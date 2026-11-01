"""Download public MIT CLIP weights for bundling. No inference API or credentials."""
import hashlib
import json
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[1]
destination = root / 'android/app/src/main/assets/models'
destination.mkdir(parents=True, exist_ok=True)
headers = {'User-Agent': 'CENA/0.4 (https://github.com/helbermoura2/teclado-br)'}

def read(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as response:
        return response.read()

metadata = json.loads(read('https://huggingface.co/api/models/Xenova/clip-vit-base-patch32?blobs=true'))
assert metadata.get('cardData', {}).get('license') == 'mit', 'Model license must remain MIT.'
revision = metadata['sha']
entry = next(row for row in metadata['siblings'] if row['rfilename'] == 'onnx/vision_model_quantized.onnx')
expected = entry['lfs']['sha256']
size = entry['lfs']['size']
assert 20_000_000 < size < 180_000_000
target = destination / 'clip-vision.onnx'
digest = hashlib.sha256()
url = f'https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/{revision}/onnx/vision_model_quantized.onnx'
with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=180) as response, target.open('wb') as output:
    while chunk := response.read(1024 * 1024):
        output.write(chunk)
        digest.update(chunk)
assert target.stat().st_size == size and digest.hexdigest() == expected, 'Model download integrity check failed.'
info = {'source': 'Xenova/clip-vit-base-patch32', 'revision': revision, 'sha256': expected, 'size': size, 'license': 'MIT'}
(destination / 'model-info.json').write_text(json.dumps(info, indent=2))
for filename, url in [
    ('CLIP-LICENSE.txt', 'https://raw.githubusercontent.com/openai/CLIP/main/LICENSE'),
    ('ONNXRUNTIME-LICENSE.txt', 'https://raw.githubusercontent.com/microsoft/onnxruntime/main/LICENSE')
]:
    (destination / filename).write_bytes(read(url))
print('Bundled local visual AI:', json.dumps(info))
