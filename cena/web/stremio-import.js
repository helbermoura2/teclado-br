import { trustedArtwork } from './artwork.js';
export const stremioKey = item => `${item.type}:${item.id}`;
export function stremioPreview(existing, rows) {
  const known=new Set(existing.map(stremioKey)), unique=new Map();
  let excluded=0;
  for(const raw of rows || []) {
    if(raw.removed!==false || raw.temp!==false || !['movie','series'].includes(raw.type)) {excluded++;continue;}
    const id=typeof(raw.id || raw._id)==='string' ? (raw.id || raw._id) : '';
    const name=typeof raw.name==='string' ? raw.name.trim().slice(0,500) : '';
    if(!id || !name) {excluded++;continue;}
    const item={id,type:raw.type,name,poster:trustedArtwork(raw.poster),year:String(raw.year || '').slice(0,4)};
    const key=stremioKey(item);
    if(unique.has(key))continue;
    unique.set(key,{...item,compatible:/^tt\d{5,12}$/.test(id),exists:known.has(key)});
  }
  const items=[...unique.values()];
  return {items,excluded,existing:items.filter(item=>item.exists).length,unsupported:items.filter(item=>!item.compatible).length,available:items.filter(item=>item.compatible&&!item.exists).length};
}
export function importStremioLibrary(existing, rows, selectedKeys, now=new Date().toISOString()) {
  const preview=stremioPreview(existing,rows), selected=new Set(selectedKeys);
  const additions=preview.items.filter(item=>item.compatible&&!item.exists&&selected.has(stremioKey(item))).map(item=>({id:item.id,type:item.type,name:item.name,originalName:item.name,year:item.year,poster:item.poster,description:'',genre:item.type==='series'?'Série':'Filme',status:'watchlist',source:'Stremio',sourceUrl:`https://www.imdb.com/title/${item.id}/`,importedFrom:'Stremio',addedAt:now}));
  if(existing.length+additions.length>2000)throw Error('Esta versão aceita até 2.000 títulos. Selecione um lote menor para importar.');
  return {items:[...existing,...additions],added:additions};
}
