const safeId = item => /^tt\d{5,12}$/.test(item?.id || '') && ['movie','series'].includes(item.type);
export function trustedArtwork(value) {
  try { const url=new URL(value); return url.protocol==='https:' && !url.username && !url.password && ['upload.wikimedia.org','image.tmdb.org','images.metahub.space','m.media-amazon.com'].includes(url.hostname) ? url.href : ''; } catch { return ''; }
}
export function titleArtwork(item,value){
 const url=trustedArtwork(value);if(!url)return '';
 const parsed=new URL(url);
 const embedded=parsed.pathname.match(/tt[0-9]{5,12}/g);
 if(embedded&&embedded.some(id=>id!==item.id))return '';
 // A Wikipedia page thumbnail need not depict the show itself.
 if(parsed.hostname==='upload.wikimedia.org')return '';
 // Repair known contaminated poster regardless of old cache provenance.
 if(item.id==='tt0185906'&&parsed.hostname!=='images.metahub.space')return '';
 return url;
}
export async function catalogArtwork(item, fetcher=fetch) {
  if(!safeId(item)) return '';
  const response=await fetcher(`https://v3-cinemeta.strem.io/meta/${item.type}/${item.id}.json`,{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
  if(!response.ok) throw Error('Capa indisponível no catálogo.');
  const {meta}=await response.json();
  if((meta?.imdb_id || meta?.id)!==item.id || meta?.type!==item.type) return '';
  return trustedArtwork(meta.poster);
}
async function artworkJson(fetcher,address){
  const response=await fetcher(address,{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('Fonte de capa indisponível.');return response.json();
}
export async function searchCatalogArtwork(item,fetcher=fetch){
  if(!safeId(item)||!item.name)return '';
  const data=await artworkJson(fetcher,`https://v3-cinemeta.strem.io/catalog/${item.type}/top/search=${encodeURIComponent(item.name)}.json`);
  const row=(data.metas||[]).find(row=>(row.imdb_id||row.id)===item.id&&(!row.type||row.type===item.type));return trustedArtwork(row?.poster);
}
export async function regionalArtwork(item,fetcher=fetch){
  if(!safeId(item)||!item.name)return '';
  const query=item.name.replaceAll('"','').slice(0,150);
  for(const language of ['pt','en']){
    try{
      const params=new URLSearchParams({action:'query',format:'json',origin:'*',generator:'search',gsrsearch:'"'+query+'"',gsrlimit:'5',prop:'pageprops|pageimages',piprop:'thumbnail',pithumbsize:'600',pilicense:'any'});
      const pages=Object.values((await artworkJson(fetcher,`https://${language}.wikipedia.org/w/api.php?${params}`)).query?.pages||{});
      const ids=[...new Set(pages.map(page=>page.pageprops?.wikibase_item).filter(id=>/^Q\d+$/.test(id||'')))];if(!ids.length)continue;
      const entityParams=new URLSearchParams({action:'wbgetentities',format:'json',origin:'*',ids:ids.join('|'),props:'claims'});
      const entities=(await artworkJson(fetcher,`https://www.wikidata.org/w/api.php?${entityParams}`)).entities||{};
      for(const page of pages){
        const claims=entities[page.pageprops?.wikibase_item]?.claims?.P345||[];
        if(!claims.some(claim=>claim.mainsnak?.datavalue?.value===item.id))continue;
        const thumb=page.thumbnail,ratio=thumb?.width/thumb?.height;
        // Exact film identity plus a portrait poster, not a cast member or landscape still.
        if(ratio<.5||ratio>.85||!Number.isFinite(ratio))continue;
        const poster=trustedArtwork(thumb?.source);if(poster)return poster;
      }
    }catch{}
  }
  return '';
}
function probeImage(url) {
  return new Promise(resolve=>{
    const image=new Image(); let done=false;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);image.onload=null;image.onerror=null;resolve(value);};
    const timer=setTimeout(()=>{finish(false);image.src='';},8000);
    image.referrerPolicy='no-referrer';
    image.onload=()=>finish(image.naturalWidth>=60 && image.naturalHeight>=90);
    image.onerror=()=>finish(false);
    // Displaying a poster does not require CORS. Story export requests CORS separately.
    image.src=url;
  });
}
export class ArtworkResolver {
  constructor({storage,fetcher=fetch,probe=probeImage,now=Date.now,concurrency=2}={}) {
    this.storage=storage;this.fetcher=fetcher;this.probe=probe;this.now=now;this.concurrency=concurrency;
    this.active=0;this.queue=[];this.jobs=new Map();this.interests=new Map();this.failures=new Map();this.cache={};
    try { this.cache=JSON.parse(storage?.getItem('cena.artwork.v1')||'{}'); } catch {}
    if(!this.cache || Array.isArray(this.cache) || typeof this.cache!=='object')this.cache={};
  }
  key(item){return `${item.type}:${item.id}`;}
  peek(item){const cached=this.cache[this.key(item)];return cached && this.now()-cached.at<14*86400000 ? titleArtwork(item,cached.poster):'';}
  retry(){this.failures.clear();}
  remember(item,poster){
    this.cache[this.key(item)]={poster,at:this.now()};
    const entries=Object.entries(this.cache).sort((a,b)=>b[1].at-a[1].at).slice(0,600);this.cache=Object.fromEntries(entries);
    try{this.storage?.setItem('cena.artwork.v1',JSON.stringify(this.cache));}catch{}
  }
  resolve(item,{shouldLoad}={}){
    if(!safeId(item))return Promise.resolve('');
    const key=this.key(item);
    if(this.jobs.has(key)){this.interests.get(key)?.push(shouldLoad);return this.jobs.get(key);}
    if(this.failures.has(key) && this.now()-this.failures.get(key)<60000)return Promise.resolve('');
    const task={item:{...item},interests:[shouldLoad]};
    const promise=new Promise(resolve=>{task.resolve=resolve;});task.promise=promise;
    this.interests.set(key,task.interests);this.jobs.set(key,promise);this.queue.push(task);this.pump();return promise;
  }
  pump(){
    while(this.active<this.concurrency && this.queue.length){
      const task=this.queue.shift(),key=this.key(task.item);
      if(!task.interests.some(condition=>!condition||condition())){
        if(this.jobs.get(key)===task.promise){this.jobs.delete(key);this.interests.delete(key);}task.resolve('');continue;
      }
      this.active++;
      this.find(task.item).then(task.resolve,()=>task.resolve('')).finally(()=>{
        this.active--;if(this.jobs.get(key)===task.promise){this.jobs.delete(key);this.interests.delete(key);}this.pump();
      });
    }
  }
  async find(item){
    const tried=new Set();
    const attempt=async value=>{const url=titleArtwork(item,value);if(!url||tried.has(url))return '';tried.add(url);return await this.probe(url)?url:'';};
    for(const candidate of [this.peek(item),item.poster]) {const poster=await attempt(candidate);if(poster){this.remember(item,poster);return poster;}}
    let catalog='';try{catalog=await catalogArtwork(item,this.fetcher);}catch{}
    for(const candidate of [catalog,`https://images.metahub.space/poster/medium/${item.id}/img`]) {const poster=await attempt(candidate);if(poster){this.remember(item,poster);return poster;}}
    for(const lookup of [searchCatalogArtwork]){
      let candidate='';try{candidate=await lookup(item,this.fetcher);}catch{}
      const poster=await attempt(candidate);if(poster){this.remember(item,poster);return poster;}
    }
    this.failures.set(this.key(item),this.now());return '';
  }
}
