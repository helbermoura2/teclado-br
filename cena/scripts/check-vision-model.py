"""Run the bundled model against the reported photo and the actual catalog posters."""
import base64
import io
import json
import urllib.request
from pathlib import Path
import numpy as np
import onnxruntime as ort
from PIL import Image

root = Path(__file__).resolve().parents[1]
session = ort.InferenceSession(str(root / 'android/app/src/main/assets/models/clip-vision.onnx'), providers=['CPUExecutionProvider'])
assert session.get_inputs()[0].name == 'pixel_values'

def embedding(image):
    image = image.convert('RGB')
    scale = max(224 / image.width, 224 / image.height)
    w, h = max(1, int(224 / scale)), max(1, int(224 / scale))
    left, top = (image.width-w)//2, (image.height-h)//2
    image = image.crop((left, top, left+w, top+h)).resize((224,224), Image.Resampling.BILINEAR)
    pixels = np.asarray(image).astype(np.float32) / 255
    pixels = (pixels - np.array([.48145466,.4578275,.40821073], dtype=np.float32)) / np.array([.26862954,.26130258,.27577711], dtype=np.float32)
    vector = session.run(['image_embeds'], {'pixel_values': pixels.transpose(2,0,1)[None].copy()})[0][0]
    assert vector.shape == (512,) and np.isfinite(vector).all()
    return vector / max(float(np.linalg.norm(vector)), .000001)

photo = Image.open(io.BytesIO(base64.b64decode((root / 'tests/fixtures/marshals-photo.base64').read_text())))
original = embedding(photo)
assert float(np.dot(original, embedding(photo))) > .999
candidates = json.loads((root / 'qa/cover-candidates.json').read_text())
comparisons = []
for item in candidates[:4]:
    if not item.get('poster', '').startswith('https://upload.wikimedia.org/'):
        continue
    try:
        request = urllib.request.Request(item['poster'], headers={'User-Agent': 'CENA/0.4 (https://github.com/helbermoura2/teclado-br)'})
        with urllib.request.urlopen(request, timeout=15) as response:
            reference = Image.open(io.BytesIO(response.read()))
        score = max(0, min(1, float(np.dot(original, embedding(reference)))))
        combined = .75 * item.get('matchScore', .85) + .25 * score
        comparisons.append({'id': item['id'], 'name': item['name'], 'visual': score, 'combined': combined})
    except Exception as error:
        print('Optional poster unavailable:', item['id'], type(error).__name__)
assert any(item['id'] == 'tt0120873' for item in comparisons), 'The reference cover must be available for the photo regression.'
comparisons.sort(key=lambda item: item['combined'], reverse=True)
assert comparisons[0]['id'] == 'tt0120873', 'Visual-assisted ranking must keep the actual photographed film first.'
(root / 'qa/visual-comparison.json').write_text(json.dumps(comparisons, indent=2))
print('Real local visual inference OK:', json.dumps(comparisons))
