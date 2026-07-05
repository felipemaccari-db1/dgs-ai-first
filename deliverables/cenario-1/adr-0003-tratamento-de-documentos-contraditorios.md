# ADR-0003 — Tratamento de documentos contraditórios

**Status**: Aceito

## Contexto

O pipeline RAG da NovaTech opera sobre ~1.200 documentos de procedimentos internos de logística. O desenvolvedor identificou versões conflitantes em ao menos 3 procedimentos — situação esperada em bases documentais corporativas onde o ciclo de revisão não é centralizado: um documento é atualizado no SharePoint mas a versão antiga permanece no Confluence, ou dois departamentos mantêm versões divergentes de um mesmo procedimento.

**Forças técnicas e de negócio que tornam isso uma decisão arquitetural:**

- **Requisito explícito do Product Specialist**: documentos contraditórios devem exibir ambas as versões com indicação de data. A resposta não pode silenciosamente escolher uma versão e apresentá-la como verdade única.
- **Requisito de não alucinar**: o assistente nunca deve inventar informações. Delegar a resolução da contradição ao LLM sem dados suficientes (ex.: sem metadado de data de vigência) significa que o modelo pode sintetizar uma resposta plausível que não corresponde a nenhuma das versões reais.
- **Rastreabilidade e auditoria**: respostas devem citar fonte. Se uma versão for descartada silenciosamente no pipeline antes de chegar ao LLM, a citação omitirá informação relevante para o operador que tomará a decisão final.
- **Volume e atualização**: 320 chamados/dia, atualização máxima de 24h após publicação. O pipeline de indexação precisa de uma estratégia consistente para lidar com o estado de múltiplas versões sem exigir intervenção manual a cada atualização.
- **Contexto de uso**: operadores de logística consultam o bot para tomar decisões operacionais (prazos, procedimentos de devolução, SLAs). Uma resposta que apresente a versão errada — mesmo sem alucinação — pode gerar erros operacionais reais.

## Decisão

Manter ambas as versões indexadas com metadados de vigência (`data_publicacao`, `fonte`, `versao`) e recuperá-las como chunks distintos, instruindo o LLM via **prompt dinâmico** a identificar a contradição, exibir ambas as versões com suas respectivas datas e fontes, e recomendar verificação com o responsável pelo documento.

### Critério de identidade de documento entre sistemas

A correspondência de versões conflitantes entre SharePoint e Confluence não pode depender de `doc_id` (namespaced por sistema, sem relação cruzada) nem de título exato (títulos mudam em atualizações). O critério de identidade adotado é hierárquico:

1. **Primário**: `doc_id` dentro do mesmo sistema (detecta versões do mesmo documento no mesmo repositório).
2. **Secundário**: similaridade de título normalizado ≥ 0,85 (Jaccard sobre tokens, após remoção de stopwords e normalização de versão/número) entre documentos de sistemas distintos.
3. **Terciário**: hash de conteúdo parcial sobre as primeiras 512 palavras, usado para validar matches do critério secundário com limiar de similaridade ≥ 0,70.

Matches confirmados pelos critérios 2 e 3 são marcados com flag `contradição_detectada: true` e agrupados sob um `grupo_conflito_id` persistido no índice. Matches pelo critério 2 sem confirmação pelo critério 3 são registrados como `contradição_suspeita` para revisão manual pelo gestor documental.

### Injeção de prompt condicional

As instruções de tratamento de contradição **não fazem parte do system prompt fixo**. Elas são injetadas dinamicamente no contexto da query apenas quando o retriever retorna ao menos um chunk com `contradição_detectada: true`. Queries que não tocam documentos contraditórios recebem o system prompt padrão sem overhead de instrução de conflito. Isso evita que o modelo sinalize incerteza desnecessária em respostas onde não existe contradição real.

### Estratégia de degradação por overflow de tokens

Quando o contexto de uma query com contradição detectada ultrapassa o teto de tokens definido no ADR-0002:

