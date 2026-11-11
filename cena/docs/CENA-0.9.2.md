# CENA 0.9.2

Corrige a leitura de GGUF pelo seletor do Android: usa diretamente o descritor autorizado, sem reabrir o arquivo por caminho nem copiar os pesos. O teste Android reproduz o caso com modelo privado pertencente a outro UID, acessível apenas pelo descritor recebido de um provider.

Inclui os ajustes da 0.9.1: correspondência temática obrigatória quando identificada; mais buscas e metadados; não completa resultados insuficientes com gêneros genéricos; comparação inclui o catálogo pessoal por padrão; pedido local menor, contexto 2048 e diagnósticos seguros por etapa.

A execução do GGUF específico do usuário ainda deve ser confirmada no aparelho. A mensagem passa a mostrar um código útil caso outra incompatibilidade persista.

Instale por cima da versão atual para manter listas e conexões.
