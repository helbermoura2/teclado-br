package app.cena

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.util.Base64
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class VisualModelTest {
    @Test(timeout = 90000) fun bundledVisualModelRunsOnAndroidAndDistinguishesImages() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val fixture = instrumentation.context.assets.open("marshals-photo.base64").bufferedReader().use { it.readText() }
        val bytes = Base64.decode(fixture, Base64.DEFAULT)
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        val photo = VisualMatcher.pixels(bitmap)
        bitmap.recycle()
        val different = Bitmap.createBitmap(224,224, Bitmap.Config.ARGB_8888).apply { eraseColor(Color.RED) }
        val other = VisualMatcher.pixels(different)
        different.recycle()
        VisualMatcher(instrumentation.targetContext).use { engine ->
            val a = engine.embedding(photo)
            val b = engine.embedding(photo)
            val c = engine.embedding(other)
            assertTrue(VisualModelStore.status(instrumentation.targetContext).optBoolean("available"))
            var notified=false
            VisualModelStore.download(instrumentation.targetContext){notified=true}
            assertTrue("An installed model must be reused without starting another download",notified)
            assertEquals(512, a.size)
            assertTrue(a.all { it.isFinite() })
            val same = a.indices.sumOf { (a[it]*b[it]).toDouble() }
            val differentScore = a.indices.sumOf { (a[it]*c[it]).toDouble() }
            assertTrue("Identical photo similarity must be near 1, got $same", same > .999)
            assertTrue("Photo must differ from a plain red reference, got $differentScore", same > differentScore + .05)
        }
    }
}
