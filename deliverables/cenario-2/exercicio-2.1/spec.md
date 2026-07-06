# AGENTS.md — Tech Lead Sections Specification

## Problem Statement

O AGENTS.md deste repositório é a *constitution* que todo agente de IA (Copilot, Claude Code) deve ler antes de gerar qualquer artefato. Hoje ele só tem placeholders `<!-- TODO -->`. Sem conteúdo prescritivo real, agentes geram código inconsistente com as decisões técnicas já tomadas no Cenário 1 (TypeScript strict, Zod, Vitest, pino, Azure Functions v4, Conventional Commits) e sem respeitar o orçamento de contexto da ADR-0002. O Tech Lead precisa escrever as seções sob sua responsabilidade e **provar empiricamente** — com um agente de codificação real, não por inspeção visual — que o texto produz o comportamento pretendido.

## Goals

- [ ] Seções Project Overview, Tech Stack & Architecture, Coding Standards e Build & Deploy do AGENTS.md escritas de forma prescritiva e auditável.
- [ ] Ciclo de teste real (não simulado) com GitHub Copilot CLI, medindo aderência antes (v1) e depois (v2) de uma reescrita orientada por evidência.
- [ ] Análise honesta do que não é seguido, sem inflar a eficácia do documento.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Seções "Product Rules & Guardrails" (Product Specialist), "Testing Standards" (QA), "Project Management Rules" (Delivery Manager) | Pertencem a outros papéis, exercício 2.3 do cenário |
| Arquitetura de MCP servers (`.mcp/mcp.json`) | Exercício 2.2, plano separado |
| Implementação completa e produtização do endpoint `feedback` (persistência real, integração com Azure) | O endpoint é usado apenas como sonda de conformidade ao AGENTS.md; a exercício não pede um pipeline funcional de feedback |
| Escrever as skills técnicas (`skills/domain/*.md`) | Exercício 2.3 |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Qual endpoint usar como sonda de conformidade | `src/functions/feedback/` (handler + validator) | É o stub mais rico do scaffold (recebe input do usuário) — único jeito de testar de verdade a regra de Zod, pino e error handling do AGENTS.md; `health` não tem input e não testaria REQ-06 de forma significativa | y (ver context.md) |
| Prompt do Copilot deve ser idêntico nas duas rodadas | Sim — só o AGENTS.md muda entre v1 e v2 | Isolar a variável testada; senão a comparação v1→v2 fica confundida com mudança de prompt | y |
| Onde guardar evidência das duas rodadas | `.specs/features/agents-md-tech-lead/evidence/round-{1,2}/` (transcript + diff), além do estado final do código no histórico git | Precisamos comparar as duas rodadas lado a lado; git sozinho sobrescreveria round 1 no working tree | y |
| Flags de segurança do Copilot CLI não-interativo | `--allow-all-tools --add-dir <sandbox>` apenas; nunca `--allow-all-paths`/`--yolo` | CLI de terceiros com execução de shell/edição de arquivos — escopo mínimo necessário, path restrito ao sandbox | y |
| Números de context budget a materializar | ~4K tokens system prompt + ~8K tokens chunks (5×~1.500) + histórico de 3 turnos — a formulação simplificada do Cenário 2 (`docs/cenario-2/exercicio-2-fase-estruturacao.md:24`), não os números mais granulares do ADR-0002 original do Cenário 1 | O enunciado do Cenário 2 fornece esses números como o input oficial desta fase; usar os do Cenário 1 introduziria uma inconsistência não pedida | y |

**Open questions:** none — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Tech Lead escreve um AGENTS.md que um agente de codificação realmente segue ⭐ MVP

**User Story**: Como Tech Lead, quero escrever as seções do AGENTS.md sob minha responsabilidade de forma prescritiva, para que um agente de IA gere código aderente às convenções do projeto sem eu precisar corrigir manualmente todo output.

**Why P1**: É o entregável central do Exercício 2.1 — sem isso não há "constitution" funcional.

**Acceptance Criteria**:

