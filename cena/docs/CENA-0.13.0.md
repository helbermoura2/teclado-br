# CENA 0.13.0 — sua memória de cinema

Catálogo e preferências passam a usar um banco SQLite privado no Android. A leitura inicial migra os dados legados, mantendo a cópia anterior; as atualizações do catálogo e a restauração em lote usam transações. Credenciais continuam nas estruturas de autenticação anteriores e não são exportadas.

Perfil ganha backup JSON com prévia e restauração por mesclagem: catálogo, notas, listas, feedback, ocultações e histórico disponível. Dados atuais prevalecem em conflitos. O histórico restaurado fica consultável por ano numa área própria, sem atribuí-lo à conta Trakt ativa nem enviá-lo ao player. Credenciais e modelos de IA não entram no arquivo. Limite de 24 MB por arquivo e 20 mil títulos na união.

Minhas listas pessoais no Catálogo e no detalhe de cada título. Listas guardam referências e metadados dos títulos; adicionar a uma lista pessoal não altera automaticamente Quero assistir no Trakt. Gostei reforça as próximas recomendações; Não combina e Já assisti retiram títulos das sugestões. Filmes podem ser marcados como assistidos; séries continuam exigindo progresso por episódios. Temas identificados e elenco passam a ter justificativas mais específicas.

Detalhes com fundo da arte, sinopse expansível, ações de avaliar/compartilhar e organização em listas. Editor de Stories separado em módulo próprio, com o fluxo existente preservado. Descobrir usa cards maiores em duas colunas no celular e uma explicação inicial mais curta.

Calendário exibe somente datas recebidas na consulta de episódios do Trakt: próximos 90 dias e lançamentos dos últimos 30 dias. Datas ausentes não são inferidas. Se Nuvio for a fonte dos assistidos, o calendário não confirma se aquele episódio foi visto. Perfil ganha retrospectiva anual em PNG 1080×1920 com filmes, séries, episódios, reproduções e tempo estimado; usa o histórico disponível por ano de visualização.

Conectar passa a apresentar estado, última conclusão, pendências e falhas de cada fonte. Ausência de dados não é anunciada como sincronização bem-sucedida.

Modelo visual CLIP separado do APK: download opcional de cerca de 89 MB em Conectar, com progresso, cancelamento e verificação de tamanho/SHA-256. Pesos públicos com licença MIT e revisão fixada. OCR funciona sem o download; fotos não são enviadas. Modelos já copiados por versões anteriores podem ser reaproveitados. O GGUF opcional do usuário continua fora do APK. QA Android usa os mesmos pesos como fixture embarcada, enquanto o pacote de entrega é verificado sem os pesos.

Instale por cima da versão atual, sem desinstalar. Mantém conexões, biblioteca, histórico e assinatura de atualização.
