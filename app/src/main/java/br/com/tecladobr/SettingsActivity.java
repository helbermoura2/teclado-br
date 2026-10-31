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
        TextView title = new TextView(this); title.setText("Teclado BR · 0.5.0");
        title.setTextSize(26); root.addView(title);
        TextView intro = new TextView(this);
        intro.setText("Teclado brasileiro com visual inspirado no Samsung.\n\nIA OFFLINE: NÃO INSTALADA. Os testes de modelos aconteceram fora do aplicativo. A revisão atual é básica local; a lupa ainda está em desenvolvimento.\n\n1. Ative o teclado.\n2. Selecione Teclado BR.\n3. Abra a tela de teste.\n\n");
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
        Button test = new Button(this); test.setText("3. Testar teclado");
        test.setOnClickListener(v -> startActivity(new Intent(this, PreviewActivity.class)));
        root.addView(test);
        TextView note = new TextView(this);
        note.setText("\nMantenha uma letra pressionada para ver acentos e símbolos. Após uma autocorreção, toque em ⌫ para desfazer.\n\nA barra superior mostra sugestões ao digitar. Abra os atalhos e deslize para os lados para ver todos. Toque na seta à esquerda para alternar com os atalhos. O ícone de edição abre Selecionar tudo, Copiar, Recortar, Colar e setas do cursor. O menu ⋯ oferece Desfazer e Refazer, quando o aplicativo permite; o rosto abre emojis. Mantenha o espaço pressionado para trocar de teclado.\n\nO atalho das estrelas abre o assistente de escrita. A revisão básica local corrige palavras conhecidas; revisão gramatical completa, estilos, resumo, compositor e tradução aguardam integração de IA. Esta versão não tem IA, gestos ou dicionário completo. As sugestões usam um dicionário local ampliado. Não acessa a internet nem mantém histórico do que você digita.\n\nDicionário: FrequencyWords, Hermit Dave, lista portuguesa de 2018, adaptação de 5.000 entradas. Conteúdo CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/ . Fonte e atribuição no arquivo DICTIONARY-LICENSE.txt do app.\n\nProjeto independente, sem vínculo com Samsung ou Nothing.");
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
