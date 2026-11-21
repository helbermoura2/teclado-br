import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAppStorage} from '../web/app-storage.js';
import {validateBackup,mergeBackup,buildBackup} from '../web/backup.js';
import {createCollection,toggleCollection,collectionItems} from '../web/collections.js';
import {setFeedback} from '../web/feedback.js';
import {RecommendationEngine} from '../web/recommendations.js';
import {calendarEntries} from '../web/calendar.js';
import {recapData} from '../web/retrospective.js';
import {syncRows} from '../web/sync-summary.js';
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
const movie={id:'tt1335975',type:'movie',name:'47 Ronin',status:'watchlist',genres:['Action'],description:'Samurai revenge fantasy'};
const event=(id,time='2024-05-01T12:00:00Z')=>({eventId:id,name:'47 Ronin',kind:'movie',type:'movie',id:movie.id,year:2013,datePrecision:'exact',watchedAt:time});
test('native storage migrates legacy values once, then reads canonical SQL values without stale fallback',()=>{
 const legacy=memory(),sql=new Map();legacy.setItem('cena.local.items.v1',JSON.stringify([movie]));let puts=0;const bridge={dataGet:k=>sql.get(k)??'null',dataPut:(k,v)=>{puts++;sql.set(k,v);return '{"ok":true}';},dataBatch:()=>'{"ok":true}'};const storage=createAppStorage(legacy,bridge);assert.equal(JSON.parse(storage.getItem('cena.local.items.v1'))[0].id,movie.id);storage.setItem('cena.local.items.v1','[]');assert.equal(storage.getItem('cena.local.items.v1'),'[]');assert.equal(puts,2);assert.equal(JSON.parse(legacy.getItem('cena.local.items.v1')).length,1);bridge.dataGet=()=>'__ERROR__';assert.throws(()=>storage.getItem('cena.local.items.v1'),/abrir/);
});
test('backup merges safely, preserves current edits and excludes connection credentials',()=>{
 const legacy=memory(),storage=createAppStorage(legacy);storage.setItem('cena.local.items.v1',JSON.stringify([{...movie,status:'watched'}]));storage.setItem('cena.connection.v1',JSON.stringify({writeToken:'private-token'}));const backup={format:'cena-backup',version:1,data:{'cena.local.items.v1':[movie,{...movie,id:'tt0120873',name:'U.S. Marshals'}],'cena.connection.v1':{writeToken:'other-token'}},history:{format:'cena-watch-history',account:'Minha conta',events:[event('1'),event('2')]}};mergeBackup(storage,backup);mergeBackup(storage,backup);const result=buildBackup(storage);assert.equal(result.data['cena.local.items.v1'].length,2);assert.equal(result.data['cena.local.items.v1'].find(x=>x.id===movie.id).status,'watched');assert.equal(result.data['cena.history.archive.v1']['Minha conta'].events.length,2);assert.ok(!JSON.stringify(result).includes('private-token'));assert.ok(!JSON.stringify(result).includes('other-token'));assert.equal(JSON.parse(legacy.getItem('cena.connection.v1')).writeToken,'private-token');
});
test('invalid backup is rejected before any write and history never invents a watch date',()=>{
 const legacy=memory(),storage=createAppStorage(legacy);storage.setItem('cena.local.items.v1',JSON.stringify([movie]));const before=storage.getItem('cena.local.items.v1');assert.throws(()=>mergeBackup(storage,{format:'cena-backup',version:1,data:{'cena.local.items.v1':[{id:'invalid id'}]}}));assert.equal(storage.getItem('cena.local.items.v1'),before);assert.throws(()=>validateBackup({format:'cena-backup',version:1,data:{'cena.collections.v1':{test:null}}}));const result=validateBackup({format:'cena-backup',version:1,data:{},history:{format:'cena-watch-history',events:[event('1','broken')]}});assert.equal(result.history.events[0].datePrecision,'unknown');assert.equal(result.history.events[0].watchedAt,'');
});
test('personal collections retain unsaved title metadata without mutating the watchlist',()=>{
 const storage=createAppStorage(memory()),id=createCollection(storage,'Cinema de samurais');toggleCollection(storage,id,movie);assert.equal(collectionItems(storage,id,[])[0].id,movie.id);assert.equal(storage.getItem('cena.local.items.v1'),null);toggleCollection(storage,id,movie);assert.deepEqual(collectionItems(storage,id,[movie]),[]);assert.throws(()=>createCollection(storage,'Cinema de samurais'),/existe/);
});
test('explicit feedback changes recommendations and explanations identify themes instead of only broad genres',async()=>{
 const storage=createAppStorage(memory());setFeedback(storage,movie,'like');setFeedback(storage,{...movie,id:'tt0000002',name:'Rejeitado'},'dislike');const candidates=[{...movie,id:'tt0000002',name:'Rejeitado'},{...movie,id:'tt0000003',name:'Nova história samurai'},{...movie,id:'tt0000004',name:'Outra ação',description:'Car chase in a city'}];const engine=new RecommendationEngine({storage,details:async x=>x,fetcher:async()=>({ok:true,json:async()=>({metas:candidates})})});const result=await engine.recommend([]);assert.ok(!result.items.some(x=>x.id==='tt0000002'));assert.equal(result.items[0].id,'tt0000003');assert.match(result.items[0].recommendationReason,/samurais/);
});
test('calendar uses confirmed episode dates, includes stale warnings, and leaves unknown dates out',()=>{
 const now=Date.parse('2026-11-03T00:00:00Z'),item={id:'tt0903747',type:'series',name:'Série'};const row={id:item.id,checkedAt:1,next:{season:2,number:3,firstAired:'2026-11-05T12:00:00Z'}};assert.equal(calendarEntries([item],{items:[row]},{now})[0].released,false);assert.equal(calendarEntries([item],{items:[{...row,error:'offline'}]},{now})[0].stale,true);assert.deepEqual(calendarEntries([item],{items:[{...row,next:{season:2,number:4}}]},{now}),[]);
});
test('yearly retrospective uses watch-year statistics and labels time as estimated input',()=>{
 const state={years:[{year:2024,movies:3,series:1,episodes:5,plays:9,estimatedMinutes:600}]};assert.equal(recapData(state,'2024').minutes,600);assert.equal(recapData(state,'2024').movies,3);assert.throws(()=>recapData(state,'all'));assert.throws(()=>recapData(state,'2013'));
});
test('sync diagnostics distinguish pending work, errors and never-consulted sources',()=>{
 const rows=syncRows({trakt:{connected:true,pending:[{}],lastSync:123},nuvio:{active:true,lastSync:124,error:'offline'},history:{connected:true,coverage:'partial'},series:{}});assert.equal(rows[0].pending,1);assert.equal(rows.find(row=>row.name==='Reprodução · Nuvio').error,'offline');assert.match(rows.find(row=>row.name==='Histórico por ano').note,/parcial/);assert.equal(rows.find(row=>row.name==='Datas e episódios · Trakt').at,undefined);
});

test('restored history can produce an offline retrospective without mixing accounts or release years',async()=>{
 const {archiveSummary}=await import('../web/backup.js');const events=[{...event('1'),runtimeMinutes:119},{...event('2'),runtimeMinutes:119},event('3','invalid')];const state=archiveSummary(events);assert.equal(state.origin,'backup');assert.equal(state.years[0].year,2024);assert.equal(state.years[0].plays,2);assert.equal(state.years[0].movies,1);assert.equal(recapData(state,'2024').origin,'backup');assert.equal(recapData(state,'2024').minutes,238);
});
