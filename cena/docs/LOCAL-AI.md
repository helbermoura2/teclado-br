# IA local no Android

O GGUF é opcional. Cada detalhe oferece cinco títulos semelhantes usando os metadados públicos e uma comparação local de temas, gêneros e elenco. É independente do perfil geral da aba Descobrir.

Para usar o arquivo existente, abra Conectar → IA local → Selecionar GGUF já baixado. O seletor do Android concede acesso persistente de leitura; o arquivo permanece em Downloads. Se ele existir apenas dentro do armazenamento privado de outro aplicativo, o Android não permite que o CENA leia essa cópia: selecione o original acessível pelo seletor.

A consulta usa somente texto. Não há suporte ao mmproj de visão nesta versão. CPU com quatro threads, contexto de 2048 tokens, saída máxima de 128 tokens, timeout de 150 segundos, processo privado `:localai`. Cancelamento por geração atômica e callbacks de aborto, descarte de mensagens antigas, liberação RAII dos pesos e contexto. O processo principal nunca carrega a biblioteca JNI.

A seleção é construída com até doze candidatos reais de catálogo. A resposta deve conter exatamente cinco IDs únicos presentes nesse conjunto; qualquer outra resposta é descartada. Isso não cria dados nem amplia por si só a base de filmes. Metadados e imagens continuam sendo consultados online, sem enviar o GGUF ou o pedido a um serviço de IA.

O motor está fixado em llama.cpp b12020 / 0ec4027a2a0183de87c007069adddc06e665f7de. A licença MIT da dependência é copiada do checkout fixado e incluída em assets/licenses/llama.cpp.txt. A ponte C++ independente é MIT. Pesos GGUF não são distribuídos no APK. Testes de instrumentação executam um Qwen3 0.6B Q8_0 com checksum verificado; isso verifica a ponte, o descritor de arquivo protegido de outro UID e a execução real, não o desempenho ou a qualidade do GGUF do usuário.

0.9.2: usa dup/fdopen e llama_model_load_from_file_ptr para preservar a permissão SAF, sem reabrir o caminho do arquivo. A instrumentação usa um provider no APK de teste, cujo modelo privado não pode ser aberto por caminho pelo CENA.
