# Skill: azure-functions-endpoint

**Nível:** Domain
**Depende de:** `AGENTS.md` (Coding Standards), `src/shared/logger.ts`, `src/shared/errors.ts`, skill `testing-patterns` (Domain — ainda não escrita nesta fase; quando existir, todo endpoint criado com esta skill deve também seguir aquela para o teste Vitest)

## Contexto

Use esta skill sempre que for criar um **novo endpoint HTTP** em `src/functions/<nome>/` no projeto `novatech-assistant`. Ela cobre a forma do handler, onde plugar validação (Zod), logging (pino) e tratamento de erro — não cobre a lógica de negócio de nenhum endpoint específico (isso é do domínio de cada spec em `specs/<modulo>/`).

Não use esta skill para: rotas do painel web React (`src/web/`), lógica do bot do Teams (`src/bot/`), ou funções que não são HTTP trigger (ex.: timer trigger do pipeline de ingestão).

## Regras prescritivas

1. **DEVE** registrar o endpoint com o modelo de programação **v4** do Azure Functions (`app.http(...)`), nunca o modelo v3 (`function.json` por pasta).
2. **DEVE** ter um arquivo `handler.ts` por endpoint, em `src/functions/<nome>/handler.ts`. Se o endpoint tiver input de request (body ou query params), o schema Zod **DEVE** viver em um arquivo `validator.ts` separado no mesmo diretório — nunca inline no `handler.ts`.
3. **DEVE** validar todo input (body e query params) com Zod antes de qualquer lógica tocar nesses dados. Nenhum handler acessa `request.body`/`request.json()`/`request.query` diretamente sem passar por `safeParse` primeiro.
4. **DEVE** logar via `import { logger } from "../../shared/logger"` — nunca instanciar `pino(...)` localmente, nunca `console.log`/`console.error`.
5. **DEVE** retornar erro de validação de shape (Zod) como `{ status: 400, jsonBody: { error: "invalid_input", details: parsed.error.flatten() } }` diretamente — não criar uma classe de erro para isso.
6. **DEVE** usar classes de erro customizadas de `src/shared/errors.ts` para falhas que ocorrem **depois** da validação de shape (dependência externa indisponível, recurso não encontrado) — nunca lançar `Error` genérico nem devolver 500 sem contexto estruturado no log.
7. **NUNCA** usar `any`/`as any`/`@ts-ignore` para contornar o TypeScript strict mode ao lidar com o corpo da requisição.

## Exemplos DO / DON'T

### 1. Registro do endpoint (Azure Functions v4)

**DO:**
```typescript
// src/functions/health/handler.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { logger } from "../../shared/logger";
import { parseHealthQuery } from "./validator";

export async function healthHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const parsedQuery = parseHealthQuery(request.query);
  if (!parsedQuery.success) {
    return { status: 400, jsonBody: { error: "invalid_input", details: parsedQuery.error.flatten() } };
  }
  logger.info({ invocationId: context.invocationId, deep: parsedQuery.data.deep }, "health check requested");
  // ... lógica do endpoint
  return { status: 200, jsonBody: { status: "ok" } };
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: healthHandler,
});
```

**DON'T:**
```typescript
// NUNCA: modelo v3 (function.json separado) ou registro sem tipos do @azure/functions
module.exports = async function (context, req) {
  context.res = { body: "ok" }; // sem tipo, sem validação, sem app.http
};
```

### 2. Validação de query params com Zod

**DO:**
```typescript
// src/functions/health/validator.ts
import { z } from "zod";

const HealthQuerySchema = z.object({
  deep: z.enum(["true", "false"]).optional().default("false"),
});

export function parseHealthQuery(query: URLSearchParams | Record<string, string | undefined>) {
  const raw = query instanceof URLSearchParams ? Object.fromEntries(query) : query;
  return HealthQuerySchema.safeParse(raw);
}
```

**DON'T:**
```typescript
// NUNCA: ler o query param direto e assumir o formato
const deep = request.query.get("deep") === "true"; // sem schema, sem tratamento de valor inesperado
```

## Anti-padrões comuns

- **Lógica de negócio dentro do `handler.ts`.** O handler deve orquestrar (validar → chamar serviço → mapear erro → responder); lógica de domínio pertence a `src/services/`. Motivo: mistura a camada HTTP com regra de negócio, dificultando testar a regra sem subir um request fake.
- **Handler que decide o status HTTP por `if (err.message.includes(...))`.** Isso acopla o contrato HTTP ao texto de uma mensagem de erro, que pode mudar sem aviso. Use classes de erro de `src/shared/errors.ts` e um `switch`/mapa por `instanceof`.
- **Um `pino({...})` por arquivo.** Cada instância nova perde a configuração centralizada (nível, transporte) e impede correlacionar logs do mesmo processo. Sempre importe a instância única de `src/shared/logger.ts`.
- **Retornar 200 com um campo `error` no corpo em vez de usar o status HTTP correto.** O status HTTP é o contrato — clientes automatizados (bot do Teams, painel web) dependem dele para decidir o fluxo, não do corpo.

## Dependências

- `AGENTS.md` — Coding Standards (Zod, pino, erros, testes) é a fonte de verdade; esta skill é uma receita mais concreta dela, nunca contradiz.
- `src/shared/logger.ts` — logger único do projeto.
- `src/shared/errors.ts` — classes de erro para falhas pós-validação.
- Skill `testing-patterns` (Domain) — cobre como escrever o teste Vitest do endpoint; esta skill cobre só a implementação.
