import {historyStats} from './watch-history.js';
export function recapData(state,year){if(!/^\d{4}$/.test(String(year)))throw Error('Escolha um ano para sua retrospectiva.');const stats=historyStats(state,String(year));if(!stats.plays)throw Error('Não há registros confirmados para este ano.');return {origin:state.origin==='backup'?'backup':'Trakt',year:Number(year),movies:Number(stats.movies)||0,series:Number(stats.series)||0,episodes:Number(stats.episodes)||0,plays:Number(stats.plays)||0,minutes:Number(stats.estimatedMinutes)||0};}
const number = value => value.toLocaleString('pt-BR');
const logo = Promise.resolve().then(() => {
 if(typeof Image==='undefined')return [];
 return Promise.all(['brand-still.webp','brand-wordmark.svg'].map(src=>new Promise(resolve=>{
  const image=new Image();
  image.onload=()=>resolve(image);
  image.onerror=()=>resolve(null);
  image.src=src;
 })));
});

export async function renderRecap(canvas,data){
 const [mark,wordmark]=await logo;
 canvas.width=1080;
 canvas.height=1920;
 const ctx=canvas.getContext('2d');
 const glow=ctx.createRadialGradient(840,250,0,840,250,1050);
 glow.addColorStop(0,'#412461');
 glow.addColorStop(1,'#08070c');
 ctx.fillStyle=glow;
 ctx.fillRect(0,0,1080,1920);
 ctx.strokeStyle='#8964ad';
 ctx.lineWidth=2;
 ctx.roundRect(48,48,984,1824,40);
 ctx.stroke();
 function label(value,x,y,font,color='#f7f1ff'){
  ctx.textAlign='center';
  ctx.font=font;
  ctx.fillStyle=color;
  ctx.fillText(value,x,y);
 }

 label('MINHA MEMÓRIA DE CINEMA',540,210,'700 30px sans-serif','#d4acf9');
 label(String(data.year),540,480,'700 216px Georgia');
 const metrics=[
  [data.movies,data.movies===1?'filme diferente':'filmes diferentes'],
  [data.series,data.series===1?'série acompanhada':'séries acompanhadas'],
  [data.episodes,data.episodes===1?'episódio diferente':'episódios diferentes'],
  [data.plays,data.plays===1?'reprodução':'reproduções'],
 ];
 metrics.forEach(([value,name],index)=>{
  const x=100+(index%2)*450,y=640+Math.floor(index/2)*270;
  ctx.beginPath();
  ctx.fillStyle='#ffffff0e';
  ctx.roundRect(x,y,430,230,30);
  ctx.fill();
  label(number(value),x+215,y+115,'700 82px sans-serif');
  label(name,x+215,y+171,'30px sans-serif','#d7c3ec');
 });
 label(data.minutes?`${Math.floor(data.minutes/60)}h ${data.minutes%60}min`:'Sem duração disponível',540,1328,'700 56px sans-serif');
 if(data.minutes)label('Tempo estimado pelas durações do catálogo',540,1386,'28px sans-serif','#d7c3ec');
 label(data.origin==='backup'?'Histórico restaurado do backup':'Histórico disponível no Trakt',540,1484,'26px sans-serif','#bbb0c9');

 if(mark&&wordmark){
  ctx.globalCompositeOperation='screen';
  ctx.drawImage(mark,306,1620,110,110);
  ctx.globalCompositeOperation='source-over';
  ctx.drawImage(wordmark,430,1650,340,55);
 }else{
  label('CENA IA',540,1720,'700 56px sans-serif');
 }
}
export function mountRetrospective(element,{state,bridge,toast,prefix='recap'}){
 element.innerHTML='<h2>Sua retrospectiva</h2><p>Um card do seu ano para guardar ou compartilhar.</p><select id="recap-year" aria-label="Ano da retrospectiva"></select><div class="actions"><button class="secondary" id="recap-generate">Criar retrospectiva</button></div><div id="recap-preview"></div>';
 if(prefix!=='recap')for(const node of element.querySelectorAll('[id]'))node.id=node.id.replace('recap',prefix);
 const select=element.querySelector('select');for(const row of state.years||[]){const option=document.createElement('option');option.value=String(row.year);option.textContent=String(row.year);select.append(option);}if(!select.options.length){element.querySelector('button').disabled=true;return;}
 element.querySelector('#'+prefix+'-generate').onclick=async event=>{const generate=event.currentTarget;generate.disabled=true;try{const data=recapData(state,select.value),target=element.querySelector('#'+prefix+'-preview');target.replaceChildren();const canvas=document.createElement('canvas');canvas.className='recap-canvas';canvas.setAttribute('aria-label','Prévia da retrospectiva');await renderRecap(canvas,data);if(!target.isConnected)return;target.append(canvas);for(const [label,share]of [['Compartilhar retrospectiva',true],['Salvar imagem PNG',false]]){const button=document.createElement('button');button.className='secondary wide';button.textContent=label;button.onclick=async()=>{try{const encoded=canvas.toDataURL('image/png').split(',')[1];if(share&&bridge?.shareStory)bridge.shareStory(encoded);else if(!share&&bridge?.saveStory)bridge.saveStory(encoded);else{const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const file=new File([blob],`CENA-${data.year}.png`,{type:'image/png'});if(share&&navigator.canShare?.({files:[file]}))await navigator.share({files:[file]});else{const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}}}catch(error){if(error.name!=='AbortError')toast('Não consegui exportar a retrospectiva.');}};target.append(button);}}catch(error){toast(error.message);}finally{generate.disabled=false;}};
}
