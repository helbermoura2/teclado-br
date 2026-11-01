package app.cena

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.net.Uri
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.nio.FloatBuffer
import kotlin.math.max
import kotlin.math.sqrt

/** Image-to-image CLIP comparison. All inference and photo pixels stay on-device. */
class VisualMatcher(private val context: Context) : AutoCloseable {
    private val environment = OrtEnvironment.getEnvironment()
    private var session: OrtSession? = null
    private val references = LinkedHashMap<String, FloatArray>()

    private fun model(): OrtSession {
        session?.let { return it }
        val info = JSONObject(context.assets.open("models/model-info.json").bufferedReader().use { it.readText() })
        val file = File(File(context.filesDir, "vision").apply { mkdirs() }, "clip-${info.getString("sha256").take(16)}.onnx")
        if (!file.exists() || file.length() != info.getLong("size")) {
            val temporary = File(file.parentFile, file.name + ".tmp")
            context.assets.open("models/clip-vision.onnx").use { input -> temporary.outputStream().use { input.copyTo(it) } }
            require(temporary.length() == info.getLong("size"))
            require(temporary.renameTo(file))
        }
        val options = OrtSession.SessionOptions().apply { setIntraOpNumThreads(2); setInterOpNumThreads(1) }
        try { session = environment.createSession(file.absolutePath, options) } finally { options.close() }
        return session!!
    }

    fun embedding(pixels: FloatArray): FloatArray {
        OnnxTensor.createTensor(environment, FloatBuffer.wrap(pixels), longArrayOf(1, 3, 224, 224)).use { tensor ->
            model().run(mapOf("pixel_values" to tensor)).use { result ->
                val output = result.get("image_embeds").orElse(result[0]) as OnnxTensor
                val buffer = output.floatBuffer
                val vector = FloatArray(buffer.remaining()).apply { buffer.get(this) }
                require(vector.size == 512)
                val length = sqrt(vector.sumOf { (it * it).toDouble() }).toFloat().coerceAtLeast(0.000001f)
                for (index in vector.indices) vector[index] /= length
                return vector
            }
        }
    }

    fun compare(source: FloatArray, candidates: JSONArray): JSONArray {
        val original = embedding(source)
        val scores = JSONArray()
        for (index in 0 until minOf(candidates.length(), 4)) {
            val item = candidates.getJSONObject(index)
            val id = item.optString("id")
            val address = item.optString("poster")
            if (!Regex("tt\\d{5,12}").matches(id)) continue
            try {
                val reference = references[address] ?: run {
                    val bitmap = download(address)
                    val pixels = try { pixels(bitmap) } finally { bitmap.recycle() }
                    embedding(pixels).also {
                        if (references.size >= 40) references.remove(references.keys.first())
                        references[address] = it
                    }
                }
                var cosine = 0f
                for (i in original.indices) cosine += original[i] * reference[i]
                scores.put(JSONObject().put("id", id).put("score", cosine.coerceIn(0f, 1f).toDouble()))
            } catch (_: Exception) { /* Missing reference posters do not discard text matches. */ }
        }
        return scores
    }

    private fun download(address: String): Bitmap {
        val url = URL(address)
        require(url.protocol == "https" && url.host in setOf("upload.wikimedia.org", "image.tmdb.org"))
        val connection = (url.openConnection() as HttpURLConnection).apply {
            connectTimeout = 4000; readTimeout = 5000; instanceFollowRedirects = false
            setRequestProperty("User-Agent", "CENA/0.4 (https://github.com/helbermoura2/teclado-br)")
        }
        try {
            require(connection.responseCode == 200)
            val bytes = ByteArrayOutputStream()
            connection.inputStream.use { input ->
                val buffer = ByteArray(8192)
                var total = 0
                while (true) {
                    val count = input.read(buffer); if (count < 0) break
                    total += count; require(total <= 8 * 1024 * 1024)
                    bytes.write(buffer, 0, count)
                }
            }
            val raw = bytes.toByteArray()
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(raw, 0, raw.size, bounds)
            require(bounds.outWidth > 0 && bounds.outHeight > 0)
            var sample = 1
            while (max(bounds.outWidth, bounds.outHeight) / sample > 1024) sample *= 2
            return BitmapFactory.decodeByteArray(raw, 0, raw.size, BitmapFactory.Options().apply { inSampleSize = sample }) ?: error("Poster unavailable")
        } finally { connection.disconnect() }
    }

    override fun close() { references.clear(); session?.close(); session = null }

    companion object {
        fun source(context: Context, uri: Uri): FloatArray {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            context.contentResolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
            require(bounds.outWidth > 0 && bounds.outHeight > 0)
            var sample = 1
            while (max(bounds.outWidth, bounds.outHeight) / sample > 1024) sample *= 2
            val bitmap = context.contentResolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample }) } ?: error("Image unavailable")
            return try { pixels(bitmap) } finally { bitmap.recycle() }
        }

        // CLIP's RGB center crop and normalization, without allocating a huge resized panorama.
        fun pixels(bitmap: Bitmap): FloatArray {
            val scale = max(224f / bitmap.width, 224f / bitmap.height)
            val w = (224 / scale).toInt().coerceIn(1, bitmap.width)
            val h = (224 / scale).toInt().coerceIn(1, bitmap.height)
            val left = (bitmap.width - w) / 2; val top = (bitmap.height - h) / 2
            val square = Bitmap.createBitmap(224, 224, Bitmap.Config.ARGB_8888)
            Canvas(square).drawBitmap(bitmap, Rect(left, top, left+w, top+h), Rect(0, 0, 224, 224), Paint(Paint.FILTER_BITMAP_FLAG))
            val rgb = IntArray(224 * 224)
            square.getPixels(rgb, 0, 224, 0, 0, 224, 224); square.recycle()
            val means = floatArrayOf(.48145466f, .4578275f, .40821073f)
            val stds = floatArrayOf(.26862954f, .26130258f, .27577711f)
            val output = FloatArray(3 * 224 * 224)
            for (i in rgb.indices) {
                output[i] = (((rgb[i] shr 16) and 255) / 255f - means[0]) / stds[0]
                output[224*224+i] = (((rgb[i] shr 8) and 255) / 255f - means[1]) / stds[1]
                output[2*224*224+i] = ((rgb[i] and 255) / 255f - means[2]) / stds[2]
            }
            return output
        }
    }
}
