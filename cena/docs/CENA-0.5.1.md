CENA IA 0.5.1 — recuperação das capas.

Instale sobre a 0.5.0, sem desinstalar nem desconectar o Trakt.

- Os títulos importados do Trakt buscam capas pelo IMDb e tipo do conteúdo, sem depender de refazer a busca pelo nome.
- Busca automática das imagens dos títulos visíveis, com no máximo duas tarefas simultâneas.
- Guarda a URL validada da capa junto aos filmes já salvos e em um cache independente de imagens.
- Recupera imagens quebradas usando o catálogo e uma fonte alternativa. A exibição comum da capa não exige CORS; a exportação de Stories continua usando seu carregamento separado.
- No catálogo, Atualizar capas tenta novamente os espaços ainda sem imagem. Nada é removido da lista quando uma imagem não existe ou a rede está indisponível.

A conexão Trakt, sua fila, histórico e lista são preservados. Nem todos os títulos têm imagens disponíveis: nesse caso, o nome continua visível.
