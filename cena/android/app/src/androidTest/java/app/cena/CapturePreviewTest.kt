package app.cena
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.core.content.FileProvider
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import java.io.File
class CapturePreviewTest {
 @Test fun previewIsARestrictedSessionJpegWithBoundedDimensions(){
  val context=InstrumentationRegistry.getInstrumentation().targetContext
  val file=File.createTempFile("preview-",".jpg",File(context.cacheDir,"captures").apply{mkdirs()})
  val source=Bitmap.createBitmap(1500,800,Bitmap.Config.ARGB_8888)
  try{
   file.outputStream().use{source.compress(Bitmap.CompressFormat.JPEG,95,it)}
   val value=CapturePreview.fromUri(context,FileProvider.getUriForFile(context,"${context.packageName}.files",file));assertTrue(value.startsWith("data:image/jpeg;base64,"))
   val bytes=Base64.decode(value.substringAfter(','),Base64.DEFAULT);assertTrue(bytes.size<=650000)
   val bounds=BitmapFactory.Options().apply{inJustDecodeBounds=true};BitmapFactory.decodeByteArray(bytes,0,bytes.size,bounds);assertTrue(bounds.outWidth<=1024&&bounds.outHeight<=1024);assertTrue(bounds.outWidth>0)
   try{CapturePreview.fromUri(context,Uri.parse("content://another.app/private"));fail("External provider accepted")}catch(_:IllegalArgumentException){}
  }finally{source.recycle();file.delete()}
 }
}
