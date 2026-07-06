# Skill `azure-functions-endpoint` — Tasks

## Execution Protocol

Implementado com a skill `tlc-spec-driven` (Specify já feito → Design pulado, sem decisão de arquitetura, é autoria de documento + ciclo de teste empírico, mesmo raciocínio de `agents-md-tech-lead/context.md` → Tasks abaixo → Execute).

**Desvio combinado com o usuário nesta sessão:** sem commits por tarefa (instrução explícita) — cada task é concluída e verificada pelo gate, mas o "Commit" do template abaixo é substituído por "Estado do working tree" (arquivos criados/alterados, sem `git commit`). Sub-agentes são usados para as rodadas de teste (T2, T5) e para o Verifier final, para manter o contexto do agente principal enxuto — não para paralelismo de wall-clock (o ciclo é empírico e sequencial, ver Parallelism Assessment abaixo).

**Spec**: `.specs/features/azure-functions-endpoint-skill/spec.md`
**Status**: Approved (autorização do usuário nesta sessão, incluindo uso de sub-agentes)

---

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| `src/functions/health/handler.ts` (+ `validator.ts` se separado) — gerado pelo agente isolado como sonda de conformidade | unit | Happy path (200 raso), `?deep=true` saudável (200) e `?deep=true` com dependência falha (503) — a profundidade mínima que comprova a skill, não cobertura de negócio exaustiva | `tests/unit/health-handler.test.ts` | `npm test` (`vitest run`) |
| `skills/domain/azure-functions-endpoint.md` (Markdown) | none | — revisão humana + verificação empírica via agente isolado, não testável por test runner | `skills/domain/azure-functions-endpoint.md` | — |
| `docs/pull-requests/PR-0003-azure-functions-endpoint-skill.md` | none | — documento | `docs/pull-requests/` | — |

## Parallelism Assessment

| Aspect | Parallel-safe? | Rationale |
| --- | --- | --- |
| Wall-clock entre T1→T7 | **Não** | Ciclo empírico linear: escrever v1 → testar → analisar → reescrever v2 (guiado pelos achados) → testar de novo → comparar → critérios de maturidade. Cada passo consome o artefato real do anterior; não há "ramos" independentes a paralelizar (mesma conclusão de `agents-md-tech-lead/tasks.md`). |
| Isolamento de contexto via sub-agente (T2, T5, Verifier) | **Sim — é o eixo real de paralelismo útil aqui** | T2/T5 despacham um agente fresco (Agent tool), sem histórico da conversa principal, restrito a ler apenas a skill-alvo + o stub `health/` — o transcript completo da geração de código (potencialmente extenso) fica isolado no sub-agente; só o relatório final + diff retornam ao agente principal. O Verifier final é outro agente isolado (author ≠ verifier), evitando que a verificação herde o modelo mental de quem escreveu a skill. Isso não acelera o relógio (T5 só pode rodar depois de T4), mas evita "estufar" o contexto principal com 3 transcritos completos de geração/verificação. |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após T2 e T5 (código gerado, antes da análise) | `npm run build` (type-check via `tsc -p .`) |
| Full | Após T7 (endpoint final + teste presentes) | `npm run build && npm test` |
| Build | Tarefas só de documentação (T1, T3, T4, T6, T7-doc) | Nenhum comando de código — revisão de conteúdo contra REQ-IDs do spec |

---

## Execution Plan

### Phase 1: Skill v1 (Sequential — inline, agente principal)

```
T1
```

### Phase 2: Rodada 1 — teste com agente isolado (Sequential)

```
T1 → T2 → T3
```

### Phase 3: Iteração (Sequential)

```
T3 → T4 → T5 → T6 → T7
```

3 fases → oferta de sub-agente por fase não se aplica da forma "1 worker por fase completa" (as fases são curtas, 1-3 tarefas fortemente sequenciais); em vez disso, sub-agentes são usados pontualmente dentro das fases (T2, T5) e um Verifier isolado ao final — ver Parallelism Assessment.

---

## Task Breakdown

### T1: Escrever skill `azure-functions-endpoint.md` v1

