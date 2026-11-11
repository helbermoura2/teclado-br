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
                    val result=String(LocalAiNative.generate(descriptor.fd,prompt.toByteArray(Charsets.UTF_8),epoch,data.getInt("maximum",256)),Charsets.UTF_8)
                    check(!cancelled.get());if(result.startsWith("S\n"))deliver("ok",result.substring(2))else deliver("error",error="A resposta da IA ficou incompleta. Mantive a seleção do catálogo.")
                }?:error("Modelo indisponível")
            }catch(error:Throwable){deliver("error",error=localAiFailure(error,cancelled.get()))}
            finally{Handler(Looper.getMainLooper()).post{busy=false};stopSelf()}
        }
        true
    })
    override fun onBind(intent:Intent?):IBinder=input.binder
    override fun onDestroy(){cancellation.set(true);if(nativeLoaded)try{LocalAiNative.cancel()}catch(_:Throwable){};executor.shutdownNow();super.onDestroy()}
}

/** Safe, actionable diagnostics: never expose model paths, prompts or raw native logs. */
internal fun localAiFailure(error:Throwable,cancelled:Boolean=false):String {
 if(cancelled)return "Consulta cancelada. Mantive as opções do catálogo. [CANCELADO]"
 return when(error){
  is SecurityException->"O Android retirou o acesso ao GGUF. Selecione o arquivo novamente em Conectar → IA local. [ACESSO]"
  is java.io.FileNotFoundException->"O arquivo GGUF não está mais disponível. Selecione o original em Downloads. [ARQUIVO]"
  is OutOfMemoryError->"Faltou memória para executar o modelo. Feche outros aplicativos e tente novamente. [MEMORIA]"
  is UnsatisfiedLinkError->"O motor local não pôde ser carregado nesta arquitetura Android. [MOTOR]"
  else->{val code=error.message.orEmpty().takeIf{it.matches(Regex("(INICIAR|CARREGAR_MODELO|TEMPLATE|CONTEXTO|PROCESSAR):(MEMORIA|INCOMPATIVEL|ARQUIVO|PEDIDO_LONGO|CANCELADO|FALHA)"))}?:"EXECUCAO:FALHA"
   val help=when{
    code.endsWith(":MEMORIA")->"Faltou memória para carregar o GGUF. Feche outros aplicativos ou use um modelo menor."
    code.endsWith(":INCOMPATIVEL")->"Este GGUF usa uma arquitetura ou quantização não suportada pelo motor instalado."
    code.endsWith(":ARQUIVO")->"Não consegui ler a estrutura do GGUF. Confira se o download terminou e selecione o original em Downloads."
    code.endsWith(":PEDIDO_LONGO")->"O pedido excedeu o contexto local. Reduza a preferência e tente novamente."
    code.startsWith("TEMPLATE:")->"O formato de conversa deste GGUF não pôde ser preparado pelo motor."
    code.startsWith("CONTEXTO:")->"Não consegui reservar o contexto do modelo. Feche outros aplicativos e tente novamente."
    code.startsWith("CARREGAR_MODELO:")->"O motor não conseguiu carregar este GGUF. Pode ser memória insuficiente ou incompatibilidade do arquivo."
    else->"A execução local falhou. As sugestões do catálogo foram preservadas."
   };"$help [$code]"
  }
 }
}
