// Only native TMDB metadata tied to the requested IMDb ID can supply regional names.
export function createTitleAliasResolver(bridge,{timeout=18000}={}){
 const jobs=new Map(),cache=new Map();
 const key=item=>`${item.type}:${item.id}`;
 return {
  async resolve(item){
   if(!/^tt\d{5,12}$/.test(item?.id||'')||!['movie','series'].includes(item.type)||typeof bridge?.findTitleAliases!=='function')return item;
   const id=key(item);let result=cache.get(id);
   if(!result){let job=jobs.get(id);if(!job){job={};job.promise=new Promise(resolve=>{job.finish=resolve;job.timer=setTimeout(()=>{if(jobs.get(id)===job)jobs.delete(id);resolve(null);},timeout);});jobs.set(id,job);try{bridge.findTitleAliases(item.id,item.type);}catch{clearTimeout(job.timer);jobs.delete(id);job.finish(null);}}result=await job.promise;}
   if(!result)return item;
   return {...item,name:result.name||item.name,originalName:result.originalName||item.originalName,year:item.year||result.year,aliases:[...new Set([...(item.aliases||[]),item.name,item.originalName,...result.aliases].filter(Boolean))]};
  },
  accept(value){
   const id=key(value||{}),job=jobs.get(id);if(!job)return;
   clearTimeout(job.timer);jobs.delete(id);
   const valid=!value.error&&Array.isArray(value.aliases)&&value.aliases.length<=40&&value.aliases.every(x=>typeof x==='string'&&x.trim().length>0&&x.length<=160);
   if(!valid){job.finish(null);return;}
   const result={aliases:value.aliases,name:typeof value.name==='string'?value.name.slice(0,160):'',originalName:typeof value.originalName==='string'?value.originalName.slice(0,160):'',year:/^\d{4}$/.test(value.year||'')?value.year:''};
   if(cache.size>160)cache.clear();cache.set(id,result);job.finish(result);
  }
 };
}
