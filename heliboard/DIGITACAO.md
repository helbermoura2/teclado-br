# Digitação 0.6.4

Ativa o espaço automático nativo após pontuação: o espaço é inserido ao começar
a próxima palavra. Números decimais, campos de senha e endereços seguem as regras
do motor nativo. Não insere um espaço duplicado ao pressionar espaço manualmente.

Remove globo e emoji da fileira inferior. Idiomas e emoji ficam no início da
barra expansível; segurar espaço também permite trocar de idioma.

Segurar uma palavra na barra de sugestões abre um menu com Adicionar ao dicionário,
Mais sugestões e, quando aplicável, Remover sugestão. A adição usa o dicionário
pessoal nativo e o idioma atual. Também é possível adicionar/editar palavras em
Configurações > Correção de texto > Dicionário pessoal.

Ativa sugestões personalizadas e adição automática de palavras repetidas no
histórico, pelo mecanismo nativo HeliBoard. O aprendizado ocorre localmente e
progressivamente. Campos de senha, campos que pedem não aprender e modo anônimo
continuam respeitados. Não é integração de modelo generativo: IA, prompt e lupa
permanecem pendentes. Idiomas, tema e pins existentes são preservados.

## Validação

[Run 41261586814](https://github.com/helbermoura2/teclado-br/actions/runs/41261586814), commit `d4c3df331069c6113b595479daed2f1df86d248b`: build, assinatura e interação aprovados.
142 testes unitários sem falhas. No emulador Android 35, o teste digitou uma
palavra inexistente, abriu o menu por toque longo e confirmou sua gravação no
provedor de dicionário pessoal. Digitar `bom.dia ` produziu `Bom. Dia ` sem
pressionar espaço depois do ponto. Troca PT-BR/EN pela barra, ausência de globo e
emoji nas teclas, Ç ao segurar C, 200 toques sobrepostos, autocorreção e pins
passaram. Pins também resistiram a 30 dias simulados e à reinstalação/reinício.
Sugestões personalizadas e adição automática estão ativadas pelo mecanismo
nativo; não foi feita medição longitudinal da qualidade do aprendizado no aparelho.

A primeira compilação revelou que a palavra digitada era omitida da barra;
a correção mantém essa palavra visível. A segunda execução encontrou uma falha
no teste ao percorrer um nó sem texto; corrigida antes da validação final.

APK SHA-256: `ce8c95d8caa4c3fce27a5daffb91770306ddea02d32e4fdba5a685ccca15f623`.
Fontes SHA-256: `e8ad6138208a4bf1e69bce50716a7cb8f4a850d8beacfeed75083668ee08f805`.
Assinatura igual à 0.6.3: instalar como atualização, sem desinstalar.
