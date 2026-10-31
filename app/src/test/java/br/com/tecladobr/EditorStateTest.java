package br.com.tecladobr;
import org.junit.Test;
import static org.junit.Assert.*;
public class EditorStateTest {
    @Test public void delayedAcknowledgementsDoNotEraseNewTyping(){
        EditorState state=new EditorState();state.reset("",0,0,false);
        state.insert("a");state.expectAck();state.insert("b");state.expectAck();state.insert("c");state.expectAck();
        assertTrue(state.acknowledge(1,1));assertEquals("abc",state.before());
        assertTrue(state.acknowledge(3,3));assertEquals("abc",state.before());assertEquals(3,state.cursor());
    }
    @Test public void externalSelectionInvalidatesOldContext(){
        EditorState state=new EditorState();state.reset("abc",3,3,false);
        assertFalse(state.acknowledge(0,3));assertTrue(state.hasSelection());assertFalse(state.valid());
        state.reset("",0,3,false);state.insert("X");assertEquals("X",state.before());assertEquals(1,state.cursor());
    }
    @Test public void sensitiveFieldsNeverKeepText(){
        EditorState state=new EditorState();state.reset("secret",6,6,true);state.insert("password");
        assertEquals("",state.before());assertEquals(14,state.cursor());state.clear();assertEquals("",state.before());
    }
    @Test public void deletionTracksUnicodeLength(){
        EditorState state=new EditorState();state.reset("a😀",3,3,false);state.deleteLeft(2);
        assertEquals("a",state.before());assertEquals(1,state.cursor());
    }
    @Test public void longBurstKeepsDelayedAcknowledgementHistory(){
        EditorState state=new EditorState();state.reset("",0,0,false);
        for(int i=0;i<300;i++){state.insert("a");state.expectAck();}
        assertTrue(state.acknowledge(1,1));assertTrue(state.valid());assertEquals(300,state.before().length());
        assertTrue(state.acknowledge(300,300));assertEquals(300,state.cursor());
    }
}
