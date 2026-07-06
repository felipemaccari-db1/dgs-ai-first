# AGENTS.md — Tech Lead Sections Context

**Gathered:** 2026-07-05
**Spec:** `.specs/features/agents-md-tech-lead/spec.md`
**Status:** Ready for tasks (Design skipped — sem decisão de arquitetura, é autoria de documento + ciclo de teste empírico)

---

## Feature Boundary

Escrever as seções do AGENTS.md sob responsabilidade do Tech Lead (Project Overview, Tech Stack & Architecture, Coding Standards, Build & Deploy) e comprovar empiricamente sua eficácia com duas rodadas de teste contra o endpoint-sonda `feedback`, produzindo v1 → análise → v2 → análise comparativa. **Rodadas executadas via subagente Claude isolado (não GitHub Copilot — ver decisão de tooling abaixo).**

---

## Implementation Decisions

### Tooling: GitHub Copilot CLI existe mas não está autenticado — pivô para simulação via subagente isolado

- `npx --yes @github/copilot` está instalado e funcional nesta máquina (CLI v1.0.68, `--version`/`--help` respondem).
- **Atualização (bloqueio real na execução da T2):** a primeira tentativa de invocação não-interativa (`-p ... --allow-all-tools`) falhou com `Error: No authentication information found.` — não há login (`copilot login`) nem token (`GITHUB_TOKEN`/`GH_TOKEN`/`COPILOT_GITHUB_TOKEN`) configurado nesta sessão, e autenticar exige uma ação do usuário (fluxo OAuth no navegador ou fornecer um token) que não pode ser feita por este agente.
- **Decisão do usuário (perguntado explicitamente):** não autenticar agora. Em vez disso, T2/T3/T6 usam um **subagente Claude isolado** (Agent tool, sem histórico desta conversa) como substituto do GitHub Copilot — ele recebe apenas o caminho do `AGENTS.md` e do stub a implementar, sem ver o spec, a régua de nota ou qualquer análise, para se aproximar ao máximo de "um agente de codificação que só conhece o AGENTS.md".
- **Isso é uma simulação, não GitHub Copilot real**, e é declarado assim em toda a evidência gerada (nomes de arquivo, análise, e no relatório de avaliação final) — REQ-03 do spec pedia evidência de "agente real"; a evidência aqui é de um agente real (Claude via Agent tool), mas não do Copilot especificamente. Isso é registrado como desvio/limitação (REQ-05), não escondido.
- (Histórico da tentativa descartada) o plano original era `--allow-all-tools --add-dir <sandbox>`, nunca `--allow-all-paths`/`--yolo` — não chegou a ser exercido de verdade por falta de autenticação.
- O subagente que substitui o Copilot roda com as ferramentas nativas do Claude Code (Read/Write/Edit/Bash) restritas ao sandbox por instrução explícita no prompt do subagente (sem acesso a `.specs/`, `docs/cenario-2/`, ou qualquer material fora de `AGENTS.md` + o stub-alvo) — o equivalente, para um subagente, do escopo mínimo que o `--add-dir` daria à CLI.

### Sandbox: localização e higiene

- O Anexo D foi extraído inicialmente em `docs/cenario-2/...` (local errado — `docs/` é referência estática) e movido para `deliverables/cenario-2/novatech-assistant/` (área de trabalho em andamento, mesmo padrão do Cenário 1).
- É um repositório Git local real e funcional (`.git` preservado no move, histórico com o commit `chore: starter repo (Anexo D)` intacto).
- 161 arquivos `*:Zone.Identifier` (resíduo da extração via Windows) foram removidos; `*:Zone.Identifier` foi adicionado ao `.gitignore` interno do sandbox para não reaparecer.
- O sandbox está no `.gitignore` da raiz do `dgs-ai-first` — o repo externo não rastreia o `.git` aninhado.

### Endpoint-sonda: `feedback`, não `health`

- `src/functions/feedback/{handler.ts,validator.ts}` foi escolhido como alvo de teste porque recebe input do usuário (rating + comentário de um chamado) — é o único stub do scaffold que de fato exercita Zod, pino e error handling ao mesmo tempo.
- `health` foi descartado como sonda: não tem input, não testaria a regra de validação de input do AGENTS.md de forma significativa.

### Prompt idêntico entre rodadas

- O prompt enviado ao subagente é fixo entre a rodada 1 (v1) e a rodada 2 (v2) — só o conteúdo do AGENTS.md muda. Isso isola a variável testada; sem isso, qualquer melhora observada na rodada 2 poderia ser atribuída ao prompt, não ao documento. O subagente é sempre despachado fresco (sem memória da rodada anterior).

### Evidência: onde fica

- `.specs/features/agents-md-tech-lead/evidence/round-1/` e `round-2/` guardam a resposta completa do subagente + diff do código gerado, capturados imediatamente após cada rodada — antes que a rodada seguinte sobrescreva os arquivos-alvo no working tree.
- O código final (pós-rodada 2) fica commitado normalmente em `src/functions/feedback/`; git preserva a versão da rodada 1 no histórico, mas a cópia explícita em `evidence/` evita depender de garimpar `git show` para montar a comparação.

### Agent's Discretion

- Redação exata das seções do AGENTS.md (tom, exemplos de código DO/DON'T) — dentro dos requisitos REQ-01/02/06 do spec.
- Escolha de qual regra específica rescrever em v2, guiada pela análise real da rodada 1 (não decidida a priori).

### Declined / Undiscussed Gray Areas → Assumptions

Nenhuma — todas as áreas cinzentas identificadas (endpoint-sonda, consistência de prompt, local de evidência, flags de segurança da CLI, números de context budget) foram resolvidas e já estão registradas na tabela **Assumptions & Open Questions** do `spec.md`, com confirmação (`y`) porque decorrem diretamente de decisões já tomadas com o usuário nesta sessão (Copilot real; sandbox em `deliverables/cenario-2/`) ou são inferências de baixo risco, reversíveis, dentro do limite da feature.

---

## Specific References

- Números de context budget vêm literalmente de `docs/cenario-2/exercicio-2-fase-estruturacao.md:24` (formulação simplificada do Cenário 2), não do ADR-0002 original do Cenário 1.
- Convenções de branch/PR-como-markdown vêm de `docs/cenario-2/exercicio-2-fase-estruturacao.md:59` e da seção "Convenções de organização" do Anexo C.
- Régua de nota: `.claude/skills/avaliacao-tech-lead/avaliacao-tech-lead.md`, seção "Exercício 2.1".

---

## Deferred Ideas

- Testar as seções de Product Rules, Testing Standards e Project Management do AGENTS.md — pertence ao Exercício 2.3 (Delivery Manager/QA/Product Specialist), plano separado.
- Arquitetura de MCP e health check dos servers locais — Exercício 2.2, plano separado (ver justificativa de janela de contexto no plano aprovado).
