import {seriesCards} from './series-continuity.js';
import {seriesSummary} from './series-view.js';
export const titleName=item=>item?.name&&!/^tt\d+$/.test(item.name)?item.name:item?.type==='series'?'Série · buscando título':'Filme · buscando título';
export const resumeKey=(entry,scope)=>JSON.stringify([entry.scope||scope,entry.item.type,entry.item.id,entry.row.season||0,entry.row.episode||0]);
export function visibleResume(rows,hidden={},scope=''){
 return rows.filter(entry=>(['next','pending'].includes(entry.kind)||entry.source==='Trakt'&&entry.kind==='paused'&&entry.percent>=2||Number.isFinite(Number(entry.row.position))&&entry.row.position>=60000&&(!(entry.row.duration>0)||entry.row.position/entry.row.duration>=.02))&&!hidden[resumeKey(entry,scope)]);
}
export function oneResumePerTitle(rows){
 const cards=new Map();
 const priority={paused:2,next:1,pending:0};
 for(const entry of rows){
  const key=entry.item.type+':'+entry.item.id;
  const existing=cards.get(key);
  if(!existing||(entry.row.lastWatched||0)>(existing.row.lastWatched||0)||
   (entry.row.lastWatched||0)===(existing.row.lastWatched||0)&&priority[entry.kind]>priority[existing.kind]){
   cards.set(key,entry);
  }
 }
 return [...cards.values()].sort((a,b)=>(b.row.lastWatched||0)-(a.row.lastWatched||0));
}
export function homeSeries(items,seriesState,nuvioState,options){return seriesCards(items,seriesState,nuvioState,options);}
