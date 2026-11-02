# Teclado BR — HeliBoard com assistente offline

Variante 0.7.3-heli3.6, pacote br.com.tecladobr.heli.debug, base HeliBorg/HeliBoard
v3.6 fixada em upstream.json. Android mínimo 8 (API 26); Nothing Phone (1) usa arm64-v8a.
Atualiza as versões 0.6.1–0.7.0 com a mesma assinatura de teste, preservando pins,
idiomas e dicionário pessoal. O HeliBoard oficial e o aplicativo original 0.1–0.5
continuam separados.

Os símbolos secundários nos cantos das teclas usam 32% da altura da tecla
(antes 16%) e cor mais clara no tema Teclado BR escuro. A migração atualiza
somente a cor desses símbolos, preservando as outras cores e preferências.

O botão ＋ junto às sugestões salva a palavra do campo de texto no dicionário.
Aprendizado de palavras recorrentes e próxima palavra usa o motor local nativo.
Detalhes: [PERSONALIZACAO.md](PERSONALIZACAO.md).

Mantém PT-BR e en-US, fileira A–L centralizada, Ç ao segurar C, espaço imediato
após pontuação e sugestões/aprendizado nativos. Idiomas e emoji estão na barra.
O botão de brilho abre um painel dentro da área das teclas, mantendo o aplicativo
visível acima: revisão, Compositor com prompt, cinco estilos, resumo, marcadores,
tabela e tradução de texto. A revisão oferece Editar, Copiar e Substituir.
O prompt é digitado com as teclas nativas, sem alterar a mensagem original.
A inferência roda em processo separado; a engrenagem abre somente as configurações
do modelo. Modelos já importados na 0.7.0 permanecem no mesmo diretório privado.
O modelo GGUF deve ser baixado pelo navegador e importado uma vez. O APK não
inclui pesos e não tem permissão INTERNET; a geração ocorre no aparelho.
Detalhes, modelos e limites em [ai/README.md](ai/README.md).

A lupa sobre frases em outros aplicativos ainda não foi integrada. A Gemma 4
E2B permanece no comparativo final de qualidade e desempenho no Nothing Phone (1).
A execução Android com modelo pequeno valida o caminho de inferência; não mede
qualidade geral em português nem desempenho do modelo maior no telefone real.

## Compilar

JDK 17, SDK 35, NDK 28.0.13004108, CMake 3.22+ e Ninja.

1. Baixar o commit HeliBoard de upstream.json em uma pasta limpa.
2. Baixar ggml-org/llama.cpp no commit 0ec4027a2a0183de87c007069adddc06e665f7de
   para `HeliBoard/ai-native/llama.cpp`.
3. Executar `python3 heliboard/prepare.py /caminho/HeliBoard` no repositório Teclado BR.
4. Executar `bash heliboard/ai/build-native.sh /caminho/HeliBoard` para as duas ABIs.
5. Na pasta HeliBoard preparada: `./gradlew --no-daemon testRunTestsUnitTest assembleDebugNoMinify`.

O arquivo de fontes entregue já contém as árvores preparadas de HeliBoard e
llama.cpp. Dentro da pasta extraída, basta executar
`bash teclado-br-overlay/ai/build-native.sh .` e depois o comando Gradle do passo 5,
sem executar prepare.py outra vez. Pesos externos não são necessários para compilar.
O workflow heliboard.yml inclui assinatura estável, testes unitários, interação
Android 15, modelo sintético com SHA-256 fixado e inferência sem rede no emulador.

## Licenças

Derivado HeliBoard/OpenBoard/AOSP sob GPL-3.0-only, com avisos originais preservados.
Preservar LICENSE, LICENSE-Apache-2.0, LICENSE-CC-BY-SA-4.0 e créditos do upstream.
llama.cpp tem licença MIT, incluída na árvore de fontes e nos assets do APK.
O arquivo completo de fontes correspondente acompanha o APK nos artefatos da
execução. O repositório permanece privado. Modelos têm licenças próprias, consultáveis
na página escolhida pelo usuário, e não são redistribuídos dentro do APK.

## Legibilidade — 0.7.3

Símbolos secundários ampliados de 16% para 32% da altura da tecla. A cor no tema
Teclado BR escuro passa de RGB 140/140/145 para 210/210/214. Migração única que
altera somente KEY_HINT_TEXT no mapa de cores existente. A disposição, áreas de
toque e dados pessoais são preservados.

Compilação, 142 testes unitários e todas as fases de interação aprovados no
[run 41419040336](https://github.com/helbermoura2/teclado-br/actions/runs/41419040336),
commit `da4a358f821abb96f31a46cc3577d370b6262776`. Capturas 01 e 07 no Android 15
AOSP x86_64 conferidas com letras minúsculas e maiúsculas; símbolos legíveis nos
cantos, sem sobreposição observada com as letras. ARM64 também compilado.

APK SHA-256: `cf5329c9999e323b600ad6352a7303de010a96f4e5a1493585ebf3cc98d1ab75`.
Fontes SHA-256: `953719d290501a94224810d30a74fa7cb5c1e660ebc36b9eb5f72d38f5aab6ca`.
Certificado SHA-256: `b758875ca8380d3b2ba0aa7b2b34a17f785aac3d0c4d1874674266a8877e9d45`.

Assinatura verificada pelo CI e certificado v2 conferido no APK baixado. Instalar
por cima da atual, sem desinstalar, para manter modelo, dicionário e pins.

[ZIP com APK](https://github.com/helbermoura2/teclado-br/actions/runs/41419040336/artifacts/13129985267)
· [Fontes](https://github.com/helbermoura2/teclado-br/actions/runs/41419040336/artifacts/13128284930)
· [Capturas e resultados](https://github.com/helbermoura2/teclado-br/actions/runs/41419040336/artifacts/13130421414).
