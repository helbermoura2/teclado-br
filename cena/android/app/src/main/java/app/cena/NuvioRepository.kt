package app.cena

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

internal const val NUVIO_BASE="https://api.nuvio.tv"
// Public client key, published by the Nuvio browser bridge; never a user/service-role secret.
internal const val NUVIO_PUBLIC_KEY="sb_publishable_1Clq8rlTVACkdcZuqr6_AD__xUUC_EN"
data class NuvioResponse(val code:Int,val body:String)
fun interface NuvioTransport {fun request(path:String,body:JSONObject?,token:String?):NuvioResponse}
class NuvioHttp:NuvioTransport {
 override fun request(path:String,body:JSONObject?,token:String?):NuvioResponse {
  require(path.startsWith("/")&&!path.startsWith("//")&&!path.contains(".."))
  val connection=(URL(NUVIO_BASE+path).openConnection() as HttpURLConnection).apply{
   requestMethod=if(body==null)"GET" else "POST";connectTimeout=10000;readTimeout=20000;instanceFollowRedirects=false
   setRequestProperty("Accept","application/json");setRequestProperty("Content-Type","application/json");setRequestProperty("apikey",NUVIO_PUBLIC_KEY);setRequestProperty("User-Agent","CENA/0.10.0")
   if(token!=null)setRequestProperty("Authorization","Bearer $token")
  }
  try{
   if(body!=null){connection.doOutput=true;connection.outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}}
   val code=connection.responseCode;val stream=if(code in 200..299)connection.inputStream else connection.errorStream
   val bytes=stream?.use{input->val output=java.io.ByteArrayOutputStream();val buffer=ByteArray(8192);while(true){val count=input.read(buffer);if(count<0)break;require(output.size()+count<=4*1024*1024);output.write(buffer,0,count)};output.toByteArray()}?:ByteArray(0)
   return NuvioResponse(code,String(bytes,Charsets.UTF_8))
  }finally{connection.disconnect()}
 }
}

