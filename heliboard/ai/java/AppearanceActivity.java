// SPDX-License-Identifier: GPL-3.0-only
package helium314.keyboard.latin.ai;
import android.app.Activity;
import android.os.Bundle;
import android.widget.*;
import android.graphics.Color;
import android.content.SharedPreferences;
import helium314.keyboard.latin.Typography;
import helium314.keyboard.latin.settings.Settings;
import helium314.keyboard.latin.utils.DeviceProtectedUtils;
public final class AppearanceActivity extends Activity {
    private LinearLayout root;
    private SharedPreferences prefs;
    private SeekBar height,letters,symbols;
    private int dp(int n) {
        return (int)(n*getResources().getDisplayMetrics().density+.5f);
    }
    private TextView label(String text,int size) {
        TextView t=new TextView(this);
        t.setText(text);
        t.setTextSize(size);
        t.setTextColor(Color.WHITE);
        t.setPadding(0,dp(10),0,dp(6));
        root.addView(t);
        return t;
    }
    private SeekBar slider(String title,String id,int min,int max,int initial) {
        TextView value=label(title+": "+initial+"%",17);
        SeekBar bar=new SeekBar(this);
        bar.setContentDescription(id);
        bar.setMax(max-min);
        bar.setProgress(Math.max(0,Math.min(max-min,initial-min)));
        bar.setTag(min);
        bar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            public void onProgressChanged(SeekBar b,int p,boolean user) {
                value.setText(title+": "+(p+min)+"%");
            }
            public void onStartTrackingTouch(SeekBar b) {
            }
            public void onStopTrackingTouch(SeekBar b) {
            }
        });
        root.addView(bar,new LinearLayout.LayoutParams(-1,dp(48)));
        return bar;
    }
    private float value(SeekBar bar) {
        return ((Integer)bar.getTag()+bar.getProgress())/100f;
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs=DeviceProtectedUtils.getSharedPreferences(this);
        ScrollView scroll=new ScrollView(this);
        root=new LinearLayout(this);
        root.setOrientation(1);
        root.setPadding(dp(20),dp(20),dp(20),dp(20));
        root.setBackgroundColor(0xff17191e);
        scroll.addView(root);
        setContentView(scroll);
        label("Aparência do teclado",24);
        label("Ajustes separados. A altura abaixo vale para o telefone em pé. Reabra o teclado para conferir o resultado.",14);
        height=slider("Altura","appearance_height",85,140,Math.round(prefs.getFloat(Settings.PREF_KEYBOARD_HEIGHT_SCALE_PREFIX+"_false",1.1f)*100));
        letters=slider("Letras","appearance_letters",80,125,Math.round(prefs.getFloat(Settings.PREF_FONT_SCALE,1f)*100));
        symbols=slider("Símbolos dos cantos","appearance_symbols",70,130,Math.round(prefs.getFloat(Typography.SYMBOL_SCALE,1f)*100));
        Button save=new Button(this);
        save.setAllCaps(false);
        save.setText("Aplicar ajustes");
        save.setContentDescription("appearance_save");
        save.setOnClickListener(v-> {
            prefs.edit().putFloat(Settings.PREF_KEYBOARD_HEIGHT_SCALE_PREFIX+"_false",value(height)).putFloat(Settings.PREF_FONT_SCALE,value(letters)).putFloat(Typography.SYMBOL_SCALE,value(symbols)).commit();
            Typography.load(this);
            Toast.makeText(this,"Ajustes aplicados. Reabra o teclado.",Toast.LENGTH_LONG).show();
            finish();
        });
        root.addView(save);
        Button reset=new Button(this);
        reset.setAllCaps(false);
        reset.setText("Restaurar tamanhos recomendados");
        reset.setOnClickListener(v-> {
            height.setProgress(110-85);
            letters.setProgress(100-80);
            symbols.setProgress(100-70);
        });
        root.addView(reset);
        Button back=new Button(this);
        back.setText("Voltar");
        back.setAllCaps(false);
        back.setOnClickListener(v->finish());
        root.addView(back);
    }
}
