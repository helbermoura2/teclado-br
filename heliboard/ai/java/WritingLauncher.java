// SPDX-License-Identifier: GPL-3.0-only
package helium314.keyboard.latin.ai;
import android.content.*;
import android.os.*;
import android.view.inputmethod.*;
import android.widget.Toast;
import android.text.InputType;
import helium314.keyboard.latin.LatinIME;
import java.util.Objects;
public final class WritingLauncher {
    private static long request;
    public static boolean syntheticTest;
    public static void open(LatinIME ime) {
        EditorInfo editor=ime.getCurrentInputEditorInfo();InputConnection connection=ime.getCurrentInputConnection();
        if(editor==null||connection==null)return;
        int variation=editor.inputType&InputType.TYPE_MASK_VARIATION;
        if((editor.inputType&InputType.TYPE_MASK_CLASS)!=InputType.TYPE_CLASS_TEXT
                ||variation==InputType.TYPE_TEXT_VARIATION_PASSWORD||variation==InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD||variation==InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD){Toast.makeText(ime,"Assistente indisponível neste campo.",Toast.LENGTH_SHORT).show();return;}
        ExtractedText extracted=connection.getExtractedText(new ExtractedTextRequest(),0);
        CharSequence selected=connection.getSelectedText(0);
        // The editor must expose a complete, bounded snapshot before we offer replacement.
        boolean complete=extracted!=null&&extracted.text!=null&&extracted.startOffset==0&&extracted.partialStartOffset<0&&extracted.text.length()<=6000;
        String snapshot=complete?extracted.text.toString():null;
        int start=complete?Math.min(extracted.selectionStart,extracted.selectionEnd):0;
        int end=complete?Math.max(extracted.selectionStart,extracted.selectionEnd):0;
        if(complete&&(start<0||end>snapshot.length()))complete=false;
        if(complete&&start==end){start=0;end=snapshot.length();}
        String source=selected==null?complete?snapshot:"":selected.toString();
        if(source.length()>4000){Toast.makeText(ime,"Selecione um trecho de até 4.000 caracteres.",Toast.LENGTH_LONG).show();return;}
        final boolean canReplace=complete;final int replaceStart=start,replaceEnd=end;
        final String original=snapshot,application=editor.packageName;final int field=editor.fieldId;
        final long id=++request;Handler handler=new Handler(Looper.getMainLooper());
        ResultReceiver result=new ResultReceiver(handler) {
            @Override protected void onReceiveResult(int code,Bundle data) {
                if(code!=1||id!=request||!canReplace||data==null)return;
                String replacement=data.getString("text");if(replacement==null||replacement.length()>12000)return;
                Runnable apply=new Runnable(){int attempts;
                    @Override public void run(){
                        if(id!=request)return;
                        EditorInfo now=ime.getCurrentInputEditorInfo();InputConnection ic=ime.getCurrentInputConnection();
                        if(now==null||ic==null||!Objects.equals(now.packageName,application)||now.fieldId!=field||!ime.isInputViewShown()){
                            if(++attempts<35)handler.postDelayed(this,150);else Toast.makeText(ime,"Volte ao campo original. O resultado continua disponível para copiar.",Toast.LENGTH_LONG).show();return;
                        }
                        ExtractedText current=ic.getExtractedText(new ExtractedTextRequest(),0);
                        if(current==null||current.text==null||current.startOffset!=0||!original.contentEquals(current.text)){
                            Toast.makeText(ime,"O texto mudou. Use Copiar para preservar suas alterações.",Toast.LENGTH_LONG).show();return;
                        }
                        ic.beginBatchEdit();boolean committed=false;
                        try {if(ic.setSelection(replaceStart,replaceEnd))committed=ic.commitText(replacement,1);}
                        finally{ic.endBatchEdit();}
                        if(!committed)Toast.makeText(ime,"Não foi possível substituir. Use Copiar.",Toast.LENGTH_LONG).show();
                    }
                };handler.postDelayed(apply,350);
            }
        };
        Intent intent=new Intent(ime,WritingActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra("synthetic_test",syntheticTest);
        intent.putExtra("source",source).putExtra("replace",canReplace).putExtra("receiver",result);
        ime.startActivity(intent);
    }
}
