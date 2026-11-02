# CENA 0.11.0 — histórico por ano

Importa os registros individuais de filmes e episódios da conta Trakt autorizada, percorrendo as páginas de /sync/history sem filtro por data. Usa watched_at, preserva o ID de cada reprodução como texto (inclusive IDs de 64 bits) e mantém revisitas como eventos separados. Datas inválidas ou ausentes ficam como Data desconhecida; nunca usa o ano de lançamento ou o dia da importação como data de visualização.

Área Meu perfil no topo do CENA, mantendo os cinco botões inferiores: Histórico e Estatísticas, filtros por ano e tipo, navegação paginada e exportação JSON. Estatísticas distinguem títulos diferentes de reproduções e séries acompanhadas de episódios diferentes; o tempo é estimado pelas durações disponíveis, sem afirmar tempo real de tela. Os detalhes e cards dos títulos já no catálogo ganham os anos encontrados por correspondência exata de IMDb e tipo. Títulos fora do catálogo continuam acessíveis no histórico, sem alterar a lista Quero assistir.

Cópia local SQLite, separada por conta. Importações usam área de preparação e só publicam o lote completo após validar as páginas e a atividade da conta. Erros preservam a cópia anterior. Reimportar atualiza os mesmos IDs sem duplicá-los; registros locais já importados não são apagados automaticamente se deixarem de ser retornados. Uma verificação de quantidade sinaliza cobertura parcial ou não confirmada quando não corresponde aos totais informados pelo Trakt. O histórico só contém o que foi efetivamente disponibilizado pela API, não permite recuperar visualizações nunca registradas.

A primeira importação começa no aparelho com o Trakt já conectado, também disponível no botão Importar / atualizar Trakt. Atualização em segundo plano programada a cada 12 horas, sujeita às restrições do Android. As datas são agrupadas no fuso do aparelho.

A conta e os dados reais do usuário não foram acessados no ambiente de desenvolvimento: tokens continuam somente no Android Keystore. Testes usam históricos simulados com múltiplas páginas, falha intermediária, revisitas, datas inválidas, virada de ano, troca de conta e IDs grandes.

Instale por cima da versão atual. Mantém a conexão Nuvio experimental, notas IMDb e pacote ARM64 enxuto. A importação não escreve eventos nem altera bibliotecas no Trakt ou Nuvio.
