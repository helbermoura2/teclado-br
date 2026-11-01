import { searchPublicTitles, titleFromEntity } from './search-public.js';

export const normalizeTitle = text => String(text || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const cache = new Map();

export function similarity(left, right) {
  left = normalizeTitle(left); right = normalizeTitle(right);
  if (!left || !right) return 0;
  const prev = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i++) {
    let diagonal = prev[0]; prev[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const old = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = old;
    }
  }
  return 1 - prev[right.length] / Math.max(left.length, right.length);
}

export function coverQueries(lines) {
  const usable = [...new Set(lines.filter(value => typeof value === 'string').map(value => value.trim()).filter(value => value.length >= 3 && value.length <= 100))];
  const primary = usable[0] || '';
  const compact = normalizeTitle(primary);
  const queries = [];
  // Prefix windows recover an attached/misread initial such as "LSMARSHAIG".
  // There are no title-specific corrections or actor-name lookup tables.
  if (compact.length >= 6) {
    for (let offset = 0; offset <= Math.min(2, compact.length - 5); offset++) {
      queries.push(`intitle:${compact.slice(offset, offset + 5)}* film`);
    }
  }
  if (!queries.length) queries.push(`${primary.replace(/[^\p{L}\p{N} ]/gu, ' ')} film`);
  const clues = usable.slice(1).map(value => value.replace(/[^\p{L} .'-]/gu, '').trim()).filter(value => {
    const words = value.split(/\s+/);
    return words.length >= 2 && words.length <= 5 && value.length <= 50 && !/coming|march|produced|directed|presents|copyright|trailer|subscribe|assistir|cinema|legendado|dublado/i.test(value);
  }).slice(0, 3);
  if (clues.length >= 2) queries.unshift(`"${clues[0].replaceAll('"', '')}" "${clues[1].replaceAll('"', '')}" film`);
  else queries.unshift(`intitle:${compact || primary}~2 film`);
  return [...new Set(queries)].slice(0, 4);
}

async function json(fetcher, base, params) {
  const url = new URL(base);
  url.search = new URLSearchParams({ format: 'json', origin: '*', ...params });
  const response = await fetcher(url.toString(), { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw Error('Não consegui consultar o catálogo. Confira a internet e tente novamente.');
  const value = await response.json();
  if (value.error) throw Error('O catálogo está indisponível no momento. Tente novamente.');
  return value;
}

export function scoreCover(item, lines, extract = '') {
  const labels = [item.name, item.originalName, item.wikiTitle?.replace(/\([^)]*\)/g, '')].filter(Boolean);
  const primary = lines[0] || '';
  const titleScore = Math.max(0, ...labels.map(label => similarity(primary, label)));
  const secondaryTitle = Math.max(0, ...lines.slice(1, 6).flatMap(line => labels.map(label => similarity(line, label))));
  const description = normalizeTitle(extract + ' ' + item.description);
  const clues = lines.slice(1).filter(line => line.split(/\s+/).length >= 2 && normalizeTitle(line).length >= 7);
  const hits = clues.filter(line => description.includes(normalizeTitle(line))).length;
  // Two cast-name clues can rescue a badly read title, without claiming certainty.
  return Math.min(1, Math.max(titleScore, secondaryTitle * .9) * .85 + Math.min(hits, 3) * .12);
}

export async function identifyCover(lines, fetcher = fetch) {
  lines = [...new Set(lines.filter(value => typeof value === 'string').map(value => value.trim()).filter(Boolean))].slice(0, 24);
  const primary = (lines[0] || '').slice(0, 150);
  if (primary.length < 2) return [];
  const key = lines.join('\n').toLowerCase();
  if (fetcher === fetch && cache.get(key)?.until > Date.now()) return structuredClone(cache.get(key).items);
  let exact = [];
  try { exact = await searchPublicTitles(primary, fetcher); } catch { /* The independent wiki search can still succeed. */ }
  if (exact.some(item => Math.max(similarity(primary, item.name), similarity(primary, item.originalName)) > .93)) return exact;
  const queries = coverQueries(lines);
  const replies = await Promise.allSettled(queries.map(query => json(fetcher, 'https://en.wikipedia.org/w/api.php', {
    action: 'query', generator: 'search', gsrsearch: query, gsrnamespace: '0', gsrlimit: '10',
    prop: 'pageprops|pageimages|extracts', piprop: 'thumbnail', pithumbsize: '500', pilicense: 'any',
    exintro: '1', explaintext: '1', exchars: '1800'
  })));
  const successful = replies.filter(reply => reply.status === 'fulfilled');
  if (!successful.length && !exact.length) throw Error('Não consegui identificar o título online. Confira a internet e tente novamente.');
  const pages = new Map();
  for (const reply of successful) for (const page of Object.values(reply.value.query?.pages || {})) {
    const id = page.pageprops?.wikibase_item;
    if (/^Q\d+$/.test(id || '') && !pages.has(id)) pages.set(id, page);
  }
  let suggestions = [];
  if (pages.size) {
    const data = await json(fetcher, 'https://www.wikidata.org/w/api.php', { action: 'wbgetentities', ids: [...pages.keys()].slice(0, 40).join('|'), props: 'claims|labels|descriptions|sitelinks', languages: 'pt|en', sitefilter: 'enwiki' });
    for (const [id, page] of pages) {
      const item = titleFromEntity(data.entities?.[id] || {});
      if (!item) continue;
      const score = scoreCover(item, lines, page.extract || '');
      if (score < .40) continue;
      const poster = page.thumbnail?.source;
      if (typeof poster === 'string' && poster.startsWith('https://upload.wikimedia.org/')) item.poster = poster;
      if (page.extract) item.description = page.extract.slice(0, 1800);
      suggestions.push({ ...item, matchScore: score, suggested: true });
    }
  }
  const merged = new Map();
  for (const item of [...exact.map(item => ({ ...item, matchScore: scoreCover(item, lines) })), ...suggestions]) {
    if (!merged.has(item.id) || merged.get(item.id).matchScore < item.matchScore) merged.set(item.id, item);
  }
  const items = [...merged.values()].sort((a, b) => b.matchScore - a.matchScore).slice(0, 8);
  if (cache.size > 80) cache.clear();
  if (fetcher === fetch) cache.set(key, { items: structuredClone(items), until: Date.now() + 300000 });
  return items;
}

export const searchTolerantTitles = query => identifyCover([query]);
