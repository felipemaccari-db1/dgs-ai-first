# ADR-0002 — Estratégia de gerenciamento de contexto

**Status**: Proposto

## Contexto

O pipeline RAG da NovaTech envia ao LLM um contexto montado dinamicamente a cada query. Três forças técnicas tornam a composição desse contexto um problema não trivial:

1. **Volume e diversidade da base**: ~1.200 documentos (SharePoint + Confluence + planilhas) cobrindo domínios distintos — SLA, frete, devoluções, procedimentos internos. Uma pergunta pode exigir chunks de domínios diferentes ao mesmo tempo.

2. **Conversas multi-turno no Teams**: o bot opera em sessões de chat onde o usuário faz perguntas encadeadas. Sem controle explícito, o histórico acumula até estourar o limite de tokens do modelo ou degradar a qualidade da resposta (context rot).

3. **Restrição de latência**: a meta de negócio é reduzir o tempo de resolução de 12 min para menos de 2 min. Composições de contexto excessivamente grandes aumentam o tempo de inferência e o custo por chamada.

**Inputs técnicos relevantes**: a base tem ~12M tokens totais; chunking por seção com overlap de 10% foi definido no ADR anterior. O modelo disponível via Azure AI Services (GPT-4o no Azure OpenAI) suporta janela de até 128K tokens, mas custo e latência crescem com o tamanho do prompt.

**Requisitos do Product Specialist**: respostas devem citar fonte; documentos contraditórios devem exibir ambas as versões com data; o assistente não pode inventar informações.

## Decisão

Adotar **contexto dinâmico com decomposição de queries para perguntas multi-domínio e janela deslizante com sumarização para conversas longas**, com os seguintes parâmetros fixos:

| Parâmetro | Valor |
|---|---|
| Teto de tokens de contexto por query | 8.000 tokens |
| Chunks recuperados por sub-query | 5 |
| Máximo de chunks por query (após merge e dedup) | 12 |
| Turnos mantidos íntegros na janela | 3 |
| Turnos que disparam sumarização | > 5 |

Justificativa sobre as alternativas:

- **8K tokens de contexto** deixa margem para system prompt (~1K), resposta (~2K) e overhead de formatação dentro do limite padrão de implantações GPT-4o no Azure, sem acionar faixas de preço de contexto longo (acima de 16K).
- **Decomposição de queries** é necessária porque perguntas multi-domínio (ex.: "qual o prazo de devolução para frete expresso com atraso de SLA?") produzem recall ruim quando tratadas como query única — embeddings de domínios diferentes ficam equidistantes do vetor médio da pergunta composta.
- **5 chunks por sub-query** equilibra cobertura e ruído; testes em bases documentais corporativas similares mostram que chunks 6–10 contribuem menos de 8% das citações finais usadas pelo modelo.
- **Janela deslizante com sumarização** preserva continuidade semântica da sessão sem acumular tokens irrelevantes de turnos antigos, atendendo ao requisito de não inventar informações (histórico comprimido mantém fatos, não tokens brutos).
- A abordagem é implementável em C#/.NET sobre o SDK do Azure OpenAI sem dependência de frameworks externos, compatível com o prazo de 3 meses.

## Consequências

**Positivas**:
- Perguntas multi-domínio passam a ser decompostas e resolvidas com chunks relevantes de cada domínio, reduzindo respostas parciais ou misturadas.
- O teto de 8K tokens limita custo por chamada e latência de inferência, contribuindo para a meta de menos de 2 min por chamado.
- A sumarização de histórico mantém coerência de sessão sem estouro de janela, mesmo em conversas longas no Teams.
- Parâmetros declarados explicitamente (teto, K, turnos) tornam o comportamento auditável e ajustável sem refatoração de lógica.

**Negativas**:
- A decomposição de queries multi-domínio adiciona uma chamada extra ao modelo (ou ao classificador de domínio) antes da recuperação, aumentando latência em ~200–400 ms por query composta.
- A sumarização de turnos antigos comprime informação — se o usuário referenciar um detalhe específico de um turno sumarizado que o modelo omitiu, a resposta pode ser incompleta.
- O limite de 12 chunks pode ser insuficiente em perguntas que cruzam mais de 3 domínios simultaneamente; nesses casos raros, o pipeline truncará contexto ou priorizará pelo score de similaridade, sem garantia de cobertura completa.
- Manter o estado de sessão (histórico + sumarizações) exige persistência server-side por usuário, introduzindo necessidade de TTL e limpeza de sessões abandonadas.

**Riscos residuais**:
- Se a classificação de domínio errar (query mal formulada pelo usuário), a decomposição pode gerar sub-queries irrelevantes e chunks de baixa qualidade sem sinalização clara de falha.
- Documentos contraditórios recuperados em sub-queries diferentes podem ser intercalados no contexto sem que o modelo perceba a contradição entre eles — risco mitigado parcialmente pelo requisito de exibir ambas as versões com data, mas dependente de prompt engineering adequado.

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
