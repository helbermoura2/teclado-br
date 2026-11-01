import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { coverInput, identifyCover } from '../web/identify-cover.js';

const fetcher = (url, options = {}) => fetch(url, { ...options, headers: { ...options.headers, 'User-Agent': 'CENA/0.4.1 (https://github.com/helbermoura2/teclado-br)' } });
const cases = JSON.parse(await readFile('qa/native-ocr.json', 'utf8'));
for (const { expected, payload } of cases) {
  const { query, lines } = coverInput(payload);
  assert.ok(query, 'Native OCR must reconstruct a title to search.');
  const items = await identifyCover(lines, fetcher);
  console.log('Real Android OCR to catalog:', JSON.stringify({ expected, lines, results: items.map(item => ({ id: item.id, name: item.name, year: item.year, score: item.matchScore })) }));
  assert.equal(items[0]?.id, expected, 'Actual Android OCR of the supplied photo must recover the correct film first.');
}
