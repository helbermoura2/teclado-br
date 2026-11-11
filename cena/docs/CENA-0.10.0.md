# CENA 0.10.0 — Nuvio direto experimental

Em Conectar → Nuvio direto, gere o código, autorize no navegador oficial do Nuvio e escolha o perfil. No Nuvio do celular e da TV, use a mesma conta/perfil e Nuvio Sync como fonte do progresso.

Consulta os endpoints de assistidos e progresso usados pelo Nuvio. Filmes compatíveis presentes no catálogo recebem o check; episódios são contados separadamente, sem marcar toda a série como concluída. Continuar assistindo aparece no Início. A escolha de Nuvio impede que consultas Trakt sobrescrevam esses estados.

Login por código: senha não entra no CENA. Sessões e histórico ficam protegidos pelo Android Keystore; tokens, nonce e código privado não chegam ao JavaScript. A conexão só consulta histórico/progresso e não altera a biblioteca do Nuvio. A lista enviada ao player ainda usa a integração Trakt existente.

Consulta ao abrir, a cada cinco minutos com o CENA em primeiro plano e programação a cada doze horas em segundo plano, sujeita às restrições de bateria do Android. Dados antigos são preservados em falhas temporárias. Perfis protegidos por PIN e IDs que não sejam IMDb ainda não têm suporte completo. Não há correspondência por nome que possa marcar o filme errado.

Compatibilidade experimental: usa APIs identificadas no código público do Nuvio Mobile (DeviceLinkAuthRepository, SupabaseWatchedSyncAdapter e SupabaseProgressSyncAdapter). O login e a gravação de uma reprodução real ainda precisam ser confirmados com a conta/dispositivos do usuário. Os testes de autenticação, perfis, paginação e histórico usam respostas simuladas; há apenas uma checagem pública de configuração sem criar sessões ou escrever dados.

Instale por cima da versão atual para preservar listas e conexões. Mantém o pacote ARM64 enxuto e as notas públicas IMDb.
