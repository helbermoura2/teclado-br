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
        '''    // In compact mode, suggestions take the entire available strip
    // while typing. When selection starts, editing tools take priority.
    // The native ⋯ expands all original actions without disabling them.
    private var tecladoBrHasSelection = false
    private var tecladoBrHasPredictions = false

    private fun tecladoBrApplyStripVisibility() {
        if (!context.prefs().getBoolean("teclado_br_compact_toolbar_active", false)
                || isDeviceLocked(context) || toolbarContainer.isVisible) return
        pinnedKeys.isVisible = tecladoBrHasSelection || !tecladoBrHasPredictions
        suggestionsStrip.isVisible = !tecladoBrHasSelection
    }

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
        tecladoBrApplyStripVisibility()
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
    # Predictions must be given all the horizontal space, before the
    # native layout helper truncates word candidates. The state can change
    # without toggling the native expanded editing menu.
    content = replace_once(content,
        '''        toolbarExpandKey.scaleX = (if (toolbarVisible && !locked) -1f else 1f) * direction
    }''',
        '''        toolbarExpandKey.scaleX = (if (toolbarVisible && !locked) -1f else 1f) * direction
        tecladoBrApplyStripVisibility()
    }''',
        'SuggestionStripView setToolbarVisibility')
    content = replace_once(content,
        '''        suggestedWords = suggestions
        startIndexOfMoreSuggestions = layoutHelper.layoutAndReturnStartIndexOfMoreSuggestions(''',
        '''        suggestedWords = suggestions
        tecladoBrHasPredictions = suggestions.getWordCountToShow() > 0
        tecladoBrApplyStripVisibility()
        startIndexOfMoreSuggestions = layoutHelper.layoutAndReturnStartIndexOfMoreSuggestions(''',
        'SuggestionStripView prepare full-width predictions')
    content = replace_once(content,
        '''        isExternalSuggestionVisible = false
        updateKeys()
    }

    fun setExternalSuggestionView''',
        '''        isExternalSuggestionVisible = false
        updateKeys()
        // updateKeys resets visibility, so reapply the compact row priority.
        tecladoBrApplyStripVisibility()
    }

    fun setExternalSuggestionView''',
        'SuggestionStripView retain prediction priority')
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
