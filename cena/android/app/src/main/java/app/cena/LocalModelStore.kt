package app.cena

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.system.Os
import android.system.OsConstants
import org.json.JSONObject

class LocalModelStore(private val context:Context){
    private val vault=TraktVault(context,"cena.local-ai.v1","IA local")
    fun status():JSONObject {
        val saved=vault.read();val uri=saved.optString("uri")
        return JSONObject().put("configured",uri.isNotBlank()).put("name",saved.optString("name")).put("bytes",saved.optLong("bytes")).put("supported",android.os.Build.SUPPORTED_64_BIT_ABIS.isNotEmpty())
    }
    fun uri():String=vault.read().optString("uri")
    fun select(uri:Uri,persist:Boolean=true){
        require(uri.scheme=="content"){"Selecione um arquivo pelo Android."}
        var name="Modelo GGUF";var size=-1L
        context.contentResolver.query(uri,arrayOf(OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE),null,null,null)?.use{cursor->if(cursor.moveToFirst()){
            val n=cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);val s=cursor.getColumnIndex(OpenableColumns.SIZE)
            if(n>=0)name=cursor.getString(n)?:name;if(s>=0&&!cursor.isNull(s))size=cursor.getLong(s)
        }}
        require(name.endsWith(".gguf",true)){"Escolha o arquivo de modelo .gguf."}
        context.contentResolver.openFileDescriptor(uri,"r")?.use{descriptor->
            require(descriptor.statSize in 1024..8L*1024*1024*1024){"Escolha um GGUF local, completo, de até 8 GB, por exemplo em Downloads."}
            size=descriptor.statSize;Os.lseek(descriptor.fileDescriptor,0,OsConstants.SEEK_SET)
            val header=ByteArray(4);require(Os.read(descriptor.fileDescriptor,header,0,4)==4&&header.contentEquals(byteArrayOf(71,71,85,70))){"O arquivo selecionado não tem um cabeçalho GGUF válido."}
        }?:error("Não consegui abrir o modelo.")
        if(persist)context.contentResolver.takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION)
        val old=this.uri();vault.write(JSONObject().put("uri",uri.toString()).put("name",name.take(180)).put("bytes",size))
        if(persist&&old.isNotBlank()&&old!=uri.toString())try{context.contentResolver.releasePersistableUriPermission(Uri.parse(old),Intent.FLAG_GRANT_READ_URI_PERMISSION)}catch(_:Exception){}
    }
    fun remove(){val old=uri();vault.clear();if(old.isNotBlank())try{context.contentResolver.releasePersistableUriPermission(Uri.parse(old),Intent.FLAG_GRANT_READ_URI_PERMISSION)}catch(_:Exception){} }
}
