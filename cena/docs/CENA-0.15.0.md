# CENA 0.15.0 — continuidade automática da TV

Corrige a importação de séries assistidas no Trakt: o inventário local deixa de filtrar /sync/watched/shows. Séries iniciadas fora de Quero assistir recebem nome, contagem e consulta de progresso por IMDb. Elas aparecem na continuidade sem serem adicionadas à lista nem gerar escritas de mídia. A consulta ao abrir/retornar ignora o cache curto de leitura, preservando bloqueios de escritas e limites da API. Com o app aberto, a consulta periódica existente atualiza as alterações; no segundo plano permanece a programação de 12 horas sujeita ao Android.

Continuar assistindo passa a mostrar episódios/filmes pausados e próximos episódios confirmados de séries iniciadas. O Trakt fornece o próximo episódio em /shows/{id}/progress/watched e, separadamente, posições de /sync/playback. A falha da consulta de pausas não apaga o histórico ou a cópia anterior. Séries fora do catálogo podem ser abertas normalmente nos detalhes. Séries recentes e mudanças de histórico são priorizadas nos lotes de consulta.

Nuvio passa a fornecer um resumo de todas as séries identificadas com suas chaves de episódios vistos, inclusive fora do inventário. O CENA consulta metadados públicos de episódios pelo mesmo IMDb, verifica o tipo/identidade e encontra o primeiro episódio lançado ainda não visto. Não usa contagem+1: lacunas, temporadas e datas ausentes são respeitadas. Catálogos incompletos ou indisponíveis não confirmam novos episódios. Metadados são consultados ao abrir a interface/receber atualizações, com cache e três solicitações simultâneas; não existe um novo servidor de scrobble.

Nuvio ativo não oculta mais o progresso confirmado do Trakt. Cada cartão identifica sua fonte. O mesmo episódio-alvo é agrupado visualmente com indicação da outra fonte; se as fontes apontarem para episódios diferentes, os registros permanecem distintos. Contagens e históricos de contas/perfis não são somados. Troca de perfil cancela a publicação de respostas antigas. Dados de uma conta Trakt anterior são ocultados imediatamente.

Quando a contagem recebida muda, o próximo episódio antigo fica pendente até a nova consulta, em vez de continuar sendo apresentado como atual. Séries totalmente em dia ou com apenas lançamentos futuros não entram como episódios disponíveis para continuar. A tela Suas séries mantém o acompanhamento e o calendário disponível.

O progresso ainda depende de a TV publicar os dados na conta Trakt ou no Nuvio Sync correto. Não há acesso direto à TV nem recuperação de reproduções guardadas apenas no aparelho. Identificadores sem IMDb compatível continuam sujeitos às limitações já indicadas na conexão. Testes privados usam fixtures: não acessamos a conta real do usuário no ambiente de desenvolvimento.

Instale por cima da versão atual, sem desinstalar. Mantém dados, credenciais, backups, recomendações e o APK de aproximadamente 45 MB.
