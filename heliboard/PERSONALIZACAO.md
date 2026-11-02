# Dicionário e aprendizado local — 0.7.2

O botão ＋ junto às sugestões lê a palavra no cursor ou uma palavra selecionada e
abre «Adicionar “palavra” ao dicionário». Não depende de a palavra estar entre as
sugestões, nem salva o texto visualmente abreviado de uma sugestão longa.
O salvamento é explícito e feito fora da thread de digitação. O dicionário nativo
é notificado pelo provedor do Android; palavras pessoais passam a participar de
completamentos e correções. Segurar uma sugestão continua oferecendo o menu.

A migração ativa sugestões, personalização, próxima palavra e inclusão automática
de palavras recorrentes no dicionário pessoal. O mecanismo nativo aprende
frequência e contexto das palavras confirmadas, com ganho gradual; não é uma
promessa de completar todas as frases.

O cache de próximas palavras é invalidado a cada palavra aprendida e não guarda
resultados vazios, evitando previsões desatualizadas dentro do mesmo campo.
Não grava tudo como um histórico de mensagens. Apagar/corrigir palavras também fornece sinais ao motor nativo.

Campos de senha, modo anônimo e campos com NO_PERSONALIZED_LEARNING continuam
excluídos do aprendizado. O botão de inclusão fica oculto no modo anônimo.
Não exige Gemma nem conexão de rede. A atualização mantém modelo, pins e dados.

Os testes de interação incluem inclusão de «maravilhosaaaa» pelo botão, consulta
real ao dicionário do Android, completamento por prefixo e treino por digitação
repetida de uma expressão sintética. Também verificam palavra aprendida e próxima
palavra após reinstalar o mesmo APK, sem apagar os dados.

## Validação e entrega

Run [41409012543](https://github.com/helbermoura2/teclado-br/actions/runs/41409012543),
commit `39e9bcf8759aaebd6b3c16a8cd9b5c5c2fc36071`. Build, 142 testes unitários sem
falhas e todas as fases de interação no Android 15 AOSP x86_64 aprovadas.

- Inclusão de «maravilhosaaaa» pelo botão ＋ e consulta real ao provedor Android.
- Completamento a partir de «maravilhos»: a sugestão abreviada visualmente com …
  inseriu a palavra inteira ao receber um toque.
- Digitação repetida de «zunibravo cafezinho»: «zuni» completou «zunibravo» e
  o teclado sugeriu «cafezinho» após «zunibravo». O toque inseriu a próxima palavra.
- Palavra manual, completamento aprendido e próxima palavra preservados após
  reinstalar o mesmo APK, sem apagar dados.
- Regressões: 200 toques sobrepostos, subteclas, espaço após pontuação, maiúsculas,
  autocorreção, PT-BR/EN, pins, revisão offline, Compositor e substituição segura.

O treino usou somente dados sintéticos; não mede qualidade em todas as situações
nem tempo de adaptação no telefone real. O aprendizado é gradual, depende das
palavras confirmadas e pode mudar suas prioridades com o uso. A IA generativa não
é usada para cada tecla. As limitações dos testes de IA permanecem nos relatórios
anteriores; não houve novo benchmark da Gemma no Nothing Phone (1).

APK SHA-256: `e9c1bd7fd73b596c6173c4e82b2302ae1d1683262ba3ecc31e1a3997e90eca82`.

Fontes SHA-256: `6fb7bafa86176d2a7508749a685fb4fa36faa02244d25cbdb89e27f86292c133`.

Certificado SHA-256: `b758875ca8380d3b2ba0aa7b2b34a17f785aac3d0c4d1874674266a8877e9d45`.

A assinatura foi verificada no CI e o certificado v2 conferido no APK baixado.
O certificado é o mesmo das versões anteriores. Instalar por cima, sem desinstalar.

[ZIP com APK](https://github.com/helbermoura2/teclado-br/actions/runs/41409012543/artifacts/13125196168)
· [Fontes](https://github.com/helbermoura2/teclado-br/actions/runs/41409012543/artifacts/13124583844)
· [Resultados e capturas](https://github.com/helbermoura2/teclado-br/actions/runs/41409012543/artifacts/13126285167).

Os links exigem acesso ao repositório privado. Modelo GGUF e chaves privadas não
acompanham o APK nem o pacote de fontes.
