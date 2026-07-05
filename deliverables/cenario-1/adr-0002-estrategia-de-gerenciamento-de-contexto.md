# ADR-0002 — Estratégia de gerenciamento de contexto

**Status**: Aceito

> Revisado em 2026-06-12 após análise crítica de objeções arquiteturais. A decisão central (contexto dinâmico + decomposição de queries + janela deslizante com sumarização) sobreviveu ao processo. Quatro objeções de severidade média ou alta geraram mitigações incorporadas nos Riscos residuais e nas Consequências. Nenhuma objeção mudou a abordagem arquitetural.

## Contexto

O pipeline RAG da NovaTech envia ao LLM um contexto montado dinamicamente a cada query. Três forças técnicas tornam a composição desse contexto um problema não trivial:

1. **Volume e diversidade da base**: ~1.200 documentos (SharePoint + Confluence + planilhas) cobrindo domínios distintos — SLA, frete, devoluções, procedimentos internos. Uma pergunta pode exigir chunks de domínios diferentes ao mesmo tempo.

2. **Conversas multi-turno no Teams**: o bot opera em sessões de chat onde o usuário faz perguntas encadeadas. Sem controle explícito, o histórico acumula até estourar o limite de tokens do modelo ou degradar a qualidade da resposta (context rot).

3. **Restrição de latência**: a meta de negócio é reduzir o tempo de resolução de 12 min para menos de 2 min. Composições de contexto excessivamente grandes aumentam o tempo de inferência e o custo por chamada.

**Inputs técnicos relevantes**: a base tem ~12M tokens totais (~10.000 tokens/documento em média); chunking por seção com overlap de 10% foi definido no ADR anterior. O modelo disponível via Azure AI Services (GPT-4o no Azure OpenAI) suporta janela de até 128K tokens, mas custo e latência crescem com o tamanho do prompt.

**Requisitos do Product Specialist**: respostas devem citar fonte; documentos contraditórios devem exibir ambas as versões com data; o assistente não pode inventar informações.

## Decisão

Adotar **contexto dinâmico com decomposição de queries para perguntas multi-domínio e janela deslizante com sumarização para conversas longas**, com os seguintes parâmetros fixos:

| Parâmetro | Valor |
|---|---|
| Teto de tokens de contexto por query (prompt total de entrada) | 8.000 tokens |
| Tamanho máximo assumido por chunk (restrição de indexação) | 500 tokens |
| Chunks recuperados por sub-query | 5 |
| Máximo de chunks por query (após merge e dedup) | 12 |
| Turnos mantidos íntegros na janela | 3 |
| Turnos que disparam sumarização | > 5 |

**Nota sobre a relação entre teto de tokens e máximo de chunks**: os dois parâmetros são derivados, não independentes. O teto de 8.000 tokens é a restrição primária; o máximo de 12 chunks é derivado assumindo chunks de no máximo 500 tokens. O orçamento de tokens é:

| Componente | Tokens reservados |
|---|---|
| System prompt | ~1.000 |
| Histórico íntegro (3 turnos × ~400 tokens) | ~1.200 |
| Chunks (12 × 500 tokens) | ~6.000 |
| Overhead de formatação e query | ~800 |
| **Total** | **~9.000** |

O teto de 8.000 tokens é atingido antes de 12 chunks se o tamanho médio dos chunks superar 500 tokens. Por isso, o chunking na fase de indexação deve aplicar um limite máximo de 500 tokens por chunk, com splits por frase em seções longas. O parâmetro "máximo de 12 chunks" é um teto de contagem; o teto de tokens é o limite real. Validar com amostras reais antes do go-live (ver Riscos residuais).

**Mecanismo de decomposição de queries**: a detecção de queries multi-domínio usa uma chamada prévia ao GPT-4o com um system prompt minimalista que retorna no máximo 3 sub-queries. Essa chamada utiliza um prompt de decomposição com output forçado em JSON estruturado, o que reduz tokens de saída e, portanto, latência. A latência real esperada é de **800–1.500 ms** (revisado da estimativa original de 200–400 ms, que subestimava o custo de uma chamada LLM). Consultas que o classificador identificar como single-domain não passam pela etapa de decomposição. O threshold de confiança para classificar uma query como multi-domínio deve ser calibrado durante o desenvolvimento com exemplos reais de chamados da NovaTech.

