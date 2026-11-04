# Limpeza de armazenamento — 4 de novembro de 2026

Inventário: [run 41905806051](https://github.com/helbermoura2/teclado-br/actions/runs/41905806051).
Execução verificada: [run 41906337610](https://github.com/helbermoura2/teclado-br/actions/runs/41906337610).

Foram removidos 127 arquivos redundantes de compilações/testes do teclado,
totalizando 3.433.201.982 bytes (3,43 GB decimais / 3,20 GiB).
O total de artefatos caiu de 375 / 8.236.328.342 bytes para
248 / 4.803.126.360 bytes. A API confirmou a exclusão dos IDs auditados e a
preservação de todos os demais artefatos. A lista está em
[storage-plan.json](../.github/maintenance/storage-plan.json).

## Preservado

- Todas as 24 Releases e seus arquivos, verificadas antes/depois por IDs,
  nomes, tamanhos e hashes fornecidos pelo GitHub; incluindo a atual 0.8.1.
- APK/fontes/testes/unitários da 0.8.0 (run 41449779518) para retorno.
- Todos os backups de assinatura do teclado; nenhuma chave foi baixada.
- Comparativos de modelos, arquivos do CENA, caches de compilação, execuções,
  logs e histórico Git.

Os arquivos antigos removidos não podem mais ser baixados pelos links de
artefatos dessas compilações. As Releases e a 0.8.0 preservada continuam disponíveis.

## Prevenção

O fluxo HeliBoard deixa de subir cópias combinadas/separadas do mesmo APK e
dos mesmos fontes. A distribuição continua na Release privada, depois de todos
os testes. Relatórios unitários e diagnósticos passam a durar 7 dias;
backups da assinatura mantêm 90 dias. O fluxo do protótipo antigo agora roda
somente quando seus arquivos relevantes mudam.

O workflow de manutenção volta ao modo inventário por padrão. Não existe
limpeza ampla automática: uma exclusão futura exige uma nova lista de IDs
revisada, com verificações de nome/tamanho/run e bloqueio de assinatura/retorno.

O contador de uso/cota do GitHub pode levar 6–12 horas para refletir exclusões.
Ainda restam cerca de 4,8 GB de artefatos, principalmente CENA; essa limpeza
adicional depende da definição de escopo solicitada ao usuário.
