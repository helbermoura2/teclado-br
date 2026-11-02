import assert from 'node:assert/strict';
import {SimilarEngine} from '../web/similar.js';
const seed={id:'tt1335975',type:'movie',name:'47 Ronin',year:'2013'};
const result=await new SimilarEngine().find(seed);
assert.equal(result.items.length,5,'47 Ronin must have five actual catalog suggestions');
assert.equal(new Set(result.items.map(item=>item.id)).size,5);
assert(result.items.every(item=>item.id!==seed.id&&item.type==='movie'&&item.name&&item.recommendationReason));
console.log(JSON.stringify(result.items.map(({id,name,recommendationReason})=>({id,name,reason:recommendationReason})),null,2));
