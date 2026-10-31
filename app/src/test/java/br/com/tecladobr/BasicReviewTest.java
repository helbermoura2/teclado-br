package br.com.tecladobr;

import org.junit.Test;
import static org.junit.Assert.*;

public class BasicReviewTest {
    @Test public void correctsKnownSpellingAndPreservesLayout() {
        assertEquals("Você tem opções.\nNão, obrigado! 😀", BasicReview.correct("Voce tem opcoes.\nNao, obrigado! 😀"));
    }
    @Test public void leavesUnknownGrammarAndNamesUntouched() {
        assertEquals("Nothing Phone 1; nós vai.", BasicReview.correct("Nothing Phone 1; nós vai."));
        assertEquals("", BasicReview.correct(""));
        assertEquals("VOCÊ", BasicReview.correct("VOCE"));
    }
}
