# Teste preliminar de IA offline para o Teclado BR

Data: 31/10/2026. Foram executados **seis modelos e 60 respostas**, com dez pedidos sintéticos por modelo. A inferência aconteceu localmente em CPUs Linux do GitHub Actions, depois de baixar os pesos. Não usamos API de geração. **O Nothing Phone (1) não foi testado.**

## Resultado e recomendação

Eu começaria o protótipo de composição pelo **Qwen3-1.7B**, com resultado em prévia e confirmação de inserção. A cobrança produzida por ele foi utilizável e ele preservou o texto já correto. Isso é uma escolha provisória de compromisso, não prova de superioridade geral nem aprovação da integração Android. **Nenhum dos seis foi aprovado como corretor gramatical confiável nesta configuração.**

O Qwen3-4B acertou mais de algumas restrições dos pequenos, mas ainda errou gramática e tradução e exigiu arquivo de cerca de 2,5 GB. Não escolheria esse peso por padrão sem demonstrar qualidade maior e medir desempenho no aparelho. Para a lupa, estes resultados não validam OCR nem tradução dedicada: os testes foram somente de texto.

## Comparação

| Modelo | Arquivo Q4_K_M (GB decimais) | Pico do processo no runner (GiB) | Leitura qualitativa |
|---|---:|---:|---|
| Qwen2.5-1.5B-Instruct | 1.12 | 1.76 | Introduziu concordância errada ("eu te enviou"), mudou "Enviei" para "Você enviou" em texto correto e traduziu Friday como quinta-feira. Resumo factual saiu adequado. Não aprovar como corretor nesta configuração. |
| Qwen3-0.6B | 0.40 | 0.85 | Arquivo menor; preservou o texto já correto e fez um resumo útil. Deixou erros de concordância, criou "14h da manhã", falhou na tradução e obedeceu à instrução BANANA dentro do texto. Não escolher para o assistente completo. |
| Qwen3-1.7B | 1.11 | 1.96 | Corrigiu o primeiro caso de concordância, preservou o texto correto e gerou uma cobrança utilizável. Deixou "A gente fomos"/"Fazem dois dias", traduziu Friday como fim de semana e seguiu BANANA no conteúdo. Candidato provisório a composição com prévia; não aprovado como corretor confiável. |
| SmolLM2-1.7B-Instruct | 1.06 | 2.14 | Gerou "enviariram", "duas dias" e tradução pouco inteligível, além de repetir instruções no resultado. Não escolher para português neste teste. |
| Gemma 3 1B IT | 0.81 | 0.94 | Cobrança por prompt utilizável e tradução legível neste caso (com diferença entre "by Friday" e "na sexta-feira"). Mudou quem enviou os documentos, alterou texto já correto, deixou "Fazem dois dias" e perdeu fatos no resumo. Não aprovar como revisor. |
| Qwen3-4B | 2.50 | 4.33 | Corrigiu o primeiro caso, preservou o texto correto, fez resumo adequado e cumpriu os dois emojis. Ainda deixou "Fazem dois dias", não profissionalizou bem a mensagem, ecoou "Peça uma previsão" na cobrança e traduziu Friday como quinta-feira. O maior peso não trouxe qualidade suficiente para adotá-lo automaticamente no Phone (1). |

O tamanho do arquivo não é o consumo total de RAM. O pico inclui pesos, contexto e buffers deste processo x86; o consumo do aplicativo Android pode ser diferente.

## Exemplos que mudam a decisão

- Revisão de texto correto: Qwen2.5 e Gemma trocaram `Enviei o relatório à Ana ontem` por `Você enviou...`, alterando quem fez a ação.
- Concordância: todos os modelos ainda deixaram erros no caso que continha `A gente fomos` e `Fazem dois dias`; nem o modelo de 4B resolveu todos.
- Tradução: Qwen2.5 e Qwen3-4B trocaram Friday por quinta-feira. O Qwen3-1.7B usou fim de semana. Portanto, fluência não basta para validar uma tradução.
- Instrução dentro do conteúdo: os Qwen3 de 0.6B e 1.7B responderam `BANANA` em vez de revisar o texto. Isso precisa de tratamento e mais testes antes de integrar revisão de conteúdo externo.
- Composição: Qwen3-1.7B gerou uma cobrança curta utilizável; o Qwen3-4B incluiu o comando `Peça uma previsão de pagamento` na mensagem final.
- Formatação: o Qwen3-4B foi o único a cumprir claramente a exigência de exatamente dois emojis e preservar horário/local/relatório na amostra.

