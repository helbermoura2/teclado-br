# CENA · Seu próximo play

Primeira base do aplicativo Android para fotografar capas, montar uma lista de filmes e séries e consultar essa lista como um catálogo no Stremio/Nuvio. Tema escuro com roxo, conforme o conceito visual da conversa.

## Compilação na nuvem, sem computador

O fluxo `.github/workflows/cena-android.yml` instala as ferramentas no GitHub Actions, executa os testes e compila `CENA-preview.apk`. Ele aceita o projeto na raiz do repositório ou dentro da pasta `cena/` e roda em pushes para `main` ou `cena/**`.

Pelo celular, abra a execução em **Actions**, aguarde o sucesso e baixe **CENA-Android-APK** na seção Artifacts. Extraia o ZIP no gerenciador de arquivos e abra `CENA-preview.apk`. O Android pode solicitar que você autorize a instalação pelo aplicativo que abriu o arquivo. O APK é de teste, assinado com a chave de debug da execução; não é uma publicação na Play Store. A chave é mantida no cache do Actions, mas, se esse cache expirar, uma versão posterior pode exigir desinstalar a anterior, perdendo os dados locais.

O aplicativo agora inicia em **modo local**, sem exigir servidor. A lista fica salva no aparelho; câmera/OCR e geração de cards estão preparados no código nativo. A busca inicial tem seis títulos de amostra. A conexão a um servidor HTTPS é opcional, pela aba Conectar; ela cria uma lista remota separada, preservando a lista local. A sincronização com Stremio/Nuvio ainda requer hospedar esse servidor e validar nos players.

## O que esta versão entrega

- Interface responsiva: início, catálogo, captura, detalhes e conexão.
- Busca de filmes e séries: seis títulos de amostra por padrão; busca no TMDB ao configurar um token no servidor.
- Lista persistente no servidor, sem duplicatas, com estados “Quero assistir” e “Assistido”.
- Complemento de **catálogo** no formato Stremio, com listas separadas para filmes e séries e IDs IMDb. Adições e remoções aparecem na próxima consulta ao servidor. O player pode manter seu próprio cache.
- Projeto Android em Kotlin que inclui a interface localmente, abre a câmera do sistema e lê texto da capa com ML Kit no aparelho. O usuário confirma o título por meio da busca. As fotos são temporárias e não são enviadas ao servidor.
- Gerador local de imagem vertical 9:16 para Stories. No Android, entrega um PNG ao compartilhamento do sistema. A publicação é concluída no Instagram pelo usuário.
- Código privado de recuperação para conectar outro aparelho à mesma lista. O link do catálogo só dá acesso de leitura.

## Estado real da entrega

**Servidor, catálogo e lista local: sete testes automatizados passaram.** Os testes usam o manipulador HTTP real em memória porque este ambiente proibiu abrir portas, inclusive localhost.

**Android: código-fonte preparado, ainda não compilado nem executado em aparelho.** Não há APK nesta entrega. O ambiente não disponibilizou Android SDK/Gradle nem acesso funcional ao registro de dependências. O Chromium também não iniciou neste sandbox; a interface ainda precisa de teste visual e de interação em navegador/aparelho.

**Stremio e Nuvio: o protocolo de catálogo está implementado e testado no servidor; a instalação e a leitura nos aplicativos ainda precisam de teste real.** Não há sincronização da biblioteca interna deles, nem atualização de assistidos do player para o CENA. Não há Trakt nesta versão.

O reconhecimento é **leitura de texto da capa**, não identificação visual completa por IA. Uma capa sem título legível pode exigir busca manual. A prévia web permite escolher/fotografar uma imagem e digitar o título; o OCR está apenas no projeto Android.

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
