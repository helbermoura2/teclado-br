import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalApi } from '../web/local-api.js';

test('Android local list persists across restarts and does not invent a manifest', async () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const api = createLocalApi(storage);
  const connection = await api('/api/libraries', { method: 'POST' });
  assert.equal(connection.manifestUrl, undefined);
  const search = await api('/api/search?q=duna');
  assert.equal(search.items[0].id, 'tt15239678');
  const item = { ...search.items[0], status: 'watchlist' };
  await api('/api/libraries/local/items', { method: 'PUT', body: JSON.stringify(item) });
  await api('/api/libraries/local/items', { method: 'PUT', body: JSON.stringify(item) });
  const restarted = createLocalApi(storage);
  const restored = await restarted('/api/libraries/local');
  assert.equal(restored.items.length, 1);
  assert.equal(restored.items[0].name, 'Duna: Parte Dois');
  await restarted('/api/libraries/local/items', { method: 'PUT', body: JSON.stringify({ ...item, status: 'watched' }) });
  assert.equal((await api('/api/libraries/local')).items[0].status, 'watched');
  await api('/api/libraries/local/items/tt15239678', { method: 'DELETE' });
  assert.deepEqual((await restarted('/api/libraries/local')).items, []);
});

test('local title matching handles accents and original titles', async () => {
  const api = createLocalApi({ getItem: () => null, setItem() {} });
  assert.equal((await api('/api/search?q=interstellar')).items[0].name, 'Interestelar');
  assert.equal((await api('/api/search?q=nao-existe')).items.length, 0);
  assert.equal((await api('/api/config')).local, true);
});
