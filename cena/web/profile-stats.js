/** Aggregate only confirmed local data; viewing time and catalog size are different measures. */
export function profileCollection(items=[]){
 const unique=new Map();for(const item of items){if(!item?.id||!['movie','series'].includes(item.type))continue;unique.set(`${item.type}:${item.id}`,item);}
 const rows=[...unique.values()];return {total:rows.length,movies:rows.filter(x=>x.type==='movie').length,series:rows.filter(x=>x.type==='series').length,watchlist:rows.filter(x=>x.status==='watchlist').length,watched:rows.filter(x=>x.status==='watched').length};
}
export function yearlyHistory(state={}){return (state.years||[]).filter(x=>Number.isInteger(Number(x.year))&&Number(x.year)>=1&&Number(x.year)<=9999).map(x=>({year:Number(x.year),plays:Math.max(0,Number(x.plays)||0),movies:Math.max(0,Number(x.movies)||0),episodes:Math.max(0,Number(x.episodes)||0),minutes:Math.max(0,Number(x.estimatedMinutes)||0),timedPlays:Math.max(0,Number(x.timedPlays)||0)})).sort((a,b)=>a.year-b.year);}
export function personalRatings(notes={}){
 const rows=Object.entries(notes).flatMap(([key,note])=>{const raw=String(note?.rating??'').trim();if(!/^(?:10(?:[.,]0{1,2})?|[0-9](?:[.,]\d{1,2})?)$/.test(raw)||! /^(movie|series):tt\d{5,12}$/.test(key))return [];const rating=Number(raw.replace(',','.'));return [{key,rating}];});
 return {count:rows.length,average:rows.length?rows.reduce((sum,row)=>sum+row.rating,0)/rows.length:null,distribution:Array.from({length:11},(_,rating)=>({rating,count:rows.filter(row=>Math.round(row.rating)===rating).length}))};
}

export function watchedGenres(media, items, period, type, label){
 const names=new Map(items.map(item=>[`${item.type}:${item.id}`,item.genres]));
 const counts=new Map(),seen=new Set();
 let classified=0;
 for(const title of media){
  if(type&&title.type!==type)continue;
  if(period==='unknown'&&!title.unknownDates)continue;
  if(period!=='all'&&period!=='unknown'&&!title.years?.includes(Number(period)))continue;
  const key=`${title.type}:${title.id}`;
  if(seen.has(key))continue;
  seen.add(key);
  const genres=new Set((names.get(key)||[]).filter(value=>typeof value==='string'&&value.trim()).map(value=>label(value.trim())));
  if(genres.size)classified++;
  for(const genre of genres)counts.set(genre,(counts.get(genre)||0)+1);
 }
 return {classified,total:seen.size,rows:[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR')).slice(0,6)};
}

export function watchedTitles(media, items, period, type){
 const catalog=new Map(items.map(item=>[`${item.type}:${item.id}`,item]));
 return media.flatMap(row=>{
  if(type&&row.type!==type)return [];
  const stats=period==='all'?row:row.periods?.[period];
  if(!(Number(stats?.plays)>0))return [];
  const item=catalog.get(`${row.type}:${row.id}`)||row;
  return [{item,plays:Number(stats.plays),episodes:Number(stats.episodes)||0,minutes:Number(stats.minutes)||0}];
 });
}

export function castRanking(titles){
 const names=new Map();
 for(const {item} of titles){
  const cast=new Map((Array.isArray(item.cast)?item.cast:[]).filter(name=>typeof name==='string'&&name.trim()).map(name=>[name.trim().toLocaleLowerCase('pt-BR'),name.trim()]));
  for(const [key,name] of cast){
   const row=names.get(key)||{name,count:0};
   row.count++;
   names.set(key,row);
  }
 }
 return [...names.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'pt-BR')).slice(0,12);
}