class NuvioRepository(context:Context,private val transport:NuvioTransport=NuvioHttp(),private val now:()->Long=System::currentTimeMillis){
 private val auth=TraktVault(context,"cena.nuvio.auth.v1","Nuvio")
 private val data=TraktVault(context,"cena.nuvio.data.v1","Nuvio")
 private val inventory=context.getSharedPreferences("cena.nuvio.inventory.v1",Context.MODE_PRIVATE)
 companion object {private val lock=Any()}
 private fun failure(message:String):Nothing=throw IllegalStateException(message)
 private fun array(body:String):JSONArray=try{JSONArray(body)}catch(_:Exception){failure("O Nuvio mudou o formato da resposta. [NUVIO_FORMATO]")}
 private fun objectBody(body:String):JSONObject=try{JSONObject(body)}catch(_:Exception){failure("Resposta de login Nuvio incompatível. [NUVIO_FORMATO]")}
 private fun rpc(name:String,params:JSONObject=JSONObject(),token:String?=null):JSONArray {
  val reply=transport.request("/rest/v1/rpc/$name",params,token);checkReply(reply);return array(reply.body)
 }
 private fun checkReply(reply:NuvioResponse){if(reply.code !in 200..299)failure(when(reply.code){
  400,404->"Esta função da API Nuvio não está disponível para esta conexão. [NUVIO_API_${reply.code}]"
  401,403->"A sessão Nuvio expirou ou este perfil exige autorização. Reconecte sua conta. [NUVIO_AUTH_${reply.code}]"
  429->"O Nuvio limitou as consultas. Aguarde alguns minutos. [NUVIO_LIMITE]"
  else->"Não consegui consultar o Nuvio agora. Os dados anteriores foram mantidos. [NUVIO_HTTP_${reply.code}]"
 })}
 private fun safeError(error:Exception)=error.message?.takeIf{it.startsWith("O Nuvio")||it.startsWith("A sessão")||it.startsWith("Esta função")||it.startsWith("Não consegui")||it.startsWith("Resposta de")||it.startsWith("Escolha")||it.startsWith("Perfil")||it.startsWith("A autorização")}?:"Não consegui acessar o Nuvio. Confira a conexão e tente novamente. [NUVIO_REDE]"
 fun inventory(raw:String)=synchronized(lock){val rows=JSONArray(raw);require(rows.length()<=5000);val safe=JSONArray();for(i in 0 until rows.length()){val item=rows.optJSONObject(i)?:continue;if(item.optString("id").matches(Regex("tt\\d{5,12}"))&&item.optString("type") in listOf("movie","series"))safe.put(JSONObject().put("id",item.optString("id")).put("type",item.optString("type")))};inventory.edit().putString("items",safe.toString()).apply()}
 fun status():JSONObject=synchronized(lock){
  val a=auth.read();val d=data.read();val connected=a.optString("access").isNotBlank();val selected=a.optInt("profile",0);val active=connected&&a.optBoolean("active")&&selected>0
  val known=mutableSetOf<String>();try{val list=JSONArray(inventory.getString("items","[]"));for(i in 0 until list.length()){val row=list.optJSONObject(i)?:continue;known.add(row.optString("type")+":"+row.optString("id"))}}catch(_:Exception){}
  val watched=d.optJSONArray("watched")?:JSONArray();val filtered=JSONArray();val recent=JSONArray();var unsupported=0
  for(i in 0 until watched.length()){val row=watched.optJSONObject(i)?:continue;if(row.optString("id").isBlank()){unsupported++;continue};if(known.contains(row.optString("type")+":"+row.optString("id")))filtered.put(row);}
  (0 until watched.length()).mapNotNull{watched.optJSONObject(it)}.filter{it.optString("id").isNotBlank()}.sortedByDescending{it.optLong("watchedAt")}.take(50).forEach{recent.put(it)}
  val shows=linkedMapOf<String,JSONObject>();val episodeKeys=mutableMapOf<String,MutableSet<String>>();val finished=mutableSetOf<String>()
  for(i in 0 until watched.length()){val row=watched.optJSONObject(i)?:continue;val id=row.optString("id");if(id.isBlank())continue;finished.add(row.optString("type")+":"+id+":"+row.optInt("season")+":"+row.optInt("episode"));if(row.optString("type")=="series"&&row.optInt("season")>0&&row.optInt("episode")>0){val keys=episodeKeys.getOrPut(id){linkedSetOf()};keys.add("${row.optInt("season")}:${row.optInt("episode")}");val show=shows.getOrPut(id){JSONObject().put("id",id).put("type","series").put("name",row.optString("name",id)).put("watchedAt",0)};show.put("watchedAt",maxOf(show.optLong("watchedAt"),row.optLong("watchedAt")))}}
  for((id,show)in shows){show.put("episodes",episodeKeys[id]?.size?:0).put("seen",JSONArray(episodeKeys[id]?.toList()?:emptyList<String>()))}
  val progress=d.optJSONArray("progress")?:JSONArray();val resume=JSONArray();for(i in 0 until progress.length()){val row=progress.optJSONObject(i)?:continue;if(row.optString("id").isBlank()){unsupported++;continue};if(resume.length()<100&&row.optString("type")+":"+row.optString("id")+":"+row.optInt("season")+":"+row.optInt("episode") !in finished)resume.put(row)}
  val output=JSONObject().put("connected",connected).put("active",active).put("profileId",selected).put("profiles",a.optJSONArray("profiles")?:JSONArray()).put("profileName",a.optString("profileName")).put("account",a.optString("account"))
   .put("scope",java.security.MessageDigest.getInstance("SHA-256").digest((a.optString("uid")+":"+selected).toByteArray()).joinToString(""){"%02x".format(it)}.take(24)).put("lastSync",if(d.optInt("profile")==selected)d.optLong("lastSync") else 0).put("error",a.optString("error")).put("series",if(active&&d.optInt("profile")==selected)JSONArray(shows.values.sortedByDescending{it.optLong("watchedAt")})else JSONArray()).put("watchedCount",watched.length()).put("unsupported",unsupported).put("watched",if(active&&d.optInt("profile")==selected)filtered else JSONArray()).put("recent",if(active&&d.optInt("profile")==selected)recent else JSONArray()).put("progress",if(active&&d.optInt("profile")==selected)resume else JSONArray())
  if(active&&d.optInt("profile")==selected)output.put("statistics",NuvioCodec.statistics(watched))
  if(!connected&&a.optLong("pairExpires")>now())output.put("pairing",true).put("userCode",a.optString("userCode")).put("verificationUrl",a.optString("verificationUrl"))
  output
 }
 fun begin()=synchronized(lock){
  val previous=auth.read();if(previous.optString("access").isNotBlank())return@synchronized
  try{
   val nonce=UUID.randomUUID().toString();val rows=rpc("start_device_login_session",JSONObject().put("p_device_nonce",nonce).put("p_redirect_base_url","https://nuvio.tv/link").put("p_device_name","CENA IA").put("p_device_type","mobile"));val row=rows.optJSONObject(0)?:failure("Resposta de login Nuvio incompatível. [NUVIO_LOGIN]")
   val url=URL(row.optString("verification_uri_complete"));require(url.protocol=="https"&&url.host in listOf("nuvio.tv","www.nuvio.tv")&&url.userInfo==null&&url.path in listOf("/link","/tv-login"))
   val device=row.optString("device_code");val code=row.optString("user_code");require(device.length in 6..512&&code.matches(Regex("[A-Za-z0-9-]{4,16}")))
   auth.write(JSONObject().put("nonce",nonce).put("device",device).put("userCode",code).put("verificationUrl",url.toString()).put("pairExpires",now()+600000).put("pollInterval",row.optInt("poll_interval_seconds",3).coerceIn(3,10)*1000).put("pollAt",0))
  }catch(e:Exception){auth.write(previous.put("error",safeError(e)))}
 }
 fun poll()=synchronized(lock){
  var a=auth.read();if(a.optString("access").isNotBlank()||a.optString("device").isBlank())return@synchronized
  if(a.optLong("pairExpires")<=now()){auth.write(JSONObject().put("error","A autorização expirou. Gere outro código. [NUVIO_EXPIRADO]"));return@synchronized}
  if(now()-a.optLong("pollAt")<a.optInt("pollInterval",3000))return@synchronized
  a.put("pollAt",now());auth.write(a)
  try{
   val rows=rpc("poll_tv_login_session",JSONObject().put("p_code",a.optString("device")).put("p_device_nonce",a.optString("nonce")));val result=rows.optJSONObject(0)?:failure("Resposta de login Nuvio incompatível. [NUVIO_LOGIN]")
   when(result.optString("status").lowercase()){
    "pending"->{a.remove("error");auth.write(a)}
    "approved"->{val reply=transport.request("/functions/v1/tv-logins-exchange",JSONObject().put("code",a.optString("device")).put("device_nonce",a.optString("nonce")),null);checkReply(reply);val session=objectBody(reply.body);val next=sessionData(session)
     auth.write(next);try{loadProfiles(next)}catch(e:Exception){auth.write(next.put("error",safeError(e)))}
    }
    else->auth.write(JSONObject().put("error","A autorização foi encerrada. Gere outro código. [NUVIO_EXPIRADO]"))
   }
  }catch(e:Exception){a=auth.read();auth.write(a.put("error",safeError(e)))}
 }
 private fun sessionData(session:JSONObject):JSONObject {
  val access=session.optString("access_token");val refresh=session.optString("refresh_token");require(access.length in 10..16000&&refresh.length in 10..16000&&!access.contains('\n')&&!refresh.contains('\n'))
  val seconds=session.optLong("expires_in");require(seconds in 1..2592000)
  var user=session.optJSONObject("user");if(user==null){val reply=transport.request("/auth/v1/user",null,access);checkReply(reply);user=objectBody(reply.body)}
  val safeUser=user?:failure("Resposta de login Nuvio incompatível. [NUVIO_USUARIO]");require(safeUser.optString("id").isNotBlank());return JSONObject().put("uid",safeUser.optString("id")).put("access",access).put("refresh",refresh).put("expires",now()+seconds*1000).put("account",safeUser.optString("email", "Conta Nuvio").take(120)).put("profiles",JSONArray()).put("active",false)
 }
 private fun token(a:JSONObject):String {
  if(a.optLong("expires")>now()+60000)return a.optString("access")
  val reply=transport.request("/auth/v1/token?grant_type=refresh_token",JSONObject().put("refresh_token",a.optString("refresh")),null);checkReply(reply);val session=objectBody(reply.body)
  val refreshed=sessionData(session);require(refreshed.optString("uid")==a.optString("uid"));for(key in listOf("access","refresh","expires","account"))a.put(key,refreshed.get(key));auth.write(a);return a.optString("access")
 }
 private fun loadProfiles(a:JSONObject){
  val rows=rpc("sync_pull_profiles",token=token(a));val safe=JSONArray()
  for(i in 0 until rows.length()){val row=rows.optJSONObject(i)?:continue;val id=row.optInt("profile_index",0);if(id in 1..100)safe.put(JSONObject().put("id",id).put("name",row.optString("name","Perfil $id").take(100)).put("locked",row.optBoolean("has_pin")||row.optBoolean("is_locked")))}
  if(safe.length()==0)failure("Escolha um perfil criado na conta Nuvio. [NUVIO_PERFIS]");a.put("profiles",safe).remove("error");auth.write(a)
 }
 fun profiles()=synchronized(lock){val a=auth.read();try{loadProfiles(a)}catch(e:Exception){auth.write(a.put("error",safeError(e)))}}
 fun selectProfile(id:Int)=synchronized(lock){val a=auth.read();val rows=a.optJSONArray("profiles")?:JSONArray();var selected:JSONObject?=null;for(i in 0 until rows.length()){val row=rows.getJSONObject(i);if(row.optInt("id")==id)selected=row};require(selected!=null&&!selected.optBoolean("locked"));a.put("profile",id).put("profileName",selected.optString("name")).put("active",true).remove("error");auth.write(a);if(data.read().optInt("profile")!=id)data.write(JSONObject().put("profile",id));sync(true)}
 fun pairing():Boolean=synchronized(lock){val a=auth.read();a.optString("access").isBlank()&&a.optString("device").isNotBlank()}
 fun enabled():Boolean=synchronized(lock){val a=auth.read();a.optBoolean("active")&&a.optString("access").isNotBlank()}
 fun sync(force:Boolean=false):Boolean=synchronized(lock){
  val a=auth.read();if(!a.optBoolean("active")||a.optString("access").isBlank())return@synchronized true
  val old=data.read();if(!force&&old.optInt("profile")==a.optInt("profile")&&now()-old.optLong("lastSync")<300000)return@synchronized true
  try{
   val jwt=token(a);val profile=a.optInt("profile");val watched=JSONArray();var complete=false
   for(page in 1..40){val rows=rpc("sync_pull_watched_items",JSONObject().put("p_profile_id",profile).put("p_page",page).put("p_page_size",500),jwt);for(i in 0 until rows.length()){val row=rows.optJSONObject(i)?:continue;NuvioCodec.watched(row)?.let{watched.put(it)}};if(rows.length()<500){complete=true;break}}
   if(!complete)failure("Não consegui concluir a leitura do histórico Nuvio. Os dados anteriores foram mantidos. [NUVIO_PAGINACAO]")
   val rows=rpc("sync_pull_watch_progress",JSONObject().put("p_profile_id",profile),jwt);require(rows.length()<=10000);val progress=JSONArray();for(i in 0 until rows.length()){val row=rows.optJSONObject(i)?:continue;NuvioCodec.progress(row)?.let{progress.put(it)}}
   data.write(JSONObject().put("profile",profile).put("lastSync",now()).put("watched",watched).put("progress",progress));a.remove("error");auth.write(a);true
  }catch(e:Exception){auth.write(a.put("error",safeError(e)));false}
 }
 fun disconnect()=synchronized(lock){auth.clear();data.clear()}
}

