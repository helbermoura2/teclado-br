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
    assert 'v0.28.8' in index
    assert 'assets/brand-mark.png' in archive.namelist()
    assert 'assets/online-ai.js' in archive.namelist()
    assert 'assets/title-aliases.js' in archive.namelist()
    assert 'assets/cover-reading.js' in archive.namelist()
    assert 'camera-reading' in app
    assert 'enrichCameraTitle' in app and 'findTitleAliases' in archive.read('assets/title-aliases.js').decode()
    assert 'camera-ai-action' in app and 'analyzeCameraOnline' in app
    assert '/api/ai/identify-cover' in archive.read('assets/online-ai.js').decode()
    assert 'assets/recent-watches.js' in archive.namelist()
    assert 'assets/brand-wordmark.svg' in archive.namelist()
    assert 'CENA IA, início' in index
    assert '<h1>Descubra pelo <span>olhar.</span></h1>' in app and 'id="pick-image"' in app
    assert 'scan-ai-preferences' in app and 'camera-ai-auto' in app, 'Gemini settings must be available in CENA Vision'
    assert 'assets/editorial.css' in archive.namelist()
    assert 'CENA Vision' in archive.read('assets/editorial.css').decode(), 'The new design must be included in the signed APK'
    identification = archive.read('assets/identify-cover.js').decode()
    assert 'compareCovers' in app and 'coverInput(result)' in app
    assert 'result.title' in identification and 'result.phrases' in identification
    assert '<textarea id="scan-query"' in app
    assert 'assets/models/clip-vision.onnx' not in archive.namelist(), 'Visual model must be an optional download.'
    story = archive.read('assets/story-editor.js').decode()
    for module in ['app-storage','backup','collections','feedback','calendar','retrospective','sync-summary','taste-features','vision-model-panel','similarity-criteria','series-continuity','nuvio-series']:
        assert 'assets/'+module+'.js' in archive.namelist()
    assert not any('photo.base64' in name for name in archive.namelist()), 'Private test photos must never ship in the app.'
    assert 'assets/artwork.js' in archive.namelist()
    assert 'assets/recommendations.js' in archive.namelist()
    assert 'assets/profile-stats.js' in archive.namelist()
    assert 'assets/series-view.js' in archive.namelist()
    assert 'data-tab="discover"' in index
    assert index.count('data-tab=') == 5
    assert 'assets/story-artwork.js' in archive.namelist()
    assert 'assets/story-layout.js' in archive.namelist()
    layout = archive.read('assets/story-layout.js').decode()
    assert 'drawFogParticles' in layout and 'const titleWidth=width-24' in layout
    assert "layoutVersion='31'" in layout
    assert 'Story cinematográfico' in story
    assert 'assets/story-metadata.js' in archive.namelist()
    assert 'id="story-rating"' in story and 'id="story-title"' in story
    assert "id=\"share-story\" disabled" in story
    assert 'assets/stremio-panel.js' in archive.namelist()
    assert 'assets/stremio-import.js' in archive.namelist()
    assert 'trakt-state.js' in '\n'.join(archive.namelist())
    assert '1080' in story and '1920' in story and 'Salvar imagem PNG' in story
    assert 'assets/home-feed.js' in archive.namelist()
    assert 'brand-triangle' in index and 'resume-dismiss' in app
    assert 'assets/watch-history.js' in archive.namelist()
    assert 'profile-shortcut' in index and 'id="history-year"' in app
    assert 'assets/nuvio-state.js' in archive.namelist() and 'assets/nuvio-panel.js' in archive.namelist()
    assert 'CenaNuvioResult' in app and 'Continuar assistindo' in app
    assert 'assets/ratings.js' in archive.namelist()
    assert 'data-rating-key' in app
    assert 'assets/similar.js' in archive.namelist() and 'assets/local-ai.js' in archive.namelist()
    assert 'id="similar-titles"' in app
    assert not any(name.endswith('.gguf') for name in archive.namelist())
    assert archive.getinfo('lib/arm64-v8a/libcenallm.so').file_size > 1000000
    assert all(name.split('/')[1]=='arm64-v8a' for name in archive.namelist() if name.startswith('lib/') and name.endswith('.so'))
    assert apk.stat().st_size < 65_000_000, 'Mobile APK should exclude emulator ABIs and unused symbols'
    print('APK size bytes:',apk.stat().st_size)
    for entry in sorted(archive.infolist(),key=lambda value:value.file_size,reverse=True)[:10]: print('APK component:',entry.filename,'bytes:',entry.file_size,'stored:',entry.compress_size)
    assert 'assets/licenses/llama.cpp.txt' in archive.namelist()
    model = json.loads(archive.read('assets/models/model-info.json'))
tools = sorted(Path(os.environ['ANDROID_HOME']).glob('build-tools/*/aapt'))
assert tools
badging = subprocess.check_output([str(tools[-1]), 'dump', 'badging', str(apk)], text=True).splitlines()[0]
expected_package = sys.argv[2] if len(sys.argv)>2 else "app.cena.mobile"
assert expected_package in {"app.cena.mobile","app.cena.mobile.next"}
assert f"name='{expected_package}'" in badging
assert "versionName='0.28.8'" in badging and "versionCode='75'" in badging
assert any('application-icon' in line for line in subprocess.check_output([str(tools[-1]), 'dump', 'badging', str(apk)], text=True).splitlines()), 'Launcher icon must be packaged.'
print('Verified packaged APK:', badging, 'model bytes:', model['size'])

