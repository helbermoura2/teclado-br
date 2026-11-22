#!/usr/bin/env bash
set -euo pipefail
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell am instrument -w -r -e class app.cena.StreamingPolicyTest,app.cena.CoverLayoutTest,app.cena.CoverRecognitionTest app.cena.mobile.test/androidx.test.runner.AndroidJUnitRunner > /tmp/cena-regional-titles-android.txt
cat /tmp/cena-regional-titles-android.txt
python3 - <<'PY'
from pathlib import Path
import re
text=Path('/tmp/cena-regional-titles-android.txt').read_text()
assert re.search(r'OK \(9 tests\)',text), 'Regional title policy and JavaScript bridge tests did not finish successfully'
assert 'INSTRUMENTATION_FAILED' not in text and 'FAILURES!!!' not in text
PY

mkdir -p ../qa
adb shell run-as app.cena.mobile cat files/native-cover-layout.json > ../qa/native-cover-layout.json
node ../scripts/check-native-cover-layout.mjs

adb shell run-as app.cena.mobile cat files/native-ocr.json > ../qa/native-ocr.json
(cd .. && node scripts/check-native-cover-identification.mjs)
