# Cenário-Âncora 2 — Fase de Estruturação do Trabalho

## Ferramentas disponíveis para os participantes
- **Claude** (chat) — todos os papéis
- **GitHub Copilot** — desenvolvedores e Tech Lead
- **Claude Cowork** — Delivery Manager, Product Specialist, QA
- **Claude Design** — Product Specialist

## Documentos de apoio
- **Anexo A — Documentação Simulada da NovaTech:** Conteúdo completo dos 5 documentos-chave. Usar como referência para guardrails, glossário de domínio, e dados de teste.
- **Anexo B — Chunks de Referência do Pipeline de RAG:** Chunks extraídos e mapa de cobertura. Usar nos exercícios que pedem dados de teste realistas.
- **Anexo C — Estrutura do Repositório:** Mapa de diretórios do `db1/novatech-assistant` no início desta fase, com convenções de organização e exemplo de configuração MCP.

---

## O Cenário (continuação)

O projeto NovaTech foi aprovado. O discovery está concluído e a fase de entendimento produziu artefatos concretos: ADRs com decisões arquiteturais (modelo LLM, estratégia de contexto, tratamento de documentos contraditórios, build vs buy), uma spec de requisitos de produto para o pipeline de RAG, um protótipo funcional de RAG com ferramentas open-source, cenários de falha mapeados pelo QA, e um plano de testes inicial. Agora o time precisa estruturar o ambiente, os padrões e os artefatos que vão governar o desenvolvimento.

### O que foi definido na fase anterior (cenário 1)

- **Modelo LLM:** Azure OpenAI (GPT-4o) — escolhido pela integração com o ecossistema Microsoft da NovaTech e pela janela de 128K tokens (ADR-0001).
- **Pipeline de RAG:** Azure AI Search + Azure OpenAI. O protótipo open-source (ChromaDB + sentence-transformers) validou a abordagem e identificou problemas de chunking em tabelas (ADR-0004).
- **Estratégia de contexto:** Context budget de ~4K tokens para system prompt + ~8K para chunks (5 chunks de ~1.500 tokens) + pergunta + histórico limitado a 3 turnos (ADR-0002).
- **Documentos contraditórios:** Metadado de vigência no pipeline; prompt instrui o modelo a priorizar versão mais recente; documentos obsoletos marcados, não excluídos (ADR-0003).
- **Integração:** Microsoft Teams (bot) + painel web interno.
- **Base documental:** das ~1.250 fontes brutas do cenário 1 (SharePoint, Confluence e planilhas), após deduplicação e limpeza no discovery restaram 847 documentos válidos consolidados (12 deles com contradições pendentes de resolução pelo Compliance da NovaTech); 63 foram descartados por obsolescência e ~340 eliminados como duplicatas ou redundâncias.
- **Arquitetura:** 4 componentes — (1) pipeline de ingestão, (2) API do assistente (Azure Functions + Azure AI Search + Azure OpenAI), (3) interface no Teams via Bot Framework, e (4) painel web interno (dashboard de métricas e histórico).
- **Stack:** TypeScript (backend e bot), React (painel web), Bicep para infraestrutura como código.
- **Repositório:** `novatech-assistant` (o prefixo `db1/` é narrativo). Nesta fase é trabalhado como repositório Git **local** — ver Anexo D (Starter Repo); não há remoto nem GitHub necessários.
- **Time:** 1 Tech Lead, 2 Desenvolvedores (1 pleno, 1 sênior), 1 QA, 1 Product Specialist, 1 Delivery Manager.

### O desafio desta fase

Antes de escrever a primeira linha de código de produção, o time precisa:
1. Definir como agentes de IA (Copilot, Claude Code) serão usados no desenvolvimento — regras, limites, padrões.
2. Recortar o domínio do projeto (bounded contexts, linguagem ubíqua) e especificar o que será construído usando Spec Driven Development.
3. Configurar as conexões que os agentes precisam para operar (MCP servers para acessar repositório, docs, Azure).
4. Criar skills reutilizáveis que encapsulam os padrões do projeto para geração consistente de código e artefatos.

