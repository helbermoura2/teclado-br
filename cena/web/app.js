import {NuvioSeriesEngine} from './nuvio-series.js';
import {seriesUniverse,seriesCards,nextEpisodeEntries,combineContinuity,traktPausedEntries} from './series-continuity.js';
import {mountVisionModel} from './vision-model-panel.js';
import {mountBackup} from './backup.js';
import {readCollections,createCollection,collectionItems,mountTitleCollections} from './collections.js';
import {mountFeedback,readFeedback} from './feedback.js';
import {mountCalendar} from './calendar.js';
import {mountRetrospective} from './retrospective.js';
import {renderSyncSummary} from './sync-summary.js';
import {createStoryEditor} from './story-editor.js';
import {createAppStorage} from './app-storage.js';
import {resumeKey,visibleResume,titleName,homeSeries} from './home-feed.js';
import {applyHistoryMetadata,historyYearLabel,historyStats,historyDate,historyItem} from './watch-history.js';
import {applyNuvioState,nuvioContinue} from './nuvio-state.js';
import {renderNuvioPanel} from './nuvio-panel.js';
import {RatingsResolver,imdbLabel} from './ratings.js';
import {SimilarEngine,buildLocalSelectionPrompt,validateLocalSelection} from './similar.js';
import {createLocalAI} from './local-ai.js';
import {RecommendationEngine} from './recommendations.js';
import {seriesSummary} from './series-view.js';
import {receiveStoryArtwork} from './story-artwork.js';
import {createStremioPanel} from './stremio-panel.js';
import { ArtworkResolver, trustedArtwork } from './artwork.js';
import { applyTraktState, traktItemLabel } from './trakt-state.js';
import { getTitleDetails } from './search-public.js';
import { createLocalApi } from './local-api.js';
import { coverInput, identifyCover, searchTolerantTitles } from './identify-cover.js';
import { rankWithVision } from './visual-ranking.js';
const $ = selector => document.querySelector(selector);
const native = Boolean(window.CenaAndroid);
const storage=createAppStorage(localStorage,window.CenaAndroid);
window.CenaStoryArtworkResult=receiveStoryArtwork;
const storageKey = 'cena.connection.v1';
let connection = null;
let stored = null;
try { stored = JSON.parse(storage.getItem(storageKey) || 'null'); } catch {}
let apiBase = stored?.apiBase || (native ? 'local' : location.origin);
const localApi = createLocalApi(storage, { search: searchTolerantTitles });
let visualModelState={available:false,downloading:false};
window.CenaVisionModelState=value=>{visualModelState=value;renderVisionModel();};
function renderVisionModel(){mountVisionModel($('#vision-model-panel'),{state:visualModelState,bridge:window.CenaAndroid});}
let activeCollection='',collectionResults=[];
let items = [], tab = 'home', filter = 'watchlist', searchResults = [], config = null;
let nuvioSeriesRows=[],nuvioSeriesTicket=0,seriesResults=[];
let seriesState={items:[],reading:false,pending:0,lastCheck:0};
let discoveryRefreshing=false,discoveryRequest=0;
let highlightsResults=[],highlightView='',highlightsPending=null,highlightsAt=0;
let discoveryResults=[],discoveryMode='recommend',discoveryFilter='all',discoveryInfo=null,discoveryFingerprint='';
let nuvioState={connected:false,active:false,watched:[],progress:[]},deferredNuvioState=null,nuvioResults=[];
let resumeExpanded=false,homeMetadata=new Map(),homeMetadataTried=new Set(),homeMetadataBusy=false,homeRecommendationPending=null;
const resumeHiddenKey='cena.resume.hidden.v1';
let resumeHidden={};try{resumeHidden=JSON.parse(storage.getItem(resumeHiddenKey)||'{}')||{};}catch{}
let historyState={totals:{},years:[],media:[]},deferredHistoryState=null,historyYear='all',historyKind='all',historyMode='history',historyMedia='',historyRows=[],historyRequest=0,historyPage=1,historyHasMore=false,historyResults=[];
let historyDedicated=false;
let recentHistoryRequest='',recentHistoryRows=[],recentHistoryResults=[];
let updateState={status:'idle',message:'Confira novas versões do aplicativo.'};
window.CenaUpdateResult=value=>{updateState=value;renderUpdatePanel();};
function renderUpdatePanel(){const status=$('#update-status'),install=$('#update-install'),check=$('#update-check');if(!status||!install||!check)return;status.textContent=updateState.message+(updateState.version&&updateState.status==='available'?' Versão '+updateState.version+'.':'');install.hidden=!['available','permission','error'].includes(updateState.status);install.disabled=['checking','downloading','installing'].includes(updateState.status);check.disabled=['checking','downloading','installing'].includes(updateState.status);}
let traktState = { connected:false, configured:false, pending:[] };
let traktWasConnected = false;
let traktInitialUploadRequested = false;
let libraryReady=false, deferredTraktState=null;
let scanPhoto = '', detectedLines = [], detailItem = null, searchGeneration = 0, busy = false;
const main = $('#main');
const stremioPanel=createStremioPanel({
  bridge:window.CenaAndroid,getItems:()=>items,traktConnected:()=>Boolean(traktState.connected),toast,
  onImport:async(result,sendToTrakt)=>{
    if(apiBase!=='local'||!libraryReady)throw Error('Aguarde sua lista local carregar.');
    storage.setItem('cena.local.items.v1',JSON.stringify(result.items));items=result.items;
    sendTraktInventory();
    if(sendToTrakt&&typeof window.CenaAndroid?.queueTraktBatch==='function')window.CenaAndroid.queueTraktBatch(JSON.stringify(result.added.map(({id,type})=>({id,type,action:'add'}))));
  }
});
window.CenaStremioResult=state=>stremioPanel.update(state);

function historyBadge(item){return `<span class="watch-years">${escape(historyYearLabel(item))}</span>`;}
window.CenaHistoryResult=state=>{
 if(!libraryReady){deferredHistoryState=state;return;}
 if(JSON.stringify(state)===JSON.stringify(historyState))return;
 const previous=historyState;historyState=state;renderSync();const merged=applyHistoryMetadata(items,state),changed=JSON.stringify(merged)!==JSON.stringify(items);
 if(previous.scope!==state.scope){recentHistoryRows=[];recentHistoryResults=[];recentHistoryRequest='';renderRecentHistory();}
 if(changed&&apiBase==='local'){items=merged;storage.setItem('cena.local.items.v1',JSON.stringify(items));}
 if(tab==='profile'){renderHistorySummary();if(previous.scope!==state.scope||previous.lastImport!==state.lastImport)mountRetrospective($('#retrospective-panel'),{state:historyState,bridge:window.CenaAndroid,toast});if(previous.scope!==state.scope||previous.lastImport!==state.lastImport){const records=$('#history-records');if(records)records.innerHTML='<p class="muted">Carregando histórico desta conta…</p>';loadHistoryRows(true);}}
 else if(tab==='library'&&changed)patchLibrary();else if(tab==='home'&&changed&&!$('#detail').open){const position=window.scrollY;home();window.scrollTo(0,position);}
 const dates=$('#title-watch-history');if(dates&&detailItem)renderTitleHistory(items.find(item=>item.id===detailItem.id&&item.type===detailItem.type)||detailItem);
 if(tab==='home'&&(previous.scope!==state.scope||previous.lastImport!==state.lastImport))loadRecentHistory();
};
window.CenaHistoryRows=value=>{
 if(String(value.requestId)===recentHistoryRequest){if(value.scope===historyState.scope&&tab==='home'){recentHistoryRows=value.rows||[];renderRecentHistory();}return;}
 if(String(value.requestId)!==String(historyRequest)||value.scope!==historyState.scope||tab!=='profile')return;
 historyRows=value.page===1?value.rows||[]:[...historyRows,...(value.rows||[])];historyPage=value.page;historyHasMore=Boolean(value.hasMore);renderHistoryRows(value.total||0);
};
function loadHistoryRows(reset=true){
 if(reset){historyRows=[];historyPage=0;historyHasMore=false;}
 if(typeof window.CenaAndroid?.historyRows!=='function'){const target=$('#history-records');if(target)target.innerHTML='<p class="muted">A importação e o histórico completo ficam disponíveis no APK Android.</p>';return;}
 const id=String(++historyRequest);window.CenaAndroid.historyRows(id,historyYear,historyKind,reset?1:historyPage+1,historyMedia);
}
function profile(){
 main.innerHTML=`${historyDedicated?'<div class="collection-header"><button class="collection-back" id="history-back" aria-label="Voltar">←</button><h1>Últimos vistos</h1></div>':'<div class="eyebrow">SUA MEMÓRIA DE CINEMA</div><h1>Meu perfil</h1>'}<div id="history-summary" ${historyDedicated?'hidden':''}></div><div class="history-filters"><label for="history-year">Ano em que assistiu</label><select id="history-year"></select><label for="history-kind" ${historyMode==='stats'?'hidden':''}>Tipo</label><select id="history-kind" ${historyMode==='stats'?'hidden':''}><option value="all">Filmes e episódios</option><option value="movie">Filmes</option><option value="episode">Episódios</option></select></div><div class="chips"><button class="chip ${historyMode==='history'?'selected':''}" id="history-tab">Histórico</button><button class="chip ${historyMode==='stats'?'selected':''}" id="history-stats-tab">Estatísticas</button></div><div id="history-stats"></div><div id="history-records"></div><section class="panel" id="retrospective-panel" ${historyDedicated?'hidden':''}></section><section class="panel" id="backup-panel" ${historyDedicated?'hidden':''}></section>`;
 if($('#history-back'))$('#history-back').onclick=()=>window.CenaBack();
 renderHistorySummary();$('#history-kind').value=historyKind;
 mountBackup($('#backup-panel'),{storage,bridge:window.CenaAndroid,toast,onRestore:async()=>{await refresh();items=applyNuvioState(applyHistoryMetadata(items,historyState),nuvioState);storage.setItem('cena.local.items.v1',JSON.stringify(items));sendTraktInventory();resumeHidden=JSON.parse(storage.getItem(resumeHiddenKey)||'{}');profile();}});
 mountRetrospective($('#retrospective-panel'),{state:historyState,bridge:window.CenaAndroid,toast});
 $('#history-year').onchange=event=>{historyYear=event.target.value;renderHistoryStats();loadHistoryRows(true);};$('#history-kind').onchange=event=>{historyKind=event.target.value;loadHistoryRows(true);};
 $('#history-tab').onclick=()=>{historyMode='history';profile();};$('#history-stats-tab').onclick=()=>{historyMode='stats';profile();};
 loadHistoryRows(true);if(typeof window.CenaAndroid?.historyState==='function')window.CenaAndroid.historyState();
}
function renderHistorySummary(){
 const target=$('#history-summary');if(!target)return;
 const state=historyState;
 target.innerHTML=`<p class="muted">${state.account?`Histórico de ${escape(state.account)} · `:''}${state.connected?'Importado da conta Trakt autorizada.':'Cópia local. Conecte o Trakt para importar ou atualizar.'}</p>${state.importing?`<p class="notice" role="status">Importando histórico: ${Number(state.processed)||0} registros lidos${state.pages?` · página ${state.page} de ${state.pages}`:''}. A cópia anterior continua disponível até concluir.</p>`:''}${state.lastImport?`<p class="muted">Última importação: ${new Date(state.lastImport).toLocaleString('pt-BR')}</p>`:''}${state.coverage==='partial'?'<p class="notice">O total recebido não corresponde a todos os registros informados pelo Trakt. Os dados disponíveis foram salvos; a cobertura ainda é parcial.</p>':state.lastImport&&state.coverage!=='complete'?'<p class="notice">Importação finalizada. Não foi possível confirmar a cobertura total do histórico no Trakt.</p>':''}${state.error?`<p class="error" role="alert">${escape(state.error)}</p>`:''}<div class="actions"><button class="primary" id="history-import" ${!state.connected?'disabled':''}>${state.importing?'Continuar importação':'Importar / atualizar Trakt'}</button><button class="secondary" id="history-export" ${!(state.totals?.plays>0)?'disabled':''}>Exportar JSON</button></div>${historyMedia?'<p class="notice">Mostrando o histórico deste título. <button class="link-button" id="history-all-titles">Ver todos os títulos</button></p>':''}`;
 $('#history-import').onclick=()=>{window.CenaAndroid?.importHistory?.();toast('Importação agendada. O histórico será lido no aparelho.');};$('#history-export').onclick=()=>window.CenaAndroid?.exportHistory?.();if($('#history-all-titles'))$('#history-all-titles').onclick=()=>{historyMedia='';renderHistorySummary();loadHistoryRows(true);};
 const select=$('#history-year');if(select&&document.activeElement!==select){select.innerHTML=`<option value="all">Todos os anos</option>${(state.years||[]).map(row=>`<option value="${Number(row.year)}">${row.year} · ${row.plays} registros</option>`).join('')}${state.totals?.unknownDates?'<option value="unknown">Data desconhecida</option>':''}`;select.value=historyYear;if(select.selectedIndex<0){historyYear='all';select.value='all';}}
 renderHistoryStats();
}
function renderHistoryStats(){
 const target=$('#history-stats');if(!target)return;const stats=historyStats(historyState,historyYear),minutes=Number(stats.estimatedMinutes)||0;
 target.innerHTML=`<div class="history-stat-grid"><div><strong>${stats.movies||0}</strong><span>Filmes diferentes</span></div><div><strong>${stats.series||0}</strong><span>Séries acompanhadas</span></div><div><strong>${stats.episodes||0}</strong><span>Episódios diferentes</span></div><div><strong>${stats.plays||0}</strong><span>Reproduções</span></div><div><strong>${Math.floor(minutes/60)}h ${minutes%60}min</strong><span>Tempo estimado</span></div></div><p class="muted">Revisitas contam como novas reproduções. Tempo estimado pela duração dos títulos${stats.plays?`, disponível em ${stats.timedPlays||0} de ${stats.plays} registros`:''}; não mede o tempo real diante da tela. Datas no fuso do aparelho: ${escape(historyState.timezone||'local')}.</p>${historyState.unmatched?`<p class="muted">${historyState.unmatched} registro(s) sem correspondência IMDb continuam no histórico, sem associação por nome.</p>`:''}`;
 target.hidden=historyMode!=='stats';const records=$('#history-records');if(records)records.hidden=historyMode!=='history';
}
function renderHistoryRows(total){
 const target=$('#history-records');if(!target)return;historyResults=historyRows.map(row=>historyItem(row,items));
 target.innerHTML=`<p class="muted">${total} registros ${historyYear==='all'?'em todos os anos':historyYear==='unknown'?'sem data confirmada':`em ${escape(historyYear)}`}</p>${historyRows.length?`<div class="grid history-grid">${historyRows.map((row,index)=>`<button class="history-row poster-card" data-history-index="${index}">${poster(historyResults[index],'',true)}<strong>${escape(historyResults[index].name)}</strong><small>${row.kind==='episode'?`T${escape(row.season)} · E${escape(row.episode)}${row.episodeTitle?` · ${escape(row.episodeTitle)}`:''}`:'Filme'}</small><small>${escape(historyDate(row))}</small></button>`).join('')}</div>`:'<div class="empty"><p>Nenhum registro disponível para este filtro.</p></div>'}${historyHasMore?'<button class="secondary wide" id="history-more">Mais registros</button>':''}`;
 for(const button of target.querySelectorAll('[data-history-index]'))button.onclick=()=>showDetail(historyResults[Number(button.dataset.historyIndex)]);
 if($('#history-more'))$('#history-more').onclick=()=>loadHistoryRows(false);
 wireImages();
 renderHistoryStats();
}
function renderTitleHistory(item){
 const target=$('#title-watch-history');if(!target)return;const info=item.historyInfo||items.find(row=>row.id===item.id&&row.type===item.type)?.historyInfo||(historyState.media||[]).find(row=>row.id===item.id&&row.type===item.type);
 target.innerHTML=info?.plays?`<div class="notice"><strong>${escape(historyYearLabel({...item,historyInfo:info}))}</strong><p>${info.plays} registro(s) de reprodução no Trakt.${info.unknownDates?` ${info.unknownDates} sem data confirmada.`:''}</p><button class="link-button" id="history-title-dates">Ver todas as datas</button></div>`:'';
 if($('#history-title-dates'))$('#history-title-dates').onclick=()=>{$('#detail').close();historyMedia=item.id;historyYear='all';historyKind='all';historyMode='history';historyDedicated=true;setTab('profile');};
}

