# Revisão Crítica de Proposta de Arquitetura RAG

**Projeto:** NovaTech — Assistente de Atendimento RAG  
**Papel:** Tech Lead  
**Exercício:** 1.3 — Revisão Crítica de uma Proposta de RAG

---

## Proposta original (desenvolvedor júnior)

> "Vamos usar Azure AI Search com embeddings do ada-002. Todos os documentos serão
> indexados num único índice. Chunking fixo de 512 tokens sem overlap. O LLM recebe
> os 3 chunks mais similares. Usaremos GPT-4o para geração. O pipeline de ingestão
> roda manualmente quando alguém lembra de atualizar."

---

## Parte 1 — Revisão Técnica do Tech Lead

*Feita antes de consultar o Claude.*

### Problema 1 — Chunking fixo de 512 tokens sem overlap

**O que está errado:** Cortar documentos em blocos fixos de 512 tokens ignora a estrutura semântica do conteúdo. Quando a fronteira de corte cai no meio de uma regra, uma tabela ou uma lista enumerada, o chunk resultante perde o contexto que o torna compreensível. Na base da NovaTech isso é especialmente crítico: a tabela de frete especial (PROC-042) tem multiplicadores regionais organizados em formato tabular — um corte no meio da tabela produz um chunk com valores sem cabeçalho, que o modelo não consegue interpretar corretamente.

**Por que é grave:** Chunking ruim não é recuperável em geração. O LLM só responde bem se os chunks que recebeu contêm a informação completa. Nenhum ajuste de prompt corrige um chunk truncado.

**Alternativa:** Chunking por seção semântica (headers Markdown, títulos de seção em PDF) com overlap de 10% (~50 tokens) entre chunks adjacentes. O overlap garante que perguntas sobre o final de uma seção encontrem o contexto correto mesmo se o retriever trouxer o chunk da seção seguinte. Para documentos escaneados (15% da base), chunking por parágrafo após extração OCR.

---

### Problema 2 — Apenas 3 chunks por query

**O que está errado:** 3 chunks é um teto arbitrariamente baixo que falha em dois cenários frequentes do atendimento NovaTech:

1. **Perguntas multi-domínio:** um atendente pergunta "qual o SLA do cliente Gold para devolução com frete especial?" — essa resposta requer chunks de SLA-2024, POL-001 e PROC-042. Com 3 chunks, o retriever precisa acertar exatamente os três certos. Se qualquer um errar e trazer um chunk irrelevante, a resposta fica incompleta.

2. **Documentos contraditórios:** PROC-042 e PROC-042-v2 têm multiplicadores diferentes para as mesmas regiões. Para mostrar ambas as versões com data de vigência (requisito do Product Specialist), o pipeline precisa trazer pelo menos 2 chunks de versões diferentes do mesmo documento — deixando apenas 1 slot para outros documentos relevantes.

**Alternativa:** Teto de 12 chunks por query com reranking por score de similaridade. O orçamento de contexto (ADR-0002: 8K tokens, ~480 tokens por chunk) acomoda 12 chunks confortavelmente.

---

### Problema 3 — Pipeline de ingestão manual

**O que está errado:** "Roda manualmente quando alguém lembra de atualizar" não é uma estratégia operacional — é uma ausência de estratégia. Os impactos concretos:

- A NovaTech atualiza documentação mensalmente em 3 áreas (Operações, Compliance, Comercial) sem processo unificado. Sem automação, qualquer das três pode publicar um documento novo e ninguém acionar a reingestão.
- O requisito do Product Specialist é ≤24h de defasagem entre publicação e disponibilidade no assistente. Com ingestão manual, esse SLA é impossível de garantir.
- Um procedimento publicado durante um feriado, férias do responsável ou qualquer janela de ausência fica invisível para o assistente até alguém notar.

**Alternativa:** Pipeline incremental automatizado via Azure Functions acionado por eventos de modificação no SharePoint e Confluence (webhooks nativos). A reingestão processa apenas documentos novos ou modificados, não a base inteira. SLA de 24h passa a ser um invariante de sistema, não uma promessa informal.

---

### Problema 4 — Índice único sem metadados de vigência

**O que está errado:** Um índice plano sem metadados estruturados torna impossível:

- Distinguir a versão vigente da obsoleta (PROC-042 vs PROC-042-v2 ficam misturados)
- Filtrar por fonte (SharePoint vs Confluence vs Excel têm níveis de confiabilidade diferentes)
- Implementar o comportamento definido no ADR-0003: quando o retriever detecta contradição, precisa comparar `data_vigencia` dos dois chunks para informar ao atendente qual é o mais recente

