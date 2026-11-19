import {storyAvailability} from '../web/availability.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderStory,storyOpinion,wrapStoryText,storyLayout,parseStoryRating,cinematicStoryStyle} from '../web/story-layout.js';
import {storyMetadata} from '../web/story-metadata.js';
const context=()=>({font:'44px sans-serif',measureText(text){return{width:Array.from(text).length*(Number(this.font.match(/(\d+)px/)?.[1])||44)*.54};},createLinearGradient:()=>({addColorStop(){}}),fillRect(){},save(){},restore(){},drawImage(){},beginPath(){},roundRect(){},fill(){},stroke(){},clip(){},fillText(){},moveTo(){},lineTo(){},closePath(){}});
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
 assert.equal(canvas.width,1080);assert.equal(canvas.height,1920);assert.ok(result.titleLines.length<=2);assert.ok(result.opinionLines.length<=6);assert.ok(result.opinionBottom<storyLayout.safe.bottom);assert.equal(result.score,8.5);assert.equal(canvas.dataset.layoutVersion,'24');
 const lines=wrapStoryText(ctx,'X'.repeat(200),860,3);assert.ok(lines.length<=3);assert.ok(lines.every(line=>ctx.measureText(line).width<=860));
});
test('story composes the official watermark and availability inside the export area',()=>{
 const text=[],images=[],panels=[];
 const ctx={...context(),fillText:(label,x,y)=>text.push({label,x,y}),drawImage:(...args)=>images.push(args),roundRect:(...args)=>panels.push(args)};
 const canvas={dataset:{},getContext:()=>ctx};
 const mark={width:432,height:432},wordmark={width:265,height:45},provider={width:92,height:92};
 const rendered=renderStory(canvas,{image:{width:500,height:750},brandMark:mark,brandWordmark:wordmark,
   providerIcons:new Map([['Netflix',provider]]),title:'Peaky Blinders: O Homem Imortal',caption:'Quero assistir 🍿',rating:'8. 1',
   availability:['Assinatura · Netflix, Netflix Standard with Ads','Aluguel · Outro serviço','Cinema · Assisti no cinema']});
 assert.ok(images.some(([asset,,y,width])=>asset===mark&&width>=500&&y>rendered.opinionBottom));
 assert.ok(images.some(([asset,,,width])=>asset===provider&&width===44));
 assert.ok(panels.some(([, ,width])=>width===cinematicStoryStyle.streamingPanelWidth));
 assert.equal(cinematicStoryStyle.streamingPanelWidth,900);
 assert.ok(text.some(({label})=>label==='Netflix'));
 assert.ok(text.some(({label})=>label.includes('Também no plano com anúncios')));
 assert.ok(text.some(({label})=>label==='Assisti no cinema'));
 assert.ok(text.some(({label})=>label==='8,1 / 10'));
 assert.ok(text.map(({label})=>label).join(' ').includes('O Homem Imortal'));
 assert.ok(text.every(({label,y})=>y>=storyLayout.safe.top&&y<(label==='TMDB / JustWatch'?1860:1740)));
});
test('reference composition exports the personal 3,6 score, text and Netflix inside a wide glass panel',()=>{
 const labels=[],rectangles=[];
 const ctx={...context(),fillText:(label,x,y)=>labels.push({label,x,y}),roundRect:(x,y,width,height)=>rectangles.push({x,y,width,height})};
 const canvas={dataset:{},getContext:()=>ctx};
 renderStory(canvas,{image:{width:1400,height:800},title:'Peaky Blinders: O Homem Imortal',year:'2026',type:'movie',caption:'Aqui escrevo minha resenha sobre o filme.',rating:'3,6',availability:['Assinatura · Netflix, Netflix Standard with Ads']});
 assert.ok(labels.some(({label})=>label==='3,6 / 10'));
 assert.ok(labels.some(({label})=>label.includes('Peaky Blinders')));
 assert.ok(labels.some(({label})=>label==='ASSINATURA'));
 assert.ok(labels.some(({label})=>label==='Netflix'));
 assert.ok(labels.some(({label})=>label==='Também no plano com anúncios'));
 assert.ok(rectangles.some(({x,y,width,height})=>width===900&&x>=0&&y>1000&&y+height<=1750));
 assert.ok(labels.some(({label,y})=>label==='TMDB / JustWatch'&&y>=1800&&y<1860));
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
