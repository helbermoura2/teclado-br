#!/usr/bin/env python3
"""Apply the small, auditable Teclado BR overlay to the pinned HeliBoard tree."""
# SPDX-License-Identifier: GPL-3.0-only
import json
from pathlib import Path
import shutil
import sys
import xml.etree.ElementTree as ET

here = Path(__file__).resolve().parent
root = Path(sys.argv[1]).resolve()
lock = json.loads((here / 'upstream.json').read_text())
def replace(path, old, new):
    file = root / path
    text = file.read_text()
    assert text.count(old) == 1, f'Upstream changed: {path}: {old!r}'
    file.write_text(text.replace(old, new))

replace('app/build.gradle.kts', 'applicationId = "helium314.keyboard"', 'applicationId = "br.com.tecladobr.heli"')
replace('app/build.gradle.kts', 'versionCode = 3603', 'versionCode = 7020')
replace('app/build.gradle.kts', 'android {', 'android {\n    signingConfigs.getByName("debug") {\n        storeFile = File(System.getenv("HOME") ?: System.getProperty("user.home"), ".android/debug.keystore")\n        storePassword = "android"\n        keyAlias = "androiddebugkey"\n        keyPassword = "android"\n    }')
replace('app/build.gradle.kts', 'versionName = "3.6"', 'versionName = "0.7.2-heli3.6"')
replace('app/build.gradle.kts', 'listOf("armeabi-v7a", "arm64-v8a", "x86", "x86_64")', 'listOf("arm64-v8a", "x86_64")')
replace('app/src/main/java/helium314/keyboard/latin/App.kt', '        AppUpgrade.transferOldPinnedClips(this) // todo: remove in a few months, maybe mid 2026', '        AppUpgrade.transferOldPinnedClips(this) // todo: remove in a few months, maybe mid 2026\n        configureTecladoBr(this)\n        SubtypeSettings.reloadEnabledSubtypes(this)')
replace('app/src/main/res/values/donottranslate.xml', '<item>qwerty</item>', '<item>qwerty</item>\n        <item>tecladobr</item>')
replace('app/src/main/res/values/donottranslate.xml', '<item>QWERTY</item>', '<item>QWERTY</item>\n        <item>Português BR</item>')
shutil.copyfile(here/'overlay/TecladoBrDefaults.kt', root/'app/src/main/java/helium314/keyboard/latin/TecladoBrDefaults.kt')
layout = root/'app/src/main/assets/layouts/main/tecladobr.txt'
layout.write_text('q\nw\ne\nr\nt\ny\nu\ni\no\np\n\na\ns\nd\nf\ng\nh\nj\nk\nl\n\nz\nx\nc\nv\nb\nn\nm\n')
# Put the native emoji key immediately after 123, preserving the globe.
functional = root/'app/src/main/assets/layouts/functional/functional_keys.json'
rows = json.loads(functional.read_text())
emoji = rows[1].pop(3)
assert 'emojiKeyEnabled' in emoji
rows[1].insert(1, emoji)
functional.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
# Visual resources only: the input engine and touch dispatch stay upstream.
replace('app/src/main/res/values/config.xml', '<fraction name="config_key_vertical_gap_holo">6.127%p</fraction>', '<fraction name="config_key_vertical_gap_holo">4.6%p</fraction>')
replace('app/src/main/res/values/config.xml', '<fraction name="config_key_horizontal_gap_holo">1.739%p</fraction>', '<fraction name="config_key_horizontal_gap_holo">1.35%p</fraction>')
replace('app/src/main/res/values/config.xml', '<fraction name="config_key_hint_letter_ratio_lxx">25%</fraction>', '<fraction name="config_key_hint_letter_ratio_lxx">16%</fraction>')
for name in ('btn_keyboard_key_normal_lxx_base_border.xml', 'btn_keyboard_key_pressed_lxx_base_border.xml'):
    file = root/'app/src/main/res/drawable'/name
    file.write_text(file.read_text().replace('5dp', '7dp'))
replace('app/src/main/java/helium314/keyboard/keyboard/KeyboardView.java',
    '        mTypeface = Settings.getInstance().getCustomTypeface();',
    '        final Typeface customTypeface = Settings.getInstance().getCustomTypeface();\n        mTypeface = customTypeface != null ? customTypeface : Typeface.create("sans-serif-condensed", Typeface.NORMAL);')
# Keep PT-BR and English data in this trial; other languages remain importable.
for dictionary in (root/'app/src/main/assets/dicts').glob('main_*.dict'):
    if dictionary.name not in ('main_pt-BR.dict', 'main_en-US.dict'):
        dictionary.unlink()
