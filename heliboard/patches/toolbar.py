# SPDX-License-Identifier: GPL-3.0-only
"""Teclado BR compact toolbar overflow and selection-context overlay.

Applied only to the pinned HeliBoard v3.6 tree after AI shortcuts exist.
When disabled, the original HeliBoard suggestion strip is unchanged.
"""
def apply(context):
    strip = context.root / 'app/src/main/java/helium314/keyboard/latin/suggestions/SuggestionStripView.kt'
    ime = context.root / 'app/src/main/java/helium314/keyboard/latin/LatinIME.java'

    def replace_once(text, old, new, where):
        count = text.count(old)
        if count != 1:
            raise RuntimeError('Teclado BR toolbar anchor changed: %s (%d matches)' % (where, count))
        return text.replace(old, new, 1)

    content = strip.read_text()
    content = replace_once(content,
        '    private lateinit var listener: Listener',
        '''    // In compact mode only pinned favorites are shown. The expand key
    // opens the original full toolbar, including all editing shortcuts.
    // A nonempty selection temporarily shows context-appropriate editing
    // commands; it does not alter any stored toolbar preference.
    private var tecladoBrHasSelection = false

    fun updateTecladoBrSelection(hasSelection: Boolean) {
        if (!context.prefs().getBoolean("teclado_br_compact_toolbar_active", false)
                || tecladoBrHasSelection == hasSelection) return
        tecladoBrHasSelection = hasSelection
        if (Settings.getValues().mSuggestionStripHiddenPerUserSettings) return
        pinnedKeys.removeAllViews()
        val keys = if (hasSelection) listOf(ToolbarKey.SELECT_ALL,
            ToolbarKey.COPY, ToolbarKey.CUT, ToolbarKey.PASTE)
            else getPinnedToolbarKeys(context.prefs())
        val colors = Settings.getValues().mColors
        for (key in keys) {
            val button = createToolbarKey(context, key)
            button.layoutParams = toolbarKeyLayoutParams
            setupKey(button, colors)
            pinnedKeys.addView(button)
        }
    }

    private lateinit var listener: Listener''',
        'SuggestionStripView selection method')
    content = replace_once(content,
        '            toolbarExpandKey.setImageDrawable(toolbarArrowIcon)',
        '''            val compact = context.prefs().getBoolean("teclado_br_compact_toolbar_active", false)
            toolbarExpandKey.setImageDrawable(if (compact)
                context.getDrawable(R.drawable.teclado_br_more) else toolbarArrowIcon)
            if (compact) toolbarExpandKey.contentDescription = "Mais ferramentas de edição"''',
        'SuggestionStripView expand icon')
    strip.write_text(content)

    content = ime.read_text()
    content = replace_once(content,
        '        final SettingsValues settingsValues = mSettings.getCurrent();\n        if (isInputViewShown()\n                && mInputLogic.onUpdateSelection',
        '''        // Selection-state callback is only a view update: no text is
        // accessed or sent anywhere and the editor remains authoritative.
        if (isInputViewShown() && hasSuggestionStripView()) {
            mSuggestionStripView.updateTecladoBrSelection(
                    newSelStart >= 0 && newSelEnd >= 0 && newSelStart != newSelEnd);
        }
        final SettingsValues settingsValues = mSettings.getCurrent();
        if (isInputViewShown()
                && mInputLogic.onUpdateSelection''',
        'LatinIME selection callback')
    ime.write_text(content)
