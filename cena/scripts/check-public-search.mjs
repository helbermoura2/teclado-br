import assert from 'node:assert/strict';
import { searchPublicTitles } from '../web/search-public.js';

const publicFetch = (url, options = {}) => fetch(url, { ...options, headers: { ...options.headers, 'User-Agent': 'CENA/0.2 (https://github.com/helbermoura2/teclado-br)' } });
const results = await searchPublicTitles('Sisu', publicFetch);
assert.ok(results.some(item => item.id === 'tt14846026'), 'Live SISU search must return the 2022 film before shipping this APK.');
console.log('Live online search OK:', results.map(item => `${item.name} (${item.year}) ${item.id}`).join(', '));
