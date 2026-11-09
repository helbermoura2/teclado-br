// SPDX-License-Identifier: GPL-3.0-only
package helium314.keyboard.latin.ai;
import org.junit.Test;
import java.util.*;
import java.util.concurrent.CancellationException;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.junit.Assert.*;

/** Synthetic test only: no API keys, network, clipboard, personal text or model weights. */
public final class OnlinePriorityTest {
    private static final String PROMPT="Corrija: Eu nao sei.";
    private static InferenceResult answer(String provider) {
        return new InferenceResult("Eu não sei.",provider,false);
    }
    @Test public void primarySuccessSkipsOtherProviders()throws Exception {
        List<String> calls=new ArrayList<>();
        InferenceResult result=OnlinePriority.run(PROMPT,128,
            (p,n,c)->{calls.add("3.8");return answer("Gemini 3.8");},
            (p,n,c)->{calls.add("3.6");return answer("Gemini 3.6");},
            (p,n,c)->{calls.add("Groq");return answer("Groq");},
            ()->false,s->{},s->{},s->{});
        assertEquals(Arrays.asList("3.8"),calls);
        assertEquals("Gemini 3.8",result.backend);
    }
    @Test public void failingPrimaryAlwaysTriesSecondaryBeforeGroq()throws Exception {
        List<String> calls=new ArrayList<>();
        List<String> failures=new ArrayList<>();
        InferenceResult result=OnlinePriority.run(PROMPT,128,
            (p,n,c)->{calls.add("3.8");throw new GeminiClient.Failure(403);},
            (p,n,c)->{calls.add("3.6");return answer("Gemini 3.6");},
            (p,n,c)->{calls.add("Groq");return answer("Groq");},
            ()->false,s->{},failures::add,s->{});
        assertEquals(Arrays.asList("3.8","3.6"),calls);
        assertTrue(result.backend.startsWith("Gemini 3.6"));
        assertEquals(1,failures.size());
        assertTrue(failures.get(0).contains("3.8: HTTP 403"));
    }
    @Test public void groqRunsOnlyAfterBothGeminisFail()throws Exception {
        List<String> calls=new ArrayList<>(),failures=new ArrayList<>(),statuses=new ArrayList<>();
        InferenceResult result=OnlinePriority.run(PROMPT,128,
            (p,n,c)->{calls.add("3.8");throw new java.net.SocketTimeoutException("Read timed out");},
            (p,n,c)->{calls.add("3.6");throw new GeminiClient.Failure(429);},
            (p,n,c)->{calls.add("Groq");return answer("Groq");},
            ()->false,statuses::add,failures::add,s->{});
        assertEquals(Arrays.asList("3.8","3.6","Groq"),calls);
        assertEquals("Groq",result.backend);
        assertTrue(failures.get(failures.size()-1).contains("3.6: HTTP 429"));
        assertTrue(statuses.stream().anyMatch(s->s.contains("terceira tentativa")));
    }
    @Test public void automaticUsesOfflineOnlyAfterAllOnlineFail()throws Exception {
        List<String> calls=new ArrayList<>();
        InferenceResult result=InferenceRouter.run(
            AiPreferences.AUTO,true,true,true,PROMPT,128,
            (p,n,partial)->OnlinePriority.run(p,n,
                (p2,n2,t)->{calls.add("3.8");throw new GeminiClient.Failure(503);},
                (p2,n2,t)->{calls.add("3.6");throw new GeminiClient.Failure(503);},
                (p2,n2,t)->{calls.add("Groq");throw new GroqClient.Failure(503);},
                ()->false,s->{},s->{},partial),
            (p,n,partial)->{calls.add("Gemma");return answer("Gemma offline");},
            ()->false,s->{},s->{});
        assertEquals(Arrays.asList("3.8","3.6","Groq","Gemma"),calls);
        assertEquals("Gemma offline",result.backend);
    }
    @Test public void cancelledRequestDoesNotRetryOrLeakToGroq()throws Exception {
        List<String> calls=new ArrayList<>();
        AtomicBoolean cancelled=new AtomicBoolean(false);
        try {
            OnlinePriority.run(PROMPT,128,
                (p,n,partial)->{calls.add("3.8");cancelled.set(true);throw new CancellationException();},
                (p,n,partial)->{calls.add("3.6");return answer("Gemini 3.6");},
                (p,n,partial)->{calls.add("Groq");return answer("Groq");},
                cancelled::get,s->{},s->{},s->{});
            fail("cancel must be propagated");
        }catch(CancellationException expected){}
        assertEquals(Arrays.asList("3.8"),calls);
    }
    @Test public void groqCanWorkWithoutAnyGeminiCredential()throws Exception {
        List<String> calls=new ArrayList<>();
        InferenceResult result=OnlinePriority.run(PROMPT,128,
            null,null,(p,n,partial)->{calls.add("Groq");return answer("Groq");},
            ()->false,s->{},s->{},s->{});
        assertEquals(Arrays.asList("Groq"),calls);
        assertEquals("Groq",result.backend);
    }
}