const artworkResolver = new ArtworkResolver({storage:storage});
const ratingsResolver=new RatingsResolver({storage:storage});
let streamingConfigured=false,streamingMessage='Configure sua chave gratuita do TMDB para exibir os serviços no Brasil.';
const streamingData=new Map(),streamingPending=new Set(),streamingObserved=new WeakSet();
const tmdbPosterRecovery=new Set();
function recoverTmdbPoster(key,value){if(!/^\/[A-Za-z0-9_.-]{1,120}\.(jpg|png)$/.test(value?.poster||'')||tmdbPosterRecovery.has(key))return;const item=artworkModels.get(key),nodes=[...document.querySelectorAll('.poster-art[data-artwork-key]')].filter(node=>node.dataset.artworkKey===key&&!node.querySelector(':scope > img'));if(!item||!nodes.length)return;tmdbPosterRecovery.add(key);artworkResolver.remember(item,'https://image.tmdb.org/t/p/w500'+value.poster);const pending=artworkResolver.jobs.get(key);Promise.resolve(pending).finally(()=>{artworkResolver.failures.delete(key);tmdbPosterRecovery.delete(key);for(const node of nodes)if(node.isConnected&&!node.querySelector(':scope > img'))hydrateArtwork(node);});}
function requestStreaming(node){if(!streamingConfigured||!node.isConnected)return;const key=node.dataset.streamKey;if(!/^(movie|series):tt\d{5,12}$/.test(key||'')||streamingData.has(key)||streamingPending.has(key))return;const [type,id]=key.split(':');streamingPending.add(key);window.CenaAndroid?.findStreaming?.(id,type);}
function paintStreaming(node,value){node.replaceChildren();if(!value?.logo||!/^\/[A-Za-z0-9_.-]{1,120}\.png$/.test(value.logo))return;const img=document.createElement('img');img.src='https://image.tmdb.org/t/p/w92'+value.logo;img.alt='Disponível em '+String(value.name||'streaming');img.loading='lazy';node.append(img);node.title=img.alt;node.classList.add('has-stream');}
const streamingObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)requestStreaming(entry.target);},{rootMargin:'150px'}):null;
function wireStreaming(){for(const node of document.querySelectorAll('[data-stream-key]')){const cached=streamingData.get(node.dataset.streamKey);if(cached)paintStreaming(node,cached);if(streamingObserved.has(node))continue;streamingObserved.add(node);if(streamingObserver)streamingObserver.observe(node);else requestStreaming(node);}}
window.CenaStreamingResult=value=>{if(value.kind==='status'){streamingConfigured=Boolean(value.configured);streamingMessage=value.message||(streamingConfigured?'TMDB conectado. Disponibilidade do Brasil.':'Configure sua chave gratuita do TMDB para exibir os serviços no Brasil.');const label=$('#streaming-status');if(label)label.textContent=streamingMessage;if(streamingConfigured){streamingData.clear();streamingPending.clear();for(const node of document.querySelectorAll('[data-stream-key]')){const rect=node.getBoundingClientRect();if(rect.bottom>=-150&&rect.top<=innerHeight+150)requestStreaming(node);}}return;}if(value.kind==='provider'){const key=`${value.type}:${value.id}`;streamingPending.delete(key);if(!value.error){streamingData.set(key,value);recoverTmdbPoster(key,value);}for(const node of document.querySelectorAll('[data-stream-key]'))if(node.dataset.streamKey===key)paintStreaming(node,value);}};
const ratingModels=new Map(),ratingObserved=new WeakSet(),ratingLoading=new WeakSet();
function scoreMarkup(item){const id=`${item.type}:${item.id}`;ratingModels.set(id,item);const value=ratingsResolver.peek(item);return `<span class="imdb-score ${value!=null?'rated':'unrated'}" data-rating-key="${escape(id)}" data-rating-state="${value===undefined?'pending':value===null?'missing':'ready'}" title="Nota dos usuários do IMDb, de 1 a 10">${imdbLabel(value)}</span>`;}
async function hydrateScore(element){
 if(!element.isConnected||ratingLoading.has(element))return;
 const item=ratingModels.get(element.dataset.ratingKey);if(!item)return;ratingLoading.add(element);
 try{
  const value=await ratingsResolver.resolve(item,{shouldLoad:()=>{const rect=element.getBoundingClientRect();return element.isConnected&&rect.bottom>=-200&&rect.top<=innerHeight+200;}});
  for(const node of document.querySelectorAll('[data-rating-key]'))if(node.dataset.ratingKey===`${item.type}:${item.id}`){if(value===undefined&&node.dataset.ratingState==='ready')continue;node.textContent=imdbLabel(value);node.classList.toggle('rated',value!=null);node.classList.toggle('unrated',value==null);node.dataset.ratingState=value===undefined?'error':value===null?'missing':'ready';node.title=value==null?'Nota IMDb indisponível no momento.':'Nota dos usuários do IMDb, de 1 a 10';}
 }finally{ratingLoading.delete(element);}
}
const ratingObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.target.isConnected){ratingObserver.unobserve(entry.target);continue;}if(entry.isIntersecting)hydrateScore(entry.target);}},{rootMargin:'200px'}):null;
function wireRatings(){for(const element of document.querySelectorAll('[data-rating-key]')){if(ratingObserved.has(element))continue;ratingObserved.add(element);if(ratingObserver)ratingObserver.observe(element);else hydrateScore(element);}}

