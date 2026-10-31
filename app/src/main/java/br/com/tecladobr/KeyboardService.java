package br.com.tecladobr;

import android.inputmethodservice.InputMethodService;
import android.content.*;
import android.graphics.Color;
import android.graphics.drawable.*;
import android.os.*;
import android.text.*;
import android.view.*;
import android.view.inputmethod.*;
import android.widget.*;
import java.util.*;
import java.util.concurrent.*;
import java.io.*;

public class KeyboardService extends InputMethodService {
    static KeyboardService activeInstance;
    int keyboardBuilds, contextReads, contextReadsOnMain;
    private LinearLayout root,candidates,shortcutRow;
    private HorizontalScrollView shortcutScroll;
    private final List<LetterBinding> letters=new ArrayList<>();
    private final Map<String,Button> editButtons=new HashMap<>();
    private final Button[] suggestions=new Button[3];
    private Button shiftKey;
    private WritingPanel writingPanel;
    private boolean panelEditingShown,keyboardShown,editingToolbar,shift,capsLock,manualShift,symbols,sensitive,literal,numeric;
    private boolean autoCaps=true,correction=true,haptic=true,numbers=true,alive=true,reading;
    private int keyHeight=48,barMode=-1,shiftVisual=-1;
    private final ToolbarState toolbar=new ToolbarState();
    private final EditorState editor=new EditorState();
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ExecutorService contextWorker=Executors.newSingleThreadExecutor();
    private final ExecutorService suggestionWorker=Executors.newSingleThreadExecutor();
    private long revision,session;
    private String builtLayout="";
    private String layoutSignature(){return numbers+":"+symbols+":"+keyHeight;}
    private String undoOriginal,undoExpected;
    private final Runnable readLater=this::readContext;
    private final Runnable suggestLater=this::findSuggestions;
    private static final class LetterBinding{
        final KeyboardKey button;final String value;
        LetterBinding(KeyboardKey button,String value){this.button=button;this.value=value;}
    }
    @Override public void onCreate(){
        super.onCreate();activeInstance=this;loadPreferences();
        suggestionWorker.execute(()->{
            try(Reader reader=new InputStreamReader(getAssets().open("pt_frequency.txt"),java.nio.charset.StandardCharsets.UTF_8)){TextEngine.load(reader);}
            catch(IOException ignored){}
            handler.post(()->{if(alive)queueSuggestions();});
        });
    }
    private SharedPreferences prefs(){return getSharedPreferences("keyboard",MODE_PRIVATE);}
    private void loadPreferences(){SharedPreferences p=prefs();autoCaps=p.getBoolean("caps",true);correction=p.getBoolean("correction",true);haptic=p.getBoolean("haptic",true);numbers=p.getBoolean("numbers",true);keyHeight=40+p.getInt("height",8);}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private String before(){return editor.before();}
    @Override public View onCreateInputView(){
        root=new LinearLayout(this);root.setOrientation(1);root.setMotionEventSplittingEnabled(true);
        root.setBackgroundColor(Color.BLACK);root.setPadding(0,0,0,dp(54));
        getWindow().getWindow().setNavigationBarColor(Color.BLACK);
        getWindow().getWindow().getDecorView().setSystemUiVisibility(0);
        root.setOnApplyWindowInsetsListener((view,insets)->{
            int bottom=Build.VERSION.SDK_INT>=30?insets.getInsets(WindowInsets.Type.navigationBars()).bottom:insets.getSystemWindowInsetBottom();
            root.setPadding(0,0,0,dp(6)+Math.max(dp(48),bottom));return insets;
        });render();return root;
    }
    @Override public void onStartInput(EditorInfo info,boolean restarting){
        super.onStartInput(info,restarting);session++;revision++;handler.removeCallbacks(readLater);handler.removeCallbacks(suggestLater);
        int cls=info.inputType&InputType.TYPE_MASK_CLASS,variation=info.inputType&InputType.TYPE_MASK_VARIATION;
        sensitive=(cls==InputType.TYPE_CLASS_TEXT&&(variation==InputType.TYPE_TEXT_VARIATION_PASSWORD||variation==InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD||variation==InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD))||(cls==InputType.TYPE_CLASS_NUMBER&&variation==InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        literal=cls!=InputType.TYPE_CLASS_TEXT||sensitive||variation==InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS||variation==InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS||variation==InputType.TYPE_TEXT_VARIATION_URI||(info.inputType&InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS)!=0;
        boolean wasNumeric=numeric;
        numeric=cls==InputType.TYPE_CLASS_NUMBER||cls==InputType.TYPE_CLASS_PHONE||cls==InputType.TYPE_CLASS_DATETIME;
        String initial=null;
        if(sensitive)initial="";
        else if(Build.VERSION.SDK_INT>=30){CharSequence value=info.getInitialTextBeforeCursor(512,0);if(value!=null)initial=value.toString();}
        editor.reset(initial,info.initialSelStart,info.initialSelEnd,sensitive);
        boolean preserve=restarting&&keyboardShown&&writingPanel==null&&numeric==wasNumeric;
        writingPanel=null;
        if(!preserve){editingToolbar=false;toolbar.reset();symbols=numeric;shift=false;capsLock=false;manualShift=false;}
        clearUndo();autoShift();if(preserve)refreshVisuals();else render();queueContext(80);
    }
    @Override public void onStartInputView(EditorInfo info,boolean restarting){super.onStartInputView(info,restarting);loadPreferences();autoShift();if(!keyboardShown||writingPanel!=null||!builtLayout.equals(layoutSignature()))render();else refreshVisuals();queueContext(80);}
    @Override public boolean onEvaluateFullscreenMode(){return false;}
    @Override public void onFinishInput(){
        session++;revision++;handler.removeCallbacks(readLater);handler.removeCallbacks(suggestLater);editor.clear();clearUndo();editingToolbar=false;writingPanel=null;
        for(Button b:suggestions)if(b!=null)b.setText("");
        if(!keyboardShown&&root!=null){root.removeAllViews();keyboardShown=false;}
        super.onFinishInput();
    }
    @Override public void onDestroy(){alive=false;session++;handler.removeCallbacksAndMessages(null);contextWorker.shutdownNow();suggestionWorker.shutdownNow();if(activeInstance==this)activeInstance=null;super.onDestroy();}
    private void clearUndo(){undoOriginal=null;undoExpected=null;}
    private void autoShift(){if(!manualShift&&!capsLock)shift=autoCaps&&!literal&&editor.valid()&&TextEngine.sentenceStart(before());}
    private void queueContext(long delay){handler.removeCallbacks(readLater);if(alive&&!sensitive)handler.postDelayed(readLater,delay);}
    private void readContext(){
        if(reading||!alive||sensitive)return;
        InputConnection ic=getCurrentInputConnection();if(ic==null)return;
        final long token=revision,generation=session;reading=true;
        contextWorker.execute(()->{
            contextReads++;if(Looper.myLooper()==Looper.getMainLooper())contextReadsOnMain++;
            String prefix=null;int start=-1,end=-1;
            try{
                ExtractedTextRequest request=new ExtractedTextRequest();request.hintMaxChars=1024;
                ExtractedText value=ic.getExtractedText(request,0);
                if(value!=null&&value.text!=null&&value.selectionStart>=0&&value.selectionEnd>=0){
                    int position=Math.min(value.selectionStart,value.selectionEnd);
                    if(position<=value.text.length()){prefix=value.text.subSequence(Math.max(0,position-512),position).toString();start=value.startOffset+value.selectionStart;end=value.startOffset+value.selectionEnd;}
                }
                if(prefix==null){CharSequence valueBefore=ic.getTextBeforeCursor(512,0);if(valueBefore!=null)prefix=valueBefore.toString();}
            }catch(RuntimeException ignored){}
            final String result=prefix;final int a=start,b=end;
            handler.post(()->{
                reading=false;if(!alive)return;if(generation!=session){queueContext(0);return;}
                if(token!=revision){queueContext(100);return;}
                if(result!=null){
                    int sa=a>=0?a:editor.start(),se=b>=0?b:editor.end();
                    boolean changed=!editor.valid()||!before().equals(result)||sa!=editor.start()||se!=editor.end();
                    editor.reset(result,sa,se,false);
                    if(changed){revision++;clearUndo();}
                    refreshVisuals();
                }
            });
        });
    }
    private void afterEdit(){revision++;editor.expectAck();refreshVisuals();queueContext(120);}
    private void afterExternalAction(){revision++;clearUndo();editor.invalidate();refreshVisuals();queueContext(0);}
    @Override public void onUpdateSelection(int oldStart,int oldEnd,int start,int end,int cs,int ce){
        super.onUpdateSelection(oldStart,oldEnd,start,end,cs,ce);
        if(!editor.acknowledge(start,end)){revision++;clearUndo();if(sensitive)editor.reset("",start,end,true);else queueContext(0);}
        if(writingPanel==null)refreshVisuals();
    }
    private GradientDrawable background(int color){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(6));return d;}
    private Button key(LinearLayout row,String label,float weight,Runnable action,boolean special){
        KeyboardKey b=new KeyboardKey(this);b.setText(label);b.setAllCaps(false);b.setTextSize(24);b.setTextColor(Color.WHITE);b.setFocusable(false);b.setPadding(0,0,0,0);
        b.setMinWidth(0);b.setMinimumWidth(0);b.setMinHeight(0);b.setMinimumHeight(0);
        StateListDrawable bg=new StateListDrawable();bg.addState(new int[]{android.R.attr.state_pressed},background(0xff5a5a60));bg.addState(new int[]{},background(special?0xff171719:0xff333335));b.setBackground(bg);b.setElevation(0);b.setSoundEffectsEnabled(false);b.setContentDescription(label);
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,dp(keyHeight),weight);lp.setMargins(dp(3),dp(5),dp(3),dp(5));row.addView(b,lp);
        b.setOnClickListener(v->{if(haptic)v.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);action.run();});return b;
    }
    private LinearLayout row(){LinearLayout r=new LinearLayout(this);r.setMotionEventSplittingEnabled(true);r.setPadding(dp(5),0,dp(5),0);root.addView(r);return r;}
    private Button icon(LinearLayout row,String name,String description,Runnable action){KeyboardKey b=(KeyboardKey)key(row,"",1,action,true);b.icon(name);b.setContentDescription(description);return b;}
    private String secondary(String value){String alphabet="qwertyuiopasdfghjklçzxcvbnm",marks="*×÷=/-<>[]!@#$%&*()~_\"':;?.";int i=alphabet.indexOf(value);return i<0||i>=marks.length()?"":marks.substring(i,i+1);}
    private void letters(String text){LinearLayout r=row();for(char c:text.toCharArray())letter(r,String.valueOf(c));}
    private void letter(LinearLayout row,String value){
        final String[] inserted={""};final long[] ticket={-1};
        KeyboardKey b=(KeyboardKey)key(row,value,1,()->{String shown=shift||capsLock?value.toUpperCase(TextEngine.PT):value;insert(shown);inserted[0]=shown;ticket[0]=revision;},false);
        b.quickTouch(true);b.hint(secondary(value));letters.add(new LetterBinding(b,value));
        String accents;
        switch(value){case "a":accents="áàâãä";break;case "e":accents="éêèë";break;case "i":accents="íìîï";break;case "o":accents="óôõòö";break;case "u":accents="úüùû";break;case "c":accents="ç";break;default:accents="";}
        final String choices=accents+secondary(value);
        if(!choices.isEmpty())b.setOnLongClickListener(v->{
            if(ticket[0]!=revision||inserted[0].isEmpty())return true;
            String shown=Character.isUpperCase(inserted[0].charAt(0))?choices.toUpperCase(TextEngine.PT):choices;
            showAccents(b,shown,inserted[0],ticket[0]);return true;
        });
    }
    private void showAccents(View anchor,String choices,String previous,long token){
        LinearLayout panel=new LinearLayout(this);panel.setPadding(dp(4),dp(4),dp(4),dp(4));panel.setBackground(background(0xff28282c));
        PopupWindow popup=new PopupWindow(panel,dp(choices.length()*45+8),dp(68),true);popup.setBackgroundDrawable(background(0xff28282c));popup.setOutsideTouchable(true);
        for(char c:choices.toCharArray()){String replacement=String.valueOf(c);key(panel,replacement,1,()->{replaceRecent(previous,replacement,token);popup.dismiss();},false);}
        popup.showAsDropDown(anchor,0,-dp(120));
    }
    private boolean replaceRecent(String previous,String replacement,long token){
        if(token!=revision)return false;
        if(writingPanel!=null&&writingPanel.isEditing()){if(writingPanel.replaceRecent(previous,replacement)){revision++;return true;}return false;}
        if(!editor.valid()||editor.hasSelection()||!before().endsWith(previous))return false;
        InputConnection ic=getCurrentInputConnection();if(ic==null)return false;
        ic.beginBatchEdit();ic.deleteSurroundingText(previous.length(),0);ic.commitText(replacement,1);ic.endBatchEdit();
        editor.deleteLeft(previous.length());editor.insert(replacement);clearUndo();afterEdit();return true;
    }
    private void render(){
        if(root==null)return;root.removeAllViews();letters.clear();shiftKey=null;shiftVisual=-1;barMode=-1;keyboardShown=false;
        root.setBackground(writingPanel==null?new ColorDrawable(Color.BLACK):new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{0xff28384f,0xff28483e,0xff362d4c}));
        panelEditingShown=writingPanel!=null&&writingPanel.isEditing();
        if(writingPanel!=null){candidates=null;writingPanel.render(root);if(!panelEditingShown)return;}
        candidates=new LinearLayout(this);candidates.setGravity(Gravity.CENTER_VERTICAL);candidates.setBackgroundColor(0xff171719);candidates.setPadding(dp(6),0,dp(6),0);root.addView(candidates,new LinearLayout.LayoutParams(-1,dp(46)));
        if(panelEditingShown){TextView hint=new TextView(this);hint.setText("Editando prévia · Concluir acima");hint.setTextColor(Color.LTGRAY);hint.setGravity(Gravity.CENTER);candidates.addView(hint,new LinearLayout.LayoutParams(-1,-1));}
        else updateSuggestions();
        if(numbers||symbols){LinearLayout r=row();for(char c:"1234567890".toCharArray()){
            KeyboardKey k=(KeyboardKey)key(r,String.valueOf(c),1,()->insert(String.valueOf(c)),false);k.quickTouch(true);k.setTextSize(23);k.getLayoutParams().height=dp(keyHeight-6);
        }}
        if(symbols){letters("@#$%&*()-+");letters("!\"':;/?=ç_");LinearLayout r=row();for(char c:"[]{}<>\\|".toCharArray())letter(r,String.valueOf(c));((KeyboardKey)icon(r,"backspace","Apagar ou desfazer correção",this::backspace)).repeatOnHold();}
        else{
            letters("qwertyuiop");letters("asdfghjklç");LinearLayout r=row();
            shiftKey=icon(r,"shift","Maiúsculas; mantenha pressionado para fixar",()->{manualShift=true;shift=!shift;capsLock=false;refreshVisuals();});((LinearLayout.LayoutParams)shiftKey.getLayoutParams()).weight=1.35f;
            shiftKey.setOnLongClickListener(v->{capsLock=!capsLock;shift=capsLock;manualShift=capsLock;refreshVisuals();return true;});
            for(char c:"zxcvbnm".toCharArray())letter(r,String.valueOf(c));
            KeyboardKey del=(KeyboardKey)icon(r,"backspace","Apagar ou desfazer correção",this::backspace);((LinearLayout.LayoutParams)del.getLayoutParams()).weight=1.35f;del.repeatOnHold();
        }
        LinearLayout last=row();key(last,symbols?"ABC":"!#1",1.35f,()->{symbols=!symbols;render();},true).setTextSize(19);
        long[] commaToken={-1},spaceToken={-1};
        KeyboardKey comma=(KeyboardKey)key(last,",",.85f,()->{insert(",");commaToken[0]=revision;},false);comma.quickTouch(true);comma.setOnLongClickListener(v->{if(replaceRecent(",","",commaToken[0]))showEmojis(comma);return true;});
        KeyboardKey space=(KeyboardKey)key(last,"‹    Português (BR)    ›",4.7f,()->{insert(" ");spaceToken[0]=revision;},false);space.quickTouch(true);space.setTextSize(14);space.setContentDescription("Espaço; mantenha pressionado para trocar teclado");
        space.setOnLongClickListener(v->{if(replaceRecent(" ","",spaceToken[0]))((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).showInputMethodPicker();return true;});
        ((KeyboardKey)key(last,".",.85f,()->insert("."),false)).quickTouch(true);
        Button enter=icon(last,"enter","Confirmar ou inserir nova linha",this::enter);((LinearLayout.LayoutParams)enter.getLayoutParams()).weight=1.35f;
        keyboardShown=true;builtLayout=layoutSignature();keyboardBuilds++;refreshVisuals();
    }
    private void refreshVisuals(){
        if(writingPanel!=null&&!panelEditingShown)return;
        if(!panelEditingShown)autoShift();
        for(LetterBinding binding:letters){String shown=shift||capsLock?binding.value.toUpperCase(TextEngine.PT):binding.value;if(!binding.button.getText().toString().equals(shown)){binding.button.setText(shown);binding.button.setContentDescription(shown);}}
        if(shiftKey!=null){int visual=capsLock?2:shift?1:0;if(visual!=shiftVisual){shiftVisual=visual;((KeyboardKey)shiftKey).icon(capsLock?"caps":"shift");shiftKey.setBackground(background(shift||capsLock?0xff53535a:0xff171719));}}
        if(!panelEditingShown)updateSuggestions();
    }
    private Button barIcon(LinearLayout row,String icon,String label,Runnable action,boolean fixed){
        Button b=icon(row,icon,label,action);LinearLayout.LayoutParams p=(LinearLayout.LayoutParams)b.getLayoutParams();p.height=dp(40);p.setMargins(dp(1),0,dp(1),0);
        if(fixed){p.width=dp(38);p.weight=0;}b.setLayoutParams(p);b.setTooltipText(label);return b;
    }
    private void shortcut(String icon,String label,Runnable action){Button b=barIcon(shortcutRow,icon,label,action,false);LinearLayout.LayoutParams p=(LinearLayout.LayoutParams)b.getLayoutParams();p.width=dp(50);p.weight=0;b.setLayoutParams(p);editButtons.put(label,b);}
    private void clipboardShortcuts(){
        shortcut("selectall","Selecionar tudo",()->contextAction(android.R.id.selectAll,"selecionar tudo"));shortcut("copy","Copiar seleção",()->contextAction(android.R.id.copy,"copiar"));shortcut("cut","Recortar seleção",()->contextAction(android.R.id.cut,"recortar"));shortcut("clipboard","Colar",this::pasteClipboard);
        shortcut("left","Mover cursor para a esquerda",()->moveCursor(KeyEvent.KEYCODE_DPAD_LEFT));shortcut("right","Mover cursor para a direita",()->moveCursor(KeyEvent.KEYCODE_DPAD_RIGHT));
        shortcut("undo","Desfazer",()->contextAction(android.R.id.undo,"desfazer"));shortcut("redo","Refazer",()->contextAction(android.R.id.redo,"refazer"));
    }
    private void mainShortcuts(){
        shortcut("editing","Ferramentas de edição",this::openEditingToolbar);shortcut("emoji","Emojis",()->showEmojis(candidates));shortcut("ai","Assistente · IA offline não instalada",this::openWritingPanel);shortcut("search","Lupa (em desenvolvimento)",()->unavailable("A lupa"));
    }
    private void updateSuggestions(){
        if(candidates==null||panelEditingShown)return;int mode=editingToolbar?2:toolbar.isExpanded()?1:0;
        if(mode!=barMode){
            candidates.removeAllViews();editButtons.clear();Arrays.fill(suggestions,null);shortcutScroll=null;barMode=mode;
            barIcon(candidates,mode==0?"expand":"collapse",mode==0?"Mostrar atalhos":mode==2?"Voltar à barra anterior":"Mostrar sugestões",()->{if(editingToolbar)editingToolbar=false;else toolbar.toggle();barMode=-1;updateSuggestions();},true);
            if(mode==0){
                for(int i=0;i<3;i++){
                    final int index=i;Button b=key(candidates,"",1,()->choose(suggestions[index].getText().toString()),true);b.setTextSize(17);LinearLayout.LayoutParams p=(LinearLayout.LayoutParams)b.getLayoutParams();p.height=dp(40);p.setMargins(0,0,0,0);suggestions[i]=b;
                }
                barIcon(candidates,"more","Mostrar todos os atalhos",()->{toolbar.toggle();barMode=-1;updateSuggestions();},true);
            }else{
                shortcutScroll=new HorizontalScrollView(this);shortcutScroll.setHorizontalScrollBarEnabled(true);shortcutScroll.setFillViewport(false);shortcutScroll.setContentDescription("Atalhos: deslize para os lados");shortcutScroll.setClipToPadding(false);
                candidates.addView(shortcutScroll,new LinearLayout.LayoutParams(0,dp(46),1));shortcutRow=new LinearLayout(this);shortcutRow.setGravity(Gravity.CENTER_VERTICAL);shortcutScroll.addView(shortcutRow,new HorizontalScrollView.LayoutParams(-2,-1));
                if(mode==2){clipboardShortcuts();mainShortcuts();}else{mainShortcuts();clipboardShortcuts();}
                shortcut("translate","Tradução (em desenvolvimento)",()->unavailable("A tradução"));shortcut("settings","Configurações",this::openSettings);shortcut("more","Mais opções",()->showMore(candidates));
            }
        }
        if(mode==0)queueSuggestions();else updateEditButtons();
    }
    private void updateEditButtons(){for(String label:new String[]{"Selecionar tudo","Copiar seleção","Recortar seleção","Colar","Desfazer","Refazer"}){Button b=editButtons.get(label);if(b!=null)b.setEnabled(!sensitive&&(!(label.equals("Copiar seleção")||label.equals("Recortar seleção"))||editor.hasSelection()));}}
    private void queueSuggestions(){handler.removeCallbacks(suggestLater);if(alive&&barMode==0&&!sensitive)handler.postDelayed(suggestLater,35);}
    private void findSuggestions(){
        if(barMode!=0)return;final String prefix=before();final long token=revision,generation=session;final boolean off=literal;
        suggestionWorker.execute(()->{List<String> options=off?Collections.emptyList():TextEngine.suggestionsForContext(prefix);handler.post(()->{
            if(!alive||generation!=session||token!=revision||barMode!=0)return;
            for(int i=0;i<3;i++){Button b=suggestions[i];if(b==null)continue;String word=i<options.size()?options.get(i):"";if(!b.getText().toString().equals(word))b.setText(word);b.setContentDescription(word);b.setEnabled(!word.isEmpty());}
        });});
    }
    private void toggleToolbar(){editingToolbar=false;toolbar.toggle();barMode=-1;updateSuggestions();}
    private void unavailable(String feature){Toast.makeText(this,feature+" ainda não está disponível nesta versão.",Toast.LENGTH_LONG).show();}
    private void openWritingPanel(){if(literal){Toast.makeText(this,"Assistente indisponível neste tipo de campo.",Toast.LENGTH_SHORT).show();return;}revision++;clearUndo();editingToolbar=false;writingPanel=new WritingPanel(this);render();}
    void closeWritingPanel(){writingPanel=null;render();queueContext(0);}
    void refreshWritingPanel(){if(writingPanel!=null&&writingPanel.isEditing()&&panelEditingShown&&keyboardShown){writingPanel.refreshPreview();refreshVisuals();}else render();}
    private void openSettings(){startActivity(new Intent(this,SettingsActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));}
    private void showMore(View anchor){
        PopupMenu menu=new PopupMenu(new ContextThemeWrapper(this,android.R.style.Theme_Material),anchor);
        menu.getMenu().add(toolbar.isExpanded()?"Mostrar sugestões":"Mostrar atalhos").setOnMenuItemClickListener(i->{toggleToolbar();return true;});
        menu.getMenu().add("Ferramentas de edição").setOnMenuItemClickListener(i->{openEditingToolbar();return true;});
        menu.getMenu().add("Configurações").setOnMenuItemClickListener(i->{openSettings();return true;});menu.getMenu().add("Trocar teclado").setOnMenuItemClickListener(i->{((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).showInputMethodPicker();return true;});menu.getMenu().add("Recolher teclado").setOnMenuItemClickListener(i->{requestHideSelf(0);return true;});menu.show();
    }
    private void openEditingToolbar(){if(writingPanel!=null)return;editingToolbar=true;clearUndo();barMode=-1;updateSuggestions();}
    private void contextAction(int action,String label){
        if(writingPanel!=null||sensitive)return;InputConnection ic=getCurrentInputConnection();if(ic==null)return;
        if((action==android.R.id.copy||action==android.R.id.cut)&&!editor.hasSelection()){Toast.makeText(this,"Selecione um texto primeiro.",Toast.LENGTH_SHORT).show();return;}
        if(!ic.performContextMenuAction(action))Toast.makeText(this,"Este aplicativo não permitiu "+label+".",Toast.LENGTH_SHORT).show();afterExternalAction();
    }
    private void moveCursor(int direction){if(writingPanel!=null)return;InputConnection ic=getCurrentInputConnection();if(ic==null)return;ic.sendKeyEvent(new KeyEvent(0,direction));ic.sendKeyEvent(new KeyEvent(1,direction));afterExternalAction();}
    private void pasteClipboard(){
        if(writingPanel!=null||sensitive)return;ClipboardManager manager=(ClipboardManager)getSystemService(CLIPBOARD_SERVICE);ClipData clip=manager.getPrimaryClip();
        if(clip==null||clip.getItemCount()==0||clip.getItemAt(0).getText()==null){Toast.makeText(this,"Nenhum texto copiado.",Toast.LENGTH_SHORT).show();return;}
        InputConnection ic=getCurrentInputConnection();if(ic==null)return;CharSequence text=clip.getItemAt(0).getText();ic.commitText(text,1);editor.insert(text.toString());clearUndo();afterEdit();
    }
    private void showEmojis(View anchor){
        LinearLayout panel=new LinearLayout(this);panel.setOrientation(1);panel.setPadding(dp(5),dp(5),dp(5),dp(5));panel.setBackground(background(0xff28282c));PopupWindow popup=new PopupWindow(panel,dp(320),dp(130),true);popup.setBackgroundDrawable(background(0xff28282c));popup.setOutsideTouchable(true);
        for(String[] group:new String[][]{{"😀","😂","😍","🥰","😊","😎"},{"👍","🙏","❤️","🎉","🤔","😢"}}){LinearLayout r=new LinearLayout(this);panel.addView(r);for(String emoji:group)key(r,emoji,1,()->{insert(emoji);popup.dismiss();},false);}popup.showAtLocation(root,Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL,0,dp(80));
    }
    private void choose(String word){
        if(word.isEmpty())return;
        if(writingPanel!=null&&writingPanel.isEditing()){writingPanel.insert(word+" ");return;}
        if(!editor.valid()||editor.hasSelection()){queueContext(0);return;}
        InputConnection ic=getCurrentInputConnection();if(ic==null)return;String original=TextEngine.currentWord(before());
        ic.beginBatchEdit();ic.deleteSurroundingText(original.length(),0);ic.commitText(word+" ",1);ic.endBatchEdit();editor.deleteLeft(original.length());editor.insert(word+" ");editingToolbar=false;toolbar.onTyping();clearUndo();afterEdit();
    }
    private void insert(String text){
        handler.removeCallbacks(readLater);revision++;
        if(writingPanel!=null&&writingPanel.isEditing()){if(!capsLock){shift=false;manualShift=false;}writingPanel.insert(text);return;}
        InputConnection ic=getCurrentInputConnection();if(ic==null)return;editingToolbar=false;toolbar.onTyping();clearUndo();
        boolean boundary=text.equals(" ")||".,!?;:\n".contains(text);String original=TextEngine.currentWord(before());String corrected=boundary&&correction&&!literal&&editor.valid()&&!editor.hasSelection()?TextEngine.correct(original):original;
        if(!corrected.equals(original)){
            ic.beginBatchEdit();ic.deleteSurroundingText(original.length(),0);ic.commitText(corrected+text,1);ic.endBatchEdit();editor.deleteLeft(original.length());editor.insert(corrected+text);undoOriginal=original;undoExpected=corrected+text;
        }else{ic.commitText(text,1);editor.insert(text);}
        if(!capsLock){manualShift=false;shift=false;}afterEdit();
    }
    private void backspace(){
        handler.removeCallbacks(readLater);revision++;editingToolbar=false;
        if(writingPanel!=null&&writingPanel.isEditing()){writingPanel.backspace();return;}
        toolbar.onTyping();InputConnection ic=getCurrentInputConnection();if(ic==null)return;
        if(editor.hasSelection()){ic.commitText("",1);editor.insert("");}
        else if(undoExpected!=null&&editor.valid()&&before().endsWith(undoExpected)){ic.beginBatchEdit();ic.deleteSurroundingText(undoExpected.length(),0);ic.commitText(undoOriginal,1);ic.endBatchEdit();editor.deleteLeft(undoExpected.length());editor.insert(undoOriginal);}
        else{String prefix=before();int count=prefix.isEmpty()?1:Character.charCount(prefix.codePointBefore(prefix.length()));ic.deleteSurroundingTextInCodePoints(1,0);editor.deleteLeft(count);}
        clearUndo();afterEdit();
    }
    private void enter(){if(writingPanel!=null&&writingPanel.isEditing()){revision++;writingPanel.insert("\n");return;}EditorInfo info=getCurrentInputEditorInfo();InputConnection ic=getCurrentInputConnection();if(info==null||ic==null)return;int action=info.imeOptions&EditorInfo.IME_MASK_ACTION;
        if((info.imeOptions&EditorInfo.IME_FLAG_NO_ENTER_ACTION)==0&&action!=EditorInfo.IME_ACTION_NONE&&action!=EditorInfo.IME_ACTION_UNSPECIFIED){clearUndo();ic.performEditorAction(action);}else insert("\n");}
}
