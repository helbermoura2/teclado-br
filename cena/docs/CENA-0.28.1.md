# CENA 0.28.1

- Últimos vistos inclui filmes e episódios confirmados no Nuvio mesmo sem Trakt. Registros recentes são ordenados pela data de visualização, sem duplicar o título entre as fontes. Uma troca de perfil limpa os registros do perfil anterior.
- Ver histórico mostra até 50 títulos recentes do Nuvio quando não há histórico Trakt disponível. Uma posição de reprodução não é tratada como conclusão. Datas ausentes continuam desconhecidas.
- Uma sincronização nova do Trakt solicita a atualização do histórico, sem esperar o intervalo de 12 horas. A tela informa quando a importação está em andamento.
- Exportar backup usa uma fila própria e lê apenas o histórico local, sem esperar pela consulta da conta Trakt. Há mensagem de preparação e tratamento de erro.
- Botões Desconectar Nuvio e Trakt mostram Desconectando enquanto o aplicativo processa a solicitação. Os cliques foram verificados no navegador com respostas simuladas; o uso nas contas reais ainda depende da validação no aparelho.
- Mantém Gemini online e a composição de Stories da 0.27.9.

## Instalação

Para manter a instalação 0.27.9, baixe **CENA-0.28.1-novo.apk**. Ele instala **CENA IA Novo** ao lado do CENA antigo. Os dados são separados. Não desinstale o antigo enquanto não conferir suas listas, notas e histórico.

Se tiver um backup JSON, restaure em Perfil → Histórico e backup → Seu backup → Restaurar arquivo → Mesclar este backup. As conexões precisam de novo login/configuração. O botão de backup do novo aplicativo não consegue exportar dados privados da instalação antiga.

CENA-0.28.1.apk é a edição do pacote original para instalações com a assinatura permanente. A edição Novo seleciona o arquivo -novo.apk nas próximas atualizações pelo aplicativo.

No novo aplicativo, configure o Gemini em Perfil → IA online · Gemini usando o Worker e o CENA_AI_ACCESS_TOKEN criado na Cloudflare. Não informe a chave Gemini nesse campo. Os testes automatizados não chamam a API real com seu token.
