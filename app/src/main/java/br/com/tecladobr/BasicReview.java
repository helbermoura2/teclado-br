package br.com.tecladobr;

import java.util.regex.*;

/** Conservative local spelling substitutions, not a grammar or AI model. */
public final class BasicReview {
    private static final Pattern WORD = Pattern.compile("[\\p{L}\\p{M}]+");
    public static String correct(String source) {
        Matcher matcher = WORD.matcher(source);
        StringBuffer output = new StringBuffer();
        while (matcher.find()) matcher.appendReplacement(output, Matcher.quoteReplacement(TextEngine.correct(matcher.group())));
        matcher.appendTail(output);
        return output.toString();
    }
}
