# Teclado BR 0.9.0 — estilo One UI 8.5 (não oficial)

## Objetivo

Evoluir a variante HeliBoard v3.6 para uma interface escura inspirada na
organização do Samsung Keyboard no Galaxy S26 Ultra, sem distribuir
componentes, logos, temas, serviços ou código proprietário Samsung.
Não é o teclado oficial nem uma implementação de Galaxy AI.

Referências públicas para análise visual/funcional:

- [Samsung Newsroom: Área de Transferência Inteligente One UI 8.5](https://news.samsung.com/br/conheca-e-domine-a-area-de-transferencia-inteligente-da-nova-samsung-one-ui-8-5).
- [Samsung Newsroom: recursos Galaxy AI S26](https://news.samsung.com/br/galaxy-ai-na-galaxy-s26-series-recursos-para-resumir-conteudos-responder-mensagens-e-personalizar-a-rotina).

## Entregue no código desta prévia

1. **Tema opcional e reversível.** Em `Assistente → ⚙ → Aparência do teclado`,
   habilite `Estilo One UI 8.5 · inspirado no Samsung Keyboard`. A prévia
   mostra a nova paleta antes de salvar. A ativação preserva o tema anterior,
   o modo dia/noite, as bordas e o estilo; desativar restaura esses valores.
   Não modifica palavras aprendidas, dicionário pessoal, prancheta fixada,
   idioma, fonte, tamanhos, altura, modelos ou credenciais.
2. **Barra de escrita reorganizada.** Quando o novo tema está ativo,
   o assistente exibe um cabeçalho escuro com contraste reforçado,
   cartões de ferramentas e ações adicionais numa área rolável. A tarja
   de sugestões e a barra nativa do HeliBoard permanecem intactas.
3. **Tradução para cinco destinos.** Português brasileiro, inglês,
   espanhol, francês e italiano. A escolha precede a chamada de IA;
   a tradução não acontece ao digitar.
4. **Compositor com tom.** Padrão, Profissional, Casual, Educado,
   Direto e Amigável, aplicados explicitamente ao prompt.
5. **Sugestões de resposta.** Geradas apenas quando o usuário seleciona
   uma mensagem ou trecho e solicita a função. Não lê outras mensagens,
   notificações nem histórico de conversa.
6. **Prancheta com IA, por ação explícita.** O último item *textual*
   disponível no clipboard pode ser resumido, traduzido ou usado
   para sugerir resposta. O clipboard não é examinado em segundo plano
   e não é criado um histórico próprio de textos ou imagens. A resposta
   gerada dessa origem **não pode substituir o campo de edição**, pois
   não corresponde ao snapshot original do aplicativo. Apenas Copiar e
   edição de prévia permanecem disponíveis.
7. **Proteções mantidas.** O modo Offline é o padrão; a Groq só recebe
   texto quando há uma solicitação explícita em modo Online/Automático.
   Senhas continuam bloqueadas no assistente. O snapshot impede
   alterações desatualizadas de outro texto. A inferência continua
   no processo `:writing`, fora da digitação.

## Comparação e validação

- **Antes**: perfil `Teclado BR · escuro`, paleta cinza/pretos e
  assistente original com gradiente.
- **Depois**: opção `Teclado BR · Estilo One UI`, fundo mais profundo,
  teclas cinza-ardósia, símbolos claros, azul de destaque e painel IA
  escuro com ferramentas roláveis. O visual é inspirado, **não idêntico**.
- O fluxo Android de CI cria capturas `24-ajustes-de-aparencia`,
  `24b-preview-visual-oneui`, `24c-teclado-oneui`,
  `13b-ia-traducao-idiomas` e `16-ia-compositor`.
  Essas capturas devem ser revisadas antes de liberar APK.
- Teste de UI alterna o tema e confere restauração exata do anterior;
  novos testes unitários verificam tradução, tom do Compositor,
  respostas sugeridas e correção tradicional.
- O workflow `teclado-oneui-preview.yml` executa o build e o emulador
  Android 15 **em PR, sem publicar release**. A publicação privada
  segue o workflow histórico somente após integração na `main`.
- Ainda é obrigatória a validação manual de tamanho, conforto,
  resposta ao toque, consumo de memória/energia e qualidade de modelos
  no **Nothing Phone (1)** real. A equivalência visual em cada aplicativo
  depende dos campos IME e da orientação da tela.

## O que continua fora do escopo

- Não há acesso aos serviços oficiais Galaxy AI ou Now Nudge.
- Não há tradução simultânea automática de mensagens recebidas.
- Não processa fotos e imagens do clipboard, nem executa OCR flutuante.
- Não faz engenharia reversa de pacotes nem copia ativos proprietários.
- Não promete equivalência pixel a pixel ou qualidade linguística
  de modelos pequenos. O motor de linguagem continua sujeito ao
  tamanho do GGUF, à RAM e à rede.

## Atualização sem perda de dados

O pacote permanece `br.com.tecladobr.heli.debug`, a assinatura
fixa anterior é preservada e o número da versão sobe para
`versionCode 9000` (`0.9.0-heli3.6`). **Após a publicação
e verificação da assinatura**, instalar o APK por cima da versão
0.8.1, nunca desinstalar, para preservar modelos GGUF, pins,
preferências e dicionário. Se a assinatura não corresponder, não
forçar a instalação e não apagar dados.

O código da variante HeliBoard conserva as obrigações GPLv3 e os avisos
de atribuição; o runtime llama.cpp usa MIT. O modelo GGUF e a chave
Groq não são distribuídos no APK.
