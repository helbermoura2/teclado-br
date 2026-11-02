import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { samples } from './samples.mjs';

const webRoot = fileURLToPath(new URL('../web/', import.meta.url));
const token = () => randomBytes(24).toString('base64url');
const fail = (status, message) => Object.assign(new Error(message), { status });
const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const equal = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const validId = id => /^tt\d{5,12}$/.test(id);

async function body(req) {
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 32_768) throw fail(413, 'Requisição muito grande.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw fail(400, 'JSON inválido.'); }
}

export async function createApp(options = {}) {
  const dataDir = path.resolve(options.dataDir ?? process.env.DATA_DIR ?? './data');
  const publicBase = (options.publicBase ?? process.env.PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
  if (publicBase && !/^https?:\/\//.test(publicBase)) throw Error('PUBLIC_BASE_URL deve ser uma URL HTTP(S).');
  const tmdbToken = options.tmdbToken ?? process.env.TMDB_READ_TOKEN;
  const fetcher = options.fetcher ?? fetch;
  const file = path.join(dataDir, 'libraries.json');
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  let db;
  try { db = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; db = {}; }
  let queue = Promise.resolve();
  // Serialize persistence and publish state only once the atomic write succeeds.
  function mutate(fn) {
    const pending = queue.then(async () => {
      const next = structuredClone(db);
      const result = fn(next);
      await writeFile(file + '.tmp', JSON.stringify(next), { mode: 0o600 });
      await rename(file + '.tmp', file);
      db = next;
      return result;
    });
    queue = pending.catch(() => {});
    return pending;
  }
  async function tmdb(route) {
    const response = await fetcher(`https://api.themoviedb.org/3/${route}`, {
      headers: { Authorization: `Bearer ${tmdbToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw fail(502, 'A busca de filmes está indisponível. Tente novamente.');
    return response.json();
  }
  const cache = new Map();
  async function search(query) {
    if (!tmdbToken) return samples.filter(item => normalize(`${item.name} ${item.originalName}`).includes(normalize(query)));
    const result = await tmdb(`search/multi?language=pt-BR&include_adult=false&query=${encodeURIComponent(query)}`);
    const rows = result.results.filter(row => ['movie', 'tv'].includes(row.media_type)).slice(0, 12);
    const items = await Promise.all(rows.map(async row => {
      const type = row.media_type === 'tv' ? 'series' : 'movie';
      const extra = await tmdb(`${row.media_type}/${row.id}/external_ids`);
      if (!validId(extra.imdb_id ?? '')) return null;
      return { id: extra.imdb_id, type, name: row.title ?? row.name, year: (row.release_date ?? row.first_air_date ?? '').slice(0, 4), description: row.overview ?? '', poster: row.poster_path ? `https://image.tmdb.org/t/p/w500${row.poster_path}` : '', genre: type === 'series' ? 'Série' : 'Filme' };
    }));
    return items.filter(Boolean);
  }
  function authorize(req, id) {
    const library = db[id];
    if (!library || !equal(req.headers.authorization, `Bearer ${library.writeToken}`)) throw fail(401, 'Conexão inválida. Conecte sua lista novamente.');
    return library;
  }
  function base(req) { return publicBase || `http://localhost:${req.socket.localPort}`; }
  function connection(req, library) {
    return { id: library.id, writeToken: library.writeToken, manifestUrl: `${base(req)}/addon/${library.id}/${library.readToken}/manifest.json` };
  }
  const limits = new Map();
  function rateLimit(req) {
    const key = req.socket.remoteAddress;
    const now = Date.now();
    if (limits.size > 2000) for (const [ip, entry] of limits) if (now > entry.until) limits.delete(ip);
    const entry = limits.get(key);
    if (!entry || now > entry.until) { limits.set(key, { count: 1, until: now + 60_000 }); return; }
    if (++entry.count > 180) throw fail(429, 'Muitas solicitações. Aguarde um minuto.');
  }
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    // Native UI is bundled and served with Android WebViewAssetLoader.
    if (origin === 'https://appassets.androidplatform.net') res.setHeader('Access-Control-Allow-Origin', origin);
    if (req.url?.startsWith('/addon/')) res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      rateLimit(req);
      const url = new URL(req.url, 'http://localhost');
      const p = url.pathname;
      if (req.method === 'GET' && p === '/api/config') return json(200, { searchMode: tmdbToken ? 'tmdb' : 'sample', publicConfigured: Boolean(publicBase), catalogName: 'CENA · Quero assistir' });
      if (req.method === 'GET' && p === '/api/search') {
        const query = (url.searchParams.get('q') ?? '').trim();
        if (query.length < 2 || query.length > 150) throw fail(400, 'Digite entre 2 e 150 caracteres.');
        const key = normalize(query);
        let hit = cache.get(key);
        if (!hit || hit.until < Date.now()) {
          hit = { items: await search(query), until: Date.now() + 300_000 };
          if (cache.size > 100) cache.clear();
          cache.set(key, hit);
        }
        return json(200, { items: hit.items, mode: tmdbToken ? 'tmdb' : 'sample' });
      }
      if (req.method === 'POST' && p === '/api/libraries') {
        const library = { id: randomBytes(12).toString('hex'), writeToken: token(), readToken: token(), items: [], updatedAt: new Date().toISOString() };
        await mutate(next => { next[library.id] = library; });
        return json(201, { ...connection(req, library), items: [] });
      }
      const apiMatch = p.match(/^\/api\/libraries\/([a-f0-9]{24})(?:\/items(?:\/(tt\d{5,12}))?)?$/);
      if (apiMatch) {
        const [, id, itemId] = apiMatch;
        const library = authorize(req, id);
        if (req.method === 'GET' && p === `/api/libraries/${id}`) return json(200, { ...connection(req, library), items: library.items, updatedAt: library.updatedAt });
        if (req.method === 'PUT' && p === `/api/libraries/${id}/items`) {
          const input = await body(req);
          if (!validId(input.id ?? '') || !['movie', 'series'].includes(input.type) || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 200) throw fail(400, 'Título inválido.');
          if (library.items.length >= 2000 && !library.items.some(i => i.id === input.id)) throw fail(409, 'Limite de 2000 títulos atingido.');
          const item = { id: input.id, type: input.type, name: input.name.trim(), year: String(input.year ?? '').slice(0, 4), description: String(input.description ?? '').slice(0, 4000), poster: /^https:\/\/image\.tmdb\.org\/t\/p\//.test(input.poster ?? '') ? input.poster : '', genre: String(input.genre ?? '').slice(0, 80), status: ['watchlist', 'watched'].includes(input.status) ? input.status : 'watchlist' };
          await mutate(next => {
            const current = next[id];
            const old = current.items.find(i => i.id === item.id);
            current.items = [{ ...item, addedAt: old?.addedAt ?? new Date().toISOString() }, ...current.items.filter(i => i.id !== item.id)];
            current.updatedAt = new Date().toISOString();
          });
          return json(200, { items: db[id].items });
        }
        if (req.method === 'DELETE' && itemId) {
          await mutate(next => { next[id].items = next[id].items.filter(i => i.id !== itemId); next[id].updatedAt = new Date().toISOString(); });
          return json(200, { items: db[id].items });
        }
      }
      const addon = p.match(/^\/addon\/([a-f0-9]{24})\/([\w-]+)\/(.+)$/);
      if (addon && req.method === 'GET') {
        const [, id, readToken, resource] = addon;
        const library = db[id];
        if (!library || !equal(library.readToken, readToken)) throw fail(404, 'Catálogo não encontrado.');
        if (resource === 'manifest.json') return json(200, {
          id: `app.cena.${id}`, version: '0.1.0', name: 'CENA · Quero assistir',
          description: 'Sua lista de filmes e séries adicionados no CENA. Atualize o catálogo no player para consultar alterações.',
          resources: ['catalog'], types: ['movie', 'series'],
          catalogs: [ { type: 'movie', id: 'cena-watchlist', name: 'CENA · Filmes para assistir' }, { type: 'series', id: 'cena-watchlist', name: 'CENA · Séries para assistir' } ],
          behaviorHints: { configurable: false }
        });
        const catalog = resource.match(/^catalog\/(movie|series)\/cena-watchlist\.json$/);
        if (catalog) return json(200, { metas: library.items.filter(i => i.type === catalog[1] && i.status === 'watchlist').map(i => ({ id: i.id, type: i.type, name: i.name, poster: i.poster || undefined, releaseInfo: i.year, description: i.description })), cacheMaxAge: 0, staleRevalidate: 0, staleError: 0 });
        throw fail(404, 'Recurso não encontrado.');
      }
      const files = { '/similar.js':['similar.js','text/javascript'], '/local-ai.js':['local-ai.js','text/javascript'], '/recommendations.js': ['recommendations.js','text/javascript'], '/series-view.js': ['series-view.js','text/javascript'], '/story-layout.js': ['story-layout.js', 'text/javascript'], '/story-metadata.js': ['story-metadata.js', 'text/javascript'], '/story-artwork.js': ['story-artwork.js', 'text/javascript'], '/artwork.js': ['artwork.js', 'text/javascript'], '/stremio-panel.js': ['stremio-panel.js', 'text/javascript'], '/stremio-import.js': ['stremio-import.js', 'text/javascript'], '/trakt-state.js': ['trakt-state.js', 'text/javascript'], '/visual-ranking.js': ['visual-ranking.js', 'text/javascript'], '/identify-cover.js': ['identify-cover.js', 'text/javascript'], '/search-public.js': ['search-public.js', 'text/javascript'], '/local-api.js': ['local-api.js', 'text/javascript'], '/offline-catalog.js': ['offline-catalog.js', 'text/javascript'], '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'], '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'], '/icon.svg': ['icon.svg', 'image/svg+xml'] };
      if (req.method === 'GET' && files[p]) {
        const [name, mime] = files[p];
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://image.tmdb.org https://upload.wikimedia.org https://images.metahub.space https://m.media-amazon.com; connect-src 'self' http: https:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
        res.writeHead(200, { 'Content-Type': mime + '; charset=utf-8' });
        res.end(await readFile(path.join(webRoot, name)));
        return;
      }
      throw fail(404, 'Não encontrado.');
    } catch (error) {
      if (!res.headersSent) json(error.status ?? 500, { error: error.status ? error.message : 'Não foi possível concluir a operação.' });
      else res.end();
    }
  });
  return server;
}
