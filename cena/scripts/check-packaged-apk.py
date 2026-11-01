"""Validate the delivered APK, not just source files in the checkout."""
import json
import os
import subprocess
import sys
from pathlib import Path
from zipfile import ZipFile

apk = Path(sys.argv[1])
with ZipFile(apk) as archive:
    index = archive.read('assets/index.html').decode()
    app = archive.read('assets/app.js').decode()
    assert 'v0.4.2' in index
    assert '<h1>Capturar título</h1>' in app and 'id="pick-image"' in app
    identification = archive.read('assets/identify-cover.js').decode()
    assert 'compareCovers' in app and 'coverInput(result)' in app
    assert 'result.title' in identification and 'result.phrases' in identification
    assert '<textarea id="scan-query"' in app
    assert archive.getinfo('assets/models/clip-vision.onnx').file_size > 20_000_000
    assert not any('photo.base64' in name for name in archive.namelist()), 'Private test photos must never ship in the app.'
    model = json.loads(archive.read('assets/models/model-info.json'))
tools = sorted(Path(os.environ['ANDROID_HOME']).glob('build-tools/*/aapt'))
assert tools
badging = subprocess.check_output([str(tools[-1]), 'dump', 'badging', str(apk)], text=True).splitlines()[0]
assert "name='app.cena.mobile'" in badging
assert "versionName='0.4.2'" in badging and "versionCode='6'" in badging
print('Verified packaged APK:', badging, 'model bytes:', model['size'])
