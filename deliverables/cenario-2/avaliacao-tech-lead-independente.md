# Avaliação Tech Lead — Independente (Cenário 2, exercícios 2.1–2.3)

**Rubrica usada:** `.claude/skills/avaliacao-tech-lead/avaliacao-tech-lead.md`
**Metodologia:** verificação independente estilo `tlc-spec-driven` (author ≠ verifier, evidence-or-zero). Três sub-agentes isolados, sem contexto entre si e sem acesso às autoavaliações como fonte de verdade, re-conferiram cada critério da rubrica contra evidência bruta (código, diffs, saída de comando re-executada agora). As autoavaliações (`avaliacao-exercicio-2.1.md`, `-2.2.md`, `-2.3.md`) foram usadas só como lista de alegações a confirmar ou refutar — nunca como evidência em si.

**Nota sobre a rubrica:** `avaliacao-tech-lead.md` referencia um arquivo `avaliacao-foundation.md` ("dimensões e escala") que **não existe neste repositório**. Isso é uma lacuna do framework de avaliação, não da entrega — as pontuações abaixo seguem apenas as colunas Critério/Score 3/Red flag definidas no próprio `avaliacao-tech-lead.md`.

---

## Exercício 2.1 — AGENTS.md

| Critério | Veredito | Evidência |
|---|---|---|
| Prescritivo, não descritivo | **Atende** | `AGENTS.md` usa "DEVE"/"NUNCA" de ponta a ponta (linhas 10, 17, 56, 86, 123–126); nenhuma frase narrativa tipo "usamos X" encontrada. |
| Inclui regras de context budget | **Atende** (com nuance divulgada) | Tabela nas linhas 25–30 (~4K system / ~8K chunks / 5×1.500 tokens / 3 turnos). Os números **não** batem literalmente com a ADR-0002 original do cenário 1 (8K total, 500/chunk, até 12 chunks pós-merge) — mas isso é porque o próprio enunciado do Cenário 2 (linha 60) entrega uma "ADR simulada" simplificada com esses números, e o time documenta a divergência explicitamente em `context.md:60`. Não é um erro escondido. |
| Teste real com Copilot | **Parcial** | Copilot CLI real foi tentado e falhou por falta de autenticação (`copilot-round-1/copilot-cli-auth-failure.txt`: "Error: No authentication information found"). Substituído por sub-agente Claude isolado, divulgado explicitamente. Evidência do substituto é real (rebuild/teste re-executados agora: build limpo, 9/9 testes passando). Não é "sem evidência" (não é red flag), mas também não é Copilot literal — mesma nota que a autoavaliação já se deu (2/3). |
| Iteração v1 → v2 | **Atende** | `diff agents-md-v1.md agents-md-v2.md` mostra reescrita substantiva de 2 regras (logging singleton, contradição sobre erro de validação Zod). `AGENTS.md` atual é byte-idêntico a v2 (v2 foi de fato adotado). Round-2 corrige ambos os problemas de fato: `src/shared/logger.ts` criado, única instanciação de `pino(...)` no repo confirmada via grep. |
| Reconhece limitações | **Atende** | Substituição do Copilot divulgada em todo lugar; um Verifier independente (`.specs/features/agents-md-tech-lead/validation.md`) achou um mutante sobrevivente (sem asserção de log estruturado) — corrigido depois, confirmado agora em `tests/unit/feedback-handler.test.ts:41,55-58` (`vi.spyOn(logger, "info")` real). |
| Referencia ADRs do cenário 1 | **Atende** | Linha do RAG stack (AGENTS.md:21) bate com `adr-0004-build-vs-buy-pipeline-rag.md:26`; regra de documentos contraditórios (AGENTS.md:12) bate com `adr-0003-...:19`. Nenhuma decisão inventada sem rastro. |

**Discrepância vs. autoavaliação:** nenhuma alegação inflada encontrada — a autoavaliação já se penaliza corretamente no critério 3 e já expõe a divergência dos números de contexto. Único ponto de atenção: a nota consolidada "≈2.83/3" é uma média simples que dilui o critério 3 (genuinamente Parcial); uma leitura mais rigorosa pesaria essa lacuna mais.

**Extra/fora de escopo:** nenhum. Artefatos de 2.2/2.3 existem no mesmo sandbox mas em pastas `.specs/features/` próprias, sem vazar para dentro da entrega de 2.1.

---

## Exercício 2.2 — Arquitetura de MCP

