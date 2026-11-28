package app.cena

import android.content.Context
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean

/** Only the documented core Link flow and three account-read operations are reachable. */
data class StremioResponse(val status:Int,val body:String,val retrySeconds:Long=5)
fun interface StremioTransport { fun request(method:String,path:String,body:JSONObject?):StremioResponse }
class StremioHttp : StremioTransport {
    override fun request(method:String,path:String,body:JSONObject?):StremioResponse {
        val address=when {
            method=="GET" && path=="/link/create" -> "https://link.stremio.com/api/v2/create?type=Create"
            method=="GET" && path.startsWith("/link/read?code=") -> "https://link.stremio.com/api/v2/read?type=Read&code="+Uri.encode(path.substringAfter("code="))
            method=="POST" && path in setOf("/getUser","/datastoreMeta","/datastoreGet","/datastorePut") -> "https://api.strem.io/api$path"
            else -> throw IllegalArgumentException("Operação Stremio não permitida.")
        }
        val connection=(URL(address).openConnection() as HttpURLConnection).apply {
            requestMethod=method;connectTimeout=10000;readTimeout=20000;instanceFollowRedirects=false
            useCaches=false;setRequestProperty("Cache-Control","no-store");setRequestProperty("Accept","application/json");setRequestProperty("Content-Type","application/json");setRequestProperty("User-Agent","CENA/0.6.0")
        }
        try {
            if(body!=null){connection.doOutput=true;connection.outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}}
            val status=connection.responseCode
            val stream=if(status in 200..299)connection.inputStream else connection.errorStream
            val text=stream?.use { input ->
                val bytes=java.io.ByteArrayOutputStream();val buffer=ByteArray(8192);var total=0
                while(true){val count=input.read(buffer);if(count<0)break;total+=count;require(total<=12*1024*1024);bytes.write(buffer,0,count)}
                bytes.toString("UTF-8")
            } ?: ""
            return StremioResponse(status,text,(connection.getHeaderField("Retry-After")?.toLongOrNull() ?: 5).coerceIn(5,300))
        } finally {connection.disconnect()}
    }
}

