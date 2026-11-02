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
promessa de completar todas as frases. O cache de próximas palavras é invalidado a cada palavra aprendida e não guarda
resultados vazios, evitando previsões desatualizadas dentro do mesmo campo.
Não grava tudo como um histórico de
mensagens. Apagar/corrigir palavras também fornece sinais ao motor nativo.

Campos de senha, modo anônimo e campos com NO_PERSONALIZED_LEARNING continuam
excluídos do aprendizado. O botão de inclusão fica oculto no modo anônimo.
Não exige Gemma nem conexão de rede. A atualização mantém modelo, pins e dados.

Os testes de interação incluem inclusão de «maravilhosaaaa» pelo botão, consulta
real ao dicionário do Android, completamento por prefixo e treino por digitação
repetida de uma expressão sintética. Também verificam palavra aprendida e próxima
palavra após reinstalar o mesmo APK, sem apagar os dados.
