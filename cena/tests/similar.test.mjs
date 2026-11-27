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
test('local model output accepts fewer relevant IDs and rejects duplicates or foreign IDs from verified candidates',()=>{
 const ids=candidates.slice(0,5).map(item=>item.id);assert.equal(validateLocalSelection(JSON.stringify(ids),candidates).length,5);
 assert.equal(validateLocalSelection(JSON.stringify([...ids.slice(0,4),'tt9999999']),candidates),null);assert.equal(validateLocalSelection(JSON.stringify([ids[0],...ids.slice(0,4)]),candidates),null);assert.equal(validateLocalSelection('The Last Samurai',candidates),null);assert.equal(validateLocalSelection(JSON.stringify(ids.slice(0,3)),candidates).length,3);assert.match(buildLocalSelectionPrompt(seed,candidates),/SOMENTE IDs/);
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

const airForce={id:'tt0118571',type:'movie',name:'Air Force One',year:'1997',genres:['Action','Thriller'],cast:['Harrison Ford'],description:'Terrorists hijack Air Force One and hold the U.S. President and his family hostage.'};
const presidential=[
 {id:'tt2334879',name:'White House Down',description:'An armed invasion of the White House puts the president in danger.'},
 {id:'tt2302755',name:'Olympus Has Fallen',description:'A former guard rescues the U.S. President during a terrorist attack.'},
 {id:'tt3300542',name:'London Has Fallen',plot:'Mike Banning uncovers a plot to assassinate world leaders.',description:'The United States President is protected by his Secret Service agent during an attack in London.'},
 {id:'tt6189022',name:'Angel Has Fallen',description:'A U.S. Secret Service agent must uncover the attack against the president.'},
 {id:'tt2088003',name:'Big Game',description:'A teenager rescues the American president when Air Force One is shot down.'}
].map(row=>({...row,type:'movie',genres:['Action','Thriller'],year:'2015'}));
const irrelevant=[
 {id:'tt1856101',name:'Blade Runner 2049',cast:['Harrison Ford'],description:'An officer uncovers a secret and searches for a missing blade runner.'},
 {id:'tt1745960',name:'Top Gun Maverick',description:'A U.S. Navy pilot trains a group of elite pilots for a dangerous mission.'},
 {id:'tt0050083',name:'12 Angry Men',description:'A jury must decide whether a young man is guilty.'},
 {id:'tt0362227',name:'A foreign president',description:'An American actor plays the French president who fights terrorists in Paris.'}
].map(row=>({...row,type:'movie',genres:['Action','Drama']}));
test('Air Force One prefers presidential plots over actor overlap, aviation or generic action in both modes',()=>{
 const rows=rankSimilar(airForce,[...irrelevant,...presidential],{query:'Mais ação que envolva o presidente dos EUA'});assert.equal(rows.length,5);assert.ok(rows.every(row=>presidential.some(item=>item.id===row.id)));assert.ok(rows.every(row=>row.similarEvidence.some(proof=>proof.topic==='president')));assert.ok(rankSimilar(airForce,irrelevant).length===0);assert.equal(validateLocalSelection(JSON.stringify([irrelevant[0].id]),[...rows,...irrelevant],{seed:airForce,query:'presidente dos EUA'}),null);
});
test('request filters apply genres, exclusions and decades, and fewer matching titles remain fewer',()=>{
 const rows=rankSimilar(airForce,[...presidential,{...presidential[0],id:'tt9999991',genres:['Drama']}],{query:'mais ação, presidente dos EUA, anos 90'});assert.equal(rows.length,0);const one=rankSimilar(airForce,[presidential[0],...irrelevant],{query:'presidente dos EUA sem terror'});assert.equal(one.length,1);assert.equal(validateLocalSelection(JSON.stringify([one[0].id]),one,{seed:airForce,query:'presidente dos EUA'}).length,1);
});
test('retrieval searches for the request before local reranking, enriches focused candidates first and reports omitted saved matches',async()=>{
 const queries=[];const engine=new SimilarEngine({details:async item=>item,fetcher:async()=>({ok:true,json:async()=>({metas:[]})}),search:async query=>{queries.push(query);return presidential;},engine:{catalog:async()=>({items:irrelevant})}});
 const result=await engine.find(airForce,{existing:[presidential[0]],includeSaved:false,query:'mais ação com presidente dos EUA'});assert.ok(queries.includes('White House Down'));assert.equal(result.items.length,4);assert.equal(result.omitted[0].id,presidential[0].id);assert.ok(!result.items.some(item=>item.id===irrelevant[0].id));assert.ok(result.criteriaLabels.includes('presidente dos EUA'));
});
test('a foreign president in an American film is not evidence of a US president',async()=>{
 const {evidenceFor}=await import('../web/similarity-criteria.js');assert.equal(evidenceFor(irrelevant[3],'president'),'');assert.ok(evidenceFor(presidential[0],'president'));
});

test('a mismatched metadata ID cannot lend its presidential plot to another title',async()=>{
 const {getTitleDetails}=await import('../web/search-public.js');const item=irrelevant[0];const wrong=await getTitleDetails(item,async()=>({ok:true,json:async()=>({meta:{id:presidential[0].id,type:'movie',name:'Wrong identity',genres:['Action'],description:presidential[0].description}})}));assert.equal(wrong.description,item.description);assert.equal(rankSimilar(airForce,[wrong],{query:'presidente dos EUA'}).length,0);
});

test('local prompts stay compact and validation rejects a candidate omitted from the model context',()=>{
 const many=Array.from({length:10},(_,i)=>({...presidential[0],id:'tt'+(9000000+i),name:'Presidential action '.repeat(15),description:presidential[0].description+'More details. '.repeat(100)}));const prompt=buildLocalSelectionPrompt(airForce,many,'mais ação com presidente dos EUA');const shown=JSON.parse(prompt.split('Candidatos: ')[1]);assert.equal(shown.length,8);assert.ok(prompt.length<4200);assert.ok(shown.every(row=>!row.summary||!row.evidence));const outside=many.find(row=>!shown.some(candidate=>candidate.id===row.id));assert.equal(validateLocalSelection(JSON.stringify([outside.id]),many,{seed:airForce,query:'mais ação com presidente dos EUA'}),null);
});


test('Greek epics match The Odyssey while a contemporary character named Troy is not thematic evidence',()=>{
 const seed={id:'tt33764258',type:'movie',name:'The Odyssey',genres:['Action','Adventure'],description:'After the Trojan War, Odysseus faces a dangerous voyage back to Ithaca.'};
 const matches=[{id:'tt0332452',name:'Troy',description:'The assault on Troy by the united Greek forces.'},{id:'tt1253864',name:'Immortals',description:'Theseus leads the ancient Greek warriors against a ruthless king.'},{id:'tt0800320',name:'Clash of the Titans',description:'Perseus battles monsters to save Andromeda.'},{id:'tt1646987',name:'Wrath of the Titans',description:'Perseus journeys to rescue the gods.'},{id:'tt0082186',name:'Clash of the Titans',description:'Greek mythology and the quest of Perseus.'}].map(row=>({...row,type:'movie',genres:['Action','Adventure'],year:'2010'}));
 const unrelated={id:'tt28014327',type:'movie',name:'Mayday',genres:['Action'],description:'Lieutenant Troy travels to a modern city to investigate spies.'};
 const rows=rankSimilar(seed,[...matches,unrelated]);assert.equal(rows.length,5);assert.ok(rows.every(row=>row.id!==unrelated.id));
});
test('metadata enrichment reaches later thematic searches even when the first query floods the result pool',async()=>{
 const seed={id:'tt33764258',type:'movie',name:'The Odyssey',genres:['Action'],description:'Odysseus returns from the Trojan War.'};
 const flood=Array.from({length:35},(_,i)=>({id:'tt'+String(7000000+i),name:'Unrelated '+i,genres:['Action']}));
 const engine=new SimilarEngine({storage:{getItem:()=>null,setItem:()=>{}},engine:{catalog:async()=>({items:[]})},search:async()=>[],fetcher:async url=>({ok:true,json:async()=>({metas:url.includes('search=Troy')?flood:url.includes('search=Clash%20of%20the%20Titans')?[{id:'tt0800320',name:'Clash of the Titans',genres:['Action']}]:[]})}),details:async item=>item.id==='tt0800320'?{...item,description:'Perseus battles monsters in Greek mythology.'}:item});
 const result=await engine.find(seed);assert.ok(result.items.some(item=>item.id==='tt0800320'));
});

test('The Diplomat finds political series when broad search and catalog lack candidates',async()=>{
 const seed={id:'tt17491088',type:'series',name:'The Diplomat',description:'In the midst of an international crisis, Kate Wyler, a career diplomat, lands in a high-profile job.'};
 const known={tt3501074:{name:'Madam Secretary',description:'A political drama about the Secretary of State.'},tt1526318:{name:'Borgen',description:"A political drama about a prime minister's rise to power."}};
 const fetcher=async url=>{
  const id=url.match(/meta\/series\/(tt\d+)\.json$/)?.[1];
  const meta=known[id];
  return {ok:true,json:async()=>meta?{meta:{...meta,id,type:'series'}}:id?{meta:{id:'tt0000001',type:'series',name:'Wrong identity',description:known.tt1526318.description}}:{metas:[]}};
 };
 const engine=new SimilarEngine({fetcher,search:async()=>[],details:async item=>item,engine:{catalog:async()=>({items:[]})}});
 const result=await engine.find(seed);
 assert.deepEqual(result.items.map(item=>item.id),['tt3501074','tt1526318']);
 assert.ok(result.items.every(item=>item.similarEvidence.length>0));
 const focused=await engine.find(seed,{query:'diplomacia e relações internacionais'});
 assert.deepEqual(focused.items.map(item=>item.id),['tt3501074']);
});
