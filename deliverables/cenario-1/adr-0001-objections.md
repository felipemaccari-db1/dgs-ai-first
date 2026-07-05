
┌─────┬──────────────────────────────────────────────────┬────────────┬─────────────────────────┐
│  #  │                     Objeção                      │ Severidade │        Veredicto        │
├─────┼──────────────────────────────────────────────────┼────────────┼─────────────────────────┤
│ 1   │ GPT-4o em Brasil South não validado              │ Alta       │ Fortalece com mitigação │
├─────┼──────────────────────────────────────────────────┼────────────┼─────────────────────────┤
│ 2   │ Sem benchmark de qualidade antes do go-live      │ Alta       │ Fortalece com mitigação │
├─────┼──────────────────────────────────────────────────┼────────────┼─────────────────────────┤
│ 3   │ Versionamento do modelo não tratado              │ Média      │ Fortalece com mitigação │
├─────┼──────────────────────────────────────────────────┼────────────┼─────────────────────────┤
│ 4   │ Custo sem análise de sensibilidade a crescimento │ Média      │ Fortalece com mitigação │
├─────┼──────────────────────────────────────────────────┼────────────┼─────────────────────────┤
│ 5   │ Sem degradação graciosa em indisponibilidade     │ Média      │ Fortalece com mitigação │
└─────┴──────────────────────────────────────────────────┴────────────┴─────────────────────────┘

Nenhuma objeção mudou a decisão. A escolha de GPT-4o no Azure OpenAI é sólida dado o contexto da NovaTech — a análise apenas expôs lacunas operacionais que, se ignoradas, transformariam riscos teóricos em incidentes reais.

Mudanças no ADR:
- Status: Proposto → Aceito
- Adicionada pré-condição de arquitetura na seção Decisão sobre validar disponibilidade em Brasil South antes de desenvolver
- Quatro mitigações marcadas como [Mitigação obrigatória] incorporadas nos Riscos residuais: golden dataset pré-go-live, pinning de versão + processo de revalidação, teto orçamentário com trigger de revisão, e circuit breaker com fallback de chunks brutos
- Alternativa open-source anotada com nota de reavaliação se custo superar teto definido