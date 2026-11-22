package app.cena

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

internal object UpdatePolicy {
    private fun version(value:String):List<Int>{require(Regex("[0-9]{1,4}\\.[0-9]{1,4}\\.[0-9]{1,4}").matches(value));return value.split('.').map{it.toInt()}}
    fun newer(a:String,b:String):Boolean{val first=version(a);val second=version(b);for(i in 0..2)if(first[i]!=second[i])return first[i]>second[i];return false}
    fun parse(release:JSONObject, parallel:Boolean=false):JSONObject{
        val tag=release.getString("tag_name");require(tag.startsWith("v"));val v=tag.substring(1);version(v)
        val filename=if(parallel) "CENA-$v-novo.apk" else "CENA-$v.apk"
        val assets=release.getJSONArray("assets");var selected:JSONObject?=null
        for(i in 0 until assets.length()){val a=assets.getJSONObject(i);if(a.optString("name")==filename)selected=a}
        val asset=selected?:error("APK da versão não encontrado.")
        val hash=asset.getString("digest");require(Regex("sha256:[a-f0-9]{64}").matches(hash))
        val size=asset.getLong("size");require(size in 1L..100_000_000L)
        val url=asset.getString("browser_download_url");require(url=="https://github.com/helbermoura2/cena-downloads/releases/download/$tag/$filename")
        return JSONObject().put("version",v).put("url",url).put("hash",hash.substring(7)).put("size",size)
    }
}

/** Updates are obtained exclusively from the public CENA release repository. */
class UpdateManager(private val activity: Activity, private val notify: (JSONObject) -> Unit) {
    private val executor = Executors.newSingleThreadExecutor()
    private var candidate: JSONObject? = null
    private val packageName = activity.packageName
    private fun emit(status: String, message: String, version: String = "") =
        activity.runOnUiThread { if (!activity.isFinishing && !activity.isDestroyed) notify(JSONObject().put("status",status).put("message",message).put("version",version)) }
    private fun connection(url: String): HttpURLConnection {
        val parsed=URL(url)
        require(parsed.protocol=="https" && parsed.host in setOf("api.github.com","github.com","release-assets.githubusercontent.com","objects.githubusercontent.com"))
        return (parsed.openConnection() as HttpURLConnection).apply { connectTimeout=15000;readTimeout=30000;instanceFollowRedirects=false;setRequestProperty("User-Agent","CENA-Android") }
    }
    private fun request(url: String): HttpURLConnection {
        var next=url
        repeat(5) {
            val c=connection(next);val status=c.responseCode
            if(status in 300..399){val target=c.getHeaderField("Location")?:error("Redirecionamento inválido");next=URL(URL(next),target).toString();c.disconnect()}
            else { check(status==200){"Serviço de atualizações indisponível."};return c }
        }
        error("Muitos redirecionamentos")
    }
    private fun checkRelease(): JSONObject {
        val conn=request("https://api.github.com/repos/helbermoura2/cena-downloads/releases/latest")
        val body=try{conn.inputStream.bufferedReader().use{it.readText()}}finally{conn.disconnect()}
        require(body.length<200000)
        return UpdatePolicy.parse(JSONObject(body), packageName=="app.cena.mobile.next")
    }
    fun check() { executor.execute { try {emit("checking","Consultando atualizações…");val info=checkRelease();val current=activity.packageManager.getPackageInfo(packageName,0).versionName?:"0.0.0";if(UpdatePolicy.newer(info.getString("version"),current)){candidate=info;emit("available","Nova versão disponível.",info.getString("version"))}else{candidate=null;emit("current","O CENA está atualizado.",current)}}catch(_:Exception){emit("error","Não consegui verificar atualizações. Confira a internet.")} } }
    @Suppress("DEPRECATION")
    private fun verify(file: File) {
        val pm=activity.packageManager;val archive=pm.getPackageArchiveInfo(file.absolutePath,PackageManager.GET_SIGNATURES)?:error("APK inválido")
        val installed=pm.getPackageInfo(packageName,PackageManager.GET_SIGNATURES)
        require(archive.packageName==packageName && archive.versionCode>installed.versionCode)
        val old=installed.signatures?.map{it.toByteArray().toList()}?.toSet()?:emptySet()
        val fresh=archive.signatures?.map{it.toByteArray().toList()}?.toSet()?:emptySet()
        require(old.isNotEmpty() && old==fresh)
    }
    fun install() { executor.execute { try {
        val info=candidate?:checkRelease();val v=info.getString("version");val current=activity.packageManager.getPackageInfo(packageName,0).versionName?:"0.0.0";require(UpdatePolicy.newer(v,current))
        if(Build.VERSION.SDK_INT>=26 && !activity.packageManager.canRequestPackageInstalls()){
            emit("permission","Autorize instalações pelo CENA e volte para tocar em Atualizar novamente.",v)
            activity.runOnUiThread{if(!activity.isFinishing)activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:$packageName")))};return@execute
        }
        emit("downloading","Baixando atualização…",v)
        val dir=File(activity.cacheDir,"updates").apply{mkdirs()};val file=File(dir,"cena-update.apk");val tmp=File(dir,"cena-update-tmp.apk");tmp.delete()
        val digest=MessageDigest.getInstance("SHA-256");var count=0L;val conn=request(info.getString("url"))
        try{conn.inputStream.use{input->tmp.outputStream().use{out->val buffer=ByteArray(32768);while(true){val n=input.read(buffer);if(n<0)break;count+=n;require(count<=info.getLong("size") && count<=100_000_000);digest.update(buffer,0,n);out.write(buffer,0,n)}}}}finally{conn.disconnect()}
        require(count==info.getLong("size") && digest.digest().joinToString(""){"%02x".format(it)}==info.getString("hash"));verify(tmp)
        file.delete();check(tmp.renameTo(file));val uri=FileProvider.getUriForFile(activity,"$packageName.files",file)
        emit("installing","Confirme a instalação no Android.",v)
        activity.runOnUiThread{if(!activity.isFinishing)activity.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))}
    }catch(_:Exception){emit("error","Não consegui instalar a atualização. Tente novamente.")} } }
    fun close(){executor.shutdownNow()}
}
