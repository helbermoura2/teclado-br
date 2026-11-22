import subprocess,time,shutil,os,tempfile
from playwright.sync_api import sync_playwright,expect
p=subprocess.Popen(['node','server/index.mjs'],env=dict(os.environ,DATA_DIR=tempfile.mkdtemp()),stdout=subprocess.DEVNULL)
try:
 time.sleep(1)
 with sync_playwright() as q:
  b=q.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox']);page=b.new_page(viewport={'width':412,'height':915});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('https://**/*',lambda r:r.fulfill(status=200,content_type='application/json',body='{}'))
  page.add_init_script('''localStorage.setItem('cena.connection.v1',JSON.stringify({apiBase:'local'}));window.calls=[];window.CenaAndroid={ready:()=>{},appVersion:()=> '0.28.0',traktInventory:()=>{},connectTrakt:()=>{},connectNuvio:()=>{},exportBackup:()=>calls.push('backup'),disconnectNuvio:()=>calls.push('nuvio'),disconnectTrakt:()=>calls.push('trakt')};''')
  page.goto('http://127.0.0.1:3000',wait_until='domcontentloaded');page.wait_for_timeout(250)
  page.evaluate("window.CenaNuvioResult({connected:true,active:true,scope:'n',lastSync:1,profileId:1,profiles:[{id:1,name:'Teste'}]});window.CenaTraktResult({configured:true,connected:true,username:'Teste',pending:[]})")
  page.locator('#profile-shortcut').click()
  for selector in ['#nuvio-disconnect','#trakt-disconnect']:
   try:page.locator(selector).click(timeout=3000);print(selector,'clicked')
   except Exception as e:print(selector,str(e)[-1400:]);print(page.locator(selector).evaluate('(e)=>{const r=e.getBoundingClientRect();return [r.toJSON(),document.elementsFromPoint(r.x+r.width/2,r.y+r.height/2).map(n=>n.tagName+"#"+n.id+"."+n.className)]}'))
  page.locator('#jump-history').click();page.locator('#backup-export').click(timeout=3000)
  assert page.evaluate('calls')==['nuvio','trakt','backup'];assert not errors,errors;print('Cliques de desconectar Nuvio/Trakt e exportar backup verificados.')
  b.close()
finally:p.terminate();p.wait()
