package app.cena

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicBoolean

interface SeriesSource {
    fun snapshot():JSONObject
    fun progress(id:String):JSONObject
    fun episode(id:String,season:Int,number:Int):JSONObject
}
class TraktSeriesSource(private val repo:TraktRepository):SeriesSource {
    override fun snapshot()=repo.seriesSnapshot()
    override fun progress(id:String)=repo.seriesRead("/shows/$id/progress/watched?hidden=false&specials=false&count_specials=false")
    override fun episode(id:String,season:Int,number:Int)=repo.seriesRead("/shows/$id/seasons/$season/episodes/$number?extended=full")
}
object SeriesProgress {
    const val INTERVAL=12*60*60*1000L
    fun parse(id:String,raw:JSONObject,nextDetails:JSONObject?,previous:JSONObject?,historyKey:String,now:Long):JSONObject {
        require(raw.has("aired")&&raw.has("completed")){"Progresso indisponível."}
        val aired=raw.getInt("aired").coerceAtLeast(0);val completed=raw.getInt("completed").coerceAtLeast(0);val available=(aired-completed).coerceAtLeast(0)
        val next=raw.optJSONObject("next_episode")
        val safeNext=if(next!=null&&next.optInt("season")>0&&next.optInt("number")>0){
            val details=nextDetails?.takeIf{it.optInt("season")==next.optInt("season")&&it.optInt("number")==next.optInt("number")}
            JSONObject().put("season",next.getInt("season")).put("number",next.getInt("number")).put("title",(details?.optString("title")?:next.optString("title")).take(250)).put("firstAired",details?.optString("first_aired")?:next.optString("first_aired"))
        }else JSONObject()
        val previousNew=if(previous?.optString("historyKey")==historyKey)(previous?.optInt("newEpisodes")?:0)else 0
        val newlyAired=if(previous!=null&&previous.optLong("checkedAt")>0)(aired-previous.optInt("aired")).coerceAtLeast(0)else 0
        return JSONObject().put("id",id).put("aired",aired).put("completed",completed).put("available",available)
            .put("next",safeNext).put("newEpisodes",minOf(available,previousNew+newlyAired)).put("checkedAt",now).put("historyKey",historyKey).put("error","")
    }
}
class SeriesRepository(context:Context,private val source:SeriesSource=TraktSeriesSource(TraktRepository(context)),private val now:()->Long={System.currentTimeMillis()},private val changed:()->Unit={}) {
    companion object {private val lock=Any();private val running=AtomicBoolean(false)}
    private val vault=TraktVault(context,"cena.series.v1","Trakt")
    private fun rows(value:JSONArray?)=(0 until (value?.length()?:0)).mapNotNull{value?.optJSONObject(it)}
    fun status():JSONObject {val snapshot=source.snapshot();return synchronized(lock){val state=vault.read();val matching=snapshot.optBoolean("connected")&&snapshot.optString("account")==state.optString("account");JSONObject().put("source","Trakt").put("connected",snapshot.optBoolean("connected")).put("account",snapshot.optString("account")).put("reading",running.get()).put("lastCheck",if(matching)state.optLong("lastCheck")else 0).put("pending",if(matching)state.optInt("pending")else 0).put("error",if(matching)state.optString("error")else "").put("items",if(matching)state.optJSONArray("items")?:JSONArray()else JSONArray()).put("intervalHours",12)}}
    fun clear()=synchronized(lock){vault.clear()}
    /** At most twenty due shows per pass; continuations finish large libraries without blocking UI. */
    fun refresh(force:Boolean=false):Boolean {
        if(!running.compareAndSet(false,true))return false
        try{
            val snapshot=source.snapshot();if(!snapshot.optBoolean("connected")){clear();return false}
            val account=snapshot.optString("account");val requested=rows(snapshot.optJSONArray("series")).filter{Regex("tt\\d{5,12}").matches(it.optString("id"))}.distinctBy{it.getString("id")}.sortedWith(compareByDescending<JSONObject>{it.optInt("episodes")>0}.thenByDescending{it.optString("watchedAt")})
            var state=synchronized(lock){vault.read()}
            if(state.optString("account")!=account)state=JSONObject().put("account",account)
            val ids=requested.map{it.getString("id")}.toSet()
            val stored=rows(state.optJSONArray("items")).filter{it.optString("id") in ids}.associateBy{it.getString("id")}.toMutableMap()
            val forced=if(force)ids.toMutableSet()else (0 until (state.optJSONArray("forceIds")?.length()?:0)).mapNotNull{state.optJSONArray("forceIds")?.optString(it)}.filter{it in ids}.toMutableSet()
            fun history(row:JSONObject)=row.optString("watchedAt")+":"+row.optInt("episodes")
            fun due(row:JSONObject):Boolean {val old=stored[row.getString("id")];return old==null||(force||now()>=old.optLong("retryAt"))&&(row.getString("id") in forced||now()-old.optLong("checkedAt")>=SeriesProgress.INTERVAL||old.optString("historyKey")!=history(row))}
            val pending=requested.filter(::due).sortedBy{if(stored[it.getString("id")]?.optString("historyKey")!=history(it))0 else 1};state.put("pending",pending.size).put("error","").put("forceIds",JSONArray(forced.toList()))
            synchronized(lock){state.put("items",JSONArray(stored.values.toList()));vault.write(state)};changed()
            for(row in pending.take(20)){
                if(Thread.currentThread().isInterrupted)return requested.any(::due)
                val id=row.getString("id")
                // A disconnect/account switch must never repopulate the prior account's cache.
                val current=source.snapshot();if(!current.optBoolean("connected")||current.optString("account")!=account){clear();return false}
                try{
                    val progress=source.progress(id);val next=progress.optJSONObject("next_episode")
                    var warning="";val details=if(next!=null&&next.optInt("season")>0&&next.optInt("number")>0)try{source.episode(id,next.getInt("season"),next.getInt("number"))}catch(_:Exception){warning="A data do próximo episódio ainda não foi confirmada.";null}else null
                    stored[id]=SeriesProgress.parse(id,progress,details,stored[id],history(row),now()).put("warning",warning).put("name",row.optString("name",id)).put("year",row.opt("year")?:"").put("watchedAt",row.optString("watchedAt")).put("source","Trakt")
                }catch(_:Exception){
                    val old=stored[id]?.let{JSONObject(it.toString())}?:JSONObject().put("id",id).put("checkedAt",0)
                    stored[id]=old.put("error","Não consegui atualizar esta série. Os dados anteriores foram preservados.").put("retryAt",now()+15*60*1000L)
                    state.put("error","Algumas séries aguardam nova consulta. Confira a conexão e a autorização Trakt.")
                }
                val confirmed=source.snapshot();if(!confirmed.optBoolean("connected")||confirmed.optString("account")!=account){clear();return false}
                forced.remove(id);state.put("forceIds",JSONArray(forced.toList()))
                state.put("items",JSONArray(stored.values.toList())).put("pending",requested.count(::due)).put("lastCheck",now())
                synchronized(lock){vault.write(state)};changed()
            }
            state.put("items",JSONArray(stored.values.toList())).put("pending",requested.count(::due))
            synchronized(lock){vault.write(state)}
            return requested.any(::due)
        }catch(_:Exception){synchronized(lock){val state=vault.read();state.put("error","Não consegui consultar as séries. Tente novamente mais tarde.");vault.write(state)};return false}
        finally{running.set(false);changed()}
    }
}
