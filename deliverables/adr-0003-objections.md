Decisão central: sobreviveu intacta — exibir ambas as versões com metadados é o único caminho que satisfaz o requisito do Product Specialist.

O que foi adicionado/alterado pelas objeções:

┌──────────────────────────────────────────────────┬────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                     Objeção                      │ Severidade │                                                        Mudança no ADR                                                        │
├──────────────────────────────────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Critério de identidade sub-especificado          │ Alta       │ Critério hierárquico explícito: doc_id intra-sistema → similaridade de título ≥ 0,85 → hash de conteúdo parcial ≥ 0,70       │
├──────────────────────────────────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Overflow de tokens sem degradação definida       │ Alta       │ Estratégia de degradação explícita com ordem de prioridade e proibição de truncamento silencioso de versões conflitantes     │
├──────────────────────────────────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ System prompt estático penaliza todas as queries │ Média      │ Prompt dinâmico condicional: instruções de contradição injetadas apenas quando retriever detecta contradição_detectada: true │
├──────────────────────────────────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Escalation path sem dente operacional            │ Média      │ Inventário de contradições com SLA de 5 dias úteis, não apenas "disponível para exportação"                                  │
├──────────────────────────────────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Metadados ausentes tratados como edge case       │ Média      │ Validação de qualidade de metadados na ingestão com flag metadado_vigencia_ausente e comportamento explícito definido        │
└──────────────────────────────────────────────────┴────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