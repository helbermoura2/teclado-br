CENA IA 0.5.0 — Trakt, assistidos, Stories e ícone.

Instale por cima da 0.4.3, sem desinstalar.

- Conectar → Trakt: configuração do Client ID público da integração e autorização por código no navegador. Tokens ficam cifrados no Android Keystore, fora do WebView. O cadastro externo do aplicativo Trakt é obrigatório; nenhum Client Secret é pedido ou embutido.
- Fila persistente para enviar/remover da watchlist, tarefas de rede em segundo plano e atualização ao abrir o CENA. Pendências e falhas ficam visíveis; sem fingir sucesso offline.
- Leitura do histórico Trakt para check de filmes assistidos. Nuvio precisa usar a mesma conta e registrar reproduções no Trakt. Séries mostram episódios vistos, sem marcar a série inteira por um episódio.
- Card PNG 1080×1920, frase personalizada, identificação de assistido e logo. Compartilhar pelo seletor Android ou Salvar PNG; a publicação é concluída pelo usuário no Instagram. Não há publicação automática nem integração Meta cadastrada.
- Ícone adaptativo com marca CENA no launcher Android.

Limite de validação: protocolos e filas são testados com respostas simuladas, além dos testes reais de catálogo e Android. Autorização e sincronização ponta a ponta com uma conta Trakt/Nuvio pessoal dependem do Client ID cadastrado e da autorização no celular; não foram feitas por estes testes.
