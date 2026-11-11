# Stremio → CENA

A integração 0.6.0 usa o fluxo Link v2 do cliente oficial Stremio. Não requer cadastro de Client ID, assinatura, serviço de IA pago ou senha enviada ao CENA.

Referências: [LinkRequest e DatastoreRequest](https://github.com/Stremio/stremio-core/blob/development/src/types/api/request.rs), [modelo Link](https://github.com/Stremio/stremio-core/blob/development/src/models/link.rs), [LibraryItem](https://github.com/Stremio/stremio-core/blob/development/src/types/library/library_item.rs).

Operações nativas permitidas:

- GET https://link.stremio.com/api/v2/create?type=Create
- GET https://link.stremio.com/api/v2/read?type=Read&code=…
- POST https://api.strem.io/api/getUser
- POST https://api.strem.io/api/datastoreMeta, collection libraryItem
- POST https://api.strem.io/api/datastoreGet, collection libraryItem, ids em lotes de 100, all false

O teste anônimo real de 02/11/2026 confirmou create HTTP 200 e read antes da autorização HTTP 200 com error 101, "Invalid or expired token". Esse erro é também a resposta de espera, portanto não deve encerrar a tentativa automaticamente; o cliente para de consultar após dez minutos e permite gerar outro link. Não presumimos que dez minutos seja o prazo contratual do servidor.

A autorização abre exclusivamente um link HTTPS em link.stremio.com no navegador externo. Não há login, senha ou token no WebView. A sessão tem poder mais amplo no provedor: só a implementação CENA é limitada a leitura. A confirmação getUser precisa funcionar antes de aceitar a sessão. Chaves e links ficam em cofre AES-GCM/Android Keystore separado do Trakt; os nomes e aliases existentes do Trakt permanecem idênticos.

A tela recebe somente conta mascarada, estado, progresso e registros leves da biblioteca. Seleção e importação ficam locais, por par tipo/IMDb exato. O importador não substitui registros existentes, não infere histórico e não faz escrita Stremio. Enviar ao Trakt é uma opção explícita, desmarcada por padrão, limitada aos novos selecionados.

Limites: 20.000 registros de índice, 5.000 ativos na prévia, 2.000 títulos locais. Erro preserva a prévia anterior, bloqueia sua importação até uma leitura bem-sucedida e não altera a lista local. Leituras parcialmente devolvidas são avisadas. Cancelar preserva os dados. Desconectar remove apenas a sessão/cache locais; não usa logout remoto.

Testes: reducer JS para filtros, duplicados, seleção, estado e limites; repositório Android com Keystore real e transporte simulado para espera, privacidade, paginação, falha, IDs personalizados, parcialidade e isolamento; navegador com fluxo de seleção e envio opcional; atualização assinada sobre a 0.5.1. O acesso à conta real depende da autorização do usuário no celular, ainda não é uma validação efetuada pelo agente.
