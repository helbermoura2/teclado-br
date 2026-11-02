CENA IA 0.7.2 — rolagem estável e recuperação de capas brasileiras.

Instale sobre a 0.7.1, sem desinstalar.

- A atualização em segundo plano do Trakt deixou de chamar a navegação que voltava ao topo. Mudanças apenas de sincronização não recriam a lista.
- Quando filmes realmente mudam, o catálogo atualiza os cards existentes, preserva as imagens já carregadas, o filtro, o texto da busca, os resultados e a posição do card visível. Abrir/fechar os detalhes não reinicia a navegação.
- Capas ainda são carregadas conforme entram na área visível. Tarefas enfileiradas para cards que saíram da tela deixam de atrasar os que você está vendo.
- Novas tentativas pelo catálogo de busca e pela Wikipédia, com validação do IMDb exato e de imagem em formato de pôster, para recuperar títulos cujas fontes anteriores falharam. Não usa foto de ator só por compartilhar o nome.
- Fontes públicas verificadas para O Sequestro do Voo 375 (2023, tt13073252) e 45 do Segundo Tempo (2022, tt8646254).
- Contador Capas salvas e avisos Buscando capa/Capa indisponível distinguem uma tarefa pendente de uma imagem que não foi encontrada. O contador representa URLs salvas; as demais são verificadas ao rolar. Nenhum filme é removido por falta de capa.

Validação: 50 testes locais; regressão de rolagem com 110 filmes e atualização real da lista simulada, mantendo o mesmo card e elemento de imagem; carregamento de nove capas reais, incluindo os dois filmes brasileiros; consulta e download das duas capas regionais; atualização Android assinada sobre a 0.7.1 e testes nativos existentes.

Não há garantia de imagem disponível para todo título: indisponibilidade de origem ou rede continua sendo sinalizada, sem inventar uma capa.
