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

A versão 0.6.0 usou uma chave de depuração temporária do runner. A 0.6.1 tem
uma assinatura de testes preservada. Android não aceita substituir a 0.6.0 com
certificado diferente. Para manter seus textos e configurações:

1. Na 0.6.0, abra Configurações → Avançado → Backup e restauração → Fazer backup.
2. Salve o ZIP em Downloads ou Documentos, fora da pasta do aplicativo, e confira
   que o arquivo foi salvo antes de desinstalar qualquer coisa.
3. Reinstale com o novo APK e use Avançado → Backup e restauração → Restaurar.
4. Reinicie o aparelho após restaurar o backup antigo. Isso reaplica a migração
   dos novos atalhos aos dados da 0.6.0. Ative e escolha o teclado novamente, se necessário.

O banco de clipboard/pins faz parte do backup nativo. Itens não fixados continuam
sujeitos à limpeza normal por idade; fixe antes os textos que quer guardar.

A partir da 0.6.1 a chave de teste é restaurada de cache ou backup de artefato privado
antes da compilação. Não é gravada no repositório nem nas fontes do APK. O certificado
público registrado é conferido; se a chave expirar no armazenamento do CI e não houver
backup, a compilação deve falhar em vez de trocar silenciosamente de assinatura.
O backup privado do CI tem retenção de 90 dias. É uma chave de testes, não uma
assinatura de produção. A migração futura para produção exigirá planejamento próprio.

Gemma 4 E2B continua no teste final offline. IA, prompt e lupa não são adicionados
por esta alteração de idiomas e clipboard.


## Verificação da 0.6.1

Código testado: 82728506e92c431f97f41ce45360de609e31c5c9.
Execução: https://github.com/helbermoura2/teclado-br/actions/runs/41232773850 (tentativa 2).
Compilação e 142 testes unitários aprovados. apksigner verificou o APK e o
certificado registrado em signing-cert.sha256; a leitura independente do
certificado do APK também conferiu o digest público.

Android 15 AOSP, emulador 540×1170 / 220 dpi:
- Globo alternou PT-BR → inglês → PT-BR, recuperando a tecla Ç ao voltar.
- Prancheta acessível junto às sugestões; pressão longa no cartão gravou PINNED=1.
- Com datas dos registros simulando 30 dias atrás, a limpeza nativa preservou o
  pin e removeu um texto não fixado expirado. Não foi uma espera real de 30 dias.
- Após encerrar o processo e reinstalar o mesmo APK por cima, um novo processo
  recuperou o pin do SQLite e o cartão colou o texto completo no editor.
- Regressão: 200 caracteres com dedos sobrepostos e ordem alternada de soltura,
  copiar/colar, sugestões de você, acentos por deslizar, maiúsculas e autocorreção.

A primeira tentativa do APK com assinatura estabilizada falhou na troca de idioma
com o teclado oculto durante a transição de atividade do teste; a repetição do
mesmo APK passou os cenários completos. O teste não mede a fluidez no Nothing
Phone (1), nem cobre todas as transições entre aplicativos.
A injeção dos 200 caracteres levou 33.798 ms, incluindo sobrecarga do emulador,
sem equivaler à latência nem à velocidade máxima no telefone.

SHA-256 do APK:
dfd267c4afcb5ae7dd094df77369112ca2aea4a559bf8dff4d3992a8f54b3502

SHA-256 das fontes:
d9afe4dd48688ca2af95a20cf501b6938911beab75de67cfb1304fe952a886c3
