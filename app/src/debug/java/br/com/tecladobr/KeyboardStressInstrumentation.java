package br.com.tecladobr;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.*;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.view.*;
import android.view.accessibility.*;
import java.io.*;
import java.util.*;
import java.util.function.Predicate;

/** Real input events against the IME, with the editor in its separate process. Debug only. */
public class KeyboardStressInstrumentation extends Instrumentation {
    private UiAutomation ui;
    private final Map<Character,Rect> keys=new HashMap<>();
    private File shots;
    @Override public void onCreate(Bundle arguments){super.onCreate(arguments);start();}
    private void shell(String command)throws Exception{
        try(ParcelFileDescriptor fd=ui.executeShellCommand(command);FileInputStream in=new FileInputStream(fd.getFileDescriptor())){byte[] b=new byte[4096];while(in.read(b)>=0){}}
    }
    private AccessibilityNodeInfo walk(AccessibilityNodeInfo node,Predicate<AccessibilityNodeInfo> test){
        if(node==null)return null;if(test.test(node))return node;
        for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo found=walk(node.getChild(i),test);if(found!=null)return found;}return null;
    }
    private AccessibilityNodeInfo find(Predicate<AccessibilityNodeInfo> test,long timeout)throws Exception{
        long end=SystemClock.uptimeMillis()+timeout;
        do{
            for(AccessibilityWindowInfo window:ui.getWindows()){AccessibilityNodeInfo found=walk(window.getRoot(),test);if(found!=null)return found;}
            if(timeout==0)return null;Thread.sleep(100);
        }while(SystemClock.uptimeMillis()<end);
        throw new AssertionError("Control not found");
    }
    private AccessibilityNodeInfo node(String description)throws Exception{
        try{return find(n->description.contentEquals(n.getContentDescription()==null?"":n.getContentDescription())&&n.isEnabled(),12000);}
        catch(AssertionError e){throw new AssertionError("Missing enabled control: "+description,e);}
    }
    private Rect bounds(String description)throws Exception{
        AccessibilityNodeInfo n=node(description);n.performAction(AccessibilityNodeInfo.ACTION_SHOW_ON_SCREEN);Thread.sleep(120);
        n=node(description);Rect r=new Rect();n.getBoundsInScreen(r);return r;
    }
    private void event(long down,int action,int[] ids,Rect[] positions)throws Exception{
        MotionEvent.PointerProperties[] properties=new MotionEvent.PointerProperties[ids.length];MotionEvent.PointerCoords[] coords=new MotionEvent.PointerCoords[ids.length];
        for(int i=0;i<ids.length;i++){properties[i]=new MotionEvent.PointerProperties();properties[i].id=ids[i];properties[i].toolType=MotionEvent.TOOL_TYPE_FINGER;coords[i]=new MotionEvent.PointerCoords();coords[i].x=positions[i].exactCenterX();coords[i].y=positions[i].exactCenterY();coords[i].pressure=1;coords[i].size=.08f;}
        MotionEvent e=MotionEvent.obtain(down,SystemClock.uptimeMillis(),action,ids.length,properties,coords,0,0,1,1,0,0,android.view.InputDevice.SOURCE_TOUCHSCREEN,0);
        check(ui.injectInputEvent(e,true),"Input event rejected");e.recycle();Thread.sleep(4);
    }
    private void tap(Rect rect)throws Exception{long down=SystemClock.uptimeMillis();event(down,MotionEvent.ACTION_DOWN,new int[]{0},new Rect[]{rect});event(down,MotionEvent.ACTION_UP,new int[]{0},new Rect[]{rect});}
    private void click(String description)throws Exception{tap(bounds(description));Thread.sleep(160);}
    private String text()throws Exception{
        AccessibilityNodeInfo n=find(v->"android.widget.EditText".contentEquals(v.getClassName()),6000);n.refresh();CharSequence value=n.getText();String result=value==null?"":value.toString();return result.equals("Experimente aqui")?"":result;
    }
    private void expectText(String expected)throws Exception{
        long end=SystemClock.uptimeMillis()+12000;String actual="";
        do{actual=text();if(actual.equals(expected))return;Thread.sleep(120);}while(SystemClock.uptimeMillis()<end);
        throw new AssertionError("Text mismatch. Expected "+expected.length()+" chars: "+expected+"; actual "+actual.length()+": "+actual);
    }
    private void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
    private void shot(String name)throws Exception{
        Bitmap image=ui.takeScreenshot();if(image==null)return;
        try(FileOutputStream out=new FileOutputStream(new File(shots,name+".png"))){image.compress(Bitmap.CompressFormat.PNG,100,out);}image.recycle();
    }
    private void openShortcuts()throws Exception{
        AccessibilityNodeInfo toggle=find(n->"Mostrar atalhos".contentEquals(n.getContentDescription()==null?"":n.getContentDescription()),0);
        if(toggle!=null)click("Mostrar atalhos");
    }
    private void clearText()throws Exception{openShortcuts();click("Selecionar tudo");click("Apagar ou desfazer correção");expectText("");Thread.sleep(200);}
    private void ascii(String value)throws Exception{
        for(char c:value.toCharArray()){
            if(c==' '){click("Espaço; mantenha pressionado para trocar teclado");continue;}
            Rect rect=keys.get(c);if(rect==null){rect=bounds(String.valueOf(c));keys.put(c,rect);}tap(rect);
        }
    }
    @Override public void onStart(){
        Bundle result=new Bundle();
        try{
            ui=getUiAutomation();AccessibilityServiceInfo info=ui.getServiceInfo();info.flags|=AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS|AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;ui.setServiceInfo(info);
            shots=new File(getTargetContext().getCacheDir(),"typing-shots");shots.mkdirs();
            getTargetContext().getSharedPreferences("keyboard",0).edit().putBoolean("caps",false).putBoolean("correction",false).putBoolean("haptic",false).putBoolean("numbers",true).putInt("height",8).commit();
            shell("settings put secure show_ime_with_hard_keyboard 1");shell("ime enable br.com.tecladobr/.KeyboardService");shell("ime set br.com.tecladobr/.KeyboardService");
            getTargetContext().startActivity(new Intent(getTargetContext(),PreviewActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK));
            Rect e=bounds("e"),r=bounds("r");Thread.sleep(300);
            check(KeyboardService.activeInstance!=null,"IME not bound");int[] builds={0};
            runOnMainSync(()->builds[0]=KeyboardService.activeInstance.keyboardBuilds);
            long begin=SystemClock.uptimeMillis();StringBuilder expected=new StringBuilder();
            for(int i=0;i<100;i++){
                long down=SystemClock.uptimeMillis();event(down,MotionEvent.ACTION_DOWN,new int[]{0},new Rect[]{e});
                event(down,MotionEvent.ACTION_POINTER_DOWN|(1<<MotionEvent.ACTION_POINTER_INDEX_SHIFT),new int[]{0,1},new Rect[]{e,r});
                boolean reverse=i%2==1;
                event(down,MotionEvent.ACTION_POINTER_UP|((reverse?1:0)<<MotionEvent.ACTION_POINTER_INDEX_SHIFT),new int[]{0,1},new Rect[]{e,r});
                event(down,MotionEvent.ACTION_UP,new int[]{reverse?0:1},new Rect[]{reverse?e:r});expected.append("er");
            }
            result.putLong("burst_event_ms",SystemClock.uptimeMillis()-begin);expectText(expected.toString());
            int[] stats=new int[3];runOnMainSync(()->{stats[0]=KeyboardService.activeInstance.keyboardBuilds;stats[1]=KeyboardService.activeInstance.contextReadsOnMain;stats[2]=KeyboardService.activeInstance.contextReads;});
            check(stats[0]==builds[0],"Keyboard rebuilt during input: "+builds[0]+" -> "+stats[0]);check(stats[1]==0,"Blocking context read on main thread");
            result.putInt("burst_characters",200);result.putInt("keyboard_rebuilds_during_burst",stats[0]-builds[0]);result.putInt("main_thread_context_reads",stats[1]);result.putInt("background_context_reads",stats[2]);shot("01-200-toques-sobrepostos");
            openShortcuts();click("Selecionar tudo");click("Copiar seleção");click("Selecionar tudo");click("Apagar ou desfazer correção");expectText("");
            openShortcuts();click("Colar");expectText(expected.toString());click("Selecionar tudo");click("Recortar seleção");expectText("");click("Colar");expectText(expected.toString());shot("02-edicao-deslizante");
            clearText();ascii("como ");node("você");click("você");expectText("como você ");node("está");click("está");expectText("como você está ");node("bem");shot("03-previsao-frase");
            clearText();ascii("comovov");node("comovov");shot("04-palavra-desconhecida");
            clearText();long down=SystemClock.uptimeMillis();event(down,MotionEvent.ACTION_DOWN,new int[]{0},new Rect[]{e});Thread.sleep(650);event(down,MotionEvent.ACTION_UP,new int[]{0},new Rect[]{e});click("é");expectText("é");shot("05-acento-sem-duplicar");
            openShortcuts();AccessibilityNodeInfo scroll=find(n->"android.widget.HorizontalScrollView".contentEquals(n.getClassName()),5000);Rect sb=new Rect();scroll.getBoundsInScreen(sb);
            int oldLeft=bounds("Ferramentas de edição").left;scroll.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD);Thread.sleep(400);shot("06-todos-atalhos-deslizantes");
            click("Lupa (em desenvolvimento)");click("Assistente · IA offline não instalada");node("IA offline não instalada");shot("07-estado-ia-claro");click("⌨ Teclado");
            result.putString("result","PASS");result.putString("coverage","200 characters, overlapping fingers with reversed release order, no keyboard rebuild, no main-thread context reads, clipboard, phrase prediction, unknown-word fallback, long-press accent, scroll toolbar, AI status");
            finish(Activity.RESULT_OK,result);
        }catch(Throwable failure){
            try{shot("failure");}catch(Exception ignored){}
            StringWriter trace=new StringWriter();failure.printStackTrace(new PrintWriter(trace));result.putString("result","FAIL");result.putString("failure",trace.toString());finish(Activity.RESULT_CANCELED,result);
        }
    }
}
