package app.cena

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.max

/** Public artwork only. Native decoding supplies clean pixels to the WebView canvas. */
object StoryArtwork {
    private val hosts=setOf("upload.wikimedia.org","image.tmdb.org","images.metahub.space","m.media-amazon.com")
    fun allowed(address:String):Boolean=try{val url=URL(address);url.protocol=="https"&&url.host in hosts&&url.userInfo==null&&url.port in setOf(-1,443)}catch(_:Exception){false}
    fun download(address:String,redirects:Int=0,deadline:Long=android.os.SystemClock.elapsedRealtime()+25000):Bitmap {
        val remaining=(deadline-android.os.SystemClock.elapsedRealtime()).coerceAtMost(6000).toInt();require(remaining>0)
        require(allowed(address));val url=URL(address)
        val connection=(url.openConnection() as HttpURLConnection).apply {
            connectTimeout=minOf(4000,remaining);readTimeout=remaining;instanceFollowRedirects=false
            setRequestProperty("Accept","image/jpeg,image/png,image/webp");setRequestProperty("User-Agent","CENA/0.6.1")
        }
        try{
            val status=connection.responseCode
            if(status in setOf(301,302,303,307,308)){
                require(redirects<3)
                return download(URL(url,connection.getHeaderField("Location")?:error("Missing image")).toString(),redirects+1,deadline)
            }
            require(status==200)
            val bytes=ByteArrayOutputStream()
            connection.inputStream.use{input->val buffer=ByteArray(8192);var total=0
                while(true){check(android.os.SystemClock.elapsedRealtime()<deadline);val count=input.read(buffer);if(count<0)break;total+=count;require(total<=8*1024*1024);bytes.write(buffer,0,count)}
            }
            return decode(bytes.toByteArray())
        }finally{connection.disconnect()}
    }
    fun decode(bytes:ByteArray):Bitmap {
        require(bytes.size<=8*1024*1024)
        val bounds=BitmapFactory.Options().apply{inJustDecodeBounds=true};BitmapFactory.decodeByteArray(bytes,0,bytes.size,bounds)
        require(bounds.outWidth in 60..30000&&bounds.outHeight in 90..30000)
        var sample=1;while(max(bounds.outWidth,bounds.outHeight)/sample>1600)sample*=2
        return BitmapFactory.decodeByteArray(bytes,0,bytes.size,BitmapFactory.Options().apply{inSampleSize=sample})?:error("Invalid image")
    }
    fun dataUrl(bitmap:Bitmap):String {
        val bytes=ByteArrayOutputStream();check(bitmap.compress(Bitmap.CompressFormat.JPEG,92,bytes));require(bytes.size()<=5*1024*1024)
        return "data:image/jpeg;base64,"+Base64.encodeToString(bytes.toByteArray(),Base64.NO_WRAP)
    }
}
