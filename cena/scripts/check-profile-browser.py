import subprocess,time,urllib.request,json,shutil
from playwright.sync_api import sync_playwright,expect
p=subprocess.Popen(['node','server/index.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(40):
  try:urllib.request.urlopen('http://127.0.0.1:3000');break
  except:time.sleep(.2)
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox']);page=b.new_page(viewport={'width':412,'height':915});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('https://**/*',lambda r:r.fulfill(status=200,content_type='application/json',body='{}'))
  page.add_init_script('''localStorage.setItem('cena.connection.v1',JSON.stringify({apiBase:'local'}));localStorage.setItem('cena.local.items.v1',JSON.stringify([{id:'tt0000001',type:'movie',name:'Teste',year:'2020',status:'watchlist'}]));localStorage.setItem('cena.story.notes.v1',JSON.stringify({'movie:tt0000001':{rating:'8,53'}}));window.CenaAndroid={appVersion:()=> '0.20.0',traktInventory:()=>{},historyState:()=>{},ready:()=>queueMicrotask(()=>window.CenaHistoryResult({scope:'a',connected:true,coverage:'partial',totals:{plays:3,movies:1,episodes:2,estimatedMinutes:357,timedPlays:3},years:[{year:2023,plays:1},{year:2026,plays:2}],media:[]})),historyRows:(id)=>queueMicrotask(()=>window.CenaHistoryRows({requestId:id,scope:'a',rows:[],page:1,total:0}))};''')
  page.goto('http://127.0.0.1:3000',wait_until='domcontentloaded');page.locator('#profile-shortcut').click();page.locator('#history-stats-tab').click();expect(page.locator('#history-stats')).to_contain_text('1 títulos');expect(page.locator('#history-stats')).to_contain_text('Histórico parcial');page.locator('[data-profile-stats=time]').click();expect(page.locator('#history-stats')).to_contain_text('5h 57min');expect(page.locator('.profile-bars')).to_contain_text('2026');page.locator('[data-profile-stats=ratings]').click();expect(page.locator('#history-stats')).to_contain_text('8,53 / 10');page.locator('[data-profile-stats=platforms]').click();expect(page.locator('#history-stats')).to_contain_text('não informa');page.locator('.profile-tools summary').first.click();expect(page.locator('#backup-panel')).to_be_visible();assert not errors,errors
  print('Perfil: categorias, dados anuais, notas decimais, cobertura parcial e backup verificados.')
finally:p.terminate();p.wait()
