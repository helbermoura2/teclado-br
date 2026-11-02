import {seriesSummary} from './series-view.js';
export const titleName=item=>item?.name&&!/^tt\d+$/.test(item.name)?item.name:item?.type==='series'?'Série · buscando título':'Filme · buscando título';
export const resumeKey=(entry,scope)=>JSON.stringify([scope,entry.item.type,entry.item.id,entry.row.season||0,entry.row.episode||0]);
export function visibleResume(rows,hidden={},scope=''){
 return rows.filter(entry=>Number.isFinite(Number(entry.row.position))&&entry.row.position>=60000&&(!(entry.row.duration>0)||entry.row.position/entry.row.duration>=.02)&&!hidden[resumeKey(entry,scope)]);
}
export function homeSeries(items,seriesState,nuvioState){
 return items.filter(item=>item.type==='series').map(item=>{
  if(nuvioState.active){const count=item.nuvioWatchedEpisodes||0;return {item,headline:count?`${count} ${count===1?'episódio visto':'episódios vistos'}`:'Na sua lista',detail:'Acompanhe sua série',priority:count?1:0};}
  const state=seriesState.items?.find(row=>row.id===item.id),summary=seriesSummary(state);
  return {item,headline:summary.headline,detail:summary.detail,priority:(state?.newEpisodes||0)*1000+(state?.available||0)};
 }).sort((a,b)=>b.priority-a.priority);
}
