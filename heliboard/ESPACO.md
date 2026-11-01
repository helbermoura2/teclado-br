# Espaço imediato 0.6.5

A 0.6.4 usava o espaço fantasma nativo: o espaço só aparecia ao digitar a próxima
palavra. Esta versão insere espaço real imediatamente após pontuação de frase
(ponto, vírgula, interrogação, exclamação, dois-pontos e ponto e vírgula).
Funciona sem depender de a palavra ser conhecida no dicionário ou de autocorreção.

Ao pressionar espaço manualmente em seguida, substitui o espaço automático,
sem duplicá-lo. Pontuação consecutiva remove o espaço automático anterior para
permitir reticências e combinações como ?!. Campos de senha, e-mail, URL e
números mantêm as restrições nativas; não adiciona espaço em ponto após dígito.
Tokens que já contêm @ ou / são preservados. Um domínio sem protocolo digitado
num campo de conversa pode exigir apagar o espaço após o ponto, pois ainda não
há contexto suficiente para distingui-lo de fim de frase.

Preserva tema, idiomas, dicionário pessoal, aprendizado e pins da versão anterior.
IA, prompt e lupa permanecem pendentes de integração.

## Validação

[Run 41263274095](https://github.com/helbermoura2/teclado-br/actions/runs/41263274095)
aprovado no commit `c3fb2e102403e64faf794312add6df0bb61101a9`.
Testes de interação Android 35 confirmaram `Bom. ` imediatamente após tocar
no ponto, antes de qualquer tecla seguinte. Pressionar espaço manualmente
manteve apenas um espaço. `bom...` resultou em `Bom... `, `3.14 ` foi preservado,
e `bom,dia ` produziu `Bom, dia `. Uma palavra desconhecida com autocorreção
desativada também recebeu espaço imediato. Captura 07-espaco-imediato conferida.
Regressões de dicionário pessoal, idiomas, toques sobrepostos e pins aprovadas,
incluindo reinstalação/reinício e expiração simulada. Testes em emulador;
ainda não testado diretamente no Nothing Phone (1).

APK SHA-256: `3cd090b304318d7cea6c299ceed5b9368df40223de2530db61df8c69bb527893`.
Fontes SHA-256: `cb6d6f0e0257f7626053f5a940d5d6f6786717203c2d206a5bbc1e1c7a435e05`.
Assinatura verificada igual à 0.6.4; instalar como atualização sem desinstalar.
