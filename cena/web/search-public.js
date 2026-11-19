const endpoint = 'https://www.wikidata.org/w/api.php';
const filmClasses = new Set(['Q11424', 'Q506240', 'Q24862', 'Q202866']);
const seriesClasses = new Set(['Q5398426', 'Q1259759', 'Q639669']);
const cache = new Map();

async function getJson(fetcher, base, params) {
  const url = new URL(base);
  url.search = new URLSearchParams({ format: 'json', origin: '*', ...params });
  const response = await fetcher(url.toString(), { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw Error('A busca online está indisponível. Confira sua conexão e tente novamente.');
  const data = await response.json();
  if (data.error) throw Error('A busca online está temporariamente indisponível. Tente novamente.');
  return data;
}

const values = (entity, property) => (entity.claims?.[property] || []).map(claim => claim.mainsnak?.datavalue?.value).filter(Boolean);

export function titleFromEntity(entity) {
  const id = values(entity, 'P345').find(value => typeof value === 'string' && /^tt\d{5,12}$/.test(value));
  const classes = values(entity, 'P31').map(value => value.id);
  const description = entity.descriptions?.pt?.value || entity.descriptions?.en?.value || '';
  if (!id || classes.includes('Q5')) return null;
  const series = classes.some(value => seriesClasses.has(value)) || /television series|tv series|miniseries|série de televisão|série televisiva/i.test(description);
  const film = classes.some(value => filmClasses.has(value)) || /\bfilm\b|\bfilme\b/i.test(description);
  if (!series && !film) return null;
  const name = entity.labels?.pt?.value || entity.labels?.en?.value;
  if (!name) return null;
  const dates = values(entity, 'P577').map(value => value.time).filter(Boolean).sort();
  const year = dates[0]?.match(/^\+?(\d{4})/)?.[1] || '';
  return {
    id, type: series ? 'series' : 'movie', name, originalName: entity.labels?.en?.value || name,
    year, genre: series ? 'Série' : 'Filme', description, poster: '',
    source: 'Wikidata / Wikipédia', sourceUrl: `https://www.wikidata.org/wiki/${entity.id}`,
    wikiTitle: entity.sitelinks?.enwiki?.title || '', localWikiTitle: entity.sitelinks?.ptwiki?.title || '',
    aliases: [...(entity.aliases?.pt || []), ...(entity.aliases?.en || [])].map(value => value.value)
  };
}

const normalized = value => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
async function publicJson(fetcher, url) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw Error('Catálogo indisponível.');
  return response.json();
}
function cinemetaItem(meta) {
  if (!/^tt\d{5,12}$/.test(meta?.imdb_id || meta?.id || '') || !['movie','series'].includes(meta.type) || !meta.name) return null;
  return { id: meta.imdb_id || meta.id, type: meta.type, name: meta.name, originalName: meta.name,
    year: String(meta.releaseInfo || meta.year || '').slice(0,4), description: meta.description || '',
    poster: /^https:\/\//.test(meta.poster || '') ? meta.poster : '', backdrop: meta.background || '', genre: (meta.genres || []).join(' · '),
    genres: meta.genres || [], cast: meta.cast || [], directors: Array.isArray(meta.director) ? meta.director : meta.director ? [meta.director] : [],
    runtime: meta.runtime || '', rating: meta.imdbRating || '', imdbRating:meta.imdbRating??null, imdbRatingAt:Date.now(), source: 'Cinemeta', sourceUrl: `https://www.imdb.com/title/${meta.imdb_id || meta.id}/` };
}
const catalogUrl = (type, query) => `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(query)}.json`;
function relevance(item, query) {
  const key = normalized(query);
  const significant = key.split(' ').filter(word => !['de','da','do','das','dos','a','o','as','os','the','of','and'].includes(word));
  const labels = [item.name, item.originalName, item.wikiTitle, item.localWikiTitle, ...(item.aliases || [])].map(normalized).filter(Boolean);
  const lexical = Math.max(0, ...labels.map(label => label === key ? 1 : label.startsWith(key + ' ') ? .95 : label.includes(key) ? .85 : significant.filter(word => label.split(' ').includes(word)).length / Math.max(1, significant.length) * .75));
  return lexical + (item.wikiRank === undefined ? 0 : .18 / (item.wikiRank + 1));
}

// Independent catalog sources: regional article titles/redirects, Wikidata aliases and Cinemeta.
export async function searchPublicTitles(query, fetcher = fetch) {
  query = query.trim();
  if (query.length < 2 || query.length > 150) throw Error('Digite entre 2 e 150 caracteres.');
  const key = query.toLocaleLowerCase('pt-BR');
  if (fetcher === fetch && cache.get(key)?.until > Date.now()) return structuredClone(cache.get(key).items);
  const tasks = [
    ...['pt','en'].map(language => getJson(fetcher, endpoint, { action:'wbsearchentities', search:query, language, uselang:'pt', type:'item', limit:'20' })),
    ...['pt','en'].map(language => getJson(fetcher, `https://${language}.wikipedia.org/w/api.php`, { action:'query', generator:'search', gsrsearch:'"' + query.replaceAll('"','') + '"', gsrnamespace:'0', gsrlimit:'20', prop:'pageprops|pageimages|extracts', exintro:'1', explaintext:'1', exchars:'2000', exlimit:'max', piprop:'thumbnail', pithumbsize:'500', pilimit:'20', pilicense:'any' })),
    ...['movie','series'].map(type => publicJson(fetcher, catalogUrl(type, query)))
  ];
  const replies = await Promise.allSettled(tasks);
  if (replies.every(reply => reply.status === 'rejected')) throw Error('Não consegui consultar o catálogo online. Confira a internet e tente novamente.');
  const value = i => replies[i]?.status === 'fulfilled' ? replies[i].value : {};
  const pages = new Map();
  for (const i of [2,3]) for (const page of Object.values(value(i).query?.pages || {})) {
    const id = page.pageprops?.wikibase_item;
    if (/^Q\d+$/.test(id || '') && (!pages.has(id) || i === 2)) pages.set(id, { ...page, language:i === 2 ? 'pt':'en', rank: Math.max(0, (page.index || 1)-1) });
  }
  const ids = [...new Set([...pages.keys(), ...[0,1].flatMap(i => (value(i).search || []).map(row => row.id))])].filter(id => /^Q\d+$/.test(id)).slice(0,50);
  const unique = new Map();
  for (const i of [4,5]) for (const meta of value(i).metas || []) { const item = cinemetaItem(meta); if (item) unique.set(item.id,item); }
  if (ids.length) {
    try {
      const data = await getJson(fetcher, endpoint, { action:'wbgetentities', ids:ids.join('|'), props:'claims|labels|descriptions|sitelinks|aliases', languages:'pt|en', sitefilter:'ptwiki|enwiki' });
      for (const id of ids) {
        const item = titleFromEntity(data.entities?.[id] || {}); if (!item) continue;
        const page = pages.get(id);
        if (page) {
          item.wikiRank = page.rank;
          if (page.language === 'pt') item.localWikiTitle = page.title;
          if (page.extract) {
            item.description = page.extract;
            if (normalized(page.extract).includes(normalized(query))) item.aliases = [...(item.aliases || []), query];
          }
          if (page.thumbnail?.source?.startsWith('https://upload.wikimedia.org/')) item.poster = page.thumbnail.source;
        }
        const previous = unique.get(item.id);
        unique.set(item.id, { ...previous, ...item, poster:item.poster || previous?.poster || '', genre: previous?.genre || item.genre });
      }
    } catch { if (!unique.size) throw Error('Não consegui carregar os títulos. Confira a internet e tente novamente.'); }
  }
  const items = [...unique.values()].sort((a,b) => relevance(b,query)-relevance(a,query)).slice(0,20);
  const missing = items.filter(item => !item.poster && item.wikiTitle);
  if (missing.length) try {
    const data = await getJson(fetcher, 'https://en.wikipedia.org/w/api.php', { action:'query', titles:missing.map(item => item.wikiTitle).join('|'), prop:'pageimages', piprop:'thumbnail', pithumbsize:'500', pilicense:'any', redirects:'1' });
    for (const item of missing) {
      const title = data.query?.redirects?.find(row => row.from === item.wikiTitle)?.to || item.wikiTitle;
      const source = Object.values(data.query?.pages || {}).find(page => page.title === title)?.thumbnail?.source;
      if (source?.startsWith('https://upload.wikimedia.org/')) item.poster = source;
    }
  } catch { /* A missing poster never hides a title. */ }
  if (cache.size > 100) cache.clear();
  if (fetcher === fetch) cache.set(key, {items:structuredClone(items), until:Date.now()+300000});
  return items;
}

const detailCache = new Map();
export async function getTitleDetails(item, fetcher = fetch) {
  if (!/^tt\d{5,12}$/.test(item.id)) return item;
  if (fetcher === fetch && detailCache.has(item.id)) return structuredClone(detailCache.get(item.id));
  const requests = [publicJson(fetcher, `https://v3-cinemeta.strem.io/meta/${item.type === 'series' ? 'series':'movie'}/${item.id}.json`)];
  const title = item.localWikiTitle || item.wikiTitle;
  if (title) requests.push(getJson(fetcher, `https://${item.localWikiTitle ? 'pt':'en'}.wikipedia.org/w/api.php`, {action:'query',titles:title,redirects:'1',prop:'extracts',exintro:'1',explaintext:'1',exchars:'4000'}));
  const replies = await Promise.allSettled(requests);
  const responseMeta = replies[0].status === 'fulfilled' ? cinemetaItem(replies[0].value.meta) : null;
  const meta=responseMeta?.id===item.id&&responseMeta.type===item.type?responseMeta:null;
  const page = replies[1]?.status === 'fulfilled' ? Object.values(replies[1].value.query?.pages || {}).find(page => page.extract) : null;
  const result = { ...item, ...((!item.name || /^tt\d+$/.test(item.name)) && meta?.id===item.id && meta.type===item.type ? {name:meta.name} : {}), year:item.year || (meta?.id===item.id ? meta.year : '') || '', poster: item.poster || (meta?.id===item.id ? meta.poster : '') || '', ...(meta ? {backdrop:item.backdrop || meta.backdrop,runtime:meta.runtime,rating:meta.rating,imdbRating:meta.imdbRating,imdbRatingAt:meta.imdbRatingAt,cast:meta.cast,directors:meta.directors,genres:meta.genres,genre:meta.genre || item.genre} : {}),
    plot: meta?.id===item.id&&meta.type===item.type ? meta.description : item.plot||'',
    description: page?.extract || meta?.description || item.description || '',
    detailsAvailable: Boolean(meta || page), detailError: replies.every(reply => reply.status === 'rejected') ? 'Não consegui carregar mais informações. Confira a conexão e tente novamente.' : '' };
  if (fetcher === fetch && result.detailsAvailable) { if(detailCache.size>100) detailCache.clear(); detailCache.set(item.id,structuredClone(result)); }
  return result;
}
