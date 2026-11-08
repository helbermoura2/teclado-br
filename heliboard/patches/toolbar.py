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
        'import android.widget.ImageButton',
        'import android.widget.HorizontalScrollView\nimport android.widget.ImageButton',
        'Use native Android horizontal scroll for clipboard editing actions')
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
                // Upstream suggestions_strip.xml uses animateLayoutChanges=true.
                // With rapid typing it can crossfade pinned favorites AND words
                // in the same row. Compact mode must switch instantly so icons
                // never draw over word candidates. Classic theme is untouched.
                stripRow.layoutTransition = null
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

    // Editing toolbox is INSIDE the clipboard's long-press view, not ⋯.
    // Its native action buttons are horizontally scrollable: arrows, word
    // navigation and page movements must not be crushed into 40px of width.
    private fun tecladoBrRebuildPinnedKeys() {
        if (!tecladoBrCompact() || Settings.getValues().mSuggestionStripHiddenPerUserSettings)
            return

        // Move the SAME dictionary '+' view between its hidden holder and
        // the editing scroller. Never clone it or lose its real click listener.
        val dictionary = findViewById<TextView>(R.id.teclado_add_word)
        (dictionary?.parent as? ViewGroup)?.removeView(dictionary)
        pinnedKeys.removeAllViews()
        val colors = Settings.getValues().mColors
        (pinnedKeys.layoutParams as? LinearLayout.LayoutParams)?.let {
            it.width = 0
            it.weight = 1f
            pinnedKeys.layoutParams = it
        }

        if (tecladoBrEditingMode && !tecladoBrHasSelection) {
            val back = ImageButton(context, null, R.attr.suggestionWordStyle)
            back.contentDescription = "Voltar aos atalhos principais"
            back.setImageDrawable(context.getDrawable(android.R.drawable.ic_media_previous))
            back.layoutParams = LinearLayout.LayoutParams(
                42.dpToPx(resources), LinearLayout.LayoutParams.MATCH_PARENT)
            setupKey(back, colors)
            back.setOnClickListener {
                tecladoBrEditingMode = false
                tecladoBrRebuildPinnedKeys()
            }
            back.setOnLongClickListener { true }
            pinnedKeys.addView(back)

            val scroller = HorizontalScrollView(context).apply {
                isHorizontalScrollBarEnabled = false
                overScrollMode = View.OVER_SCROLL_NEVER
            }
            val row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
            val editingKeys = listOf(
                ToolbarKey.SELECT_ALL, ToolbarKey.SELECT_WORD,
                ToolbarKey.COPY, ToolbarKey.CUT, ToolbarKey.PASTE,
                ToolbarKey.UNDO, ToolbarKey.REDO,
                ToolbarKey.LEFT, ToolbarKey.RIGHT, ToolbarKey.UP, ToolbarKey.DOWN,
                ToolbarKey.WORD_LEFT, ToolbarKey.WORD_RIGHT,
                ToolbarKey.FULL_LEFT, ToolbarKey.FULL_RIGHT,
                ToolbarKey.PAGE_UP, ToolbarKey.PAGE_DOWN,
                ToolbarKey.PAGE_START, ToolbarKey.PAGE_END)
            for (key in editingKeys) {
                val button = createToolbarKey(context, key)
                button.layoutParams = LinearLayout.LayoutParams(
                    44.dpToPx(resources), LinearLayout.LayoutParams.MATCH_PARENT)
                setupKey(button, colors)
                // Don't enter upstream quick-pin logic from a scroll row.
                // Preserve the native longer-press action for navigation.
                button.setOnLongClickListener {
                    val code = getCodeForToolbarKeyLongClick(key)
                    if (code != KeyCode.UNSPECIFIED) {
                        listener.onCodeInput(code,
                            Constants.SUGGESTION_STRIP_COORDINATE,
                            Constants.SUGGESTION_STRIP_COORDINATE, false)
                    }
                    true
                }
                row.addView(button)
            }
            if (dictionary != null) {
                dictionary.layoutParams = LinearLayout.LayoutParams(
                    44.dpToPx(resources), LinearLayout.LayoutParams.MATCH_PARENT)
                dictionary.isVisible = !Settings.getValues().mIncognitoModeEnabled
                row.addView(dictionary)
            }
            scroller.addView(row, HorizontalScrollView.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.MATCH_PARENT))
            pinnedKeys.addView(scroller, LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.MATCH_PARENT, 1f))
        } else {
            // The ⋯ overflow is now miscellaneous tools ONLY. '+' belongs to
            // the clipboard editing panel and must be invisible in ⋯.
            if (dictionary != null) {
                dictionary.isVisible = false
                toolbar.addView(dictionary, 0, LinearLayout.LayoutParams(
                    42.dpToPx(resources), LinearLayout.LayoutParams.MATCH_PARENT))
            }
            val keys = if (tecladoBrHasSelection)
                listOf(ToolbarKey.SELECT_ALL, ToolbarKey.COPY,
                    ToolbarKey.CUT, ToolbarKey.PASTE)
                else getPinnedToolbarKeys(context.prefs())
            val favorites = !tecladoBrHasSelection
            for (key in keys) {
                val button = createToolbarKey(context, key)
                button.layoutParams = LinearLayout.LayoutParams(
                    0, LinearLayout.LayoutParams.MATCH_PARENT, 1f)
                setupKey(button, colors)
                if (favorites) tecladoBrStyleFavorite(button)
                pinnedKeys.addView(button)
            }
        }
        tecladoBrApplyStripVisibility()
    }

    private fun tecladoBrApplyStripVisibility() {
        if (!tecladoBrCompact()) return
        val locked = isDeviceLocked(context)
        val expanded = toolbarContainer.isVisible
        findViewById<TextView>(R.id.teclado_add_word)?.isVisible =
            !locked && !expanded && tecladoBrEditingMode && !tecladoBrHasSelection
                && !Settings.getValues().mIncognitoModeEnabled
        // Hide the misc ⋯ button while inside the scrollable edit panel.
        // It reappears with the five favorites and stays available when
        // its own miscellaneous panel is already open.
        toolbarExpandKey.isVisible = !locked && (expanded || !tecladoBrEditingMode)
        if (locked || expanded) {
            // Even when the overflow is displayed, make the background
            // layers mutually exclusive. In particular, do not allow the
            // upstream visibility callback to reveal suggestions underneath.
            pinnedKeys.visibility = View.GONE
            suggestionsStrip.visibility = View.GONE
            return
        }
        val showTools = tecladoBrHasSelection || tecladoBrEditingMode || !tecladoBrHasPredictions
        // Hide the INACTIVE row first, then reveal the active row. This
        // prevents a transient overlap on the UI thread.
        if (showTools) {
            suggestionsStrip.visibility = View.GONE
            pinnedKeys.visibility = View.VISIBLE
        } else {
            pinnedKeys.visibility = View.GONE
            suggestionsStrip.visibility = View.VISIBLE
        }
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
        // Punctuation rows ("! ? , : ;") and next-word predictions
        // are not active composition. On an empty editor we must show
        // the compact favorites instead of treating punctuation as words.
        // Keep the FULL suggestion strip for actual typing/correction.
        val composing = when (suggestions.mInputStyle) {
            SuggestedWords.INPUT_STYLE_TYPING,
            SuggestedWords.INPUT_STYLE_RECORRECTION,
            SuggestedWords.INPUT_STYLE_UPDATE_BATCH,
            SuggestedWords.INPUT_STYLE_TAIL_BATCH,
            SuggestedWords.INPUT_STYLE_APPLICATION_SPECIFIED -> true
            else -> false
        }
        tecladoBrHasPredictions = !suggestions.isPunctuationSuggestions()
            && composing && suggestions.getWordCountToShow() > 0
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
    # The native onVisibilityChanged() resets the suggestions View to
    # VISIBLE when the whole keyboard returns onscreen, even if compact
    # favorites should be shown. Keep the exclusive state invariant.
    content = replace_once(content,
        '''        if (view === this)
            suggestionsStrip.visibility = visibility''',
        '''        if (view === this) {
            suggestionsStrip.visibility = visibility
            if (tecladoBrCompact()) tecladoBrApplyStripVisibility()
        }''',
        'SuggestionStripView preserve exclusive favorites on keyboard visibility')

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
