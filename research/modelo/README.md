# Modelo preditivo de limiar por calibre axonal

`modelo_preditivo.py` é o programa que produz todos os números do volume. Cadeia de nós de
Ranvier com membrana passiva, função de ativação de Rattay, Monte Carlo sobre a distribuição
de diâmetros do fascículo e bootstrap percentílico. Semente fixa: a saída é idêntica a cada
execução.

```bash
pip install numpy scipy
python modelo_preditivo.py        # grava res.json
```

Valores de referência desta versão:

| Grandeza | Valor |
|---|---|
| Expoente da lei de escala | 1,1266 |
| Razão Aδ/Aβ a 1 mm | 3,2077 |
| Mediana no fascículo | 3,0959 (IC 95 % 2,9797–3,2249) |
| Fração de Aδ com 10 % de Aβ recrutadas | 0,38 % |

**Não é dispositivo médico.** Ferramenta de pesquisa e ensino; não deve ser usada para
calcular parâmetros de estimulação em pessoas.
