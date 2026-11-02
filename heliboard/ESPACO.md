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
