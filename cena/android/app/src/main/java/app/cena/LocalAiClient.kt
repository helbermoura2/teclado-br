package app.cena

import android.content.*
import android.os.*
import org.json.JSONObject

class LocalAiClient(private val context:Context,private val result:(JSONObject)->Unit){
    private val handler=Handler(Looper.getMainLooper())
    private var active:String?=null
    private var connection:ServiceConnection?=null
    private var remote:Messenger?=null
    private var timeout:Runnable?=null
    private val reply=Messenger(Handler(Looper.getMainLooper()){message->
        val data=message.data;val id=data.getString("requestId")?:""
        if(message.what==3&&active==id){finish(JSONObject().put("requestId",id).put("status",data.getString("status")).put("text",data.getString("text")).put("error",data.getString("error")));true}else false
    })
    fun generate(id:String,uri:String,prompt:String,maximum:Int=256){
        if(active!=null){result(JSONObject().put("requestId",id).put("status","error").put("error","A IA local já está trabalhando."));return}
        if(uri.isBlank()){result(JSONObject().put("requestId",id).put("status","error").put("error","Selecione o GGUF em Conectar → IA local."));return}
        active=id
        val current=object:ServiceConnection{
            override fun onServiceConnected(name:ComponentName,binder:IBinder){
                if(active!=id)return
                remote=Messenger(binder)
                val message=Message.obtain(null,1);message.replyTo=reply;message.data=Bundle().apply{putString("requestId",id);putString("uri",uri);putString("prompt",prompt);putInt("maximum",maximum)}
                try{remote!!.send(message)}catch(_:RemoteException){fail("Não consegui iniciar a IA local.")}
            }
            override fun onServiceDisconnected(name:ComponentName){if(active==id)fail("A IA foi interrompida pelo Android. Mantive as opções do catálogo.")}
            override fun onBindingDied(name:ComponentName){if(active==id)fail("O processo de IA foi encerrado. Tente novamente com mais memória livre.")}
            override fun onNullBinding(name:ComponentName){if(active==id)fail("O motor de IA não está disponível.")}
        }
        connection=current
        timeout=Runnable{if(active==id){cancelRemote();fail("A IA demorou demais. Mantive as opções do catálogo.")}}.also{handler.postDelayed(it,150000)}
        try{if(!context.bindService(Intent(context,LocalAiService::class.java),current,Context.BIND_AUTO_CREATE))fail("Não consegui abrir o motor de IA.")}catch(_:Exception){fail("Não consegui abrir o motor de IA.")}
    }
    private fun cancelRemote(){try{remote?.send(Message.obtain(null,2))}catch(_:Exception){} }
    fun cancel(){if(active==null)return;cancelRemote();finish(JSONObject().put("requestId",active).put("status","cancelled").put("error","Consulta cancelada. Mantive as opções do catálogo."))}
    private fun fail(message:String){val id=active?:return;finish(JSONObject().put("requestId",id).put("status","error").put("error",message))}
    private fun finish(value:JSONObject){
        active=null;timeout?.let{handler.removeCallbacks(it)};timeout=null
        val old=connection;connection=null;remote=null;if(old!=null)try{context.unbindService(old)}catch(_:Exception){}
        result(value)
    }
}
