package br.com.tecladobr;

import android.inputmethodservice.InputMethodService;
import android.content.*;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.text.InputType;
import android.view.*;
import android.view.inputmethod.*;
import android.widget.*;
import java.util.List;

public class KeyboardService extends InputMethodService {
    private LinearLayout root, candidates;
    private boolean shift, capsLock, manualShift, symbols, sensitive, literal, numeric;
    private String undoOriginal, undoExpected;
    private int expectedCursor = -1;
    private SharedPreferences prefs() { return getSharedPreferences("keyboard", MODE_PRIVATE); }
    private boolean enabled(String key) { return prefs().getBoolean(key, true); }
    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }
    private String before() {
        InputConnection ic = getCurrentInputConnection();
        CharSequence value = ic == null ? null : ic.getTextBeforeCursor(256, 0);
        return value == null ? "" : value.toString();
    }
    @Override public View onCreateInputView() {
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(217, 220, 225));
        root.setPadding(dp(3), dp(4), dp(3), dp(6));
        render(); return root;
    }
    @Override public void onStartInput(EditorInfo info, boolean restarting) {
        super.onStartInput(info, restarting);
        int cls = info.inputType & InputType.TYPE_MASK_CLASS;
        int variation = info.inputType & InputType.TYPE_MASK_VARIATION;
        sensitive = (cls == InputType.TYPE_CLASS_TEXT && (
            variation == InputType.TYPE_TEXT_VARIATION_PASSWORD ||
            variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD ||
            variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD)) ||
            (cls == InputType.TYPE_CLASS_NUMBER && variation == InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        literal = cls != InputType.TYPE_CLASS_TEXT || sensitive ||
            variation == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS ||
            variation == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS ||
            variation == InputType.TYPE_TEXT_VARIATION_URI ||
            (info.inputType & InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS) != 0;
        numeric = cls == InputType.TYPE_CLASS_NUMBER || cls == InputType.TYPE_CLASS_PHONE ||
            cls == InputType.TYPE_CLASS_DATETIME;
        symbols = numeric; shift = false; capsLock = false; manualShift = false;
        clearUndo(); expectedCursor = -1;
        autoShift(); render();
    }
    @Override public void onStartInputView(EditorInfo info, boolean restarting) {
        super.onStartInputView(info, restarting); autoShift(); render();
    }
    @Override public boolean onEvaluateFullscreenMode() { return false; }
    @Override public void onFinishInput() {
        clearUndo(); expectedCursor = -1;
        if (candidates != null) candidates.removeAllViews();
        super.onFinishInput();
    }
    private void clearUndo() { undoOriginal = null; undoExpected = null; }
    private void autoShift() {
        if (!manualShift && !capsLock) shift = enabled("caps") && !literal && TextEngine.sentenceStart(before());
    }
    private GradientDrawable background(int color) {
        GradientDrawable d = new GradientDrawable(); d.setColor(color); d.setCornerRadius(dp(7)); return d;
    }
    private Button key(LinearLayout row, String label, float weight, Runnable action, boolean special) {
        Button b = new Button(this); b.setText(label); b.setAllCaps(false); b.setTextSize(21);
        b.setTextColor(Color.rgb(24, 27, 31)); b.setPadding(0, 0, 0, 0);
        b.setMinWidth(0); b.setMinimumWidth(0); b.setMinHeight(0); b.setMinimumHeight(0);
        b.setBackground(background(special ? Color.rgb(190, 197, 206) : Color.WHITE));
        b.setElevation(dp(1)); b.setContentDescription(label);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0,
            dp(40 + prefs().getInt("height", 8)), weight);
        lp.setMargins(dp(2), dp(3), dp(2), dp(3)); row.addView(b, lp);
        b.setOnClickListener(v -> { if (enabled("haptic")) v.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP); action.run(); });
        return b;
    }
    private LinearLayout row() {
        LinearLayout r = new LinearLayout(this); root.addView(r); return r;
    }
    private void letters(String chars) {
        LinearLayout r = row();
        for (int i = 0; i < chars.length(); i++) letter(r, chars.substring(i, i + 1));
    }
    private void letter(LinearLayout row, String value) {
        String shown = (shift || capsLock) ? value.toUpperCase(TextEngine.PT) : value;
        Button b = key(row, shown, 1, () -> insert(shown), false);
        String accents;
        switch(value) {
            case "a": accents = "áàâãä"; break;
            case "e": accents = "éêèë"; break;
            case "i": accents = "íìîï"; break;
            case "o": accents = "óôõòö"; break;
            case "u": accents = "úüùû"; break;
            case "c": accents = "ç"; break;
            default: accents = "";
        }
        if (!accents.isEmpty()) {
            final String choices = (shift || capsLock) ? accents.toUpperCase(TextEngine.PT) : accents;
            b.setOnLongClickListener(v -> { showAccents(b, choices); return true; });
        }
    }
    private void showAccents(View anchor, String choices) {
        LinearLayout panel = new LinearLayout(this);
        panel.setPadding(dp(4), dp(4), dp(4), dp(4));
        panel.setBackground(background(Color.rgb(217, 220, 225)));
        PopupWindow popup = new PopupWindow(panel, dp(choices.length() * 45 + 8), dp(68), true);
        popup.setBackgroundDrawable(background(Color.WHITE)); popup.setOutsideTouchable(true);
        for (int i = 0; i < choices.length(); i++) {
            String c = choices.substring(i, i + 1);
            key(panel, c, 1, () -> { insert(c); popup.dismiss(); }, false);
        }
        popup.showAsDropDown(anchor, 0, -dp(120));
    }
    private void render() {
        if (root == null) return;
        root.removeAllViews(); candidates = row();
        candidates.setMinimumHeight(dp(42)); updateSuggestions();
        if (enabled("numbers") || symbols) letters("1234567890");
        if (symbols) {
            letters("@#$%&*()-+"); letters("!\"':;/?=ç_");
            letters(".,[]{}<>\\|");
        } else {
            letters("qwertyuiop"); letters("asdfghjklç");
            LinearLayout bottom = row();
            Button sh = key(bottom, capsLock ? "⇪" : shift ? "⬆" : "⇧", 1.3f, () -> {
                manualShift = true; shift = !shift; capsLock = false; render();
            }, true);
            sh.setContentDescription("Maiúsculas; mantenha pressionado para fixar");
            sh.setOnLongClickListener(v -> { capsLock = !capsLock; shift = capsLock; manualShift = capsLock; render(); return true; });
            for (char c : "zxcvbnm".toCharArray()) letter(bottom, String.valueOf(c));
            key(bottom, "⌫", 1.3f, this::backspace, true).setContentDescription("Apagar ou desfazer correção");
        }
        LinearLayout last = row();
        key(last, symbols ? "ABC" : "?123", 1.5f, () -> { symbols = !symbols; render(); }, true).setTextSize(15);
        key(last, ",", 0.8f, () -> insert(","), false);
        Button language = key(last, "🌐", 0.9f, () ->
            ((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).showInputMethodPicker(), true);
        language.setContentDescription("Trocar teclado");
        key(last, "Português (BR)", 3.6f, () -> insert(" "), false).setTextSize(14);
        key(last, ".", 0.8f, () -> insert("."), false);
        if (symbols) key(last, "⌫", 1, this::backspace, true);
        key(last, "↵", 1.2f, this::enter, true).setContentDescription("Confirmar ou inserir nova linha");
    }
    private void updateSuggestions() {
        if (candidates == null) return;
        candidates.removeAllViews();
        if (literal) return;
        List<String> options = TextEngine.suggest(TextEngine.currentWord(before()));
        if (options.isEmpty()) {
            TextView hint = new TextView(this); hint.setText("Português (Brasil)");
            hint.setGravity(Gravity.CENTER); hint.setTextColor(Color.DKGRAY);
            candidates.addView(hint, new LinearLayout.LayoutParams(-1, dp(42)));
        } else for (String word : options) {
            Button b = key(candidates, word, 1, () -> choose(word), true); b.setTextSize(16);
        }
    }
    private void replaceWord(InputConnection ic, String word, String replacement) {
        ic.deleteSurroundingText(word.length(), 0); ic.commitText(replacement, 1);
    }
    private void choose(String word) {
        InputConnection ic = getCurrentInputConnection(); if (ic == null) return;
        ic.beginBatchEdit(); replaceWord(ic, TextEngine.currentWord(before()), word + " "); ic.endBatchEdit();
        clearUndo(); afterEdit();
    }
    private void insert(String text) {
        InputConnection ic = getCurrentInputConnection(); if (ic == null) return;
        clearUndo();
        boolean boundary = text.equals(" ") || ".,!?;:\n".contains(text);
        CharSequence selected = ic.getSelectedText(0);
        ic.beginBatchEdit();
        if (boundary && enabled("correction") && !literal && (selected == null || selected.length() == 0)) {
            String original = TextEngine.currentWord(before());
            String corrected = TextEngine.correct(original);
            if (!corrected.equals(original)) {
                replaceWord(ic, original, corrected);
                undoOriginal = original; undoExpected = corrected + text;
            }
        }
        ic.commitText(text, 1); ic.endBatchEdit();
        if (!capsLock) { manualShift = false; shift = false; }
        afterEdit();
    }
    private void backspace() {
        InputConnection ic = getCurrentInputConnection(); if (ic == null) return;
        CharSequence selected = ic.getSelectedText(0);
        if (selected != null && selected.length() > 0) ic.commitText("", 1);
        else if (undoExpected != null && before().endsWith(undoExpected)) {
            ic.beginBatchEdit(); ic.deleteSurroundingText(undoExpected.length(), 0);
            ic.commitText(undoOriginal, 1); ic.endBatchEdit();
        } else ic.deleteSurroundingTextInCodePoints(1, 0);
        clearUndo(); afterEdit();
    }
    private void enter() {
        EditorInfo info = getCurrentInputEditorInfo(); InputConnection ic = getCurrentInputConnection();
        if (info == null || ic == null) return;
        int action = info.imeOptions & EditorInfo.IME_MASK_ACTION;
        if ((info.imeOptions & EditorInfo.IME_FLAG_NO_ENTER_ACTION) == 0 &&
            action != EditorInfo.IME_ACTION_NONE && action != EditorInfo.IME_ACTION_UNSPECIFIED) {
            clearUndo(); ic.performEditorAction(action);
        } else insert("\n");
    }
    private void afterEdit() {
        InputConnection ic = getCurrentInputConnection();
        ExtractedText extracted = ic == null ? null : ic.getExtractedText(new ExtractedTextRequest(), 0);
        expectedCursor = extracted == null ? -1 : extracted.startOffset + extracted.selectionEnd;
        autoShift(); render();
    }
    @Override public void onUpdateSelection(int oldStart, int oldEnd, int start, int end, int cs, int ce) {
        super.onUpdateSelection(oldStart, oldEnd, start, end, cs, ce);
        if (start != end || (expectedCursor >= 0 && end != expectedCursor)) clearUndo();
        autoShift(); render();
    }
}
