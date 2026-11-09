// SPDX-License-Identifier: GPL-3.0-only
package helium314.keyboard.latin.ai;

import java.util.concurrent.CancellationException;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/** Fixed provider order for an explicit online writing task.
 * This ordering does not depend on the manually selected diagnostic model. */
public final class OnlinePriority {
    private OnlinePriority() {}

    public static InferenceResult run(String prompt,int limit,
            InferenceRouter.Backend gemini38,
            InferenceRouter.Backend gemini36,
            InferenceRouter.Backend groq,
            BooleanSupplier cancelled,
            Consumer<String> status,
            Consumer<String> issue,
            Consumer<String> partial)throws Exception {
        InferenceRouter.check(cancelled);
        Exception last=null;
        StringBuilder failures=new StringBuilder();
        if(gemini38!=null) {
            try {
                status.accept("Gemini 3.8 Flash · primeira tentativa…");
                InferenceResult result=gemini38.generate(prompt,limit,partial);
                InferenceRouter.check(cancelled);
                return result;
            }catch(Exception error) {
                InferenceRouter.check(cancelled);
                if(error instanceof CancellationException)throw error;
                last=error;
                String reason="3.8: "+GeminiClient.diagnostic(error);
                failures.append(reason);
                issue.accept(failures.toString());
                status.accept("Gemini 3.8 falhou ("+reason+"). Tentando 3.6…");
            }
        }
        if(gemini36!=null) {
            try {
                status.accept("Gemini 3.6 Flash · segunda tentativa…");
                InferenceResult result=gemini36.generate(prompt,limit,partial);
                InferenceRouter.check(cancelled);
                if(failures.length()>0)
                    return new InferenceResult(result.text,result.backend+
                        "\nGemini 3.8: "+failures.toString(),result.truncated);
                return result;
            }catch(Exception error) {
                InferenceRouter.check(cancelled);
                if(error instanceof CancellationException)throw error;
                last=error;
                if(failures.length()>0)failures.append("; ");
                failures.append("3.6: ").append(GeminiClient.diagnostic(error));
                issue.accept(failures.toString());
                status.accept("Gemini 3.6 falhou. "+
                    (groq!=null?"Tentando Groq…":"Retornando ao modo local, se disponível…"));
            }
        }
        if(groq!=null) {
            status.accept("Groq · terceira tentativa online…");
            InferenceResult result=groq.generate(prompt,limit,partial);
            InferenceRouter.check(cancelled);
            return result;
        }
        if(last!=null)throw last;
        throw new IllegalStateException("Cadastre uma chave Gemini ou Groq.");
    }
}
