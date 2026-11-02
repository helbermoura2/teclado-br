CENA IA 0.6.1 — capa presente no Story.

Instale por cima da 0.6.0, sem desinstalar. A biblioteca e as conexões Stremio/Trakt são preservadas.

- As capas do Story são carregadas pelo Android e convertidas em pixels locais. Uma imagem que aparece no catálogo pode bloquear a exportação no navegador; o novo caminho nativo evita essa dependência de CORS.
- O carregamento tenta a capa disponível e uma fonte alternativa para o mesmo IMDb. Somente imagens públicas HTTPS dos quatro provedores já usados pelo app são permitidas, incluindo a validação dos redirecionamentos. Há limites de tamanho, resolução e tempo.
- Salvar e compartilhar ficam bloqueados até a capa estar pronta. Se falhar, há um aviso, Tentar carregar capa e Continuar sem capa por escolha explícita.
- A exportação continua PNG 1080 × 1920, com frase editável e identidade CENA. O usuário escolhe Instagram/Stories no compartilhamento do Android e conclui a publicação.
- A prévia ficou um pouco mais compacta para facilitar o acesso aos controles no celular.

Validação: testes do carregador, retentativa e falhas; fluxo de interface com sucesso, erro e escolha explícita de card sem capa; teste Android que baixa a capa real de The Pianist (2002), carrega pelo bridge nativo e exporta o próprio canvas em PNG 1080 × 1920; instalação assinada sobre a 0.6.0.
