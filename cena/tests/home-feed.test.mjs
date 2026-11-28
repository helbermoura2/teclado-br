import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visibleResume,oneResumePerTitle,resumeKey,titleName,homeSeries} from '../web/home-feed.js';
import {getTitleDetails} from '../web/search-public.js';
const item={id:'tt4158110',type:'series',name:'tt4158110',status:'watchlist'};
const entry=(position,duration=2400000,episode=3)=>({item,row:{position,duration,season:2,episode}});
test('resume shelves omit accidental starts without modifying history or input',()=>{
 const rows=[entry(12000),entry(60000,7200000),entry(120000),entry(NaN)];assert.deepEqual(visibleResume(rows),[rows[2]]);assert.equal(rows.length,4);
});
test('hiding is scoped to account, profile, title and episode and can be restored',()=>{
 const row=entry(600000),hidden={[resumeKey(row,'a:1')]:true};assert.equal(visibleResume([row],hidden,'a:1').length,0);assert.equal(visibleResume([row],hidden,'b:1').length,1);assert.equal(visibleResume([row,entry(600000,2400000,4)],hidden,'a:1').length,1);delete hidden[resumeKey(row,'a:1')];assert.equal(visibleResume([row],hidden,'a:1').length,1);
});
test('home never invents a next episode from a Nuvio count or renders a raw IMDb title',()=>{
 assert.doesNotMatch(titleName(item),/tt4158110/);const rows=homeSeries([{...item,nuvioWatchedEpisodes:3}],{items:[{id:item.id,available:50}]},{active:true});assert.equal(rows[0].headline,'3 episódios vistos');assert.doesNotMatch(rows[0].detail,/T\d|50/);
 const next=homeSeries([item],{items:[{id:item.id,checkedAt:Date.now(),available:1,newEpisodes:1,next:{season:2,number:4}}]},{});assert.match(next[0].detail,/T2 · E4/);
});
test('missing names are recovered only from matching IMDb and type, preserving a user title',async()=>{
 const meta={id:item.id,type:item.type,name:'Mr. Robot'};const fetcher=value=>async()=>({ok:true,json:async()=>({meta:value})});assert.equal((await getTitleDetails(item,fetcher(meta))).name,'Mr. Robot');assert.equal((await getTitleDetails(item,fetcher({...meta,id:'tt0903747'}))).name,item.name);assert.equal((await getTitleDetails(item,fetcher({...meta,type:'movie'}))).name,item.name);assert.equal((await getTitleDetails({...item,name:'Meu título'},fetcher(meta))).name,'Meu título');
});


test('continuity shows one card per series even when two providers reported different episodes',()=>{
 const item={type:'series',id:'tt17491088'};
 const row=(episode,lastWatched,kind)=>({item,kind,row:{season:3,episode,lastWatched}});
 const older=row(1,10,'next'),newer=row(2,20,'paused'),sameTime=row(3,20,'next');
 assert.deepEqual(oneResumePerTitle([older,newer,sameTime]),[newer]);
 assert.deepEqual(oneResumePerTitle([sameTime,older,newer]),[newer]);
});
