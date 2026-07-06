# Avaliação — Exercício 2.1 (AGENTS.md — seções do Tech Lead)

**Régua usada:** `.claude/skills/avaliacao-tech-lead/avaliacao-tech-lead.md`, seção "Exercício 2.1".
**Lacuna registrada:** o cabeçalho da skill referencia `avaliacao-foundation.md` para "dimensões e escala", mas esse arquivo não existe neste repositório. Esta avaliação usa apenas a escala 0–3 já embutida na própria tabela de critérios ("Score 3" / "red flag (≤ 1)") — não foram inventadas dimensões D1/D2/D3 não documentadas. Onde a régua do enunciado do exercício menciona "D2" (a regra "se não há evidência de teste → D2 ≤ 1"), tratei isso como o critério "Teste real com Copilot" da tabela abaixo, por ser a única linha a que a regra pode se referir.

**Evidência-fonte:** `.specs/features/agents-md-tech-lead/` dentro de `deliverables/cenario-2/novatech-assistant/` (sandbox local, branch `feature/agents-md-tech-lead`, commits `5576ed6`..`162b435`) — spec, contexto, tasks, evidência das duas rodadas, comparação v1→v2, PR-0001, e `validation.md` (Verifier independente + re-verificação).

---

## Nota por critério

| Critério | Score (0–3) | Evidência | Racional |
| --- | --- | --- | --- |
| Prescritivo, não descritivo | **3** | `AGENTS.md` (raiz do sandbox), seções Project Overview/Tech Stack/Coding Standards/Build & Deploy — uso consistente de "DEVE"/"NUNCA" (ex.: "DEVE usar Zod", "NUNCA usar console.log"), confirmado por leitura direta e pelo Verifier (`validation.md`, REQ-01 AC1: ✅ PASS com citações `AGENTS.md:10-13,17-21,56,86,108-110,123-126`) | Nenhum trecho narrativo tipo "usamos Zod" — todas as regras são instruções auditáveis |
| Inclui regras de context budget | **3** | `AGENTS.md`, seção "Gerenciamento de contexto (ADR-0002)": tabela com 4.000/8.000/5×1.500/3 turnos, batendo com `docs/cenario-2/exercicio-2-fase-estruturacao.md:24` — confirmado pelo Verifier (REQ-02 AC2: ✅ PASS) | Materializa a ADR-0002 na formulação simplificada do Cenário 2, não a do Cenário 1 — decisão registrada e justificada em `spec.md` (tabela de Assumptions) |
| Teste real com Copilot | **2** | Evidência real e verificável existe: código gerado de verdade (`evidence/round-1/endpoint.diff`, `evidence/round-2/endpoint.diff`), testes reais rodando e passando (5/5, `test-run-output.txt` de ambas as rodadas, reexecutado de forma independente por mim e pelo Verifier), análise seguiu/ignorou item a item (`analise-v1.md`). **Mas** a ferramenta pedida (GitHub Copilot CLI) nunca rodou com sucesso — falhou por falta de autenticação (`evidence/round-1/copilot-cli-auth-failure.txt`) — e foi substituída por um subagente Claude isolado, decisão tomada com o usuário e documentada (`context.md`), não escondida. | **Não é o red flag "sem evidência"** (há evidência real, testada, verificada por um Verifier independente) — por isso não cai para ≤1. Mas também não é "GitHub Copilot real" como a tarefa pedia literalmente, e o próprio Verifier encontrou uma falha de integridade da evidência na primeira versão (arquivo de prompt mal rotulado, corrigida depois — ver `validation.md`, Fix 2). Score 2: evidência real e rigorosamente verificada, ferramenta diferente da especificada. |
| Iteração v1 → v2 | **3** | `git diff 5576ed6 cb40ef8 -- AGENTS.md` mostra reescrita cirúrgica de exatamente 2 regras (logging centralizado; escopo de classes de erro) — cada uma rastreável a um achado real da rodada 1 (`analise-v1.md`). Rodada 2 corrigiu ambas, com evidência de código independente (`evidence/round-2/endpoint.diff`: `src/shared/logger.ts` criado, handler importa dele, nenhuma instância local de `pino`) — confirmado pelo Verifier (REQ-04 AC1: ✅ PASS) e por uma segunda re-verificação independente. | V1 ≠ V2 de forma verificável e não cosmética — exatamente o oposto do red flag "V1 = V2" |
| Reconhece limitações | **3** | `spec.md` (dimensões N/A justificadas), `analise-v1.md` (REQ-02 "não avaliável" pela sonda escolhida, declarado explicitamente em vez de omitido), `comparacao-v1-v2.md` (nota de metodologia sobre vazamento parcial de isolamento do subagente), `context.md`/`PR-0001` (Copilot CLI não autenticado, substituto documentado), `validation.md` (Verifier encontrou gaps reais — 1 mutante sobrevivente, inconsistência de arquivo de prompt — e ambos foram corrigidos e reconferidos, não escondidos) | Nível de honestidade acima da média: os próprios limites do desenho do teste (não só do documento) foram documentados |
| Referencia ADRs do cenário 1 | **3** | `AGENTS.md` Coding Standards cita explicitamente TypeScript strict, Azure Functions v4, Zod, Vitest, pino (nunca `console.log`), Conventional Commits, branch local + PR-como-markdown — todas as decisões do enunciado do Cenário 2 (linhas 53–59), rastreáveis ao Cenário 1 | Nenhuma decisão inventada sem rastreabilidade — confirmado pelo Verifier (REQ-06: ✅ Verified) |

**Nota consolidada: 17/18 (≈ 2,83/3 de média).** Não há nenhum critério em red flag (≤1); o único critério abaixo de 3 (teste real com Copilot → subagente, score 2) está documentado com uma justificativa específica, não por omissão.

---

## O que isso não cobre (fora do escopo desta nota)

- Exercícios 2.2 e 2.3 — planos separados (ver `/home/felipemaccari/.claude/plans/use-a-skill-claude-skills-tlc-spec-drive-wiggly-adleman.md`, seção "Fora de escopo").
- Seções de Product Rules, Testing Standards e Project Management do AGENTS.md — outros papéis.
- Comportamento real do GitHub Copilot — não pôde ser observado nesta sessão (CLI instalada, não autenticada); se o usuário autenticar depois, o ciclo de teste pode ser refeito contra a ferramenta real para elevar o critério 3 de 2 para 3, comparando se o comportamento do Copilot real diverge do substituto usado aqui.
