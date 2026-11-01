import { offlineCatalog } from './offline-catalog.js';

export function createLocalApi(storage, settings = {}) {
  const key = 'cena.local.items.v1';
  const load = () => JSON.parse(storage.getItem(key) || '[]');
  const persist = items => storage.setItem(key, JSON.stringify(items));
  return async (route, options = {}) => {
    if (route === '/api/config') return { searchMode: settings.search ? 'public' : 'sample', publicConfigured: false, local: true };
    if (route.startsWith('/api/search?')) {
      const query = new URL('https://local.invalid' + route).searchParams.get('q') || '';
      if (settings.search) return { mode: 'public', items: await settings.search(query) };
      const norm = text => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      return { mode: 'sample', items: offlineCatalog.filter(item => norm(item.name + ' ' + item.originalName).includes(norm(query))) };
    }
    if (route === '/api/libraries' && options.method === 'POST') return { id: 'local', writeToken: '', items: load() };
    if (route === '/api/libraries/local') return { id: 'local', writeToken: '', items: load() };
    if (route === '/api/libraries/local/items' && options.method === 'PUT') {
      const item = JSON.parse(options.body);
      const items = [{ ...item, addedAt: new Date().toISOString() }, ...load().filter(row => row.id !== item.id)];
      persist(items); return { items };
    }
    if (route.startsWith('/api/libraries/local/items/') && options.method === 'DELETE') {
      const id = route.split('/').pop(); const items = load().filter(item => item.id !== id);
      persist(items); return { items };
    }
    throw Error('Operação indisponível no modo local.');
  };
}
