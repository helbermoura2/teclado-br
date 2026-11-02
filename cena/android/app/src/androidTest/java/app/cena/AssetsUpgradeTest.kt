package app.cena

import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class AssetsUpgradeTest {
    private fun findWeb(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) for (i in 0 until view.childCount) findWeb(view.getChildAt(i))?.let { return it }
        return null
    }
    private fun evaluate(scenario: ActivityScenario<MainActivity>, code: String): String {
        var output = ""; val done = CountDownLatch(1)
        scenario.onActivity { activity -> findWeb(activity.window.decorView)!!.evaluateJavascript(code) { output = it; done.countDown() } }
        assertTrue(done.await(10, TimeUnit.SECONDS))
        return output
    }
    @Test(timeout = 45000) fun signedUpdatePreservesDataAndShowsTheFullTitleField() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        assertEquals("app.cena.mobile", context.packageName)
        assertEquals("update", File(context.filesDir, "legacy-update-marker.txt").readText().trim())
        assertEquals("0.11.0", context.packageManager.getPackageInfo(context.packageName, 0).versionName)
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val deadline = android.os.SystemClock.uptimeMillis()+15000
            while (!evaluate(scenario, "typeof window.CenaNativeResult").contains("function")) {
                assertTrue(android.os.SystemClock.uptimeMillis()<deadline)
                Thread.sleep(200)
            }
            assertTrue(evaluate(scenario, "location.pathname").contains("/cena-0.11.0/"))
            assertTrue(evaluate(scenario, "document.querySelector('#app-version').textContent").contains("0.11.0"))
            assertTrue(evaluate(scenario, "typeof window.CenaStremioResult").contains("function"))
            evaluate(scenario, "document.querySelector('nav [data-tab=connect]').click(); true")
            assertTrue(evaluate(scenario, "document.querySelector('#stremio-connect') !== null").contains("true"))
            evaluate(scenario, "document.querySelector('nav [data-tab=scan]').click(); true")
            assertTrue(evaluate(scenario, "document.querySelector('#pick-image') !== null").contains("true"))
            assertTrue(evaluate(scenario, "document.querySelector('#scan-query').tagName").contains("TEXTAREA"))
            assertTrue(evaluate(scenario, "document.querySelector('main h1').textContent").contains("Capturar"))
        }
    }
}
