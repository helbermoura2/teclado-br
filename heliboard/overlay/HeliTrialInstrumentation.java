// SPDX-License-Identifier: GPL-3.0-only
package br.com.tecladobr.heli.testing;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.*;
import android.view.*;
import android.view.accessibility.*;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.widget.*;
import helium314.keyboard.keyboard.*;
import helium314.keyboard.latin.settings.Settings;
import helium314.keyboard.latin.RichInputMethodManager;
import helium314.keyboard.latin.database.ClipboardDao;
import helium314.keyboard.latin.database.Database;
import helium314.keyboard.keyboard.internal.keyboard_parser.floris.KeyCode;
import android.database.Cursor;
import helium314.keyboard.latin.suggestions.SuggestionStripView;
import helium314.keyboard.latin.utils.DeviceProtectedUtils;
import helium314.keyboard.latin.utils.ToolbarKey;
import java.io.*;
import java.util.*;
import java.util.function.Predicate;

/** Debug-only real touch injection; no calls to the IME text insertion methods. */
public final class HeliTrialInstrumentation extends Instrumentation {
    UiAutomation ui; File shots; final Bundle result=new Bundle();String phase="full";
    static final String PIN_TEXT="Texto fixado para usar em outros dias.";
    static final String TEMP_TEXT="Texto temporário do teste de expiração.";
    @Override public void onCreate(Bundle args){super.onCreate(args);if(args!=null)phase=args.getString("phase","full");start();}
    void check(boolean ok,String why){if(!ok)throw new AssertionError(why);}
    void shell(String command)throws Exception{try(InputStream in=new ParcelFileDescriptor.AutoCloseInputStream(ui.executeShellCommand(command))){byte[] b=new byte[4096];while(in.read(b)>=0){}}}
    AccessibilityNodeInfo walk(AccessibilityNodeInfo n,Predicate<AccessibilityNodeInfo> test){if(n==null)return null;if(test.test(n))return n;for(int i=0;i<n.getChildCount();i++){AccessibilityNodeInfo found=walk(n.getChild(i),test);if(found!=null)return found;}return null;}
    AccessibilityNodeInfo find(Predicate<AccessibilityNodeInfo> test){for(AccessibilityWindowInfo w:ui.getWindows()){AccessibilityNodeInfo n=walk(w.getRoot(),test);if(n!=null)return n;}return null;}
    AccessibilityNodeInfo field()throws Exception{long deadline=SystemClock.uptimeMillis()+60000;do{AccessibilityNodeInfo n=find(v->"android.widget.EditText".contentEquals(v.getClassName()));if(n!=null)return n;Thread.sleep(150);}while(SystemClock.uptimeMillis()<deadline);throw new AssertionError("No editor");}
    String text()throws Exception{CharSequence value=field().getText();String s=value==null?"":value.toString();return s.equals("Experimente aqui")?"":s;}
    void expect(String value)throws Exception{long deadline=SystemClock.uptimeMillis()+12000;String actual="";do{actual=text();if(actual.equals(value))return;Thread.sleep(100);}while(SystemClock.uptimeMillis()<deadline);throw new AssertionError("Expected: "+value+"; actual: "+actual);}
    void options(boolean caps,boolean correction){DeviceProtectedUtils.getSharedPreferences(getTargetContext()).edit().putBoolean(Settings.PREF_AUTO_CAP,caps).putBoolean(Settings.PREF_AUTO_CORRECTION,correction).commit();}
    void launch()throws Exception{
        getTargetContext().startActivity(new Intent(getTargetContext(),TrialEditor.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK));Thread.sleep(2000);
        // Only dismiss an unrelated launcher ANR; never hide a keyboard/app ANR.
        AccessibilityNodeInfo launcher=find(n->n.getText()!=null&&n.getText().toString().contains("Quickstep")&&n.getText().toString().contains("respond"));
        if(launcher!=null){AccessibilityNodeInfo close=find(n->"Close app".contentEquals(n.getText()==null?"":n.getText()));if(close!=null)close.performAction(AccessibilityNodeInfo.ACTION_CLICK);}
        Rect area=new Rect();field().getBoundsInScreen(area);area.bottom=Math.min(area.bottom,area.top+80);tap(area);bounds('e',false);Thread.sleep(1000);
    }
    View findView(View v,Predicate<View> test){if(v==null)return null;if(test.test(v))return v;if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++){View found=findView(g.getChildAt(i),test);if(found!=null)return found;}}return null;}
    MainKeyboardView main(){return KeyboardSwitcher.getInstance().getMainKeyboardView();}
    Rect bounds(char letter,boolean popup)throws Exception{return keyBounds(letter,popup);}
    Rect keyBounds(int letter,boolean popup)throws Exception{
        long deadline=SystemClock.uptimeMillis()+12000;
        do{Rect[] found={null};runOnMainSync(()->{
            MainKeyboardView m=main();if(m==null||m.getKeyboard()==null||!m.isShown())return;
            View start=m.getRootView();
            KeyboardView view=popup?(KeyboardView)findView(start,v->v instanceof KeyboardView&&!(v instanceof MainKeyboardView)&&v.isShown()):m;
            if(view==null||view.getKeyboard()==null)return;
            for(Key key:view.getKeyboard().getSortedKeys())if(Character.toLowerCase(key.getCode())==Character.toLowerCase(letter)||String.valueOf((char)letter).equalsIgnoreCase(key.getLabel())){
                int[] origin=new int[2];view.getLocationOnScreen(origin);int x=origin[0]+view.getPaddingLeft()+key.getX(),y=origin[1]+view.getPaddingTop()+key.getY();found[0]=new Rect(x,y,x+key.getWidth(),y+key.getHeight());break;
            }
        });if(found[0]!=null)return found[0];Thread.sleep(100);}while(SystemClock.uptimeMillis()<deadline);
        throw new AssertionError("Key not available: "+letter+" popup="+popup);
    }
    void event(long down,int action,int[] ids,Rect[] positions)throws Exception{
        MotionEvent.PointerProperties[] p=new MotionEvent.PointerProperties[ids.length];MotionEvent.PointerCoords[] c=new MotionEvent.PointerCoords[ids.length];
        for(int i=0;i<ids.length;i++){p[i]=new MotionEvent.PointerProperties();p[i].id=ids[i];p[i].toolType=MotionEvent.TOOL_TYPE_FINGER;c[i]=new MotionEvent.PointerCoords();c[i].x=positions[i].exactCenterX();c[i].y=positions[i].exactCenterY();c[i].pressure=1;c[i].size=.08f;}
        MotionEvent e=MotionEvent.obtain(down,SystemClock.uptimeMillis(),action,ids.length,p,c,0,0,1,1,0,0,InputDevice.SOURCE_TOUCHSCREEN,0);check(ui.injectInputEvent(e,false),"Rejected input");e.recycle();Thread.sleep(5);
    }
    void tap(Rect rect)throws Exception{long d=SystemClock.uptimeMillis();event(d,MotionEvent.ACTION_DOWN,new int[]{0},new Rect[]{rect});event(d,MotionEvent.ACTION_UP,new int[]{0},new Rect[]{rect});}
    void type(String value)throws Exception{for(char letter:value.toCharArray()){tap(bounds(letter,false));Thread.sleep(20);}}
    void clear()throws Exception{Bundle args=new Bundle();args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,"");check(field().performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,args),"Cannot clear editor");expect("");Thread.sleep(300);}
    void shot(String name)throws Exception{Thread.sleep(600);Bitmap bitmap=ui.takeScreenshot();if(bitmap!=null){try(OutputStream out=new FileOutputStream(new File(shots,name+".png"))){bitmap.compress(Bitmap.CompressFormat.PNG,100,out);}bitmap.recycle();}}
    List<String> suggestions()throws Exception{List<String> words=new ArrayList<>();runOnMainSync(()->{View strip=KeyboardSwitcher.getInstance().getStripContainer();findView(strip,v->{if(v instanceof TextView){String s=((TextView)v).getText().toString();if(!s.isEmpty())words.add(s);}return false;});});return words;}
    void toolbar(ToolbarKey key)throws Exception{
        runOnMainSync(()->{View strip=KeyboardSwitcher.getInstance().getStripContainer();SuggestionStripView s=(SuggestionStripView)findView(strip,v->v instanceof SuggestionStripView);check(s!=null,"No suggestion strip");s.setToolbarVisibility(true);});Thread.sleep(250);
        View[] target={null};runOnMainSync(()->{target[0]=findView(KeyboardSwitcher.getInstance().getStripContainer(),v->v.getTag()==key);check(target[0]!=null,"Missing shortcut "+key);target[0].requestRectangleOnScreen(new Rect(0,0,target[0].getWidth(),target[0].getHeight()),true);});Thread.sleep(250);
        Rect r=new Rect();runOnMainSync(()->{check(target[0].isShown(),"Hidden shortcut "+key);int[] origin=new int[2];target[0].getLocationOnScreen(origin);r.set(origin[0],origin[1],origin[0]+target[0].getWidth(),origin[1]+target[0].getHeight());});tap(r);Thread.sleep(300);
    }
    void tagged(ToolbarKey key)throws Exception{
        long deadline=SystemClock.uptimeMillis()+10000;
        do{Rect[] rect={null};runOnMainSync(()->{View root=KeyboardSwitcher.getInstance().getWrapperView().getRootView();View v=findView(root,n->n.getTag()==key&&n.isShown());if(v!=null){int[] xy=new int[2];v.getLocationOnScreen(xy);rect[0]=new Rect(xy[0],xy[1],xy[0]+v.getWidth(),xy[1]+v.getHeight());}});
            if(rect[0]!=null){tap(rect[0]);Thread.sleep(350);return;}Thread.sleep(100);
        }while(SystemClock.uptimeMillis()<deadline);throw new AssertionError("Visible shortcut missing: "+key);
    }
    void language(String wanted)throws Exception{
        long deadline=SystemClock.uptimeMillis()+8000;
        do{String[] tag={""};runOnMainSync(()->tag[0]=RichInputMethodManager.getInstance().getCurrentSubtypeLocale().getLanguage());if(tag[0].equals(wanted))return;Thread.sleep(100);}while(SystemClock.uptimeMillis()<deadline);
        throw new AssertionError("Language did not switch to "+wanted);
    }
    boolean storedPinned(){
        try(Cursor c=Database.Companion.getInstance(getTargetContext()).getReadableDatabase().rawQuery("SELECT PINNED FROM CLIPBOARD WHERE TEXT = ?",new String[]{PIN_TEXT})){
            return c.moveToFirst()&&c.getInt(0)==1;
        }
    }
    void pinnedEntry(boolean verifyOnly)throws Exception{
        if(!verifyOnly){
            ClipboardManager clip=(ClipboardManager)getTargetContext().getSystemService(Context.CLIPBOARD_SERVICE);
            runOnMainSync(()->clip.setPrimaryClip(ClipData.newPlainText("Teste",PIN_TEXT)));Thread.sleep(400);
            clear();type("oi"); // word suggestions collapse the toolbar; pinned shortcut must remain accessible
        }
        tagged(ToolbarKey.CLIPBOARD);
        long deadline=SystemClock.uptimeMillis()+8000;AccessibilityNodeInfo item;
        do{item=find(n->PIN_TEXT.contentEquals(n.getText()==null?"":n.getText()));if(item!=null)break;Thread.sleep(100);}while(SystemClock.uptimeMillis()<deadline);
        check(item!=null,"Pinned text is missing in clipboard UI");Rect itemRect=new Rect();item.getBoundsInScreen(itemRect);
        if(verifyOnly){
            check(storedPinned(),"Pin flag did not survive restart/update");tap(itemRect);expect(PIN_TEXT);shot("12-pin-colado-apos-reiniciar");return;
        }
        long d=SystemClock.uptimeMillis();event(d,MotionEvent.ACTION_DOWN,new int[]{0},new Rect[]{itemRect});Thread.sleep(850);event(d,MotionEvent.ACTION_UP,new int[]{0},new Rect[]{itemRect});Thread.sleep(350);
        check(storedPinned(),"Long press did not pin the copied text");shot("11-texto-fixado");tagged(ToolbarKey.CLOSE_HISTORY);
        runOnMainSync(()->{
            ClipboardDao dao=ClipboardDao.Companion.getInstance(getTargetContext());check(dao!=null,"No clipboard database");
            dao.addClip(System.currentTimeMillis(),false,TEMP_TEXT);
            long old=System.currentTimeMillis()-30L*24*60*60*1000;
            for(int i=0;i<dao.count();i++)if(dao.getAt(i).getText().equals(PIN_TEXT)||dao.getAt(i).getText().equals(TEMP_TEXT))dao.getAt(i).setTimeStamp(old);
            Database.Companion.getInstance(getTargetContext()).getWritableDatabase().execSQL("UPDATE CLIPBOARD SET TIMESTAMP = ? WHERE TEXT IN (?, ?)",new Object[]{old,PIN_TEXT,TEMP_TEXT});
            dao.clearOldClips(true);check(storedPinned(),"Pinned text expired after aging");
            for(int i=0;i<dao.count();i++)check(!dao.getAt(i).getText().equals(TEMP_TEXT),"Unpinned expired text was retained");
        });
        result.putString("pin_retention","Pinned text survives 30-day timestamp aging; unpinned text expires");
    }
    @Override public void onStart(){try{
        ui=getUiAutomation();AccessibilityServiceInfo info=ui.getServiceInfo();info.flags|=AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;ui.setServiceInfo(info);
        shots=new File(getTargetContext().getCacheDir(),"heli-shots");shots.mkdirs();
        shell("settings put secure show_ime_with_hard_keyboard 1");shell("ime enable br.com.tecladobr.heli.debug/helium314.keyboard.latin.LatinIME");shell("ime set br.com.tecladobr.heli.debug/helium314.keyboard.latin.LatinIME");
        Thread.sleep(10000);options(false,false);launch();
        if(phase.equals("verify_pins")){check(storedPinned(),"Stored pin lost after process restart");pinnedEntry(true);result.putString("result","PASS");result.putString("coverage","Pinned clipboard text survives app restart and reinstall with same certificate, and can be pasted");finish(Activity.RESULT_OK,result);return;}
        check(bounds('ç',false)!=null,"No cedilla");shot("01-base-ptbr");
        Rect e=bounds('e',false),r=bounds('r',false);StringBuilder expected=new StringBuilder();long begin=SystemClock.uptimeMillis();
        for(int i=0;i<100;i++){long d=SystemClock.uptimeMillis();event(d,MotionEvent.ACTION_DOWN,new int[]{0},new Rect[]{e});event(d,MotionEvent.ACTION_POINTER_DOWN|(1<<8),new int[]{0,1},new Rect[]{e,r});boolean reverse=i%2==1;event(d,MotionEvent.ACTION_POINTER_UP|((reverse?1:0)<<8),new int[]{0,1},new Rect[]{e,r});event(d,MotionEvent.ACTION_UP,new int[]{reverse?0:1},new Rect[]{reverse?e:r});expected.append("er");}
        result.putLong("touch_injection_ms",SystemClock.uptimeMillis()-begin);expect(expected.toString());result.putInt("overlapping_characters",200);shot("02-toques-sobrepostos");
        toolbar(ToolbarKey.SELECT_ALL);
        long selectedDeadline=SystemClock.uptimeMillis()+5000;boolean selected=false;do{AccessibilityNodeInfo f=field();selected=Math.abs(f.getTextSelectionEnd()-f.getTextSelectionStart())==200;if(selected)break;Thread.sleep(100);}while(SystemClock.uptimeMillis()<selectedDeadline);check(selected,"SELECT_ALL did not select 200 characters");shot("03-texto-selecionado");
        toolbar(ToolbarKey.COPY);ClipboardManager clipboard=(ClipboardManager)getTargetContext().getSystemService(Context.CLIPBOARD_SERVICE);
        ClipData copied=clipboard.getPrimaryClip();check(copied!=null&&copied.getItemCount()>0&&expected.toString().contentEquals(copied.getItemAt(0).getText()),"COPY did not preserve the text");
        clear();toolbar(ToolbarKey.PASTE);expect(expected.toString());shot("03-edicao");
        clear();type("voce");long deadline=SystemClock.uptimeMillis()+10000;List<String> words;
        do{words=suggestions();if(words.stream().anyMatch(s->s.equalsIgnoreCase("você")))break;Thread.sleep(200);}while(SystemClock.uptimeMillis()<deadline);
        check(words.stream().anyMatch(s->s.equalsIgnoreCase("você")),"PT-BR dictionary did not suggest você: "+words);result.putString("ptbr_suggestions",words.toString());shot("04-dicionario-portugues");
        clear();long d=SystemClock.uptimeMillis();event(d,MotionEvent.ACTION_DOWN,new int[]{0},new Rect[]{e});Thread.sleep(700);Rect accent=bounds('ê',true);event(d,MotionEvent.ACTION_MOVE,new int[]{0},new Rect[]{accent});shot("05-deslizando-subtecla");event(d,MotionEvent.ACTION_UP,new int[]{0},new Rect[]{accent});expect("ê");shot("06-acento-soltar");
        options(true,true);launch();type("bom. dia ");expect("Bom. Dia ");shot("07-maiusculas");
        clear();type("voce ");expect("Você ");shot("08-autocorrecao");
        options(false,false);launch();language("pt");tap(keyBounds(KeyCode.LANGUAGE_SWITCH,false));language("en");clear();type("hello ");expect("hello ");shot("09-ingles-globo");
        tap(keyBounds(KeyCode.LANGUAGE_SWITCH,false));language("pt");check(bounds('ç',false)!=null,"Portuguese layout lost after switch");shot("10-portugues-globo");pinnedEntry(false);
        result.putString("result","PASS");result.putString("coverage","Globe PT-BR/English switching, pinned clipboard shortcut, long-press pin, expiration exclusion, PT-BR dictionary, Ç layout, 200 overlapping letters including reversed release order, copy/paste, slide-to-select accent, sentence caps, autocorrection");finish(Activity.RESULT_OK,result);
    }catch(Throwable failure){try{shot("failure");}catch(Exception ignored){}StringWriter trace=new StringWriter();failure.printStackTrace(new PrintWriter(trace));result.putString("failure",trace.toString());result.putString("result","FAIL");finish(Activity.RESULT_CANCELED,result);}}
}
