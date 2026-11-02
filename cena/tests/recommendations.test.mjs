import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankRecommendations,RecommendationEngine} from '../web/recommendations.js';
import {seriesSummary} from '../web/series-view.js';
const watched={id:'tt0000001',type:'movie',name:'Meu filme policial',genres:['Crime','Drama'],cast:['Actor One'],status:'watched'};
const candidates=[{id:'tt0000002',type:'movie',name:'Crime novo',genres:['Crime','Drama'],cast:['Actor One']},{id:'tt0000003',type:'series',name:'Comédia nova',genres:['Comedy']},{...watched},{id:'tt0000002',type:'movie',name:'Duplicate',genres:['Crime']}];
test('content recommendations use watched genres and cast, exclude all saved titles, and deduplicate',()=>{
 const rows=rankRecommendations([watched],candidates);assert.equal(rows.length,2);assert.equal(rows[0].id,'tt0000002');assert.match(rows[0].recommendationReason,/comum.*Meu filme/);assert.ok(!rows.some(row=>row.id===watched.id));
});
test('a low personal rating is not interpreted as liking a watched film; IMDb ratings do not become personal preferences',()=>{
 const negative=rankRecommendations([watched],candidates,{notes:{'movie:tt0000001':{rating:'1'}}});assert.equal(negative[0].id,'tt0000003');
 const normal=rankRecommendations([{...watched,rating:'1'}],candidates);assert.equal(normal[0].id,'tt0000002');
});
test('empty tastes provide honest catalog discoveries and dismissals remain excluded',()=>{
 const rows=rankRecommendations([],candidates,{dismissed:['movie:tt0000002']});assert.ok(rows.every(row=>row.id!=='tt0000002'));assert.match(rows[0].recommendationReason,/descoberta/);
});
test('recommendation catalog is cached for twelve hours and an outage reuses the saved feed',async()=>{
 const values=new Map();let calls=0,offline=false,time=1700000000000;
 const engine=new RecommendationEngine({storage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},now:()=>time,details:async item=>item,fetcher:async url=>{calls++;if(offline)throw Error('offline');return{ok:true,json:async()=>({metas:candidates.filter(row=>url.includes('/'+row.type+'/'))})};}});
 const first=await engine.recommend([watched]);assert.ok(first.items.length);const after=calls;await engine.recommend([watched]);assert.equal(calls,after);
 offline=true;time+=13*3600000;const cached=await engine.recommend([watched]);assert.equal(cached.stale,true);assert.ok(cached.items.length);
});
test('series distinguish available episodes, future airings, unknown data and caught-up status',()=>{
 const now=Date.parse('2026-11-02T00:00:00Z');
 assert.equal(seriesSummary(null,now).state,'unknown');
 const available=seriesSummary({checkedAt:1,available:3,newEpisodes:1,next:{season:2,number:5,title:'Next'}},now);assert.equal(available.state,'new');assert.match(available.detail,/T2 · E5/);
 const future=seriesSummary({checkedAt:1,available:0,aired:10,next:{season:2,number:1,firstAired:'2026-12-01T00:00:00Z'}},now);assert.equal(future.state,'upcoming');assert.equal(future.headline,'Em dia');
 assert.equal(seriesSummary({checkedAt:1,available:0,aired:10,next:{}},now).state,'caught-up');
 assert.equal(seriesSummary({checkedAt:1,available:0,aired:0,next:{}},now).state,'unknown');
 assert.equal(seriesSummary({checkedAt:1,available:2,error:'offline',next:{}},now).state,'stale');
});
