import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLocalAI} from '../web/local-ai.js';
test('local AI bridge rejects unavailable models and cancels pending requests without accepting late results',async()=>{
 let id,cancelled=0;const ai=createLocalAI({bridge:{generateLocalAi:(value)=>{id=value;},cancelLocalAi:()=>cancelled++}});
 await assert.rejects(ai.generate('x'),/Selecione/);ai.update({configured:true,supported:true});const pending=ai.generate('prompt');ai.cancel();await assert.rejects(pending,/cancelada/);assert.equal(cancelled,1);ai.receive({requestId:id,status:'ok',text:'late'});
 const next=ai.generate('prompt');ai.receive({requestId:String(Number(id)-1),status:'ok',text:'stale'});ai.receive({requestId:id,status:'ok',text:'valid'});assert.equal(await next,'valid');
});
