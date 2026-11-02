package app.cena

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Tokens, device grants and the account-bound outbox never enter WebView storage or logs. */
class TraktVault(context: Context, private val namespace: String = "cena.trakt.v1", private val serviceName: String = "Trakt") {
    private val prefs = context.getSharedPreferences(namespace, Context.MODE_PRIVATE)
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(namespace, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(namespace, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    fun read(): JSONObject {
        val encoded = prefs.getString("sealed", null) ?: return JSONObject()
        return try {
            val value = JSONObject(encoded)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(value.getString("iv"), Base64.NO_WRAP)))
            JSONObject(String(cipher.doFinal(Base64.decode(value.getString("data"), Base64.NO_WRAP)), Charsets.UTF_8))
        } catch (_: Exception) { JSONObject().put("error", "A conexão protegida não está disponível. Conecte o $serviceName novamente.") }
    }
    fun write(value: JSONObject) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key())
        val sealed = JSONObject().put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .put("data", Base64.encodeToString(cipher.doFinal(value.toString().toByteArray(Charsets.UTF_8)), Base64.NO_WRAP))
        check(prefs.edit().putString("sealed", sealed.toString()).commit())
    }
}

data class TraktResponse(val status: Int, val body: String, val pages: Int = 1, val retrySeconds: Long = 30)
fun interface TraktTransport { fun request(method: String, path: String, body: JSONObject?, clientId: String, token: String?): TraktResponse }
class TraktHttp : TraktTransport {
    override fun request(method: String, path: String, body: JSONObject?, clientId: String, token: String?): TraktResponse {
        require(path.startsWith("/") && !path.startsWith("//"))
        val connection = (URL("https://api.trakt.tv$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method; connectTimeout = 10000; readTimeout = 15000; instanceFollowRedirects = false
            setRequestProperty("Accept", "application/json"); setRequestProperty("Content-Type", "application/json")
            setRequestProperty("trakt-api-version", "2"); setRequestProperty("trakt-api-key", clientId)
            setRequestProperty("User-Agent", "CENA/0.5.0")
            if (token != null) setRequestProperty("Authorization", "Bearer $token")
        }
        try {
            if (body != null) { connection.doOutput = true; connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) } }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.use { input ->
                val bytes = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192); var total = 0
                while (true) { val count = input.read(buffer); if(count < 0) break; total += count; require(total <= 8 * 1024 * 1024); bytes.write(buffer,0,count) }
                bytes.toString("UTF-8")
            } ?: ""
            return TraktResponse(code, text, (connection.getHeaderField("X-Pagination-Page-Count")?.toIntOrNull() ?: 1).coerceAtLeast(1),
                (connection.getHeaderField("Retry-After")?.toLongOrNull() ?: 30).coerceIn(5,3600))
        } finally { connection.disconnect() }
    }
}