# Preserve authors/license notices. Mark the variant distinctly in every translated label.
for directory in (root/'app/src').glob('*/res/values*'):
    for file in directory.glob('*.xml'):
        text = file.read_text()
        import re
        text = re.sub(r'(<string\b[^>]*\bname="english_ime_name"[^>]*>).*?(</string>)',
                      r'\1Teclado BR · Heli teste\2', text, flags=re.S)
        text = text.replace('helium314.keyboard.debug.clipprovider', 'br.com.tecladobr.heli.debug.clipprovider')
        text = text.replace('helium314.keyboard.debug.provider', 'br.com.tecladobr.heli.debug.provider')
        file.write_text(text)
# Add a separate-process editor and framework instrumentation to the trial build only.
source = root/'app/src/debugNoMinify/java/br/com/tecladobr/heli/testing'
source.mkdir(parents=True, exist_ok=True)
for name in ('TrialEditor.java', 'HeliTrialInstrumentation.java'):
    if (here/'overlay'/name).exists(): shutil.copyfile(here/'overlay'/name, source/name)
manifest = root/'app/src/debugNoMinify/AndroidManifest.xml'
manifest.write_text('''<manifest xmlns:android="http://schemas.android.com/apk/res/android">
<instrumentation android:name="br.com.tecladobr.heli.testing.HeliTrialInstrumentation" android:targetPackage="br.com.tecladobr.heli.debug" android:functionalTest="true"/>
<application><activity android:name="br.com.tecladobr.heli.testing.TrialEditor" android:exported="true" android:process=":typing" android:theme="@android:style/Theme.Material.NoActionBar" android:windowSoftInputMode="adjustResize"/></application>
</manifest>''')
# The complete source archive accompanies every APK; no model is bundled or simulated.
shutil.copyfile(here/'README.md', root/'TECLADO-BR.md')
shutil.copyfile(here/'upstream.json', root/'TECLADO-BR-UPSTREAM.json')

# Native toolbar language switch, including all three icon styles.
replace('app/src/main/java/helium314/keyboard/latin/utils/ToolbarUtils.kt',
    '    EMOJI -> KeyCode.EMOJI', '    LANGUAGE -> KeyCode.LANGUAGE_SWITCH\n    EMOJI -> KeyCode.EMOJI')
replace('app/src/main/java/helium314/keyboard/latin/utils/ToolbarUtils.kt',
    '    PAGE_UP, PAGE_DOWN, FULL_LEFT, FULL_RIGHT, PAGE_START, PAGE_END\n}',
    '    PAGE_UP, PAGE_DOWN, FULL_LEFT, FULL_RIGHT, PAGE_START, PAGE_END, LANGUAGE\n}')
for style, drawable in [('holo', 'sym_keyboard_language_switch'), ('lxx', 'sym_keyboard_language_switch_lxx'), ('rounded', 'sym_keyboard_language_switch_lxx')]:
    replace('app/src/main/java/helium314/keyboard/keyboard/internal/KeyboardIconsSet.kt',
        f'                    ToolbarKey.EMOJI -> R.drawable.sym_keyboard_smiley_{style}',
        f'                    ToolbarKey.LANGUAGE -> R.drawable.{drawable}\n                    ToolbarKey.EMOJI -> R.drawable.sym_keyboard_smiley_{style}')
strings = root/'app/src/main/res/values/strings.xml'
strings.write_text(strings.read_text().replace('</resources>', '<string name="language">Idiomas</string>\n</resources>'))
# Keep the typed word visible so an unknown word can be saved explicitly.
replace('app/src/main/java/helium314/keyboard/latin/suggestions/SuggestionStripLayoutHelper.java',
    'settingsValues.mGestureFloatingPreviewTextEnabled, true);',
    'settingsValues.mGestureFloatingPreviewTextEnabled, suggestedWords.mInputStyle != SuggestedWords.INPUT_STYLE_TYPING);')
