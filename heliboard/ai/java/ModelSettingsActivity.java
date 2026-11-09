// SPDX-License-Identifier: GPL-3.0-only
package helium314.keyboard.latin.ai;
import android.app.*;
import android.os.*;
import android.content.*;
import android.net.Uri;
import android.graphics.Color;
import android.text.InputType;
import android.view.WindowManager;
import android.widget.*;
import java.util.concurrent.*;
/** Configuration and synthetic measurements. Real prompts never appear in this activity. */
public final class ModelSettingsActivity extends Activity {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private volatile boolean cancelled;
    private boolean busy,measuring,bound;
    private LinearLayout root;
    private TextView description,status,keyState,geminiKeyState,metrics;
    private Button add,remove,cancel,save,measure,cancelMeasure;
    private EditText key,geminiKey;
    private RadioGroup modes;
    private Messenger engine;
    private int dp(int n) {
        return (int)(n*getResources().getDisplayMetrics().density+.5f);
    }
    private TextView label(String text,int size) {
        TextView v=new TextView(this);
        v.setText(text);
        v.setTextSize(size);
        v.setTextColor(Color.WHITE);
        v.setPadding(0,dp(10),0,dp(8));
        root.addView(v);
        return v;
    }
    private Button button(String text,String id,Runnable action) {
        Button b=new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setMinHeight(dp(48));
        if(id!=null)b.setContentDescription(id);
        b.setOnClickListener(v->action.run());
        root.addView(b,new LinearLayout.LayoutParams(-1,-2));
        return b;
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(0xff17191e);
        root=new LinearLayout(this);
        root.setOrientation(1);
        SettingsLayout.insets(root,dp(20));
        scroll.addView(root);
        setContentView(scroll);
        label("Assistente · configurações",24);
        label("Somente tarefas iniciadas por você no botão de brilho enviam o texto selecionado ao Gemini e, se ele falhar, à Groq. O modo Offline não envia texto. A digitação e o aprendizado continuam no aparelho.",14);
        modes=new RadioGroup(this);
        String[] names= {
            "Offline · somente no aparelho","Automático · Gemini → Groq → aparelho","Online · Gemini → Groq (sem offline)"
        };
        String[] values= {
            AiPreferences.OFFLINE,AiPreferences.AUTO,AiPreferences.ONLINE
        };
        for(int i=0;i<3;i++) {
            RadioButton radio=new RadioButton(this);
            radio.setId(android.view.View.generateViewId());
            radio.setText(names[i]);
            radio.setTextColor(Color.WHITE);
            radio.setTag(values[i]);
            radio.setContentDescription("ai_setting_"+values[i]);
            radio.setMinHeight(dp(48));
            modes.addView(radio);
            if(values[i].equals(AiPreferences.mode(this)))radio.setChecked(true);
        }
        root.addView(modes);
        label("Gemini 3.8 Flash · principal online",20);
        label("Você já pode usar sua própria chave do Google AI Studio. Não cole aqui no GitHub ou no chat. A chave é cifrada no aparelho e não entra no APK. Os textos enviados usam a política da sua conta Google; contas pagas podem ter custos.",14);
        geminiKeyState=label(SecretStore.hasGeminiKey(this)?"Chave Gemini protegida já cadastrada.":"Nenhuma chave Gemini cadastrada.",14);
        geminiKeyState.setContentDescription("ai_gemini_key_state");
        geminiKey=new EditText(this);
        geminiKey.setSingleLine(true);
        geminiKey.setTextColor(Color.WHITE);
        geminiKey.setHintTextColor(Color.LTGRAY);
        geminiKey.setHint("Cole a chave do Gemini aqui");
        geminiKey.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        geminiKey.setImeOptions(android.view.inputmethod.EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING);
        geminiKey.setContentDescription("ai_gemini_key");
        root.addView(geminiKey);
        button("Abrir minhas chaves Gemini",null,()->open("https://aistudio.google.com/api-keys"));
        button("Remover só a chave Gemini","ai_remove_gemini_key",()-> {
            stopMeasurement();
            SecretStore.removeGemini(this);
            geminiKey.setText("");
            geminiKeyState.setText("Chave Gemini removida.");
            ensureUsableMode();
            status.setText("Chave Gemini removida. A chave Groq e o modelo offline foram mantidos.");
        });

        label("Groq · reserva online",20);
        label("Opcional. Se Gemini falhar, o teclado pode tentar sua chave Groq. Se as duas falharem, o modo Automático usa Gemma offline. Os serviços podem ter limites e custos conforme seu plano.",14);
        keyState=label(SecretStore.hasKey(this)?"Chave Groq protegida já cadastrada.":"Nenhuma chave Groq cadastrada.",14);
        keyState.setContentDescription("ai_key_state");
        key=new EditText(this);
        key.setSingleLine(true);
        key.setTextColor(Color.WHITE);
        key.setHintTextColor(Color.LTGRAY);
        key.setHint("Cole a chave da Groq (opcional)");
        key.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        key.setImeOptions(android.view.inputmethod.EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING);
        key.setContentDescription("ai_groq_key");
        root.addView(key);
        save=button("Salvar modo e chaves","ai_save_settings",this::saveOptions);
        button("Abrir minhas chaves Groq",null,()->open("https://console.groq.com/keys"));
        button("Remover só a chave Groq","ai_remove_key",()-> {
            stopMeasurement();
            SecretStore.remove(this);
            key.setText("");
            keyState.setText("Chave Groq removida.");
            ensureUsableMode();
            status.setText("Chave Groq removida. A chave Gemini e o modelo offline foram mantidos.");
        });
        label("Modelo offline",20);
        description=label(ModelStore.description(this),15);
        add=button("Importar modelo GGUF",null,()-> {
            if(!busy&&!measuring)startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE),41);
        });
        button("Onde baixar os modelos",null,()->new AlertDialog.Builder(this).setTitle("Modelos offline").setMessage("Baixe no navegador e importe o GGUF. Qwen3.5 2B Q4_K_M: cerca de 1,4 GB. Gemma 4 E2B Q4_0: cerca de 2,84 GB; exige mais memória. Qualidade e velocidade dependem do aparelho e do modelo.").setPositiveButton("Qwen3.5 2B",(d,w)->open("https://huggingface.co/bartowski/Qwen_Qwen3.5-2B-GGUF/blob/7d26695454df6de5fbcce2e58681e62dae06ce43/Qwen_Qwen3.5-2B-Q4_K_M.gguf")).setNeutralButton("Gemma 4 E2B",(d,w)->open("https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/blob/6938c58e698502037401a5f19f6905f2fb2f7dee/gemma-4-E2B-it-Q4_0.gguf")).setNegativeButton("Fechar",null).show());
        remove=button("Remover somente o modelo",null,()-> {
            if(!busy&&!measuring)new AlertDialog.Builder(this).setTitle("Remover o modelo?").setMessage("Seu dicionário e seus pins serão mantidos.").setPositiveButton("Remover",(d,w)-> {
                ModelStore.model(this).delete();
                ModelStore.metadata(this).delete();
                description.setText(ModelStore.description(this));
                controls(false);
            }).setNegativeButton("Cancelar",null).show();
        });
        status=label("O GGUF já importado é mantido ao atualizar o teclado.",14);
        cancel=button("Cancelar importação",null,()-> {
            cancelled=true;
            status.setText("Cancelando…");
        });
        label("Medições no seu aparelho",20);
        label("Teste com uma frase sintética, usando o modo salvo acima. Mede tempo total e pico de memória amostrado. A energia, quando informada pelo Android, é do aparelho inteiro e não isola o teclado. Compare nas mesmas condições.",14);
        measure=button("Medir IA selecionada","ai_measure",this::startMeasurement);
        cancelMeasure=button("Cancelar medição","ai_cancel_measure",this::stopMeasurement);
        metrics=label(MeasurementHistory.describe(this),14);
        metrics.setContentDescription("ai_measurements");
        button("Copiar medições",null,()-> {
            ((android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Medições de IA",MeasurementHistory.describe(this)));
            Toast.makeText(this,"Medições copiadas.",Toast.LENGTH_SHORT).show();
        });
        button("Aparência do teclado",null,()->startActivity(new Intent(this,AppearanceActivity.class)));
        button("Dicionário pessoal e backup",null,()->startActivity(new Intent(this,DictionaryActivity.class)));
        button("Voltar ao aplicativo",null,this::finish);
        controls(false);
    }
    private void ensureUsableMode() {
        if(AiPreferences.ONLINE.equals(AiPreferences.mode(this))&&
            !SecretStore.hasGeminiKey(this)&&!SecretStore.hasKey(this)) {
            AiPreferences.mode(this,AiPreferences.OFFLINE);
            for(int i=0;i<modes.getChildCount();i++) {
                RadioButton r=(RadioButton)modes.getChildAt(i);
                if(AiPreferences.OFFLINE.equals(r.getTag()))r.setChecked(true);
            }
        }
    }
    private void saveOptions() {
        if(busy||measuring)return;
        int checked=modes.getCheckedRadioButtonId();
        if(checked==-1)return;
        String mode=(String)modes.findViewById(checked).getTag();
        String groqSecret=key.getText().toString().trim();
        String geminiSecret=geminiKey.getText().toString().trim();
        save.setEnabled(false);
        worker.execute(()-> {
            try {
                if(!geminiSecret.isEmpty())SecretStore.saveGemini(this,geminiSecret);
                if(!groqSecret.isEmpty())SecretStore.save(this,groqSecret);
                if(AiPreferences.ONLINE.equals(mode)&&
                    !SecretStore.hasGeminiKey(this)&&!SecretStore.hasKey(this))
                    throw new IllegalStateException("Cadastre uma chave Gemini ou Groq.");
                AiPreferences.mode(this,mode);
                runOnUiThread(()-> {
                    if(!isDestroyed()) {
                        geminiKey.setText("");
                        key.setText("");
                        geminiKeyState.setText(SecretStore.hasGeminiKey(this)?"Chave Gemini protegida cadastrada.":"Sem chave Gemini.");
                        keyState.setText(SecretStore.hasKey(this)?"Chave Groq protegida cadastrada.":"Sem chave Groq.");
                        status.setText("Configurações salvas: "+AiPreferences.label(this));
                        save.setEnabled(true);
                    }
                });
            }
            catch(Exception e) {
                runOnUiThread(()-> {
                    if(!isDestroyed()) {
                        status.setText("Não foi possível salvar. Confira a chave e o modo escolhido.");
                        save.setEnabled(true);
                    }
                });
            }
        });
    }
    private void open(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));
        }
        catch(ActivityNotFoundException e) {
            status.setText("Abra o link em um navegador.");
        }
    }
    private void controls(boolean importing) {
        busy=importing;
        add.setEnabled(!busy&&!measuring);
        remove.setEnabled(!busy&&!measuring&&ModelStore.model(this).isFile());
        cancel.setEnabled(busy);
        save.setEnabled(!busy&&!measuring);
        measure.setEnabled(!busy&&!measuring);
        cancelMeasure.setEnabled(measuring);
    }
    private final ServiceConnection connection=new ServiceConnection() {
        public void onServiceConnected(ComponentName name,IBinder binder) {
            engine=new Messenger(binder);
            if(measuring&&!isDestroyed())sendMeasurement();
        }
        public void onServiceDisconnected(ComponentName name) {
            engine=null;
            if(measuring) {
                measuring=false;
                controls(busy);
                status.setText("Medição interrompida.");
            }
        }
    };
    private void startMeasurement() {
        if(busy||measuring)return;
        measuring=true;
        controls(false);
        status.setText("Preparando medição…");
        bound=bindService(new Intent(this,WritingEngineService.class),connection,BIND_AUTO_CREATE);
        if(!bound) {
            measuring=false;
            controls(false);
            status.setText("Não foi possível iniciar o motor.");
        }
    }
    private void sendMeasurement() {
        ResultReceiver receiver=new ResultReceiver(new Handler(Looper.getMainLooper())) {
            protected void onReceiveResult(int code,Bundle data) {
                if(!measuring||isDestroyed())return;
                if(code==4)status.setText(data.getString("text"));
                else if(code==2) {
                    MeasurementHistory.add(ModelSettingsActivity.this,data);
                    metrics.setText(MeasurementHistory.describe(ModelSettingsActivity.this));
                    status.setText("Medição concluída. Isso não é uma avaliação automática da qualidade da resposta.");
                    stopMeasurement();
                }
                else if(code==3) {
                    status.setText(data.getString("text"));
                    stopMeasurement();
                }
            }
        };
        Parcel parcel=Parcel.obtain();
        try {
            receiver.writeToParcel(parcel,0);
            parcel.setDataPosition(0);
            Bundle data=new Bundle();
            data.putParcelable("receiver",ResultReceiver.CREATOR.createFromParcel(parcel));
            data.putString("mode",AiPreferences.mode(this));
            data.putString("prompt",PromptBuilder.build("Ortografia e gramática","","","Eu nao sei o que fazer hoje."));
            data.putInt("limit",128);
            data.putBoolean("benchmark",true);
            Message message=Message.obtain(null,1);
            message.setData(data);
            engine.send(message);
        }
        catch(Exception e) {
            status.setText("Não foi possível iniciar a medição.");
            stopMeasurement();
        }
        finally {
            parcel.recycle();
        }
    }
    private void stopMeasurement() {
        measuring=false;
        if(engine!=null)try {
            engine.send(Message.obtain(null,2));
        }
        catch(RemoteException ignored) {
        }
        if(bound) {
            try {
                unbindService(connection);
            }
            catch(IllegalArgumentException ignored) {
            }
            bound=false;
        }
        engine=null;
        if(add!=null&&measure!=null)controls(busy);
    }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if(request!=41||result!=RESULT_OK||data==null||data.getData()==null)return;
        Uri uri=data.getData();
        cancelled=false;
        controls(true);
        status.setText("Importando…");
        worker.execute(()-> {
            try {
                ModelStore.importFile(this,uri,(n,total)-> {
                    runOnUiThread(()-> {
                        if(!isDestroyed())status.setText("Importando: "+n/1048576+" MB"+(total>0?" de "+total/1048576+" MB":""));
                    });
                    return !cancelled;
                });
                runOnUiThread(()-> {
                    if(!isDestroyed()) {
                        description.setText(ModelStore.description(this));
                        status.setText("Modelo pronto para usar no painel.");
                        controls(false);
                    }
                });
            }
            catch(Exception e) {
                runOnUiThread(()-> {
                    if(!isDestroyed()) {
                        status.setText("Não foi possível importar: "+e.getMessage());
                        controls(false);
                    }
                });
            }
        });
    }
    @Override protected void onDestroy() {
        cancelled=true;
        stopMeasurement();
        worker.shutdownNow();
        super.onDestroy();
    }
}
