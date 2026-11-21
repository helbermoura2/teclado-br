package app.cena

import org.json.JSONObject
import org.json.JSONArray
import java.time.Instant
import java.time.ZoneId

object WatchHistoryCodec {
 fun parse(row:JSONObject):JSONObject? {
  val kind=row.optString("type");if(kind !in listOf("movie","episode"))return null
  val title=row.optJSONObject(if(kind=="movie")"movie" else "show")?:return null
  val episode=if(kind=="episode")row.optJSONObject("episode")?:return null else null
  val ids=title.optJSONObject("ids")?:JSONObject();val rawId=ids.optString("imdb");val id=rawId.takeIf{it.matches(Regex("tt\\d{5,12}"))}?:""
  val key=(if(kind=="movie")"movie:" else "series:")+(if(id.isNotBlank())id else if(ids.optLong("trakt")>0)"trakt:${ids.optLong("trakt")}" else if(ids.optLong("tmdb")>0)"tmdb:${ids.optLong("tmdb")}" else "unknown:${row.optString("id")}")
  val at=row.optString("watched_at");val instant=try{Instant.parse(at)}catch(_:Exception){null}
  val ms=try{instant?.takeIf{it.atZone(ZoneId.of("UTC")).year in 1..9999}?.toEpochMilli()}catch(_:Exception){null}
  val season=episode?.optInt("season",-1)?:-1;val number=episode?.optInt("number",-1)?:-1
  val episodeId=episode?.optJSONObject("ids")?.optString("trakt").orEmpty()
  val episodeKey=if(kind=="movie")"" else if(season>=0&&number>0)"$key:$season:$number" else if(episodeId.isNotBlank())"episode:trakt:$episodeId" else "unknown-episode:${row.optString("id") }"
  val eventId=row.optString("id").takeIf{it.matches(Regex("[0-9]{1,30}"))}?:return null
  val minutes=(if(kind=="movie")title.optInt("runtime") else episode?.optInt("runtime")?.takeIf{it>0}?:title.optInt("runtime")).coerceIn(0,2000)
  return JSONObject().put("eventId",eventId).put("source","Trakt").put("kind",kind).put("type",if(kind=="movie")"movie" else "series").put("id",id).put("mediaKey",key).put("episodeKey",episodeKey)
   .put("name",title.optString("title","Título sem nome").take(300)).put("year",title.opt("year")?:"").put("episodeTitle",episode?.optString("title").orEmpty().take(300)).put("season",season).put("episode",number)
   .put("watchedAt",if(ms!=null)instant.toString() else "").put("watchedMs",ms?:JSONObject.NULL).put("datePrecision",if(ms!=null)"exact" else "unknown").put("runtimeMinutes",minutes).put("action",row.optString("action").take(40))
 }
 fun summary(rows:List<JSONObject>,zone:ZoneId=ZoneId.systemDefault()):JSONObject {
  fun stats(events:List<JSONObject>):JSONObject {
   val movies=events.filter{it.optString("kind")=="movie"};val episodes=events.filter{it.optString("kind")=="episode"}
   return JSONObject().put("plays",events.size).put("movies",movies.filter{!it.optString("mediaKey").contains(":unknown:")}.map{it.optString("mediaKey")}.toSet().size).put("moviePlays",movies.size).put("series",episodes.filter{!it.optString("mediaKey").contains(":unknown:")}.map{it.optString("mediaKey")}.toSet().size).put("episodes",episodes.filter{!it.optString("episodeKey").startsWith("unknown-episode:")}.map{it.optString("episodeKey")}.toSet().size).put("episodePlays",episodes.size).put("estimatedMinutes",events.sumOf{it.optInt("runtimeMinutes").toLong()}).put("timedPlays",events.count{it.optInt("runtimeMinutes")>0}).put("unknownDates",events.count{it.optString("datePrecision")!="exact"})
  }
  fun year(row:JSONObject):Int?=try{if(row.optString("datePrecision")=="exact")Instant.ofEpochMilli(row.optLong("watchedMs")).atZone(zone).year else null}catch(_:Exception){null}
  val years=JSONArray();for((year,events)in rows.groupBy{year(it)}.filterKeys{it!=null}.toSortedMap(compareByDescending{it?:0}))years.put(stats(events).put("year",year))
  val media=JSONArray();for((_,events)in rows.filter{it.optString("id").isNotBlank()}.groupBy{it.optString("mediaKey")}){
   val first=events.first();val dates=events.filter{it.optString("datePrecision")=="exact"}.map{it.optLong("watchedMs")}.sorted()
   media.put(JSONObject().put("id",first.getString("id")).put("type",first.getString("type")).put("name",first.optString("name")).put("year",first.opt("year")?:"").put("plays",events.size).put("episodes",events.filter{it.optString("kind")=="episode"}.map{it.optString("episodeKey")}.toSet().size)
    .put("years",JSONArray(events.mapNotNull{year(it)}.distinct().sorted())).put("unknownDates",events.count{it.optString("datePrecision")!="exact"}).put("firstWatched",dates.firstOrNull()?:JSONObject.NULL).put("lastWatched",dates.lastOrNull()?:JSONObject.NULL))
  }
  return JSONObject().put("totals",stats(rows)).put("years",years).put("unknown",stats(rows.filter{it.optString("datePrecision")!="exact"})).put("media",media).put("unmatched",rows.count{it.optString("id").isBlank()}).put("timezone",zone.id)
 }
}