**What**: Preencher `skills/domain/azure-functions-endpoint.md` (hoje vazio) com: contexto de uso, regras prescritivas, ≥2 exemplos DO/DON'T (registro `app.http`; validação Zod), seção de anti-padrões comuns (com explicação), lista de dependências.
**Where**: `skills/domain/azure-functions-endpoint.md`
**Depends on**: None
**Reuses**: `AGENTS.md` (Coding Standards já escritas no Ex. 2.1), `src/functions/feedback/handler.ts` (único endpoint real do repo, referência de estilo), `docs/cenario-2/anexo-c-estrutura-repositorio.md` (hierarquia de skills)
**Requirement**: REQ-01, REQ-02

**Tools**: MCP: NONE. Skill: NONE (autoria direta).

**Done when**:
- [ ] Todas as 5 seções do REQ-01 presentes e checáveis por leitura direta
- [ ] Consistente com `AGENTS.md` (REQ-02)

**Tests**: none
**Gate**: build (revisão de conteúdo)
**Estado do working tree**: arquivo criado, sem commit

---

### T2: Gerar endpoint `health` com agente isolado (skill v1)

**What**: Despachar um sub-agente (Agent tool) fresco, sem histórico da conversa, com instrução explícita de **não ler** `.specs/`, `docs/`, `.claude/`, `AGENTS.md` ou qualquer skill além de `skills/domain/azure-functions-endpoint.md` — apenas essa skill + o caminho do stub-alvo. Prompt fixo pedindo a implementação de `GET /api/health` (checagem rasa + `?deep=true`) em `src/functions/health/handler.ts` (e `validator.ts` se o agente optar). Salvar prompt, relatório e diff em `evidence/round-1/`.
**Where**: `src/functions/health/handler.ts`, possivelmente `src/functions/health/validator.ts`
**Depends on**: T1
**Reuses**: N/A (isolamento é o ponto)
**Requirement**: REQ-03

**Tools**: MCP: NONE. Skill: NONE (a skill sob teste é o artefato-alvo do próprio agente isolado, não uma skill do Claude Code).

**Done when**:
- [ ] `evidence/round-1/prompt.txt`, `evidence/round-1/agent-report.md`, `evidence/round-1/endpoint.diff` existem, de execução real
- [ ] `npm run build` roda contra o código gerado — resultado registrado (passa ou falha)
- [ ] Estado do working tree registrado (sem commit)

**Tests**: none (o teste é gerado na T7, ver nota)
**Gate**: quick (`npm run build`)

---

### T3: Análise seguiu/ignorou — rodada 1 (v1)

**What**: Comparar o código gerado na T2 contra REQ-01/REQ-02 item a item: seguiu, ignorou ou parcial, com trecho de código como evidência.
**Where**: `.specs/features/azure-functions-endpoint-skill/evidence/round-1/analise-v1.md`
**Depends on**: T2
**Requirement**: REQ-03, REQ-05

**Done when**:
- [ ] Cada regra tem veredito explícito com trecho citado
- [ ] Nenhuma não-conformidade omitida

**Tests**: none
**Gate**: build

---

### T4: Reescrever skill v2

