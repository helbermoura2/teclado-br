const valid=item=>/^tt\d{5,12}$/.test(item?.id||'')&&['movie','series'].includes(item.type);
const key=item=>`${item.type}:${item.id}`;
export function imdbScore(value){
 if(typeof value!=='number'&&typeof value!=='string')return null;
 const raw=String(value).trim();if(!/^\d{1,2}(?:[.,]\d{1,2})?$/.test(raw))return null;
 const score=Number(raw.replace(',','.'));return Number.isFinite(score)&&score>=1&&score<=10?score:null;
}
export function imdbLabel(value){const score=imdbScore(value);return score===null?'IMDb —':`★ IMDb ${score.toFixed(1).replace('.',',')} / 10`;}
export class RatingsResolver {
 constructor({storage,fetcher=fetch,now=Date.now}={}){this.storage=storage;this.fetcher=(...args)=>fetcher(...args);this.now=now;this.jobs=new Map();this.queue=[];this.active=0;this.failures=new Map();try{this.cache=JSON.parse(storage?.getItem('cena.imdb.ratings.v1')||'{}');}catch{this.cache={};}if(!this.cache||typeof this.cache!=='object'||Array.isArray(this.cache))this.cache={};this.cache=Object.fromEntries(Object.entries(this.cache).filter(([id,row])=>/^(movie|series):tt\d{5,12}$/.test(id)&&row&&Number.isFinite(row.at)&&(row.value===null||imdbScore(row.value)!==null)));}
 record(item){const row=this.cache[key(item)],age=this.now()-Number(row?.at);if(row&&age>=0&&age<(row.value===null?24:168)*3600000&&(row.value===null||imdbScore(row.value)!==null))return row;return null;}
 peek(item){if(!valid(item))return undefined;const row=this.record(item),score=imdbScore(item.imdbRating),age=this.now()-Number(item.imdbRatingAt);if(score!==null&&age>=0&&age<7*86400000&&(!row||item.imdbRatingAt>row.at))return score;return row?row.value:undefined;}
 save(item,value,at=this.now()){this.cache[key(item)]={value,at};this.cache=Object.fromEntries(Object.entries(this.cache).sort((a,b)=>b[1].at-a[1].at).slice(0,600));try{this.storage?.setItem('cena.imdb.ratings.v1',JSON.stringify(this.cache));}catch{}return value;}
 resolve(item,{shouldLoad=()=>true}={}){
  if(!valid(item))return Promise.resolve(undefined);
  const known=this.peek(item);if(known!==undefined){if(!this.record(item)||item.imdbRatingAt>this.record(item).at)this.save(item,known,item.imdbRatingAt);return Promise.resolve(known);}
  const id=key(item);if(this.failures.has(id)&&this.now()-this.failures.get(id)<600000)return Promise.resolve(undefined);
  if(this.jobs.has(id)){const job=this.jobs.get(id);job.interests.push(shouldLoad);return job.promise;}
  let done;const promise=new Promise(resolve=>done=resolve);const job={id,item,interests:[shouldLoad],promise,done};this.jobs.set(id,job);this.queue.push(job);this.drain();return promise;
 }
 drain(){while(this.active<2&&this.queue.length){const job=this.queue.shift();if(!job.interests.some(check=>{try{return check();}catch{return false;}})){this.jobs.delete(job.id);job.done(undefined);continue;}this.active++;this.fetchRating(job.item).then(value=>job.done(this.save(job.item,value))).catch(()=>{this.failures.set(job.id,this.now());job.done(undefined);}).finally(()=>{this.jobs.delete(job.id);this.active--;this.drain();});}}
 async fetchRating(item){
  const response=await this.fetcher(`https://v3-cinemeta.strem.io/meta/${item.type}/${item.id}.json`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Nota indisponível.');
  const {meta}=await response.json();if((meta?.imdb_id||meta?.id)!==item.id||meta?.type!==item.type)throw Error('Identidade da nota divergente.');return imdbScore(meta.imdbRating);
 }
 retry(){this.failures.clear();}
}
