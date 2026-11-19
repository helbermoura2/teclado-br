import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderStory,storyOpinion,wrapStoryText,storyLayout,parseStoryRating} from '../web/story-layout.js';
import {storyMetadata} from '../web/story-metadata.js';
const context=()=>({font:'44px sans-serif',measureText(text){return{width:Array.from(text).length*(Number(this.font.match(/(\d+)px/)?.[1])||44)*.54};},createLinearGradient:()=>({addColorStop(){}}),fillRect(){},save(){},restore(){},drawImage(){},beginPath(){},roundRect(){},fill(){},stroke(){},clip(){},fillText(){},moveTo(){},lineTo(){},closePath(){}});
test('personal scores including zero and decimal commas are separated from a trailing review score',()=>{
 assert.deepEqual(storyOpinion('Filme extremamente excelente, 8/10'),{opinion:'Filme extremamente excelente',score:8});
 assert.deepEqual(storyOpinion('Muito bom — 8,5/10'),{opinion:'Muito bom',score:8.5});
 assert.deepEqual(storyOpinion('Minha opinião','0'),{opinion:'Minha opinião',score:0});
 assert.equal(storyOpinion('11/10').score,null);assert.equal(storyOpinion('18/10').score,null);
 assert.equal(storyOpinion('Muito bom, 8/10','9').score,9);
 assert.equal(parseStoryRating('8.53'),8.53);assert.equal(parseStoryRating('8,53'),8.53);assert.equal(parseStoryRating('10.00'),10);
 assert.deepEqual(storyOpinion('Muito bom, 8.53/10'),{opinion:'Muito bom',score:8.53});
 for(const invalid of ['10.01','8.531','-1','abc','8e0'])assert.equal(parseStoryRating(invalid),null);

});
test('long titles and opinions stay inside the Instagram safe area with bounded line counts',()=>{
 const ctx=context(),canvas={dataset:{},getContext:()=>ctx};
 const result=renderStory(canvas,{title:'Um título muito longo '.repeat(15),originalTitle:'A long original title',year:'2006',type:'movie',caption:'Uma opinião completa e bastante longa '.repeat(6),rating:'8,5'});
 assert.equal(canvas.width,1080);assert.equal(canvas.height,1920);assert.ok(result.titleLines.length<=2);assert.ok(result.opinionLines.length<=3);assert.ok(result.opinionBottom<storyLayout.safe.bottom);assert.equal(result.score,8.5);assert.equal(canvas.dataset.layoutVersion,'4');
 const lines=wrapStoryText(ctx,'X'.repeat(200),860,3);assert.ok(lines.length<=3);assert.ok(lines.every(line=>ctx.measureText(line).width<=860));
});
test('localized title comes from an exact IMDb and type match, keeping the original name and release year',async()=>{
 const item={id:'tt0405094',type:'movie',name:'The Lives of Others',originalName:'The Lives of Others'};
 const result=await storyMetadata(item,{details:async()=>({...item,year:'2006'}),search:async()=>[{...item,id:'tt9999999',name:'Wrong movie'},{...item,name:'A Vida dos Outros',localWikiTitle:'A Vida dos Outros (filme)'}]});
 assert.equal(result.title,'A Vida dos Outros');assert.equal(result.originalTitle,'The Lives of Others');assert.equal(result.year,'2006');
 const offline=await storyMetadata(item,{details:async()=>{throw Error('offline');},search:async()=>[{...item,id:'tt9999999',name:'Wrong movie'}]});assert.equal(offline.title,item.name);
});
