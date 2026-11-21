import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyNuvioState,nuvioContinue} from '../web/nuvio-state.js';
import {applyTraktState} from '../web/trakt-state.js';
const movie={id:'tt1335975',type:'movie',name:'47 Ronin',status:'watchlist'},show={id:'tt0903747',type:'series',name:'Breaking Bad',status:'watchlist'};
const state={connected:true,active:true,lastSync:1000,profileId:1,scope:'account-a:1',watched:[{...movie,watchedAt:500},{...show,season:1,episode:1},{...show,season:1,episode:1},{...show,season:1,episode:2}],progress:[{...movie,position:1000,duration:2000},{...show,season:1,episode:3,position:600000,duration:2400000}]};
test('Nuvio confirms exact film IDs and unique episodes, without marking the entire series watched',()=>{
 const rows=applyNuvioState([movie,show],state);assert.equal(rows[0].status,'watched');assert.equal(rows[0].watchedSource,'Nuvio');assert.equal(rows[1].status,'watchlist');assert.equal(rows[1].nuvioWatchedEpisodes,2);
 const ignored=applyNuvioState([movie],{...state,watched:[{...movie,id:'tmdb:550'}]});assert.equal(ignored[0].status,'watchlist');
});
test('changing Nuvio profile/account restores the prior local state instead of leaking another profile history',()=>{
 const imported=applyNuvioState([movie,show],state);const changed=applyNuvioState(imported,{...state,scope:'account-b:1',lastSync:0,watched:[]});assert.equal(changed[0].status,'watchlist');assert.equal(changed[0].watchedSource,undefined);assert.equal(changed[1].nuvioWatchedEpisodes,undefined);
 assert.equal(applyNuvioState(imported,{active:false}),imported,'Disconnect retains the last local copy');
});
test('continue watching uses milliseconds, omits completed media, and never invents a next episode',()=>{
 const rows=nuvioContinue([movie,show],state);assert.equal(rows.length,1);assert.match(rows[0].label,/T1 · E3 · 10 min · 25%/);assert.equal(rows[0].item.name,'Breaking Bad');
 assert.deepEqual(nuvioContinue([movie],{...state,progress:[{...movie,position:2000,duration:2000}]}),[]);
});
test('Trakt library sync does not overwrite Nuvio watch state when the user chooses Nuvio',()=>{
 const imported=applyNuvioState([movie,show],state);const trakt={connected:true,lastSync:2000,watchlist:[movie,show],watched:[],progress:[{...show,episodes:99}]};
 const rows=applyTraktState(imported,trakt,{preserveWatchState:true});assert.equal(rows[0].status,'watched');assert.equal(rows[0].watchedSource,'Nuvio');assert.equal(rows[1].watchedEpisodes,2);
});
