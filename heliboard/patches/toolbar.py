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
    # The special '+' key was added by suggestions.py for the PERSONAL
    # DICTIONARY. It is a real action; keep it, but place it in the overflow
    # toolbox in compact mode instead of stealing width from word candidates.
    # Move the existing View, not a copy, so its listener and accessibility
    # name remain intact. The classic theme keeps its original layout.
    content = replace_once(content,
        '''        updateKeys()
    }

    private lateinit var listener: Listener''',
        '''        updateKeys()
        if (context.prefs().getBoolean("teclado_br_compact_toolbar_active", false)) {
            val stripRow = toolbarExpandKey.parent as? LinearLayout
            val dictionary = findViewById<TextView>(R.id.teclado_add_word)
            if (stripRow != null && dictionary != null) {
                (dictionary.parent as? ViewGroup)?.removeView(dictionary)
                toolbar.addView(dictionary, 0, LinearLayout.LayoutParams(
                    42.dpToPx(resources), LinearLayout.LayoutParams.MATCH_PARENT))
                dictionary.isVisible = false

                // The toolbar scroller cannot keep MATCH_PARENT width when
                // the ⋯ toggle is placed AFTER it (Samsung-like placement).
                (toolbarContainer.layoutParams as? LinearLayout.LayoutParams)?.let {
                    it.width = 0
                    it.weight = 1f
                    toolbarContainer.layoutParams = it
                }
                stripRow.removeView(toolbarExpandKey)
                stripRow.addView(toolbarExpandKey)
            }
            tecladoBrRebuildPinnedKeys()
        }
    }

    private lateinit var listener: Listener''',
        'Rearrange compact toolbar right toggle and relocate dictionary action')
    content = replace_once(content,
        '    private lateinit var listener: Listener',
        '''    // Compact shortcuts and suggestions are exclusive, just like on Samsung.
    // No text is read by this view state machine.
    private var tecladoBrHasSelection = false
    private var tecladoBrHasPredictions = false
    private var tecladoBrEditingMode = false

    private fun tecladoBrCompact(): Boolean =
        context.prefs().getBoolean("teclado_br_compact_toolbar_active", false)

    private fun tecladoBrStyleFavorite(button: ImageButton) {
        val background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.rgb(53, 54, 60))
        }
        button.background = android.graphics.drawable.InsetDrawable(
            background, 7.dpToPx(resources), 3.dpToPx(resources),
            7.dpToPx(resources), 3.dpToPx(resources))
        val pad = 11.dpToPx(resources)
        button.setPadding(pad, pad, pad, pad)
    }

    private fun tecladoBrRebuildPinnedKeys() {
        if (!tecladoBrCompact() || Settings.getValues().mSuggestionStripHiddenPerUserSettings)
            return
        pinnedKeys.removeAllViews()
        val keys = when {
            tecladoBrHasSelection -> listOf(ToolbarKey.SELECT_ALL,
                ToolbarKey.COPY, ToolbarKey.CUT, ToolbarKey.PASTE)
            tecladoBrEditingMode -> listOf(ToolbarKey.SELECT_ALL,
                ToolbarKey.COPY, ToolbarKey.CUT, ToolbarKey.PASTE,
                ToolbarKey.UNDO, ToolbarKey.REDO)
            else -> getPinnedToolbarKeys(context.prefs())
        }
        val colors = Settings.getValues().mColors
        val favorites = !tecladoBrHasSelection && !tecladoBrEditingMode
        (pinnedKeys.layoutParams as? LinearLayout.LayoutParams)?.let {
            it.width = 0
            it.weight = 1f
            pinnedKeys.layoutParams = it
        }
        if (tecladoBrEditingMode && !tecladoBrHasSelection) {
            val back = ImageButton(context, null, R.attr.suggestionWordStyle)
            back.contentDescription = "Voltar aos atalhos principais"
            back.setImageDrawable(KeyboardIconsSet.instance.getNewDrawable(
                KeyboardIconsSet.NAME_TOOLBAR_KEY, context))
            back.layoutParams = LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.MATCH_PARENT, 1f)
            setupKey(back, colors)
            back.setOnClickListener {
                tecladoBrEditingMode = false
                tecladoBrRebuildPinnedKeys()
            }
            back.setOnLongClickListener { true }
            pinnedKeys.addView(back)
        }
        for (key in keys) {
            val button = createToolbarKey(context, key)
            button.layoutParams = LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.MATCH_PARENT, 1f)
            setupKey(button, colors)
            if (favorites) tecladoBrStyleFavorite(button)
            pinnedKeys.addView(button)
        }
        tecladoBrApplyStripVisibility()
    }

    private fun tecladoBrApplyStripVisibility() {
        if (!tecladoBrCompact()) return
        val locked = isDeviceLocked(context)
        val expanded = toolbarContainer.isVisible
        findViewById<TextView>(R.id.teclado_add_word)?.isVisible =
            !locked && expanded && !Settings.getValues().mIncognitoModeEnabled
        if (locked || expanded) return
        val showTools = tecladoBrHasSelection || tecladoBrEditingMode || !tecladoBrHasPredictions
        pinnedKeys.isVisible = showTools
        suggestionsStrip.isVisible = !showTools
    }

    fun updateTecladoBrSelection(hasSelection: Boolean) {
        if (!tecladoBrCompact() || tecladoBrHasSelection == hasSelection) return
        tecladoBrHasSelection = hasSelection
        if (hasSelection) tecladoBrEditingMode = false
        tecladoBrRebuildPinnedKeys()
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
    # Keep the usual tap on Clipboard untouched: it still opens history.
    # Long press only in the compact favorite row enters a dedicated
    # edit-only strip with a Back button. Classic mode keeps paste-on-hold.
    content = replace_once(content,
        '''        val tag = view.tag as? ToolbarKey ?: return
        if (!Settings.getValues().mQuickPinToolbarKeys || view.parent === pinnedKeys) {''',
        '''        val tag = view.tag as? ToolbarKey ?: return
        if (tag == ToolbarKey.CLIPBOARD && view.parent === pinnedKeys
                && tecladoBrCompact()) {
            tecladoBrEditingMode = true
            tecladoBrRebuildPinnedKeys()
            return
        }
        if (!Settings.getValues().mQuickPinToolbarKeys || view.parent === pinnedKeys) {''',
        'Clipboard long press opens selection/copy/cut/paste/undo/redo')
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
    # Keep native long-press and popup access, but remove the visual
    # three-dot underline from the center prediction in compact mode.
    # More suggestions are still accessible through the existing gesture
    # and the long-press word menu.
    helper = context.root / 'app/src/main/java/helium314/keyboard/latin/suggestions/SuggestionStripLayoutHelper.java'
    helper_text = helper.read_text()
    helper_text = replace_once(helper_text,
        'if (positionInStrip == mCenterPositionInStrip && mMoreSuggestionsAvailable) {',
        '''if (positionInStrip == mCenterPositionInStrip && mMoreSuggestionsAvailable
                && !helium314.keyboard.latin.utils.DeviceProtectedUtils
                    .getSharedPreferences(context)
                    .getBoolean("teclado_br_compact_toolbar_active", false)) {''',
        'Hide only the compact theme decorative suggestion dots')
    helper.write_text(helper_text)

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
