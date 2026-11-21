// Only model status and generated text cross this bridge; file URIs stay native.
export function createLocalAI({bridge,onState=()=>{}}={}){
 let state={configured:false,supported:false},serial=0,pending=null;
 const available=()=>typeof bridge?.generateLocalAi==='function';
 return {
  get state(){return state;},available,
  update(value){state=value;onState(state);},
  receive(value){if(!pending||String(value.requestId)!==pending.id)return;const request=pending;pending=null;clearTimeout(request.timer);value.status==='ok'?request.resolve(value.text):request.reject(Error(value.error||'Consulta cancelada.'));},
  cancel(){if(!pending)return;bridge?.cancelLocalAi?.();const request=pending;pending=null;clearTimeout(request.timer);request.reject(Error('Consulta cancelada. Mantive as opções do catálogo.'));},
  select(){bridge?.chooseLocalModel?.();},remove(){this.cancel();bridge?.removeLocalModel?.();},
  generate(prompt){if(!available()||!state.configured)return Promise.reject(Error('Selecione seu GGUF em Conectar → IA local.'));if(pending)return Promise.reject(Error('A IA local já está trabalhando.'));return new Promise((resolve,reject)=>{const id=String(++serial);pending={id,resolve,reject,timer:setTimeout(()=>{this.cancel();},155000)};try{bridge.generateLocalAi(id,prompt);}catch(error){clearTimeout(pending.timer);pending=null;reject(error);}});}
 };
}
