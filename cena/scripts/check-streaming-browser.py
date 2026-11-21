import os,shutil,subprocess,tempfile,time,base64,io
from PIL import Image
from playwright.sync_api import sync_playwright
p=subprocess.Popen(['node','server/index.mjs'],env=dict(os.environ,DATA_DIR=tempfile.mkdtemp(prefix='cena-stream-')),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(1)
 with sync_playwright() as q:
  b=q.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  page=b.new_page(viewport={'width':412,'height':915})
  buffer=io.BytesIO();Image.new('RGB',(100,150),'#664488').save(buffer,format='PNG');png=buffer.getvalue()
  page.route('https://**/*',lambda route:route.fulfill(status=404,body='') if route.request.resource_type=='image' and 'images.metahub.space' in route.request.url else route.fulfill(status=200,content_type='image/png',body=png) if route.request.resource_type=='image' else route.fulfill(status=200,content_type='application/json',body='{}'))
  page.add_init_script('''localStorage.setItem('cena.local.items.v1',JSON.stringify([{id:'tt1335975',type:'movie',name:'47 Ronin',status:'watchlist'}]));window.configured=false;window.CenaAndroid={appVersion:()=>"0.17.0",ready:()=>{},traktInventory:()=>{},streamingStatus:()=>queueMicrotask(()=>window.CenaStreamingResult({kind:'status',configured:window.configured})),configureStreaming:(key)=>{window.testKey=key;window.configured=true;queueMicrotask(()=>window.CenaStreamingResult({kind:'status',configured:true,message:'TMDB conectado.'}))},findStreaming:(id,type)=>queueMicrotask(()=>window.CenaStreamingResult({kind:'provider',id,type,name:'Streaming teste',logo:'/teste.png',poster:'/filme.jpg'}))};''')
  page.goto('http://127.0.0.1:3000',wait_until='domcontentloaded')
  page.locator('#profile-shortcut').click()
  page.locator('#streaming-key').fill('a'*32)
  page.locator('#streaming-form button').click()
  assert page.locator('#streaming-key').input_value()==''
  assert 'TMDB conectado' in page.locator('#streaming-status').inner_text()
  page.locator('nav [data-tab="library"]').click()
  badge=page.locator('[data-stream-key="movie:tt1335975"] img').first
  badge.wait_for(timeout=15000)
  assert badge.get_attribute('alt')=='Disponível em Streaming teste'
  page.locator('.poster-art[data-artwork-key="movie:tt1335975"] > img').first.wait_for(timeout=15000)
  assert page.locator('.poster-art[data-artwork-key="movie:tt1335975"] > img').first.get_attribute('src')=='https://image.tmdb.org/t/p/w500/filme.jpg'
  assert not page.evaluate("Object.values(localStorage).some(v=>typeof v==='string'&&v.includes('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'))")
  print('Selo do streaming, capa independente e chave fora do armazenamento web verificados com dados simulados.')
  b.close()
finally:
 p.terminate();p.wait()

