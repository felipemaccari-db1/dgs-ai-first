# MCP Architecture Specification

## Problem Statement

O `.mcp/mcp.json` deste repositório está vazio (`{"mcpServers": {}}`) e o time não tem nenhum documento que trate os servers MCP locais (filesystem, git, memory, everything) como infraestrutura gerenciada. Sem escopo/permissões declarados, política de aprovação, monitoramento e um plano para quando um server cai, cada desenvolvedor configuraria MCP de forma ad-hoc — e um agente sem `filesystem` funcional sobre `docs/novatech/` corre o risco de alucinar respostas em vez de avisar que a fonte está indisponível. O Tech Lead precisa produzir a arquitetura, um script de health check que **realmente executa** contra os servers locais, e um plano de contingência realista, com evidência de execução — não apenas texto descritivo.

## Goals

- [ ] Documento de arquitetura de MCP (`docs/mcp-architecture.md`) cobrindo diagrama de conexões/permissões, política de aprovação, monitoramento e versionamento.
- [ ] Script de health check (`scripts/mcp-health-check.ts`) que lê `.mcp/mcp.json`, sobe/consulta cada server real e é **executado de verdade**, com a saída da execução capturada no repositório.
- [ ] Plano de contingência (`docs/runbooks/mcp-contingency.md`) que degrada a capacidade do agente em vez de travar tudo quando um server fica indisponível.

## Out of Scope

Explicitamente excluído. Documentado para prevenir scope creep.

| Feature | Reason |
| --- | --- |
| Reescrita das seções do AGENTS.md (Tech Stack, Coding Standards etc.) | Pertence ao Exercício 2.1 (`agents-md-tech-lead`), já concluído nesta branch-mãe |
| Skills técnicas (`skills/domain/*.md`) e seu ciclo de teste com Copilot | Exercício 2.3, plano separado |
| Provisionamento de qualquer server MCP pago ou dependente de serviço externo (ex. GitHub remoto, Confluence real) | Anexo C exige servers locais e gratuitos apenas; GitHub foi arquivado no upstream e é coberto localmente por `git` + `filesystem` |
| Escolha final do pacote npm para o server `git` (`@cyanheads/git-mcp-server` vs `mcp-server-git` vs outro) | Decisão de arquitetura (qual pacote, quais flags) — fica para a fase de Design; aqui só se registra a restrição (`uvx`/`uv` indisponíveis neste ambiente) e as opções levantadas, ver `context.md` |
| Autenticação real do GitHub Copilot CLI | Fora do controle deste agente (exige ação do usuário); ver política de fallback documentada em `context.md`, mesmo precedente do Exercício 2.1 |
| Servidor MCP remoto/hospedado ou multi-tenant | Fora do escopo — todos os servers deste projeto são processos locais de vida curta, iniciados sob demanda |

---

## Assumptions & Open Questions

Toda ambiguidade foi resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Caminho do documento de arquitetura | `docs/mcp-architecture.md` | Convenção combinada nesta sessão de planejamento; mantém paridade com `docs/runbooks/`, `docs/adr/`, `docs/pull-requests/` já existentes no scaffold | y |
| Caminho do plano de contingência | `docs/runbooks/mcp-contingency.md` | A pasta `docs/runbooks/` já existe no scaffold, vazia, criada exatamente para este tipo de artefato | y |
| Caminho e linguagem do script de health check | `scripts/mcp-health-check.ts` (diretório novo) | Repositório é TypeScript/Node (`package.json` com `typescript`, `tsx`/`vitest` no toolchain); um script `.ts` é consistente com o resto do código e pode reusar tipos do MCP SDK | y |
| Runtime do transporte MCP checado pelo script | stdio (spawn do `command`/`args` de cada entrada do `.mcp/mcp.json`, seguido de uma chamada real do protocolo, ex. `tools/list`/`resources/list`) | É o único transporte usado pelos reference servers listados no Anexo C (`npx @modelcontextprotocol/server-*`); não há servers HTTP/SSE neste projeto | y |
| Ferramenta para gerar o script | Tentar GitHub Copilot CLI real primeiro (com aprovação do usuário antes de rodar); se falhar por autenticação (mesmo bloqueio do Exercício 2.1), cair no subagente Claude isolado como substituto documentado | Precedente já aceito e registrado em `agents-md-tech-lead/context.md`; a régua de nota pede "Gerado com Copilot" mas o bloqueio de autenticação é ambiental, não de escopo — repetir o padrão já validado em vez de inventar um novo | y |
| Pacote npm para o server `git` | Decisão adiada para a fase de Design (opções: `@cyanheads/git-mcp-server`, `mcp-server-git` via npx, ambos alternativas ao `uvx mcp-server-git` do Anexo C que não roda neste ambiente) | Não é uma ambiguidade de requisito — é uma escolha de implementação que depende de testar qual pacote responde corretamente ao handshake MCP; travar isso agora no spec seria inventar uma decisão sem evidência | y |
| Nível de detalhe do diagrama de conexões | Mermaid ou tabela estruturada — não é exigida uma ferramenta específica de diagramação | O critério de nota exige "quem consome o quê, com permissões", não um formato visual específico; Mermaid é renderizável em Markdown puro (GitHub/VS Code) sem ferramenta externa | y |

