package app.cena

import org.json.JSONObject
import org.json.JSONArray
import java.time.Instant
import java.time.LocalDate
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
 fun moviePeriod(rows:List<JSONObject>,period:String,zone:ZoneId=ZoneId.systemDefault(),today:LocalDate=LocalDate.now(zone)):JSONObject {
  val start=when(period){
   "all"->null
   "today"->today
   "month"->today.withDayOfMonth(1)
   "year"->today.withDayOfYear(1)
   else->LocalDate.parse(when(period.length){4->"$period-01-01";7->"$period-01";else->period})
  }
  val end=when{period=="month"||period.length==7->start?.plusMonths(1);period=="year"||period.matches(Regex("[0-9]{4}"))->start?.plusYears(1);else->start?.plusDays(1)}
  val movies=rows.asSequence().filter{it.optString("kind")=="movie"}.map{row->
   val date=if(row.optString("datePrecision")=="exact"&&!row.isNull("watchedMs"))
    Instant.ofEpochMilli(row.optLong("watchedMs")).atZone(zone).toLocalDate() else null
   row to date
  }.filter{(_,date)->start==null||(date!=null&&date>=start&&date<requireNotNull(end))}.toList()
  val dates=movies.mapNotNull{it.second}.toSet()
  var streak=0;var longestStreak=0;var previous:LocalDate?=null
  for(date in dates.sorted()){
   streak=if(previous?.plusDays(1)==date)streak+1 else 1
   longestStreak=maxOf(longestStreak,streak);previous=date
  }
  val weekdays=movies.mapNotNull{it.second?.dayOfWeek?.value}.groupingBy{it}.eachCount()
  val topWeekday=weekdays.entries.sortedWith(compareByDescending<Map.Entry<Int,Int>>{it.value}.thenBy{it.key}).firstOrNull()
  val known=movies.map{it.first}.filter{val key=it.optString("mediaKey");key.isNotBlank()&&!key.contains(":unknown:")}.groupBy{it.optString("mediaKey")}
  val rewatched=known.values.filter{it.size>1}.sortedByDescending{it.size}.take(5).map{
   JSONObject().put("name",it.first().optString("name","Filme sem nome")).put("plays",it.size)
  }
  return JSONObject().put("movies",known.size).put("moviePlays",movies.size)
   .put("movieMinutes",movies.sumOf{it.first.optInt("runtimeMinutes").coerceAtLeast(0).toLong()})
   .put("timedMovies",movies.count{it.first.optInt("runtimeMinutes")>0}).put("activeDays",dates.size)
   .put("firstMovieDate",dates.minOrNull()?.toString().orEmpty()).put("unknownMovieDates",movies.count{it.second==null})
   .put("longestStreak",longestStreak).put("topWeekday",topWeekday?.key?:0).put("topWeekdayPlays",topWeekday?.value?:0)
   .put("rewatched",JSONArray(rewatched))
 }
 fun summary(rows:List<JSONObject>,zone:ZoneId=ZoneId.systemDefault()):JSONObject {
  fun stats(events:List<JSONObject>):JSONObject {
   val movies=events.filter{it.optString("kind")=="movie"};val episodes=events.filter{it.optString("kind")=="episode"}
   val weekdays=events.mapNotNull{row->
    if(row.optString("datePrecision")!="exact"||row.isNull("watchedMs"))null
    else Instant.ofEpochMilli(row.optLong("watchedMs")).atZone(zone).dayOfWeek.value to row.optString("kind")
   }.groupingBy{it}.eachCount()
   val activity=JSONObject().put("movies",JSONArray((1..7).map{weekdays[it to "movie"]?:0}))
    .put("episodes",JSONArray((1..7).map{weekdays[it to "episode"]?:0}))
   return JSONObject().put("weekdays",activity).put("plays",events.size).put("movies",movies.filter{!it.optString("mediaKey").contains(":unknown:")}.map{it.optString("mediaKey")}.toSet().size).put("moviePlays",movies.size).put("series",episodes.filter{!it.optString("mediaKey").contains(":unknown:")}.map{it.optString("mediaKey")}.toSet().size).put("episodes",episodes.filter{!it.optString("episodeKey").startsWith("unknown-episode:")}.map{it.optString("episodeKey")}.toSet().size).put("episodePlays",episodes.size).put("estimatedMinutes",events.sumOf{it.optInt("runtimeMinutes").toLong()}).put("timedPlays",events.count{it.optInt("runtimeMinutes")>0}).put("unknownDates",events.count{it.optString("datePrecision")!="exact"})
  }
  fun date(row:JSONObject):LocalDate?=try{
   if(row.optString("datePrecision")=="exact"&&!row.isNull("watchedMs"))Instant.ofEpochMilli(row.optLong("watchedMs")).atZone(zone).toLocalDate()else null
  }catch(_:java.time.DateTimeException){null}
  fun metrics(events:List<JSONObject>)=JSONObject().put("plays",events.size)
   .put("episodes",events.filter{it.optString("kind")=="episode"&&!it.optString("episodeKey").startsWith("unknown-episode:")}.map{it.optString("episodeKey")}.toSet().size)
   .put("minutes",events.sumOf{it.optInt("runtimeMinutes").toLong()})
  val byDate=rows.groupBy{date(it)}
  val years=JSONArray()
  for((year,events) in rows.groupBy{date(it)?.year}.filterKeys{it!=null}.toSortedMap(compareByDescending{it?:0}))years.put(stats(events).put("year",year))
  val activity=JSONArray()
  for((day,events) in byDate.filterKeys{it!=null}.toSortedMap(compareBy<LocalDate?>{it})){
   val films=events.filter{it.optString("kind")=="movie"}
   val episodes=events.filter{it.optString("kind")=="episode"}
   activity.put(JSONObject().put("date",day.toString()).put("movies",metrics(films)).put("series",metrics(episodes)))
  }
  val media=JSONArray()
  for((_,events) in rows.filter{it.optString("id").isNotBlank()}.groupBy{it.optString("mediaKey")}){
   val first=events.first()
   val groups=events.groupBy{date(it)?.year}
   val periods=JSONObject()
   for((year,viewings) in groups)periods.put(year?.toString()?:"unknown",metrics(viewings))
   val dates=events.filter{date(it)!=null}.map{it.optLong("watchedMs")}.sorted()
   media.put(metrics(events).put("id",first.getString("id")).put("type",first.getString("type")).put("name",first.optString("name")).put("year",first.opt("year")?:"")
    .put("years",JSONArray(groups.keys.filterNotNull().sorted())).put("unknownDates",groups[null]?.size?:0)
    .put("periods",periods).put("firstWatched",dates.firstOrNull()?:JSONObject.NULL).put("lastWatched",dates.lastOrNull()?:JSONObject.NULL))
  }
  return JSONObject().put("activity",activity).put("totals",stats(rows)).put("years",years).put("unknown",stats(rows.filter{it.optString("datePrecision")!="exact"})).put("media",media).put("unmatched",rows.count{it.optString("id").isBlank()}).put("timezone",zone.id)
 }
}
