import {createCaptureMemory} from './capture-memory.js';
import {prepareCoverReading} from './cover-reading.js';
import {createTitleAliasResolver} from './title-aliases.js';
import {recentWatches,viewingDayKey,viewingDays} from './recent-watches.js';
import {createOnlineAI} from './online-ai.js';
import {availabilityRows} from './availability.js';
import {profileCollection,yearlyHistory,personalRatings,watchedGenres,watchedTitles,castRanking,combinedViewing} from './profile-stats.js';
import {NuvioSeriesEngine} from './nuvio-series.js';
import {seriesUniverse,seriesCards,nextEpisodeEntries,combineContinuity,traktPausedEntries,currentTraktProgress} from './series-continuity.js';
import {mountVisionModel} from './vision-model-panel.js';
import {mountBackup} from './backup.js';
import {readCollections,createCollection,collectionItems,mountTitleCollections} from './collections.js';
import {mountFeedback,readFeedback} from './feedback.js';
import {mountCalendar} from './calendar.js';
import {mountRetrospective} from './retrospective.js';
import {renderSyncSummary} from './sync-summary.js';
import {createStoryEditor} from './story-editor.js';
import {createAppStorage} from './app-storage.js';
import {resumeKey,visibleResume,oneResumePerTitle,titleName,homeSeries} from './home-feed.js';
import {applyHistoryMetadata,historyYearLabel,historyStats,historyDate,historyItem} from './watch-history.js';
import {applyNuvioState,nuvioContinue} from './nuvio-state.js';
import {renderNuvioPanel} from './nuvio-panel.js';
import {RatingsResolver,imdbLabel} from './ratings.js';
import {SimilarEngine,buildLocalSelectionPrompt,validateLocalSelection} from './similar.js';
import {createLocalAI} from './local-ai.js';
import {RecommendationEngine,genreLabel} from './recommendations.js';
import {seriesSummary} from './series-view.js';
import {receiveStoryArtwork} from './story-artwork.js';
import {createStremioPanel} from './stremio-panel.js';
import { ArtworkResolver, trustedArtwork, titleArtwork } from './artwork.js';
import { applyTraktState, traktItemLabel } from './trakt-state.js';
import { getTitleDetails } from './search-public.js';
import { createLocalApi } from './local-api.js';
import { coverInput, identifyCover, searchTolerantTitles, verifyCameraTitles, coverTitlePhrase } from './identify-cover.js';
import { rankWithVision } from './visual-ranking.js';
const $ = selector => document.querySelector(selector);
const native = Boolean(window.CenaAndroid);
const storage=createAppStorage(localStorage,window.CenaAndroid);
const onlineAI=createOnlineAI(storage);
const captureMemory=createCaptureMemory(storage);
let captureEvidence='';
const titleAliases=createTitleAliasResolver(window.CenaAndroid);
const enrichCameraTitle=item=>streamingConfigured?titleAliases.resolve(item):Promise.resolve(item);
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
let libraryType='all',librarySort='saved';
let items = [], tab = 'home', filter = 'watchlist', searchResults = [], config = null;
let nuvioSeriesRows=[],nuvioSeriesTicket=0,seriesResults=[];
let seriesState={items:[],reading:false,pending:0,lastCheck:0};
let discoveryRefreshing=false,discoveryRequest=0;
let highlightsResults=[],highlightView='',highlightsPending=null,highlightsAt=0;
let discoveryResults=[],discoveryMode='recommend',discoveryFilter='all',discoveryInfo=null,discoveryFingerprint='';
let nuvioState={connected:false,active:false,watched:[],progress:[]},deferredNuvioState=null,nuvioResults=[];
let homeSections={};try{homeSections=JSON.parse(storage.getItem('cena.home.sections.v1')||'{}')||{};}catch{}
let resumeExpanded=false,homeMetadata=new Map(),homeMetadataTried=new Set(),homeMetadataBusy=false,homeRecommendationPending=null;
const resumeHiddenKey='cena.resume.hidden.v1';
let resumeHidden={};try{resumeHidden=JSON.parse(storage.getItem(resumeHiddenKey)||'{}')||{};}catch{}
let historyState={totals:{},years:[],media:[]},deferredHistoryState=null,historyYear='all',historyKind='all',historyMode='history',historyMedia='',historyRows=[],historyRequest=0,historyPage=1,historyHasMore=false,historyResults=[];
let statsSource='auto',homeViewingDay='';
const statsMetadataKey='cena.stats.catalog.v1';
const statsMetadata=new Map();
const statsMetadataTried=new Set();
let statsMetadataLoading=false;
try{for(const item of JSON.parse(storage.getItem(statsMetadataKey)||'[]'))statsMetadata.set(item.type+':'+item.id,item);}catch{}
function warmStatsMetadata(dates){
 if(statsMetadataLoading||tab!=='profile'||historyMode!=='stats')return;
 const candidates=(dates.media||[]).filter(item=>/^tt[0-9]{5,12}$/.test(item.id)&&!statsMetadataTried.has(item.type+':'+item.id)&&!statsMetadata.has(item.type+':'+item.id)).slice(0,80);
 if(!candidates.length)return;
 statsMetadataLoading=true;
 void(async()=>{
  try{
   for(let offset=0;offset<candidates.length&&tab==='profile'&&historyMode==='stats';offset+=3){
    await Promise.all(candidates.slice(offset,offset+3).map(async item=>{
     const key=item.type+':'+item.id;statsMetadataTried.add(key);
     try{
      const resolved=await getTitleDetails(item);
      if(resolved.id===item.id&&resolved.type===item.type&&(resolved.genres?.length||resolved.cast?.length)){
       statsMetadata.set(key,{id:item.id,type:item.type,name:resolved.name,poster:resolved.poster,genres:resolved.genres,cast:resolved.cast});
      }
     }catch{}
    }));
    if(tab==='profile'&&historyMode==='stats'&&(offset===0||offset%12===0))renderHistoryStats();
   }
  }finally{
   statsMetadataLoading=false;
   try{storage.setItem(statsMetadataKey,JSON.stringify([...statsMetadata.values()].slice(-500)));}catch{}
   if(tab==='profile'&&historyMode==='stats')renderHistoryStats(false);
  }
 })();
}

let historyDedicated=false,profileStatsTab='overview',historyPeriod='all',periodRequest=0,periodStats=null;
let discoveryScroll=0,discoveryRailOffsets=[];
let recentHistoryRequest='',recentHistoryRows=[],recentHistoryResults=[];
let updateState={status:'idle',message:'Confira novas versões do aplicativo.'};
window.CenaUpdateResult=value=>{updateState=value;renderUpdatePanel();};
function renderUpdatePanel(){const status=$('#update-status'),install=$('#update-install'),check=$('#update-check');if(!status||!install||!check)return;status.textContent=updateState.message+(updateState.version&&updateState.status==='available'?' Versão '+updateState.version+'.':'');install.hidden=!['available','permission','error'].includes(updateState.status);install.disabled=['checking','downloading','installing'].includes(updateState.status);check.disabled=['checking','downloading','installing'].includes(updateState.status);}
let traktState = { connected:false, configured:false, pending:[] };
let traktWasConnected = false;
let traktInitialUploadRequested = false;
let libraryReady=false, deferredTraktState=null;
let cameraSequence=0,cameraAttempt=-1;
let cameraLines=[];
const cameraAuto=()=>{try{return JSON.parse(storage.getItem('cena.camera.online.v1')||'false')===true;}catch{return false;}};
let cameraReading=null,cameraRegions=[];
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
let stremioConnection={};
window.CenaStremioResult=state=>{stremioConnection=state;stremioPanel.update(state);};

