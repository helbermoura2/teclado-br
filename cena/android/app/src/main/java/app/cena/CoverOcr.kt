package app.cena

import com.google.mlkit.vision.text.Text
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.min

/** Keep complete title phrases instead of taking only the largest printed word. */
object CoverOcr {
    fun analyze(result: Text): JSONObject {
        val all = result.textBlocks.flatMap { it.lines }
        val ranked = all.sortedByDescending { it.boundingBox?.height() ?: 0 }
        val anchor = ranked.firstOrNull()?.boundingBox
        val nearby = if (anchor == null) emptyList() else all.filter { line ->
            val box = line.boundingBox ?: return@filter false
            val overlap = (min(box.right, anchor.right) - maxOf(box.left, anchor.left)).coerceAtLeast(0)
            val aligned = overlap.toFloat() / min(box.width(), anchor.width()).coerceAtLeast(1) > .35f
            aligned && box.height() >= anchor.height() * .20 && abs(box.centerY() - anchor.centerY()) <= anchor.height() * 6
        }.sortedWith(compareBy({ it.boundingBox?.top ?: 0 }, { it.boundingBox?.left ?: 0 }))
        val blocks = result.textBlocks.sortedByDescending { block -> block.lines.maxOfOrNull { it.boundingBox?.height() ?: 0 } ?: 0 }
        val phrases = (listOf(nearby.joinToString(" ") { it.text }) + blocks.map { it.text.replace('\n', ' ') })
            .map { it.trim().replace(Regex("\\s+"), " ") }
            .filter { it.length in 5..180 && it.contains(' ') }.distinct().take(6)
        return JSONObject()
            .put("title", phrases.firstOrNull() ?: ranked.firstOrNull()?.text.orEmpty())
            .put("lines", JSONArray(ranked.map { it.text }.distinct().take(24)))
            .put("phrases", JSONArray(phrases))
            .put("fullText", result.text.take(6000))
    }
}
