const DEFAULT_URL='https://cena-ia.terrestre.workers.dev';
export function createOnlineAI(storage,{fetcher=fetch}={}){
 const key='cena.online-ai.v1';
 const read=()=>{try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}};
 const origin=value=>{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Use apenas a origem HTTPS do Worker.');return url.origin;};
 const compact=x=>({id:x.id,type:x.type,name:String(x.name||'').slice(0,160),year:String(x.year||'').slice(0,4),description:String(x.plot||x.description||'').slice(0,1800)});
 const api={
 configured:()=>Boolean(read()?.url&&read()?.token),
 save(url,token){const value=String(token||'').trim();if(!value.length||value.length>512||/[\r\n]/.test(value)||value==='CENA_AI_ACCESS_TOKEN')throw Error('Copie o valor completo de CENA_AI_ACCESS_TOKEN salvo na Cloudflare, não o nome da variável.');if(/^AIza/.test(value))throw Error('Este campo usa o token do CENA. A chave Gemini fica no secret GEMINI_API_KEY da Cloudflare.');storage.setItem(key,JSON.stringify({url:origin(url),token:value}));},
 remove(){storage.setItem(key,'null');},
 async select(result,query=''){
 const config=read();if(!config?.url||!config.token)throw Error('Configure o Gemini em Perfil → IA online · Gemini.');
 if(!Array.isArray(result.candidates)||!result.candidates.length)throw Error('Não há candidatos verificados para enviar ao Gemini.');
 const candidates=result.candidates.slice(0,10);let response;
 try{response=await fetcher(origin(config.url)+'/api/ai/similar',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.token},signal:AbortSignal.timeout(35000),body:JSON.stringify({seed:compact(result.seed),candidates:candidates.map(compact),query:String(query).slice(0,200)})});}catch{throw Error('Não consegui alcançar o Worker. Confira a internet e o endereço.');}
 let data;try{data=await response.json();}catch{throw Error('O servidor não retornou uma resposta compatível com o CENA.');}
 if(!response.ok)throw Error(response.status===401?'Token recusado pelo Worker. Confira CENA_AI_ACCESS_TOKEN.':String(data.error||'Não consegui consultar o Gemini.').slice(0,500));
 const allowed=new Map(candidates.map(x=>[x.id,x])),seen=new Set();
 if(!Array.isArray(data.items)||data.items.length>5||data.items.some(x=>!x||!allowed.has(x.id)||seen.has(x.id)||!seen.add(x.id)||typeof x.reason!=='string'||!x.reason.trim()||x.reason.length>500))throw Error('Resposta incompatível com os candidatos do catálogo.');
 return data.items.map(x=>({...allowed.get(x.id),recommendationReason:x.reason,similarEvidence:[]}));
 },
 mount(target){
  const config=read();
  target.innerHTML='<h2>IA online · Gemini</h2><p>Funciona pela internet, sem instalar uma IA local.</p><p class="online-ai-status muted" role="status" aria-live="polite" tabindex="-1"></p><form><label>Endereço do Worker<input name="url" type="url" required></label><label>Token do CENA<input name="token" type="password" autocomplete="off" maxlength="512" placeholder="Cole o valor de CENA_AI_ACCESS_TOKEN"></label><p class="muted">Na Cloudflare, use o valor que você criou no secret CENA_AI_ACCESS_TOKEN. Não é sua senha nem a chave Gemini. Deixe vazio para manter um token já salvo.</p><button class="primary" type="submit">Salvar e testar Gemini</button></form><div class="actions"><button class="secondary" data-test>Testar Gemini</button><button class="secondary" data-remove>Remover conexão</button></div><p class="muted">O título, o pedido e até dez candidatos do catálogo são enviados ao Worker e ao Gemini. A API possui limites próprios.</p>';
  const status=target.querySelector('[role=status]'),url=target.querySelector('[name=url]'),token=target.querySelector('[name=token]');
  url.value=config?.url||DEFAULT_URL;
  const report=(message,state='idle')=>{status.textContent=message;status.dataset.state=state;};
  report(api.configured()?'Conexão salva. Toque em Testar Gemini para conferir.':'Gemini ainda não conectado. Cole o token do CENA e toque em Salvar e testar.');
  const saveDraft=()=>{
   const next=origin(url.value),saved=read(),value=token.value.trim();
   if(!value&&(!saved?.token||saved.url!==next))throw Error('Cole o valor completo de CENA_AI_ACCESS_TOKEN para conectar o Gemini.');
   api.save(next,value||saved.token);token.value='';
  };
  const test=async()=>{
   try{saveDraft();}catch(error){report(error.message,'error');status.focus({preventScroll:true});status.scrollIntoView({block:'center'});return;}
   const buttons=[...target.querySelectorAll('button')];buttons.forEach(button=>button.disabled=true);
   report('Conexão salva. Testando o Gemini pelo Worker…','loading');
   try{
    await api.select({seed:{id:'tt0118571',type:'movie',name:'Air Force One',description:'O presidente dos Estados Unidos enfrenta terroristas em seu avião.'},candidates:[{id:'tt2334879',type:'movie',name:'White House Down',description:'Um policial tenta proteger o presidente dos Estados Unidos durante um ataque à Casa Branca.'}]},'Ação envolvendo o presidente dos Estados Unidos');
    report('Gemini respondeu. Conexão autenticada e pronta para recomendações. Não é necessário um modelo local.','ok');
   }catch(error){report(error.message,'error');}
   finally{buttons.forEach(button=>button.disabled=false);if(status.isConnected)status.scrollIntoView({block:'nearest'});}
  };
  target.querySelector('form').onsubmit=e=>{e.preventDefault();test();};
  target.querySelector('[data-test]').onclick=test;
  target.querySelector('[data-remove]').onclick=()=>{api.remove();api.mount(target);};
 }
 };return api;
}
