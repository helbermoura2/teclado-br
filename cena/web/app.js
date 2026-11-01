import { createLocalApi } from './local-api.js';
import { identifyCover, searchTolerantTitles } from './identify-cover.js';
import { rankWithVision } from './visual-ranking.js';
const $ = selector => document.querySelector(selector);
const native = Boolean(window.CenaAndroid);
const storageKey = 'cena.connection.v1';
let connection = null;
let stored = null;
try { stored = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch {}
let apiBase = stored?.apiBase || (native ? 'local' : location.origin);
const localApi = createLocalApi(localStorage, { search: searchTolerantTitles });
let items = [], tab = 'home', filter = 'watchlist', searchResults = [], config = null;
let scanPhoto = '', detectedLines = [], detailItem = null, searchGeneration = 0, busy = false;
const main = $('#main');
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
  if (apiBase === 'local') return '<div class="notice">Busca online de filmes e séries · sua lista fica salva neste aparelho. A sincronização com o player ainda não está ativa.</div>';
  return config?.searchMode === 'sample' ? '<div class="notice">Prévia com 6 títulos de amostra. Busca completa disponível ao configurar o TMDB no servidor.</div>' : '';
}
function poster(item, badge = '') {
  return `<div class="poster-art"><span class="fallback">${escape(item.name)}</span>${item.poster ? `<img src="${escape(item.poster)}" alt="" loading="lazy" crossorigin="anonymous">` : ''}${badge ? `<span class="badge">${escape(badge)}</span>` : ''}</div>`;
}
function grid(rows) { return `<div class="grid">${rows.map(item => `<button class="poster-card" data-id="${escape(item.id)}" aria-label="Ver ${escape(item.name)}">${poster(item, item.status === 'watched' ? 'Assistido' : '')}<strong>${escape(item.name)}</strong><small>${escape(item.year)} · ${titleType(item)}</small></button>`).join('')}</div>`; }
function wireImages() { document.querySelectorAll('img').forEach(img => { img.addEventListener('error', () => img.remove(), { once: true }); }); }
function wireCards(rows) {
  main.querySelectorAll('[data-id]').forEach(button => button.onclick = () => showDetail(rows.find(i => i.id === button.dataset.id)));
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
  main.innerHTML = `<div class="eyebrow">CADA HISTÓRIA TEM SEU LUGAR</div><h1>Meu catálogo</h1><form id="search-form" class="search-row"><input id="query" type="search" placeholder="Buscar filme ou série…" aria-label="Nome do filme ou série" minlength="2" maxlength="150" required><button class="primary" type="submit">Buscar</button></form><div class="chips"><button class="chip ${filter === 'watchlist' ? 'selected' : ''}" data-filter="watchlist">Quero assistir</button><button class="chip ${filter === 'watched' ? 'selected' : ''}" data-filter="watched">Assistidos</button><button class="chip ${filter === 'all' ? 'selected' : ''}" data-filter="all">Todos</button></div><div id="search-results"></div><div class="section-heading"><h2>${filter === 'watched' ? 'Já fizeram parte da sua história' : 'Na sua lista'}</h2><span class="count">${rows.length} títulos</span></div><div id="library-grid">${rows.length ? grid(rows) : empty()}</div>${notice()}`;
  $('#search-form').onsubmit = e => { e.preventDefault(); runSearch($('#query').value); };
  document.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { filter = button.dataset.filter; library(); });
  if ($('#empty-search')) $('#empty-search').onclick = () => $('#query').focus();
  wireCards(rows);
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
    const assisted = searchResults.some(item => item.suggested) || response.mode === 'assisted';
    target.innerHTML = `<div class="section-heading"><h2>${assisted ? 'Possíveis correspondências' : 'Resultados'}</h2><span class="count">${searchResults.length} títulos</span></div>${assisted && searchResults.length ? '<p class="muted">Conferi variações do texto e pistas da capa. Confira a imagem e o ano antes de adicionar.</p>' : ''}${searchResults.length ? `<div id="result-grid">${grid(searchResults)}</div>` : '<div class="empty"><p>Nenhum título encontrado. Tente o nome original ou ajuste o texto da capa.</p></div>'}`;
    target.querySelectorAll('[data-id]').forEach(button => button.onclick = () => showDetail(searchResults.find(i => i.id === button.dataset.id)));
    wireImages();
    if (native && coverLines && searchResults.some(item => item.poster) && typeof window.CenaAndroid.compareCovers === 'function') {
      target.insertAdjacentHTML('beforeend', '<div id="vision-status" class="notice" role="status">Comparando as capas com IA no aparelho…</div>');
      window.CenaAndroid.compareCovers(String(generation), JSON.stringify(searchResults.filter(item => item.poster).slice(0,4).map(item => ({ id: item.id, poster: item.poster }))));
    }
  } catch (error) { if (generation === searchGeneration && target.isConnected) target.innerHTML = `<div class="error" role="alert">${escape(error.message)}</div>`; }
}
function scan() {
  main.innerHTML = `<div class="eyebrow">ENCONTROU UMA BOA HISTÓRIA?</div><h1>Capturar título</h1><p class="muted">Use uma foto de capa ou um print da sua galeria.</p><div class="scan-frame">${scanPhoto ? `<img src="${escape(scanPhoto)}" alt="Foto da capa escolhida">` : '<div class="scan-corners"><span class="scan-symbol">▣</span>A próxima sessão<br>começa com uma foto.</div>'}</div><div class="scan-controls"><button class="primary wide" id="take-photo">▣ &nbsp; ${scanPhoto ? 'Fotografar novamente' : 'Abrir câmera'}</button><button class="secondary wide" id="pick-image">Escolher imagem ou print</button></div><div class="notice">${native ? 'Fotografe, escolha um print ou use Compartilhar → CENA. Inclua o título e a imagem da capa no recorte. A leitura e a comparação visual com IA acontecem no aparelho; sua imagem não é enviada ao servidor.' : 'Na prévia web, você pode escolher ou fotografar uma capa e digitar o título. A leitura automática do texto está preparada no aplicativo Android.'}</div><form id="scan-search" class="search-row"><input id="scan-query" type="search" placeholder="Título da capa" aria-label="Título identificado na imagem" minlength="2" maxlength="150" required><button class="primary">Buscar</button></form><div id="detected-lines"></div><div id="search-results"></div>`;
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
  const lines = (result.lines || []).filter(line => typeof line === 'string' && line.trim().length > 2);
  detectedLines = [...new Set(lines)].slice(0, 6);
  if (detectedLines.length > 1) {
    $('#detected-lines').innerHTML = `<p class="muted">O título está em outra linha? Toque para buscar:</p><div class="chips">${detectedLines.map((line, index) => `<button class="chip" data-line="${index}">${escape(line)}</button>`).join('')}</div>`;
    document.querySelectorAll('[data-line]').forEach(button => button.onclick = () => { $('#scan-query').value = detectedLines[Number(button.dataset.line)].slice(0, 150); runSearch($('#scan-query').value); });
  }
  $('#scan-query').value = lines[0]?.slice(0, 150) || '';
  if (lines.length) { toast('Conferindo o título e outras pistas da capa…'); const context = [...new Set([...lines, ...String(result.fullText || '').split('\n')])].slice(0, 24); runSearch($('#scan-query').value, context); }
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
      area.querySelectorAll('[data-id]').forEach(button => button.onclick = () => showDetail(searchResults.find(item => item.id === button.dataset.id)));
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
    const result = await api(`/api/libraries/${connection.id}/items`, { method: 'PUT', body: JSON.stringify({ ...item, status }) });
    items = result.items;
    toast(status === 'watched' ? 'Marcado como assistido.' : apiBase === 'local' ? 'Adicionado à lista neste aparelho.' : 'Adicionado! Sua lista no servidor foi atualizada.');
    showDetail(item); setTab(tab);
  } catch (error) { toast(error.message); }
  finally { busy = false; }
}
async function remove(item) {
  if (busy) return;
  busy = true;
  try {
    const result = await api(`/api/libraries/${connection.id}/items/${item.id}`, { method: 'DELETE' });
    items = result.items; $('#detail').close(); setTab(tab); toast('Título removido da lista.');
  } catch (error) { toast(error.message); }
  finally { busy = false; }
}
function showDetail(item) {
  if (!item) return;
  detailItem = item;
  const saved = items.find(i => i.id === item.id);
  $('#detail-content').innerHTML = `<div class="detail-top">${poster(item)}<div><div class="eyebrow">${titleType(item)}</div><h2>${escape(item.name)}</h2><span class="meta">${escape(item.year)} · ${escape(item.genre)}</span></div></div><div class="detail-body"><p>${escape(item.description || 'Sem sinopse disponível.')}</p>${saved ? `<div class="status-label">✓ ${saved.status === 'watched' ? 'Você já assistiu' : 'Na sua lista Quero assistir'}</div>` : ''}<button class="primary wide" id="add-title">${saved?.status === 'watchlist' ? '✓ Está na minha lista' : '+ Quero assistir'}</button><div class="actions"><button class="secondary" id="share-title">↗ Criar Story</button>${saved ? `<button class="secondary" id="mark-status">${saved.status === 'watched' ? '↺ Rever depois' : '✓ Já assisti'}</button>` : ''}</div>${saved ? '<button class="link-button" id="remove-title">Remover do catálogo</button>' : ''}<p class="muted">${apiBase === 'local' ? 'Sua lista fica salva neste aparelho.' : 'A lista foi atualizada no servidor. Atualize o catálogo no player.'}</p>${item.sourceUrl ? `<p class="muted">Metadados: <a href="${escape(item.sourceUrl)}" target="_blank" rel="noreferrer">Wikidata / Wikipédia</a></p>` : ''}<div id="story-editor"></div></div>`;
  $('#add-title').onclick = () => saved?.status === 'watchlist' ? toast('Este título já está na sua lista.') : save(item);
  if ($('#mark-status')) $('#mark-status').onclick = () => save(item, saved.status === 'watched' ? 'watchlist' : 'watched');
  if ($('#remove-title')) $('#remove-title').onclick = () => remove(item);
  $('#share-title').onclick = () => story(item);
  wireImages();
  if (!$('#detail').open) $('#detail').showModal();
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
  if (connection) { const result = await api(`/api/libraries/${connection.id}`); connection = { id: result.id, writeToken: result.writeToken, manifestUrl: result.manifestUrl }; items = result.items; persist(); }
}

