# Segunda rodada: quatro IAs offline para o Teclado BR

**O Gemma 4 E2B foi o candidato mais consistente nos dez pedidos desta amostra.** O Qwen3.5-2B foi a alternativa de arquivo menor, mas a cobrança gerada inventou que o dinheiro havia sido recebido. Eu priorizaria o Gemma 4 para um teste de qualidade e desempenho no Nothing Phone (1), mantendo o Qwen3.5 como alternativa mais leve. Isso ainda não define o modelo padrão do aplicativo.

Foram executadas 40 respostas dos quatro modelos novos e dez de referência (Qwen3-1.7B), com os mesmos dez pedidos da primeira rodada e o mesmo hash de casos. Todos concluíram sem erro HTTP, sem truncamento e sem conteúdo de raciocínio retornado. Junto com as 60 respostas anteriores, o material inclui 110 respostas: dez modelos distintos e uma repetição de controle.

**Não houve teste no Nothing Phone (1).** A inferência foi local a runners Linux, depois de baixar os pesos. Não usamos API de geração nem mensagens reais do usuário.

## Os quatro novos

| Modelo | Arquivo efetivamente usado (GB decimais) | Pico do processo no runner (GiB) | Avaliação manual |
|---|---:|---:|---|
| Gemma 4 E2B IT | 3.43 | 4.24 | Melhor conjunto nesta amostra: corrigiu os dois casos, preservou o texto correto, gerou cobrança utilizável, profissionalizou e cumpriu dois emojis. Na tradução, trocou o prazo "até sexta" por contato "na sexta", uma nuance a corrigir. Não equivale a aprovação geral. |
| Qwen3.5-2B | 1.40 | 2.44 | Melhor compromisso de arquivo menor entre os novos: corrigiu os dois casos, preservou o texto correto e traduziu o prazo corretamente. A cobrança inventou recebimento do valor; o estilo gerou "Posso me enviar?" e não cumpriu os emojis. |
| Gemma 3n E2B IT | 3.31 | 4.14 | Boa correção e tradução nesta amostra. A cobrança incluiu [data de ontem], o estilo pediu confirmação de envio e adicionou assinatura genérica; gerou três emojis quando foram pedidos dois. Peso próximo ao Gemma 4 sem a mesma consistência neste teste. |
| SmolLM3-3B | 1.92 | 3.36 | Melhorou bastante sobre o SmolLM2: português compreensível, revisão inicial, estilo e resumo úteis. Deixou "Fazem dois dias", cobrança com "está vencido ontem", tradução literal pouco natural e não adicionou emojis. |

GB do arquivo é armazenamento; GiB do processo é memória nesta execução x86. Não são a mesma medida nem uma previsão de RAM no Android. E2B indica parâmetros efetivos: não significa que o arquivo inteiro tenha somente dois bilhões de parâmetros. As técnicas de economia do runtime móvel não foram avaliadas aqui.

## Comparação direta com a primeira rodada

- **Gramática:** nenhum dos seis anteriores corrigiu integralmente o caso de `A gente fomos` / `Fazem dois dias`. Gemma 4, Gemma 3n e Qwen3.5 corrigiram esses erros nesta amostra; SmolLM3 ainda deixou `Fazem dois dias`.
- **Texto correto:** os quatro novos preservaram quem enviou o relatório, o valor e a data. Gemma 3n adicionou uma quebra de linha; SmolLM3 adicionou uma quebra no início, portanto esses dois não cumpriram literalmente a exigência de devolver exatamente a mesma string. Na primeira rodada, Qwen2.5 e Gemma 3 1B tinham alterado o agente da ação.
- **Compositor:** Gemma 4 gerou uma cobrança utilizável com R$ 180,00, vencimento ontem e pedido de previsão. Qwen3.5 afirmou ter recebido o valor; Gemma 3n deixou um marcador de data; SmolLM3 ecoou instrução e gerou concordância temporal inadequada. Não basta avaliar fluência.
- **Tradução:** Qwen3.5 e Gemma 3n preservaram claramente `by Friday` como `até sexta-feira`. Gemma 4 escreveu `na sexta-feira`, restringindo indevidamente a ideia de prazo. SmolLM3 preservou a sexta-feira, mas usou a construção pouco natural `Eu volto com você`. O controle Qwen3 continuou usando `fim de semana`.
- **Instrução dentro do conteúdo:** os quatro novos revisaram a frase e mantiveram a instrução BANANA como texto; o Qwen3 de referência respondeu apenas BANANA.
- **Emojis:** Gemma 4 cumpriu exatamente dois e preservou os detalhes; Gemma 3n produziu três; Qwen3.5 e SmolLM3 não adicionaram nenhum.

