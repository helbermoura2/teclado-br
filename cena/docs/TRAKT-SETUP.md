# Ativar CENA → Trakt → Nuvio pelo celular

## Cadastro único do CENA

1. Abra https://developer.trakt.tv/apps no navegador do celular, entre no Trakt e faça a verificação GitHub exigida pelo portal.
2. Cadastre uma aplicação chamada CENA para organizar sua própria watchlist e acompanhar o que assistir. Use uma URL HTTPS sob seu controle nos campos de site exigidos pelo portal. O fluxo por código não utiliza retorno por URL.
3. Copie somente o **Client ID público**. Não cole Client Secret, senha ou token no CENA nem no chat.
4. No APK: Conectar → Configurar integração CENA → Client ID público → Salvar cadastro.
5. Toque em Conectar e enviar Quero assistir. Copie o código exibido, abra o endereço de verificação pelo botão e autorize o CENA. Volte ao aplicativo.

Não foi cadastrado um cliente externo nesta implementação: a conexão GitHub disponível não dá acesso à sua conta Trakt para criar esse registro. O acesso Standard é gratuito, sujeito às políticas e limites da conta. Fonte: https://developer.trakt.tv/docs/create-an-app e https://developer.trakt.tv/docs/api-use-policy .

## Nuvio no telefone e Android/Google/Fire TV

Conecte a mesma conta Trakt em cada Nuvio e escolha Trakt como fonte da biblioteca. Ative o envio do histórico/reproduções ao Trakt; a localização e o nome exatos dependem da versão do Nuvio. Só um filme presente no histórico assistido pode gerar o check automático; abrir a tela ou iniciar alguns segundos não basta.

O CENA lê o histórico ao sincronizar. Em segundo plano, o Android agenda tarefas com rede disponível; pode adiar por bateria/rede. Ao reabrir o CENA, a consulta é retomada. O app mostra envios pendentes e não apaga títulos locais por uma ausência na lista remota. Séries mostram contagem de episódios vistos, sem inventar a conclusão inteira.

Marcar um filme manualmente como assistido no CENA é um registro local e retira sua intenção de assistir da watchlist. A gravação de histórico de reprodução no Trakt fica com o Nuvio; o CENA não publica uma reprodução falsa nem duplica eventos de histórico em uma retentativa.

## Limite de validação e segurança

O fluxo Device Code está implementado usando apenas Client ID, sem Client Secret no APK. Seu cadastro e a autorização real ainda precisam ser validados no Trakt. Se o provedor restringir o fluxo por código para o cadastro, não embutir segredos como solução: usar o fluxo PKCE com retorno HTTPS verificado recomendado pelo Trakt, com hospedagem e App Links apropriados.

Tokens, grant privado e fila ficam cifrados usando Android Keystore; o WebView só recebe estado público, código de autorização visível e identificadores dos filmes. A fila é descartada ao desconectar para não vazar operações para outra conta. Respostas de limite de conta e de taxa não são tratadas como sucesso. Testes de protocolo utilizam um transporte simulado, não a conta de uma pessoa.

## Stories e ícone

Abra um filme → Criar Story → edite a frase → Compartilhar imagem ou Salvar imagem PNG. O card tem 1080×1920 e marca CENA. No seletor Android, escolha Instagram e o destino Stories se essa opção for oferecida. O caminho garantido sem cadastro Meta é salvar o PNG e selecionar a imagem na galeria do Instagram. A publicação é sempre concluída por você, e não automaticamente pelo CENA.

O launcher usa um ícone adaptativo CENA, com símbolo branco e triângulo roxo.
