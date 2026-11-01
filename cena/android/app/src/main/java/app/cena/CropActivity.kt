package app.cena

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.media.ExifInterface
import android.net.Uri
import android.os.Bundle
import android.view.MotionEvent
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import java.io.File
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

class CropActivity : ComponentActivity() {
    private var bitmap: Bitmap? = null
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        try {
            val uri = intent.data ?: error("Imagem ausente")
            require(uri.scheme == "content" && uri.authority == "$packageName.files")
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            contentResolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
            require(bounds.outWidth > 0 && bounds.outHeight > 0)
            var sample = 1
            while (max(bounds.outWidth, bounds.outHeight) / sample > 2048) sample *= 2
            val decoded = contentResolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample }) } ?: error("Imagem inválida")
            val orientation = try { contentResolver.openInputStream(uri).use { stream -> ExifInterface(stream!!).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) } } catch (_: Exception) { ExifInterface.ORIENTATION_NORMAL }
            val matrix = Matrix().apply {
                when (orientation) {
                    ExifInterface.ORIENTATION_ROTATE_90 -> postRotate(90f)
                    ExifInterface.ORIENTATION_ROTATE_180 -> postRotate(180f)
                    ExifInterface.ORIENTATION_ROTATE_270 -> postRotate(270f)
                    ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> postScale(-1f, 1f)
                    ExifInterface.ORIENTATION_FLIP_VERTICAL -> postScale(1f, -1f)
                    ExifInterface.ORIENTATION_TRANSPOSE -> { postRotate(90f); postScale(-1f, 1f) }
                    ExifInterface.ORIENTATION_TRANSVERSE -> { postRotate(270f); postScale(-1f, 1f) }
                }
            }
            val image = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
            if (image !== decoded) decoded.recycle()
            bitmap = image
            val root = LinearLayout(this).apply { this.orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.rgb(16,16,23)) }
            val heading = TextView(this).apply { text = "Recortar imagem"; textSize = 24f; setTextColor(Color.WHITE); setPadding(24,24,24,12) }
            val instruction = TextView(this).apply { text = "Selecione a capa, incluindo o título e a imagem. Isso ajuda a leitura e a comparação visual. Você também pode usar a imagem inteira."; setTextColor(Color.LTGRAY); setPadding(24,0,24,16) }
            val preview = CropView(image)
            root.addView(heading); root.addView(instruction)
            root.addView(preview, LinearLayout.LayoutParams(-1, 0, 1f))
            val buttons = LinearLayout(this).apply { this.orientation = LinearLayout.VERTICAL; setPadding(20,12,20,16) }
            buttons.addView(Button(this).apply { text = "Ler recorte"; setOnClickListener { finishImage(preview.crop()) } })
            buttons.addView(Button(this).apply { text = "Ler imagem inteira"; setOnClickListener { finishImage(image) } })
            buttons.addView(Button(this).apply { text = "Cancelar"; setOnClickListener { setResult(Activity.RESULT_CANCELED); finish() } })
            root.addView(buttons)
            setContentView(root)
            ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
                val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
                WindowInsetsCompat.CONSUMED
            }
            ViewCompat.requestApplyInsets(root)
        } catch (_: Exception) { setResult(Activity.RESULT_FIRST_USER, Intent().putExtra("error", "Não consegui abrir essa imagem. Tente um print em JPG ou PNG.")); finish() }
    }
    private fun finishImage(image: Bitmap) {
        try {
            val file = File.createTempFile("crop-", ".jpg", File(cacheDir, "captures").apply { mkdirs() })
            file.outputStream().use { image.compress(Bitmap.CompressFormat.JPEG, 94, it) }
            val uri = FileProvider.getUriForFile(this, "$packageName.files", file)
            setResult(Activity.RESULT_OK, Intent().setData(uri).putExtra("cropFile", file.name))
            if (image !== bitmap) image.recycle()
        } catch (_: Exception) { setResult(Activity.RESULT_CANCELED) }
        finish()
    }
    override fun onDestroy() { super.onDestroy(); bitmap?.recycle(); bitmap = null }

    inner class CropView(private val image: Bitmap) : View(this@CropActivity) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val display = RectF()
        private val selection = RectF()
        private var startX = 0f
        private var startY = 0f
        init { contentDescription = "Imagem para recortar. Arraste um retângulo sobre o título ou use Ler imagem inteira." }
        override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
            val scale = min(w.toFloat()/image.width, h.toFloat()/image.height)
            val width = image.width*scale; val height = image.height*scale
            display.set((w-width)/2, (h-height)/2, (w+width)/2, (h+height)/2)
            selection.set(display)
        }
        override fun onDraw(canvas: Canvas) {
            canvas.drawBitmap(image, null, display, paint)
            paint.color = 0x99000000.toInt(); paint.style = Paint.Style.FILL
            canvas.drawRect(display.left, display.top, display.right, selection.top, paint)
            canvas.drawRect(display.left, selection.bottom, display.right, display.bottom, paint)
            canvas.drawRect(display.left, selection.top, selection.left, selection.bottom, paint)
            canvas.drawRect(selection.right, selection.top, display.right, selection.bottom, paint)
            paint.color = 0xffac70ff.toInt(); paint.style = Paint.Style.STROKE; paint.strokeWidth = 5f
            canvas.drawRect(selection, paint); paint.style = Paint.Style.FILL
        }
        override fun onTouchEvent(event: MotionEvent): Boolean {
            val x = event.x.coerceIn(display.left, display.right); val y = event.y.coerceIn(display.top, display.bottom)
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> { startX=x; startY=y; parent.requestDisallowInterceptTouchEvent(true); return true }
                MotionEvent.ACTION_MOVE, MotionEvent.ACTION_UP -> {
                    selection.set(min(startX,x), min(startY,y), max(startX,x), max(startY,y))
                    if (event.actionMasked == MotionEvent.ACTION_UP) {
                        if (abs(x-startX) < 20 || abs(y-startY) < 20) selection.set(display)
                        performClick()
                    }
                    invalidate(); return true
                }
            }
            return true
        }
        override fun performClick(): Boolean { super.performClick(); return true }
        fun crop(): Bitmap {
            val sx=image.width/display.width(); val sy=image.height/display.height()
            val x=((selection.left-display.left)*sx).toInt().coerceIn(0,image.width-1)
            val y=((selection.top-display.top)*sy).toInt().coerceIn(0,image.height-1)
            val w=(selection.width()*sx).toInt().coerceIn(1,image.width-x)
            val h=(selection.height()*sy).toInt().coerceIn(1,image.height-y)
            return Bitmap.createBitmap(image,x,y,w,h)
        }
    }
}