**Alternativa:** Metadados obrigatórios por documento no índice: `doc_id`, `titulo`, `versao`, `data_publicacao`, `data_vigencia`, `fonte` (sharepoint/confluence/excel), `area_responsavel`. O retriever usa `data_vigencia` para ordenar versões conflitantes e o sistema de detecção de contradições compara `doc_id` idênticos com `versao` diferente.

---

### Problema 5 — Embeddings com ada-002

**O que está errado:** O `text-embedding-ada-002` foi marcado como modelo legado pela OpenAI desde o lançamento dos modelos `text-embedding-3-*` em janeiro de 2024. Adotar ada-002 em um projeto novo significa iniciar com dívida técnica imediata:

- `text-embedding-3-small` custa ~5x menos por token e performa melhor em benchmarks de retrieval semântico
- `text-embedding-3-large` oferece dimensionalidade configurável (256 a 3.072 dimensões), útil para reduzir custo de armazenamento vetorial
- Migração de embeddings exige reingestão completa da base (~12M tokens) — quanto mais tarde, mais caro

**Alternativa:** `text-embedding-3-small` como padrão. Só justifica `text-embedding-3-large` se testes de qualidade de retrieval com o golden dataset mostrarem gap relevante.

---

### Problema 6 — Sem tratamento para documentos escaneados

**O que está errado:** 15% da base (~180 documentos) são PDFs escaneados que chegam como imagens sem texto extraível. A proposta não menciona nenhuma etapa de pré-processamento. Se esses documentos forem indexados sem OCR, os chunks resultantes serão strings vazias ou lixo binário — o retriever nunca os encontrará, como se não existissem.

**Alternativa:** Etapa de extração obrigatória antes da indexação: Azure AI Document Intelligence (já disponível no Azure AI Services contratado) para OCR + extração de tabelas. O pipeline detecta documentos escaneados pelo tipo MIME e os roteia para extração antes do chunking.

---

## Parte 2 — Revisão do Claude

*Ao colar a proposta no Claude com o pedido "identifique problemas técnicos nesta arquitetura de RAG para o contexto NovaTech", o Claude retornou:*

**Problemas identificados pelo Claude:**

1. **Chunking fixo sem overlap** — Mesmo diagnóstico da revisão humana: fronteiras arbitrárias perdem contexto semântico. O Claude adicionou: chunks de 512 tokens é razoável para prosa, mas inadequado para documentos com estrutura tabular densa.

2. **Volume de chunks insuficiente** — O Claude identificou o problema de 3 chunks, focando no ângulo de perguntas complexas. Não chegou a vincular ao requisito de contradições e ao ADR-0003.

3. **Ingestão manual como risco operacional** — O Claude identificou diretamente, com ênfase no risco de documentação desatualizada sem mecanismo de alerta.

4. **Ausência de metadados** — O Claude identificou que um índice sem metadados não permite filtros por data ou fonte, tornando o tratamento de versões conflitantes impossível.

5. **Sem estratégia de fallback** — O Claude adicionou um risco que a revisão humana não levantou: o que acontece quando o Azure AI Search está indisponível? A proposta não menciona circuit breaker, timeout, nem mensagem de fallback para o usuário do Teams.

6. **Controle de acesso não resolvido** — O Claude identificou que documentos do SharePoint têm permissões de acesso por usuário/grupo que o índice único não herda. Um atendente de nível básico poderia recuperar chunks de documentos restritos a supervisores.

**O que o Claude NÃO identificou:**

- O problema específico de ada-002 ser um modelo legado. O Claude mencionou genericamente "considere avaliar modelos de embedding mais recentes", sem citar o modelo alternativo nem o custo comparativo.
- O risco de chunking em tabelas de frete com 15+ colunas. O Claude tratou o problema de chunking de forma genérica, sem vincular à estrutura específica dos documentos PROC-042.
- A ausência de tratamento para documentos escaneados (OCR). O Claude não mencionou este ponto.

---

## Parte 3 — Comparação: Humano vs Claude

| Problema | Revisão Humana | Revisão Claude |
|---|---|---|
| Chunking fixo sem overlap | ✓ Com detalhe de tabelas de frete | ✓ Genérico |
| 3 chunks insuficiente | ✓ Vinculado a contradições (ADR-0003) | ✓ Vinculado a perguntas complexas |
| Ingestão manual | ✓ Com SLA de 24h do cliente | ✓ Com risco de alerta ausente |
| Índice sem metadados de vigência | ✓ Com referência ao ADR-0003 | ✓ Genérico |
| ada-002 legado | ✓ Com custo comparativo | — Mencionou "avaliar outros modelos" sem precisão |
| Documentos escaneados sem OCR | ✓ | — Não identificou |
| Sem fallback de disponibilidade | — Não identificou | ✓ |
| Controle de acesso do SharePoint | — Não identificou | ✓ |

