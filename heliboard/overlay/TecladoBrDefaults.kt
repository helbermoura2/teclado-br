// SPDX-License-Identifier: GPL-3.0-only
// Teclado BR private trial customization, 2026-10-31. AI-assisted development.
package helium314.keyboard.latin

import android.content.Context
import helium314.keyboard.latin.settings.Settings
import helium314.keyboard.latin.settings.Defaults
import helium314.keyboard.latin.settings.SettingsSubtype.Companion.toSettingsSubtype
import helium314.keyboard.latin.utils.SubtypeSettings
import helium314.keyboard.latin.settings.SettingsSubtype
import helium314.keyboard.latin.utils.LayoutType
import helium314.keyboard.latin.utils.ToolbarKey
import helium314.keyboard.latin.utils.prefs
import java.util.Locale

fun configureTecladoBr(context: Context) {
    if (BuildConfig.BUILD_TYPE != "debugNoMinify") return
    val prefs = context.prefs()
    if (!prefs.getBoolean("teclado_br_defaults_v2", false)) {
    val subtype = SettingsSubtype(Locale.forLanguageTag("pt-BR"), "")
        .withLayout(LayoutType.MAIN, "tecladobr").toPref()
    val keys = listOf(ToolbarKey.SETTINGS, ToolbarKey.CLIPBOARD, ToolbarKey.EMOJI,
        ToolbarKey.SELECT_ALL, ToolbarKey.COPY, ToolbarKey.CUT, ToolbarKey.PASTE,
        ToolbarKey.LEFT, ToolbarKey.RIGHT, ToolbarKey.UNDO, ToolbarKey.REDO)
    prefs.edit()
        .putString(Settings.PREF_ADDITIONAL_SUBTYPES, subtype)
        .putString(Settings.PREF_ENABLED_SUBTYPES, subtype)
        .putString(Settings.PREF_SELECTED_SUBTYPE, subtype)
        .putString(Settings.PREF_THEME_COLORS, "darker")
        .putString(Settings.PREF_THEME_COLORS_NIGHT, "darker")
        .putBoolean(Settings.PREF_THEME_DAY_NIGHT, false)
        .putBoolean(Settings.PREF_THEME_KEY_BORDERS, true)
        .putBoolean(Settings.PREF_SHOW_NUMBER_ROW, true)
        .putBoolean(Settings.PREF_AUTO_CAP, true)
        .putBoolean(Settings.PREF_AUTO_CORRECTION, true)
        .putBoolean(Settings.PREF_SHOW_SUGGESTIONS, true)
        .putBoolean(Settings.PREF_BIGRAM_PREDICTIONS, true)
        .putBoolean(Settings.PREF_USE_CONTACTS, false)
        .putBoolean(Settings.PREF_USE_APPS, false)
        .putString(Settings.PREF_TOOLBAR_MODE, "EXPANDABLE")
        .putBoolean(Settings.PREF_AUTO_SHOW_TOOLBAR, true)
        .putBoolean(Settings.PREF_AUTO_HIDE_TOOLBAR, true)
        .putString(Settings.PREF_TOOLBAR_KEYS, keys.joinToString("|") { "${it.name}:true" })
        .putBoolean("teclado_br_defaults_v2", true)
        .commit()
    }
    if (!prefs.getBoolean("teclado_br_languages_pins_v1", false)) {
        val enabled = SubtypeSettings.createSettingsSubtypes(prefs.getString(Settings.PREF_ENABLED_SUBTYPES, Defaults.PREF_ENABLED_SUBTYPES)!!).toMutableList()
        if (enabled.none { it.locale == Locale.US }) {
            enabled.add(SubtypeSettings.getResourceSubtypesForLocale(Locale.US).first().toSettingsSubtype())
        }
        val pinned = prefs.getString(Settings.PREF_PINNED_TOOLBAR_KEYS, Defaults.PREF_PINNED_TOOLBAR_KEYS)!!
            .split("|").filterNot { it.startsWith("CLIPBOARD:") }.toMutableList()
        pinned.add(0, "CLIPBOARD:true")
        prefs.edit()
            .putString(Settings.PREF_ENABLED_SUBTYPES, SubtypeSettings.createPrefSubtypes(enabled))
            .putBoolean(Settings.PREF_SHOW_LANGUAGE_SWITCH_KEY, true)
            .putString(Settings.PREF_LANGUAGE_SWITCH_KEY, "internal")
            .putBoolean(Settings.PREF_ENABLE_CLIPBOARD_HISTORY, true)
            .putBoolean(Settings.PREF_CLIPBOARD_HISTORY_PINNED_FIRST, true)
            .putString(Settings.PREF_PINNED_TOOLBAR_KEYS, pinned.joinToString("|"))
            .putBoolean("teclado_br_languages_pins_v1", true)
            .commit()
    }
}