internal object NuvioCodec {
 private class WatchTotals {
  val movies=mutableSetOf<String>()
  val series=mutableSetOf<String>()
  val episodes=mutableSetOf<String>()
  fun add(row:JSONObject) {
   val id=row.optString("id")
   if(row.optString("type")=="movie")movies.add(id)
   else {
    series.add(id)
    episodes.add("$id:${row.optInt("season")}:${row.optInt("episode")}")
   }
  }
  private val weekdays=mutableMapOf<Int,WatchTotals>()
  fun addWeekday(day:Int,row:JSONObject){weekdays.getOrPut(day){WatchTotals()}.add(row)}
  fun json()=JSONObject().put("movies",movies.size).put("series",series.size)
   .put("episodes",episodes.size).put("plays",movies.size+episodes.size)
   .put("weekdays",JSONObject()
    .put("movies",JSONArray((1..7).map{weekdays[it]?.movies?.size?:0}))
    .put("episodes",JSONArray((1..7).map{weekdays[it]?.episodes?.size?:0})))
 }
 fun statistics(watched:JSONArray):JSONObject {
  val totals=WatchTotals()
  val unknown=WatchTotals()
  val years=sortedMapOf<Int,WatchTotals>(compareByDescending{it})
  val media=linkedMapOf<Pair<String,String>,JSONObject>()
  val mediaYears=mutableMapOf<Pair<String,String>,MutableSet<Int>>()
  val timezone=java.time.ZoneId.systemDefault()
  for(index in 0 until watched.length()){
   val row=watched.optJSONObject(index)?:continue
   if(row.optString("id").isBlank())continue
   totals.add(row)
   val date=try{row.optLong("watchedAt").takeIf{it>0}?.let{java.time.Instant.ofEpochMilli(it).atZone(timezone)}}catch(_:java.time.DateTimeException){null}
   val key=row.optString("type") to row.optString("id")
   val title=media.getOrPut(key){JSONObject().put("type",key.first).put("id",key.second)}
   if(date!=null&&date.year in 1..9999){
    val annual=years.getOrPut(date.year){WatchTotals()}
    annual.add(row)
    annual.addWeekday(date.dayOfWeek.value,row)
    totals.addWeekday(date.dayOfWeek.value,row)
    mediaYears.getOrPut(key){sortedSetOf()}.add(date.year)
   }else{
    unknown.add(row)
    title.put("unknownDates",true)
   }
  }
  for((key,title) in media)title.put("years",JSONArray(mediaYears[key].orEmpty()))
  return JSONObject().put("media",JSONArray(media.values)).put("origin","Nuvio").put("totals",totals.json().put("unknownDates",unknown.json().optInt("plays")))
   .put("unknown",unknown.json()).put("years",JSONArray(years.map{(year,counts)->counts.json().put("year",year)}))
 }
 private fun base(row:JSONObject):JSONObject? {
  val source=row.optString("content_id");val type=when(row.optString("content_type")){"movie"->"movie";"series","show","tv"->"series";else->return null}
  val match=Regex("^(tt\\d{5,12})(?::(\\d+):(\\d+))?$").matchEntire(source)
  val season=if(row.isNull("season"))match?.groupValues?.getOrNull(2)?.toIntOrNull()?:0 else row.optInt("season")
  val episode=if(row.isNull("episode"))match?.groupValues?.getOrNull(3)?.toIntOrNull()?:0 else row.optInt("episode")
  if(type=="movie"&&(season>0||episode>0))return null
  return JSONObject().put("sourceId",source.take(120)).put("id",match?.groupValues?.get(1)?:"").put("type",type).put("name",row.optString("title",source).take(200)).put("season",season).put("episode",episode)
 }
 fun watched(row:JSONObject):JSONObject? {val item=base(row)?:return null;if(item.optString("type")=="series"&&(item.optInt("season")<1||item.optInt("episode")<1))return null;var at=row.optLong("watched_at");if(at in 1..9999999999L)at*=1000;if(at<=0)at=try{java.time.Instant.parse(row.optString("watched_at")).toEpochMilli()}catch(_:Exception){0L};return item.put("watchedAt",at)}
 fun progress(row:JSONObject):JSONObject? {val item=base(row)?:return null;val position=row.optLong("position");val duration=row.optLong("duration");if(position<=0||duration<0)return null;return item.put("position",if(duration>0)position.coerceAtMost(duration)else position).put("duration",duration).put("lastWatched",row.optLong("last_watched").let{if(it in 1..9999999999L)it*1000 else it})}
}

