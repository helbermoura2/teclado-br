// Only confirmed watches belong here; playback position alone never proves completion.
export function recentWatches(history=[],nuvio={},limit=10){
 const rows=[...history];
 if(nuvio.connected&&nuvio.active){
  for(const row of [...(nuvio.recent||[]),...(nuvio.watched||[])]){
   if(!/^tt\d{5,12}$/.test(row.id||'')||!['movie','series'].includes(row.type))continue;
   if(row.type==='series'&&!(row.season>0&&row.episode>0))continue;
   const at=typeof row.watchedAt==='number'?row.watchedAt:Date.parse(row.watchedAt);
   const exact=Number.isFinite(at)&&at>0&&Number.isFinite(new Date(at).getTime());
   rows.push({...row,kind:row.type==='movie'?'movie':'episode',name:row.name||row.id,source:'Nuvio',datePrecision:exact?'exact':'unknown',watchedAt:exact?new Date(at).toISOString():''});
  }
 }
 const stamp=row=>row.datePrecision==='exact'?(Date.parse(row.watchedAt)||0):0;
 const seen=new Set();
 return rows.sort((a,b)=>stamp(b)-stamp(a)).filter(row=>{
  const id=row.id||row.mediaKey;if(!id)return false;
  const key=(row.kind==='movie'?'movie:':'series:')+id;
  if(seen.has(key))return false;seen.add(key);return true;
 }).slice(0,limit);
}

export function viewingDayKey(date){
 return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
export function viewingDays(history=[],nuvio={}){
 const rows=[...history];
 if(nuvio.active)for(const entry of [...(nuvio.recent||[]),...(nuvio.watched||[])]){
  if(!/^tt[0-9]{5,12}$/.test(entry.id)||!['movie','series'].includes(entry.type))continue;
  if(entry.type==='series'&&!(entry.season>=0&&entry.episode>0))continue;
  rows.push({...entry,source:'Nuvio',kind:entry.type==='movie'?'movie':'episode',datePrecision:'exact'});
 }
 const days=new Map();
 for(const row of rows){
  if(row.datePrecision!=='exact'||!row.watchedAt)continue;
  const date=new Date(row.watchedAt);
  if(!Number.isFinite(date.getTime()))continue;
  const id=row.id||row.mediaKey;
  if(!id)continue;
  const key=viewingDayKey(date);
  const day=days.get(key)||new Map();
  const viewingKey=[row.kind,id,row.season||0,row.episode||0].join(':');
  const previous=day.get(viewingKey);
  if(previous)previous.sources.add(row.source||'Trakt');
  else day.set(viewingKey,{...row,sources:new Set([row.source||'Trakt'])});
  days.set(key,day);
 }
 return days;
}
