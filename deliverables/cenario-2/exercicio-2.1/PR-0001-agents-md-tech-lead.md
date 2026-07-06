# PR-0001 — AGENTS.md: seções do Tech Lead (Project Overview, Tech Stack & Architecture, Coding Standards, Build & Deploy)

**Branch:** `feature/agents-md-tech-lead`
**Autor:** Tech Lead (Exercício 2.1)
**Status:** Pronto para revisão local

## Objetivo

Preencher, no `AGENTS.md` do projeto, as quatro seções sob responsabilidade do Tech Lead, e comprovar empiricamente — com duas rodadas de teste real contra um endpoint-sonda (`feedback`) — que o documento produz o comportamento pretendido, iterando de v1 para v2 com base em achados concretos.

## Mudanças

- `AGENTS.md`: Project Overview, Tech Stack & Architecture (incluindo o orçamento de contexto da ADR-0002 na formulação do Cenário 2), Coding Standards e Build & Deploy — v1 e depois v2 (logging centralizado em `src/shared/logger.ts`; regra de classes de erro delimitada para não contradizer o exemplo de validação Zod).
- `src/functions/feedback/{handler.ts,validator.ts}`: endpoint HTTP de feedback de chamado (POST), usado como sonda de conformidade ao AGENTS.md — não é o pipeline de feedback final do produto, é instrumentação de teste.
- `src/shared/logger.ts`: instância única de `pino` para o projeto (criada na rodada 2, exigida pela v2 do AGENTS.md).
- `tests/unit/feedback-handler.test.ts`: 5 testes Vitest (caminho feliz + 3 caminhos de erro de validação), gerados na rodada 2.
- `package.json`: adiciona `@azure/functions` e `pino` como dependências de runtime; move `zod` de `devDependencies` para `dependencies`.
- `.specs/features/agents-md-tech-lead/`: spec, contexto, tasks e toda a evidência das duas rodadas (`evidence/round-1/`, `evidence/round-2/`, `evidence/comparacao-v1-v2.md`).

## Desvio de plano registrado

O ciclo de teste previsto usava GitHub Copilot CLI real (`npx @github/copilot`). A CLI está instalada nesta máquina mas não autenticada nesta sessão — sem login/token, que só o usuário pode fornecer. Com a confirmação do usuário, as duas rodadas usaram um **subagente Claude isolado** como substituto documentado, não GitHub Copilot. Ver `.specs/features/agents-md-tech-lead/context.md` e `evidence/round-1/copilot-cli-auth-failure.txt`.

## Checklist de validation gates

- [x] `npm run build` (`tsc -p .`, strict mode) — passa sem erros, sem `any`/`@ts-ignore` (rodada 1 e rodada 2)
- [x] `npm test` (`vitest run`) — 5/5 testes passando, reexecutado de forma independente após cada rodada (`evidence/round-1/test-run-output.txt`, `evidence/round-2/test-run-output.txt`)
- [x] AGENTS.md v1 e v2 usam linguagem prescritiva ("DEVE"/"NUNCA"), não narrativa
- [x] Números de context budget do ADR-0002 (formulação do Cenário 2) presentes em Tech Stack & Architecture
- [x] Duas não-conformidades reais da rodada 1 (logging não centralizado; contradição interna sobre classes de erro) corrigidas na rodada 2, com evidência de diff — não apenas afirmação
- [x] Limitações documentadas sem omissão: REQ-02 não exercitável pela sonda `feedback`; isolamento do subagente não é estrutural (self-limitação, não sandbox); substituto de Copilot, não Copilot real
- [ ] Autenticação real do GitHub Copilot CLI — pendente, depende do usuário; não bloqueia este PR

## Como revisar

1. Ler `AGENTS.md` (seções Project Overview → Build & Deploy) e confirmar que são prescritivas e cobrem as convenções do Cenário 1.
2. Ler `.specs/features/agents-md-tech-lead/evidence/comparacao-v1-v2.md` para o veredito regra a regra.
3. Rodar `npm install && npm run build && npm test` neste diretório para confirmar os gates de forma independente.