const nuvioSeriesEngine=new NuvioSeriesEngine({storage});
const recommendationEngine=new RecommendationEngine({storage:storage});
const similarEngine=new SimilarEngine({storage:storage,engine:recommendationEngine});
let similarResults=[],similarTicket=0;
const localAI=createLocalAI({bridge:window.CenaAndroid,onState:renderLocalAI});
window.CenaLocalModelResult=value=>localAI.update(value);
window.CenaLocalAiResult=value=>localAI.receive(value);
function renderLocalAI(){
 const panel=$('#local-ai-panel');if(!panel)return;
 const state=localAI.state;
 panel.innerHTML=`<h2>IA local · GGUF</h2><p>Use o modelo que você já baixou para refinar até cinco títulos semelhantes. O modelo e o pedido ficam no celular. A consulta de capas e metadados usa a internet.</p><p class="muted">Selecione o arquivo original em Downloads. Não copiamos nem baixamos os pesos; mantenha o arquivo nesse local. Esta integração usa texto, sem análise de imagens pelo Gemma.</p>${!localAI.available()?'<p>Disponível no APK Android atualizado.</p>':!state.supported?'<p>Este motor precisa de Android de 64 bits.</p>':`<p>${state.configured?`✓ ${escape(state.name)} · ${(Number(state.bytes)/1024**3).toFixed(2)} GB`:'Nenhum modelo selecionado.'}</p><button class="primary" id="choose-model">${state.configured?'Trocar GGUF':'Selecionar GGUF já baixado'}</button>${state.configured?'<button class="secondary" id="forget-model">Remover acesso ao modelo</button>':''}<p class="muted">Carregado somente quando você pedir. Pode demorar e exigir bastante memória. Remover o acesso não apaga o arquivo.</p>`}`;
 if($('#choose-model'))$('#choose-model').onclick=()=>localAI.select();
 if($('#forget-model'))$('#forget-model').onclick=()=>localAI.remove();
}
function similaritySummary(result,local=false){
 const count=result.items.length,labels=result.criteriaLabels.length?` Critérios: ${result.criteriaLabels.join(', ')}.`:'';
 return `${count} ${count===1?'opção':'opções'} ${local?'selecionadas com IA local entre enredos verificados':'por proximidade do enredo'}.${count<5?' Não completei a lista com títulos pouco relacionados.':''}${labels}${result.omitted.length?` ${result.omitted.length} opções encontradas foram omitidas porque já estão no seu catálogo.`:''}${result.partial?' Algumas fontes não responderam; a busca pode estar incompleta.':''}`;
}
function paintSimilar(panel,result,local=false){
 similarResults=result.items;patchRecommendationCards(panel.querySelector('#similar-grid'),similarResults);
 panel.querySelector('#similar-status').textContent=similaritySummary(result,local);
 panel.querySelector('#similar-reasons').innerHTML=similarResults.map(item=>`<details class="similar-evidence"><summary>${escape(item.name)} · ${escape(item.recommendationReason)}</summary>${(item.similarEvidence||[]).map(proof=>`<p class="muted">${escape(proof.quote)}</p>`).join('')}<small class="muted">Evidência na sinopse consultada. Abra o título para conferir a fonte.</small></details>`).join('');
 panel.querySelector('#similar-omitted').replaceChildren();
 if(result.omitted.length){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Quais títulos já estão no meu catálogo?';details.append(summary);for(const item of result.omitted){const line=document.createElement('p');line.className='muted';line.textContent=item.name;details.append(line);}panel.querySelector('#similar-omitted').append(details);}
 wireImages();for(const button of panel.querySelectorAll('button.poster-card[data-id]'))button.onclick=()=>showDetail(similarResults.find(item=>item.id===button.dataset.id));
}
async function findSimilar(seed,includeSaved=true,query=''){
 localAI.cancel();const ticket=++similarTicket,panel=$('#similar-panel');
 panel.innerHTML=`<h3>Semelhantes a ${escape(seed.name)}</h3><label><input type="checkbox" id="similar-saved" ${includeSaved?'checked':''}> Incluir títulos do meu catálogo</label><label for="similar-preference">O que você quer encontrar?</label><input id="similar-preference" maxlength="200" placeholder="Ex.: mais ação com o presidente dos EUA" value="${escape(query)}"><button class="secondary wide" id="search-similar">Buscar pelo enredo</button><p id="similar-status" class="muted" role="status">Consultando sinopses e temas…</p><div id="similar-grid"></div><div id="similar-reasons"></div><div id="similar-omitted"></div>${localAI.state.configured&&localAI.state.supported?'<button class="secondary wide" id="refine-similar">✧ Refinar com IA local</button><button class="secondary wide" id="cancel-similar" hidden>Cancelar IA</button>':'<button class="secondary wide" id="similar-ai-settings">Configurar IA local opcional</button>'}`;
 const search=panel.querySelector('#search-similar'),ai=panel.querySelector('#refine-similar'),status=panel.querySelector('#similar-status');
 search.disabled=true;panel.querySelector('#similar-saved').disabled=true;if(ai)ai.disabled=true;
 const run=async useLocal=>{
  if(!search.isConnected||search.disabled)return;
  const preference=panel.querySelector('#similar-preference').value,include=panel.querySelector('#similar-saved').checked;
  search.disabled=true;panel.querySelector('#similar-saved').disabled=true;if(ai)ai.disabled=true;let cancelled=false;const cancel=panel.querySelector('#cancel-similar');if(cancel&&useLocal){cancel.hidden=false;cancel.onclick=()=>{cancelled=true;localAI.cancel();status.textContent='Consulta cancelada. As opções anteriores foram preservadas.';};}
  status.textContent='Buscando candidatos para o pedido e conferindo sinopses…';
  try{
   const result=await similarEngine.find(seed,{existing:items,includeSaved:include,query:preference});
   if(ticket!==similarTicket||!panel.isConnected||cancelled)return;
   paintSimilar(panel,result);
   if(useLocal&&result.candidates.length){status.textContent='Executando o GGUF no celular entre candidatos que atendem aos critérios…';const answer=await localAI.generate(buildLocalSelectionPrompt(result.seed,result.candidates,preference));if(ticket!==similarTicket||!panel.isConnected||cancelled)return;const selected=validateLocalSelection(answer,result.candidates,{seed:result.seed,query:preference});if(!selected)throw Error('A IA não retornou uma seleção válida para os critérios. Mantive as opções do catálogo.');paintSimilar(panel,{...result,items:selected},true);}
  }catch(error){if(ticket===similarTicket&&status.isConnected&&!cancelled)status.textContent=error.message;}
  finally{if(search.isConnected){search.disabled=false;panel.querySelector('#similar-saved').disabled=false;}if(ai?.isConnected)ai.disabled=false;if(cancel?.isConnected)cancel.hidden=true;}
 };
 search.onclick=()=>run(false);if(ai)ai.onclick=()=>run(true);
 panel.querySelector('#similar-preference').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();run(false);}};
 panel.querySelector('#similar-saved').onchange=()=>run(false);
 if($('#similar-ai-settings'))$('#similar-ai-settings').onclick=()=>{$('#detail').close();setTab('connect');$('#local-ai-panel')?.scrollIntoView({block:'center'});};
 try{const result=await similarEngine.find(seed,{existing:items,includeSaved,query});if(ticket===similarTicket&&panel.isConnected)paintSimilar(panel,result);}
 catch(error){if(ticket===similarTicket&&status.isConnected)status.textContent=error.message;}
 finally{if(search.isConnected){search.disabled=false;panel.querySelector('#similar-saved').disabled=false;}if(ai?.isConnected)ai.disabled=false;}
}

window.CenaNuvioResult=state=>{
 if(!libraryReady){deferredNuvioState=state;return;}
 if(JSON.stringify(state)===JSON.stringify(nuvioState))return;
 const previousScope=nuvioState.scope;nuvioState=state;if(previousScope!==state.scope)nuvioSeriesRows=[];refreshNuvioEpisodes();renderSync();const merged=applyNuvioState(items,state),changed=JSON.stringify(merged)!==JSON.stringify(items);
 if(changed&&apiBase==='local'){items=merged;storage.setItem('cena.local.items.v1',JSON.stringify(items));}
 if(tab==='connect'&&!document.querySelector('#nuvio-profile:focus')){const panel=$('#nuvio-panel');renderNuvioPanel(panel,state,window.CenaAndroid);}
 if(!$('#detail').open){if(tab==='library'&&changed)patchLibrary();else if(tab==='home'&&changed){const y=window.scrollY;home();window.scrollTo(0,y);}}
 renderNuvioSections();renderSeriesSections();
};
async function refreshNuvioEpisodes(){const ticket=++nuvioSeriesTicket;if(!nuvioState.active){nuvioSeriesRows=[];return;}const scope=nuvioState.scope;await nuvioSeriesEngine.refresh(nuvioState,{isCurrent:()=>ticket===nuvioSeriesTicket&&scope===nuvioState.scope,onRow:row=>{nuvioSeriesRows=[...nuvioSeriesRows.filter(old=>old.id!==row.id),row];renderNuvioSections();renderSeriesSections();}});}
function resumeScope(){return nuvioState.scope||String(nuvioState.profileId||'');}
function renderNuvioSections(){
 const section=$('#nuvio-home');if(!section)return;
 const paused=nuvioContinue(items,nuvioState).map(entry=>({...entry,scope:resumeScope()}));const all=combineContinuity([...paused,...traktPausedEntries(traktState)],nextEpisodeEntries(items,seriesState,traktState,nuvioState,nuvioSeriesRows)),rows=visibleResume(all,resumeHidden,resumeScope());nuvioResults=rows.map(({item})=>({...item,...homeMetadata.get(`${item.type}:${item.id}`)}));
 if(!rows.length&&!all.length){section.innerHTML='';return;}
 const hidden=all.filter(entry=>resumeHidden[resumeKey(entry,resumeScope())]).length;
 if(!rows.length&&!hidden){section.innerHTML='';return;}
 section.innerHTML=`<div class="section-heading"><div><span class="eyebrow">SEU PRÓXIMO PLAY</span><h2>Continuar assistindo</h2></div>${rows.length>6?`<button id="resume-expand">${resumeExpanded?'Mostrar menos':`Ver todos · ${rows.length}`}</button>`:''}</div>${rows.length?`<div class="resume-rail ${resumeExpanded?'expanded':''}">${rows.slice(0,resumeExpanded?rows.length:6).map((entry,index)=>{const {row,label}=entry,item=nuvioResults[index],percent=Number.isFinite(entry.percent)?entry.percent:row.duration>0?Math.max(0,Math.min(99,Math.round(row.position/row.duration*100))):null;return `<article class="resume-card"><button class="resume-open" data-nuvio-title="${escape(item.id)}" data-nuvio-type="${escape(item.type)}" aria-label="Ver ${escape(titleName(item))}"><div class="resume-art">${poster({...item,name:titleName(item)})}<span class="resume-play" aria-hidden="true">▶</span></div><div class="resume-copy"><strong>${escape(titleName(item))}</strong><small>${escape(label)}</small><small class="continuity-source">${escape(entry.source)} · ${entry.kind==='paused'?'Retomar episódio ou filme':entry.kind==='pending'?'Aguardando confirmação':'Próximo episódio confirmado'}</small>${percent!==null?`<progress max="100" value="${percent}" aria-label="${percent}% assistido"></progress>`:''}${scoreMarkup(item)}${(entry.also||[]).map(row=>`<small class="continuity-secondary">Também em ${escape(row.source)}: ${escape(row.label)}</small>`).join('')}</div></button>${entry.kind==='pending'?'':`<button class="resume-dismiss" data-resume-hide="${index}" aria-label="Remover ${escape(titleName(item))} de continuar assistindo">×</button>`}</article>`;}).join('')}</div>`:'<p class="muted">Sua próxima sessão começa quando você quiser.</p>'}${hidden?`<button class="link-button restore-resume" id="resume-restore">Restaurar ${hidden} ${hidden===1?'título oculto':'títulos ocultos'}</button>`:''}`;
 for(const button of section.querySelectorAll('[data-nuvio-title]'))button.onclick=()=>showDetail(nuvioResults.find(row=>row.id===button.dataset.nuvioTitle&&row.type===button.dataset.nuvioType));
 for(const button of section.querySelectorAll('[data-resume-hide]'))button.onclick=()=>{resumeHidden[resumeKey(rows[Number(button.dataset.resumeHide)],resumeScope())]=true;storage.setItem(resumeHiddenKey,JSON.stringify(resumeHidden));renderNuvioSections();toast('Oculto no CENA. O histórico do Nuvio foi mantido.');};
 if($('#resume-expand'))$('#resume-expand').onclick=()=>{resumeExpanded=!resumeExpanded;renderNuvioSections();};
 if($('#resume-restore'))$('#resume-restore').onclick=()=>{for(const entry of all)delete resumeHidden[resumeKey(entry,resumeScope())];storage.setItem(resumeHiddenKey,JSON.stringify(resumeHidden));renderNuvioSections();};
 wireImages();hydrateHomeNames(rows.map(entry=>entry.item));
}
async function hydrateHomeNames(rows){
 for(const item of rows)if(!item.name||/^tt\d+$/.test(item.name))homeMetadataTried.has(`${item.type}:${item.id}`)||homeMetadata.set(`${item.type}:${item.id}`,homeMetadata.get(`${item.type}:${item.id}`)||{...item,name:''});
 if(homeMetadataBusy)return;homeMetadataBusy=true;
 try{for(const [key,value]of homeMetadata){if(homeMetadataTried.has(key))continue;homeMetadataTried.add(key);try{const details=await getTitleDetails(value);if(details.id===value.id&&details.type===value.type){homeMetadata.set(key,details);const saved=items.find(item=>item.id===value.id&&item.type===value.type);if(saved&&(!saved.name||/^tt\d+$/.test(saved.name))&&details.name&&!/^tt\d+$/.test(details.name)){saved.name=details.name;if(apiBase==='local')storage.setItem('cena.local.items.v1',JSON.stringify(items));}}}catch{}if(tab==='home'){renderNuvioSections();renderSeriesSections();}}}
 finally{homeMetadataBusy=false;}
}
window.CenaSeriesResult=state=>{if(JSON.stringify(state)===JSON.stringify(seriesState))return;seriesState=state;renderSync();renderNuvioSections();renderSeriesSections();};
window.CenaResume=()=>{if(libraryReady){refreshNuvioEpisodes();renderNuvioSections();renderSeriesSections();}};
const artworkModels = new Map();
const artworkObserved = new WeakSet();
const artworkLoading = new WeakSet();
function persistArtwork(item, url) {
  if(apiBase==='local') {
    const saved=items.find(row=>row.id===item.id && row.type===item.type);
    if(saved && saved.poster!==url) { saved.poster=url; try {storage.setItem('cena.local.items.v1',JSON.stringify(items));}catch{} }
  }
  for(const row of searchResults) if(row.id===item.id && row.type===item.type) row.poster=url;
  if(detailItem?.id===item.id && detailItem?.type===item.type) detailItem.poster=url;
  updateArtworkProgress();
}
async function hydrateArtwork(element) {
  if(!element.isConnected || artworkLoading.has(element))return;
  const item=artworkModels.get(element.dataset.artworkKey);if(!item)return;
  artworkLoading.add(element);
  try {
    element.dataset.artworkState='loading';
    const url=await artworkResolver.resolve(item,{shouldLoad:()=>{const rect=element.getBoundingClientRect();return element.isConnected&&rect.bottom>=-200&&rect.top<=innerHeight+200;}});
    if(!url){element.dataset.artworkState='missing';return;}
    element.dataset.artworkState='ready';
    persistArtwork(item,url);item.poster=url;
    artworkObserver?.unobserve(element);
    for(const poster of document.querySelectorAll('.poster-art[data-artwork-key]')) {
      if(poster.dataset.artworkKey!==element.dataset.artworkKey || poster.querySelector(':scope > img'))continue;
      const image=new Image();image.alt='';image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';image.src=url;
      image.onerror=()=>{image.remove();poster.dataset.artworkState='missing';delete artworkResolver.cache[artworkResolver.key(item)];persistArtwork(item,'');artworkResolver.failures.set(artworkResolver.key(item),Date.now());};
      poster.dataset.artworkState='ready';poster.insertBefore(image,poster.querySelector('.badge'));
    }
  } finally {artworkLoading.delete(element);}
}
const artworkObserver = typeof IntersectionObserver==='function' ? new IntersectionObserver(entries=>{
  for(const entry of entries) {
    if(!entry.target.isConnected){artworkObserver.unobserve(entry.target);continue;}
    if(entry.isIntersecting)hydrateArtwork(entry.target);
  }
},{rootMargin:'200px'}) : null;

