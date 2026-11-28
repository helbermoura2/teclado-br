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
    @Test fun legacyActionsNeverWriteToTrakt() {
        var writes=0
        val fake=transport{method,path,_->if(method!="GET"&&path.startsWith("/sync/"))writes++;response(JSONArray())}
        val repo=TraktRepository(context,fake){clock};login(repo)
        repo.enqueue(JSONObject().put("id","tt14846026").put("type","movie").put("action","add"))
        repo.sync(true)
        assertEquals(0,writes);assertEquals(0,repo.status().getJSONArray("pending").length())
        assertFalse(repo.status().getBoolean("needsUpload"));assertTrue(repo.status().getBoolean("readOnly"))
        assertFalse(repo.markEpisode("{}").getBoolean("ok"))
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
    @Test fun watchedShowsAndPausedPlaybackAreDiscoveredOutsideTheLocalInventory() {
        val show=JSONObject().put("title","Verônica com K").put("year",2024).put("ids",JSONObject().put("imdb","tt1234567"))
        val episodes=JSONArray();for(number in 1..4)episodes.put(JSONObject().put("number",number).put("plays",1))
        val fake=transport { _,path,_ -> when {
            path.startsWith("/sync/watched/shows") -> response(JSONArray().put(JSONObject().put("show",show).put("last_watched_at","2026-11-04T00:00:00Z").put("seasons",JSONArray().put(JSONObject().put("number",1).put("episodes",episodes)))))
            path.startsWith("/sync/playback") -> response(JSONArray().put(JSONObject().put("type","episode").put("show",show).put("episode",JSONObject().put("season",1).put("number",5)).put("progress",42.5).put("paused_at","2026-11-04T00:10:00Z")))
            path.startsWith("/shows/tt1234567/progress") -> response(JSONObject().put("aired",8).put("completed",4).put("next_episode",JSONObject().put("season",1).put("number",5)))
            path.startsWith("/shows/tt1234567/seasons") -> response(JSONObject().put("season",1).put("number",5).put("first_aired","2025-01-01T00:00:00Z"))
            else -> response(JSONArray())
        }}
        val repo=TraktRepository(context,fake){clock};login(repo);repo.inventory(JSONArray());repo.sync(refresh=true)
        assertEquals(0,repo.status().getJSONArray("watchlist").length());assertEquals(4,repo.status().getJSONArray("progress").getJSONObject(0).getInt("episodes"));assertEquals("Verônica com K",repo.seriesSnapshot().getJSONArray("series").getJSONObject(0).getString("name"));assertEquals(5,repo.status().getJSONArray("paused").getJSONObject(0).getInt("episode"))
        val series=SeriesRepository(context,TraktSeriesSource(repo),{clock});try{series.refresh();val row=series.status().getJSONArray("items").getJSONObject(0);assertEquals(5,row.getJSONObject("next").getInt("number"));assertEquals(4,row.getInt("available"))}finally{series.clear()}
    }
    @Test fun failedPlaybackRefreshRetainsCompletedProgressAndItsPreviousPause() {
        var fail=false
        val fake=transport { _,path,_ -> if(path.startsWith("/sync/playback")){if(fail)response(JSONArray(),503)else response(JSONArray().put(JSONObject().put("type","movie").put("movie",JSONObject().put("title","Filme").put("ids",JSONObject().put("imdb","tt1335975"))).put("progress",15).put("paused_at","2026-11-04T00:00:00Z")))}else response(JSONArray()) }
        val repo=TraktRepository(context,fake){clock};login(repo);repo.sync(true);assertEquals(1,repo.status().getJSONArray("paused").length());fail=true;clock+=1000;repo.sync(refresh=true);assertEquals(clock,repo.status().getLong("lastSync"));assertEquals(1,repo.status().getJSONArray("paused").length());assertTrue(repo.status().getString("playbackError").isNotBlank());assertTrue(repo.status().getString("error").isBlank())
    }
    @Test fun foregroundRefreshNeverWritesToTrakt() {
        var writes=0
        val fake=transport { method,path,_ -> if(method=="POST"&&path.startsWith("/sync/"))writes++;response(JSONArray()) }
        val repo=TraktRepository(context,fake){clock};login(repo);repo.enqueue(JSONObject().put("id","tt1335975").put("type","movie").put("action","add"));repo.sync(true);clock+=1000;repo.sync(refresh=true)
        assertEquals(0,writes);assertEquals(0,repo.status().getJSONArray("pending").length())
    }

}
