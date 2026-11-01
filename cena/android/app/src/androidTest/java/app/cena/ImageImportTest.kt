package app.cena

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.core.content.FileProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.intent.Intents
import androidx.test.espresso.intent.Intents.intending
import androidx.test.espresso.intent.matcher.IntentMatchers.hasAction
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import androidx.test.espresso.matcher.ViewMatchers.withText
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class ImageImportTest {
    private fun screenshot(): Uri {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val bitmap = Bitmap.createBitmap(1000, 600, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)
        canvas.drawText("SISU", 200f, 340f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; textSize = 200f; typeface = android.graphics.Typeface.DEFAULT_BOLD })
        val file = File.createTempFile("test-print-", ".png", File(context.cacheDir, "captures").apply { mkdirs() })
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
        return FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    }
    private fun findWeb(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) for (index in 0 until view.childCount) findWeb(view.getChildAt(index))?.let { return it }
        return null
    }
    private fun evaluate(scenario: ActivityScenario<MainActivity>, code: String): String {
        var result = ""; val done = CountDownLatch(1)
        scenario.onActivity { activity -> findWeb(activity.window.decorView)!!.evaluateJavascript(code) { result = it; done.countDown() } }
        assertTrue("JavaScript response timed out", done.await(10, TimeUnit.SECONDS))
        return result
    }
    private fun eventually(block: () -> Unit) {
        var last: Throwable? = null
        repeat(60) {
            try { block(); return } catch (error: Throwable) { last = error; Thread.sleep(500) }
        }
        throw AssertionError("Image import did not finish", last)
    }
    private fun readEntireImage(scenario: ActivityScenario<MainActivity>) {
        eventually { onView(withText("Ler imagem inteira")).check(matches(isDisplayed())) }
        onView(withText("Ler imagem inteira")).perform(click())
        eventually { assertTrue(evaluate(scenario, "document.querySelector('#scan-query')?.value || ''").contains("SISU", ignoreCase = true)) }
    }
    @Test fun sharedPngOpensCropAndReadsTitleOnColdStart() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_SEND; type = "image/png"
            putExtra(Intent.EXTRA_STREAM, screenshot())
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        ActivityScenario.launch<MainActivity>(intent).use { scenario -> readEntireImage(scenario) }
    }
    @Test fun galleryButtonAcceptsPngAndReadsTitle() {
        Intents.init()
        try {
            intending(hasAction(Intent.ACTION_GET_CONTENT)).respondWith(Instrumentation.ActivityResult(Activity.RESULT_OK, Intent().setData(screenshot())))
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                eventually { assertTrue(evaluate(scenario, "typeof window.CenaNativeResult").contains("function")) }
                evaluate(scenario, "document.querySelector('nav [data-tab=scan]').click(); document.querySelector('#pick-image').click(); true")
                readEntireImage(scenario)
            }
        } finally { Intents.release() }
    }
}
