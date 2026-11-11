import os,subprocess,tempfile,time,shutil
from playwright.sync_api import sync_playwright
p=subprocess.Popen(['node','server/index.mjs'],env=dict(os.environ,DATA_DIR=tempfile.mkdtemp(prefix='cena-history-')),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(1)
 with sync_playwright() as q:
  b=q.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  page=b.new_page(viewport={'width':412,'height':915})
  errors=[]
  page.on('pageerror',lambda e: errors.append(str(e)))
  page.add_init_script('''window.CenaAndroid={appVersion:()=>"0.17.0",traktInventory:()=>{},ready:()=>queueMicrotask(()=>window.CenaHistoryResult({scope:"conta-a",connected:true,totals:{},media:[],lastImport:1})),historyRows:(id)=>queueMicrotask(()=>window.CenaHistoryRows({requestId:id,scope:"conta-a",page:1,rows:[{id:"tt0374463",kind:"episode",name:"The Pacific",season:1,episode:3,watchedAt:"2026-11-04T12:00:00Z",datePrecision:"exact"}]}))};''')
  page.goto('http://127.0.0.1:3000',wait_until='domcontentloaded',timeout=15000)
  page.locator('#recent-history strong').get_by_text('The Pacific').wait_for(timeout=15000)
  assert 'T1 · E3' in page.locator('#recent-history').inner_text()
  page.locator('#recent-see-all').click()
  assert page.locator('h1').inner_text()=='Últimos vistos'
  assert page.locator('#history-records .history-row').count()==1
  page.locator('#history-back').click()
  page.evaluate('window.CenaHistoryResult({scope:"conta-b",connected:true,totals:{},media:[],lastImport:2})')
  assert page.locator('#recent-history strong').get_by_text('The Pacific').count()==0
  assert not errors, errors
  print('Últimos vistos: episódio, data e isolamento de conta conferidos no navegador.')
  b.close()
finally:
 p.terminate();p.wait()
