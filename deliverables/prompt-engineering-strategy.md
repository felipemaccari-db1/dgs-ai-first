# Estratégia de Prompt Engineering como Artefato de Arquitetura

**Projeto:** NovaTech — Assistente de Atendimento RAG  
**Papel:** Tech Lead  
**Exercício:** 1.2 — Prompt Engineering como Artefato de Arquitetura

---

## 1. Estratégia de Versionamento de Prompts

### Onde os prompts vivem

```
prompts/
  system-prompt-v1.md     ← versão inicial (desenvolvedor)
  system-prompt-v2.md     ← versão atual aceita (este documento)
  system-prompt-v3.md     ← próxima iteração (quando necessário)
```

Os prompts vivem no mesmo repositório que o código. Não em variável de ambiente, não no banco de dados — no controle de versão, ao lado do código que os consome.

### Convenção de nomes

`system-prompt-v{N}.md` — inteiro sequencial, sem semver. Prompts não têm compatibilidade retroativa: cada versão substitui a anterior. O número facilita referência em PRs, logs e incidentes ("a resposta degradou depois de v3").

### Ciclo de mudança

1. **Branch**: `prompt/v{N}-descricao-curta`
2. **PR obrigatório** com aprovação do Tech Lead + ao menos um revisor de domínio (Product Specialist ou QA)
3. **Execução do golden dataset** como check de CI: `python prompt-test.py --prompt prompts/system-prompt-v{N}.md` deve passar 100% dos casos determinísticos antes do merge
4. **Tag git**: `prompt/v{N}` no commit de merge para rastreabilidade em `git log --tags`
5. **Deploy controlado**: variável de ambiente `SYSTEM_PROMPT_VERSION=N` determina qual arquivo é carregado em runtime — isso permite rollback sem redeploy de código

### Quem pode alterar

| Ação | Autorização |
|---|---|
| Propor mudança (abrir PR) | Qualquer dev ou Product Specialist |
| Aprovar e mergear | Tech Lead (obrigatório) + 1 revisor de domínio |
| Deploy em produção | Tech Lead + confirmação do golden dataset |
| Rollback de emergência | Tech Lead ou on-call engineer via `SYSTEM_PROMPT_VERSION` |

---

## 2. Anatomia do Contexto — Estático vs Dinâmico

Uma query ao assistente NovaTech não é apenas "o prompt". É uma composição de partes com tamanhos, origens e frequências de mudança diferentes. Tratá-las como uma só string é o principal motivo pelo qual prompts ficam difíceis de manter.

### Mapa de componentes

| Componente | Tipo | Tokens estimados | Frequência de mudança |
|---|---|---|---|
| System prompt | Estático | ~600 | Raro — requer PR e golden dataset |
| Metadados do cliente | Dinâmico/query | ~80 | A cada query (nome, tier, canal) |
| Chunks recuperados | Dinâmico/query | até 5.760 | A cada query (12 chunks × ~480 tokens) |
| Histórico de conversa | Dinâmico/crescente | até 1.200 | Cresce por turno; sumarizado após 5+ turnos |
| Pergunta atual | Dinâmico/query | ~60 | A cada query |
| **Total** | | **~7.700** | **Teto: 8.000 tokens (ADR-0002)** |

> **Por que 8K e não 128K?** O GPT-4o tem janela de 128K tokens, mas quanto maior o contexto, mais o modelo distribui atenção. Contextos longos ativam o efeito *lost in the middle*: chunks posicionados no meio recebem menos peso. O teto de 8K é um orçamento deliberado, não uma limitação técnica. Ver ADR-0002.

### Prioridade de posição dentro do contexto

A ordem no contexto importa. Modelos processam melhor o que está no início e no fim:

```
[INÍCIO — maior atenção]
  1. System prompt (guardrails + identidade)
  2. Metadados do cliente (tier, nome)
  3. Pergunta atual
  4. Chunks mais relevantes (top-ranked pelo retriever)
  5. Chunks de suporte (menor score de similaridade)
  6. Histórico de conversa (turnos mais recentes primeiro)
[FIM — maior atenção]
```

Chunks com contradições conhecidas (ADR-0003) são posicionados juntos, com o mais recente primeiro.

### Composição em C#

```csharp
var context = new ContextBuilder()
    .AddStatic(systemPrompt)              // ~600 tokens
    .AddDynamic(clientMetadata)           // ~80 tokens
    .AddDynamic(currentQuestion)          // ~60 tokens
    .AddChunks(retrievedChunks, maxTokens: 5760)   // dinâmico, até 12 chunks
    .AddHistory(conversationHistory, maxTurns: 3)  // crescente, sumarizado após 5+
    .Build(tokenCeiling: 8000);
```

---

## 3. System Prompt v2

O prompt fornecido pelo desenvolvedor (v1) tem 4 linhas e cobre apenas o caso feliz. A versão abaixo corrige as omissões identificadas na revisão técnica.

### Prompt v1 (recebido)

```
Você é o assistente de atendimento da NovaTech, empresa de logística.
Responda perguntas sobre procedimentos, SLAs e regras de frete.
Use apenas as informações dos documentos fornecidos.
Cite a fonte. Se não souber, diga que não sabe.
```

**Problemas identificados:**
- Sem instrução de formato de citação (modelo cita como quiser)
- Sem tratamento explícito para documentos contraditórios
- "Se não souber, diga que não sabe" é vago — o modelo pode interpretar como sugestão, não obrigação
- Sem restrição de tier (modelo pode confirmar tiers que não existem)
- Sem instrução de escalada quando ausência de resposta

