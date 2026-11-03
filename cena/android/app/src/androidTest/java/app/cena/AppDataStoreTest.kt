package app.cena

import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class AppDataStoreTest {
 private val context get()=InstrumentationRegistry.getInstrumentation().targetContext
 private fun item(id:String="tt1335975",type:String="movie")=JSONObject().put("id",id).put("type",type).put("name","Título").put("status","watchlist")
 @Test fun catalogPersistsOrderAndDistinctIdentitiesAcrossReopening(){val name="cena-test-${java.util.UUID.randomUUID()}.db";try{AppDataStore(context,name).use{store->assertEquals("null",store.get("cena.local.items.v1"));store.put("cena.local.items.v1",JSONArray().put(item()).put(item("tt0903747","series")).toString())};AppDataStore(context,name).use{store->val rows=JSONArray(store.get("cena.local.items.v1"));assertEquals(2,rows.length());assertEquals("tt1335975",rows.getJSONObject(0).getString("id"));store.put("cena.local.items.v1",JSONArray().put(item("tt0903747","series")).toString());assertEquals(1,JSONArray(store.get("cena.local.items.v1")).length())}}finally{context.deleteDatabase(name)}}
 @Test fun invalidRestoreBatchCannotPartiallyReplaceData(){val name="cena-test-${java.util.UUID.randomUUID()}.db";try{AppDataStore(context,name).use{store->store.put("cena.local.items.v1",JSONArray().put(item()).toString());val before=store.get("cena.local.items.v1");try{store.batch(JSONObject().put("cena.local.items.v1",JSONArray()).put("cena.feedback.v1",JSONArray()));fail("Invalid settings must fail")}catch(_:Exception){};assertEquals(before,store.get("cena.local.items.v1"));assertEquals("null",store.get("cena.feedback.v1"))}}finally{context.deleteDatabase(name)}}
 @Test fun backupDumpNeverExportsConnectionOrVaultKeys(){val name="cena-test-${java.util.UUID.randomUUID()}.db";try{AppDataStore(context,name).use{store->try{store.put("cena.connection.v1","{\"writeToken\":\"secret\"}");fail("Credentials must remain outside this store")}catch(_:Exception){};store.put("cena.local.items.v1",JSONArray().put(item()).toString());assertFalse(store.dump().toString().contains("writeToken"));assertFalse(store.dump().toString().contains("access_token"));assertEquals(1,store.dump().getJSONArray("cena.local.items.v1").length())}}finally{context.deleteDatabase(name)}}
}
