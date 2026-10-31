# Visual escuro inspirado no teclado Samsung — 0.6.2

Referências fornecidas pelo usuário: teclas cinza altas, texto estreito, símbolos
secundários discretos, fundo preto e Enter escuro com ícone branco.

A adaptação usa o sistema de cores do HeliBoard, com um tema editável chamado
Teclado BR · escuro. Uma migração aplica esse tema à instalação existente sem
alterar idiomas ou dados de clipboard/pins. Altura de retrato em 110%, cantos em
7 dp, espaçamentos visuais menores e fonte Android sans-serif-condensed.
Enter e teclas funcionais escuros, espaço cinza, Shift ativo e pins com azul discreto.
A fonte escolhida pelo usuário nas configurações continua tendo prioridade.
A altura em paisagem é preservada.

Não há código, fontes ou imagens extraídos da Samsung. É uma aproximação visual
sobre o motor HeliBoard, preservando o layout brasileiro com Ç, o globo e a
prancheta. Os símbolos continuam usando os atalhos nativos do HeliBoard.

Assinatura de teste igual à 0.6.1: atualização por cima deve preservar os dados.
Usuários que ainda estejam na 0.6.0 precisam seguir IDIOMAS-E-PINS.md para o backup
e a reinstalação únicos, por causa da assinatura antiga.

Gemma 4 E2B segue prevista para o teste final offline; IA, prompt e lupa continuam
pendentes de integração e não fazem parte desta mudança visual.

## Validação da versão entregue

Build e interação Android 35 aprovados no [run 41240289013](https://github.com/helbermoura2/teclado-br/actions/runs/41240289013),
commit `eb9e54735d01591dd70c60fc9b9fe10403b225b2`.
142 testes unitários, sem falhas. Testes de 200 caracteres com toques sobrepostos,
seleção/cópia/cola, acento ao deslizar e soltar, maiúscula após ponto, autocorreção,
globo PT-BR/EN e pins passaram. O pin resistiu ao envelhecimento simulado de
30 dias e à reinstalação do mesmo APK com reinício do processo.
Captura `07-inicio-maiusculas.png` conferida visualmente. Os testes foram feitos
em emulador; a aparência e o conforto final no Nothing Phone (1) ainda dependem
do teste no aparelho.

SHA-256 do APK: `131dcbde0c490756565917b2c1361669672894e400dafa84cba3c98bf78587e9`.
SHA-256 das fontes: `8b2d630c575c23579de2ead52a057cfd2d30ffb7ac78e6a94276b9f482853e31`.
Certificado do APK verificado, igual à versão 0.6.1.
