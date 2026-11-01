# CENA IA · Seu próximo play

Protótipo Android para fotografar capas ou importar prints, identificar filmes e séries, montar uma lista e gerar cards para Stories. Tema escuro com roxo.

## Instalar pelo celular

A versão 0.4.1 é distribuída como **CENA IA**, identificador `app.cena.mobile`. Ela instala ao lado do antigo CENA (`app.cena`): a assinatura das versões anteriores não foi preservada corretamente. Não desinstale o antigo se precisar dos dados dele. A lista antiga não é transferida automaticamente.

Depois de todos os testes passarem, o GitHub Actions publica `CENA-0.4.1.apk` na prévia privada **cena-v0.4.1**. Baixe o APK diretamente pela área Releases do repositório, usando sua conta GitHub, e instale no Android 8 ou superior. Não exige PC nem extrair ZIP. Confira **v0.4.1** ao lado do logo ao abrir. O arquivo inclui o modelo visual e tem aproximadamente 120 MB.

A identidade de assinatura desta nova distribuição é persistida em um asset de release **privada e em rascunho** (`cena-internal-signing`), utilizada tanto na compilação quanto nos testes Android. Não publique nem exclua esse rascunho: atualizações futuras dependem da mesma chave. Trata-se de assinatura de protótipo, sem publicação na Play Store.

## O que esta versão entrega

- Início, catálogo, captura, detalhes e conexão.
- Câmera, galeria, prints recebidos por compartilhamento e recorte da imagem.
- OCR ML Kit no aparelho, reconstrução de títulos em várias linhas e busca tolerante a erros no catálogo público Wikipedia/Wikidata, sem token de API.
- IA visual CLIP quantizada e ONNX Runtime no aparelho para comparar sua imagem com capas candidatas. As fotos não são enviadas a um serviço de IA. As consultas de texto e o download das capas exigem internet.
- Lista local persistente, com “Quero assistir” e “Assistido”; você confirma o título antes de adicionar.
- Card vertical 9:16 compartilhado como PNG. O usuário conclui a publicação no Instagram.
- Servidor opcional com lista remota, recuperação por credencial privada e complemento de catálogo compatível com Stremio.

## Validação e limites

Os testes incluem 20 verificações de lógica, buscas reais dos textos incorretos relatados, comparação visual das duas fotos fornecidas, validação do APK empacotado, navegação no navegador e testes Android 15 da interface, OCR e modelo visual. A publicação do APK depende da validação do OCR Android contra o catálogo. As fotos de regressão ficam somente nos testes do repositório privado; não entram no APK.

A comparação visual depende de candidatos encontrados pelo texto. Não é identificação universal de qualquer imagem: pode falhar e requer conferência do título e do ano.

**Stremio/Nuvio: a sincronização não está ativa no modo local.** O protocolo de catálogo está implementado no servidor, que ainda precisa ser hospedado e validado nos players. Não há sincronização da biblioteca interna dos players, retorno de assistidos ou integração Trakt nesta versão.

## Rodar a prévia no computador

Requer Node.js 22 ou superior. Não precisa de `npm install`.

```sh
cd cena
npm start
```

Abra **http://localhost:3000**. Busque “Duna”, “Matrix”, “Interestelar”, “Stranger Things”, “Breaking Bad” ou “Game of Thrones”. Os pôsteres precisam de internet; sem ela, o título aparece em uma capa substituta.

Roteiro rápido:

1. Abra **Catálogo**, busque “Duna” e toque no resultado.
2. Toque em **Quero assistir**. A lista é criada automaticamente e salva no servidor.
3. Abra **Conectar** e copie o link do complemento.
4. Abra esse link no navegador: o manifest deve aparecer em JSON.
5. Substitua `manifest.json` por `catalog/movie/cena-watchlist.json` para ver o catálogo contendo o título.
6. No CENA, marque como assistido e consulte o catálogo novamente: o título sai de “Quero assistir”, mas permanece no histórico do CENA.
7. Nos detalhes, toque em **Criar Story** para gerar/baixar o card. Um pôster indisponível gera um card com o título.

Para verificar o código:

```sh
npm run check
npm test
```

## Ativar a busca completa