# Explicit, user-triggered personal dictionary entry from a suggested word.
strip = root/'app/src/main/java/helium314/keyboard/latin/suggestions/SuggestionStripView.kt'
text = strip.read_text()
start = text.index('    private fun onLongClickSuggestion(wordView: TextView): Boolean {')
end = text.index('    private fun showMoreSuggestions(): Boolean {', start)
text = text[:start] + '''    private fun onLongClickSuggestion(wordView: TextView): Boolean {
        val wordIndex = wordView.tag as? Int
        val word = if (wordIndex != null && wordIndex < suggestedWords.size()) suggestedWords.getInfo(wordIndex).mWord else wordView.text.toString().trim()
        if (word.isEmpty()) return false
        android.widget.PopupMenu(context, wordView).apply {
            menu.add("Adicionar ao dicionário").setOnMenuItemClickListener {
                try {
                    android.provider.UserDictionary.Words.addWord(context, word, 250, null, Settings.getValues().mLocale)
                    android.widget.Toast.makeText(context, "Palavra adicionada: $word", android.widget.Toast.LENGTH_SHORT).show()
                } catch (e: SecurityException) {
                    android.widget.Toast.makeText(context, "Abra Configurações > Correção de texto > Dicionário pessoal", android.widget.Toast.LENGTH_LONG).show()
                }
                true
            }
            menu.add("Mais sugestões").setOnMenuItemClickListener { showMoreSuggestions(); true }
            val index = wordView.tag as? Int
            if (index != null && index < suggestedWords.size() && suggestedWords.getInfo(index).mSourceDict != Dictionary.DICTIONARY_USER_TYPED)
                menu.add("Remover sugestão").setOnMenuItemClickListener { removeSuggestion(wordView); true }
            show()
        }
        return true
    }

''' + text[end:]
strip.write_text(text)

# A visible editor-word action remains available even when the typed token is absent
# from native candidates (e.g. elongated informal spellings).
shutil.copyfile(here/'overlay/PersonalWords.java', root/'app/src/main/java/helium314/keyboard/latin/PersonalWords.java')
replace('app/src/main/res/layout/suggestions_strip.xml',
    '        <LinearLayout\n            android:id="@+id/pinned_keys"',
    '\n        <TextView android:id="@+id/teclado_add_word" android:layout_width="40dp" android:layout_height="match_parent" android:gravity="center" android:text="＋" android:textSize="26sp" android:contentDescription="Adicionar palavra ao dicionário" android:focusable="true" android:clickable="true"/>\n        <LinearLayout\n            android:id="@+id/pinned_keys"')
replace('app/src/main/java/helium314/keyboard/latin/suggestions/SuggestionStripView.kt',
    '        toolbarExpandKey.scaleX = (if (toolbarVisible && !locked) -1f else 1f) * direction',
    '        findViewById<TextView>(R.id.teclado_add_word).apply {\n            isVisible = !locked && !toolbarVisible && !Settings.getValues().mIncognitoModeEnabled\n            setTextColor(Settings.getValues().mColors.get(ColorType.KEY_TEXT))\n            setOnClickListener { listener.onCodeInput(-11051, 0, 0, false) }\n        }\n        toolbarExpandKey.scaleX = (if (toolbarVisible && !locked) -1f else 1f) * direction')
replace('app/src/main/java/helium314/keyboard/latin/LatinIME.java',
    '    public void onEvent(@NonNull final Event event) {',
    '    public void onEvent(@NonNull final Event event) {\n        if (event.getKeyCode() == -11051) { PersonalWords.open(this, mInputView.findViewById(R.id.teclado_add_word)); return; }')

# Materialize punctuation spacing immediately, rather than upstream phantom spacing.
logic = root/'app/src/main/java/helium314/keyboard/latin/inputlogic/InputLogic.java'
text = logic.read_text()
assert text.count('    public void startInput(final String combiningSpec, final SettingsValues settingsValues) {') == 1
text = text.replace('    public void startInput(final String combiningSpec, final SettingsValues settingsValues) {',
    '    private int mTecladoBrAutoSpacePosition = -1;\n\n    public void startInput(final String combiningSpec, final SettingsValues settingsValues) {\n        mTecladoBrAutoSpacePosition = -1;')
text = text.replace('        final Event processedEvent = mWordComposer.processEvent(event);',
    '        prepareTecladoBrAutoSpace(event);\n        final Event processedEvent = mWordComposer.processEvent(event);')
