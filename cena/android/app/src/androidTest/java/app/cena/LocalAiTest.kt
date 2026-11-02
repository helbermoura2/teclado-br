package app.cena

import androidx.core.content.FileProvider
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.json.JSONObject

class LocalAiTest {
 @Test fun selectedFileIsLinkedAndRemovingAccessDoesNotDeleteIt(){
  val context=InstrumentationRegistry.getInstrumentation().targetContext
  val file=File(context.cacheDir,"local-ai-tests/header.gguf");file.parentFile!!.mkdirs();file.writeBytes(ByteArray(1024).also{"GGUF".toByteArray().copyInto(it)})
  val uri=FileProvider.getUriForFile(context,"${context.packageName}.files",file)
  val store=LocalModelStore(context);store.select(uri,false)
  try{assertTrue(store.status().getBoolean("configured"));assertFalse(store.status().has("uri"));assertEquals(uri.toString(),store.uri())}finally{store.remove()}
  assertTrue(file.exists());file.delete()
 }
 @Test fun failuresGiveSafeActionableDiagnostics(){
  assertTrue(localAiFailure(SecurityException("content://private/model")).contains("[ACESSO]"))
  assertTrue(localAiFailure(IllegalStateException("CARREGAR_MODELO:INCOMPATIVEL")).contains("não suportada"))
  assertTrue(localAiFailure(IllegalStateException("CONTEXTO:PEDIDO_LONGO")).contains("excedeu"))
  assertFalse(localAiFailure(IllegalStateException("/private/model and private prompt")).contains("private"))
 }
 @Test(timeout=180000) fun realGgufRunsThroughSeparateProcessAndCanBeCancelled(){
  val instrumentation=InstrumentationRegistry.getInstrumentation();val context=instrumentation.targetContext
  val file=File(context.cacheDir,"local-ai-tests/smoke.gguf");assertTrue("CI must provide verified small GGUF",file.length()>100000000)
  val uri=FileProvider.getUriForFile(context,"${context.packageName}.files",file)
  val done=CountDownLatch(1);var response=JSONObject();lateinit var client:LocalAiClient
  instrumentation.runOnMainSync{client=LocalAiClient(context){response=it;done.countDown()};client.generate("1",uri.toString(),"Return only the word cinema.",64)}
  assertTrue("Actual GGUF inference timed out",done.await(155,TimeUnit.SECONDS));assertEquals(response.toString(),"ok",response.optString("status"));assertTrue(response.optString("text").isNotBlank())
  val cancelled=CountDownLatch(1)
  instrumentation.runOnMainSync{client=LocalAiClient(context){response=it;cancelled.countDown()};client.generate("2",uri.toString(),"Return only cinema.");client.cancel()}
  assertTrue(cancelled.await(5,TimeUnit.SECONDS));assertEquals("cancelled",response.optString("status"))
 }
}