### Prompt v2 (revisado)

```
Você é o assistente de atendimento interno da NovaTech, empresa de logística.
Seu papel é responder perguntas do time de atendimento ao cliente sobre
procedimentos operacionais, SLAs, regras de frete e políticas da empresa.

## Regras de resposta

1. **Responda apenas com base nos documentos fornecidos neste contexto.**
   Nunca use conhecimento geral ou inferências não fundamentadas nos documentos.
   Se a informação não estiver nos documentos, siga a regra 4.

2. **Cite obrigatoriamente a fonte de cada informação.**
   Formato: [FONTE: {nome-do-documento}, seção {número}]
   Exemplo: [FONTE: POL-001, seção 3.2]
   Toda afirmação factual (prazo, valor, regra) deve ter sua fonte citada.

3. **Quando dois documentos se contradizerem**, apresente ambas as versões
   com as datas de vigência de cada uma e oriente o atendente a verificar
   qual é a versão ativa com o supervisor ou área responsável.
   Não escolha uma versão silenciosamente.

4. **Quando não houver resposta nos documentos**, responda:
   "Não encontrei essa informação na documentação disponível.
   Recomendo escalar para o supervisor ou verificar diretamente com a área responsável."
   Nunca invente prazos, valores, multiplicadores ou regras não documentadas.

5. **Confirme apenas os tiers de cliente existentes:** Gold, Silver e Standard.
   Se perguntarem sobre um tier diferente, informe que ele não existe na tabela
   SLA atual e cite o documento [FONTE: SLA-2024].

6. **Idioma e tom:** português formal e direto. Sem jargão técnico de TI.
   Respostas curtas — máximo 5 linhas, exceto quando a pergunta exigir
   comparação de múltiplas versões de documento.

## Contexto do atendimento

- Canal: Microsoft Teams
- Usuário: atendente do time de suporte ao cliente NovaTech
- Documentação fornecida: chunks do pipeline RAG, priorizados por relevância
```

**O que mudou:**
- Citação tem formato obrigatório `[FONTE: X, seção Y]` — facilita validação determinística
- Regra 3 implementa o ADR-0003 (contradições mostram ambas versões com datas)
- Regra 4 explicita o comportamento de fallback com texto de resposta fixo
- Regra 5 fecha a lista de tiers válidos — impede alucinação de "Platinum", "Diamond" etc.
- Regra 6 limita o tamanho da resposta por padrão

---

## 4. Enforcement Probabilístico vs Determinístico

Um guardrail no prompt é uma instrução que o modelo pode ou não seguir. É probabilístico. Alguns guardrails podem e devem ser enforçados deterministicamente, fora do modelo, no harness.

| Guardrail | Enforcement | Mecanismo | Justificativa |
|---|---|---|---|
| Citar fonte | Probabilístico (prompt) | Instrução no system prompt | Formato livre — modelo decide como estruturar. V2 define formato fixo para facilitar validação |
| Formato de citação `[FONTE: ...]` | **Determinístico (pós-geração)** | Regex: `\[FONTE:.*?\]` | Com o formato fixo do v2, ausência de match é erro detectável |
| Nunca inventar prazos/valores | Probabilístico (prompt) | Instrução no system prompt | Não é detectável genericamente — só para valores específicos conhecidos |
| Tier válido (Gold/Silver/Standard) | **Determinístico (pós-geração)** | Lista negra de tiers inválidos | `if "Platinum" in response or "Diamond" in response: block` |
| Dizer "não encontrei" | Probabilístico (prompt) | Instrução no system prompt | Semântico — sem sinal determinístico confiável |
| Resposta em português | **Determinístico (pós-geração)** | Language detection (stopwords PT) | Verificável sem modelo externo |
| Contexto dentro do orçamento | **Determinístico (pré-geração)** | Contagem de tokens antes de enviar | `assert total_tokens <= 8000` no ContextBuilder |
| Resposta sem conteúdo de cargas perigosas invertido | Probabilístico (prompt) + **teste de regressão** | Incluído no golden dataset | Difícil detectar deterministicamente; o golden dataset é o backstop |

### Separação no harness (C#)

```
[Pré-geração — determinístico]
  ContextBuilder.Build() → assert tokens <= 8000

[Geração — probabilístico]
  LLM processa system prompt + chunks + pergunta

[Pós-geração — determinístico]
  1. Regex: resposta contém [FONTE: ...]?         → se não: log warning, flag para revisão
  2. Blocklist: resposta contém tier inválido?    → se sim: substituir por mensagem padrão
  3. Language check: resposta está em português?  → se não: log error
  4. Length check: resposta tem mais de 50 linhas? → se sim: log warning (possível context overflow)
```

> **Regra prática:** se o critério pode ser verificado com código sem precisar de outro LLM, torne-o determinístico. Probabilístico é para o que requer julgamento semântico.

---

## 5. Relação com os ADRs

| ADR | Decisão | Impacto nesta estratégia |
|---|---|---|
| ADR-0001 | Azure OpenAI GPT-4o | System prompt deve ser compatível com model version pinned |
| ADR-0002 | Teto de 8K tokens, 12 chunks, 3 turnos | Orçamento de contexto na tabela da seção 2 |
| ADR-0003 | Contradições mostram ambas versões | Regra 3 do system prompt v2 |
| ADR-0004 | Azure AI Search (managed) | Chunks chegam já rankeados; o prompt pode assumir ordem de relevância |