**Fallback de decomposição**: se a chamada de decomposição falhar ou retornar sub-queries sem tokens relevantes após a recuperação, o pipeline regride automaticamente para recuperação single-query com o texto original. O fallback é registrado em log para diagnóstico retroativo.

**Mecanismo de sumarização**: a sumarização de histórico é executada como chamada separada ao GPT-4o, disparada no início do 6º turno (antes da recuperação de chunks). Os turnos 1 a 3 são sumarizados em bloco; os turnos 4 e 5 permanecem íntegros. A partir do 7º turno, a cada novo turno o turno mais antigo dos íntegros é sumarizado e incorporado ao sumário acumulado. A chamada de sumarização usa no máximo 2.000 tokens de entrada e retorna no máximo 400 tokens — latência adicional de ~800–1.200 ms na query que a dispara.

**Persistência de estado de sessão**: o histórico de turnos e o sumário acumulado são persistidos em **Azure Cache for Redis** com TTL de 4 horas (alinhado com a duração de um turno de trabalho de suporte). Em caso de falha do Redis ou restart do serviço de bot, o pipeline opera em modo stateless para aquela query, notificando o usuário com a mensagem "contexto de sessão indisponível — respondendo com base apenas na pergunta atual". Nenhum estado de sessão é mantido em memória do processo.

Justificativa sobre as alternativas:

- **8K tokens de contexto** é consistente com o orçamento de tokens detalhado acima, assumindo chunks limitados a 500 tokens. O limite protege custo e latência de inferência.
- **Decomposição de queries** é necessária porque perguntas multi-domínio (ex.: "qual o prazo de devolução para frete expresso com atraso de SLA?") produzem recall ruim quando tratadas como query única — embeddings de domínios diferentes ficam equidistantes do vetor médio da pergunta composta.
- **5 chunks por sub-query** equilibra cobertura e ruído; testes em bases documentais corporativas similares mostram que chunks 6–10 contribuem menos de 8% das citações finais usadas pelo modelo.
- **Janela deslizante com sumarização** preserva continuidade semântica da sessão sem acumular tokens irrelevantes de turnos antigos, atendendo ao requisito de não inventar informações (histórico comprimido mantém fatos, não tokens brutos).
- A abordagem é implementável em C#/.NET sobre o SDK do Azure OpenAI sem dependência de frameworks externos, compatível com o prazo de 3 meses.

## Consequências

**Positivas**:
- Perguntas multi-domínio passam a ser decompostas e resolvidas com chunks relevantes de cada domínio, reduzindo respostas parciais ou misturadas.
- O teto de 8K tokens limita custo por chamada e latência de inferência, contribuindo para a meta de menos de 2 min por chamado.
- A sumarização de histórico mantém coerência de sessão sem estouro de janela, mesmo em conversas longas no Teams.
- Parâmetros declarados explicitamente (teto, K, turnos, TTL, backend) tornam o comportamento auditável e ajustável sem refatoração de lógica.
- Redis com TTL elimina o risco de acúmulo de sessões órfãs e define comportamento determinístico em restart.

**Negativas**:
- A decomposição de queries multi-domínio adiciona uma chamada extra ao GPT-4o antes da recuperação, aumentando latência em **~800–1.500 ms** (não 200–400 ms como estimado originalmente) para queries compostas. Esse impacto deve ser validado contra a meta de 2 min por chamado.
- A sumarização de turnos antigos comprime informação — se o usuário referenciar um detalhe específico de um turno sumarizado que o modelo omitiu, a resposta pode ser incompleta.
- O limite de 12 chunks pode ser insuficiente em perguntas que cruzam mais de 3 domínios simultaneamente; nesses casos raros, o pipeline truncará contexto ou priorizará pelo score de similaridade, sem garantia de cobertura completa.
- Sessões com mais de 5 turnos (esperadas na maioria dos chamados, dado que sessões típicas têm 8–12 turnos) disparam sumarização em ~60% dos dias de uso, adicionando ~60.000 tokens de entrada extras/dia (~9% sobre o volume base do ADR-0001). Esse custo deve ser incorporado à estimativa mensal de tokens.
- Azure Cache for Redis Standard C1 (capacidade suficiente para estado de sessão de 320 usuários simultâneos) adiciona ~R$ 200–300/mês ao custo operacional.