---

#### Exercício 2.1 — Construção e teste do AGENTS.md do projeto

**Contexto:** Você é responsável por montar o AGENTS.md do repositório — o documento que todo agente de IA (Copilot, Claude Code) lê antes de gerar qualquer artefato no projeto. As decisões técnicas vêm das ADRs produzidas na fase anterior.

**Ferramentas a utilizar:** Claude (chat) + GitHub Copilot

**Inputs fornecidos:**
- O cenário completo.
- A estrutura do repositório (ver **Anexo C**).
- As decisões técnicas das ADRs da fase anterior (simuladas):
  - TypeScript com strict mode.
  - Azure Functions v4 com HTTP triggers.
  - Zod para validação de input/output.
  - Vitest para testes.
  - pino para logging (nunca console.log).
  - Conventional Commits para mensagens de commit.
  - Branch strategy: feature branches **locais**. Como esta fase não usa remoto, "abrir PR" significa criar a branch e escrever a descrição do PR como um arquivo markdown (ex.: `docs/pull-requests/PR-NNNN.md`) com objetivo, mudanças e checklist de validation gates; a revisão é simulada localmente.
  - Context budget: ~4K tokens system prompt + ~8K chunks por query (ADR-0002).
  - Documentos contraditórios: metadado de vigência, priorizar mais recente (ADR-0003).
- A especificação do AGENTS.md: *"O AGENTS.md é a constitution do projeto: contém decisões duráveis que todo agente e toda spec devem respeitar. Funciona como contrato entre humanos e agentes."*

**Tarefa:**
1. Usando o **Claude**, escreva o AGENTS.md completo do projeto, incluindo as seções: Project Overview, Tech Stack & Architecture, Coding Standards, Build & Deploy. Inclua na seção de Architecture as regras de gerenciamento de contexto derivadas da ADR-0002. (As seções de Product Rules, Testing Standards e Project Management serão escritas pelos outros papéis.)

2. Usando o **GitHub Copilot**, teste o AGENTS.md: com o arquivo presente no repositório, peça ao Copilot que gere (a) uma Azure Function endpoint, (b) um teste para esse endpoint. Observe se o Copilot segue as convenções definidas.

3. Documente o que o Copilot seguiu e o que ignorou. Para cada item ignorado, reescreva a seção relevante para ser mais prescritiva e teste novamente.

**Entregável:** O AGENTS.md v1, os outputs do Copilot, a análise do que foi seguido/ignorado, o AGENTS.md v2 (iterado), e os outputs da segunda rodada.

**Critérios de avaliação:**
- O AGENTS.md é prescritivo (instruções que um agente consegue seguir, não descrição do projeto).
- As regras de gerenciamento de contexto da ADR-0002 estão incorporadas (context budget, limites por query).
- O teste com Copilot é real (evidência de outputs).
- A iteração v1 → v2 mostra melhoria concreta.
- A análise reconhece limitações (nem tudo será seguido — e isso é esperado).

---

#### Exercício 2.2 — Arquitetura de MCP do projeto (servers locais)

**Contexto:** Você precisa definir a arquitetura de MCP do projeto: quais servers locais, com quais escopos/permissões, como monitorá-los e como o time é avisado de mudanças. Como todos os servers rodam localmente, "monitorar" e "health check" são exercícios **executáveis de verdade**.

**Ferramentas a utilizar:** Claude (chat) + GitHub Copilot

**Inputs fornecidos:**
- O cenário completo, o **Anexo C** e o **Anexo D — Starter Repo**.
- O mapeamento de MCP do desenvolvedor (simulado — output do Dev 2.1, fornecido para autossuficiência):
  ```
  Servers locais e gratuitos:
  (1) filesystem  -> ./src ./specs ./skills (rw) + ./docs/novatech ./data/retrieval-corpus (read-only)
  (2) git         -> repositório local (histórico, diff, branches)
  (3) memory      -> grafo persistente de decisões e linguagem ubíqua
  (4) everything  -> aprendizado das primitivas de MCP
  ```