**Open questions:** none — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Tech Lead documenta o MCP como infraestrutura gerenciada ⭐ MVP

**User Story**: Como Tech Lead, quero um documento de arquitetura de MCP com diagrama de conexões/permissões, política de aprovação, monitoramento e versionamento, para que novos servers não sejam adicionados de forma ad-hoc e qualquer pessoa do time entenda quem acessa o quê.

**Why P1**: É o critério de maior peso da régua de nota (`avaliacao-tech-lead.md`, Exercício 2.2) — "MCP como infraestrutura" com red flag "configuração ad-hoc" — e a base sobre a qual o script de health check e o plano de contingência se apoiam.

**Acceptance Criteria**:

1. WHEN `.mcp/mcp.json` é inspecionado THEN ele SHALL conter um objeto `mcpServers` populado com, no mínimo, as quatro entradas `filesystem`, `git`, `memory`, `everything`, cada uma com `command`/`args` não vazios — substituindo o scaffold atual `{"mcpServers": {}}`. (REQ-01)
2. WHEN `docs/mcp-architecture.md` é lido THEN ele SHALL conter uma seção de "Versionamento" que nomeia o arquivo versionado (`.mcp/mcp.json`) e o mecanismo concreto de revisão de mudanças (ex.: review de diff em PR) — uma frase genérica como "versionar no git" sem nomear o mecanismo de revisão NÃO satisfaz este critério. (REQ-01)
3. WHEN `docs/mcp-architecture.md` é lido THEN ele SHALL conter uma seção de "Monitoramento" descrevendo (a) o que significa operacionalmente um server "down" ou "degradado" e (b) quando/como o script de health check (REQ-03) deve ser executado (ex.: manualmente antes de uma sessão de trabalho e/ou em CI) — uma menção solta a "monitorar os servers" sem nomear o mecanismo NÃO satisfaz este critério. (REQ-01)
4. WHEN `docs/mcp-architecture.md` é lido THEN ele SHALL conter um diagrama (Mermaid ou tabela estruturada) listando, para cada chave presente em `mcpServers` do `.mcp/mcp.json`, qual agente/papel consome aquele server (ex.: "Tech Lead via Claude Code", "Copilot CLI") e o escopo de acesso (caminhos e rw/read-only). (REQ-02)
5. WHEN o conjunto de servers do diagrama é comparado ao conjunto de chaves de `mcpServers` em `.mcp/mcp.json` THEN os dois conjuntos SHALL ser idênticos — nenhum server configurado sem entrada correspondente no diagrama, e nenhuma entrada do diagrama para um server ausente do `.mcp/mcp.json`. (REQ-02)
6. WHEN a entrada do diagrama para o server `filesystem` é lida THEN ela SHALL distinguir os caminhos de leitura-e-escrita (`./src`, `./specs`, `./skills`) dos caminhos somente-leitura (`./docs/novatech`, `./data/retrieval-corpus`), refletindo o mapeamento do desenvolvedor dado no enunciado do exercício. (REQ-02)
7. WHEN a seção de política de aprovação de `docs/mcp-architecture.md` é lida THEN ela SHALL nomear um único papel aprovador responsável (ex.: "Tech Lead") pela adição de um novo server ao `.mcp/mcp.json` — ela SHALL NOT exigir revisão por comitê/conselho. (REQ-05)
8. WHEN a política de aprovação é lida THEN ela SHALL exigir que quem propõe o novo server declare, antes do merge, o escopo (caminhos e/ou tools expostas) e uma justificativa ligada a uma necessidade real do projeto — ela SHALL NOT permitir merge de um server sem essa declaração de escopo. (REQ-05)
9. WHEN a política de aprovação é lida THEN ela SHALL declarar um prazo máximo concreto de revisão (ex.: "revisão em até 1 dia útil") — o suficiente para não travar a configuração local de um desenvolvedor. (REQ-05)

**Independent Test**: Ler `docs/mcp-architecture.md` e `.mcp/mcp.json` isoladamente (sem rodar nada) e conferir, item a item, que cada seção e cada entrada de servers existe e é consistente entre os dois arquivos.

---