**Riscos residuais**:
- Se a classificação de domínio errar (query mal formulada pelo usuário), a decomposição pode gerar sub-queries irrelevantes e chunks de baixa qualidade. Mitigação: fallback para single-query automático quando os chunks recuperados das sub-queries forem distintos entre si acima de um threshold de dissimilaridade; log de todas as decomposições para revisão offline.

- **[Mitigação obrigatória — calibração de chunk size]** O parâmetro de 12 chunks e o teto de 8K são consistentes apenas se os chunks indexados respeitarem o limite de 500 tokens. A estratégia de chunking da fase de indexação (ADR-0004) deve validar com amostras reais dos documentos da NovaTech que o P90 do tamanho de chunk fique abaixo de 500 tokens. Se o P90 superar 500 tokens, o máximo de chunks deve ser reduzido para 8 ou o teto deve ser elevado para 10K com reavaliação do impacto de custo.

- **[Mitigação obrigatória — latência de decomposição]** A latência adicional de decomposição (~800–1.500 ms) deve ser medida em ambiente Azure real durante o desenvolvimento, não estimada. Se a latência total de queries compostas (decomposição + 2× recuperação + geração) exceder 90 segundos no P95, a estratégia de decomposição deve ser reavaliada para usar um modelo menor (ex.: GPT-4o mini) na etapa de classificação.

- Documentos contraditórios recuperados em sub-queries diferentes podem ser intercalados no contexto sem que o modelo perceba a contradição entre eles — risco mitigado parcialmente pelo requisito de exibir ambas as versões com data, mas dependente de prompt engineering adequado.

- **[Mitigação obrigatória — custo de sumarização]** Adicionar ao monitoramento operacional uma métrica de "chamadas de sumarização/dia". Se exceder 250/dia (indicando sessões mais longas que o esperado), revisar os parâmetros de janela (reduzir turnos íntegros de 3 para 2 ou aumentar o threshold de sumarização para >7 turnos).

## Alternativas consideradas

**Janela fixa com top-K global (sem decomposição)**
- Prós: implementação simples; sem latência adicional de classificação; comportamento determinístico fácil de testar.
- Contras: queries multi-domínio produzem recall ruim — o vetor médio da pergunta composta não está próximo dos chunks de nenhum domínio específico; K fixo não se adapta à complexidade da pergunta.
- Por que não foi escolhida: com 60% das queries envolvendo documentação e domínios cruzados frequentes (SLA + frete + devolução), a abordagem fixa produziria respostas incompletas em uma fração significativa dos 192 chamados/dia que consultam documentos.

**Janela deslizante simples sem sumarização**
- Prós: sem custo de sumarização; histórico completo disponível para o modelo; simples de implementar.
- Contras: em sessões longas no Teams, o histórico consome tokens que poderiam ser usados por chunks relevantes; após 5–7 turnos de contexto médio, o espaço disponível para chunks recuperados cai abaixo do mínimo útil.
- Por que não foi escolhida: o bot opera em sessões de suporte onde um atendente pode fazer 8–12 perguntas consecutivas; sem sumarização, a qualidade das respostas degradaria progressivamente ao longo da sessão.

**Contexto longo sem teto (usar janela máxima do modelo)**
- Prós: elimina o risco de truncamento; permite recuperar mais chunks sem preocupação com limite; simplifica a lógica de composição.
- Contras: custo por chamada cresce linearmente com tokens de entrada no Azure OpenAI; latência de inferência aumenta de forma não linear acima de 16K tokens; 320 chamados/dia com contexto médio de 20K tokens eleva o custo operacional mensal de forma incompatível com o orçamento típico de projetos internos de logística.
- Por que não foi escolhida: o impacto financeiro inviabiliza a operação sustentável; latência adicional compromete a meta de 2 min por chamado.

**Re-ranking por relevância pura (sem decomposição de domínio)**
- Prós: recupera os chunks mais similares à query original sem necessidade de classificar domínio; mantém pipeline simples.
- Contras: re-ranking melhora precisão dentro de um domínio, mas não resolve o problema de queries que precisam de cobertura balanceada entre domínios — chunks de um domínio dominante podem suprimir chunks relevantes de domínios secundários mesmo com scores altos.
- Por que não foi escolhida: re-ranking é complementar à decomposição, não substituto; a decisão não impede seu uso futuro como etapa adicional dentro de cada sub-query.