function historyBadge(item){return `<span class="watch-years">${escape(historyYearLabel(item))}</span>`;}
window.CenaHistoryResult=state=>{
 if(!libraryReady){deferredHistoryState=state;return;}
 if(JSON.stringify(state)===JSON.stringify(historyState))return;
 const previous=historyState;historyState=state;updateCopyHistory(previous,state);renderSync();const merged=applyHistoryMetadata(items,state),changed=JSON.stringify(merged)!==JSON.stringify(items);
 if(previous.scope!==state.scope){recentHistoryRows=[];recentHistoryResults=[];recentHistoryRequest='';renderRecentHistory();}
 if(changed&&apiBase==='local'){items=merged;storage.setItem('cena.local.items.v1',JSON.stringify(items));}
 if(tab==='profile'){renderHistorySummary();if(previous.scope!==state.scope||previous.lastImport!==state.lastImport)loadPeriod();if(previous.scope!==state.scope||previous.lastImport!==state.lastImport)mountStatsRecap();if(previous.scope!==state.scope||previous.lastImport!==state.lastImport){const records=$('#history-records');if(records)records.innerHTML='<p class="muted">Carregando histórico desta conta…</p>';loadHistoryRows(true);}}
 else if(tab==='library'&&changed)patchLibrary();else if(tab==='home'&&changed&&!$('#detail').open){const position=window.scrollY;home();window.scrollTo(0,position);}
 const dates=$('#title-watch-history');if(dates&&detailItem)renderTitleHistory(items.find(item=>item.id===detailItem.id&&item.type===detailItem.type)||detailItem);
 if(tab==='home'){renderRecentHistory();if(previous.scope!==state.scope||previous.lastImport!==state.lastImport)loadRecentHistory();}
};
window.CenaHistoryRows=value=>{
 if(String(value.requestId)===recentHistoryRequest){if(value.scope===historyState.scope&&tab==='home'){recentHistoryRows=value.rows||[];renderRecentHistory();}return;}
 if(String(value.requestId)!==String(historyRequest)||value.scope!==historyState.scope||tab!=='profile')return;
 historyRows=value.page===1?value.rows||[]:[...historyRows,...(value.rows||[])];historyPage=value.page;historyHasMore=Boolean(value.hasMore);renderHistoryRows(value.total||0);
};
function loadHistoryRows(reset=true){
 if(reset){historyRows=[];historyPage=0;historyHasMore=false;const target=$('#history-records');if(target&&historyMode==='history')target.innerHTML='<p class="muted" role="status">Carregando histórico…</p>';}
 if(!historyState.scope&&nuvioState.connected&&nuvioState.active){historyRows=recentWatches([],nuvioState,50).filter(row=>(historyKind==='all'||row.kind===historyKind)&&(historyYear==='all'||historyYear==='unknown'&&row.datePrecision!=='exact'||String(new Date(row.watchedAt).getFullYear())===historyYear));historyPage=1;historyHasMore=false;renderHistoryRows(historyRows.length);const target=$('#history-records');if(target)target.insertAdjacentHTML('afterbegin','<p class="muted">Registros recentes confirmados pelo Nuvio; até 50 títulos desta consulta.</p>');return;}
 if(typeof window.CenaAndroid?.historyRows!=='function'){const target=$('#history-records');if(target)target.innerHTML='<p class="muted">A importação e o histórico completo ficam disponíveis no APK Android.</p>';return;}
 const id=String(++historyRequest);window.CenaAndroid.historyRows(id,historyYear,historyKind,reset?1:historyPage+1,historyMedia);
}
function activeStatsSource(){
 return statsSource==='auto' ? (nuvioState.active&&nuvioState.statistics&&historyState.lastImport?'Combinado':nuvioState.active&&nuvioState.statistics ? 'Nuvio' : historyState.lastImport ? 'Trakt' : items.some(item=>item.importedFrom==='Stremio') ? 'Stremio' : 'Nuvio') : statsSource;
}
function viewingStats(){
 if(activeStatsSource()==='Combinado')return combinedViewing(nuvioState.statistics,historyState);
 return activeStatsSource()==='Nuvio' ? (nuvioState.statistics || {origin:'Nuvio'}) : activeStatsSource()==='Stremio' ? {origin:'Stremio'} : historyState;
}
function mountStatsRecap(){
 const element=$('#retrospective-panel');
 if(element)mountRetrospective(element,{state:viewingStats(),bridge:window.CenaAndroid,toast});
}
function profile(){
 main.innerHTML=`${historyDedicated?'<div class="collection-header"><button class="collection-back" id="history-back" aria-label="Voltar">←</button><h1>Últimos vistos</h1></div>':'<div class="profile-header"><div class="eyebrow">SUA MEMÓRIA DE CINEMA</div><h1>Estatísticas</h1></div>'}<div class="profile-main-tabs" role="tablist" aria-label="Áreas do perfil"><button class="profile-main-tab ${historyMode==='stats'?'selected':''}" id="history-stats-tab" role="tab" aria-selected="${historyMode==='stats'}">Estatísticas</button><button class="profile-main-tab ${historyMode==='history'?'selected':''}" id="history-tab" role="tab" aria-selected="${historyMode==='history'}">Histórico</button></div><div class="history-filters ${historyMode==='stats'?'stats-filters':''}"><div><label for="stats-source" ${historyMode==='stats'?'':'hidden'}>Fonte das estatísticas</label><select id="stats-source" ${historyMode==='stats'?'':'hidden'}><option value="auto">Automático</option><option value="Combinado">Nuvio + Trakt</option><option>Nuvio</option><option>Stremio</option><option>Trakt</option></select></div><div><label for="history-year">Ano</label><select id="history-year"></select></div><label for="history-kind" ${historyMode==='stats'?'hidden':''}>Tipo</label><select id="history-kind" ${historyMode==='stats'?'hidden':''}><option value="all">Filmes e episódios</option><option value="movie">Filmes</option><option value="episode">Episódios</option></select></div><div id="history-stats"></div><section id="viewing-period" ${historyMode==='stats'&&!historyDedicated?'':'hidden'}><div class="period-controls" role="group" aria-label="Período de visualização"><button class="chip" data-period="today">Hoje</button><button class="chip" data-period="month">Mês</button><button class="chip" data-period="year">Ano</button><button class="chip" data-period="all">Desde o início</button></div><details class="period-custom"><summary>Escolher outra data</summary><label class="period-date">Dia <input id="period-date" type="date"></label><label class="period-date">Mês <input id="period-month" type="month"></label><label class="period-date">Ano <input id="period-year" type="number" min="1" max="9999" inputmode="numeric" placeholder="Ex.: 2025"></label></details><h2>Atividade de filmes</h2><div id="period-results" aria-live="polite"></div></section><div id="history-records"></div><details class="profile-sync" ${historyDedicated?'hidden':''}><summary>Sincronização e exportação</summary><div id="history-summary"></div></details><details class="profile-tools" ${historyDedicated?'hidden':''}><summary>Retrospectiva e backup</summary><section class="panel" id="retrospective-panel"></section><section class="panel" id="backup-panel"></section></details>`;
 for(const button of document.querySelectorAll('[data-period]'))button.onclick=()=>{historyPeriod=button.dataset.period;loadPeriod();};
 for(const id of ['period-date','period-month','period-year'])$('#'+id).onchange=event=>{
  if(!event.target.value||!event.target.validity.valid)return;
  historyPeriod=id==='period-year'?event.target.value.padStart(4,'0'):event.target.value;
  loadPeriod();
 };
 loadPeriod();
 if($('#history-back'))$('#history-back').onclick=()=>window.CenaBack();
 renderHistorySummary();$('#history-kind').value=historyKind;
 mountBackup($('#backup-panel'),{storage,bridge:window.CenaAndroid,toast,onRestore:async()=>{await refresh();items=applyNuvioState(applyHistoryMetadata(items,historyState),nuvioState);storage.setItem('cena.local.items.v1',JSON.stringify(items));sendTraktInventory();resumeHidden=JSON.parse(storage.getItem(resumeHiddenKey)||'{}');profile();const tools=$('.profile-tools');if(tools)tools.open=true;}});
 mountStatsRecap();
 $('#stats-source').onchange=event=>{statsSource=event.target.value;historyYear='all';profileStatsTab='overview';renderHistorySummary();mountStatsRecap();};
 $('#history-year').onchange=event=>{historyYear=event.target.value;renderHistoryStats();if(historyMode==='history')loadHistoryRows(true);};$('#history-kind').onchange=event=>{historyKind=event.target.value;loadHistoryRows(true);};
 $('#history-tab').onclick=()=>{historyMode='history';profile();};$('#history-stats-tab').onclick=()=>{historyMode='stats';profile();};
 if(historyMode==='history')loadHistoryRows(true);if(typeof window.CenaAndroid?.historyState==='function')window.CenaAndroid.historyState();
}
function paintPeriod(){
 const target=$('#period-results');if(!target)return;
 if(!periodStats){target.textContent=typeof window.CenaAndroid?.historyPeriod==='function'?'Consultando histórico…':'Importe o histórico no CENA para Android para consultar seus filmes.';return;}
 const stats=periodStats,weekday=['','segunda','terça','quarta','quinta','sexta','sábado','domingo'][stats.topWeekday],minutes=Number(stats.movieMinutes)||0,format=n=>Number(n||0).toLocaleString('pt-BR');
 target.innerHTML=`<div class="history-stat-grid period-grid"><div><strong>${format(stats.movies)}</strong><span>Filmes diferentes</span></div><div><strong>${format(stats.moviePlays)}</strong><span>Sessões de filmes</span></div><div><strong>${Math.floor(minutes/60)}h ${minutes%60}min</strong><span>Tempo estimado</span></div><div><strong>${format(stats.activeDays)}</strong><span>Dias com filmes</span></div></div><p class="muted">Duração disponível em ${format(stats.timedMovies)} de ${format(stats.moviePlays)} sessões.${stats.firstMovieDate?' Primeiro registro no período: '+escape(stats.firstMovieDate.split('-').reverse().join('/'))+'.':''}${stats.unknownMovieDates?' '+format(stats.unknownMovieDates)+' sessão(ões) sem data confirmada.':''}</p>${stats.activeDays?`<p class="muted">Maior sequência: ${format(stats.longestStreak)} dia(s).${weekday?" Dia mais ativo: "+weekday+" · "+format(stats.topWeekdayPlays)+" sessão(ões).":""}</p>`:''}${stats.rewatched?.length?`<h3>Filmes mais revistos</h3><ol class="rewatch-list">${stats.rewatched.map(row=>`<li>${escape(row.name)} <strong>${format(row.plays)}×</strong></li>`).join('')}</ol>`:''}`;
}
function loadPeriod(){
 const area=$('#viewing-period');if(!area||area.hidden||activeStatsSource()!=='Trakt')return;
 for(const button of area.querySelectorAll('[data-period]'))button.setAttribute('aria-pressed',String(button.dataset.period===historyPeriod));
 area.querySelector('#period-date').value=/^\d{4}-\d{2}-\d{2}$/.test(historyPeriod)?historyPeriod:'';
 area.querySelector('#period-month').value=/^\d{4}-\d{2}$/.test(historyPeriod)?historyPeriod:'';
 area.querySelector('#period-year').value=/^\d{4}$/.test(historyPeriod)?historyPeriod:'';
 periodStats=null;paintPeriod();
 window.CenaAndroid?.historyPeriod?.(String(++periodRequest),historyPeriod);
}
window.CenaHistoryPeriod=value=>{
 if(tab!=='profile'||String(value.requestId)!==String(periodRequest)||value.scope!==(historyState.scope||''))return;
 periodStats=value;paintPeriod();
};
function renderHistorySummary(){
 const target=$('#history-summary');if(!target)return;
 const state=historyState;
 target.innerHTML=`<p class="muted">${state.account?`Histórico de ${escape(state.account)} · `:''}${state.connected?'Importado da conta Trakt autorizada.':'Cópia local. Conecte o Trakt para importar ou atualizar.'}</p>${state.importing?`<p class="notice" role="status">Importando histórico: ${Number(state.processed)||0} registros lidos${state.pages?` · página ${state.page} de ${state.pages}`:''}. A cópia anterior continua disponível até concluir.</p>`:''}${state.lastImport?`<p class="muted">Última importação: ${new Date(state.lastImport).toLocaleString('pt-BR')}</p>`:''}${state.coverage==='partial'?'<p class="notice">O total recebido não corresponde a todos os registros informados pelo Trakt. Os dados disponíveis foram salvos; a cobertura ainda é parcial.</p>':state.lastImport&&state.coverage!=='complete'?'<p class="notice">Importação finalizada. Não foi possível confirmar a cobertura total do histórico no Trakt.</p>':''}${state.error?`<p class="error" role="alert">${escape(state.error)}</p>`:''}<div class="actions"><button class="primary" id="history-import" ${!state.connected?'disabled':''}>${state.importing?'Continuar importação':'Importar / atualizar Trakt'}</button><button class="secondary" id="history-export" ${!(state.totals?.plays>0)?'disabled':''}>Exportar JSON</button></div>${historyMedia?'<p class="notice">Mostrando o histórico deste título. <button class="link-button" id="history-all-titles">Ver todos os títulos</button></p>':''}`;
 $('#history-import').onclick=()=>{window.CenaAndroid?.importHistory?.();toast('Importação agendada. O histórico será lido no aparelho.');};$('#history-export').onclick=()=>window.CenaAndroid?.exportHistory?.();if($('#history-all-titles'))$('#history-all-titles').onclick=()=>{historyMedia='';renderHistorySummary();loadHistoryRows(true);};
 const selectedSource=$('#stats-source');if(selectedSource)selectedSource.value=activeStatsSource();
 const dates=historyMode==='stats'?viewingStats():state;
 const select=$('#history-year');if(select)select.disabled=historyMode==='stats'&&activeStatsSource()==='Stremio';
 if(select&&document.activeElement!==select){select.innerHTML=`<option value="all">Todos os anos</option>${(dates.years||[]).map(row=>`<option value="${Number(row.year)}">${row.year} · ${row.plays} registros</option>`).join('')}${dates.totals?.unknownDates?'<option value="unknown">Data desconhecida</option>':''}`;select.value=historyYear;if(select.selectedIndex<0){historyYear='all';select.value='all';}}
 renderHistoryStats();
}
function renderHistoryStats(loadMetadata=true){
 const target=$('#history-stats');if(!target)return;const source=activeStatsSource(),dates=viewingStats(),stats=historyStats(dates,historyYear),minutes=Number(stats.estimatedMinutes)||0,collection=profileCollection(items),years=yearlyHistory(dates);
 const enriched=new Map(statsMetadata);
 for(const item of items){
  const key=item.type+':'+item.id,meta=enriched.get(key);
  enriched.set(key,{...meta,...item,genres:item.genres?.length?item.genres:meta?.genres,cast:item.cast?.length?item.cast:meta?.cast});
 }
 const statsItems=[...enriched.values()];
 if(loadMetadata)warmStatsMetadata(dates);
 let notes={};try{notes=JSON.parse(storage.getItem('cena.story.notes.v1')||'{}')||{};}catch{}const ratings=personalRatings(notes);
 if(source==='Stremio'){
  const imported=profileCollection(items.filter(item=>item.importedFrom==='Stremio'));
  $('#viewing-period').hidden=true;
  target.hidden=historyMode!=='stats';
  $('#history-records').hidden=historyMode!=='history';
  target.innerHTML=`<section class="stats-overview"><p class="eyebrow">Stremio</p><h2>Biblioteca importada</h2><div class="history-stat-grid"><div><strong>${imported.movies}</strong><span>Filmes</span></div><div><strong>${imported.series}</strong><span>Séries</span></div></div><p class="muted">Títulos trazidos para a lista local do CENA. Esta importação consulta o acervo salvo.</p><button class="secondary" id="stats-stremio">Conectar e importar do Stremio</button></section>`;
  $('#stats-stremio').onclick=()=>{setTab('connect');$('#stremio-panel')?.scrollIntoView();};
  return;
 }
 const tabs=[['overview','Visão geral'],['movies','Filmes'],['series','Séries'],['library','Biblioteca'],...(source==='Trakt'?[['time','Tempo']]:[]),['ratings','Avaliações'],['platforms','Plataformas']];
 if(!tabs.some(([id])=>id===profileStatsTab))profileStatsTab='overview';
 const cards=`<div class="history-stat-grid"><div><strong>${stats.movies||0}</strong><span>Filmes diferentes</span></div><div><strong>${stats.series||0}</strong><span>Séries acompanhadas</span></div><div><strong>${stats.episodes||0}</strong><span>Episódios diferentes</span></div><div><strong>${stats.plays||0}</strong><span>${source==='Nuvio'?'Itens assistidos':'Reproduções'}</span></div>${source==='Nuvio'?'':`<div><strong>${Math.floor(minutes/60)}h ${minutes%60}min</strong><span>Tempo estimado</span></div>`}</div>`;
 const historyPending=source==='Nuvio'?!nuvioState.statistics:!historyState.lastImport&&!Number(stats.plays);
 const historyEmpty=source==='Nuvio'?'<div class="profile-empty"><strong>Dados do Nuvio</strong><p>Conecte sua conta e sincronize o perfil para ver os itens assistidos.</p><button class="secondary" id="stats-nuvio">Configurar Nuvio</button></div>':'<div class="profile-empty"><strong>Seu histórico, com mais detalhes</strong><p>As estatísticas aparecem após importar o histórico detalhado do Trakt. Os últimos vistos do Nuvio continuam disponíveis na aba Histórico.</p></div>';
 const chart=(metric,label)=>{
  const peak=Math.max(1,...years.map(row=>row[metric]));
  if(!years.some(row=>row[metric]>0))return '<p class="muted">Ainda não há registros com data para este gráfico.</p>';
  return `<div class="profile-chart" tabindex="0" role="region" aria-label="${label}"><div class="profile-bars">${years.map(row=>`<div class="profile-bar-column"><span>${row[metric].toLocaleString('pt-BR')}</span><div class="profile-bar" data-bar-height="${row[metric]?Math.max(3,Math.round(100*row[metric]/peak)):0}"></div><small>${row.year}</small></div>`).join('')}</div></div>`;
 };
 const periodLabel=historyYear==='all'?'Desde o início':historyYear==='unknown'?'Registros sem data':historyYear;
 const thisYear=years.find(row=>row.year===new Date().getFullYear());
 const count=value=>(Number(value)||0).toLocaleString('pt-BR');
 const playLabel=source==='Trakt'?'Reproduções':'Itens assistidos';
 const overview=`<section class="stats-dashboard-hero"><span class="eyebrow">${escape(source)} · ${escape(periodLabel)}</span><h2>Sua atividade</h2><strong class="stats-dashboard-total">${count(stats.plays)}</strong><span class="stats-dashboard-label">${playLabel}</span><dl class="stats-dashboard-kpis"><div><dt>Filmes</dt><dd>${count(stats.movies)}</dd></div><div><dt>Séries</dt><dd>${count(stats.series)}</dd></div><div><dt>Episódios</dt><dd>${count(stats.episodes)}</dd></div></dl>${source==='Trakt'&&stats.timedPlays?`<p class="muted">${Math.floor(minutes/60)}h ${minutes%60}min estimados em ${count(stats.timedPlays)} reproduções com duração</p>`:''}</section>`;
 const annual=historyYear==='all'&&thisYear?`<section class="stats-dashboard-section"><header class="stats-section-heading"><h2>Este ano</h2><span>${thisYear.year}</span></header><dl class="stats-dashboard-kpis"><div><dt>Filmes</dt><dd>${count(thisYear.movies)}</dd></div><div><dt>Episódios</dt><dd>${count(thisYear.episodes)}</dd></div><div><dt>${playLabel}</dt><dd>${count(thisYear.plays)}</dd></div></dl></section>`:'';
 const genreSection=type=>{
  const {classified,total,rows}=watchedGenres(dates.media||[],statsItems,historyYear,type,genreLabel);
  return `<section class="stats-dashboard-section"><h2>Gêneros mais assistidos</h2>${rows.length?`<ul class="stats-genres">${rows.map(([genre,value])=>`<li><span>${escape(genre)}</span><meter min="0" max="${classified}" value="${value}" aria-label="${escape(genre)}"></meter><strong>${count(value)}</strong></li>`).join('')}</ul><p class="muted">${count(classified)} de ${count(total)} títulos identificados têm gênero no catálogo. Um título pode contar em mais de um gênero.</p>`:'<p class="muted">Ainda não há gêneros disponíveis para os títulos assistidos neste período.</p>'}</section>`;
 };
 const feedback=readFeedback(storage);
 const byKey=new Map(items.map(item=>[`${item.type}:${item.id}`,item]));
 const favorites=Object.entries(feedback).filter(([key,row])=>row?.value==='like'&&/^(movie|series):tt[0-9]{5,12}$/.test(key))
  .sort(([,a],[,b])=>b.at-a.at).map(([key,{item}])=>byKey.get(key)||item).filter(item=>item?.id&&item.name);
 const favoriteShelf=type=>{
  const rows=favorites.filter(item=>item.type===type).slice(0,12);
  const title=type==='movie'?'Filmes favoritos':'Séries favoritas';
  return `<section class="stats-dashboard-section"><h2>${title}</h2>${rows.length?`<div class="stats-poster-shelf">${rows.map((item,index)=>`<button class="poster-card" data-stats-favorite="${index}" data-stats-type="${type}" type="button">${poster(item,'',false,false)}${viewingRibbon(item)}<strong>${escape(item.name)}</strong></button>`).join('')}</div>`:'<p class="muted">Marque “Gostei” na ficha de um título para ele aparecer aqui.</p>'}</section>`;
 };
 const weekdaySection=type=>{
  const values=stats.weekdays?.[type];
  if(!Array.isArray(values)||values.length!==7||!values.some(value=>value>0))return '';
  const days=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
  const peak=Math.max(...values);
  const unit=type==='movies'?'filmes':'episódios';
  return `<section class="stats-dashboard-section"><h2>Atividade por dia da semana</h2><div class="stats-weekdays">${values.map((value,index)=>`<div aria-label="${days[index]}, ${count(value)} ${unit}"><strong>${count(value)}</strong><div class="profile-bar" data-bar-height="${value?Math.max(3,Math.round(value/peak*100)):0}"></div><small>${days[index].slice(0,3)}</small></div>`).join('')}</div><p class="muted">${source==='Nuvio'?`Total de ${unit} distintos em cada dia da semana.`:'Reproduções registradas com data.'}</p></section>`;
 };
 const detailItems=[];
 const actorKey='cena.stats.favorite-cast.v1';
 let favoriteActors=[];
 try{const saved=JSON.parse(storage.getItem(actorKey)||'[]');if(Array.isArray(saved))favoriteActors=saved.filter(name=>typeof name==='string');}catch{}
 const actorFavorites=()=>`<section class="stats-dashboard-section"><h2>Atores favoritos</h2>${favoriteActors.length?`<div class="chips">${favoriteActors.map(name=>`<button class="chip selected" data-favorite-actor="${escape(name)}" aria-pressed="true">${escape(name)} · Remover</button>`).join('')}</div>`:'<p class="muted">Use o coração ao lado de um nome em Atores mais vistos.</p>'}</section>`;
 const savedShelf=type=>{
  const rows=items.filter(item=>item.type===type).slice(0,12);
  if(!rows.length)return '';
  return `<section class="stats-dashboard-section"><h2>${type==='movie'?'Meus filmes':'Minhas séries'}</h2><div class="stats-poster-shelf">${rows.map(item=>{
   const index=detailItems.push(item)-1;
   return `<button class="poster-card" data-stats-title="${index}">${poster(item,'',false,false)}${viewingRibbon(item)}<strong>${escape(item.name)}</strong></button>`;
  }).join('')}</div></section>`;
 };
 const actorList=type=>{
  const titles=watchedTitles(dates.media||[],statsItems,historyYear,type);
  const clean=name=>String(name).replace(/&(?:apos|#39|#x27);/gi,"'").replace(/&amp;/gi,'&').replace(/&quot;/gi,'"');
   const actors=castRanking(titles.map(row=>({...row,item:{...row.item,cast:(row.item.cast||[]).map(clean)}})));
  if(!actors.length)return '<section class="stats-dashboard-section"><h2>Atores mais vistos</h2><p class="muted">Aparecem quando os títulos assistidos têm elenco cadastrado no catálogo local.</p></section>';
  return `<section class="stats-dashboard-section"><h2>Atores mais vistos</h2><ol class="stats-ranking stats-actors">${actors.map(({name,count:total},rank)=>`<li><span class="stats-actor-rank">${rank+1}</span><div class="stats-actor-copy"><span>${escape(name)}</span><strong>${count(total)} ${total===1?'título':'títulos'}</strong></div><button class="chip" data-favorite-actor="${escape(name)}" aria-label="Favoritar ${escape(name)}" aria-pressed="${favoriteActors.includes(name)}">${favoriteActors.includes(name)?'♥':'♡'}</button></li>`).join('')}</ol><p class="muted">Contagem de títulos assistidos com elenco disponível.</p></section>`;
 };
 const topTitles=(type,metric,label)=>{
  const rows=watchedTitles(dates.media||[],statsItems,historyYear,type).filter(row=>row[metric]>0&&row.item.name)
   .sort((a,b)=>b[metric]-a[metric]||a.item.name.localeCompare(b.item.name,'pt-BR')).slice(0,10);
  if(!rows.length)return '';
  return `<section class="stats-dashboard-section"><h2>${label}</h2><ol class="stats-ranking stats-title-ranking">${rows.map((row,rank)=>{
   const index=detailItems.push(row.item)-1;
   const value=row[metric];
   return `<li><button class="stats-title-row" data-stats-title="${index}"><span class="stats-rank-number">${rank+1}</span><div class="stats-rank-art">${poster(row.item,'',false,false)}</div><div class="stats-rank-copy"><strong>${escape(row.item.name)}</strong><meter min="0" max="${rows[0][metric]}" value="${value}"></meter></div><strong class="stats-rank-value">${metric==='minutes'?`${Math.floor(value/60)}h ${value%60}min`:count(value)+(type==='series'?' ep.':'×')}</strong></button></li>`;
  }).join('')}</ol></section>`;
 };
 const detailActivity=type=>{
  const rows=dates.activity;
  if(!Array.isArray(rows)||historyYear==='unknown')return '';
  const today=new Date(),key=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  const weekStart=new Date(today.getFullYear(),today.getMonth(),today.getDate()-((today.getDay()+6)%7));
  const monthStart=new Date(today.getFullYear(),today.getMonth(),1);
  const matching=rows.filter(row=>row.date<=key(today)&&(historyYear==='all'||row.date.startsWith(historyYear+'-')));
  const sum=(start,metric)=>matching.filter(row=>row.date>=key(start)).reduce((total,row)=>total+(Number(row[type]?.[metric])||0),0);
  const timed=matching.some(row=>row[type]?.minutes>0);
  const metric=timed?'minutes':'plays';
  const values=new Map();
  for(const row of matching){const month=row.date.slice(0,7);values.set(month,(values.get(month)||0)+(Number(row[type]?.[metric])||0));}
  const months=[...values].slice(-12);
  const top=Math.max(1,...months.map(([,value])=>value));
  const format=value=>timed?`${Math.floor(value/60)}h ${value%60}min`:count(value);
  return `<section class="stats-dashboard-section"><h2>Atividade no tempo</h2>${historyYear==='all'||Number(historyYear)===today.getFullYear()?`<dl class="stats-dashboard-kpis"><div><dt>Esta semana</dt><dd>${count(sum(weekStart,'plays'))}</dd></div><div><dt>Este mês</dt><dd>${count(sum(monthStart,'plays'))}</dd></div>${timed?`<div><dt>Tempo este mês</dt><dd>${format(sum(monthStart,'minutes'))}</dd></div>`:''}</dl>`:''}<p class="muted">${source==='Nuvio'?'Registros com data, somados por dia.':'Reproduções registradas com data.'} ${timed?'Tempo estimado pelas durações disponíveis.':''}</p>${months.length?`<div class="profile-chart" role="region" aria-label="Evolução mensal" tabindex="0"><div class="profile-bars">${months.map(([month,value])=>`<div class="profile-bar-column"><span>${format(value)}</span><div class="profile-bar" data-bar-height="${value?Math.max(3,Math.round(value/top*100)):0}"></div><small>${escape(month.slice(5)+'/'+month.slice(2,4))}</small></div>`).join('')}</div></div>`:''}</section>`;
 };
 const statusSection=type=>{
  const totals=new Map();
  for(const item of items.filter(item=>item.type===type)){
   const state=viewingStatus(item);
   totals.set(state.label,(totals.get(state.label)||0)+1);
  }
  return totals.size?`<section class="stats-dashboard-section"><h2>Distribuição por status</h2><ul class="stats-ranking">${[...totals].map(([label,total])=>`<li><span>${escape(label)}</span><strong>${count(total)}</strong></li>`).join('')}</ul><p class="muted">Situação atual dos títulos salvos no CENA.</p></section>`:'';
 };
 const activity=(metric,label)=>`<section class="stats-dashboard-section"><h2>${label}</h2>${chart(metric,label)}</section>`;
 let content='';
 if(profileStatsTab==='overview')content=`${source==='Combinado'?'<p class="muted">Nuvio + Trakt · filmes e episódios identificados, sem duplicar o mesmo título ou episódio. Reprises aparecem na visão do Trakt.</p>':''}${historyPending?historyEmpty:`${overview}${annual}${genreSection()}`}${favoriteShelf('movie')}${favoriteShelf('series')}${actorFavorites()}${historyPending?'':actorList()}${savedShelf('movie')}${savedShelf('series')}${items.length?viewingLegend():''}${historyPending?'':activity('plays',source==='Trakt'?'Reproduções por ano':'Itens assistidos por ano')}`;
 if(profileStatsTab==='movies')content=historyPending?historyEmpty:`<section class="stats-dashboard-hero"><span class="eyebrow">${escape(periodLabel)}</span><h2>Filmes assistidos</h2><strong class="stats-dashboard-total">${count(stats.movies)}</strong><span class="stats-dashboard-label">Filmes diferentes</span></section>${detailActivity('movies')}${statusSection('movie')}${(source==='Trakt'?topTitles('movie','plays','Filmes mais vistos'):'')}${actorList('movie')}${weekdaySection('movies')}${genreSection('movie')}${activity('movies','Filmes diferentes por ano')}`;
 if(profileStatsTab==='series')content=historyPending?historyEmpty:`<section class="stats-dashboard-hero"><span class="eyebrow">${escape(periodLabel)}</span><h2>Séries assistidas</h2><dl class="stats-dashboard-kpis"><div><dt>Séries</dt><dd>${count(stats.series)}</dd></div><div><dt>Episódios</dt><dd>${count(stats.episodes)}</dd></div></dl></section>${detailActivity('series')}${statusSection('series')}${topTitles('series','minutes','Séries por tempo assistido')}${topTitles('series','episodes','Séries por episódios vistos')}${actorList('series')}${weekdaySection('episodes')}${genreSection('series')}${activity('episodes','Episódios diferentes por ano')}`;
 if(profileStatsTab==='library')content=`<div class="profile-hero"><span>SUA COLEÇÃO NESTE APARELHO</span><strong>${collection.total} ${collection.total===1?'título':'títulos'}</strong><div><span>${collection.movies} filmes</span><span>${collection.series} séries</span><span>${collection.watchlist} para assistir</span></div></div><h2>Histórico assistido</h2>${historyPending?historyEmpty:cards}<p class="muted">A coleção inclui títulos salvos para assistir. Os números do histórico seguem a fonte selecionada.</p>`;
 if(profileStatsTab==='library'&&!collection.total&&nuvioState.active)content=`<div class="profile-hero"><span>SUA ATIVIDADE CONECTADA</span><strong>Nuvio</strong><p>${Number(nuvioState.watchedCount)||0} registros recebidos${nuvioState.profileName?' · '+escape(nuvioState.profileName):''}.</p></div><h2>Histórico assistido</h2>${historyPending?historyEmpty:cards}<p class="muted">Sua coleção reúne os títulos que você salva no CENA. Os registros recebidos do Nuvio podem incluir episódios e não equivalem ao total de filmes assistidos.</p>`;
 if(profileStatsTab==='time')content=`<div class="profile-hero"><span>TEMPO DE VISUALIZAÇÃO ESTIMADO</span><strong>${Math.floor(minutes/60)}h ${minutes%60}min</strong><p>Duração disponível em ${stats.timedPlays||0} de ${stats.plays||0} registros.</p></div><h2>Reproduções por ano</h2>${chart('plays','Reproduções por ano')}<p class="muted">O gráfico usa o ano em que você assistiu. O tempo soma a duração informada dos títulos e não mede o tempo real na tela. Datas no fuso ${escape(historyState.timezone||'local')}.</p>${cards}`;
 if(profileStatsTab==='time'&&historyPending)content=historyEmpty;
 if(profileStatsTab==='ratings')content=`<div class="profile-hero"><span>SUAS NOTAS NO CENA</span><strong>${ratings.average===null?'Sem notas':ratings.average.toLocaleString('pt-BR',{maximumFractionDigits:2})+' / 10'}</strong><p>${ratings.count} ${ratings.count===1?'avaliação salva':'avaliações salvas'} nos Stories deste aparelho.</p></div><h2>Distribuição das notas</h2>${ratings.count?`<div class="profile-chart"><div class="profile-bars">${ratings.distribution.map(row=>`<div class="profile-bar-column"><span>${row.count||''}</span><div class="profile-bar" data-bar-height="${Math.max(row.count?3:0,Math.round(100*row.count/Math.max(1,...ratings.distribution.map(x=>x.count))))}"></div><small>${row.rating}</small></div>`).join('')}</div></div><p class="muted">Para o gráfico, notas decimais são agrupadas no inteiro mais próximo. A média usa a nota original.</p>`:'<p class="muted">Adicione uma nota ao criar um Story para começar.</p>'}<p class="muted">Essas são suas notas locais; avaliações do Trakt ainda não são importadas.</p>`;
 if(profileStatsTab==='platforms')content='<div class="profile-empty"><strong>Plataformas assistidas</strong><p>O histórico atual não informa em qual serviço cada reprodução aconteceu. Os logotipos das capas mostram disponibilidade atual e não determinam onde você assistiu.</p></div>';
 target.innerHTML=`<div class="profile-stat-tabs" role="tablist" aria-label="Categorias de estatísticas">${tabs.map(([id,label])=>`<button role="tab" aria-selected="${profileStatsTab===id}" class="chip ${profileStatsTab===id?'selected':''}" data-profile-stats="${id}">${label}</button>`).join('')}</div>${content}${source==='Trakt'&&historyState.coverage==='partial'?'<p class="notice">Histórico parcial: os totais podem aumentar após uma importação completa.</p>':''}${source==='Trakt'&&historyState.unmatched?`<p class="muted">${Number(historyState.unmatched)} registro(s) sem correspondência IMDb continuam no histórico.</p>`:''}`;
 for(const button of target.querySelectorAll('[data-favorite-actor]'))button.onclick=()=>{
  const name=button.dataset.favoriteActor;
  const updated=favoriteActors.includes(name)?favoriteActors.filter(value=>value!==name):[...favoriteActors,name];
  storage.setItem(actorKey,JSON.stringify(updated));renderHistoryStats();
 };
 for(const button of target.querySelectorAll('[data-stats-title]'))button.onclick=()=>showDetail(detailItems[Number(button.dataset.statsTitle)]);
 for(const button of target.querySelectorAll('[data-stats-favorite]'))button.onclick=()=>showDetail(favorites.filter(item=>item.type===button.dataset.statsType)[Number(button.dataset.statsFavorite)]);
 if(historyMode==='stats')wireImages();
 for(const bar of target.querySelectorAll('[data-bar-height]'))bar.style.height=Number(bar.dataset.barHeight)*.82+'px';
 const period=$('#viewing-period');
 const wasHidden=period?.hidden;
 if($('#stats-nuvio'))$('#stats-nuvio').onclick=()=>{setTab('connect');$('#nuvio-panel')?.scrollIntoView();};
 if(period)period.hidden=source!=='Trakt'||historyMode!=='stats'||historyDedicated||profileStatsTab!=='movies';
 if(wasHidden&&period&&!period.hidden)loadPeriod();
 target.querySelectorAll('[data-profile-stats]').forEach(button=>button.onclick=()=>{profileStatsTab=button.dataset.profileStats;renderHistoryStats();});target.hidden=historyMode!=='stats';const records=$('#history-records');if(records)records.hidden=historyMode!=='history';
}
function renderHistoryRows(total){
 const other=(nuvioState.active?[...viewingDays([],nuvioState).values()].flatMap(day=>[...day.values()]):[])
  .filter(row=>(!historyMedia||row.id===historyMedia)&&(historyKind==='all'||row.kind===historyKind)&&(historyYear==='all'||historyYear===String(new Date(row.watchedAt).getFullYear())));
 const key=row=>[viewingDayKey(new Date(row.watchedAt)),row.kind,row.id,row.season||0,row.episode||0].join(':');
 const imported=new Set(historyRows.filter(row=>row.datePrecision==='exact'&&row.id).map(key));
 const extra=other.filter(row=>!imported.has(key(row)));
 const rows=[...historyRows,...extra].sort((a,b)=>(b.datePrecision==='exact'?new Date(b.watchedAt).getTime():0)-(a.datePrecision==='exact'?new Date(a.watchedAt).getTime():0));

 const target=$('#history-records');if(!target)return;historyResults=rows.map(row=>historyItem(row,items));
 const groups=[];
 rows.forEach((row,index)=>{
   const [day,time]=historyDate(row).split(', ');
   let group=groups.at(-1);
   if(group?.day!==day){group={day,entries:[]};groups.push(group);}
   const item=historyResults[index];
   const episode=row.kind==='episode'?`T${escape(row.season)} · E${escape(row.episode)}${row.episodeTitle?` · ${escape(row.episodeTitle)}`:''}`:'Filme';
   group.entries.push(`<li><button class="history-row poster-card" data-history-index="${index}">${poster(item)}<span class="history-entry-copy">${viewingRibbon(item,null,'watched')}<strong>${escape(item.name)}</strong><small>${episode}${nuvioState.active?' · '+escape([...(row.sources||[row.source||'Trakt'])].join(' + ')):''}</small></span>${time?`<time>${escape(time)}</time>`:''}</button></li>`);
 });
 const timeline=groups.map(({day,entries})=>`<section class="history-day"><h3>${escape(day)}</h3><ul>${entries.join('')}</ul></section>`).join('');
 target.innerHTML=`<p class="muted">${nuvioState.active?'Nuvio (registros recentes) + histórico importado do Trakt. ':''}${total} registros ${historyYear==='all'?'em todos os anos':historyYear==='unknown'?'sem data confirmada':`em ${escape(historyYear)}`}</p>${timeline||'<div class="empty"><p>Nenhum registro disponível para este filtro.</p></div>'}${historyHasMore?'<button class="secondary wide" id="history-more">Mais registros</button>':''}`;
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
const streamingData=new Map(),streamingPending=new Set(),streamingObserved=new WeakSet(),cinemaData=new Map(),cinemaPending=new Set();
const tmdbPosterRecovery=new Set();
function recoverTmdbPoster(key,value){if(!/^\/[A-Za-z0-9_.-]{1,120}\.(jpg|png)$/.test(value?.poster||'')||tmdbPosterRecovery.has(key))return;const item=artworkModels.get(key),nodes=[...document.querySelectorAll('.poster-art[data-artwork-key]')].filter(node=>node.dataset.artworkKey===key&&!node.querySelector(':scope > img'));if(!item||!nodes.length)return;tmdbPosterRecovery.add(key);artworkResolver.remember(item,'https://image.tmdb.org/t/p/w500'+value.poster);const pending=artworkResolver.jobs.get(key);Promise.resolve(pending).finally(()=>{artworkResolver.failures.delete(key);tmdbPosterRecovery.delete(key);for(const node of nodes)if(node.isConnected&&!node.querySelector(':scope > img'))hydrateArtwork(node);});}
function requestStreaming(node){if(!streamingConfigured||!node.isConnected)return;const key=node.dataset.streamKey;if(!/^(movie|series):tt\d{5,12}$/.test(key||'')||streamingData.has(key)||streamingPending.has(key))return;const [type,id]=key.split(':');streamingPending.add(key);window.CenaAndroid?.findStreaming?.(id,type);}
function paintStreaming(node,value){
 if(node.onCenaAvailability){node.onCenaAvailability(value,streamingConfigured,cinemaData.get(node.dataset.streamKey));return;}
 if(node.id==='detail-providers'){
   const rows=availabilityRows(value);
   node.innerHTML=`<h3>Onde assistir no Brasil</h3>${rows.length?rows.map(row=>`<p><strong>${escape(row.label)}</strong> · ${escape(row.names.join(', '))}</p>`).join('')+'<small>JustWatch via TMDB</small>':`<p class="muted">${!streamingConfigured?'Conecte o TMDB em Conexões.':value?'Disponibilidade não confirmada nesta consulta.':'Consultando serviços…'}</p>`}`;
   return;
 }
 node.replaceChildren();node.classList.remove('has-stream');node.removeAttribute('title');if(!value?.logo||!/^\/[A-Za-z0-9_.-]{1,120}\.png$/.test(value.logo))return;const img=document.createElement('img');img.src='https://image.tmdb.org/t/p/w92'+value.logo;img.alt='Disponível em '+String(value.name||'streaming');img.loading='lazy';node.append(img);node.title=img.alt;node.classList.add('has-stream');}
const streamingObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)requestStreaming(entry.target);},{rootMargin:'150px'}):null;
function requestCinema(node,key){
 if(!streamingConfigured||typeof window.CenaAndroid?.findCinema!=='function'||node.id==='story-availability'||!node.onCenaAvailability||!/^movie:tt\d{5,12}$/.test(key)||cinemaData.has(key)||cinemaPending.has(key))return;
 cinemaPending.add(key);window.CenaAndroid.findCinema(key.slice(6));
}
function wireStreaming(){for(const node of document.querySelectorAll('[data-stream-key]')){const cached=streamingData.get(node.dataset.streamKey);requestCinema(node,node.dataset.streamKey);if(cached||node.id==='detail-providers'||node.onCenaAvailability)paintStreaming(node,cached);if(streamingObserved.has(node))continue;streamingObserved.add(node);if(streamingObserver)streamingObserver.observe(node);else requestStreaming(node);}}
window.CenaStreamingResult=value=>{
 if(value.kind==='titleAliases'){titleAliases.accept(value);return;}
 if(value.kind==='cinema'){
  const key=`movie:${value.id}`;cinemaPending.delete(key);
  if(!value.error)cinemaData.set(key,value.date||'');
  for(const node of document.querySelectorAll('#story-availability'))if(node.dataset.streamKey===key)paintStreaming(node,streamingData.get(key));
  return;
 }if(value.kind==='status'){streamingConfigured=Boolean(value.configured);streamingMessage=value.message||(streamingConfigured?'TMDB conectado. Disponibilidade do Brasil.':'Configure sua chave gratuita do TMDB para exibir os serviços no Brasil.');const label=$('#streaming-status');if(label)label.textContent=streamingMessage;for(const node of document.querySelectorAll('#detail-providers,#story-availability'))paintStreaming(node);if(streamingConfigured){streamingData.clear();streamingPending.clear();cinemaData.clear();cinemaPending.clear();for(const node of document.querySelectorAll('[data-stream-key]')){const rect=node.getBoundingClientRect();if(rect.bottom>=-150&&rect.top<=innerHeight+150){requestStreaming(node);requestCinema(node,node.dataset.streamKey);}}}return;}if(value.kind==='provider'){const key=`${value.type}:${value.id}`;streamingPending.delete(key);if(!value.error){streamingData.set(key,value);recoverTmdbPoster(key,value);}for(const node of document.querySelectorAll('[data-stream-key]'))if(node.dataset.streamKey===key)paintStreaming(node,value);}};
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
 panel.innerHTML=`<h3>Semelhantes a ${escape(seed.name)}</h3><label><input type="checkbox" id="similar-saved" ${includeSaved?'checked':''}> Incluir títulos do meu catálogo</label><label for="similar-preference">O que você quer encontrar?</label><input id="similar-preference" maxlength="200" placeholder="Ex.: mais ação com o presidente dos EUA" value="${escape(query)}"><button class="secondary wide" id="search-similar">Buscar pelo enredo</button><button class="secondary wide" id="online-similar">${onlineAI.configured()?'✧ Refinar com Gemini online':'✧ Conectar Gemini online'}</button><p id="similar-status" class="muted" role="status">Consultando sinopses e temas…</p><div id="similar-grid"></div><div id="similar-reasons"></div><div id="similar-omitted"></div>${localAI.state.configured&&localAI.state.supported?'<button class="secondary wide" id="refine-similar">✧ Refinar com IA local</button><button class="secondary wide" id="cancel-similar" hidden>Cancelar IA</button>':''}`;
 const search=panel.querySelector('#search-similar'),ai=panel.querySelector('#refine-similar'),online=panel.querySelector('#online-similar'),status=panel.querySelector('#similar-status');
 search.disabled=true;online.disabled=true;panel.querySelector('#similar-saved').disabled=true;if(ai)ai.disabled=true;
 const run=async useLocal=>{
  if(!search.isConnected||search.disabled)return;
  const preference=panel.querySelector('#similar-preference').value,include=panel.querySelector('#similar-saved').checked;
  search.disabled=true;online.disabled=true;panel.querySelector('#similar-saved').disabled=true;if(ai)ai.disabled=true;let cancelled=false;const cancel=panel.querySelector('#cancel-similar');if(cancel&&useLocal){cancel.hidden=false;cancel.onclick=()=>{cancelled=true;localAI.cancel();status.textContent='Consulta cancelada. As opções anteriores foram preservadas.';};}
  status.textContent='Buscando candidatos para o pedido e conferindo sinopses…';
  try{
   const result=await similarEngine.find(seed,{existing:items,includeSaved:include,query:preference});
   if(ticket!==similarTicket||!panel.isConnected||cancelled)return;
   paintSimilar(panel,result);
   if(useLocal==='online'){status.textContent='Consultando Gemini online…';const selected=await onlineAI.select(result,preference);if(ticket!==similarTicket||!panel.isConnected)return;paintSimilar(panel,{...result,items:selected});status.textContent=selected.length+' opções selecionadas pelo Gemini entre candidatos do catálogo.';}
   if(useLocal===true&&result.candidates.length){status.textContent='Executando o GGUF no celular entre candidatos que atendem aos critérios…';const answer=await localAI.generate(buildLocalSelectionPrompt(result.seed,result.candidates,preference));if(ticket!==similarTicket||!panel.isConnected||cancelled)return;const selected=validateLocalSelection(answer,result.candidates,{seed:result.seed,query:preference});if(!selected)throw Error('A IA não retornou uma seleção válida para os critérios. Mantive as opções do catálogo.');paintSimilar(panel,{...result,items:selected},true);}
  }catch(error){if(ticket===similarTicket&&status.isConnected&&!cancelled)status.textContent=error.message;}
  finally{if(search.isConnected){search.disabled=false;online.disabled=false;panel.querySelector('#similar-saved').disabled=false;}if(ai?.isConnected)ai.disabled=false;if(cancel?.isConnected)cancel.hidden=true;}
 };
 search.onclick=()=>run(false);panel.querySelector('#online-similar').onclick=()=>{if(!onlineAI.configured()){toast('Conecte o Gemini online com seu token do CENA. A IA local é opcional.');$('#detail').close();setTab('connect');$('#online-ai-panel')?.scrollIntoView({block:'center'});return;}run('online');};if(ai)ai.onclick=()=>run(true);
 panel.querySelector('#similar-preference').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();run(false);}};
 panel.querySelector('#similar-saved').onchange=()=>run(false);
 if($('#similar-ai-settings'))$('#similar-ai-settings').onclick=()=>{$('#detail').close();setTab('connect');$('#local-ai-panel')?.scrollIntoView({block:'center'});};
 try{const result=await similarEngine.find(seed,{existing:items,includeSaved,query});if(ticket===similarTicket&&panel.isConnected)paintSimilar(panel,result);}
 catch(error){if(ticket===similarTicket&&status.isConnected)status.textContent=error.message;}
 finally{if(search.isConnected){search.disabled=false;online.disabled=false;panel.querySelector('#similar-saved').disabled=false;}if(ai?.isConnected)ai.disabled=false;}
}

