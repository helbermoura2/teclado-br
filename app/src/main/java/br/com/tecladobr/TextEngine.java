package br.com.tecladobr;

import java.text.Normalizer;
import java.util.*;

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
    private static String matchCase(String source, String result) {
        if (source.equals(source.toUpperCase(PT))) return result.toUpperCase(PT);
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
    public static List<String> suggest(String word) {
        if (word.isEmpty()) return Collections.emptyList();
        LinkedHashSet<String> result = new LinkedHashSet<>();
        String corrected = correct(word);
        if (!corrected.equals(word)) result.add(corrected);
        String prefix = plain(word);
        for (String candidate : WORDS) {
            if (plain(candidate).startsWith(prefix)) result.add(matchCase(word, candidate));
            if (result.size() >= 3) break;
        }
        return new ArrayList<>(result);
    }
}
