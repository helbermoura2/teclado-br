// SPDX-License-Identifier: GPL-3.0-only
package helium314.keyboard.latin.ai;
import android.content.*;
import android.graphics.*;
import android.graphics.drawable.*;
import android.inputmethodservice.InputMethodService;
import android.os.*;
import android.text.TextUtils;
import android.view.*;
import android.view.inputmethod.*;
import android.widget.*;
import helium314.keyboard.latin.LatinIME;
import helium314.keyboard.latin.R;
import helium314.keyboard.keyboard.KeyboardSwitcher;
import helium314.keyboard.keyboard.internal.keyboard_parser.floris.KeyCode;
import helium314.keyboard.event.Event;
import java.util.Objects;
/** The writing workspace lives entirely in the IME window, above the user's application. */
public final class WritingPanel {
    private static WritingPanel active;
    public static void open(LatinIME ime) {
        if(active!=null) {
            active.close();
            return;
        }
        EditorInfo info=ime.getCurrentInputEditorInfo();
        if(info==null)return;
        int type=info.inputType,variation=type&android.text.InputType.TYPE_MASK_VARIATION;
        if((type&android.text.InputType.TYPE_MASK_CLASS)!=android.text.InputType.TYPE_CLASS_TEXT||variation==android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD||variation==android.text.InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD||variation==android.text.InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD) {
            Toast.makeText(ime,"Assistente indisponível neste campo.",Toast.LENGTH_SHORT).show();
            return;
        }
        ime.prepareTecladoWriting();
        View view=ime.getTecladoInputView();
        if(!(view instanceof FrameLayout))return;
        active=new WritingPanel(ime,(FrameLayout)view);
        active.home();
    }
    public static boolean isActive() {
        return active!=null&&!active.closed;
    }
    public static boolean isEditing() {
        return isActive()&&active.localEditor!=null;
    }
    public static void onStart(EditorInfo info,boolean restarting) {
        if(active!=null&&(!restarting||info==null||!Objects.equals(active.originPackage,info.packageName)||active.originField!=info.fieldId||active.originType!=info.inputType))dismiss();
    }
    public static void dismiss() {
        if(active!=null)active.close();
    }
    public static boolean insets(InputMethodService.Insets out,View input) {
        if(!isActive())return false;
        int top=Math.max(0,input.getHeight()-active.areaHeight());
        out.contentTopInsets=top;
        out.visibleTopInsets=top;
        out.touchableInsets=InputMethodService.Insets.TOUCHABLE_INSETS_REGION;
        out.touchableRegion.set(0,top,input.getWidth(),input.getHeight());
        return true;
    }
    public static boolean text(String value) {
        if(!isEditing())return false;
        active.localConnection.commitText(value,1);
        return true;
    }
    public static boolean key(Event event) {
        if(!isEditing())return false;
        int cp=event.getCodePoint(),code=event.getKeyCode();
        InputConnection ic=active.localConnection;
        if(code==KeyCode.DELETE) {
            int a=active.localEditor.getSelectionStart(),b=active.localEditor.getSelectionEnd();
            if(a!=b)ic.commitText("",1);
            else ic.deleteSurroundingTextInCodePoints(1,0);
        }
        else if(cp>=0)ic.commitText(new String(Character.toChars(cp)),1);
        else if(code==KeyCode.CLIPBOARD_PASTE) {
            ClipboardManager cb=(ClipboardManager)active.ime.getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData clip=cb.getPrimaryClip();
            if(clip!=null&&clip.getItemCount()>0)ic.commitText(clip.getItemAt(0).coerceToText(active.c),1);
        }
        else if(code==KeyCode.CLIPBOARD_SELECT_ALL)active.localEditor.selectAll();
        else if(code==KeyCode.CLIPBOARD_COPY)active.localEditor.onTextContextMenuItem(android.R.id.copy);
        else if(code==KeyCode.CLIPBOARD_CUT)active.localEditor.onTextContextMenuItem(android.R.id.cut);
        else if(code==KeyCode.ARROW_LEFT||code==KeyCode.ARROW_RIGHT) {
            int p=active.localEditor.getSelectionEnd()+(code==KeyCode.ARROW_LEFT?-1:1);
            active.localEditor.setSelection(Math.max(0,Math.min(active.localEditor.length(),p)));
        }
        return true;
    }
    private final LatinIME ime;
    private final Context c;
    private final FrameLayout input;
    private final LinearLayout frame;
    private final View strip;
    private final String originPackage;
    private final int originField,originType;
    private final int height,stripVisibility;
    private FrameLayout overlay;
    private LinearLayout content,header,editorBar;
    private TextView resultView,status;
    private EditText localEditor;
    private InputConnection localConnection;
    private String prompt="",answer="",task="",style="";
    private boolean closed,busy,bound,applied,replaceAllowed;
    private int safeBottom,request;
    private TextSnapshot snapshot;
    private Messenger remote;
    private Runnable pending;
    private TextView replaceButton,modeButton;
    private boolean showChanges;
    private String lastBackend="";
    private long lastDuration;
    private final ServiceConnection connection=new ServiceConnection() {
        @Override public void onServiceConnected(ComponentName n,IBinder binder) {
            if(closed)return;
            remote=new Messenger(binder);
            if(pending!=null) {
                Runnable p=pending;
                pending=null;
                p.run();
            }
        }
        @Override public void onServiceDisconnected(ComponentName n) {
            remote=null;
            if(!closed&&busy)failed("O processamento foi interrompido. Tente novamente.");
        }
    };
    private WritingPanel(LatinIME service,FrameLayout root) {
        ime=service;
        EditorInfo origin=service.getCurrentInputEditorInfo();
        originPackage=origin.packageName;
        originField=origin.fieldId;
        originType=origin.inputType;
        input=root;
        c=root.getContext();
        frame=root.findViewById(R.id.main_keyboard_frame);
        strip=root.findViewById(R.id.strip_container);
        stripVisibility=strip.getVisibility();
        height=Math.min((int)(c.getResources().getDisplayMetrics().heightPixels*.65f),Math.max(dp(260),frame.getHeight()));
    }
    private int dp(int n) {
        return (int)(n*c.getResources().getDisplayMetrics().density+.5f);
    }
    private int areaHeight() {
        return localEditor!=null?frame.getHeight():height;
    }
    private GradientDrawable round(int color,int radius) {
        GradientDrawable b=new GradientDrawable();
        b.setColor(color);
        b.setCornerRadius(dp(radius));
        return b;
    }
    private TextView label(String value,int size) {
        TextView t=new TextView(c);
        t.setText(value);
        t.setTextColor(Color.WHITE);
        t.setTextSize(size);
        t.setGravity(Gravity.CENTER_VERTICAL);
        t.setFontFeatureSettings("kern");
        return t;
    }
    private TextView action(String value,String id,Runnable click) {
        TextView t=label(value,15);
        t.setGravity(Gravity.CENTER);
        t.setPadding(dp(10),dp(8),dp(10),dp(8));
        t.setContentDescription(id);
        t.setOnClickListener(v->click.run());
        t.setFocusable(true);
        return t;
    }
    private View icon(String name,int size) {
        ImageView v=new ImageView(c);
        v.setImageDrawable(WritingGraphics.icon(name));
        v.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        v.setLayoutParams(new LinearLayout.LayoutParams(dp(size),dp(size)));
        return v;
    }
    private void screen(String title,boolean home) {
        if(closed)return;
        endEditing(false);
        frame.setVisibility(View.INVISIBLE);
        if(overlay!=null)input.removeView(overlay);
        overlay=new FrameLayout(c);
        overlay.setContentDescription("ai_panel");
        overlay.setElevation(dp(16));
        overlay.setBackground(WritingGraphics.background());
        overlay.setClickable(true);
        input.addView(overlay,new FrameLayout.LayoutParams(-1,height,Gravity.BOTTOM));
        LinearLayout all=new LinearLayout(c);
        all.setOrientation(1);
        WindowInsets system=input.getRootWindowInsets();
        safeBottom=system==null?0:system.getStableInsetBottom();
        all.setPadding(dp(12),0,dp(12),dp(12)+safeBottom);
        overlay.addView(all,new FrameLayout.LayoutParams(-1,-1));
        header=new LinearLayout(c);
        header.setGravity(Gravity.CENTER_VERTICAL);
        all.addView(header,new LinearLayout.LayoutParams(-1,dp(48)));
        LinearLayout keyboard=new LinearLayout(c);
        keyboard.setGravity(Gravity.CENTER);
        keyboard.addView(icon("keyboard",22));
        keyboard.setContentDescription("ai_back");
        keyboard.setOnClickListener(v->close());
        header.addView(keyboard,new LinearLayout.LayoutParams(dp(38),-1));
        View line=new View(c);
        line.setBackgroundColor(0x55ffffff);
        LinearLayout.LayoutParams divider=new LinearLayout.LayoutParams(dp(1),dp(20));
        divider.setMargins(dp(6),0,dp(12),0);
        header.addView(line,divider);
        TextView heading=label(title,16);
        heading.setSingleLine(true);
        heading.setEllipsize(TextUtils.TruncateAt.END);
        header.addView(heading,new LinearLayout.LayoutParams(0,-1,1));
        modeButton=action(modeLabel(),"ai_mode",this::modes);
        modeButton.setTextSize(12);
        header.addView(modeButton,new LinearLayout.LayoutParams(dp(78),-1));
        LinearLayout end=new LinearLayout(c);
        end.setGravity(Gravity.CENTER);
        end.addView(icon(home?"settings":"info",22));
        end.setContentDescription(home?"ai_settings":"ai_info");
        end.setOnClickListener(v-> {
            if(home)settings();
            else toast(ModelStore.description(ime));
        });
        header.addView(end,new LinearLayout.LayoutParams(dp(38),-1));
        content=new LinearLayout(c);
        content.setOrientation(1);
        all.addView(content,new LinearLayout.LayoutParams(-1,0,1));
        overlay.bringToFront();
        input.requestLayout();
    }
    private LinearLayout rowCard(float weight) {
        LinearLayout row=new LinearLayout(c);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setBackground(round(0x8a2b3e4d,28));
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,0,weight);
        lp.setMargins(0,dp(8),0,0);
        content.addView(row,lp);
        return row;
    }
    private void tile(LinearLayout row,String glyph,String title,String id,boolean vertical,Runnable action) {
        LinearLayout tile=new LinearLayout(c);
        tile.setOrientation(vertical?1:0);
        tile.setGravity(Gravity.CENTER);
        tile.setPadding(dp(6),dp(8),dp(6),dp(8));
        tile.setContentDescription(id);
        tile.setOnClickListener(v->action.run());
        tile.setFocusable(true);
        tile.addView(icon(glyph,25));
        TextView text=label(title,15);
        text.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(vertical?-1:-2,-2);
        if(vertical)lp.topMargin=dp(7);
        else lp.leftMargin=dp(10);
        tile.addView(text,lp);
        row.addView(tile,new LinearLayout.LayoutParams(0,-1,1));
    }
    private void separator(LinearLayout row) {
        View v=new View(c);
        v.setBackgroundColor(0x33ffffff);
        row.addView(v,new LinearLayout.LayoutParams(dp(1),dp(52)));
    }
    private void home() {
        cancelRequest();
        screen("Assistente de escrita",true);
        LinearLayout row=rowCard(2);
        tile(row,"spelling","Ortografia e\ngramática","ai_review",true,()->choose("Ortografia e gramática"));
        separator(row);
        tile(row,"style","Estilo de escrita","ai_style",true,this::styles);
        separator(row);
        tile(row,"summary","Resumir","ai_summary",true,()->choose("Resumir"));
        row=rowCard(1);
        tile(row,"bullets","Marcador","ai_bullets",false,()->choose("Marcador"));
        separator(row);
        tile(row,"table","Tabela","ai_table",false,()->choose("Tabela"));
        row=rowCard(1);
        tile(row,"compose","Compositor","ai_compositor",false,this::composer);
        TextView translation=action("Traduzir para português","ai_translate",()->choose("Traduzir para português"));
        content.addView(translation,new LinearLayout.LayoutParams(-1,dp(40)));
        if(!AiPreferences.canStart(ime)) {
            TextView hint=action("Adicione um modelo em ⚙","ai_missing_model",this::settings);
            hint.setTextSize(13);
            content.addView(hint,new LinearLayout.LayoutParams(-1,dp(28)));
        }
        else {
            View space=new View(c);
            content.addView(space,new LinearLayout.LayoutParams(-1,0,.6f));
        }
    }
    private String modeLabel() {
        switch(AiPreferences.mode(ime)) {
            case AiPreferences.AUTO:return "Auto ▾";
            case AiPreferences.ONLINE:return "Online ▾";
            default:return "Offline ▾";
        }
    }
    private void modes() {
        if(busy) {
            toast("Cancele a tarefa antes de trocar o modo.");
            return;
        }
        PopupMenu menu=new PopupMenu(c,modeButton);
        String[] modes= {
            AiPreferences.OFFLINE,AiPreferences.AUTO,AiPreferences.ONLINE
        };
        String[] names= {
            "Offline · só no aparelho","Automático · Groq com retorno ao aparelho","Online · só Groq"
        };
        for(int i=0;i<modes.length;i++) {
            final String mode=modes[i];
            menu.getMenu().add(names[i]).setOnMenuItemClickListener(item-> {
                AiPreferences.mode(ime,mode);
                modeButton.setText(modeLabel());
                if(!AiPreferences.OFFLINE.equals(mode)&&!SecretStore.hasKey(ime))toast("Cadastre a chave da Groq na engrenagem. Sem chave, Automático usa o aparelho.");
                return true;
            });
        }
        menu.show();
    }
    private void settings() {
        close();
        ime.startActivity(new Intent(ime,ModelSettingsActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    }
    private void styles() {
        cancelRequest();
        screen("Estilo de escrita",false);
        String[] values= {
            "Profissional","Casual","Mídia","Educado","Com emojis"
        };
        for(String value:values) {
            TextView option=action(value,"ai_style_"+value,()-> {
                style=value;
                choose("Estilo de escrita");
            });
            option.setBackground(round(0x8a2b3e4d,22));
            LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,0,1);
            p.setMargins(0,dp(7),0,0);
            content.addView(option,p);
        }
    }
    private void composer() {
        cancelRequest();
        screen("Compositor",false);
        TextView heading=label("O que você quer escrever?",16);
        content.addView(heading,new LinearLayout.LayoutParams(-1,dp(44)));
        TextView field=action(prompt.isEmpty()?"Escreva seu pedido…":prompt,"ai_prompt",()->edit(prompt,true));
        field.setGravity(Gravity.TOP|Gravity.LEFT);
        field.setPadding(dp(18),dp(18),dp(18),dp(18));
        field.setBackground(round(0x8a2b3e4d,24));
        content.addView(field,new LinearLayout.LayoutParams(-1,0,1));
        TextView go=action("Gerar texto","ai_generate",()-> {
            if(prompt.trim().isEmpty()) {
                toast("Escreva um pedido para o Compositor.");
                return;
            }
            choose("Compositor");
        });
        go.setBackground(round(0x8a2b3e4d,24));
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(48));
        p.topMargin=dp(12);
        content.addView(go,p);
    }
    private void choose(String value) {
        snapshot=TextSnapshot.capture(ime);
        task=value;
        applied=false;
        replaceAllowed=snapshot!=null&&snapshot.complete;
        if(snapshot==null||(snapshot.source.trim().isEmpty()&&!task.equals("Compositor"))) {
            screen(value,false);
            notice("Digite ou selecione um texto na conversa para usar esta opção.");
            return;
        }
        if(snapshot.source.length()>4000||prompt.length()>2000) {
            screen(value,false);
            notice("Selecione um trecho menor para processar.");
            return;
        }
        if(!AiPreferences.canStart(ime)) {
            screen(value,false);
            notice("Configure a Groq ou importe um modelo offline na engrenagem.");
            return;
        }
        if(!task.equals("Compositor"))snapshot.highlight(ime);
        answer="";
        lastBackend="";
        showChanges=false;
        busy=true;
        screen(value,false);
        renderResult();
        generate();
    }
    private void notice(String value) {
        TextView t=label(value,16);
        t.setPadding(dp(18),dp(18),dp(18),dp(18));
        content.addView(t,new LinearLayout.LayoutParams(-1,0,1));
        content.addView(action("Configurações do modelo","ai_settings_model",this::settings),new LinearLayout.LayoutParams(-1,dp(48)));
        content.addView(action("Voltar","ai_home",this::home),new LinearLayout.LayoutParams(-1,dp(44)));
    }
    private void renderResult() {
        content.removeAllViews();
        LinearLayout card=new LinearLayout(c);
        card.setOrientation(1);
        card.setPadding(dp(18),dp(18),dp(10),dp(8));
        card.setBackground(round(0x8a2b3e4d,28));
        LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-1,0,1);
        cp.topMargin=dp(8);
        content.addView(card,cp);
        if(!busy&&!answer.isEmpty()&&snapshot!=null&&!snapshot.source.isEmpty()) {
            TextView changes=action(showChanges?"Ver somente o resultado":"Comparar alterações","ai_diff",()-> {
                showChanges=!showChanges;
                renderResult();
            });
            changes.setTextSize(13);
            card.addView(changes,new LinearLayout.LayoutParams(-1,dp(36)));
        }
        ScrollView scroll=new ScrollView(c);
        LinearLayout texts=new LinearLayout(c);
        texts.setOrientation(1);
        scroll.addView(texts,new ScrollView.LayoutParams(-1,-2));
        TextChanges.Pair changes=!busy&&snapshot!=null?TextChanges.compare(snapshot.source,answer):null;
        if(showChanges&&changes!=null) {
            TextView title=label("Original · trechos removidos riscados",12);
            texts.addView(title);
            TextView original=label("",16);
            original.setText(changes.before);
            original.setContentDescription("ai_original");
            original.setPadding(0,dp(6),0,dp(12));
            texts.addView(original);
            texts.addView(label("Revisado · alterações destacadas",12));
        }
        resultView=label(busy&&answer.isEmpty()?"Processando…":answer,17);
        if(showChanges&&changes!=null)resultView.setText(changes.after);
        resultView.setContentDescription("ai_output");
        resultView.setTextIsSelectable(!busy);
        resultView.setGravity(Gravity.TOP);
        texts.addView(resultView,new LinearLayout.LayoutParams(-1,-2));
        card.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout actions=new LinearLayout(c);
        actions.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);
        card.addView(actions,new LinearLayout.LayoutParams(-1,dp(46)));
        TextView edit=action("Editar","ai_edit_result",()->edit(answer,false));
        TextView copy=action("Copiar","ai_copy",()-> {
            ((ClipboardManager)ime.getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Texto revisado",answer));
            toast("Texto copiado");
        });
        replaceButton=action("Substituir","ai_replace",this::replace);
        for(TextView a:new TextView[] {
            edit,copy,replaceButton
        }) {
            a.setEnabled(!busy&&!answer.isEmpty()&&(a!=replaceButton||replaceAllowed));
            a.setAlpha(a.isEnabled()?1:.4f);
            actions.addView(a,new LinearLayout.LayoutParams(-2,-1));
        }
        status=label(busy?"Processando…":(lastBackend.isEmpty()?"":lastBackend+" · "+String.format(java.util.Locale.ROOT,"%.1f s",lastDuration/1000.0)+"\n")+"Revise antes de substituir.",13);
        status.setContentDescription("ai_status");
        status.setMaxLines(3);
        status.setEllipsize(TextUtils.TruncateAt.END);
        status.setPadding(dp(8),dp(8),dp(8),dp(4));
        content.addView(status,new LinearLayout.LayoutParams(-1,-2));
        if(busy)content.addView(action("Cancelar","ai_cancel",()-> {
            cancelRequest();
            busy=false;
            answer="";
            renderResult();
            status.setText("Cancelado.");
        }),new LinearLayout.LayoutParams(-1,dp(42)));
        else content.addView(action("Voltar às opções","ai_home",this::home),new LinearLayout.LayoutParams(-1,dp(42)));
    }
    private void generate() {
        int id=++request;
        ResultReceiver receiver=new ResultReceiver(new Handler(Looper.getMainLooper())) {
            @Override protected void onReceiveResult(int code,Bundle data) {
                if(closed||id!=request||data==null)return;
                String value=data.getString("text","");
                if(code==1) {
                    answer=value;
                    if(resultView!=null)resultView.setText(value);
                }
                else if(code==4) {
                    if(status!=null)status.setText(value);
                }
                else if(code==2) {
                    busy=false;
                    answer=value;
                    lastBackend=data.getString("backend","");
                    lastDuration=data.getLong("duration_ms");
                    renderResult();
                    if(data.getBoolean("truncated"))status.setText("Limite de geração atingido. Confira o trecho.\n"+lastBackend);
                }
                else failed(value);
            }
        };
        pending=()-> {
            if(closed||id!=request)return;
            Message m=Message.obtain(null,1);
            Bundle b=new Bundle();
            b.putString("mode",AiPreferences.mode(ime));
            b.putString("prompt",PromptBuilder.build(task,style,prompt,snapshot.source));
            b.putInt("limit",WritingLauncher.syntheticTest?32:256);
            Parcel parcel=Parcel.obtain();
            try {
                receiver.writeToParcel(parcel,0);
                parcel.setDataPosition(0);
                b.putParcelable("receiver",ResultReceiver.CREATOR.createFromParcel(parcel));
            }
            finally {
                parcel.recycle();
            }
            m.setData(b);
            try {
                remote.send(m);
            }
            catch(RemoteException e) {
                failed("Não foi possível iniciar o processamento.");
            }
        };
        if(remote!=null) {
            Runnable r=pending;
            pending=null;
            r.run();
        }
        else if(!bound) {
            bound=ime.bindService(new Intent(ime,WritingEngineService.class),connection,Context.BIND_AUTO_CREATE);
            if(!bound)failed("Não foi possível iniciar o motor offline.");
        }
    }
    private void failed(String text) {
        busy=false;
        answer="";
        renderResult();
        status.setText(text==null?"Falha no processamento.":text);
    }
    private void cancelRequest() {
        request++;
        pending=null;
        if(remote!=null)try {
            remote.send(Message.obtain(null,2));
        }
        catch(RemoteException ignored) {
        }
    }
    private void replace() {
        if(snapshot==null||answer.length()>12000||!snapshot.apply(ime,answer)) {
            replaceAllowed=false;
            replaceButton.setEnabled(false);
            replaceButton.setAlpha(.4f);
            status.setText("O texto original mudou. Seu resultado foi preservado; use Copiar.");
            return;
        }
        applied=true;
        close();
    }
    private void edit(String initial,boolean isPrompt) {
        cancelRequest();
        busy=false;
        if(overlay!=null) {
            input.removeView(overlay);
            overlay=null;
        }
        frame.setVisibility(View.VISIBLE);
        strip.setVisibility(View.GONE);
        editorBar=new LinearLayout(c);
        editorBar.setOrientation(1);
        editorBar.setPadding(dp(10),0,dp(10),dp(8));
        editorBar.setBackground(WritingGraphics.background());
        LinearLayout row=new LinearLayout(c);
        row.setGravity(Gravity.CENTER_VERTICAL);
        TextView title=label(isPrompt?"Pedido para o Compositor":"Editar resultado",14);
        row.addView(title,new LinearLayout.LayoutParams(0,dp(38),1));
        row.addView(action("Concluir","ai_done_edit",()-> {
            String value=localEditor.getText().toString();
            endEditing(true);
            if(isPrompt) {
                prompt=value;
                composer();
            }
            else {
                answer=value;
                screen(task,false);
                renderResult();
            }
        }),new LinearLayout.LayoutParams(-2,dp(38)));
        row.addView(action("Cancelar","ai_cancel_edit",()-> {
            endEditing(true);
            if(isPrompt)composer();
            else {
                screen(task,false);
                renderResult();
            }
        }),new LinearLayout.LayoutParams(-2,dp(38)));
        editorBar.addView(row);
        localEditor=new EditText(c);
        localEditor.setContentDescription("ai_local_edit");
        localEditor.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        localEditor.setShowSoftInputOnFocus(false);
        localEditor.setTextColor(Color.WHITE);
        localEditor.setTextSize(16);
        localEditor.setMaxLines(3);
        localEditor.setBackground(round(0x7a2b3e4d,12));
        localEditor.setPadding(dp(12),dp(6),dp(12),dp(6));
        localEditor.setText(initial);
        localEditor.setSelection(localEditor.length());
        editorBar.addView(localEditor,new LinearLayout.LayoutParams(-1,dp(64)));
        frame.addView(editorBar,0,new LinearLayout.LayoutParams(-1,-2));
        localEditor.requestFocus();
        localConnection=new BaseInputConnection(localEditor,true) {
            @Override public android.text.Editable getEditable() {
                return localEditor.getText();
            }
        };
        KeyboardSwitcher.getInstance().requestUpdatingShiftState(0,0);
        input.requestLayout();
    }
    private void endEditing(boolean keep) {
        if(localConnection!=null)localConnection.finishComposingText();
        localConnection=null;
        localEditor=null;
        if(editorBar!=null) {
            frame.removeView(editorBar);
            editorBar=null;
        }
        strip.setVisibility(stripVisibility);
    }
    private void close() {
        if(closed)return;
        closed=true;
        cancelRequest();
        endEditing(false);
        if(overlay!=null)input.removeView(overlay);
        frame.setVisibility(View.VISIBLE);
        if(snapshot!=null&&!applied)snapshot.restore(ime);
        if(bound) {
            try {
                ime.unbindService(connection);
            }
            catch(IllegalArgumentException ignored) {
            }
            bound=false;
        }
        remote=null;
        active=null;
        input.requestLayout();
        KeyboardSwitcher.getInstance().requestUpdatingShiftState(ime.getCurrentAutoCapsState(),ime.getCurrentRecapitalizeState());
    }
    private void toast(String text) {
        Toast.makeText(ime,text,Toast.LENGTH_SHORT).show();
    }
}
