// SPDX-License-Identifier: GPL-3.0-only
package helium314.keyboard.latin.ai;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CancellationException;
import java.util.function.*;
import org.json.*;

/** Single explicit, bounded Gemini request; no streaming, redirects, telemetry or hidden retries. */
public final class GeminiClient implements InferenceRouter.Backend {
    public static final String MODEL="gemini-3.8-flash";
    private static final String ENDPOINT="https://generativelanguage.googleapis.com/v1beta/models/"+MODEL+":generateContent";
    private final String endpoint,key;
    private final BooleanSupplier cancelled;
    private final int timeout;
    private volatile HttpURLConnection connection;

    public static final class Failure extends IOException {
        public final int status;
        Failure(int code) {
            super(code==429?"Cota do Gemini atingida.":code==401||code==403?
                "Chave ou acesso ao Gemini inválido.":code==404?
                "Modelo Gemini indisponível nesta conta.":"Serviço Gemini indisponível ("+code+").");
            status=code;
        }
    }
    public GeminiClient(String key,BooleanSupplier cancelled) {
        this(ENDPOINT,key,cancelled,20000);
    }
    /** Controlled loopback is reserved for synthetic transport tests with a fake key. */
    public GeminiClient(String endpoint,String key,BooleanSupplier cancelled,int timeout) {
        if(!ENDPOINT.equals(endpoint)) {
            try {
                URL uri=new URL(endpoint);
                if(!"http".equals(uri.getProtocol())||!"127.0.0.1".equals(uri.getHost())||
                    uri.getUserInfo()!=null||uri.getPort()<1||uri.getQuery()!=null||uri.getRef()!=null)
                    throw new IllegalArgumentException("Endpoint não permitido.");
            }
            catch(MalformedURLException e){throw new IllegalArgumentException("Endpoint inválido.");}
        }
        this.endpoint=endpoint;
        this.key=key;
        this.cancelled=cancelled;
        this.timeout=timeout;
    }
    public void cancel() {
        HttpURLConnection active=connection;
        if(active!=null)active.disconnect();
    }
    @Override public InferenceResult generate(String prompt,int limit,Consumer<String> partial)throws Exception {
        InferenceRouter.check(cancelled);
        if(prompt==null||prompt.length()>12000)throw new IOException("Texto muito longo para a revisão.");
        HttpURLConnection http=(HttpURLConnection)new URL(endpoint).openConnection();
        connection=http;
        try {
            http.setInstanceFollowRedirects(false);
            http.setRequestMethod("POST");
            http.setConnectTimeout(Math.min(timeout,8000));
            http.setReadTimeout(timeout);
            http.setDoOutput(true);
            http.setRequestProperty("Content-Type","application/json; charset=utf-8");
            http.setRequestProperty("Accept","application/json");
            http.setRequestProperty("x-goog-api-key",key);
            JSONObject instruction=new JSONObject().put("parts",new JSONArray().put(new JSONObject()
                .put("text","Você é um revisor e assistente de escrita em português brasileiro. "
                    +"Cumpra estritamente a tarefa solicitada. Não acrescente informações, "
                    +"não altere fatos, nomes, números, negações ou o tom sem solicitação. "
                    +"Retorne somente o texto final, sem comentários, explicações ou raciocínio.")));
            JSONObject body=new JSONObject()
                .put("systemInstruction",instruction)
                .put("contents",new JSONArray().put(new JSONObject().put("role","user")
                    .put("parts",new JSONArray().put(new JSONObject().put("text",prompt)))))
                .put("generationConfig",new JSONObject()
                    .put("maxOutputTokens",4096)
                    .put("thinkingConfig",new JSONObject().put("thinkingLevel","low")));
            byte[] request=body.toString().getBytes(StandardCharsets.UTF_8);
            if(request.length>40000)throw new IOException("Pedido online muito grande.");
            http.setFixedLengthStreamingMode(request.length);
            try(OutputStream out=http.getOutputStream()) {
                InferenceRouter.check(cancelled);
                out.write(request);
            }
            InferenceRouter.check(cancelled);
            int status=http.getResponseCode();
            if(status!=200)throw new Failure(status);
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            try(InputStream in=http.getInputStream()) {
                byte[] buffer=new byte[4096];int n;
                while((n=in.read(buffer))!=-1) {
                    InferenceRouter.check(cancelled);
                    if(bytes.size()+n>131072)throw new IOException("Resposta online muito grande.");
                    bytes.write(buffer,0,n);
                }
            }
            JSONObject reply=new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));
            JSONArray choices=reply.optJSONArray("candidates");
            if(choices==null||choices.length()==0)throw new IOException("Gemini não retornou resposta.");
            JSONObject candidate=choices.optJSONObject(0);
            if(candidate==null)throw new IOException("Resposta inválida.");
            String finish=candidate.optString("finishReason","");
            if(!finish.isEmpty()&&!"STOP".equals(finish)&&!"MAX_TOKENS".equals(finish))
                throw new IOException("Gemini bloqueou ou interrompeu a resposta.");
            JSONObject content=candidate.optJSONObject("content");
            JSONArray parts=content==null?null:content.optJSONArray("parts");
            if(parts==null||parts.length()==0)throw new IOException("Resposta online vazia.");
            StringBuilder output=new StringBuilder();
            for(int i=0;i<parts.length();i++) {
                JSONObject item=parts.optJSONObject(i);
                if(item==null||item.optBoolean("thought",false))continue;
                String value=item.optString("text","");
                if(value.length()>12000||output.length()+value.length()>12000)
                    throw new IOException("Resposta online muito longa.");
                output.append(value);
            }
            String result=output.toString().trim();
            if(result.isEmpty()||result.contains("<think>")||result.contains("<|im_end|>"))
                throw new IOException("Resposta online inválida.");
            InferenceRouter.check(cancelled);
            return new InferenceResult(result,"Gemini · "+MODEL,"MAX_TOKENS".equals(finish));
        }
        catch(IOException e) {
            if(cancelled.getAsBoolean())throw new CancellationException("Cancelado.");
            if(e instanceof Failure)throw e;
            throw new IOException("Não foi possível concluir a conexão com o Gemini.");
        }
        finally {
            connection=null;
            http.disconnect();
        }
    }
}
