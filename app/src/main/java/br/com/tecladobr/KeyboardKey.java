package br.com.tecladobr;

import android.content.Context;
import android.graphics.*;
import android.widget.Button;
import android.view.MotionEvent;
import android.view.ViewConfiguration;

/** Draw labels and small secondary symbols without relying on colored emoji fonts. */
public final class KeyboardKey extends Button {
    private final android.text.TextPaint paint = new android.text.TextPaint(Paint.ANTI_ALIAS_FLAG);
    private String hint = "", icon = "";
    private boolean quickTouch,repeat;
    interface HoldGesture {
        void move(float screenX,float screenY);
        void finish(boolean cancelled);
    }
    private HoldGesture holdGesture;
    void holdGesture(HoldGesture gesture){
        endHold(true);holdGesture=gesture;
        getParent().requestDisallowInterceptTouchEvent(true);
    }
    private void endHold(boolean cancelled){
        HoldGesture gesture=holdGesture;holdGesture=null;
        if(gesture!=null){gesture.finish(cancelled);if(getParent()!=null)getParent().requestDisallowInterceptTouchEvent(false);}
    }
    private final Runnable held=new Runnable(){public void run(){
        if(!isPressed())return;
        if(repeat){performClick();postDelayed(this,65);}
        else if(isLongClickable())performLongClick();
    }};
    public void quickTouch(boolean value){quickTouch=value;}
    public void repeatOnHold(){quickTouch=true;repeat=true;}
    @Override public boolean onTouchEvent(MotionEvent event){
        if(!quickTouch||!isEnabled())return super.onTouchEvent(event);
        int action=event.getActionMasked();
        if(action==MotionEvent.ACTION_DOWN||action==MotionEvent.ACTION_POINTER_DOWN){
            endHold(true);removeCallbacks(held);setPressed(true);performClick();
            if(event.getPointerCount()==1)postDelayed(held,repeat?350:ViewConfiguration.getLongPressTimeout());
            return true;
        }
        if(action==MotionEvent.ACTION_MOVE){
            if(holdGesture!=null){holdGesture.move(event.getRawX(),event.getRawY());return true;}
            if(event.getX()<0||event.getX()>getWidth()||event.getY()<0||event.getY()>getHeight())removeCallbacks(held);
            return true;
        }
        if(action==MotionEvent.ACTION_UP||action==MotionEvent.ACTION_CANCEL){removeCallbacks(held);setPressed(false);if(holdGesture!=null&&action==MotionEvent.ACTION_UP)holdGesture.move(event.getRawX(),event.getRawY());endHold(action==MotionEvent.ACTION_CANCEL);return true;}
        if(action==MotionEvent.ACTION_POINTER_UP){removeCallbacks(held);endHold(true);return true;}
        return true;
    }
    @Override protected void onDetachedFromWindow(){endHold(true);removeCallbacks(held);super.onDetachedFromWindow();}
    public KeyboardKey(Context context) { super(context); }
    public void hint(String value) { hint = value; invalidate(); }
    public void icon(String value) { icon = value; invalidate(); }
    private float dp(float value) { return value * getResources().getDisplayMetrics().density; }
    @Override protected void onDraw(Canvas canvas) {
        paint.setColor(isEnabled() ? Color.rgb(240,240,242) : Color.rgb(115,115,120));
        paint.setStyle(Paint.Style.FILL);
        if (!icon.isEmpty()) {
            canvas.save(); canvas.translate(getWidth()/2f - dp(12), getHeight()/2f - dp(12));
            canvas.scale(dp(1), dp(1)); drawIcon(canvas); canvas.restore();
        } else {
            paint.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));
            paint.setTextAlign(Paint.Align.CENTER); paint.setTextSize(getTextSize());
            Paint.FontMetrics fm = paint.getFontMetrics();
            float baseline = getHeight()/2f - (fm.ascent+fm.descent)/2f;
            String shown=android.text.TextUtils.ellipsize(getText(),paint,Math.max(1,getWidth()-dp(8)),android.text.TextUtils.TruncateAt.END).toString();
            canvas.drawText(shown, getWidth()/2f, baseline + (hint.isEmpty()?0:dp(2)), paint);
        }
        if (!hint.isEmpty()) {
            paint.setTextAlign(Paint.Align.RIGHT); paint.setTextSize(dp(9));
            paint.setColor(Color.rgb(148,148,154));
            canvas.drawText(hint, getWidth()-dp(4), dp(12), paint);
        }
    }
    private void line(Canvas c, float x, float y, float xx, float yy) { c.drawLine(x,y,xx,yy,paint); }
    private void path(Canvas c, float... points) {
        Path p = new Path(); p.moveTo(points[0],points[1]);
        for(int i=2;i<points.length;i+=2) p.lineTo(points[i],points[i+1]);
        c.drawPath(p,paint);
    }
    private void star(Canvas c,float x,float y,float r) {
        Path p=new Path();p.moveTo(x,y-r);p.lineTo(x+r*.3f,y-r*.3f);p.lineTo(x+r,y);
        p.lineTo(x+r*.3f,y+r*.3f);p.lineTo(x,y+r);p.lineTo(x-r*.3f,y+r*.3f);
        p.lineTo(x-r,y);p.lineTo(x-r*.3f,y-r*.3f);p.close();c.drawPath(p,paint);
    }
    private void drawIcon(Canvas c) {
        paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(1.7f);
        paint.setStrokeCap(Paint.Cap.ROUND); paint.setStrokeJoin(Paint.Join.ROUND);
        switch(icon) {
            case "expand":
            case "collapse":
                c.drawRoundRect(2,4,21,20,3,3,paint);
                if(icon.equals("expand"))path(c,13,8,9,12,13,16);
                else path(c,10,8,14,12,10,16);
                break;
            case "search":
                c.drawCircle(10,10,7,paint);line(c,15,15,22,22);break;
            case "undo":path(c,8,4,3,9,8,14);c.drawArc(3,8,22,24,190,180,false,paint);break;
            case "redo":path(c,16,4,21,9,16,14);c.drawArc(2,8,21,24,-10,-180,false,paint);break;
            case "editing":
            case "selectall":
                paint.setPathEffect(new DashPathEffect(new float[]{2,2},0));
                c.drawRect(3,3,21,21,paint);paint.setPathEffect(null);
                if(icon.equals("editing")){line(c,12,7,12,17);line(c,9,7,15,7);line(c,9,17,15,17);}
                else {line(c,7,9,17,9);line(c,7,15,17,15);}break;
            case "copy":
                c.drawRoundRect(3,3,17,18,1,1,paint);c.drawRoundRect(7,7,21,22,1,1,paint);break;
            case "cut":
                c.drawCircle(6,6,3,paint);c.drawCircle(6,18,3,paint);
                line(c,8,8,21,21);line(c,8,16,21,3);break;
            case "left":path(c,15,4,7,12,15,20);break;
            case "right":path(c,9,4,17,12,9,20);break;
            case "clipboard":
                c.drawRoundRect(4,4,20,22,2,2,paint);
                c.drawRoundRect(8,2,16,7,2,2,paint);break;
            case "emoji":
                c.drawCircle(12,12,10,paint);
                c.drawArc(6,6,18,18,20,140,false,paint);
                paint.setStyle(Paint.Style.FILL);c.drawCircle(9,9,1,paint);c.drawCircle(15,9,1,paint);break;
            case "ai":
                paint.setStyle(Paint.Style.FILL);star(c,11,12,8);star(c,20,4,3);star(c,20,21,2);break;
            case "translate":
                c.drawRoundRect(2,7,16,22,2,2,paint);c.drawRoundRect(8,2,22,17,2,2,paint);
                paint.setStyle(Paint.Style.FILL);paint.setTextSize(11);paint.setTextAlign(Paint.Align.CENTER);
                c.drawText("A",9,18,paint);c.drawText("文",16,12,paint);break;
            case "settings":
                Path gear=new Path();
                for(int i=0;i<32;i++) {
                    double a=Math.PI*2*i/32;float r=(i%4==0||i%4==3)?10:8;
                    float x=12+(float)Math.cos(a)*r,y=12+(float)Math.sin(a)*r;
                    if(i==0)gear.moveTo(x,y);else gear.lineTo(x,y);
                }
                gear.close();c.drawPath(gear,paint);c.drawCircle(12,12,3.5f,paint);break;
            case "more":
                paint.setStyle(Paint.Style.FILL);
                for(int i=5;i<=19;i+=7)c.drawCircle(i,12,1.5f,paint);break;
            case "shift":
            case "caps":
                path(c,3,12,12,3,21,12,16,12,16,21,8,21,8,12,3,12);
                if(icon.equals("caps"))line(c,8,24,16,24);break;
            case "backspace":
                path(c,2,12,9,4,22,4,22,20,9,20,2,12);
                line(c,12,9,17,15);line(c,17,9,12,15);break;
            case "enter":
                path(c,21,5,21,14,5,14,10,9);path(c,5,14,10,19);break;
        }
        paint.setStyle(Paint.Style.FILL);
    }
}
