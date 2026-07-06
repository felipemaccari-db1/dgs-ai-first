# MCP Architecture — Context

**Gathered:** 2026-07-05
**Spec:** `.specs/features/mcp-architecture/spec.md`
**Status:** Specify concluída. Complexidade avaliada como **Large** (multi-componente: doc de arquitetura + script real + runbook + decisão de pacote npm ainda em aberto) — a fase de **Design** SHALL ser executada a seguir, antes de Tasks/Execute, para decidir o pacote do server `git` e o desenho interno do script de health check. Esta sessão cobriu apenas Specify, por escopo explícito da tarefa.

---

## Feature Boundary

Tratar os 4 servers MCP locais do projeto (`filesystem`, `git`, `memory`, `everything`) como infraestrutura gerenciada: popular `.mcp/mcp.json` de fato, documentar arquitetura/aprovação/monitoramento/versionamento, provar por execução real que os servers respondem, e definir como o agente degrada (sem alucinar) quando um server cai. Não inclui reescrever AGENTS.md nem as skills técnicas (exercícios separados).

---

## Implementation Decisions

### Estado inicial do `.mcp/mcp.json`: vazio, precisa ser preenchido de verdade

- `deliverables/cenario-2/novatech-assistant/.mcp/mcp.json` existe hoje como `{"mcpServers": {}}` — um scaffold vazio, não uma configuração incompleta. A tarefa desta feature é populá-lo com os 4 servers reais do mapeamento do Dev 2.1 (fornecido no enunciado do Exercício 2.2), não só documentar um estado hipotético.

### Ambiente sem `uvx`/`uv`/`pipx`/`pip` — a receita literal do Anexo C para o server `git` não roda aqui

- O Anexo C (`docs/cenario-2/anexo-c-estrutura-repositorio.md`, seção "Exemplo de configuração MCP") prescreve `"command": "uvx", "args": ["mcp-server-git", "--repository", "."]` para o server `git`. Nenhum desses binários (`uvx`, `uv`, `pipx`, `pip`) está instalado neste ambiente — confirmado por checagem direta durante o planejamento.
- `npx` funciona normalmente e resolve pacotes reais via registry npm. Pesquisado durante o planejamento: `@modelcontextprotocol/server-filesystem`, `@modelcontextprotocol/server-memory` e `@modelcontextprotocol/server-everything` resolvem para a versão `2026.7.4` no momento da pesquisa — esses três entram em `.mcp/mcp.json` sem alteração de estratégia frente ao Anexo C, só trocando `uvx` por `npx -y` onde aplicável (eles já usam `npx` no Anexo C).
- Para `git`, como `uvx` não roda aqui, duas alternativas 100%-`npx` foram identificadas e ficam registradas como opções para a fase de Design decidir entre si (não decidido agora, de propósito — ver `spec.md`, tabela de Assumptions): `@cyanheads/git-mcp-server` (`2.15.1`) e `mcp-server-git` (`0.0.2`, um port Node do server oficial em Python). A escolha final depende de testar qual responde corretamente ao handshake MCP (`tools/list`) neste ambiente — algo que só se verifica na prática, não por leitura de changelog.

### Tooling para gerar o script: mesmo precedente do Exercício 2.1 (Copilot real → fallback documentado)

- GitHub Copilot CLI está instalado nesta máquina (`v1.0.68`, binário em `.../github.copilot-chat/copilotCli/copilot`, confirmado via `--version`/`--help`).
- No exercício irmão anterior (`agents-md-tech-lead`), a primeira tentativa real de invocação não-interativa do Copilot CLI falhou com `Error: No authentication information found.` (sem login nem token configurado) — bloqueio ambiental, não de escopo. O usuário, perguntado explicitamente naquela sessão, optou por não autenticar e aprovou um subagente Claude isolado (Agent tool, sem histórico da conversa, sem acesso a `.specs/`/`docs/`/`.claude/`) como substituto declarado, nunca escondido, registrado em `evidence/round-1/copilot-cli-auth-failure.txt`.
- **Decisão para esta feature:** repetir exatamente esse padrão. Na fase de Execute, tentar o Copilot CLI real primeiro para gerar `scripts/mcp-health-check.ts` (com aprovação do usuário antes de rodar, por ser CLI de terceiros com execução de shell/edição de arquivos) — se a autenticação falhar de novo (bloqueio já observado uma vez, provavelmente reprodutível), cair no subagente Claude isolado como substituto aprovado, declarando isso na evidência da mesma forma que a feature irmã fez. Isso não é decidido a priori como "vamos simular direto" — a tentativa real acontece primeiro.

### Linhagem da branch: nasceu de `feature/agents-md-tech-lead`, não de `master`

