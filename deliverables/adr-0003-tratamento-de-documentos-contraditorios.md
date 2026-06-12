# ADR-0003 — Tratamento de documentos contraditórios

**Status**: Proposto

## Contexto

O pipeline RAG da NovaTech opera sobre ~1.200 documentos de procedimentos internos de logística. O desenvolvedor identificou versões conflitantes em ao menos 3 procedimentos — situação esperada em bases documentais corporativas onde o ciclo de revisão não é centralizado: um documento é atualizado no SharePoint mas a versão antiga permanece no Confluence, ou dois departamentos mantêm versões divergentes de um mesmo procedimento.

**Forças técnicas e de negócio que tornam isso uma decisão arquitetural:**

- **Requisito explícito do Product Specialist**: documentos contraditórios devem exibir ambas as versões com indicação de data. A resposta não pode silenciosamente escolher uma versão e apresentá-la como verdade única.
- **Requisito de não alucinar**: o assistente nunca deve inventar informações. Delegar a resolução da contradição ao LLM sem dados suficientes (ex.: sem metadado de data de vigência) significa que o modelo pode sintetizar uma resposta plausível que não corresponde a nenhuma das versões reais.
- **Rastreabilidade e auditoria**: respostas devem citar fonte. Se uma versão for descartada silenciosamente no pipeline antes de chegar ao LLM, a citação omitirá informação relevante para o operador que tomará a decisão final.
- **Volume e atualização**: 320 chamados/dia, atualização máxima de 24h após publicação. O pipeline de indexação precisa de uma estratégia consistente para lidar com o estado de múltiplas versões sem exigir intervenção manual a cada atualização.
- **Contexto de uso**: operadores de logística consultam o bot para tomar decisões operacionais (prazos, procedimentos de devolução, SLAs). Uma resposta que apresente a versão errada — mesmo sem alucinação — pode gerar erros operacionais reais.

## Decisão

Manter ambas as versões indexadas com metadados de vigência (`data_publicacao`, `fonte`, `versao`) e recuperá-las como chunks distintos, instruindo o LLM via prompt a identificar a contradição, exibir ambas as versões com suas respectivas datas e fontes, e recomendar verificação com o responsável pelo documento.

- **Atende diretamente ao requisito do Product Specialist**: a instrução "mostrar ambas as versões com indicação de data" só é satisfeita se ambas as versões estiverem disponíveis no contexto enviado ao modelo. Manter apenas a mais recente tornaria esse requisito inatingível por design.
- **Preserva rastreabilidade e citação de fonte**: cada chunk retém seus metadados de origem (SharePoint vs. Confluence, data de publicação, autor da última modificação). O LLM pode citar ambas as fontes na resposta, permitindo que o operador verifique diretamente qual versão é a autoritativa para seu caso.
- **Evita que o LLM resolva uma contradição factual sem base**: delegar a decisão ao LLM sem dados de vigência viola o requisito de não inventar informações — o modelo inferirá qual versão é mais recente ou mais coerente com base em heurísticas linguísticas, não em fatos verificáveis. Com metadados de data, a instrução de prompt pode ser baseada em evidência, não em inferência.
- **Compatível com o ciclo de indexação de 24h**: a lógica de detecção de documentos contraditórios (mesmo `doc_id` ou mesmo título com `fonte` diferente) pode ser implementada na etapa de pré-processamento do indexador, sem exigir revisão manual a cada atualização.
- **Implementável sem infraestrutura adicional**: os metadados de data e fonte já são extraídos nas APIs do SharePoint (via Microsoft Graph) e do Confluence (via REST API). Não há necessidade de serviço externo de versionamento.

## Consequências

