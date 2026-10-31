package br.com.tecladobr;

import java.text.Normalizer;
import java.util.*;
import java.io.*;

/** Offline starter lexicon; intentionally conservative about automatic changes. */
public final class TextEngine {
    public static final Locale PT = Locale.forLanguageTag("pt-BR");
    private static final Map<String, String> FIXES = new LinkedHashMap<>();
    private static final List<String> WORDS = Arrays.asList((
        "você vocês não sim também então amanhã hoje ontem agora depois antes obrigado obrigada " +
        "bom boa dia tarde noite tudo bem como está estou estamos vamos pode posso preciso " +
        "quero queria fazer falar conversar mensagem trabalho casa escola família telefone " +
        "celular teclado português correção café água pão coração atenção informação reunião " +
        "horário muito mais menos para por porque quando onde quem qual quanto aqui ali " +
        "ainda já até só nós são tem têm oi olá beleza certo combinado desculpa por favor"
    ).split(" +"));
    static {
        FIXES.put("opcoes", "opções"); FIXES.put("ortografiaa", "ortografia");
        FIXES.put("voce", "você"); FIXES.put("voces", "vocês");
        FIXES.put("nao", "não"); FIXES.put("tambem", "também");
        FIXES.put("entao", "então"); FIXES.put("amanha", "amanhã");
        FIXES.put("ola", "olá"); FIXES.put("coracao", "coração");
        FIXES.put("informacao", "informação"); FIXES.put("reuniao", "reunião");
        FIXES.put("obrigadoo", "obrigado"); FIXES.put("obrigadaa", "obrigada");
    }
    public static String currentWord(String before) {
        int i = before.length();
        while (i > 0 && Character.isLetter(before.charAt(i - 1))) i--;
        return before.substring(i);
    }
    public static boolean sentenceStart(String before) {
        int i = before.length() - 1;
        while (i >= 0 && Character.isWhitespace(before.charAt(i))) {
            if (before.charAt(i) == '\n') return true;
            i--;
        }
        while (i >= 0 && "\"'”’)]}".indexOf(before.charAt(i)) >= 0) i--;
        return i < 0 || ".!?".indexOf(before.charAt(i)) >= 0;
    }
    private static final class Entry{
        final String word,fold;
        Entry(String word){this.word=word;this.fold=plain(word);}
    }
    private static volatile List<Entry> lexicon=entries(WORDS);
    private static List<Entry> entries(Collection<String> words){
        List<Entry> result=new ArrayList<>();for(String word:words)result.add(new Entry(word));return result;
    }
    public static void load(Reader source)throws IOException{
        LinkedHashSet<String> words=new LinkedHashSet<>();
        BufferedReader reader=new BufferedReader(source);String line;
        while((line=reader.readLine())!=null){String word=line.split(" ",2)[0].toLowerCase(PT);
            if(word.length()>1&&word.length()<25&&word.codePoints().allMatch(Character::isLetter))words.add(word);
        }
        words.addAll(WORDS);lexicon=entries(words);
    }
    private static String matchCase(String source, String result) {
        if (source.length()>1 && source.equals(source.toUpperCase(PT))) return result.toUpperCase(PT);
        if (Character.isUpperCase(source.charAt(0)))
            return result.substring(0, 1).toUpperCase(PT) + result.substring(1);
        return result;
    }
    public static String correct(String word) {
        if (word.isEmpty()) return word;
        String fixed = FIXES.get(word.toLowerCase(PT));
        return fixed == null ? word : matchCase(word, fixed);
    }
    private static String plain(String word) {
        return Normalizer.normalize(word.toLowerCase(PT), Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "");
    }
    private static int distance(String a,String b,int limit){
        if(Math.abs(a.length()-b.length())>limit)return limit+1;
        int[] previous=new int[b.length()+1],older=null;
        for(int j=0;j<=b.length();j++)previous[j]=j;
        for(int i=1;i<=a.length();i++){
            int[] current=new int[b.length()+1];current[0]=i;int best=i;
            for(int j=1;j<=b.length();j++){
                current[j]=Math.min(Math.min(current[j-1]+1,previous[j]+1),previous[j-1]+(a.charAt(i-1)==b.charAt(j-1)?0:1));
                if(older!=null&&i>1&&j>1&&a.charAt(i-1)==b.charAt(j-2)&&a.charAt(i-2)==b.charAt(j-1))current[j]=Math.min(current[j],older[j-2]+1);
                best=Math.min(best,current[j]);
            }
            if(best>limit)return limit+1;older=previous;previous=current;
        }
        return previous[b.length()];
    }
    public static List<String> suggest(String word) {
        if(word.isEmpty())return Collections.emptyList();
        LinkedHashSet<String> result=new LinkedHashSet<>();
        String corrected=correct(word),prefix=plain(word);
        if(!corrected.equals(word))result.add(corrected);
        List<Entry> words=lexicon;
        for(Entry candidate:words){
            if(candidate.fold.startsWith(prefix))result.add(matchCase(word,candidate.word));
            if(result.size()>=3)return new ArrayList<>(result);
        }
        if(!result.isEmpty())return new ArrayList<>(result);
        // Never leave an unknown word blank; retaining a name is always an option.
        result.add(word);
        if(prefix.length()>2&&prefix.length()<24){
            for(int tolerance=1;tolerance<=2&&result.size()<3;tolerance++)for(Entry candidate:words){
                if(!candidate.fold.isEmpty()&&candidate.fold.charAt(0)==prefix.charAt(0)&&distance(prefix,candidate.fold,tolerance)<=tolerance)result.add(matchCase(word,candidate.word));
                if(result.size()>=3)break;
            }
        }
        if(result.size()<3&&prefix.length()>=6&&prefix.length()<24){
            outer:for(int split=prefix.length()-2;split>=2;split--){
                String left=prefix.substring(0,split),right=prefix.substring(split);Entry first=null;
                for(Entry candidate:words)if(candidate.fold.equals(left)){first=candidate;break;}
                if(first==null)continue;
                for(Entry second:words){
                    if(second.fold.length()<2||second.fold.charAt(0)!=right.charAt(0))continue;
                    String part=second.fold.substring(0,Math.min(right.length(),second.fold.length()));
                    if(distance(right,part,1)<=1){result.add(matchCase(word,first.word+" "+second.word));break outer;}
                }
            }
        }
        List<String> output=new ArrayList<>(result);return output.subList(0,Math.min(3,output.size()));
    }
    /** Small hand-written next-word list, separate from prefix completion. */
    public static List<String> suggestionsForContext(String before) {
        String word = currentWord(before);
        if (!word.isEmpty()) return suggest(word);
        if (sentenceStart(before)) return Arrays.asList("Eu", "Você", "Bom");
        String previous = currentWord(before.trim()).toLowerCase(PT);
        switch (previous) {
            case "olá": case "ola": return Arrays.asList("tudo", "como", "você");
            case "como": return Arrays.asList("você", "foi", "está");
            case "está": case "esta": return Arrays.asList("bem", "tudo", "pronto");
            case "quero": return Arrays.asList("fazer", "saber", "ver");
            case "vou": return Arrays.asList("fazer", "para", "te");
            case "não": return Arrays.asList("sei", "posso", "quero");
            case "assim": return Arrays.asList("que", "mesmo", "como");
            case "eu": return Arrays.asList("quero", "estou", "vou");
            case "você": case "voce": return Arrays.asList("está", "pode", "quer");
            case "bom": return Arrays.asList("dia", "trabalho", "mesmo");
            case "boa": return Arrays.asList("tarde", "noite", "ideia");
            case "tudo": return Arrays.asList("bem", "certo", "pronto");
            default: return Arrays.asList("que", "de", "para");
        }
    }
}
