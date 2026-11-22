package app.cena

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class UpdatePolicyTest {
    private fun release()=JSONObject().put("tag_name","v0.17.0").put("assets",JSONArray().put(JSONObject().put("name","CENA-0.17.0.apk").put("size",45000000).put("digest","sha256:"+"a".repeat(64)).put("browser_download_url","https://github.com/helbermoura2/cena-downloads/releases/download/v0.17.0/CENA-0.17.0.apk")))
    private fun rejected(value:JSONObject){try{UpdatePolicy.parse(value);fail("A versão inválida foi aceita")}catch(_:Exception){}}
    @Test fun parallelEditionSelectsOnlyItsOwnAsset() {
        val r=release()
        val parallel=JSONObject(r.getJSONArray("assets").getJSONObject(0).toString())
        parallel.put("name","CENA-0.17.0-novo.apk")
        parallel.put("browser_download_url","https://github.com/helbermoura2/cena-downloads/releases/download/v0.17.0/CENA-0.17.0-novo.apk")
        r.getJSONArray("assets").put(parallel)
        assertTrue(UpdatePolicy.parse(r,true).getString("url").endsWith("-novo.apk"))
        assertFalse(UpdatePolicy.parse(r).getString("url").endsWith("-novo.apk"))
        try { UpdatePolicy.parse(release(),true); fail("Não pode instalar a outra edição") } catch(_:Exception) {}
        parallel.put("browser_download_url","https://github.com/helbermoura2/cena-downloads/releases/download/v0.17.0/CENA-0.17.0.apk")
        try { UpdatePolicy.parse(r,true); fail("URL de outra edição aceita") } catch(_:Exception) {}
    }
    @Test fun verifiesReleaseAndComparesVersionNumbers(){val value=UpdatePolicy.parse(release());assertEquals("0.17.0",value.getString("version"));assertTrue(UpdatePolicy.newer("0.17.0","0.16.9"));assertFalse(UpdatePolicy.newer("0.16.0","0.16.0"))}
    @Test fun rejectsOtherHostsHashesAndOversizedFiles(){for((key,value) in listOf("browser_download_url" to "https://example.com/CENA-0.17.0.apk","digest" to "sha256:bad","size" to 100000001)){val r=release();r.getJSONArray("assets").getJSONObject(0).put(key,value);rejected(r)}}
    @Test fun rejectsMalformedTagsAndDifferentApkNames(){val a=release().put("tag_name","v0.17.0-evil");rejected(a);val b=release();b.getJSONArray("assets").getJSONObject(0).put("name","other.apk");rejected(b)}
}
