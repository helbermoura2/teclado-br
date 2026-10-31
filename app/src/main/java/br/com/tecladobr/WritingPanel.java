package br.com.tecladobr;

import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.widget.*;
import android.view.inputmethod.*;

/** User-triggered text preview. Nothing is sent or applied automatically. */
final class WritingPanel {
    private final KeyboardService service;
    private String page="menu", source="", draft="", original="", notice="";
    private int start, end, selectionStart, selectionEnd;
    private boolean editing;
    WritingPanel(KeyboardService service){this.service=service;}
    boolean isEditing(){return editing;}
    private int dp(int n){return Math.round(n*service.getResources().getDisplayMetrics().density);}
    private LinearLayout column(){LinearLayout v=new LinearLayout(service);v.setOrientation(1);v.setPadding(dp(12),dp(8),dp(12),dp(8));return v;}
    private TextView label(String text,int size){TextView v=new TextView(service);v.setText(text);v.setTextColor(Color.WHITE);v.setTextSize(size);v.setPadding(dp(8),dp(8),dp(8),dp(8));return v;}
    private Button button(LinearLayout row,String title,Runnable action){
        Button v=new Button(service);v.setText(title);v.setAllCaps(false);v.setTextSize(14);v.setTextColor(Color.WHITE);
        v.setMinWidth(0);v.setMinimumWidth(0);v.setPadding(dp(4),dp(4),dp(4),dp(4));
        GradientDrawable bg=new GradientDrawable();bg.setColor(0xff30323b);bg.setCornerRadius(dp(18));v.setBackground(bg);
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,dp(62),1);lp.setMargins(dp(3),dp(4),dp(3),dp(4));row.addView(v,lp);
        v.setOnClickListener(x->action.run());return v;
    }
    private LinearLayout row(LinearLayout parent){LinearLayout r=new LinearLayout(service);parent.addView(r);return r;}
    private boolean capture(){
        InputConnection ic=service.getCurrentInputConnection();
        ExtractedTextRequest request=new ExtractedTextRequest();request.hintMaxChars=6001;
        ExtractedText text=ic==null?null:ic.getExtractedText(request,0);
        if(text==null||text.text==null||text.startOffset!=0||text.partialStartOffset>=0||text.text.length()>6000){
            notice="Não foi possível ler este campo completo (limite de 6.000 caracteres).";return false;
        }
        original=text.text.toString();selectionStart=text.selectionStart;selectionEnd=text.selectionEnd;
        if(selectionStart<0||selectionEnd<0||selectionStart>original.length()||selectionEnd>original.length()){
            notice="O aplicativo não disponibilizou a seleção de texto.";return false;
        }
        start=Math.min(selectionStart,selectionEnd);end=Math.max(selectionStart,selectionEnd);
        if(start==end){start=0;end=original.length();}
        source=original.substring(start,end);
        if(source.trim().isEmpty()){notice="Digite ou selecione um texto antes de revisar.";return false;}
        return true;
    }
    private void review(){
        if(capture()){draft=BasicReview.correct(source);page="review";notice="Revisão básica local: corrige apenas palavras conhecidas. Gramática por IA ainda não está conectada.";}
        service.refreshWritingPanel();
    }
    private void pending(String feature){page="pending";notice=feature+" precisa do motor de IA. A escolha entre IA local e serviço online ainda está pendente. Nenhum texto foi enviado.";service.refreshWritingPanel();}
    void render(LinearLayout root){
        LinearLayout header=row(root);button(header,"⌨ Teclado",()->service.closeWritingPanel());
        button(header,page.equals("menu")?"Assistente de escrita":"‹ Voltar",()->{page="menu";editing=false;source="";draft="";original="";notice="";service.refreshWritingPanel();});
        if(editing){
            root.addView(label("Editar prévia · alterações no fim do texto",13));
            TextView preview=label(draft+"▏",16);preview.setMaxLines(3);root.addView(preview);
            LinearLayout r=row(root);button(r,"Concluir edição",()->{editing=false;service.refreshWritingPanel();});return;
        }
        ScrollView scroll=new ScrollView(service);LinearLayout content=column();scroll.addView(content);
        root.addView(scroll,new LinearLayout.LayoutParams(-1,dp(244)));
        if(page.equals("menu")){
            content.addView(label("✦ Assistente de escrita",20));
            LinearLayout first=row(content);button(first,"Ortografia e\ngramática",this::review);
            button(first,"Estilo de\nescrita",()->{page="styles";notice="";service.refreshWritingPanel();});
            button(first,"Resumir",()->pending("Resumir"));
            LinearLayout second=row(content);button(second,"Marcador",()->format(false));button(second,"Tabela",()->format(true));
            button(row(content),"Compositor",()->pending("Compositor"));
        }else if(page.equals("styles")){
            content.addView(label("Estilo de escrita",20));
            content.addView(label("Escolha o tom. Reescrita por IA ainda não conectada.",13));
            LinearLayout first=row(content);button(first,"Profissional",()->pending("Estilo Profissional"));button(first,"Casual",()->pending("Estilo Casual"));
            LinearLayout second=row(content);button(second,"Mídia",()->pending("Estilo Mídia"));button(second,"Educado",()->pending("Estilo Educado"));
            button(row(content),"Com emojis",()->pending("Estilo Com emojis"));
        }else if(page.equals("review")){
            content.addView(label("Ortografia e gramática",20));
            content.addView(label(notice,13));
            TextView result=label(draft,17);result.setTextIsSelectable(true);content.addView(result);
            if(draft.equals(source))content.addView(label("A revisão básica não encontrou alterações. Isso não garante ausência de erros.",13));
            LinearLayout actions=row(content);
            button(actions,"Editar",()->{editing=true;service.refreshWritingPanel();});
            button(actions,"Copiar",()->{android.content.ClipboardManager clipboard=(android.content.ClipboardManager)service.getSystemService(android.content.Context.CLIPBOARD_SERVICE);clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Texto revisado",draft));Toast.makeText(service,"Texto copiado",Toast.LENGTH_SHORT).show();});
            button(actions,"Substituir",this::replace);
        }else{
            content.addView(label("Recurso de IA",20));content.addView(label(notice,16));
        }
        if(!notice.isEmpty()&&!page.equals("review")&&!page.equals("pending"))content.addView(label(notice,14));
    }
    private void format(boolean table){
        if(capture()){
            if(table){draft="| Texto |\n| --- |\n| "+source.replace("|","\\|").replace("\n"," |\n| ")+" |";}
            else draft="• "+source.replace("\n","\n• ");
            page="review";notice=table?"Formatação Markdown local. Confira a prévia antes de substituir.":"Lista com marcadores. Confira a prévia antes de substituir.";
        }service.refreshWritingPanel();
    }
    private void replace(){
        InputConnection ic=service.getCurrentInputConnection();
        ExtractedText current=ic==null?null:ic.getExtractedText(new ExtractedTextRequest(),0);
        if(current==null||current.text==null||current.startOffset!=0||!original.contentEquals(current.text)||current.selectionStart!=selectionStart||current.selectionEnd!=selectionEnd){
            notice="O texto ou a seleção mudou. Volte e faça uma nova revisão para não substituir o trecho errado.";service.refreshWritingPanel();return;
        }
        boolean applied=false;
        ic.beginBatchEdit();
        try{if(ic.setSelection(start,end))applied=ic.commitText(draft,1);}
        finally{ic.endBatchEdit();}
        if(applied)service.closeWritingPanel();
        else{ic.setSelection(selectionStart,selectionEnd);notice="Este aplicativo não permitiu substituir o trecho. Use Copiar.";service.refreshWritingPanel();}
    }
    void insert(String text){draft+=text;service.refreshWritingPanel();}
    void backspace(){if(!draft.isEmpty())draft=draft.substring(0,draft.offsetByCodePoints(draft.length(),-1));service.refreshWritingPanel();}
}
