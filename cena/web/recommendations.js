import {getTitleDetails} from './search-public.js';
import {trustedArtwork} from './artwork.js';
import {storyOpinion} from './story-layout.js';
const normalize=value=>String(value||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const key=item=>`${item.type}:${item.id}`;
const valid=item=>/^tt\d{5,12}$/.test(item?.id||'')&&['movie','series'].includes(item.type);
const genreNames={action:'Ação',adventure:'Aventura',animation:'Animação',comedy:'Comédia',crime:'Policial',documentary:'Documentário',drama:'Drama',family:'Família',fantasy:'Fantasia',horror:'Terror',mystery:'Mistério',romance:'Romance','sci-fi':'Ficção científica','science fiction':'Ficção científica',thriller:'Suspense',war:'Guerra',western:'Faroeste',history:'História',biography:'Biografia'};
export const genreLabel=value=>genreNames[normalize(value)]||value;
const genres=item=>(Array.isArray(item.genres)?item.genres:typeof item.genre==='string'?item.genre.split(/[·,|]/):[]).map(value=>String(value).trim()).filter(value=>value&&!['filme','serie'].includes(normalize(value)));
const stops=new Set('the and for with from this that their they have about into after before uma para com dos das que por pelo pela como mais seus suas filme film movie series television story'.split(' '));
function features(item){
 const vector=new Map();const add=(token,weight)=>vector.set(token,(vector.get(token)||0)+weight);
 for(const genre of genres(item))add('g:'+normalize(genre),3);
 for(const name of item.directors||[])add('d:'+normalize(name),2);
 for(const name of (item.cast||[]).slice(0,5))add('a:'+normalize(name),1.2);
 for(const word of normalize(item.description||'').match(/[a-z]{3,}/g)||[])if(!stops.has(word))add('w:'+word,.1);
 return vector;
}
function weightedVectors(documents){
 const raw=documents.map(features),frequency=new Map();
 for(const vector of raw)for(const token of vector.keys())frequency.set(token,(frequency.get(token)||0)+1);
 return raw.map(vector=>{let norm=0;for(const [token,weight]of vector){const value=weight*(1+Math.log((documents.length+1)/((frequency.get(token)||0)+1)));vector.set(token,value);norm+=value*value;}norm=Math.sqrt(norm)||1;for(const [token,value]of vector)vector.set(token,value/norm);return vector;});
}
const similarity=(a,b)=>{let value=0;for(const [token,weight]of a)value+=weight*(b.get(token)||0);return value;};
function preference(item,notes){const note=notes?.[key(item)]||{};return storyOpinion(note.caption||'',note.rating||'').score;}
export function selectTasteSeeds(items,notes={}){
 return items.filter(valid).map(item=>({item,rating:preference(item,notes),seen:item.status==='watched'||item.watchedEpisodes>0}))
  .sort((a,b)=>Number(b.seen)-Number(a.seen)||(b.rating??5)-(a.rating??5)||String(b.item.watchedAt||b.item.addedAt||'').localeCompare(String(a.item.watchedAt||a.item.addedAt||'')))
  .slice(0,12).map(row=>row.item);
}
export function rankRecommendations(items,candidates,{notes={},seeds=selectTasteSeeds(items,notes),limit=24,dismissed=[],now=Date.now()}={}){
 const excluded=new Set([...items.map(key),...dismissed]);const unique=new Map();
 for(const candidate of candidates||[])if(valid(candidate)&&!(Date.parse(candidate.released||'')>now)&&!(Number(candidate.year)>new Date(now).getFullYear())&&!excluded.has(key(candidate))&&!unique.has(key(candidate)))unique.set(key(candidate),candidate);
 const choices=[...unique.values()];const vectors=weightedVectors([...seeds,...choices]);
 const seedData=seeds.map((item,i)=>{const rating=preference(item,notes),seen=item.status==='watched'||item.watchedEpisodes>0;return {item,vector:vectors[i],negative:rating!==null&&rating<=4,weight:rating!==null?Math.max(.2,rating/5):seen?1:.3};});
 const ranked=choices.map((item,index)=>{
  const vector=vectors[seeds.length+index];let total=0,weight=0,best=null,bestScore=0,penalty=0;
  for(const seed of seedData){const score=similarity(vector,seed.vector);if(seed.negative){penalty+=score*.6;continue;}total+=score*seed.weight;weight+=seed.weight;if(score*seed.weight>bestScore){bestScore=score*seed.weight;best=seed;}}
  const shared=best?genres(item).find(genre=>genres(best.item).some(other=>normalize(other)===normalize(genre))):null;
  const reason=bestScore>.015?`${shared?genreLabel(shared)+' em comum':'Temas ou elenco em comum'} com ${best.item.name}.`:'Uma descoberta do catálogo para ampliar suas opções.';
  return {...item,poster:trustedArtwork(item.poster),recommendationReason:reason,affinity:(weight?total/weight:0)-penalty,providerOrder:index};
 }).sort((a,b)=>b.affinity-a.affinity||a.providerOrder-b.providerOrder);
 const selected=[],usedGenres=new Map();const remaining=[...ranked];
 while(remaining.length&&selected.length<limit){let index=remaining.findIndex(item=>(usedGenres.get(normalize(genres(item)[0]))||0)<4);if(index<0)index=0;const [item]=remaining.splice(index,1);selected.push(item);const genre=normalize(genres(item)[0]);usedGenres.set(genre,(usedGenres.get(genre)||0)+1);}
 return selected;
}
async function json(fetcher,url){const response=await fetcher(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});if(!response.ok)throw Error('Catálogo indisponível.');return response.json();}
export class RecommendationEngine {
 constructor({storage,fetcher=fetch,details=getTitleDetails,bridge,now=Date.now}={}){this.storage=storage;this.fetcher=(...args)=>fetcher(...args);this.details=details;this.bridge=bridge;this.now=now;this.inFlight=null;}
 read(key,fallback){try{return JSON.parse(this.storage?.getItem(key)||'null')||fallback;}catch{return fallback;}}
 save(key,value){try{this.storage?.setItem(key,JSON.stringify(value));}catch{}}
 async catalog(force=false,preferred=[]){
  const genreKey=preferred.slice(0,2).sort().join('|');const cached=this.read('cena.discovery.catalog.v1',null);if(!force&&cached&&cached.genreKey===genreKey&&this.now()-cached.at<12*3600000)return cached;
  let rows=[];let source='Cinemeta';
  const requests=['movie','series'].flatMap(type=>['',...preferred.slice(0,2)].map(genre=>({type,url:`https://v3-cinemeta.strem.io/catalog/${type}/top/${genre?'genre='+encodeURIComponent(genre)+'&':''}skip=0.json`})));
  const results=await Promise.allSettled(requests.map(request=>json(this.fetcher,request.url)));
  for(let i=0;i<results.length;i++)if(results[i].status==='fulfilled')for(const meta of results[i].value.metas||[]){const type=requests[i].type;const item={id:meta.imdb_id||meta.id,type:meta.type||type,name:meta.name,originalName:meta.name,year:String(meta.releaseInfo||meta.year||'').slice(0,4),released:meta.released||'',poster:trustedArtwork(meta.poster),genres:meta.genres||[],description:meta.description||'',imdbRating:meta.imdbRating??null,imdbRatingAt:Date.now(),cast:meta.cast||[],directors:meta.director?Array.isArray(meta.director)?meta.director:[meta.director]:[],source:'Cinemeta',sourceUrl:`https://www.imdb.com/title/${meta.imdb_id||meta.id}/`};if(valid(item)&&item.name)rows.push(item);}
  if(!rows.length){if(cached)return {...cached,stale:true};throw Error('Não consegui consultar opções agora. Confira a internet e tente novamente.');}
  const value={at:this.now(),genreKey,items:['movie','series'].flatMap(type=>[...new Map(rows.filter(item=>item.type===type).map(item=>[key(item),item])).values()].slice(0,150)),source};this.save('cena.discovery.catalog.v1',value);return value;
 }
 async recommend(items,{force=false}={}){
  if(this.inFlight)return this.inFlight;
  this.inFlight=this.run(items,force).finally(()=>{this.inFlight=null;});return this.inFlight;
 }
 async run(items,force){
  const notes=this.read('cena.story.notes.v1',{}),seeds=selectTasteSeeds(items,notes),profiles=this.read('cena.discovery.profiles.v1',{}),rich=[];
  let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<seeds.length){const seed=seeds[cursor++],saved=profiles[key(seed)];let metadata=saved&&this.now()-saved.at<30*86400000?saved.item:null;if(!metadata)try{metadata=await this.details(seed);if(metadata.id!==seed.id||metadata.type!==seed.type)metadata=null;else profiles[key(seed)]={at:this.now(),item:metadata};}catch{}rich.push({...seed,...metadata,status:seed.status,watchedEpisodes:seed.watchedEpisodes});}}));
  this.save('cena.discovery.profiles.v1',Object.fromEntries(Object.entries(profiles).sort((a,b)=>b[1].at-a[1].at).slice(0,100)));
  const counts=new Map();for(const seed of rich)if(preference(seed,notes)===null||preference(seed,notes)>=5)for(const genre of genres(seed))counts.set(genre,(counts.get(genre)||0)+1);
  const preferred=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([genre])=>genre);
  const catalog=await this.catalog(force,preferred),dismissed=this.read('cena.discovery.dismissed.v1',[]);
  const countsByType={movie:0,series:0};const ranked=rankRecommendations(items,catalog.items,{notes,seeds:rich,limit:300,dismissed}).filter(item=>countsByType[item.type]++<30);
  return {items:ranked,at:catalog.at,stale:Boolean(catalog.stale),source:catalog.source,seedCount:rich.length};
 }
 dismiss(item){const values=this.read('cena.discovery.dismissed.v1',[]);this.save('cena.discovery.dismissed.v1',[...new Set([...values,key(item)])].slice(-500));}
}
