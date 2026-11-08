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
