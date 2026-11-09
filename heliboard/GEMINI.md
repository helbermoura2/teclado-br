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
Modo Automático: Gemini 3.8 → Gemini 3.6 → Groq (se configurada) → GGUF local.
Modo Online: Gemini 3.8 → Gemini 3.6 → Groq (se configurada); sem offline.
A ordem de revisão é fixa independentemente do seletor, que serve apenas para o teste manual de conexão. Toda falha não cancelada do Gemini 3.8 tenta o 3.6, inclusive HTTP 400/403 e resposta vazia; o Groq só é consultado depois de ambos falharem. Sem internet ou sem chave, o modo Offline continua independente.
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

## Diagnóstico e latência (beta 14)

- Em solicitações curtas (até 600 caracteres de prompt total), o Gemini 3.8
  tem `readTimeout=15000ms` após o envio da solicitação. A conexão possui
  seu próprio prazo (até 8 segundos), portanto a duração total pode superar
  15 segundos. Textos maiores preservam o limite anterior de 60 segundos.
- O 3.6 mantém o próprio prazo e a Groq só recebe o texto se ambos os Gemini
  falharem. O modo Automático ainda pode usar o GGUF offline.
- A opção **Diagnóstico rápido do Gemini 3.8** envia só a frase fictícia
  "Responda apenas OK", sem a instrução longa de revisão. O teste individual
  normal permanece disponível.
- O diagnóstico apresenta somente etapa, duração de conexão/TLS, envio,
  espera pelo código HTTP, leitura e código HTTP numérico (quando conhecido).
  Nunca grava nem mostra chave, prompt pessoal ou corpo de resposta da API.
  Esses tempos identificam a fase da falha, não asseguram a causa no Google.
- A chave já cadastrada permanece no Android Keystore, sem migração.

