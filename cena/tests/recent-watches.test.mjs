import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recentWatches} from '../web/recent-watches.js';
const movie={id:'tt1335975',type:'movie',name:'47 Ronin',watchedAt:Date.parse('2026-11-20T12:00:00Z')};
test('Nuvio alone populates recent films and episodes outside the saved catalog',()=>{
 const rows=recentWatches([],{connected:true,active:true,recent:[movie,{id:'tt0374463',type:'series',name:'The Pacific',season:1,episode:4,watchedAt:Date.parse('2026-11-21T12:00:00Z')}]});
 assert.equal(rows[0].episode,4);assert.equal(rows[0].kind,'episode');assert.equal(rows[1].source,'Nuvio');assert.equal(rows[1].datePrecision,'exact');
});
test('confirmed watches merge by viewing date without duplicating titles across providers or episodes',()=>{
 const trakt={id:movie.id,kind:'movie',name:movie.name,watchedAt:'2026-11-19T12:00:00Z',datePrecision:'exact'};
 const rows=recentWatches([trakt],{connected:true,active:true,recent:[movie,movie],progress:[{...movie,position:1}]});
 assert.equal(rows.length,1);assert.equal(rows[0].source,'Nuvio');assert.equal(recentWatches([],{connected:true,active:true,progress:[movie]}).length,0);
});
test('disconnect and profile reset remove Nuvio watches and unknown dates stay unknown',()=>{
 assert.deepEqual(recentWatches([],{connected:false,active:true,recent:[movie]}),[]);
 assert.deepEqual(recentWatches([],{connected:true,active:false,recent:[movie]}),[]);
 const rows=recentWatches([],{connected:true,active:true,recent:[{...movie,watchedAt:0},{id:'tt0374463',type:'series',season:1}]});
 assert.equal(rows.length,1);assert.equal(rows[0].datePrecision,'unknown');assert.equal(rows[0].watchedAt,'');
});
