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
    assert 'v0.9.1' in index
    assert '<h1>Capturar título</h1>' in app and 'id="pick-image"' in app
    identification = archive.read('assets/identify-cover.js').decode()
    assert 'compareCovers' in app and 'coverInput(result)' in app
    assert 'result.title' in identification and 'result.phrases' in identification
    assert '<textarea id="scan-query"' in app
    assert archive.getinfo('assets/models/clip-vision.onnx').file_size > 20_000_000
    assert not any('photo.base64' in name for name in archive.namelist()), 'Private test photos must never ship in the app.'
    assert 'assets/artwork.js' in archive.namelist()
    assert 'assets/recommendations.js' in archive.namelist()
    assert 'assets/series-view.js' in archive.namelist()
    assert 'data-tab="discover"' in index
    assert index.count('data-tab=') == 5
    assert 'assets/story-artwork.js' in archive.namelist()
    assert 'assets/story-layout.js' in archive.namelist()
    assert 'assets/story-metadata.js' in archive.namelist()
    assert 'id="story-rating"' in app and 'id="story-title"' in app
    assert "id=\"share-story\" disabled" in app
    assert 'assets/stremio-panel.js' in archive.namelist()
    assert 'assets/stremio-import.js' in archive.namelist()
    assert 'trakt-state.js' in '\n'.join(archive.namelist())
    assert '1080' in app and '1920' in app and 'Salvar imagem PNG' in app
    assert 'assets/similar.js' in archive.namelist() and 'assets/local-ai.js' in archive.namelist()
    assert 'id="similar-titles"' in app
    assert not any(name.endswith('.gguf') for name in archive.namelist())
    for abi in ['arm64-v8a','x86_64']: assert archive.getinfo(f'lib/{abi}/libcenallm.so').file_size > 1000000
    assert 'assets/licenses/llama.cpp.txt' in archive.namelist()
    model = json.loads(archive.read('assets/models/model-info.json'))
tools = sorted(Path(os.environ['ANDROID_HOME']).glob('build-tools/*/aapt'))
assert tools
badging = subprocess.check_output([str(tools[-1]), 'dump', 'badging', str(apk)], text=True).splitlines()[0]
assert "name='app.cena.mobile'" in badging
assert "versionName='0.9.1'" in badging and "versionCode='17'" in badging
assert any('application-icon' in line for line in subprocess.check_output([str(tools[-1]), 'dump', 'badging', str(apk)], text=True).splitlines()), 'Launcher icon must be packaged.'
print('Verified packaged APK:', badging, 'model bytes:', model['size'])
