import {storyAvailability} from '../web/availability.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderStory,storyOpinion,wrapStoryText,storyLayout,parseStoryRating} from '../web/story-layout.js';
import {storyMetadata} from '../web/story-metadata.js';
const context=()=>({font:'44px sans-serif',measureText(text){return{width:Array.from(text).length*(Number(this.font.match(/(\d+)px/)?.[1])||44)*.54};},createLinearGradient:()=>({addColorStop(){}}),fillRect(){},save(){},restore(){},drawImage(){},beginPath(){},roundRect(){},ellipse(){},fill(){},stroke(){},clip(){},fillText(){},moveTo(){},lineTo(){},closePath(){}});
test('personal scores including zero and decimal commas are separated from a trailing review score',()=>{
 assert.deepEqual(storyOpinion('Filme extremamente excelente, 8/10'),{opinion:'Filme extremamente excelente',score:8});
 assert.deepEqual(storyOpinion('Muito bom — 8,5/10'),{opinion:'Muito bom',score:8.5});
 assert.deepEqual(storyOpinion('Minha opinião','0'),{opinion:'Minha opinião',score:0});
 assert.equal(storyOpinion('11/10').score,null);assert.equal(storyOpinion('18/10').score,null);
 assert.equal(storyOpinion('Muito bom, 8/10','9').score,9);
 assert.equal(parseStoryRating('8.53'),8.53);assert.equal(parseStoryRating('8. 1'),8.1);assert.equal(parseStoryRating('8 , 1'),8.1);assert.equal(parseStoryRating('8 1'),null);assert.equal(parseStoryRating('8,53'),8.53);assert.equal(parseStoryRating('10.00'),10);
 assert.deepEqual(storyOpinion('Muito bom, 8.53/10'),{opinion:'Muito bom',score:8.53});
 for(const invalid of ['10.01','8.531','-1','abc','8e0'])assert.equal(parseStoryRating(invalid),null);

});
test('long titles and opinions stay inside the Instagram safe area with bounded line counts',()=>{
 const ctx=context(),canvas={dataset:{},getContext:()=>ctx};
 const result=renderStory(canvas,{title:'Um título muito longo '.repeat(15),originalTitle:'A long original title',year:'2006',type:'movie',caption:'Uma opinião completa e bastante longa '.repeat(6),rating:'8,5'});
 assert.equal(canvas.width,1080);assert.equal(canvas.height,1920);assert.ok(result.titleLines.length<=2);assert.ok(result.opinionLines.length<=6);assert.ok(result.opinionBottom<storyLayout.safe.bottom);assert.equal(result.score,8.5);assert.equal(canvas.dataset.layoutVersion,'30');
 const lines=wrapStoryText(ctx,'X'.repeat(200),860,3);assert.ok(lines.length<=3);assert.ok(lines.every(line=>ctx.measureText(line).width<=860));
});
test('Story reveals more of the artwork and preserves the gold title, fog particles, watermark and deduplicated providers',()=>{
 const text=[],images=[],particles=[];
 const ctx={...context(),fillText:(label,x,y)=>text.push({label,x,y}),drawImage:(...args)=>images.push(args),ellipse:(...args)=>particles.push(args)};
 const canvas={dataset:{},getContext:()=>ctx};
 const mark={width:432,height:432},provider={width:92,height:92};
 renderStory(canvas,{image:{width:1400,height:800},brandMark:mark,
  providerIcons:new Map([['Netflix',provider]]),title:'Peaky Blinders: O Homem Imortal',year:'2026',caption:'Aqui escrevo minha resenha.',rating:'3,6',
  availability:['Assinatura · Netflix, Netflix Standard with Ads','Aluguel · Netflix, Apple TV']});
 assert.equal(canvas.dataset.layoutVersion,'30');
 assert.ok(text.some(({label})=>label==='3,6 / 10'));
 assert.equal(text.filter(({label})=>label==='Netflix').length,1);
 assert.ok(text.some(({label})=>label==='Apple TV'));
 assert.ok(text.some(({label})=>label==='PEAKY BLINDERS'&&text.find(t=>t.label===label).y>=998));
 assert.ok(text.some(({label})=>label==='O HOMEM IMORTAL'));
 assert.ok(images.some(([asset])=>asset===mark));
 assert.ok(images.some(([asset])=>asset===provider));
 assert.ok(particles.length>0&&particles.every(([,y])=>y>=1440&&y<=1920));
 assert.ok(text.every(({y})=>y>=storyLayout.safe.top&&y<1920));
});

test('localized title comes from an exact IMDb and type match, keeping the original name and release year',async()=>{
 const item={id:'tt0405094',type:'movie',name:'The Lives of Others',originalName:'The Lives of Others'};
 const result=await storyMetadata(item,{details:async()=>({...item,year:'2006'}),search:async()=>[{...item,id:'tt9999999',name:'Wrong movie'},{...item,name:'A Vida dos Outros',localWikiTitle:'A Vida dos Outros (filme)'}]});
 assert.equal(result.title,'A Vida dos Outros');assert.equal(result.originalTitle,'The Lives of Others');assert.equal(result.year,'2006');
 const offline=await storyMetadata(item,{details:async()=>{throw Error('offline');},search:async()=>[{...item,id:'tt9999999',name:'Wrong movie'}]});assert.equal(offline.title,item.name);
});

test('Story availability includes rental when streaming, free and cinema offers compete',()=>{
 const groups={flatrate:['Netflix'],free:['Pluto TV'],ads:['Outro'],rent:['Apple TV']};
 assert.deepEqual(storyAvailability({groups},true),['Assinatura · Netflix','Aluguel · Apple TV','Cinema · Assisti no cinema']);
 assert.deepEqual(storyAvailability({groups:{flatrate:['Netflix'],rent:[]}}),['Assinatura · Netflix']);
});

test('lowered composition reserves readable services and score for long reviews and titles',()=>{
 const labels=[],icons=[],ctx={...context(),fillText:(label,x,y)=>labels.push({label,x,y}),drawImage:(...args)=>icons.push(args)};
 const canvas={dataset:{},getContext:()=>ctx};
 const result=renderStory(canvas,{image:{width:1400,height:800},title:'Uma jornada épica: a longa volta para casa',caption:'Uma aventura repleta de imagens marcantes e surpresas pelo caminho. '.repeat(4),rating:'8,35',brandMark:{width:432,height:432},availability:['Assinatura · Netflix, Prime Video, Disney+, Max, Globoplay, Claro tv+']});
 assert.ok(labels.some(row=>row.label==='8,35 / 10'&&row.y>=1350));
 assert.ok(labels.some(row=>row.label.includes('JORNADA')&&row.y>=1150));
 assert.ok(labels.every(row=>row.y>=storyLayout.safe.top&&row.y<1820));
 assert.ok(result.opinionBottom<1650);
 assert.ok(labels.some(row=>row.label.startsWith('+ ')));
});
