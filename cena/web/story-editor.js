import {renderStory,parseStoryRating,constrainStoryLogo} from './story-layout.js';
import {storyMetadata} from './story-metadata.js';
import {storyAvailability} from './availability.js';
import {loadStoryPoster,loadStoryBackdrop,loadCanvasImage} from './story-artwork.js';
export function createStoryEditor({$,escape,storage,getItems,native,artworkResolver,persistArtwork,toast,wireStreaming}){
return async function story(item) {
  const items=getItems();
  $('#story-editor').innerHTML = `<div class="story"><h3>Seu Story</h3><p id="story-status" role="status" data-state="loading">Carregando a capa…</p><div class="story-preview"><canvas id="story-canvas" width="1080" height="1920" aria-label="Prévia do Story"></canvas></div><button class="secondary" id="story-logo-move" type="button" aria-expanded="false" aria-controls="story-logo-controls">Posicionar logo</button><div id="story-logo-controls" hidden><p class="muted">Toque ou arraste na prévia para mover o logo.</p><label for="story-logo-x">Horizontal</label><input id="story-logo-x" type="range" min="32" max="495"><label for="story-logo-y">Vertical</label><input id="story-logo-y" type="range" min="75" max="1580"><button class="secondary" id="story-logo-reset" type="button">Restaurar posição</button></div><p id="story-availability" data-stream-key="${escape(item.type+':'+item.id)}" class="muted" role="status"></p><label for="story-include"><input id="story-include" type="checkbox" checked> Incluir onde assistir</label><label for="story-title">Título do Story</label><input id="story-title" value="${escape(item.name)}" maxlength="180"><label for="story-rating">Sua nota (opcional, de 0 a 10)</label><input id="story-rating" inputmode="decimal" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Ex.: 8,1 ou 8.1" maxlength="12"><p id="story-rating-error" class="error" hidden>Use uma nota de 0 a 10, com até duas casas decimais.</p><label for="story-caption">Sua opinião</label><textarea rows="3" id="story-caption" maxlength="140">${items.find(saved=>saved.id===item.id)?.status === 'watched' ? 'Já assisti ✓' : 'Quero assistir 🍿'}</textarea><div class="story-export"><button class="primary wide" id="share-story" disabled>Compartilhar imagem</button><button class="secondary wide" id="save-story" disabled>Salvar imagem PNG</button></div><div class="actions"><button class="secondary" id="retry-story" hidden>Tentar carregar capa</button><button class="secondary" id="story-without-poster" hidden>Continuar sem capa</button></div><p class="muted">Escolha o Instagram no compartilhamento ou salve a imagem para publicar nos Stories.</p></div>`;
  const canvas=$('#story-canvas'),caption=$('#story-caption'),title=$('#story-title'),rating=$('#story-rating'),ratingError=$('#story-rating-error');
  let brandMark=null,brandWordmark=null,mist=null;
  const mistAsset=loadCanvasImage('story-mist.png').then(asset=>{mist=asset;}).catch(()=>{});
  const brandAssets=Promise.all(['brand-mark.png','brand-wordmark.svg'].map(src=>new Promise((resolve,reject)=>{const asset=new Image();asset.onload=()=>resolve(asset);asset.onerror=()=>reject(Error('Não consegui carregar a marca do CENA. Tente novamente.'));asset.src=src;}))).then(([mark,wordmark])=>{brandMark=mark;brandWordmark=wordmark;});
  let image=null,backdrop=null,metadata={title:item.name,originalTitle:item.originalName||'',year:item.year||''},ready=false;
  const notesKey='cena.story.notes.v1',noteId=`${item.type}:${item.id}`;
  let notes={};try{notes=JSON.parse(storage.getItem(notesKey)||'{}');}catch{}
  if(!notes||typeof notes!=='object'||Array.isArray(notes))notes={};
  if(notes[noteId]){caption.value=String(notes[noteId].caption||'').slice(0,140);rating.value=String(notes[noteId].rating??'');if(notes[noteId].title)title.value=String(notes[noteId].title).slice(0,180);}
  let logoPosition=constrainStoryLogo(notes[noteId]?.logoPosition);
  let availability=[],providerIcon=null,iconKey='';
  let editedTitle=Boolean(notes[noteId]?.title);
  const validRating=()=>rating.value.trim()===''||parseStoryRating(rating.value)!==null;
  const draw=()=>{
    renderStory(canvas,{image:image&&(backdrop||image),title:title.value.trim()||metadata.title,originalTitle:metadata.originalTitle,year:metadata.year,type:item.type,caption:caption.value,rating:rating.value,brandMark,brandWordmark,providerIcon,mist,logoPosition,availability:$('#story-include').checked?availability:[]});
    ratingError.hidden=validRating();
    if($('#share-story')){$('#share-story').disabled=!ready||!validRating();$('#save-story').disabled=!ready||!validRating();}
  };
  const remember=()=>{notes[noteId]={caption:caption.value,rating:rating.value,title:editedTitle?title.value:'',logoPosition,at:Date.now()};try{storage.setItem(notesKey,JSON.stringify(Object.fromEntries(Object.entries(notes).sort((a,b)=>(b[1].at||0)-(a[1].at||0)).slice(0,200))));}catch{}};
  caption.oninput=rating.oninput=()=>{draw();remember();};title.oninput=()=>{editedTitle=true;draw();remember();};
  const move=$('#story-logo-move'),controls=$('#story-logo-controls');
  const horizontal=$('#story-logo-x'),vertical=$('#story-logo-y');
  const setLogo=position=>{
    logoPosition=constrainStoryLogo(position);
    horizontal.value=logoPosition.x;vertical.value=logoPosition.y;
    draw();
  };
  horizontal.value=logoPosition.x;vertical.value=logoPosition.y;
  move.onclick=()=>{
    controls.hidden=!controls.hidden;
    move.setAttribute('aria-expanded',String(!controls.hidden));
    canvas.classList.toggle('story-logo-moving',!controls.hidden);
    move.textContent=controls.hidden?'Posicionar logo':'Concluir posição';
  };
  horizontal.oninput=vertical.oninput=()=>{setLogo({x:Number(horizontal.value),y:Number(vertical.value)});remember();};
  $('#story-logo-reset').onclick=()=>{setLogo();remember();};
  let pointer=null,logoFrame=0;
  const moveLogoTo=(event,savePosition=false)=>{
    const rect=canvas.getBoundingClientRect();
    const position={x:(event.clientX-rect.left)*1080/rect.width-246,y:(event.clientY-rect.top)*1920/rect.height-44};
    cancelAnimationFrame(logoFrame);
    logoFrame=requestAnimationFrame(()=>{if(canvas.isConnected){setLogo(position);if(savePosition)remember();}});
  };
  canvas.onpointerdown=event=>{
    if(controls.hidden||pointer!==null||event.button!==0)return;
    pointer=event.pointerId;canvas.setPointerCapture(pointer);moveLogoTo(event);
  };
  canvas.onpointermove=event=>{if(event.pointerId===pointer)moveLogoTo(event);};
  canvas.onpointerup=event=>{if(event.pointerId===pointer){moveLogoTo(event,true);pointer=null;}};
  canvas.onlostpointercapture=()=>{pointer=null;};
  const providerNode=$('#story-availability');
  providerNode.onCenaAvailability=(value,configured,cinemaDate)=>{
    availability=storyAvailability(value,cinemaDate);
    providerNode.textContent=availability.length?'Disponibilidade no Brasil · TMDB e JustWatch':!configured?'Conecte o TMDB em Perfil para consultar serviços.':value?'Disponibilidade não confirmada nesta consulta.':'Consultando serviços no Brasil…';
    const key=/^\/[A-Za-z0-9_.-]{1,120}\.png$/.test(value?.logo||'')&&value?.name?value.logo:'';
    if(key!==iconKey){
      iconKey=key;providerIcon=null;
      if(key)loadCanvasImage('https://image.tmdb.org/t/p/w92'+key).then(asset=>{
        if(iconKey!==key||!canvas.isConnected)return;
        providerIcon={name:String(value.name),image:asset};draw();
      }).catch(()=>{});
    }
    draw();
  };
  $('#story-include').onchange=draw;
  wireStreaming();
  storyMetadata(item).then(async value=>{
    if(!canvas.isConnected)return;
    metadata=value;if(!editedTitle)title.value=value.title;draw();
    if(!value.backdrop)return;
    backdrop=await loadStoryBackdrop(item,value.backdrop,window.CenaAndroid);
    if(backdrop&&canvas.isConnected&&image)draw();
  }).catch(()=>{});
  draw();
  const status=$('#story-status'),share=$('#share-story'),save=$('#save-story'),retry=$('#retry-story'),without=$('#story-without-poster');
  const enable=()=>{ready=true;draw();};
  const prepare=async()=>{
    ready=false;share.disabled=true;save.disabled=true;retry.hidden=true;without.hidden=true;status.dataset.state='loading';status.textContent='Carregando a capa…';
    try{
      const [result]=await Promise.all([loadStoryPoster(item,{bridge:window.CenaAndroid,resolveArtwork:value=>artworkResolver.resolve(value)}),brandAssets,mistAsset]);
      if(!canvas.isConnected)return;
      image=result.image;draw();
      // Verify exportability before offering save/share, including in web previews.
      canvas.toDataURL('image/png');canvas.dataset.posterLoaded='true';
      if(result.sourceUrl)persistArtwork(item,result.sourceUrl);
      status.dataset.state='ready';status.textContent='Capa pronta para compartilhar.';enable();
    }catch(error){
      if(!canvas.isConnected)return;
      image=null;canvas.width=1080;canvas.height=1920;draw();canvas.dataset.posterLoaded='false';
      status.dataset.state='error';status.textContent=error.message||'Não consegui preparar a capa.';retry.hidden=false;without.hidden=false;
    }
  };
  retry.onclick=prepare;
  without.onclick=async()=>{try{await Promise.all([brandAssets,mistAsset]);status.dataset.state='title-only';status.textContent='Você escolheu compartilhar apenas o título.';without.hidden=true;enable();}catch(error){status.dataset.state='error';status.textContent=error.message;}};
  Promise.all([document.fonts?.load('800 88px "Playfair Display"'),document.fonts?.load('800 62px Manrope'),document.fonts?.load('400 33px Manrope')]).then(()=>{if(canvas.isConnected)draw();}).catch(()=>{});
  prepare();
  $('#save-story').onclick = () => {
    if(save.disabled)return;
    try { if(native && typeof window.CenaAndroid.saveStory==='function') window.CenaAndroid.saveStory(canvas.toDataURL('image/png').split(',')[1]);
      else { const link=document.createElement('a'); link.href=canvas.toDataURL('image/png'); link.download='CENA-Story.png'; link.click(); }
    } catch { toast('Não consegui salvar o card. Tente outra imagem.'); }
  };
  $('#share-story').onclick = async () => {
    if(share.disabled)return;
    try {
      if (native) { window.CenaAndroid.shareStory(canvas.toDataURL('image/png').split(',')[1]); return; }
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw Error('Não foi possível gerar a imagem.');
      const file = new File([blob], 'cena-story.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: item.name });
      else { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'cena-story.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Imagem salva. Abra o Instagram para publicar.'); }
    } catch (error) { if (error.name !== 'AbortError') toast('Não foi possível compartilhar a imagem. Tente novamente.'); }
  };
  canvas.closest('.story').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth', block: 'start' });
}
}
