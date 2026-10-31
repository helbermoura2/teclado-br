# Testes no Nothing Phone (1)

Os testes unitários cobrem o motor de texto, o cache de contexto e o estado da barra.
O teste de instrumentação da versão 0.5.0 injeta eventos de toque e compara o texto
real do editor em processo separado. Os resultados da execução ficam no artefato
`teclado-br-telas-android`, arquivo `typing-results.txt`. Os cenários abaixo continuam
necessários no Nothing Phone (1); emulador não mede a latência percebida no aparelho.

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
sem integração de IA.

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


## Digitação rápida e barra deslizante (0.5.0)

O teste `KeyboardStressInstrumentation` roda somente em builds debug e usa a
interface real do teclado. Injeta 100 pares de letras com dois dedos simultâneos,
alternando qual dedo é solto primeiro. Compara os 200 caracteres finais, registra
reconstruções do teclado e consultas de contexto na thread principal. O tempo
registrado inclui injeção síncrona de eventos no emulador, não é medida de latência
de toque nem representa velocidade máxima no Nothing.

Também verifica cópia/recorte/colagem, sugestões encadeadas `como você está`,
preservação de `comovov` nas sugestões, acento sem letra duplicada, maiúsculas e
correções em `ola. voce `, rolagem da barra e aviso de IA offline não instalada.

No Nothing, repetir:

1. Digitar rapidamente com dois polegares, inclusive alternando letras na mesma
   linha e entre linhas, e conferir ausência de letras perdidas ou trocadas.
2. Digitar `como `, escolher `você`, depois `está` e verificar `bem` nas sugestões.
3. Digitar palavra inexistente, nome e texto longo; verificar que a barra não some.
4. Deslizar a barra de atalhos nos dois sentidos e usar copiar/colar após selecionar.
5. Manter uma vogal e escolher acento; conferir uma única letra acentuada.
6. Segurar Backspace e verificar repetição; soltar e conferir parada imediata.
7. Repetir em WhatsApp, navegador e notas, incluindo seleção e mudança de cursor.
8. Conferir explicitamente os avisos de IA offline ausente e lupa em desenvolvimento.


Resultado automatizado da 0.5.0: PASS em Android 15 AOSP, commit
`b9ac19523e3f792d002b42dc9b75b866099f1946`, execução
https://github.com/helbermoura2/teclado-br/actions/runs/41201671536.
200 caracteres completos na ordem esperada, 0 reconstruções durante a sequência,
0 consultas de contexto na thread principal, 96 consultas em segundo plano
registradas até o fim da sequência. Duração da injeção: 34.453 ms, incluindo
sobrecarga do emulador; não é benchmark de latência nem simulação de velocidade
máxima. Alguns PNGs capturam transições antes da composição final, portanto
são evidência visual parcial. O resultado textual compara o editor via acessibilidade.


## Subteclas por pressão longa (0.5.1)

1. Manter N pressionado e verificar `?` no texto antes de soltar; soltar não duplica.
2. Manter E pressionado, deslizar até Ê/ê e soltar no mesmo gesto; não tocar outra vez.
3. Manter E e soltar sem mover: inserir a primeira opção É/é.
4. Manter E, arrastar para longe das opções e soltar: cancelar sem letra residual.
5. Tocar E brevemente: inserir somente E/e.
6. Repetir com Shift, nas vogais das bordas A/O/U e com dois polegares,
   verificando que uma pressão antiga não substitui texto digitado depois.


Automação 0.5.1: PASS em Android 15 AOSP (540×1170 / 220 dpi), execução
https://github.com/helbermoura2/teclado-br/actions/runs/41203751306,
commit `df29b7b349f3df79fc1791fb48e5acadcf8e78ec`.
Comparações reais do texto confirmaram os cenários 1–5 acima. Capturas confirmam
painel acima da tecla, opção Ê/ê destacada durante o gesto e somente o acento após
soltar; a captura do símbolo mostra `?` enquanto N permanece pressionado.
A regressão de 200 caracteres sobrepostos passou sem reconstruções nem leituras de
contexto na thread principal. O tempo de injeção de 28.101 ms inclui sobrecarga do
emulador e não mede a latência no telefone. Cenário 6 permanece para teste manual.
