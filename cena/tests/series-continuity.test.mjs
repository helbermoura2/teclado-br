import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seriesUniverse,nextEpisodeEntries,combineContinuity,traktPausedEntries} from '../web/series-continuity.js';
import {visibleResume,homeSeries} from '../web/home-feed.js';
import {deriveNuvioSeries,NuvioSeriesEngine} from '../web/nuvio-series.js';
const id='tt1234567',pacific='tt0374463';
const at='2026-11-04T00:00:00Z';
const trakt={connected:true,account:'account-a',progress:[{id,type:'series',name:'Verônica com K',episodes:4,watchedAt:at},{id:pacific,type:'series',name:'The Pacific',episodes:3,watchedAt:at}]};
const state={connected:true,account:'account-a',items:[{id,name:'Verônica com K',checkedAt:1,completed:4,available:4,historyKey:at+':4',next:{season:1,number:5}},{id:pacific,name:'The Pacific',checkedAt:1,completed:3,available:7,historyKey:at+':3',next:{season:1,number:4}}]};
test('started shows outside the local library appear as exact next episodes even with Nuvio active',()=>{
 const local=[];const cards=nextEpisodeEntries(local,state,trakt,{active:true,scope:'profile-a',series:[]});assert.equal(cards.length,2);assert.match(cards[0].label,/T1 · E5/);assert.match(cards[1].label,/T1 · E4/);assert.ok(cards.every(row=>row.source==='Trakt'));assert.equal(local.length,0);assert.equal(seriesUniverse(local,trakt,{}).length,2);assert.equal(visibleResume(cards).length,2);
});
test('a changed watch count never presents the old cached next episode as current',()=>{
 const changed={...trakt,progress:[{...trakt.progress[0],episodes:5,watchedAt:'2026-11-04T01:00:00Z'}]};const rows=nextEpisodeEntries([],state,changed,{});assert.equal(rows[0].kind,'pending');assert.doesNotMatch(rows[0].label,/T1 · E5/);const other=nextEpisodeEntries([],{...state,account:'account-b'},trakt,{});assert.ok(other.every(row=>row.kind==='pending'));
});
test('paused playback and next episodes remain distinct and exactly matching episodes are not duplicated',()=>{
 const paused=traktPausedEntries({...trakt,paused:[{id,type:'series',name:'Verônica com K',season:1,episode:5,percent:42,pausedAt:at}]});assert.equal(paused[0].source,'Trakt');assert.equal(visibleResume(paused).length,1);const rows=combineContinuity(paused,nextEpisodeEntries([],state,trakt,{}));assert.equal(rows.filter(row=>row.item.id===id).length,1);assert.equal(rows.find(row=>row.item.id===pacific).kind,'next');assert.equal(rows[0].source,'Trakt');assert.equal(traktPausedEntries({...trakt,connected:false}).length,0);
});
test('Nuvio derives the next known unwatched episode from exact episode keys, not count plus one',()=>{
 const videos=Array.from({length:8},(_,i)=>({season:1,episode:i+1,title:'Ep '+(i+1),released:'2025-01-01T00:00:00Z'}));const row=deriveNuvioSeries({id,name:'Verônica',seen:['1:1','1:2','1:3','1:4']},videos);assert.equal(row.next.number,5);assert.equal(row.available,4);const gap=deriveNuvioSeries({id,seen:['1:1','1:3','1:4','1:5']},videos);assert.equal(gap.next.number,2);assert.equal(gap.observed,4);const noDates=deriveNuvioSeries({id,seen:['1:1']},[{season:1,episode:2}]);assert.deepEqual(noDates.next,{});assert.equal(noDates.coverage,'partial');
});
test('future or caught-up episodes do not become playable continuation cards',()=>{
 const row=deriveNuvioSeries({id,seen:['1:1']},[{season:1,episode:1,released:'2025-01-01'},{season:1,episode:2,released:'2099-01-01'}]);assert.equal(row.available,0);const cards=nextEpisodeEntries([],{items:[]},{},{active:true,scope:'a',series:[{id,name:'Série',episodes:1,seen:['1:1']}]},[row]);assert.equal(cards.length,0);
});
test('public Nuvio episode metadata is verified by ID/type and stale replies cannot publish another profile',async()=>{
 const replies=[];const engine=new NuvioSeriesEngine({fetcher:async()=>({ok:true,json:async()=>({meta:{id:'tt9999999',type:'series',videos:[{season:1,episode:1,released:'2025-01-01'}]}})})});await engine.refresh({series:[{id,episodes:4,seen:['1:1']}]},{onRow:row=>replies.push(row)});assert.equal(replies[0].checkedAt,0);assert.ok(replies[0].error);replies.length=0;await engine.refresh({series:[{id,seen:['1:1']}]},{isCurrent:()=>false,onRow:row=>replies.push(row)});assert.equal(replies.length,0);
});
test('home series keep source labels without adding Nuvio and Trakt counts',()=>{
 const direct=deriveNuvioSeries({id,name:'Verônica',seen:['1:1']},[{season:1,episode:1,released:'2025-01-01'},{season:1,episode:2,released:'2025-01-01'}]);const cards=homeSeries([],state,{active:true,series:[{id,episodes:1,seen:['1:1']}]},{trakt,nuvioRows:[direct]});const card=cards.find(row=>row.item.id===id);assert.equal(card.state.completed,1);assert.equal(card.source,'Nuvio');assert.equal(card.state.available,1);
});

test('matching targets share one card while different next episodes keep their source identities',()=>{
 const one={kind:'next',source:'Trakt',scope:'trakt:a',item:{id,type:'series'},row:{season:1,episode:5,lastWatched:1},label:'Próximo T1 E5'};
 const same={...one,source:'Nuvio',scope:'nuvio:b'};const merged=combineContinuity([],[one,same]);assert.equal(merged.length,1);assert.equal(merged[0].also[0].source,'Nuvio');assert.equal(merged[0].source,'Trakt');const disagreement=combineContinuity([],[one,{...same,row:{season:1,episode:4,lastWatched:2}}]);assert.equal(disagreement.length,2);
});

test('a fresh Nuvio watch list invalidates its previously calculated next episode immediately',()=>{
 const videos=Array.from({length:8},(_,i)=>({season:1,episode:i+1,released:'2025-01-01'}));const old=deriveNuvioSeries({id,seen:['1:1','1:2','1:3','1:4']},videos);const state={active:true,scope:'a',series:[{id,name:'Verônica',episodes:5,seen:['1:1','1:2','1:3','1:4','1:5']}]};const rows=nextEpisodeEntries([],{},{},state,[old]);assert.equal(rows[0].kind,'pending');assert.doesNotMatch(rows[0].label,/E5/);
});
