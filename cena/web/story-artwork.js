import {trustedArtwork} from './artwork.js';
const waiting=new Map();let sequence=0;
export function receiveStoryArtwork(result){const pending=waiting.get(String(result?.requestId));if(!pending)return;waiting.delete(String(result.requestId));clearTimeout(pending.timer);result.status==='ok'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(result.image||'')?pending.resolve(result):pending.reject(Error('Capa indisponível para o Story.'));}
function requestNative(bridge,item,urls){return new Promise((resolve,reject)=>{
  const id=String(++sequence),timer=setTimeout(()=>{waiting.delete(id);reject(Error('A capa demorou para carregar. Tente novamente.'));},35000);
  waiting.set(id,{resolve,reject,timer});
  try{bridge.loadStoryArtwork(id,JSON.stringify({id:item.id,type:item.type,urls}));}catch{clearTimeout(timer);waiting.delete(id);reject(Error('Não consegui preparar a capa.'));}
});}
export function loadCanvasImage(url){return new Promise((resolve,reject)=>{
  const image=new Image();let finished=false;
  const done=(error)=>{if(finished)return;finished=true;clearTimeout(timer);image.onload=null;image.onerror=null;error?reject(error):resolve(image);};
  const timer=setTimeout(()=>{done(Error('A capa demorou para carregar.'));image.src='';},10000);
  image.crossOrigin='anonymous';image.referrerPolicy='no-referrer';
  image.onload=()=>image.naturalWidth>=60&&image.naturalHeight>=90?done():done(Error('Imagem de capa inválida.'));
  image.onerror=()=>done(Error('Não consegui usar esta capa no Story.'));image.src=url;
});}
export async function loadStoryPoster(item,{bridge,resolveArtwork,loadImage=loadCanvasImage}={}){
  if(!/^tt\d{5,12}$/.test(item?.id||'')||!['movie','series'].includes(item.type))throw Error('Não encontrei uma capa compatível para este título.');
  const urls=[];const add=value=>{const url=trustedArtwork(value);if(url&&!urls.includes(url))urls.push(url);};
  add(item.poster);
  if(!urls.length&&resolveArtwork)add(await resolveArtwork(item));
  add(`https://images.metahub.space/poster/medium/${item.id}/img`);
  if(typeof bridge?.loadStoryArtwork==='function'){
    const result=await requestNative(bridge,item,urls);return {image:await loadImage(result.image),sourceUrl:trustedArtwork(result.sourceUrl)};
  }
  for(const url of urls){try{return {image:await loadImage(url),sourceUrl:url};}catch{}}
  throw Error('Não consegui carregar a capa para o Story. Tente novamente.');
}
