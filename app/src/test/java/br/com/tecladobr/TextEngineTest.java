package br.com.tecladobr;

import org.junit.Test;
import static org.junit.Assert.*;

public class TextEngineTest {
    @Test public void sentences() {
        assertTrue(TextEngine.sentenceStart(""));
        assertTrue(TextEngine.sentenceStart("Olá. "));
        assertTrue(TextEngine.sentenceStart("Tudo bem? "));
        assertTrue(TextEngine.sentenceStart("Sim!\" "));
        assertTrue(TextEngine.sentenceStart("Uma linha\n"));
        assertFalse(TextEngine.sentenceStart("Olá, "));
        assertFalse(TextEngine.sentenceStart("Estou digitando"));
    }
    @Test public void correctionsPreserveCaseAndUnknownWords() {
        assertEquals("você", TextEngine.correct("voce"));
        assertEquals("Você", TextEngine.correct("Voce"));
        assertEquals("NÃO", TextEngine.correct("NAO"));
        assertEquals("Nothing", TextEngine.correct("Nothing"));
        assertEquals("", TextEngine.correct(""));
        assertEquals("avó", TextEngine.correct("avó"));
    }
    @Test public void wordBoundaryAndSuggestions() {
        assertEquals("voce", TextEngine.currentWord("Oi, voce"));
        assertEquals("", TextEngine.currentWord("Oi. "));
        assertEquals("você", TextEngine.suggest("voce").get(0));
        assertTrue(TextEngine.suggest("cora").contains("coração"));
        assertTrue(TextEngine.suggest("").isEmpty());
    }
    @Test public void toolbarSuggestsCompletionsOrNextWords() {
        assertEquals("que", TextEngine.suggestionsForContext("É assim ").get(0));
        assertEquals("você", TextEngine.suggestionsForContext("oi voce").get(0));
        assertEquals("Eu", TextEngine.suggestionsForContext("Terminou. ").get(0));
        assertEquals("dia", TextEngine.suggestionsForContext("Bom ").get(0));
        assertEquals("bem", TextEngine.suggestionsForContext("Tudo ").get(0));
    }
    @Test public void unknownWordsKeepAnOptionAndDoNotForceCorrection(){
        assertTrue(TextEngine.suggest("Xyzzyphone").contains("Xyzzyphone"));
        assertFalse(TextEngine.suggestionsForContext("Olá comovov").isEmpty());
        assertEquals("Xyzzyphone",TextEngine.correct("Xyzzyphone"));
        assertEquals("você",TextEngine.suggestionsForContext("Olá como ").get(0));
        assertEquals("bem",TextEngine.suggestionsForContext("Você está ").get(0));
        assertEquals("Você",TextEngine.suggest("V").get(0));
    }
}
