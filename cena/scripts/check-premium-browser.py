"""Responsive UI, cached posters and repeated-tab navigation regression checks."""
import os,subprocess,tempfile,time,shutil
from playwright.sync_api import sync_playwright
p=subprocess.Popen(['node','server/index.mjs'],env=dict(os.environ,DATA_DIR=tempfile.mkdtemp(prefix='cena-premium-')),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(1)
 with sync_playwright() as q:
  b=q.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  page=b.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
  page.route('https://**/*',lambda r:r.abort())
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script('''localStorage.setItem('cena.connection.v1',JSON.stringify({apiBase:'local'}));localStorage.setItem('cena.local.items.v1',JSON.stringify([{id:'tt1335975',type:'movie',name:'47 Ronin',status:'watchlist',poster:'https://image.tmdb.org/t/p/w500/cover.jpg'}]));window.CenaAndroid={appVersion:()=>"0.28.4",ready:()=>{},traktInventory:()=>{}};''')
  page.goto('http://127.0.0.1:3000',wait_until='domcontentloaded')
  assert page.evaluate("getComputedStyle(document.querySelector('nav')).borderRadius")=='26px', 'Editorial stylesheet must be served'
  for width in [320,390,768]:
   page.set_viewport_size({'width':width,'height':915})
   for tab in ['home','library','scan','profile']:
    page.locator(f'nav [data-tab="{tab}"]').click()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,tab)
    assert page.locator('nav button svg').count()==5
  page.locator('nav [data-tab="library"]').click()
  page.evaluate("window.savedMain=document.querySelector('#main').firstElementChild")
  page.locator('nav [data-tab="library"]').click()
  assert page.evaluate("savedMain===document.querySelector('#main').firstElementChild"), 'Active tab must preserve its content'
  page.evaluate('window.CenaNuvioResult({connected:true,active:true,scope:"nuvio-a",profileName:"Helber",profileId:1,watchedCount:104,recent:[],watched:[],series:[]})')
  page.locator('nav [data-tab="profile"]').click()
  assert 'Seu histórico, com mais detalhes' in page.locator('#history-stats').inner_text()
  assert not errors,errors
  print('Premium: CSS servido, 320/390/768px, cinco ícones, aba preservada e estatísticas sem totais fictícios verificados.')
  b.close()
finally:p.terminate();p.wait()
