const clean=x=>typeof x==='string'?x.trim().slice(0,160):'';
const norm=x=>clean(x).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const list=x=>Array.isArray(x)?[...new Set(x.map(clean).filter(Boolean))].slice(0,24):[];
export function promotionalCoverText(text){
 const value=norm(text);
 return /\b(nomeac\w*|indicac\w*|nominations?|awards?|starring|apresenta|distribui\w*|copyright)\b/.test(value)||/\b(globos? de ouro|golden globes?|academy awards|melhor (filme|ator|atriz)|nos cinemas|em (dvd|blu ray)|um filme (de|que)|do realizador|do diretor|from the director|produced by|directed by)\b/.test(value);
}
export function parseCoverReading(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 return {title:clean(value.title),subtitle:clean(value.subtitle),cast:list(value.cast),awards:list(value.awards),taglines:list(value.taglines),other:list(value.other)};
}
export function geometricCoverReading(regions){
 if(!Array.isArray(regions))return null;
 const boxes=regions.slice(0,100).filter(x=>x&&clean(x.text)&&[x.x,x.y,x.width,x.height].every(Number.isFinite)&&x.width>0&&x.height>0&&!promotionalCoverText(x.text));
 const anchor=boxes.slice().sort((a,b)=>b.height-a.height)[0];if(!anchor)return null;
 const group=boxes.filter(box=>{
  const overlap=Math.max(0,Math.min(box.x+box.width,anchor.x+anchor.width)-Math.max(box.x,anchor.x))/Math.min(box.width,anchor.width);
  const connector=/^(a|o|ao|a0|de|da|do|as|os|the|of|and)$/i.test(clean(box.text));
  return overlap>.35&&Math.abs(box.y+box.height/2-anchor.y-anchor.height/2)<=anchor.height*3&&box.height>=anchor.height*(connector ? .22 : .5);
 }).sort((a,b)=>a.y-b.y||a.x-b.x);
 const title=group.map(x=>clean(x.text)).join(' ').trim();
 if(!title||title.length>150)return null;
 return {title,subtitle:'',cast:[],awards:regions.filter(x=>promotionalCoverText(x?.text)).map(x=>clean(x.text)).slice(0,12),taglines:[],other:[],source:'layout'};
}
export function prepareCoverReading(hints={},lines=[],layout=null){
 const explicit=parseCoverReading(hints.reading),local=parseCoverReading(layout),visible=list(hints.visibleText),raw=list(lines);
 const roles=explicit||local,excluded=[...(roles?.cast||[]),...(roles?.awards||[]),...(roles?.taglines||[]),...(roles?.other||[])].map(norm);
 const valid=text=>Boolean(clean(text))&&!promotionalCoverText(text)&&!excluded.includes(norm(text));
 const suggestions=(Array.isArray(hints.titles)?hints.titles:[]).filter(x=>x&&valid(x.title));
 const literal=suggestions.find(x=>[...visible,...raw].some(text=>norm(text)===norm(x.title))||norm(visible.join(' ')).includes(norm(x.title)));
 const preferred=[explicit?.title,local?.title,literal?.title].find(valid)||'';
 const subtitle=valid(explicit?.subtitle||local?.subtitle)?explicit?.subtitle||local?.subtitle:'';
 const title=preferred&&subtitle&&!norm(preferred).includes(norm(subtitle))?preferred+' '+subtitle:preferred;
 const evidence=title?[title]:[...visible,...raw].filter(valid);
 return {title,evidence,titles:suggestions,reading:explicit||local,classified:Boolean(explicit?.title||local?.title)};
}
