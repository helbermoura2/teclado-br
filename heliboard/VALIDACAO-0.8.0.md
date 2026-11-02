# Validação 0.8.0

Compilação e interação aprovadas no [run 41449779518](https://github.com/helbermoura2/teclado-br/actions/runs/41449779518),
commit `14b68fd59c5d80012c8df508f8ace30b4d6615d3`. Repositório permanece privado.
São sete fases de instrumentação aprovadas, além dos testes unitários.

[APK (ZIP)](https://github.com/helbermoura2/teclado-br/actions/runs/41449779518/artifacts/13143308299) ·
[Fontes (ZIP)](https://github.com/helbermoura2/teclado-br/actions/runs/41449779518/artifacts/13144012909) ·
[Diagnóstico e capturas](https://github.com/helbermoura2/teclado-br/actions/runs/41449779518/artifacts/13144544046)

SHA-256 APK: `f50fad364276a62bc698202a0ef20a946dcc34608db0b57eaa1d31ad0b16f7bc`.
SHA-256 tar.gz de fontes: `1cacc82910f3af567b59ec3c9bd622a3b0db4929e0d23e59bdf62e897fb06fcc`.

## Verificações

142 testes unitários, sem falhas ou ignorados. Android 15 AOSP x86_64, tela
540×1170 e densidade 220. Bibliotecas nativas também compiladas para ARM64.

O contrato de transporte usa HttpURLConnection real contra servidor 127.0.0.1
com chave fictícia e texto sintético: payload OpenAI/Groq, sucesso, HTTP 429,
401, 403, 500 e 302 sem seguir redirecionamento; resposta malformada e timeout;
modos Offline/Automático/Online; cancelamento sem iniciar fallback. O modo
Offline e o Automático sem conexão/chave não chamam o backend online.
O teste entre processos envia o modo por solicitação e confirma mudanças sem
usar uma preferência em cache no processo de inferência.

Verificados cifragem e leitura da chave via Android Keystore, ausência de chave
em preferências e backup JSON, comparação que preserva os textos, exportação /
importação do dicionário e rejeição de formato inválido sem modificar entradas.
Telas de aparência e dicionário exercitadas por toque. Título e botão do dicionário
verificados fora das barras do sistema; capturas revisadas.

Regressões: 200 caracteres com toques sobrepostos, pontuação com espaço imediato,
maiúsculas após frase, autocorreção, Ç/acento por pressão longa, mudança PT-BR/EN,
edição e pins. Inclusão manual, completamento por toque e próxima palavra
aprendida; aprendizagem e pins persistem após reinstalação com a mesma assinatura.

Inferência JNI com Qwen3 0.6B Q8_0 fixado por SHA-256, Wi-Fi e dados desligados:
Compositor, revisão, edição/cópia/substituição, rejeição de resultado antigo após
mudança no campo original e cancelamento. As respostas do modelo pequeno não
aprovam sua qualidade linguística: serve para verificar a integração.

## Limites

Não foi usada chave real Groq nem validada latência/cota de uma conta real.
As falhas da API e o fallback foram exercitados com respostas controladas;
a inferência local foi exercitada separadamente com o runtime real.
Não houve acesso ao Nothing Phone (1), medição física de bateria/memória/tempo
ou nova avaliação Android da Gemma 4 E2B. A ferramenta no aplicativo permite
executar a medição no aparelho. PSS é amostrado; energia é do aparelho inteiro.
O fluxo SAF de importação/exportação pelo aplicativo de arquivos não foi
navegado automaticamente: o teste cobre os dados e a ida às telas de ajustes.
A lupa flutuante com OCR ainda não foi integrada.

## Distribuição

Pacote br.com.tecladobr.heli.debug, versão 0.8.0-heli3.6, versionCode 8000.
Certificado SHA-256 b758875ca8380d3b2ba0aa7b2b34a17f785aac3d0c4d1874674266a8877e9d45.
Mesma assinatura das versões anteriores; instalar por cima, sem desinstalar.
Fontes GPLv3 correspondentes acompanham o APK, incluindo overlay e runtime MIT.
Nenhum peso GGUF ou chave real foi incluído no APK ou nas fontes.
