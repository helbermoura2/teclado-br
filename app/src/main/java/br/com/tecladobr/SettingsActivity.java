package br.com.tecladobr;

import android.app.Activity;
import android.os.Bundle;
import android.content.*;
import android.provider.Settings;
import android.view.inputmethod.InputMethodManager;
import android.widget.*;

public class SettingsActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int p = (int) (24 * getResources().getDisplayMetrics().density);
        root.setPadding(p, p, p, p);
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true);
        scroll.addView(root); setContentView(scroll);
        TextView title = new TextView(this); title.setText("Teclado BR · 0.2.0");
        title.setTextSize(26); root.addView(title);
        TextView intro = new TextView(this);
        intro.setText("Teclado brasileiro com visual inspirado no Samsung.\n\n1. Ative o teclado.\n2. Selecione Teclado BR.\n3. Experimente no campo abaixo.\n\n");
        root.addView(intro);
        Button enable = new Button(this); enable.setText("1. Ativar teclado");
        enable.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_INPUT_METHOD_SETTINGS)));
        root.addView(enable);
        Button choose = new Button(this); choose.setText("2. Escolher teclado");
        choose.setOnClickListener(v -> ((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).showInputMethodPicker());
        root.addView(choose);
        option(root, "caps", "Maiúscula automática", true);
        option(root, "correction", "Autocorreção básica em português", true);
        option(root, "haptic", "Vibração ao tocar", true);
        option(root, "numbers", "Linha de números", true);
        TextView height = new TextView(this); height.setText("Altura das teclas"); root.addView(height);
        SeekBar size = new SeekBar(this); size.setMax(20);
        size.setProgress(getSharedPreferences("keyboard", MODE_PRIVATE).getInt("height", 8));
        size.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            public void onProgressChanged(SeekBar s, int n, boolean user) {
                if (user) getSharedPreferences("keyboard", MODE_PRIVATE).edit().putInt("height", n).apply();
            }
            public void onStartTrackingTouch(SeekBar s) {}
            public void onStopTrackingTouch(SeekBar s) {}
        }); root.addView(size);
        EditText demo = new EditText(this); demo.setHint("Digite: ola. voce esta bem?");
        demo.setMinLines(3); demo.setInputType(android.text.InputType.TYPE_CLASS_TEXT |
            android.text.InputType.TYPE_TEXT_FLAG_CAP_SENTENCES | android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        root.addView(demo);
        TextView note = new TextView(this);
        note.setText("\nMantenha uma letra pressionada para ver acentos e símbolos. Após uma autocorreção, toque em ⌫ para desfazer.\n\nA barra superior mostra sugestões ao digitar. Toque na seta à esquerda para alternar com os atalhos. O botão de área de transferência cola o texto copiado; o rosto abre emojis. Mantenha o espaço pressionado para trocar de teclado.\n\nOs atalhos de IA e tradução indicam recursos em desenvolvimento. Esta versão não tem IA, gestos ou dicionário completo. As sugestões usam uma lista pequena de palavras. Não acessa a internet nem mantém histórico do que você digita.\n\nProjeto independente, sem vínculo com Samsung ou Nothing.");
        root.addView(note);
    }
    private void option(LinearLayout root, String key, String label, boolean fallback) {
        Switch toggle = new Switch(this); toggle.setText(label);
        toggle.setChecked(getSharedPreferences("keyboard", MODE_PRIVATE).getBoolean(key, fallback));
        toggle.setOnCheckedChangeListener((v, checked) ->
            getSharedPreferences("keyboard", MODE_PRIVATE).edit().putBoolean(key, checked).apply());
        root.addView(toggle);
    }
}
