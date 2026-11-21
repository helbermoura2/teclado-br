import test from 'node:test';
import assert from 'node:assert/strict';
import {profileCollection,yearlyHistory,personalRatings} from '../web/profile-stats.js';
test('collection counts unique movie and series IDs and does not claim a watched series is complete',()=>{assert.deepEqual(profileCollection([{id:'tt1234567',type:'series',status:'watchlist'},{id:'tt1234567',type:'series',status:'watchlist'},{id:'tt1234567',type:'movie',status:'watched'}]),{total:2,movies:1,series:1,watchlist:1,watched:1});});
test('yearly watch statistics use viewing aggregates and exclude unknown dates',()=>{assert.deepEqual(yearlyHistory({years:[{year:2025,plays:4,estimatedMinutes:60},{year:2023,plays:2},{year:'unknown',plays:7}]}).map(x=>[x.year,x.plays]),[[2023,2],[2025,4]]);});
test('personal ratings accept zero and decimal comma but exclude missing and invalid ratings',()=>{const result=personalRatings({'movie:tt1234567':{rating:'0'},'series:tt2345678':{rating:'8,53'},'movie:tt3456789':{rating:''},'movie:tt4567890':{rating:'11'}});assert.equal(result.count,2);assert.equal(result.average,4.265);assert.equal(result.distribution[9].count,1);});