/** All callers, including WorkManager, serialize refresh-token rotation and outbox changes. */
class TraktRepository(context: Context, private val transport: TraktTransport = TraktHttp(), private val now: () -> Long = { System.currentTimeMillis() }) {
    companion object { val lock = Any(); private val imdb = Regex("tt\\d{5,12}") }
    private val vault = TraktVault(context)
    private fun load() = vault.read()
    private fun save(s: JSONObject) = vault.write(s)
    private fun connected(s: JSONObject) = s.optString("access").isNotBlank()
    private fun id(s: JSONObject) = s.optString("clientId")
    private fun records(value: JSONArray?): List<JSONObject> = (0 until (value?.length() ?: 0)).mapNotNull { value?.optJSONObject(it) }
    private fun contentKey(row: JSONObject) = row.optString("type") + ":" + row.optString("id")
    private fun valid(row: JSONObject) = imdb.matches(row.optString("id")) && row.optString("type") in setOf("movie", "series")
    fun status(): JSONObject = synchronized(lock) {
        val s = load()
        JSONObject().put("configured", id(s).isNotBlank()).put("clientId", id(s)).put("connected", connected(s))
            .put("username", s.optString("username")).put("error", s.optString("error"))
            .put("needsUpload",s.optBoolean("needsUpload")).put("blocked",s.optBoolean("blocked")).put("lastSync", s.optLong("lastSync")).put("userCode", s.optString("userCode"))
            .put("verificationUrl", s.optString("verificationUrl")).put("authExpires", s.optLong("authExpires"))
            .put("pending", s.optJSONArray("queue") ?: JSONArray()).put("synced", s.optJSONArray("synced") ?: JSONArray())
            .put("watchlist", s.optJSONArray("watchlist") ?: JSONArray()).put("watched", s.optJSONArray("watched") ?: JSONArray())
            .put("progress", s.optJSONArray("progress") ?: JSONArray()).put("limits", s.optJSONObject("limits") ?: JSONObject())
    }
    fun configure(clientId: String) = synchronized(lock) {
        require(Regex("[A-Za-z0-9_-]{20,200}").matches(clientId)) { "Informe somente o Client ID público do cadastro CENA no Trakt." }
        val s = load(); check(!connected(s)) { "Desconecte antes de trocar o cadastro." }
        save(JSONObject().put("clientId",clientId))
    }
    fun beginAuth() = synchronized(lock) {
        val s = load(); check(id(s).isNotBlank()) { "Cadastre a integração CENA no Trakt e informe o Client ID público." }
        check(!connected(s)) { "O Trakt já está conectado." }
        val r = transport.request("POST", "/oauth/device/code", JSONObject().put("client_id",id(s)), id(s), null)
        check(r.status == 200) { "O Trakt não iniciou a autorização (${r.status}). Confira o cadastro da integração." }
        val value = JSONObject(r.body)
        val url = android.net.Uri.parse(value.getString("verification_url"))
        require(url.scheme == "https" && url.host in setOf("trakt.tv","app.trakt.tv","auth.trakt.tv","www.trakt.tv"))
        s.put("deviceCode",value.getString("device_code")).put("userCode",value.getString("user_code"))
            .put("verificationUrl",url.toString()).put("authExpires",now()+value.getLong("expires_in")*1000)
            .put("pollInterval",value.optLong("interval",5).coerceAtLeast(5)*1000).put("nextPoll",now()+5000).put("error","")
        save(s)
    }
    private fun clearGrant(s: JSONObject) { for (key in listOf("deviceCode","userCode","verificationUrl","authExpires","nextPoll")) s.remove(key) }
    private fun tokens(s: JSONObject, value: JSONObject) {
        require(value.getString("access_token").isNotBlank() && value.getString("refresh_token").isNotBlank())
        s.put("access",value.getString("access_token")).put("refresh",value.getString("refresh_token"))
            .put("expires",(value.optLong("created_at",now()/1000)+value.getLong("expires_in"))*1000).put("error","")
    }
    fun pollAuth() = synchronized(lock) {
        val s = load(); if(s.optString("deviceCode").isBlank()) return@synchronized
        if(now() >= s.optLong("authExpires")) { clearGrant(s); s.put("error","O código expirou. Inicie a conexão novamente."); save(s); return@synchronized }
        if(now() < s.optLong("nextPoll")) return@synchronized
        val r = transport.request("POST","/oauth/device/token",JSONObject().put("code",s.getString("deviceCode")).put("client_id",id(s)),id(s),null)
        when(r.status) {
            200 -> { tokens(s,JSONObject(r.body)); clearGrant(s); s.put("queue",JSONArray()).put("synced",JSONArray()).put("watchlist",JSONArray()).put("watched",JSONArray()).put("lastSync",0).put("needsUpload",true); save(s) }
            400 -> {
                val error=try { JSONObject(r.body).optString("error") } catch(_:Exception) { "" }
                if(error.isNotBlank() && error !in setOf("authorization_pending","pending")) { clearGrant(s); s.put("error","O Trakt recusou a autorização: $error. Confira o cadastro da integração.") }
                else s.put("nextPoll",now()+s.optLong("pollInterval",5000))
                save(s)
            }
            429 -> { s.put("pollInterval",maxOf(s.optLong("pollInterval",5000)+5000,r.retrySeconds*1000)).put("nextPoll",now()+r.retrySeconds*1000); save(s) }
            else -> { clearGrant(s); s.put("error",if(r.status == 418) "Autorização recusada. Sua lista local foi preservada." else "Não foi possível concluir a autorização (${r.status}). Tente novamente."); save(s) }
        }
    }
    private fun api(s: JSONObject, method: String, path: String, body: JSONObject? = null): TraktResponse {
        if(now()+60000 >= s.optLong("expires")) {
            val r = transport.request("POST","/oauth/token",JSONObject().put("client_id",id(s)).put("refresh_token",s.optString("refresh")).put("grant_type","refresh_token"),id(s),null)
            if(r.status != 200) { if(r.status in setOf(400,401,403)) { s.remove("access"); s.remove("refresh"); s.put("queue",JSONArray()); save(s) }; error("Sua autorização precisa ser renovada. Conecte o Trakt novamente.") }
            tokens(s,JSONObject(r.body)); save(s) // Persist single-use refresh-token rotation before another request.
        }
        val r = transport.request(method,path,body,id(s),s.getString("access"))
        when(r.status) {
            401 -> { s.remove("access"); s.remove("refresh"); s.put("queue",JSONArray()); save(s); error("A autorização expirou. Conecte o Trakt novamente.") }
            420 -> { s.put("blocked",true).put("queueError","Você atingiu um limite da conta Trakt. Libere espaço e tente novamente."); save(s); error("Você atingiu um limite da conta Trakt. Libere espaço na lista e toque em Tentar novamente.") }
            429 -> { s.put("retryAt",now()+r.retrySeconds*1000); save(s); error("O Trakt pediu uma pausa. A sincronização será tentada depois.") }
        }
        check(r.status in 200..299) { "O Trakt não concluiu a sincronização (${r.status}). Sua lista local foi preservada." }
        return r
    }
    fun initialUploadComplete() = synchronized(lock) { val s=load(); s.put("needsUpload",false); save(s) }
    fun inventory(raw: JSONArray) = synchronized(lock) {
        require(raw.length() <= 2000)
        val s = load(); s.put("inventory",JSONArray(records(raw).filter(::valid).map { JSONObject().put("id",it.getString("id")).put("type",it.getString("type")) })); save(s)
    }
    fun enqueue(raw: JSONObject) = synchronized(lock) {
        require(valid(raw) && raw.optString("action") in setOf("add","remove"))
        val s=load(); if(!connected(s)) return@synchronized
        val queue=records(s.optJSONArray("queue")).filter { contentKey(it) != contentKey(raw) }.toMutableList()
        check(queue.size < 2000) { "Muitos títulos aguardam sincronização. Sincronize antes de adicionar mais." }
        queue.add(JSONObject().put("id",raw.getString("id")).put("type",raw.getString("type")).put("action",raw.getString("action")))
        s.put("queue",JSONArray(queue)).put("blocked",false).put("queueError","").put("error",""); save(s)
    }
    private fun all(s: JSONObject, path: String): List<JSONObject> {
        val result=mutableListOf<JSONObject>(); var page=1; var pages=1
        do {
            val r=api(s,"GET",path + (if(path.contains('?')) "&" else "?")+"page=$page&limit=100")
            pages=r.pages; check(pages <= 500) { "Histórico muito extenso. A sincronização não foi concluída." }
            result.addAll(records(JSONArray(r.body))); page++
        } while(page <= pages)
        return result
    }
    fun sync(force: Boolean = false) = synchronized(lock) {
        val s=load(); if(!connected(s)) return@synchronized
        if(now()<s.optLong("retryAt")) return@synchronized
        if(!force && now()-s.optLong("lastSync") < 60000 && records(s.optJSONArray("queue")).isEmpty()) return@synchronized
        if(force) s.put("blocked",false).put("queueError","")
        try {
            val settings=JSONObject(api(s,"GET","/users/settings").body)
            val account=settings.getJSONObject("user").getJSONObject("ids").getString("slug")
            if(s.optString("account").isNotBlank() && s.optString("account") != account) { s.put("queue",JSONArray()).put("synced",JSONArray()).put("watched",JSONArray()).put("watchlist",JSONArray()) }
            s.put("account",account).put("username",settings.getJSONObject("user").optString("username",account)).put("limits",settings.optJSONObject("limits") ?: JSONObject()); save(s)
            if(!s.optBoolean("blocked")) for(action in listOf("add","remove")) {
                val batch=records(s.optJSONArray("queue")).filter { it.optString("action")==action }
                if(batch.isEmpty()) continue
                val body=JSONObject()
                for(type in listOf("movie","series")) body.put(if(type=="movie")"movies" else "shows",JSONArray(batch.filter { it.optString("type")==type }.map { JSONObject().put("ids",JSONObject().put("imdb",it.getString("id"))) }))
                val reply=JSONObject(api(s,"POST",if(action=="add")"/sync/watchlist" else "/sync/watchlist/remove",body).body)
                check(reply.has("added") || reply.has("deleted") || reply.has("existing")) { "O Trakt não confirmou os títulos enviados." }
                val missing=reply.optJSONObject("not_found")
                val missingIds=listOf("movies","shows").flatMap { records(missing?.optJSONArray(it)) }.map { it.optJSONObject("ids")?.optString("imdb") ?: "" }.toSet()
                val failed=batch.filter { it.getString("id") in missingIds }
                val completedKeys=(batch-failed.toSet()).map(::contentKey).toSet()
                s.put("queue",JSONArray(records(s.optJSONArray("queue")).filter { contentKey(it) !in completedKeys }))
                val synced=records(s.optJSONArray("synced")).filter { contentKey(it) !in completedKeys }.toMutableList(); synced.addAll(batch.filter { contentKey(it) in completedKeys }.map { JSONObject(it.toString()).put("at",now()) })
                s.put("synced",JSONArray(synced.takeLast(2000))); save(s)
                if(failed.isNotEmpty()) { s.put("blocked",true); error("Alguns títulos não foram encontrados no Trakt. Eles continuam na sua lista local.") }
            }
            val remote=mutableListOf<JSONObject>()
            for(type in listOf("movies","shows")) for(row in all(s,"/sync/watchlist/$type/added")) {
                val movie=row.optJSONObject(if(type=="movies")"movie" else "show") ?: continue
                val imdbId=movie.optJSONObject("ids")?.optString("imdb") ?: continue
                if(imdb.matches(imdbId)) remote.add(JSONObject().put("id",imdbId).put("type",if(type=="movies")"movie" else "series").put("name",movie.optString("title")).put("year",movie.opt("year") ?: ""))
            }
            val tracked=records(s.optJSONArray("inventory")).map { it.getString("id") }.toSet()+remote.map { it.getString("id") }
            val watched=all(s,"/sync/watched/movies").mapNotNull { row ->
                val imdbId=row.optJSONObject("movie")?.optJSONObject("ids")?.optString("imdb") ?: return@mapNotNull null
                if(imdbId !in tracked) null else JSONObject().put("id",imdbId).put("type","movie").put("watchedAt",row.optString("last_watched_at"))
            }
            val progress=mutableListOf<JSONObject>()
            for(row in all(s,"/sync/watched/shows")) {
                val imdbId=row.optJSONObject("show")?.optJSONObject("ids")?.optString("imdb") ?: continue
                if(imdbId !in tracked) continue
                val completed=records(row.optJSONArray("seasons")).filter { it.optInt("number") > 0 }.sumOf { season -> records(season.optJSONArray("episodes")).count { it.optInt("plays") > 0 } }
                progress.add(JSONObject().put("id",imdbId).put("type","series").put("episodes",completed))
            }
            s.put("watchlist",JSONArray(remote)).put("watched",JSONArray(watched)).put("progress",JSONArray(progress)).put("lastSync",now()).put("error",if(s.optBoolean("blocked")) s.optString("queueError") else "").put("failures",0).put("retryAt",0); save(s)
        } catch(e: Exception) {
            val failures=s.optInt("failures")+1
            if(s.optLong("retryAt") <= now()) s.put("retryAt",now()+minOf(300000L,30000L*(1L shl minOf(failures-1,3))))
            s.put("failures",failures).put("error",e.message?.take(200) ?: "Sem conexão. A sincronização continua pendente."); save(s)
        }
    }
    fun disconnect() = synchronized(lock) {
        val s=load(); var revoked=true
        if(connected(s)) try { revoked=transport.request("POST","/oauth/revoke",JSONObject().put("token",s.getString("access")).put("client_id",id(s)),id(s),null).status in 200..299 } catch(_:Exception) { revoked=false }
        save(JSONObject().put("clientId",id(s)).put("error",if(revoked) "" else "Desconectado neste aparelho. Revogue também o acesso CENA nas configurações do Trakt."))
    }
}
