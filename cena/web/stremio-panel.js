import {stremioKey,stremioPreview,importStremioLibrary} from './stremio-import.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createStremioPanel({bridge,getItems,onImport,traktConnected,toast}) {
  let state={connected:false,library:[]},container=null,selected=new Set(),query='',page=0,lastRead=0,sendTrakt=false,importing=false;
  const preview=()=>stremioPreview(getItems(),state.library);
  function renderRows() {
    if(!container?.isConnected)return;
    const target=container.querySelector('#stremio-rows');if(!target)return;
    const data=preview(),filtered=data.items.filter(item=>`${item.name} ${item.year} ${item.id}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
    page=Math.max(0,Math.min(page,Math.ceil(filtered.length/50)-1));
    target.innerHTML=filtered.slice(page*50,page*50+50).map(item=>`<label class="stremio-row"><input type="checkbox" data-stremio-key="${esc(stremioKey(item))}" ${item.exists||!item.compatible?'disabled':selected.has(stremioKey(item))?'checked':''}><span><b>${esc(item.name)}</b><small>${item.type==='series'?'Série':'Filme'}${item.year?` · ${esc(item.year)}`:''} · ${item.exists?'Já está no CENA':!item.compatible?'Identificador ainda não compatível':'Novo no CENA'}</small></span></label>`).join('')||'<p>Nenhum título nesta busca.</p>';
    target.querySelectorAll('[data-stremio-key]').forEach(input=>input.onchange=()=>{input.checked?selected.add(input.dataset.stremioKey):selected.delete(input.dataset.stremioKey);updateCount();});
    const pages=container.querySelector('#stremio-pages');pages.textContent=`${filtered.length} títulos · página ${page+1} de ${Math.max(1,Math.ceil(filtered.length/50))}`;
    container.querySelector('#stremio-prev').disabled=page===0;
    container.querySelector('#stremio-next').disabled=(page+1)*50>=filtered.length;
    updateCount();
  }
  function updateCount(){
    const count=preview().items.filter(item=>item.compatible&&!item.exists&&selected.has(stremioKey(item))).length;
    const button=container?.querySelector('#stremio-import');if(button){button.textContent=`Importar ${count} título(s)`;button.disabled=!count||importing||state.reading||Boolean(state.error);}
  }
  function render(){
    if(!container?.isConnected)return;
    const supported=typeof bridge?.connectStremio==='function',data=preview();
    container.innerHTML=`<h2>${state.connected?'✓ Stremio conectado':'Importar biblioteca do Stremio'}</h2><p>Traga seus filmes e séries para o CENA sem fotografar cada capa. A leitura não altera sua biblioteca no Stremio.</p>
      ${!supported?'<p>Disponível na atualização do APK Android.</p>':state.connected?`<p>${esc(state.account||'Conta Stremio')}</p><div class="actions"><button class="primary" id="stremio-read" ${state.reading?'disabled':''}>${state.reading?'Lendo biblioteca…':'Ler biblioteca'}</button>${state.reading?'<button class="secondary" id="stremio-cancel">Cancelar leitura</button>':''}<button class="secondary" id="stremio-disconnect" ${state.reading?'disabled':''}>Desconectar Stremio</button></div>${state.reading?`<p role="status">Consultando ${state.processed||0} de ${state.total||0} registros…</p>`:''}`:state.pairing?`<p>Abra o site oficial do Stremio, entre na sua conta e confirme a vinculação. Depois volte ao CENA.</p><p class="muted">Aguardando autorização. Se o link expirar, gere outro.</p><div class="actions"><button class="primary" id="stremio-authorize">Autorizar no Stremio</button><button class="secondary" id="stremio-restart">Gerar outro link</button><button class="secondary" id="stremio-disconnect">Cancelar</button></div>`:`<p>Você autoriza uma sessão pelo navegador. O CENA usa essa sessão apenas para ler a biblioteca e a guarda protegida neste aparelho. Sua senha é informada somente no site do Stremio.</p><button class="primary wide" id="stremio-connect">Conectar Stremio</button>`}
      ${state.error?`<p class="error" role="alert">${esc(state.error)}</p>`:''}
      ${state.connected&&state.lastRead?`<div id="stremio-preview"><h3>Confira antes de importar</h3><p id="stremio-summary">${data.available} novos · ${data.existing} já no CENA · ${data.unsupported} sem identificador compatível.</p><p class="muted">Leitura: ${new Date(state.lastRead).toLocaleString('pt-BR')}. ${state.excluded||0} registros removidos, temporários ou de outros tipos ficaram fora.</p>${state.warning?`<p class="notice">${esc(state.warning)}</p>`:''}<p>Os novos entram em Quero assistir. Suas marcações de assistido e os dados dos títulos existentes são preservados.</p><label for="stremio-filter">Filtrar biblioteca</label><input type="search" id="stremio-filter" placeholder="Nome, ano ou código IMDb" value="${esc(query)}"><div class="actions"><button class="secondary" id="stremio-select">Selecionar novos</button><button class="secondary" id="stremio-clear">Limpar seleção</button></div><div id="stremio-rows"></div><p class="muted" id="stremio-pages"></p><div class="actions"><button class="secondary" id="stremio-prev">Anterior</button><button class="secondary" id="stremio-next">Próxima</button></div><button class="primary wide" id="stremio-import"></button><p class="muted">Títulos sem código IMDb ficam nesta conferência para uma etapa futura de identificação.</p></div>`:''}`;
    const bind=(id,fn)=>{const button=container.querySelector(id);if(button)button.onclick=fn;};
    bind('#stremio-connect',()=>bridge.connectStremio());bind('#stremio-restart',()=>bridge.connectStremio());
    bind('#stremio-authorize',()=>bridge.openStremioAuthorization());bind('#stremio-disconnect',()=>{bridge.disconnectStremio();selected.clear();sendTrakt=false;});
    bind('#stremio-read',()=>{bridge.readStremioLibrary();});bind('#stremio-cancel',()=>{bridge.cancelStremioReading();toast('Cancelamento solicitado. Sua lista será preservada.');});
    bind('#stremio-select',()=>{selected=new Set(preview().items.filter(i=>i.compatible&&!i.exists).map(stremioKey));renderRows();});
    bind('#stremio-clear',()=>{selected.clear();renderRows();});
    bind('#stremio-prev',()=>{page--;renderRows();});bind('#stremio-next',()=>{page++;renderRows();});
    const search=container.querySelector('#stremio-filter');if(search)search.oninput=()=>{query=search.value;page=0;renderRows();};
    const trakt=container.querySelector('#stremio-trakt');if(trakt)trakt.onchange=()=>{sendTrakt=trakt.checked;};
    bind('#stremio-import',async()=>{
      if(importing||state.reading||state.error)return;
      importing=true;updateCount();
      try {
        const result=importStremioLibrary(getItems(),state.library,selected);
        if(!result.added.length)return;
        await onImport(result,false);selected.clear();sendTrakt=false;
        toast(`${result.added.length} título(s) importado(s).`);
      }catch(error){toast(error.message||'Não consegui salvar a importação.');}
      finally{importing=false;render();}
    });
    renderRows();
  }
  return {
    mount(element){container=element;render();},
    update(next){
      if(JSON.stringify(next)===JSON.stringify(state))return;
      state=next;
      if(next.lastRead&&next.lastRead!==lastRead){lastRead=next.lastRead;selected=new Set(preview().items.filter(i=>i.compatible&&!i.exists).map(stremioKey));page=0;}
      if(!next.connected&&!next.pairing){lastRead=0;selected.clear();}
      // A progress or Trakt event must not replace text being typed in the filter.
      if(container?.querySelector('#stremio-filter')!==document.activeElement)render();
    }
  };
}
