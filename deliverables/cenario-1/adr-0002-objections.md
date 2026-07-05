4 objeções levantadas — nenhuma mudou a decisão arquitetural central, todas geraram mitigações:

┌─────┬──────────────────────────────────────────────────────────────────────────┬────────────┬─────────────────────────┐
│  #  │                                 Objeção                                  │ Severidade │        Veredicto        │
├─────┼──────────────────────────────────────────────────────────────────────────┼────────────┼─────────────────────────┤
│ 1   │ Inconsistência entre teto 8K e limite de 12 chunks                       │ Alta       │ Fortalece com mitigação │
├─────┼──────────────────────────────────────────────────────────────────────────┼────────────┼─────────────────────────┤
│ 2   │ Mecanismo de decomposição não especificado (latência subestimada em ~4×) │ Alta       │ Fortalece com mitigação │
├─────┼──────────────────────────────────────────────────────────────────────────┼────────────┼─────────────────────────┤
│ 3   │ Custo e frequência da sumarização não contabilizados                     │ Média      │ Fortalece com mitigação │
├─────┼──────────────────────────────────────────────────────────────────────────┼────────────┼─────────────────────────┤
│ 4   │ Persistência de sessão sem TTL, backend ou comportamento de falha        │ Média      │ Fortalece com mitigação │
└─────┴──────────────────────────────────────────────────────────────────────────┴────────────┴─────────────────────────┘

Principais mudanças no ADR revisado:

- Status: Proposto → Aceito
- Parâmetros: adicionada restrição de 500 tokens/chunk como premissa explícita que amarra os dois parâmetros antes inconsistentes
- Decomposição: especificado como chamada GPT-4o com output JSON estruturado; latência corrigida de 200–400 ms para 800–1.500 ms; fallback definido
- Sumarização: timing especificado (início do 6º turno, antes da recuperação); mecanismo de rollover de turnos definido; custo adicional (~9% do volume base) quantificado
- Persistência de sessão: backend definido (Azure Cache for Redis), TTL de 4 horas, comportamento de degradação graceful em restart especificado
- 3 mitigações obrigatórias adicionadas nos Riscos residuais (calibração de chunk size, validação de latência real, monitoramento de custo de sumarização)