# Painel dentro do teclado — 0.7.1

O botão de brilho substitui visualmente as teclas por um painel na própria janela
IME. O aplicativo e seu texto continuam visíveis acima. Não abre a antiga
WritingActivity, que foi removida.

- Menu em degradê e cartões arredondados: Ortografia e gramática, Estilo de
  escrita, Resumir; Marcador e Tabela; Compositor.
- Estilos: Profissional, Casual, Mídia, Educado e Com emojis.
- Revisão captura o trecho selecionado ou o texto completo, gera no aparelho e
  mostra um cartão com Editar, Copiar e Substituir.
- Compositor tem um pedido livre. Ao editar pedido ou resultado, as teclas
  nativas reaparecem sob um editor interno. Os eventos são dirigidos ao editor
  interno, sem escrever na conversa.
- A engrenagem gerencia o modelo. A inferência usa serviço privado no processo
  :writing; a interface permanece no IME. O aplicativo não tem INTERNET.
- O ícone de teclado fecha o painel e restaura as teclas.
- Antes de substituir, confirma identidade do campo e snapshot completo do texto.
  Se o original mudou, preserva o resultado para copiar e bloqueia a substituição.

O GGUF permanece em getNoBackupFilesDir()/offline-ai/model.gguf, o mesmo local da
0.7.0. A atualização usa o certificado anterior e não exige nova importação.
Não desinstalar para atualizar. A lupa flutuante ainda está pendente.

Os limites do motor e a distinção entre integração e qualidade dos modelos
continuam em VALIDACAO.md. A revisão visual não mede desempenho da Gemma 4 no
Nothing Phone (1).

## Verificações

Compilação e 142 testes unitários aprovados. Certificado mantido. No Android 15
AOSP x86_64, o fluxo offline com Qwen3 0.6B Q8_0 passou: menu no IME, prompt com
teclas nativas sem alterar o campo original, inferência real, edição da prévia,
cópia, substituição, bloqueio após alteração do original e cancelamento.

As respostas da fixture foram `Sauda-me.` no pedido de saudação e
`eu nao sei o que fazer.` na revisão. A segunda deixou erros de acentuação;
**o teste aprova a integração e os controles, não a qualidade linguística desse
modelo pequeno**. Não é o modelo recomendado para uso. A Gemma 4 importada pelo
usuário é mantida, mas não houve medição de qualidade ou desempenho no telefone.

As capturas mostraram necessidade de reservar a navegação do Android. A correção
reserva os insets inferiores, atualiza o recorte da janela e testa os botões por
toques injetados, além das verificações de acessibilidade.

## Entrega verificada

Run 41348374690, commit e9e71847b0a0f3479ed233e8f5880f36c4108077:
compilação, 142 unitários sem falhas e interação Android aprovados.
Fluxo do assistente testado por toques reais nas coordenadas dos controles.
Regressões de 200 caracteres sobrepostos, subteclas, pontuação, maiúsculas,
autocorreção, idiomas e dicionário aprovadas. Pins preservados após 30 dias
simulados, reinício e reinstalação com a mesma assinatura.

APK SHA-256: 6dbc63708b59db69b981090c861aea043dad1dbc3601c0319238a448f41a8d39

Fontes SHA-256: 71ffa4b9b1226f216063f62e60b26e1ab17858c8b78bbfdc08f4bf4b29b09ac3

Certificado SHA-256: b758875ca8380d3b2ba0aa7b2b34a17f785aac3d0c4d1874674266a8877e9d45

APK: https://github.com/helbermoura2/teclado-br/actions/runs/41348374690/artifacts/13100735107

Fontes: https://github.com/helbermoura2/teclado-br/actions/runs/41348374690/artifacts/13100550791

Testes e capturas: https://github.com/helbermoura2/teclado-br/actions/runs/41348374690/artifacts/13101350039

Os ZIPs do GitHub exigem acesso ao repositório privado. Instalar o APK por cima
da versão anterior, sem desinstalar. O modelo importado permanece no mesmo local.
