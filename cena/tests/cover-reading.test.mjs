import {test} from 'node:test';import assert from 'node:assert/strict';
import {geometricCoverReading,prepareCoverReading,promotionalCoverText} from '../web/cover-reading.js';
import {coverInput,verifyCameraTitles,coverTitlePhrase} from '../web/identify-cover.js';
const regions=[{text:'DAVID MORSE',x:280,y:30,width:180,height:30},{text:'RALPH FIENNES',x:490,y:30,width:180,height:30},{text:'GUERRA',x:280,y:180,width:400,height:100},{text:'AO',x:420,y:290,width:90,height:40},{text:'TERROR',x:280,y:350,width:400,height:100},{text:'UM FILME QUE DEVERIA RENDER UMA INDICAÇÃO AO OSCAR',x:30,y:800,width:420,height:35}];
test('dominant title layout separates actor names and review copy without title-specific rules',()=>{
 assert.equal(geometricCoverReading(regions).title,'GUERRA AO TERROR');const input=coverInput({title:'DAVID MORSE',lines:regions.map(x=>x.text),regions});assert.equal(input.query,'GUERRA AO TERROR');assert.equal(input.reading.title,input.query);
});
test('numeric film title survives award, other-film advertising and release-date text',()=>{
 const reading=prepareCoverReading({titles:[{title:'1917',year:'2019'}],visibleText:['3 NOMEAÇÕES GLOBOS DE OURO','DO REALIZADOR DE 007: SKYFALL','1917','23 JANEIRO NOS CINEMAS']},[]);
 assert.equal(reading.title,'1917');assert.equal(coverTitlePhrase(reading.evidence),'1917');assert.ok(promotionalCoverText('3 NOMEAÇÕES GLOBOS DE OURO'));assert.ok(promotionalCoverText('DO REALIZADOR DE 007: SKYFALL'));
});
test('explicit semantic reading uses cast and awards as excluded support, not search titles',()=>{
 const reading=prepareCoverReading({reading:{title:'Guerra ao Terror',subtitle:'',cast:['David Morse','Ralph Fiennes'],awards:['Indicação ao Oscar']},titles:[{title:'David Morse'},{title:'Guerra ao Terror',originalTitle:'The Hurt Locker'}],visibleText:['David Morse','GUERRA AO TERROR']},[]);assert.equal(reading.title,'Guerra ao Terror');assert.deepEqual(reading.titles.map(x=>x.title),['Guerra ao Terror']);
});
test('filmography results cannot replace the photographed title even when old Gemini suggests an actor',async()=>{
 const wanted={id:'tt0887912',type:'movie',name:'The Hurt Locker',year:'2008',aliases:['Guerra ao Terror']},wrong={id:'tt0486822',type:'movie',name:'Disturbia',cast:['David Morse'],description:'Starring David Morse'};
 const rows=await verifyCameraTitles({titles:[{title:'David Morse',type:'movie'}],visibleText:regions.map(x=>x.text),uncertain:false},['DAVID MORSE'],{reading:geometricCoverReading(regions),search:async()=>[wrong,wanted]});assert.deepEqual(rows.map(x=>x.id),[wanted.id]);
});
test('1917 is a title, not a release year, and ceremonies are not matching films',async()=>{
 const movie={id:'tt8579674',type:'movie',name:'1917',year:'2019'},ceremony={id:'tt1234567',type:'movie',name:'Globos de Ouro',year:'2025'};
 const rows=await verifyCameraTitles({reading:{title:'1917',cast:[],awards:['3 NOMEAÇÕES GLOBOS DE OURO']},titles:[{title:'1917',year:'2019',type:'movie'}],visibleText:['3 NOMEAÇÕES GLOBOS DE OURO','1917'],uncertain:false},[],{search:async()=>[ceremony,movie]});assert.deepEqual(rows.map(x=>x.id),[movie.id]);assert.equal(rows[0].year,'2019');
});

test('even a unique filmography search result cannot manufacture an actor-name title alias',async()=>{
 const {localizedCoverEvidence}=await import('../web/identify-cover.js');const movie={id:'tt0080928',type:'movie',name:'Inside Moves',releaseInfo:'1980'};
 const fetcher=async()=>({ok:true,json:async()=>({metas:[movie]})});
 const rows=await verifyCameraTitles({titles:[{title:'David Morse',type:'movie'}],visibleText:['DAVID MORSE'],uncertain:false},[],{search:async()=>[{...movie,year:'1980'}],localized:query=>localizedCoverEvidence(query,fetcher)});assert.deepEqual(rows,[]);
});

test('a short AO connector read as A0 remains between the dominant title lines',async()=>{
 const {coverSearchPhrases}=await import('../web/identify-cover.js');const boxes=regions.map(x=>x.text==='AO'?{...x,text:'A0',height:22}:x);
 assert.equal(geometricCoverReading(boxes).title,'GUERRA A0 TERROR');assert.ok(coverSearchPhrases(['GUERRA A0 TERROR']).includes('GUERRA AO TERROR'));
});
test('ordinary film titles are not discarded merely for containing a word used in award copy',()=>{
 assert.equal(promotionalCoverText('O Vencedor'),false);assert.equal(prepareCoverReading({reading:{title:'O Vencedor'},titles:[{title:'O Vencedor'}]},[]).title,'O Vencedor');assert.equal(promotionalCoverText('VENCEDOR DO OSCAR DE MELHOR FILME'),true);
});
