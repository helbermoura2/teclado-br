# CENA IA 0.28.6

Reconhecimento de capas com títulos brasileiros e nomes alternativos verificados.

- O CENA usa a conexão TMDB já salva para conferir nomes em português e o título original pelo mesmo ID IMDb. A chave continua no armazenamento nativo; não é enviada ao JavaScript.
- Reconhece Hiroshima - A Guerra da Sobrevivência como Hiroshima: Out of the Ashes (1990), IMDb tt0099772, sem confundir com outros filmes chamados Hiroshima.
- O nome principal também ajuda a recuperar candidatos quando a IA omite o título original; cada candidato continua passando pela conferência do título completo.
- O Gemini continua sendo usado para ler a imagem. Um palpite da IA não substitui a identidade e os títulos registrados no catálogo.
- A consulta dos nomes tem fila separada dos logotipos, cache, limite de candidatos e tempo de espera. Não envia a fotografia ao TMDB.

Validação: 148 testes JavaScript e fluxo de câmera no navegador com respostas privadas simuladas. A publicação executa cinco testes Android de seleção de provedores, títulos regionais, identidade IMDb e exposição da função JavaScript; verifica os APKs e a assinatura. Os binários de inferência permanecem idênticos aos já validados, enquanto o código Kotlin é recompilado.

Fonte do caso: https://www.themoviedb.org/movie/299668-hiroshima-out-of-the-ashes?language=pt-BR

Atualize pelo próprio CENA. Mantenha o TMDB conectado no Perfil. Não é necessário alterar o Worker da Cloudflare.