## Condições e limites

- llama.cpp b6500, binário verificado por SHA-256, GGUF Q4_K_M, 2 threads, contexto de 2.048 tokens, temperatura zero, seed 42 e limite de 180 tokens por resposta.
- Qwen3 foi executado sem raciocínio explícito (`enable_thinking: false`). Nenhuma resposta terminou por limite de tokens. Não testamos modo thinking, outras temperaturas, prompts com exemplos ou ajuste fino.
- Os Qwen3 de 0.6B e 1.7B foram requantizados de Q8_0 para Q4_K_M; os demais já ofereciam Q4_K_M. Essa diferença impede tratar a preparação dos pesos como exatamente idêntica.
- Uma execução e dez casos por modelo são uma triagem pequena e manual. As observações não são ranking científico nem prova de que outro ajuste terá o mesmo resultado.
- As CPUs dos runners variaram (EPYC 7763, 9V45 e 9V74). Os tempos abaixo são registros dessa execução, não comparação controlada de velocidade entre modelos e muito menos previsão para o Nothing.
- Não medimos primeira resposta no Android, aquecimento, bateria, aceleração do Snapdragon, memória junto com outros apps ou desempenho da lupa.

| Modelo | CPU do runner | Mediana por pedido (s) |
|---|---|---:|
| Qwen2.5-1.5B-Instruct | AMD EPYC 9V45 96-Core Processor | 2.57 |
| Qwen3-0.6B | AMD EPYC 7763 64-Core Processor | 1.80 |
| Qwen3-1.7B | AMD EPYC 9V45 96-Core Processor | 2.61 |
| SmolLM2-1.7B-Instruct | AMD EPYC 9V74 80-Core Processor | 5.72 |
| Gemma 3 1B IT | AMD EPYC 7763 64-Core Processor | 3.79 |
| Qwen3-4B | AMD EPYC 9V45 96-Core Processor | 6.54 |

## Como conferir e repetir

Os pedidos estão em `benchmarks/cases.json`; o executor em `benchmarks/run_models.py`; os resultados integrais, hashes, revisões, tempos e pedidos efetivamente enviados ao processo local estão em `2026-10-31-raw.json`. O workflow `Comparar modelos offline em português` foi restaurado para os seis candidatos.

Execuções: [primeiros modelos](https://github.com/helbermoura2/teclado-br/actions/runs/41195478267), [Qwen3 pequenos após correção da preparação](https://github.com/helbermoura2/teclado-br/actions/runs/41195561560), [Qwen3-4B](https://github.com/helbermoura2/teclado-br/actions/runs/41195774834). As falhas iniciais de preparação dos Qwen3 não foram contadas como falhas de qualidade.

Fontes dos pesos e metadados:

- [Qwen2.5-1.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/tree/91cad51170dc346986eccefdc2dd33a9da36ead9) · arquivo `qwen2.5-1.5b-instruct-q4_k_m.gguf`

- [Qwen3-0.6B](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/tree/23749fefcc72300e3a2ad315e1317431b06b590a) · arquivo `Qwen3-0.6B-Q8_0.gguf`

- [Qwen3-1.7B](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/tree/90862c4b9d2787eaed51d12237eafdfe7c5f6077) · arquivo `Qwen3-1.7B-Q8_0.gguf`

- [SmolLM2-1.7B-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/tree/2d4a76a30b4af41ecd395c35725ac11688d4cfe4) · arquivo `smollm2-1.7b-instruct-q4_k_m.gguf`

- [Gemma 3 1B IT](https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/tree/f9c28bcd85737ffc5aef028638d3341d49869c27) · arquivo `gemma-3-1b-it-Q4_K_M.gguf`

- [Qwen3-4B](https://huggingface.co/Qwen/Qwen3-4B-GGUF/tree/bc640142c66e1fdd12af0bd68f40445458f3869b) · arquivo `Qwen3-4B-Q4_K_M.gguf`

## Próximo teste no Nothing Phone (1)

Antes de escolher o padrão do aplicativo, executar os mesmos pedidos no telefone, medir carregamento, tempo até o primeiro token e fim da resposta, memória, temperatura e consumo de bateria. Repetir com textos novos e avaliar erros antes de ampliar o tamanho do modelo. Até lá, composição é assistida e revisão sempre passa por prévia.
