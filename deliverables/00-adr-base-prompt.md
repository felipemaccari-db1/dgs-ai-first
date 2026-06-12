# Lógica de engenharia de prompt aplicada
Antes de escrever qualquer prompt, preciso justificar cada decisão de design:
## 1. Persona + papel (Role Prompting)

Definir que o modelo atua como arquiteto de software sênior ativa o registro técnico correto e reduz respostas genéricas. Sem isso, o modelo tende a escrever ADRs como documentos acadêmicos em vez de artefatos de engenharia.

## 2. Formato estruturado como âncora (Output Anchoring)

ADRs têm uma anatomia canônica (Maude/Nygard: Título → Status → Contexto → Decisão → Consequências). Fornecer o esqueleto explícito no prompt elimina variação indesejada entre as 4 saídas, mantendo consistência sem precisar corrigir depois.

## 3. Injeção de contexto rico (Context Stuffing)

O modelo precisa de três camadas de contexto para raciocinar bem: (a) o cenário de negócio — NovaTech, volume de 320 chamados/dia, Teams; (b) as opções técnicas em disputa — isso evita que o modelo invente alternativas que você não pediu; (c) os critérios de decisão — custo, janela de contexto, alucinação, integração Azure. Sem isso, o modelo escolhe os critérios por conta própria, que pode não ser o que você quer.

## 4. Cadeia de raciocínio explícita (Chain-of-Thought)

Pedir que o modelo mostre o raciocínio em cada seção antes de concluir melhora a qualidade da decisão final. Em ADRs isso é essencial — o valor não está só na decisão, mas na justificativa auditável.

## 5. Restrições negativas (Negative Constraints)

Especificar o que não fazer (não inventar alternativas fora das listadas, não usar linguagem corporativa vazia, não omitir trade-offs negativos) é tão importante quanto o que fazer. Modelos tendem a suavizar os cons — a restrição explícita força honestidade técnica.

## 6. Few-shot implícito via terminologia

Usar termos precisos como "consequências positivas e negativas", "riscos residuais", "critérios de aceitação" sinaliza o nível de sofisticação esperado sem precisar de um exemplo completo.


# Diagrama da estrutura do prompt

## 1. Papel e tom (Role prompting)
Arquiteto sênior;
Registro técnico;
Decisão auditável;

## 2. Contexto do sistema (Context stuffing - camada de negócio)
NovaTech · RAG · Teams · 320 req/dia · stack Azure;
Restrições não-funcionais: latência, custo, alucinação;


## 3. Especificação da decisão (Chain-of-thought + context stuffing - camada técnica)
Título · alternativas explícitas · critérios de avaliação
Forçar raciocínio: "avalie cada alternativa contra os critérios"
— substituído pelo conteúdo de cada ADR —

## 4. Esqueleto de saída (Output anchoring - estrutura Nygard)
- Contexto → Decisão → Alternativas consideradas;
- Consequências (pros, contras, riscos residuais);
- Critérios de aceitação;
- Formato: Markdown · tom: direto, sem adjetivos corporativos

## 5. Restrições negativas (Negative constraints)
Não inventar alternativas · não omitir trade-offs negativos
Não usar linguagem vaga · não recomendar sem justificar


___


# Modelo de Prompt
Você é um arquiteto de software sênior documentando decisões técnicas em formato 
ADR para um projeto de pipeline RAG corporativo.

## Contexto do sistema

- **Produto**: bot de suporte interno no Microsoft Teams (NovaTech, logística)
- **Pipeline**: RAG sobre documentação interna (~800 docs SharePoint + ~400 Confluence
  + planilhas mensais)
- **Volume**: 320 chamados/dia, ~60% com consulta a documentos
- **Stack**: Azure (Microsoft 365 E3 + Azure AI Services já disponíveis), C#/.NET
- **Prazo**: 3 meses (discovery + desenvolvimento + go-live)
- **Meta de negócio**: reduzir busca por chamado de 12 min para menos de 2 min

**Input do desenvolvedor:**
Base estimada em ~12M tokens. PDFs com tabelas complexas são o maior desafio para
extração. Documentos escaneados (~15% da base) precisarão de OCR. Documentos
contraditórios identificados em ao menos 3 procedimentos. Recomendação de chunking
por seção com overlap de 10%.

**Requisitos do Product Specialist:**
Respostas devem citar fonte. Documentos contraditórios devem mostrar ambas as versões
com indicação de data. Atualização máxima de 24h após publicação de novo documento.
O assistente nunca deve inventar informações.

---

## Decisão a documentar

[PREENCHER com o texto da decisão]

---

## Tarefa

Gere o conteúdo completo do arquivo `deliverables/[adr-XXXX-titulo-em-kebab-case].md`
com o seguinte formato interno:

---

# ADR-XXXX — [Título curto]

**Status**: Proposto

## Contexto

Qual problema estamos resolvendo? Que forças técnicas e de negócio atuam?
Referencie os inputs do desenvolvedor e do Product Specialist quando relevantes.

## Decisão

Declare a alternativa escolhida em uma frase. Em seguida, justifique em 3–5 bullets
por que ela supera as outras neste contexto específico — não em geral.

## Consequências

- **Positivas**: o que melhora ou simplifica
- **Negativas**: o que piora, complica ou gera débito técnico
- **Riscos residuais**: o que pode dar errado mesmo com essa decisão

## Alternativas consideradas

Para cada alternativa listada no enunciado:

**[Nome da alternativa]**
- Prós: (concretos)
- Contras: (concretos — não omita os negativos mesmo de boas opções)
- Por que não foi escolhida neste contexto: (1–2 frases diretas)

---

## Regras

- Português, tom técnico direto
- Não use adjetivos sem dados que os justifiquem ("robusto", "escalável")
- Não invente alternativas além das listadas no enunciado
- Não omita contras de nenhuma alternativa, incluindo a escolhida
- O arquivo deve ser autossuficiente — legível sem contexto externo
- Entregue apenas o conteúdo do arquivo, sem explicações adicionais