CENA IA 0.6.0 — importar a biblioteca do Stremio pelo celular.

Instale sobre a 0.5.1, sem desinstalar. A lista local, capas, conexão e histórico Trakt são preservados.

1. Abra Conectar → Importar biblioteca do Stremio → Conectar Stremio.
2. Toque em Autorizar no Stremio. Entre na sua conta no site oficial e confirme a vinculação. Sua senha não é informada ao CENA.
3. Volte ao CENA e toque em Ler biblioteca.
4. Confira os novos, os que já estão no CENA e os que ainda não têm identificador compatível. Selecione os novos e toque em Importar.
5. Se quiser esses novos no Nuvio, marque Enviar também ao Trakt antes de importar. Use a mesma conta Trakt no Nuvio.

A leitura inclui filmes e séries realmente salvos na biblioteca. Registros removidos ou temporários são excluídos. O CENA consulta o índice e lê os registros em lotes, com progresso, cancelamento e aviso se algum registro não for devolvido.

Os novos entram em Quero assistir; títulos existentes não são substituídos. Não deduzimos que um título foi assistido só porque está na biblioteca. Os checks de assistido continuam vindo do Trakt. IDs personalizados (por exemplo, kitsu) aparecem separados, sem inventar uma correspondência pelo nome. A versão aceita até 2.000 títulos locais e uma prévia de até 5.000 títulos ativos; nunca corta a lista silenciosamente.

O CENA não adiciona, remove nem marca nada no Stremio. Desconectar apaga apenas o acesso e a prévia Stremio guardados no CENA; os títulos já importados permanecem. A sessão é criptografada no Android Keystore e não entra no JavaScript, nos logs ou na exportação da lista. O Stremio fornece uma sessão completa, não uma permissão tecnicamente limitada à leitura; o CENA restringe suas operações a leitura e não chama a API de escrita ou logout.

A integração usa o protocolo do cliente oficial, sem garantia de estabilidade de API pública. O teste anônimo confirma a criação do link e a resposta de espera; os testes automatizados de conta/biblioteca usam respostas simuladas. A autorização e leitura da conta real precisam ser conferidas pelo usuário no celular após instalar.
