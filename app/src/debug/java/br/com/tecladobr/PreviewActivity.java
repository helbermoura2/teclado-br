package br.com.tecladobr;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.widget.*;

/** Debug-only screen for testing the IME in a real Android window. */
public class PreviewActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);layout.setPadding(24,48,24,24);
        layout.setBackgroundColor(Color.BLACK);
        layout.setOnApplyWindowInsetsListener((v,insets)->{
            layout.setPadding(24,48+insets.getSystemWindowInsetTop(),24,24);
            return insets;
        });
        TextView title=new TextView(this);title.setText("Teclado BR · teste de digitação");
        title.setTextColor(Color.WHITE);title.setTextSize(22);layout.addView(title);
        TextView instructions=new TextView(this);
        instructions.setText("Digite para mostrar sugestões. Use a seta da barra para voltar aos atalhos.");
        instructions.setTextColor(Color.LTGRAY);layout.addView(instructions);
        EditText edit=new EditText(this);edit.setTextColor(Color.WHITE);edit.setHintTextColor(Color.GRAY);
        edit.setHint("Experimente aqui");edit.setTextSize(22);
        edit.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        layout.addView(edit,new LinearLayout.LayoutParams(-1,0,1));setContentView(layout);
        edit.requestFocus();edit.postDelayed(()->((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).showSoftInput(edit,InputMethodManager.SHOW_IMPLICIT),600);
    }
}
