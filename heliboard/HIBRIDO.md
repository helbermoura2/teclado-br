# Assistente de escrita híbrido — Gemini, Groq e Gemma (em implementação)

## Modos no teclado

- **Offline (padrão):** usa o GGUF importado no aparelho (por exemplo Gemma 4);
  nunca consulta serviços online.
- **Automático:** tenta Gemini 3.8 Flash se houver chave e internet; diante de
  falha tenta a chave Groq existente; se ambas indisponíveis, usa o GGUF local.
- **Online:** Gemini e, se necessário, Groq; não usa o GGUF como reserva.

Somente o texto escolhido para a tarefa explicitamente acionada pelo usuário
é enviado ao provedor. O editor normal, sugestões, dados de senha, aprendizado
e dicionário permanecem locais. Não há envio em segundo plano.
O botão **Substituir** continua sendo a única forma de aplicar uma revisão no
campo original e exige snapshot válido. A comparação de alterações é local.

## Configurar chave e privacidade

No teclado, abra **Assistente → engrenagem**. Cadastre sua chave Gemini no
campo próprio; Groq é opcional. A chave nunca deve ser enviada pelo chat nem
commitada no repositório. Cada chave é cifrada com AES-GCM e alias distinto no
Android Keystore, em diretório privado sem backup. Atualizações preservam os
arquivos e modelos locais. É possível remover uma chave sem apagar a outra.
O app não embute nenhum segredo, nem habilita faturamento em provedores.
A gratuidade depende do projeto e das cotas de cada fornecedor; serviços podem
usar os textos recebidos conforme as condições do plano.

O uso direto da API no dispositivo é reservado ao protótipo pessoal. A Google
recomenda uma camada de backend para produção, porque chaves em aplicações
cliente podem ser extraídas de aparelhos comprometidos. Consulte [GEMINI.md](GEMINI.md).
A conexão exige HTTPS; exceção HTTP só para 127.0.0.1 nos testes sintéticos.

## Qualidade e validação

O prompt de revisão foi reforçado para preservar fatos, negações, nomes,
valores, links, gírias intencionais e não parafrasear textos corretos.
Isso não garante correção perfeita: Gemini, Groq e Gemma devem ser comparados
com frases reais escolhidas pelo usuário, sem enviar essas frases a logs ou CI.
O modelo online responde em uma única requisição limitada, com cancelamento
e detecção de falha. A saída fica na prévia até ação explícita.

A suíte existente tem testes sintéticos de erros de rede, chaves, limites e
edição; a nova implementação adiciona casos Gemini. A compilação e o teste
no Nothing Phone (1) ainda não foram concluídos nesta branch.

## Personalização

Segure uma sugestão para ler a palavra inteira, usá-la, adicioná-la ao dicionário
ou remover uma sugestão indesejada. O botão ＋ continua salvando a palavra do campo.
No menu ＋ há gerenciamento pesquisável do dicionário pessoal e importação/exportação
JSON pelo seletor de arquivos. Importação mescla, sem limpar as palavras existentes;
exporta o dicionário pessoal, não o histórico interno de aprendizagem, pins ou chaves.
Excluir uma entrada pessoal não apaga palavras dos dicionários base ou do histórico.

Aparência oferece altura em retrato e tamanhos separados de letras e símbolos.
Salve e reabra o teclado para aplicar. A barra nativa desliza horizontalmente;
quando aberta manualmente, fica aberta até a próxima entrada de texto.

## Medição e validação

As configurações oferecem teste com texto sintético e histórico local das últimas
cinco medições. Mostra duração, pico amostrado de PSS do processo de inferência e,
quando disponível, diferença do contador de energia do aparelho. Energia é do
aparelho inteiro, não consumo isolado da IA. PSS amostrado não captura todo pico.
Execute no Nothing Phone (1) com condições semelhantes e repita cada modo.
Não há resultado de desempenho real do telefone nem validação com chave real Groq
nesta implementação. O modelo pequeno do teste Android verifica integração, não
qualidade geral de revisão ou desempenho da Gemma maior.

Testes automatizados aprovados ([registro](VALIDACAO-0.8.0.md)): transporte HTTP real contra servidor local controlado,
sucesso, cota, autenticação, redirecionamento, resposta inválida, timeout, cancelamento,
fallback; chave cifrada; comparação sem alteração do texto; backup do dicionário;
controles de aparência e regressões de digitação, idiomas, pins e inferência offline.
A lupa flutuante com OCR continua pendente.

Os patches agora ficam em módulos de sugestões, digitação e assistente, com âncoras
únicas verificadas e relatório TECLADO-BR-PATCHES.json no fonte preparado. Upstream,
llama.cpp e licença GPLv3 permanecem fixados. As fontes acompanham cada APK.