- `feature/mcp-architecture` foi criada a partir de `feature/agents-md-tech-lead` (não de `master`) especificamente para manter o AGENTS.md v2 (já revisado e aceito no exercício irmão) disponível como contexto de trabalho nesta feature, em vez de reintroduzir o AGENTS.md com placeholders `<!-- TODO -->` do estado inicial do scaffold.
- Consequência prática: qualquer trabalho desta feature herda o histórico de `agents-md-tech-lead` (commits `2670e33`…`162b435`); ao abrir o PR desta feature, o diff de comparação correto é contra `feature/agents-md-tech-lead` (ou o ponto em que ela for eventualmente integrada a `master`), não contra `master` diretamente — decisão a confirmar no momento de abrir `docs/pull-requests/PR-0002-mcp-architecture.md`.

### Régua de nota: sem `avaliacao-foundation.md`, mesma solução da feature irmã

- `avaliacao-tech-lead.md` referencia `avaliacao-foundation.md` no cabeçalho ("dimensões e escala"), mas esse arquivo não existe neste repositório. O mesmo problema já apareceu na avaliação da feature irmã (`agents-md-tech-lead`) e foi resolvido usando a escala 0–3 já embutida na própria tabela de critérios da seção do exercício (aqui, "Exercício 2.2") como fonte de verdade, sem inventar uma escala externa. Esta feature repete essa mesma solução.

### Onde os artefatos finais vão morar (registrado para as próximas fases, não criado agora)

| Artefato | Caminho |
| --- | --- |
| Documento de arquitetura de MCP | `docs/mcp-architecture.md` |
| Plano de contingência | `docs/runbooks/mcp-contingency.md` (pasta já existe, vazia, no scaffold) |
| Script de health check | `scripts/mcp-health-check.ts` (diretório `scripts/` é novo — não existe hoje no sandbox) |
| PR como markdown | `docs/pull-requests/PR-0002-mcp-architecture.md` (segue a numeração sequencial após `PR-0001-agents-md-tech-lead.md`) |

### Agent's Discretion

- Formato exato do diagrama de conexões (Mermaid vs. tabela estruturada) — dentro do requisito REQ-02, que exige conteúdo (quem consome o quê, com permissões), não uma ferramenta específica.
- Redação exata das seções do documento de arquitetura e do runbook — dentro dos requisitos REQ-01/02/04/05.
- Escolha final do pacote npm para o server `git`, feita na fase de Design com base em teste real de handshake MCP, não em preferência a priori.

### Declined / Undiscussed Gray Areas → Assumptions

Nenhuma pendente — as áreas cinzentas identificadas nesta sessão (caminhos dos artefatos, transporte MCP verificado pelo script, ferramenta de geração do script, pacote do server `git`, formato do diagrama) foram todas resolvidas e já estão registradas na tabela **Assumptions & Open Questions** de `spec.md`, com confirmação (`y`) por decorrerem de decisões já tomadas nesta sessão de planejamento ou de restrições verificadas diretamente no ambiente (ausência de `uvx`, precedente do Exercício 2.1).

---

## Specific References

- Enunciado do exercício: `docs/cenario-2/exercicio-2-fase-estruturacao.md`, seção "Exercício 2.2 — Arquitetura de MCP do projeto (servers locais)".
- Régua de nota: `.claude/skills/avaliacao-tech-lead/avaliacao-tech-lead.md`, seção "Exercício 2.2 — Arquitetura de MCP".
- Formato de referência de `.mcp/mcp.json` e mapeamento necessidade→server: `docs/cenario-2/anexo-c-estrutura-repositorio.md`, seção "Exemplo de configuração MCP (`.mcp/mcp.json`)" (a partir de ~linha 185).
- Precedente de pivô de tooling (Copilot CLI → subagente isolado): `deliverables/cenario-2/novatech-assistant/.specs/features/agents-md-tech-lead/context.md`, seção "Tooling: GitHub Copilot CLI existe mas não está autenticado".
- Documentos read-only que o server `filesystem` precisa enxergar: `deliverables/cenario-2/novatech-assistant/docs/novatech/` (5 arquivos: FAQ, POL-001, PROC-042 v1/v2, SLA-2024) e `deliverables/cenario-2/novatech-assistant/data/retrieval-corpus/`.

---

## Deferred Ideas

- Decisão final entre `@cyanheads/git-mcp-server` e `mcp-server-git` (npm) para o server `git` — fase de Design desta mesma feature, não uma feature separada.
- Automatizar o health check em CI (mencionado como opção na seção "Monitoramento" do documento de arquitetura, mas não é requisito obrigatório desta feature — REQ-01 AC3 só exige que o documento declare quando/como o script roda, não que exista um workflow de CI real).
