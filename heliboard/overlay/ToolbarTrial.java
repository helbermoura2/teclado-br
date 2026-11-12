// SPDX-License-Identifier: GPL-3.0-only
package br.com.tecladobr.heli.testing;
import android.graphics.Rect;
import android.os.Bundle;
import android.view.View;
import helium314.keyboard.keyboard.KeyboardSwitcher;
import helium314.keyboard.keyboard.internal.keyboard_parser.floris.KeyCode;
import helium314.keyboard.latin.R;
import helium314.keyboard.latin.SuggestedWords;
import helium314.keyboard.latin.suggestions.SuggestionStripView;

/** Real IME views and touch input; no personal messages/accounts. */
public final class ToolbarTrial {
    private static SuggestionStripView strip(HeliTrialInstrumentation test) {
        return (SuggestionStripView)test.findView(KeyboardSwitcher.getInstance().getStripContainer(),v->v instanceof SuggestionStripView);
    }
    private static void mode(HeliTrialInstrumentation test, boolean shortcuts) throws Exception {
        Thread.sleep(500);
        test.runOnMainSync(()-> {
            SuggestionStripView s=strip(test);
            test.check(s.findViewById(R.id.toolbar_container).isShown()==shortcuts,"Unexpected toolbar mode");
            test.check(s.findViewById(R.id.suggestions_strip).isShown()!=shortcuts,"Words and shortcuts overlap");
            test.check(!s.findViewById(R.id.pinned_keys).isShown(),"Pinned icon occupies word space");
            test.check(s.findViewById(R.id.teclado_add_word).isShown()==shortcuts,"Dictionary action occupies word space");
            if (shortcuts) {
                View plus=s.findViewById(R.id.teclado_add_word);
                int[] parent=new int[2],child=new int[2];s.getLocationOnScreen(parent);plus.getLocationOnScreen(child);
                Rect frame=new Rect(parent[0],parent[1],parent[0]+s.getWidth(),parent[1]+s.getHeight());
                test.check(frame.contains(new Rect(child[0],child[1],child[0]+plus.getWidth(),child[1]+plus.getHeight())),"Dictionary action clipped outside strip");
            }
        });
    }
    static void expand(HeliTrialInstrumentation test) throws Exception {
        Rect bounds=new Rect();
        test.runOnMainSync(()-> {
            View arrow=strip(test).findViewById(R.id.suggestions_strip_toolbar_key);
            int[] xy=new int[2];arrow.getLocationOnScreen(xy);
            bounds.set(xy[0],xy[1],xy[0]+arrow.getWidth(),xy[1]+arrow.getHeight());
        });
        test.check(!bounds.isEmpty(),"Toolbar expansion handle missing");
        test.tap(bounds);Thread.sleep(400);
    }
    public static void run(HeliTrialInstrumentation test, Bundle result) throws Exception {
        test.clear();test.type("ola");mode(test,false);test.shot("28-barra-so-palavras");
        test.type(",");mode(test,false);
        test.type("tudo bem");mode(test,false);
        test.type(".");mode(test,true);
        // Reproduce late native callbacks after punctuation, then verify stable mode.
        test.runOnMainSync(()-> {
            strip(test).setSuggestions(SuggestedWords.getEmptyInstance(),false);
            strip(test).hideToolbarForSuggestions();
        });
        mode(test,true);test.shot("29-barra-icones-apos-ponto");
        test.type("a");mode(test,false);
        test.runOnMainSync(()->strip(test).setToolbarVisibility(true));
        mode(test,false);test.shot("30-barra-volta-palavras");
        expand(test);mode(test,true);
        test.type("g");mode(test,false);
        test.type(".");mode(test,true);
        test.tap(test.keyBounds(KeyCode.DELETE,false));
        test.tap(test.keyBounds(KeyCode.DELETE,false));
        test.check(!test.text().trim().endsWith("."),"Period was not deleted");mode(test,false);
        result.putString("toolbar","PASS: words only, period shortcuts, delayed callbacks, next letter, manual expansion, deletion");
    }
}
