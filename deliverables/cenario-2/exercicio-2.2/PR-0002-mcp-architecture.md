# PR-0002 — Arquitetura de MCP: servers locais, health check real, contingência

**Branch:** `feature/mcp-architecture` (criada a partir de `feature/agents-md-tech-lead`)
**Autor:** Tech Lead (Exercício 2.2)
**Status:** Pronto para revisão local

## Objetivo

Tratar os 4 servers MCP locais do projeto (`filesystem`, `git`, `memory`, `everything`) como infraestrutura gerenciada: popular `.mcp/mcp.json` com uma configuração real e testada (não um exemplo do Anexo C copiado sem verificação), documentar arquitetura/aprovação/monitoramento/versionamento, provar por execução real que os servers respondem, e definir como o agente degrada — com aviso, nunca com alucinação — quando um server fica indisponível.

## Mudanças

- `.mcp/mcp.json`: sai do estado vazio (`{"mcpServers": {}}`) e passa a configurar os 4 servers reais. `filesystem`/`memory`/`everything` seguem a receita do Anexo C (pacotes oficiais via `npx`). `git` diverge do Anexo C (`uvx mcp-server-git`, que não roda neste ambiente — `uvx`/`uv`/`pip` ausentes) e usa `@cyanheads/git-mcp-server`, confirmado por handshake MCP real.
- `docs/mcp-architecture.md`: documento de arquitetura — diagrama de conexões/permissões (Mermaid + tabela), política de aprovação de novo server, monitoramento (o que é UP/DOWN/DEGRADED, quando rodar o health check), versionamento do `.mcp.json` via PR-como-markdown.
- `docs/runbooks/mcp-contingency.md`: comportamento degradado por server + regra de degradação cumulativa quando mais de um server cai ao mesmo tempo, fundamentado na evidência real de execução.
- `scripts/mcp-health-check.ts`: script que lê `.mcp/mcp.json` do disco, sobe cada server, faz handshake MCP real (`initialize`+`tools/list`) com timeout por server, confirma especificamente que `filesystem` enxerga `docs/novatech/`, e nunca deixa a falha de um server interromper a checagem dos demais.
- `scripts/output/run-output-normal.txt` e `scripts/output/run-output-degraded.txt`: saída real de duas execuções — todos os servers `UP`, e uma simulação real do cenário nomeado no exercício (`docs/novatech` inacessível) reportando `filesystem` como `DEGRADED`.
- `package.json`/`package-lock.json`: adiciona `tsx` e `@types/node` como devDependencies (necessário para rodar o script TypeScript diretamente) e o script `npm run mcp:health`.
- `.specs/features/mcp-architecture/`: spec, context, design e evidência desta feature (skill `tlc-spec-driven`).

## Achado de segurança registrado (não um desvio de plano, um achado real)

Ao avaliar candidatos `npx`-based para substituir `uvx mcp-server-git` (indisponível neste ambiente), o pacote `mcp-server-git` (npm, `0.0.2`) foi testado e descartado: seu `bin`/`postinstall` real é `theinfosecguy/npx-canary`, uma sonda de telemetria de pesquisa de segurança, não um MCP server funcional. Isso só foi descoberto por teste real (handshake MCP), não por leitura da página do npm — motivo pelo qual a política de aprovação em `docs/mcp-architecture.md` (seção 2) exige evidência de teste real antes de aprovar qualquer novo server, não apenas o nome do pacote.

## Desvio de plano registrado

O ciclo de geração do script de health check era previsto com GitHub Copilot CLI real. Repetindo o precedente do Exercício 2.1 (`PR-0001`), o usuário optou por ir direto ao substituto documentado — um **subagente Claude isolado** (sem acesso a `.specs/`, `.claude/`, ou aos documentos de arquitetura/avaliação deste próprio exercício, apenas ao `AGENTS.md` e ao requisito funcional dado diretamente) — em vez de tentar novamente a CLI real, já que a falha de autenticação observada no exercício irmão é ambiental e não dependia de nada mudado nesta sessão. Ver `.specs/features/mcp-architecture/context.md`.

## Checklist de validation gates

- [x] `npm run build` (`tsc -p .`) — passa sem erros
- [x] `npm run mcp:health` executado de verdade, duas vezes (normal e degradado), com saída capturada em `scripts/output/`
- [x] `.mcp/mcp.json` restaurado ao estado real/de trabalho após a simulação de indisponibilidade (`git diff` limpo no arquivo após a restauração)
- [x] Diagrama de conexões (`docs/mcp-architecture.md`, seção 1) cobre as 4 chaves exatas presentes em `.mcp/mcp.json` — nenhum server documentado sem config, nenhuma config sem entrada no diagrama
- [x] Limitação técnica real do `filesystem` (sem rw/ro nativo fora do modo Docker) documentada como risco conhecido, não escondida
- [x] Plano de contingência cobre degradação por server + degradação cumulativa (não é "se cair, para tudo")
- [ ] Automação do health check em CI — registrada como evolução futura opcional, não bloqueante para este PR

## Como revisar

1. Ler `docs/mcp-architecture.md` (arquitetura completa) e `docs/runbooks/mcp-contingency.md` (contingência).
2. Ler `scripts/output/run-output-normal.txt` e `run-output-degraded.txt` — confirmar que a saída tem cara de execução real (mensagens de erro específicas de pacote/protocolo, não texto genérico).
3. Rodar `npm install && npm run build && npm run mcp:health` neste diretório para reproduzir o resultado `UP` dos 4 servers de forma independente.
4. Conferir `.specs/features/mcp-architecture/validation.md` (Verifier independente) antes de aprovar.
