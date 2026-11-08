# Proteção dos minutos GitHub Actions — novembro de 2026

## Motivo

O repositório `teclado-br` é **privado**; builds no runner GitHub-hosted
utilizam a franquia mensal da conta `helbermoura2`. Em 8 de novembro de
2026 o GitHub enviou um alerta de **1.806 / 2.000 minutos** usados, com
renovação informada em **1º de dezembro de 2026**. O saldo muda após o
alerta; confira o medidor oficial antes de executar testes pesados.

A versão **Teclado BR 0.9.0 já foi publicada**, com APK e assinatura
verificados: `https://github.com/helbermoura2/teclado-br/releases/tag/heli-0.9.0`.

## Como evitar gasto involuntário

Os workflows abaixo agora aceitam somente `workflow_dispatch`, em vez
de rodar automaticamente a cada push ou atualização de pull request:

| Workflow | Quando usar |
|---|---|
| `Testar base HeliBoard` | Apenas ao publicar uma nova versão assinada, após atualizar o número e metadados de release |
| `Teclado BR One UI preview` | Apenas ao validar alterações de IME com testes e capturas Android |
| `Gerar APK de teste` | Apenas ao validar a implementação Android legada |
| `Verificar teclado no Android` | Apenas ao precisar de instrumentação Android legada |
| `Comparar modelos offline em português` | Apenas ao escolher modelos para benchmark |
| `Comparar quatro modelos offline novos` | Apenas ao executar benchmarks de IA ampliados |

Para executar manualmente: abra o repositório no GitHub, entre em
**Actions**, selecione o workflow e clique **Run workflow**. Escolha a
branch correta. Antes, confira que o saldo do mês é suficiente.

**Atenção:** a execução completa de HeliBoard também publica uma Release;
não reexecute a versão 0.9.0 como se fosse uma nova publicação. Atualize
`heliboard/upstream.json`, `heliboard/prepare.py` e os nomes/tags em
`.github/workflows/heliboard.yml` para a versão seguinte, revisando a
assinatura e o teste do APK antes de acionar o workflow.

O workflow `Limpar arquivos antigos de testes` continua isolado e restrito
a um plano de exclusão revisado; ele não publica APKs.

Esta proteção não altera nenhum APK, assinatura ou dados locais do usuário.
Não configura o orçamento financeiro da conta no GitHub.

## Evitar cobranças (configuração da conta, obrigatória pelo titular)

Em https://github.com/settings/billing, selecione
**Budgets and alerts > New budget > Product-level budget > Actions**,
escopo da conta inteira, valor **US$ 0**, e habilite a opção de
**parar o uso ao alcançar o orçamento** se for mostrada. Um
orçamento com alerta **sem bloqueio** não impede cobranças.
Confirme a configuração nas telas de cobrança do GitHub.

O alerta é um registro histórico. O saldo atual só pode ser lido pelo
proprietário da conta na seção de cobrança. O uso de runners padrão em
repositórios públicos, como `Monitor-Global`, é gratuito segundo o
GitHub; runners maiores e repositórios privados podem ser cobrados.

Documentação oficial:
- https://docs.github.com/en/billing/how-tos/set-up-budgets
- https://docs.github.com/en/actions/concepts/billing-and-usage
