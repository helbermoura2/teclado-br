# CENA 0.28.2

- Gemini online: Salvar e testar faz as duas ações. Testar Gemini também salva o token que estiver preenchido. O resultado e os erros ficam visíveis no topo do painel. Não é necessário instalar IA local.
- Remove a restrição de tamanho mínimo imposta pelo aplicativo ao token já configurado no Worker. Continua exigindo um valor não vazio e valida a conexão no servidor. O campo recusa o nome literal CENA_AI_ACCESS_TOKEN e identifica uma chave Gemini colocada no campo errado.
- A busca reconhece mitologia e Grécia antiga. Consultas diferentes compartilham a prioridade de enriquecimento, para uma busca ampla não ocupar todo o limite. O catálogo real de The Odyssey passou a retornar opções relacionadas. Os títulos continuam sendo verificados pelo catálogo; a IA não pode inventar IDs.
- O botão Gemini fica desabilitado enquanto o catálogo carrega. Quando a conexão não está salva, ele mostra Conectar Gemini online. A configuração da IA local fica no Perfil.
- Story com mais área para a imagem, menor zoom e transição de sombra mais abaixo. Título, nota e resenha descem. O rodapé reserva espaço para serviços legíveis e a marca menor se integra à névoa. Listas extensas de serviços usam um resumo; resenhas longas continuam sinalizando eventual corte na prévia.

Atualize no próprio CENA IA Novo em Perfil → Atualizações do CENA. Se precisar instalar manualmente mantendo a 0.27.9, baixe CENA-0.28.2-novo.apk. Ele instala ao lado da versão antiga ou atualiza CENA IA Novo 0.28.0/0.28.1. A edição sem -novo é para o pacote original com a assinatura permanente.

A confirmação de acesso à sua API depende de testar com seu token no aparelho. Não envie token ou chave na conversa. Em Perfil → IA online · Gemini, cole o valor de CENA_AI_ACCESS_TOKEN e toque em Salvar e testar Gemini. A chave Gemini permanece na Cloudflare.