function sendTraktInventory() {
  if(apiBase==='local'&&typeof window.CenaAndroid?.nuvioInventory==='function')window.CenaAndroid.nuvioInventory(JSON.stringify(items.map(({id,type})=>({id,type}))));
  if (apiBase === 'local' && native && typeof window.CenaAndroid.traktInventory === 'function') window.CenaAndroid.traktInventory(JSON.stringify(items.map(({id,type})=>({id,type}))));
}
function sendTraktList() {
  if(native && traktState.connected && typeof window.CenaAndroid.queueTraktBatch==='function') window.CenaAndroid.queueTraktBatch(JSON.stringify(items.filter(item=>item.status==='watchlist').map(({id,type})=>({id,type,action:'add'}))));
}
function queueTrakt(item, action) {
  if (apiBase === 'local' && native && traktState.connected && typeof window.CenaAndroid.queueTrakt === 'function') window.CenaAndroid.queueTrakt(JSON.stringify({id:item.id,type:item.type,action}));
}
window.CenaTraktResult = state => {
  if(!libraryReady) { deferredTraktState=state; return; }
  if(JSON.stringify(state)===JSON.stringify(traktState)) return;
  const becameConnected = state.connected && !traktWasConnected;
  if(!state.connected) traktInitialUploadRequested=false;
  traktWasConnected = Boolean(state.connected); traktState = state;renderSync();
  if(apiBase !== 'local') return;
  const merged = applyTraktState(items,state,{preserveWatchState:nuvioState.active});
  const libraryChanged=JSON.stringify(merged)!==JSON.stringify(items);
  if(libraryChanged) { items=merged; storage.setItem('cena.local.items.v1',JSON.stringify(items)); }
  if(becameConnected) sendTraktInventory();
  if(state.connected && state.needsUpload && !traktInitialUploadRequested) { traktInitialUploadRequested=true; sendTraktList(); }
  if(tab==='connect' && !document.querySelector('#trakt-client-id:focus, #stremio-filter:focus')) localConnection();
  else if(!$('#detail').open) {
    if(tab==='library') { if(libraryChanged)patchLibrary();else updateArtworkProgress(); }
    else if(tab==='home'&&libraryChanged) {const position=window.scrollY;home();window.scrollTo(0,position);}
  }
  renderNuvioSections();renderSeriesSections();
  const label=$('#trakt-item-state'); if(label && detailItem) label.textContent=traktItemLabel(detailItem,state);
};
main.addEventListener('click', event => {
  const card = event.target.closest?.('button.poster-card[data-id]');
  if (card) showDetail([...searchResults,...discoveryResults,...highlightsResults,...similarResults,...nuvioResults,...seriesResults,...collectionResults,...recentHistoryResults,...items].find(item => item.id === card.dataset.id));
});
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titleType = item => item.type === 'series' ? 'Série' : 'Filme';