1. WHEN o AGENTS.md v1 é lido THEN as seções Project Overview, Tech Stack & Architecture, Coding Standards e Build & Deploy SHALL usar linguagem prescritiva ("DEVE"/"NUNCA"/"SEMPRE"), não narrativa descritiva. (REQ-01)
2. WHEN a seção Tech Stack & Architecture é lida THEN ela SHALL declarar o context budget da ADR-0002 (formulação do Cenário 2): teto de ~4K tokens para system prompt, ~8K tokens para até 5 chunks de ~1.500 tokens por query, e histórico limitado a 3 turnos. (REQ-02)
3. WHEN a seção Coding Standards é lida THEN ela SHALL prescrever: TypeScript strict mode, Zod para validação de input/output de toda function HTTP, pino para logging (proibição explícita de `console.log`), classes de erro customizadas de `src/shared/errors.ts` para estados de falha, Vitest para testes, e Conventional Commits + branch local + PR-como-markdown em `docs/pull-requests/PR-NNNN.md` para o fluxo de mudanças. **Exemplo de código DO/DON'T é exigido apenas para as regras sobre *shape* de código (Zod, pino/logging)** — regras de processo (Vitest, Commits, branch/PR, quando usar classe de erro) são aceitáveis como prosa prescritiva ("DEVE"/"NUNCA"), já que não há um "shape de código" único para ilustrar. **Correção pós-Verifier:** a redação original desta AC pedia DO/DON'T para todos os 6 itens sem essa distinção; `validation.md` marcou isso como spec-precision gap porque só Zod e pino tinham exemplo de código no v1/v2 reais — a AC foi ajustada para refletir o padrão que já fazia sentido (e que o Verifier considerou funcionalmente correto), em vez de forçar exemplos de código artificiais para regras de processo. (REQ-06)

**Independent Test**: Ler o AGENTS.md v1 isoladamente e checklist manual de presença de cada regra acima — verificável sem rodar nenhum agente.

---

### P1: Validar empiricamente que o AGENTS.md é seguido por um agente real ⭐ MVP

**User Story**: Como Tech Lead, quero rodar um agente de codificação real contra o AGENTS.md e documentar o que ele seguiu ou ignorou, para que a decisão de aceitar o documento seja baseada em evidência, não em leitura própria.

**Why P1**: É a diferença entre um documento "que parece bom" e um documento comprovadamente eficaz — e é o critério com red-flag mais severo da régua de nota (`avaliacao-tech-lead.md`: "sem evidência de teste → D2 ≤ 1").

**Acceptance Criteria**:

1. WHEN um agente de codificação real é invocado dentro do sandbox, com o AGENTS.md v1 presente, pedindo a implementação do endpoint `feedback` (handler + validator) THEN o prompt exato, o relatório completo e o diff gerado SHALL ser capturados em `evidence/round-1/`. **Ferramenta:** GitHub Copilot CLI é a ferramenta-alvo original; se ela não estiver autenticável na sessão, um subagente Claude isolado (Agent tool, sem histórico da conversa, sem acesso a `.specs/`/`docs/`/`.claude/`) é o substituto aprovado — ver `context.md` para a decisão e `evidence/round-1/copilot-cli-auth-failure.txt` para a evidência do bloqueio real. **`// SPEC_DEVIATION` registrado nesta revisão:** a primeira versão desta AC assumia Copilot CLI sem alternativa; corrigido após o Verifier (`validation.md`) apontar que a AC, como escrita, não seria satisfeita pela ferramenta efetivamente usada. (REQ-03)
2. WHEN o mesmo agente (Copilot CLI ou o substituto) é invocado pedindo o teste Vitest do endpoint `feedback`, mesmo contexto v1 THEN o prompt, o relatório e o diff SHALL também ser capturados em `evidence/round-1/`. (REQ-03)
3. WHEN o código gerado na rodada 1 é comparado item a item contra REQ-01, REQ-02 e REQ-06 THEN a análise SHALL listar explicitamente cada regra seguida e cada regra ignorada, sem omitir os casos de não-conformidade. (REQ-03, REQ-05)

**Independent Test**: Os arquivos de prompt, relatório e diff em `evidence/round-1/` existem e são internamente consistentes entre si (o prompt citado em qualquer relatório é, palavra por palavra, o conteúdo do arquivo de prompt correspondente); os testes gerados rodam de verdade (`npm test`) e o resultado é reproduzível de forma independente, não apenas relatado pelo autor.

---

### P1: Iterar o AGENTS.md com base na evidência e reprovar a melhora ⭐ MVP

**User Story**: Como Tech Lead, quero reescrever as seções que o agente ignorou na rodada 1, de forma mais prescritiva, e testar de novo, para comprovar que a iteração produz melhora real e não cosmética.

**Why P1**: Sem uma segunda rodada comparável, "iteramos" é uma afirmação não verificável — exatamente o red flag "V1 = V2" da régua de nota.

**Acceptance Criteria**:

1. WHEN o AGENTS.md v2 é comparado ao v1 THEN cada seção reescrita SHALL corresponder a um item marcado como "ignorado" na análise da rodada 1 — nenhuma reescrita sem motivo rastreável. (REQ-04)
2. WHEN o mesmo agente (Copilot CLI ou o substituto aprovado) é invocado novamente com o **mesmo prompt** da rodada 1 — salvo em arquivo em ambas as rodadas para permitir comparação verbatim, não só a afirmação do autor — agora com AGENTS.md v2 presente THEN o prompt, o relatório e o diff SHALL ser capturados em `evidence/round-2/`, preservando os artefatos da rodada 1 intactos. (REQ-03, REQ-04)
3. WHEN as rodadas 1 e 2 são comparadas THEN a análise SHALL apontar, para cada regra antes ignorada, se a rodada 2 corrigiu o comportamento — e SHALL declarar explicitamente qualquer regra que continua sendo ignorada mesmo após a reescrita. (REQ-04, REQ-05)