- Conceito de MCP architecture: *"MCP servers devem ser gerenciados como infraestrutura: versionados, com escopo/permissões mínimas, e observáveis. O Tech Lead decide quais servers são autorizados e quais tools cada um expõe."*

**Tarefa:**
1. Usando o **Claude**, produza um documento de arquitetura de MCP que cubra:
   - Diagrama dos servers e suas conexões com os agentes (quem consome o quê, com qual escopo).
   - Política de aprovação: como um novo server local é adicionado ao `.mcp/mcp.json` do projeto (quem revisa escopo e permissões).
   - Monitoramento: como saber se um server parou de responder ou perdeu acesso a uma pasta.
   - Versionamento: como garantir que mudar o escopo de um server não quebre fluxos existentes.

2. Usando o **GitHub Copilot**, crie um **script de health check** que sobe/consulta cada server configurado no `.mcp/mcp.json` e verifica que ele responde (ex.: lista as tools/resources expostas; confirma que o `filesystem` enxerga `docs/novatech/`). Como os servers são locais, o script **roda de fato** — inclua a saída de uma execução.

3. Defina o que acontece quando um server fica indisponível durante o desenvolvimento (ex.: `filesystem` sem a pasta de docs -> o agente deve degradar com aviso, não inventar).

**Entregável:** O documento de arquitetura, o script de health check **com saída de execução real**, e o plano de contingência.

**Critérios de avaliação:**
- A arquitetura trata os servers locais como infraestrutura gerenciada (escopo, permissões, versionamento), não config ad-hoc.
- A política de aprovação equilibra agilidade com segurança (revisão de escopo/least privilege).
- O health check é **funcional e foi executado** (saída real contra servers locais), não apenas conceitual.
- O plano de contingência é realista (agente degradado com aviso é melhor que agente que alucina).

---

#### Exercício 2.3 — Criação e teste de skills técnicas

**Contexto:** Você precisa criar as skills técnicas do projeto que vão garantir que o Copilot gere código consistente com os padrões definidos.

**Ferramentas a utilizar:** Claude (chat) + GitHub Copilot

**Inputs fornecidos:**
- O cenário completo.
- A estrutura do repositório (ver **Anexo C**) — as skills devem seguir a hierarquia de diretórios definida em `/skills/`.
- A árvore de skills proposta pelo desenvolvedor (simulada):
  ```
  Foundation:
  ├── typescript-conventions (strict mode, imports, naming)
  ├── error-handling (custom errors, logging, retry)
  └── project-structure (folders, modules, exports)
  
  Domain:
  ├── azure-functions-endpoint (HTTP trigger pattern)
  ├── azure-ai-search-integration (query, index management)
  ├── react-components (painel web patterns)
  └── testing-patterns (Vitest, mocks, fixtures)
  
  Artifact:
  ├── create-rag-endpoint (receita completa)
  ├── create-integration-test (receita completa)
  └── create-react-card (receita completa)
  ```

**Tarefa:**
1. Usando o **Claude**, escreva o SKILL.md completo para a skill `azure-functions-endpoint` (Domain level). Inclua: contexto, regras prescritivas, exemplos de código (DO/DON'T), anti-padrões comuns, e dependências.

2. Usando o **GitHub Copilot**, teste a skill: com o SKILL.md no repositório, peça ao Copilot que gere um endpoint. Avalie se seguiu as regras.

3. Itere: reescreva seções que o Copilot não seguiu. Teste novamente.

4. Defina critérios para "skill madura": quando está pronta para uso pelo time.

**Entregável:** O SKILL.md, os outputs do Copilot (antes e depois), e os critérios de maturidade.

**Critérios de avaliação:**
- O SKILL.md é prescritivo e concreto (exemplos de código reais).
- A iteração mostra que skills precisam de refinamento baseado em teste real.
- Os critérios de maturidade são práticos e mensuráveis.
- O participante demonstra que skills são artefatos vivos.

---