function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 4000); }
async function api(route, options = {}) {
  if (apiBase === 'local') return localApi(route, options);
  if (!apiBase) throw Error('Conecte o endereço do seu servidor na aba Conectar.');
  const response = await fetch(`${apiBase}${route}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(connection ? { Authorization: `Bearer ${connection.writeToken}` } : {}), ...options.headers }, signal: AbortSignal.timeout(12000) });
  const value = await response.json();
  if (!response.ok) throw Error(value.error || 'Não foi possível conectar.');
  return value;
}
function persist() { storage.setItem(storageKey, JSON.stringify({ ...connection, apiBase })); }
async function ensureConnection() {
  if (connection) return;
  connection = await api('/api/libraries', { method: 'POST' });
  persist();
}
function notice() {
  if (apiBase === 'local') return `<div class="notice">${traktState.connected ? `Trakt conectado${traktState.pending?.length ? ` · ${traktState.pending.length} envio(s) pendente(s)` : ' · consulta de assistidos ativada'}` : 'Sua lista está salva neste aparelho. Conecte o Trakt para sincronizar com o Nuvio.'}</div>`;
  return config?.searchMode === 'sample' ? '<div class="notice">Prévia com 6 títulos de amostra. Busca completa disponível ao configurar o TMDB no servidor.</div>' : '';
}
function poster(item, badge = '', showRating = false) {
  const key=`${item.type}:${item.id}`;artworkModels.set(key,item);
  return `<div class="poster-art" data-artwork-key="${escape(key)}"><span class="fallback">${escape(item.name)}</span>${badge ? `<span class="badge">${escape(badge)}</span>` : ''}${showRating?scoreMarkup(item):''}<span class="stream-badge" data-stream-key="${escape(key)}"></span></div>`;
}
function grid(rows,recommendation=false) { return `<div class="grid">${rows.map(item => `<button class="poster-card" data-id="${escape(item.id)}" aria-label="Ver ${escape(item.name)}">${poster(item, item.status === 'watched' ? '✓ Assistido' : item.watchedEpisodes ? `${item.watchedEpisodes} episódios vistos` : '',true)}<strong>${escape(item.name)}</strong>${historyBadge(item)}<small>${escape(item.year)} · ${titleType(item)}</small>${recommendation?`<p class="recommendation-reason">${escape(item.recommendationReason)}</p>`:''}</button>`).join('')}</div>`; }
function wireImages() {
  wireRatings();wireStreaming();
  for(const element of document.querySelectorAll('.poster-art[data-artwork-key]')) {
    if(artworkObserved.has(element))continue;artworkObserved.add(element);
    if(artworkObserver)artworkObserver.observe(element);else hydrateArtwork(element);
  }
}
function wireCards(rows) {

  wireImages();
}
function empty(text = 'Sua próxima sessão começa aqui', sub = 'Busque um título ou fotografe uma capa para começar sua lista.') { return `<div class="empty"><div class="empty-icon">✧</div><h3>${text}</h3><p>${sub}</p><button class="secondary" id="empty-search">Buscar um título</button></div>`; }
const tabHistory=[];
function setTab(next, fromBack=false) {
  if(!fromBack && next!==tab) tabHistory.push(tab);
  if(tab==='profile'&&next!=='profile')historyDedicated=false;
  if(tab==='discover'&&next!=='discover')highlightView='';
  tab = next;
  searchGeneration++;
  document.querySelectorAll('nav [data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  if (tab === 'home') home();
  if (tab === 'library') library();
  if (tab === 'scan') scan();
  if (tab === 'connect') connect();
  if (tab === 'discover') discover();
  if (tab === 'profile') profile();
  if(tab==='collections')collections();
  window.scrollTo(0, 0);
}
window.CenaBack=()=>{const dialog=document.querySelector('dialog[open]');if(dialog){dialog.close();return true;}if(tab==='discover'&&highlightView){highlightView='';discover();return true;}if(tab==='collections'&&activeCollection){activeCollection='';collections();return true;}if(tabHistory.length){setTab(tabHistory.pop(),true);return true;}if(tab!=='home'){setTab('home',true);return true;}return false;};
function horizontalGrid(rows,recommendation=false){return grid(rows,recommendation).replace('class="grid"','class="poster-rail"');}
function loadRecentHistory(){if(tab!=='home')return;if(!historyState.scope||typeof window.CenaAndroid?.historyRows!=='function'){recentHistoryRows=[];renderRecentHistory();return;}recentHistoryRequest=String(++historyRequest);window.CenaAndroid.historyRows(recentHistoryRequest,'all','all',1,'');}
function renderRecentHistory(){const target=$('#recent-history');if(!target)return;const seen=new Set();const rows=recentHistoryRows.filter(row=>{const identity=row.id||row.mediaKey;if(!identity)return true;const key=(row.kind==='movie'?'movie:':'series:')+identity;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,10);recentHistoryResults=rows.map(row=>historyItem(row,items));target.innerHTML=`<div class="section-heading"><h2>Últimos vistos</h2><button id="recent-see-all">Ver histórico</button></div>${rows.length?`<div class="poster-rail">${rows.map((row,index)=>{const item=recentHistoryResults[index];return `<button class="poster-card" data-id="${escape(item.id)}">${poster(item,'',true)}<strong>${escape(item.name)}</strong><small>${row.kind==='episode'?`T${Number(row.season)} · E${Number(row.episode)} · `:''}${escape(historyDate(row))}</small></button>`;}).join('')}</div>`:'<p class="muted">Os filmes e episódios do seu histórico Trakt aparecerão aqui.</p>'}`;$('#recent-see-all').onclick=()=>{historyYear='all';historyKind='all';historyMedia='';historyMode='history';historyDedicated=true;setTab('profile');};wireImages();}
function home() {
 const pending=items.filter(item=>item.status==='watchlist');
 main.innerHTML=`<div class="home-welcome"><div class="eyebrow">SEU CINEMA, DO SEU JEITO</div><h1>Qual é o play<br>de hoje<span>?</span></h1><p>Suas histórias, no seu ritmo.</p></div><section id="nuvio-home"></section><section id="series-home"></section><section class="calendar-preview" id="home-calendar"></section><section id="home-recommendations"><div class="section-heading"><div><span class="eyebrow">BOAS PRÓXIMAS HISTÓRIAS</span><h2>Para você</h2></div><button id="home-discover">Explorar</button></div><div id="home-recommendation-grid"></div></section><section><div class="section-heading"><div><span class="eyebrow">SALVOS PARA DEPOIS</span><h2>Quero assistir</h2></div><button id="see-all">${pending.length?`Ver todos · ${pending.length}`:'Seu catálogo'}</button></div>${pending.length?horizontalGrid(pending.slice(0,6)):empty()}</section><button class="capture-strip" id="hero-scan"><span class="capture-strip-icon" aria-hidden="true">▣</span><span><strong>Viu uma boa história?</strong><small>Fotografe uma capa ou escolha um print</small></span><span aria-hidden="true">→</span></button><button class="home-sync" id="home-sync"><span class="sync-dot ${nuvioState.error||traktState.error?'pending':''}" aria-hidden="true"></span>${nuvioState.active?'Nuvio conectado':traktState.connected?'Trakt conectado':'Lista salva neste aparelho'}<span aria-hidden="true">→</span></button>`;
 $('#hero-scan').onclick=()=>setTab('scan');$('#see-all').onclick=()=>{filter='watchlist';setTab('library');};$('#home-discover').onclick=()=>{discoveryMode='recommend';setTab('discover');};$('#home-sync').onclick=()=>setTab('connect');
 if($('#empty-search'))$('#empty-search').onclick=()=>{setTab('library');$('#query').focus();};
 wireCards(pending);renderSeriesSections();renderNuvioSections();renderHomeRecommendations();
 const recent=document.createElement('section');recent.id='recent-history';$('#nuvio-home').after(recent);renderRecentHistory();loadRecentHistory();
 const area=$('#home-recommendations');if(typeof IntersectionObserver==='function'){const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();loadHomeRecommendations();}},{rootMargin:'100px'});observer.observe(area);}else loadHomeRecommendations();
}
function renderHomeRecommendations(){
 const target=$('#home-recommendation-grid');if(!target)return;
 const known=new Set(items.map(item=>`${item.type}:${item.id}`)),rows=discoveryResults.filter(item=>!known.has(`${item.type}:${item.id}`)).slice(0,5);
 target.innerHTML=rows.length?horizontalGrid(rows,true):`<div class="home-discovery-empty"><span aria-hidden="true">✧</span><p>${homeRecommendationPending?'Procurando histórias que combinam com você…':'Novas descobertas a partir do que você gosta.'}</p><button class="secondary" id="home-find-suggestions">Encontrar sugestões</button></div>`;
 if($('#home-find-suggestions'))$('#home-find-suggestions').onclick=()=>loadHomeRecommendations(true);
 wireImages();
}
async function loadHomeRecommendations(force=false){
 if(tab!=='home'||homeRecommendationPending)return;
 if(!force&&discoveryInfo&&discoveryFingerprint===tasteFingerprint()&&Date.now()-discoveryInfo.at<12*3600000){renderHomeRecommendations();return;}
 const fingerprint=tasteFingerprint();homeRecommendationPending=recommendationEngine.recommend(items,{force});renderHomeRecommendations();
 try{const result=await homeRecommendationPending;discoveryResults=result.items;discoveryInfo=result;discoveryFingerprint=fingerprint;}
 catch{}finally{homeRecommendationPending=null;if(tab==='home')renderHomeRecommendations();}
}
function collections(){
 const lists=readCollections(storage);if(activeCollection&&!lists[activeCollection])activeCollection='';
 const title=activeCollection?lists[activeCollection].name:'Minhas listas';
 main.innerHTML=`<div class="collection-header"><button class="collection-back" id="collections-back" aria-label="Voltar">←</button><div><span class="eyebrow">SEU CINEMA</span><h1>${escape(title)}</h1></div></div><div id="collection-choices" class="collection-list"></div><section id="collection-titles"></section>${activeCollection?'':'<form id="new-collection" class="search-row"><input id="collection-name" placeholder="Nome da nova lista" aria-label="Nome da nova lista" maxlength="60" required><button class="primary">Criar</button></form>'}`;
 $('#collections-back').onclick=()=>window.CenaBack();
 const choices=$('#collection-choices');if(!activeCollection)for(const [id,list]of Object.entries(lists)){const button=document.createElement('button');button.className='collection-tile';const saved=collectionItems(storage,id,items);button.innerHTML=`<span class="collection-tile-art">${saved[0]?poster(saved[0]):'<span aria-hidden="true">▤</span>'}</span><span class="collection-tile-copy"><strong>${escape(list.name)}</strong><small>${saved.length} ${saved.length===1?'título':'títulos'}</small></span><span aria-hidden="true">›</span>`;button.onclick=()=>{activeCollection=id;collections();};choices.append(button);}
 if($('#new-collection'))$('#new-collection').onsubmit=event=>{event.preventDefault();try{activeCollection=createCollection(storage,$('#collection-name').value);collections();}catch(error){toast(error.message);}};
 if(!activeCollection){$('#collection-titles').innerHTML=Object.keys(lists).length?'':'<p class="muted">Crie sua primeira lista para organizar seus filmes e séries.</p>';wireImages();return;}
 collectionResults=collectionItems(storage,activeCollection,items);$('#collection-titles').innerHTML=collectionResults.length?grid(collectionResults):'<p class="muted">Esta lista ainda não tem títulos. Adicione pelo detalhe de um filme ou série.</p>';wireImages();
}
function renderSync(){const target=$('#sync-summary');if(target)renderSyncSummary(target,{trakt:traktState,nuvio:nuvioState,history:historyState,series:seriesState});}
function library() {
  const rows = items.filter(i => filter === 'all' || i.status === filter);
  main.innerHTML = `<div class="eyebrow">CADA HISTÓRIA TEM SEU LUGAR</div><h1>Meu catálogo</h1><button class="secondary" id="open-collections">♡ Minhas listas</button><form id="search-form" class="search-row"><input id="query" type="search" placeholder="Buscar filme ou série…" aria-label="Nome do filme ou série" minlength="2" maxlength="150" required><button class="primary" type="submit">Buscar</button></form><div class="chips"><button class="chip ${filter === 'watchlist' ? 'selected' : ''}" data-filter="watchlist">Quero assistir</button><button class="chip ${filter === 'watched' ? 'selected' : ''}" data-filter="watched">Assistidos</button><button class="chip ${filter === 'all' ? 'selected' : ''}" data-filter="all">Todos</button></div><div id="search-results"></div><div class="section-heading"><h2>${filter === 'watched' ? 'Já fizeram parte da sua história' : 'Na sua lista'}</h2><div class="actions"><span class="count" id="library-count">${rows.length} títulos</span><button class="link-button" id="refresh-artwork">Atualizar capas</button></div></div><p id="artwork-progress" class="muted"></p><div id="library-grid">${rows.length ? grid(rows) : empty()}</div><div id="library-sync-notice">${notice()}</div>`;
  if($('#open-collections'))$('#open-collections').onclick=()=>setTab('collections');
  if($('#refresh-artwork')) $('#refresh-artwork').onclick=()=>{
    artworkResolver.retry();
    for(const element of document.querySelectorAll('.poster-art[data-artwork-key]')) {
      if(element.querySelector(':scope > img'))continue;
      const rect=element.getBoundingClientRect();if(rect.bottom>=0 && rect.top<=innerHeight+200)hydrateArtwork(element);
    }
    toast('Buscando capas. As demais carregam ao rolar a lista.');
  };
  $('#search-form').onsubmit = e => { e.preventDefault(); runSearch($('#query').value); };
  document.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { filter = button.dataset.filter; library(); });
  if ($('#empty-search')) $('#empty-search').onclick = () => $('#query').focus();
  wireCards(rows);updateArtworkProgress();
}
function updateArtworkProgress(){
  const label=$('#artwork-progress');if(!label)return;
  const rows=items.filter(i=>filter==='all'||i.status===filter),known=rows.filter(i=>trustedArtwork(i.poster)).length;
  label.textContent=`Capas salvas: ${known} de ${rows.length}. As demais carregam ao rolar.`;
}
function patchLibrary(){
  const target=$('#library-grid');if(!target)return;
  const anchors=[...target.querySelectorAll('.poster-card')].filter(card=>{const rect=card.getBoundingClientRect();return rect.bottom>0&&rect.top<innerHeight;}).map(card=>({card,top:card.getBoundingClientRect().top}));
  const position=window.scrollY,rows=items.filter(i=>filter==='all'||i.status===filter);
  const existing=new Map([...target.querySelectorAll('.poster-card')].map(card=>[card.querySelector('[data-artwork-key]')?.dataset.artworkKey,card]));
  let list=target.querySelector(':scope > .grid');
  if(!rows.length){target.innerHTML=empty();if($('#empty-search'))$('#empty-search').onclick=()=>$('#query').focus();}
  else{
    if(!list){target.innerHTML='<div class="grid"></div>';list=target.firstElementChild;}
    let next=list.firstElementChild;
    for(const row of rows){
      const key=`${row.type}:${row.id}`;let card=existing.get(key);artworkModels.set(key,row);
      if(!card){const template=document.createElement('template');template.innerHTML=grid([row]);card=template.content.querySelector('.poster-card');}
      existing.delete(key);
      const art=card.querySelector('.poster-art'),badge=row.status==='watched'?'✓ Assistido':row.watchedEpisodes?`${row.watchedEpisodes} episódios vistos`:'';
      let badgeNode=art.querySelector('.badge');
      if(badge){if(!badgeNode){badgeNode=document.createElement('span');badgeNode.className='badge';art.append(badgeNode);}badgeNode.textContent=badge;}else badgeNode?.remove();
      card.querySelector('strong').textContent=row.name;let years=card.querySelector('.watch-years');if(!years){years=document.createElement('span');years.className='watch-years';card.querySelector('strong').after(years);}years.textContent=historyYearLabel(row);card.querySelector('.fallback').textContent=row.name;card.querySelector('small').textContent=`${row.year||''} · ${titleType(row)}`;
      if(card!==next)list.insertBefore(card,next);next=card.nextElementSibling;
    }
    for(const card of existing.values())card.remove();
  }
  const count=$('#library-count');if(count)count.textContent=`${rows.length} títulos`;
  const noticeArea=$('#library-sync-notice');if(noticeArea)noticeArea.innerHTML=notice();
  updateArtworkProgress();wireImages();
  const anchor=anchors.find(value=>value.card.isConnected);
  if(anchor)window.scrollBy(0,anchor.card.getBoundingClientRect().top-anchor.top);else window.scrollTo(0,position);
}
function refreshCurrentView(){
  if(tab==='profile'){renderHistorySummary();return;}
  if(tab==='discover'){renderRecommendations();renderSeriesSections();}
  else if(tab==='library')patchLibrary();else if(tab==='home'){const position=window.scrollY;home();window.scrollTo(0,position);}
}
function seriesRows(){return homeSeries(items,seriesState,nuvioState,{trakt:traktState,nuvioRows:nuvioSeriesRows});}
function seriesContent(limit=Infinity){
 const rows=seriesRows();seriesResults=rows.map(row=>row.item);
 return `<p class="muted">Progresso identificado por fonte. Nuvio e Trakt podem ter perfis ou horários diferentes; as contagens não são somadas.</p><div class="actions"><button class="secondary" data-series-refresh>Atualizar episódios</button></div>${seriesState.error?`<p class="notice">${escape(seriesState.error)}</p>`:''}${!rows.length?'<p class="muted">As séries iniciadas recebidas das suas contas aparecerão automaticamente aqui.</p>':`<div class="grid series-grid">${rows.slice(0,limit).map(({item,headline,detail,source,state})=>`<button class="poster-card series-grid-card" data-series-id="${escape(item.id)}">${poster({...item,name:titleName(item)},'',true)}<strong>${escape(titleName(item))}</strong><span class="series-status">${escape(headline)}</span><small>${escape(detail)}</small>${state?.warning?`<small>${escape(state.warning)}</small>`:''}<small>Fonte: ${escape(source)}</small></button>`).join('')}</div>`}`;
}

function renderSeriesSections(){
  const position=window.scrollY;
  const homeSection=$('#series-home');if(homeSection){
   const rows=seriesRows();seriesResults=rows.map(row=>row.item);
   homeSection.innerHTML=rows.length?`<div class="section-heading"><div><span class="eyebrow">EPISÓDIO POR EPISÓDIO</span><h2>${nuvioState.active?'Suas séries':'Próximos episódios'}</h2></div><button id="see-series">Ver todas</button></div><div class="poster-rail series-rail">${rows.slice(0,6).map(({item,headline,detail})=>`<button class="poster-card" data-series-id="${escape(item.id)}">${poster({...item,name:titleName(item)})}<strong>${escape(titleName(item))}</strong><span class="series-status">${escape(headline)}</span><small>${escape(detail)}</small></button>`).join('')}</div>`:'';
   if($('#see-series'))$('#see-series').onclick=()=>{discoveryMode='series';setTab('discover');};
  }
  const section=$('#series-discovery');if(section)section.innerHTML=seriesContent();
  const details=$('#series-detail-state');if(details){const state=seriesState.items?.find(row=>row.id===detailItem?.id);if(detailItem?.type==='series'&&traktState.connected){const summary=seriesSummary(state);details.innerHTML=`<div class="notice"><strong>${escape(summary.headline)}</strong><p>${escape(summary.detail)}</p>${state?.error?'<p>Consulta pendente. Os dados anteriores foram preservados.</p>':''}</div>`;}else details.innerHTML='';}
  for(const button of document.querySelectorAll('[data-series-refresh]'))button.onclick=()=>{if(typeof window.CenaAndroid?.refreshSeries==='function'){window.CenaAndroid.refreshSeries();refreshNuvioEpisodes();toast('Consulta de episódios solicitada.');}else toast('A consulta de episódios usa a conexão Trakt no APK Android.');};
  for(const button of document.querySelectorAll('[data-series-id]'))button.onclick=()=>showDetail(seriesResults.find(item=>item.id===button.dataset.seriesId));
  for(const id of ['#calendar-panel','#home-calendar']){const target=$(id);if(target){mountCalendar(target,{items:seriesUniverse(items,traktState,nuvioState,seriesState),state:seriesState,nuvioActive:nuvioState.active,onOpen:showDetail});if(id==='#home-calendar'&&!target.querySelector('.calendar-row'))target.replaceChildren();}}
  wireImages();if(window.scrollY!==position)window.scrollTo(0,position);
}
function discover(){
  if(highlightView){const type=highlightView;const rows=highlightsResults.filter(item=>item.type===type);main.innerHTML=`<div class="discovery-list-heading"><button class="secondary" id="highlights-back" aria-label="Voltar">←</button><div><h1>${type==='movie'?'Filmes em destaque':'Séries em destaque'}</h1><p class="muted">Catálogo Cinemeta</p></div></div>${rows.length?grid(rows):'<p class="muted">Nenhum título disponível agora.</p>'}`;$('#highlights-back').onclick=()=>window.CenaBack();wireImages();return;}
  main.innerHTML=`<div class="eyebrow">NOVAS HISTÓRIAS PARA VOCÊ</div><h1>Descobrir</h1><div class="chips"><button class="chip ${discoveryMode==='recommend'?'selected':''}" data-discovery-mode="recommend">Para você</button><button class="chip ${discoveryMode==='series'?'selected':''}" data-discovery-mode="series">Suas séries</button></div>${discoveryMode==='series'?'<section class="panel" id="calendar-panel"></section><section id="series-discovery"></section>':`<section id="discovery-highlights" aria-label="Destaques"></section><p class="muted">Novas histórias a partir do que você gosta. Abra um título para dar seu feedback.</p><details class="recommendation-explanation"><summary>Como as sugestões funcionam</summary><p class="muted">Gêneros, temas, elenco, assistidos e suas notas ajudam nas escolhas. Gostei reforça seu gosto; Não combina e Já assisti retiram o título das próximas sugestões.</p></details><div class="chips"><button class="chip ${discoveryFilter==='all'?'selected':''}" data-discovery-filter="all">Tudo</button><button class="chip ${discoveryFilter==='movie'?'selected':''}" data-discovery-filter="movie">Filmes</button><button class="chip ${discoveryFilter==='series'?'selected':''}" data-discovery-filter="series">Séries</button></div><div class="actions"><button class="secondary" id="refresh-recommendations">Mostrar outras sugestões</button></div><div id="recommendation-status" class="muted" role="status"></div><div id="recommendation-grid"></div><p class="muted">Abra uma indicação para ver detalhes e adicionar a Quero assistir. Com o Trakt conectado, ela segue para sua lista usada no Nuvio.</p>`}`;
  document.querySelectorAll('[data-discovery-mode]').forEach(button=>button.onclick=()=>{discoveryMode=button.dataset.discoveryMode;discover();});
  document.querySelectorAll('[data-discovery-filter]').forEach(button=>button.onclick=()=>{discoveryFilter=button.dataset.discoveryFilter;discover();});
  renderSeriesSections();
  if($('#refresh-recommendations'))$('#refresh-recommendations').disabled=discoveryRefreshing;
  if(discoveryMode==='recommend'){renderHighlights();loadHighlights();$('#refresh-recommendations').onclick=()=>loadRecommendations(true);renderRecommendations();if(!discoveryInfo||discoveryFingerprint!==tasteFingerprint()||Date.now()-discoveryInfo.at>=12*3600000)loadRecommendations();}
}
function renderHighlights(){
 const target=$('#discovery-highlights');if(!target)return;
 if(!highlightsResults.length){target.innerHTML=highlightsPending?'<p class="muted" role="status">Carregando destaques…</p>':'<p class="muted">Destaques indisponíveis agora. <button class="highlight-retry">Tentar novamente</button></p>';target.querySelector('.highlight-retry')?.addEventListener('click',()=>loadHighlights(true));return;}
 target.innerHTML=['movie','series'].map(type=>{const rows=highlightsResults.filter(item=>item.type===type);if(!rows.length)return '';return `<section class="highlights-section"><div class="section-heading"><h2>${type==='movie'?'Filmes em destaque':'Séries em destaque'}</h2><button data-highlight-type="${type}">Ver todos</button></div>${horizontalGrid(rows.slice(0,12))}</section>`;}).join('')+'<p class="highlight-source">Destaques do catálogo Cinemeta</p>';
 target.querySelectorAll('[data-highlight-type]').forEach(button=>button.onclick=()=>{highlightView=button.dataset.highlightType;discover();window.scrollTo(0,0);});wireImages();
}
async function loadHighlights(force=false){
 if(highlightsPending||(!force&&highlightsResults.length&&Date.now()-highlightsAt<12*3600000))return;
 highlightsPending=recommendationEngine.catalog(force,[]);renderHighlights();
 try{const result=await highlightsPending;highlightsResults=result.items;highlightsAt=result.at;}catch{}finally{highlightsPending=null;if(tab==='discover'&&!highlightView)renderHighlights();}
}
function renderRecommendations(){
  const target=$('#recommendation-grid');if(!target)return;
  const known=new Set(items.map(item=>`${item.type}:${item.id}`));
  const rows=discoveryResults.filter(item=>!known.has(`${item.type}:${item.id}`)&&(discoveryFilter==='all'||item.type===discoveryFilter)).slice(0,24);
  patchRecommendationCards(target,rows);
  const status=$('#recommendation-status');if(status&&discoveryInfo)status.textContent=`${discoveryInfo.seedCount?'Baseado em '+discoveryInfo.seedCount+' títulos do seu catálogo.':'Descobertas do catálogo para começar.'} ${discoveryInfo.stale?'Mostrando a última consulta salva. ':''}Atualizado em ${new Date(discoveryInfo.at).toLocaleString('pt-BR')}.`;
  wireImages();
}
function patchRecommendationCards(target,rows){
 const current=new Map([...target.querySelectorAll('.poster-card')].map(card=>[card.querySelector('[data-artwork-key]')?.dataset.artworkKey,card]));
 let list=target.querySelector(':scope > .grid');
 if(!rows.length){if(!target.querySelector('.empty'))target.innerHTML=discoveryInfo?'<div class="empty"><p>Sem novas sugestões neste filtro.</p></div>':'';return;}
 if(!list){target.innerHTML='<div class="grid"></div>';list=target.firstElementChild;}
 let next=list.firstElementChild;
 for(const item of rows){
  let card=current.get(`${item.type}:${item.id}`);current.delete(`${item.type}:${item.id}`);
  if(!card){const template=document.createElement('template');template.innerHTML=grid([item],true);card=template.content.querySelector('.poster-card');}
  artworkModels.set(`${item.type}:${item.id}`,item);ratingModels.set(`${item.type}:${item.id}`,item);
  const reason=card.querySelector('.recommendation-reason');if(reason&&reason.textContent!==item.recommendationReason)reason.textContent=item.recommendationReason;
  if(card!==next)list.insertBefore(card,next);next=card.nextElementSibling;
 }
 for(const card of current.values())card.remove();
}
function tasteFingerprint(){return JSON.stringify(items.map(({id,type,status,watchedEpisodes})=>({id,type,status,watchedEpisodes})))+(storage.getItem('cena.story.notes.v1')||'')+(storage.getItem('cena.feedback.v1')||'');}
async function loadRecommendations(force=false){
 const status=$('#recommendation-status'),button=$('#refresh-recommendations');if(!status||discoveryRefreshing)return;
 const ticket=++discoveryRequest,selectedFilter=discoveryFilter;
 const known=new Set(items.map(item=>`${item.type}:${item.id}`));
 const exclude=force?discoveryResults.filter(item=>!known.has(`${item.type}:${item.id}`)&&(selectedFilter==='all'||item.type===selectedFilter)).slice(0,24).map(item=>`${item.type}:${item.id}`):[];
 discoveryRefreshing=true;status.textContent=force?'Procurando outras sugestões… Suas capas continuam aqui.':'Preparando sugestões a partir do seu catálogo…';if(button){button.disabled=true;button.textContent='Buscando sugestões…';}
 try{
  const fingerprint=tasteFingerprint(),value=await recommendationEngine.recommend(items,{force,exclude});
  if(ticket!==discoveryRequest)return;
  const alternatives=value.items.filter(item=>selectedFilter==='all'||item.type===selectedFilter);
  if(force&&!alternatives.length){if(status.isConnected)status.textContent=value.stale?'Não consegui consultar novas opções agora. As sugestões anteriores foram mantidas.':'Não encontrei outras opções neste filtro agora. As sugestões anteriores foram mantidas.';return;}
  if(force&&selectedFilter!=='all')value.items=[...value.items.filter(item=>item.type===selectedFilter),...discoveryResults.filter(item=>item.type!==selectedFilter)];
  discoveryResults=value.items;discoveryInfo=value;discoveryFingerprint=fingerprint;
  if(tab==='discover'&&$('#recommendation-status')){renderRecommendations();if(value.stale)$('#recommendation-status').textContent='Mostrando outras opções do catálogo salvo. Não consegui atualizar o catálogo online agora.';}
 }catch(error){if(status.isConnected)status.textContent='Não consegui atualizar agora. Suas sugestões foram mantidas. '+error.message;}
 finally{discoveryRefreshing=false;const active=$('#refresh-recommendations');if(active){active.disabled=false;active.textContent='Mostrar outras sugestões';}}
}
async function runSearch(query, coverLines = null) {
  const target = $('#search-results');
  if (!target) return;
  query = query.trim();
  if (query.length < 2) { toast('Digite pelo menos duas letras.'); return; }
  const generation = ++searchGeneration;
  target.innerHTML = '<div class="loading" role="status">Procurando sua próxima história…</div>';
  try {
    const response = coverLines && apiBase === 'local' ? { items: await identifyCover(coverLines), mode: 'assisted' } : await api(`/api/search?q=${encodeURIComponent(query)}`);
    if (generation !== searchGeneration || !target.isConnected) return;
    searchResults = response.items;
    if (coverLines && searchResults[0]?.matchScore >= .65 && (!searchResults[1] || searchResults[0].matchScore - searchResults[1].matchScore >= .04)) {
      const field = $('#scan-query');
      if (field) field.value = searchResults[0].originalName || searchResults[0].name;
    }
    const assisted = searchResults.some(item => item.suggested) || response.mode === 'assisted';
    target.innerHTML = `<div class="section-heading"><h2>${assisted ? 'Possíveis correspondências' : 'Resultados'}</h2><span class="count">${searchResults.length} títulos</span></div>${assisted && searchResults.length ? '<p class="muted">Conferi variações do texto e pistas da capa. Confira a imagem e o ano antes de adicionar.</p>' : ''}${searchResults.length ? `<div id="result-grid">${grid(searchResults)}</div>` : '<div class="empty"><p>Nenhum título encontrado. Tente o nome original ou ajuste o texto da capa.</p></div>'}`;

    wireImages();
    if (native && coverLines && searchResults.some(item => item.poster) && typeof window.CenaAndroid.compareCovers === 'function') {
      target.insertAdjacentHTML('beforeend', '<div id="vision-status" class="notice" role="status">Comparando as capas com IA no aparelho…</div>');
      window.CenaAndroid.compareCovers(String(generation), JSON.stringify(searchResults.filter(item => item.poster).slice(0,4).map(item => ({ id: item.id, poster: item.poster }))));
    }
  } catch (error) { if (generation === searchGeneration && target.isConnected) target.innerHTML = `<div class="error" role="alert">${escape(error.message)}</div>`; }
}
function scan() {
  main.innerHTML = `<div class="eyebrow">ENCONTROU UMA BOA HISTÓRIA?</div><h1>Capturar título</h1><p class="muted">Use uma foto de capa ou um print da sua galeria.</p><div class="scan-frame">${scanPhoto ? `<img src="${escape(scanPhoto)}" alt="Foto da capa escolhida">` : '<div class="scan-corners"><span class="scan-symbol">▣</span>A próxima sessão<br>começa com uma foto.</div>'}</div><div class="scan-controls"><button class="primary wide" id="take-photo">▣ &nbsp; ${scanPhoto ? 'Fotografar novamente' : 'Abrir câmera'}</button><button class="secondary wide" id="pick-image">Escolher imagem ou print</button></div><div class="notice">${native ? 'Fotografe, escolha um print ou use Compartilhar → CENA. Inclua o título e a imagem da capa no recorte. A leitura e a comparação visual com IA acontecem no aparelho; sua imagem não é enviada ao servidor.' : 'Na prévia web, você pode escolher ou fotografar uma capa e digitar o título. A leitura automática do texto está preparada no aplicativo Android.'}</div><form id="scan-search" class="search-row"><textarea id="scan-query" rows="3" placeholder="Título completo da capa" aria-label="Título completo identificado na imagem" minlength="2" maxlength="150" required></textarea><button class="primary">Buscar</button></form><div id="detected-lines"></div><div id="search-results"></div>`;
  $('#take-photo').onclick = () => { if (native) window.CenaAndroid.scanCover(); else { $('#photo-input').setAttribute('capture', 'environment'); $('#photo-input').click(); } };
  $('#pick-image').onclick = () => { if (native) window.CenaAndroid.pickImage(); else { $('#photo-input').removeAttribute('capture'); $('#photo-input').click(); } };
  $('#scan-search').onsubmit = event => { event.preventDefault(); runSearch($('#scan-query').value); };
}
$('#photo-input').onchange = event => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) { toast('Escolha uma imagem de até 15 MB.'); return; }
  if (scanPhoto) URL.revokeObjectURL(scanPhoto);
  scanPhoto = URL.createObjectURL(file);
  setTab('scan'); $('#scan-query').focus();
  event.target.value = '';
};
window.CenaNativeResult = result => {
  if (result.error) { toast(result.error); return; }
  if ($('#detail').open) $('#detail').close();
  setTab('scan');
  const input = coverInput(result);
  const lines = (result.lines || []).filter(line => typeof line === 'string' && line.trim().length > 2);
  detectedLines = [...new Set(lines)].slice(0, 6);
  if (detectedLines.length > 1 && input.query === lines[0]) {
    $('#detected-lines').innerHTML = `<p class="muted">O título está em outra linha? Toque para buscar:</p><div class="chips">${detectedLines.map((line, index) => `<button class="chip" data-line="${index}">${escape(line)}</button>`).join('')}</div>`;
    document.querySelectorAll('[data-line]').forEach(button => button.onclick = () => { $('#scan-query').value = detectedLines[Number(button.dataset.line)].slice(0, 150); runSearch($('#scan-query').value); });
  }
  $('#scan-query').value = input.query;
  if (input.query) { toast('Buscando o título completo e as pistas da capa…'); runSearch(input.query, input.lines); }
  else toast('Não encontrei texto. Digite o título para buscar.');
};
window.CenaVisualResult = result => {
  if (String(result.requestId) !== String(searchGeneration)) return;
  const status = $('#vision-status');
  if (!status) return;
  if (result.status === 'ok' && Array.isArray(result.scores) && result.scores.length) {
    searchResults = rankWithVision(searchResults, result.scores);
    const area = $('#result-grid');
    if (area) {
      area.innerHTML = grid(searchResults);

      wireImages();
    }
    status.textContent = 'IA visual local: comparei sua imagem com as capas encontradas. Confirme o título e o ano antes de adicionar.';
  } else {
    status.textContent = result.status === 'no-references' ? 'Não encontrei capas disponíveis para comparar. Confira as sugestões pelo texto.' : (!visualModelState.available?'Comparação visual opcional: baixe o modelo em Conectar. A busca pelo texto continua funcionando.':'A comparação visual não ficou disponível neste aparelho. As sugestões pelo texto continuam disponíveis.');
  }
};

async function save(item, status = 'watchlist') {
  if (busy) return false;
  busy = true;
  try {
    await ensureConnection();
    const payload={...item,status};delete payload.recommendationReason;delete payload.affinity;delete payload.providerOrder;
    if(status==='watchlist') { delete payload.watchedSource; delete payload.watchedAt; }
    const result = await api(`/api/libraries/${connection.id}/items`, { method: 'PUT', body: JSON.stringify(payload) });
    items = result.items;
    sendTraktInventory(); queueTrakt(item, status === 'watchlist' ? 'add' : 'remove');
    toast(status === 'watched' ? 'Marcado como assistido.' : apiBase === 'local' ? 'Adicionado à lista neste aparelho.' : 'Adicionado! Sua lista no servidor foi atualizada.');
    showDetail(item); refreshCurrentView();return true;
  } catch (error) { toast(error.message);return false; }
  finally { busy = false; }
}
async function remove(item) {
  if (busy) return;
  busy = true;
  try {
    const result = await api(`/api/libraries/${connection.id}/items/${item.id}`, { method: 'DELETE' });
    items = result.items; queueTrakt(item,'remove'); sendTraktInventory(); $('#detail').close();refreshCurrentView();toast('Título removido da lista.');
  } catch (error) { toast(error.message); }
  finally { busy = false; }
}
function showDetail(item, enriched = false) {
  if (!item) return;
  localAI.cancel();similarTicket++;
  detailItem = item;
  if(trustedArtwork(item.poster))persistArtwork(item,item.poster);
  const saved = items.find(i => i.id === item.id);
  $('#detail-content').innerHTML = `<div class="detail-backdrop" id="detail-backdrop" aria-hidden="true"></div><div class="detail-top">${poster(item)}<div><div class="eyebrow">${titleType(item)}</div><h2>${escape(item.name)}</h2>${scoreMarkup(item)}<span class="meta">${escape(item.year)} · ${escape(item.genre)}</span></div></div><div class="detail-body"><h3>Sinopse</h3><p id="detail-synopsis" class="synopsis-clamp">${escape(item.description || 'Sem sinopse disponível.')}</p><button class="link-button" id="synopsis-expand" aria-expanded="false">Ler sinopse completa</button><p id="detail-loading" class="muted" role="status">${enriched ? '' : 'Buscando sinopse e ficha técnica…'}</p>${item.runtime ? `<p><strong>Duração:</strong> ${escape(item.runtime)}</p>` : ''}${item.directors?.length ? `<p><strong>Direção:</strong> ${escape(item.directors.join(', '))}</p>` : ''}${item.cast?.length ? `<p><strong>Elenco:</strong> ${escape(item.cast.slice(0,12).join(', '))}</p>` : ''}${item.detailError ? `<p role="alert">${escape(item.detailError)}</p>` : ''}${saved ? `<div class="status-label">✓ ${saved.status === 'watched' ? 'Você já assistiu' : 'Na sua lista Quero assistir'}</div>` : ''}<div id="title-watch-history"></div><div id="series-detail-state"></div><p class="muted" id="trakt-item-state">${escape(traktItemLabel(item,traktState))}</p>${saved?.watchedSource === "Nuvio" ? '<p class="muted">✓ Assistido confirmado no histórico Nuvio.</p>' : ''}${saved?.watchedSource === "Trakt" ? '<p class="muted">✓ Assistido confirmado no histórico Trakt.</p>' : ''}<button class="primary wide" id="add-title">${saved?.status === 'watchlist' ? '✓ Está na minha lista' : '+ Quero assistir'}</button><div class="actions"><button class="secondary" id="rate-title">☆ Avaliar</button><button class="secondary" id="share-title">↗ Criar Story</button>${saved ? `<button class="secondary" id="mark-status">${saved.status === 'watched' ? '↺ Rever depois' : '✓ Já assisti'}</button>` : ''}</div>${saved ? '<button class="link-button" id="remove-title">Remover do catálogo</button>' : ''}<p class="muted">${apiBase === 'local' ? 'Sua lista fica salva neste aparelho.' : 'A lista foi atualizada no servidor. Atualize o catálogo no player.'}</p>${item.sourceUrl ? `<p class="muted">Metadados: <a href="${escape(item.sourceUrl)}" target="_blank" rel="noreferrer">${escape(item.source || "Catálogo")}</a></p>` : ''}<button class="secondary wide" id="similar-titles">✧ Ver semelhantes</button><div id="similar-panel"></div><section class="detail-section" id="title-feedback"></section><section class="detail-section" id="title-collections"></section><div id="story-editor"></div></div>`;
  $('#add-title').onclick = () => saved?.status === 'watchlist' ? toast('Este título já está na sua lista.') : save(item);
  if ($('#mark-status')) $('#mark-status').onclick = () => save(item, saved.status === 'watched' ? 'watchlist' : 'watched');
  if ($('#remove-title')) $('#remove-title').onclick = () => remove(item);
  $('#share-title').onclick = () => story(item);
  $('#rate-title').onclick=async()=>{await story(item);$('#story-rating')?.focus();};
  $('#synopsis-expand').onclick=()=>{const expanded=$('#synopsis-expand').getAttribute('aria-expanded')==='true';$('#detail-synopsis').classList.toggle('synopsis-clamp',expanded);$('#synopsis-expand').setAttribute('aria-expanded',String(!expanded));$('#synopsis-expand').textContent=expanded?'Ler sinopse completa':'Recolher sinopse';};
  const backdrop=$('#detail-backdrop');if(trustedArtwork(item.poster)){const image=new Image();image.src=item.poster;image.alt='';backdrop.append(image);}
  mountTitleCollections($('#title-collections'),{storage,item,toast});
  mountFeedback($('#title-feedback'),{storage,item,toast,onSeen:async value=>{if(value.type==='series')throw Error('Para séries, registre os episódios no player ou use os controles de progresso.');if(!await save(value,'watched'))throw Error('Não consegui marcar este filme. Tente novamente.');},onChange:()=>{const values=readFeedback(storage);discoveryResults=discoveryResults.filter(row=>!['dislike','seen'].includes(values[row.type+':'+row.id]?.value));discoveryInfo=null;discoveryFingerprint='';if(tab==='discover')renderRecommendations();if(tab==='home')renderHomeRecommendations();}});

  $('#similar-titles').onclick=()=>findSimilar(item);
  renderSeriesSections();renderTitleHistory(item);
  if(typeof window.CenaAndroid?.historyState==='function')window.CenaAndroid.historyState();
  wireImages();
  if (!$('#detail').open) { $('#detail').showModal(); $('#detail').scrollTop = 0; }
  if (!enriched) getTitleDetails(item).then(details => {
    if ($('#detail').open && detailItem?.id === item.id) {
      if($('#story-canvas')||$('#similar-panel')?.childNodes.length||document.activeElement?.closest('#title-collections,#title-feedback')) { const status=$('#detail-loading'); if(status) status.textContent=''; }
      else showDetail(details, true);
    }
  }).catch(() => { const status = $('#detail-loading'); if (status && detailItem?.id === item.id) status.textContent = 'Não consegui carregar a ficha. Tente abrir o filme novamente.'; });
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Link copiado.'); }
  catch { toast('Selecione e copie o link no campo acima.'); }
}
function validBase(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !['https:', 'http:'].includes(url.protocol)) throw Error('Use apenas a origem do servidor, por exemplo https://cena.exemplo.com');
  if (native && url.protocol !== 'https:') throw Error('No aplicativo Android, use um endereço HTTPS.');
  return url.origin;
}
function connect() {
  if (apiBase === 'local') { localConnection(); return; }
  const connected = Boolean(connection);
  main.innerHTML = `<div class="eyebrow">SUA LISTA, EM MAIS TELAS</div><h1>Conectar ao player</h1><p class="muted">O CENA publica sua lista como um complemento de catálogo, separado da biblioteca interna do player.</p><div class="panel"><h2>Servidor do CENA</h2><p>Use o mesmo servidor no celular e no player. Para outro aparelho, o endereço precisa ser acessível pela rede.</p><form id="server-form"><label for="server-url">Endereço do servidor</label><input id="server-url" type="url" value="${escape(apiBase)}" placeholder="https://seu-servidor.exemplo" required><div class="actions"><button class="secondary" type="submit">${connected ? 'Atualizar conexão' : 'Conectar servidor'}</button></div></form></div><div class="panel"><h2>CENA · Quero assistir</h2>${connected ? '<p class="connection-status">Lista conectada ao servidor</p>' : '<p>Crie sua lista para gerar o link do complemento.</p>'}${connected ? `<label for="manifest-url">Link do complemento — acesso somente à leitura</label><textarea class="url-field" id="manifest-url" readonly>${escape(connection.manifestUrl)}</textarea><div class="actions"><button class="primary" id="copy-addon">Copiar link</button><button class="secondary" id="refresh-list">Atualizar lista</button></div>` : '<button class="primary" id="create-list">Criar minha lista</button>'}</div>${config && !config.publicConfigured ? '<div class="notice">Servidor em modo local. Configure PUBLIC_BASE_URL com um endereço HTTPS acessível para instalar o complemento em outro aparelho.</div>' : ''}<div class="step"><b>1</b><span>No Stremio, abra Complementos e instale pelo link do manifest acima.</span></div><div class="step"><b>2</b><span>No Nuvio, tente instalar o mesmo manifest na área de complementos. A compatibilidade ainda precisa ser testada no aparelho.</span></div><div class="step"><b>3</b><span>Procure “CENA · Filmes para assistir” ou “CENA · Séries para assistir”. Após uma alteração, atualize o catálogo no player.</span></div><div class="notice">Esta versão sincroniza o conteúdo do catálogo. O que você assistir no player ainda não volta automaticamente para o CENA.</div>${connected ? '<div class="panel"><h2>Guardar acesso à lista</h2><p>O código abaixo permite editar sua lista em outro dispositivo. Guarde em local privado. Não compartilhe com o player.</p><button class="secondary" id="export-connection">Copiar código de recuperação</button></div>' : ''}<div class="panel"><h2>Já tem uma lista?</h2><form id="restore-form"><label for="restore-code">Código de recuperação</label><textarea id="restore-code" class="url-field" placeholder="Cole seu código privado aqui" required></textarea><div class="actions"><button class="secondary" type="submit">Recuperar lista</button></div></form></div><p class="attribution">Metadados e imagens: TMDB. Este produto usa a API do TMDB, mas não é endossado ou certificado pelo TMDB. <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">Sobre o TMDB</a></p>`;
  $('#server-form').onsubmit = async event => {
    event.preventDefault();
    const previous = { apiBase, config, connection };
    try {
      const next = validBase($('#server-url').value.trim());
      if (connection && next !== apiBase) throw Error('Para trocar de servidor, recupere uma lista criada nele usando o código privado.');
      apiBase = next; config = await api('/api/config');
      await ensureConnection(); persist(); toast('Servidor conectado.'); connect();
    } catch (error) { ({ apiBase, config, connection } = previous); toast(error.message); }
  };
  if ($('#create-list')) $('#create-list').onclick = async () => { try { await ensureConnection(); connect(); } catch (error) { toast(error.message); } };
  if ($('#copy-addon')) $('#copy-addon').onclick = () => copy(connection.manifestUrl);
  if ($('#export-connection')) $('#export-connection').onclick = () => copy(JSON.stringify({ apiBase, id: connection.id, writeToken: connection.writeToken }));
  if ($('#refresh-list')) $('#refresh-list').onclick = async () => { try { await refresh(); connect(); toast('Lista atualizada.'); } catch (error) { toast(error.message); } };
  $('#restore-form').onsubmit = async event => {
    event.preventDefault();
    const previous = { apiBase, connection, config, items };
    try {
      const input = JSON.parse($('#restore-code').value);
      if (!/^[a-f0-9]{24}$/.test(input.id) || !/^[\w-]{32}$/.test(input.writeToken)) throw Error('Código de recuperação inválido.');
      apiBase = validBase(input.apiBase); connection = { id: input.id, writeToken: input.writeToken };
      await refresh(); persist(); connect(); toast('Lista recuperada.');
    } catch (error) { ({ apiBase, connection, config, items } = previous); toast(error.message); }
  };
}
async function refresh() {
  config = await api('/api/config');
  if(apiBase==='local' && !connection) { connection=await api('/api/libraries',{method:'POST'}); persist(); }
  if (connection) { const result = await api(`/api/libraries/${connection.id}`); connection = { id: result.id, writeToken: result.writeToken, manifestUrl: result.manifestUrl }; items = result.items; persist(); }
}

function localConnection() {
  const supported = native && typeof window.CenaAndroid.connectTrakt === 'function';
  const pending = traktState.pending?.length || 0;
  main.innerHTML = `<div class="eyebrow">SUA LISTA, EM MAIS TELAS</div><h1>Conectar ao Nuvio</h1><div class="panel" id="update-panel"><h2>Atualizações do CENA</h2><p id="update-status">Confira novas versões do aplicativo.</p><div class="actions"><button class="secondary" id="update-check">Verificar atualização</button><button class="primary" id="update-install" hidden>Atualizar</button></div></div><div class="panel" id="streaming-panel"><h2>Onde assistir</h2><p id="streaming-status"></p><p>Para mostrar os serviços no Brasil, use uma chave de API v3 gratuita da sua conta TMDB. <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">Criar ou consultar chave no TMDB</a>. Dados de disponibilidade: JustWatch via TMDB.</p><form id="streaming-form"><label for="streaming-key">Chave de API v3 do TMDB</label><input id="streaming-key" type="password" autocomplete="off" minlength="32" maxlength="32" required><button class="secondary" type="submit">Conectar TMDB</button></form></div>
    <div class="panel"><h2>Trakt como ponte</h2><p>Adicione no CENA → receba em Quero assistir no Trakt → abra a biblioteca Trakt do Nuvio no celular ou na TV.</p>
    <p>Use a mesma conta Trakt nos dois Nuvios e selecione Trakt como fonte da biblioteca. Ative também o registro do que assistir no Trakt.</p></div>
    <div class="panel" id="sync-summary"></div><div class="panel" id="vision-model-panel"></div><div class="panel" id="trakt-panel"><h2>${traktState.connected ? `✓ Trakt conectado${traktState.username ? ` · ${escape(traktState.username)}` : ''}` : 'Conectar sua conta Trakt'}</h2>
    ${!supported ? '<p>O login e a conexão protegida estão disponíveis no APK Android.</p>' : !traktState.configured ? `<p>Falta o cadastro único da integração CENA no Trakt. Depois, você autoriza sua conta por um código no navegador do celular.</p><details><summary>Configurar integração CENA</summary><p>Cadastre CENA em <a href="https://developer.trakt.tv/docs/create-an-app" target="_blank" rel="noreferrer">Trakt Developer</a> e copie somente o Client ID público. Não informe Client Secret, senha ou token.</p><form id="trakt-config-form"><label for="trakt-client-id">Client ID público</label><input id="trakt-client-id" minlength="20" maxlength="200" autocomplete="off" required><button class="primary" type="submit">Salvar cadastro</button></form></details>` : traktState.connected ? `<p>${pending ? `${pending} alteração(ões) aguardam envio.` : 'Nenhum envio pendente.'}</p><p class="muted">${traktState.lastSync ? `Última sincronização: ${new Date(traktState.lastSync).toLocaleString('pt-BR')}` : 'Aguardando a primeira sincronização.'}</p><div class="actions"><button class="primary" id="trakt-sync">${traktState.error ? 'Tentar novamente' : 'Sincronizar agora'}</button><button class="secondary" id="trakt-send-list">Enviar Quero assistir</button><button class="secondary" id="trakt-disconnect">Desconectar</button></div>` : traktState.userCode ? `<p>Seu código de autorização:</p><p class="auth-code" id="trakt-user-code">${escape(traktState.userCode)}</p><p>Copie o código, abra o Trakt e autorize o CENA. Volte ao app: a conexão será conferida até o código expirar.</p><div class="actions"><button class="secondary" id="trakt-copy-code">Copiar código</button><button class="primary" id="trakt-authorize">Abrir Trakt para autorizar</button></div>` : `<p>Ao autorizar, sua lista Quero assistir será enviada ao Trakt. Os filmes já assistidos no Trakt poderão receber o check no CENA.</p><button class="primary wide" id="trakt-connect">Conectar e enviar Quero assistir</button>`}
    ${traktState.error ? `<p class="error" role="alert">${escape(traktState.error)}</p>` : ''}</div>
    <div class="panel" id="nuvio-panel"></div><div class="panel" id="stremio-panel"></div><div class="panel" id="local-ai-panel"></div>
    <div class="panel"><h2>✓ Já assistido</h2><p>Quando o Nuvio registrar um filme como assistido no Trakt, o CENA recebe esse histórico na próxima sincronização. Abrir um filme não marca como assistido.</p><p>Para séries, mostramos os episódios vistos: um episódio não marca a série inteira como concluída.</p><p class="muted">A consulta automática em segundo plano é programada a cada 12 horas e retomada ao abrir o CENA. O Android pode adiá-la para economizar bateria. As novidades aparecem em Suas séries, no Início e em Descobrir.</p></div>
    <div class="panel"><h2>Stories</h2><p>Abra o filme → Criar Story → escolha a frase → Compartilhar ou Salvar imagem. No Instagram, escolha Stories e conclua a publicação.</p></div>
    <details class="panel"><summary>Catálogo remoto opcional</summary><p>Esta opção cria outra lista num servidor próprio. Não envia automaticamente sua lista local nem substitui a biblioteca Trakt.</p><form id="local-server-form"><input id="local-server-url" type="url" placeholder="https://seu-servidor.exemplo" required><button class="secondary" type="submit">Conectar servidor</button></form></details>`;
  window.CenaAndroid?.visionModelState?.();stremioPanel.mount($('#stremio-panel'));renderLocalAI();renderSync();renderVisionModel();renderNuvioPanel($('#nuvio-panel'),nuvioState,window.CenaAndroid);
  renderUpdatePanel();$('#update-check').onclick=()=>window.CenaAndroid?.checkUpdates?.();$('#update-install').onclick=()=>window.CenaAndroid?.installUpdate?.();
  $('#streaming-status').textContent=streamingMessage;$('#streaming-form').onsubmit=event=>{event.preventDefault();const field=$('#streaming-key');window.CenaAndroid?.configureStreaming?.(field.value);field.value='';$('#streaming-status').textContent='Conectando ao TMDB…';};window.CenaAndroid?.streamingStatus?.();
  if($('#trakt-config-form')) $('#trakt-config-form').onsubmit = event => { event.preventDefault(); window.CenaAndroid.configureTrakt($('#trakt-client-id').value.trim()); };
  if($('#trakt-connect')) $('#trakt-connect').onclick=()=>window.CenaAndroid.connectTrakt();
  if($('#trakt-copy-code')) $('#trakt-copy-code').onclick=()=>copy(traktState.userCode);
  if($('#trakt-authorize')) $('#trakt-authorize').onclick=()=>window.CenaAndroid.openTraktVerification();
  if($('#trakt-sync')) $('#trakt-sync').onclick=()=>{ sendTraktInventory(); window.CenaAndroid.syncTrakt(); };
  if($('#trakt-send-list')) $('#trakt-send-list').onclick=()=>{ sendTraktInventory(); sendTraktList(); toast('Envio solicitado. Confira os itens pendentes.'); };
  if($('#trakt-disconnect')) $('#trakt-disconnect').onclick=()=>window.CenaAndroid.disconnectTrakt();
  $('#local-server-form').onsubmit = async event => {
    event.preventDefault(); const previous={apiBase,connection,config,items};
    try { apiBase=validBase($('#local-server-url').value.trim()); connection=null; config=await api('/api/config'); await ensureConnection(); items=[]; connect(); toast('Servidor conectado. Sua lista local foi preservada.'); }
    catch(error) { ({apiBase,connection,config,items}=previous); toast(error.message); }
  };
}

// Render a 9:16 PNG locally. Photo captures never leave the device.
const story=createStoryEditor({$,escape,storage,getItems:()=>items,native,artworkResolver,persistArtwork,toast});
document.querySelectorAll('nav [data-tab]').forEach(button => button.onclick = () => setTab(button.dataset.tab));
$('#profile-shortcut').onclick=()=>{historyMedia='';historyDedicated=false;setTab('profile');};
$('#search-shortcut').onclick = () => { setTab('library'); $('#query').focus(); };
$('.brand').onclick = event => { event.preventDefault(); setTab('home'); };
$('#detail .close').onclick = () => $('#detail').close();
$('#detail').addEventListener('close',()=>{similarTicket++;localAI.cancel();refreshCurrentView();});
$('#detail').onclick = event => { if (event.target === $('#detail')) { const r = $('#detail').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('#detail').close(); } };
if (stored?.id && stored?.writeToken) connection = { id: stored.id, writeToken: stored.writeToken, manifestUrl: stored.manifestUrl };
home();
if (apiBase) refresh().then(() => { libraryReady=true; setTab(tab); sendTraktInventory(); if(deferredHistoryState){const state=deferredHistoryState;deferredHistoryState=null;window.CenaHistoryResult(state);} if(deferredNuvioState){const state=deferredNuvioState;deferredNuvioState=null;window.CenaNuvioResult(state);} if(deferredTraktState) { const state=deferredTraktState; deferredTraktState=null; window.CenaTraktResult(state); } }).catch(error => toast(error.message));
else setTab('connect');

if (native) { if (typeof window.CenaAndroid.appVersion === 'function') $('#app-version').textContent = 'v' + window.CenaAndroid.appVersion(); window.CenaAndroid.ready();window.CenaAndroid.streamingStatus?.(); }

window.addEventListener('online',()=>{artworkResolver.retry();for(const element of document.querySelectorAll('.poster-art[data-artwork-key]')){if(!element.querySelector(':scope > img')){const rect=element.getBoundingClientRect();if(rect.bottom>=0 && rect.top<=innerHeight+200)hydrateArtwork(element);}}});

window.addEventListener('online',()=>{ratingsResolver.retry();for(const node of document.querySelectorAll('[data-rating-state=error]'))hydrateScore(node);});
