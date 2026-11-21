# CENA 0.14.0 — semelhantes pelo enredo

Os modos comum e IA local passam a usar a mesma busca orientada pelo pedido. O campo de preferência fica disponível nos dois modos. Buscar pelo enredo consulta catálogos e fontes regionais por temas e títulos relacionados, enriquece candidatos com sinopses e aplica critérios antes da classificação. Os dados consultados são públicos; a geração GGUF continua no aparelho, sem API de IA paga.

Presidente dos EUA, samurais, zumbis, assaltos, vampiros, viagem no tempo, artes marciais, espaço, máfia, sequestro de transporte, reféns, terrorismo e investigação têm evidências verificáveis na sinopse. Gêneros, exclusões como sem terror e décadas podem restringir a busca. A busca continua heurística: não interpreta perfeitamente qualquer pedido em linguagem natural nem mede objetivamente quantos minutos de ação um filme tem.

Para Air Force One, afinidade com presidente ameaçado e o enredo têm prioridade. Ator em comum, aviação ou ação genérica não bastam. Presidente de outro país num filme americano não é tratado como presidente dos EUA. Quando há apenas algumas opções elegíveis, o app mostra menos de cinco. Não preenche vagas com filmes pouco relacionados.

A IA local recebe até oito candidatos já aprovados, evidências e os critérios do pedido. Pode selecionar de um a cinco IDs distintos; a saída é novamente validada contra os candidatos e os critérios. IDs inventados ou fora do pedido são rejeitados, mantendo as opções do catálogo. A seleção do modelo continua sujeita à capacidade do GGUF escolhido.

A interface mostra critérios aplicados, trechos da sinopse usados como evidência e títulos encontrados que foram omitidos por já estarem no catálogo. Cache breve reaproveita candidatos ao alternar a opção de incluir salvos ou refinar o mesmo pedido; a seleção é recalculada com o catálogo atual.

Instale por cima da versão atual. Mantém banco local, backups, histórico, conexões, APK leve e modelo visual opcional.
