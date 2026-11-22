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
