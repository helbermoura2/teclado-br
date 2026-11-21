package app.cena

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean

/** Public pinned weights only. Never uploads images or account information. */
object VisualModelStore {
 private val downloading=AtomicBoolean(false)
 private val cancelled=AtomicBoolean(false)
 @Volatile private var received=0L
 @Volatile private var failure=""
 private val lock=Any()
 private fun info(context:Context)=JSONObject(context.assets.open("models/model-info.json").bufferedReader().use{it.readText()})
 private fun target(context:Context,value:JSONObject)=File(File(context.filesDir,"vision").apply{mkdirs()},"clip-${value.getString("sha256").take(16)}.onnx")
 fun status(context:Context):JSONObject {val value=info(context);val file=target(context,value);return JSONObject().put("available",file.exists()&&file.length()==value.getLong("size")).put("downloading",downloading.get()).put("received",received).put("size",value.getLong("size")).put("error",failure)}
 fun file(context:Context):File=synchronized(lock){val value=info(context);val file=target(context,value);if(file.exists()&&file.length()==value.getLong("size"))return@synchronized file
  // Emulator QA can bundle the same model; production downloads it only on request.
  val asset=try{context.assets.open("models/clip-vision.onnx")}catch(_:Exception){throw IllegalStateException("Baixe o modelo visual em Conectar para ativar a comparação de capas.")}
  val temp=File(file.parentFile,file.name+".bundled.tmp");try{asset.use{input->temp.outputStream().use{input.copyTo(it)}};require(temp.length()==value.getLong("size"));require(digest(temp)==value.getString("sha256"));require(temp.renameTo(file));file}finally{temp.delete()}
 }
 private fun digest(file:File):String {val hash=MessageDigest.getInstance("SHA-256");file.inputStream().use{input->val bytes=ByteArray(65536);var count=input.read(bytes);while(count>=0){hash.update(bytes,0,count);count=input.read(bytes)}};return hash.digest().joinToString(""){"%02x".format(it)}}
 private fun open(url:URL,redirects:Int=0):HttpURLConnection {val host=url.host.lowercase();require(url.protocol=="https"&&(url.port==-1||url.port==443)&&url.userInfo==null&&(host=="huggingface.co"||host.endsWith(".huggingface.co")||host.endsWith(".hf.co")));val connection=(url.openConnection()as HttpURLConnection).apply{connectTimeout=20000;readTimeout=30000;instanceFollowRedirects=false;setRequestProperty("User-Agent","CENA-Android")};if(connection.responseCode in 300..399){val location=connection.getHeaderField("Location");connection.disconnect();require(redirects<5&&location!=null);return open(URL(url,location),redirects+1)};require(connection.responseCode==200);return connection}
 fun cancel(){cancelled.set(true)}
 fun download(context:Context,notify:()->Unit){if(status(context).optBoolean("available")){notify();return};if(!downloading.compareAndSet(false,true))return;cancelled.set(false);received=0;failure="";val value=info(context);val destination=target(context,value);val temp=File(destination.parentFile,destination.name+".download.tmp");notify()
  try{val revision=value.getString("revision");require(revision.matches(Regex("[a-f0-9]{40}")));val connection=open(URL("https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/$revision/onnx/vision_model_quantized.onnx"));try{connection.inputStream.use{input->temp.outputStream().use{output->val bytes=ByteArray(65536);var last=0L;var count=input.read(bytes);while(count>=0){check(!cancelled.get()&&!Thread.currentThread().isInterrupted);received+=count;require(received<=value.getLong("size"));output.write(bytes,0,count);val now=System.currentTimeMillis();if(now-last>400){last=now;notify()};count=input.read(bytes)}}}}finally{connection.disconnect()}
   require(temp.length()==value.getLong("size")&&digest(temp)==value.getString("sha256"));synchronized(lock){require(temp.renameTo(destination))}
  }catch(_:Exception){failure=if(cancelled.get()||Thread.currentThread().isInterrupted)"Download cancelado. Você pode tentar novamente."else "Não consegui baixar ou validar o modelo. Confira a conexão e tente novamente."}finally{temp.delete();downloading.set(false);notify()}
 }
}
