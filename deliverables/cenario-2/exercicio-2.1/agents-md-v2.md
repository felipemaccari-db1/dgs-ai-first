# AGENTS.md — NovaTech Assistant

> Constitution do projeto. Todo agente de IA (Copilot, Claude Code) lê este arquivo antes de gerar qualquer artefato.
> As seções abaixo são preenchidas por papéis diferentes nos exercícios do Cenário 2.

## Project Overview

NovaTech Assistant é um bot de suporte interno no Microsoft Teams para a NovaTech (logística), com um painel web de métricas. Ele responde perguntas de atendentes consultando uma base documental interna (RAG) — políticas, procedimentos e SLAs — em vez de depender de memória do atendente ou busca manual.

- **DEVE** tratar toda resposta como derivada de documentos recuperados, nunca de conhecimento geral do modelo. Se a recuperação não trouxer chunk relevante, a resposta **DEVE** dizer que não encontrou a informação — **NUNCA** inventar um procedimento, SLA ou valor que não veio de um chunk citável.
- **DEVE** citar a fonte (documento + data de vigência) em toda resposta que usar um chunk recuperado.
- Documentos contraditórios **DEVEM** ser tratados como dado, não filtrados: quando o pipeline detectar mais de uma versão vigente relevante, a resposta **DEVE** apresentar ambas com suas datas (ADR-0003), nunca escolher uma silenciosamente.
- Este arquivo é a *constitution* do projeto — qualquer agente de IA (GitHub Copilot, Claude Code) **DEVE** ler e seguir as seções abaixo antes de gerar código, spec ou documento neste repositório.

## Tech Stack & Architecture

- **Linguagem/runtime**: TypeScript em modo `strict` (ver `tsconfig.json` — `strict: true` **NUNCA** deve ser desabilitado ou contornado com `any`/`@ts-ignore` para passar o build).
- **Backend**: Azure Functions **v4**, modelo de programação por HTTP trigger (`src/functions/<nome>/handler.ts`). **NUNCA** usar o modelo v3 (`function.json` por pasta) — o projeto usa exclusivamente o registro programático v4.
- **Frontend**: React, painel web em `src/web/`.
- **IaC**: Bicep (`infra/`) — nesta fase (Cenário 2) é estado narrativo, nenhum recurso Azure real é provisionado; o código Bicep **DEVE** ser mantido consistente com os módulos existentes (`ai-search`, `openai`, `functions`, `cosmos`) mesmo sem deploy real.
- **RAG**: Azure AI Search + Azure OpenAI (GPT-4o) — decisão do ADR-0004 do Cenário 1. Nesta fase local, `filesystem` MCP sobre `data/retrieval-corpus/` faz o papel do Azure AI Search e `docs/novatech/` faz o papel do Confluence (ver Anexo C/D) — código de produção **DEVE**, ainda assim, ser escrito contra a interface real do Azure AI Search em `src/services/search.ts`, não contra o filesystem.

### Gerenciamento de contexto (ADR-0002 — obrigatório em qualquer código ou prompt que monte contexto para o LLM)

| Parâmetro | Valor | Onde se aplica |
| --- | --- | --- |
| Teto de tokens do system prompt | ~4.000 tokens | `prompts/system-prompt.md` — **NUNCA** deve crescer sem revisão explícita em `prompts/prompt-changelog.md` |
| Teto de tokens de chunks recuperados por query | ~8.000 tokens | `src/services/prompt-builder.ts` |
| Chunks recuperados por query | 5 chunks, ~1.500 tokens cada | `src/services/search.ts` |
| Histórico de conversa mantido íntegro | 3 turnos | `src/bot/bot.ts` (sessão Teams) |

- Todo código que monta o prompt final (`src/services/prompt-builder.ts`) **DEVE** respeitar os tetos acima antes de chamar o Azure OpenAI. Se a soma de system prompt + chunks + histórico + pergunta ultrapassar o teto, o código **DEVE** truncar chunks pela ordem de relevância (nunca o system prompt, nunca a pergunta atual) e registrar o truncamento via log estruturado (ver Coding Standards).
- **NUNCA** enviar histórico de conversa além de 3 turnos íntegros sem antes resumir — a estratégia de sumarização de turnos mais antigos é responsabilidade do serviço que gerencia a sessão, não do `prompt-builder`.
- **DO** (exemplo de orçamento explícito no código, não implícito):

  ```typescript
  export const CONTEXT_BUDGET = {
    systemPromptTokensMax: 4_000,
    chunksTokensMax: 8_000,
    chunkCount: 5,
    chunkTokensEach: 1_500,
    turnsKeptIntact: 3,
  } as const;
  ```

- **DON'T** (orçamento invisível, hardcoded em múltiplos lugares sem uma fonte única):

  ```typescript
  // NUNCA: números mágicos espalhados sem referência ao ADR-0002
  const chunks = results.slice(0, 5);
  const prompt = systemPrompt + chunks.join("\n"); // sem checagem de tamanho
  ```

## Coding Standards (Tech Lead)

- **Validação de input/output**: toda Azure Function HTTP **DEVE** validar seu input e a forma da sua resposta com **Zod**. Nenhum handler recebe `request.body` diretamente sem passar por um schema Zod primeiro.

  **DO**:
  ```typescript
  import { z } from "zod";

  const FeedbackInput = z.object({
    ticketId: z.string().min(1),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(2_000).optional(),
  });

  export async function feedbackHandler(request: HttpRequest): Promise<HttpResponseInit> {
    const parsed = FeedbackInput.safeParse(await request.json());
    if (!parsed.success) {
      return { status: 400, jsonBody: { error: "invalid_input", details: parsed.error.flatten() } };
    }
    // ...
  }
  ```

  **DON'T**:
  ```typescript
  // NUNCA: confiar no shape do body sem validar
  export async function feedbackHandler(request: HttpRequest) {
    const body = await request.json() as any; // "as any" proibido
    const rating = body.rating; // pode não existir, pode não ser número
  }
  ```

- **Logging**: `src/shared/logger.ts` **DEVE** exportar uma única factory/instância de `pino` para todo o projeto — nenhum outro arquivo em `src/` pode chamar `pino(...)` diretamente. Todo handler/serviço que precisa logar **DEVE** importar de `src/shared/logger.ts`, nunca instanciar seu próprio logger local. **NUNCA** usar `console.log`/`console.error` em código de `src/` — só é tolerado em scripts de uma vez fora de `src/`. Logs de erro **DEVEM** incluir contexto estruturado (ex.: `{ ticketId, errorCode }`), nunca apenas a mensagem de erro solta.

  **DO**:
  ```typescript
  // src/shared/logger.ts
  import pino from "pino";
  export const logger = pino({ name: "novatech-assistant" });

  // src/functions/feedback/handler.ts
  import { logger } from "../../shared/logger";
  logger.info({ ticketId, errorCode }, "feedback received");
  ```

  **DON'T**:
  ```typescript
  // NUNCA: instância de pino local ao handler — cada arquivo com seu próprio logger
  // impede configuração centralizada (nível, transporte, redaction) no futuro.
  import pino from "pino";
  const logger = pino({ name: "feedback-handler" });
  ```

- **Erros**: a resposta HTTP 400 de uma validação Zod que falhou (`safeParse(...).error.flatten()`) **NÃO** precisa de uma classe de erro — devolver `{ status: 400, jsonBody: { error: "invalid_input", details } }` diretamente do resultado do Zod, como no exemplo de Validação de input acima, é o padrão correto e completo para esse caso. Classes de erro customizadas de `src/shared/errors.ts` **DEVEM** ser usadas para falhas que acontecem **depois** que o shape do input já foi validado: recurso não encontrado, contradição de documento não resolvida, falha de dependência externa (Azure AI Search, Azure OpenAI). Isso permite que o handler HTTP mapeie esses erros para o status HTTP correto sem `if` em cadeia por mensagem de string — erro de validação de shape não entra nessa cadeia, porque o Zod já devolve a informação estruturada de que o handler precisa.
- **Testes**: **DEVE** usar Vitest. Todo endpoint HTTP novo **DEVE** ter teste unitário cobrindo pelo menos o caminho feliz e um caminho de erro de validação, em `tests/unit/`.
- **Commits**: **DEVE** seguir Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`), com escopo entre parênteses quando fizer sentido (ex.: `feat(feedback): add rating validation`). Um commit por unidade de trabalho — **NUNCA** amontoar múltiplas mudanças não relacionadas em um commit.
- **Branches e PRs**: como esta fase não tem remoto, "abrir PR" significa criar uma branch local `feature/<slug>` e escrever a descrição em `docs/pull-requests/PR-NNNN.md` (objetivo, mudanças, checklist de validation gates) — a revisão é simulada localmente, não pulada.

## Product Rules & Guardrails (Product Specialist)
<!-- TODO (Product Specialist — Ex. 2.3) -->

## Testing Standards (QA)
<!-- TODO (QA — Ex. 2.1) -->

## Project Management Rules (Delivery Manager)
<!-- TODO (Delivery Manager — Ex. 2.3) -->

## Build & Deploy

- **Build**: `npm run build` (`tsc -p .`, strict mode) **DEVE** passar sem erros e sem `// @ts-ignore` antes de qualquer commit que toque `src/`.
- **Testes**: `npm test` (`vitest run`) **DEVE** passar. O limiar de cobertura configurado em `vitest.config.ts` é 80% de linhas — **NUNCA** reduzir esse limiar para fazer um PR passar; se um caso legítimo exigir exceção, ela **DEVE** ser justificada no PR-como-markdown, não silenciosamente ignorada na config.
- **CI local (nesta fase)**: os workflows em `.github/workflows/` (`ci.yml`, `cd.yml`) são referência narrativa — não há runner remoto nesta fase. Antes de qualquer PR-como-markdown ser marcado como pronto, os mesmos passos do `ci.yml` (build + test) **DEVEM** ter sido rodados localmente e o resultado registrado no PR.
- **Deploy**: nesta fase (Cenário 2, sem Azure real), "deploy" não é uma ação executável — **NUNCA** simular um deploy real ou inventar uma URL/ambiente que não existe. O estado "provisionado em dev" descrito no Anexo C é ficção narrativa.
