package app.cena

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.util.Base64
import androidx.core.content.FileProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.intent.Intents
import androidx.test.espresso.intent.Intents.intending
import androidx.test.espresso.intent.matcher.IntentMatchers.hasAction
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayOutputStream
import java.io.File

@RunWith(AndroidJUnit4::class)
class StoryExportTest {
    private fun waitFor(condition: () -> Boolean) {
        val deadline=android.os.SystemClock.uptimeMillis()+10000
        while(!condition()) { assertTrue("Story export timed out",android.os.SystemClock.uptimeMillis()<deadline); Thread.sleep(100) }
    }
    @Test(timeout=45000) fun saveAndShareUsePngAndReadableContentUris() {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val buffer=ByteArrayOutputStream(); val bitmap=Bitmap.createBitmap(2,2,Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(0xff9959ff.toInt());bitmap.compress(Bitmap.CompressFormat.PNG,100,buffer);bitmap.recycle()
        val bytes=buffer.toByteArray(); val encoded=Base64.encodeToString(bytes,Base64.NO_WRAP)
        val file=File.createTempFile("saved-story-",".png",File(context.cacheDir,"stories").apply { mkdirs() })
        val destination=FileProvider.getUriForFile(context,"${context.packageName}.files",file)
        Intents.init()
        try {
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(Instrumentation.ActivityResult(Activity.RESULT_OK,Intent().setData(destination)))
            intending(hasAction(Intent.ACTION_CHOOSER)).respondWith(Instrumentation.ActivityResult(Activity.RESULT_CANCELED,null))
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                scenario.onActivity { it.Bridge().saveStory(encoded) }
                waitFor { file.length()==bytes.size.toLong() }
                assertArrayEquals(bytes,file.readBytes())
                scenario.onActivity { it.Bridge().shareStory(encoded) }
                waitFor { Intents.getIntents().any { it.action==Intent.ACTION_CHOOSER } }
                val chooser=Intents.getIntents().first { it.action==Intent.ACTION_CHOOSER }
                @Suppress("DEPRECATION") val share=chooser.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)!!
                assertEquals(Intent.ACTION_SEND,share.action);assertEquals("image/png",share.type)
                assertTrue(share.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION != 0)
                @Suppress("DEPRECATION") val uri=share.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)!!
                assertEquals("content",uri.scheme)
                assertArrayEquals(bytes,context.contentResolver.openInputStream(uri)!!.use { it.readBytes() })
            }
        } finally { Intents.release();file.delete() }
    }
}
