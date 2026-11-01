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
    assert 'v0.5.1' in index
    assert '<h1>Capturar título</h1>' in app and 'id="pick-image"' in app
    identification = archive.read('assets/identify-cover.js').decode()
    assert 'compareCovers' in app and 'coverInput(result)' in app
    assert 'result.title' in identification and 'result.phrases' in identification
    assert '<textarea id="scan-query"' in app
    assert archive.getinfo('assets/models/clip-vision.onnx').file_size > 20_000_000
    assert not any('photo.base64' in name for name in archive.namelist()), 'Private test photos must never ship in the app.'
    assert 'assets/artwork.js' in archive.namelist()
    assert 'trakt-state.js' in '\n'.join(archive.namelist())
    assert '1080' in app and '1920' in app and 'Salvar imagem PNG' in app
    model = json.loads(archive.read('assets/models/model-info.json'))
tools = sorted(Path(os.environ['ANDROID_HOME']).glob('build-tools/*/aapt'))
assert tools
badging = subprocess.check_output([str(tools[-1]), 'dump', 'badging', str(apk)], text=True).splitlines()[0]
assert "name='app.cena.mobile'" in badging
assert "versionName='0.5.1'" in badging and "versionCode='9'" in badging
assert any('application-icon' in line for line in subprocess.check_output([str(tools[-1]), 'dump', 'badging', str(apk)], text=True).splitlines()), 'Launcher icon must be packaged.'
print('Verified packaged APK:', badging, 'model bytes:', model['size'])
