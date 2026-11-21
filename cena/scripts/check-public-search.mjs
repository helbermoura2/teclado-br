import assert from 'node:assert/strict';
import { searchPublicTitles, getTitleDetails } from '../web/search-public.js';

const publicFetch = (url, options = {}) => fetch(url, { ...options, headers: { ...options.headers, 'User-Agent': 'CENA/0.2 (https://github.com/helbermoura2/teclado-br)' } });
const results = await searchPublicTitles('Sisu', publicFetch);
assert.ok(results.some(item => item.id === 'tt14846026'), 'Live SISU search must return the 2022 film before shipping this APK.');
console.log('Live online search OK:', results.map(item => `${item.name} (${item.year}) ${item.id}`).join(', '));

const birds = await searchPublicTitles('AVES DE RAPINA', publicFetch);
console.log('Portuguese regional title lookup:', JSON.stringify(birds.map(item => ({id:item.id,name:item.name,year:item.year}))));
assert.ok(birds[0]?.id === 'tt7713068' && birds[0]?.year === '2020', 'Portuguese title must include Birds of Prey 2020.');
const details = await getTitleDetails(birds.find(item => item.id === 'tt7713068'), publicFetch);
assert.ok(details.description.length > 100, 'A real synopsis must be available.');
assert.ok(details.cast.length > 0 && details.runtime, 'Cast and runtime must load from the metadata provider.');
console.log('Real title details OK:', JSON.stringify({id:details.id,runtime:details.runtime,cast:details.cast.slice(0,3),synopsisLength:details.description.length}));
