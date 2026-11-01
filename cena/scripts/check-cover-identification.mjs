import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { identifyCover } from '../web/identify-cover.js';

const fetcher = (url, options = {}) => fetch(url, { ...options, headers: { ...options.headers, 'User-Agent': 'CENA/0.4 (https://github.com/helbermoura2/teclado-br)' } });
for (const lines of [
  ['LSMARSHAIG'],
  ['LSMARSHAIG', 'TOMMY LEE JONES', 'WESLEY SNIPES', 'ROBERT DOWNEY JR.']
]) {
  const items = await identifyCover(lines, fetcher);
  console.log('Cover lookup:', JSON.stringify({ lines, results: items.map(item => ({ name: item.name, id: item.id, year: item.year, score: item.matchScore })) }));
  await mkdir('qa', { recursive: true });
  await writeFile('qa/cover-candidates.json', JSON.stringify(items, null, 2));
  assert.equal(items[0]?.id, 'tt0120873', 'The photographed OCR error must rank U.S. Marshals first before publishing the APK.');
}
