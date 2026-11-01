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

export function coverInput(result) {
  const lines = [...new Set((result.lines || []).filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))];
  const phrases = (result.phrases || []).filter(value => typeof value === 'string' && value.trim().length <= 150);
  const query = [result.title, ...phrases, lines[0]].find(value => typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 150)?.trim() || '';
  return { query, lines: [...new Set([query, ...lines, ...phrases, ...String(result.fullText || '').split('\n')])].filter(Boolean).slice(0, 24) };
}

export function coverQueries(lines) {
  const usable = [...new Set(lines.filter(value => typeof value === 'string').map(value => value.trim()).filter(value => value.length >= 3 && value.length <= 150))];
  const primary = usable[0] || '';
  const anchor = usable.find(value => value.split(/\s+/).length === 1 && normalizeTitle(value).length >= 5) || primary;
  const compact = normalizeTitle(anchor);
  const queries = [];
  // Search the complete assembled phrase as well as independent OCR fragments.
  if (primary.split(/\s+/).length > 1) queries.push(primary.replace(/[^\p{L}\p{N} ]/gu, ' ') + ' film');
  queries.push(`intitle:${compact || primary}~2`);
  if (compact.length >= 6) for (let offset = 0; offset <= Math.min(2, compact.length - 5); offset++) {
    queries.push(`intitle:${compact.slice(offset, offset + 5)}* hastemplate:Infobox_film`);
  }
  const supporting = [...new Set(usable.join(' ').match(/[\p{L}]{3,}/gu) || [])]
    .filter(word => similarity(word, anchor) < .65 && !/^(the|and|for|with|from|film|coming|march|produced|directed|presents)$/i.test(word)).slice(0, 6);
  if (compact.length >= 5 && supporting.length) queries.unshift(`intitle:${compact.slice(0,5)}* (${supporting.map(word => `intitle:${word.slice(0,5)}*`).join(' OR ')}) hastemplate:Infobox_film`);
  return [...new Set(queries)].slice(0, 6);
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

// Recover short supporting words even when OCR joins words or misreads a letter.
// Require two distinct clues outside the primary word to avoid one-word matches.
function supportingClues(labels, lines) {
  const context = normalizeTitle(lines.slice(1).join(' ')).slice(0, 1800);
  const primary = lines[0] || '';
  if (!context || lines.length < 2) return 0;
  const common = new Set(['the', 'and', 'for', 'with', 'from', 'you', 'are', 'its', 'that', 'this', 'her', 'his']);
  const tokens = labels.flatMap(label => label.toLowerCase().replace(/['’]/g, '').match(/[a-z]+/g) || []);
  const words = [...new Set([...tokens, ...tokens.slice(1).map((word, i) => tokens[i] + word)])]
    .filter(word => word.length >= 3 && !common.has(word) && similarity(word, primary) < .7);
  let hits = 0;
  for (const word of words) {
    let match = context.includes(word);
    if (!match && word.length >= 4) for (let i = 0; i <= context.length - word.length; i++) {
      let differences = 0;
      const allowed = Math.floor(word.length * .22);
      for (let j = 0; j < word.length; j++) {
        if (word[j] !== context[i + j] && ++differences > allowed) break;
      }
      if (differences <= allowed) { match = true; break; }
    }
    if (match) hits++;
  }
  return hits >= 2 ? Math.min(.24, hits * .12) : 0;
}

export function scoreCover(item, lines, extract = '') {
  const labels = [item.name, item.originalName, ...(item.aliases || []), item.localWikiTitle, item.wikiTitle?.replace(/\([^)]*\)/g, '')].filter(Boolean);
  const primary = lines[0] || '';
  const titleScore = Math.max(0, ...labels.map(label => similarity(primary, label)));
  const secondaryTitle = Math.max(0, ...lines.slice(1, 10).flatMap(line => labels.map(label => similarity(line, label) * (normalizeTitle(line).length > normalizeTitle(primary).length + 6 ? .98 : .9))));
  const words = labels.flatMap(label => label.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/)).filter(word => normalizeTitle(word).length >= 5);
  const fragment = normalizeTitle(primary).length >= 5 && primary.trim().split(/\s+/).length === 1 ? Math.max(0, ...words.map(word => similarity(primary, word))) * .65 : 0;
  const labelClues = lines.slice(1).filter(line => { const part = normalizeTitle(line); return part.length >= 4 && part.length <= 60 && labels.some(label => normalizeTitle(label).includes(part)); }).length;
  const labelBonus = Math.max(labelClues >= 2 ? Math.min(.24, labelClues * .08) : 0, supportingClues(labels, lines));
  const description = normalizeTitle(extract + ' ' + item.description);
  const clues = lines.slice(1).filter(line => line.split(/\s+/).length >= 2 && normalizeTitle(line).length >= 7);
  const hits = clues.filter(line => description.includes(normalizeTitle(line))).length;
  // Two cast-name clues can rescue a badly read title, without claiming certainty.
  return Math.min(1, Math.max(titleScore * .85, secondaryTitle * .85, fragment) + Math.min(hits, 3) * .12 + labelBonus);
}

export async function identifyCover(lines, fetcher = fetch) {
  lines = [...new Set(lines.filter(value => typeof value === 'string').map(value => value.trim()).filter(Boolean))].slice(0, 24);
  const primary = (lines[0] || '').slice(0, 150);
  if (primary.length < 2) return [];
  const key = lines.join('\n').toLowerCase();
  if (fetcher === fetch && cache.get(key)?.until > Date.now()) return structuredClone(cache.get(key).items);
  let exact = [];
  try { exact = await searchPublicTitles(primary, fetcher); } catch { /* The independent wiki search can still succeed. */ }
  if (lines.length === 1 && primary.trim().split(/\s+/).length > 1 && exact.some(item => Math.max(similarity(primary, item.name), similarity(primary, item.originalName)) > .93)) return exact;
  const queries = coverQueries(lines);
  const replies = await Promise.allSettled(queries.map(query => json(fetcher, 'https://en.wikipedia.org/w/api.php', {
    action: 'query', generator: 'search', gsrsearch: query, gsrnamespace: '0', gsrlimit: '50',
    prop: 'pageprops|pageimages|extracts', exlimit: 'max', pilimit: '50', piprop: 'thumbnail', pithumbsize: '500', pilicense: 'any',
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
    const relevant = [...pages.entries()].map(([id, page]) => ({ id, page,
      score: scoreCover({ name: page.title.replace(/\([^)]*\)/g, '') }, lines, page.extract || '')
    })).sort((a, b) => b.score - a.score).slice(0, 40).map(({ id, page }) => [id, page]);
    const data = await json(fetcher, 'https://www.wikidata.org/w/api.php', { action: 'wbgetentities', ids: relevant.map(([id]) => id).join('|'), props: 'claims|labels|descriptions|sitelinks', languages: 'pt|en', sitefilter: 'enwiki' });
    for (const [id, page] of relevant) {
      const item = titleFromEntity(data.entities?.[id] || {});
      if (!item) continue;
      const score = scoreCover(item, lines, page.extract || '');
      if (score < .40) continue;
      const poster = page.thumbnail?.source;
      if (typeof poster === 'string' && poster.startsWith('https://upload.wikimedia.org/')) item.poster = poster;
      if (page.extract) item.description = page.extract.slice(0, 1800);
      const partialTitle = normalizeTitle(item.originalName).length > normalizeTitle(primary).length + 6 && item.originalName.split(/\s+/).some(word => similarity(primary, word) > .7);
      suggestions.push({ ...item, matchScore: score, suggested: true, partialTitle });
    }
  }
  const merged = new Map();
  for (const item of [...exact.map(item => ({ ...item, matchScore: scoreCover(item, lines) })), ...suggestions]) {
    if (!merged.has(item.id) || merged.get(item.id).matchScore < item.matchScore) merged.set(item.id, item);
  }
  const items = [...merged.values()].sort((a, b) => b.matchScore - a.matchScore).slice(0, 8);
  if (items.some(item => item.partialTitle)) for (const item of items) item.ambiguousTitle = true;
  if (cache.size > 80) cache.clear();
  if (fetcher === fetch) cache.set(key, { items: structuredClone(items), until: Date.now() + 300000 });
  return items;
}

export const searchTolerantTitles = query => identifyCover([query]);
