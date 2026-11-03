package app.cena

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject

/** Canonical local catalog/settings; OAuth credentials remain in the separate encrypted vaults. */
class AppDataStore(context:Context,name:String="cena-library.db"):SQLiteOpenHelper(context,name,null,1){
 companion object {
  val keys=setOf("cena.local.items.v1","cena.story.notes.v1","cena.collections.v1","cena.feedback.v1","cena.resume.hidden.v1","cena.history.archive.v1")
  private val lock=Any()
 }
 init{setWriteAheadLoggingEnabled(true)}
 override fun onCreate(db:SQLiteDatabase){db.execSQL("CREATE TABLE settings (key TEXT PRIMARY KEY,payload TEXT NOT NULL)");db.execSQL("CREATE TABLE titles (identity TEXT PRIMARY KEY,position INTEGER NOT NULL,payload TEXT NOT NULL)")}
 override fun onUpgrade(db:SQLiteDatabase,oldVersion:Int,newVersion:Int){}
 fun get(key:String):String=synchronized(lock){require(key in keys);val value=readableDatabase.rawQuery("SELECT payload FROM settings WHERE key=?",arrayOf(key)).use{if(it.moveToFirst())it.getString(0)else "null"};if(key!="cena.local.items.v1"||value=="null")value else readableDatabase.rawQuery("SELECT payload FROM titles ORDER BY position",null).use{val rows=JSONArray();while(it.moveToNext())rows.put(JSONObject(it.getString(0)));rows.toString()}}
 private fun validate(key:String,value:String){require(key in keys&&value.length<=24*1024*1024);if(key=="cena.local.items.v1"){val rows=JSONArray(value);require(rows.length()<=20000);val seen=HashSet<String>();for(i in 0 until rows.length()){val row=rows.getJSONObject(i);require(row.getString("id").matches(Regex("[A-Za-z0-9:._-]{1,180}"))&&row.getString("type") in setOf("movie","series"));require(seen.add(row.getString("type")+":"+row.getString("id")))}}else JSONObject(value)}
 fun put(key:String,value:String)=synchronized(lock){validate(key,value);val db=writableDatabase;db.beginTransaction();try{if(key=="cena.local.items.v1"){val rows=JSONArray(value);val previous=HashMap<String,Pair<Int,String>>();db.rawQuery("SELECT identity,position,payload FROM titles",null).use{cursor->while(cursor.moveToNext())previous[cursor.getString(0)]=Pair(cursor.getInt(1),cursor.getString(2))};for(i in 0 until rows.length()){val row=rows.getJSONObject(i);val id=row.getString("type")+":"+row.getString("id");val payload=row.toString();val old=previous.remove(id);if(old==null||old.first!=i||old.second!=payload)db.insertWithOnConflict("titles",null,ContentValues().apply{put("identity",id);put("position",i);put("payload",payload)},SQLiteDatabase.CONFLICT_REPLACE)};for(id in previous.keys)db.delete("titles","identity=?",arrayOf(id))}

 db.insertWithOnConflict("settings",null,ContentValues().apply{put("key",key);put("payload",if(key=="cena.local.items.v1")"[]"else value)},SQLiteDatabase.CONFLICT_REPLACE);db.setTransactionSuccessful()}finally{db.endTransaction()}}
 fun batch(values:JSONObject)=synchronized(lock){for(key in values.keys())validate(key,values.get(key).toString());val db=writableDatabase;db.beginTransaction();try{for(key in values.keys())put(key,values.get(key).toString());db.setTransactionSuccessful()}finally{db.endTransaction()}}
 fun dump():JSONObject=synchronized(lock){val out=JSONObject();for(key in keys){val raw=get(key);if(raw!="null")out.put(key,if(key=="cena.local.items.v1")JSONArray(raw)else JSONObject(raw))};out}
}
