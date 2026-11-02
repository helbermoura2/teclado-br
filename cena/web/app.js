import {renderStory,parseStoryRating} from './story-layout.js';
import {storyMetadata} from './story-metadata.js';
import {loadStoryPoster,receiveStoryArtwork} from './story-artwork.js';
import {createStremioPanel} from './stremio-panel.js';
import { ArtworkResolver, trustedArtwork } from './artwork.js';
import { applyTraktState, traktItemLabel } from './trakt-state.js';
import { getTitleDetails } from './search-public.js';
import { createLocalApi } from './local-api.js';
import { coverInput, identifyCover, searchTolerantTitles } from './identify-cover.js';
import { rankWithVision } from './visual-ranking.js';
const $ = selector => document.querySelector(selector);
const native = Boolean(window.CenaAndroid);
window.CenaStoryArtworkResult=receiveStoryArtwork;
const storageKey = 'cena.connection.v1';
let connection = null;
let stored = null;
try { stored = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch {}
let apiBase = stored?.apiBase || (native ? 'local' : location.origin);
const localApi = createLocalApi(localStorage, { search: searchTolerantTitles });
let items = [], tab = 'home', filter = 'watchlist', searchResults = [], config = null;
let traktState = { connected:false, configured:false, pending:[] };
let traktWasConnected = false;
let traktInitialUploadRequested = false;
let libraryReady=false, deferredTraktState=null;
let scanPhoto = '', detectedLines = [], detailItem = null, searchGeneration = 0, busy = false;
const main = $('#main');
const stremioPanel=createStremioPanel({
  bridge:window.CenaAndroid,getItems:()=>items,traktConnected:()=>Boolean(traktState.connected),toast,
  onImport:async(result,sendToTrakt)=>{
    if(apiBase!=='local'||!libraryReady)throw Error('Aguarde sua lista local carregar.');
    localStorage.setItem('cena.local.items.v1',JSON.stringify(result.items));items=result.items;
    sendTraktInventory();
    if(sendToTrakt&&typeof window.CenaAndroid?.queueTraktBatch==='function')window.CenaAndroid.queueTraktBatch(JSON.stringify(result.added.map(({id,type})=>({id,type,action:'add'}))));
  }
});
window.CenaStremioResult=state=>stremioPanel.update(state);

const artworkResolver = new ArtworkResolver({storage:localStorage});
const artworkModels = new Map();
const artworkObserved = new WeakSet();
const artworkLoading = new WeakSet();
function persistArtwork(item, url) {
  if(apiBase==='local') {
    const saved=items.find(row=>row.id===item.id && row.type===item.type);
    if(saved && saved.poster!==url) { saved.poster=url; try {localStorage.setItem('cena.local.items.v1',JSON.stringify(items));}catch{} }
  }
  for(const row of searchResults) if(row.id===item.id && row.type===item.type) row.poster=url;
  if(detailItem?.id===item.id && detailItem?.type===item.type) detailItem.poster=url;
  updateArtworkProgress();
}
async function hydrateArtwork(element) {
  if(!element.isConnected || artworkLoading.has(element))return;
  const item=artworkModels.get(element.dataset.artworkKey);if(!item)return;
  artworkLoading.add(element);
  try {
    element.dataset.artworkState='loading';
    const url=await artworkResolver.resolve(item,{shouldLoad:()=>{const rect=element.getBoundingClientRect();return element.isConnected&&rect.bottom>=-200&&rect.top<=innerHeight+200;}});
    if(!url){element.dataset.artworkState='missing';return;}
    element.dataset.artworkState='ready';
    persistArtwork(item,url);item.poster=url;
    artworkObserver?.unobserve(element);
    for(const poster of document.querySelectorAll('.poster-art[data-artwork-key]')) {
      if(poster.dataset.artworkKey!==element.dataset.artworkKey || poster.querySelector('img'))continue;
      const image=new Image();image.alt='';image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';image.src=url;
      image.onerror=()=>{image.remove();poster.dataset.artworkState='missing';delete artworkResolver.cache[artworkResolver.key(item)];persistArtwork(item,'');artworkResolver.failures.set(artworkResolver.key(item),Date.now());};
      poster.dataset.artworkState='ready';poster.insertBefore(image,poster.querySelector('.badge'));
    }
  } finally {artworkLoading.delete(element);}
}
const artworkObserver = typeof IntersectionObserver==='function' ? new IntersectionObserver(entries=>{
  for(const entry of entries) {
    if(!entry.target.isConnected){artworkObserver.unobserve(entry.target);continue;}
    if(entry.isIntersecting)hydrateArtwork(entry.target);
  }
},{rootMargin:'200px'}) : null;

function sendTraktInventory() {
  if (apiBase === 'local' && native && typeof window.CenaAndroid.traktInventory === 'function') window.CenaAndroid.traktInventory(JSON.stringify(items.map(({id,type})=>({id,type}))));
}
function sendTraktList() {
  if(native && traktState.connected && typeof window.CenaAndroid.queueTraktBatch==='function') window.CenaAndroid.queueTraktBatch(JSON.stringify(items.filter(item=>item.status==='watchlist').map(({id,type})=>({id,type,action:'add'}))));
}
function queueTrakt(item, action) {
  if (apiBase === 'local' && native && traktState.connected && typeof window.CenaAndroid.queueTrakt === 'function') window.CenaAndroid.queueTrakt(JSON.stringify({id:item.id,type:item.type,action}));
}
window.CenaTraktResult = state => {
  if(!libraryReady) { deferredTraktState=state; return; }
  if(JSON.stringify(state)===JSON.stringify(traktState)) return;
  const becameConnected = state.connected && !traktWasConnected;
  if(!state.connected) traktInitialUploadRequested=false;
  traktWasConnected = Boolean(state.connected); traktState = state;
  if(apiBase !== 'local') return;
  const merged = applyTraktState(items,state);
  const libraryChanged=JSON.stringify(merged)!==JSON.stringify(items);
  if(libraryChanged) { items=merged; localStorage.setItem('cena.local.items.v1',JSON.stringify(items)); }
  if(becameConnected) sendTraktInventory();
  if(state.connected && state.needsUpload && !traktInitialUploadRequested) { traktInitialUploadRequested=true; sendTraktList(); }
  if(tab==='connect' && !document.querySelector('#trakt-client-id:focus, #stremio-filter:focus')) localConnection();
  else if(!$('#detail').open) {
    if(tab==='library') { if(libraryChanged)patchLibrary();else updateArtworkProgress(); }
    else if(tab==='home'&&libraryChanged) {const position=window.scrollY;home();window.scrollTo(0,position);}
  }
  const label=$('#trakt-item-state'); if(label && detailItem) label.textContent=traktItemLabel(detailItem,state);
};
main.addEventListener('click', event => {
  const card = event.target.closest?.('button.poster-card[data-id]');
  if (card) showDetail([...searchResults, ...items].find(item => item.id === card.dataset.id));
});
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titleType = item => item.type === 'series' ? 'Série' : 'Filme';

function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 4000); }
async function api(route, options = {}) {
  if (apiBase === 'local') return localApi(route, options);
  if (!apiBase) throw Error('Conecte o endereço do seu servidor na aba Conectar.');
  const response = await fetch(`${apiBase}${route}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(connection ? { Authorization: `Bearer ${connection.writeToken}` } : {}), ...options.headers }, signal: AbortSignal.timeout(12000) });
  const value = await response.json();
  if (!response.ok) throw Error(value.error || 'Não foi possível conectar.');
  return value;
}
function persist() { localStorage.setItem(storageKey, JSON.stringify({ ...connection, apiBase })); }
async function ensureConnection() {
  if (connection) return;
  connection = await api('/api/libraries', { method: 'POST' });
  persist();
}
function notice() {
  if (apiBase === 'local') return `<div class="notice">${traktState.connected ? `Trakt conectado${traktState.pending?.length ? ` · ${traktState.pending.length} envio(s) pendente(s)` : ' · consulta de assistidos ativada'}` : 'Sua lista está salva neste aparelho. Conecte o Trakt para sincronizar com o Nuvio.'}</div>`;
  return config?.searchMode === 'sample' ? '<div class="notice">Prévia com 6 títulos de amostra. Busca completa disponível ao configurar o TMDB no servidor.</div>' : '';
}
function poster(item, badge = '') {
  const key=`${item.type}:${item.id}`;artworkModels.set(key,item);
  return `<div class="poster-art" data-artwork-key="${escape(key)}"><span class="fallback">${escape(item.name)}</span>${badge ? `<span class="badge">${escape(badge)}</span>` : ''}</div>`;
}
function grid(rows) { return `<div class="grid">${rows.map(item => `<button class="poster-card" data-id="${escape(item.id)}" aria-label="Ver ${escape(item.name)}">${poster(item, item.status === 'watched' ? '✓ Assistido' : item.watchedEpisodes ? `${item.watchedEpisodes} episódios vistos` : '')}<strong>${escape(item.name)}</strong><small>${escape(item.year)} · ${titleType(item)}</small></button>`).join('')}</div>`; }
function wireImages() {
  for(const element of document.querySelectorAll('.poster-art[data-artwork-key]')) {
    if(artworkObserved.has(element))continue;artworkObserved.add(element);
    if(artworkObserver)artworkObserver.observe(element);else hydrateArtwork(element);
  }
}
function wireCards(rows) {

  wireImages();
}
function empty(text = 'Sua próxima sessão começa aqui', sub = 'Busque um título ou fotografe uma capa para começar sua lista.') { return `<div class="empty"><div class="empty-icon">✧</div><h3>${text}</h3><p>${sub}</p><button class="secondary" id="empty-search">Buscar um título</button></div>`; }
function setTab(next) {
  tab = next;
  searchGeneration++;
  document.querySelectorAll('nav [data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  if (tab === 'home') home();
  if (tab === 'library') library();
  if (tab === 'scan') scan();
  if (tab === 'connect') connect();
  window.scrollTo(0, 0);
}
function home() {
  const pending = items.filter(i => i.status === 'watchlist');
  main.innerHTML = `<div class="eyebrow">SEU CINEMA, DO SEU JEITO</div><h1>O que vamos<br>assistir hoje?</h1><section class="hero"><div class="hero-content"><span class="eyebrow">DA CAPA PARA SUA LISTA</span><h2>Sua próxima<br>grande história.</h2><p class="meta">Viu uma capa que chamou sua atenção?</p><button class="primary" id="hero-scan">▣ &nbsp; Fotografar capa</button></div></section><div class="section-heading"><h2>Quero assistir</h2><button id="see-all">${pending.length ? `Ver todos · ${pending.length}` : 'Seu catálogo'}</button></div>${pending.length ? grid(pending.slice(0, 8)) : empty()}${notice()}<div class="panel"><h2>Uma lista. Seu próximo play.</h2><p>Adicione no CENA e consulte seu catálogo no player compatível.</p><button class="link-button" id="connect-shortcut">Conectar minha lista →</button></div>`;
  $('#hero-scan').onclick = () => setTab('scan'); $('#see-all').onclick = () => setTab('library');
  $('#connect-shortcut').onclick = () => setTab('connect');
  if ($('#empty-search')) $('#empty-search').onclick = () => { setTab('library'); $('#query').focus(); };
  wireCards(pending);
}
function library() {
  const rows = items.filter(i => filter === 'all' || i.status === filter);
  main.innerHTML = `<div class="eyebrow">CADA HISTÓRIA TEM SEU LUGAR</div><h1>Meu catálogo</h1><form id="search-form" class="search-row"><input id="query" type="search" placeholder="Buscar filme ou série…" aria-label="Nome do filme ou série" minlength="2" maxlength="150" required><button class="primary" type="submit">Buscar</button></form><div class="chips"><button class="chip ${filter === 'watchlist' ? 'selected' : ''}" data-filter="watchlist">Quero assistir</button><button class="chip ${filter === 'watched' ? 'selected' : ''}" data-filter="watched">Assistidos</button><button class="chip ${filter === 'all' ? 'selected' : ''}" data-filter="all">Todos</button></div><div id="search-results"></div><div class="section-heading"><h2>${filter === 'watched' ? 'Já fizeram parte da sua história' : 'Na sua lista'}</h2><div class="actions"><span class="count" id="library-count">${rows.length} títulos</span><button class="link-button" id="refresh-artwork">Atualizar capas</button></div></div><p id="artwork-progress" class="muted"></p><div id="library-grid">${rows.length ? grid(rows) : empty()}</div><div id="library-sync-notice">${notice()}</div>`;
  if($('#refresh-artwork')) $('#refresh-artwork').onclick=()=>{
    artworkResolver.retry();
    for(const element of document.querySelectorAll('.poster-art[data-artwork-key]')) {
      if(element.querySelector('img'))continue;
      const rect=element.getBoundingClientRect();if(rect.bottom>=0 && rect.top<=innerHeight+200)hydrateArtwork(element);
    }
    toast('Buscando capas. As demais carregam ao rolar a lista.');
  };
  $('#search-form').onsubmit = e => { e.preventDefault(); runSearch($('#query').value); };
  document.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { filter = button.dataset.filter; library(); });
  if ($('#empty-search')) $('#empty-search').onclick = () => $('#query').focus();
  wireCards(rows);updateArtworkProgress();
}
function updateArtworkProgress(){
  const label=$('#artwork-progress');if(!label)return;
  const rows=items.filter(i=>filter==='all'||i.status===filter),known=rows.filter(i=>trustedArtwork(i.poster)).length;
  label.textContent=`Capas salvas: ${known} de ${rows.length}. As demais carregam ao rolar.`;
}
function patchLibrary(){
  const target=$('#library-grid');if(!target)return;
  const anchors=[...target.querySelectorAll('.poster-card')].filter(card=>{const rect=card.getBoundingClientRect();return rect.bottom>0&&rect.top<innerHeight;}).map(card=>({card,top:card.getBoundingClientRect().top}));
  const position=window.scrollY,rows=items.filter(i=>filter==='all'||i.status===filter);
  const existing=new Map([...target.querySelectorAll('.poster-card')].map(card=>[card.querySelector('[data-artwork-key]')?.dataset.artworkKey,card]));
  let list=target.querySelector(':scope > .grid');
  if(!rows.length){target.innerHTML=empty();if($('#empty-search'))$('#empty-search').onclick=()=>$('#query').focus();}
  else{
    if(!list){target.innerHTML='<div class="grid"></div>';list=target.firstElementChild;}
    let next=list.firstElementChild;
    for(const row of rows){
      const key=`${row.type}:${row.id}`;let card=existing.get(key);artworkModels.set(key,row);
      if(!card){const template=document.createElement('template');template.innerHTML=grid([row]);card=template.content.querySelector('.poster-card');}
      existing.delete(key);
      const art=card.querySelector('.poster-art'),badge=row.status==='watched'?'✓ Assistido':row.watchedEpisodes?`${row.watchedEpisodes} episódios vistos`:'';
      let badgeNode=art.querySelector('.badge');
      if(badge){if(!badgeNode){badgeNode=document.createElement('span');badgeNode.className='badge';art.append(badgeNode);}badgeNode.textContent=badge;}else badgeNode?.remove();
      card.querySelector('strong').textContent=row.name;card.querySelector('.fallback').textContent=row.name;card.querySelector('small').textContent=`${row.year||''} · ${titleType(row)}`;
      if(card!==next)list.insertBefore(card,next);next=card.nextElementSibling;
    }
    for(const card of existing.values())card.remove();
  }
  const count=$('#library-count');if(count)count.textContent=`${rows.length} títulos`;
  const noticeArea=$('#library-sync-notice');if(noticeArea)noticeArea.innerHTML=notice();
  updateArtworkProgress();wireImages();
  const anchor=anchors.find(value=>value.card.isConnected);
  if(anchor)window.scrollBy(0,anchor.card.getBoundingClientRect().top-anchor.top);else window.scrollTo(0,position);
}
function refreshCurrentView(){
  if(tab==='library')patchLibrary();else if(tab==='home'){const position=window.scrollY;home();window.scrollTo(0,position);}
}
async function runSearch(query, coverLines = null) {
  const target = $('#search-results');
  if (!target) return;
  query = query.trim();
  if (query.length < 2) { toast('Digite pelo menos duas letras.'); return; }
  const generation = ++searchGeneration;
  target.innerHTML = '<div class="loading" role="status">Procurando sua próxima história…</div>';
  try {
    const response = coverLines && apiBase === 'local' ? { items: await identifyCover(coverLines), mode: 'assisted' } : await api(`/api/search?q=${encodeURIComponent(query)}`);
    if (generation !== searchGeneration || !target.isConnected) return;
    searchResults = response.items;
    if (coverLines && searchResults[0]?.matchScore >= .65 && (!searchResults[1] || searchResults[0].matchScore - searchResults[1].matchScore >= .04)) {
      const field = $('#scan-query');
      if (field) field.value = searchResults[0].originalName || searchResults[0].name;
    }
    const assisted = searchResults.some(item => item.suggested) || response.mode === 'assisted';
    target.innerHTML = `<div class="section-heading"><h2>${assisted ? 'Possíveis correspondências' : 'Resultados'}</h2><span class="count">${searchResults.length} títulos</span></div>${assisted && searchResults.length ? '<p class="muted">Conferi variações do texto e pistas da capa. Confira a imagem e o ano antes de adicionar.</p>' : ''}${searchResults.length ? `<div id="result-grid">${grid(searchResults)}</div>` : '<div class="empty"><p>Nenhum título encontrado. Tente o nome original ou ajuste o texto da capa.</p></div>'}`;

    wireImages();
    if (native && coverLines && searchResults.some(item => item.poster) && typeof window.CenaAndroid.compareCovers === 'function') {
      target.insertAdjacentHTML('beforeend', '<div id="vision-status" class="notice" role="status">Comparando as capas com IA no aparelho…</div>');
      window.CenaAndroid.compareCovers(String(generation), JSON.stringify(searchResults.filter(item => item.poster).slice(0,4).map(item => ({ id: item.id, poster: item.poster }))));
    }
  } catch (error) { if (generation === searchGeneration && target.isConnected) target.innerHTML = `<div class="error" role="alert">${escape(error.message)}</div>`; }
}
function scan() {
  main.innerHTML = `<div class="eyebrow">ENCONTROU UMA BOA HISTÓRIA?</div><h1>Capturar título</h1><p class="muted">Use uma foto de capa ou um print da sua galeria.</p><div class="scan-frame">${scanPhoto ? `<img src="${escape(scanPhoto)}" alt="Foto da capa escolhida">` : '<div class="scan-corners"><span class="scan-symbol">▣</span>A próxima sessão<br>começa com uma foto.</div>'}</div><div class="scan-controls"><button class="primary wide" id="take-photo">▣ &nbsp; ${scanPhoto ? 'Fotografar novamente' : 'Abrir câmera'}</button><button class="secondary wide" id="pick-image">Escolher imagem ou print</button></div><div class="notice">${native ? 'Fotografe, escolha um print ou use Compartilhar → CENA. Inclua o título e a imagem da capa no recorte. A leitura e a comparação visual com IA acontecem no aparelho; sua imagem não é enviada ao servidor.' : 'Na prévia web, você pode escolher ou fotografar uma capa e digitar o título. A leitura automática do texto está preparada no aplicativo Android.'}</div><form id="scan-search" class="search-row"><textarea id="scan-query" rows="3" placeholder="Título completo da capa" aria-label="Título completo identificado na imagem" minlength="2" maxlength="150" required></textarea><button class="primary">Buscar</button></form><div id="detected-lines"></div><div id="search-results"></div>`;
  $('#take-photo').onclick = () => { if (native) window.CenaAndroid.scanCover(); else { $('#photo-input').setAttribute('capture', 'environment'); $('#photo-input').click(); } };
  $('#pick-image').onclick = () => { if (native) window.CenaAndroid.pickImage(); else { $('#photo-input').removeAttribute('capture'); $('#photo-input').click(); } };
  $('#scan-search').onsubmit = event => { event.preventDefault(); runSearch($('#scan-query').value); };
}
$('#photo-input').onchange = event => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) { toast('Escolha uma imagem de até 15 MB.'); return; }
  if (scanPhoto) URL.revokeObjectURL(scanPhoto);
  scanPhoto = URL.createObjectURL(file);
  setTab('scan'); $('#scan-query').focus();
  event.target.value = '';
};
window.CenaNativeResult = result => {
  if (result.error) { toast(result.error); return; }
  if ($('#detail').open) $('#detail').close();
  setTab('scan');
  const input = coverInput(result);
  const lines = (result.lines || []).filter(line => typeof line === 'string' && line.trim().length > 2);
  detectedLines = [...new Set(lines)].slice(0, 6);
  if (detectedLines.length > 1 && input.query === lines[0]) {
    $('#detected-lines').innerHTML = `<p class="muted">O título está em outra linha? Toque para buscar:</p><div class="chips">${detectedLines.map((line, index) => `<button class="chip" data-line="${index}">${escape(line)}</button>`).join('')}</div>`;
    document.querySelectorAll('[data-line]').forEach(button => button.onclick = () => { $('#scan-query').value = detectedLines[Number(button.dataset.line)].slice(0, 150); runSearch($('#scan-query').value); });
  }
  $('#scan-query').value = input.query;
  if (input.query) { toast('Buscando o título completo e as pistas da capa…'); runSearch(input.query, input.lines); }
  else toast('Não encontrei texto. Digite o título para buscar.');
};
window.CenaVisualResult = result => {
  if (String(result.requestId) !== String(searchGeneration)) return;
  const status = $('#vision-status');
  if (!status) return;
  if (result.status === 'ok' && Array.isArray(result.scores) && result.scores.length) {
    searchResults = rankWithVision(searchResults, result.scores);
    const area = $('#result-grid');
    if (area) {
      area.innerHTML = grid(searchResults);

      wireImages();
    }
    status.textContent = 'IA visual local: comparei sua imagem com as capas encontradas. Confirme o título e o ano antes de adicionar.';
  } else {
    status.textContent = result.status === 'no-references' ? 'Não encontrei capas disponíveis para comparar. Confira as sugestões pelo texto.' : 'A comparação visual não ficou disponível neste aparelho. As sugestões pelo texto continuam disponíveis.';
  }
};

async function save(item, status = 'watchlist') {
  if (busy) return;
  busy = true;
  try {
    await ensureConnection();
    const payload={...item,status};
    if(status==='watchlist') { delete payload.watchedSource; delete payload.watchedAt; }
    const result = await api(`/api/libraries/${connection.id}/items`, { method: 'PUT', body: JSON.stringify(payload) });
    items = result.items;
    sendTraktInventory(); queueTrakt(item, status === 'watchlist' ? 'add' : 'remove');
    toast(status === 'watched' ? 'Marcado como assistido.' : apiBase === 'local' ? 'Adicionado à lista neste aparelho.' : 'Adicionado! Sua lista no servidor foi atualizada.');
    showDetail(item); refreshCurrentView();
  } catch (error) { toast(error.message); }
  finally { busy = false; }
}
async function remove(item) {
  if (busy) return;
  busy = true;
  try {
    const result = await api(`/api/libraries/${connection.id}/items/${item.id}`, { method: 'DELETE' });
    items = result.items; queueTrakt(item,'remove'); sendTraktInventory(); $('#detail').close();refreshCurrentView();toast('Título removido da lista.');
  } catch (error) { toast(error.message); }
  finally { busy = false; }
}
function showDetail(item, enriched = false) {
  if (!item) return;
  detailItem = item;
  if(trustedArtwork(item.poster))persistArtwork(item,item.poster);
  const saved = items.find(i => i.id === item.id);
  $('#detail-content').innerHTML = `<div class="detail-top">${poster(item)}<div><div class="eyebrow">${titleType(item)}</div><h2>${escape(item.name)}</h2><span class="meta">${escape(item.year)} · ${escape(item.genre)}</span></div></div><div class="detail-body"><h3>Sinopse</h3><p id="detail-synopsis">${escape(item.description || 'Sem sinopse disponível.')}</p><p id="detail-loading" class="muted" role="status">${enriched ? '' : 'Buscando sinopse e ficha técnica…'}</p>${item.runtime ? `<p><strong>Duração:</strong> ${escape(item.runtime)}</p>` : ''}${item.rating ? `<p><strong>Nota IMDb:</strong> ${escape(item.rating)} / 10</p>` : ''}${item.directors?.length ? `<p><strong>Direção:</strong> ${escape(item.directors.join(', '))}</p>` : ''}${item.cast?.length ? `<p><strong>Elenco:</strong> ${escape(item.cast.slice(0,12).join(', '))}</p>` : ''}${item.detailError ? `<p role="alert">${escape(item.detailError)}</p>` : ''}${saved ? `<div class="status-label">✓ ${saved.status === 'watched' ? 'Você já assistiu' : 'Na sua lista Quero assistir'}</div>` : ''}<p class="muted" id="trakt-item-state">${escape(traktItemLabel(item,traktState))}</p>${saved?.watchedSource === "Trakt" ? '<p class="muted">✓ Assistido confirmado no histórico Trakt.</p>' : ''}<button class="primary wide" id="add-title">${saved?.status === 'watchlist' ? '✓ Está na minha lista' : '+ Quero assistir'}</button><div class="actions"><button class="secondary" id="share-title">↗ Criar Story</button>${saved ? `<button class="secondary" id="mark-status">${saved.status === 'watched' ? '↺ Rever depois' : '✓ Já assisti'}</button>` : ''}</div>${saved ? '<button class="link-button" id="remove-title">Remover do catálogo</button>' : ''}<p class="muted">${apiBase === 'local' ? 'Sua lista fica salva neste aparelho.' : 'A lista foi atualizada no servidor. Atualize o catálogo no player.'}</p>${item.sourceUrl ? `<p class="muted">Metadados: <a href="${escape(item.sourceUrl)}" target="_blank" rel="noreferrer">${escape(item.source || "Catálogo")}</a></p>` : ''}<div id="story-editor"></div></div>`;
  $('#add-title').onclick = () => saved?.status === 'watchlist' ? toast('Este título já está na sua lista.') : save(item);
  if ($('#mark-status')) $('#mark-status').onclick = () => save(item, saved.status === 'watched' ? 'watchlist' : 'watched');
  if ($('#remove-title')) $('#remove-title').onclick = () => remove(item);
  $('#share-title').onclick = () => story(item);
  wireImages();
  if (!$('#detail').open) { $('#detail').showModal(); $('#detail').scrollTop = 0; }
  if (!enriched) getTitleDetails(item).then(details => {
    if ($('#detail').open && detailItem?.id === item.id) {
      if($('#story-canvas')) { const status=$('#detail-loading'); if(status) status.textContent=''; }
      else showDetail(details, true);
    }
  }).catch(() => { const status = $('#detail-loading'); if (status && detailItem?.id === item.id) status.textContent = 'Não consegui carregar a ficha. Tente abrir o filme novamente.'; });
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Link copiado.'); }
  catch { toast('Selecione e copie o link no campo acima.'); }
}
function validBase(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !['https:', 'http:'].includes(url.protocol)) throw Error('Use apenas a origem do servidor, por exemplo https://cena.exemplo.com');
  if (native && url.protocol !== 'https:') throw Error('No aplicativo Android, use um endereço HTTPS.');
  return url.origin;
}
function connect() {
  if (apiBase === 'local') { localConnection(); return; }
  const connected = Boolean(connection);
  main.innerHTML = `<div class="eyebrow">SUA LISTA, EM MAIS TELAS</div><h1>Conectar ao player</h1><p class="muted">O CENA publica sua lista como um complemento de catálogo, separado da biblioteca interna do player.</p><div class="panel"><h2>Servidor do CENA</h2><p>Use o mesmo servidor no celular e no player. Para outro aparelho, o endereço precisa ser acessível pela rede.</p><form id="server-form"><label for="server-url">Endereço do servidor</label><input id="server-url" type="url" value="${escape(apiBase)}" placeholder="https://seu-servidor.exemplo" required><div class="actions"><button class="secondary" type="submit">${connected ? 'Atualizar conexão' : 'Conectar servidor'}</button></div></form></div><div class="panel"><h2>CENA · Quero assistir</h2>${connected ? '<p class="connection-status">Lista conectada ao servidor</p>' : '<p>Crie sua lista para gerar o link do complemento.</p>'}${connected ? `<label for="manifest-url">Link do complemento — acesso somente à leitura</label><textarea class="url-field" id="manifest-url" readonly>${escape(connection.manifestUrl)}</textarea><div class="actions"><button class="primary" id="copy-addon">Copiar link</button><button class="secondary" id="refresh-list">Atualizar lista</button></div>` : '<button class="primary" id="create-list">Criar minha lista</button>'}</div>${config && !config.publicConfigured ? '<div class="notice">Servidor em modo local. Configure PUBLIC_BASE_URL com um endereço HTTPS acessível para instalar o complemento em outro aparelho.</div>' : ''}<div class="step"><b>1</b><span>No Stremio, abra Complementos e instale pelo link do manifest acima.</span></div><div class="step"><b>2</b><span>No Nuvio, tente instalar o mesmo manifest na área de complementos. A compatibilidade ainda precisa ser testada no aparelho.</span></div><div class="step"><b>3</b><span>Procure “CENA · Filmes para assistir” ou “CENA · Séries para assistir”. Após uma alteração, atualize o catálogo no player.</span></div><div class="notice">Esta versão sincroniza o conteúdo do catálogo. O que você assistir no player ainda não volta automaticamente para o CENA.</div>${connected ? '<div class="panel"><h2>Guardar acesso à lista</h2><p>O código abaixo permite editar sua lista em outro dispositivo. Guarde em local privado. Não compartilhe com o player.</p><button class="secondary" id="export-connection">Copiar código de recuperação</button></div>' : ''}<div class="panel"><h2>Já tem uma lista?</h2><form id="restore-form"><label for="restore-code">Código de recuperação</label><textarea id="restore-code" class="url-field" placeholder="Cole seu código privado aqui" required></textarea><div class="actions"><button class="secondary" type="submit">Recuperar lista</button></div></form></div><p class="attribution">Metadados e imagens: TMDB. Este produto usa a API do TMDB, mas não é endossado ou certificado pelo TMDB. <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">Sobre o TMDB</a></p>`;
  $('#server-form').onsubmit = async event => {
    event.preventDefault();
    const previous = { apiBase, config, connection };
    try {
      const next = validBase($('#server-url').value.trim());
      if (connection && next !== apiBase) throw Error('Para trocar de servidor, recupere uma lista criada nele usando o código privado.');
      apiBase = next; config = await api('/api/config');
      await ensureConnection(); persist(); toast('Servidor conectado.'); connect();
    } catch (error) { ({ apiBase, config, connection } = previous); toast(error.message); }
  };
  if ($('#create-list')) $('#create-list').onclick = async () => { try { await ensureConnection(); connect(); } catch (error) { toast(error.message); } };
  if ($('#copy-addon')) $('#copy-addon').onclick = () => copy(connection.manifestUrl);
  if ($('#export-connection')) $('#export-connection').onclick = () => copy(JSON.stringify({ apiBase, id: connection.id, writeToken: connection.writeToken }));
  if ($('#refresh-list')) $('#refresh-list').onclick = async () => { try { await refresh(); connect(); toast('Lista atualizada.'); } catch (error) { toast(error.message); } };
  $('#restore-form').onsubmit = async event => {
    event.preventDefault();
    const previous = { apiBase, connection, config, items };
    try {
      const input = JSON.parse($('#restore-code').value);
      if (!/^[a-f0-9]{24}$/.test(input.id) || !/^[\w-]{32}$/.test(input.writeToken)) throw Error('Código de recuperação inválido.');
      apiBase = validBase(input.apiBase); connection = { id: input.id, writeToken: input.writeToken };
      await refresh(); persist(); connect(); toast('Lista recuperada.');
    } catch (error) { ({ apiBase, connection, config, items } = previous); toast(error.message); }
  };
}
async function refresh() {
  config = await api('/api/config');
  if(apiBase==='local' && !connection) { connection=await api('/api/libraries',{method:'POST'}); persist(); }
  if (connection) { const result = await api(`/api/libraries/${connection.id}`); connection = { id: result.id, writeToken: result.writeToken, manifestUrl: result.manifestUrl }; items = result.items; persist(); }
}

function localConnection() {
  const supported = native && typeof window.CenaAndroid.connectTrakt === 'function';
  const pending = traktState.pending?.length || 0;
  main.innerHTML = `<div class="eyebrow">SUA LISTA, EM MAIS TELAS</div><h1>Conectar ao Nuvio</h1>
    <div class="panel"><h2>Trakt como ponte</h2><p>Adicione no CENA → receba em Quero assistir no Trakt → abra a biblioteca Trakt do Nuvio no celular ou na TV.</p>
    <p>Use a mesma conta Trakt nos dois Nuvios e selecione Trakt como fonte da biblioteca. Ative também o registro do que assistir no Trakt.</p></div>
    <div class="panel" id="trakt-panel"><h2>${traktState.connected ? `✓ Trakt conectado${traktState.username ? ` · ${escape(traktState.username)}` : ''}` : 'Conectar sua conta Trakt'}</h2>
    ${!supported ? '<p>O login e a conexão protegida estão disponíveis no APK Android.</p>' : !traktState.configured ? `<p>Falta o cadastro único da integração CENA no Trakt. Depois, você autoriza sua conta por um código no navegador do celular.</p><details><summary>Configurar integração CENA</summary><p>Cadastre CENA em <a href="https://developer.trakt.tv/docs/create-an-app" target="_blank" rel="noreferrer">Trakt Developer</a> e copie somente o Client ID público. Não informe Client Secret, senha ou token.</p><form id="trakt-config-form"><label for="trakt-client-id">Client ID público</label><input id="trakt-client-id" minlength="20" maxlength="200" autocomplete="off" required><button class="primary" type="submit">Salvar cadastro</button></form></details>` : traktState.connected ? `<p>${pending ? `${pending} alteração(ões) aguardam envio.` : 'Nenhum envio pendente.'}</p><p class="muted">${traktState.lastSync ? `Última sincronização: ${new Date(traktState.lastSync).toLocaleString('pt-BR')}` : 'Aguardando a primeira sincronização.'}</p><div class="actions"><button class="primary" id="trakt-sync">${traktState.error ? 'Tentar novamente' : 'Sincronizar agora'}</button><button class="secondary" id="trakt-send-list">Enviar Quero assistir</button><button class="secondary" id="trakt-disconnect">Desconectar</button></div>` : traktState.userCode ? `<p>Seu código de autorização:</p><p class="auth-code" id="trakt-user-code">${escape(traktState.userCode)}</p><p>Copie o código, abra o Trakt e autorize o CENA. Volte ao app: a conexão será conferida até o código expirar.</p><div class="actions"><button class="secondary" id="trakt-copy-code">Copiar código</button><button class="primary" id="trakt-authorize">Abrir Trakt para autorizar</button></div>` : `<p>Ao autorizar, sua lista Quero assistir será enviada ao Trakt. Os filmes já assistidos no Trakt poderão receber o check no CENA.</p><button class="primary wide" id="trakt-connect">Conectar e enviar Quero assistir</button>`}
    ${traktState.error ? `<p class="error" role="alert">${escape(traktState.error)}</p>` : ''}</div>
    <div class="panel" id="stremio-panel"></div>
    <div class="panel"><h2>✓ Já assistido</h2><p>Quando o Nuvio registrar um filme como assistido no Trakt, o CENA recebe esse histórico na próxima sincronização. Abrir um filme não marca como assistido.</p><p>Para séries, mostramos os episódios vistos: um episódio não marca a série inteira como concluída.</p><p class="muted">O Android pode adiar tarefas em segundo plano. Ao abrir o CENA, a consulta é retomada.</p></div>
    <div class="panel"><h2>Stories</h2><p>Abra o filme → Criar Story → escolha a frase → Compartilhar ou Salvar imagem. No Instagram, escolha Stories e conclua a publicação.</p></div>
    <details class="panel"><summary>Catálogo remoto opcional</summary><p>Esta opção cria outra lista num servidor próprio. Não envia automaticamente sua lista local nem substitui a biblioteca Trakt.</p><form id="local-server-form"><input id="local-server-url" type="url" placeholder="https://seu-servidor.exemplo" required><button class="secondary" type="submit">Conectar servidor</button></form></details>`;
  stremioPanel.mount($('#stremio-panel'));
  if($('#trakt-config-form')) $('#trakt-config-form').onsubmit = event => { event.preventDefault(); window.CenaAndroid.configureTrakt($('#trakt-client-id').value.trim()); };
  if($('#trakt-connect')) $('#trakt-connect').onclick=()=>window.CenaAndroid.connectTrakt();
  if($('#trakt-copy-code')) $('#trakt-copy-code').onclick=()=>copy(traktState.userCode);
  if($('#trakt-authorize')) $('#trakt-authorize').onclick=()=>window.CenaAndroid.openTraktVerification();
  if($('#trakt-sync')) $('#trakt-sync').onclick=()=>{ sendTraktInventory(); window.CenaAndroid.syncTrakt(); };
  if($('#trakt-send-list')) $('#trakt-send-list').onclick=()=>{ sendTraktInventory(); sendTraktList(); toast('Envio solicitado. Confira os itens pendentes.'); };
  if($('#trakt-disconnect')) $('#trakt-disconnect').onclick=()=>window.CenaAndroid.disconnectTrakt();
  $('#local-server-form').onsubmit = async event => {
    event.preventDefault(); const previous={apiBase,connection,config,items};
    try { apiBase=validBase($('#local-server-url').value.trim()); connection=null; config=await api('/api/config'); await ensureConnection(); items=[]; connect(); toast('Servidor conectado. Sua lista local foi preservada.'); }
    catch(error) { ({apiBase,connection,config,items}=previous); toast(error.message); }
  };
}

// Render a 9:16 PNG locally. Photo captures never leave the device.
async function story(item) {
  $('#story-editor').innerHTML = `<div class="story"><h3>Seu Story</h3><p id="story-status" role="status" data-state="loading">Carregando a capa…</p><canvas id="story-canvas" width="1080" height="1920" aria-label="Prévia do Story"></canvas><label for="story-title">Título do Story</label><input id="story-title" value="${escape(item.name)}" maxlength="180"><label for="story-rating">Sua nota (opcional, de 0 a 10)</label><input id="story-rating" inputmode="decimal" placeholder="Ex.: 8,53 ou 8.53" maxlength="5"><p id="story-rating-error" class="error" hidden>Use uma nota de 0 a 10, com até duas casas decimais.</p><label for="story-caption">Sua opinião</label><textarea rows="3" id="story-caption" maxlength="140">${items.find(saved=>saved.id===item.id)?.status === 'watched' ? 'Já assisti ✓' : 'Quero assistir 🍿'}</textarea><button class="primary wide" id="share-story" disabled>Compartilhar imagem</button><button class="secondary wide" id="save-story" disabled>Salvar imagem PNG</button><div class="actions"><button class="secondary" id="retry-story" hidden>Tentar carregar capa</button><button class="secondary" id="story-without-poster" hidden>Continuar sem capa</button></div><p class="muted">Escolha o Instagram no compartilhamento ou salve a imagem para publicar nos Stories.</p></div>`;
  const canvas=$('#story-canvas'),caption=$('#story-caption'),title=$('#story-title'),rating=$('#story-rating'),ratingError=$('#story-rating-error');
  let image=null,metadata={title:item.name,originalTitle:item.originalName||'',year:item.year||''},ready=false;
  const notesKey='cena.story.notes.v1',noteId=`${item.type}:${item.id}`;
  let notes={};try{notes=JSON.parse(localStorage.getItem(notesKey)||'{}');}catch{}
  if(!notes||typeof notes!=='object'||Array.isArray(notes))notes={};
  if(notes[noteId]){caption.value=String(notes[noteId].caption||'').slice(0,140);rating.value=String(notes[noteId].rating||'');if(notes[noteId].title)title.value=String(notes[noteId].title).slice(0,180);}
  let editedTitle=Boolean(notes[noteId]?.title);
  const validRating=()=>rating.value.trim()===''||parseStoryRating(rating.value)!==null;
  const draw=()=>{
    renderStory(canvas,{image,title:title.value.trim()||metadata.title,originalTitle:metadata.originalTitle,year:metadata.year,type:item.type,caption:caption.value,rating:rating.value});
    ratingError.hidden=validRating();
    if($('#share-story')){$('#share-story').disabled=!ready||!validRating();$('#save-story').disabled=!ready||!validRating();}
  };
  const remember=()=>{notes[noteId]={caption:caption.value,rating:rating.value,title:editedTitle?title.value:'',at:Date.now()};try{localStorage.setItem(notesKey,JSON.stringify(Object.fromEntries(Object.entries(notes).sort((a,b)=>(b[1].at||0)-(a[1].at||0)).slice(0,200))));}catch{}};
  caption.oninput=rating.oninput=()=>{draw();remember();};title.oninput=()=>{editedTitle=true;draw();remember();};
  storyMetadata(item).then(value=>{if(!canvas.isConnected)return;metadata=value;if(!editedTitle)title.value=value.title;draw();}).catch(()=>{});
  draw();
  const status=$('#story-status'),share=$('#share-story'),save=$('#save-story'),retry=$('#retry-story'),without=$('#story-without-poster');
  const enable=()=>{ready=true;draw();};
  const prepare=async()=>{
    ready=false;share.disabled=true;save.disabled=true;retry.hidden=true;without.hidden=true;status.dataset.state='loading';status.textContent='Carregando a capa…';
    try{
      const result=await loadStoryPoster(item,{bridge:window.CenaAndroid,resolveArtwork:value=>artworkResolver.resolve(value)});
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
  without.onclick=()=>{status.dataset.state='title-only';status.textContent='Você escolheu compartilhar apenas o título.';without.hidden=true;enable();};
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
  canvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
document.querySelectorAll('nav [data-tab]').forEach(button => button.onclick = () => setTab(button.dataset.tab));
$('#search-shortcut').onclick = () => { setTab('library'); $('#query').focus(); };
$('.brand').onclick = event => { event.preventDefault(); setTab('home'); };
$('#detail .close').onclick = () => $('#detail').close();
$('#detail').addEventListener('close',refreshCurrentView);
$('#detail').onclick = event => { if (event.target === $('#detail')) { const r = $('#detail').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('#detail').close(); } };
if (stored?.id && stored?.writeToken) connection = { id: stored.id, writeToken: stored.writeToken, manifestUrl: stored.manifestUrl };
home();
if (apiBase) refresh().then(() => { libraryReady=true; setTab(tab); sendTraktInventory(); if(deferredTraktState) { const state=deferredTraktState; deferredTraktState=null; window.CenaTraktResult(state); } }).catch(error => toast(error.message));
else setTab('connect');

if (native) { if (typeof window.CenaAndroid.appVersion === 'function') $('#app-version').textContent = 'v' + window.CenaAndroid.appVersion(); window.CenaAndroid.ready(); }

window.addEventListener('online',()=>{artworkResolver.retry();for(const element of document.querySelectorAll('.poster-art[data-artwork-key]')){if(!element.querySelector('img')){const rect=element.getBoundingClientRect();if(rect.bottom>=0 && rect.top<=innerHeight+200)hydrateArtwork(element);}}});
