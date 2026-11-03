import assert from 'node:assert/strict';
import {SimilarEngine} from '../web/similar.js';
const seed={id:'tt1335975',type:'movie',name:'47 Ronin',year:'2013'};
const result=await new SimilarEngine().find(seed);
assert(result.items.length>=3&&result.items.length<=5,'47 Ronin needs several verified thematic matches, never filler');
assert.equal(new Set(result.items.map(item=>item.id)).size,result.items.length);
assert(result.items.every(item=>item.id!==seed.id&&item.type==='movie'&&item.name&&item.recommendationReason));
console.log(JSON.stringify(result.items.map(({id,name,recommendationReason})=>({id,name,reason:recommendationReason})),null,2));

const presidential=await new SimilarEngine().find({id:'tt0118571',type:'movie',name:'Air Force One',year:'1997'},{query:'Mais ação que envolva o presidente dos EUA'});
assert(presidential.items.length>=2&&presidential.items.length<=5,'Live presidential retrieval must find multiple relevant matches');
assert(presidential.items.every(item=>item.similarEvidence.some(proof=>proof.topic==='president')));
assert(!presidential.items.some(item=>['tt1856101','tt1745960','tt0050083','tt0113277','tt1392214','tt0114369'].includes(item.id)));
console.log('Presidential action matches:',JSON.stringify(presidential.items.map(({id,name,recommendationReason})=>({id,name,reason:recommendationReason}))));
