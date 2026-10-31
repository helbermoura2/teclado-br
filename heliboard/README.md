# Teclado BR — teste com base HeliBoard

Base: HeliBorg/HeliBoard v3.6 (SDK 35; a v4.2 exige SDK 37 indisponível no ambiente), fixada no commit de upstream.json.
Variante experimental 0.6.1-heli3.6, pacote br.com.tecladobr.heli.debug.
Instala separadamente do Teclado BR anterior e do HeliBoard oficial.

A base 0.6.0 passou em compilação, 142 testes unitários e interação no Android 15.
A 0.6.1 passou nos testes de idiomas, pins e persistência em emulador.
As mudanças 0.6.1 estão descritas em [IDIOMAS-E-PINS.md](IDIOMAS-E-PINS.md).
Resultados e limites em [VALIDACAO.md](VALIDACAO.md).
No Nothing, ativar e selecionar **Teclado BR · Heli teste** nas configurações do Android.

Mudanças locais, 31/10/2026 (desenvolvimento assistido por IA):
- Perfil inicial PT-BR e layout QWERTY com Ç; números, tema escuro e teclas com bordas.
- Correção, sugestões e maiúsculas do motor original, sem reimplementar digitação.
- Barra expansível do HeliBoard com seleção, copiar, recortar, colar, cursores e desfazer/refazer.
- Dicionários PT-BR e en-US incluídos; outros podem ser importados nas configurações.
- Contatos e nomes de apps desligados no perfil inicial.
- Somente ABIs arm64-v8a (Nothing Phone 1) e x86_64 (emulador).
- Editor e instrumentação de teste adicionados somente à variante debugNoMinify.

Esta etapa avalia a base de digitação. Ainda NÃO contém IA generativa, prompt,
revisão gramatical por IA ou lupa tradutora. A Gemma 4 E2B permanece obrigatória
na avaliação final de IA offline no Nothing Phone (1). Avaliar memória, tempo de
resposta, qualidade em PT-BR e impacto na digitação antes de adotá-la.
O assistente e a lupa da versão antiga precisarão ser portados para esta base.
Digitação por deslizar entre letras depende de biblioteca opcional do upstream;
nenhuma biblioteca proprietária foi adicionada. Os gestos de subteclas já são nativos.

## Compilar

1. Baixar o commit exato de upstream.json para uma pasta limpa.
2. Executar `python3 heliboard/prepare.py /caminho/HeliBoard` a partir do repositório Teclado BR.
3. No HeliBoard preparado: `./gradlew --no-daemon testRunTestsUnitTest assembleDebugNoMinify`.
   JDK 17, SDK 35 e NDK 28.0.13004108; Gradle Wrapper do upstream.
4. O workflow heliboard.yml também testa o APK em Android 15 AOSP.

As fontes entregues em tar.gz já estão preparadas; basta executar o comando Gradle
do passo 3 dentro da pasta extraída, sem reaplicar prepare.py.

## Licença e origem

Variante derivada do HeliBoard/OpenBoard/AOSP, distribuída sob GPL-3.0-only.
Preservar LICENSE, LICENSE-Apache-2.0, LICENSE-CC-BY-SA-4.0 e os avisos originais.
O ícone do upstream permanece sob CC BY-SA 4.0 e seus autores estão no README
original. O nome distingue esta variante do HeliBoard oficial.
O código-fonte completo correspondente é entregue no mesmo conjunto de artefatos
do APK (teclado-br-heli-fontes.tar.gz). O repositório privado não altera os direitos
concedidos aos destinatários pela GPL. Não há contribuição ou mensagem enviada
aos mantenedores do upstream.
