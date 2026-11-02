const key=item=>`${item.type}:${item.id}`;
export function applyHistoryMetadata(items,state){
 if(!state.scope)return state.connected?items.map(item=>{if(!item.historyInfo)return item;const copy={...item};delete copy.historyInfo;return copy;}):items;
 const media=new Map((state.media||[]).filter(row=>/^tt\d{5,12}$/.test(row.id||'')&&['movie','series'].includes(row.type)).map(row=>[key(row),row]));
 return items.map(item=>{const row=media.get(key(item));if(!row){if(item.historyInfo?.scope&&item.historyInfo.scope!==state.scope){const copy={...item};delete copy.historyInfo;return copy;}return item;}
  const info={scope:state.scope,source:'Trakt',plays:Number(row.plays)||0,episodes:Number(row.episodes)||0,years:(row.years||[]).filter(year=>Number.isInteger(year)&&year>=1&&year<=9999),unknownDates:Number(row.unknownDates)||0,firstWatched:row.firstWatched,lastWatched:row.lastWatched};
  return JSON.stringify(info)===JSON.stringify(item.historyInfo)?item:{...item,historyInfo:info};
 });
}
export function historyYearLabel(item){const years=item.historyInfo?.years||[];if(!years.length)return item.historyInfo?.plays?'Data desconhecida':'';const label=years.length>3?`${years[0]}–${years.at(-1)}`:years.join(', ');return item.type==='series'?`Episódios em ${label}`:`Visto em ${label}`;}
export function historyStats(state,year='all'){if(year==='all')return state.totals||{};if(year==='unknown')return state.unknown||{};return (state.years||[]).find(row=>String(row.year)===String(year))||{};}
export function historyDate(row){const date=row.datePrecision==='exact'?new Date(row.watchedAt):null;return date&&Number.isFinite(date.getTime())?date.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Data desconhecida';}
export function historyItem(row,items=[]){const type=row.kind==='movie'?'movie':'series',saved=items.find(item=>item.id===row.id&&item.type===type);return saved||{id:row.id||row.mediaKey,type,name:row.name,year:row.year,genre:type==='series'?'Série':'Filme',source:'Trakt',sourceUrl:/^tt\d{5,12}$/.test(row.id||'')?`https://www.imdb.com/title/${row.id}/`:undefined};}