## Exemplos reais

Entrada: `A gente fomos no mercado mais nao tinha pao. Fazem dois dias que estou esperando as opcoes.`

Gemma 4:

> A gente foi no mercado, mas não tinha pão. Faz dois dias que estou esperando as opções.

Na cobrança, o Gemma 4 respondeu:

> Olá! Tudo bem? Gostaria de saber se você teria uma previsão de quando conseguirá realizar o pagamento referente ao valor de R$ 180,00, que venceu ontem. Agradeço a atenção! 😊

No mesmo pedido, o Qwen3.5 começou com `Recebi o valor de R$ 180,00`, contrariando o pagamento pendente. As respostas integrais estão nos dados brutos, inclusive os casos que favorecem outros modelos.

## Leitura manual por tarefa

“Adequado” significa satisfatório para este caso específico. “Parcial” indica problema localizado, formatação ou informação omitida; “falhou” indica erro gramatical relevante, contradição ou restrição não cumprida. São julgamentos manuais nesta amostra pequena, não porcentagens de precisão. Resumos podem omitir fatos secundários; as omissões maiores foram apontadas.

| Pedido | Gemma 4 | Qwen3.5 | Gemma 3n | SmolLM3 |
|---|---|---|---|---|
| correcao_concordancia | adequado | adequado | adequado | adequado |
| correcao_naturalidade | adequado | adequado | adequado | falhou |
| preservar_texto_correto | adequado | adequado | parcial | parcial |
| profissional | adequado | parcial | parcial | adequado |
| educado_preserva_negacao | adequado | adequado | adequado | parcial |
| compositor | adequado | falhou | parcial | falhou |
| resumo_fatos | adequado | parcial | parcial | adequado |
| traducao_idiomatica | parcial | adequado | adequado | parcial |
| texto_com_instrucao_embutida | adequado | adequado | adequado | adequado |
| emojis | adequado | falhou | falhou | falhou |

## Condições de execução e limites

- Mesmo `cases.json` (SHA-256 `98d1627e914bcfbe35372f673592b712a4f78a2c08b5b5423d1e37844137d23e`). Mesmas mensagens de sistema e usuário da primeira rodada.
- llama.cpp **b12020**, necessário para as arquiteturas recentes, substituiu b6500. Binário verificado por SHA-256; contexto 2.048, duas threads, CPU, uma sessão, temperatura 0, seed 42, limite de 180 tokens e `enable_thinking: false`.
- Todos usaram Q4_K_M. Gemma 4, Gemma 3n e o Qwen3 de referência foram requantizados de Q8_0; Qwen3.5 e SmolLM3 já forneciam Q4_K_M. Arquivos e revisões exatos foram registrados. Não avaliamos imagens, áudio ou projetores multimodais.
- Repetimos o Qwen3-1.7B com **hash dos pesos idêntico** ao da primeira rodada. 5 das dez saídas mudaram textualmente com o novo conjunto motor/hardware, mas as falhas principais permaneceram. Não é possível atribuir toda diferença entre rodadas exclusivamente ao modelo ou exclusivamente ao motor.
- As CPUs dos runners não foram idênticas. Tempos são apenas registros destas execuções: não devem ser usados para ordenar velocidade, comparar com o telefone ou prometer resposta instantânea.
- Uma execução, um seed e dez frases por modelo são triagem. Não otimizamos temperatura individualmente, prompts com exemplos, contexto maior, modo thinking ou quantizações alternativas. Não testamos frases novas suficientes para certificar confiabilidade gramatical.
- Pico de memória e latência do runner não medem Android, uso junto com WhatsApp, carregamento, bateria, calor ou aceleração no Snapdragon. A lupa/OCR continua fora deste teste.

