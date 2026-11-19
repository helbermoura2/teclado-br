package app.cena

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.ZoneId
import java.util.concurrent.atomic.AtomicBoolean

interface WatchHistorySource {
 fun snapshot():JSONObject
 fun owner():String
 fun page(owner:String,page:Int):TraktResponse
 fun activities(owner:String):String
 fun expectedPlays(owner:String):Long
}
class TraktHistorySource(private val repo:TraktRepository):WatchHistorySource {
 override fun snapshot()=repo.historySnapshot()
 override fun owner()=repo.historyOwner()
 override fun page(owner:String,page:Int)=repo.historyRead(owner,"events",page)
 override fun activities(owner:String):String {val raw=JSONObject(repo.historyRead(owner,"activities").body);return raw.optJSONObject("movies")?.optString("watched_at").orEmpty()+"|"+raw.optJSONObject("episodes")?.optString("watched_at").orEmpty()}
 override fun expectedPlays(owner:String):Long {val raw=JSONObject(repo.historyRead(owner,"stats").body);val movies=raw.optJSONObject("movies");val episodes=raw.optJSONObject("episodes");return if(movies?.has("plays")==true&&episodes?.has("plays")==true)movies.optLong("plays")+episodes.optLong("plays")else -1}
}
enum class HistoryPass { COMPLETE,MORE,FAILED }
class WatchHistoryRepository(context:Context,private val source:WatchHistorySource=TraktHistorySource(TraktRepository(context)),private val now:()->Long=System::currentTimeMillis,private val store:WatchHistoryStore=WatchHistoryStore(context)):java.io.Closeable {
 companion object {private val running=AtomicBoolean(false);private val lock=Any();const val INTERVAL=12*60*60*1000L}
 private val preferences=context.getSharedPreferences("cena.history.selection.v1",Context.MODE_PRIVATE)
 private var memoKey="";private var memo=JSONObject()
 private fun ownerForView():String {val snapshot=source.snapshot();return if(snapshot.optBoolean("connected"))snapshot.optString("account")else preferences.getString("account","").orEmpty()}
 private fun scope(owner:String)=java.security.MessageDigest.getInstance("SHA-256").digest(owner.toByteArray()).joinToString(""){"%02x".format(it)}.take(24)
 private fun safe(error:Exception)=error.message?.takeIf{text->listOf("Conecte","O Trakt","A conta","A autorização","Histórico","Não consegui","Sua autorização").any{text.startsWith(it)}}?.take(250)?:"Não consegui importar o histórico agora. Os registros já salvos foram preservados."
 fun status():JSONObject {
  val snapshot=source.snapshot();val owner=ownerForView();val meta=if(owner.isBlank())JSONObject()else store.meta(owner)
  val revision=owner+":"+meta.optLong("lastImport")+":"+ZoneId.systemDefault().id
  if(revision!=memoKey){memo=WatchHistoryCodec.summary(if(owner.isBlank())emptyList()else store.rows(owner));memoKey=revision}
  return JSONObject(memo.toString()).put("scope",if(owner.isBlank())"" else scope(owner)).put("connected",snapshot.optBoolean("connected")).put("account",meta.optString("username",snapshot.optString("username"))).put("lastImport",meta.optLong("lastImport"))
   .put("importing",running.get()||meta.optBoolean("pending")).put("page",meta.optInt("nextPage",1)-1).put("pages",meta.optInt("pages")).put("processed",meta.optInt("processed")).put("expected",meta.optLong("expected",-1)).put("coverage",meta.optString("coverage","unverified"))
   .put("error",meta.optString("error",preferences.getString("error","").orEmpty())).put("invalid",meta.optInt("invalid"))
 }
 fun moviePeriod(period:String):JSONObject {
  val owner=ownerForView()
  val rows=if(owner.isBlank())emptyList()else store.rows(owner)
  return WatchHistoryCodec.moviePeriod(rows,period).put("scope",if(owner.isBlank())""else scope(owner))
 }
 fun page(year:String,kind:String,page:Int,mediaId:String=""):JSONObject {val owner=ownerForView();require(page in 1..100000);return (if(owner.isBlank())JSONObject().put("rows",JSONArray()).put("total",0).put("page",page).put("hasMore",false)else store.page(owner,year,kind,page,mediaId)).put("scope",if(owner.isBlank())""else scope(owner))}
 fun importBatch(force:Boolean=false):HistoryPass {
  if(!running.compareAndSet(false,true))return HistoryPass.COMPLETE
  var owner="";var meta=JSONObject()
  try{return synchronized(lock){
   if(!source.snapshot().optBoolean("connected"))return@synchronized HistoryPass.COMPLETE
   owner=source.owner();check(owner.isNotBlank()){"Não consegui identificar a conta Trakt."};meta=store.meta(owner)
   preferences.edit().putString("account",owner).remove("error").apply()
   if(!force&&!meta.optBoolean("pending")&&!meta.optBoolean("retryRequired")&&meta.optLong("lastImport")>0&&now()>=meta.optLong("lastImport")&&now()-meta.optLong("lastImport")<INTERVAL)return@synchronized HistoryPass.COMPLETE
   if(!meta.optBoolean("pending")){
    val expected=try{source.expectedPlays(owner)}catch(_:Exception){-1}
    meta.put("pending",true).put("nextPage",1).put("pages",0).put("processed",0).put("invalid",0).put("startedAt",now()).put("expected",expected).put("fingerprint",source.activities(owner)).put("error","").put("retryRequired",false).put("username",source.snapshot().optString("username"))
    store.begin(owner,meta)
   }
   var processedPages=0
   while(processedPages<20){
    check(source.snapshot().optBoolean("connected")&&source.snapshot().optString("account")==owner){"A conta Trakt mudou. Inicie a importação novamente."}
    val page=meta.optInt("nextPage",1);val reply=source.page(owner,page);check(reply.status in 200..299){"O Trakt não devolveu o histórico (${reply.status})."};check(reply.pages in 1..1000){"Histórico muito extenso. A importação não foi concluída."}
    if(page>1&&reply.pages!=meta.optInt("pages")){meta.put("pending",false).put("retryRequired",true);throw IllegalStateException("Histórico alterado durante a importação. Vou consultar novamente.")}
    val raw=JSONArray(reply.body);val parsed=mutableListOf<JSONObject>();var invalid=0
    for(index in 0 until raw.length()){val row=raw.optJSONObject(index);val value=if(row!=null)WatchHistoryCodec.parse(row)else null;if(value==null)invalid++ else parsed.add(value)}
    meta.put("pages",reply.pages).put("nextPage",page+1).put("processed",meta.optInt("processed")+raw.length()).put("invalid",meta.optInt("invalid")+invalid).put("headerTotal",reply.itemCount).put("error","")
    store.stage(owner,parsed,meta);processedPages++
    if(page>=reply.pages){
     if(source.activities(owner)!=meta.optString("fingerprint")){meta.put("pending",false).put("retryRequired",true);throw IllegalStateException("Histórico alterado durante a importação. Vou consultar novamente.")}
     val count=meta.optLong("processed");val expected=meta.optLong("expected",-1);val header=meta.optLong("headerTotal",-1)
     val coverage=when{meta.optInt("invalid")>0||expected>=0&&count<expected||header>=0&&count<header->"partial";expected>=0&&count==expected||header>=0&&count==header->"complete";else->"unverified"}
     meta.put("pending",false).put("retryRequired",false).put("lastImport",now()).put("coverage",coverage).put("error","");store.commit(owner,meta);return@synchronized HistoryPass.COMPLETE
    }
   };HistoryPass.MORE
  }}catch(error:Exception){val message=safe(error);if(owner.isNotBlank()){meta.put("error",message);store.setMeta(owner,meta)}else preferences.edit().putString("error",message).apply();return HistoryPass.FAILED}
  finally{running.set(false)}
 }
 fun export():JSONObject {val owner=ownerForView();check(owner.isNotBlank()){"Nenhum histórico local para exportar."};return JSONObject().put("format","cena-watch-history").put("version",1).put("source","Trakt").put("exportedAt",java.time.Instant.ofEpochMilli(now()).toString()).put("account",store.meta(owner).optString("username")).put("events",JSONArray(store.rows(owner)))}
 override fun close(){store.close()}
}
