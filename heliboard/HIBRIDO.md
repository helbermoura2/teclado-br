# IA híbrida e melhorias — 0.8.0

## Ativar

Abra o brilho e a engrenagem. Crie uma chave em https://console.groq.com/keys
usando uma conta no plano Free. Cadastre a chave apenas no aplicativo; não a envie
no chat. Salve o modo Automático. Mantenha o GGUF da Gemma já importado para fallback.
O seletor Offline/Automático/Online também aparece no painel de escrita.

Offline nunca chama a Groq. Automático usa Groq quando há conexão validada e chave;
se houver erro, limite ou falta de conexão, usa o GGUF. Online exige conexão e chave
e apresenta erro sem fallback. Cancelar não inicia uma segunda geração local.
Nada substitui o campo original até tocar em Substituir; mudança no campo bloqueia
uma substituição antiga. A comparação destaca remoções no original e inserções na revisão.

A digitação normal, correção e aprendizagem do HeliBoard continuam locais. Somente
a tarefa solicitada envia à Groq seu texto e instruções, conforme a política do
provedor. Campos de senha são bloqueados. A chave usa AES-GCM/Android Keystore e
arquivo privado fora do backup, sem registro em logs ou exportação do dicionário.
O endpoint é HTTPS, sem redirecionamentos; testes usam servidor local e chave fictícia.

Modelo online: openai/gpt-oss-20b. O plano Free tem cotas que podem mudar; o app não
ativa cobrança nem troca para plano pago. Uma chave de conta paga pode gerar cobrança
no provedor: o app não consegue detectar o plano. Use conta Free para manter grátis.
O app não usa a assinatura do ChatGPT e não precisa de servidor próprio.

## Personalização

Segure uma sugestão para ler a palavra inteira, usá-la, adicioná-la ao dicionário
ou remover uma sugestão indesejada. O botão ＋ continua salvando a palavra do campo.
No menu ＋ há gerenciamento pesquisável do dicionário pessoal e importação/exportação
JSON pelo seletor de arquivos. Importação mescla, sem limpar as palavras existentes;
exporta o dicionário pessoal, não o histórico interno de aprendizagem, pins ou chaves.
Excluir uma entrada pessoal não apaga palavras dos dicionários base ou do histórico.

Aparência oferece altura em retrato e tamanhos separados de letras e símbolos.
Salve e reabra o teclado para aplicar. A barra nativa desliza horizontalmente;
quando aberta manualmente, fica aberta até a próxima entrada de texto.

## Medição e validação

As configurações oferecem teste com texto sintético e histórico local das últimas
cinco medições. Mostra duração, pico amostrado de PSS do processo de inferência e,
quando disponível, diferença do contador de energia do aparelho. Energia é do
aparelho inteiro, não consumo isolado da IA. PSS amostrado não captura todo pico.
Execute no Nothing Phone (1) com condições semelhantes e repita cada modo.
Não há resultado de desempenho real do telefone nem validação com chave real Groq
nesta implementação. O modelo pequeno do teste Android verifica integração, não
qualidade geral de revisão ou desempenho da Gemma maior.

Testes automatizados previstos: transporte HTTP real contra servidor local controlado,
sucesso, cota, autenticação, redirecionamento, resposta inválida, timeout, cancelamento,
fallback; chave cifrada; comparação sem alteração do texto; backup do dicionário;
controles de aparência e regressões de digitação, idiomas, pins e inferência offline.
A lupa flutuante com OCR continua pendente.

Os patches agora ficam em módulos de sugestões, digitação e assistente, com âncoras
únicas verificadas e relatório TECLADO-BR-PATCHES.json no fonte preparado. Upstream,
llama.cpp e licença GPLv3 permanecem fixados. As fontes acompanham cada APK.
