import os,shutil,subprocess,tempfile,time
from playwright.sync_api import sync_playwright
env=dict(os.environ,DATA_DIR=tempfile.mkdtemp(prefix='cena-nav-'))
p=subprocess.Popen(['node','server/index.mjs'],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(1)
 with sync_playwright() as q:
  executable=shutil.which('google-chrome') or shutil.which('chromium')
  assert executable, 'Chrome ou Chromium não encontrado'
  b=q.chromium.launch(executable_path=executable,args=['--no-sandbox'])
  page=b.new_page(viewport={'width':412,'height':915})
  page.add_init_script('''localStorage.setItem('cena.connection.v1',JSON.stringify({apiBase:'local'}));localStorage.setItem('cena.local.items.v1',JSON.stringify([{id:'tt1335975',type:'movie',name:'47 Ronin',status:'watchlist'}]));localStorage.setItem('cena.collections.v1',JSON.stringify({x:{name:'Favoritos',items:['movie:tt1335975'],titles:{},at:1}}));window.CenaAndroid={appVersion:()=>"0.17.0",ready:()=>{},traktInventory:()=>{}};''')
  page.goto('http://127.0.0.1:3000',wait_until='domcontentloaded')
  page.wait_for_function("document.querySelector('.brand img')?.naturalWidth > 0")
  assert page.locator('.brand').get_attribute('aria-label') == 'CENA IA, início'
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  page.locator('nav [data-tab="library"]').click();page.locator('#open-collections').click()
  assert '1 título' in page.locator('.collection-tile').inner_text()
  page.locator('.collection-tile').click();assert page.locator('#collection-titles .poster-card').count()==1
  assert page.evaluate('window.CenaBack()') is True
  assert page.locator('.collection-tile').count()==1
  assert page.evaluate('window.CenaBack()') is True
  assert page.locator('#library-grid').count()==1
  print('Lista, capa e retorno entre coleção e catálogo verificados.')
  b.close()
finally:
 p.terminate();p.wait()
