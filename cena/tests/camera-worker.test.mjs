import {test} from 'node:test';import assert from 'node:assert/strict';import {createWorker} from '../cloudflare/worker.mjs';
const env={CENA_AI_ACCESS_TOKEN:'fixture-token',GEMINI_API_KEY:'fake-provider-key',GEMINI_MODEL:'gemini-3.5-flash-lite'};
const request=(path,body,auth=true)=>new Request('https://cena.invalid'+path,{method:'POST',headers:{Origin:'https://appassets.androidplatform.net','Content-Type':'application/json',...(auth?{Authorization:'Bearer '+env.CENA_AI_ACCESS_TOKEN}:{})},body:JSON.stringify(body)});
const vision={image:{mimeType:'image/jpeg',data:'/9j/2Q=='},lines:['HROSHIN 0 UT OF THE A SHES']};
test('camera Worker sends a bounded JPEG to Gemini and returns title hints without fabricated IMDb IDs',async()=>{
 let upstream;const worker=createWorker(async(url,options)=>{upstream={url,options};return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({titles:[{title:'Hiroshima: Out of the Ashes',year:'1990',type:'movie',id:'tt-invented'}],visibleText:['HIROSHIMA','OUT OF THE ASHES'],uncertain:false})}]}}]});});
 const response=await worker.fetch(request('/api/ai/identify-cover',vision),env);assert.equal(response.status,200);const result=await response.json();assert.equal(result.titles[0].title,'Hiroshima: Out of the Ashes');assert.equal(result.titles[0].id,undefined);assert.ok(!JSON.stringify(result).includes(env.GEMINI_API_KEY));assert.ok(JSON.parse(upstream.options.body).contents[0].parts.some(x=>x.inlineData?.mimeType==='image/jpeg'));assert.ok(!upstream.options.body.includes('history'));
});
test('camera Worker refuses unauthenticated, non-JPEG and oversized requests before calling Gemini',async()=>{
 let calls=0;const worker=createWorker(async()=>{calls++;throw Error('must not call')});
 assert.equal((await worker.fetch(request('/api/ai/identify-cover',vision,false),env)).status,401);
 assert.equal((await worker.fetch(request('/api/ai/identify-cover',{image:{mimeType:'image/png',data:'bad'}}),env)).status,400);
 assert.equal((await worker.fetch(request('/api/ai/identify-cover',{image:{mimeType:'image/jpeg',data:'/9j/'+'A'.repeat(1500001)}}),env)).status,413);
 assert.equal(calls,0);
});
test('updated Worker preserves the existing recommendation endpoint and rejects invented candidate IDs',async()=>{
 let returned='tt2334879';const worker=createWorker(async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({items:[{id:returned,reason:'Mesmo tema.'}]})}]}}]}));
 const body={seed:{id:'tt0118571',type:'movie',name:'Air Force One'},candidates:[{id:'tt2334879',type:'movie',name:'White House Down'}]};
 assert.equal((await worker.fetch(request('/api/ai/similar',body),env)).status,200);returned='tt9999999';assert.equal((await worker.fetch(request('/api/ai/similar',body),env)).status,502);
});
