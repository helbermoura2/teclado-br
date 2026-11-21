package app.cena

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject

/** Private local ledger. Credentials are never stored in this database. */
class WatchHistoryStore(context:Context):SQLiteOpenHelper(context,"cena-watch-history.db",null,1){
 init{setWriteAheadLoggingEnabled(true)}
 override fun onCreate(db:SQLiteDatabase){
  for(table in listOf("events","staging"))db.execSQL("CREATE TABLE $table (account TEXT NOT NULL, event_id TEXT NOT NULL, media_key TEXT NOT NULL, kind TEXT NOT NULL, imdb TEXT NOT NULL, watched_ms INTEGER, payload TEXT NOT NULL, PRIMARY KEY(account,event_id))")
  db.execSQL("CREATE INDEX history_account_date ON events(account,watched_ms DESC)")
  db.execSQL("CREATE INDEX history_account_media ON events(account,imdb)")
  db.execSQL("CREATE TABLE metadata (account TEXT PRIMARY KEY, payload TEXT NOT NULL)")
 }
 override fun onUpgrade(db:SQLiteDatabase,oldVersion:Int,newVersion:Int){}
 fun meta(account:String):JSONObject=readableDatabase.rawQuery("SELECT payload FROM metadata WHERE account=?",arrayOf(account)).use{if(it.moveToFirst())JSONObject(it.getString(0))else JSONObject()}
 fun setMeta(account:String,value:JSONObject){writableDatabase.insertWithOnConflict("metadata",null,ContentValues().apply{put("account",account);put("payload",value.toString())},SQLiteDatabase.CONFLICT_REPLACE)}
 fun begin(account:String,meta:JSONObject){val db=writableDatabase;db.beginTransaction();try{db.delete("staging","account=?",arrayOf(account));setMeta(account,meta);db.setTransactionSuccessful()}finally{db.endTransaction()}}
 fun stage(account:String,rows:List<JSONObject>,meta:JSONObject){val db=writableDatabase;db.beginTransaction();try{
  for(row in rows){val at=row.optLong("watchedMs");db.insertWithOnConflict("staging",null,ContentValues().apply{put("account",account);put("event_id",row.getString("eventId"));put("media_key",row.getString("mediaKey"));put("kind",row.getString("kind"));put("imdb",row.optString("id"));if(row.optString("datePrecision")=="exact")put("watched_ms",at)else putNull("watched_ms");put("payload",row.toString())},SQLiteDatabase.CONFLICT_REPLACE)}
  setMeta(account,meta);db.setTransactionSuccessful()
 }finally{db.endTransaction()}}
 fun commit(account:String,meta:JSONObject){val db=writableDatabase;db.beginTransaction();try{
  db.execSQL("INSERT OR REPLACE INTO events(account,event_id,media_key,kind,imdb,watched_ms,payload) SELECT account,event_id,media_key,kind,imdb,watched_ms,payload FROM staging WHERE account=?",arrayOf(account))
  db.delete("staging","account=?",arrayOf(account));setMeta(account,meta);db.setTransactionSuccessful()
 }finally{db.endTransaction()}}
 fun rows(account:String):List<JSONObject> = readableDatabase.rawQuery("SELECT payload FROM events WHERE account=? ORDER BY watched_ms DESC,event_id DESC",arrayOf(account)).use{cursor->buildList{while(cursor.moveToNext())add(JSONObject(cursor.getString(0)))}}
 fun page(account:String,year:String,kind:String,page:Int,mediaId:String=""):JSONObject {
  val where=StringBuilder("account=?");val args=mutableListOf(account)
  if(year=="unknown")where.append(" AND watched_ms IS NULL")
  else if(year.toIntOrNull()?.let{it in 1..9999}==true){val y=year.toInt();val zone=java.time.ZoneId.systemDefault();where.append(" AND watched_ms>=? AND watched_ms<?");args.add(java.time.LocalDate.of(y,1,1).atStartOfDay(zone).toInstant().toEpochMilli().toString());args.add(java.time.LocalDate.of(y+1,1,1).atStartOfDay(zone).toInstant().toEpochMilli().toString())}
  if(kind in listOf("movie","episode")){where.append(" AND kind=?");args.add(kind)}
  if(mediaId.matches(Regex("tt\\d{5,12}"))){where.append(" AND imdb=?");args.add(mediaId)}
  val total=readableDatabase.rawQuery("SELECT COUNT(*) FROM events WHERE $where",args.toTypedArray()).use{it.moveToFirst();it.getInt(0)}
  val rows=JSONArray();readableDatabase.rawQuery("SELECT payload FROM events WHERE $where ORDER BY watched_ms IS NULL,watched_ms DESC,event_id DESC LIMIT 50 OFFSET ?",(args+((page-1).coerceAtLeast(0)*50).toString()).toTypedArray()).use{while(it.moveToNext())rows.put(JSONObject(it.getString(0)))}
  return JSONObject().put("rows",rows).put("total",total).put("page",page).put("hasMore",page*50<total)
 }
}
