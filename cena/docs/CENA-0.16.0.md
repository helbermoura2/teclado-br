# CENA 0.16.0 — nova interface e atualizações

Visual escuro com painéis translúcidos, notas sobre as capas e uma prateleira de últimos vistos na tela inicial. Os últimos vistos usam eventos importados do Trakt, exibem data e episódio e respeitam a conta ativa.

Em Conectar, o botão de atualizações consulta o repositório público cena-downloads. Quando houver versão mais recente, baixa o APK para o cache privado e verifica tamanho, SHA-256, nome do pacote, versão e assinatura instalada antes de abrir o instalador do Android. O usuário precisa confirmar a instalação e, na primeira vez, autorizar o CENA a instalar aplicativos. O recurso exige uma versão instalada que já contenha o botão.

Os ícones dos serviços são consultados no TMDB para o Brasil, com dados do JustWatch. Para ativar, informe no aplicativo uma chave de API v3 da sua conta TMDB; ela fica criptografada no dispositivo. Serviços por assinatura, gratuitos e com anúncios são identificados quando disponíveis; aluguel e compra não são exibidos como assinatura. Caso não haja dados, nenhum serviço é inventado.

Instale sobre a versão atual, sem desinstalar, para preservar seus dados e conexões.
