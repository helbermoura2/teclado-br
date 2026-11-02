package app.cena

import android.app.Service
import android.content.Intent
import android.net.Uri
import android.os.*
import org.json.JSONObject
import java.util.concurrent.Executors

/** Bound, non-exported, separate process. No model data or prompts use the network. */
class LocalAiService:Service(){
    private val executor=Executors.newSingleThreadExecutor()
    private var busy=false
    @Volatile private var nativeLoaded=false
    private var cancellation=java.util.concurrent.atomic.AtomicBoolean(false)
    private val input=Messenger(Handler(Looper.getMainLooper()){message->
        if(message.what==2){cancellation.set(true);if(nativeLoaded)try{LocalAiNative.cancel()}catch(_:Throwable){};return@Handler true}
        if(message.what!=1)return@Handler false
        val reply=message.replyTo?:return@Handler true
        val data=Bundle(message.data);val requestId=data.getString("requestId")?:""
        fun deliver(status:String,text:String="",error:String=""){
            val result=Message.obtain(null,3);result.data=Bundle().apply{putString("requestId",requestId);putString("status",status);putString("text",text);putString("error",error)}
            try{reply.send(result)}catch(_:RemoteException){}
        }
        if(busy){deliver("error",error="A IA local já está trabalhando. Aguarde ou cancele.");return@Handler true}
        busy=true
        val cancelled=java.util.concurrent.atomic.AtomicBoolean(false);cancellation=cancelled
        executor.execute{
            try{
                val address=Uri.parse(data.getString("uri")?:"");require(address.scheme=="content")
                val prompt=data.getString("prompt")?:"";require(prompt.isNotBlank()&&prompt.length<=20000)
                check(!cancelled.get());nativeLoaded=true;val epoch=LocalAiNative.epoch();check(!cancelled.get())
                contentResolver.openFileDescriptor(address,"r")?.use{descriptor->
                    require(descriptor.statSize in 1024..8L*1024*1024*1024)
                    val path="/proc/self/fd/${descriptor.fd}"
                    val result=String(LocalAiNative.generate(path.toByteArray(Charsets.UTF_8),prompt.toByteArray(Charsets.UTF_8),epoch,data.getInt("maximum",256)),Charsets.UTF_8)
                    check(!cancelled.get());if(result.startsWith("S\n"))deliver("ok",result.substring(2))else deliver("error",error="A resposta da IA ficou incompleta. Mantive a seleção do catálogo.")
                }?:error("Modelo indisponível")
            }catch(_:Throwable){deliver("error",error="Não consegui executar o GGUF. Confira o acesso ao arquivo, a compatibilidade e a memória disponível.")}
            finally{Handler(Looper.getMainLooper()).post{busy=false};stopSelf()}
        }
        true
    })
    override fun onBind(intent:Intent?):IBinder=input.binder
    override fun onDestroy(){cancellation.set(true);if(nativeLoaded)try{LocalAiNative.cancel()}catch(_:Throwable){};executor.shutdownNow();super.onDestroy()}
}
