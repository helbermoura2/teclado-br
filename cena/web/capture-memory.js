const key='cena.capture.confirmations.v1';
const limit=200;

function signature(text){
 const normalized=String(text||'').normalize('NFD').replace(/\p{Diacritic}/gu,'')
  .toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 return normalized.length>=12 && normalized.length<=160 && normalized.split(' ').length>=3 ? normalized : '';
}

export function createCaptureMemory(storage){
 const read=()=>{
  try{
   const rows=JSON.parse(storage.getItem(key)||'[]');
   return Array.isArray(rows)?rows.filter(row=>row&&typeof row.title==='string'&&typeof row.item==='string').slice(0,limit):[];
  }catch{return [];}
 };
 const identity=item=>item.type+':'+item.id;
 return {
  remember(text,item){
   const title=signature(text);
   if(!title||!/^tt\d{5,12}$/.test(item?.id)||!['movie','series'].includes(item.type))return false;
   storage.setItem(key,JSON.stringify([{title,item:identity(item)},...read().filter(row=>row.title!==title)].slice(0,limit)));
   return true;
  },
  prioritize(text,items){
   const title=signature(text);
   const saved=title&&read().find(row=>row.title===title);
   const preferred=saved&&items.find(item=>identity(item)===saved.item);
   return preferred?[preferred,...items.filter(item=>item!==preferred)]:items;
  },
  size:()=>read().length,
  clear:()=>storage.setItem(key,'[]'),
 };
}
