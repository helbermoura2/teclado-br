package app.cena

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
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
class CoverLayoutTest {
    private fun capture(name:String,expected:String,draw:(Canvas,Paint)->Unit){
        val bitmap=Bitmap.createBitmap(800,1100,Bitmap.Config.ARGB_8888)
        val canvas=Canvas(bitmap);canvas.drawColor(Color.WHITE)
        val paint=Paint(Paint.ANTI_ALIAS_FLAG).apply{color=Color.BLACK;typeface=Typeface.DEFAULT_BOLD}
        draw(canvas,paint)
        val recognizer=TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        try{
            val text=Tasks.await(recognizer.process(InputImage.fromBitmap(bitmap,0)),30,TimeUnit.SECONDS)
            val payload=CoverOcr.analyze(text)
            assertTrue("Production OCR must export text regions",payload.getJSONArray("regions").length()>0)
            val file=File(InstrumentationRegistry.getInstrumentation().targetContext.filesDir,"native-cover-layout.json")
            val reports=if(file.exists())JSONArray(file.readText())else JSONArray()
            reports.put(JSONObject().put("name",name).put("expected",expected).put("payload",payload));file.writeText(reports.toString())
        }finally{recognizer.close();bitmap.recycle()}
    }
    @Test(timeout=90000) fun numericTitleWithAwardsAndAdvertising(){capture("numeric","1917"){canvas,paint->
        paint.textSize=28f;canvas.drawText("3 GOLDEN GLOBE NOMINATIONS",80f,60f,paint)
        paint.textSize=24f;canvas.drawText("FROM THE DIRECTOR OF SKYFALL",80f,110f,paint)
        paint.textSize=230f;canvas.drawText("1917",100f,500f,paint)
        paint.textSize=24f;canvas.drawText("JANUARY 23 IN CINEMAS",100f,900f,paint)
    }}
    @Test(timeout=90000) fun stackedTitleWithSmallerCastNames(){capture("cast","GUERRA AO TERROR"){canvas,paint->
        paint.textSize=24f;canvas.drawText("DAVID MORSE",260f,60f,paint);canvas.drawText("RALPH FIENNES",510f,60f,paint)
        paint.textSize=100f;canvas.drawText("GUERRA",280f,300f,paint)
        paint.textSize=50f;canvas.drawText("AO",420f,380f,paint)
        paint.textSize=100f;canvas.drawText("TERROR",280f,510f,paint)
        paint.textSize=24f;canvas.drawText("UM FILME QUE DEVERIA RENDER",80f,900f,paint);canvas.drawText("UMA INDICACAO AO OSCAR",80f,940f,paint)
    }}
}
