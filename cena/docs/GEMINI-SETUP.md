# Gemini online

O servidor requer GEMINI_API_KEY, GEMINI_MODEL (padrão gemini-2.5-flash) e CENA_AI_ACCESS_TOKEN. A chave Gemini nunca deve ser colocada no APK ou no formulário do aplicativo. O token do servidor é uma credencial separada.

Para hospedar em Render, crie um Web Service conectado ao repositório privado helbermoura2/teclado-br, branch cena/android-preview. Root Directory: cena. Runtime: Node. Build Command: npm install --omit=dev. Start Command: node server/index.mjs. Cadastre as variáveis acima no painel privado da hospedagem. Escolha o plano e confira eventuais custos antes de ativar. Use uma versão Node >=22.

Após a hospedagem estar pronta, no CENA acesse Conectar → IA online · Gemini. Informe a origem HTTPS do serviço e CENA_AI_ACCESS_TOKEN. Não informe GEMINI_API_KEY no aplicativo. Em um título, escolha Refinar com Gemini online. Somente referência, pedido e candidatos são enviados; o histórico completo não é enviado.

O provedor pode cobrar por uso e impor limites. A consulta online ainda depende da configuração real da hospedagem. Testes automatizados usam respostas simuladas, sem chamadas pagas. Os candidatos vêm do catálogo já consultado; a IA não amplia automaticamente a cobertura da busca.
