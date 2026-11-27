// SPDX-License-Identifier: GPL-3.0-only
package helium314.keyboard.latin.ai;
import android.content.Context;
import java.nio.charset.StandardCharsets;
import java.util.function.*;
public final class OfflineEngine implements InferenceRouter.Backend {
    private final Context context;
    private final BooleanSupplier cancelled;
    private volatile boolean loaded;
    public OfflineEngine(Context c,BooleanSupplier cancelled) {
        context=c;
        this.cancelled=cancelled;
    }
    public void cancel() {
        if(loaded)OfflineNative.cancel();
    }
    @Override public InferenceResult generate(String prompt,int limit,Consumer<String> partial)throws Exception {
        InferenceRouter.check(cancelled);
        OfflineNative.reset();
        loaded=true;
        InferenceRouter.check(cancelled);
        byte[] bytes=OfflineNative.generate(OfflineNative.utf8(ModelStore.model(context).getAbsolutePath()),OfflineNative.utf8(prompt),ignored -> {},limit);
        InferenceRouter.check(cancelled);
        String result=OfflineOutput.finalText(new String(bytes,StandardCharsets.UTF_8));
        return new InferenceResult(result,"Offline · "+ModelStore.description(context),false);
    }
}
