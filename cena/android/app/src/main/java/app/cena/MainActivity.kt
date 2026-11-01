package app.cena

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowCompat
import androidx.webkit.WebViewAssetLoader
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private var photoUri: Uri? = null
    private var photoFile: File? = null
    private var scanning = false
    private val recognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }
    private val camera = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val uri = photoUri
        if (!success || uri == null) { scanning = false; cleanPhoto(); return@registerForActivityResult }
        try {
            val image = InputImage.fromFilePath(this, uri)
            recognizer.process(image)
                .addOnSuccessListener { result ->
                    // Largest text lines usually contain the title. Recognition is not an identity match.
                    val lines = result.textBlocks.flatMap { it.lines }
                        .sortedByDescending { it.boundingBox?.height() ?: 0 }
                        .map { it.text }.distinct().take(12)
                    sendResult(JSONObject().put("lines", JSONArray(lines)))
                }
                .addOnFailureListener { sendError("Não consegui ler a capa. Você pode digitar o título.") }
                .addOnCompleteListener { scanning = false; cleanPhoto() }
        } catch (_: Exception) {
            scanning = false; cleanPhoto(); sendError("Não consegui abrir a foto. Tente novamente.")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val root = FrameLayout(this).apply { setBackgroundColor(android.graphics.Color.rgb(16, 16, 23)) }
        web = WebView(this)
        root.addView(web, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        setContentView(root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            web.layoutParams = (web.layoutParams as FrameLayout.LayoutParams).apply { setMargins(bars.left, bars.top, bars.right, bars.bottom) }
            WindowInsetsCompat.CONSUMED
        }
        ViewCompat.requestApplyInsets(root)
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
        }
        // Bridge only exists on bundled assets. Remote documents cannot load in this WebView.
        web.addJavascriptInterface(Bridge(), "CenaAndroid")
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? = loader.shouldInterceptRequest(request.url)
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.scheme == "https" && uri.host == "appassets.androidplatform.net" && uri.path?.startsWith("/assets/") == true) return false
                if (request.isForMainFrame && uri.scheme == "https") {
                    try { startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (_: Exception) {}
                }
                return true
            }
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript("document.querySelector('dialog[open]') !== null") { open ->
                    if (open == "true") web.evaluateJavascript("document.querySelector('dialog[open]').close()", null)
                    else { isEnabled = false; onBackPressedDispatcher.onBackPressed() }
                }
            }
        })
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html")
    }

    inner class Bridge {
        @JavascriptInterface fun scanCover() = runOnUiThread {
            if (scanning) return@runOnUiThread
            scanning = true
            try {
                val directory = File(cacheDir, "captures").apply { mkdirs() }
                photoFile = File.createTempFile("cover-", ".jpg", directory)
                photoUri = FileProvider.getUriForFile(this@MainActivity, "$packageName.files", photoFile!!)
                camera.launch(photoUri!!)
            } catch (_: Exception) {
                scanning = false; cleanPhoto(); sendError("Câmera indisponível. Digite o título para buscar.")
            }
        }

        @JavascriptInterface fun shareStory(encoded: String) {
            if (encoded.length > 12_000_000) { runOnUiThread { sendError("Imagem muito grande para compartilhar.") }; return }
            Thread {
                try {
                    val bytes = Base64.decode(encoded, Base64.DEFAULT)
                    val pngHeader = byteArrayOf(0x89.toByte(), 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
                    require(bytes.size >= 8 && bytes.take(8).toByteArray().contentEquals(pngHeader))
                    val directory = File(cacheDir, "stories").apply { mkdirs() }
                    // Clean only old shared images; preserve recent files while another app reads them.
                    directory.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 86_400_000 }?.forEach { it.delete() }
                    val file = File.createTempFile("cena-", ".png", directory).apply { writeBytes(bytes) }
                    val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.files", file)
                    runOnUiThread {
                        val intent = Intent(Intent.ACTION_SEND).apply {
                            type = "image/png"
                            putExtra(Intent.EXTRA_STREAM, uri)
                            clipData = ClipData.newRawUri("CENA Story", uri)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                        startActivity(Intent.createChooser(intent, "Compartilhar seu Story"))
                    }
                } catch (_: Exception) { runOnUiThread { Toast.makeText(this@MainActivity, "Não foi possível compartilhar.", Toast.LENGTH_SHORT).show() } }
            }.start()
        }
    }

    private fun sendError(message: String) = sendResult(JSONObject().put("error", message))
    private fun sendResult(result: JSONObject) {
        web.evaluateJavascript("window.CenaNativeResult(${result})", null)
    }
    private fun cleanPhoto() { photoFile?.delete(); photoFile = null; photoUri = null }
    override fun onDestroy() {
        super.onDestroy()
        cleanPhoto()
        recognizer.close()
        web.removeJavascriptInterface("CenaAndroid")
        web.destroy()
    }
}
