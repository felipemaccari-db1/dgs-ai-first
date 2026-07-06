# Runbook — Contingência de servers MCP indisponíveis

**Status**: Aceito
**Escopo**: os 4 servers MCP locais declarados em `.mcp/mcp.json` (`filesystem`, `git`, `memory`, `everything`). Complementa `docs/mcp-architecture.md` (arquitetura/aprovação/monitoramento/versionamento) com o que fazer, na prática, quando `scripts/mcp-health-check.ts` (ou o próprio agente, em tempo real) detecta um server fora do ar.

**Princípio central** (enunciado do exercício, REQ-04): um agente com um server indisponível **degrada com aviso explícito** — perde uma capacidade específica e diz isso claramente — em vez de (a) travar todo o trabalho, ou (b) inventar uma resposta a partir de memória/treinamento para preencher a lacuna. Nenhuma das duas falhas é aceitável; a segunda é a mais perigosa, porque é silenciosa.

---

## Evidência real que fundamenta este runbook

Este runbook não é especulativo — foi escrito a partir de duas execuções reais do `scripts/mcp-health-check.ts` (commits `a5feb76` e `31196cd` desta branch):

- **Execução normal** (`scripts/output/run-output-normal.txt`): os 4 servers reportaram `UP`.
- **Execução degradada, simulando o cenário nomeado no exercício** (`scripts/output/run-output-degraded.txt`): removido `./docs/novatech` da lista de diretórios do `filesystem` em `.mcp/mcp.json`, rodado o script contra o arquivo real, e restaurado depois. Saída real obtida:
  ```
  DEGRADED  filesystem — handshake respondeu, mas o acesso a docs/novatech via tool "list_directory" falhou:
  Access denied - path outside allowed directories: .../docs/novatech not in .../src, .../specs, .../skills, .../data/retrieval-corpus
  ```
  Isso confirma, por execução real (não por leitura de documentação do pacote), que o servidor `filesystem` **não trava nem derruba o processo inteiro** quando perde acesso a um diretório específico — ele continua respondendo ao protocolo MCP normalmente, só a tool que tenta tocar aquele caminho falha. É exatamente o tipo de falha parcial que este runbook precisa nomear, não um "server totalmente fora do ar" genérico.

---

## Detecção + comportamento degradado, por server

| Server | Sinal de detecção | Comportamento em modo degradado |
| --- | --- | --- |
| `filesystem` — **DOWN** (processo não sobe) | `mcp-health-check.ts` reporta `DOWN` para `filesystem`; ou o agente tenta qualquer tool do server e recebe erro de conexão/timeout, não um erro de aplicação. | O agente **não tem acesso a nenhum arquivo do projeto** (código, specs, skills, nem `docs/novatech`). Deve avisar explicitamente o usuário ("o server `filesystem` não está respondendo, não consigo ler nem escrever nenhum arquivo agora") e parar de propor edições de código — mas pode continuar uma conversa puramente textual/de planejamento se o usuário fornecer o conteúdo relevante colado na conversa. |
| `filesystem` — **DEGRADED** (sobe, mas um diretório específico falha — cenário real observado acima) | `mcp-health-check.ts` reporta `DEGRADED` com o diretório que falhou; ou uma tool como `list_directory`/`read_file` retorna "Access denied"/"path outside allowed directories" para um caminho específico enquanto outras chamadas no mesmo server funcionam. | Se o caminho afetado for `docs/novatech` (a documentação de negócio da NovaTech — POL-001, PROC-042, SLA-2024, FAQ): o agente **SHALL NOT** responder uma pergunta que dependa dessa fonte usando conhecimento geral/memória — deve dizer explicitamente "não consigo acessar `docs/novatech` agora para confirmar isso" e (a) pedir ao usuário para colar o trecho relevante, ou (b) declarar que não pode responder com confiança até o acesso ser restaurado. Se o caminho afetado for `./src`/`./specs`/`./skills`, o agente pode continuar tarefas que não toquem aqueles caminhos (ex. redigir um documento novo) mas deve avisar antes de tentar qualquer leitura/escrita ali. |
| `git` — **DOWN** ou **DEGRADED** | `mcp-health-check.ts` reporta `DOWN`/timeout no handshake; ou uma chamada de tool (ex. listar branches, diff) falha. | O agente perde a capacidade de inspecionar histórico, diffs e branches via MCP. Deve avisar o usuário e, se a tarefa exigir essa informação (ex. "qual foi o diff entre v1 e v2"), pedir que o usuário rode o comando `git` manualmente e cole a saída, ou adiar essa parte da tarefa — nunca inventar um diff ou um hash de commit. Tarefas que não dependem de histórico de git (ex. escrever um documento novo) continuam normalmente. |
| `memory` — **DOWN** ou **DEGRADED** | `mcp-health-check.ts` reporta `DOWN`; ou uma chamada ao grafo (criar/consultar entidade) falha. | O agente perde a memória persistente entre sessões (glossário, decisões registradas no grafo). Deve avisar o usuário e cair de volta na fonte de verdade em disco já existente no projeto — `.specs/STATE.md` (Decisions/Handoff) e os arquivos `context.md` de cada feature — em vez de assumir que "lembra" uma decisão que só estava no grafo. Nunca afirmar uma decisão de projeto como certa se ela só poderia vir do grafo e o grafo está inacessível. |
| `everything` — **DOWN** ou **DEGRADED** | `mcp-health-check.ts` reporta `DOWN`. | Nenhum impacto em trabalho real — este server não expõe dado do projeto, é só para explorar as primitivas do protocolo MCP. O agente pode simplesmente avisar e seguir em frente; é o único caso em que "seguir sem aquele server" não exige nenhuma mitigação adicional. |

