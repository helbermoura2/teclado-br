package app.cena

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.io.File

/** Only the test APK owns this provider and private public-fixture file. */
class TestModelProvider:ContentProvider(){
 override fun onCreate():Boolean {
  requireNotNull(context).grantUriPermission("app.cena.mobile",Uri.parse("content://app.cena.mobile.test.model/model"),android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
  return true
 }
 private fun fixture(uri:Uri):File {require(uri.path=="/model");return File(requireNotNull(context).filesDir,"smoke.gguf")}
 override fun openFile(uri:Uri,mode:String):ParcelFileDescriptor {require(mode=="r");return ParcelFileDescriptor.open(fixture(uri),ParcelFileDescriptor.MODE_READ_ONLY)}
 override fun getType(uri:Uri)="application/octet-stream"
 override fun query(uri:Uri,projection:Array<out String>?,selection:String?,selectionArgs:Array<out String>?,sortOrder:String?):Cursor {
  val file=fixture(uri);return MatrixCursor(arrayOf(OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE)).apply{addRow(arrayOf(file.name,file.length()))}
 }
 override fun insert(uri:Uri,values:ContentValues?):Uri?=throw UnsupportedOperationException()
 override fun update(uri:Uri,values:ContentValues?,selection:String?,selectionArgs:Array<out String>?)=throw UnsupportedOperationException()
 override fun delete(uri:Uri,selection:String?,selectionArgs:Array<out String>?)=throw UnsupportedOperationException()
}
