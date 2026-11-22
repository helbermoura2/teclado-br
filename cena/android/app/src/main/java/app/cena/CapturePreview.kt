package app.cena

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import java.io.ByteArrayOutputStream
import kotlin.math.max

/** A session-only JPEG of the selected crop. Re-encoding removes EXIF metadata. */
object CapturePreview {
 fun fromUri(context:Context,uri:Uri):String {
  require(uri.scheme=="content"&&uri.authority=="${context.packageName}.files")
  val bounds=BitmapFactory.Options().apply{inJustDecodeBounds=true}
  context.contentResolver.openInputStream(uri).use{BitmapFactory.decodeStream(it,null,bounds)}
  require(bounds.outWidth>0&&bounds.outHeight>0)
  var sample=1;while(max(bounds.outWidth,bounds.outHeight)/sample>2048)sample*=2
  val bitmap=context.contentResolver.openInputStream(uri).use{BitmapFactory.decodeStream(it,null,BitmapFactory.Options().apply{inSampleSize=sample})}?:error("Imagem inválida")
  val ratio=minOf(1f,1024f/max(bitmap.width,bitmap.height));val scaled=if(ratio<1)Bitmap.createScaledBitmap(bitmap,max(1,(bitmap.width*ratio).toInt()),max(1,(bitmap.height*ratio).toInt()),true)else bitmap
  try{val out=ByteArrayOutputStream();for(quality in listOf(82,65,48)){out.reset();check(scaled.compress(Bitmap.CompressFormat.JPEG,quality,out));if(out.size()<=650000)break};val bytes=out.toByteArray();require(bytes.size<=650000);return "data:image/jpeg;base64,"+Base64.encodeToString(bytes,Base64.NO_WRAP)}
  finally{if(scaled!==bitmap)scaled.recycle();bitmap.recycle()}
 }
}
