# CENA 0.28.0

- IA online Gemini: em Perfil → IA online · Gemini, salve o endereço https://cena-ia.terrestre.workers.dev e o CENA_AI_ACCESS_TOKEN criado na Cloudflare. A chave Gemini permanece no Worker.
- Use Testar Gemini para conferir a conexão e Refinar com Gemini online nos títulos para selecionar sugestões entre candidatos verificados do catálogo.
- Preserva os Stories da 0.27.9: título dourado abaixo da capa, serviços sem repetição e partículas na névoa.
- Preserva a atualização isolada do painel Trakt, sem apagar o que você está digitando nas outras conexões.
- Número interno 67, superior ao 66 da 0.27.9. Instale pelo atualizador, sem desinstalar.

## Origem e validação

A base 0.27.9 foi recuperada do APK na branch pública download-cena-0.27.9-teste, commit ed6d050287d63a82fc037a0c72e005d3225cbcf9. SHA-256 do APK: 99331b40a8c02da2e2eb94ba4f166e7a316216c1a946532a0d1712c500b27c8b. Os três arquivos DEX são idênticos aos da 0.27.5; as mudanças de app.js e story-layout.js foram reconciliadas com a integração Gemini. O renderer dos Stories é preservado integralmente.

A consulta Gemini real requer seu token no aparelho; as verificações automatizadas usam respostas simuladas. O envio contém o título, a preferência e candidatos limitados, sem enviar o histórico inteiro. Os serviços gratuitos têm limites de uso.