| Modelo | CPU do runner | Mediana por pedido (s), apenas registro |
|---|---|---:|
| Gemma 4 E2B IT | AMD EPYC 9V74 80-Core Processor | 4.40 |
| Qwen3.5-2B | AMD EPYC 7763 64-Core Processor | 4.86 |
| Gemma 3n E2B IT | AMD EPYC 7763 64-Core Processor | 7.91 |
| SmolLM3-3B | AMD EPYC 7763 64-Core Processor | 11.12 |
| Qwen3-1.7B (controle) | AMD EPYC 9V45 96-Core Processor | 2.14 |

## Materiais e reprodução

[Execução completa da rodada 2](https://github.com/helbermoura2/teclado-br/actions/runs/41196525297). Executor: `benchmarks/run_models_v2.py`; pedidos: `benchmarks/cases.json`; resultados: `2026-10-31-rodada2-raw.json`. O relatório anterior e seus dados foram preservados. O workflow registra quatro candidatos e um modelo de controle, sem alterar o aplicativo Android.

Fontes dos pesos (arquivos de texto, sem módulos multimodais):

- [Gemma 4 E2B IT](https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/tree/6938c58e698502037401a5f19f6905f2fb2f7dee) · `gemma-4-E2B-it-Q8_0.gguf` · modelo final SHA-256 `f2e77e73ec6c7b0065de078af1ed0103345b6759850b44da79489b88c5727726`

- [Qwen3.5-2B](https://huggingface.co/bartowski/Qwen_Qwen3.5-2B-GGUF/tree/7d26695454df6de5fbcce2e58681e62dae06ce43) · `Qwen_Qwen3.5-2B-Q4_K_M.gguf` · modelo final SHA-256 `57a1085840f497d764a7fc5d346922dbde961efb54cc792ea81d694fd846a1d8`

- [Gemma 3n E2B IT](https://huggingface.co/ggml-org/gemma-3n-E2B-it-GGUF/tree/989cffaba23976934324f5e3abfabe31b30eb73b) · `gemma-3n-E2B-it-Q8_0.gguf` · modelo final SHA-256 `ffd6902fe0440fde379e8191cb6d330b78321ea713cdf2b9975fef1032f83cab`

- [SmolLM3-3B](https://huggingface.co/ggml-org/SmolLM3-3B-GGUF/tree/4965cb60b150737b68a0408c36aeefb65078f894) · `SmolLM3-Q4_K_M.gguf` · modelo final SHA-256 `8334b850b7bd46238c16b0c550df2138f0889bf433809008cc17a8b05761863e`

- [Qwen3-1.7B (controle)](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/tree/90862c4b9d2787eaed51d12237eafdfe7c5f6077) · `Qwen3-1.7B-Q8_0.gguf` · modelo final SHA-256 `54c0f1203a724e9f33e76916beab3bdfaffef56cf7b42a93b1bc21319fc0bf97`

## Próxima decisão para o teclado

Primeiro medir Gemma 4 E2B no Nothing Phone (1), usando textos novos em português e o mesmo conjunto como referência. Se memória/velocidade forem inadequadas, comparar Qwen3.5-2B como alternativa menor e validar os erros de composição antes de adotá-lo. Manter prévia e confirmação para inserir ou substituir. A integração offline ainda precisa ser implementada; este teste não criou um novo APK de IA. O campo de prompt no Compositor e a lupa permanecem requisitos do projeto.