**What**: Reescrever apenas as seções que a T3 marcou como ignoradas/parciais, tornando-as mais prescritivas (exemplo DO/DON'T concreto adicional onde fizer diferença). Seções 100% seguidas na rodada 1 não mudam.
**Where**: `skills/domain/azure-functions-endpoint.md`
**Depends on**: T3
**Requirement**: REQ-04

**Done when**:
- [ ] Todo trecho reescrito é rastreável a um item "ignorado"/"parcial" da T3
- [ ] Diff mostra mudança cirúrgica, não reescrita cosmética do documento inteiro

**Tests**: none
**Gate**: build

---

### T5: Rodada 2 — regenerar endpoint com agente isolado (skill v2)

**What**: Repetir exatamente o mesmo prompt da T2 (agente fresco, mesmo isolamento), agora com a skill v2 presente. Preservar os artefatos da rodada 1 (já capturados em `evidence/round-1/`) antes de sobrescrever o working tree; salvar novos artefatos em `evidence/round-2/`.
**Where**: `src/functions/health/handler.ts` (+ `validator.ts`), `evidence/round-2/`
**Depends on**: T4
**Requirement**: REQ-03, REQ-04

**Done when**:
- [ ] `evidence/round-2/prompt.txt`, `agent-report.md`, `endpoint.diff` existem, de execução real
- [ ] `npm run build` roda contra o código da rodada 2 — resultado registrado
- [ ] `evidence/round-1/` permanece intacto

**Tests**: none
**Gate**: quick (`npm run build`)

---

### T6: Comparação v1→v2

**What**: Para cada regra de REQ-01/REQ-02 marcada como ignorada/parcial na T3: declarar se a rodada 2 corrigiu (com evidência de código) ou se continua ignorada (limitação documentada, REQ-05).
**Where**: `.specs/features/azure-functions-endpoint-skill/evidence/comparacao-v1-v2.md`
**Depends on**: T5
**Requirement**: REQ-04, REQ-05

**Done when**:
- [ ] Toda regra da T3 marcada como ignorada/parcial tem veredito de "corrigida" ou "ainda ignorada"

**Tests**: none
**Gate**: build

---

### T7: Teste Vitest final + critérios de skill madura + PR-0003

**What**: (a) Escrever `tests/unit/health-handler.test.ts` cobrindo os 3 casos da Test Coverage Matrix contra o código final (pós rodada 2) e rodar o gate full; (b) escrever `skills/domain/MATURIDADE.md`-equivalente — na prática, uma seção dedicada dentro do documento de comparação ou um arquivo próprio `criterios-skill-madura.md` com critérios mensuráveis (REQ-06), aplicados à própria skill desta feature; (c) `docs/pull-requests/PR-0003-azure-functions-endpoint-skill.md`.
**Where**: `tests/unit/health-handler.test.ts`, `.specs/features/azure-functions-endpoint-skill/criterios-skill-madura.md`, `docs/pull-requests/PR-0003-azure-functions-endpoint-skill.md`
**Depends on**: T6
**Requirement**: REQ-06

**Done when**:
- [ ] `npm run build && npm test` verde
- [ ] Critérios de maturidade mensuráveis, aplicados à skill desta feature com veredito explícito (madura / não madura / condições faltantes)
- [ ] PR-0003 lista objetivo, mudanças v1→v2, checklist de validation gates

**Tests**: unit (próprio deliverable)
**Gate**: full (`npm run build && npm test`)

---

## Parallel Execution Map

```
Phase 1: T1
Phase 2: T1 → T2 → T3
Phase 3: T3 → T4 → T5 → T6 → T7
```

Nenhuma tarefa `[P]` no sentido de wall-clock — é um ciclo empírico linear. O paralelismo real desta feature está em **quem executa** cada tarefa (agente principal vs. sub-agente isolado), não em rodar tarefas simultaneamente:

| Task | Executor | Por quê |
| --- | --- | --- |
| T1, T3, T4, T6, T7 | Agente principal (inline) | Autoria/análise que precisa do contexto completo da feature (spec, achados anteriores) — delegar isso a um sub-agente exigiria repassar todo esse contexto, o que não economiza espaço. |
| T2, T5 | Sub-agente isolado (Agent tool, fresco, sem histórico) | Simula "um agente que só conhece a skill" (requisito da própria feature) **e** mantém o transcript completo de geração de código fora do contexto principal — só o relatório final + diff retornam. |
| Verifier (pós-T7, automático) | Sub-agente isolado (author ≠ verifier) | Regra não-negociável da skill `tlc-spec-driven`; mesmo raciocínio de isolamento de contexto. |

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | 1 arquivo (skill v1) | ✅ Granular |
| T2 | 1-2 arquivos (endpoint via sub-agente) | ✅ Granular |
| T3 | 1 documento de análise | ✅ Granular |
| T4 | 1 arquivo (skill v2, reescrita direcionada) | ✅ Granular |
| T5 | mesmo par de T2, regenerado | ✅ Granular |
| T6 | 1 documento de comparação | ✅ Granular |
| T7 | 1 teste + 1 doc de critérios + 1 PR | ✅ Granular (3 artefatos da mesma unidade de fechamento) |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T2 | `src/functions/health/*` | unit | none (deliberado — o teste da T7 é parte do que valida o resultado final, não uma tarefa nossa de cobertura própria) | ✅ OK |
| T5 | mesmo layer, regenerado | unit | none (mesmo motivo) | ✅ OK |
| T7 | `tests/unit/health-handler.test.ts` | unit | unit | ✅ OK |
| T1, T3, T4, T6 | Markdown | none | none | ✅ OK |
