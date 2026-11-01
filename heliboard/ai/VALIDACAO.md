# Validação da primeira integração offline — 0.7.0

Build e interação aprovados no [run 41324324587](https://github.com/helbermoura2/teclado-br/actions/runs/41324324587),
commit `44a0340b22983ecf8d7d23be1954228ea50e0a97`.

## O que foi testado

- 142 testes unitários: zero falhas e zero ignorados.
- Android 15 AOSP x86_64 em emulador. Motor nativo também compilado para ARM64.
- App sem permissão INTERNET, verificada pelo PackageManager.
- Modelo Qwen3 0.6B Q8_0 com SHA-256 fixado, baixado pelo runner e copiado para
  a pasta privada. Wi-Fi e dados do emulador desativados antes da geração.
- Entrada no assistente pelo botão AI do teclado, captura do texto original,
  seleção do Compositor, prompt livre e resposta de inferência real pelo JNI.
- Resposta final sem marcadores de pensamento nem token de fim de mensagem.
- Edição da prévia e substituição no campo original, confirmada no outro processo.
- Revisão completa de uma frase sintética.
- Alteração deliberada do aplicativo original após a geração: substituição
  recusada, resposta preservada para copiar e texto novo mantido intacto.
- Cancelamento pelo botão: processamento interrompido, saída descartada,
  campo original preservado.
- Ausência de modelo: geração desabilitada e instrução para importar GGUF.
- Regressões de digitação, 200 caracteres com toques sobrepostos, Ç ao segurar C,
  espaço imediato, autocorreção, PT-BR/EN, dicionário pessoal e pins aprovadas.
- Pins preservados após 30 dias simulados, reinício e reinstalação do mesmo APK.

## Respostas reais e limites de qualidade

A revisão `Eu nao sei oque fazer.` retornou `Eu não sei o que fazer.`.

No pedido de saudação do Compositor, o modelo pequeno retornou
`Devolva somente o texto final.`, ecoando parte da instrução. Esse resultado
**não cumpre o pedido de redação** e não aprova esse modelo para uso real.
A aprovação da integração mede a execução local e os controles; não transforma
uma resposta inadequada em acerto de qualidade. A fixture de 0.6B não é o modelo
recomendado no catálogo do aplicativo.

Os resultados dos modelos maiores da rodada Linux anterior permanecem nos
relatórios de benchmarks. Qwen3.5 2B e Gemma 4 E2B têm links no assistente.
A opção oficial Gemma 4 Q4_0 (~2,84 GB) difere da Q4_K_M requantizada de 3,43 GB
do comparativo anterior. Sua qualidade, memória e latência não foram medidas
neste teste Android. Não houve execução no Nothing Phone (1).

O importador usa o seletor de documentos e copia o GGUF para no_backup, valida
cabeçalho e tamanho e registra SHA-256. O hash calculado de um arquivo arbitrário
não autentica sua origem; os links indicados apontam a revisões fixadas.
No teste automatizado, os pesos foram copiados diretamente para a pasta privada:
o seletor de arquivos e o download pelo navegador não foram automatizados.

O contexto é de 2.048 tokens e a geração normal limita-se a 256 tokens; o limite
de 32 tokens é usado somente pela instrumentação. Resultados truncados são
identificados na interface e podem ser editados antes de copiar ou substituir.
O texto original precisa fornecer um snapshot completo e limitado para permitir
substituição; caso contrário, o resultado pode ser copiado.

## Artefatos entregues

APK SHA-256:
`cd4c609304d9485e32ef59d2e72d3a7a4a11c9a3404773996b712eb627ad42ce`.

Fontes SHA-256:
`eab86871df52a38e2a39447994887fb2e608d31e37672ed76094531ac1040cd2`.

Certificado SHA-256:
`b758875ca8380d3b2ba0aa7b2b34a17f785aac3d0c4d1874674266a8877e9d45`.

Apksigner verificou a assinatura; o certificado v2 também foi conferido
independentemente no APK baixado. É o mesmo das versões 0.6.1–0.6.5.
Instalar por cima preserva dados; não desinstalar.

Capturas 13–19 mostram ausência de modelo, Compositor, resposta, substituição,
revisão, proteção de texto alterado e cancelamento. Pesos não acompanham o APK.
As fontes incluem HeliBoard, overlay e llama.cpp, com as licenças preservadas.
Fixtures binárias de vocabulário do upstream foram excluídas do pacote de fontes;
não são necessárias para compilar o aplicativo.

A lupa sobre outros aplicativos continua pendente. Esta versão oferece
tradução do texto fornecido dentro do assistente.
