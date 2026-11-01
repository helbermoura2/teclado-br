// SPDX-License-Identifier: GPL-3.0-only
package helium314.keyboard.latin.ai;
import android.app.*;import android.os.*;import android.content.*;import android.net.Uri;import android.graphics.Color;import android.widget.*;import java.util.concurrent.*;
/** Model management is intentionally separate from the writing panel. */
public final class ModelSettingsActivity extends Activity {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();private volatile boolean cancelled;private boolean busy;
    private LinearLayout root;private TextView description,status;private Button add,remove,cancel;
    private TextView label(String t,int size){TextView v=new TextView(this);v.setText(t);v.setTextSize(size);v.setTextColor(Color.WHITE);v.setPadding(0,16,0,16);root.addView(v);return v;}
    private Button button(String text,Runnable action){Button b=new Button(this);b.setText(text);b.setAllCaps(false);b.setOnClickListener(v->action.run());root.addView(b,new LinearLayout.LayoutParams(-1,-2));return b;}
    @Override public void onCreate(Bundle state){super.onCreate(state);ScrollView scroll=new ScrollView(this);scroll.setBackgroundColor(0xff17191e);root=new LinearLayout(this);root.setOrientation(1);root.setPadding(24,32,24,24);scroll.addView(root);setContentView(scroll);
        label("Modelo offline",24);label("Estas configurações não alteram seu dicionário nem seus pins.",15);description=label(ModelStore.description(this),16);
        add=button("Importar modelo GGUF",()->{if(!busy)startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE),41);});
        button("Onde baixar os modelos",()->new AlertDialog.Builder(this).setTitle("Modelos offline").setMessage("Baixe no navegador e importe o GGUF. Qwen3.5 2B Q4_K_M: cerca de 1,4 GB. Gemma 4 E2B Q4_0: cerca de 2,84 GB; exige mais memória. A qualidade e velocidade dependem do aparelho e do modelo.").setPositiveButton("Qwen3.5 2B",(d,w)->open("https://huggingface.co/bartowski/Qwen_Qwen3.5-2B-GGUF/blob/7d26695454df6de5fbcce2e58681e62dae06ce43/Qwen_Qwen3.5-2B-Q4_K_M.gguf")).setNeutralButton("Gemma 4 E2B",(d,w)->open("https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/blob/6938c58e698502037401a5f19f6905f2fb2f7dee/gemma-4-E2B-it-Q4_0.gguf")).setNegativeButton("Fechar",null).show());
        remove=button("Remover modelo",()->{if(!busy)new AlertDialog.Builder(this).setTitle("Remover somente o modelo?").setMessage("Seu dicionário e seus pins serão mantidos.").setPositiveButton("Remover",(d,w)->{ModelStore.model(this).delete();ModelStore.metadata(this).delete();description.setText(ModelStore.description(this));controls(false);}).setNegativeButton("Cancelar",null).show();});
        status=label("Após importar, volte ao aplicativo e abra o brilho do teclado.",14);cancel=button("Cancelar importação",()->{cancelled=true;status.setText("Cancelando…");});button("Voltar",this::finish);controls(false);
    }
    private void open(String url){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(ActivityNotFoundException e){status.setText("Abra o link em um navegador.");}}
    private void controls(boolean b){busy=b;add.setEnabled(!b);remove.setEnabled(!b&&ModelStore.model(this).isFile());cancel.setEnabled(b);}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request!=41||result!=RESULT_OK||data==null||data.getData()==null)return;Uri uri=data.getData();cancelled=false;controls(true);status.setText("Importando…");worker.execute(()->{try{ModelStore.importFile(this,uri,(n,total)->{runOnUiThread(()->{if(!isDestroyed())status.setText("Importando: "+n/1048576+" MB"+(total>0?" de "+total/1048576+" MB":""));});return !cancelled;});runOnUiThread(()->{if(!isDestroyed()){description.setText(ModelStore.description(this));status.setText("Modelo pronto para usar no painel do teclado.");controls(false);}});}catch(Exception e){runOnUiThread(()->{if(!isDestroyed()){status.setText(e.getMessage());controls(false);}});}});}
    @Override protected void onDestroy(){cancelled=true;worker.shutdownNow();super.onDestroy();}
}