window.CenaNuvioResult=state=>{
 if(!libraryReady){deferredNuvioState=state;return;}
 if(JSON.stringify(state)===JSON.stringify(nuvioState))return;
 const previousScope=nuvioState.scope;nuvioState=state;if(previousScope!==state.scope)copyPreview=null;mountNuvioCopy($('#nuvio-copy'));if(previousScope!==state.scope)nuvioSeriesRows=[];refreshNuvioEpisodes();renderSync();const merged=applyNuvioState(items,state),changed=JSON.stringify(merged)!==JSON.stringify(items);
 if(changed&&apiBase==='local'){items=merged;storage.setItem('cena.local.items.v1',JSON.stringify(items));}
 if(tab==='connect'&&!document.querySelector('#nuvio-profile:focus')){const panel=$('#nuvio-panel');renderNuvioPanel(panel,state,window.CenaAndroid);}
 if(!$('#detail').open){if(tab==='library'&&changed)patchLibrary();else if(tab==='home'&&changed){const y=window.scrollY;home();window.scrollTo(0,y);}}
 if(tab==='profile'){renderHistorySummary();mountStatsRecap();if(historyMode==='history')loadHistoryRows(true);}
 renderNuvioSections();renderSeriesSections();renderRecentHistory();
};
async function refreshNuvioEpisodes(){const ticket=++nuvioSeriesTicket;if(!nuvioState.active){nuvioSeriesRows=[];return;}const scope=nuvioState.scope;await nuvioSeriesEngine.refresh(nuvioState,{isCurrent:()=>ticket===nuvioSeriesTicket&&scope===nuvioState.scope,onRow:row=>{nuvioSeriesRows=[...nuvioSeriesRows.filter(old=>old.id!==row.id),row];renderNuvioSections();renderSeriesSections();}});}
function resumeScope(){return nuvioState.scope||String(nuvioState.profileId||'');}
let resumeHomeOffset=0,resumeLastMotion=0,resumePointer=false,resumeRefreshTimer=0,resumeFullRefresh=false;
function resumeInMotion(){return resumePointer||Date.now()-resumeLastMotion<350;}
function deferResumeRefresh(full=false){
 resumeFullRefresh=resumeFullRefresh||full;clearTimeout(resumeRefreshTimer);
 resumeRefreshTimer=setTimeout(()=>{if(tab!=='home'){resumeFullRefresh=false;return;}if(resumeInMotion()){deferResumeRefresh();return;}const rebuild=resumeFullRefresh;resumeFullRefresh=false;if(rebuild){const y=window.scrollY;home();window.scrollTo(0,y);}else renderNuvioSections();},400);
}
function renderNuvioSections(){
 const section=$('#nuvio-home')||$('#nuvio-library');if(!section)return;
 const previousRail=section.querySelector('.resume-rail:not(.expanded)');
 if(section.id==='nuvio-home'&&previousRail&&resumeInMotion()){deferResumeRefresh();return;}
 if(section.id==='nuvio-home'&&previousRail)resumeHomeOffset=previousRail.scrollLeft;
 const paused=nuvioContinue(items,nuvioState).map(entry=>({...entry,scope:resumeScope()}));const all=combineContinuity([...paused,...traktPausedEntries(traktState)],nextEpisodeEntries(items,seriesState,traktState,nuvioState,nuvioSeriesRows)),eligible=visibleResume(all,resumeHidden,resumeScope()),rows=oneResumePerTitle(eligible);nuvioResults=rows.map(({item})=>({...item,...homeMetadata.get(`${item.type}:${item.id}`)}));
 if(!rows.length&&!all.length){section.innerHTML=section.id==='nuvio-library'?'<p class="muted">Nenhuma reprodução em andamento nas contas consultadas.</p>':'';return;}
 const hidden=oneResumePerTitle(all.filter(entry=>resumeHidden[resumeKey(entry,resumeScope())])).length;
 if(!rows.length&&!hidden){section.innerHTML='';return;}
 const isHome=section.id==='nuvio-home',previewCount=isHome?12:6;
 const markup=`<div class="section-heading"><div><h2>Continuar assistindo</h2></div>${rows.length>previewCount?`<button id="resume-expand" aria-expanded="${resumeExpanded}">${resumeExpanded?'Mostrar menos':`Ver todos · ${rows.length}`}</button>`:''}</div>${rows.length?`<div class="resume-rail ${resumeExpanded?'expanded':''}">${rows.slice(0,resumeExpanded?rows.length:previewCount).map((entry,index)=>{const {row,label}=entry,item=nuvioResults[index],percent=Number.isFinite(entry.percent)?entry.percent:row.duration>0?Math.max(0,Math.min(99,Math.round(row.position/row.duration*100))):null;const backdrop=isHome?trustedArtwork(item.backdrop):'';return `<article class="resume-card"><button class="resume-open" data-nuvio-title="${escape(item.id)}" data-nuvio-type="${escape(item.type)}" aria-label="Ver ${escape(titleName(item))}"><div class="resume-art">${backdrop?`<img class="resume-backdrop" src="${escape(backdrop)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:''}${poster({...item,name:titleName(item)})}<span class="resume-play" aria-hidden="true">▶</span></div><div class="resume-copy">${viewingRibbon(item,null,'progress')}<strong>${escape(titleName(item))}</strong><small>${escape(label)}</small><small class="continuity-source">${escape(entry.source)}${entry.kind==='pending'?' · Aguardando confirmação':''}</small>${percent!==null?`<progress max="100" value="${percent}" aria-label="${percent}% assistido"></progress>`:''}${scoreMarkup(item)}${(entry.also||[]).map(row=>`<small class="continuity-secondary">Também em ${escape(row.source)}: ${escape(row.label)}</small>`).join('')}</div></button>${entry.kind==='pending'?'':`<button class="resume-dismiss" data-resume-hide="${index}" aria-label="Remover ${escape(titleName(item))} de continuar assistindo">×</button>`}</article>`;}).join('')}</div>`:'<p class="muted">Sua próxima sessão começa quando você quiser.</p>'}${hidden?`<button class="link-button restore-resume" id="resume-restore">Restaurar ${hidden} ${hidden===1?'título oculto':'títulos ocultos'}</button>`:''}`;
 if(section.resumeMarkup===markup&&section.querySelector('.resume-rail'))return;
 section.resumeMarkup=markup;section.innerHTML=markup;
 const rail=section.querySelector('.resume-rail:not(.expanded)');
 if(rail&&isHome){rail.scrollLeft=resumeHomeOffset;rail.addEventListener('scroll',()=>{resumeHomeOffset=rail.scrollLeft;resumeLastMotion=Date.now();},{passive:true});rail.addEventListener('pointerdown',()=>{resumePointer=true;},{passive:true});}
 for(const image of section.querySelectorAll('.resume-backdrop'))image.onerror=()=>image.remove();
 for(const button of section.querySelectorAll('[data-nuvio-title]'))button.onclick=()=>showDetail(nuvioResults.find(row=>row.id===button.dataset.nuvioTitle&&row.type===button.dataset.nuvioType));
 for(const button of section.querySelectorAll('[data-resume-hide]'))button.onclick=()=>{const {item}=rows[Number(button.dataset.resumeHide)];for(const entry of eligible){if(entry.item.id===item.id&&entry.item.type===item.type)resumeHidden[resumeKey(entry,resumeScope())]=true;}storage.setItem(resumeHiddenKey,JSON.stringify(resumeHidden));renderNuvioSections();toast('Oculto no CENA. O histórico do Nuvio foi mantido.');};
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
  if(url&&!titleArtwork(item,url))return;
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
  if(traktState.connected!==state.connected||traktState.username!==state.username){copyPreview=null;copyMessage='';copyImportQueued=false;} traktWasConnected = Boolean(state.connected); traktState = state;renderSync();mountNuvioCopy($('#nuvio-copy'));
  if(apiBase !== 'local') return;
  const merged = applyTraktState(items,state,{preserveWatchState:nuvioState.active});
  const libraryChanged=JSON.stringify(merged)!==JSON.stringify(items);
  if(libraryChanged) { items=merged; storage.setItem('cena.local.items.v1',JSON.stringify(items)); }
  if(becameConnected) sendTraktInventory();
  if(state.connected && state.needsUpload && !traktInitialUploadRequested) { traktInitialUploadRequested=true; sendTraktList(); }
  if(tab==='connect') renderTraktPanel();
  else if(!$('#detail').open) {
    if(tab==='library') { if(libraryChanged)patchLibrary();else updateArtworkProgress(); }
    else if(tab==='home'&&libraryChanged) {const position=window.scrollY;home();window.scrollTo(0,position);}
  }
  renderNuvioSections();renderSeriesSections();
  const label=$('#trakt-item-state'); if(label && detailItem) label.textContent=traktItemLabel(detailItem,state);
};
main.addEventListener('click', event => {
  const card = event.target.closest?.('button.poster-card[data-id]');
  if (!card) return;
  const capture = card.closest('#result-grid')?.dataset.capture === 'true';
  const pool = capture ? searchResults : [...searchResults,...discoveryResults,...highlightsResults,...similarResults,...nuvioResults,...seriesResults,...collectionResults,...recentHistoryResults,...items];
  const item = pool.find(row => row.id === card.dataset.id);
  if (!item) return;
  showDetail(item,false,capture ? {reading:captureEvidence} : null);
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
function streamBadge(key){
  return `<span class="stream-badge" data-stream-key="${escape(key)}"></span>`;
}
function seriesBadges(item){
  return `<span class="series-badges">${scoreMarkup(item)}${streamBadge(`${item.type}:${item.id}`)}</span>`;
}
function poster(item, badge = '', showRating = false, showStreaming = true) {
  const key=`${item.type}:${item.id}`;artworkModels.set(key,item);
  const image=artworkResolver.peek(item)||titleArtwork(item,item.poster);
  return `<div class="poster-art" data-artwork-key="${escape(key)}">${image?`<img src="${escape(image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:''}<span class="fallback">${escape(item.name)}</span>${badge ? `<span class="badge">${escape(badge)}</span>` : ''}${showRating?scoreMarkup(item):''}${showStreaming?streamBadge(key):''}</div>`;
}
function viewingStatus(item,row,activity){
 if(activity==='progress')return {color:'orange',label:'Em andamento'};
 const series=item.type==='series';
 const saved=items.find(title=>title.id===item.id&&title.type===item.type)||item;
 const observed=series&&nuvioState.active?nuvioState.series?.find(title=>title.id===item.id):null;
 if(series&&!row){
  const key=observed?[...(observed.seen||[])].sort().join('|'):null;
  row=(key!==null?nuvioSeriesRows.find(title=>title.id===item.id&&title.historyKey===key):null)||currentTraktProgress(item,seriesState,traktState);
 }
 if(series&&row?.checkedAt&&!row.error){
  if(row.coverage!=='partial'&&row.aired>0&&row.available===0)return {color:'green',label:'Em dia'};
  if(row.available>0&&(row.completed>0||saved.watchedEpisodes>0))return {color:'orange',label:'Em andamento'};
 }
 const archived=historyState.media?.find(title=>title.id===item.id&&title.type===item.type);
 const nuvioWatched=nuvioState.active&&[nuvioState.watched,nuvioState.recent].some(rows=>rows?.some(title=>title.id===item.id&&title.type===item.type));
 if(!series&&(activity==='watched'||saved.status==='watched'||archived?.plays>0||nuvioWatched))return {color:'green',label:'Assistido'};
 const paused=nuvioState.active&&nuvioState.progress?.some(title=>title.id===item.id&&title.type===item.type&&title.position>0&&(!title.duration||title.position<title.duration))
  ||traktState.connected&&traktState.paused?.some(title=>title.id===item.id&&title.type===item.type&&title.percent>0&&title.percent<100);
 if(paused||series&&(activity==='watched'||saved.watchedEpisodes>0||archived?.episodes>0||observed?.episodes>0||nuvioWatched))return {color:'orange',label:'Em andamento'};
 if(saved.status==='watchlist')return {color:'purple',label:'Quero assistir'};
 return {color:'gray',label:'Sem progresso'};
}
function viewingRibbon(item,row,activity){
 const {color,label}=viewingStatus(item,row,activity);
 return `<span class="viewing-ribbon" data-color="${color}">${label}</span>`;
}
function updateViewingRibbon(card,item){
 const ribbon=card.querySelector('.viewing-ribbon');
 const {color,label}=viewingStatus(item);
 ribbon.dataset.color=color;
 ribbon.textContent=label;
}
function viewingLegend(){
 return '<details class="viewing-legend"><summary>Legenda das barras</summary><ul><li data-color="green">Verde · Assistido ou em dia</li><li data-color="orange">Laranja · Em andamento</li><li data-color="purple">Roxo · Quero assistir</li><li data-color="gray">Cinza · Sem progresso registrado</li></ul></details>';
}
function grid(rows,recommendation=false) {
  return `<div class="grid">${rows.map(item=>{
    const series=item.type==='series';
    return `<button class="poster-card" data-id="${escape(item.id)}" aria-label="Ver ${escape(item.name)}">${poster(item,'',!series,!series)}${viewingRibbon(item)}<strong>${escape(item.name)}</strong>${historyBadge(item)}<small>${escape(item.year)} · ${titleType(item)}</small>${series?seriesBadges(item):''}${recommendation?`<p class="recommendation-reason">${escape(item.recommendationReason)}</p>`:''}</button>`;
  }).join('')}</div>`;
}
function wireImages() {
  wireRatings();wireStreaming();
  for(const element of document.querySelectorAll('.poster-art[data-artwork-key]')) {
    if(artworkObserved.has(element))continue;artworkObserved.add(element);
    const image=element.querySelector(':scope > img');
    if(image){element.dataset.artworkState='ready';image.onerror=()=>{image.remove();element.dataset.artworkState='missing';const item=artworkModels.get(element.dataset.artworkKey);if(item){delete artworkResolver.cache[artworkResolver.key(item)];persistArtwork(item,'');item.poster='';}hydrateArtwork(element);};continue;}
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
  main.dataset.screen=next;
  searchGeneration++;
  document.querySelectorAll('nav [data-tab]').forEach(button => {
    const active=button.dataset.tab===tab;
    button.classList.toggle('active',active);
    if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  });
  if (tab === 'home') home();
  if (tab === 'library') library();
  if (tab === 'scan') scan();
  if (tab === 'connect') connect();
  if (tab === 'discover') discover();
  if (tab === 'profile') profile();
  if(tab==='collections')collections();
  window.scrollTo(0, 0);
  if(window.matchMedia('(prefers-reduced-motion: no-preference)').matches){
    main.getAnimations().forEach(animation=>animation.cancel());
    main.animate([{opacity:.72},{opacity:1}],{duration:210,easing:'ease-out'});
  }
}
window.CenaBack=()=>{const dialog=document.querySelector('dialog[open]');if(dialog){dialog.close();return true;}if(tab==='discover'&&highlightView){highlightView='';discover();window.scrollTo(0,discoveryScroll);document.querySelectorAll('#discovery-highlights .poster-rail').forEach((rail,i)=>rail.scrollLeft=discoveryRailOffsets[i]||0);return true;}if(tab==='collections'&&activeCollection){activeCollection='';collections();return true;}if(tabHistory.length){setTab(tabHistory.pop(),true);return true;}if(tab!=='home'){setTab('home',true);return true;}return false;};
function horizontalGrid(rows,recommendation=false){return grid(rows,recommendation).replace('class="grid"','class="poster-rail"');}
function loadRecentHistory(){if(tab!=='home')return;if(!historyState.scope||typeof window.CenaAndroid?.historyRows!=='function'){recentHistoryRows=[];renderRecentHistory();return;}recentHistoryRequest=String(++historyRequest);window.CenaAndroid.historyRows(recentHistoryRequest,'all','all',1,'');}
function renderHomeViewing(){
 const target=$('#home-viewing');if(!target)return;
 const groups=viewingDays(recentHistoryRows,nuvioState);
 const days=new Set([...groups.keys(),...(historyState.activity||[]).map(row=>row.date),...(nuvioState.active?nuvioState.statistics?.activity||[]:[]).map(row=>row.date)]);
 if(!days.size){target.replaceChildren();return;}
 const today=new Date(),offset=delta=>new Date(today.getFullYear(),today.getMonth(),today.getDate()+delta);
 let streak=0,start=days.has(viewingDayKey(today))?0:-1;
 while(days.has(viewingDayKey(offset(start-streak))))streak++;
 const week=Array.from({length:7},(_,i)=>offset(i-6));
 const available=week.map(viewingDayKey);
 const selected=available.includes(homeViewingDay)?homeViewingDay:[...available].reverse().find(day=>days.has(day))||available.at(-1);
 const rows=[...(groups.get(selected)?.values()||[])].sort((a,b)=>new Date(b.watchedAt)-new Date(a.watchedAt));
 const selectedDate=week[available.indexOf(selected)];
 const movies=rows.filter(row=>row.kind==='movie').length,episodes=rows.length-movies;
 target.innerHTML=`<div class="section-heading"><h2>Diário de visualização</h2><strong class="diary-streak"><span aria-hidden="true">✦</span> ${streak} ${streak===1?'dia':'dias'} em sequência</strong></div>
 <div class="diary-panel"><div class="viewing-week" role="group" aria-label="Últimos sete dias">${week.map(day=>{const key=viewingDayKey(day),active=days.has(key);return `<button class="chip" data-viewing-day="${key}" aria-label="${day.toLocaleDateString('pt-BR')}${active?', com atividade':''}" aria-pressed="${key===selected}"><span>${day.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','')}</span><strong>${day.getDate()}</strong><i class="diary-dot ${active?'active':''}" aria-hidden="true"></i></button>`;}).join('')}</div>
 <div class="diary-day-heading"><div><small>SUA SESSÃO</small><strong>${escape(selectedDate.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}))}</strong></div><span>${rows.length} ${rows.length===1?'registro':'registros'}</span></div>
 ${rows.length?`<div class="diary-totals">${movies?`<span>${movies} ${movies===1?'filme':'filmes'}</span>`:''}${episodes?`<span>${episodes} ${episodes===1?'episódio':'episódios'}</span>`:''}</div><ul class="diary-entries">${rows.map((row,index)=>{const item=historyItem(row,items),sources=[...row.sources];return `<li><button class="diary-entry" data-daily-title="${index}"><div class="diary-art">${poster(item,'',false,false)}</div><div class="diary-info"><strong>${escape(titleName(item))}</strong><small>${row.kind==='episode'?`Temporada ${Number(row.season)} · Episódio ${Number(row.episode)}`:'Filme assistido'}</small><div class="diary-sources">${sources.map(source=>`<span data-source="${escape(source)}">${escape(source)}</span>`).join('')}</div></div><span class="diary-chevron" aria-hidden="true">›</span></button></li>`;}).join('')}</ul>`:`<p class="diary-empty">${days.has(selected)?'Há atividade neste dia. Os títulos desse dia não vieram na consulta recente.':'Sem visualizações registradas neste dia.'}</p>`}</div>`;
 for(const button of target.querySelectorAll('[data-viewing-day]'))button.onclick=()=>{homeViewingDay=button.dataset.viewingDay;renderHomeViewing();};
 for(const button of target.querySelectorAll('[data-daily-title]'))button.onclick=()=>showDetail(historyItem(rows[Number(button.dataset.dailyTitle)],items));
 wireImages();
}
function renderRecentHistory(){renderHomeViewing();const target=$('#recent-history');if(!target)return;const rows=recentWatches(recentHistoryRows,nuvioState,12);recentHistoryResults=rows.map(row=>historyItem(row,items));target.innerHTML=`<div class="section-heading"><h2>Últimos vistos</h2><button id="recent-see-all">Ver histórico</button></div>${rows.length?`<div class="poster-rail">${rows.map((row,index)=>{const item=recentHistoryResults[index];return `<button class="poster-card" data-id="${escape(item.id)}">${poster(item,'',true)}${viewingRibbon(item,null,'watched')}<strong>${escape(item.name)}</strong><small>${row.kind==='episode'?`T${Number(row.season)} · E${Number(row.episode)} · `:''}${escape(historyDate(row))}</small></button>`;}).join('')}</div>`:`<p class="home-empty muted">${historyState.importing?'Importando o histórico do Trakt… Os registros aparecem ao concluir.':historyState.error?escape(historyState.error):'Seu histórico de filmes e episódios aparece aqui.'}</p>`}`;$('#recent-see-all').onclick=()=>{historyYear='all';historyKind='all';historyMedia='';historyMode='history';historyDedicated=true;setTab('profile');};wireImages();}
window.addEventListener('pointerup',()=>{if(resumePointer){resumePointer=false;resumeLastMotion=Date.now();}},{passive:true});
window.addEventListener('pointercancel',()=>{if(resumePointer){resumePointer=false;resumeLastMotion=Date.now();}},{passive:true});
function home() {
  const rail=$('#nuvio-home .resume-rail:not(.expanded)');if(rail){if(resumeInMotion()){deferResumeRefresh(true);return;}resumeHomeOffset=rail.scrollLeft;}
 const pending=items.filter(item=>item.status==='watchlist'&&!item.watchedEpisodes);
 main.innerHTML=`<section class="capture-hero" id="home-capture"><div class="capture-editorial"><h1>Que filme é esse?</h1><p>Descubra o título pela capa.</p><button class="primary" id="hero-scan"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="3.5"/></svg>Fotografar capa</button></div><div class="capture-emblem" aria-hidden="true"><picture><source media="(prefers-reduced-motion: reduce)" srcset="brand-still.webp"><source type="image/webp" srcset="brand-loop.webp"><img src="brand-mark.png" alt=""></picture></div></section><section id="nuvio-home"></section><section id="home-viewing"></section><section class="home-watchlist" id="home-watchlist"><div class="section-heading"><div><h2>Começar a assistir</h2></div><button id="see-all">${pending.length?`Ver todos · ${pending.length}`:'Seu catálogo'}</button></div>${pending.length?horizontalGrid(pending.slice(0,12)):'<p class="home-empty muted">Salve filmes e séries para encontrar aqui depois.</p><button class="secondary" id="empty-search">Buscar título</button>' }</section><section id="series-home" ${homeSections.series===false?'hidden':''}></section><section class="calendar-preview" id="home-calendar"></section><section id="home-recommendations" ${homeSections.recommendations===false?'hidden':''}><div class="section-heading"><div><h2>Para você</h2></div><button id="home-discover">Explorar</button></div><div id="home-recommendation-grid"></div></section><section id="recent-history" ${homeSections.recent===false?'hidden':''}></section>${viewingLegend()}<button class="home-sync" id="home-sync"><span class="sync-dot ${nuvioState.error||traktState.error?'pending':''}" aria-hidden="true"></span>${nuvioState.active?'Nuvio conectado':traktState.connected?'Trakt conectado':'Lista salva neste aparelho'}<span aria-hidden="true">→</span></button>`;
 $('#hero-scan').onclick=()=>{setTab('scan');if(native)$('#take-photo').click();};$('#see-all').onclick=()=>{filter='watchlist';setTab('library');};$('#home-discover').onclick=()=>{discoveryMode='recommend';setTab('discover');};$('#home-sync').onclick=()=>setTab('connect');
 if($('#empty-search'))$('#empty-search').onclick=()=>{setTab('library');$('#query').focus();};
 wireCards(pending);renderSeriesSections();renderNuvioSections();renderHomeRecommendations();
 renderRecentHistory();loadRecentHistory();
 const area=$('#home-recommendations');if(typeof IntersectionObserver==='function'){const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();loadHomeRecommendations();}},{rootMargin:'100px'});observer.observe(area);}else loadHomeRecommendations();
}
function renderHomeRecommendations(){
 const target=$('#home-recommendation-grid');if(!target)return;
 const known=new Set(items.map(item=>`${item.type}:${item.id}`)),rows=discoveryResults.filter(item=>!known.has(`${item.type}:${item.id}`)).slice(0,12);
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
function libraryRows(){const rows=items.filter(i=>(filter==='all'||i.status===filter)&&(libraryType==='all'||i.type===libraryType));if(librarySort==='name')rows.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));else if(librarySort==='year')rows.sort((a,b)=>(Number(b.year)||0)-(Number(a.year)||0));return rows;}
function library() {
  const rows = libraryRows();
  main.innerHTML = `<div class="library-titlebar"><h1>Minha lista</h1><button class="secondary" id="open-collections">Minhas listas</button></div><form id="search-form" class="search-row"><input id="query" type="search" placeholder="Buscar filme ou série…" aria-label="Nome do filme ou série" minlength="2" maxlength="150" required><button class="primary" type="submit">Buscar</button></form><div class="chips library-status-filters"><button class="chip ${filter === 'watchlist' ? 'selected' : ''}" data-filter="watchlist">Quero assistir</button><button class="chip ${filter === 'watched' ? 'selected' : ''}" data-filter="watched">Já assisti</button><button class="chip ${filter==='progress'?'selected':''}" data-filter="progress">Em andamento</button><button class="chip ${filter === 'all' ? 'selected' : ''}" data-filter="all">Todos</button></div><div id="search-results"></div>${filter==='progress'?'<section id="nuvio-library"></section>':''}<div id="library-saved" ${filter==='progress'?'hidden':''}><details class="library-filter-panel"><summary>Filtros e ordenação</summary><div class="library-controls"><label>Tipo <select id="library-type" aria-label="Tipo no catálogo"><option value="all">Filmes e séries</option><option value="movie">Filmes</option><option value="series">Séries</option></select></label><label>Ordenar <select id="library-sort" aria-label="Ordenar catálogo"><option value="saved">Ordem da lista</option><option value="name">Título A–Z</option><option value="year">Ano de lançamento</option></select></label></div></details><div class="section-heading"><h2>${filter === 'watched' ? 'Já fizeram parte da sua história' : 'Na sua lista'}</h2><div class="actions"><span class="count" id="library-count">${rows.length} ${rows.length===1?'título':'títulos'}</span><button class="link-button" id="refresh-artwork">Atualizar capas</button></div></div><p id="artwork-progress" class="muted"></p>${viewingLegend()}<div id="library-grid">${rows.length ? grid(rows) : empty()}</div><div id="library-sync-notice">${notice()}</div></div>`;
  $('#library-type').value=libraryType;$('#library-sort').value=librarySort;$('#library-type').onchange=e=>{libraryType=e.target.value;patchLibrary();};$('#library-sort').onchange=e=>{librarySort=e.target.value;patchLibrary();};
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
  wireCards(rows);updateArtworkProgress();if(filter==='progress')renderNuvioSections();
}
function updateArtworkProgress(){
  const label=$('#artwork-progress');if(!label)return;
  const rows=libraryRows(),known=rows.filter(i=>trustedArtwork(i.poster)).length;
  label.textContent=`Capas salvas: ${known} de ${rows.length}. As demais carregam ao rolar.`;
}
function patchLibrary(){
  const target=$('#library-grid');if(!target)return;
  const anchors=[...target.querySelectorAll('.poster-card')].filter(card=>{const rect=card.getBoundingClientRect();return rect.bottom>0&&rect.top<innerHeight;}).map(card=>({card,top:card.getBoundingClientRect().top}));
  const position=window.scrollY,rows=libraryRows();
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
      updateViewingRibbon(card,row);
      card.querySelector('strong').textContent=row.name;let years=card.querySelector('.watch-years');if(!years){years=document.createElement('span');years.className='watch-years';card.querySelector('strong').after(years);}years.textContent=historyYearLabel(row);card.querySelector('.fallback').textContent=row.name;card.querySelector('small').textContent=`${row.year||''} · ${titleType(row)}`;
      if(card!==next)list.insertBefore(card,next);next=card.nextElementSibling;
    }
    for(const card of existing.values())card.remove();
  }
  const count=$('#library-count');if(count)count.textContent=`${rows.length} ${rows.length===1?'título':'títulos'}`;
  const noticeArea=$('#library-sync-notice');if(noticeArea)noticeArea.innerHTML=notice();
  updateArtworkProgress();wireImages();
  const anchor=anchors.find(value=>value.card.isConnected);
  if(anchor)window.scrollBy(0,anchor.card.getBoundingClientRect().top-anchor.top);else window.scrollTo(0,position);
}
function refreshCurrentView(){
  if(tab==='profile'){renderHistorySummary();loadPeriod();return;}
  if(tab==='discover'){renderRecommendations();renderSeriesSections();}
  else if(tab==='library')patchLibrary();else if(tab==='home'){const position=window.scrollY;home();window.scrollTo(0,position);}
}
function seriesRows(){return homeSeries(items,seriesState,nuvioState,{trakt:traktState,nuvioRows:nuvioSeriesRows});}
function seriesContent(limit=Infinity){
 const rows=seriesRows();seriesResults=rows.map(row=>row.item);
 return `<div class="series-toolbar"><details><summary>Sobre o progresso</summary><p class="muted">Nuvio e Trakt podem ter perfis ou horários diferentes. Cada contagem vem da fonte indicada.</p></details><button class="secondary" data-series-refresh>Atualizar episódios</button></div>${seriesState.error?`<p class="notice">${escape(seriesState.error)}</p>`:''}${!rows.length?'<p class="muted">As séries iniciadas recebidas das suas contas aparecerão automaticamente aqui.</p>':`<div class="grid series-grid">${rows.slice(0,limit).map(({item,headline,detail,source,state})=>`<button class="poster-card series-grid-card" data-series-id="${escape(item.id)}">${poster({...item,name:titleName(item)},'',false,false)}<span class="series-card-copy">${viewingRibbon(item,state)}<strong>${escape(titleName(item))}</strong>${seriesBadges(item)}<span class="series-status">${escape(headline)}</span><small>${escape(detail)}</small>${state?.warning?`<small>${escape(state.warning)}</small>`:''}<small>Fonte: ${escape(source)}</small></span></button>`).join('')}</div>`}`;
}

function renderSeriesSections(){
  const position=window.scrollY;
  const homeSection=$('#series-home');if(homeSection){
   const rows=seriesRows();seriesResults=rows.map(row=>row.item);
   homeSection.innerHTML=rows.length?`<div class="section-heading"><div><h2>${nuvioState.active?'Suas séries':'Próximos episódios'}</h2></div><button id="see-series">Ver todas</button></div><div class="poster-rail series-rail">${rows.slice(0,12).map(({item,headline,detail,state})=>`<button class="poster-card" data-series-id="${escape(item.id)}">${poster({...item,name:titleName(item)})}<span class="home-series-copy">${viewingRibbon(item,state)}<strong>${escape(titleName(item))}</strong><span class="series-status">${escape(headline)}</span><small>${escape(detail)}</small></span></button>`).join('')}</div>`:'';
   if($('#see-series'))$('#see-series').onclick=()=>{discoveryMode='series';setTab('discover');};
  }
  const section=$('#series-discovery');if(section)section.innerHTML=seriesContent();
  refreshEpisodeManager();
  const details=$('#series-detail-state');if(details){const state=seriesState.items?.find(row=>row.id===detailItem?.id);if(detailItem?.type==='series'&&traktState.connected){const summary=seriesSummary(state);details.innerHTML=`<div class="notice"><strong>${escape(summary.headline)}</strong><p>${escape(summary.detail)}</p>${state?.error?'<p>Consulta pendente. Os dados anteriores foram preservados.</p>':''}</div>`;}else details.innerHTML='';}
  for(const button of document.querySelectorAll('[data-series-refresh]'))button.onclick=()=>{if(typeof window.CenaAndroid?.refreshSeries==='function'){window.CenaAndroid.refreshSeries();refreshNuvioEpisodes();toast('Consulta de episódios solicitada.');}else toast('A consulta de episódios usa a conexão Trakt no APK Android.');};
  for(const button of document.querySelectorAll('[data-series-id]'))button.onclick=()=>showDetail(seriesResults.find(item=>item.id===button.dataset.seriesId));
  for(const id of ['#calendar-panel','#home-calendar']){const target=$(id);if(target){mountCalendar(target,{items:seriesUniverse(items,traktState,nuvioState,seriesState),state:seriesState,nuvioActive:nuvioState.active,onOpen:showDetail,renderStatus:(item)=>viewingRibbon(item)});if(id==='#home-calendar'&&!target.querySelector('.calendar-row'))target.replaceChildren();}}
  wireImages();if(window.scrollY!==position)window.scrollTo(0,position);
}
function discover(){
  if(highlightView){const type=highlightView;const rows=highlightsResults.filter(item=>item.type===type);main.innerHTML=`<div class="discovery-list-heading"><button class="secondary" id="highlights-back" aria-label="Voltar">←</button><div><h1>${type==='movie'?'Filmes em destaque':'Séries em destaque'}</h1><p class="muted">Catálogo Cinemeta</p></div></div>${rows.length?grid(rows):'<p class="muted">Nenhum título disponível agora.</p>'}`;$('#highlights-back').onclick=()=>window.CenaBack();wireImages();return;}
  main.innerHTML=`<h1>Descobrir</h1><div class="chips"><button class="chip ${discoveryMode==='recommend'?'selected':''}" data-discovery-mode="recommend">Para você</button><button class="chip ${discoveryMode==='series'?'selected':''}" data-discovery-mode="series">Suas séries</button></div>${discoveryMode==='series'?'<section id="series-discovery"></section><section class="panel" id="calendar-panel"></section>':`<section id="discovery-highlights" aria-label="Destaques"></section><p class="muted">Novas histórias a partir do que você gosta. Abra um título para dar seu feedback.</p><details class="recommendation-explanation"><summary>Como as sugestões funcionam</summary><p class="muted">Gêneros, temas, elenco, assistidos e suas notas ajudam nas escolhas. Gostei reforça seu gosto; Não combina e Já assisti retiram o título das próximas sugestões.</p></details><div class="chips"><button class="chip ${discoveryFilter==='all'?'selected':''}" data-discovery-filter="all">Tudo</button><button class="chip ${discoveryFilter==='movie'?'selected':''}" data-discovery-filter="movie">Filmes</button><button class="chip ${discoveryFilter==='series'?'selected':''}" data-discovery-filter="series">Séries</button></div><div class="actions"><button class="secondary" id="refresh-recommendations">Mostrar outras sugestões</button></div><div id="recommendation-status" class="muted" role="status"></div><div id="recommendation-grid"></div><p class="muted">Abra uma indicação para ver detalhes e adicionar a Quero assistir. Com o Trakt conectado, ela segue para sua lista usada no Nuvio.</p>`}`;
  document.querySelectorAll('[data-discovery-mode]').forEach(button=>button.onclick=()=>{discoveryMode=button.dataset.discoveryMode;discover();});
  document.querySelectorAll('[data-discovery-filter]').forEach(button=>button.onclick=()=>{discoveryFilter=button.dataset.discoveryFilter;discover();});
  renderSeriesSections();
  if($('#refresh-recommendations'))$('#refresh-recommendations').disabled=discoveryRefreshing;
  if(discoveryMode==='recommend'){renderHighlights();loadHighlights();$('#refresh-recommendations').onclick=()=>loadRecommendations(true);renderRecommendations();if(!discoveryInfo||discoveryFingerprint!==tasteFingerprint()||Date.now()-discoveryInfo.at>=12*3600000)loadRecommendations();}
}
function renderHighlights(){
 const target=$('#discovery-highlights');if(!target)return;
 if(!highlightsResults.length){target.innerHTML=highlightsPending?'<p class="muted" role="status">Carregando destaques…</p>':'<p class="muted">Destaques indisponíveis agora. <button class="highlight-retry">Tentar novamente</button></p>';target.querySelector('.highlight-retry')?.addEventListener('click',()=>loadHighlights(true));return;}
 target.innerHTML=['movie','series'].map(type=>{const rows=highlightsResults.filter(item=>item.type===type);if(!rows.length)return '';return `<section class="highlights-section" data-catalog-type="${type}"><div class="section-heading"><h2>${type==='movie'?'Filmes em destaque':'Séries em destaque'}</h2><button data-highlight-type="${type}">Ver todos</button></div>${horizontalGrid(rows.slice(0,12))}</section>`;}).join('')+'<p class="highlight-source">Destaques do catálogo Cinemeta</p>';
 target.querySelectorAll('[data-highlight-type]').forEach(button=>button.onclick=()=>{discoveryScroll=window.scrollY;discoveryRailOffsets=[...target.querySelectorAll(".poster-rail")].map(rail=>rail.scrollLeft);highlightView=button.dataset.highlightType;discover();window.scrollTo(0,0);});wireImages();
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
  updateViewingRibbon(card,item);
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
function renderCaptureMatches(target,response,coverLines){
    captureEvidence=coverLines ? response.reading || prepareCoverReading({},coverLines,cameraReading).title || coverTitlePhrase(coverLines) : '';
    searchResults = captureMemory.prioritize(captureEvidence,response.items);
    if (coverLines && searchResults[0]?.matchScore >= .65 && (!searchResults[1] || searchResults[0].matchScore - searchResults[1].matchScore >= .04)) {
      const field = $('#scan-query');
      if (field) field.value = searchResults[0].originalName || searchResults[0].name;
    }
    const assisted = searchResults.some(item => item.suggested) || ['assisted','vision'].includes(response.mode);
    target.innerHTML = `<div class="section-heading"><h2>${assisted ? 'Possíveis correspondências' : 'Resultados'}</h2><span class="count">${searchResults.length} ${searchResults.length===1?'título':'títulos'}</span></div>${assisted && searchResults.length ? `<p class="muted">${response.mode==='vision'?'O Gemini analisou a imagem e conferi os nomes no catálogo.':'Conferi variações do texto e pistas da capa.'} Confira a imagem e o ano antes de adicionar.</p>` : ''}${searchResults.length ? `<div id="result-grid" data-capture="${Boolean(coverLines)}">${grid(searchResults)}</div>` : '<div class="empty"><p>Nenhum título encontrado. Tente o nome original ou ajuste o texto da capa.</p></div>'}`;

    wireImages();
}
async function cameraJpeg(){
 if(scanPhoto.startsWith('data:image/jpeg;base64,'))return scanPhoto;
 if(!scanPhoto.startsWith('blob:'))throw Error('Escolha a capa novamente para preparar a imagem.');
 const image=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Não consegui preparar esta imagem.'));image.src=scanPhoto;});
 const scale=Math.min(1,1024/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.82);
}
function showCameraReading(value){
 const target=$('#camera-reading');if(!target)return;
 const reading=value?.reading||value;if(!reading?.title){target.hidden=true;return;}
 const groups=[['Elenco',reading.cast],['Prêmios e publicidade',reading.awards],['Frases da capa',reading.taglines]].filter(([,rows])=>Array.isArray(rows)&&rows.length);
 target.hidden=false;target.innerHTML=`<strong>${reading.source==='layout'?'Texto em destaque':'Título lido'}: ${escape(reading.title)}</strong>${reading.subtitle?`<p>Subtítulo: ${escape(reading.subtitle)}</p>`:''}${groups.length?`<details><summary>Outros textos da capa</summary>${groups.map(([label,rows])=>`<p><strong>${label}</strong>: ${rows.map(escape).join(' · ')}</p>`).join('')}</details>`:''}`;
}
async function analyzeCameraOnline(){
 if(!onlineAI.configured()){toast('Conecte o Gemini no Perfil para analisar a capa.');setTab('connect');$('#online-ai-panel')?.scrollIntoView({block:'center'});return;}
 if(!scanPhoto){toast('Escolha ou fotografe uma capa primeiro.');return;}
 const sequence=cameraSequence,generation=++searchGeneration,status=$('#camera-ai-status'),button=$('#camera-ai-action');cameraAttempt=sequence;
 if(button)button.disabled=true;if(status)status.textContent='Enviando o recorte ao Gemini e conferindo os nomes no catálogo…';
 try{
  const image=await cameraJpeg();if(sequence!==cameraSequence)return;
  const hints=await onlineAI.identifyCover(image,cameraLines,cameraRegions);
  if(sequence!==cameraSequence||generation!==searchGeneration||tab!=='scan')return;
  const selectedReading=prepareCoverReading(hints,cameraLines,cameraReading);showCameraReading({...selectedReading.reading,title:selectedReading.title});
  const rows=await verifyCameraTitles(hints,cameraLines,{enrich:enrichCameraTitle,reading:cameraReading});
  const readTitle=selectedReading.title||rows[0]?.name||'';
  if(sequence!==cameraSequence||generation!==searchGeneration||tab!=='scan')return;
  if(rows.length){renderCaptureMatches($('#search-results'),{items:rows,mode:'vision',reading:selectedReading.title},cameraLines);if(status?.isConnected)status.textContent='Análise concluída. Confira o título, o ano e a capa antes de adicionar.';}
  else {renderCaptureMatches($('#search-results'),{items:[],mode:'vision'},cameraLines);if(status?.isConnected)status.textContent='Não consegui confirmar o título completo no catálogo. As sugestões sem concordância com a capa foram descartadas. Tente outro recorte ou ajuste o texto.';}
  if(readTitle&&$('#scan-query'))$('#scan-query').value=readTitle.slice(0,150);
 }catch(error){if(sequence===cameraSequence&&status?.isConnected)status.textContent=error.message;}
 finally{if(button?.isConnected)button.disabled=false;}
}
async function runSearch(query, coverLines = null) {
  const target = $('#search-results');
  if (!target) return;
  query = query.trim();
  if (query.length < 2) { toast('Digite pelo menos duas letras.'); return; }
  const generation = ++searchGeneration;
  target.innerHTML = '<div class="loading" role="status">Procurando sua próxima história…</div>';
  try {
    const response = coverLines && apiBase === 'local' ? { items: await identifyCover(coverLines,fetch,{enrich:enrichCameraTitle}), mode: 'assisted' } : await api(`/api/search?q=${encodeURIComponent(query)}`);
    if (generation !== searchGeneration || !target.isConnected) return;
    renderCaptureMatches(target,response,coverLines);
    if(coverLines&&(!searchResults.length||!coverTitlePhrase(coverLines)||!searchResults.some(item=>item.matchScore>=.72&&!item.partialTitle&&!item.ambiguousTitle))&&cameraAuto()&&onlineAI.configured()&&scanPhoto&&cameraAttempt!==cameraSequence){analyzeCameraOnline();return;}

    if (native && coverLines && searchResults.some(item => item.poster) && typeof window.CenaAndroid.compareCovers === 'function') {
      target.insertAdjacentHTML('beforeend', '<div id="vision-status" class="notice" role="status">Comparando as capas com IA no aparelho…</div>');
      window.CenaAndroid.compareCovers(String(generation), JSON.stringify(searchResults.filter(item => item.poster).slice(0,4).map(item => ({ id: item.id, poster: item.poster }))));
    }
  } catch (error) { if (generation === searchGeneration && target.isConnected) target.innerHTML = `<div class="error" role="alert">${escape(error.message)}</div>`; }
}
function scan() {
  main.innerHTML = `
    <section class="scan-intro scan-studio">
      <div class="scan-studio-kicker"><span class="scan-studio-dot" aria-hidden="true"></span>CENA VISION <span class="scan-kicker-divider">/</span> CAPTURA INTELIGENTE</div>
      <h1>Descubra pelo <span>olhar.</span></h1>
      <p>Aponte para uma capa de filme ou série. O CENA reconhece e encontra o título para você.</p>
      ${scanPhoto?`<div class="scan-frame"><img src="${escape(scanPhoto)}" alt="Foto da capa escolhida"></div>`:`<div class="scan-viewfinder" aria-hidden="true">
        <svg viewBox="0 0 112 84"><path d="M27 10H12v15m73-15h15v15M12 59v15h15m73-15v15H85"/><rect x="39" y="18" width="34" height="48" rx="4"/><path d="m43 52 7-8 7 6 6-10 6 8M47 57h18"/><circle cx="50" cy="33" r="3"/></svg>
        <span class="scan-sweep"></span>
      </div>`}
      <div class="scan-controls scan-studio-actions">
        <button class="primary wide scan-camera-primary" id="take-photo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="3"/></svg><span>${scanPhoto?'Fotografar novamente':'Abrir câmera'}</span></button>
        <button class="secondary wide scan-gallery-secondary" id="pick-image"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 18 6-6 3 3 3-4 4 5"/></svg><span>Galeria</span></button>
      </div>
      <p class="scan-tip">Dica: enquadre o título e evite reflexos para uma identificação mais precisa.</p>
      <div class="scan-ai-module"><div class="scan-ai-topline"><span class="scan-ai-icon" aria-hidden="true">✦</span><div><strong>Inteligência extra</strong><small>Uma segunda análise quando precisar</small></div><span class="scan-ai-online">ONLINE</span></div>
      <button class="secondary wide scan-ai-trigger" id="camera-ai-action">${onlineAI.configured()?'✧ Analisar esta capa com Gemini':'✧ Conectar Gemini para analisar capas'}</button>
      <details class="scan-ai-preferences"><summary>Opções da análise e privacidade</summary>
      <label class="camera-ai-opt"><input id="camera-ai-auto" type="checkbox" ${cameraAuto()?'checked':''}> Usar Gemini automaticamente quando a leitura local estiver incompleta</label>
      <p class="muted scan-ai-privacy">Ao usar o Gemini, o recorte desta imagem é enviado à Cloudflare e ao Google. Usa internet e a cota da sua API.</p></details><p class="muted" id="camera-ai-status" role="status"></p><div class="notice" id="camera-reading" hidden></div></div>
    </section>
    <section class="scan-manual scan-search-panel"><div class="scan-search-heading"><span class="scan-search-symbol" aria-hidden="true">⌕</span><div><strong>Já sabe o nome?</strong><p>Encontre o título direto no catálogo.</p></div></div>
      <form id="scan-search">
        <label for="scan-query">Filme ou série</label>
        <div class="search-row"><textarea id="scan-query" rows="1" placeholder="Nome do filme ou série" minlength="2" maxlength="150" required></textarea><button class="primary">Buscar</button></div>
      </form>
      <div id="detected-lines"></div>
      <div id="search-results"></div>
    </section>
    <details class="scan-help scan-info"><summary>Como o reconhecimento funciona</summary><p>${native?'Você pode fotografar, escolher um print ou usar Compartilhar → CENA. A leitura inicial e a comparação local acontecem no aparelho. O Gemini online pode analisar o recorte quando você pedir ou ativar a opção automática.':'Na prévia web, escolha ou fotografe a capa e digite o título. O reconhecimento automático está no aplicativo Android.'}</p></details>`;
  $('#camera-ai-action').onclick=analyzeCameraOnline;$('#camera-ai-auto').onchange=e=>storage.setItem('cena.camera.online.v1',JSON.stringify(e.target.checked));
  $('#take-photo').onclick = () => { cameraSequence++;if (native) window.CenaAndroid.scanCover(); else { $('#photo-input').setAttribute('capture', 'environment'); $('#photo-input').click(); } };
  $('#pick-image').onclick = () => { cameraSequence++;if (native) window.CenaAndroid.pickImage(); else { $('#photo-input').removeAttribute('capture'); $('#photo-input').click(); } };
  $('#scan-search').onsubmit = event => { event.preventDefault(); runSearch($('#scan-query').value); };
}
$('#photo-input').onchange = event => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) { toast('Escolha uma imagem de até 15 MB.'); return; }
  if (scanPhoto) URL.revokeObjectURL(scanPhoto);
  cameraSequence++;cameraReading=null;cameraRegions=[];cameraLines=[];scanPhoto = URL.createObjectURL(file);
  setTab('scan'); $('#scan-query').focus();
  event.target.value = '';
};
window.CenaNativeResult = result => {
  if (result.error) { toast(result.error); return; }
  if ($('#detail').open) $('#detail').close();
  cameraSequence++;if(scanPhoto.startsWith('blob:'))URL.revokeObjectURL(scanPhoto);scanPhoto=typeof result.image==='string'&&result.image.startsWith('data:image/jpeg;base64,')?result.image:'';
  const input = coverInput(result);cameraLines=input.lines;cameraReading=input.reading;cameraRegions=Array.isArray(result.regions)?result.regions:[];
  setTab('scan');showCameraReading(cameraReading);
  const lines = (result.lines || []).filter(line => typeof line === 'string' && line.trim().length > 2);
  detectedLines = [...new Set(lines)].slice(0, 6);
  if (detectedLines.length > 1 && input.query === lines[0]) {
    $('#detected-lines').innerHTML = `<p class="muted">O título está em outra linha? Toque para buscar:</p><div class="chips">${detectedLines.map((line, index) => `<button class="chip" data-line="${index}">${escape(line)}</button>`).join('')}</div>`;
    document.querySelectorAll('[data-line]').forEach(button => button.onclick = () => { $('#scan-query').value = detectedLines[Number(button.dataset.line)].slice(0, 150); runSearch($('#scan-query').value); });
  }
  $('#scan-query').value = input.query;
  if (input.query) { toast('Buscando o título completo e as pistas da capa…'); runSearch(input.query, input.lines); }
  else {toast('Não encontrei texto. Use Analisar esta capa com Gemini ou digite o título.');if(cameraAuto()&&onlineAI.configured()&&scanPhoto)analyzeCameraOnline();}
};
window.CenaVisualResult = result => {
  if (String(result.requestId) !== String(searchGeneration)) return;
  const status = $('#vision-status');
  if (!status) return;
  if (result.status === 'ok' && Array.isArray(result.scores) && result.scores.length) {
    searchResults = captureMemory.prioritize(captureEvidence,rankWithVision(searchResults,result.scores));
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

async function save(item, status = 'watchlist', capture = null) {
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
    showDetail(item,false,capture); refreshCurrentView();return true;
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
let synopsisSerial=0;
const synopsisRequests=new Map(), synopsisTranslations=new Map();
window.CenaSynopsisTranslation = result => synopsisRequests.get(String(result?.requestId))?.(result);

function translateSynopsis(text) {
  if(synopsisTranslations.has(text))return synopsisTranslations.get(text);
  const id=String(++synopsisSerial);
  const promise=new Promise(resolve=>{
    const timer=setTimeout(()=>complete(null),120000);
    function complete(result){
      clearTimeout(timer);synopsisRequests.delete(id);
      const synopsis=typeof result?.synopsis==='string' ? result.synopsis.trim() : '';
      resolve(synopsis && ['original','translated'].includes(result.status) ? {synopsis,status:result.status} : null);
    }
    synopsisRequests.set(id,complete);
    try{window.CenaAndroid.translateCatalogSynopsis(id,text);}catch{complete(null);}
  });
  if(synopsisTranslations.size>=60)synopsisTranslations.delete(synopsisTranslations.keys().next().value);
  synopsisTranslations.set(text,promise);
  promise.then(result=>{if(!result && synopsisTranslations.get(text)===promise)synopsisTranslations.delete(text);});
  return promise;
}

function mountSynopsis(item, awaitingDetails=false) {
  const synopsis=$('#detail-synopsis'),expand=$('#synopsis-expand'),status=$('#synopsis-status'),retry=$('#synopsis-retry');
  const source=String(item.description||item.plot||'').trim().slice(0,4000);
  const localized=String(item.portugueseSynopsis||'').trim();
  function show(text, credit=''){
    synopsis.textContent=text;
    synopsis.hidden=!text;
    expand.hidden=text.length<=160;
    status.textContent=credit;
  }
  expand.onclick=()=>{
    const expanded=expand.getAttribute('aria-expanded')==='true';
    synopsis.classList.toggle('synopsis-clamp',expanded);
    expand.setAttribute('aria-expanded',String(!expanded));
    expand.textContent=expanded?'Ler sinopse completa':'Recolher sinopse';
  };
  if(localized){show(localized);return;}
  if(awaitingDetails){show('','Buscando a sinopse…');return;}
  if(!source){show('Sem sinopse no catálogo.');return;}
  if(typeof window.CenaAndroid?.translateCatalogSynopsis!=='function'){show(source);return;}
  retry.onclick=async()=>{
    retry.hidden=true;
    expand.setAttribute('aria-expanded','false');
    expand.textContent='Ler sinopse completa';
    synopsis.classList.add('synopsis-clamp');
    show('','Preparando a tradução. O primeiro uso pode baixar um modelo.');
    const result=await translateSynopsis(source);
    if(!synopsis.isConnected || !$('#detail').open)return;
    if(result)show(result.synopsis,result.status==='translated'?'Tradução automática do Google':'');
    else{
      show(source,'Tradução indisponível. Texto original do catálogo.');
      retry.hidden=false;
    }
  };
  retry.click();
}

let librarySendRequest=0,librarySendPending=null;
function finishLibrarySend(service,result){
 const pending=librarySendPending;
 if(!pending||pending.service!==service||pending.id!==result.requestId)return;
 librarySendPending=null;
 if(pending.button.isConnected)pending.button.disabled=false;
 const message=result.ok?(result.existing?'Já está na biblioteca':'Adicionado à biblioteca')+' do '+service+'.':result.error||'Não consegui confirmar o envio ao '+service+'.';
 if(pending.status.isConnected)pending.status.textContent=message;
 toast(message);
}
window.CenaNuvioLibraryResult=result=>finishLibrarySend('Nuvio',result);
window.CenaStremioLibraryResult=result=>finishLibrarySend('Stremio',result);
let copyRequest=0,copyBusy=false,copyPreview=null,copyMessage='',copyImportQueued=false,copyImportAttempt=0;
function updateCopyHistory(previous,state){
 if(previous.scope!==state.scope||previous.lastImport!==state.lastImport||previous.connected!==state.connected||state.importing){copyPreview=null;if(!copyBusy)copyMessage='';}
 if(state.importing||previous.lastImport!==state.lastImport||previous.error!==state.error||!state.connected)copyImportQueued=false;
 mountNuvioCopy($('#nuvio-copy'));
}
function mountNuvioCopy(target){
 const bridge=window.CenaAndroid;
 if(!target||typeof bridge?.previewNuvioCopy!=='function'||typeof bridge.applyNuvioCopy!=='function'){if(target)target.hidden=true;return;}
 const ready=traktState.connected&&nuvioState.active&&Boolean(nuvioState.scope);
 const preview=copyPreview;
 const importing=Boolean(historyState.importing||copyImportQueued);
 const imported=Boolean(historyState.connected&&Number(historyState.lastImport)>0);
 const canImport=traktState.connected&&typeof bridge.importHistory==='function'&&!importing&&!copyBusy;
 const canPreview=ready&&imported&&!importing&&!copyBusy;
 target.innerHTML=`<h2>Copiar do Trakt para o Nuvio</h2><p>Copie a lista Quero assistir e as marcações de filmes e episódios vistos para o perfil Nuvio selecionado.</p>
 ${ready?'':'<p class="muted">Conecte o Trakt e selecione um perfil do Nuvio para usar a cópia.</p>'}
 <p><strong>1. Importar histórico do Trakt</strong></p>
 <p class="muted" role="status">${!traktState.connected?'Conecte sua conta Trakt acima.':importing?'Importando histórico… '+(Number(historyState.processed)||0)+' registros lidos.':imported?'Última importação: '+new Date(historyState.lastImport).toLocaleString('pt-BR'):'Importe o histórico antes de gerar a prévia.'}</p>
 ${historyState.error?'<p class="error" role="alert">'+escape(historyState.error)+'</p>':''}
 ${imported&&historyState.coverage!=='complete'?'<p class="notice">A cobertura do histórico é parcial ou não confirmada.</p>':''}
 <button class="primary" id="nuvio-copy-import" ${canImport?'':'disabled'}>${importing?'Importando…':imported?'Atualizar histórico do Trakt':'Importar histórico do Trakt'}</button>
 <p><strong>2. Gerar prévia</strong></p>
 <button class="secondary" id="nuvio-copy-preview" ${canPreview?'':'disabled'}>Gerar prévia</button>
 <p><strong>3. Transferir para o Nuvio</strong></p>
 ${preview?'':'<button class="primary" id="nuvio-copy-confirm" disabled>Transferir para o Nuvio</button>'}
 ${preview?`<p>Perfil de destino: <strong>${escape(preview.profile||'Nuvio')}</strong></p>
 <ul><li>${Number(preview.titles)} títulos para adicionar à biblioteca</li><li>${Number(preview.movies)} filmes a marcar como vistos</li>
 <li>${Number(preview.episodes)} episódios a marcar como vistos</li><li>${Number(preview.existing)} itens já presentes · ${Number(preview.skipped)} registros pulados</li></ul>
 ${preview.partial?'<p class="notice">O histórico importado do Trakt tem cobertura parcial ou não confirmada.</p>':''}
 <button class="primary" id="nuvio-copy-confirm" ${canPreview&&(preview.titles||preview.movies||preview.episodes)?'':'disabled'}>Transferir para o Nuvio</button>`:''}
 <p class="muted" role="status">${escape(copyMessage)}</p>`;
 target.querySelector('#nuvio-copy-import').onclick=()=>{
  if(!canImport)return;
  copyPreview=null;copyMessage='';copyImportQueued=true;const attempt=++copyImportAttempt;
  mountNuvioCopy(target);
  try{bridge.importHistory();bridge.historyState?.();}
  catch(error){copyImportQueued=false;copyMessage='Não consegui iniciar a importação. Tente novamente.';mountNuvioCopy(target);return;}
  setTimeout(()=>{if(attempt!==copyImportAttempt||!copyImportQueued)return;copyImportQueued=false;copyMessage='Importação solicitada. Confira o andamento ou tente novamente.';bridge.historyState?.();mountNuvioCopy($('#nuvio-copy'));},30000);
 };
 target.querySelector('#nuvio-copy-preview').onclick=()=>{
  if(!canPreview)return;
  copyPreview=null;copyBusy=true;copyMessage='Conferindo a biblioteca e o histórico…';
  mountNuvioCopy(target);bridge.previewNuvioCopy(++copyRequest);
 };
 const confirm=target.querySelector('#nuvio-copy-confirm');
 if(confirm&&preview)confirm.onclick=()=>{
  if(!canPreview)return;
  copyBusy=true;copyPreview=null;copyMessage='Copiando para o perfil Nuvio…';
  mountNuvioCopy(target);bridge.applyNuvioCopy(++copyRequest,preview.planId);
 };
}
window.CenaNuvioCopyResult=result=>{
 if(result.requestId!==copyRequest)return;
 copyBusy=false;
 copyPreview=result.ok&&result.planId?result:null;
 copyMessage=result.ok?(result.planId?'Confira os números antes de confirmar.':result.titles+' títulos e '+result.watched+' marcações confirmados no Nuvio. '+result.skipped+' registros pulados.'):result.error;
 mountNuvioCopy($('#nuvio-copy'));
};
function mountDirectSend(after,item){
 const bridge=window.CenaAndroid;
 const destinations=[
  {name:'Nuvio',scope:nuvioState.active?nuvioState.scope:'',label:nuvioState.profileName,send:bridge?.sendNuvioLibraryTitle},
  {name:'Stremio',scope:stremioConnection.connected?stremioConnection.scope:'',label:stremioConnection.account,send:bridge?.sendStremioLibraryTitle},
 ].filter(option=>typeof option.send==='function');
 if(!destinations.length||!/^tt[0-9]{5,12}$/.test(item.id))return;
 const details=document.createElement('details');
 details.className='direct-send';
 const summary=document.createElement('summary');
 summary.textContent='Mandar direto';
 const status=document.createElement('p');
 status.className='muted';status.setAttribute('role','status');
 details.append(summary);
 for(const destination of destinations){
  const button=document.createElement('button');
  button.type='button';button.className='secondary';
  button.textContent=destination.scope?(destination.label?destination.name+' · '+destination.label:destination.name):'Conectar '+destination.name;
  button.onclick=()=>{
   if(!destination.scope){$('#detail').close();setTab('connect');$(destination.name==='Nuvio'?'#nuvio-panel':'#stremio-panel')?.scrollIntoView();return;}
   if(librarySendPending){toast('Aguarde o envio anterior.');return;}
   const id=++librarySendRequest;
   button.disabled=true;status.textContent='Enviando ao '+destination.name+'…';
   librarySendPending={id,service:destination.name,button,status};
   try{destination.send.call(bridge,id,JSON.stringify({id:item.id,type:item.type,name:String(item.name||'').slice(0,200),year:String(item.year||'').slice(0,30),scope:destination.scope}));}
   catch{finishLibrarySend(destination.name,{requestId:id,ok:false});}
  };
  details.append(button);
 }
 details.append(status);after.after(details);
}
const manualEpisodeKey='cena.manual-episodes.v1';
let episodeView=null,episodeRequest=0;
const episodePending=new Map();
function episodeScope(){return 'n:'+String(nuvioState.active?nuvioState.scope||'':'')+'|t:'+String(traktState.connected?traktState.account||traktState.username||'':'');}
function manualEpisodes(){try{return JSON.parse(storage.getItem(manualEpisodeKey)||'{}')||{};}catch{return {};}}
function episodeIdentity(item,episode){return episodeScope()+'|'+item.id+'|'+episode.season+':'+episode.episode;}
function remoteEpisodeSources(item,episode){
 const key=episode.season+':'+episode.episode,out=[];
 if(nuvioState.active&&(nuvioState.series||[]).some(show=>show.id===item.id&&(show.seen||[]).includes(key)))out.push('Nuvio');
 if(traktState.connected&&(traktState.progress||[]).some(show=>show.id===item.id&&(show.seen||[]).includes(key)))out.push('Trakt');
 if(traktState.connected&&(recentHistoryRows||[]).some(row=>row.id===item.id&&row.kind==='episode'&&Number(row.season)===episode.season&&Number(row.episode)===episode.episode)&&!out.includes('Trakt'))out.push('Trakt');
 return out;
}
function mountEpisodeManager(item){
 const target=$('#episode-manager');if(!target)return;
 const same=episodeView?.id===item.id&&episodeView?.scope===episodeScope();
 if(!same)episodeView={id:item.id,scope:episodeScope(),item,videos:null,season:null,open:false,loading:false,error:''};
 else episodeView.item=item;
 refreshEpisodeManager();
}
function refreshEpisodeManager(){
 const target=$('#episode-manager'),view=episodeView;
 if(!target||!view||detailItem?.id!==view.id)return;
 if(view.scope!==episodeScope()){mountEpisodeManager(detailItem);return;}
 const old=target.querySelector('details');if(old)view.open=old.open;
 const all=manualEpisodes(),videos=view.videos||[];
 const seasons=[...new Set(videos.map(e=>e.season))];
 if(!seasons.includes(view.season))view.season=seasons.find(s=>s>0)||seasons[0];
 const seen=e=>remoteEpisodeSources(view.item,e).length||Boolean(all[episodeIdentity(view.item,e)]);
 const rows=videos.filter(e=>e.season===view.season);
 const count=videos.filter(seen).length;
 target.innerHTML=`<details class="episode-manager" ${view.open?'open':''}><summary><span><strong>Temporadas e episódios</strong><small>${videos.length?count+' de '+videos.length+' marcados como vistos':'Veja e marque episódios individualmente'}</small></span><span aria-hidden="true">›</span></summary><div class="episode-manager-body">${view.loading?'<p role="status">Carregando episódios…</p>':view.error?'<p class="error">'+escape(view.error)+'</p><button id="episode-retry" class="secondary">Tentar novamente</button>':videos.length?`<label for="episode-season">Temporada</label><select id="episode-season">${seasons.map(s=>`<option value="${s}" ${s===view.season?'selected':''}>${s===0?'Especiais':'Temporada '+s}</option>`).join('')}</select><p class="muted">${rows.filter(seen).length} de ${rows.length} episódios vistos nesta temporada. Marcação local não altera o histórico remoto sem sua confirmação.</p><div class="episode-list">${rows.map(e=>{const key=episodeIdentity(view.item,e),record=all[key],sources=remoteEpisodeSources(view.item,e),future=Date.parse(e.released)>Date.now(),busy=episodePending.has(key);return `<article class="episode-row"><div class="episode-main"><span class="episode-number">E${String(e.episode).padStart(2,'0')}</span><div><strong>${escape(e.title||'Episódio '+e.episode)}</strong><small>${escape([...sources,...(record?['CENA']:[])].join(' + ')|| (future?'Ainda não lançado':'Não marcado'))}</small></div><button class="episode-check" data-episode="${e.episode}" aria-pressed="${Boolean(record||sources.length)}" ${busy||future||sources.length?'disabled':''}>${record||sources.length?'✓':'Marcar visto'}</button></div>${record?`<div class="episode-sync-actions">${nuvioState.active&&nuvioState.scope&&typeof window.CenaAndroid?.markNuvioEpisode==='function'&&!sources.includes('Nuvio')&&!record.nuvio?'<button class="secondary" data-send-episode="'+e.episode+'" data-destination="Nuvio" '+(busy?'disabled':'')+'>Enviar ao Nuvio</button>':''}${traktState.connected&&traktState.account&&typeof window.CenaAndroid?.markTraktEpisode==='function'&&!sources.includes('Trakt')&&!record.trakt?'<button class="secondary" data-send-episode="'+e.episode+'" data-destination="Trakt" '+(busy?'disabled':'')+'>Enviar ao Trakt</button>':''}<small role="status">${escape(record.message||'Salvo neste aparelho')}</small></div>`:''}</article>`;}).join('')}</div>`:'<p>Abra para consultar o catálogo.</p>'}</div></details>`;
 const details=target.querySelector('details');details.ontoggle=()=>{view.open=details.open;if(view.open&&!view.videos&&!view.loading&&!view.error)loadEpisodeCatalog(view);};
 const retry=target.querySelector('#episode-retry');if(retry)retry.onclick=()=>loadEpisodeCatalog(view);
 const season=target.querySelector('#episode-season');if(season)season.onchange=()=>{view.season=Number(season.value);refreshEpisodeManager();};
 for(const button of target.querySelectorAll('[data-episode]'))button.onclick=()=>{const e=rows.find(e=>e.episode===Number(button.dataset.episode)),key=episodeIdentity(view.item,e),data=manualEpisodes();if(data[key])delete data[key];else data[key]={at:Date.now()};storage.setItem(manualEpisodeKey,JSON.stringify(data));refreshEpisodeManager();toast(data[key]?'Episódio marcado no CENA.':'Marcação local removida.');};
 for(const button of target.querySelectorAll('[data-send-episode]'))button.onclick=()=>{const e=rows.find(e=>e.episode===Number(button.dataset.sendEpisode)),key=episodeIdentity(view.item,e),dest=button.dataset.destination;const request=++episodeRequest;episodePending.set(key,{request,dest});refreshEpisodeManager();const payload=JSON.stringify({id:view.id,name:view.item.name,season:e.season,episode:e.episode,scope:dest==='Nuvio'?nuvioState.scope:traktState.account});if(dest==='Nuvio')window.CenaAndroid.markNuvioEpisode(request,payload);else window.CenaAndroid.markTraktEpisode(request,payload);};
}
async function loadEpisodeCatalog(view){
 view.loading=true;view.error='';refreshEpisodeManager();
 try{const catalog=await nuvioSeriesEngine.catalog(view.id);const unique=new Map();for(const row of catalog.videos){const season=Number(row.season),episode=Number(row.episode);if(Number.isInteger(season)&&season>=0&&Number.isInteger(episode)&&episode>0)unique.set(season+':'+episode,{...row,season,episode});}view.videos=[...unique.values()].sort((a,b)=>a.season-b.season||a.episode-b.episode);if(!view.videos.length)throw Error('Catálogo sem episódios confirmados.');}catch{view.error='Não consegui consultar os episódios. Confira a conexão e tente novamente.';}finally{view.loading=false;if(episodeView===view)refreshEpisodeManager();}
}
window.CenaManualEpisodeResult=result=>{
 for(const [key,pending] of episodePending){if(pending.request!==result.requestId)continue;episodePending.delete(key);const data=manualEpisodes(),record=data[key];if(record){if(result.ok)record[pending.dest.toLowerCase()]=true;record.message=result.ok?'Confirmado no '+pending.dest:result.error||'Envio não confirmado. Tente novamente.';storage.setItem(manualEpisodeKey,JSON.stringify(data));}refreshEpisodeManager();break;}
};
function showDetail(item, enriched = false, capture = null) {
  if (!item) return;
  localAI.cancel();similarTicket++;
  detailItem = item;
  if(titleArtwork(item,item.poster))persistArtwork(item,item.poster);
  const saved = items.find(i => i.id === item.id);
  const traktReady = apiBase === 'local' && traktState.connected && typeof window.CenaAndroid?.queueTrakt === 'function';

  const captureReview = capture ? `<section class="capture-review" aria-label="Resultado da captura">
    <h3>Por que este título?</h3><p>${capture.reading ? `Texto usado na busca <strong>${escape(capture.reading)}</strong>. ` : ''}${item.aiAssisted ? 'A análise da imagem sugeriu este título para conferência no catálogo.' : 'Este título apareceu na busca pelas pistas da capa.'} Confira o ano e o cartaz.</p>
    <h3>A identificação está correta?</h3><div class="actions"><button class="secondary" id="capture-correct" aria-pressed="${Boolean(capture.confirmed)}">Correto</button><button class="secondary" id="capture-wrong">Errado</button></div>
    <p class="muted" id="capture-verdict" role="status">${capture.remembered ? 'Confirmação guardada neste aparelho.' : capture.confirmed ? 'Identificação confirmada neste resultado.' : ''}</p>
  </section>` : '';
  const directSendAvailable=typeof window.CenaAndroid?.sendNuvioLibraryTitle==='function'||typeof window.CenaAndroid?.sendStremioLibraryTitle==='function';
  const viaTrakt=capture&&traktReady&&!directSendAvailable;
  const addLabel=viaTrakt?(saved?.status==='watchlist'?'Enviar ao Nuvio via Trakt':'Adicionar ao Nuvio via Trakt'):saved?.status==='watchlist'?'✓ Está na minha lista':'+ Quero assistir';
  const syncHint=viaTrakt?`<p class="muted capture-sync-tip">O CENA envia ao Trakt. No Nuvio, use a mesma conta Trakt como fonte da biblioteca.</p>`:'';
  $('#detail-content').innerHTML = `<div class="detail-backdrop" id="detail-backdrop" aria-hidden="true"></div><div class="detail-top">${poster(item)}<div>${viewingRibbon(item)}<div class="eyebrow">${titleType(item)}</div><h2>${escape(item.name)}</h2>${scoreMarkup(item)}<span class="meta">${escape(item.year)}${!capture && item.genre ? ` · ${escape(item.genre)}` : ''}</span></div></div><div class="detail-body"><section class="detail-summary" aria-label="Sinopse"><h3>Sinopse</h3><p id="detail-synopsis" class="synopsis-clamp" hidden></p><p class="muted" id="synopsis-status" role="status"></p><button class="link-button" id="synopsis-expand" aria-expanded="false" hidden>Ler sinopse completa</button><button class="link-button" id="synopsis-retry" hidden>Tentar traduzir novamente</button></section>${captureReview}<button class="primary wide" id="add-title">${addLabel}</button>${syncHint}<div id="detail-providers" data-stream-key="${escape(item.type+':'+item.id)}" aria-live="polite"></div><p id="detail-loading" class="muted" role="status">${enriched ? '' : 'Buscando sinopse e ficha técnica…'}</p>${item.runtime ? `<p><strong>Duração:</strong> ${escape(item.runtime)}</p>` : ''}${item.directors?.length ? `<p><strong>Direção:</strong> ${escape(item.directors.join(', '))}</p>` : ''}${item.cast?.length ? `<p><strong>Elenco:</strong> ${escape(item.cast.slice(0,12).join(', '))}</p>` : ''}${item.detailError ? `<p role="alert">${escape(item.detailError)}</p>` : ''}${saved ? `<div class="status-label">✓ ${saved.status === 'watched' ? 'Você já assistiu' : 'Na sua lista Quero assistir'}</div>` : ''}<div id="title-watch-history"></div><div id="series-detail-state"></div>${item.type==='series'?'<section id="episode-manager" class="detail-section"></section>':''}<p class="muted" id="trakt-item-state">${escape(traktItemLabel(item,traktState))}</p>${saved?.watchedSource === "Nuvio" ? '<p class="muted">✓ Assistido confirmado no histórico Nuvio.</p>' : ''}${saved?.watchedSource === "Trakt" ? '<p class="muted">✓ Assistido confirmado no histórico Trakt.</p>' : ''}<div class="actions"><button class="secondary" id="rate-title">☆ Avaliar</button><button class="secondary" id="share-title">↗ Criar Story</button>${saved&&item.type!=='series' ? `<button class="secondary" id="mark-status">${saved.status === 'watched' ? '↺ Rever depois' : '✓ Já assisti'}</button>` : ''}</div>${saved ? '<button class="link-button" id="remove-title">Remover do catálogo</button>' : ''}<p class="muted">${apiBase === 'local' ? 'Sua lista fica salva neste aparelho.' : 'A lista foi atualizada no servidor. Atualize o catálogo no player.'}</p>${item.sourceUrl ? `<p class="muted">Metadados: <a href="${escape(item.sourceUrl)}" target="_blank" rel="noreferrer">${escape(item.source || "Catálogo")}</a></p>` : ''}<button class="secondary wide" id="similar-titles">✧ Ver semelhantes</button><div id="similar-panel"></div><section class="detail-section" id="title-feedback"></section><section class="detail-section" id="title-collections"></section><div id="story-editor"></div></div>`;
  mountDirectSend($('#add-title'),item);
  $('#add-title').onclick = () => {
    if(saved?.status !== 'watchlist') return save(item,'watchlist',capture);
    if(viaTrakt){queueTrakt(item,'add');toast('Envio para a lista do Trakt solicitado.');return;}
    toast('Este título já está na sua lista.');
  };
  if(capture){
    $('#capture-correct').onclick = event => {
      capture.confirmed=true;
      event.currentTarget.setAttribute('aria-pressed','true');
      let remembered=false;
      try{remembered=captureMemory.remember(capture.reading,item);}catch{}
      capture.remembered=remembered;
      $('#capture-verdict').textContent=remembered?'Confirmação guardada neste aparelho.':'Identificação confirmada neste resultado.';
    };
    $('#capture-wrong').onclick = () => {
      const results = $('#result-grid[data-capture="true"]');
      if(results){
        searchResults=searchResults.filter(row=>row.id!==item.id||row.type!==item.type);
        results.innerHTML=searchResults.length ? grid(searchResults) : '<p class="muted">Nenhuma outra opção. Ajuste o título ou escolha outra imagem.</p>';
        const count=$('#search-results .count');
        if(count)count.textContent=`${searchResults.length} ${searchResults.length===1?'título':'títulos'}`;
        wireImages();
      }
      $('#detail').close();
      (results?.querySelector('button') || $('#scan-query'))?.focus();
      toast('Correspondência descartada.');
    };
  }
  if ($('#mark-status')) $('#mark-status').onclick = () => save(item, saved.status === 'watched' ? 'watchlist' : 'watched', capture);
  if ($('#remove-title')) $('#remove-title').onclick = () => remove(item);
  $('#share-title').onclick = () => story(item);
  $('#rate-title').onclick=async()=>{await story(item);$('#story-rating')?.focus();};

  const backdrop=$('#detail-backdrop');if(titleArtwork(item,item.poster)){const image=new Image();image.src=titleArtwork(item,item.poster);image.alt='';backdrop.append(image);}
  mountTitleCollections($('#title-collections'),{storage,item,toast});
  mountFeedback($('#title-feedback'),{storage,item,toast,onSeen:async value=>{if(value.type==='series')throw Error('Para séries, registre os episódios no player ou use os controles de progresso.');if(!await save(value,'watched'))throw Error('Não consegui marcar este filme. Tente novamente.');},onChange:()=>{const values=readFeedback(storage);discoveryResults=discoveryResults.filter(row=>!['dislike','seen'].includes(values[row.type+':'+row.id]?.value));discoveryInfo=null;discoveryFingerprint='';if(tab==='discover')renderRecommendations();if(tab==='home')renderHomeRecommendations();}});

  $('#similar-titles').onclick=()=>findSimilar(item);
  renderSeriesSections();renderTitleHistory(item);if(item.type==='series')mountEpisodeManager(item);
  if(typeof window.CenaAndroid?.historyState==='function')window.CenaAndroid.historyState();
  wireImages();
  if (!$('#detail').open) { $('#detail').showModal(); $('#detail').scrollTop = 0; }
  mountSynopsis(item,!enriched);
  if (!enriched) getTitleDetails(item).then(details => {
    if ($('#detail').open && detailItem === item) {
      if($('#story-canvas')||$('#similar-panel')?.childNodes.length||$('#episode-manager details[open]')||document.activeElement?.closest('#title-collections,#title-feedback,#episode-manager')) { const status=$('#detail-loading'); if(status) status.textContent=''; mountSynopsis(details); }
      else showDetail(details, true, capture);
    }
  }).catch(() => { const status = $('#detail-loading'); if (status && detailItem === item) {status.textContent = 'Não consegui carregar a ficha completa.';mountSynopsis(item);} });
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
function connect(remoteSettings=false) {
  if (!remoteSettings&&(native||apiBase==='local')) { localConnection(); return; }
  const connected = Boolean(connection);
  main.innerHTML = `<div class="eyebrow">SUA LISTA, EM MAIS TELAS</div><h1>Perfil</h1><p class="muted">O CENA publica sua lista como um complemento de catálogo, separado da biblioteca interna do player.</p><div class="panel"><h2>Servidor do CENA</h2><p>Use o mesmo servidor no celular e no player. Para outro aparelho, o endereço precisa ser acessível pela rede.</p><form id="server-form"><label for="server-url">Endereço do servidor</label><input id="server-url" type="url" value="${escape(apiBase)}" placeholder="https://seu-servidor.exemplo" required><div class="actions"><button class="secondary" type="submit">${connected ? 'Atualizar conexão' : 'Conectar servidor'}</button></div></form></div><div class="panel"><h2>CENA · Quero assistir</h2>${connected ? '<p class="connection-status">Lista conectada ao servidor</p>' : '<p>Crie sua lista para gerar o link do complemento.</p>'}${connected ? `<label for="manifest-url">Link do complemento — acesso somente à leitura</label><textarea class="url-field" id="manifest-url" readonly>${escape(connection.manifestUrl)}</textarea><div class="actions"><button class="primary" id="copy-addon">Copiar link</button><button class="secondary" id="refresh-list">Atualizar lista</button></div>` : '<button class="primary" id="create-list">Criar minha lista</button>'}</div>${config && !config.publicConfigured ? '<div class="notice">Servidor em modo local. Configure PUBLIC_BASE_URL com um endereço HTTPS acessível para instalar o complemento em outro aparelho.</div>' : ''}<div class="step"><b>1</b><span>No Stremio, abra Complementos e instale pelo link do manifest acima.</span></div><div class="step"><b>2</b><span>No Nuvio, tente instalar o mesmo manifest na área de complementos. A compatibilidade ainda precisa ser testada no aparelho.</span></div><div class="step"><b>3</b><span>Procure “CENA · Filmes para assistir” ou “CENA · Séries para assistir”. Após uma alteração, atualize o catálogo no player.</span></div><div class="notice">Esta versão sincroniza o conteúdo do catálogo. O que você assistir no player ainda não volta automaticamente para o CENA.</div>${connected ? '<div class="panel"><h2>Guardar acesso à lista</h2><p>O código abaixo permite editar sua lista em outro dispositivo. Guarde em local privado. Não compartilhe com o player.</p><button class="secondary" id="export-connection">Copiar código de recuperação</button></div>' : ''}<div class="panel"><h2>Já tem uma lista?</h2><form id="restore-form"><label for="restore-code">Código de recuperação</label><textarea id="restore-code" class="url-field" placeholder="Cole seu código privado aqui" required></textarea><div class="actions"><button class="secondary" type="submit">Recuperar lista</button></div></form></div><p class="attribution">Metadados e imagens: TMDB. Este produto usa a API do TMDB, mas não é endossado ou certificado pelo TMDB. <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">Sobre o TMDB</a></p>`;
  $('#server-form').onsubmit = async event => {
    event.preventDefault();
    const previous = { apiBase, config, connection };
    try {
      const next = validBase($('#server-url').value.trim());
      if (connection && next !== apiBase) throw Error('Para trocar de servidor, recupere uma lista criada nele usando o código privado.');
      apiBase = next; config = await api('/api/config');
      await ensureConnection(); persist(); toast('Servidor conectado.'); connect(true);
    } catch (error) { ({ apiBase, config, connection } = previous); toast(error.message); }
  };
  if ($('#create-list')) $('#create-list').onclick = async () => { try { await ensureConnection(); connect(true); } catch (error) { toast(error.message); } };
  if ($('#copy-addon')) $('#copy-addon').onclick = () => copy(connection.manifestUrl);
  if ($('#export-connection')) $('#export-connection').onclick = () => copy(JSON.stringify({ apiBase, id: connection.id, writeToken: connection.writeToken }));
  if ($('#refresh-list')) $('#refresh-list').onclick = async () => { try { await refresh(); connect(true); toast('Lista atualizada.'); } catch (error) { toast(error.message); } };
  $('#restore-form').onsubmit = async event => {
    event.preventDefault();
    const previous = { apiBase, connection, config, items };
    try {
      const input = JSON.parse($('#restore-code').value);
      if (!/^[a-f0-9]{24}$/.test(input.id) || !/^[\w-]{32}$/.test(input.writeToken)) throw Error('Código de recuperação inválido.');
      apiBase = validBase(input.apiBase); connection = { id: input.id, writeToken: input.writeToken };
      await refresh(); persist(); connect(true); toast('Lista recuperada.');
    } catch (error) { ({ apiBase, connection, config, items } = previous); toast(error.message); }
  };
}
async function refresh() {
  config = await api('/api/config');
  if(apiBase==='local' && !connection) { connection=await api('/api/libraries',{method:'POST'}); persist(); }
  if (connection) { const result = await api(`/api/libraries/${connection.id}`); connection = { id: result.id, writeToken: result.writeToken, manifestUrl: result.manifestUrl }; items = result.items; persist(); }
}

function renderTraktPanel() {
  const panel = $('#trakt-panel');
  if (!panel || panel.querySelector('#trakt-client-id:focus')) return;
  const supported = native && typeof window.CenaAndroid.connectTrakt === 'function';
  const pending = traktState.pending?.length || 0;
  const accountLimit=/limite da conta Trakt/i.test(traktState.error||'');
  panel.innerHTML = `<h2>${traktState.connected ? `✓ Trakt conectado${traktState.username ? ` · ${escape(traktState.username)}` : ''}` : 'Conectar sua conta Trakt'}</h2>
    ${!supported ? '<p>O login e a conexão protegida estão disponíveis no APK Android.</p>' : !traktState.configured ? `<p>Falta o cadastro único da integração CENA no Trakt. Depois, você autoriza sua conta por um código no navegador do celular.</p><details><summary>Configurar integração CENA</summary><p>Cadastre CENA em <a href="https://developer.trakt.tv/docs/create-an-app" target="_blank" rel="noreferrer">Trakt Developer</a> e copie somente o Client ID público. Não informe Client Secret, senha ou token.</p><form id="trakt-config-form"><label for="trakt-client-id">Client ID público</label><input id="trakt-client-id" minlength="20" maxlength="200" autocomplete="off" required><button class="primary" type="submit">Salvar cadastro</button></form></details>` : traktState.connected ? `<p>${pending ? `${pending} ${pending===1?'alteração aguarda':'alterações aguardam'} envio.` : 'Nenhum envio pendente.'}</p><p class="muted">${traktState.lastSync ? `Última sincronização: ${new Date(traktState.lastSync).toLocaleString('pt-BR')}` : 'Aguardando a primeira sincronização.'}</p><div class="actions"><button class="primary" id="trakt-sync">${traktState.error ? 'Tentar novamente' : 'Sincronizar agora'}</button><button class="secondary" id="trakt-send-list">Enviar Quero assistir</button><button class="secondary" id="trakt-disconnect">Desconectar</button></div>` : traktState.userCode ? `<p>Seu código de autorização:</p><p class="auth-code" id="trakt-user-code">${escape(traktState.userCode)}</p><p>Copie o código, abra o Trakt e autorize o CENA. Volte ao app: a conexão será conferida até o código expirar.</p><div class="actions"><button class="secondary" id="trakt-copy-code">Copiar código</button><button class="primary" id="trakt-authorize">Abrir Trakt para autorizar</button></div>` : `<p>Ao autorizar, sua lista Quero assistir será enviada ao Trakt. Os filmes já assistidos no Trakt poderão receber o check no CENA.</p><button class="primary wide" id="trakt-connect">Conectar e enviar Quero assistir</button>`}
    ${traktState.error ? `<p class="error" role="alert">${accountLimit?'O Trakt recusou o envio por um limite da sua conta. Os títulos continuam salvos no CENA e as alterações ficam na fila. Se a lista Quero assistir do Trakt estiver cheia, libere espaço no Trakt e toque em Tentar novamente.':escape(traktState.error)}</p>` : ''}`;
  if($('#trakt-config-form')) $('#trakt-config-form').onsubmit = event => { event.preventDefault(); window.CenaAndroid.configureTrakt($('#trakt-client-id').value.trim()); };
  if($('#trakt-connect')) $('#trakt-connect').onclick=()=>window.CenaAndroid.connectTrakt();
  if($('#trakt-copy-code')) $('#trakt-copy-code').onclick=()=>copy(traktState.userCode);
  if($('#trakt-authorize')) $('#trakt-authorize').onclick=()=>window.CenaAndroid.openTraktVerification();
  if($('#trakt-sync')) $('#trakt-sync').onclick=()=>{ sendTraktInventory(); window.CenaAndroid.syncTrakt(); };
  if($('#trakt-send-list')) $('#trakt-send-list').onclick=()=>{ sendTraktInventory(); sendTraktList(); toast('Envio solicitado. Confira os itens pendentes.'); };
  if($('#trakt-disconnect')) $('#trakt-disconnect').onclick=()=>{$('#trakt-disconnect').textContent='Desconectando…';window.CenaAndroid.disconnectTrakt();};
}

function localConnection() {
  main.innerHTML = `<div class="connections-heading"><h1>Perfil</h1><p>Contas, sincronização e preferências do CENA.</p></div>
    <section class="profile-services" aria-labelledby="profile-services-title"><h2 id="profile-services-title">Conexões</h2><div class="connection-jumps" aria-label="Serviços">
    <button data-service="nuvio-panel"><strong>Nuvio</strong><small>Perfil e progresso</small></button>
    <button data-service="trakt-panel"><strong>Trakt</strong><small>Lista e histórico</small></button>
    <button data-service="stremio-panel"><strong>Stremio</strong><small>Importar biblioteca</small></button>
    <button data-service="streaming-panel"><strong>TMDB</strong><small>Onde assistir</small></button>
    </div></section><div class="settings-quick">
    <button class="secondary" id="jump-updates">Atualizações do CENA</button>
    <button class="secondary" id="jump-history">Histórico e backup</button>
    <button class="secondary" id="jump-nuvio-copy">Copiar Trakt para Nuvio</button>
    </div><details class="panel home-customize" id="home-preferences"><summary>Personalizar início</summary><div class="home-customize-options">
    <label><input type="checkbox" data-home-section="recent" ${homeSections.recent!==false?'checked':''}> Últimos vistos</label>
    <label><input type="checkbox" data-home-section="series" ${homeSections.series!==false?'checked':''}> Suas séries</label>
    <label><input type="checkbox" data-home-section="recommendations" ${homeSections.recommendations!==false?'checked':''}> Para você</label>
    </div></details> ${native&&apiBase!=='local'?'<button class="secondary" id="manage-remote-list">Gerenciar catálogo remoto</button>':''}<div class="panel" id="update-panel"><h2>Atualizações do CENA</h2><p id="update-status">Confira novas versões do aplicativo.</p><div class="actions"><button class="secondary" id="update-check">Verificar atualização</button><button class="primary" id="update-install" hidden>Atualizar</button></div></div><div class="panel" id="streaming-panel"><h2>TMDB · Onde assistir</h2><p id="streaming-status"></p><p>Para mostrar os serviços no Brasil, use uma chave de API v3 gratuita da sua conta TMDB. <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">Criar ou consultar chave no TMDB</a>. Dados de disponibilidade: JustWatch via TMDB.</p><form id="streaming-form"><label for="streaming-key">Chave de API v3 do TMDB</label><input id="streaming-key" type="password" autocomplete="off" minlength="32" maxlength="32" required><button class="secondary" type="submit">Conectar TMDB</button></form></div>
    <div class="panel"><h2>Trakt como ponte</h2><p>Adicione no CENA → receba em Quero assistir no Trakt → abra a biblioteca Trakt do Nuvio no celular ou na TV.</p>
    <p>Use a mesma conta Trakt nos dois Nuvios e selecione Trakt como fonte da biblioteca. Ative também o registro do que assistir no Trakt.</p></div>
    <div class="panel" id="sync-summary"></div><div class="panel" id="vision-model-panel"></div><div class="panel" id="trakt-panel"></div>
    <section class="panel"><h2>Memória das capturas</h2><p>O CENA guarda o título lido e o filme confirmado neste aparelho.</p><button class="secondary" id="clear-capture-memory" ${captureMemory.size()?'':'disabled'}>Apagar confirmações locais</button><p class="muted" id="capture-memory-status" role="status"></p></section><div class="panel" id="nuvio-panel"></div><section class="panel" id="nuvio-copy"></section><div class="panel" id="stremio-panel"></div><div class="panel" id="local-ai-panel"></div><div class="panel" id="online-ai-panel"></div>
    <div class="panel"><h2>✓ Já assistido</h2><p>Quando o Nuvio registrar um filme como assistido no Trakt, o CENA recebe esse histórico na próxima sincronização. Abrir um filme não marca como assistido.</p><p>Para séries, mostramos os episódios vistos: um episódio não marca a série inteira como concluída.</p><p class="muted">A consulta automática em segundo plano é programada a cada 12 horas e retomada ao abrir o CENA. O Android pode adiá-la para economizar bateria. As novidades aparecem em Suas séries, no Início e em Descobrir.</p></div>
    <div class="panel"><h2>Stories</h2><p>Abra o filme → Criar Story → escolha a frase → Compartilhar ou Salvar imagem. No Instagram, escolha Stories e conclua a publicação.</p></div>
    <details class="panel"><summary>Catálogo remoto opcional</summary><p>Esta opção cria outra lista num servidor próprio. Não envia automaticamente sua lista local nem substitui a biblioteca Trakt.</p><form id="local-server-form"><input id="local-server-url" type="url" placeholder="https://seu-servidor.exemplo" required><button class="secondary" type="submit">Conectar servidor</button></form></details>`;
  mountNuvioCopy($('#nuvio-copy'));
  const updatePanel=$('#update-panel');
  $('#jump-history').onclick=()=>{historyMedia='';historyDedicated=false;historyMode='history';setTab('profile');$('.profile-sync').open=true;$('.profile-tools').open=true;};
  for(const box of main.querySelectorAll('[data-home-section]'))box.onchange=()=>{
    homeSections[box.dataset.homeSection]=box.checked;
    storage.setItem('cena.home.sections.v1',JSON.stringify(homeSections));
  };
  main.append(updatePanel);
  $('#jump-updates').onclick=()=>{updatePanel.tabIndex=-1;updatePanel.focus({preventScroll:true});updatePanel.scrollIntoView({block:'start'});};
  const serviceButtons=[...main.querySelectorAll('[data-service]')];
  const anchor=$('.settings-quick');
  // Keep the actual integration controls immediately after their shortcuts.
  let after=anchor;
  for(const button of serviceButtons){
    const panel=document.getElementById(button.dataset.service);
    after.after(panel);after=panel;panel.tabIndex=-1;
    button.onclick=()=>{
      panel.focus({preventScroll:true});
      panel.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    };
  }
  const copyPanel=$('#nuvio-copy');$('#trakt-panel').after(copyPanel);copyPanel.tabIndex=-1;
   const copyJump=$('#jump-nuvio-copy');copyJump.hidden=copyPanel.hidden;copyJump.onclick=()=>{copyPanel.focus({preventScroll:true});copyPanel.scrollIntoView({block:'start'});};
   window.CenaAndroid?.historyState?.();
   if($('#manage-remote-list'))$('#manage-remote-list').onclick=()=>connect(true);
  $('#clear-capture-memory').onclick=event=>{
    try{captureMemory.clear();event.currentTarget.disabled=true;$('#capture-memory-status').textContent='Confirmações apagadas.';}
    catch{$('#capture-memory-status').textContent='Não consegui apagar as confirmações. Tente novamente.';}
  };
  window.CenaAndroid?.visionModelState?.();stremioPanel.mount($('#stremio-panel'));renderLocalAI();renderSync();renderVisionModel();renderNuvioPanel($('#nuvio-panel'),nuvioState,window.CenaAndroid);
  onlineAI.mount($('#online-ai-panel'));
  renderUpdatePanel();$('#update-check').onclick=()=>window.CenaAndroid?.checkUpdates?.();$('#update-install').onclick=()=>window.CenaAndroid?.installUpdate?.();
  $('#streaming-status').textContent=streamingMessage;$('#streaming-form').onsubmit=event=>{event.preventDefault();const field=$('#streaming-key');window.CenaAndroid?.configureStreaming?.(field.value);field.value='';$('#streaming-status').textContent='Conectando ao TMDB…';};window.CenaAndroid?.streamingStatus?.();
  renderTraktPanel();
  $('#local-server-form').onsubmit = async event => {
    event.preventDefault(); const previous={apiBase,connection,config,items};
    try { apiBase=validBase($('#local-server-url').value.trim()); connection=null; config=await api('/api/config'); await ensureConnection(); items=[]; connect(true); toast('Servidor conectado. Sua lista local foi preservada.'); }
    catch(error) { ({apiBase,connection,config,items}=previous); toast(error.message); }
  };
}

// Render a 9:16 PNG locally. Photo captures never leave the device.
const story=createStoryEditor({$,escape,storage,getItems:()=>items,native,artworkResolver,persistArtwork,toast,wireStreaming});
document.querySelectorAll('nav [data-tab]').forEach(button => button.onclick = () => {if(button.dataset.tab===tab&&tab!=='profile'){window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});return;}setTab(button.dataset.tab);});
$('nav [data-tab=profile]').addEventListener('click',()=>{historyMode='stats';historyDedicated=false;historyMedia='';},true);
$('#profile-shortcut').onclick=()=>setTab('connect');
$('#search-shortcut').onclick = () => { setTab('library'); $('#query').focus(); };
function animateBrand(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const brand=$('.brand');
  brand.classList.remove('brand-intro');
  void brand.offsetWidth;
  brand.classList.add('brand-intro');
}
$('.brand').onclick = event => { event.preventDefault(); setTab('home'); animateBrand(); };
if(document.readyState==='complete')requestAnimationFrame(animateBrand);
else window.addEventListener('load',()=>requestAnimationFrame(animateBrand),{once:true});
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