| Critério | Veredito | Evidência |
|---|---|---|
| MCP como infraestrutura | **Atende** | `.mcp/mcp.json` real com 4 servers configurados (filesystem, git, memory, everything); `docs/mcp-architecture.md` tem seções de aprovação (98–116), monitoramento (119–136) e versionamento (140–150). |
| Diagrama de conexões | **Atende** | Diagrama Mermaid real (linhas 12–30) + tabela de escopo rw/ro (34–40), consistente com `.mcp/mcp.json`. Limitação técnica do `filesystem` server (sem enforcement real de ro fora do modo Docker) é divulgada, não escondida. |
| Script de health check executado | **Atende**, com ressalva de proveniência | Script de 388 linhas real (handshake JSON-RPC completo, timeout por server, falhas isoladas). **Executado agora mesmo** (`npm run mcp:health` → `UP UP UP UP`, idêntico a `run-output-normal.txt`). Cenário degradado **reproduzido de forma independente** (removendo `docs/novatech` do escopo em cópia isolada) → saída bate com `run-output-degraded.txt`. Ressalva: não há evidência de nenhuma tentativa real do Copilot CLI para *este* script (zero pasta `evidence/` na feature `mcp-architecture`, diferente de 2.1) — a autoavaliação já divulga isso e pontua 2/3 por essa razão. |
| Plano de contingência realista | **Atende** | `docs/runbooks/mcp-contingency.md:26-32`, tabela DOWN vs. DEGRADED por servidor, incluindo o cenário nomeado do enunciado (perda de `docs/novatech` → agente NÃO pode responder de memória). Seção de degradação cumulativa (36–46) rejeita explicitamente "se cair, para tudo". |
| Política de aprovação equilibrada | **Atende** | Aprovador único (Tech Lead), SLA de 1 dia útil, declaração obrigatória de escopo/justificativa, exigência de teste de handshake antes de aprovar um pacote novo — motivada por um achado de segurança real. |

**Achado de segurança re-verificado de forma independente (não veio de fé):** o pacote npm `mcp-server-git` foi confirmado, via `npm view`/`npm pack` executados agora, como um "canary" de telemetria (`theinfosecguy/npx-canary`) que faz POST para `vulnerable-live.workers.dev` no `postinstall` e não implementa protocolo MCP algum — exatamente como `docs/mcp-architecture.md` e o PR afirmam.

**Discrepância vs. autoavaliação:** nenhuma. A nota 14/15 já reflete corretamente a única lacuna real (falta de tentativa de Copilot real para o health-check).

**Extra/fora de escopo:** nenhum — o diff da feature (`44ca890..0b4510a`) fica cleanly dentro de `.mcp/`, `docs/mcp-architecture.md`, `docs/runbooks/`, `scripts/` e `.specs/features/mcp-architecture/`.

---

## Exercício 2.3 — Skill técnica `azure-functions-endpoint`

