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
test('regional fallback matches the exact film IMDb and rejects cast portraits and landscape images',async()=>{
  const film={id:'tt8646254',type:'movie',name:'45 do Segundo Tempo'};
  const url='https://upload.wikimedia.org/wikipedia/pt/3/39/45_do_Segundo_Tempo.jpg';
  const {regionalArtwork}=await import('../web/artwork.js');
  const result=await regionalArtwork(film,async raw=>{
    if(raw.includes('wikipedia.org'))return {ok:true,json:async()=>({query:{pages:{1:{pageprops:{wikibase_item:'Q1'},thumbnail:{source:poster,width:200,height:300}},2:{pageprops:{wikibase_item:'Q2'},thumbnail:{source:url,width:221,height:328}}}}})};
    return {ok:true,json:async()=>({entities:{Q1:{claims:{P345:[{mainsnak:{datavalue:{value:'nm1234567'}}}]}},Q2:{claims:{P345:[{mainsnak:{datavalue:{value:film.id}}}]}}}})};
  });
  assert.equal(result,url);
});
test('a catalog search fallback requires exact identity, not merely a similar localized name',async()=>{
  const {searchCatalogArtwork}=await import('../web/artwork.js');
  assert.equal(await searchCatalogArtwork(item,async()=>({ok:true,json:async()=>({metas:[{id:'tt9999999',type:'movie',name:item.name,poster}]})})), '');
  assert.equal(await searchCatalogArtwork(item,async()=>({ok:true,json:async()=>({metas:[{id:item.id,type:item.type,poster}]})})),poster);
});
test('queued artwork which has scrolled out of view is skipped without a failure cooldown',async()=>{
  let calls=0;const resolver=new ArtworkResolver({storage:storage(),fetcher:async()=>{calls++;return response({...item,poster});},probe:async()=>true});
  assert.equal(await resolver.resolve(item,{shouldLoad:()=>false}),'');assert.equal(calls,0);assert.equal(resolver.failures.size,0);
  await new Promise(resolve=>setTimeout(resolve,0));assert.equal(await resolver.resolve(item),poster);assert.equal(calls,1);
});
test('a new visible card keeps a shared queued image request alive when the previous screen disappeared',async()=>{
  let release;const gate=new Promise(resolve=>release=resolve);let calls=0;
  const resolver=new ArtworkResolver({storage:storage(),concurrency:1,fetcher:async url=>{calls++;if(calls===1)await gate;return response({...item,id:url.match(/(tt\d+)\.json/)[1],poster});},probe:async()=>true});
  const first=resolver.resolve({...item,id:'tt1111111'});
  const old=resolver.resolve(item,{shouldLoad:()=>false});
  const visible=resolver.resolve(item,{shouldLoad:()=>true});release();
  const values=await Promise.all([first,old,visible]);assert.ok(values.every(value=>value===poster));assert.equal(calls,2);
});

test('contaminated Band of Brothers artwork and mismatching IMDb URLs are rejected',async()=>{
 const {titleArtwork}=await import('../web/artwork.js');const show={id:'tt0185906',type:'series',name:'Band of Brothers'};
 assert.equal(titleArtwork(show,'https://image.tmdb.org/t/p/w500/wrong.jpg'),'');
 assert.equal(titleArtwork(show,'https://images.metahub.space/poster/medium/tt9999999/img'),'');
 const correct='https://images.metahub.space/poster/medium/tt0185906/img';
 assert.equal(titleArtwork(show,correct),correct);
 const resolver=new ArtworkResolver({storage:storage(),fetcher:async()=>response({...show,poster:'https://image.tmdb.org/t/p/w500/wrong.jpg'}),probe:async()=>true});
 assert.equal(await resolver.resolve({...show,poster:'https://image.tmdb.org/t/p/w500/wrong.jpg'}),correct);
});