**Análise:**

A revisão humana foi mais profunda nos problemas que dependem de conhecimento do domínio NovaTech: a estrutura específica dos documentos de frete, o requisito concreto de 24h do Product Specialist, e a obsolescência do ada-002 com números de custo. Esses problemas exigem contexto acumulado sobre o projeto — o Claude só os identificaria com um briefing mais completo.

O Claude foi mais abrangente nos riscos de infraestrutura genéricos de RAG — fallback de disponibilidade e controle de acesso são problemas que aparecem em qualquer sistema RAG corporativo, mas estavam fora do foco da revisão humana por serem menos óbvios no enunciado. Essa é a contribuição mais valiosa de usar IA como par de revisão: cobertura de categorias de risco que o revisor humano não tinha em mente.

**Lição operacional:** Usar o Claude como segunda revisão não é redundância — é diversidade de perspectiva. O revisor humano traz profundidade de contexto de domínio; o Claude traz amplitude de cobertura de categorias de risco. A lista final combinada é mais robusta do que qualquer uma isolada.

---

## Parte 4 — Proposta Reescrita

*Incorpora todos os problemas identificados. Mantém a stack Azure sem adicionar componentes desnecessários.*

---

**Proposta revisada — Pipeline RAG NovaTech**

**Embeddings:** `text-embedding-3-small` (Azure OpenAI). Substitui o ada-002 legado. Reingestão da base completa na primeira carga; incrementos são baratos (~5x menor custo por token).

**Extração e pré-processamento:**
- Documentos de texto (PDF editável, DOCX, HTML): extração direta de texto com estrutura de headers preservada
- Documentos escaneados (~15% da base): roteados para Azure AI Document Intelligence antes da indexação (OCR + extração de tabelas)
- Planilhas Excel: convertidas para texto tabular estruturado com cabeçalhos de coluna preservados

**Chunking:** Por seção semântica (delimitada por headers H1/H2/H3), com overlap de 10% (~50 tokens) entre chunks adjacentes. Tamanho alvo: 400–600 tokens por chunk. Tabelas permanecem inteiras no mesmo chunk; se a tabela exceder 600 tokens, é dividida mantendo o cabeçalho em cada fragmento.

**Metadados obrigatórios por chunk indexado:**

| Campo | Tipo | Exemplo |
|---|---|---|
| `doc_id` | string | `PROC-042` |
| `versao` | string | `v2` |
| `data_publicacao` | date | `2024-03-15` |
| `data_vigencia` | date | `2024-04-01` |
| `fonte` | enum | `sharepoint`, `confluence`, `excel` |
| `area_responsavel` | string | `Operações` |
| `permissao_acesso` | enum | `atendente`, `supervisor`, `todos` |

**Retrieval:** 12 chunks por query (teto), com reranking por score de similaridade. Filtro de `permissao_acesso` aplicado no retriever antes do ranking — chunks restritos não chegam ao LLM se o usuário não tem permissão. Detecção de contradição: se dois chunks com mesmo `doc_id` e `versao` diferente estiverem no resultado, ambos são incluídos com seus metadados de vigência.

**Geração:** GPT-4o (Azure OpenAI, versão pinned). System prompt v2 (definido no exercício 1.2).

**Ingestão incremental:** Azure Functions acionado por webhooks de modificação no SharePoint e Confluence. Cada evento de publicação dispara a extração, chunking e indexação apenas do documento alterado. SLA: documento disponível no assistente em até 24h após publicação. Alertas automáticos se a fila de ingestão parar por mais de 2h.

**Fallback de disponibilidade:** Se o Azure AI Search retornar erro ou timeout >5s, o assistente responde com mensagem padrão: "O sistema de busca está temporariamente indisponível. Por favor, consulte o SharePoint diretamente ou acione o supervisor." Nenhuma chamada ao LLM é feita sem chunks — o modelo não responde no modo de conhecimento geral.

**Observabilidade:** Log estruturado de cada query com: score dos chunks retornados, flag de contradição detectada, flag de "nenhum chunk relevante" (score < threshold). Dashboard mínimo: % de queries sem resposta por dia, contagem de contradições ativas no índice.
