import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaptureMemory} from '../web/capture-memory.js';

test('a confirmed full cover title prioritizes only its matching catalog item',()=>{
 const values=new Map();
 const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 const memory=createCaptureMemory(storage);
 const film={id:'tt0099772',type:'movie'}, namesake={id:'tt0113309',type:'movie'};
 const title='Hiroshima – A Guerra da Sobrevivência';
 assert.equal(memory.remember('Hiroshima',film),false);
 assert.equal(memory.remember(title,film),true);
 const reloaded=createCaptureMemory(storage);
 assert.deepEqual(reloaded.prioritize('HIROSHIMA A GUERRA DA SOBREVIVENCIA',[namesake,film]),[film,namesake]);
 assert.deepEqual(reloaded.prioritize('Hiroshima',[namesake,film]),[namesake,film]);
 assert.deepEqual(reloaded.prioritize(title,[namesake]),[namesake]);
 reloaded.clear();
 assert.equal(memory.size(),0);
 assert.deepEqual(memory.prioritize(title,[namesake,film]),[namesake,film]);
});