old = '            mConnection.commitCodePoint(codePoint);\n\n            if (isInlineEmojiSearchAction()) {'
assert text.count(old) == 1
text = text.replace(old, '            mConnection.commitCodePoint(codePoint);\n            insertTecladoBrPunctuationSpace(codePoint, settingsValues);\n\n            if (isInlineEmojiSearchAction()) {')
methods = '''    // Track only the space inserted by this feature, never arbitrary user whitespace.
    private void prepareTecladoBrAutoSpace(final Event event) {
        if (mTecladoBrAutoSpacePosition >= 0
                && mConnection.getExpectedSelectionStart() == mTecladoBrAutoSpacePosition
                && mConnection.getExpectedSelectionEnd() == mTecladoBrAutoSpacePosition
                && mConnection.getCodePointBeforeCursor() == Constants.CODE_SPACE) {
            final int cp = event.getCodePoint();
            if (cp == Constants.CODE_SPACE || cp == Constants.CODE_ENTER
                    || (cp >= 0 && ".,!?;:)]}\\\"".indexOf(cp) >= 0)) {
                mConnection.beginBatchEdit();
                mConnection.deleteTextBeforeCursor(1);
                mConnection.endBatchEdit();
            }
        }
        mTecladoBrAutoSpacePosition = -1;
    }

    private void insertTecladoBrPunctuationSpace(final int cp, final SettingsValues settings) {
        if (!helium314.keyboard.latin.BuildConfig.BUILD_TYPE.equals("debugNoMinify")
                || !settings.mAutospaceAfterPunctuation
                || !settings.mInputAttributes.mShouldInsertSpacesAutomatically
                || settings.mInputAttributes.mIsPasswordField
                || cp < 0 || ".,!?;:".indexOf(cp) < 0) return;
        final CharSequence before = mConnection.getTextBeforeCursor(96, 0);
        if (before == null || before.length() < 2) return;
        final char previous = before.charAt(before.length() - 2);
        if (!Character.isLetter(previous) && ".,!?;:".indexOf(previous) < 0) return;
        final String token = before.toString().substring(0, before.length() - 1);
        final int boundary = Math.max(token.lastIndexOf(' '), token.lastIndexOf('\\n'));
        final String current = token.substring(boundary + 1);
        if (current.indexOf('@') >= 0 || current.indexOf('/') >= 0 || current.contains("://")) return;
        mConnection.commitCodePoint(Constants.CODE_SPACE);
        mSpaceState = SpaceState.NONE;
        mTecladoBrAutoSpacePosition = mConnection.getExpectedSelectionStart();
    }

'''
text = text.replace('    private void handleSeparatorEvent(final Event event, final InputTransaction inputTransaction,',
    methods + '    private void handleSeparatorEvent(final Event event, final InputTransaction inputTransaction,')
logic.write_text(text)

# Offline writing workspace and native runtime. No INTERNET permission is added.
replace('app/build.gradle.kts', 'minSdk = 21', 'minSdk = 26')
ai_java = root/'app/src/main/java/helium314/keyboard/latin/ai'
shutil.copytree(here/'ai/java', ai_java, dirs_exist_ok=True)
shutil.copytree(here/'ai/native', root/'ai-native', dirs_exist_ok=True)
shutil.copyfile(root/'ai-native/llama.cpp/LICENSE', root/'app/src/main/assets/TECLADO-BR-LLAMA-LICENSE.txt')
replace('app/src/main/java/helium314/keyboard/latin/utils/ToolbarUtils.kt',
    '    LANGUAGE -> KeyCode.LANGUAGE_SWITCH', '    AI -> -11050\n    LANGUAGE -> KeyCode.LANGUAGE_SWITCH')
replace('app/src/main/java/helium314/keyboard/latin/utils/ToolbarUtils.kt',
    'PAGE_START, PAGE_END, LANGUAGE\n}', 'PAGE_START, PAGE_END, LANGUAGE, AI\n}')
for style in ('holo', 'lxx', 'rounded'):
    replace('app/src/main/java/helium314/keyboard/keyboard/internal/KeyboardIconsSet.kt',
        f'                    ToolbarKey.EMOJI -> R.drawable.sym_keyboard_smiley_{style}',
        f'                    ToolbarKey.AI -> R.drawable.teclado_br_ai\n                    ToolbarKey.EMOJI -> R.drawable.sym_keyboard_smiley_{style}')
(root/'app/src/main/res/drawable/teclado_br_ai.xml').write_text('''<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:fillColor="#FFFFFFFF" android:pathData="M12,2 L14.8,9.2 L22,12 L14.8,14.8 L12,22 L9.2,14.8 L2,12 L9.2,9.2 Z M21,1 L21.8,3.2 L24,4 L21.8,4.8 L21,7 L20.2,4.8 L18,4 L20.2,3.2 Z"/></vector>''')
strings = root/'app/src/main/res/values/strings.xml'
strings.write_text(strings.read_text().replace('</resources>', '<string name="ai">Assistente de escrita offline</string>\n</resources>'))
replace('app/src/main/java/helium314/keyboard/latin/inputlogic/InputLogic.java',
    '            case KeyCode.LANGUAGE_SWITCH:',
    '            case -11050:\n                helium314.keyboard.latin.ai.WritingLauncher.open(mLatinIME);\n                break;\n            case KeyCode.LANGUAGE_SWITCH:')
