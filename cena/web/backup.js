import {constrainStoryLogo,storyCaptionLimit} from './story-layout.js';
import {mountRetrospective} from './retrospective.js';
import {managedKeys} from './app-storage.js';
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const safeItemFields=['id','type','name','originalName','year','genre','genres','description','poster','runtime','cast','directors','status','addedAt','watchedAt','watchedEpisodes','imdbRating','imdbRatingAt','source','sourceUrl'];
export function cleanItem(item){
 if(!object(item)||!/[A-Za-z0-9]/.test(item.id||'')||!String(item.id).match(/^[A-Za-z0-9:._-]{1,180}$/)||!['movie','series'].includes(item.type)||typeof item.name!=='string'||item.name.length>500)throw Error('Há um título inválido no backup.');
 return Object.fromEntries(safeItemFields.filter(key=>Object.hasOwn(item,key)).map(key=>[key,item[key]]));
}
function cleanHistory(history){
 if(!object(history)||history.format!=='cena-watch-history'||!Array.isArray(history.events)||history.events.length>50000)throw Error('Histórico inválido.');
 const fields=['eventId','source','kind','type','id','mediaKey','episodeKey','name','year','episodeTitle','season','episode','watchedAt','watchedMs','datePrecision','runtimeMinutes','action'];
 const events=history.events.map(row=>{if(!object(row)||!/^\d{1,30}$/.test(row.eventId||'')||!['movie','episode'].includes(row.kind)||typeof row.name!=='string'||row.name.length>500)throw Error('Registro de histórico inválido.');const clean=Object.fromEntries(fields.filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]]));if(row.datePrecision!=='exact'||!Number.isFinite(Date.parse(row.watchedAt))){clean.datePrecision='unknown';clean.watchedAt='';clean.watchedMs=null;}return clean;});
 const account=String(history.account||'Conta não informada').slice(0,250);if(['__proto__','constructor','prototype'].includes(account))throw Error('Conta do histórico inválida.');return {format:'cena-watch-history',account,events};
}
function cleanSettings(key,value){
 if(!object(value)||Object.keys(value).length>50000)throw Error('Preferências inválidas.');const entries=[];
 for(const [id,row]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(id)||id.length>1000)throw Error('Identificador inválido.');
 if(key==='cena.collections.v1'){if(!object(row)||typeof row.name!=='string'||!row.name.trim()||row.name.length>60||!Array.isArray(row.items)||row.items.length>20000||!row.items.every(value=>typeof value==='string'&&/^(movie|series):[A-Za-z0-9:._-]{1,180}$/.test(value)))throw Error('Lista pessoal inválida.');entries.push([id,{name:row.name,items:[...new Set(row.items)],titles:Object.fromEntries(Object.entries(row.titles||{}).map(([k,v])=>[k,cleanItem(v)])),at:Number(row.at)||0}]);}
 else if(key==='cena.feedback.v1'){if(!object(row)||!['like','dislike','seen'].includes(row.value))throw Error('Feedback inválido.');const item=cleanItem(row.item);if(id!==item.type+':'+item.id)throw Error('Feedback de outro título.');entries.push([id,{value:row.value,item,at:Number(row.at)||0}]);}
 else if(key==='cena.story.notes.v1'){if(!object(row)||!/^(movie|series):[A-Za-z0-9:._-]{1,180}$/.test(id))throw Error('Nota inválida.');entries.push([id,{caption:String(row.caption||'').slice(0,storyCaptionLimit),title:String(row.title||'').slice(0,180),rating:String(row.rating??'').slice(0,12),...(row.logoPosition?{logoPosition:constrainStoryLogo(row.logoPosition)}:{}),at:Number(row.at)||0}]);}
 else if(key==='cena.history.archive.v1')entries.push([id,cleanHistory(row)]);
 else if(key==='cena.resume.hidden.v1'){if(typeof row!=='boolean')throw Error('Preferência inválida.');entries.push([id,row]);}
 }
 return Object.fromEntries(entries);
}
export function validateBackup(raw){
 if(!object(raw)||raw.format!=='cena-backup'||raw.version!==1||!object(raw.data))throw Error('Este arquivo não é um backup CENA compatível.');
 const data={};
 for(const key of managedKeys){if(!Object.hasOwn(raw.data,key))continue;const value=raw.data[key];if(key==='cena.local.items.v1'){if(!Array.isArray(value)||value.length>20000)throw Error('Catálogo inválido.');data[key]=value.map(cleanItem);}else{if(!object(value)||JSON.stringify(value).length>24*1024*1024)throw Error('Preferências inválidas.');data[key]=cleanSettings(key,value);}}
 const history=raw.history?cleanHistory(raw.history):null;
 return {format:'cena-backup',version:1,createdAt:String(raw.createdAt||''),data,history};
}
const identity=item=>`${item.type}:${item.id}`;
export function mergeBackup(storage,raw){
 const backup=validateBackup(raw),values={};
 for(const [key,incoming]of Object.entries(backup.data)){
  const current=JSON.parse(storage.getItem(key)|| (key==='cena.local.items.v1'?'[]':'{}'));
  values[key]=key==='cena.local.items.v1'?[...new Map([...incoming,...current].map(item=>[identity(item),item])).values()]:{...incoming,...current};
 }
 if(backup.history){const key='cena.history.archive.v1',archives=values[key]||JSON.parse(storage.getItem(key)||'{}');const id=backup.history.account||'Conta não informada';const previous=archives[id]?.events||[];archives[id]={...backup.history,events:[...new Map([...backup.history.events,...previous].map(row=>[row.eventId,row])).values()]};values[key]=archives;}
 if(values['cena.local.items.v1']?.length>20000)throw Error('A união ultrapassa o limite de 20 mil títulos. Nada foi alterado.');
 storage.batch(values);return {titles:values['cena.local.items.v1']?.length||0,events:backup.history?.events.length||0};
}
export function buildBackup(storage){return {format:'cena-backup',version:1,createdAt:new Date().toISOString(),data:Object.fromEntries(managedKeys.map(key=>[key,JSON.parse(storage.getItem(key)||'null')]).filter(([,value])=>value!==null))};}
export function downloadJson(value,name='CENA-Backup.json'){const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function archiveSummary(events){
 const stats=rows=>({plays:rows.length,movies:new Set(rows.filter(row=>row.kind==='movie'&&(row.id||row.mediaKey)).map(row=>row.id||row.mediaKey)).size,series:new Set(rows.filter(row=>row.kind==='episode'&&(row.id||row.mediaKey)).map(row=>row.id||row.mediaKey)).size,episodes:new Set(rows.filter(row=>row.kind==='episode'&&row.season>=0&&row.episode>0).map(row=>`${row.id||row.mediaKey}:${row.season}:${row.episode}`)).size,estimatedMinutes:rows.reduce((sum,row)=>sum+Math.max(0,Math.min(2000,Number(row.runtimeMinutes)||0)),0)});
 const unique=[...new Map(events.map(row=>[row.eventId,row])).values()],groups=new Map();for(const row of unique){if(row.datePrecision!=='exact'||!Number.isFinite(Date.parse(row.watchedAt)))continue;const year=new Date(row.watchedAt).getFullYear();if(!groups.has(year))groups.set(year,[]);groups.get(year).push(row);}
 return {origin:'backup',totals:stats(unique),years:[...groups].sort((a,b)=>b[0]-a[0]).map(([year,rows])=>({...stats(rows),year}))};
}
export function mountBackup(element,{storage,bridge,toast,onRestore}){
 if(!element)return;
 element.innerHTML='<h2>Seu backup</h2><p>Guarde catálogo, listas, notas, preferências e histórico disponível. Os logins ficam no aparelho.</p><div class="actions"><button class="primary" id="backup-export">Salvar backup</button><button class="secondary" id="backup-import">Restaurar arquivo</button></div><input id="backup-file" type="file" accept="application/json,.json" hidden><div id="backup-preview"></div><div id="backup-archive"></div>';
 element.querySelector('#backup-export').onclick=()=>{try{storage.sync();if(bridge?.exportBackup)bridge.exportBackup();else downloadJson(buildBackup(storage));}catch(error){toast(error.message);}};
 const preview=raw=>{try{const value=validateBackup(raw),target=element.querySelector('#backup-preview');target.innerHTML='<p class="notice"></p><button class="secondary" id="backup-apply">Mesclar este backup</button>';target.querySelector('p').textContent=`${value.data['cena.local.items.v1']?.length||0} títulos e ${value.history?.events.length||0} registros de histórico. Seus dados atuais prevalecem em conflitos. O histórico restaurado fica separado da sincronização.`;target.querySelector('button').onclick=()=>{try{mergeBackup(storage,value);toast('Backup restaurado. Suas conexões foram mantidas.');onRestore();}catch(error){toast(error.message);}};}catch(error){toast(error.message);}};
 window.CenaBackupFile=preview;
 element.querySelector('#backup-import').onclick=()=>bridge?.pickBackup?bridge.pickBackup():element.querySelector('#backup-file').click();
 element.querySelector('#backup-file').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>24*1024*1024)throw Error('Arquivo maior que 24 MB.');preview(JSON.parse(await file.text()));}catch(error){toast(error.message);}};
 const archives=JSON.parse(storage.getItem('cena.history.archive.v1')||'{}'),target=element.querySelector('#backup-archive');
 if(Object.keys(archives).length){
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Consultar histórico restaurado';details.append(summary);target.append(details);
  const account=document.createElement('select');account.setAttribute('aria-label','Conta do histórico restaurado');for(const name of Object.keys(archives)){const option=document.createElement('option');option.value=name;option.textContent=name;account.append(option);}details.append(account);
  const select=document.createElement('select');select.setAttribute('aria-label','Ano do histórico restaurado');details.append(select);const list=document.createElement('div'),recap=document.createElement('div');details.append(list,recap);let page=0;
  const records=()=>archives[account.value]?.events||[];
  const draw=()=>{const selected=select.value,rows=records().filter(row=>selected==='Todos os anos'||selected==='Data desconhecida'&&row.datePrecision!=='exact'||String(new Date(row.watchedAt).getFullYear())===selected).sort((a,b)=>(Date.parse(b.watchedAt)||0)-(Date.parse(a.watchedAt)||0));list.replaceChildren();const count=document.createElement('p');count.textContent=`${rows.length} registros restaurados. Não são enviados ao Trakt ou Nuvio.`;list.append(count);for(const row of rows.slice(0,(page+1)*50)){const p=document.createElement('p');p.className='archive-row';p.textContent=`${row.name}${row.kind==='episode'?` · T${row.season} E${row.episode}`:''} · ${row.datePrecision==='exact'&&Number.isFinite(Date.parse(row.watchedAt))?new Date(row.watchedAt).toLocaleString('pt-BR'):'Data desconhecida'}`;list.append(p);}if(rows.length>(page+1)*50){const more=document.createElement('button');more.className='secondary';more.textContent='Mais registros';more.onclick=()=>{page++;draw();};list.append(more);}};
  const changeAccount=()=>{page=0;select.replaceChildren();const years=archiveSummary(records()).years.map(row=>row.year);for(const year of ['Todos os anos',...years,'Data desconhecida']){const option=document.createElement('option');option.textContent=String(year);select.append(option);}draw();mountRetrospective(recap,{state:archiveSummary(records()),bridge,toast,prefix:'archive-recap'});};
  account.onchange=changeAccount;select.onchange=()=>{page=0;draw();};changeAccount();
 }
}
