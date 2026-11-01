# Disposição 0.6.3

Layout brasileiro com fileira A–L de nove teclas centralizada, sem Ç dedicado.
Ç/ç permanece no popup nativo do C para PT-BR, selecionável ao segurar e deslizar.
Tecla nativa de emoji logo depois de 123. Globo de idiomas preservado.
A migração ativa emoji uma única vez, sem apagar pins, idiomas ou tema.
O tema escuro da 0.6.2 permanece. IA, prompt e lupa ainda não integrados.

## Validação

Commit `2562d20bceb421b1f6ca672ade261da48ff5e341`, [run 41254195027](https://github.com/helbermoura2/teclado-br/actions/runs/41254195027), tentativa 2 aprovada.
142 testes unitários sem falhas. Interação Android 35: fileira centralizada,
emoji depois de 123, Ç pelo popup do C, 200 caracteres com toques sobrepostos,
correção, maiúsculas, idiomas e pins aprovados. Pin preservado após envelhecimento
simulado de 30 dias e reinstalação/reinício do processo. A primeira tentativa
parou ao reabrir a janela do teclado no emulador; a repetição usou o mesmo APK.
Captura da disposição conferida na primeira tentativa. Validação em emulador,
sem medição de desempenho no Nothing Phone (1).

APK SHA-256: `74ebcb3ec3dbc1d5832fbea52c76c8cbf514fc7277b2e021a5f6794d1b76a413`.
Fontes SHA-256: `39e888a2465f9971bc7a647b71d3e6416b0b256ce812378625fe7e3e63eabd7b`.
Assinatura igual à 0.6.2: instalar como atualização, sem desinstalar.