manifest = root/'app/src/main/AndroidManifest.xml'
manifest.write_text(manifest.read_text().replace('        <!-- Services -->', '''        <activity android:name=".ai.ModelSettingsActivity" android:exported="false"
            android:directBootAware="false" android:excludeFromRecents="true"
            android:theme="@android:style/Theme.Material.NoActionBar"/>
        <service android:name=".ai.WritingEngineService" android:exported="false"
            android:process=":writing" android:directBootAware="false"/>
        <!-- Services -->'''))
# Overlay stays inside the existing IME window, preserving the current app/input connection.
replace('app/src/main/java/helium314/keyboard/latin/LatinIME.java',
    '    public void onEvent(@NonNull final Event event) {',
    '    public void onEvent(@NonNull final Event event) {\n        if (helium314.keyboard.latin.ai.WritingPanel.key(event)) { mKeyboardSwitcher.onEvent(event, 0, 0); return; }')
replace('app/src/main/java/helium314/keyboard/latin/LatinIME.java',
    '    public void onTextInput(final String rawText) {',
    '    public void onTextInput(final String rawText) {\n        if (helium314.keyboard.latin.ai.WritingPanel.text(rawText)) return;')
replace('app/src/main/java/helium314/keyboard/latin/LatinIME.java',
    '    public int getCurrentAutoCapsState() {',
    '    public int getCurrentAutoCapsState() {\n        if (helium314.keyboard.latin.ai.WritingPanel.isEditing()) return 0;')
replace('app/src/main/java/helium314/keyboard/latin/LatinIME.java',
    '    public int getCurrentRecapitalizeState() {',
    '    public int getCurrentRecapitalizeState() {\n        if (helium314.keyboard.latin.ai.WritingPanel.isEditing()) return 0;')
replace('app/src/main/java/helium314/keyboard/latin/LatinIME.java',
    '        super.onComputeInsets(outInsets);',
    '        super.onComputeInsets(outInsets);\n        if (mInputView != null && helium314.keyboard.latin.ai.WritingPanel.insets(outInsets, mInputView)) { if (mInsetsUpdater != null) mInsetsUpdater.setInsets(outInsets); return; }')
replace('app/src/main/java/helium314/keyboard/latin/InputView.java',
    '    public boolean onInterceptTouchEvent(final MotionEvent me) {',
    '    public boolean onInterceptTouchEvent(final MotionEvent me) {\n        if (helium314.keyboard.latin.ai.WritingPanel.isActive()) { mActiveForwarder = null; return false; }')
replace('app/src/main/java/helium314/keyboard/latin/LatinIME.java',
    '\n    public void onStartInput(final EditorInfo editorInfo, final boolean restarting) {',
    '\n    public void onStartInput(final EditorInfo editorInfo, final boolean restarting) {\n        helium314.keyboard.latin.ai.WritingPanel.onStart(editorInfo, restarting);')
for method in ('onFinishInputView(final boolean finishingInput)', 'onFinishInput()', 'onDestroy()'):
    replace('app/src/main/java/helium314/keyboard/latin/LatinIME.java',
        '\n    public void ' + method + ' {',
        '\n    public void ' + method + ' {\n        helium314.keyboard.latin.ai.WritingPanel.dismiss();')
for method in ('onStartBatchInput()', 'onUpdateBatchInput(final InputPointers batchPointers)',
               'onEndBatchInput(final InputPointers batchPointers)', 'onCancelBatchInput()'):
    replace('app/src/main/java/helium314/keyboard/latin/LatinIME.java',
        '\n    public void ' + method + ' {',
        '\n    public void ' + method + ' {\n        if (helium314.keyboard.latin.ai.WritingPanel.isEditing()) return;')
replace('app/src/main/java/helium314/keyboard/latin/LatinIME.java',
    '    private View mInputView;',
    '    private View mInputView;\n    public View getTecladoInputView() { return mInputView; }\n    public void prepareTecladoWriting() { mInputLogic.finishInput(); mHandler.cancelUpdateSuggestionStrip(); }')
shutil.copytree(here, root/'teclado-br-overlay', dirs_exist_ok=True)
print('Prepared', lock['trial_version'], 'from', lock['commit'])
