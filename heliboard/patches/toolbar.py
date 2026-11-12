# SPDX-License-Identifier: GPL-3.0-only
"""Word-only content during prose; shortcuts after a terminal period."""
import shutil

STRIP = 'app/src/main/java/helium314/keyboard/latin/suggestions/SuggestionStripView.kt'
IME = 'app/src/main/java/helium314/keyboard/latin/LatinIME.java'


def apply(context):
    root, here, replace = context.root, context.here, context.replace
    shutil.copyfile(here/'overlay/ToolbarState.java', root/'app/src/main/java/helium314/keyboard/latin/suggestions/ToolbarState.java')
    # Must exist before the upstream toolbar init block first renders the views.
    replace(STRIP, '    private val toolbar: ViewGroup = findViewById(R.id.toolbar)',
            '    private val toolbarState = ToolbarState()\n    private val toolbar: ViewGroup = findViewById(R.id.toolbar)')
    previous = ('    private var toolbarManuallyExpanded = false\n'
                '    fun onKeyboardInput() { toolbarManuallyExpanded = false; if (Settings.getValues().mAutoHideToolbar && Settings.getValues().isSuggestionsEnabledPerUserSettings()) setToolbarVisibility(false) }\n'
                '    fun hideToolbarForSuggestions() { if (!toolbarManuallyExpanded) setToolbarVisibility(false) }')
    methods = '''    private fun automaticToolbar(): Boolean {
        val settings = Settings.getValues()
        return settings.mToolbarMode == ToolbarMode.EXPANDABLE && settings.mAutoHideToolbar && settings.isSuggestionsEnabledPerUserSettings()
    }
    private fun renderToolbarModeIfChanged() {
        if (automaticToolbar() && toolbarContainer.isVisible != toolbarState.isShortcutsVisible()) setToolbarVisibility(toolbarState.isShortcutsVisible())
    }
    fun onKeyboardInput(codePoint: Int) {
        toolbarState.input(codePoint)
        renderToolbarModeIfChanged()
    }
    fun onKeyboardText(text: CharSequence?) {
        toolbarState.input(text)
        renderToolbarModeIfChanged()
    }
    fun syncToolbarContext(beforeCursor: CharSequence?) {
        toolbarState.syncContext(beforeCursor)
        renderToolbarModeIfChanged()
    }
    fun beginToolbarContext(beforeCursor: CharSequence?) {
        toolbarState.reset()
        syncToolbarContext(beforeCursor)
    }
    fun requestToolbarVisibility(expanded: Boolean) {
        toolbarState.setManualExpanded(expanded)
        setToolbarVisibility(expanded)
    }
    // Dictionary results update words, never the user's current toolbar mode.
    fun hideToolbarForSuggestions() { setToolbarVisibility(false) }'''
    replace(STRIP, previous, methods)
    replace(STRIP, '    fun setToolbarVisibility(toolbarVisible: Boolean) {',
            '    fun setToolbarVisibility(requestedVisible: Boolean) {\n        val toolbarVisible = if (automaticToolbar()) toolbarState.isShortcutsVisible() else requestedVisible')
    replace('app/src/main/res/layout/suggestions_strip.xml',
            'android:id="@+id/toolbar_container"\n            android:layout_width="match_parent"',
            'android:id="@+id/toolbar_container"\n            android:layout_width="0dp"\n            android:layout_weight="1"')
    # Only the small navigation handle remains in the word row, as in the reference.
    # Dictionary + is available upon manual expansion and long-press remains available.
    replace(STRIP, 'pinnedKeys.isVisible = !locked && !toolbarVisible', 'pinnedKeys.isVisible = false')
    replace(STRIP, 'isVisible = !locked && !toolbarVisible && !Settings.getValues().mIncognitoModeEnabled',
            'isVisible = !locked && toolbarVisible && !Settings.getValues().mIncognitoModeEnabled')
    replace(STRIP, 'pinnedKeys.visibility = if (hideToolbarKeys) GONE else suggestionsStrip.visibility', 'pinnedKeys.visibility = GONE')
    replace(STRIP, '        isExternalSuggestionVisible = false\n    }\n\n    private fun addKeyToPinnedKeys',
            '        isExternalSuggestionVisible = false\n        setToolbarVisibility(toolbarContainer.isVisible)\n    }\n\n    private fun addKeyToPinnedKeys')
    replace(STRIP, '            toolbarManuallyExpanded = toolbarContainer.visibility != VISIBLE\n            setToolbarVisibility(toolbarManuallyExpanded)',
            '            requestToolbarVisibility(toolbarContainer.visibility != VISIBLE)')
    replace(STRIP, '            suggestionsStrip.visibility = visibility',
            '            suggestionsStrip.visibility = if (visibility == VISIBLE && toolbarContainer.isVisible) GONE else visibility')
    replace(STRIP, '        suggestionsStrip.isVisible = true\n\n        // Show the toolbar',
            '        setToolbarVisibility(false)\n\n        // Show the toolbar')
    replace(STRIP, '            listener.pickSuggestionManually(wordInfo)',
            '            onKeyboardText(wordInfo.mWord)\n            listener.pickSuggestionManually(wordInfo)')
    replace(STRIP, '{ listener.pickSuggestionManually(info) },',
            '{ onKeyboardText(word); listener.pickSuggestionManually(info) },')

    # Only actual edits affect the editor toolbar; local AI prompt typing is separate.
    replace(IME, '        if (mSuggestionStripView != null && (event.getCodePoint() >= 0 || event.getKeyCode() == KeyCode.DELETE)) mSuggestionStripView.onKeyboardInput();\n        if (helium314.keyboard.latin.ai.WritingPanel.key(event)) { mKeyboardSwitcher.onEvent(event, 0, 0); return; }',
            '        if (helium314.keyboard.latin.ai.WritingPanel.key(event)) { mKeyboardSwitcher.onEvent(event, 0, 0); return; }\n        if (mSuggestionStripView != null && (event.getCodePoint() >= 0 || event.getKeyCode() == KeyCode.DELETE || event.getKeyCode() == KeyCode.UNDO || event.getKeyCode() == KeyCode.REDO)) mSuggestionStripView.onKeyboardInput(event.getCodePoint());')
    replace(IME, '        if (mSuggestionStripView != null) mSuggestionStripView.onKeyboardInput();\n        if (helium314.keyboard.latin.ai.WritingPanel.text(rawText)) return;',
            '        if (helium314.keyboard.latin.ai.WritingPanel.text(rawText)) return;\n        if (mSuggestionStripView != null) mSuggestionStripView.onKeyboardText(rawText);')
    # Reuse the entry/cursor lifecycle; do not query InputConnection for each letter.
    replace(IME, '        // Set neutral suggestions and show the toolbar if the "Auto show toolbar" setting is enabled.',
            '        if (mSuggestionStripView != null) {\n            final CharSequence before = mInputLogic.mConnection.getTextBeforeCursor(128, 0);\n            if (!restarting) mSuggestionStripView.beginToolbarContext(before);\n            else mSuggestionStripView.syncToolbarContext(before);\n        }\n        // Set neutral suggestions and show the toolbar if the "Auto show toolbar" setting is enabled.')
    replace(IME, '            // we don\'t want to update a manually set shift state if selection changed towards one side',
            '            if (mSuggestionStripView != null && !helium314.keyboard.latin.ai.WritingPanel.isActive()) mSuggestionStripView.syncToolbarContext(mInputLogic.mConnection.getTextBeforeCursor(128, 0));\n            // we don\'t want to update a manually set shift state if selection changed towards one side')
    replace(IME, '                        mKeyboardSwitcher.getKeyboardShiftMode(),\n                        mKeyboardSwitcher.getCurrentKeyboardScript(), mHandler);\n        updateStateAfterInputTransaction(completeInputTransaction);',
            '                        mKeyboardSwitcher.getKeyboardShiftMode(),\n                        mKeyboardSwitcher.getCurrentKeyboardScript(), mHandler);\n        if (event.getCodePoint() < 0 && completeInputTransaction.didAffectContents() && mSuggestionStripView != null) { mSuggestionStripView.onKeyboardInput(-1); mSuggestionStripView.syncToolbarContext(mInputLogic.mConnection.getTextBeforeCursor(128, 0)); }\n        updateStateAfterInputTransaction(completeInputTransaction);')
    replace(IME, '    public void onStartBatchInput() {\n        if (helium314.keyboard.latin.ai.WritingPanel.isEditing()) return;',
            '    public void onStartBatchInput() {\n        if (helium314.keyboard.latin.ai.WritingPanel.isEditing()) return;\n        if (mSuggestionStripView != null) mSuggestionStripView.onKeyboardInput(0);')
