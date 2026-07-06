# Skill `azure-functions-endpoint` (Domain) — Specification

## Problem Statement

O repositório `novatech-assistant` tem a hierarquia de skills (Foundation → Domain → Artifact) definida no Anexo C, mas `skills/domain/azure-functions-endpoint.md` está vazio (0 bytes). Sem essa skill, um agente de codificação (GitHub Copilot) que gera um endpoint Azure Functions não tem nenhuma orientação prescritiva além do que já está em `AGENTS.md` (regras gerais do projeto) — não há receita concreta do padrão HTTP trigger (registro `app.http`, forma do handler, onde plugar Zod/pino/erros customizados, o que não fazer). Sem prova empírica de que a skill muda o comportamento de geração, "escrever a skill" é apenas um documento teórico.

## Goals

- [ ] `skills/domain/azure-functions-endpoint.md` (v1) escrito de forma prescritiva, com exemplos de código DO/DON'T reais em TypeScript e anti-padrões documentados.
- [ ] Ciclo de teste real (dois rounds) com um agente de codificação isolado (substituto do GitHub Copilot — mesma decisão de tooling do Exercício 2.1/2.2, ver Assumptions) gerando o endpoint `health` a partir da skill.
- [ ] Iteração v1 → v2 rastreável a achados reais da rodada 1, com melhora comprovada na rodada 2.
- [ ] Critérios de "skill madura" práticos e mensuráveis.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Skills Foundation (`typescript-conventions`, `error-handling`, `project-structure`) | Fora do recorte do Exercício 2.3 (que pede especificamente a skill Domain `azure-functions-endpoint`); a exercício não pede as demais |
| Skills Domain restantes (`azure-ai-search-integration`, `react-components`, `testing-patterns`) | Mesmo motivo — o enunciado pede uma única skill Domain como exemplo |
| Skills Artifact (`create-rag-endpoint`, `create-integration-test`, `create-react-card`) | Nível diferente da hierarquia; dependem de skills Domain/Foundation ainda não escritas |
| Implementação completa e produtização do endpoint `health` (checagem real de Azure AI Search/OpenAI) | O endpoint é usado como sonda de conformidade à skill; a exercício não pede um health check de produção — checagens de dependência externa são simuladas (mock), não chamadas reais |
| Commits git / abertura de PR real | Instrução explícita do usuário nesta sessão: não é necessário commitar nada. `docs/pull-requests/PR-000N.md` ainda é escrito como artefato (documento), mas sem o ciclo de commit-por-tarefa que as features anteriores (`agents-md-tech-lead`, `mcp-architecture`) usaram |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Ferramenta de teste (GitHub Copilot real vs. substituto) | Subagente Claude isolado (Agent tool), sem histórico da conversa, sem acesso a `.specs/`, `docs/`, `.claude/` ou à própria skill fora do arquivo `skills/domain/azure-functions-endpoint.md` | Mesma decisão já tomada e aprovada nas duas features anteriores (`context.md` de `agents-md-tech-lead`): Copilot CLI está instalado mas não autenticado nesta máquina, e reautenticar exige ação humana fora do escopo do agente. Reaplicar o precedente evita repetir a mesma pergunta ao usuário | y (precedente já aprovado nas features irmãs) |
| Endpoint-sonda usado para testar a skill | `src/functions/health/handler.ts` (GET `/api/health`, com query param opcional `deep` validado por Zod) | É o único stub do scaffold ainda **totalmente vazio** (0 bytes) — usar `feedback` (já implementado no Ex. 2.1) ou `query` (stub com corpo, fora do escopo desta feature) contaminaria a comparação com código pré-existente. `health` permite exercitar o padrão completo (registro HTTP, Zod em input opcional, pino, erro customizado para falha de dependência simulada) sem reescrever trabalho de outra feature | y |
| Escopo funcional do endpoint `health` | Checagem "rasa" por padrão (200, `{status: "ok"}`); com `?deep=true` (Zod: `z.enum(["true","false"]).optional()`), simula checagem de 2 dependências (Azure AI Search, Azure OpenAI) via função mockada, retornando 200 (`healthy`) ou 503 (`degraded`, com detalhe por dependência) | Precisa de superfície rica o bastante para testar Zod (input opcional), pino (log estruturado) e uma classe de erro customizada (falha de dependência) — um `health` só-200 não testaria nada disso | y |
| Prompt idêntico entre rodada 1 e rodada 2 | Sim — mesmo prompt salvo em arquivo, dispatched como agente fresco (sem memória) nas duas rodadas; só o conteúdo da skill muda | Isola a variável testada (mesmo raciocínio do Ex. 2.1) | y |
| Local da evidência | `.specs/features/azure-functions-endpoint-skill/evidence/round-{1,2}/` | Mesmo padrão das duas features anteriores | y |
| Commits / branch | Nenhum commit nesta feature (instrução explícita do usuário) | Ver Out of Scope | y |

