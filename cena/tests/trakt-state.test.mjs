import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTraktState, traktItemLabel } from '../web/trakt-state.js';
const movie={id:'tt14846026',type:'movie',name:'Sisu',status:'watchlist'};
const state={connected:true,lastSync:1700000000000,pending:[],watchlist:[],watched:[{id:movie.id,type:'movie',watchedAt:'2026-11-01T12:00:00Z'}]};
test('a completed movie reported by Trakt gains the watched check on the local list',()=>{
  const [item]=applyTraktState([movie],state);
  assert.equal(item.status,'watched');assert.equal(item.watchedSource,'Trakt');assert.equal(item.watchedAt,state.watched[0].watchedAt);
});
test('an offline rewatch action is not overwritten by an older remote watched snapshot',()=>{
  const [item]=applyTraktState([movie],{...state,pending:[{id:movie.id,type:'movie',action:'add'}]});
  assert.equal(item.status,'watchlist');assert.match(traktItemLabel(item,{...state,pending:[movie]}),/Aguardando/);
});
test('watchlist removal alone does not invent a watched event and new remote items are imported',()=>{
  assert.equal(applyTraktState([movie],{...state,watched:[]})[0].status,'watchlist');
  const [item]=applyTraktState([],{...state,watched:[],watchlist:[{...movie,year:'2022'}]});
  assert.equal(item.id,movie.id);assert.equal(item.status,'watchlist');
});
test('series progress never checks off the whole series after one episode',()=>{
  const show={id:'tt0944947',type:'series',name:'Game of Thrones',status:'watchlist'};
  const [item]=applyTraktState([show],{...state,progress:[{...show,episodes:1}]});
  assert.equal(item.status,'watchlist');assert.equal(item.watchedEpisodes,1);
});
test('a disconnected account cannot apply its old remote snapshot',()=>{
  assert.equal(applyTraktState([movie],{...state,connected:false})[0].status,'watchlist');
});

test('a successful rewatch write is protected from a stale history snapshot until the next pull',()=>{
  const [item]=applyTraktState([movie],{...state,synced:[{...movie,action:'add',at:state.lastSync+1}]});
  assert.equal(item.status,'watchlist');
});
test('a title re-added to the remote watchlist becomes planned again instead of staying checked',()=>{
  const [item]=applyTraktState([{...movie,status:'watched',watchedSource:'Trakt'}],{...state,watchlist:[movie]});
  assert.equal(item.status,'watchlist');assert.equal(item.watchedSource,undefined);
});
