#!/usr/bin/env python3
"""Check targeted strip/IME/layout hooks against a clean pinned upstream tree.
This exercises source preparation, not Android compilation or UI execution.
"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from patches import suggestions, assistant, toolbar

STRIP = toolbar.STRIP
IME = toolbar.IME
LAYOUT = 'app/src/main/res/layout/suggestions_strip.xml'
TARGETS = (STRIP, IME, LAYOUT)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('upstream', type=Path, help='Clean HeliBoard source from upstream.json')
    args = parser.parse_args()
    if (args.upstream/'.git').exists():
        revision = subprocess.check_output(['git', '-C', str(args.upstream), 'rev-parse', 'HEAD'], text=True).strip()
        assert revision == json.loads((HERE/'upstream.json').read_text())['commit'], 'Wrong upstream revision'
    with tempfile.TemporaryDirectory(prefix='teclado-toolbar-hooks-') as temp:
        root = Path(temp)
        for name in TARGETS:
            target = root/name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(args.upstream/name, target)
        for name, text in {
            'app/src/main/res/values/strings.xml': '<resources/>',
            'app/src/main/AndroidManifest.xml': '<manifest/>',
            'ai-native/llama.cpp/LICENSE': 'Fixture: no native library is built by this check.',
        }.items():
            target = root/name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text)
        (root/'app/src/main/res/drawable').mkdir(parents=True)
        (root/'app/src/main/assets').mkdir(parents=True)
        (root/'app/src/main/res/xml').mkdir(parents=True)

        class Context:
            here = HERE
            def __init__(self):
                self.root, self.hooks = root, 0
            def replace(self, name, old, new):
                if name not in TARGETS:
                    return  # Other preparation hooks are outside this focused check.
                target = root/name
                source = target.read_text()
                assert source.count(old) == 1, ('Changed upstream hook', name, old[:180])
                target.write_text(source.replace(old, new))
                self.hooks += 1

        context = Context()
        for module in (suggestions, assistant, toolbar):
            module.apply(context)
        strip = (root/STRIP).read_text()
        assert strip.index('private val toolbarState') < strip.index('// expand key')
        assert 'toolbarManuallyExpanded' not in strip
        assert 'pinnedKeys.visibility = GONE' in strip
        assert 'pinnedKeys.isVisible = false' in strip
        assert 'toolbarState.isShortcutsVisible() else requestedVisible' in strip
        assert 'toolbarState.input(text)' in strip
        ime = (root/IME).read_text()
        assert 'onKeyboardInput();' not in ime
        assert 'onKeyboardInput(event.getCodePoint())' in ime
        assert 'completeInputTransaction.didAffectContents()' in ime
        assert 'event.getKeyCode() == KeyCode.UNDO || event.getKeyCode() == KeyCode.REDO' in ime
        layout = ET.parse(root/LAYOUT)
        android = '{http://schemas.android.com/apk/res/android}'
        container = next(v for v in layout.iter() if v.get(android+'id') == '@+id/toolbar_container')
        assert container.get(android+'layout_width') == '0dp'
        assert container.get(android+'layout_weight') == '1'
        assert next(v for v in layout.iter() if v.get(android+'id') == '@+id/teclado_add_word') is not None
        print(f'Toolbar hooks: {context.hooks} unique anchors; initialization, input routing and XML width checked')


if __name__ == '__main__':
    main()