### P1: Script de health check é executado de verdade contra os servers locais ⭐ MVP

**User Story**: Como Tech Lead, quero um script que leia o `.mcp/mcp.json`, suba cada server configurado e confirme que ele responde, para que a "saúde" dos servers MCP seja um fato verificável por execução, não uma afirmação no documento.

**Why P1**: É o critério com red flag mais severo da régua de nota — "sem script, não-funcional, ou sem saída de execução" — e a única forma de provar que a arquitetura documentada corresponde à realidade.

**Acceptance Criteria**:

1. WHEN `scripts/mcp-health-check.ts` é executado pelo comando documentado em `docs/mcp-architecture.md` (ex.: `npx tsx scripts/mcp-health-check.ts` ou um script `npm run mcp:health` adicionado ao `package.json`) THEN ele SHALL ler `.mcp/mcp.json` do disco (não uma lista de servers hardcoded no próprio script) e iterar sobre cada chave de `mcpServers`. (REQ-03)
2. WHEN cada server configurado é consultado THEN o script SHALL fazer uma checagem real de protocolo MCP (ex.: `tools/list` e/ou `resources/list` sobre o transporte stdio do server) — não apenas verificar que o binário do `command` existe no PATH. (REQ-03)
3. WHEN o server `filesystem` é checado THEN o script SHALL confirmar especificamente a visibilidade sobre `docs/novatech/` (ex.: listando aquele diretório como raiz/recurso acessível, ou lendo um arquivo conhecido dentro dele) — não apenas que o processo subiu. (REQ-03)
4. WHEN um server não responde dentro de um timeout limitado e concreto (número de segundos definido no script) THEN o script SHALL marcar aquele server como DOWN com uma mensagem clara e continuar checando os servers restantes, encerrando com código de saída não-zero se qualquer server estiver DOWN — o script SHALL NOT travar/abortar no primeiro server que falhar. (REQ-03, REQ-04)
5. WHEN o script já foi executado de verdade ao menos uma vez THEN a saída literal de stdout dessa execução (não uma paráfrase nem um exemplo escrito à mão) SHALL estar capturada no repositório (ex.: um apêndice em `docs/mcp-architecture.md` ou um arquivo `scripts/mcp-health-check.output.txt`), junto com o comando exato usado para produzi-la. (REQ-03)

**Independent Test**: Rodar o comando documentado a partir de um checkout limpo do sandbox e comparar a saída obtida, linha a linha, com a saída capturada no repositório — os status reportados (UP/DOWN por server) devem ser reproduzíveis, não apenas relatados pelo autor.

---

### P1: Plano de contingência degrada a capacidade do agente em vez de travar tudo ⭐ MVP

**User Story**: Como Tech Lead, quero um runbook que diga exatamente o que o agente deve fazer quando um server MCP fica indisponível durante o desenvolvimento, para que ele avise e degrade a capacidade em vez de alucinar uma resposta ou travar o trabalho inteiro.

**Why P1**: É o segundo red flag mais severo da régua de nota — "se cair, para tudo" — e a garantia comportamental de que a ausência de uma fonte (ex. `docs/novatech/` inacessível) nunca vira uma resposta inventada.

**Acceptance Criteria**:

1. WHEN `docs/runbooks/mcp-contingency.md` é lido THEN ele SHALL definir, por server configurado, um sinal de detecção (como o agente/usuário percebe que caiu) e um comportamento de modo degradado (o que o agente ainda consegue fazer sem aquele server). (REQ-04)
2. WHEN o server `filesystem` especificamente perde acesso a `docs/novatech/` (cenário nomeado no enunciado do exercício) THEN o runbook SHALL declarar explicitamente que o agente deve avisar o usuário que a fonte está indisponível e, então, pedir uma fonte alternativa OU declarar que não pode responder — e SHALL proibir explicitamente fabricar uma resposta a partir de memória/treinamento. (REQ-04)
3. WHEN mais de um server está indisponível ao mesmo tempo THEN o runbook SHALL descrever degradação cumulativa/parcial (cada server ausente reduz a capacidade de forma independente) em vez de uma regra global única de "parar tudo" — um runbook cuja única instrução para qualquer server seja "pare o trabalho até o server voltar" NÃO satisfaz este critério. (REQ-04)

**Independent Test**: Para cada um dos 4 servers configurados, localizar no runbook a linha/seção que descreve detecção + comportamento degradado; simular (manualmente, por leitura) o cenário de dois servers caídos e confirmar que o texto resultante do runbook não recomenda parar o trabalho inteiro.

---

## Edge Cases

