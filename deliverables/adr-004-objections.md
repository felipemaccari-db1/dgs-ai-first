┌─────┬───────────────────────────────────────────────────────────────┬────────────┬─────────────────────────┐
│  #  │                            Objeção                            │ Severidade │        Veredicto        │
├─────┼───────────────────────────────────────────────────────────────┼────────────┼─────────────────────────┤
│ 1   │ Conector nativo do Confluence não existe no Azure AI Search   │ Alta       │ Fortalece com mitigação │
├─────┼───────────────────────────────────────────────────────────────┼────────────┼─────────────────────────┤
│ 2   │ Chunking de planilhas Excel destrói contexto estrutural       │ Média      │ Fortalece com mitigação │
├─────┼───────────────────────────────────────────────────────────────┼────────────┼─────────────────────────┤
│ 3   │ Custo do Document Intelligence ausente do modelo financeiro   │ Média      │ Fortalece com mitigação │
├─────┼───────────────────────────────────────────────────────────────┼────────────┼─────────────────────────┤
│ 4   │ Lock-in duplo sem estratégia de saída nem camada de abstração │ Média      │ Fortalece com mitigação │
└─────┴───────────────────────────────────────────────────────────────┴────────────┴─────────────────────────┘

O que mudou no ADR:

- Status: Proposto → Aceito
- Contexto: Corrigida a afirmação sobre conectores nativos — explicitado que Confluence exige conector customizado
- Decisão: Adicionadas a obrigatoriedade do conector customizado para Confluence e a exigência de interfaces de abstração (ISearchRepository, ICompletionClient) como restrição de implementação
- Consequências negativas: Custo atualizado para R$ 2.300–3.500/mês (inclui Document Intelligence); conector do Confluence listado como esforço real de desenvolvimento
- Riscos residuais: Adicionados os riscos de planilhas Excel (com mitigação de conversão para Markdown) e custo variável do Document Intelligence (com mitigação de política de reindexação incremental)
- Alternativas: Reconhecida a vantagem do ecossistema Python para Confluence, sem alterar a conclusão

A decisão central não mudou — Azure AI Search + Azure OpenAI continua sendo a escolha correta dado o contexto. O ADR agora, porém, não promete o que não entrega.