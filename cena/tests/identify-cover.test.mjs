import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverInput, coverQueries, identifyCover, normalizeTitle, scoreCover, similarity } from '../web/identify-cover.js';

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
  assert.ok(queries.filter(query => query?.includes('intitle:')).length <= 6);
});

test('failed searches do not invent an identification', async () => {
  const result = await identifyCover(['NOTAREALFILMXYZ'], async () => ({ ok: true, json: async () => ({ search: [], query: { pages: {} } }) }));
  assert.deepEqual(result, []);
});

test('a network failure remains an error rather than a fabricated match', async () => {
  await assert.rejects(identifyCover(['LSMARSHAIG'], async () => { throw Error('offline'); }), /internet/);
});

test('a multi-line title outranks an unrelated movie with the same last word', () => {
  const lines = ['Margahet.', "Are You There God? It's Me, Margahet.", 'Are You', 'There God?', "It's Me,"];
  const correct = { name: "Are You There God? It's Me, Margaret.", originalName: "Are You There God? It's Me, Margaret." };
  const other = { name: 'Margaret', originalName: 'Margaret' };
  assert.ok(scoreCover(correct, lines) > scoreCover(other, lines));
  assert.ok(scoreCover(correct, ['Margahet.']) >= .4, 'The full title must remain a candidate even if only its last word is readable.');
});

test('real Android OCR fragments distinguish a long title from a different film sharing its last word', () => {
  const lines = ['Margaiet.', 'AeloGod Jhere Tts Me, Margaiet.', 'AeloGod Margaiet.', 'Jhere Tts Me,', 'AeloGod', 'Tts Me,', 'Jhere'];
  const correct = { name: "Are You There God? It's Me, Margaret." };
  assert.ok(scoreCover(correct, lines) > scoreCover({ name: 'Margaret' }, lines));
  assert.ok(scoreCover(correct, lines) > scoreCover({ name: 'The Master and Margaret' }, lines));
});

test('the new phone OCR searches the assembled phrase and distinguishes the full film title', () => {
  const input = coverInput({ title: 'Jheye God9 ItsMe, Margatet.', lines: ['Margatet.', 'Jheye God9', 'ItsMe,'], phrases: ['Jheye God9 ItsMe, Margatet.'] });
  assert.equal(input.query, 'Jheye God9 ItsMe, Margatet.');
  assert.ok(coverQueries(input.lines).some(query => query.includes('Jheye God9 ItsMe')));
  assert.ok(scoreCover({ name: "Are You There God? It's Me, Margaret." }, input.lines) > scoreCover({ name: 'Margaret' }, input.lines));
});


test('broken spacing in the reported Hiroshima screenshot recovers the full catalog title even when Wikidata is limited',async()=>{
 const {coverSearchPhrases}=await import('../web/identify-cover.js');const lines=['HROSHIN 0 UT OF THE A SHES','HROSHIN','0 UT OF THE A SHES'];assert.ok(coverSearchPhrases(lines).includes('OUT OF THE ASHES'));
 const fetcher=async raw=>{const url=new URL(raw);if(url.searchParams.get('action')==='wbgetentities')return {ok:false};if(url.host==='v3-cinemeta.strem.io')return {ok:true,json:async()=>({metas:decodeURIComponent(url.pathname).includes('OUT OF THE ASHES')&&url.pathname.includes('/movie/')?[{id:'tt0099772',name:'Hiroshima: Out of the Ashes',releaseInfo:'1990'}]:[]})};if(url.searchParams.get('action')==='wbsearchentities')return {ok:true,json:async()=>({search:[]})};return {ok:true,json:async()=>({query:{pages:{1:{title:'Hiroshima: Out of the Ashes',pageprops:{wikibase_item:'Q123'},extract:'A 1990 film.'}}}})};};
 const rows=await identifyCover(lines,fetcher);assert.equal(rows[0].id,'tt0099772');assert.equal(rows[0].year,'1990');
});
test('Gemini camera hints are search inputs; only real catalog IDs can become cards',async()=>{
 const {verifyCameraTitles}=await import('../web/identify-cover.js');const rows=await verifyCameraTitles({titles:[{title:'Hiroshima: Out of the Ashes',year:'1990',type:'movie',id:'tt-invented'}]},[],{search:async()=>[{id:'tt0099772',type:'movie',name:'Hiroshima: Out of the Ashes',year:'1990'},{id:'invented',type:'movie',name:'Hiroshima: Out of the Ashes'},{id:'tt9999999',type:'series',name:'Hiroshima: Out of the Ashes'}]});assert.equal(rows.length,1);assert.equal(rows[0].id,'tt0099772');
});
