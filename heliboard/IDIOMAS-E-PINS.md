# Idiomas e textos fixados — 0.6.1

A tecla de globo alterna os idiomas habilitados dentro deste teclado.
Português brasileiro e inglês americano ficam habilitados inicialmente, com seus
dicionários já incluídos. Outros idiomas podem ser adicionados nas configurações
Idiomas e layouts; os dicionários adicionais são importados separadamente.
A configuração nova preserva os idiomas e o idioma selecionado pelo usuário.

O ícone de prancheta fica fixado junto às sugestões. Toque para abrir o histórico.
Mantenha um cartão de texto pressionado para fixar ou desafixar: não há menu
intermediário no HeliBoard 3.6. Os fixados aparecem primeiro. Toque no cartão para
colar seu conteúdo. Pins são gravados no SQLite local; a limpeza por idade e a
limpeza de não fixados os preservam. Remover os dados do aplicativo ou desinstalar
apaga os dados locais. Backup e restauração do HeliBoard inclui heliboard.db.

## Atualização da 0.6.0

A versão 0.6.0 usou chave de depuração temporária do runner. Não é possível
reutilizar uma chave privada que não foi preservada. Se Android rejeitar atualizar
por cima, exporte primeiro um backup em Configurações → Avançado → Backup e
restauração, salve o ZIP fora do app e só então reinstale e restaure esse backup.
O banco de clipboard/pins faz parte do backup nativo.

A partir da 0.6.1 a chave de teste é restaurada de cache ou backup de artefato privado
antes da compilação. Não é gravada no repositório nem nas fontes do APK. O certificado
público registrado é conferido; se a chave expirar no armazenamento do CI e não houver
backup, a compilação deve falhar em vez de trocar silenciosamente de assinatura.
O backup privado do CI tem retenção de 90 dias. É uma chave de testes, não uma
assinatura de produção. A migração futura para produção exigirá planejamento próprio.

Gemma 4 E2B continua no teste final offline. IA, prompt e lupa não são adicionados
por esta alteração de idiomas e clipboard.
