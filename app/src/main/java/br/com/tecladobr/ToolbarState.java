package br.com.tecladobr;

/** A single toolbar row alternates between shortcuts and word suggestions. */
public final class ToolbarState {
    private boolean expanded = true;
    public boolean isExpanded() { return expanded; }
    public void reset() { expanded = true; }
    public void toggle() { expanded = !expanded; }
    public void onTyping() { expanded = false; }
}
