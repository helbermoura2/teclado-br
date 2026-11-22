import os,subprocess,tempfile,time,shutil,json
from urllib.parse import unquote
from playwright.sync_api import sync_playwright,expect
p=subprocess.Popen(['node','server/index.mjs'],env=dict(os.environ,DATA_DIR=tempfile.mkdtemp()),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(1)
 with sync_playwright() as q:
  b=q.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox']);page=b.new_page(viewport={'width':412,'height':915});errors=[];calls=[];page.on('pageerror',lambda e:errors.append(str(e)))
  scenario='hiroshima'
  def route(r):
   url=r.request.url
   if url.endswith('/api/ai/identify-cover'):
    body=r.request.post_data_json;assert body['image']['mimeType']=='image/jpeg';assert 'history' not in body;calls.append(body)
    if scenario=='cast':return r.fulfill(status=200,content_type='application/json',body=json.dumps({'reading':{'title':'Guerra ao Terror','cast':['David Morse','Ralph Fiennes'],'awards':['Indicação ao Oscar']},'titles':[{'title':'David Morse','type':'movie'},{'title':'Guerra ao Terror','originalTitle':'The Hurt Locker','year':'2008','type':'movie'}],'visibleText':['DAVID MORSE','RALPH FIENNES','GUERRA AO TERROR'],'uncertain':False}))
    if scenario=='numeric':return r.fulfill(status=200,content_type='application/json',body=json.dumps({'titles':[{'title':'1917','year':'2019','type':'movie'}],'visibleText':['3 NOMEAÇÕES GLOBOS DE OURO','DO REALIZADOR DE 007 SKYFALL','1917'],'uncertain':False}))
    if scenario=='regional':return r.fulfill(status=200,content_type='application/json',body=json.dumps({'titles':[{'title':'Hiroshima - A Guerra da Sobrevivência','originalTitle':'Hiroshima: Out of the Ashes','year':'1990','type':'movie'}],'visibleText':['HIROSHIMA','A GUERRA DA SOBREVIVENCIA'],'uncertain':False}))
    if scenario!='hiroshima':return r.fulfill(status=200,content_type='application/json',body=json.dumps({'titles':[{'title':'The Angel of Auschwitz','year':'2019','type':'movie'}],'visibleText':['O PROTOCOLO DE','AUSCHWITZ'] if scenario=='auschwitz' else ['AUSCHWITZ'],'uncertain':False}))
    return r.fulfill(status=200,content_type='application/json',body=json.dumps({'titles':[{'title':'Hiroshima: Out of the Ashes','year':'1990','type':'movie'}],'visibleText':['HIROSHIMA','OUT OF THE ASHES'],'uncertain':False}))
   if scenario!='hiroshima':
    query=unquote(url).lower();metas=[]
    if scenario=='cast':metas=[{'id':'tt0887912','type':'movie','name':'Guerra ao Terror','releaseInfo':'2008'},{'id':'tt0486822','type':'movie','name':'Disturbia','releaseInfo':'2007'}]
    elif scenario=='numeric':metas=[{'id':'tt8579674','type':'movie','name':'1917','releaseInfo':'2019'},{'id':'tt1234567','type':'movie','name':'Globos de Ouro','releaseInfo':'2025'}]
    elif scenario=='regional' and 'search=hiroshima' in query:metas=[{'id':'tt0099772','type':'movie','name':'Hiroshima: Out of the Ashes','releaseInfo':'1990'},{'id':'tt0475296','type':'movie','name':'Hiroshima','releaseInfo':'2005'}]
    elif 'search=protocolo' in query:metas=[{'id':'tt9415108','type':'movie','name':'The Auschwitz Report','releaseInfo':'2021'}]
    elif 'search=the angel' in query:metas=[{'id':'tt8774388','type':'movie','name':'The Angel of Auschwitz','releaseInfo':'2019'}]
    elif 'search=auschwitz' in query:metas=[{'id':'tt1684714','type':'movie','name':'Auschwitz','releaseInfo':'2011'}]
    return r.fulfill(status=200,content_type='application/json',body=json.dumps({'metas':metas}))
   metas=[]
   if 'catalog/movie/top/search=Hiroshima' in url:metas=[{'id':'tt0099772','type':'movie','name':'Hiroshima: Out of the Ashes','releaseInfo':'1990','description':'A film about Hiroshima.'}]
   r.fulfill(status=200,content_type='application/json',body=json.dumps({'metas':metas}))
  page.route('https://**/*',route)
  page.add_init_script('''localStorage.setItem('cena.connection.v1',JSON.stringify({apiBase:'local'}));localStorage.setItem('cena.online-ai.v1',JSON.stringify({url:'https://cena-ia.terrestre.workers.dev',token:'fixture-token'}));window.CenaAndroid={ready:()=>{},appVersion:()=> '0.28.3',traktInventory:()=>{},streamingStatus:()=>queueMicrotask(()=>window.CenaStreamingResult({kind:'status',configured:true})),findTitleAliases:(id,type)=>queueMicrotask(()=>window.CenaStreamingResult(id==='tt9415108'?{kind:'titleAliases',id,type,name:'O Protocolo de Auschwitz',originalName:'The Auschwitz Report',year:'2021',aliases:['O Protocolo de Auschwitz','The Auschwitz Report']}:{kind:'titleAliases',id,type,error:true}))};''')
  page.goto('http://127.0.0.1:3000',wait_until='domcontentloaded');page.wait_for_timeout(250)
  def capture(title):page.evaluate('''title=>{const canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;window.CenaNativeResult({title,lines:[title],image:canvas.toDataURL('image/jpeg')})}''',title)
  capture('HROSHIN 0 UT OF THE A SHES');expect(page.locator('.scan-frame img')).to_be_visible();assert not calls
  page.locator('#camera-ai-action').click();expect(page.locator('#camera-ai-status')).to_contain_text('Análise concluída',timeout=15000);expect(page.locator('#result-grid')).to_contain_text('Hiroshima: Out of the Ashes');assert len(calls)==1
  page.locator('#camera-ai-auto').check();capture('ZZZXQWERTY');expect(page.locator('#camera-ai-status')).to_contain_text('Análise concluída',timeout=15000);assert len(calls)==2
  page.locator('#camera-ai-auto').uncheck();scenario='auschwitz';capture('AUSCHWITZ')
  page.locator('#camera-ai-action').click();expect(page.locator('#camera-ai-status')).to_contain_text('Análise concluída',timeout=15000)
  expect(page.locator('#result-grid')).to_contain_text('O Protocolo de Auschwitz');assert page.locator('#result-grid .poster-card').count()==1
  assert 'PROTOCOLO' in page.locator('#scan-query').input_value().upper()
  scenario='uncertain';page.locator('#camera-ai-action').click();expect(page.locator('#camera-ai-status')).to_contain_text('descartadas',timeout=15000)
  assert page.locator('#search-results .poster-card').count()==0, 'Old incorrect matches must be cleared'
  assert not errors,errors;page.close();scenario='regional'
  page=b.new_page(viewport={'width':412,'height':915});page.on('pageerror',lambda e:errors.append(str(e)));page.route('https://**/*',route)
  page.add_init_script('''localStorage.setItem('cena.connection.v1',JSON.stringify({apiBase:'local'}));localStorage.setItem('cena.online-ai.v1',JSON.stringify({url:'https://cena-ia.terrestre.workers.dev',token:'fixture-token'}));window.aliasRequests=[];window.CenaAndroid={ready:()=>{},appVersion:()=> '0.28.6',traktInventory:()=>{},streamingStatus:()=>queueMicrotask(()=>window.CenaStreamingResult({kind:'status',configured:true})),findTitleAliases:(id,type)=>{aliasRequests.push({id,type});queueMicrotask(()=>window.CenaStreamingResult({kind:'titleAliases',id,type,name:id==='tt0099772'?'Hiroshima - A Guerra da Sobrevivência':'Hiroshima',originalName:id==='tt0099772'?'Hiroshima: Out of the Ashes':'Hiroshima',year:id==='tt0099772'?'1990':'2005',aliases:id==='tt0099772'?['Hiroshima - A Guerra da Sobrevivência','Hiroshima: Out of the Ashes']:['Hiroshima']}));}};''')
  page.goto('http://127.0.0.1:3000',wait_until='domcontentloaded');page.wait_for_timeout(250)
  capture('HIROSHIMA A GUERRA DA SOBREVIVENCIA');page.locator('#camera-ai-action').click()
  expect(page.locator('#camera-ai-status')).to_contain_text('Análise concluída',timeout=15000);expect(page.locator('#result-grid')).to_contain_text('Hiroshima - A Guerra da Sobrevivência')
  assert page.locator('#result-grid .poster-card').count()==1
  assert page.locator('#result-grid .poster-card').get_attribute('data-id')=='tt0099772'
  assert page.evaluate("aliasRequests.some(x=>x.id==='tt0099772')")
  scenario='cast';capture('DAVID MORSE');page.locator('#camera-ai-action').click();expect(page.locator('#camera-ai-status')).to_contain_text('Análise concluída',timeout=15000)
  assert page.locator('#result-grid .poster-card').count()==1;assert page.locator('#result-grid .poster-card').get_attribute('data-id')=='tt0887912'
  assert page.locator('#scan-query').input_value()=='Guerra ao Terror';expect(page.locator('#camera-reading')).to_contain_text('Título lido: Guerra ao Terror');expect(page.locator('#camera-reading')).to_contain_text('David Morse')
  scenario='numeric';capture('3 NOMEAÇÕES GLOBOS DE OURO');page.locator('#camera-ai-action').click();expect(page.locator('#camera-ai-status')).to_contain_text('Análise concluída',timeout=15000)
  assert page.locator('#result-grid .poster-card').count()==1;assert page.locator('#result-grid .poster-card').get_attribute('data-id')=='tt8579674';assert page.locator('#scan-query').input_value()=='1917'
  assert not errors,errors;b.close();print('Camera: actor/award roles, numeric title, native regional names and unrelated-title rejection passed; private services simulated.')
finally:p.terminate();p.wait()