Crie uma credencial no [TMDB](https://www.themoviedb.org/settings/api). Use o **API Read Access Token** no servidor, nunca no código do celular.

```sh
export TMDB_READ_TOKEN='seu-token-de-leitura'
npm start
```

Os resultados são consultados em português e convertidos para IDs IMDb. Títulos sem um ID IMDb retornado pelo TMDB são omitidos para evitar resultados que o player não saiba resolver. A chamada real ao TMDB não foi validada neste ambiente; a conversão está coberta por teste com resposta controlada.

O projeto usa imagens/metadados do TMDB e não é endossado ou certificado pelo TMDB. Antes de distribuição pública, revisar os requisitos atuais de atribuição, incluindo a marca aprovada e os termos da API.

## Usar a mesma lista no Android e no player

Hospede o servidor em uma origem **HTTPS** acessível ao celular e ao player, com armazenamento persistente para `DATA_DIR`.

```sh
export PUBLIC_BASE_URL='https://cena.seu-dominio.com'
export DATA_DIR='/caminho/persistente/cena'
export TMDB_READ_TOKEN='seu-token-de-leitura'
npm start
```

Finalize o TLS em um proxy/host apropriado que encaminhe para a porta 3000. Não confie no endereço `localhost` para outro aparelho. `PUBLIC_BASE_URL` é a origem externa, sem caminho, usuário ou senha.

No Android, preencha o endereço HTTPS na aba **Conectar**. O app cria uma lista nesse servidor. Para usar uma lista que já existe, copie o **código de recuperação** do dispositivo original e cole no novo dispositivo. Esse código contém a permissão de escrita: guarde como uma senha. O link de instalação do complemento permite ler seus títulos, então compartilhe apenas com quem pode vê-los.

No Stremio, instale o manifest pela área de complementos. No Nuvio, tente o mesmo link na instalação de complementos compatíveis. Procure os catálogos **CENA · Filmes para assistir** e **CENA · Séries para assistir**. A posição dos menus e o suporte efetivo precisam ser confirmados na versão instalada de cada player.

O fluxo é: **CENA → servidor → catálogo consultado pelo player**. Nenhuma foto, token TMDB ou credencial de edição é incluída no manifest.

## Compilar o Android

Abra a pasta `android/` no Android Studio. Requisitos do projeto: JDK 17, Android SDK 35 e Gradle 8.11.1 (compatível com Android Gradle Plugin 8.9.2). Este repositório não inclui um Gradle Wrapper binário. Configure a instalação local do Gradle no Android Studio ou, com Gradle 8.11.1 instalado, execute:

```sh
cd android
gradle wrapper --gradle-version 8.11.1
./gradlew assembleDebug
```

As dependências AndroidX e o modelo de OCR serão baixados durante a primeira compilação. A interface em `web/` entra nos assets do APK por `sourceSets`; não há cópia manual nem etapa de Node no build Android.

O APK de debug será gerado em `android/app/build/outputs/apk/debug/`. Instale-o em um aparelho Android 8.0 ou superior. A câmera é acionada por intent do sistema; não se solicita permissão de acesso direto à câmera nem à galeria.

Checklist de validação no aparelho:

- Conectar ao servidor HTTPS, buscar e adicionar filme/série.
- Fotografar uma capa legível, revisar o texto detectado e confirmar um resultado da busca.
- Cancelar a câmera e negar/indisponibilizar o aplicativo de câmera, verificando a busca manual.
- Instalar o catálogo em Stremio e Nuvio; adicionar/remover no CENA e atualizar o catálogo no player.
- Fechar e reabrir o app; recuperar a lista em outro dispositivo.
- Gerar card com e sem pôster e compartilhar no Instagram instalado.

## Estrutura e limites do protótipo

- `web/`: interface compartilhada entre navegador e Android.
- `android/`: contêiner Android, OCR e compartilhamento nativos.
- `server/`: servidor Node, API, persistência e complemento de catálogo.
- `tests/`: testes de persistência, autenticação, catálogo, validação e IDs IMDb.

O arquivo `data/libraries.json` guarda as listas e credenciais locais. Faça backup e mantenha em volume privado. Este armazenamento foi pensado para **uma instância de servidor**; não execute múltiplas instâncias escrevendo no mesmo arquivo. O servidor não deve registrar URLs completas do complemento ou cabeçalhos de autorização em logs públicos.

Ainda faltam para um lançamento: testes reais Android/players, contas e revogação de acessos, banco de dados para escala, exclusão/gestão da conta, política de privacidade, distribuição assinada e validação dos termos de uso dos provedores. Não trate este protótipo como serviço público pronto.