**Open questions:** nenhuma — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Escrever a skill `azure-functions-endpoint` de forma prescritiva ⭐ MVP

**User Story**: Como Tech Lead, quero escrever a skill Domain `azure-functions-endpoint` com regras concretas e exemplos DO/DON'T, para que um agente de codificação gere endpoints consistentes com o padrão do projeto sem eu precisar corrigir manualmente.

**Why P1**: É o entregável central do exercício — sem isso não há o que testar.

**Acceptance Criteria**:

1. WHEN a skill v1 é lida THEN ela SHALL conter: contexto (quando usar), regras prescritivas ("DEVE"/"NUNCA"), pelo menos 2 exemplos de código DO/DON'T reais em TypeScript (registro do handler `app.http`; validação de input com Zod), uma seção de anti-padrões comuns com explicação do porquê é errado, e uma lista de dependências (`AGENTS.md`, `src/shared/logger.ts`, `src/shared/errors.ts`, skill `testing-patterns` — mesmo vazia, citada como dependência futura). (REQ-01)
2. WHEN a skill v1 é lida THEN as regras SHALL ser consistentes com `AGENTS.md` já existente (Azure Functions v4 `app.http`, nunca `function.json` v3; Zod para todo input; pino via `src/shared/logger.ts`, nunca `console.log` nem instância local; TypeScript strict). (REQ-02)

**Independent Test**: Ler a skill v1 isoladamente e fazer checklist manual de presença de cada elemento do REQ-01 — verificável sem rodar nenhum agente.

---

### P1: Validar empiricamente que a skill é seguida por um agente de codificação real ⭐ MVP

**User Story**: Como Tech Lead, quero rodar um agente de codificação real (ou o substituto aprovado) contra a skill e documentar o que ele seguiu ou ignorou, para que a decisão de aceitar a skill seja baseada em evidência.

**Why P1**: É o critério com red-flag mais severo da régua de nota (`avaliacao-tech-lead.md`: "sem evidência → D2 ≤ 1").

**Acceptance Criteria**:

1. WHEN um agente de codificação isolado (substituto do Copilot — ver Assumptions) é invocado com a skill v1 presente e o prompt fixo pedindo a implementação de `src/functions/health/handler.ts` (+ `validator.ts` se o agente optar por separar validação) THEN o prompt exato, o relatório final do agente e o diff do código gerado SHALL ser capturados em `evidence/round-1/`. (REQ-03)
2. WHEN o código gerado na rodada 1 é comparado item a item contra REQ-01 e REQ-02 THEN a análise SHALL listar explicitamente cada regra seguida e cada regra ignorada, sem omitir não-conformidades. (REQ-03, REQ-05)

**Independent Test**: Os arquivos de prompt, relatório e diff em `evidence/round-1/` existem e são internamente consistentes (o prompt citado no relatório é, palavra por palavra, o conteúdo do arquivo de prompt); se `npm run build`/`npm test` forem aplicáveis ao código gerado, o resultado é reproduzido de forma independente, não apenas relatado pelo autor.

---

### P1: Iterar a skill com base na evidência e comprovar a melhora ⭐ MVP

**User Story**: Como Tech Lead, quero reescrever as seções da skill que o agente ignorou na rodada 1, de forma mais prescritiva, e testar de novo, para provar que a iteração produz melhora real.

**Why P1**: Sem uma segunda rodada comparável, "iteramos" não é verificável — o red flag "V1 = V2" da régua de nota.

**Acceptance Criteria**:

1. WHEN a skill v2 é comparada à v1 THEN cada seção reescrita SHALL corresponder a um item marcado como "ignorado" ou "parcial" na análise da rodada 1 — nenhuma reescrita sem motivo rastreável. (REQ-04)
2. WHEN o mesmo agente isolado é invocado novamente com o mesmo prompt da rodada 1, agora com a skill v2 presente THEN o prompt, o relatório e o diff SHALL ser capturados em `evidence/round-2/`, preservando os artefatos da rodada 1 intactos. (REQ-03, REQ-04)
3. WHEN as rodadas 1 e 2 são comparadas THEN a análise SHALL declarar, para cada regra antes ignorada, se a rodada 2 corrigiu o comportamento — e SHALL declarar explicitamente qualquer regra que continue ignorada mesmo após a reescrita. (REQ-04, REQ-05)

