# Análise seguiu/ignorou — Rodada 1 (AGENTS.md v1)

**Evidência-fonte:** `endpoint-agent-report.md`, `endpoint.diff` (T2) + `test-agent-report.md`, `test.diff`, `test-run-output.txt` (T3). Gerada por subagente Claude isolado (não GitHub Copilot — ver `copilot-cli-auth-failure.txt` e `context.md`).

## REQ-01 (linguagem prescritiva) — avaliado no documento, não no código gerado

Não é uma regra que o código gerado "segue" ou "ignora" — é uma propriedade do texto do AGENTS.md em si. Verificado por inspeção direta do `AGENTS.md` v1: as 4 seções usam "DEVE"/"NUNCA" consistentemente (confirmado por grep informal ao reler o arquivo). **Seguiu** (precondição para os resultados abaixo, não um item testável separadamente nesta rodada).

## REQ-02 (context budget da ADR-0002) — não exercitável pela sonda escolhida

**Limitação honesta, não escondida:** o endpoint `feedback` foi escolhido (ver `context.md`) porque exercita bem Zod/pino/erros — mas ele não monta contexto para o LLM, então nenhuma regra de orçamento de tokens é acionada por essa sonda. REQ-02 permanece verificado apenas por inspeção do texto do AGENTS.md (feito no T1), não por comportamento observado de um agente. Se quisermos evidência comportamental de REQ-02, a sonda certa seria `src/services/prompt-builder.ts` ou `src/functions/query/`, fora do escopo desta feature (ver Out of Scope do spec). **Não avaliável nesta rodada — não confundir com "ignorado".**

## REQ-06 (convenções do Cenário 1) — item a item

| Regra | Veredito | Evidência |
| --- | --- | --- |
| TypeScript strict, sem `any`/`@ts-ignore` | ✅ Seguiu | `handler.ts`/`validator.ts` (endpoint.diff) não usam `any` nem `@ts-ignore`; `npm run build` (`tsc -p .`, strict:true) passa sem erros |
| Azure Functions v4, registro programático (`app.http`) | ✅ Seguiu | `handler.ts` registra via `app.http("feedback", {...})`, não usa `function.json` |
| Zod para validação de input/output | ✅ Seguiu | `validator.ts` define `FeedbackInputSchema` com Zod e `safeParse`; `handler.ts` só acessa o body depois de validar |
| pino para logging, nunca `console.log` | ⚠️ Parcial | Usou `pino` (nenhum `console.*`) — mas instanciou um logger `pino` **direto no handler**, em vez de usar/criar `src/shared/logger.ts` como o texto do v1 sugeria ("DEVE usar pino (`src/shared/logger.ts`)"). O parêntese não deixou claro se `src/shared/logger.ts` é *onde* o logger deve ser instanciado (centralizado) ou só um exemplo de caminho — ambiguidade do v1, não um erro do agente. |
| Classes de erro customizadas (`src/shared/errors.ts`) para falhas | ❌ Ignorado | Handler resolve erro de validação Zod com `{status: 400, jsonBody: {...}}` direto do `safeParse().error.flatten()`, sem passar por nenhuma classe de `src/shared/errors.ts` (que continua vazio). **Achado importante: o próprio exemplo `DO` do AGENTS.md v1 para este exato caso já mostra esse padrão sem classe de erro** — ou seja, o v1 tem uma contradição interna (a prosa pede classes de erro para "falhas de negócio", mas o exemplo de código do mesmo documento resolve a falha de validação sem elas). O agente seguiu o exemplo de código à risca; o texto narrativo é que estava ambíguo sobre se validação Zod conta como "falha de negócio". |
| Vitest, cobrindo caminho feliz + erro de validação | ✅ Seguiu (excedeu) | `tests/unit/functions/feedback/handler.test.ts`: 5 testes (2 caminho feliz, 3 caminhos de erro) — `npm test`: 5/5 passando (`test-run-output.txt`) |
| Conventional Commits | ✅ Seguiu | Commits desta feature (`docs(agents):`, `feat(feedback):`, `chore(specs):`) seguem o padrão — autoavaliação do próprio ciclo de trabalho, não do subagente |
| Branch local + PR-como-markdown | ⏳ Ainda não avaliável | Branch `feature/agents-md-tech-lead` existe; o PR-como-markdown é produzido na T7, depois da rodada 2 |

## Resumo para a reescrita (T5)

Dois achados reais e rastreáveis para tornar v2 mais prescritivo, sem tocar no que já funcionou:
1. **Logging**: deixar explícito que `src/shared/logger.ts` deve exportar uma factory/instância única de pino, e que handlers **DEVEM importar dali**, nunca instanciar `pino()` localmente.
2. **Erros de validação vs. erros de negócio**: resolver a contradição interna do v1 — declarar explicitamente que a resposta 400 de validação Zod (via `safeParse`) é o padrão correto e **não** precisa de uma classe de `src/shared/errors.ts`; classes customizadas são para falhas depois da validação de shape (recurso não encontrado, contradição de documento não resolvida, falha de dependência externa).

Nenhuma mudança será feita em REQ-02 no v2 por essa rodada, porque a sonda escolhida não o exercita (ver limitação acima) — mudar o texto de REQ-02 sem evidência comportamental violaria REQ-04 (só reescrever o que a rodada 1 mostrou como ignorado/parcial).
