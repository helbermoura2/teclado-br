// SPDX-License-Identifier: GPL-3.0-only
package helium314.keyboard.latin.ai;
public final class PromptBuilder {
    public static String build(String task,String style,String prompt,String source) {
        String command;
        switch(task) {
            case "Compositor":command="Redija o texto solicitado. Não invente dados. Pedido: "+prompt;
            break;
            case "Estilo de escrita":command="Reescreva no estilo "+style+", preservando fatos e negações.";
            break;
            case "Resumir":command="Resuma em português, preservando os fatos principais.";
            break;
            case "Traduzir para português":command="Traduza para português brasileiro, preservando nomes, valores e sentido.";
            break;
            case "Marcador":command="Organize o texto em uma lista com marcadores, sem inventar informações.";
            break;
            case "Tabela":command="Organize os dados em tabela de texto simples, sem acrescentar informações.";
            break;
            default:command="Corrija somente ortografia, pontuação e gramática. Preserve significado, fatos e negações. Se estiver correto, devolva o mesmo texto.";
        }
        return command+"\n\n<texto_para_editar>\n"+source+"\n</texto_para_editar>\nDevolva somente o texto final.";
    }
}
