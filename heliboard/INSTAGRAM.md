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
