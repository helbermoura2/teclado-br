package app.cena

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class StreamingPolicyTest {
    @Test fun usesBrazilianSubscriptionBeforeFreeAndRejectsUnsafeLogo(){val data=JSONObject().put("flatrate",JSONArray().put(JSONObject().put("provider_name","Teste").put("logo_path","/abc.png"))).put("free",JSONArray().put(JSONObject().put("provider_name","Grátis")));val result=StreamingPolicy.select(data);assertEquals("Teste",result.getString("name"));assertEquals("/abc.png",result.getString("logo"));data.getJSONArray("flatrate").getJSONObject(0).put("logo_path","https://evil.invalid/logo.png");assertEquals("",StreamingPolicy.select(data).getString("logo"))}
    @Test fun acceptsFreeWhenSubscriptionIsEmptyButDoesNotPretendRentalIsIncluded(){val data=JSONObject().put("flatrate",JSONArray()).put("free",JSONArray().put(JSONObject().put("provider_name","Grátis").put("logo_path","/free.png")));assertEquals("Grátis",StreamingPolicy.select(data).getString("name"));assertEquals("",StreamingPolicy.select(JSONObject().put("rent",JSONArray().put(JSONObject().put("provider_name","Aluguel")))).getString("name"));assertEquals("/poster.jpg",StreamingPolicy.posterPath("/poster.jpg"));assertEquals("",StreamingPolicy.posterPath("https://bad.example/a.jpg"))}
    @Test fun regionalTitlesRequireExactImdbIdentityAndRetainBrazilianAndOriginalNames(){
        val data=JSONObject().put("title","Hiroshima - A Guerra da Sobrevivência").put("original_title","Hiroshima: Out of the Ashes").put("release_date","1990-08-06").put("external_ids",JSONObject().put("imdb_id","tt0099772")).put("alternative_titles",JSONObject().put("titles",JSONArray().put(JSONObject().put("iso_3166_1","BR").put("title","Hiroshima: A Guerra da Sobrevivência")).put(JSONObject().put("iso_3166_1","FR").put("title","Autre titre"))))
        val result=StreamingPolicy.titleAliases(data,"tt0099772","movie")
        assertEquals("tt0099772",result.getString("id"));assertEquals("1990",result.getString("year"));assertTrue(result.getJSONArray("aliases").toString().contains("Guerra da Sobrevivência"));assertTrue(result.getJSONArray("aliases").toString().contains("Out of the Ashes"));assertFalse(result.toString().contains("Autre titre"))
        try{StreamingPolicy.titleAliases(data,"tt0475296","movie");fail("Different IMDb identity accepted")}catch(_:IllegalArgumentException){}
    }
    @Test fun seriesRegionalNamesStayBoundToTheSeriesIdentity(){
        val data=JSONObject().put("name","Uma Série").put("original_name","A Series").put("first_air_date","2020-01-01").put("external_ids",JSONObject().put("imdb_id","tt1234567"))
        val result=StreamingPolicy.titleAliases(data,"tt1234567","series");assertEquals("series",result.getString("type"));assertEquals("Uma Série",result.getString("name"));assertEquals("2020",result.getString("year"))
    }
    @Test fun titleAliasLookupIsExposedToJavascriptWithoutReturningTheTmdbKey(){
        val method=MainActivity.Bridge::class.java.getMethod("findTitleAliases",String::class.java,String::class.java)
        assertNotNull(method.getAnnotation(android.webkit.JavascriptInterface::class.java));assertEquals(Void.TYPE,method.returnType)
    }
}

