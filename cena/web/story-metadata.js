import {getTitleDetails,searchPublicTitles} from './search-public.js';
const memo=new Map();
export async function storyMetadata(item,{details=getTitleDetails,search=searchPublicTitles}={}){
  const key=`${item.type}:${item.id}`;if(details===getTitleDetails&&search===searchPublicTitles&&memo.has(key))return memo.get(key);
  const results=await Promise.allSettled([details(item),search(String(item.originalName||item.name||'').slice(0,150))]);
  const rich=results[0].status==='fulfilled'&&results[0].value.id===item.id&&results[0].value.type===item.type?results[0].value:item;
  const match=results[1].status==='fulfilled'?results[1].value.find(row=>row.id===item.id&&row.type===item.type):null;
  const localTitle=match?.localWikiTitle?.replace(/\s+\([^)]*\)\s*$/,'')||'';
  const result={title:localTitle||match?.name||rich.name||item.name,originalTitle:match?.originalName||rich.originalName||item.originalName||item.name,year:rich.year||match?.year||item.year||''};
  if(details===getTitleDetails&&search===searchPublicTitles){if(memo.size>100)memo.clear();memo.set(key,result);}return result;
}
