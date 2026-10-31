package br.com.tecladobr;

import android.inputmethodservice.InputMethodService;
import android.content.*;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.text.InputType;
import android.view.*;
import android.view.inputmethod.*;
import android.widget.*;
import java.util.List;

public class KeyboardService extends InputMethodService {
    private LinearLayout root, candidates;
    private final ToolbarState toolbar = new ToolbarState();
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
        root.setBackgroundColor(Color.BLACK);
        getWindow().getWindow().setNavigationBarColor(Color.BLACK);
        getWindow().getWindow().getDecorView().setSystemUiVisibility(0);
        root.setPadding(0, 0, 0, dp(6));
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
        toolbar.reset();
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
        KeyboardKey b = new KeyboardKey(this); b.setText(label); b.setAllCaps(false); b.setTextSize(24);
        b.setTextColor(Color.rgb(240, 240, 242)); b.setFocusable(false); b.setPadding(0, 0, 0, 0);
        b.setMinWidth(0); b.setMinimumWidth(0); b.setMinHeight(0); b.setMinimumHeight(0);
        StateListDrawable bg = new StateListDrawable();
        bg.addState(new int[]{android.R.attr.state_pressed}, background(Color.rgb(90,90,95)));
        bg.addState(new int[]{}, background(special ? Color.rgb(23,23,25) : Color.rgb(51,51,53)));
        b.setBackground(bg);
        b.setElevation(0); b.setContentDescription(label);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0,
            dp(40 + prefs().getInt("height", 8)), weight);
        lp.setMargins(dp(3), dp(5), dp(3), dp(5)); row.addView(b, lp);
        b.setOnClickListener(v -> { if (enabled("haptic")) v.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP); action.run(); });
        return b;
    }
    private LinearLayout row() {
        LinearLayout r = new LinearLayout(this); r.setPadding(dp(5), 0, dp(5), 0); root.addView(r); return r;
    }
    private void letters(String chars) {
        LinearLayout r = row();
        for (int i = 0; i < chars.length(); i++) letter(r, chars.substring(i, i + 1));
    }
    private void letter(LinearLayout row, String value) {
        String shown = (shift || capsLock) ? value.toUpperCase(TextEngine.PT) : value;
        Button b = key(row, shown, 1, () -> insert(shown), false);
        String secondary = secondary(value);
        ((KeyboardKey)b).hint(secondary);
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
        if (!secondary.isEmpty()) accents += secondary;
        if (!accents.isEmpty()) {
            final String choices = (shift || capsLock) ? accents.toUpperCase(TextEngine.PT) : accents;
            b.setOnLongClickListener(v -> { showAccents(b, choices); return true; });
        }
    }
    private void showAccents(View anchor, String choices) {
        LinearLayout panel = new LinearLayout(this);
        panel.setPadding(dp(4), dp(4), dp(4), dp(4));
        panel.setBackground(background(Color.rgb(40, 40, 44)));
        PopupWindow popup = new PopupWindow(panel, dp(choices.length() * 45 + 8), dp(68), true);
        popup.setBackgroundDrawable(background(Color.rgb(40,40,44))); popup.setOutsideTouchable(true);
        for (int i = 0; i < choices.length(); i++) {
            String c = choices.substring(i, i + 1);
            key(panel, c, 1, () -> { insert(c); popup.dismiss(); }, false);
        }
        popup.showAsDropDown(anchor, 0, -dp(120));
    }
    private String secondary(String letter) {
        String letters = "qwertyuiopasdfghjklçzxcvbnm";
        String marks = "*×÷=/-<>[]!@#$%&*()~_\"':;?.";
        int index = letters.indexOf(letter);
        return index < 0 || index >= marks.length() ? "" : marks.substring(index, index+1);
    }
    private Button icon(LinearLayout row, String name, String description, Runnable action) {
        KeyboardKey b = (KeyboardKey)key(row, "", 1, action, true);
        b.icon(name); b.setContentDescription(description);
        return b;
    }
    private void render() {
        if (root == null) return;
        root.removeAllViews(); candidates = new LinearLayout(this);
        candidates.setGravity(Gravity.CENTER_VERTICAL);
        candidates.setBackgroundColor(Color.rgb(23,23,25));
        candidates.setPadding(dp(6),0,dp(6),0);
        root.addView(candidates, new LinearLayout.LayoutParams(-1,dp(46)));
        updateSuggestions();
        if (enabled("numbers") || symbols) {
            LinearLayout numbers = row();
            for (char n : "1234567890".toCharArray()) {
                Button k=key(numbers,String.valueOf(n),1,()->insert(String.valueOf(n)),false);
                k.setTextSize(23);
                k.getLayoutParams().height=dp(34+prefs().getInt("height",8));
            }
        }
        if (symbols) {
            letters("@#$%&*()-+"); letters("!\"':;/?=ç_");
            LinearLayout r = row();
            for(char c : "[]{}<>\\|".toCharArray()) letter(r,String.valueOf(c));
            icon(r,"backspace","Apagar ou desfazer correção",this::backspace);
        } else {
            letters("qwertyuiop"); letters("asdfghjklç");
            LinearLayout bottom = row();
            Button sh=icon(bottom,capsLock?"caps":"shift","Maiúsculas; mantenha pressionado para fixar",()->{
                manualShift=true;shift=!shift;capsLock=false;render();
            });
            ((LinearLayout.LayoutParams)sh.getLayoutParams()).weight=1.35f;
            if(shift||capsLock)sh.setBackground(background(Color.rgb(83,83,90)));
            sh.setOnLongClickListener(v->{capsLock=!capsLock;shift=capsLock;manualShift=capsLock;render();return true;});
            for(char c : "zxcvbnm".toCharArray()) letter(bottom,String.valueOf(c));
            Button del=icon(bottom,"backspace","Apagar ou desfazer correção",this::backspace);
            ((LinearLayout.LayoutParams)del.getLayoutParams()).weight=1.35f;
        }
        LinearLayout last=row();
        key(last,symbols?"ABC":"!#1",1.35f,()->{symbols=!symbols;render();},true).setTextSize(19);
        Button comma=key(last,",",0.85f,()->insert(","),false);
        comma.setOnLongClickListener(v->{showEmojis(comma);return true;});
        Button space=key(last,"‹    Português (BR)    ›",4.7f,()->insert(" "),false);
        space.setTextSize(14);space.setContentDescription("Espaço; mantenha pressionado para trocar teclado");
        space.setOnLongClickListener(v->{((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).showInputMethodPicker();return true;});
        key(last,".",0.85f,()->insert("."),false);
        Button enter=icon(last,"enter","Confirmar ou inserir nova linha",this::enter);
        ((LinearLayout.LayoutParams)enter.getLayoutParams()).weight=1.35f;
    }
    private void toolbarButton(String name,String description,Runnable action,boolean fixed) {
        Button b=icon(candidates,name,description,action);
        LinearLayout.LayoutParams lp=(LinearLayout.LayoutParams)b.getLayoutParams();
        lp.height=dp(40);lp.setMargins(dp(1),0,dp(1),0);
        if(fixed){lp.width=dp(38);lp.weight=0;}
        b.setLayoutParams(lp);
    }
    private void toggleToolbar(){toolbar.toggle();updateSuggestions();}
    private void unavailable(String feature){
        Toast.makeText(this,feature+" ainda não está disponível nesta versão.",Toast.LENGTH_LONG).show();
    }
    private void openSettings(){
        startActivity(new Intent(this,SettingsActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    }
    private void showMore(View anchor){
        PopupMenu menu=new PopupMenu(this,anchor);
        menu.getMenu().add(toolbar.isExpanded()?"Mostrar sugestões":"Mostrar atalhos").setOnMenuItemClickListener(i->{toggleToolbar();return true;});
        menu.getMenu().add("Configurações").setOnMenuItemClickListener(i->{openSettings();return true;});
        menu.getMenu().add("Trocar teclado").setOnMenuItemClickListener(i->{((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).showInputMethodPicker();return true;});
        menu.getMenu().add("Recolher teclado").setOnMenuItemClickListener(i->{requestHideSelf(0);return true;});
        menu.show();
    }
    private void pasteClipboard(){
        if(sensitive){Toast.makeText(this,"Área de transferência oculta em campos de senha.",Toast.LENGTH_SHORT).show();return;}
        ClipboardManager clipboard=(ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
        ClipData clip=clipboard.getPrimaryClip();
        if(clip==null||clip.getItemCount()==0){Toast.makeText(this,"Nenhum texto copiado.",Toast.LENGTH_SHORT).show();return;}
        CharSequence text=clip.getItemAt(0).getText();
        if(text==null){Toast.makeText(this,"O conteúdo copiado não é texto.",Toast.LENGTH_SHORT).show();return;}
        InputConnection ic=getCurrentInputConnection();
        if(ic!=null){clearUndo();ic.commitText(text,1);toolbar.onTyping();afterEdit();}
    }
    private void showEmojis(View anchor){
        LinearLayout panel=new LinearLayout(this);panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(5),dp(5),dp(5),dp(5));panel.setBackground(background(Color.rgb(40,40,44)));
        PopupWindow popup=new PopupWindow(panel,dp(320),dp(130),true);
        popup.setBackgroundDrawable(background(Color.rgb(40,40,44)));popup.setOutsideTouchable(true);
        for(String[] group:new String[][]{{"😀","😂","😍","🥰","😊","😎"},{"👍","🙏","❤️","🎉","🤔","😢"}}){
            LinearLayout row=new LinearLayout(this);panel.addView(row);
            for(String emoji:group)key(row,emoji,1,()->{insert(emoji);popup.dismiss();},false);
        }
        popup.showAtLocation(root,Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL,0,dp(80));
    }
    private void updateSuggestions() {
        if(candidates==null)return;
        candidates.removeAllViews();
        toolbarButton(toolbar.isExpanded()?"collapse":"expand",toolbar.isExpanded()?"Mostrar sugestões":"Mostrar atalhos",this::toggleToolbar,true);
        if(toolbar.isExpanded()){
            toolbarButton("clipboard","Colar texto copiado",this::pasteClipboard,false);
            toolbarButton("emoji","Emojis",()->showEmojis(candidates),false);
            toolbarButton("ai","IA (em desenvolvimento)",()->unavailable("A IA"),false);
            toolbarButton("translate","Tradução (em desenvolvimento)",()->unavailable("A tradução"),false);
            toolbarButton("settings","Configurações",this::openSettings,false);
        }else{
            List<String> options=literal?java.util.Collections.emptyList():TextEngine.suggestionsForContext(before());
            for(int i=0;i<3;i++){
                String word=i<options.size()?options.get(i):"";
                Button b=key(candidates,word,1,()->choose(word),true);b.setTextSize(17);b.setEnabled(!word.isEmpty());
                LinearLayout.LayoutParams lp=(LinearLayout.LayoutParams)b.getLayoutParams();lp.height=dp(40);lp.setMargins(0,0,0,0);b.setLayoutParams(lp);
            }
        }
        toolbarButton("more","Mais opções",()->showMore(candidates),true);
    }
    private void replaceWord(InputConnection ic, String word, String replacement) {
        ic.deleteSurroundingText(word.length(), 0); ic.commitText(replacement, 1);
    }
    private void choose(String word) {
        InputConnection ic = getCurrentInputConnection(); if (ic == null || word.isEmpty()) return;
        toolbar.onTyping();
        ic.beginBatchEdit(); replaceWord(ic, TextEngine.currentWord(before()), word + " "); ic.endBatchEdit();
        clearUndo(); afterEdit();
    }
    private void insert(String text) {
        InputConnection ic = getCurrentInputConnection(); if (ic == null) return;
        clearUndo(); toolbar.onTyping();
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
        toolbar.onTyping();
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
