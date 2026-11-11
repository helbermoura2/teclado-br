/** Aggregate only confirmed local data; viewing time and catalog size are different measures. */
export function profileCollection(items=[]){
 const unique=new Map();for(const item of items){if(!item?.id||!['movie','series'].includes(item.type))continue;unique.set(`${item.type}:${item.id}`,item);}
 const rows=[...unique.values()];return {total:rows.length,movies:rows.filter(x=>x.type==='movie').length,series:rows.filter(x=>x.type==='series').length,watchlist:rows.filter(x=>x.status==='watchlist').length,watched:rows.filter(x=>x.status==='watched').length};
}
export function yearlyHistory(state={}){return (state.years||[]).filter(x=>Number.isInteger(Number(x.year))&&Number(x.year)>=1&&Number(x.year)<=9999).map(x=>({year:Number(x.year),plays:Math.max(0,Number(x.plays)||0),movies:Math.max(0,Number(x.movies)||0),episodes:Math.max(0,Number(x.episodes)||0),minutes:Math.max(0,Number(x.estimatedMinutes)||0),timedPlays:Math.max(0,Number(x.timedPlays)||0)})).sort((a,b)=>a.year-b.year);}
export function personalRatings(notes={}){
 const rows=Object.entries(notes).flatMap(([key,note])=>{const raw=String(note?.rating??'').trim();if(!/^(?:10(?:[.,]0{1,2})?|[0-9](?:[.,]\d{1,2})?)$/.test(raw)||! /^(movie|series):tt\d{5,12}$/.test(key))return [];const rating=Number(raw.replace(',','.'));return [{key,rating}];});
 return {count:rows.length,average:rows.length?rows.reduce((sum,row)=>sum+row.rating,0)/rows.length:null,distribution:Array.from({length:11},(_,rating)=>({rating,count:rows.filter(row=>Math.round(row.rating)===rating).length}))};
}