function localConnection() {
  main.innerHTML = `<div class="eyebrow">PRONTO PARA USAR NO CELULAR</div><h1>Seu CENA</h1><div class="panel"><h2>Lista neste aparelho</h2><p>Experimente a câmera, a leitura do texto da capa, sua lista e os cards para Stories. A busca combina pistas do texto com comparação visual de capas no aparelho, sem cobrança por imagem. O catálogo online requer internet.</p></div><div class="notice">Stremio e Nuvio precisam de um catálogo hospedado para acessar sua lista. O modo local ainda não sincroniza com esses players.</div><div class="panel"><h2>Conectar catálogo remoto</h2><p>Quando o servidor CENA estiver disponível, informe o endereço HTTPS. Os títulos locais são preservados, sem transferência automática.</p><form id="local-server-form"><label for="local-server-url">Endereço do servidor</label><input id="local-server-url" type="url" placeholder="https://seu-servidor.exemplo" required><div class="actions"><button class="primary" type="submit">Conectar</button></div></form></div><div class="panel"><h2>Experimentar agora</h2><p>Busque pelo nome de qualquer filme ou série. Por exemplo: SISU.</p><button class="secondary" id="local-search">Abrir catálogo</button></div>`;
  $('#local-search').onclick = () => setTab('library');
  $('#local-server-form').onsubmit = async event => {
    event.preventDefault();
    const previous = { apiBase, connection, config, items };
    try {
      apiBase = validBase($('#local-server-url').value.trim()); connection = null;
      config = await api('/api/config'); await ensureConnection(); items = []; connect();
      toast('Servidor conectado. Sua lista local foi preservada.');
    } catch (error) { ({ apiBase, connection, config, items } = previous); toast(error.message); }
  };
}

// Render a 9:16 PNG locally. Photo captures never leave the device.
async function story(item) {
  $('#story-editor').innerHTML = '<div class="story"><canvas id="story-canvas" width="720" height="1280" aria-label="Prévia do Story"></canvas><label for="story-caption">Sua frase</label><input id="story-caption" value="Assistindo hoje 🍿" maxlength="70"><button class="primary wide" id="share-story">Compartilhar imagem</button><p class="muted">Escolha o Instagram no compartilhamento ou salve a imagem para publicar nos Stories.</p></div>';
  const canvas = $('#story-canvas'); const ctx = canvas.getContext('2d');
  let image = null;
  const draw = () => {
    const gradient = ctx.createLinearGradient(0, 0, 720, 1280); gradient.addColorStop(0, '#492570'); gradient.addColorStop(.5, '#191323'); gradient.addColorStop(1, '#613d76');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 720, 1280);
    ctx.fillStyle = '#221c2e'; ctx.fillRect(110, 120, 500, 750);
    if (image) {
      const scale = Math.max(500 / image.width, 750 / image.height); const w = image.width * scale, h = image.height * scale;
      ctx.save(); ctx.beginPath(); ctx.rect(110, 120, 500, 750); ctx.clip(); ctx.drawImage(image, 110 + (500 - w) / 2, 120 + (750 - h) / 2, w, h); ctx.restore();
    } else { ctx.fillStyle = '#b790e8'; ctx.font = '120px Georgia'; ctx.textAlign = 'center'; ctx.fillText('▲', 360, 540); }
    ctx.textAlign = 'center'; ctx.fillStyle = 'white'; ctx.font = 'bold 38px Georgia';
    const words = item.name.split(' '); let line = '', y = 950;
    for (const word of words) { if (ctx.measureText(line + word).width > 600 && line) { ctx.fillText(line.trim(), 360, y); y += 48; line = ''; } line += word + ' '; }
    ctx.fillText(line.trim(), 360, y);
    ctx.font = '25px sans-serif'; ctx.fillStyle = '#ded0ec'; ctx.fillText($('#story-caption').value, 360, 1110, 620);
    ctx.font = 'bold 35px sans-serif'; ctx.fillStyle = 'white'; ctx.fillText('CENA', 360, 1200);
  };
  draw(); $('#story-caption').oninput = draw;
  if (item.poster) {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { if (!canvas.isConnected) return; image = img; draw(); };
    img.onerror = () => { if (canvas.isConnected) toast('Pôster indisponível. O card será gerado com o título.'); };
    img.src = item.poster;
  }
  $('#share-story').onclick = async () => {
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
$('#detail').onclick = event => { if (event.target === $('#detail')) { const r = $('#detail').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('#detail').close(); } };
if (stored?.id && stored?.writeToken) connection = { id: stored.id, writeToken: stored.writeToken, manifestUrl: stored.manifestUrl };
home();
if (apiBase) refresh().then(() => setTab(tab)).catch(error => toast(error.message));
else setTab('connect');

if (native) window.CenaAndroid.ready();
