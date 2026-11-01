import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArtworkResolver, catalogArtwork } from '../web/artwork.js';
import { applyTraktState } from '../web/trakt-state.js';
const item={id:'tt2015381',type:'movie',name:'Guardians of the Galaxy',year:'2014',status:'watchlist',poster:''};
const poster='https://m.media-amazon.com/images/M/guardians.jpg';
const storage=()=>{const data=new Map();return {getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};};
const response=meta=>({ok:true,json:async()=>({meta})});
test('a Trakt-imported title without artwork is repaired by exact IMDb and persisted in the artwork cache',async()=>{
  const store=storage();const imported=applyTraktState([],{connected:true,lastSync:1,pending:[],watchlist:[item]})[0];
  let fetches=0;
  const resolver=new ArtworkResolver({storage:store,fetcher:async url=>{fetches++;assert.ok(url.endsWith('/movie/tt2015381.json'));return response({...item,poster});},probe:async()=>true});
  assert.equal(await resolver.resolve(imported),poster);assert.equal(fetches,1);
  const warm=new ArtworkResolver({storage:store,fetcher:async()=>{throw Error('Metadata must be cached');},probe:async()=>true});
  assert.equal(await warm.resolve(imported),poster);
});
test('a broken existing image falls back to a new provider image without changing movie identity or watched state',async()=>{
  const saved={...item,status:'watched',watchedSource:'Trakt',poster:'https://upload.wikimedia.org/wikipedia/en/broken.jpg'};
  const resolver=new ArtworkResolver({storage:storage(),fetcher:async()=>response({...item,poster}),probe:async url=>url===poster});
  assert.equal(await resolver.resolve(saved),poster);assert.equal(saved.id,item.id);assert.equal(saved.status,'watched');assert.equal(saved.watchedSource,'Trakt');
});
test('simultaneous cards for the same title share one metadata fetch and the queue respects its concurrency bound',async()=>{
  let active=0,max=0,calls=0;
  const resolver=new ArtworkResolver({storage:storage(),fetcher:async url=>{calls++;active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;const id=url.match(/(tt\d+)\.json/)[1];return response({...item,id,poster});},probe:async()=>true});
  const a=resolver.resolve(item),b=resolver.resolve(item);
  await Promise.all([a,b,...Array.from({length:5},(_,i)=>resolver.resolve({...item,id:`tt123456${i}`}))]);
  assert.equal(calls,6);assert.ok(max<=2);
});
test('unavailable providers never remove a title or fabricate a working poster',async()=>{
  const saved={...item};const resolver=new ArtworkResolver({storage:storage(),fetcher:async()=>{throw Error('offline');},probe:async()=>false});
  assert.equal(await resolver.resolve(saved),'');assert.deepEqual(saved,item);
});
test('a metadata response for a different film is rejected instead of putting the wrong poster on a card',async()=>{
  assert.equal(await catalogArtwork(item,async()=>response({...item,id:'tt0172495',poster})), '');
});
