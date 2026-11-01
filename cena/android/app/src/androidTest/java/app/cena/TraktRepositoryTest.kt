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
class TraktRepositoryTest {
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val client="cena-public-test-client-0000000000"
    private var clock=1700000000000L
    @Before fun prepare() { context.getSharedPreferences("cena.trakt.v1",Context.MODE_PRIVATE).edit().clear().commit() }
    @After fun clear() { prepare() }
    private fun response(value: Any, status: Int=200, pages:Int=1) = TraktResponse(status, value.toString(), pages)
    private fun transport(extra:(String,String,JSONObject?)->TraktResponse = {_,_,_->response(JSONArray())}): TraktTransport = TraktTransport { method,path,body,_,_ ->
        when(path) {
            "/oauth/device/code" -> response(JSONObject().put("device_code","private-device-grant").put("user_code","CENA-CODE").put("verification_url","https://trakt.tv/activate").put("expires_in",600).put("interval",5))
            "/oauth/device/token" -> response(JSONObject().put("access_token","private-access-test").put("refresh_token","private-refresh-test").put("created_at",clock/1000).put("expires_in",3600))
            "/users/settings" -> response(JSONObject().put("user",JSONObject().put("username","test-owner").put("ids",JSONObject().put("slug","test-owner"))))
            else -> extra(method,path,body)
        }
    }
    private fun login(repo:TraktRepository) { repo.configure(client); repo.beginAuth(); clock+=5000; repo.pollAuth(); assertTrue(repo.status().getBoolean("connected")) }
    @Test fun authorizationUsesPrivateStorageAndExportsNoTokenToTheWebView() {
        val repo=TraktRepository(context,transport()){clock}
        repo.configure(client);repo.beginAuth()
        assertEquals("CENA-CODE",repo.status().getString("userCode"));assertFalse(repo.status().has("deviceCode"))
        clock+=5000;repo.pollAuth()
        assertTrue(repo.status().getBoolean("connected"));assertFalse(repo.status().toString().contains("private-access-test"))
        val raw=context.getSharedPreferences("cena.trakt.v1",Context.MODE_PRIVATE).getString("sealed","")!!
        assertFalse(raw.contains("private-access-test"));assertFalse(raw.contains("private-refresh-test"))
    }
    @Test fun failedWritesStayPendingAndOnlyAcknowledgedWritesBecomeSynced() {
        var accept=false
        val fake=transport { method,path,_ ->
            if(method=="POST" && path=="/sync/watchlist") if(accept) response(JSONObject().put("added",JSONObject().put("movies",1))) else response(JSONObject(),503)
            else response(JSONArray())
        }
        val repo=TraktRepository(context,fake){clock};login(repo)
        val action=JSONObject().put("id","tt14846026").put("type","movie").put("action","add")
        repo.enqueue(action);repo.sync(true)
        assertEquals(1,repo.status().getJSONArray("pending").length());assertEquals(0,repo.status().getJSONArray("synced").length())
        accept=true;clock+=60000;repo.sync(true)
        assertEquals(0,repo.status().getJSONArray("pending").length());assertEquals(1,repo.status().getJSONArray("synced").length())
    }
    @Test fun remoteWatchlistAndWatchedHistoryAreReadIncludingLaterPages() {
        val fake=transport { _,path,_ ->
            when {
                path.startsWith("/sync/watchlist/movies") -> response(JSONArray().put(JSONObject().put("movie",JSONObject().put("title","Sisu").put("year",2022).put("ids",JSONObject().put("imdb","tt14846026")))))
                path.startsWith("/sync/watched/movies") && path.contains("page=1") -> response(JSONArray(),pages=2)
                path.startsWith("/sync/watched/movies") -> response(JSONArray().put(JSONObject().put("last_watched_at","2026-11-01T12:00:00Z").put("movie",JSONObject().put("ids",JSONObject().put("imdb","tt14846026")))))
                else -> response(JSONArray())
            }
        }
        val repo=TraktRepository(context,fake){clock};login(repo);repo.sync(true)
        assertEquals(1,repo.status().getJSONArray("watchlist").length());assertEquals(1,repo.status().getJSONArray("watched").length());assertTrue(repo.status().getLong("lastSync")>0)
    }
}
