# Teclado BR 0.9.2 beta 4 — IA em primeiro, prancheta com edição por toque longo

A versão 0.9.1 passou na compilação, Robolectric e emulador Android 15 e foi publicada.
Esta revisão prepara o próximo APK; o visual na tela real ainda precisa de validação.

- Modo compacto: favoritos circulares em ordem IA, prancheta, emoji, tradução e ajustes; botão ⋯ à DIREITA mantém a barra HeliBoard expandida.
- Toque normal na prancheta preserva o histórico; toque longo abre faixa dedicada Selecionar tudo, Copiar, Recortar, Colar, Desfazer, Refazer com botão Voltar.
- Tradução é um atalho próprio, que abre diretamente a tela de idiomas do painel de IA já existente.
- O botão + é o comando de adicionar palavra ao dicionário pessoal. Foi movido para o menu ⋯, sem perder clique ou acessibilidade.
- Durante digitação, os favoritos somem temporariamente para que as três sugestões não fiquem truncadas.
- Sem texto, voltam os favoritos; durante seleção, prevalecem os comandos contextuais.
- No menu extra, Selecionar tudo, Copiar, Recortar, Colar, Desfazer, Refazer e setas continuam ativos.
- Seleção de texto: favoritos se tornam temporariamente Selecionar tudo, Copiar, Recortar e Colar; ao desfazer a seleção, os favoritos retornam.
- O botão ⋯ abre/fecha os comandos. Não depende de rede ou IA.
- Migração da preferência compacta da 0.9.1 usa a lista original salva, sem apagar dados.
- Ao desligar o compacto, restaura configuração anterior dos favoritos, atalhos, modo e exibição automática.
- Pontinhos inferiores do HeliBoard são omitidos apenas no visual One UI para não gerar fragmentos brancos. O toque longo continua funcionando.
- O indicador de mais sugestões sob a palavra central também é ocultado apenas no modo compacto, preservando o acesso a candidatos adicionais por gesto/toque longo.
- Ainda é necessário executar a validação manual antes de integrar/publicar.

---

# Teclado BR 0.9.1 — Refinamento visual opcional

## Origem

Em 8 de novembro de 2026, captura real do Nothing Phone (1) mostrou que
a versão 0.9.0, mesmo com a paleta escura, mantinha quase todo o desenho
nativo do HeliBoard: teclas pouco arredondadas, fonte estreita, símbolos
grandes e muitos atalhos na faixa superior.

A **versão 0.9.1 é uma proposta em desenvolvimento, ainda sem APK validado**.

## Alterações no código

- **Teclas da área principal com novo desenho:** `heliboard/patches/visual.py`
  instrumenta `KeyboardView.java` da versão upstream fixada para desenhar
  tecla arredondada (raio proporcional, até 11 dp), leve espaçamento interno,
  contorno fino, distinção entre teclas de ação e teclas comuns e realce
  de toque. Só quando o tema visual One UI está ativo.
- **Fonte de aspecto mais próximo ao Samsung:** usa `sans-serif` nativa
  em vez do padrão estreito `sans-serif-condensed`; se o usuário escolheu
  uma fonte personalizada, ela continua tendo prioridade.
- **Símbolos secundários mais discretos:** reduz em 17% o texto de dicas
  e dos pequenos símbolos nos cantos apenas no tema inspirado na One UI.
- **Barra compacta opcional e reversível:** novo interruptor em
  **Aparência do teclado** para destacar IA, prancheta, emoji, configurações
  e idioma. O restante dos atalhos é temporariamente ocultado. A lista
  anterior de atalhos permanece guardada exatamente e retorna ao desligar
  a opção. Histórico e itens fixados da prancheta não são apagados.
- **Tema clássico intacto:** a forma anterior de desenhar fica ativa
  quando `teclado_br_one_ui_active=false`. Não mudamos área de toque,
  sugestões, modelos locais, o acesso opcional Groq ou suas credenciais.

## Como ativar depois que o APK 0.9.1 for aprovado e lançado

1. Instale por cima da 0.9.0, sem desinstalar.
2. No teclado, entre em **IA → configurações → Aparência do teclado**.
3. Ative **Estilo One UI 8.5** e, se quiser menos ícones, **Barra compacta**.
4. Toque em **Aplicar ajustes** e reabra o teclado.
5. Para restaurar os atalhos anteriores, desative **Barra compacta**;
   para voltar completamente ao tema antigo, desligue também o tema One UI.

O painel escuro de IA e sua tradução continuam os da 0.9.0.
Esta implementação **não inclui Galaxy AI da Samsung, nem arquivos Samsung**.

## Correção da instabilidade Robolectric (8 de novembro de 2026)

A execução [#42492505003](https://github.com/helbermoura2/teclado-br/actions/runs/42492505003)
não alcançou o emulador. O build compilou o código, mas 137 dos 146
testes JVM falharam com `MavenArtifactFetcher.java:129` e uma
`IOException` ao baixar o Android SDK de testes pela rede. É uma
falha coletiva de obtenção do runtime do Robolectric, **não uma reprovação
das mudanças visuais**. A falha anterior no emulador (`One UI theme was
not saved`) continua aguardando novo teste com a correção dos cliques.

- O `prepare.py` agora aponta o resolvedor de runtime Robolectric para
  `https://repo.maven.apache.org/maven2`, configuração oficial suportada
  pelo Robolectric 4.14.1.
- `heliboard/ci/preload-robolectric.sh` baixa antecipadamente o JAR
  Android 15 exato (`15-robolectric-12650502-i7`) e seu POM. Usa
  retries HTTP, verifica SHA-512 de cada arquivo e armazena em
  `~/.m2/repository`, localização nativa do Robolectric.
- Os workflows de **prévia** e **publicação** reutilizam esse runtime com
  `actions/cache`. Se a rede estiver indisponível, falham cedo, antes
  de compilar a IA e inicializar o emulador.
- Não relaxamos, ignoramos ou excluímos nenhum teste unitário.
  Os builds permanecem **somente manuais** para evitar esgotar os minutos
  privados restantes. O PR não pode ser integrado até a próxima
  validação Android passar.

Referência técnica: https://robolectric.org/blog/2023/11/11/improving-android-all-downloading/

## Testes e custos

- O teste Android `HybridTrial.java` foi estendido para verificar que
  o tema e a barra compacta podem ser ativados e que os atalhos anteriores
  são recuperados com exatidão ao voltar para o tema clássico.
- O código de `visual.py` verifica todos os pontos da versão upstream
  antes de aplicar mudanças; se a fonte upstream mudar, falha em vez de
  substituir trechos ambíguos.
- As capturas do emulador e o desempenho no Nothing Phone (1) ainda
  precisam ser validados. Não há garantia de fidelidade pixel a pixel.
- **GitHub Actions da conta está perto da franquia mensal.** Os workflows
  de HeliBoard e prévia foram colocados em modo somente manual. O PR não
  dispara compilação; solicitar um teste manual somente após aprovação,
  verificando antes o saldo em GitHub Billing.
- `versionCode 9001` e versão `0.9.1-heli3.6` garantem que o futuro APK
  poderá substituir a 0.9.0 sem apagar os dados, desde que a assinatura
  oficial do teclado seja mantida e verificada.

Estado atual: **apenas código proposto**, sem merge, compilação certificada,
APK ou nova Release.
