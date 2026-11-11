# Integração da biblioteca CENA → Nuvio

Análise de 2026-11-01. Ainda não implementada e sem autenticação real testada.

## Objetivo

Adicionar pelo CENA e encontrar o mesmo IMDb na lista Quero assistir da biblioteca Nuvio, no telefone e na TV. Um catálogo de complemento não equivale à biblioteca pessoal.

## Opção 1: Trakt como ponte (recomendada para a primeira integração)

O código oficial NuvioTV contém TraktLibraryService, que carrega filmes e séries de getUserWatchlist, cria a aba WATCHLIST e permite adicionar/remover por IDs. TraktSettingsDataStore permite selecionar o modo da fonte de biblioteca. O CENA já mantém IDs IMDb, compatíveis com essas operações.

Fluxo proposto: fotografar/importar → confirmar o filme → salvar localmente → enviar à watchlist Trakt → Nuvio com a mesma conta e biblioteca Trakt carrega a lista ao atualizar. Requer selecionar a fonte correta em cada dispositivo. Não é envio instantâneo para uma TV offline.

Requisitos pendentes: registrar um cliente OAuth próprio CENA no Trakt; autenticação oficial Authorization Code com PKCE no navegador do celular (sem client_secret no app); tokens no Android Keystore, renovação/revogação; fila local de operações com retentativas e estado visível; não apagar títulos externos automaticamente; validar filme/série no celular e TV reais. Não reutilizar credenciais do Nuvio e não colocar segredo de cliente em assets do WebView. O acesso Standard é gratuito segundo a política vigente. O cadastro do app exige GitHub verificado no portal Trakt; é possível fazer pelo navegador do celular. Contas gratuitas têm limites de comunidade/listas que devem ser tratados na interface.

## Opção 2: conta Nuvio diretamente

O NuvioTV usa Supabase autenticado e RPCs sync_pull_library, sync_push_library_items, sync_delete_library_items, com perfil, revisão/cursor e identidade de cliente. É uma integração interna do próprio Nuvio. O repositório aberto não garante contrato público estável para terceiros.

Vantagem: manter a biblioteca nativa Nuvio e os perfis já existentes. Pendências: confirmar autorização oficial para cliente externo, autenticação adequada sem recolher a senha no CENA, formatos/conflitos de perfis, manutenção se o backend mudar, e teste no Nuvio Mobile e TV. Não deve ser tratado como pronto só por conhecer os endpoints.

## Fontes primárias

- https://github.com/NuvioMedia/NuvioTV/blob/dev/app/src/main/java/com/nuvio/tv/data/repository/TraktLibraryService.kt
- https://github.com/NuvioMedia/NuvioTV/blob/dev/app/src/main/java/com/nuvio/tv/data/local/TraktSettingsDataStore.kt
- https://github.com/NuvioMedia/NuvioTV/blob/dev/app/src/main/java/com/nuvio/tv/data/remote/supabase/SupabaseLibrarySyncRemoteDataSource.kt
- https://developer.trakt.tv/docs/authentication-oauth
- https://developer.trakt.tv/docs/api-use-policy
- https://github.com/NuvioMedia/NuvioMobile/blob/cmp-rewrite/composeApp/src/commonMain/kotlin/com/nuvio/app/features/trakt/TraktLibraryRepository.kt

## Aceite da próxima etapa

Adicionar um filme e uma série no CENA; comprovar presença na watchlist remota e nas bibliotecas Mobile/TV com a mesma conta; testar sem internet/repetição/revogação; informar sincronização pendente/erro sem fingir sucesso. Contas pessoais não foram acessadas nesta análise.
