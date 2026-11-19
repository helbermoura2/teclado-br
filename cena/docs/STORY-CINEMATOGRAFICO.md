# CENA IA — Story cinematográfico de filmes e séries

## Referência visual
A composição aprovada para compartilhar é uma imagem vertical de **1080 × 1920 px** (sem incluir barra de status ou controles do celular), com:
- fotografia/cena do título ao fundo e degradê escuro;
- marca oficial CENA IA na parte superior, reposicionável;
- ano e categoria, título em destaque e subtítulo com acabamento dourado;
- nota pessoal / 10, estrelas douradas e resenha do usuário;
- quadro largo de vidro fosco **ONDE ASSISTIR NO BRASIL**, ícones dos serviços e modalidade (assinatura/aluguel/compra/cinema), quando os dados existem;
- fundo roxo, marca d'água e crédito **TMDB / JustWatch** na área inferior.

## Funcionalidade
1. Abrir o filme/série e escolher compartilhar como Story.
2. Digitar uma nota de 0 a 10 (vírgula ou ponto; opcional) e a resenha; a prévia é atualizada imediatamente.
3. Manter **Incluir onde assistir** selecionado para exibir os serviços recebidos do TMDB/JustWatch (não inventar plataformas).
4. Reposicionar o logo com o controle ou arrastando na prévia; dados e posição são salvos por título.
5. Usar **Compartilhar imagem** para abrir a folha nativa de compartilhamento Android ou **Salvar imagem PNG** para guardar a arte.

## Detalhes técnicos
- Renderizador: `web/story-layout.js`; editor: `web/story-editor.js`; imagens: `web/story-artwork.js`.
- Backdrop disponibilizado pelo catálogo quando houver; sem backdrop, o poster funciona como fallback. A arte varia por título, mas a identidade visual é padronizada.
- O conteúdo é gerado em canvas real; não é uma máscara/screenshot sobre o aplicativo.
- Nota, resenha, título e posição do logo são preferências locais do usuário.
- O painel de streaming foi ampliado para 900px. Com resenhas muito extensas e diversas modalidades, são mostradas as opções prioritárias que couberem na exportação.
- Não compartilhar informações de serviços sem resposta válida da consulta; se nenhum serviço for encontrado, o editor informa explicitamente essa condição.
- O PNG usa a ponte Android já existente (`saveStory`/`shareStory`), com URIs acessíveis ao sistema.
- O código foi escrito na branch de desenvolvimento; a nova versão do APK ainda precisa ser compilada, assinada e testada em dispositivo Android. Nenhuma release foi publicada por este ajuste.

## Verificações
- `cd cena && npm test`
- `cd cena && npm run check`
- Android: rodar `StoryExportTest` e conferir preview, salvar e compartilhar no dispositivo real.

A disponibilidade em streaming pode mudar; a fonte da consulta e o momento da atualização devem continuar sendo apresentados de forma transparente.