1. **Prioridade 1**: preservar pelo menos um chunk de cada versão conflitante com seus metadados de vigência. Chunks não conflitantes são truncados primeiro.
2. **Prioridade 2**: se mesmo após truncar chunks não conflitantes o contexto ainda exceder o teto, preservar o chunk mais recente de cada grupo conflitante e sinalizar explicitamente na resposta que versões adicionais foram omitidas por limitação de contexto, com referência às fontes omitidas.
3. **Proibido**: truncar silenciosamente uma das versões conflitantes sem aviso ao operador — isso viola o requisito de transparência.

### Inventário de contradições e ciclo de resolução

A lógica de detecção de documentos contraditórios no indexador gera automaticamente um relatório de contradições pendentes. Esse relatório **deve ser exposto ativamente** à equipe de gestão documental da NovaTech com SLA de resolução de 5 dias úteis por contradição detectada. O pipeline não é responsável por resolver a contradição — mas é responsável por garantir que ela não permaneça indefinidamente no índice sem que o responsável humano seja notificado.

### Validação de qualidade de metadados na ingestão

Documentos sem `data_publicacao` preenchida ou com data anterior a 2015 (indicativo de migração sem preenchimento correto) são marcados com flag `metadado_vigencia_ausente: true`. Quando ambas as versões de uma contradição carregam esse flag, a resposta do LLM indica explicitamente que não há base de data para hierarquizar as versões e reforça a recomendação de verificação com o gestor documental. O sistema não deve fingir hierarquia onde não há dado.

**Justificativas da decisão principal:**

- **Atende diretamente ao requisito do Product Specialist**: a instrução "mostrar ambas as versões com indicação de data" só é satisfeita se ambas as versões estiverem disponíveis no contexto enviado ao modelo. Manter apenas a mais recente tornaria esse requisito inatingível por design.
- **Preserva rastreabilidade e citação de fonte**: cada chunk retém seus metadados de origem (SharePoint vs. Confluence, data de publicação, autor da última modificação). O LLM pode citar ambas as fontes na resposta, permitindo que o operador verifique diretamente qual versão é a autoritativa para seu caso.
- **Evita que o LLM resolva uma contradição factual sem base**: delegar a decisão ao LLM sem dados de vigência viola o requisito de não inventar informações — o modelo inferirá qual versão é mais recente ou mais coerente com base em heurísticas linguísticas, não em fatos verificáveis.
- **Compatível com o ciclo de indexação de 24h**: a lógica de detecção de documentos contraditórios pode ser implementada na etapa de pré-processamento do indexador, sem exigir revisão manual a cada atualização.
- **Implementável sem infraestrutura adicional**: os metadados de data e fonte já são extraídos nas APIs do SharePoint (via Microsoft Graph) e do Confluence (via REST API). Não há necessidade de serviço externo de versionamento.

## Consequências

**Positivas**:
- A resposta do bot explicita a contradição ao operador, que pode tomar a decisão com informação completa em vez de agir sobre uma versão escolhida silenciosamente pelo sistema.
- O metadado de vigência (`data_publicacao`) é persistido no índice e disponível para queries de auditoria — é possível rastrear qual versão estava ativa em determinada data.
- O inventário de contradições gerado pelo indexador alimenta um ciclo de resolução com SLA definido, criando pressão para que os documentos conflitantes sejam resolvidos na origem em vez de permanecerem indefinidamente no índice.
- Nenhum dado é descartado permanentemente; versões antigas continuam acessíveis para consultas históricas.
- O prompt condicional garante que queries sem contradição não sofrem overhead de instrução de conflito nem risco de sinalização falsa de incerteza.

**Negativas**:
- Respostas a queries que atingem documentos contraditórios são mais longas e exigem que o operador leia e interprete duas versões — potencialmente aumentando o tempo de resolução nesse subconjunto de chamados.
- O contexto enviado ao LLM é maior quando há contradição detectada (dois chunks em vez de um), consumindo parte do teto de tokens definido no ADR-0002. A estratégia de degradação mitiga isso, mas introduz complexidade adicional no pipeline.
- A lógica de agrupamento de documentos contraditórios no indexador exige manutenção do critério de identidade à medida que os sistemas de origem evoluem (renomeações, reestruturações de repositório).

