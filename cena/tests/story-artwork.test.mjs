import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadStoryPoster,receiveStoryArtwork} from '../web/story-artwork.js';
const item={id:'tt0253474',type:'movie',name:'The Pianist',poster:'https://m.media-amazon.com/images/poster.jpg'};
test('native artwork uses local JPEG pixels instead of a remote CORS image and ignores unrelated callbacks',async()=>{
  const bridge={loadStoryArtwork:(id,raw)=>{
    const request=JSON.parse(raw);assert.equal(request.id,item.id);assert.equal(request.urls[0],item.poster);assert.ok(request.urls[1].includes(item.id));
    receiveStoryArtwork({requestId:'unrelated',status:'ok',image:'data:image/jpeg;base64,AAAA'});
    receiveStoryArtwork({requestId:id,status:'ok',image:'data:image/jpeg;base64,AAAA',sourceUrl:item.poster});
  }};
  const loaded=[];const image={width:300,height:450};
  const result=await loadStoryPoster(item,{bridge,loadImage:async url=>{loaded.push(url);return image;}});
  assert.deepEqual(loaded,['data:image/jpeg;base64,AAAA']);assert.equal(result.image,image);assert.equal(result.sourceUrl,item.poster);
});
test('web export retries the exact same title at an alternate poster source after a CORS failure',async()=>{
  const calls=[];
  const result=await loadStoryPoster(item,{loadImage:async url=>{calls.push(url);if(url===item.poster)throw Error('CORS');return {width:300,height:450};}});
  assert.equal(calls.length,2);assert.equal(result.sourceUrl,`https://images.metahub.space/poster/medium/${item.id}/img`);
});
test('missing or failed export artwork is an explicit error rather than a successful empty Story',async()=>{
  await assert.rejects(loadStoryPoster(item,{loadImage:async()=>{throw Error('offline');}}),/carregar a capa/);
  await assert.rejects(loadStoryPoster({...item,id:'kitsu:123'},{loadImage:async()=>{throw Error('must not load');}}),/compatível/);
  await assert.rejects(loadStoryPoster(item,{bridge:{loadStoryArtwork:id=>receiveStoryArtwork({requestId:id,status:'unavailable'})}}),/indisponível/);
});
test('an imported title without a poster resolves its own artwork before export',async()=>{
  const result=await loadStoryPoster({...item,poster:''},{resolveArtwork:async value=>{assert.equal(value.id,item.id);return item.poster;},loadImage:async()=>({width:300,height:450})});
  assert.equal(result.sourceUrl,item.poster);
});
