package app.cena

import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class StoryArtworkTest {
    private fun findWeb(view:View):WebView?{
        if(view is WebView)return view
        if(view is ViewGroup)for(i in 0 until view.childCount)findWeb(view.getChildAt(i))?.let{return it}
        return null
    }
    private fun evaluate(scenario:ActivityScenario<MainActivity>,code:String):String{
        var result="";val latch=CountDownLatch(1)
        scenario.onActivity{findWeb(it.window.decorView)!!.evaluateJavascript(code){value->result=value;latch.countDown()}}
        assertTrue(latch.await(10,TimeUnit.SECONDS));return result
    }
    private fun until(scenario:ActivityScenario<MainActivity>,code:String,seconds:Long=30){
        val deadline=android.os.SystemClock.elapsedRealtime()+seconds*1000
        while(evaluate(scenario,code)!="true"){assertTrue("Story condition timed out: $code",android.os.SystemClock.elapsedRealtime()<deadline);Thread.sleep(200)}
    }
    @Test(timeout=90000) fun pianistPosterLoadsThroughAndroidAndExportsIntoTheActualStoryCanvas(){
        assertFalse(StoryArtwork.allowed("http://images.metahub.space/poster.jpg"));assertFalse(StoryArtwork.allowed("https://example.org/image.jpg"));assertFalse(StoryArtwork.allowed("https://user@image.tmdb.org/image.jpg"))
        ActivityScenario.launch(MainActivity::class.java).use{scenario->
            until(scenario,"typeof window.CenaStoryArtworkResult==='function'")
            evaluate(scenario,"localStorage.setItem('cena.connection.v1',JSON.stringify({apiBase:'local'}));localStorage.setItem('cena.local.items.v1',JSON.stringify([{id:'tt0253474',type:'movie',name:'The Pianist',year:'2002',status:'watchlist',poster:'https://images.metahub.space/poster/medium/tt0253474/img'}]));location.reload();true")
            until(scenario,"typeof window.CenaStoryArtworkResult==='function' && document.querySelector('.poster-card[data-id=tt0253474]')!==null")
            evaluate(scenario,"document.querySelector('.poster-card[data-id=tt0253474]').click();document.querySelector('#share-title').click();true")
            until(scenario,"document.querySelector('#story-status')?.dataset.state==='ready'",45)
            assertEquals("true",evaluate(scenario,"document.querySelector('#story-canvas').dataset.posterLoaded==='true' && !document.querySelector('#share-story').disabled"))
            val encoded=JSONArray("["+evaluate(scenario,"document.querySelector('#story-canvas').toDataURL('image/png')")+"]").getString(0).substringAfter(',')
            val bytes=Base64.decode(encoded,Base64.DEFAULT);val bitmap=BitmapFactory.decodeByteArray(bytes,0,bytes.size)
            assertEquals(1080,bitmap.width);assertEquals(1920,bitmap.height)
            val colors=mutableSetOf<Int>();for(y in 240..1200 step 40)for(x in 200..880 step 40)colors.add(bitmap.getPixel(x,y))
            assertTrue("Real poster pixels must be present, not an empty placeholder",colors.size>100);bitmap.recycle()
            File(InstrumentationRegistry.getInstrumentation().targetContext.filesDir,"story-with-poster.png").writeBytes(bytes)
            println("The Pianist real native poster rendered in exportable 1080x1920 PNG; distinct sampled poster colors: ${colors.size}")
        }
    }
}
