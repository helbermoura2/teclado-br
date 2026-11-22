# CENA IA 0.28.5

Correção do reconhecimento de capas e da validação das sugestões do Gemini.

- Usa o título completo e junta linhas curtas, evitando confundir filmes que compartilham apenas uma palavra.
- Pesquisa também o texto visível lido pelo Gemini, inclusive títulos regionais cujo nome no catálogo é inglês.
- Uma pista de título regional exige resultado único para a frase completa e confirmação por outra consulta com uma palavra distintiva.
- Rejeita sugestões incompatíveis com o restante do título e anos conhecidos contraditórios.
- Descarta resultados antigos quando a análise não consegue confirmar o título e mantém o texto lido no campo de busca.
- A opção automática também cobre leituras locais incompletas ou fracas.

Caso verificado no catálogo real: O Protocolo de Auschwitz → The Auschwitz Report (2021), IMDb tt9415108. The Angel of Auschwitz e The Guard of Auschwitz foram rejeitados no teste com sugestões Gemini simuladas. Não foi feita chamada à API Gemini do usuário.

Validação: 138 testes JavaScript, teste de câmera no navegador e consulta ao catálogo real. A publicação repete os testes de navegador, valida os APKs e a assinatura. Os componentes nativos são os mesmos da 0.28.4: o processo confirma que não houve alteração no código nativo e verifica a identidade dos binários reaproveitados.

Atualize pelo próprio CENA. Nenhuma alteração no Worker da Cloudflare é necessária.
