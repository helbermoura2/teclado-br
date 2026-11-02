package app.cena

import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class NuvioRepositoryTest {
 private val context get()=InstrumentationRegistry.getInstrumentation().targetContext
 private class Fixture:NuvioTransport {
  var paged=false;val pages=mutableListOf<Int>();var clock=1700000000000L;var failProgress=false;var refreshes=0;val calls=mutableListOf<String>()
  override fun request(path:String,body:JSONObject?,token:String?):NuvioResponse {
   calls.add(path)
   val value=when(path){
    "/rest/v1/rpc/start_device_login_session"->JSONArray().put(JSONObject().put("device_code","private-device-nuvio-code").put("user_code","ABC123").put("verification_uri_complete","https://nuvio.tv/link?code=ABC123").put("poll_interval_seconds",3)).toString()
    "/rest/v1/rpc/poll_tv_login_session"->"[{\"status\":\"approved\"}]"
    "/functions/v1/tv-logins-exchange","/auth/v1/token?grant_type=refresh_token"->{if(path.contains("refresh_token"))refreshes++;JSONObject().put("access_token","private-access-token-marker").put("refresh_token","private-refresh-token-marker").put("expires_in",3600).put("user",JSONObject().put("id","account-a").put("email","test@example.invalid")).toString()}
    "/rest/v1/rpc/sync_pull_profiles"->"[{\"profile_index\":1,\"name\":\"Pessoa A\"},{\"profile_index\":2,\"name\":\"Pessoa B\"}]"
    "/rest/v1/rpc/sync_pull_watched_items"->{pages.add(body!!.optInt("p_page"));if(paged&&body.optInt("p_page")==1){val rows=JSONArray();for(index in 0 until 500)rows.put(JSONObject().put("content_id","tt${7000000+index}").put("content_type","movie"));rows.toString()}else if(paged){"[{\"content_id\":\"tt0903747\",\"content_type\":\"series\",\"season\":1,\"episode\":1}]"}else if(body.optInt("p_profile_id")==1)"[{\"content_id\":\"tt1335975\",\"content_type\":\"movie\",\"title\":\"47 Ronin\",\"watched_at\":1700000000},{\"content_id\":\"tt0903747\",\"content_type\":\"series\",\"season\":1,\"episode\":1}]"else"[]"}
    "/rest/v1/rpc/sync_pull_watch_progress"->{if(failProgress)return NuvioResponse(503,"private server details");if(body!!.optInt("p_profile_id")==1)"[{\"content_id\":\"tt0903747\",\"content_type\":\"series\",\"season\":1,\"episode\":2,\"position\":600000,\"duration\":2400000}]"else"[]"}
    else->throw IllegalStateException("Unexpected endpoint $path")
   };return NuvioResponse(200,value)
  }
 }
 private fun loggedIn(f:Fixture):NuvioRepository {val repo=NuvioRepository(context,f){f.clock};repo.disconnect();repo.inventory("[{\"id\":\"tt1335975\",\"type\":\"movie\"},{\"id\":\"tt0903747\",\"type\":\"series\"}]");repo.begin();f.clock+=5000;repo.poll();assertTrue(repo.status().optBoolean("connected"));return repo}
 @Test fun deviceCodeLoginKeepsCredentialsNativeAndPullsOnlyTheSelectedProfile(){
  val f=Fixture();val repo=loggedIn(f)
  try{
   assertFalse(repo.status().optBoolean("active"));repo.selectProfile(1);val state=repo.status();assertTrue(state.optBoolean("active"));assertEquals(2,state.getJSONArray("watched").length());assertEquals(600000,state.getJSONArray("progress").getJSONObject(0).getLong("position"));assertEquals(1700000000000L,state.getJSONArray("watched").getJSONObject(0).getLong("watchedAt"))
   val output=state.toString();for(secret in listOf("private-access-token-marker","private-refresh-token-marker","private-device-nuvio-code","nonce"))assertFalse(output.contains(secret))
   assertFalse(f.calls.any{it.contains("sync_push")||it.contains("sync_delete")||it.contains("password")})
   repo.selectProfile(2);assertEquals(0,repo.status().getJSONArray("watched").length());assertEquals(0,repo.status().getJSONArray("progress").length());assertEquals("Pessoa B",repo.status().getString("profileName"))
  }finally{repo.disconnect()}
 }
 @Test fun transientFailuresPreserveTheLastCompleteHistoryAndRefreshTokens(){
  val f=Fixture();val repo=loggedIn(f)
  try{repo.selectProfile(1);val before=repo.status();f.clock+=3601000;f.failProgress=true;assertFalse(repo.sync(true));val failed=repo.status();assertEquals(before.optLong("lastSync"),failed.optLong("lastSync"));assertEquals(2,failed.getJSONArray("watched").length());assertTrue(failed.optString("error").contains("NUVIO_HTTP_503"));assertEquals(1,f.refreshes);f.failProgress=false;assertTrue(repo.sync(true));assertEquals(f.clock,repo.status().optLong("lastSync"))}finally{repo.disconnect()}
 }
 @Test fun snapshotsReadEveryHistoryPageBeforeCommitting(){
  val f=Fixture();f.paged=true;val repo=loggedIn(f)
  try{repo.selectProfile(1);assertEquals(listOf(1,2),f.pages);assertEquals(501,repo.status().optInt("watchedCount"));assertTrue(repo.status().optLong("lastSync")>0)}finally{repo.disconnect()}
 }
 @Test fun identifiersAndEpisodesAreValidatedWithoutTitleGuessing(){
  val unresolved=NuvioCodec.watched(JSONObject("{\"content_id\":\"tmdb:550\",\"content_type\":\"movie\",\"title\":\"47 Ronin\"}"))!!;assertEquals("",unresolved.optString("id"))
  val episode=NuvioCodec.watched(JSONObject("{\"content_id\":\"tt0903747:2:3\",\"content_type\":\"series\"}"))!!;assertEquals(2,episode.optInt("season"));assertEquals(3,episode.optInt("episode"))
  assertNull(NuvioCodec.watched(JSONObject("{\"content_id\":\"tt0903747\",\"content_type\":\"series\"}")))
  assertNull(NuvioCodec.progress(JSONObject("{\"content_id\":\"tt1335975\",\"content_type\":\"movie\",\"position\":0,\"duration\":0}")))
 }
}
