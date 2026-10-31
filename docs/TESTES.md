# Testes no Nothing Phone (1)

Os testes unitários cobrem o motor de texto e o estado da barra. A compilação
e um teste de capturas em emulador Android 15 passaram. As capturas confirmaram
tema escuro, espaço da navegação e alternância da barra; o teste de capturas não
confere automaticamente o texto inserido. Os cenários abaixo continuam sendo
a lista de validação no Nothing Phone (1).

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
e casas decimais como fim de frase; dicionário reduzido; interface escura fixa;
sem repetição de Backspace ao manter pressionado; sem integração de IA.

## Barra e aparência (0.2.0)

1. Abrir o teclado e conferir fundo preto, teclas cinza e atalhos na barra superior.
2. Digitar: conferir recolhimento dos atalhos e três posições para sugestões, sem salto de altura.
3. Tocar na seta: reabrir atalhos, depois voltar às sugestões; repetir após apagar e selecionar sugestões.
4. Digitar `É assim ` e conferir sugestões `que`, `mesmo`, `como`.
5. Copiar um texto em outro aplicativo e tocar em colar; conferir bloqueio no campo de senha.
6. Abrir emojis, inserir um emoji e apagar; conferir símbolos por pressão longa nas letras.
7. Abrir configurações e menu de opções. IA e tradução devem informar que estão em desenvolvimento.
8. Comparar as teclas em retrato/paisagem e com fonte ampliada. Conferir que acentos e emojis não saem da tela.

## Assistente de escrita (0.3.0)

1. Digitar `voce tem opcoes`, abrir estrelas e Ortografia e gramática. Conferir
   o aviso de revisão limitada e a prévia `você tem opções` (capitalização conforme a entrada).
2. Conferir que abrir a prévia não altera o texto original; testar Copiar.
3. Editar a prévia com as teclas, apagar um emoji e concluir sem aplicar.
4. Tocar em Substituir: só o trecho selecionado deve mudar; sem seleção, o campo inteiro.
5. Alterar o texto/seleção no app antes de Substituir: deve bloquear e pedir nova revisão.
6. Abrir Estilo de escrita e conferir os cinco tons. Ao tocar, deve informar que IA não está conectada.
7. Conferir o mesmo aviso em Resumir e Compositor, sem resultados inventados.
8. Testar campos vazios, senhas, seleção invertida, campo inacessível e texto acima de 6.000 caracteres.
9. Testar marcadores e tabela Markdown na prévia antes de aplicar.
10. Voltar ao teclado, trocar de aplicativo e conferir que a prévia anterior foi descartada.

## Barra de edição (0.4.0)

Executado no emulador Android 15 AOSP: seleção total, cópia, exclusão da seleção
sem alterar o clipboard, colagem, recorte e nova colagem com igualdade do texto
original. As capturas mostram estados dos botões e a barra mantendo a altura.
[Execução](https://github.com/helbermoura2/teclado-br/actions/runs/41197980035).
Os demais cenários abaixo continuam como validação manual.

1. Abrir o ícone de edição na barra de atalhos e conferir Selecionar tudo, Copiar,
   Recortar, Colar, setas e menu, sem mudar a altura da barra.
2. Sem seleção, Copiar e Recortar devem ficar desativados.
3. Selecionar tudo e copiar. Apagar a seleção com a tecla de apagar do editor e colar:
   deve restaurar o texto copiado, incluindo acentos.
4. Selecionar tudo, recortar e colar: deve restaurar o texto sem duplicação.
5. Selecionar um trecho no app, copiar/recortar só esse trecho e conferir a colagem.
6. Mover cursor com as setas, inclusive perto de caracteres acentuados e emojis.
7. Retornar à barra anterior e digitar para mostrar sugestões.
8. Em senha/PIN, ações de área de transferência devem estar desativadas.
9. Testar Desfazer/Refazer no menu; apps que não aceitam devem informar indisponibilidade.
10. Repetir em notas, navegador e WhatsApp no Nothing Phone (1).
