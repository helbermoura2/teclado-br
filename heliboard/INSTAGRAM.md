# Sugestões em campos do Instagram — 0.8.1

Correção de compatibilidade para com.instagram.android: em campos de texto
normal, mensagem curta/longa ou edição web, remove apenas NO_SUGGESTIONS no
InputAttributes interno do teclado. Não modifica EditorInfo do app, não força
preferências do usuário e preserva IME_FLAG_NO_PERSONALIZED_LEARNING. Senhas,
URLs, e-mail, filtro, campos numéricos e demais aplicativos ficam intactos.
Ao digitar com sugestões habilitadas e barra automática, volta às palavras
imediatamente, mesmo antes de chegar o resultado do dicionário.

A captura do usuário mostra atalhos durante digitação, mas não fornece os flags
reais da versão do Instagram instalada. Esta é uma correção direcionada ao
caminho compatível com o sintoma, não um diagnóstico confirmado no aparelho.
Validação usa EditorInfo sintético e um editor real isolado: verifica as flags,
a privacidade e a sugestão visível “você” para “voce”, com inserção por toque.
Não acessa Instagram, conta ou conversas. Confirmar a DM no Nothing Phone após
instalar a atualização por cima, preservando dados e modelo importado.

## Referências da base

O upstream documenta o mesmo sintoma em [#2777](https://github.com/HeliBorg/HeliBoard/issues/2777)
e [#2201](https://github.com/HeliBorg/HeliBoard/issues/2201), indicando “Always show
suggestions” como contorno. O ajuste desta variante trata o opt-out de sugestões
somente nos tipos de prosa do Instagram, preservando a configuração dos demais apps.

## Validação e distribuição

Compilação, assinatura anterior e sete fases de interação Android aprovadas no
[run 41901947366](https://github.com/helbermoura2/teclado-br/actions/runs/41901947366),
commit `9f6bcffb4afec6a63f34d2d33a52e97d3dab0a72`.
O teste verificou flags de prosa, exclusão de campos especiais, preservação de
no-learning e sugestão visível com inserção por toque em editor isolado.
Regressões de digitação, dicionário/aprendizagem, pins e IA também passaram.
A DM real continua dependendo da confirmação no aparelho.

[Versão privada com APK, fontes e diagnóstico](https://github.com/helbermoura2/teclado-br/releases/tag/heli-0.8.1).
APK SHA-256: `f6d19dbb59aace6814e664aa37379051b81a522262b4f4dde3d6c6e6f3422989`.
Certificado: `b758875ca8380d3b2ba0aa7b2b34a17f785aac3d0c4d1874674266a8877e9d45`.

A cota de artefatos do Actions estava esgotada. Compilação e interação agora
compartilham os arquivos no mesmo runner; uploads de artefatos são opcionais.
Após conferir a assinatura, APK/fontes/relatórios são preservados e os arquivos
temporários do compilador são removidos para liberar espaço ao emulador.
A distribuição verificada fica em Release privada, independente daquela cota.
