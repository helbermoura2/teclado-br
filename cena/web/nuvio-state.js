const valid=row=>/^tt\d{5,12}$/.test(row?.id||'')&&['movie','series'].includes(row.type);
const key=row=>`${row.type}:${row.id}`;
export function applyNuvioState(items,state){
 if(!state?.connected||!state.active)return items;
 const scope=state.scope||String(state.profileId);
 items=items.map(item=>{if(!item.nuvioScope||item.nuvioScope===scope)return item;const restored={...item,...(item.nuvioPreviousState||{})};for(const field of ['nuvioScope','nuvioPreviousState','nuvioProfile','nuvioConfirmedAt','nuvioWatchedEpisodes'])delete restored[field];if(!item.nuvioPreviousState?.watchedSource)delete restored.watchedSource;if(!item.nuvioPreviousState?.watchedAt)delete restored.watchedAt;return restored;});
 if(!state.lastSync)return items;
 const movies=new Map(),episodes=new Map();
 for(const row of state.watched||[]){if(!valid(row))continue;if(row.type==='movie')movies.set(key(row),row);else if(row.season>0&&row.episode>0){if(!episodes.has(key(row)))episodes.set(key(row),new Set());episodes.get(key(row)).add(`${row.season}:${row.episode}`);}}
 return items.map(item=>{const row=movies.get(key(item)),seen=episodes.get(key(item));if(!row&&!seen)return item;
  const previous=item.nuvioPreviousState||{status:item.status,watchedEpisodes:item.watchedEpisodes||0,watchedSource:item.watchedSource||'',watchedAt:item.watchedAt||''};
  if(row)return {...item,nuvioPreviousState:previous,nuvioScope:scope,status:'watched',watchedSource:'Nuvio',nuvioProfile:state.profileId,nuvioConfirmedAt:state.lastSync,...(row.watchedAt>0?{watchedAt:new Date(row.watchedAt).toISOString()}:{} )};
  return {...item,nuvioPreviousState:previous,nuvioScope:scope,watchedEpisodes:Math.max(Number(item.watchedEpisodes)||0,seen.size),nuvioWatchedEpisodes:seen.size,nuvioProfile:state.profileId,nuvioConfirmedAt:state.lastSync};
 });
}
export function nuvioContinue(items,state){
 if(!state?.active||!state.lastSync)return [];
 const finished=new Set([...(state.watched||[]),...(state.recent||[])].filter(valid).map(row=>`${key(row)}:${row.season||0}:${row.episode||0}`));const seen=new Set();
 return [...(state.progress||[])].filter(valid).sort((a,b)=>(b.lastWatched||0)-(a.lastWatched||0)).flatMap(row=>{
  const identity=`${key(row)}:${row.season||0}:${row.episode||0}`;if(seen.has(identity)||finished.has(identity)||row.position<=0||row.duration>0&&row.position>=row.duration)return [];seen.add(identity);
  const saved=items.find(item=>key(item)===key(row));const item=saved||{id:row.id,type:row.type,name:row.name||row.id,genre:row.type==='series'?'Série':'Filme',source:'Nuvio',sourceUrl:`https://www.imdb.com/title/${row.id}/`};
  const percent=row.duration>0?Math.min(99,Math.round(row.position/row.duration*100)):null;const episode=row.type==='series'&&row.season>0&&row.episode>0?`T${row.season} · E${row.episode} · `:'';
  return [{item,row,label:`${episode}${Math.floor(row.position/60000)} min${percent!==null?` · ${percent}%`:''}`}];
 }).slice(0,20);
}
