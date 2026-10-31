package br.com.tecladobr;

import org.junit.Test;
import static org.junit.Assert.*;

public class ToolbarStateTest {
    @Test public void shortcutsCollapseOnTypingAndCanBeReopened() {
        ToolbarState state = new ToolbarState();
        assertTrue(state.isExpanded());
        state.onTyping(); assertFalse(state.isExpanded());
        state.toggle(); assertTrue(state.isExpanded());
        state.onTyping(); assertFalse(state.isExpanded());
        state.onTyping(); assertFalse(state.isExpanded());
        state.toggle(); assertTrue(state.isExpanded());
        state.toggle(); assertFalse(state.isExpanded());
        state.reset(); assertTrue(state.isExpanded());
    }
}
