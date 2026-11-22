import os,subprocess,tempfile,time,shutil,json
from playwright.sync_api import sync_playwright,expect
p=subprocess.Popen(['node','server/index.mjs'],env=dict(os.environ,DATA_DIR=tempfile.mkdtemp()),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(1)
 with sync_playwright() as q:
  b=q.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox']);page=b.new_page(viewport={'width':412,'height':915});errors=[];calls=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   url=r.request.url
   if url.endswith('/api/ai/identify-cover'):
    body=r.request.post_data_json;assert body['image']['mimeType']=='image/jpeg';assert 'history' not in body;calls.append(body)
    return r.fulfill(status=200,content_type='application/json',body=json.dumps({'titles':[{'title':'Hiroshima: Out of the Ashes','year':'1990','type':'movie'}],'visibleText':['HIROSHIMA','OUT OF THE ASHES'],'uncertain':False}))
   metas=[]
   if 'catalog/movie/top/search=Hiroshima' in url:metas=[{'id':'tt0099772','type':'movie','name':'Hiroshima: Out of the Ashes','releaseInfo':'1990','description':'A film about Hiroshima.'}]
   r.fulfill(status=200,content_type='application/json',body=json.dumps({'metas':metas}))
  page.route('https://**/*',route)
  page.add_init_script('''localStorage.setItem('cena.connection.v1',JSON.stringify({apiBase:'local'}));localStorage.setItem('cena.online-ai.v1',JSON.stringify({url:'https://cena-ia.terrestre.workers.dev',token:'fixture-token'}));window.CenaAndroid={ready:()=>{},appVersion:()=> '0.28.3',traktInventory:()=>{}};''')
  page.goto('http://127.0.0.1:3000',wait_until='domcontentloaded');page.wait_for_timeout(250)
  def capture(title):page.evaluate('''title=>{const canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;window.CenaNativeResult({title,lines:[title],image:canvas.toDataURL('image/jpeg')})}''',title)
  capture('HROSHIN 0 UT OF THE A SHES');expect(page.locator('.scan-frame img')).to_be_visible();assert not calls
  page.locator('#camera-ai-action').click();expect(page.locator('#camera-ai-status')).to_contain_text('Análise concluída',timeout=15000);expect(page.locator('#result-grid')).to_contain_text('Hiroshima: Out of the Ashes');assert len(calls)==1
  page.locator('#camera-ai-auto').check();capture('ZZZXQWERTY');expect(page.locator('#camera-ai-status')).to_contain_text('Análise concluída',timeout=15000);assert len(calls)==2
  assert not errors,errors;b.close();print('Camera: preview, explicit JPEG upload, catalog verification and opt-in automatic fallback passed; Gemini response simulated.')
finally:p.terminate();p.wait()
