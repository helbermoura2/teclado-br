# CENA 0.28.3 — câmera com Gemini

- A câmera passa a mostrar uma prévia do recorte escolhido. A preparação da imagem e o OCR não disputam a fila de download do modelo visual.
- Analisar esta capa com Gemini envia somente o recorte JPEG reduzido e as pistas de OCR ao Worker. A imagem é recodificada sem EXIF, com dimensão máxima de 1024 px e tamanho limitado. A prévia fica na sessão, fora do backup e do catálogo.
- A opção automática é desativada inicialmente. Ao ativá-la, o usuário autoriza o envio quando a busca local não encontrar títulos. A tela informa que usa Cloudflare, Google, internet e a cota da API.
- O Gemini retorna hipóteses de nomes; o aplicativo consulta o catálogo e usa somente IDs reais. A escolha do título continua sendo confirmada pelo usuário. Não existe garantia de acerto universal.
- A busca local recupera palavras separadas e confusões entre O e zero. O caso HROSHIN 0 UT OF THE A SHES foi verificado contra o catálogo público e passou a apresentar Hiroshima: Out of the Ashes (1990) primeiro. Um erro ou limite do Wikidata não descarta resultados do Cinemeta já encontrados.

## Ativar a análise visual

O Worker anterior só recebe sinopses. Na Cloudflare, abra o Worker **cena-ia**, Edit code, substitua todo o código pelo arquivo https://github.com/helbermoura2/cena-downloads/blob/main/cloudflare/cena-ia-worker.js e Deploy. Preserve os secrets GEMINI_API_KEY, CENA_AI_ACCESS_TOKEN e a variável GEMINI_MODEL. O endereço continua https://cena-ia.terrestre.workers.dev. A resposta da raiz deve incluir vision:true e version:2. A conexão Gemini existente no app é reutilizada.

O novo Worker preserva /api/ai/similar e acrescenta /api/ai/identify-cover. O aplicativo informa quando esse endpoint ainda não estiver disponível. Os testes automatizados simulam respostas do Gemini; o uso da chave real depende da configuração do usuário no Worker.

Atualize o CENA IA Novo pelo botão do aplicativo. Para instalação manual sobre CENA IA Novo, baixe CENA-0.28.3-novo.apk. Ele mantém a assinatura permanente e o pacote separado da 0.27.9. A edição sem -novo é para o pacote original com assinatura permanente. Não desinstale a versão antiga para instalar esta.
