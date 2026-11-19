# CENA IA — compilação pelo Code on the Go (sem GitHub Actions)

**Estado:** procedimento de preparação. Nenhum APK 0.27.4 foi compilado ou validado pelo Code on the Go ainda.

## Projeto e aparelho
- IDE: [Code on the Go](https://appdevforall.org/code-on-the-go/) para Android ARM64 (Release 26.47, 17/11/2026).
- Código: repositório privado `helbermoura2/teclado-br`, branch `codex/cena-redesign`.
- Raiz Gradle do aplicativo: **`cena/android`**, não o diretório principal de `teclado-br` (que contém outro aplicativo).
- Pacote da instalação: `app.cena.mobile`.
- Versão do código: `0.27.4`, `versionCode=61`, `minSdk=26`, `targetSdk=35`.
- A configuração atual usa Android Gradle Plugin 8.9.2, Kotlin 2.1.20, Android SDK 35 e NDK 28.0.13004108.
- Abrir/importar o projeto a partir de uma **cópia local autenticada** do repositório; não tornar o código privado público para facilitar o download.

## O que é necessário instalar
1. Instalar a versão ARM64 atual do Code on the Go no telefone, pelos downloads oficiais.
2. Na primeira execução, concluir a configuração das ferramentas e instalar os componentes de SDK requeridos.
3. Consultar **Preferences → Add-ons Manager** para suporte de C++/NDK se houver necessidade de reconstruir as bibliotecas nativas. O plugin oficial NDK Installer existe, mas a capacidade de compilar a biblioteca CENA/llama.cpp neste aparelho **ainda precisa ser testada**.
4. Abrir a raiz Gradle `cena/android` e tentar sincronização e compilação. **Não forçar upgrade de AGP/Kotlin sem antes testar**; a versão atual da IDE pode exigir ajustes de compatibilidade.

## Dependências que impedem considerar um APK automaticamente pronto
- O CENA usa `libcenallm.so` (IA local em C++ com llama.cpp), que **não fica versionada** no repositório; nas versões antigas, era gerada por `cena/scripts/build-local-ai.sh` em ambiente Linux com NDK e commit específico do llama.cpp.
- O script atual de geração da biblioteca assume NDK Linux x86_64 e constrói ARM64 e x86_64; por isso **não roda sem adaptação no Android/Code on the Go**. Não publicar APK sem testar a integração nativa.
- A preparação do modelo visual e a instrumentação Android também eram executadas separadamente pelo processo de publicação. Um Gradle build simples não substitui todos esses testes.
- Há testes JavaScript e de navegador que devem continuar passando. O último workflow de publicação no GitHub falhou antes da geração do APK.

## Assinatura e atualização dos dados
**ATENÇÃO:** para instalar sobre a versão 0.23.0 já instalada, o APK novo deve usar **a mesma chave de assinatura**, o `applicationId` `app.cena.mobile` e um `versionCode` superior. Uma assinatura própria/aleatória do Code on the Go não permite atualizar essa instalação.

- O keystore antigo é armazenado **privadamente** em um release interno chamado `cena-internal-signing` no repositório `helbermoura2/teclado-br`.
- Não mover essa chave para repositório público, não colar a chave ou seus bytes em chats e não incluí-la em arquivos de projeto com commit.
- `cena/android/app/build.gradle.kts` já aceita a variável de ambiente `CENA_KEYSTORE_PATH` para apontar para a chave anterior durante a assinatura debug. A IDE precisa disponibilizar uma forma local e segura de apontar para ela; isto não foi validado.
- Confirmar a identidade do certificado com o APK 0.23.0 **antes** de instalar; comparar certificados, não nomes de arquivo.
- **Não desinstalar** o CENA existente para tentar instalar uma compilação incompatível. Isso pode causar perda de dados locais.

## Exportar e instalar
- Desde a release 26.45, o Code on the Go armazena APKs em diretório privado. Para obter o arquivo, usar **Export** no controle de comandos do próprio IDE.
- Antes de instalar: conferir versão, `app.cena.mobile`, arquitetura ARM64, dependência nativa e identidade de assinatura. Só então testar instalação sobre a versão anterior.

Referências:
- https://appdevforall.org/code-on-the-go/
- https://appdevforall.org/cogo-r2-smaller-faster-more-powerful/
- https://addons.appdevforall.org/
- https://github.com/appdevforall/addons/blob/main/cotg-ndk/README.md
