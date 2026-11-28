const valid = item => /^tt\d{5,12}$/.test(item?.id || '') && ['movie','series'].includes(item.type);
const key = item => `${item.type}:${item.id}`;
export function applyTraktState(items, state, {preserveWatchState=false}={}) {
  if (!state.connected || !state.lastSync) return items;
  const pending = new Set([...(state.pending || []), ...(state.synced || []).filter(row=>row.at > state.lastSync)].map(key));
  const watchlist = new Map((state.watchlist || []).filter(valid).map(item => [key(item),item]));
  const watched = new Map((state.watched || []).filter(valid).map(item => [key(item),item]));
  const progress = new Map((state.progress || []).filter(valid).map(item => [key(item),item]));
  const result = new Map(items.map(item => [key(item), {...item}]));
  for(const [id,remote] of watchlist) if(!result.has(id) && !pending.has(id)) result.set(id,{...remote,originalName:remote.name,description:'',poster:'',genre:remote.type==='series'?'Série':'Filme',status:'watchlist',source:'Trakt',sourceUrl:`https://www.imdb.com/title/${remote.id}/`,addedAt:new Date(state.lastSync).toISOString(),syncStatus:'synced'});
  for(const [id,item] of result) {
    if (pending.has(id)) { item.syncStatus='pending'; continue; }
    if(preserveWatchState){item.syncStatus='synced';continue;}
    if (watchlist.has(id)) { item.status='watchlist'; item.syncStatus='synced'; delete item.watchedSource; }
    if (item.type==='movie' && watched.has(id) && !watchlist.has(id)) {
      item.status='watched'; item.watchedAt=watched.get(id).watchedAt; item.watchedSource='Trakt'; item.syncStatus='synced';
    }
    if(item.type==='series' && progress.has(id)) item.watchedEpisodes=progress.get(id).episodes;
  }
  return [...result.values()];
}
export function traktItemLabel(item,state) {
  if(state.readOnly)return !state.connected?'Salvo neste aparelho':item.watchedSource==='Trakt'?'✓ Assistido — recebido do Trakt':(state.watchlist||[]).some(row=>key(row)===key(item))?'✓ Recebido do Trakt · somente leitura':'Salvo neste aparelho';
  if(!state.connected) return 'Salvo neste aparelho';
  if((state.pending || []).some(row => key(row)===key(item))) return state.error ? 'Sincronização pendente — confira Conectar' : 'Aguardando envio ao Trakt';
  if((state.synced || []).some(row=>key(row)===key(item)) || item.syncStatus==='synced') return item.status==='watched' && item.watchedSource==='Trakt' ? '✓ Assistido — recebido do Trakt' : '✓ Enviado ao Trakt';
  return 'Salvo neste aparelho';
}