class StremioRepository(context:Context,private val transport:StremioTransport=StremioHttp(),private val now:()->Long={System.currentTimeMillis()},private val changed:()->Unit={}) {
    companion object {val lock=Any()}
    private val vault=TraktVault(context,"cena.stremio.v1","Stremio")
    private val cancelled=AtomicBoolean(false)
    init { synchronized(lock) {
        val state=vault.read()
        if(state.optBoolean("reading")){state.put("reading",false).put("error","A leitura foi interrompida. Toque em Ler biblioteca para tentar novamente.");vault.write(state)}
    } }
    private fun load()=vault.read()
    private fun save(state:JSONObject)=vault.write(state)
    fun cancelReading(){cancelled.set(true)}
    private fun clearPair(state:JSONObject){for(key in listOf("pairCode","pairLink","publicCode","pairExpires","nextPoll"))state.remove(key)}
    private fun sessionScope(state:JSONObject):String{
        val key=state.optString("authKey")
        return if(key.isBlank())"" else java.security.MessageDigest.getInstance("SHA-256")
            .digest(key.toByteArray(Charsets.UTF_8)).take(12).joinToString(""){"%02x".format(it)}
    }
    fun status():JSONObject=synchronized(lock){
        val state=load()
        JSONObject().put("connected",state.optString("authKey").isNotBlank()).put("account",state.optString("account")).put("scope",sessionScope(state))
            .put("pairing",state.optString("pairCode").isNotBlank())
            .put("reading",state.optBoolean("reading")).put("processed",state.optInt("processed")).put("total",state.optInt("total"))
            .put("lastRead",state.optLong("lastRead")).put("error",state.optString("error")).put("warning",state.optString("warning"))
            .put("library",state.optJSONArray("library") ?: JSONArray()).put("excluded",state.optInt("excluded"))
    }
    private fun envelope(response:StremioResponse):JSONObject {
        if(response.status !in 200..299)error("O Stremio não respondeu à consulta (${response.status}). Tente novamente.")
        return try{JSONObject(response.body)}catch(_:Exception){error("A resposta do Stremio não está no formato esperado.")}
    }
    fun beginLink()=synchronized(lock){
        val state=load();check(state.optString("authKey").isBlank()){ "O Stremio já está conectado." }
        try {
            val body=envelope(transport.request("GET","/link/create",null))
            check(!body.has("error")){"Não consegui gerar o link de autorização do Stremio."}
            val result=body.getJSONObject("result");val code=result.getString("code");val link=Uri.parse(result.getString("link"))
            require(code.length in 4..4096 && link.scheme=="https" && link.host=="link.stremio.com" && link.userInfo==null)
            val publicCode=link.lastPathSegment?.takeIf{Regex("[A-Za-z0-9-]{3,12}").matches(it)} ?: ""
            clearPair(state);state.put("pairCode",code).put("pairLink",link.toString()).put("publicCode",publicCode)
                .put("pairExpires",now()+10*60*1000).put("nextPoll",now()+5000).put("error","")
        }catch(_:Exception){clearPair(state);state.put("error","Não consegui iniciar a vinculação. Confira a internet e tente novamente.")}
        save(state)
    }
    fun authorizationUrl():String=synchronized(lock){
        val link=Uri.parse(load().optString("pairLink"));require(link.scheme=="https" && link.host=="link.stremio.com" && link.userInfo==null)
        link.toString()
    }
    private fun api(state:JSONObject,path:String,extra:JSONObject=JSONObject()):Any {
        check(state.optString("authKey").isNotBlank()){ "Conecte sua conta Stremio para consultar a biblioteca." }
        val body=JSONObject(extra.toString()).put("authKey",state.getString("authKey"))
        val response=transport.request("POST",path,body)
        if(response.status in setOf(401,403)){state.remove("authKey");state.remove("account");save(state);error("Sua sessão Stremio precisa ser autorizada novamente.")}
        val envelope=envelope(response)
        val failure=envelope.optJSONObject("error")
        if(failure!=null){
            val message=failure.optString("message").lowercase()
            if(message.contains("not authorized") || message.contains("invalid auth") || message.contains("invalid session")){state.remove("authKey");state.remove("account");save(state);error("Sua sessão Stremio precisa ser autorizada novamente.")}
            error("O Stremio recusou a operação (erro ${failure.optLong("code")}). Tente novamente.")
        }
        return envelope.opt("result") ?: error("O Stremio não confirmou o resultado da consulta.")
    }
    fun pollLink()=synchronized(lock){
        val state=load();val code=state.optString("pairCode");if(code.isBlank())return@synchronized
        if(now()>=state.optLong("pairExpires")){clearPair(state);state.put("error","A vinculação expirou. Gere outro link e autorize novamente.");save(state);return@synchronized}
        if(now()<state.optLong("nextPoll"))return@synchronized
        state.put("nextPoll",now()+5000)
        try {
            val response=transport.request("GET","/link/read?code=$code",null)
            if(response.status==429){state.put("nextPoll",now()+response.retrySeconds*1000);save(state);return@synchronized}
            if(response.status==410){clearPair(state);state.put("error","O link expirou. Gere outro link.");save(state);return@synchronized}
            val body=envelope(response)
            val result=body.optJSONObject("result")
            val auth=result?.optString("authKey") ?: ""
            if(auth.isNotBlank()){
                require(auth.length<=16384)
                val candidate=JSONObject(state.toString()).put("authKey",auth)
                val user=api(candidate,"/getUser") as? JSONObject ?: error("Conta não confirmada.")
                val email=user.optString("email");val account=if(email.contains('@'))email.take(1)+"***@"+email.substringAfter('@') else "Conta Stremio"
                state.put("authKey",auth).put("account",account).put("library",JSONArray()).put("lastRead",0).put("error","").put("warning","")
                clearPair(state)
            } else {
                val error=body.optJSONObject("error");val message=error?.optString("message")?.lowercase() ?: ""
                if(error?.optInt("code")!=101 && (message.contains("expired") || message.contains("not found") || message.contains("invalid code"))){clearPair(state);state.put("error","O link não está mais disponível. Gere outro link.")}
            }
        }catch(_:Exception){state.put("error","Ainda não consegui confirmar a autorização. Confira a internet e volte após autorizar no navegador.")}
        save(state)
    }
    fun sendLibraryTitle(raw:String):JSONObject=synchronized(lock){
        try{
            val item=JSONObject(raw)
            val state=load()
            val scope=sessionScope(state)
            check(scope.isNotEmpty()&&scope==item.optString("scope")){"Conecte novamente a conta Stremio antes de enviar."}
            val id=item.getString("id")
            val type=item.getString("type")
            val name=item.getString("name").trim().take(200)
            require(id.matches(Regex("tt[0-9]{5,12}"))&&type in setOf("movie","series")&&name.isNotBlank())
            fun readTitle():JSONObject?{
                val params=JSONObject().put("collection","libraryItem").put("ids",JSONArray().put(id)).put("all",false)
                val rows=api(state,"/datastoreGet",params) as? JSONArray ?: error("A biblioteca do Stremio voltou em formato inesperado.")
                return (0 until rows.length()).mapNotNull{rows.optJSONObject(it)}.firstOrNull{it.optString("_id")==id}
            }
            fun active(row:JSONObject?)=row!=null&&row.optString("type")==type&&!row.optBoolean("removed",true)&&!row.optBoolean("temp",true)
            val previous=readTitle()
            check(previous==null||previous.optString("type")==type){"O tipo do título na biblioteca Stremio é diferente."}
            val existing=active(previous)
            if(!existing){
                val date=java.time.Instant.ofEpochMilli(now()).toString()
                val progress=JSONObject().put("timeWatched",0).put("timeOffset",0).put("overallTimeWatched",0)
                    .put("timesWatched",0).put("flaggedWatched",0).put("duration",0).put("noNotif",false)
                val entry=previous?:JSONObject().put("_id",id).put("name",name).put("type",type)
                    .put("poster","https://images.metahub.space/poster/medium/$id/img").put("posterShape","poster")
                    .put("_ctime",date).put("state",progress).put("behaviorHints",JSONObject())
                entry.put("removed",false).put("temp",false).put("_mtime",date)
                api(state,"/datastorePut",JSONObject().put("collection","libraryItem").put("changes",JSONArray().put(entry)))
                check(active(readTitle())){"Não consegui confirmar o título na biblioteca do Stremio."}
            }
            JSONObject().put("ok",true).put("existing",existing)
        }catch(error:Exception){
            val message=if(error is IllegalStateException)error.message else null
            JSONObject().put("ok",false).put("error",message?:"Não consegui enviar ao Stremio. Tente novamente.")
        }
    }
    fun readLibrary()=synchronized(lock){
        val state=load();check(state.optString("authKey").isNotBlank()){ "Conecte o Stremio primeiro." }
        cancelled.set(false);state.put("reading",true).put("processed",0).put("error","").put("warning","");save(state);changed()
        try {
            val meta=api(state,"/datastoreMeta",JSONObject().put("collection","libraryItem")) as? JSONArray ?: error("Não consegui ler o índice da biblioteca.")
            val ids=linkedSetOf<String>()
            for(i in 0 until meta.length()){
                val row=meta.optJSONArray(i)
                val id=row?.optString(0) ?: meta.optJSONObject(i)?.optString("_id") ?: ""
                check(id.isNotBlank() && id.length<=1024){"O índice da biblioteca veio incompleto."}
                ids.add(id)
            }
            check(ids.size<=20000){"Biblioteca muito extensa para esta versão. Nenhum título foi importado."}
            state.put("total",ids.size);save(state);changed()
            val received=linkedMapOf<String,JSONObject>();var processed=0
            for(batch in ids.toList().chunked(100)){
                check(!cancelled.get()){ "Leitura cancelada. A lista CENA foi preservada." }
                val rows=api(state,"/datastoreGet",JSONObject().put("collection","libraryItem").put("ids",JSONArray(batch)).put("all",false)) as? JSONArray ?: error("A biblioteca retornou um formato inesperado.")
                for(i in 0 until rows.length()){
                    val row=rows.optJSONObject(i) ?: continue;val id=row.optString("_id")
                    if(id in batch)received[id]=row
                }
                processed+=batch.size;state.put("processed",processed);save(state);changed()
            }
            check(!cancelled.get()){ "Leitura cancelada. A lista CENA foi preservada." }
            val library=JSONArray();var excluded=0
            for(row in received.values){
                if(row.optBoolean("removed",true) || row.optBoolean("temp",true) || row.optString("type") !in setOf("movie","series")){excluded++;continue}
                val id=row.getString("_id");val name=row.optString("name").trim()
                if(name.isBlank()){excluded++;continue}
                val poster=row.optString("poster").takeIf{it.startsWith("https://") && it.length<=4096} ?: ""
                library.put(JSONObject().put("id",id).put("name",name.take(500)).put("type",row.getString("type")).put("poster",poster)
                    .put("year",row.optString("year").take(4)).put("removed",false).put("temp",false))
            }
            check(library.length()<=5000){"Mais de 5.000 títulos ativos. Esta versão não consegue mostrar toda a biblioteca com segurança."}
            state.put("library",library).put("excluded",excluded).put("lastRead",now())
                .put("warning",if(received.size<ids.size)"${ids.size-received.size} registro(s) do índice não foram devolvidos. A leitura pode estar parcial; confira antes de importar." else "")
                .put("error","")
        }catch(e:Exception){
            val message=e.message ?: ""
            state.put("error",if(message.startsWith("O Stremio") || message.startsWith("Sua sessão") || message.startsWith("Conecte") || message.startsWith("Biblioteca") || message.startsWith("Leitura cancelada") || message.startsWith("Mais de") || message.startsWith("Não consegui") || message.startsWith("A biblioteca") || message.startsWith("O índice"))message.take(240) else "Não consegui concluir a leitura. Confira a internet e tente novamente. A lista CENA foi preservada.")
        }finally{state.put("reading",false);save(state);changed()}
    }
    fun disconnect()=synchronized(lock){cancelled.set(true);save(JSONObject())}
}
