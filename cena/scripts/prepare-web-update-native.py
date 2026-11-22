"""Reuse validated native binaries only after proving this is a web-only change."""
import base64,hashlib,json,os,re,subprocess,sys,urllib.request
from pathlib import Path
from zipfile import ZipFile
baseline='6b77b4601bfea911e838da6c19de9c38fd6b2c51'
root=Path(__file__).resolve().parents[1]
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
def api(path):
 request=urllib.request.Request('https://api.github.com/repos/helbermoura2/teclado-br/'+path,headers={'Authorization':'Bearer '+os.environ['CENA_PRIVATE_ACCESS'],'Accept':'application/vnd.github+json'})
 with urllib.request.urlopen(request,timeout=30)as response:return json.load(response)
comparison=api('compare/'+baseline+'...'+head)
assert comparison['status'] in ('ahead','identical') and comparison['total_commits']<250
assert len(comparison['files'])<300
for item in comparison['files']:
 name=item['filename']
 if name.startswith('cena/android/')or name in ('cena/scripts/build-local-ai.sh','cena/scripts/trim-native.sh','cena/scripts/prepare-vision-model.py'):
  assert name=='cena/android/app/build.gradle.kts','Native change requires the complete native workflow: '+name
old=base64.b64decode(api('contents/cena/android/app/build.gradle.kts?ref='+baseline)['content']).decode()
new=(root/'android/app/build.gradle.kts').read_text()
def normalize(text):
 return re.sub(r'versionName = "[0-9.]+"','versionName = "VERSION"',re.sub(r'versionCode = \d+','versionCode = CODE',text))
assert normalize(old)==normalize(new),'Only version changes are allowed in the Android build'
apk=Path(sys.argv[1]);assert hashlib.sha256(apk.read_bytes()).hexdigest()=='2f3a7530f38e50aae0adc81cde829756a3ab089451eef1ca1202fe84283258ce'
with ZipFile(apk)as archive:
 for name in archive.namelist():
  if name=='lib/arm64-v8a/libcenallm.so':target=root/'android/app/src/main/jniLibs/arm64-v8a/libcenallm.so'
  elif name.startswith(('assets/models/','assets/licenses/'))and not name.endswith('/')and not name.endswith('.onnx'):target=root/'android/app/src/main'/name
  else:continue
  target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.read(name))
print('Native source unchanged; verified 0.28.4 library and model metadata reused for web-only update.')
