package app.cena

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Before
import org.junit.After
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SeriesRepositoryTest {
    private val context get()=InstrumentationRegistry.getInstrumentation().targetContext
    private var clock=1700000000000L
    @Before fun prepare(){context.getSharedPreferences("cena.series.v1",Context.MODE_PRIVATE).edit().clear().commit()}
    @After fun clear(){prepare()}
    private fun raw(aired:Int=5,completed:Int=3)=JSONObject().put("aired",aired).put("completed",completed).put("next_episode",JSONObject().put("season",2).put("number",1).put("title","Next episode"))
    @Test fun newEpisodesRequireAConfirmedEarlierBaselineAndNeverMarkTheWholeSeriesWatched(){
        val first=SeriesProgress.parse("tt1234567",raw(),null,null,"history",clock)
        assertEquals(2,first.getInt("available"));assertEquals(0,first.getInt("newEpisodes"));assertFalse(first.has("status"))
        val next=SeriesProgress.parse("tt1234567",raw(6,3),JSONObject().put("season",2).put("number",1).put("first_aired","2026-12-01T00:00:00Z"),first,"history",clock+SeriesProgress.INTERVAL)
        assertEquals(1,next.getInt("newEpisodes"));assertEquals(3,next.getInt("available"));assertEquals("2026-12-01T00:00:00Z",next.getJSONObject("next").getString("firstAired"))
        val watched=SeriesProgress.parse("tt1234567",raw(6,6),null,next,"new-history",clock+SeriesProgress.INTERVAL+1)
        assertEquals(0,watched.getInt("available"));assertEquals(0,watched.getInt("newEpisodes"))
        val special=SeriesProgress.parse("tt1234567",raw().put("next_episode",JSONObject().put("season",0).put("number",1)),null,null,"",clock)
        assertEquals(0,special.getJSONObject("next").length())
    }
    @Test fun twelveHourCacheRefreshesOnHistoryChangesAndPreservesPriorDataOnNetworkFailure(){
        var calls=0;var fail=false;var history="old";var connected=true
        val source=object:SeriesSource{
            override fun snapshot()=JSONObject().put("connected",connected).put("account","owner").put("series",JSONArray().put(JSONObject().put("id","tt1234567").put("episodes",3).put("watchedAt",history)))
            override fun progress(id:String):JSONObject{calls++;if(fail)throw IllegalStateException("offline");return raw(if(calls>1)6 else 5)}
            override fun episode(id:String,season:Int,number:Int)=JSONObject().put("season",season).put("number",number).put("title","Next episode").put("first_aired","2026-11-01T00:00:00Z")
        }
        val repo=SeriesRepository(context,source,{clock})
        assertFalse(repo.refresh());assertEquals(1,calls);assertFalse(repo.refresh());assertEquals(1,calls)
        clock+=SeriesProgress.INTERVAL+1;repo.refresh();assertEquals(2,calls);assertEquals(1,repo.status().getJSONArray("items").getJSONObject(0).getInt("newEpisodes"))
        history="updated";clock++;repo.refresh();assertEquals(3,calls)
        val prior=repo.status().getJSONArray("items").getJSONObject(0).getInt("available")
        fail=true;clock+=SeriesProgress.INTERVAL+1;repo.refresh();val row=repo.status().getJSONArray("items").getJSONObject(0)
        assertEquals(prior,row.getInt("available"));assertTrue(row.getString("error").isNotBlank());assertFalse(repo.status().getBoolean("reading"))
        connected=false;repo.refresh();assertEquals(0,repo.status().getJSONArray("items").length());assertFalse(context.getSharedPreferences("cena.series.v1",Context.MODE_PRIVATE).contains("sealed"))
    }
    @Test fun largeLibrariesContinueInBatchesAndAnAccountSwitchClearsThePreviousSeries(){
        var calls=0;var account="first";var ids=(0 until 25).map{"tt${1000000+it}"}
        val source=object:SeriesSource{
            override fun snapshot()=JSONObject().put("connected",true).put("account",account).put("series",JSONArray(ids.map{JSONObject().put("id",it)}))
            override fun progress(id:String):JSONObject{calls++;return JSONObject().put("aired",2).put("completed",0)}
            override fun episode(id:String,season:Int,number:Int)=throw AssertionError("No next episode should be requested")
        }
        val repo=SeriesRepository(context,source,{clock})
        assertTrue(repo.refresh());assertEquals(20,calls);assertEquals(5,repo.status().getInt("pending"));assertFalse(repo.refresh());assertEquals(25,calls)
        clock++;assertTrue(repo.refresh(true));assertFalse(repo.refresh());assertEquals(50,calls)
        account="second";ids=listOf("tt2000000");assertEquals(0,repo.status().getJSONArray("items").length());repo.refresh();assertEquals(1,repo.status().getJSONArray("items").length());assertEquals("tt2000000",repo.status().getJSONArray("items").getJSONObject(0).getString("id"))
    }
}
