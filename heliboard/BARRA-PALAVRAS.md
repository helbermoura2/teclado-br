# Barra de palavras e atalhos — proposta 0.9.2

Proposta baseada no vídeo enviado em 11/11/2026. Ainda não é um APK publicado.

## Comportamento

- Campo vazio: atalhos disponíveis.
- Letras, palavras e espaços entre palavras: faixa de sugestões, sem ícones fixos
  da prancheta ou botão ＋ ocupando a largura das palavras.
- Ponto final: a faixa muda para atalhos e mantém esse estado com o espaço
  automático ou um espaço digitado após o ponto.
- Próxima letra: volta imediatamente às sugestões. Vírgula mantém sugestões.
- A pequena seta permite abrir ferramentas manualmente, como no vídeo.
  A próxima entrada ou ação de edição encerra essa abertura manual.
- ＋ para salvar a palavra do campo fica na barra expandida. Segurar uma sugestão
  continua oferecendo adicionar ao dicionário. Pins permanecem na prancheta;
  ocultar um atalho fixo não exclui o conteúdo salvo nem muda a lista de pins.

Aplica-se ao modo expansível automático com sugestões habilitadas. Modos fixos,
campos sem sugestões e restrições de senha continuam seguindo a base.
Um ponto dentro de um número/endereço deixa de ser terminal assim que chega o
próximo caractere; o teclado não tenta interpretar semanticamente uma frase.

## Implementação

ToolbarState guarda o estado das entradas; resultados de dicionário apenas
atualizam palavras, sem poder desfazer o modo após um ponto. O módulo toolbar.py
aplica o mesmo estado nas rotas de atualização, reexibição e remoção de sugestões.
A área dos atalhos usa largura flexível para o botão ＋ permanecer dentro da tela.

Entradas de texto por colagem são processadas por código Unicode: um espaço
isolado não é confundido com campo vazio. Campos/cursor e exclusões sincronizam
o contexto; letras não fazem consultas extras ao InputConnection. Renderização
por tecla só ocorre quando o modo muda. O prompt interno de IA fica separado.

## Verificação realizada

- 30 verificações Java reais de estado: digitação, vírgula, ponto, espaços,
  retomada, abertura manual, exclusão/contexto, decimais/endereço já completos,
  colagem e Unicode. Compiladas e executadas pelo compilador incluído no Java.
- Preparação dos três arquivos relevantes do upstream fixado em upstream.json:
  39 âncoras únicas aplicadas; ordem de inicialização, rotas de entrada e XML
  com largura reservada verificados.
- Python compilado; YAML conferido com gatilho somente workflow_dispatch.
- Revisão independente corrigiu posicionamento do ＋, acesso aos pins pela barra,
  tratamento de espaços colados e encerramento da abertura manual em edição.

Comandos, a partir da raiz do repositório:

```sh
java heliboard/tests/RunToolbarTests.java
python3 heliboard/tests/check_toolbar_hooks.py /caminho/HeliBoard-limpo
```

## Ainda pendente

Compilação completa Android, testes no emulador e Nothing Phone (1). Não há APK
0.9.2 gerado nem teste visual desta versão no aparelho. A máquina desta tentativa
não tem SDK/NDK; o acesso direto de rede não avançou. Os arquivos da base foram
consultados pelo conector do GitHub. Os testes Java e de preparação foram locais.

A nova fase Android verify_toolbar está preparada: toques reais, sugestões sem
ícones fixos, ponto, callbacks atrasados, retomada, expansão manual, exclusão e
retângulo do ＋ dentro da faixa. O teste de prancheta usa o atalho expandido.
Os testes existentes continuam na sequência do smoke.py.

Todos os workflows de build permanecem manuais para poupar a franquia do GitHub.
Nenhuma compilação Actions foi solicitada por esta alteração. O workflow da branch
não publica Release; a publicação continua condicionada à main e aos testes.