- WHEN `.mcp/mcp.json` está malformado (JSON inválido) ou sem a chave `mcpServers` THEN o script de health check SHALL reportar um erro de parsing/config claro e encerrar com código não-zero, em vez de lançar uma exceção não tratada. (REQ-03)
- WHEN o GitHub Copilot CLI (ferramenta-alvo do enunciado para gerar o script) falha por falta de autenticação THEN a falha SHALL ser capturada como evidência real e o subagente Claude isolado documentado em `context.md` SHALL ser usado como substituto — nunca trocado silenciosamente sem essa evidência. (Cobre a dimensão "External-dependency failure"; mesmo precedente de `agents-md-tech-lead/context.md`.)
- WHEN nenhum server responde (ex.: sem acesso à rede para `npx` baixar um pacote na primeira execução) THEN o script SHALL reportar cada server como DOWN individualmente, com sua própria mensagem de causa, em vez de travar na primeira falha. (REQ-03)

---

## Requirement Traceability

Cada requisito recebe um ID único para rastreamento entre design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| REQ-01 | P1: Tech Lead documenta MCP como infraestrutura | Design | Pending |
| REQ-02 | P1: Tech Lead documenta MCP como infraestrutura | Design | Pending |
| REQ-03 | P1: Script de health check executado de verdade | Design | Pending |
| REQ-04 | P1: Plano de contingência degrada em vez de travar | Design | Pending |
| REQ-05 | P1: Tech Lead documenta MCP como infraestrutura | Design | Pending |

**ID format:** `REQ-NN` (espelhando 1:1 as linhas da tabela de critérios do Exercício 2.2 em `avaliacao-tech-lead.md`, na mesma ordem, para que validação e avaliação leiam os mesmos IDs — mesma convenção usada em `agents-md-tech-lead/spec.md`).

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 5 total, 0 mapped to tasks (fase Tasks ainda não executada), 0 unmapped dentro do escopo desta feature.

### Implicit-Requirement Dimensions Sweep (Large tier — full gate)

| Dimension | Resolution |
| --- | --- |
| Input validation & bounds | Requirement: o script de health check SHALL validar que `.mcp/mcp.json` é JSON válido e contém `mcpServers` antes de iterar (ver Edge Cases; folded into REQ-03). |
| Failure / partial-failure states | Requirement: falha de um server SHALL ser isolada (marcado DOWN) sem interromper a checagem dos demais (REQ-03, REQ-04). |
| Idempotency / retry / duplicate handling | N/A because o health check é uma invocação de CLI somente-leitura e sem estado persistido — rodar múltiplas vezes não tem efeito colateral que exija deduplicação ou chave de idempotência. |
| Auth boundaries & rate limits | N/A because todos os servers configurados (`filesystem`, `git`, `memory`, `everything`) são processos locais sem autenticação externa; se a fase de Design escolher um pacote de `git` que exigisse auth (não é o caso das opções levantadas), este N/A precisaria ser revisitado. |
| Concurrency / ordering | Requirement: o script SHALL checar os servers com timeout individual limitado por server, de forma que um server lento não bloqueie indefinidamente a checagem dos demais (folded into REQ-03 AC4). |
| Data lifecycle / expiry | N/A because nem a configuração MCP nem a saída do health check têm TTL nesta feature; o ciclo de vida interno do grafo do server `memory` é responsabilidade do próprio server, fora do escopo deste health check. |
| Observability | Requirement: saída do script SHALL ser estruturada o suficiente para grep (uma linha de status por server) e a seção "Monitoramento" do documento de arquitetura SHALL nomear quando essa checagem roda (REQ-01 AC3, REQ-03 AC5). |
| External-dependency failure | Requirement: ver Edge Cases — falha do Copilot CLI e falha de qualquer server MCP SHALL ser reportada, nunca mascarada ou inventada (REQ-04). |
| State-transition integrity | N/A because a política de aprovação de novos servers é um processo manual de revisão humana, não uma máquina de estados automatizada, nesta feature. |

---

## Success Criteria

Como saberemos que a feature foi bem-sucedida:

- [ ] `docs/mcp-architecture.md` existe e cobre, com evidência verificável por leitura, diagrama de conexões/permissões, política de aprovação, monitoramento e versionamento (REQ-01, REQ-02, REQ-05).
- [ ] `.mcp/mcp.json` sai do estado vazio e passa a configurar os 4 servers reais (`filesystem`, `git`, `memory`, `everything`) com escopos concretos (REQ-01, REQ-02).
- [ ] `scripts/mcp-health-check.ts` roda de verdade e sua saída real (não simulada) está capturada no repositório, incluindo a confirmação específica de que `filesystem` enxerga `docs/novatech/` (REQ-03).
- [ ] `docs/runbooks/mcp-contingency.md` existe e, para cada server, descreve degradação com aviso — nunca alucinação nem parada total do trabalho (REQ-04).
