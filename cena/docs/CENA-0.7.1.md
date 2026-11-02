CENA IA 0.7.1 — nota com duas casas decimais e assinatura maior.

Instale sobre a 0.7.0, sem desinstalar.

- Sua nota aceita de 0 a 10, com até duas casas decimais, usando ponto ou vírgula: 8.53 e 8,53 funcionam. A validação e o desenho usam a mesma regra; uma nota válida deixa de ser bloqueada na exportação.
- O selo mantém as casas decimais significativas, sem arredondar 8,53 para 8. Valores fora do intervalo ou com mais de duas casas são sinalizados.
- Notas no fim da opinião, como Excelente, 8,53/10, também são reconhecidas com duas casas.
- A assinatura volta ao CEN▲ com triângulo roxo preenchido, em vez do A desenhado.
- A assinatura ficou cerca de 60% maior e permanece centralizada na área segura do Story.

Validação: 47 testes locais; interface com 8.53 e 8,53 e reabertura preservando a nota; teste Android exportando o Story com 8,53; atualização assinada sobre a 0.7.0. A biblioteca e as conexões existentes são preservadas.
