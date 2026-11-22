package app.cena

import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.ZoneId

class WatchHistoryTest {
 private val context get()=InstrumentationRegistry.getInstrumentation().targetContext
 private fun raw(event:String,time:String="2026-06-01T12:00:00Z",movie:Boolean=true)=JSONObject().put("id",event).put("watched_at",time).put("type",if(movie)"movie"else"episode").put(if(movie)"movie"else"show",JSONObject().put("title",if(movie)"47 Ronin"else"Breaking Bad").put("year",if(movie)2013 else 2008).put("runtime",if(movie)119 else 45).put("ids",JSONObject().put("imdb",if(movie)"tt1335975"else"tt0903747").put("trakt",123))).apply{if(!movie)put("episode",JSONObject().put("season",1).put("number",2).put("title","Episódio").put("ids",JSONObject().put("trakt",456)))}
 private class Fake:WatchHistorySource {
  var failSnapshot=false;var account="account-a";var connected=true;var failSecond=false;var fingerprint="stable";var reads=0;var now=1700000000000L
  val pages=mutableListOf<JSONArray>();override fun snapshot():JSONObject {check(!failSnapshot){"Network snapshot unavailable"};return JSONObject().put("connected",connected).put("account",account).put("username",account)}
  override fun owner()=account
  override fun page(owner:String,page:Int):TraktResponse {check(owner==account);reads++;if(page==2&&failSecond)throw IllegalStateException("O Trakt pediu uma pausa.");return TraktResponse(200,pages[page-1].toString(),pages.size,30,pages.sumOf{it.length()}.toLong())}
  override fun activities(owner:String)=fingerprint
  override fun expectedPlays(owner:String)=pages.sumOf{it.length()}.toLong()
 }
 @Test fun localBackupDoesNotReadTheNetworkAccountSnapshot(){
  val source=Fake();source.account="backup-local";source.pages.add(JSONArray().put(raw("991")))
  WatchHistoryRepository(context,source,{source.now}).use{repo->
   assertEquals(HistoryPass.COMPLETE,repo.importBatch(true))
   source.failSnapshot=true
   assertEquals(1,repo.exportLocal().getJSONArray("events").length())
  }
 }
 @Test fun individualEventsPreserveRewatchesLargeIdsAndUnknownDates(){
  val first=WatchHistoryCodec.parse(raw("9007199254740992","2023-01-01T12:00:00Z"))!!;val repeated=WatchHistoryCodec.parse(raw("9007199254740993"))!!;val unknown=WatchHistoryCodec.parse(raw("3","invalid"))!!
  val stats=WatchHistoryCodec.summary(listOf(first,repeated,unknown),ZoneId.of("UTC"));assertEquals(3,stats.getJSONObject("totals").getInt("plays"));assertEquals(1,stats.getJSONObject("totals").getInt("movies"));assertEquals(1,stats.getJSONObject("totals").getInt("unknownDates"));assertNotEquals(first.optString("eventId"),repeated.optString("eventId"));assertEquals("unknown",unknown.optString("datePrecision"));assertEquals(2013,unknown.optInt("year"));assertEquals(2,stats.getJSONArray("years").length())
 }
 @Test fun yearsUseWatchTimeAndTimezoneIncludingEpochAndSeriesSpecials(){
  val boundary=WatchHistoryCodec.parse(raw("1","2025-01-01T01:00:00Z"))!!;val epoch=WatchHistoryCodec.parse(raw("2","1970-01-01T00:00:00Z"))!!;val ep=WatchHistoryCodec.parse(raw("3","2024-02-01T00:00:00Z",false))!!
  val stats=WatchHistoryCodec.summary(listOf(boundary,epoch,ep),ZoneId.of("America/Sao_Paulo"));assertEquals(0,stats.getJSONObject("totals").getInt("unknownDates"));assertEquals(1,stats.getJSONObject("totals").getInt("series"));assertEquals(1,stats.getJSONObject("totals").getInt("episodes"));assertEquals(2024,stats.getJSONArray("years").getJSONObject(0).getInt("year"));assertEquals(1969,stats.getJSONArray("years").getJSONObject(1).getInt("year"))
 }
 @Test fun filmPeriodsUseViewingDateAndKeepUnknownDatesOutOfTheCalendar(){
  val rows=listOf(raw("1","2026-06-01T01:00:00Z"),raw("2","2026-06-01T12:00:00Z"),raw("3","invalid"),raw("4","2026-06-01T12:00:00Z",false)).mapNotNull(WatchHistoryCodec::parse)
  val zone=ZoneId.of("America/Sao_Paulo")
  val today=java.time.LocalDate.parse("2026-06-01")
  val day=WatchHistoryCodec.moviePeriod(rows,"today",zone,today)
  assertEquals(119,day.getInt("movieMinutes"))
  assertEquals(1,day.getInt("moviePlays"))
  assertEquals(1,WatchHistoryCodec.moviePeriod(rows,"2026-05",zone,today).getInt("moviePlays"))
  assertEquals(2,WatchHistoryCodec.moviePeriod(rows,"2026",zone,today).getInt("moviePlays"))
  val total=WatchHistoryCodec.moviePeriod(rows,"all",zone,today)
  assertEquals(3,total.getInt("moviePlays"))
  assertEquals(1,total.getInt("movies"))
  assertEquals(1,total.getInt("unknownMovieDates"))
  assertEquals(2,total.getInt("longestStreak"))
 }
 @Test fun allPagesCommitAtomicallyResumeAndNeverDuplicateOrLoseRevisits(){
  context.deleteDatabase("cena-watch-history.db");val source=Fake();source.pages.add(JSONArray().put(raw("1","2023-01-01T12:00:00Z")));source.pages.add(JSONArray().put(raw("2")))
  WatchHistoryRepository(context,source,{source.now}).use{repo->
   source.failSecond=true;assertEquals(HistoryPass.FAILED,repo.importBatch(true));assertEquals(0,repo.status().getJSONObject("totals").optInt("plays"));source.failSecond=false;assertEquals(HistoryPass.COMPLETE,repo.importBatch(true));assertEquals(2,repo.status().getJSONObject("totals").optInt("plays"));assertEquals(2,repo.page("all","movie",1).getJSONArray("rows").length());assertEquals(1,repo.page("2023","movie",1).optInt("total"));source.now+=1000;assertEquals(HistoryPass.COMPLETE,repo.importBatch(true));assertEquals(2,repo.status().getJSONObject("totals").optInt("plays"));val exported=repo.export();assertEquals(2,exported.getJSONArray("events").length());assertFalse(exported.toString().contains("access_token"));source.connected=false;assertEquals(2,repo.status().getJSONObject("totals").optInt("plays"))
  }
 }
 @Test fun accountSwitchNeverMixesHistoryAndInvalidDatesRemainFilterable(){
  context.deleteDatabase("cena-watch-history.db");val source=Fake();source.pages.add(JSONArray().put(raw("1","invalid")))
  WatchHistoryRepository(context,source,{source.now}).use{repo->assertEquals(HistoryPass.COMPLETE,repo.importBatch(true));assertEquals(1,repo.page("unknown","all",1).optInt("total"));source.account="account-b";assertEquals(0,repo.status().getJSONObject("totals").optInt("plays"));source.pages[0]=JSONArray().put(raw("2","2024-01-01T12:00:00Z",false));assertEquals(HistoryPass.COMPLETE,repo.importBatch(true));assertEquals(1,repo.status().getJSONObject("totals").optInt("plays"));assertEquals(0,repo.status().getJSONObject("totals").optInt("movies"));source.account="account-a";assertEquals(1,repo.page("unknown","all",1).optInt("total"))}
 }
}
