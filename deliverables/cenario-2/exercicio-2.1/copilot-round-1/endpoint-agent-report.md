# T2 — Relatório do subagente (rodada 1, AGENTS.md v1)

> **Substituto do GitHub Copilot.** O Copilot CLI (`npx @github/copilot`) está instalado nesta máquina mas não autenticado nesta sessão (`Error: No authentication information found` — ver `copilot-cli-auth-failure.txt`). Com o usuário confirmando que não haveria autenticação agora, esta evidência foi gerada por um **subagente Claude isolado** (Agent tool, sem histórico desta conversa, sem acesso a `.specs/`, `docs/`, `.claude/` ou à régua de nota), instruído a ler o `AGENTS.md` e implementar o stub. É uma simulação de "agente que só conhece o AGENTS.md" — não é evidência de GitHub Copilot real.

**Prompt enviado:** verbatim em `subagent-endpoint-prompt.txt` (neste diretório) — texto exato passado à chamada `Agent`.

> **Correção pós-Verifier (ver `validation.md`):** a primeira versão deste arquivo citava um trecho que não era, palavra por palavra, o conteúdo de `subagent-endpoint-prompt.txt` na época — porque aquele arquivo, por um erro de nomenclatura durante o pivô de GitHub Copilot CLI para subagente (ver `context.md`), continha na verdade o prompt em inglês que tinha sido preparado para a tentativa (falha) de invocação da CLI real, não o prompt em português efetivamente enviado ao subagente. Isso foi corrigido: `subagent-endpoint-prompt.txt` agora contém o prompt real do subagente, e o antigo conteúdo foi preservado em `copilot-cli-attempted-prompt.txt` para não perder o rastro de que a CLI real também tinha um prompt pronto (que nunca chegou a rodar, por falta de autenticação).

---

## Resposta completa do subagente

**(1) Leitura do AGENTS.md**

Li o `AGENTS.md` (na raiz de `novatech-assistant`) por completo. Pontos relevantes para este endpoint: (a) toda Azure Function HTTP **deve** validar o input (e a resposta) com **Zod**, sem nunca ler `request.body`/`request.json()` sem passar por um schema antes — inclusive há um exemplo `DO`/`DON'T` praticamente idêntico ao caso de feedback (`ticketId`, `rating` 1-5, `comment` opcional), que usei como base literal para o schema; (b) logging **deve** usar `pino`, nunca `console.log`/`console.error` em `src/`, e logs de erro devem trazer contexto estruturado (ex.: `ticketId`, `errorCode`); (c) erros de negócio devem vir de classes customizadas em `src/shared/errors.ts`, não `throw new Error()` genérico; (d) o backend é Azure Functions **v4** com registro programático (`app.http`), nunca o modelo v3 de `function.json`; (e) `strict: true` do TS nunca pode ser contornado com `any`/`@ts-ignore`.

**(2) Conteúdo final dos arquivos** — ver `endpoint.diff` neste diretório para o diff real aplicado ao working tree (idêntico ao que o subagente reportou em texto).

**(3) Dependências adicionadas ao `package.json`**

- `@azure/functions` `^4.5.0` (novo)
- `pino` `^9.3.0` (novo)
- `zod` movida de `devDependencies` para `dependencies` (já existia)

Não rodou `npm install`/`npm run build`.

**(4) Desvios/decisões declarados pelo próprio subagente**

- Não usou `src/shared/logger.ts` nem `src/shared/errors.ts` (ambos vazios) — instanciou `pino` diretamente no handler; cumpre "pino, nunca console.*" mas não centraliza o logger.
- Não usou classe de erro customizada para falha de validação — seguiu literalmente o exemplo `DO` do próprio AGENTS.md, que resolve validação inválida com `{status: 400, jsonBody: {...}}` direto do `safeParse`, sem lançar erro.
- Evitou também `specs/` (sem ponto) e `skills/` por interpretação do espírito da restrição de escopo (não é uma regra do AGENTS.md, é a própria delimitação do teste).

*(agentId da sessão: a228507056f8765bb)*
