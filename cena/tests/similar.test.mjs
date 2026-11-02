import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankSimilar,similarThemes,validateLocalSelection,buildLocalSelectionPrompt,SimilarEngine} from '../web/similar.js';
const seed={id:'tt1335975',type:'movie',name:'47 Ronin',genres:['Action','Fantasy'],description:'A band of samurai seeks revenge in Japan.'};
const candidates=Array.from({length:7},(_,i)=>({id:`tt${2000000+i}`,type:'movie',name:`Real candidate ${i}`,genres:['Action','Fantasy'],description:i<5?'Samurai in feudal Japan.':'An action adventure.',year:'2010'}));
test('a title-specific request returns five closest unique films without recommending the source itself',()=>{
 assert.deepEqual(similarThemes(seed),['samurai']);const rows=rankSimilar(seed,[seed,...candidates,candidates[0],{...candidates[0],id:'tt9999999',type:'series'}]);assert.equal(rows.length,5);assert.ok(rows.every(row=>row.type==='movie'&&row.id!==seed.id));assert.match(rows[0].recommendationReason,/samurai/);
});
test('saved titles can be excluded or explicitly included and a low personal score does not reverse an explicit similarity request',()=>{
 assert.ok(!rankSimilar(seed,candidates,{existing:[candidates[0]],includeSaved:false}).some(row=>row.id===candidates[0].id));assert.ok(rankSimilar(seed,candidates,{existing:[candidates[0]],includeSaved:true}).some(row=>row.id===candidates[0].id));assert.equal(rankSimilar({...seed,rating:'1'},candidates).length,5);
});
test('local model output must contain exactly five different IDs from verified candidates',()=>{
 const ids=candidates.slice(0,5).map(item=>item.id);assert.equal(validateLocalSelection(JSON.stringify(ids),candidates).length,5);
 assert.equal(validateLocalSelection(JSON.stringify([...ids.slice(0,4),'tt9999999']),candidates),null);assert.equal(validateLocalSelection(JSON.stringify([ids[0],...ids.slice(0,4)]),candidates),null);assert.equal(validateLocalSelection('The Last Samurai',candidates),null);assert.equal(validateLocalSelection(JSON.stringify(ids.slice(0,3)),candidates),null);assert.match(buildLocalSelectionPrompt(seed,candidates),/SOMENTE IDs/);
});
test('offline failures never invent a list of five films',async()=>{
 const engine=new SimilarEngine({details:async item=>item,fetcher:async()=>{throw Error('offline');},engine:{catalog:async()=>{throw Error('offline');}}});await assert.rejects(engine.find(seed),/consultar opções/);
});

test('specific themes never fall back to generic action films when matching films are already saved',()=>{
 const generic=['Van Helsing','The Mummy','Spider-Man','Ghostbusters','Frankenstein'].map((name,i)=>({id:`tt${8000000+i}`,name,type:'movie',genres:['Action','Fantasy'],description:'A fantasy action adventure.'}));
 const exact=candidates.slice(0,5);
 assert.equal(rankSimilar(seed,[...generic,...exact],{existing:exact,includeSaved:false}).length,0);
 assert.equal(rankSimilar(seed,[...generic,...exact],{existing:exact,includeSaved:true}).length,5);
 assert.ok(rankSimilar(seed,[...generic,exact[0]]).every(row=>row.id===exact[0].id));
 assert.deepEqual(similarThemes({name:'Outro filme',description:'Um grupo de samurais japoneses.'}),['samurai']);
});
