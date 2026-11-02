import assert from 'node:assert/strict';
import {regionalArtwork} from '../web/artwork.js';
for(const [id,name] of [['tt13073252','O Sequestro do Voo 375'],['tt8646254','45 do Segundo Tempo']]){
 const poster=await regionalArtwork({id,type:'movie',name});assert.ok(poster.startsWith('https://upload.wikimedia.org/'),`No exact regional poster for ${name}`);
 const response=await fetch(poster,{signal:AbortSignal.timeout(20000)});assert.ok(response.ok,`Poster HTTP ${response.status}: ${name}`);
 const bytes=await response.arrayBuffer();assert.ok(bytes.byteLength>5000);console.log('Verified actual regional poster:',name,id,bytes.byteLength,'bytes');
}
