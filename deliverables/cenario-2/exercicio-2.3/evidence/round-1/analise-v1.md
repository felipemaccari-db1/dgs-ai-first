# Análise seguiu/ignorou — Rodada 1 (skill v1)

**Código avaliado:** `evidence/round-1/endpoint.diff` (gerado pelo sub-agente isolado, `evidence/round-1/agent-report.md`)
**Régua:** regras 1-7 de `skills/domain/azure-functions-endpoint.md` (v1, momento da geração)

| # | Regra | Veredito | Evidência |
| --- | --- | --- | --- |
| 1 | Registrar com `app.http` (v4), nunca v3 | ✅ Seguiu | `endpoint.diff` — `handler.ts:63-65`: `app.http("health", { methods: ["GET"], authLevel: "anonymous", route: "health", handler: healthHandler })`. Nenhum `function.json`. |
| 2 | `handler.ts` + `validator.ts` separado quando há input | ✅ Seguiu | `validator.ts` criado como arquivo próprio; `handler.ts` só importa `parseHealthQuery` dele, não define schema inline. |
| 3 | Validar todo input (incl. query params) com Zod antes de qualquer lógica | ✅ Seguiu | `handler.ts:9-12`: `parseHealthQuery(request.query)` é a primeira linha de lógica; `request.query` nunca é lido diretamente em outro ponto. |
| 4 | Logar via `src/shared/logger.ts`, nunca `pino` local/`console.*` | ✅ Seguiu | `handler.ts:2`: `import { logger } from "../../shared/logger"`; nenhuma instância local de `pino`, nenhum `console.*` em `checks.ts`/`validator.ts`/`handler.ts`. |
| 5 | Erro de validação Zod → 400 direto, sem classe de erro | ✅ Seguiu | `handler.ts:10-12`: `{ status: 400, jsonBody: { error: "invalid_input", details: parsedQuery.error.flatten() } }` — cópia estrutural exata do exemplo DO da skill. |
| 6 | Falhas pós-validação (dependência externa) usam classe de `src/shared/errors.ts`, nunca `Error` genérico/500 sem contexto | ⚠️ **Parcial** | O agente **criou** `DependencyUnavailableError` em `src/shared/errors.ts` (`errors.ts:7-15`) e a **instancia** em `handler.ts:39-42` — a letra da regra é atendida (existe uma classe, é usada, o log carrega `error.dependency`). Mas a decisão de status HTTP (`503`) não passa pela classe: o `if (failedDependency)` (`handler.ts:38`) é decidido por uma variável local setada dentro do loop de checagens, e a instância de `DependencyUnavailableError` é criada só para extrair `.dependency` de volta (`handler.ts:41` → `error.dependency`, que já era a própria variável `failedDependency`) — ela nunca é lançada nem capturada, e o handler não tem nenhum `instanceof`/mapa erro→status. Isso não é uma violação da letra da regra 6, mas não demonstra o padrão de "mapear erro→HTTP sem `if` em cadeia" que o anti-padrão da skill pede — porque **a skill v1 não tem nenhum exemplo DO/DON'T para a regra 6** (só prosa), diferente das regras 1 e 3 que têm exemplo de código. Causa raiz identificada para a rodada 2. |
| 7 | Nunca `any`/`as any`/`@ts-ignore` | ✅ Seguiu | `grep -n "any\|@ts-ignore" src/functions/health/*.ts src/shared/errors.ts` não retorna nenhuma ocorrência de código (só o nome do tipo `DependencyCheckResult`, sem relação). Build (`tsc -p .`, strict) passou sem erro — `evidence/round-1/build-output.txt`, `EXIT=0`. |

## Anti-padrões — checagem

| Anti-padrão | Evitado? | Nota |
| --- | --- | --- |
| Lógica de negócio dentro do `handler.ts` | ✅ Sim | Checagens de dependência extraídas para `checks.ts`, exatamente a razão dada pelo anti-padrão da skill. |
| Handler decide status por `if (err.message.includes(...))` | ✅ Sim (na letra) / ⚠️ ver regra 6 acima | Não há branching por *string* de mensagem — mas a decisão também não passa pelo *tipo* do erro (`instanceof`), então o anti-padrão é evitado por acidente de escopo (só existe 1 tipo de falha possível), não por um padrão de mapeamento que escalaria para um segundo tipo de erro. |
| `pino({...})` por arquivo | ✅ Sim | Nenhuma instância local. |
| 200 com campo `error` no corpo | ✅ Sim | Falha usa 503, sucesso usa 200 — status HTTP correto em ambos os casos. |

## Conclusão da rodada 1

**6 de 7 regras seguidas integralmente; 1 regra (6) seguida na letra mas não na intenção**, por uma lacuna real da skill v1: não há exemplo de código para a regra de classes de erro customizadas, só as regras 1 (registro) e 3/5 (Zod) têm DO/DON'T. Isso não é um defeito do agente — é a skill que não deu ao agente um padrão concreto para replicar, então ele improvisou uma solução razoável mas superficial. **Item para a rodada 2 (v2):** adicionar um terceiro exemplo DO/DON'T à skill, mostrando classes de erro customizadas sendo *lançadas* e *mapeadas* para status HTTP via `instanceof` (não apenas instanciadas e destructuradas).

Nenhuma não-conformidade foi omitida desta análise.
