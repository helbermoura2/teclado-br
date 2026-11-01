# Assistente offline — primeira integração Android (0.7.0)

Botão de brilho na barra do HeliBoard, abrindo um espaço de revisão e composição
em processo separado :writing. Não é a lupa por cima de outros aplicativos.
Tarefas: revisão, prompt livre, cinco estilos, resumo e tradução de texto para PT.
Prévia editável; copiar ou substituir explicitamente. A substituição exige que
o campo original e seu texto ainda coincidam com o snapshot capturado.
Campos de senha não são enviados ao assistente.

O APK não recebe permissão INTERNET. Não há servidor, API nem inferência remota.
O usuário baixa um GGUF pelo navegador e o importa pelo seletor de arquivos.
Importação faz cópia privada com verificação de formato, tamanho e SHA-256;
substituição atômica do modelo anterior. Modelos ficam fora dos backups.
O arquivo de pesos não está embutido no APK nem nas fontes.

Motor: llama.cpp b12020, commit 0ec4027a2a0183de87c007069adddc06e665f7de (MIT).
Construído do código para arm64-v8a e x86_64 com NDK 28, CPU, quatro threads,
contexto 2.048, até 256 tokens e thinking desativado. Prompt passa pelo template
nativo/Jinja do GGUF e a saída pelo parser de canais do mesmo runtime.
Cancelar interrompe carregamento/decodificação e libera o modelo; a memória
é devolvida após cada tarefa. Android mínimo passa a 8 (API 26).

Qwen3.5 2B Q4_K_M é uma opção de 1,4 GB, com link fixado no aplicativo. Gemma 4
E2B permanece no comparativo final: foi melhor na amostra Linux anterior, mas
seu GGUF quantizado testado tinha 3,43 GB. Não se deve prometer latência, bateria
ou adequação de memória no Nothing Phone (1) sem teste real no aparelho.
O runtime usa o mesmo pin que os testes da rodada 2 e permite importar Gemma 4.
Um arquivo não suportado ou memória insuficiente resulta em erro, sem substituir
por revisão baseada em regras nem apresentar resultados simulados como IA.

A fixture Qwen3 0.6B Q8_0 do teste Android é pequena para validar a integração;
não é a escolha de qualidade recomendada para revisão PT-BR.
O teste não usa mensagens pessoais: somente texto sintético.

A página de download também oferece Gemma 4 E2B Q4_0 oficial (~2,84 GB), com
revisão fixada. Essa quantização difere da Q4_K_M requantizada usada na rodada 2;
sua qualidade e seu uso de memória no Android precisam ser medidos separadamente.
Remover modelo apaga somente os pesos, preservando dicionário e pins.
Se a substituição for recusada, a resposta é reaberta para copiar, sem alterar o campo.
