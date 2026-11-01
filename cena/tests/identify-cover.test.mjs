import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverQueries, identifyCover, normalizeTitle, scoreCover, similarity } from '../web/identify-cover.js';

const claim = value => ({ mainsnak: { datavalue: { value } } });
const film = { id: 'Q123', labels: { en: { value: 'U.S. Marshals' } }, descriptions: { en: { value: '1998 American film' } }, claims: { P345: [claim('tt0120873')], P31: [claim({ id: 'Q11424' })], P577: [claim({ time: '+1998-03-06T00:00:00Z' })] }, sitelinks: { enwiki: { title: 'U.S. Marshals (film)' } } };

test('punctuation and OCR substitutions are scored without title-specific substitutions', () => {
  assert.equal(normalizeTitle('U.S. Marshals'), 'usmarshals');
  assert.ok(similarity('LSMARSHAIG', 'U.S. Marshals') > similarity('LSMARSHAIG', 'Small Soldiers'));
  assert.ok(coverQueries(['LSMARSHAIG']).includes('intitle:marsh* hastemplate:Infobox_film'));
  assert.ok(coverQueries(['STRANGERTHlNGS']).some(query => query.includes('stran')));
});

test('cast-name evidence improves a possible match without automatically confirming it', () => {
  const item = { name: 'U.S. Marshals', originalName: 'U.S. Marshals', wikiTitle: 'U.S. Marshals (film)' };
  const plain = scoreCover(item, ['LSMARSHAIG']);
  const clues = scoreCover(item, ['LSMARSHAIG', 'TOMMY LEE JONES', 'WESLEY SNIPES'], 'Starring Tommy Lee Jones and Wesley Snipes.');
  assert.ok(clues > plain);
});

test('the reported garbled title recovers the film from a general catalog query', async () => {
  const queries = [];
  const fetcher = async raw => {
    const url = new URL(raw);
    let result;
    if (url.searchParams.get('action') === 'wbsearchentities') result = { search: [] };
    else if (url.searchParams.get('action') === 'wbgetentities') result = { entities: { Q123: film } };
    else {
      queries.push(url.searchParams.get('gsrsearch'));
      result = url.searchParams.get('gsrsearch').includes('marsh*') ? { query: { pages: { 1: { title: 'U.S. Marshals (film)', pageprops: { wikibase_item: 'Q123' }, extract: 'Starring Tommy Lee Jones and Wesley Snipes.', thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/en/poster.jpg' } } } } } : { query: { pages: {} } };
    }
    return { ok: true, json: async () => result };
  };
  const result = await identifyCover(['LSMARSHAIG'], fetcher);
  assert.equal(result[0].id, 'tt0120873');
  assert.equal(result[0].year, '1998');
  assert.equal(result[0].suggested, true);
  assert.ok(queries.length <= 4);
});

test('failed searches do not invent an identification', async () => {
  const result = await identifyCover(['NOTAREALFILMXYZ'], async () => ({ ok: true, json: async () => ({ search: [], query: { pages: {} } }) }));
  assert.deepEqual(result, []);
});

test('a network failure remains an error rather than a fabricated match', async () => {
  await assert.rejects(identifyCover(['LSMARSHAIG'], async () => { throw Error('offline'); }), /internet/);
});
