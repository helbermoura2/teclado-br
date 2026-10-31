package br.com.tecladobr;

import java.util.ArrayDeque;

/** Small, in-memory cursor context. Typing never needs a synchronous editor read. */
final class EditorState {
    private String prefix="";
    private int start=-1,end=-1;
    private boolean valid,privateMode;
    private final ArrayDeque<Integer> acknowledgements=new ArrayDeque<>();
    String before(){return privateMode?"":prefix;}
    boolean valid(){return valid;}
    boolean hasSelection(){return start>=0&&end>=0&&start!=end;}
    int cursor(){return end;}
    int start(){return start;}
    int end(){return end;}
    void invalidate(){valid=false;prefix="";acknowledgements.clear();}
    void reset(String before,int selectionStart,int selectionEnd,boolean secret){
        privateMode=secret;prefix=secret?"":tail(before);start=selectionStart;end=selectionEnd;
        valid=before!=null;acknowledgements.clear();
    }
    private static String tail(String text){
        if(text==null)return "";int cut=Math.max(0,text.length()-512);
        if(cut>0&&Character.isLowSurrogate(text.charAt(cut)))cut++;
        return text.substring(cut);
    }
    void insert(String text){
        if(!privateMode)prefix=tail(prefix+text);
        if(start>=0&&end>=0){start=Math.min(start,end)+text.length();end=start;}
    }
    void deleteLeft(int utf16){
        if(hasSelection()){int first=Math.min(start,end);start=first;end=first;return;}
        if(!privateMode)prefix=prefix.substring(0,Math.max(0,prefix.length()-utf16));
        if(start>=0){start=Math.max(0,start-utf16);end=start;}
    }
    void expectAck(){
        if(start==end&&end>=0){acknowledgements.addLast(end);while(acknowledgements.size()>512)acknowledgements.removeFirst();}
    }
    boolean acknowledge(int a,int b){
        if(a==b&&acknowledgements.contains(b)){
            while(!acknowledgements.isEmpty()){int n=acknowledgements.removeFirst();if(n==b)break;}
            return true;
        }
        if(a==start&&b==end)return true;
        start=a;end=b;prefix="";valid=false;acknowledgements.clear();return false;
    }
    void clear(){reset(null,-1,-1,true);}
}
