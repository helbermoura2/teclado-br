# Integração Gemini — Teclado BR 0.9.2 (a validar)

## Arquitetura

O painel do teclado mantém o mesmo tema One UI opcional e o mesmo processo
privado `:writing`. O botão de IA é acionado manualmente e recebe apenas
o trecho selecionado (limite atual: 4.000 caracteres) e a tarefa.
O novo `GeminiClient` usa HTTPS POST no endpoint oficial
`/v1beta/models/gemini-3.8-flash:generateContent` com `x-goog-api-key`,
uma única requisição, timeout, sem redirecionamento nem telemetria.
Usa `thinkingLevel: low`, saída limitada e valida `candidates/content/parts`.
A chave fica somente no dispositivo; nunca em código ou GitHub Actions.

A chave Gemini usa `tecladobr.gemini.v1` no Android Keystore e um
`gemini-key.enc` em `getNoBackupFilesDir()`. O armazenamento Groq anterior
é preservado com alias `tecladobr.groq.v1` e `groq-key.enc`.
Os arquivos são independentes; remover Gemini não apaga Groq, o modelo GGUF,
o histórico de medidas nem o dicionário.

Modo Offline: somente GGUF local (Gemma).
Modo Automático: Gemini → Groq (se configurada) → GGUF local.
Modo Online: Gemini → Groq (se configurada); se ambos falharem, mostrar erro.
Sem internet ou sem chave, o modo Offline continua independente.
Campos de senha são bloqueados; não existe processamento automático ao digitar.
Resultados são prévias, nunca substituições silenciosas.

## Segurança e custos

API direta no dispositivo foi escolhida para este teclado pessoal, sem
incluir a chave dentro do APK. Criptografia local reduz exposição a acessos
casuais, mas **não equivale a proxy seguro no backend**: aplicativos/clientes
comprometidos podem expor chaves que estão em uso. Para distribuição pública,
migrar a autenticação para um backend controlado e com limites.
Cadastre a chave apenas nas configurações; não a envie em conversas ou commits.
A API Gemini e a Groq podem consumir quotas ou faturar conforme a conta;
o teclado não ativa pagamentos. O plano gratuito do Google pode usar
solicitações para melhorar produtos conforme seus termos.

## Testes antes de instalar

1. Executar o build e testes de unidade no branch de integração 0.9.2.
2. Testar transporte Gemini com servidor local e chave sintética, incluindo
   HTTP 200/429/401/403/500/302, resposta inválida e cancelamento.
3. Conferir que as duas chaves são cifradas separadamente, sem vazamento no
   texto das telas, dicionário ou arquivo de fontes.
4. Testar modo Offline sem rede, automático com falha e modo Online sem fallback.
5. Verificar visual 0.9.2 e instalação por cima, sem apagar Gemma, no Nothing Phone (1).
6. Testar uma frase de revisão com a chave Gemini cadastrada *somente no aparelho*.

Não afirmar que a integração foi testada contra o Google em conta real até
que o teste no dispositivo seja feito. O APK ainda não foi publicado.
