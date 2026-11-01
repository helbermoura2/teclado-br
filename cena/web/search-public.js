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
    wikiTitle: entity.sitelinks?.enwiki?.title || ''
  };
}

// Public Wikimedia APIs; no app-server, user account or API key is required.
// Wikipedia thumbnails are optional; a failure there must not hide a found title.
export async function searchPublicTitles(query, fetcher = fetch) {
  query = query.trim();
  if (query.length < 2 || query.length > 150) throw Error('Digite entre 2 e 150 caracteres.');
  const key = query.toLocaleLowerCase('pt-BR');
  if (fetcher === fetch && cache.get(key)?.until > Date.now()) return structuredClone(cache.get(key).items);
  let searches;
  try {
    searches = await Promise.all(['pt', 'en'].map(language => getJson(fetcher, endpoint, { action: 'wbsearchentities', search: query, language, uselang: 'pt', type: 'item', limit: '20' })));
  } catch { throw Error('Não consegui consultar o catálogo online. Confira a internet e tente novamente.'); }
  const ids = [...new Set(searches.flatMap(result => result.search || []).map(row => row.id).filter(id => /^Q\d+$/.test(id)))].slice(0, 40);
  if (!ids.length) return [];
  const data = await getJson(fetcher, endpoint, { action: 'wbgetentities', ids: ids.join('|'), props: 'claims|labels|descriptions|sitelinks', languages: 'pt|en', sitefilter: 'enwiki' });
  const unique = new Map();
  for (const id of ids) {
    const item = titleFromEntity(data.entities?.[id] || {});
    if (item && !unique.has(item.id)) unique.set(item.id, item);
  }
  const items = [...unique.values()].slice(0, 12);
  const titles = items.map(item => item.wikiTitle).filter(Boolean);
  if (titles.length) {
    try {
      const images = await getJson(fetcher, 'https://en.wikipedia.org/w/api.php', { action: 'query', titles: titles.join('|'), prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '500', pilicense: 'any', redirects: '1' });
      const pages = Object.values(images.query?.pages || {});
      const redirects = new Map((images.query?.redirects || []).map(row => [row.from, row.to]));
      for (const item of items) {
        const title = redirects.get(item.wikiTitle) || item.wikiTitle;
        const image = pages.find(page => page.title === title)?.thumbnail?.source;
        if (typeof image === 'string' && image.startsWith('https://upload.wikimedia.org/')) item.poster = image;
      }
    } catch { /* A title-only result remains usable and shareable. */ }
  }
  if (cache.size > 100) cache.clear();
  if (fetcher === fetch) cache.set(key, { items: structuredClone(items), until: Date.now() + 300000 });
  return items;
}
