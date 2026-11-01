package app.cena

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class CoverRecognitionTest {
    @Test(timeout = 90000) fun extractActualPhotosWithTheProductionOcrPipeline() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        val reports = JSONArray()
        try {
            for ((name, expected) in listOf("marshals-photo.base64" to "tt0120873", "margaret-photo.base64" to "tt3915174")) {
                val encoded = instrumentation.context.assets.open(name).bufferedReader().use { it.readText() }
                val bytes = Base64.decode(encoded, Base64.DEFAULT)
                val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                val text = Tasks.await(recognizer.process(InputImage.fromBitmap(bitmap, 0)), 30, TimeUnit.SECONDS)
                val payload = CoverOcr.analyze(text)
                bitmap.recycle()
                assertTrue("Photo must produce OCR text", payload.getString("fullText").isNotBlank())
                reports.put(JSONObject().put("expected", expected).put("payload", payload))
            }
        } finally { recognizer.close() }
        File(instrumentation.targetContext.filesDir, "native-ocr.json").writeText(reports.toString())
    }
}
