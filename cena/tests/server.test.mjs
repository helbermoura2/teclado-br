import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.mjs';
import { request } from './transport.mjs';

async function fixture(t, options = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'cena-test-'));
  let server = await createApp({ dataDir, tmdbToken: '', ...options });
  const base = 'http://localhost:3000';
  t.after(async () => { await rm(dataDir, { recursive: true, force: true }); });
  return {
    get base() { return base; },
    async request(route, options = {}) { return request(server, route, options); },
    async restart() { server = await createApp({ dataDir, tmdbToken: '', ...options }); }
  };
}
const put = (connection, item) => ({ method: 'PUT', headers: { Authorization: `Bearer ${connection.writeToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(item) });

test('list mutations are persisted and immediately reflected in the Stremio catalog', async t => {
  const app = await fixture(t);
  const { body: connection, status } = await app.request('/api/libraries', { method: 'POST' });
  assert.equal(status, 201);
  const prefix = new URL(connection.manifestUrl).pathname.replace('/manifest.json', '');
  const { body: manifest } = await app.request(prefix + '/manifest.json');
  assert.deepEqual(manifest.types, ['movie', 'series']);
  assert.deepEqual(manifest.resources, ['catalog']);
  const { body: search } = await app.request('/api/search?q=Duna');
  const movie = search.items[0];
  assert.equal(movie.id, 'tt15239678');
  assert.equal((await app.request(`/api/libraries/${connection.id}/items`, put(connection, movie))).status, 200);
  // Duplicate writes do not duplicate catalog titles.
  await app.request(`/api/libraries/${connection.id}/items`, put(connection, movie));
  const catalog = await app.request(prefix + '/catalog/movie/cena-watchlist.json');
  assert.equal(catalog.body.metas.length, 1);
  assert.equal(catalog.body.metas[0].id, movie.id);
  assert.equal(catalog.headers.get('access-control-allow-origin'), '*');
  assert.equal(catalog.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await app.request(prefix + '/catalog/series/cena-watchlist.json')).body.metas, []);
  await app.restart();
  assert.equal((await app.request(prefix + '/catalog/movie/cena-watchlist.json')).body.metas.length, 1);
  await app.request(`/api/libraries/${connection.id}/items`, put(connection, { ...movie, status: 'watched' }));
  assert.deepEqual((await app.request(prefix + '/catalog/movie/cena-watchlist.json')).body.metas, []);
  const saved = await app.request(`/api/libraries/${connection.id}`, { headers: { Authorization: `Bearer ${connection.writeToken}` } });
  assert.equal(saved.body.items[0].status, 'watched');
  await app.request(`/api/libraries/${connection.id}/items/${movie.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${connection.writeToken}` } });
  assert.equal((await app.request(`/api/libraries/${connection.id}`, { headers: { Authorization: `Bearer ${connection.writeToken}` } })).body.items.length, 0);
});

test('private write credentials cannot be replaced by the public catalog link', async t => {
  const app = await fixture(t);
  const { body: a } = await app.request('/api/libraries', { method: 'POST' });
  const { body: b } = await app.request('/api/libraries', { method: 'POST' });
  const readToken = new URL(a.manifestUrl).pathname.split('/')[3];
  const { body: search } = await app.request('/api/search?q=Matrix');
  assert.equal((await app.request(`/api/libraries/${a.id}/items`, put({ writeToken: readToken }, search.items[0]))).status, 401);
  assert.equal((await app.request(`/api/libraries/${a.id}/items`, put(b, search.items[0]))).status, 401);
  assert.equal((await app.request(`/api/libraries/${a.id}`)).status, 401);
  const manifest = await app.request(new URL(a.manifestUrl).pathname);
  assert.ok(!JSON.stringify(manifest.body).includes(a.writeToken));
  const wrong = new URL(a.manifestUrl).pathname.replace(readToken, 'wrong');
  assert.equal((await app.request(wrong)).status, 404);
});

test('invalid titles, JSON and oversized payloads are rejected', async t => {
  const app = await fixture(t);
  const { body: c } = await app.request('/api/libraries', { method: 'POST' });
  const endpoint = `/api/libraries/${c.id}/items`;
  assert.equal((await app.request(endpoint, put(c, { id: '../anything', type: 'movie', name: 'Bad' }))).status, 400);
  assert.equal((await app.request(endpoint, { ...put(c, {}), body: '{' })).status, 400);
  assert.equal((await app.request(endpoint, put(c, { name: 'x'.repeat(40_000) }))).status, 413);
  assert.equal((await app.request('/api/search?q=a')).status, 400);
});

test('movie and series catalogs remain separated under concurrent writes', async t => {
  const app = await fixture(t, { publicBase: 'https://cena.example' });
  const { body: c } = await app.request('/api/libraries', { method: 'POST' });
  assert.ok(c.manifestUrl.startsWith('https://cena.example/'));
  await Promise.all([
    app.request(`/api/libraries/${c.id}/items`, put(c, { id: 'tt0133093', type: 'movie', name: 'Matrix' })),
    app.request(`/api/libraries/${c.id}/items`, put(c, { id: 'tt0903747', type: 'series', name: 'Breaking Bad' }))
  ]);
  const prefix = new URL(c.manifestUrl).pathname.replace('/manifest.json', '');
  assert.equal((await app.request(prefix + '/catalog/movie/cena-watchlist.json')).body.metas[0].name, 'Matrix');
  assert.equal((await app.request(prefix + '/catalog/series/cena-watchlist.json')).body.metas[0].name, 'Breaking Bad');
});

test('TMDB title lookup resolves the IMDb ID required by the players', async t => {
  const calls = [];
  const app = await fixture(t, { tmdbToken: 'test-token', fetcher: async (url, options) => {
    calls.push(url);
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return { ok: true, json: async () => url.includes('/external_ids') ? { imdb_id: 'tt0133093' } : { results: [{ media_type: 'movie', id: 603, title: 'Matrix', release_date: '1999-03-30', overview: 'Sinopse', poster_path: '/matrix.jpg' }, { media_type: 'person' }] } };
  } });
  const { body } = await app.request('/api/search?q=Matrix');
  assert.equal(body.mode, 'tmdb');
  assert.equal(body.items[0].id, 'tt0133093');
  assert.equal(body.items[0].type, 'movie');
  assert.equal(body.items[0].year, '1999');
  assert.equal(calls.length, 2);
});

// Loading the module graph repeatedly must not exhaust the API request budget.
test('static application modules and API traffic have independent rate limits',async t=>{
 const app=await fixture(t);
 for(let index=0;index<200;index++)assert.equal((await app.request('/nuvio-state.js')).status,200);
 for(let index=0;index<180;index++)assert.equal((await app.request('/api/config')).status,200);
 assert.equal((await app.request('/api/config')).status,429);
 assert.equal((await app.request('/nuvio-panel.js')).status,200);
 assert.equal((await app.request('/api/unknown.js')).status,429);
});

// Every local ES module referenced by app.js must resolve in browser previews.
test('cinematic Story module and background are served by the preview server', async t => {
 const app=await fixture(t);
 assert.equal((await app.request('/availability.js')).status,200);
 assert.equal((await app.request('/story-editor.js')).status,200);
 assert.equal((await app.request('/story-mist.png')).status,200);
});
