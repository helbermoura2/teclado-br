// SPDX-License-Identifier: GPL-3.0-only
package helium314.keyboard.latin.ai;
import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.text.InputType;
import android.view.*;
import android.widget.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

/** Offline writing workspace, isolated from the IME in :writing. No network permission. */
public final class WritingActivity extends Activity {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private volatile boolean stopped;
    private boolean busy,nativeReady;
    private EditText source,prompt,output;
    private TextView model,status,promptLabel;
    private Button generate,cancel,replace,copy,importButton,removeModel;
    private Spinner task,style;
    private ResultReceiver receiver;
    private final String[] tasks={"Ortografia e gramática","Compositor","Estilo de escrita","Resumir","Traduzir para português"};
    private final String[] styles={"Profissional","Casual","Mídia","Educado","Com emojis"};
    private LinearLayout root;
    private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
    private TextView text(String s,int size){TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(Color.WHITE);t.setPadding(0,dp(8),0,dp(6));root.addView(t);return t;}
    private EditText edit(String hint,String tag,int lines){EditText e=new EditText(this);e.setHint(hint);e.setContentDescription(tag);e.setTextColor(Color.WHITE);e.setHintTextColor(Color.LTGRAY);e.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_MULTI_LINE|InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);e.setPrivateImeOptions("teclado-br.no-assistant");e.setMinLines(lines);e.setMaxLines(8);e.setTextSize(16);root.addView(e,new LinearLayout.LayoutParams(-1,-2));return e;}
    private Button button(String title,String tag,Runnable action){Button b=new Button(this);b.setText(title);b.setContentDescription(tag);b.setAllCaps(false);b.setOnClickListener(v->action.run());root.addView(b,new LinearLayout.LayoutParams(-1,-2));return b;}
    @Override public void onCreate(Bundle saved){super.onCreate(saved);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE|WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setBackgroundColor(Color.rgb(18,18,21));
        root=new LinearLayout(this);root.setOrientation(1);root.setPadding(dp(18),dp(24),dp(18),dp(28));scroll.addView(root);setContentView(scroll);
        text("Assistente de escrita",24);
        text("Processamento no aparelho. O resultado só altera seu texto quando você escolher Substituir.",14);
        model=text(ModelStore.description(this),14);model.setContentDescription("ai_model");
        importButton=button("Importar modelo GGUF","ai_import",()->{if(!busy){Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(pick,41);}});
        button("Onde baixar os modelos","ai_models",this::modelLinks);
        removeModel=button("Remover modelo do aparelho","ai_remove_model",()->new AlertDialog.Builder(this).setTitle("Remover modelo?").setMessage("O arquivo da IA será removido. Seu dicionário e seus pins serão mantidos.").setPositiveButton("Remover",(d,w)->{ModelStore.model(this).delete();ModelStore.metadata(this).delete();model.setText(ModelStore.description(this));status.setText("Modelo removido.");controls(false,false);}).setNegativeButton("Cancelar",null).show());
        task=new Spinner(this);task.setContentDescription("ai_task");task.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,tasks));root.addView(task);
        text("Texto para revisar ou transformar",16);source=edit("O texto selecionado aparece aqui","ai_source",2);
        source.setText(saved==null?getIntent().getStringExtra("source"):saved.getString("source",""));
        promptLabel=text("Pedido para o Compositor",16);prompt=edit("Ex.: redija uma cobrança educada de R$ 180, sem inventar dados","ai_prompt",2);
        style=new Spinner(this);style.setContentDescription("ai_style");style.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,styles));root.addView(style);
        status=text("Importe um modelo para começar.",14);status.setContentDescription("ai_status");
        generate=button("Gerar no aparelho","ai_generate",this::generate);
        cancel=button("Cancelar processamento","ai_cancel",this::cancel);cancel.setEnabled(false);
        text("Resultado — você pode editar antes de usar",16);output=edit("A resposta aparecerá aqui","ai_output",3);
        copy=button("Copiar","ai_copy",()->{((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Texto revisado",output.getText().toString()));Toast.makeText(this,"Texto copiado",Toast.LENGTH_SHORT).show();});
        replace=button("Substituir no campo original","ai_replace",()->{if(receiver!=null){Bundle data=new Bundle();data.putString("text",output.getText().toString());receiver.send(1,data);finishAndRemoveTask();}});
        button("Voltar ao teclado","ai_back",this::finishAndRemoveTask);
        receiver=getIntent().getParcelableExtra("receiver");
        task.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){
            @Override public void onItemSelected(AdapterView<?> a,View v,int position,long id){promptLabel.setVisibility(position==1?View.VISIBLE:View.GONE);prompt.setVisibility(position==1?View.VISIBLE:View.GONE);style.setVisibility(position==2?View.VISIBLE:View.GONE);}
            @Override public void onNothingSelected(AdapterView<?> a){}
        });
        if(getIntent().hasExtra("result")){output.setText(getIntent().getStringExtra("result"));status.setText("O campo original mudou ou não aceitou a substituição. Seu resultado foi preservado; use Copiar.");}
        if(saved!=null){prompt.setText(saved.getString("prompt",""));output.setText(saved.getString("output",""));task.setSelection(saved.getInt("task",0));style.setSelection(saved.getInt("style",0));}
        try {OfflineNative.reset();nativeReady=true;status.setText(ModelStore.model(this).isFile()?"Modelo pronto. Escolha a tarefa e toque em Gerar.":"Importe um modelo para começar.");}
        catch(LinkageError e){status.setText("Motor indisponível nesta arquitetura. Instale o APK compatível com seu aparelho.");}
        if(getIntent().hasExtra("result"))status.setText("Substituição não aplicada. Seu resultado foi preservado; use Copiar.");
        controls(false,false);
    }
    private void modelLinks(){new AlertDialog.Builder(this).setTitle("Modelos offline")
        .setMessage("Baixe pelo navegador e depois use Importar modelo GGUF. Qwen3.5 2B Q4_K_M ocupa cerca de 1,4 GB. Gemma 4 E2B Q4_0 ocupa cerca de 2,84 GB e precisa de mais RAM. É uma quantização diferente da Q4_K_M usada no comparativo anterior. A velocidade no Nothing Phone (1) ainda precisa ser medida.")
        .setPositiveButton("Qwen3.5 2B",(d,w)->open("https://huggingface.co/bartowski/Qwen_Qwen3.5-2B-GGUF/blob/7d26695454df6de5fbcce2e58681e62dae06ce43/Qwen_Qwen3.5-2B-Q4_K_M.gguf"))
        .setNeutralButton("Gemma 4 E2B",(d,w)->open("https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/blob/6938c58e698502037401a5f19f6905f2fb2f7dee/gemma-4-E2B-it-Q4_0.gguf"))
        .setNegativeButton("Fechar",null).show();}
    private void open(String link){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(link)));}catch(ActivityNotFoundException e){Toast.makeText(this,"Nenhum navegador disponível",Toast.LENGTH_SHORT).show();}}
    private void controls(boolean working,boolean completed){busy=working;generate.setEnabled(!working&&nativeReady&&ModelStore.model(this).isFile());importButton.setEnabled(!working);removeModel.setEnabled(!working&&ModelStore.model(this).isFile());cancel.setEnabled(working);task.setEnabled(!working);style.setEnabled(!working);source.setEnabled(!working);prompt.setEnabled(!working);output.setEnabled(!working);copy.setEnabled(!working&&(completed||output.length()>0));replace.setEnabled(!working&&(completed||output.length()>0)&&getIntent().getBooleanExtra("replace",false)&&receiver!=null);}
    private void cancel(){stopped=true;if(nativeReady)OfflineNative.cancel();cancel.setEnabled(false);status.setText("Cancelando…");}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request!=41||result!=RESULT_OK||data==null)return;Uri uri=data.getData();if(uri==null)return;
        stopped=false;controls(true,false);status.setText("Importando modelo. Aguarde…");
        worker.execute(()->{try{ModelStore.importFile(this,uri,(copied,total)->{runOnUiThread(()->{if(!isDestroyed())status.setText("Importando: "+copied/1048576+" MB"+(total>0?" de "+total/1048576+" MB":""));});return !stopped;});runOnUiThread(()->{if(!isDestroyed()){model.setText(ModelStore.description(this));status.setText("Modelo importado. Pronto para gerar offline.");controls(false,false);}});}catch(Exception e){failure(e);}});
    }
    private String buildPrompt(){String content=source.getText().toString(),request=prompt.getText().toString();int choice=task.getSelectedItemPosition();
        if(content.length()>4000||request.length()>2000)throw new IllegalArgumentException("Use até 4.000 caracteres de texto e 2.000 no pedido.");
        if(choice!=1&&content.trim().isEmpty())throw new IllegalArgumentException("Digite ou selecione um texto para esta tarefa.");
        if(choice==1&&request.trim().isEmpty())throw new IllegalArgumentException("Escreva o pedido no campo do Compositor.");
        String instruction;
        switch(choice){case 1:instruction="Redija o texto solicitado a seguir. Não invente fatos, nomes ou datas. Pedido: "+request;break;
            case 2:instruction="Reescreva no estilo "+styles[style.getSelectedItemPosition()]+", preservando todos os fatos e negações.";break;
            case 3:instruction="Resuma em português, preservando os fatos principais e sem acrescentar informações.";break;
            case 4:instruction="Traduza para português brasileiro, preservando nomes, valores e sentido.";break;
            default:instruction="Corrija somente ortografia, pontuação e gramática. Preserve o significado, os fatos e as negações. Se estiver correto, devolva o mesmo texto.";
        }
        return instruction+"\n\n<texto_para_editar>\n"+content+"\n</texto_para_editar>\nDevolva somente o texto final.";
    }
    private void generate(){final String instruction;try{instruction=buildPrompt();}catch(IllegalArgumentException e){status.setText(e.getMessage());return;}
        stopped=false;OfflineNative.reset();output.setText("");controls(true,false);status.setText("Carregando e processando no aparelho…");long start=SystemClock.elapsedRealtime();
        // The short limit is only enabled by the test build's private instrumentation.
        int limit=getIntent().getBooleanExtra("synthetic_test",false)?32:256;
        worker.execute(()->{try{if(stopped)throw new IllegalStateException("Cancelado");byte[] result=OfflineNative.generate(OfflineNative.utf8(ModelStore.model(this).getAbsolutePath()),OfflineNative.utf8(instruction),partial->{String value=new String(partial,StandardCharsets.UTF_8);runOnUiThread(()->{if(!isDestroyed()&&!stopped)output.setText(value);});},limit);
            String response=new String(result,StandardCharsets.UTF_8);boolean truncated=response.startsWith("T\n");String value=response.substring(2);
            runOnUiThread(()->{if(!isDestroyed()){if(stopped){output.setText("");status.setText("Cancelado.");controls(false,false);return;}output.setText(value);long seconds=(SystemClock.elapsedRealtime()-start)/1000;status.setText((truncated?"Limite de geração atingido. Revise o trecho antes de usar.":"Pronto. Revise antes de substituir.")+" · "+seconds+" s · offline");controls(false,true);}});
        }catch(Exception e){failure(e);}catch(OutOfMemoryError e){failure(new Exception("Memória insuficiente. Experimente um modelo menor."));}});
    }
    private void failure(Exception e){runOnUiThread(()->{if(!isDestroyed()){output.setText("");status.setText(stopped?"Cancelado.":e.getMessage());controls(false,false);}});}
    @Override protected void onSaveInstanceState(Bundle state){super.onSaveInstanceState(state);state.putString("source",source.getText().toString());state.putString("prompt",prompt.getText().toString());state.putString("output",busy?"":output.getText().toString());state.putInt("task",task.getSelectedItemPosition());state.putInt("style",style.getSelectedItemPosition());}
    @Override protected void onDestroy(){stopped=true;if(nativeReady)OfflineNative.cancel();worker.shutdownNow();super.onDestroy();}
}
