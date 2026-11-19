package app.cena

import android.app.Activity
import org.json.JSONObject
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

internal object StreamingPolicy {
    fun posterPath(value:String)=value.takeIf{it.matches(Regex("/[A-Za-z0-9_.-]{1,120}\\.(jpg|png)"))}.orEmpty()
    fun nextBrazilianCinemaDate(data:JSONObject,today:java.time.LocalDate):String {
        val countries=data.optJSONArray("results")?:return ""
        val brazil=(0 until countries.length()).mapNotNull{countries.optJSONObject(it)}.firstOrNull{it.optString("iso_3166_1")=="BR"}
        val releases=brazil?.optJSONArray("release_dates")?:return ""
        return (0 until releases.length()).mapNotNull{releases.optJSONObject(it)}.filter{it.optInt("type") in 2..3}
            .mapNotNull{runCatching{java.time.LocalDate.parse(it.optString("release_date").take(10))}.getOrNull()}
            .filter{it>=today}.minOrNull()?.toString().orEmpty()
    }
    fun select(data:JSONObject?):JSONObject {
        val platforms=listOf("flatrate","free","ads").mapNotNull{data?.optJSONArray(it)}.firstOrNull{it.length()>0}
        val first=platforms?.optJSONObject(0);val logo=first?.optString("logo_path").orEmpty()
        val groups=JSONObject()
        for(mode in listOf("flatrate","free","ads","rent","buy")){
            val options=data?.optJSONArray(mode)?:continue
            val names=(0 until options.length()).mapNotNull{i->options.optJSONObject(i)?.optString("provider_name")?.trim()?.take(60)?.takeIf{it.isNotEmpty()}}.distinct().take(12)
            if(names.isNotEmpty())groups.put(mode,JSONArray(names))
        }
        return JSONObject().put("name",first?.optString("provider_name").orEmpty())
            .put("logo",logo.takeIf{it.matches(Regex("/[A-Za-z0-9_.-]{1,120}\\.png"))}.orEmpty()).put("groups",groups)
    }
}

/** The user's TMDB key stays encrypted on the device and is never returned to the WebView. */
class StreamingProviders(private val activity:Activity,private val notify:(JSONObject)->Unit){
    private val vault=TraktVault(activity.applicationContext,"cena.tmdb.v1","TMDB")
    private val executor=Executors.newSingleThreadExecutor()
    private val cache=mutableMapOf<String,Pair<Long,JSONObject>>()
    private fun emit(value:JSONObject)=activity.runOnUiThread{if(!activity.isFinishing&&!activity.isDestroyed)notify(value)}
    private fun key()=vault.read().optString("key")
    fun status(){executor.execute{emit(JSONObject().put("kind","status").put("configured",key().isNotBlank()))}}
    private fun get(path:String,apiKey:String):JSONObject{
        require(apiKey.matches(Regex("[A-Fa-f0-9]{32}")))
        val join=if(path.contains('?'))"&" else "?"
        val c=(URL("https://api.themoviedb.org/3/$path${join}api_key=$apiKey").openConnection() as HttpURLConnection).apply{connectTimeout=10000;readTimeout=15000;instanceFollowRedirects=false;setRequestProperty("Accept","application/json")}
        try{check(c.responseCode==200);val out=java.io.ByteArrayOutputStream();c.inputStream.use{input->val buffer=ByteArray(8192);while(true){val n=input.read(buffer);if(n<0)break;require(out.size()+n<=2_000_000);out.write(buffer,0,n)}};return JSONObject(out.toString("UTF-8"))}finally{c.disconnect()}
    }
    fun configure(value:String){executor.execute{try{val clean=value.trim();require(clean.matches(Regex("[A-Fa-f0-9]{32}")));get("configuration",clean);vault.write(JSONObject().put("key",clean));cache.clear();emit(JSONObject().put("kind","status").put("configured",true).put("message","TMDB conectado."))}catch(_:Exception){emit(JSONObject().put("kind","status").put("configured",key().isNotBlank()).put("message","Não consegui validar a chave TMDB. Confira a chave e a internet."))}}}
    fun find(id:String,type:String){
        if(!id.matches(Regex("tt\\d{5,12}"))||type !in setOf("movie","series"))return
        executor.execute{val apiKey=key();if(apiKey.isBlank())return@execute
            val cacheKey="$type:$id";val old=cache[cacheKey];if(old!=null&&System.currentTimeMillis()-old.first<24*3600000L){emit(old.second);return@execute}
            try{
                val result=get("find/$id?external_source=imdb_id",apiKey)
                val values=result.optJSONArray(if(type=="movie")"movie_results" else "tv_results")
                val match=values?.optJSONObject(0);val tmdb=match?.optLong("id")?:0L;require(tmdb>0)
                val kind=if(type=="movie")"movie" else "tv"
                val data=get("$kind/$tmdb/watch/providers",apiKey).optJSONObject("results")?.optJSONObject("BR")
                val response=StreamingPolicy.select(data).put("kind","provider").put("id",id).put("type",type).put("poster",StreamingPolicy.posterPath(match?.optString("poster_path").orEmpty()))
                cache[cacheKey]=System.currentTimeMillis() to response;emit(response)
            }catch(_:Exception){emit(JSONObject().put("kind","provider").put("id",id).put("type",type).put("error",true))}
        }
    }
    fun findCinema(id:String){
        if(!id.matches(Regex("tt\\d{5,12}")))return
        executor.execute{
            val apiKey=key()
            if(apiKey.isBlank())return@execute
            val result=JSONObject().put("kind","cinema").put("id",id).put("type","movie")
            try{
                val tmdb=get("find/$id?external_source=imdb_id",apiKey).optJSONArray("movie_results")?.optJSONObject(0)?.optLong("id")?:0
                require(tmdb>0)
                val today=java.time.LocalDate.now(java.time.ZoneId.of("America/Sao_Paulo"))
                val date=StreamingPolicy.nextBrazilianCinemaDate(get("movie/$tmdb/release_dates",apiKey),today)
                result.put("date",date)
            }catch(_:Exception){result.put("error",true)}
            emit(result)
        }
    }
    fun close(){executor.shutdownNow()}
}
