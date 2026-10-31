# Testes no Nothing Phone (1)

Os testes unitários cobrem apenas o motor de texto. A compilação e os testes
de interação abaixo ainda precisam ser executados; não foram validados em aparelho.

1. Ativar e selecionar o teclado pelas configurações do Android.
2. Digitar `ola. voce esta bem? sim!` e conferir a maiúscula inicial e após pontuação.
3. Digitar `voce `: conferir correção para `Você ` e desfazer com Backspace.
4. Digitar um nome desconhecido e conferir que não muda automaticamente.
5. Manter A/E/I/O/U/C pressionados e selecionar acentos; testar Shift e Caps Lock.
6. Selecionar texto e substituí-lo, mover cursor, apagar emoji e testar Enter,
   Enviar, Próximo e Busca conforme o campo. Conferir que desfazer não atua após mover o cursor.
7. Em senha, conferir ausência de sugestões e autocorreção; em e-mail/URL,
   conferir ausência de maiúscula automática e correções.
8. Testar símbolos, linha de números, tamanho, vibração, modo paisagem e navegação por gestos.
9. Usar o app de notas, navegador e WhatsApp; conferir reabertura e troca de teclado.
10. Desativar maiúsculas e autocorreção nas opções e reabrir o teclado.

Limitações conhecidas: capitalização por pontuação pode interpretar abreviações
e casas decimais como fim de frase; dicionário reduzido; interface clara fixa;
sem repetição de Backspace ao manter pressionado; sem integração de IA.
