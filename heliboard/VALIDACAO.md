# Validação da base HeliBoard — 0.6.0

- Upstream: HeliBorg/HeliBoard v3.6, commit f8ec91a982835911cc224fa99434c3396d4cd562.
- Variante: Teclado BR · Heli teste, pacote br.com.tecladobr.heli.debug.
- Código da adaptação testado: 6ca11ea0848d28671e7c5da915390663fcde52ae.
- Execução: https://github.com/helbermoura2/teclado-br/actions/runs/41227695896.

Compilação arm64-v8a e x86_64 aprovada. Os 142 testes da variante de CI do
upstream (`testRunTestsUnitTest`) passaram, com zero falhas e zero testes marcados
como ignorados no relatório. Essa variante tem os filtros de teste do upstream;
não representa todos os cenários de todos os aplicativos Android.

## Interação real no Android 15 AOSP

A automação injeta eventos de toque; o editor fica em outro processo e o texto
final é comparado por acessibilidade. Resultado: PASS.

- Layout brasileiro com tecla Ç e linha numérica.
- 200 caracteres `er` em pares com dedos sobrepostos, alternando a ordem de soltura:
  texto completo e na ordem esperada. A injeção levou 36.956 ms, incluindo custo do
  emulador e do UiAutomation. Isso não mede latência nem velocidade máxima no telefone.
- Selecionar tudo selecionou os 200 caracteres. Copiar preservou o texto exato na
  área de transferência e Colar restaurou o texto integral após limpar o campo.
- Ao digitar `voce`, a faixa mostrou `[vice, você, vive]`.
- Manter E, deslizar até ê e soltar inseriu apenas `ê`, sem segundo toque.
- Digitar `bom. dia ` produziu `Bom. Dia `.
- Digitar `voce ` com correção e maiúsculas ativadas produziu `Você `.

Capturas foram inspecionadas. Alguns quadros do emulador têm áreas ainda não
compostas; as comparações de texto e seleção são as verificações automáticas.
Tela de teste: 540×1170 / 220 dpi. A fluidez e ergonomia no Nothing Phone (1),
as mudanças de orientação e a integração com outros aplicativos continuam para
validação no aparelho.

O HeliBoard pode mostrar uma prévia de texto copiado na barra, com X para dispensar.
Essa prévia é distinta das sugestões de palavras; o comportamento é configurável
nas opções de área de transferência do HeliBoard.

## Entrega e reprodução

O APK e as fontes correspondentes vêm da mesma execução. O arquivo de fontes já
contém a adaptação aplicada: extraia e execute `./gradlew --no-daemon
testRunTestsUnitTest assembleDebugNoMinify` usando JDK 17, SDK 35 e NDK 28.0.13004108.
Não reaplique prepare.py sobre essas fontes já preparadas. Para partir de um clone
limpo, use o commit do upstream e as instruções do README da adaptação.

SHA-256 do APK:
607cd4325a4ad0b44c595b3b3d5e40ceb4ce0915d96339f9ca735204a1810f81

SHA-256 das fontes tar.gz:
16a9968da910962e1d0588c38cce917879b55c3330329b862746520121df6a9b

## Requisitos que permanecem

Esta entrega testa a base de digitação. Não contém IA generativa nem modelo.
Gemma 4 E2B permanece no teste final offline do Nothing Phone (1), com medição de
memória, tempo de resposta, qualidade em português e impacto na digitação.
Prompt no Compositor, revisão por IA, estilos e lupa tradutora ainda precisam ser
integrados à nova base; nenhum resultado foi simulado nesta versão.
