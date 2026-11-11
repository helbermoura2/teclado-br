import {test} from 'node:test';
import assert from 'node:assert/strict';
import {imdbScore,imdbLabel,RatingsResolver} from '../web/ratings.js';
const item={id:'tt1335975',type:'movie',name:'47 Ronin'};
const storage=()=>{const rows=new Map();return {getItem:key=>rows.get(key),setItem:(key,value)=>rows.set(key,value)};};
test('IMDb accepts only valid public scores and never labels an absent score as zero',()=>{
 assert.equal(imdbScore('8,1'),8.1);assert.equal(imdbLabel('8.1'),'★ IMDb 8,1 / 10');
 for(const invalid of [null,undefined,'N/A','',0,11,-1,true,'8<script>','8.111']){assert.equal(imdbScore(invalid),null);assert.equal(imdbLabel(invalid),'IMDb —');}
});
test('rating identity must match both IMDb ID and title type and private/personal ratings are ignored',async()=>{
 let calls=0;const resolver=new RatingsResolver({storage:storage(),fetcher:async()=>{calls++;return {ok:true,json:async()=>({meta:{...item,imdbRating:'6.2'}})};}});
 assert.equal(await resolver.resolve({...item,rating:'9.9',source:'Trakt'}),6.2);assert.equal(calls,1);
 const wrong=new RatingsResolver({fetcher:async()=>({ok:true,json:async()=>({meta:{...item,type:'series',imdbRating:'8.7'}})})});assert.equal(await wrong.resolve(item),undefined);
});
test('visible requests coalesce and valid scores survive offline while expired cache is refreshed',async()=>{
 const local=storage();let at=Date.now(),calls=0;
 const resolver=new RatingsResolver({storage:local,now:()=>at,fetcher:async()=>{calls++;return {ok:true,json:async()=>({meta:{...item,imdbRating:'6.2'}})};}});
 assert.deepEqual(await Promise.all([resolver.resolve(item),resolver.resolve(item)]),[6.2,6.2]);assert.equal(calls,1);
 const offline=new RatingsResolver({storage:local,now:()=>at,fetcher:async()=>{throw Error('offline');}});assert.equal(await offline.resolve(item),6.2);
 at+=8*86400000;assert.equal(await resolver.resolve(item),6.2);assert.equal(calls,2);
});
test('unrated responses are cached as absent and offscreen interests never waste requests',async()=>{
 let calls=0;const resolver=new RatingsResolver({storage:storage(),fetcher:async()=>{calls++;return {ok:true,json:async()=>({meta:item})};}});
 assert.equal(await resolver.resolve(item,{shouldLoad:()=>false}),undefined);assert.equal(calls,0);
 assert.equal(await resolver.resolve(item),null);assert.equal(await resolver.resolve(item),null);assert.equal(calls,1);
});
