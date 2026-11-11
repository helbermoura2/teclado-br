import {seriesSummary} from './series-view.js';
const idValid=row=>/^tt\d{5,12}$/.test(row?.id||'');
const stamp=value=>typeof value==='number'?value:Date.parse(value||'')||0;
export function seriesUniverse(items,trakt={},nuvio={},state={}){
 const found=new Map();
 const add=(row,source)=>{if(!idValid(row))return;const old=found.get(row.id)||{};const name=old.name&&!/^tt\d+$/.test(old.name)?old.name:row.name||old.name||row.id;found.set(row.id,{id:row.id,type:'series',name:row.name||old.name||row.id,year:row.year||old.year||'',source:old.source||source,sourceUrl:`https://www.imdb.com/title/${row.id}/`,...old,name});};
 for(const item of items.filter(row=>row.type==='series')){add(item,item.source);found.set(item.id,{...found.get(item.id),...item});}
 if(trakt.connected)for(const row of trakt.progress||[])if(row.episodes>0)add(row,'Trakt');
 if(nuvio.active)for(const row of nuvio.series||[])add(row,'Nuvio');
 if(state.connected!==false)for(const row of state.items||[])if(row.completed>0&&(!state.account||!trakt.account||state.account===trakt.account))add(row,'Trakt');
 return [...found.values()];
}
export function currentTraktProgress(item,state,trakt){
 if(state.connected===false||state.account&&trakt.account&&state.account!==trakt.account)return null;
 const row=(state.items||[]).find(row=>row.id===item.id);if(!row?.checkedAt)return null;
 const watched=(trakt.progress||[]).find(row=>row.id===item.id);
 if(watched&&(Number(watched.episodes)!==Number(row.completed)||row.historyKey&&row.historyKey!==`${watched.watchedAt||''}:${watched.episodes||0}`))return null;
 return row;
}
export function seriesCards(items,state,nuvio,{trakt={},nuvioRows=[]}={}){
 return seriesUniverse(items,trakt,nuvio,state).map(original=>{
  const item={...original};
  const observed=(nuvio.series||[]).find(row=>row.id===item.id);
  const traktRow=currentTraktProgress(item,state,trakt),direct=nuvio.active?nuvioRows.find(row=>row.id===item.id&&row.historyKey===[...(observed?.seen||[])].sort().join('|')):null;
  const counts=(nuvio.series||[]).find(row=>row.id===item.id),traktCount=(trakt.progress||[]).find(row=>row.id===item.id);
  if(direct?.name&&(!item.name||/^tt\d+$/.test(item.name)))item.name=direct.name;
  if(direct?.checkedAt){const summary=seriesSummary(direct);return {item,state:direct,source:'Nuvio',headline:direct.coverage==='partial'&&!direct.available?'Catálogo de episódios incompleto':summary.headline,detail:`Nuvio · ${summary.detail}`,priority:stamp(direct.watchedAt)};}
  if(traktRow){const summary=seriesSummary(traktRow);return {item,state:traktRow,source:'Trakt',headline:summary.headline,detail:`Trakt · ${summary.detail}`,priority:stamp(traktCount?.watchedAt||traktRow.watchedAt)};}
  const count=nuvio.active?(counts?.episodes||item.nuvioWatchedEpisodes||0):traktCount?.episodes||0;
  return {item,state:null,source:nuvio.active&&count?'Nuvio':trakt.connected?'Trakt':'Local',headline:count?`${count} episódios vistos`:'Na sua lista',detail:count?'Confirmando o próximo episódio…':'Aguardando dados confirmados.',priority:stamp(counts?.watchedAt||traktCount?.watchedAt)};
 }).sort((a,b)=>b.priority-a.priority||(b.state?.available||0)-(a.state?.available||0));
}
export function nextEpisodeEntries(items,state,trakt={},nuvio={},nuvioRows=[]){
 const universe=seriesUniverse(items,trakt,nuvio,state),out=[];
 const entry=(original,row,source,scope,at,observed)=>{
  const item={...original,...(row?.name&&!/^tt\d+$/.test(row.name)&&(!original.name||/^tt\d+$/.test(original.name))?{name:row.name}:{})};
  if(!row?.checkedAt){if(observed>0)out.push({kind:'pending',scope,item,row:{season:0,episode:0,lastWatched:stamp(at)},source,label:`${observed} episódios vistos · confirmando próximo episódio`});return;}
  if(!(row.completed>0||row.observed>0||observed>0)||row.available<=0||!row.next?.season||!row.next?.number)return;
  out.push({kind:'next',scope,item,row:{season:row.next.season,episode:row.next.number,lastWatched:stamp(at)},source,label:`Próximo: T${row.next.season} · E${row.next.number}${row.next.title?' · '+row.next.title:''}${row.error?' · consulta pendente':''}`});
 };
 for(const item of universe){
  const tracked=trakt.connected?(trakt.progress||[]).find(row=>row.id===item.id):null;
  if(tracked?.episodes>0)entry(item,currentTraktProgress(item,state,trakt),'Trakt',`trakt:${trakt.account||trakt.username||'current'}`,tracked.watchedAt,tracked.episodes);
  const watched=nuvio.active?(nuvio.series||[]).find(row=>row.id===item.id):null;
  if(watched?.episodes>0)entry(item,nuvioRows.find(row=>row.id===item.id&&row.historyKey===[...(watched.seen||[])].sort().join('|')),'Nuvio',nuvio.scope||String(nuvio.profileId),watched.watchedAt,watched.episodes);
 }
 return out;
}
export function combineContinuity(paused,next){
 const identity=entry=>`${entry.item.type}:${entry.item.id}:${entry.row.season||0}:${entry.row.episode||0}${entry.kind==='pending'?':'+entry.scope:''}`;
 const found=new Map();
 for(const value of [...paused.map(row=>({...row,kind:'paused',source:row.source||'Nuvio'})),...next]){
  const id=identity(value),old=found.get(id);if(!old){found.set(id,{...value,also:[]});continue;}
  // Collapse only the exact same target episode. Positions/counts from different sources are never summed.
  if(old.source!==value.source&&!old.also.some(row=>row.source===value.source))old.also.push({source:value.source,label:value.label});
 }
 return [...found.values()].sort((a,b)=>(b.row.lastWatched||0)-(a.row.lastWatched||0));
}

export function traktPausedEntries(state){if(!state.connected)return [];return (state.paused||[]).filter(row=>idValid(row)&&['movie','series'].includes(row.type)&&row.percent>0&&row.percent<100&&(row.type==='movie'||row.season>0&&row.episode>0)).map(row=>({kind:'paused',source:'Trakt',scope:`trakt:${state.account||state.username||'current'}`,percent:row.percent,item:{id:row.id,type:row.type,name:row.name||row.id,year:row.year||'',source:'Trakt',sourceUrl:`https://www.imdb.com/title/${row.id}/`},row:{season:row.season||0,episode:row.episode||0,lastWatched:stamp(row.pausedAt)},label:`${row.type==='series'?`T${row.season} · E${row.episode} · `:''}${Math.round(row.percent)}%${state.playbackError?' · consulta pendente':''}`}));}
