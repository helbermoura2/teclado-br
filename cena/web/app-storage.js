export const managedKeys=['cena.local.items.v1','cena.story.notes.v1','cena.collections.v1','cena.feedback.v1','cena.resume.hidden.v1','cena.history.archive.v1'];
export function createAppStorage(legacy,bridge){
 const native=typeof bridge?.dataGet==='function'&&typeof bridge?.dataPut==='function';
 return {
  getItem(key){if(!native||!managedKeys.includes(key))return legacy.getItem(key);const raw=bridge.dataGet(key);if(raw==='__ERROR__')throw Error('Não consegui abrir seus dados locais.');if(raw!=='null')return raw;const old=legacy.getItem(key);if(old!==null){const reply=JSON.parse(bridge.dataPut(key,old));if(!reply.ok)throw Error('Não consegui migrar seus dados locais.');}return old;},
  setItem(key,value){if(native&&managedKeys.includes(key)){const reply=JSON.parse(bridge.dataPut(key,String(value)));if(!reply.ok)throw Error('Não consegui salvar no banco local.');}else legacy.setItem(key,String(value));},
  batch(values){if(native){const reply=JSON.parse(bridge.dataBatch(JSON.stringify(values)));if(!reply.ok)throw Error('Não consegui restaurar. Seus dados anteriores foram preservados.');}else{const previous=Object.fromEntries(Object.keys(values).map(k=>[k,legacy.getItem(k)]));try{for(const [k,v]of Object.entries(values))legacy.setItem(k,JSON.stringify(v));}catch(error){for(const [k,v]of Object.entries(previous))v===null?legacy.removeItem(k):legacy.setItem(k,v);throw error;}}},
  sync(){for(const key of managedKeys)this.getItem(key);},
 };
}