| Critério | Veredito | Evidência |
|---|---|---|
| SKILL.md com código real | **Atende** | `skills/domain/azure-functions-endpoint.md` (137 linhas): 7 regras DEVE/NUNCA, 3 pares DO/DON'T reais em TypeScript, 5 anti-padrões com racional. |
| Teste real com Copilot | **Parcial** | Mesma substituição documentada (Copilot CLI instalado mas não autenticado); sub-agente isolado sem acesso a `AGENTS.md`/`docs/`/`.specs/`. Evidência do substituto é real e consistente. |
| Iteração documentada | **Atende** | Round-1: `DependencyUnavailableError` instanciado mas nunca lançado/capturado (confirmado no diff bruto, `handler.ts:47-59`). Round-2: `throw`/`catch...instanceof` reais, confirmados tanto no diff quanto nos arquivos atuais do repo (`checks.ts`, `handler.ts`, `errors.ts`) — não é só a prosa da análise, é o código de fato. |
| Critérios de maturidade práticos | **Atende** | `criterios-skill-madura.md`: 6 critérios, cada um com coluna "Como medir" numérica/checável (contagem de rodadas, razão DO/DON'T por regra, `npm run build && npm test` com contagem). |
| Skills são artefatos vivos | **Atende** | Declara explicitamente que "madura" é uma observação pontual, não certificação permanente, com cenário concreto que reabriria a skill (segundo tipo de erro customizado no mesmo handler). |

**Reverificação dos 2 gaps que o Verifier interno já havia achado e "corrigido" (não aceito por fé — comandos rodados agora):**
- `md5sum evidence/round-1/prompt.txt evidence/round-2/prompt.txt` → `015918c95e6362312320324c9a93d707` para os dois. **Confirmado, hash bate com o citado em `validation.md`.**
- `diff -u round-1/skill-v1-snapshot.md skills/domain/azure-functions-endpoint.md` comparado ao `skill-v1-to-v2.diff` armazenado → corpo do diff **byte-idêntico** (só as duas linhas de cabeçalho de path diferem, por causa do cwd). **Confirmado reproduzível.**
- `npm run build` (exit 0) e `npm test` (**9/9 passando**) re-executados agora mesmo, não copiados do `validation.md`.
- `git status --porcelain`: trabalho de 2.3 **segue não commitado** neste exato momento (`M skills/domain/azure-functions-endpoint.md`, `M src/functions/health/handler.ts`, `M src/shared/errors.ts` + untracked `.specs/features/azure-functions-endpoint-skill/`, `PR-0003-*.md`, `checks.ts`, `validator.ts`, `health-handler.test.ts`), consistente com a instrução explícita do usuário de não commitar nesta sessão.
- Cópia empacotada `deliverables/cenario-2/exercicio-2.3/` vs. `.specs/features/azure-functions-endpoint-skill/`: `diff -rq` **não encontrou divergência de conteúdo** — todo arquivo presente nos dois lugares é byte-idêntico (incluindo os 3 arquivos que só existem na cópia empacotada, que são cópias fiéis de arquivos-fonte fora da árvore `.specs/`).

**Discrepância nova encontrada (menor, cosmética):** `avaliacao-exercicio-2.3.md:6` cita o caminho `evidence/analise-v1.md`, mas o arquivo real está em `evidence/round-1/analise-v1.md`. Erro de path na prosa, não afeta a substância da alegação.

**Extra/fora de escopo:** nenhum.

---

## Feito a mais / fora do escopo (visão consolidada dos 3 exercícios)

1. **Scaffolding de app completo no sandbox** (`infra/*.bicep`, `specs/{feedback-api,painel-web,...}`, `src/bot`, `src/pipeline`, `src/services`, `prompts/eval/*`) — confirmado como **pré-semeado pelo starter repo** (arquivos de 0 bytes, README do starter documenta isso explicitamente). Não é trabalho extra produzido pelos agentes nesta rodada; não deve ser contado como escopo extra.
2. **Duplicação estrutural**: pastas "pacote" `deliverables/cenario-2/exercicio-2.X/` coexistem com as specs de trabalho em `novatech-assistant/.specs/features/*`. Para o exercício 2.3, verificado agora que as duas cópias são byte-idênticas onde se sobrepõem — a duplicação existe mas não gerou divergência de conteúdo. Ainda assim, é redundância que pode divergir no futuro se um lado for editado sem o outro.
3. **`dist/`** dentro de `novatech-assistant/` — artefato de build compilado, não versionado (corretamente no `.gitignore`), mas presente em disco como ruído sem relação com nenhum dos 3 exercícios.
4. **Ausência de `STATE.md`** em `.specs/` — o `tlc-spec-driven` normalmente mantém um log de decisões persistente; aqui cada feature carrega suas decisões em `context.md`/`spec.md` próprios. Não é um defeito da entrega, mas é uma inconsistência com o padrão usual da skill.

## Faltando / Gaps (visão consolidada)

1. **Nenhum dos 3 exercícios usou o GitHub Copilot real** — o enunciado pede explicitamente "Ferramentas a utilizar: Claude (chat) + GitHub Copilot" nos três. Em todos os casos o Copilot CLI não estava autenticado na máquina, e um sub-agente Claude isolado foi usado como substituto documentado. Isso é divulgado honestamente em todos os artefatos (não é uma lacuna escondida), mas continua sendo uma divergência real e não sanada do enunciado — os três exercícios se autoavaliam com 2/3 (não 3/3) exatamente por essa razão, e essa auditoria independente confirma que essa nota está correta, não inflada.
2. Para o exercício 2.2 especificamente, nem sequer houve uma nova tentativa de autenticar o Copilot CLI antes de reusar o substituto — o time citou o precedente do 2.1 sem tentar de novo (`PR-0002:25-27`, "Desvio de plano registrado").
3. **Exercício 2.3 segue sem commit** no repositório do sandbox, diferente de 2.1 e 2.2 (que têm trilha de commits real). Isso é consistente com uma instrução explícita do usuário nesta sessão de não commitar, então não é um erro do time — mas é um estado real que fica pendente caso a entrega precise ser "commit-verificável" como as outras duas.
4. **`avaliacao-foundation.md` ausente** do repositório — referenciado pela própria skill `avaliacao-tech-lead.md` como fonte das dimensões/escala de pontuação. É uma lacuna do framework de avaliação em si, fora do controle desta entrega, mas vale reportar a quem mantém a skill.

## Veredito geral

Nenhum critério "red flag" (≤1) foi encontrado nos três exercícios. Todos os critérios "Score 3" foram confirmados com evidência re-verificada agora (código, diffs, hashes, execuções reais), exceto o critério "teste real com Copilot" em todos os três exercícios, que é genuinamente **Parcial** — trabalho real e bem documentado, mas com uma ferramenta substituta em vez do Copilot pedido. As autoavaliações existentes (`avaliacao-exercicio-2.1/2.2/2.3.md`) se mostraram bem calibradas: nenhuma alegação relevante encontrada como inflada ou fabricada nesta auditoria independente. O único achado genuinamente novo desta rodada é o erro de path cosmético em `avaliacao-exercicio-2.3.md:6`.
