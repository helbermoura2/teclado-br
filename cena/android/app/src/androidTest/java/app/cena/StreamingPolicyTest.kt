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
}