**Positivas**:
- A resposta do bot explicita a contradição ao operador, que pode tomar a decisão com informação completa em vez de agir sobre uma versão escolhida silenciosamente pelo sistema.
- O metadado de vigência (`data_publicacao`) é persistido no índice e disponível para queries de auditoria — é possível rastrear qual versão estava ativa em determinada data.
- A lógica de detecção de contradição no indexador cria um inventário implícito de documentos conflitantes, que pode ser exportado como relatório para a equipe de gestão documental da NovaTech resolver na origem.
- Nenhum dado é descartado permanentemente; versões antigas continuam acessíveis para consultas históricas.

**Negativas**:
- Respostas a queries que atingem documentos contraditórios são mais longas e exigem que o operador leia e interprete duas versões — potencialmente aumentando o tempo de resolução nesse subconjunto de chamados.
- O contexto enviado ao LLM é maior quando há contradição detectada (dois chunks em vez de um), consumindo parte do teto de 8K tokens definido no ADR-0002. Em casos com múltiplas contradições na mesma query, o teto pode ser insuficiente.
- A lógica de agrupamento de documentos contraditórios no indexador precisa de critério explícito de identidade de documento (por `doc_id`, por título normalizado, ou por hash de conteúdo parcial) — critério errado gera falsos positivos (documentos diferentes tratados como contraditórios) ou falsos negativos (versões conflitantes não detectadas).

**Riscos residuais**:
- Se a data de publicação estiver ausente ou incorreta nos metadados da fonte (problema recorrente em bases SharePoint com histórico de migrações), o LLM não terá base para indicar qual versão é mais recente — a resposta exibirá ambas sem hierarquia, o que pode ser percebido como indecisão do sistema pelo operador.
- Documentos contraditórios com divergência sutil (valores numéricos diferentes, não estrutura textual diferente) podem não ser detectados pelo critério de agrupamento baseado em título/`doc_id`, e o pipeline tratará as versões como documentos independentes sem sinalizar a contradição.
- A instrução de prompt para lidar com contradições adiciona complexidade ao system prompt e pode degradar a qualidade das respostas em queries sem contradição se não for implementada com cuidado (ex.: o modelo pode passar a sinalizar incerteza desnecessariamente em documentos sem conflito).

## Alternativas consideradas

**Manter apenas a versão mais recente**
- Prós: contexto menor por query; sem necessidade de lógica especial no prompt para lidar com contradições; resposta mais direta ao operador.
- Contras: viola diretamente o requisito do Product Specialist de exibir ambas as versões; em procedimentos com versões divergentes por departamento (não apenas por data), "mais recente" pode não ser critério suficiente — um departamento pode ter atualizado sua versão por razões locais que invalidam a versão global mais recente; versões antigas são descartadas permanentemente do índice, impedindo consultas históricas.
- Por que não foi escolhida neste contexto: o requisito de exibir ambas as versões com data de publicação foi definido explicitamente pelo Product Specialist como não negociável. A alternativa mais simples tecnicamente inviabiliza esse requisito por design.

**Delegar a decisão ao LLM via instrução no prompt (sem metadados de vigência)**
- Prós: nenhuma mudança na lógica de indexação; o modelo raciocina sobre o conteúdo e escolhe ou apresenta a versão mais coerente; flexível para casos onde as versões têm diferenças sutis não detectáveis por metadado.
- Contras: sem data de publicação ou fonte no contexto, o LLM infere qual versão é "mais correta" com base em heurísticas linguísticas — o que constitui invenção de fato, violando o requisito de não alucinar; não há rastreabilidade da decisão (não é possível auditar por que o modelo escolheu uma versão); comportamento não determinístico — a mesma pergunta pode produzir respostas diferentes em execuções distintas dependendo dos chunks recuperados.
- Por que não foi escolhida neste contexto: combina o pior dos dois mundos: não atende o requisito de exibir ambas as versões (a menos que a instrução force isso, mas sem dados de vigência a exibição é superficial) e introduz risco real de violação do requisito de não alucinar. A delegação ao LLM é útil como complemento (formatar e apresentar a contradição), não como árbitro da contradição.
