# Teclado BR

Protótipo de teclado Android independente com visual inspirado no Samsung Keyboard,
destinado inicialmente a testes no Nothing Phone (1). Não é um produto Samsung.
Código próprio; não contém código ou recursos extraídos do Keyvya ou da Samsung.

## Versão 0.2.0

- Tema escuro com teclas cinza, símbolos secundários e ícones desenhados no app.
- Barra de altura fixa: atalhos ao abrir, sugestões ao digitar, seta para alternar.
- Botões para colar o texto atualmente copiado, emojis e configurações.
- IA e tradução aparecem como recursos em desenvolvimento, sem processamento simulado.
- Sugestões de próxima palavra por regras simples, além de completar palavras.

## Estado

Implementação inicial. O motor de texto foi compilado isoladamente com Java e passou
por 18 verificações de capitalização, correção e sugestões. Os XMLs foram validados.
A versão 0.1.0 passou em compilação Android e testes no GitHub Actions.
A versão atual deve ser conferida na execução de Actions correspondente.
Ainda não há validação de aparência ou interação em aparelho/emulador.
Não considerar pronto para uso diário. A compatibilidade com o Nothing Phone (1)
deve ser confirmada instalando e testando o APK.

- Layout móvel brasileiro QWERTY com Ç e acentos ao manter letras pressionadas.
  É inspirado no ABNT2, sem afirmar conformidade com uma norma de teclado físico.
- Maiúscula no início e após `.`, `?`, `!` e nova linha; Shift e Caps Lock.
- Linha de números, símbolos, altura ajustável e vibração opcional.
- Sugestões locais por prefixo e autocorreção conservadora de uma lista pequena.
- Backspace imediatamente após uma autocorreção desfaz a substituição.
- Sem sugestões e correções em campos identificados como senha, e-mail e URL.
- Sem acesso à internet, persistência de textos ou coleta de dados.

A lista inicial **não equivale a um corretor completo**. Ainda faltam um dicionário
amplo, tratamento de abreviações/números na capitalização, digitação por gestos,
catálogo completo de emojis, histórico de área de transferência e IA. O teclado ainda não contém modelo de IA.

## Gerar APK no GitHub

1. Mantenha o repositório privado e envie estes arquivos à branch `main`.
2. Abra **Actions → Gerar APK de teste** e aguarde a execução.
3. Se todos os testes e a compilação passarem, baixe o artefato
   **teclado-br-apk-teste** e extraia `app-debug.apk`.
4. Transfira o APK para o Nothing, instale e abra **Teclado BR**.
5. Use os botões **Ativar teclado** e **Escolher teclado** no aplicativo.

O workflow usa assinatura de depuração gerada no runner. Builds diferentes podem
exigir desinstalar o APK anterior; uma chave persistente privada será necessária
antes de distribuir atualizações regulares. Não publique chaves no repositório.
Em um repositório privado, execuções usam a franquia de Actions da conta.

## Desenvolvimento

Android Studio com JDK 17, SDK 35 e Gradle 8.11.1. Abra esta pasta como projeto.
No terminal com essas ferramentas instaladas:

```sh
gradle testDebugUnitTest assembleDebug
```

O workflow instala o Gradle; o projeto ainda não inclui Gradle Wrapper.
Validação manual necessária: ver [docs/TESTES.md](docs/TESTES.md).

## Próximos passos

1. Compilar e testar teclado, acentos, orientação e tamanho no Nothing Phone (1).
2. Ampliar o corretor português e calibrar áreas de toque sem aumentar erros.
3. Integrar IA para correção de frases, reescrita e tradução, com prévia antes de substituir texto.
   Avaliar modelo local, licença, memória e desempenho no aparelho antes de escolher a implementação.

Projeto privado em desenvolvimento. Sem licença pública de reutilização nesta etapa.
