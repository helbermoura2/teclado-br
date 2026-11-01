// SPDX-License-Identifier: GPL-3.0-only
package helium314.keyboard.latin.ai;
import android.app.Service;
import android.content.Intent;
import android.os.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
/** Private bound worker. The interface remains in the IME; inference stays in :writing. */
public final class WritingEngineService extends Service {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private volatile boolean busy,cancelled,loaded;
    private final Messenger messenger=new Messenger(new Handler(Looper.getMainLooper()){
        @Override public void handleMessage(Message m){
            if(m.what==2){stopGeneration();return;}
            if(m.what!=1)return;
            Bundle b=m.getData();b.setClassLoader(WritingEngineService.class.getClassLoader());ResultReceiver receiver=b.getParcelable("receiver");
            if(receiver==null)return;
            if(busy){send(receiver,3,"Aguarde o cancelamento anterior terminar.",false);return;}
            if(!ModelStore.model(WritingEngineService.this).isFile()){send(receiver,3,"Adicione um modelo nas configurações do assistente.",false);return;}
            busy=true;cancelled=false;String prompt=b.getString("prompt","");int limit=b.getInt("limit",256);
            worker.execute(()->{
                try{
                    OfflineNative.reset();loaded=true;if(cancelled)throw new IllegalStateException("Cancelado");
                    byte[] bytes=OfflineNative.generate(OfflineNative.utf8(ModelStore.model(WritingEngineService.this).getAbsolutePath()),OfflineNative.utf8(prompt),part->{if(!cancelled)send(receiver,1,new String(part,StandardCharsets.UTF_8),false);},limit);
                    String value=new String(bytes,StandardCharsets.UTF_8);
                    if(cancelled)send(receiver,3,"Cancelado.",false);else send(receiver,2,value.substring(2),value.startsWith("T\n"));
                }catch(Exception e){send(receiver,3,cancelled?"Cancelado.":e.getMessage(),false);}
                catch(LinkageError e){send(receiver,3,"Motor indisponível nesta arquitetura.",false);}
                catch(OutOfMemoryError e){send(receiver,3,"Memória insuficiente. Experimente um modelo menor.",false);}
                finally{busy=false;}
            });
        }
    });
    private static void send(ResultReceiver r,int code,String text,boolean truncated){Bundle b=new Bundle();b.putString("text",text);b.putBoolean("truncated",truncated);r.send(code,b);}
    private void stopGeneration(){cancelled=true;if(loaded)OfflineNative.cancel();}
    @Override public IBinder onBind(Intent i){return messenger.getBinder();}
    @Override public boolean onUnbind(Intent i){stopGeneration();return false;}
    @Override public void onDestroy(){stopGeneration();worker.shutdownNow();super.onDestroy();}
}