**Independent Test**: `evidence/round-1/` e `evidence/round-2/` coexistem; a análise cita ambos por caminho de arquivo, item a item; os arquivos de prompt salvos em cada rodada são comparáveis verbatim (não apenas descritos como "iguais" em prosa).

---

## Edge Cases

- WHEN o agente de codificação (Copilot CLI ou o substituto aprovado) falhar ou pedir aprovação de uma tool não concedida THEN a execução SHALL ser interrompida e reportada ao usuário — nunca substituída por texto inventado simulando o output. (Cobre a dimensão "External-dependency failure": é uma dependência externa desta feature; sem fallback silencioso permitido. Exercido de verdade: a tentativa real de Copilot CLI falhou por falta de autenticação e foi reportada, não mascarada — `evidence/round-1/copilot-cli-auth-failure.txt`.)
- WHEN o AGENTS.md v2 não corrigir uma regra específica mesmo depois de reescrita THEN isso SHALL ser documentado como limitação conhecida, não omitido. (REQ-05)
- WHEN a rodada 2 for executada THEN o prompt e o diretório de trabalho SHALL ser idênticos aos da rodada 1 (exceto o conteúdo do AGENTS.md) — verificável comparando os arquivos de prompt salvos de cada rodada, não apenas assumido.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| REQ-01 | P1: Tech Lead escreve AGENTS.md prescritivo | Tasks (T1, T5) | Pending |
| REQ-02 | P1: Tech Lead escreve AGENTS.md prescritivo | Tasks (T1) | Pending |
| REQ-03 | P1: Validar empiricamente | Tasks (T2, T3, T6) | Pending |
| REQ-04 | P1: Iterar com base em evidência | Tasks (T5, T6, T7) | Pending |
| REQ-05 | P1: Validar empiricamente / Iterar | Tasks (T4, T7) | Pending |
| REQ-06 | P1: Tech Lead escreve AGENTS.md prescritivo | Tasks (T1, T5) | Pending |

**ID format:** `REQ-NN` (mirroring the Exercício 2.1 grading rubric rows in `avaliacao-tech-lead.md`, 1:1, so validation and grading read off the same IDs).

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 6 total, 6 mapped to tasks, 0 unmapped.

### Implicit-Requirement Dimensions Sweep (Complex tier — full gate)

| Dimension | Resolution |
| --- | --- |
| Input validation & bounds | Requirement: AGENTS.md Coding Standards must mandate Zod schemas for all HTTP handler input/output (folded into REQ-06). |
| Failure / partial-failure states | Requirement: AGENTS.md must mandate custom error classes from `src/shared/errors.ts`, no silent catches (folded into REQ-06). |
| Idempotency / retry / duplicate handling | N/A because o endpoint-sonda (`feedback`) é síncrono e não tem estado persistente nesta fase — retries são responsabilidade da camada Azure Functions runtime, fora do escopo desta feature. |
| Auth boundaries & rate limits | N/A because pertence à seção "Product Rules & Guardrails" (Product Specialist, Exercício 2.3), não às seções sob responsabilidade do Tech Lead nesta feature. |
| Concurrency / ordering | N/A because handlers HTTP são stateless por request; não há ordenação cross-request no escopo desta feature. |
| Data lifecycle / expiry | N/A because o endpoint-sonda não persiste dados nesta fase (ver Out of Scope). |
| Observability | Requirement: AGENTS.md Coding Standards must mandate pino logging estruturado, proibição de `console.log` (folded into REQ-06). |
| External-dependency failure | Requirement: ver Edge Cases — falha do Copilot CLI deve ser reportada, nunca mascarada. |
| State-transition integrity | N/A because não há máquina de estados no escopo desta feature. |

---

## Success Criteria

- [x] AGENTS.md v1 e v2 existem, com diff mostrando reescrita direcionada por evidência (não V1 = V2) — `git diff 5576ed6 cb40ef8`, confirmado pelo Verifier em `validation.md`.
- [x] Duas rodadas de evidência real (Copilot CLI ou o substituto aprovado — ver `context.md`) existem em `evidence/round-1/` e `evidence/round-2/`.
- [x] A análise seguiu/ignorou cobre REQ-01, REQ-02 e REQ-06 nas duas rodadas, sem omitir não-conformidades — `evidence/round-1/analise-v1.md`, `evidence/comparacao-v1-v2.md`.
- [x] Todas as 9 dimensões implícitas resolvidas (requisito ou N/A justificado) — nenhuma em branco — ver tabela em "Implicit-Requirement Dimensions Sweep" acima.
