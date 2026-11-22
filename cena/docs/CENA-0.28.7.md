# CENA IA 0.28.7

Reconhecimento pelo título da capa, separando elenco, prêmios e publicidade.

- A leitura local preserva as posições e tamanhos do texto e dá prioridade ao bloco principal, incluindo títulos numéricos como 1917.
- O Gemini v3 transcreve e separa título, subtítulo, elenco, premiação, frases e outros textos antes de sugerir o filme.
- Nomes de atores e palavras da sinopse não são mais cadastrados como títulos alternativos. Uma busca que retorna um único filme também não basta para inventar um nome alternativo.
- A tela mostra o título lido e, quando disponível, os demais textos por categoria.
- A validação por títulos oficiais, identidade IMDb/TMDB e nomes brasileiros permanece ativa.

Validação: 161 testes JavaScript, navegador com respostas privadas simuladas, nove testes Android com OCR real de layouts de título/elenco e título numérico/premiação e regressões das fotos de reconhecimento anteriores. A publicação também verifica o conteúdo e a assinatura dos APKs.

IMPORTANTE: para ativar a classificação semântica completa do Gemini, atualize o Worker existente cena-ia na Cloudflare com o código em https://github.com/helbermoura2/cena-downloads/blob/main/cloudflare/cena-ia-worker.js . Substitua todo o código e publique com Deploy. Mantenha GEMINI_API_KEY, CENA_AI_ACCESS_TOKEN e GEMINI_MODEL como estão. Não é necessária outra chave de IA.

A verificação em https://cena-ia.terrestre.workers.dev/ deve mostrar version 3 e semanticReading true após essa publicação. O aplicativo mantém compatibilidade com o serviço anterior e já aplica as correções locais.