**Riscos residuais**:
- Se a data de publicação estiver ausente ou incorreta nos metadados da fonte (mitigado pela validação de ingestão e pelo flag `metadado_vigencia_ausente`), a resposta exibirá ambas as versões sem hierarquia — comportamento explícito e rastreável, não silencioso.
- Contradições com divergência sutil (valores numéricos diferentes sem diferença estrutural de texto) podem não ser detectadas pelo critério de identidade hierárquico e o pipeline tratará as versões como documentos independentes. Mitigação parcial: o critério terciário (hash de conteúdo parcial) reduz falsos negativos por similaridade estrutural, mas não elimina o risco para divergências pontuais.
- O critério de identidade secundário (similaridade de título ≥ 0,85) pode gerar falsos positivos em procedimentos com títulos próximos mas conteúdo distinto — mitigado pela exigência de confirmação pelo critério terciário antes de marcar como `contradição_detectada`.
- O SLA de 5 dias úteis para resolução de contradições depende de engajamento da equipe de gestão documental da NovaTech — risco organizacional fora do escopo técnico do pipeline.

## Alternativas consideradas

**Manter apenas a versão mais recente**
- Prós: contexto menor por query; sem necessidade de lógica especial no prompt para lidar com contradições; resposta mais direta ao operador.
- Contras: viola diretamente o requisito do Product Specialist de exibir ambas as versões; em procedimentos com versões divergentes por departamento (não apenas por data), "mais recente" pode não ser critério suficiente — um departamento pode ter atualizado sua versão por razões locais que invalidam a versão global mais recente; versões antigas são descartadas permanentemente do índice, impedindo consultas históricas.
- Por que não foi escolhida neste contexto: o requisito de exibir ambas as versões com data de publicação foi definido explicitamente pelo Product Specialist como não negociável. A alternativa mais simples tecnicamente inviabiliza esse requisito por design.

**Delegar a decisão ao LLM via instrução no prompt (sem metadados de vigência)**
- Prós: nenhuma mudança na lógica de indexação; o modelo raciocina sobre o conteúdo e escolhe ou apresenta a versão mais coerente; flexível para casos onde as versões têm diferenças sutis não detectáveis por metadado.
- Contras: sem data de publicação ou fonte no contexto, o LLM infere qual versão é "mais correta" com base em heurísticas linguísticas — o que constitui invenção de fato, violando o requisito de não alucinar; não há rastreabilidade da decisão (não é possível auditar por que o modelo escolheu uma versão); comportamento não determinístico — a mesma pergunta pode produzir respostas diferentes em execuções distintas dependendo dos chunks recuperados.
- Por que não foi escolhida neste contexto: combina o pior dos dois mundos: não atende o requisito de exibir ambas as versões (a menos que a instrução force isso, mas sem dados de vigência a exibição é superficial) e introduz risco real de violação do requisito de não alucinar. A delegação ao LLM é útil como complemento (formatar e apresentar a contradição), não como árbitro da contradição.

**Prompt dinâmico sem critério de identidade explícito**
- Prós: implementação mais simples; delega a detecção de contradição ao LLM via raciocínio sobre os chunks recuperados.
- Contras: sem marcação de contradição na etapa de indexação, o retriever pode não recuperar ambas as versões (o ranker pode privilegiar uma por relevância semântica); sem `grupo_conflito_id`, não é possível gerar o inventário de contradições para o ciclo de resolução; o LLM pode não detectar contradição em documentos com estrutura similar mas valores distintos.
- Por que não foi escolhida: a detecção de contradição no indexador é o que garante que ambas as versões cheguem ao contexto do LLM — sem esse passo, o prompt dinâmico não tem material para trabalhar.
