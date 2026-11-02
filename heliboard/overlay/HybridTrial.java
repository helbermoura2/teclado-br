// SPDX-License-Identifier: GPL-3.0-only
package br.com.tecladobr.heli.testing;
import android.content.*;
import android.os.Bundle;
import android.text.Spanned;
import android.text.style.StrikethroughSpan;
import android.view.accessibility.AccessibilityNodeInfo;
import helium314.keyboard.latin.ai.*;
import helium314.keyboard.latin.Typography;
import helium314.keyboard.latin.utils.DeviceProtectedUtils;
import helium314.keyboard.latin.settings.Settings;
import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
/** Debug-only transport contract tests use loopback and synthetic text, never a real provider key. */
public final class HybridTrial {
    private static final String FAKE_KEY="gsk_test_fixture_not_a_real_provider_key_123456";
    private static void check(boolean pass,String message) {
        if(!pass)throw new AssertionError(message);
    }
    private static final class Server implements AutoCloseable {
        final ServerSocket listener;
        final ExecutorService worker=Executors.newSingleThreadExecutor();
        final CountDownLatch received=new CountDownLatch(1);
        final AtomicReference<JSONObject> request=new AtomicReference<>();
        final AtomicReference<String> authorization=new AtomicReference<>("");
        final AtomicInteger count=new AtomicInteger();
        Server(int status,String body,int delay)throws Exception {
            listener=new ServerSocket(0,1,InetAddress.getByName("127.0.0.1"));
            worker.execute(()-> {
                try(Socket socket=listener.accept()) {
                    socket.setSoTimeout(3000);
                    InputStream in=socket.getInputStream();
                    ByteArrayOutputStream header=new ByteArrayOutputStream();
                    int value;
                    while((value=in.read())!=-1) {
                        header.write(value);
                        String h=header.toString("US-ASCII");
                        if(h.endsWith("\r\n\r\n"))break;
                        if(header.size()>16384)throw new IOException();
                    }
                    String head=header.toString("US-ASCII");
                    int length=0;
                    for(String line:head.split("\r\n")) {
                        if(line.toLowerCase(Locale.ROOT).startsWith("content-length:"))length=Integer.parseInt(line.substring(15).trim());
                        if(line.toLowerCase(Locale.ROOT).startsWith("authorization:"))authorization.set(line.substring(14).trim());
                    }
                    check(length<32768,"Unexpected request size");
                    byte[] payload=new byte[length];
                    new DataInputStream(in).readFully(payload);
                    request.set(new JSONObject(new String(payload,StandardCharsets.UTF_8)));
                    count.incrementAndGet();
                    received.countDown();
                    if(delay>0)Thread.sleep(delay);
                    byte[] response=body.getBytes(StandardCharsets.UTF_8);
                    String headers="HTTP/1.1 "+status+" Result\r\nContent-Type: application/json\r\nContent-Length: "+response.length+"\r\nConnection: close\r\n"+(status==302?"Location: https://not-groq.invalid/\r\n":"")+"\r\n";
                    socket.getOutputStream().write(headers.getBytes(StandardCharsets.US_ASCII));
                    socket.getOutputStream().write(response);
                }
                catch(Exception ignored) {
                    received.countDown();
                }
            });
        }
        String endpoint() {
            return "http://127.0.0.1:"+listener.getLocalPort()+"/openai/v1/chat/completions";
        }
        public void close()throws Exception {
            listener.close();
            worker.shutdownNow();
        }
    }
    private static InferenceResult route(String mode,boolean net,boolean key,InferenceRouter.Backend online,AtomicInteger fallbacks,AtomicBoolean cancelled)throws Exception {
        return InferenceRouter.run(mode,net,key,true,"Revise apenas: Ola tudo bem?",32,online,(p,n,partial)-> {
            fallbacks.incrementAndGet();
            return new InferenceResult("Resultado local.","Offline · fixture",false);
        },cancelled::get,s-> {
        },s-> {
        });
    }
    public static void run(HeliTrialInstrumentation test,Bundle result)throws Exception {
        Context c=test.getTargetContext();
        AtomicBoolean cancelled=new AtomicBoolean();
        AtomicInteger calls=new AtomicInteger(),fallbacks=new AtomicInteger();
        InferenceRouter.Backend spy=(p,n,partial)-> {
            calls.incrementAndGet();
            return new InferenceResult("Online.","Groq",false);
        };
        route(AiPreferences.OFFLINE,true,true,spy,fallbacks,cancelled);
        route(AiPreferences.AUTO,false,true,spy,fallbacks,cancelled);
        route(AiPreferences.AUTO,true,false,spy,fallbacks,cancelled);
        check(calls.get()==0&&fallbacks.get()==3,"Offline/unconfigured mode attempted the network");
        boolean rejected=false;
        try {
            route(AiPreferences.ONLINE,false,true,spy,fallbacks,cancelled);
        }
        catch(IllegalStateException e) {
            rejected=true;
        }
        check(rejected&&fallbacks.get()==3,"Online-only silently used offline");
        String success="{\"choices\":[{\"message\":{\"content\":\"Olá, tudo bem?\",\"reasoning\":\"not displayed\"},\"finish_reason\":\"stop\"}]}";
        try(Server server=new Server(200,success,0)) {
            GroqClient client=new GroqClient(server.endpoint(),FAKE_KEY,cancelled::get,2000);
            InferenceResult answer=route(AiPreferences.AUTO,true,true,client,fallbacks,cancelled);
            check(answer.text.equals("Olá, tudo bem?"),"Transport returned wrong final text");
            check(server.count.get()==1,"Unexpected retries");
            check(server.authorization.get().equals("Bearer "+FAKE_KEY),"Authorization contract mismatch");
            JSONObject request=server.request.get();
            check(GroqClient.MODEL.equals(request.getString("model")),"Wrong online model");
            check(!request.getBoolean("include_reasoning")&&!request.getBoolean("stream"),"Reasoning/streaming contract mismatch");
            check(request.getJSONArray("messages").getJSONObject(1).getString("content").equals("Revise apenas: Ola tudo bem?"),"Task text changed in transit");
        }
        for(int code:new int[] {
            429,401,403,500,302
        }) {
            int previous=fallbacks.get();
            try(Server server=new Server(code,"{}",0)) {
                InferenceResult answer=route(AiPreferences.AUTO,true,true,new GroqClient(server.endpoint(),FAKE_KEY,cancelled::get,2000),fallbacks,cancelled);
                check(answer.backend.startsWith("Offline")&&fallbacks.get()==previous+1,"Auto fallback failed for HTTP "+code);
            }
        }
        try(Server server=new Server(429,"{}",0)) {
            int previous=fallbacks.get();
            rejected=false;
            try {
                route(AiPreferences.ONLINE,true,true,new GroqClient(server.endpoint(),FAKE_KEY,cancelled::get,2000),fallbacks,cancelled);
            }
            catch(GroqClient.Failure e) {
                rejected=e.status==429;
            }
            check(rejected&&fallbacks.get()==previous,"Online-only quota failure was masked");
        }
        try(Server server=new Server(200,"not-json",0)) {
            int previous=fallbacks.get();
            route(AiPreferences.AUTO,true,true,new GroqClient(server.endpoint(),FAKE_KEY,cancelled::get,2000),fallbacks,cancelled);
            check(fallbacks.get()==previous+1,"Malformed response did not fall back");
        }
        try(Server server=new Server(200,success,600)) {
            int previous=fallbacks.get();
            route(AiPreferences.AUTO,true,true,new GroqClient(server.endpoint(),FAKE_KEY,cancelled::get,100),fallbacks,cancelled);
            check(fallbacks.get()==previous+1,"Timeout did not fall back");
        }
        try(Server server=new Server(200,success,2000)) {
            ExecutorService work=Executors.newSingleThreadExecutor();
            GroqClient client=new GroqClient(server.endpoint(),FAKE_KEY,cancelled::get,3000);
            int previous=fallbacks.get();
            Future<Boolean> stopped=work.submit(()-> {
                try {
                    route(AiPreferences.AUTO,true,true,client,fallbacks,cancelled);
                    return false;
                }
                catch(CancellationException e) {
                    return true;
                }
            });
            check(server.received.await(3,TimeUnit.SECONDS),"Mock request did not start");
            cancelled.set(true);
            client.cancel();
            check(stopped.get(3,TimeUnit.SECONDS),"HTTP cancellation failed");
            check(fallbacks.get()==previous,"Cancellation started offline generation");
            work.shutdownNow();
            cancelled.set(false);
        }
        rejected=false;
        try {
            new GroqClient("http://127.0.0.1:80@not-groq.invalid/",FAKE_KEY,cancelled::get,100);
        }
        catch(IllegalArgumentException e) {
            rejected=true;
        }
        check(rejected,"Credential redirect endpoint allowed");
        check(!android.security.NetworkSecurityPolicy.getInstance().isCleartextTrafficPermitted("api.groq.com"),"Production transport allows cleartext");
        check(!SecretStore.hasKey(c),"This test requires a fresh installation without a real API key");
        try {
            SecretStore.save(c,FAKE_KEY);
            check(SecretStore.hasKey(c),"Encrypted key not stored");
            byte[] encrypted=java.nio.file.Files.readAllBytes(new File(c.getNoBackupFilesDir(),"groq-key.enc").toPath());
            check(!new String(encrypted,StandardCharsets.ISO_8859_1).contains(FAKE_KEY),"Key stored as plaintext");
            java.lang.reflect.Method read=SecretStore.class.getDeclaredMethod("read",Context.class);
            read.setAccessible(true);
            check(FAKE_KEY.equals(read.invoke(null,c)),"Keystore round trip failed");
            for(Object value:c.getSharedPreferences("writing-options",0).getAll().values())check(!String.valueOf(value).contains(FAKE_KEY),"Key leaked to preferences");
        }
        finally {
            SecretStore.remove(c);
            AiPreferences.mode(c,AiPreferences.OFFLINE);
        }
        TextChanges.Pair diff=TextChanges.compare("Eu nao sei.","Eu não sei!");
        check(diff.before.toString().equals("Eu nao sei.")&&diff.after.toString().equals("Eu não sei!"),"Diff changed the original or result");
        check(((Spanned)diff.before).getSpans(0,diff.before.length(),StrikethroughSpan.class).length>0,"Removed text not marked");
        String saved="backupvocabteste";
        DictionaryRepository.save(c,saved,250,null,"pt_BR");
        ByteArrayOutputStream backup=new ByteArrayOutputStream();
        DictionaryRepository.exportTo(c,backup);
        check(!backup.toString("UTF-8").contains(FAKE_KEY),"Dictionary export leaked a key");
        for(DictionaryRepository.Word word:DictionaryRepository.list(c))if(word.text.equals(saved))DictionaryRepository.delete(c,word.id);
        DictionaryRepository.importFrom(c,new ByteArrayInputStream(backup.toByteArray()));
        check(DictionaryRepository.list(c).stream().anyMatch(w->w.text.equals(saved)),"Dictionary backup round trip failed");
        int before=DictionaryRepository.list(c).size();
        rejected=false;
        try {
            DictionaryRepository.importFrom(c,new ByteArrayInputStream("{\"format\":\"wrong\",\"version\":1}".getBytes(StandardCharsets.UTF_8)));
        }
        catch(Exception e) {
            rejected=true;
        }
        check(rejected&&DictionaryRepository.list(c).size()==before,"Invalid backup changed the dictionary");
        for(DictionaryRepository.Word word:DictionaryRepository.list(c))if(word.text.equals(saved))DictionaryRepository.delete(c,word.id);
        // Exercise the actual new settings screens using the same touch helpers as the keyboard tests.
        test.clear();
        test.type("teste");
        test.aiClick("Adicionar palavra ao dicionário");
        test.aiClick("keyboard_appearance");
        test.aiNode("appearance_height");
        test.aiNode("appearance_letters");
        test.aiNode("appearance_symbols");
        test.shot("24-ajustes-de-aparencia");
        test.aiClick("appearance_save");
        test.launch();
        test.clear();
        test.type("teste");
        test.aiClick("Adicionar palavra ao dicionário");
        test.aiClick("dictionary_manage");
        test.aiNode("dictionary_search");
        test.shot("25-dicionario-e-backup");
        result.putString("hybrid_contract","PASS: HTTPS payload, explicit modes, quota/auth/server/malformed/timeout fallback, no network offline, cancellation without fallback, encrypted key, diff, dictionary backup, settings touch flow");
    }
}
