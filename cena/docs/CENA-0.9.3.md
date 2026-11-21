# CENA 0.9.3

Exibe a avaliação dos usuários do IMDb junto ao nome dos filmes e séries no catálogo, busca, sugestões, acompanhamento de séries e detalhes. Valores ausentes aparecem como IMDb —, sem inventar zero nem substituir pela nota pessoal do Story.

As notas públicas são fornecidas pelo Cinemeta e podem diferir temporariamente do IMDb. Validação por ID IMDb e tipo, consultas apenas para os itens visíveis, até duas simultâneas, cache local de sete dias (ausentes: um dia). Falhas de rede não apagam notas válidas em cache. A atualização das notas não recria os cards nem muda a posição da lista.

Mantém as correções de leitura do GGUF e seleção temática da 0.9.2. Instale por cima da versão atual para preservar listas e conexões.

Pacote para celulares ARM64: remove as arquiteturas de emulador e outras versões de bibliotecas nativas, além de símbolos de depuração desnecessários do motor local. O teste nativo usa o mesmo código compilado para x86_64 em pacote separado. O Gemma selecionado pelo usuário permanece fora do APK.
