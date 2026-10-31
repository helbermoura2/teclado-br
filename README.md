# Teclado BR

Protótipo de teclado Android independente com visual inspirado no Samsung Keyboard,
destinado inicialmente a testes no Nothing Phone (1). Não é um produto Samsung.
Código próprio; não contém código ou recursos extraídos do Keyvya ou da Samsung.

## Versão 0.4.0 — ferramentas de edição

O ícone de edição na barra de atalhos abre uma linha com Selecionar tudo, Copiar,
Recortar, Colar, cursor à esquerda/direita e menu. A seta retorna à barra anterior;
ao digitar, as sugestões voltam. O menu `…` também permite abrir essas ferramentas
quando a barra está no modo de sugestões.

Copiar e Recortar só ficam ativos com seleção. Campos de senha não permitem as
ações de área de transferência. Seleção, cópia, recorte, Desfazer e Refazer usam
comandos nativos do aplicativo atual; a disponibilidade varia conforme esse app.
A função Colar usa somente o texto atual da área de transferência, sem histórico.

Compilação e testes passaram. O teste de interação no Android 15 AOSP verificou
selecionar tudo, copiar, apagar sem mudar a área de transferência, colar, recortar
e colar novamente, com comparação do texto integral. Capturas confirmaram os
estados ativado/desativado dos botões. Desfazer/Refazer, senha e aplicativos
específicos ainda precisam de validação manual no Nothing Phone (1).

## Assistente da versão 0.3.0

O botão das estrelas abre o assistente: Ortografia e gramática, Estilo de escrita,
Resumir, Marcador, Tabela e Compositor. Os estilos exibidos são Profissional,
Casual, Mídia, Educado e Com emojis.

**Ainda não há motor de IA instalado ou serviço online conectado.** A revisão
atual é uma substituição ortográfica local de palavras conhecidas, sem análise
gramatical. Uma frase como `nós vai` pode permanecer incorreta. Os estilos,
o resumo e o compositor informam que aguardam IA e não geram resultados simulados.

A revisão trabalha sobre a seleção ou o campo completo (até 6.000 caracteres).
A prévia oferece Editar, Copiar e Substituir; editar usa as teclas para acrescentar
ou apagar no fim da prévia. Só Substituir aplica o resultado, e a aplicação é
bloqueada se o texto ou a seleção tiver mudado. Campos de senha, URL e e-mail
não disponibilizam o assistente. Marcadores e tabela Markdown são formatações
locais, sem IA.

Compilação e testes unitários da versão 0.3.0 passaram. Capturas em emulador
Android 15 AOSP confirmaram menu, revisão local e estilos. A verificação visual
não testa todas as ações, nem substitui a validação no Nothing Phone (1).

## Base visual da versão 0.2.0

- Tema escuro com teclas cinza, símbolos secundários e ícones desenhados no app.
- Barra de altura fixa: atalhos ao abrir, sugestões ao digitar, seta para alternar.
- Botões para colar o texto atualmente copiado, emojis e configurações.
- IA e tradução aparecem como recursos em desenvolvimento, sem processamento simulado.
- Sugestões de próxima palavra por regras simples, além de completar palavras.

## Estado

Implementação inicial. O motor de texto foi compilado isoladamente com Java e passou
por 18 verificações de capitalização, correção e sugestões. Os XMLs foram validados.
A versão 0.2.0 passou em compilação Android e testes unitários no GitHub Actions.
Um teste de capturas em emulador Android 15 concluiu a sequência de toques;
as imagens foram inspecionadas para confirmar tema, navegação e os dois modos da barra.
Esse teste não valida automaticamente o texto final, a latência ou a qualidade do corretor.
Execução: https://github.com/helbermoura2/teclado-br/actions/runs/41175098554
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
