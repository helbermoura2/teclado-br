package app.cena

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class StremioRepositoryTest {
    private val context get()=InstrumentationRegistry.getInstrumentation().targetContext
    private var clock=1700000000000L
    @Before fun prepare(){context.getSharedPreferences("cena.stremio.v1",Context.MODE_PRIVATE).edit().clear().commit()}
    @After fun clear(){prepare()}
    private fun ok(value:Any)=StremioResponse(200,JSONObject().put("result",value).toString())
    private fun fake(extra:(String,String,JSONObject?)->StremioResponse={_,_,_->ok(JSONArray())})=StremioTransport {method,path,body->
        when {
            path=="/link/create"->ok(JSONObject().put("code","PAIR").put("link","https://link.stremio.com/PAIR"))
            path.startsWith("/link/read?code=")->ok(JSONObject().put("authKey","private-stremio-session-test"))
            path=="/getUser"->ok(JSONObject().put("email","test@example.org"))
            else->extra(method,path,body)
        }
    }
    private fun login(repo:StremioRepository){repo.beginLink();clock+=5000;repo.pollLink();assertTrue(repo.status().getBoolean("connected"))}
    @Test fun pendingAuthorizationDoesNotExpireOnError101AndCredentialsNeverReachTheWebView(){
        var pending=true
        val delegate=fake()
        val transport=StremioTransport {method,path,body->
            if(path.startsWith("/link/read")&&pending)StremioResponse(200,"""{"error":{"code":101,"message":"Invalid or expired token"}}""") else delegate.request(method,path,body)
        }
        val repo=StremioRepository(context,transport,{clock})
        TraktVault(context).write(JSONObject().put("isolationMarker","keep-existing-trakt"))
        repo.beginLink();clock+=5000;repo.pollLink()
        assertTrue(repo.status().getBoolean("pairing"));assertFalse(repo.status().getBoolean("connected"));assertFalse(repo.status().toString().contains("PAIR"))
        pending=false;clock+=5000;repo.pollLink()
        val state=repo.status().toString();assertTrue(repo.status().getBoolean("connected"));assertFalse(state.contains("private-stremio-session-test"));assertFalse(repo.status().has("pairCode"));assertFalse(repo.status().has("pairLink"))
        val sealed=context.getSharedPreferences("cena.stremio.v1",Context.MODE_PRIVATE).getString("sealed","")!!
        assertFalse(sealed.contains("private-stremio-session-test"));assertEquals("keep-existing-trakt",TraktVault(context).read().getString("isolationMarker"))
        try{StremioHttp().request("POST","/datastorePut",JSONObject());fail("Writes must be unreachable")}catch(_:IllegalArgumentException){}
        repo.disconnect();assertEquals("keep-existing-trakt",TraktVault(context).read().getString("isolationMarker"))
    }
    @Test fun everyIndexPageIsReadAndRemovedAndTemporaryRecordsAreExcluded(){
        val ids=(0 until 103).map{"tt${1000000+it}"};var reads=0;var failRead=false
        val transport=fake{method,path,body->
            assertEquals("POST",method);assertEquals("libraryItem",body!!.getString("collection"));assertEquals("private-stremio-session-test",body.getString("authKey"))
            when(path){
                "/datastoreMeta"->ok(JSONArray(ids.map{listOf(it,clock)}))
                "/datastoreGet"->{reads++;assertFalse(body.getBoolean("all"));if(failRead)StremioResponse(503,"{}")else {
                    val rows=JSONArray();val batch=body.getJSONArray("ids");assertTrue(batch.length()<=100)
                    for(i in 0 until batch.length()){val id=batch.getString(i);rows.put(JSONObject().put("_id",id).put("name","Title $id").put("type",if(id==ids.last())"series" else "movie").put("removed",id==ids[0]).put("temp",id==ids[1]))};ok(rows)
                }}
                else->throw AssertionError("Unexpected operation")
            }
        }
        val repo=StremioRepository(context,transport,{clock});login(repo);repo.readLibrary()
        assertEquals(2,reads);assertEquals(101,repo.status().getJSONArray("library").length());assertEquals(2,repo.status().getInt("excluded"));assertEquals(103,repo.status().getInt("processed"))
        val snapshot=repo.status().getJSONArray("library").toString();failRead=true;clock+=10000;repo.readLibrary()
        assertTrue(repo.status().getString("error").isNotBlank());assertEquals(snapshot,repo.status().getJSONArray("library").toString());assertFalse(repo.status().getBoolean("reading"))
    }
    @Test fun customIdentifiersRemainVisibleAndMissingRecordsAreReportedWithoutWrites(){
        val calls=mutableListOf<String>()
        val repo=StremioRepository(context,fake{_,path,_->calls.add(path);when(path){
            "/datastoreMeta"->ok(JSONArray().put(JSONArray().put("kitsu:123").put(clock)).put(JSONArray().put("tt1234567").put(clock)))
            "/datastoreGet"->ok(JSONArray().put(JSONObject().put("_id","kitsu:123").put("name","Anime").put("type","series").put("removed",false).put("temp",false)))
            else->throw AssertionError("Unexpected operation")
        }},{clock})
        login(repo);repo.readLibrary();assertEquals("kitsu:123",repo.status().getJSONArray("library").getJSONObject(0).getString("id"));assertTrue(repo.status().getString("warning").contains("1 registro"))
        repo.disconnect();assertFalse(repo.status().getBoolean("connected"));assertEquals(0,repo.status().getJSONArray("library").length());assertEquals(listOf("/datastoreMeta","/datastoreGet"),calls)
    }
    @Test fun authorizationIsNotAcceptedWhenTheAccountCannotBeValidated(){
        val delegate=fake()
        val repo=StremioRepository(context,StremioTransport{method,path,body->if(path=="/getUser")StremioResponse(503,"{}")else delegate.request(method,path,body)},{clock})
        repo.beginLink();clock+=5000;repo.pollLink();assertFalse(repo.status().getBoolean("connected"));assertTrue(repo.status().getBoolean("pairing"));assertTrue(repo.status().getString("error").isNotBlank())
    }
}