**Independent Test**: `evidence/round-1/` e `evidence/round-2/` coexistem; a comparação cita ambos por caminho de arquivo, item a item.

---

### P2: Definir critérios de "skill madura"

**User Story**: Como Tech Lead, quero critérios objetivos para saber quando uma skill está pronta para uso pelo time, para não depender de julgamento subjetivo ("parece boa").

**Why P2**: Importante para a governança de skills do projeto, mas não bloqueia a prova do ciclo empírico desta feature (P1s).

**Acceptance Criteria**:

1. WHEN os critérios de maturidade são lidos THEN eles SHALL ser mensuráveis (contáveis ou verificáveis por evidência), não vagos (ex.: não "quando parecer boa"). (REQ-06)
2. WHEN os critérios de maturidade são aplicados à skill `azure-functions-endpoint` desta própria feature THEN o documento SHALL declarar explicitamente se ela já atinge o status de "madura" ao final do ciclo de 2 rodadas, ou o que falta. (REQ-06)

**Independent Test**: Os critérios citam números/condições concretas (ex.: "N gerações consecutivas sem regressão", "M anti-padrões validados por teste real") — não frases de sentimento.

---

## Edge Cases

- WHEN o agente de codificação isolado falhar ou pedir uma ferramenta fora do escopo concedido THEN a execução SHALL ser interrompida e reportada — nunca substituída por texto inventado simulando o output. (Dimensão "External-dependency failure".)
- WHEN a skill v2 não corrigir uma regra específica mesmo após reescrita THEN isso SHALL ser documentado como limitação conhecida, não omitido. (REQ-05)
- WHEN o agente gerar código que não compila (`npm run build` falha) THEN o resultado SHALL ser registrado como está (falha real), não corrigido manualmente antes de reportar — a correção manual mascararia o que a skill realmente produziu.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| REQ-01 | P1: Escrever skill prescritiva | Tasks (T1, T4) | ✅ Verified |
| REQ-02 | P1: Escrever skill prescritiva | Tasks (T1) | ✅ Verified |
| REQ-03 | P1: Validar empiricamente | Tasks (T2, T5) | ✅ Verified |
| REQ-04 | P1: Iterar com base em evidência | Tasks (T4, T5, T6) | ⚠️ Verified with 2 gaps found and fixed — see `validation.md` (Re-verificação) |
| REQ-05 | P1: Validar / Iterar | Tasks (T3, T6) | ✅ Verified |
| REQ-06 | P2: Critérios de skill madura | Tasks (T7) | ✅ Verified |

**ID format:** `REQ-NN`, mirrors the Exercício 2.3 grading rubric rows in `avaliacao-tech-lead.md`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 6 total, 6 mapped to tasks, 0 unmapped.

### Implicit-Requirement Dimensions Sweep (Medium tier — dimensions obviously present only)

| Dimension | Resolution |
| --- | --- |
| Input validation & bounds | Requirement: skill must mandate Zod for the `deep` query param (folded into REQ-01/REQ-02). |
| Failure / partial-failure states | Requirement: skill must mandate a custom error / structured 503 response for simulated dependency failure (folded into REQ-01). |
| Observability | Requirement: skill must mandate pino structured logging via `src/shared/logger.ts` (folded into REQ-02). |
| External-dependency failure | Ver Edge Cases — falha do agente isolado deve ser reportada, nunca mascarada. |
| Remaining dimensions (idempotency, auth, concurrency, data lifecycle, state-transition) | N/A for this scope — o endpoint `health` é um GET stateless, sem persistência, sem auth própria (herda o gateway do projeto), sem transições de estado. |

---

## Success Criteria

- [x] Skill v1 e v2 existem, com diff mostrando reescrita direcionada por achados reais (não V1 = V2) — `evidence/round-1/skill-v1-to-v2.diff`, confirmado independentemente pelo Verifier (`validation.md`, Re-verificação Fix 2).
- [x] Duas rodadas de evidência real (agente isolado) existem em `evidence/round-1/` e `evidence/round-2/`, com prompt byte-idêntico entre elas (confirmado por `md5sum` após correção — ver `validation.md`).
- [x] A análise seguiu/ignorou cobre REQ-01/REQ-02 nas duas rodadas, sem omitir não-conformidades — `evidence/round-1/analise-v1.md`, `evidence/comparacao-v1-v2.md`.
- [x] Critérios de maturidade mensuráveis definidos e aplicados à própria skill — `criterios-skill-madura.md`.
- [x] Todas as dimensões implícitas resolvidas (requisito ou N/A justificado) — ver tabela "Implicit-Requirement Dimensions Sweep" acima.
