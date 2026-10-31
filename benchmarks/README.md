# Comparação preliminar de modelos para o Teclado BR

Dez pedidos sintéticos idênticos: correção gramatical/ortográfica, texto já correto,
tom profissional, recusa educada, composição por prompt, resumo com incerteza,
tradução idiomática, texto com instrução embutida e emojis com restrição de quantidade.
As respostas devem ser avaliadas em português brasileiro, preservando números,
prazos, negações e sentido. Não há nota automática que substitua leitura das respostas.

Configuração: llama.cpp b6500 (binário com SHA-256 verificado), GGUF Q4_K_M,
CPU Linux com 2 threads, contexto de 2.048 tokens, temperatura 0, seed 42,
limite de 180 tokens por resposta e template de conversa do próprio modelo.
Qwen3 recebe `enable_thinking: false` no template; raciocínio retornado é registrado.
Quando o repositório oficial disponibiliza apenas Q8_0, o script converte para
Q4_K_M e registra o hash de entrada e de saída. Isso não equivale a uma quantização
a partir do modelo original em ponto flutuante.

As revisões do Hugging Face e hashes dos modelos ficam nos resultados. Os arquivos
são baixados de repositórios públicos, sem token; modelos que exigirem autorização
ou que não ofereçam o formato solicitado serão registrados como indisponíveis.

**Esses testes não medem desempenho no Nothing Phone (1).** Os tempos e a memória
são do runner Linux. Não validam aceleração Android, bateria, temperatura, licença
para distribuição, memória total do aplicativo nem a precisão da lupa/OCR.
A inferência é local ao runner após baixar os pesos: não usa API de geração remota.
Só são usados textos sintéticos do arquivo cases.json, nunca textos do usuário.

Executar pelo workflow `Comparar modelos offline em português`. Resultados brutos,
logs, saídas, tempos, consumo e informações de hardware ficam em artefatos privados.
Uma execução e dez casos por modelo são uma triagem, não uma avaliação estatística.
