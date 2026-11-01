import { readFile, writeFile } from 'node:fs/promises';
import { samples } from '../server/samples.mjs';

const root = new URL('../', import.meta.url);
let html = await readFile(new URL('web/index.html', root), 'utf8');
const css = await readFile(new URL('web/styles.css', root), 'utf8');
let js = await readFile(new URL('web/app.js', root), 'utf8');
js = js.replace("import { searchPublicTitles } from './search-public.js';\n", '');
js = js.replace("import { createLocalApi } from './local-api.js';\n", '').replace('const localApi = createLocalApi(localStorage, { search: searchPublicTitles });', '');
js = js.replace("const native = Boolean(window.CenaAndroid);", 'const native = false;');
js = js.replace("const storageKey = 'cena.connection.v1';", "const storageKey = 'cena.offline.connection.v1';");
js = js.replace("let apiBase = stored?.apiBase || (native ? '' : location.origin);", "let apiBase = 'offline';");
const start = js.indexOf('async function api(');
const end = js.indexOf('\nfunction persist()', start);
js = js.slice(0, start) + `
const demoTitles = ${JSON.stringify(samples)};
let localTitles = [];
let storageWorks = true;
try { localTitles = JSON.parse(localStorage.getItem('cena.offline.items.v1') || '[]'); } catch { storageWorks = false; }
function saveLocal() { try { localStorage.setItem('cena.offline.items.v1', JSON.stringify(localTitles)); } catch { storageWorks = false; toast('Este visualizador não salva dados. Abra o arquivo no Chrome.'); } }
async function api(route, options = {}) {
  if (route === '/api/config') return { searchMode: 'sample', publicConfigured: false };
  if (route.startsWith('/api/search?')) {
    const query = new URL('https://local.invalid' + route).searchParams.get('q') || '';
    const norm = text => text.normalize('NFD').replace(/\\p{Diacritic}/gu, '').toLowerCase();
    return { mode: 'sample', items: demoTitles.filter(item => norm(item.name + ' ' + item.originalName).includes(norm(query))) };
  }
  if (route === '/api/libraries') return { id: 'offline', writeToken: '', manifestUrl: '', items: localTitles };
  if (options.method === 'PUT') {
    const item = JSON.parse(options.body);
    localTitles = [{ ...item, addedAt: new Date().toISOString() }, ...localTitles.filter(row => row.id !== item.id)]; saveLocal();
    return { items: localTitles };
  }
  if (options.method === 'DELETE') { const id = route.split('/').pop(); localTitles = localTitles.filter(row => row.id !== id); saveLocal(); return { items: localTitles }; }
  return { id: 'offline', writeToken: '', manifestUrl: '', items: localTitles };
}
` + js.slice(end);
js = js.replace("function persist() { localStorage.setItem(storageKey, JSON.stringify({ ...connection, apiBase })); }", "function persist() { try { localStorage.setItem(storageKey, JSON.stringify({ ...connection, apiBase })); } catch {} }");
js = js.replace('Prévia com 6 títulos de amostra. Busca completa disponível ao configurar o TMDB no servidor.', 'Prévia no celular · 6 títulos de amostra. Lista salva somente neste navegador.');
js = js.replace('Adicionado! Sua lista no servidor foi atualizada.', 'Adicionado à lista neste navegador.');
js = js.replace('A lista é atualizada no servidor. O player pode precisar atualizar o catálogo.', 'Prévia local: esta lista ainda não é sincronizada com o player.');
js = js.replace('Adicione no CENA e consulte seu catálogo no player compatível.', 'Experimente a lista e os cards para Stories. A conexão com os players será uma etapa separada.');
const connectStart = js.indexOf('function connect() {');
const connectEnd = js.indexOf('\nasync function refresh()', connectStart);
js = js.slice(0, connectStart) + `function connect() {
  main.innerHTML = '<div class="eyebrow">PRÉVIA PARA CELULAR</div><h1>Sua lista no Android</h1><div class="panel"><h2>O que você pode testar agora</h2><p>Buscar seis títulos de amostra, adicionar e remover da lista, marcar assistidos, escolher uma foto de capa e gerar um card para Stories.</p></div><div class="notice">A lista fica somente neste navegador. Esta prévia não está conectada ao Stremio ou Nuvio. A leitura automática da capa está preparada no projeto Android e não funciona neste arquivo.</div><div class="panel"><h2>Experimente estes títulos</h2><p>Duna, Interestelar, Matrix, Stranger Things, Breaking Bad e Game of Thrones.</p><button class="primary wide" id="start-search">Buscar um título</button></div><div class="panel"><h2>Se o arquivo não funcionar</h2><p>Alguns visualizadores de arquivos no Android bloqueiam JavaScript. Tente abrir no Chrome. Uma versão publicada por HTTPS será necessária para testar câmera e compartilhamento com todas as permissões do navegador.</p></div>';
  $('#start-search').onclick = () => { setTab('library'); $('#query').focus(); };
}
` + js.slice(connectEnd);
js = js.replace('home();\nif (apiBase)', 'connection = { id: "offline", writeToken: "", manifestUrl: "" };\nhome();\nif (apiBase)');
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
html = html.replace(/\s*<link rel="icon"[^>]*><link rel="manifest"[^>]*><link rel="stylesheet"[^>]*>/, `<style>${css}</style>`);
html = html.replace(/\s*<script type="module" src="app.js"><\/script>/, '');
html = html.replace('</body>', `<script>${js.replaceAll('</script', '<\\/script')}</script></body>`);
await writeFile(new URL('../cena-mobile.html', root), html);
console.log('Prévia em /workspace/cena-mobile.html');
