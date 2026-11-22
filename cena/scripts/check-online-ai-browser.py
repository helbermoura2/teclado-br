import subprocess,time,shutil,os,tempfile
from playwright.sync_api import sync_playwright,expect
p=subprocess.Popen(['node','server/index.mjs'],env=dict(os.environ,DATA_DIR=tempfile.mkdtemp(prefix='cena-ai-')),stdout=subprocess.DEVNULL)
try:
 time.sleep(1)
 with sync_playwright() as q:
  b=q.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  page=b.new_page(viewport={'width':412,'height':915});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('https://**/*',lambda r:r.fulfill(status=200,content_type='application/json',body='{}'))
  page.route('https://cena-ia.terrestre.workers.dev/api/ai/similar',lambda r:r.fulfill(status=200,content_type='application/json',body='{"items":[{"id":"tt2334879","reason":"Enredo envolvendo o presidente."}]}'))
  page.add_init_script("localStorage.setItem('cena.connection.v1',JSON.stringify({apiBase:'local'}));window.CenaAndroid={appVersion:()=> '0.28.0',ready:()=>{},traktInventory:()=>{}};")
  page.goto('http://127.0.0.1:3000',wait_until='domcontentloaded');page.locator('#profile-shortcut').click();panel=page.locator('#online-ai-panel');expect(panel).to_be_visible();expect(panel.locator('[name=url]')).to_have_value('https://cena-ia.terrestre.workers.dev');panel.locator('[name=token]').fill('fixture-token-12345678901234567890');page.evaluate("window.CenaTraktResult({connected:false,configured:false,pending:[]})");expect(panel.locator('[name=token]')).to_have_value('fixture-token-12345678901234567890');panel.locator('button[type=submit]').click();expect(panel.locator('[name=token]')).to_have_value('');panel.locator('[data-test]').click();expect(panel.locator('[role=status]')).to_contain_text('Gemini respondeu');page.reload(wait_until='domcontentloaded');page.locator('#profile-shortcut').click();expect(page.locator('#online-ai-panel [role=status]')).to_contain_text('Conexão salva');page.locator('#online-ai-panel [data-remove]').click();expect(page.locator('#online-ai-panel [role=status]')).to_contain_text('Informe seu token');assert not errors,errors;b.close();print('Gemini UI: Worker setup, simulated authenticated reply, persistence and disconnect verified; no live API call.')
finally:p.terminate();p.wait()
