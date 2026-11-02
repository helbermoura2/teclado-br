package app.cena

import android.content.ClipData
import android.content.Intent
import android.app.Activity
import android.os.Build
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
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private val installedVersion by lazy { packageManager.getPackageInfo(packageName, 0).versionName ?: "dev" }
    private val assetPrefix get() = "/cena-${installedVersion}/"
    private var photoUri: Uri? = null
    private var photoFile: File? = null
    private var scanning = false
    private val recognizerDelegate = lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }
    private val recognizer by recognizerDelegate
    private val visionExecutor = Executors.newSingleThreadExecutor()
    private val storyExecutor = Executors.newSingleThreadExecutor()
    private var visualMatcher: VisualMatcher? = null
    @Volatile private var visionInput: FloatArray? = null
    private val traktExecutor = Executors.newSingleThreadScheduledExecutor()
    private val trakt by lazy { TraktRepository(applicationContext) }
    private fun traktTask(task: () -> Unit) {
        try { traktExecutor.execute {
            try { task() } catch(e: Exception) { runOnUiThread { if(!isDestroyed) sendError(e.message?.take(200) ?: "Não foi possível conectar o Trakt.") } }
            emitTrakt()
        } } catch(_:java.util.concurrent.RejectedExecutionException) {}
    }
    private fun emitTrakt() {
        val state=trakt.status()
        traktWaitingAuth=state.optString("userCode").isNotBlank()
        runOnUiThread { if(!isDestroyed && pageReady) web.evaluateJavascript("window.CenaTraktResult && window.CenaTraktResult($state)",null) }
    }
    @Volatile private var traktVisible = false
    @Volatile private var traktWaitingAuth = false
    private val stremioExecutor = Executors.newSingleThreadScheduledExecutor()
    @Volatile private var stremioWaitingAuth = false
    private val stremio by lazy { StremioRepository(applicationContext, changed={emitStremio()}) }
    private fun emitStremio() {
        val state=stremio.status();stremioWaitingAuth=state.optBoolean("pairing")
        runOnUiThread { if(!isDestroyed && pageReady) web.evaluateJavascript("window.CenaStremioResult && window.CenaStremioResult($state)",null) }
    }
    private fun stremioTask(task:()->Unit) {
        try { stremioExecutor.execute {
            try {task()} catch(_:Exception){runOnUiThread {if(!isDestroyed)sendError("Não consegui consultar o Stremio. Tente novamente.")}}
            emitStremio()
        }} catch(_:java.util.concurrent.RejectedExecutionException) {}
    }
    private var pendingStory: ByteArray? = null
    private val saveStoryFile = registerForActivityResult(ActivityResultContracts.CreateDocument("image/png")) { uri ->
        val bytes=pendingStory; pendingStory=null
        if(uri != null && bytes != null) Thread {
            try { contentResolver.openOutputStream(uri).use { output -> requireNotNull(output); output.write(bytes) }; runOnUiThread { Toast.makeText(this,"Story salvo. Escolha essa imagem na galeria do Instagram.",Toast.LENGTH_LONG).show() } }
            catch(_:Exception) { runOnUiThread { Toast.makeText(this,"Não consegui salvar a imagem.",Toast.LENGTH_SHORT).show() } }
        }.start()
    }
    private var pageReady = false
    private var pendingImage: Uri? = null
    private var croppedFile: File? = null
    private val camera = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (success && photoUri != null) openCrop(photoUri!!)
        else { scanning = false; cleanPhoto() }
    }
    private val gallery = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) importImage(uri)
    }
    private val crop = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uri = result.data?.data
        result.data?.getStringExtra("error")?.let { sendError(it) }
        if (result.resultCode != Activity.RESULT_OK || uri == null) {
            scanning = false; cleanPhoto(); consumePending(); return@registerForActivityResult
        }
        val name = result.data?.getStringExtra("cropFile")
        if (name != null && !name.contains('/') && name.startsWith("crop-") && name.endsWith(".jpg")) {
            croppedFile = File(File(cacheDir, "captures"), name)
        }
        recognize(uri)
    }

    private fun openCrop(uri: Uri) {
        try { crop.launch(Intent(this, CropActivity::class.java).setData(uri)) }
        catch (_: Exception) { scanning = false; cleanPhoto(); sendError("Não consegui abrir a imagem. Tente outra foto ou print.") }
    }
    private fun recognize(uri: Uri) {
        try {
            require(uri.authority == "$packageName.files")
            visionInput = try { VisualMatcher.source(this, uri) } catch (_: Exception) { null }
            val image = InputImage.fromFilePath(this, uri)
            recognizer.process(image)
                .addOnSuccessListener { result ->
                    sendResult(CoverOcr.analyze(result))
                }
                .addOnFailureListener { sendError("Não consegui ler a imagem. Você pode digitar o título.") }
                .addOnCompleteListener { scanning = false; cleanPhoto(); consumePending() }
        } catch (_: Exception) {
            scanning = false; cleanPhoto(); sendError("Não consegui ler essa imagem. Tente outro print.")
        }
    }
    private fun importImage(uri: Uri) {
        if (scanning) { pendingImage = uri; return }
        scanning = true
        Thread {
            try {
                require(uri.scheme == "content")
                require(contentResolver.getType(uri)?.startsWith("image/") != false)
                val file = File.createTempFile("import-", ".image", File(cacheDir, "captures").apply { mkdirs() })
                photoFile = file
                contentResolver.openInputStream(uri).use { input ->
                    requireNotNull(input)
                    file.outputStream().use { output ->
                        val buffer = ByteArray(8192); var total = 0
                        while (true) {
                            val count = input.read(buffer)
                            if (count < 0) break
                            total += count
                            require(total <= 20 * 1024 * 1024) { "Imagem muito grande" }
                            output.write(buffer, 0, count)
                        }
                        require(total > 0)
                    }
                }
                val copiedUri = FileProvider.getUriForFile(this, "$packageName.files", file)
                runOnUiThread { openCrop(copiedUri) }
            } catch (_: Exception) {
                runOnUiThread { scanning = false; cleanPhoto(); sendError("Não consegui abrir a imagem. Escolha um JPG ou PNG de até 20 MB.") }
            }
        }.start()
    }
    private fun receiveImage(incoming: Intent?) {
        if (incoming?.action != Intent.ACTION_SEND || incoming.type?.startsWith("image/") != true) return
        val uri = if (Build.VERSION.SDK_INT >= 33) incoming.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
            else @Suppress("DEPRECATION") (incoming.getParcelableExtra<Uri>(Intent.EXTRA_STREAM))
        pendingImage = uri ?: incoming.clipData?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.uri
        consumePending()
    }
    private fun consumePending() {
        if (!pageReady || scanning) return
        val uri = pendingImage ?: return
        pendingImage = null
        importImage(uri)
    }
    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); receiveImage(intent) }

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
            .addPathHandler(assetPrefix, WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
        }
        web.clearCache(true)
        // Bridge only exists on bundled assets. Remote documents cannot load in this WebView.
        web.addJavascriptInterface(Bridge(), "CenaAndroid")
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? = loader.shouldInterceptRequest(request.url)
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.scheme == "https" && uri.host == "appassets.androidplatform.net" && uri.path?.startsWith(assetPrefix) == true) return false
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
        web.loadUrl("https://appassets.androidplatform.net${assetPrefix}index.html")
        receiveImage(intent)
        stremioExecutor.scheduleWithFixedDelay({
            try {if(stremioWaitingAuth){stremio.pollLink();emitStremio()}}catch(_:Exception){}
        },5,5,java.util.concurrent.TimeUnit.SECONDS)
        traktExecutor.scheduleWithFixedDelay({
            try { if(traktVisible || traktWaitingAuth) { trakt.pollAuth(); if(trakt.status().optBoolean("connected")) trakt.sync(); emitTrakt() } } catch(_:Exception) {}
        },5,5,java.util.concurrent.TimeUnit.SECONDS)
    }
    override fun onResume() {
        super.onResume()
        traktVisible=true
        if(::web.isInitialized) stremioTask {stremio.pollLink()}
        if(::web.isInitialized) traktTask { trakt.pollAuth(); if(trakt.status().optBoolean("connected")) TraktWorker.schedule(applicationContext); trakt.sync() }
    }

    override fun onPause() { traktVisible=false; super.onPause() }

    inner class Bridge {
        @JavascriptInterface fun loadStoryArtwork(requestId:String,raw:String){
            if(isDestroyed||!Regex("[0-9]{1,10}").matches(requestId)||raw.length>18000)return
            val input=try{JSONObject(raw)}catch(_:Exception){return}
            if(!Regex("tt\\d{5,12}").matches(input.optString("id"))||input.optString("type") !in setOf("movie","series"))return
            val urls=input.optJSONArray("urls")?:return
            try{storyExecutor.execute {
                val result=JSONObject().put("requestId",requestId).put("status","unavailable")
                val deadline=android.os.SystemClock.elapsedRealtime()+25000
                for(i in 0 until minOf(urls.length(),3)){
                    if(isDestroyed||Thread.currentThread().isInterrupted)break
                    val address=urls.optString(i)
                    try{
                        val bitmap=StoryArtwork.download(address,deadline=deadline)
                        val data=try{StoryArtwork.dataUrl(bitmap)}finally{bitmap.recycle()}
                        result.put("image",data).put("sourceUrl",address).put("status","ok");break
                    }catch(_:Exception){}
                }
                runOnUiThread{if(!isDestroyed&&pageReady)web.evaluateJavascript("window.CenaStoryArtworkResult && window.CenaStoryArtworkResult($result)",null)}
            }}catch(_:java.util.concurrent.RejectedExecutionException){}
        }

        @JavascriptInterface fun stremioState() {stremioTask {}}
        @JavascriptInterface fun connectStremio() {stremioTask {stremio.beginLink()}}
        @JavascriptInterface fun openStremioAuthorization() {stremioTask {
            val uri=Uri.parse(stremio.authorizationUrl())
            runOnUiThread {try {startActivity(Intent(Intent.ACTION_VIEW,uri))}catch(_:Exception){sendError("Não consegui abrir o navegador. Tente novamente.")}}
        }}
        @JavascriptInterface fun readStremioLibrary() {stremioTask {stremio.readLibrary()}}
        @JavascriptInterface fun cancelStremioReading() {stremio.cancelReading()}
        @JavascriptInterface fun disconnectStremio() {stremio.cancelReading();stremioTask {stremio.disconnect()}}

        @JavascriptInterface fun traktState() { traktTask { } }
        @JavascriptInterface fun configureTrakt(clientId: String) { if(clientId.length<=200) traktTask { trakt.configure(clientId.trim()) } }
        @JavascriptInterface fun connectTrakt() { traktTask { trakt.beginAuth() } }
        @JavascriptInterface fun openTraktVerification() { traktTask {
            val uri=Uri.parse(trakt.status().optString("verificationUrl"))
            require(uri.scheme=="https" && uri.host in setOf("trakt.tv","app.trakt.tv","auth.trakt.tv","www.trakt.tv"))
            runOnUiThread { try { startActivity(Intent(Intent.ACTION_VIEW,uri)) } catch(_:Exception) { sendError("Abra o endereço de autorização no navegador.") } }
        } }
        @JavascriptInterface fun syncTrakt() { traktTask { trakt.sync(true) } }
        @JavascriptInterface fun disconnectTrakt() { traktTask { trakt.disconnect(); TraktWorker.cancel(applicationContext) } }
        @JavascriptInterface fun traktInventory(raw: String) { if(raw.length<=300000) traktTask { trakt.inventory(JSONArray(raw)) } }
        @JavascriptInterface fun queueTraktBatch(raw: String) { if(raw.length<=300000) traktTask {
            val values=JSONArray(raw); require(values.length()<=2000)
            for(i in 0 until values.length()) trakt.enqueue(values.getJSONObject(i))
            trakt.initialUploadComplete(); TraktWorker.schedule(applicationContext); trakt.sync()
        } }
        @JavascriptInterface fun queueTrakt(raw: String) { if(raw.length<=2000) traktTask { trakt.enqueue(JSONObject(raw)); TraktWorker.schedule(applicationContext); trakt.sync() } }
        @JavascriptInterface fun saveStory(encoded: String) {
            if(encoded.length>12_000_000) return
            val bytes=try { Base64.decode(encoded,Base64.DEFAULT) } catch(_:Exception) { return }
            if(bytes.size<8 || bytes[0]!=0x89.toByte() || bytes[1]!=0x50.toByte() || bytes[2]!=0x4e.toByte() || bytes[3]!=0x47.toByte()) return
            runOnUiThread { pendingStory=bytes; try { saveStoryFile.launch("CENA-Story.png") } catch(_:Exception) { pendingStory=null; sendError("Não consegui abrir o local para salvar.") } }
        }
        @JavascriptInterface fun appVersion(): String = installedVersion
        @JavascriptInterface fun compareCovers(requestId: String, raw: String) {
            if (isDestroyed || raw.length > 16000 || !Regex("[0-9]{1,10}").matches(requestId)) return
            val source = visionInput
            val candidates = try { JSONArray(raw) } catch (_: Exception) { return }
            try {
                visionExecutor.execute {
                    val result = JSONObject().put("requestId", requestId)
                    try {
                        requireNotNull(source)
                        val engine = visualMatcher ?: VisualMatcher(applicationContext).also { visualMatcher = it }
                        val scores = engine.compare(source, candidates)
                        result.put("scores", scores).put("status", if (scores.length() > 0) "ok" else "no-references")
                    } catch (_: Throwable) { result.put("status", "unavailable") }
                    runOnUiThread { if (!isDestroyed) web.evaluateJavascript("window.CenaVisualResult(${result})", null) }
                }
            } catch (_: java.util.concurrent.RejectedExecutionException) {}
        }

        @JavascriptInterface fun ready() = runOnUiThread { pageReady = true; consumePending(); traktTask { }; stremioTask { } }
        @JavascriptInterface fun pickImage() = runOnUiThread {
            if (scanning) return@runOnUiThread
            try { gallery.launch("image/*") }
            catch (_: Exception) { sendError("Não consegui abrir a galeria. Use Compartilhar → CENA no aplicativo Fotos.") }
        }

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
    private fun cleanPhoto() { photoFile?.delete(); croppedFile?.delete(); photoFile = null; croppedFile = null; photoUri = null }
    override fun onDestroy() {
        super.onDestroy()
        cleanPhoto()
        visionInput = null
        stremio.cancelReading()
        stremioExecutor.shutdownNow()
        storyExecutor.shutdownNow()
        traktExecutor.shutdownNow()
        visionExecutor.execute { visualMatcher?.close(); visualMatcher = null }
        visionExecutor.shutdown()
        if (recognizerDelegate.isInitialized()) recognizer.close()
        web.removeJavascriptInterface("CenaAndroid")
        web.destroy()
    }
}