---

## Degradação cumulativa (mais de um server indisponível ao mesmo tempo)

**Regra**: cada server ausente reduz a capacidade do agente de forma **independente e cumulativa** — não existe uma regra global única de "se qualquer server cair, pare tudo". Um runbook cuja única instrução, para qualquer combinação de falhas, fosse "pare o trabalho até os servers voltarem" seria o red flag explícito da régua de nota deste exercício ("se cair, para tudo").

Na prática, ao iniciar uma sessão de trabalho (ver `docs/mcp-architecture.md`, seção 3 — rodar `npm run mcp:health` antes de começar), o agente deve:

1. Ler o resumo do health check (UP/DOWN/DEGRADED por server).
2. Declarar ao usuário, em uma frase, exatamente o que está disponível e o que não está (ex.: "filesystem e memory estão UP; git está DOWN — não vou conseguir inspecionar histórico de commits nesta sessão, mas posso ler/escrever arquivos e usar a memória normalmente").
3. Trabalhar normalmente em qualquer tarefa que não dependa dos servers indisponíveis; para tarefas que dependem de um server caído, aplicar o comportamento degradado da tabela acima (pedir informação ao usuário, ou declarar que não pode responder com confiança) — nunca fabricar o resultado que o server forneceria.

Exemplo de cenário combinado real e plausível neste projeto: `git` DOWN (npx sem rede na primeira resolução do pacote) **e** `filesystem` DEGRADED em `docs/novatech` (pasta renomeada por engano) ao mesmo tempo. Comportamento correto: o agente ainda consegue editar código em `./src`/`./specs`/`./skills` (filesystem parcialmente UP) e usar `memory` normalmente; não consegue confirmar nada sobre o conteúdo de `docs/novatech` (deve avisar e pedir a fonte) nem sobre histórico de git (deve avisar e pedir para o usuário rodar `git log`/`git diff` manualmente); nenhuma dessas duas lacunas trava a outra metade do trabalho.

---

## Quando considerar o incidente resolvido

- Rodar `npm run mcp:health` (ou `npx tsx scripts/mcp-health-check.ts`) de novo depois de corrigir a causa (ex. pasta restaurada, dependência de rede disponível, escopo do `.mcp.json` corrigido).
- Todos os servers necessários para a tarefa em andamento devem reportar `UP` antes do agente voltar a tratar aquela fonte como confiável sem aviso — um `DEGRADED` anterior não deve ser esquecido silenciosamente só porque uma tentativa isolada de tool funcionou uma vez.

---

## Referências

- `docs/mcp-architecture.md` — arquitetura, monitoramento (quando/como rodar o health check) e versionamento do `.mcp/mcp.json`.
- `scripts/mcp-health-check.ts` — implementação do health check citado neste runbook.
- `scripts/output/run-output-normal.txt` / `scripts/output/run-output-degraded.txt` — evidência real de execução usada para escrever este runbook.
- `.specs/features/mcp-architecture/spec.md` — REQ-04 (plano de contingência) e seus critérios de aceite.
