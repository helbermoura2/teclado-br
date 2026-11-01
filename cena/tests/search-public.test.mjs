import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchPublicTitles, titleFromEntity } from '../web/search-public.js';
import { createLocalApi } from '../web/local-api.js';

const claim = value => ({ mainsnak: { datavalue: { value } } });
const film = { id: 'Q123', labels: { en: { value: 'Sisu' } }, descriptions: { en: { value: '2022 film directed by Jalmari Helander' } }, claims: { P345: [claim('tt14846026')], P31: [claim({ id: 'Q11424' })], P577: [claim({ time: '+2022-09-09T00:00:00Z' })] }, sitelinks: { enwiki: { title: 'Sisu (film)' } } };

test('SISU is found online and carries its IMDb identifier through the local list', async () => {
  const calls = [];
  const fetcher = async raw => {
    const url = new URL(raw); calls.push(url);
    let result;
    if (url.searchParams.get('action') === 'wbsearchentities') result = { search: [{ id: 'Q123' }, { id: 'Q456' }] };
    else if (url.searchParams.get('action') === 'wbgetentities') result = { entities: { Q123: film, Q456: { ...film, id: 'Q456', claims: { P345: [claim('nm1234567')], P31: [claim({ id: 'Q5' })] } } } };
    else result = { query: { pages: { 1: { title: 'Sisu (film)', thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/en/sisu.jpg' } } } } };
    return { ok: true, json: async () => result };
  };
  const map = new Map();
  const api = createLocalApi({ getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) }, { search: query => searchPublicTitles(query, fetcher) });
  const { items } = await api('/api/search?q=SISU');
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'tt14846026');
  assert.equal(items[0].year, '2022');
  assert.ok(items[0].poster.startsWith('https://upload.wikimedia.org/'));
  assert.equal(calls.length, 4);
  await api('/api/libraries/local/items', { method: 'PUT', body: JSON.stringify({ ...items[0], status: 'watchlist' }) });
  assert.equal((await api('/api/libraries/local')).items[0].id, 'tt14846026');
  assert.equal((await api('/api/config')).searchMode, 'public');
});

test('online failure is reported instead of looking like no search results', async () => {
  await assert.rejects(searchPublicTitles('Sisu', async () => { throw Error('offline'); }), /internet/);
});

test('optional poster failure does not discard a recognized film', async () => {
  const items = await searchPublicTitles('Sisu', async raw => {
    const url = new URL(raw);
    if (url.hostname === 'en.wikipedia.org') throw Error('thumbnail unavailable');
    return { ok: true, json: async () => url.searchParams.get('action') === 'wbsearchentities' ? { search: [{ id: 'Q123' }] } : { entities: { Q123: film } } };
  });
  assert.equal(items[0].name, 'Sisu');
  assert.equal(items[0].poster, '');
});

test('series are distinguished from films and people are excluded', () => {
  assert.equal(titleFromEntity({ ...film, claims: { ...film.claims, P31: [claim({ id: 'Q5398426' })] } }).type, 'series');
  assert.equal(titleFromEntity({ ...film, claims: { ...film.claims, P31: [claim({ id: 'Q5' })] } }), null);
});
