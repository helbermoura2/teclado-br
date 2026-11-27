// SPDX-License-Identifier: GPL-3.0-only
package helium314.keyboard.latin.ai;

import java.util.regex.Pattern;

/** Extracts a complete, user-facing answer from the local runtime response. */
final class OfflineOutput {
    private static final Pattern THOUGHT = Pattern.compile(
        "\\A(?:<\\|channel>thought\\s*.*?<channel\\|>|<think>.*?</think>)\\s*", Pattern.DOTALL);
    private static final Pattern CONTROL = Pattern.compile("<\\|[^<>]*>|<[^<>]*\\|>|</?think>");

    static String finalText(String response) {
        if (response.startsWith("S\n")) {
            String text = response.substring(2).trim();
            text = THOUGHT.matcher(text).replaceFirst("").trim();
            if (!text.isEmpty() && !CONTROL.matcher(text).find()) return text;
        }
        throw new IllegalStateException("A IA offline não entregou um texto final completo. Tente novamente.");
    }
}
