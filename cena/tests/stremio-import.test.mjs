import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stremioPreview,importStremioLibrary,stremioKey} from '../web/stremio-import.js';
const row=(id,type='movie',extra={})=>({id,type,name:`Title ${id}`,removed:false,temp:false,...extra});
test('only saved films and series enter preview; duplicate records and incompatible IDs stay distinct',()=>{
  const data=stremioPreview([{id:'tt0172495',type:'movie',status:'watched'}],[row('tt0172495'),row('tt0120873'),row('tt0120873'),row('kitsu:123','series'),row('tt1234567','movie',{removed:true}),row('tt2222222','movie',{temp:true}),row('other','channel')]);
  assert.equal(data.items.length,3);assert.equal(data.existing,1);assert.equal(data.available,1);assert.equal(data.unsupported,1);assert.equal(data.excluded,3);
});
test('import only selected exact IDs, preserve existing watched data and posters, and do not infer watched from Stremio presence',()=>{
  const saved={id:'tt0172495',type:'movie',name:'Gladiador',poster:'https://image.tmdb.org/old.jpg',status:'watched',watchedSource:'Trakt',addedAt:'old'};
  const rows=[row(saved.id),row('tt0120873','movie',{state:{timesWatched:4}}),row('tt0903747','series'),row('kitsu:123','series')];
  const result=importStremioLibrary([saved],rows,rows.map(stremioKey),'2026-11-02T00:00:00Z');
  assert.equal(result.items.length,3);assert.deepEqual(result.items[0],saved);assert.equal(result.added.length,2);assert.ok(result.added.every(item=>item.status==='watchlist'));
  assert.equal(result.added[0].source,'Stremio');assert.equal(result.added[0].addedAt,'2026-11-02T00:00:00Z');
  assert.equal(importStremioLibrary(result.items,rows,rows.map(stremioKey)).added.length,0);
});
test('unselected titles and unsafe artwork are never silently imported',()=>{
  const rows=[row('tt0120873','movie',{poster:'https://untrusted.example/track.jpg'}),row('tt0903747','series')];
  const result=importStremioLibrary([],rows,[stremioKey(rows[0])]);
  assert.equal(result.items.length,1);assert.equal(result.items[0].poster,'');
  assert.equal(importStremioLibrary([],rows,[]).added.length,0);
});
test('a full local catalog fails before writing or dropping existing records',()=>{
  const saved=Array.from({length:2000},(_,i)=>row(`tt${1000000+i}`));
  assert.throws(()=>importStremioLibrary(saved,[row('tt0120873')],['movie:tt0120873']),/2.000/);
  assert.equal(saved.length,2000);
});
