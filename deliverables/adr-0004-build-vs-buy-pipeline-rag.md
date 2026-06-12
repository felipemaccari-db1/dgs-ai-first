# ADR-0004 — Build vs Buy para o pipeline de RAG

**Status**: Aceito

## Contexto

O pipeline RAG da NovaTech precisa ingerir ~1.200 documentos (SharePoint + Confluence + planilhas mensais), indexá-los para busca semântica e servir ~192 consultas RAG/dia ao bot de suporte no Teams. A decisão central é se esse pipeline será construído com frameworks open-source (LangChain/LlamaIndex + ChromaDB/FAISS) ou montado com serviços gerenciados Azure (Azure AI Search + Azure OpenAI).

**Forças técnicas que condicionam a escolha:**

- **Complexidade de ingestão**: ~15% dos documentos são escaneados e requerem OCR; PDFs com tabelas complexas exigem extração estruturada — ambos os casos demandam estágios especializados de pré-processamento antes de qualquer indexação.
- **Fontes heterogêneas**: SharePoint (M365 E3), Confluence e planilhas exigem conectores de leitura e mapeamento de metadados. O Azure AI Search possui conector nativo apenas para SharePoint Online — o conector para Confluence exige implementação customizada via REST API do Confluence. Planilhas Excel requerem pré-processamento adicional para preservar contexto estrutural (ver Riscos residuais).
- **Requisito de atualização em 24h**: novos documentos publicados precisam estar disponíveis para consulta no máximo 24 horas depois — o que exige pipeline de reindexação incremental confiável, não um processo manual.
- **Stack existente**: Azure (M365 E3 + Azure AI Services) já contratado. A equipe é C#/.NET. Adicionar dependências Python em produção (LangChain, LlamaIndex e seus ecossistemas são primariamente Python) introduz overhead de runtime, containerização e manutenção poliglota.
- **Prazo de 3 meses**: o tempo disponível cobre discovery, desenvolvimento e go-live. Infraestrutura de vector store auto-hospedada (ChromaDB/FAISS) requer provisioning, monitoramento, backup e tuning — tarefas que consomem parcela significativa do prazo sem entregar valor de negócio diretamente.
- **Ausência de equipe MLOps**: não há time dedicado para operar infraestrutura de ML. Serviços gerenciados transferem a carga operacional para o vendor.

**Requisitos do Product Specialist que impactam a escolha:**

- Citação de fonte obrigatória em toda resposta — requer que o pipeline preserve e propague metadados de origem do chunk até a resposta final.
- Documentos contraditórios devem exibir ambas as versões com data — requer que o retrieval retorne múltiplos documentos com metadados de versão intactos.
- Atualização máxima de 24h após publicação — requer trigger de reindexação automática, não periódica manual.

## Decisão

Adotar **Azure AI Search + Azure OpenAI como plataforma gerenciada para o pipeline RAG**, sem frameworks open-source de orquestração em produção, com as seguintes precisões sobre o escopo de integração:

- **OCR e extração de documentos sem engenharia adicional**: Azure AI Document Intelligence (incluído no Azure AI Services já contratado) processa PDFs escaneados e tabelas complexas com extração estruturada pronta para uso — elimina a necessidade de construir e manter um estágio de pré-processamento customizado para os ~15% de documentos escaneados e os PDFs com tabelas.
- **Conector nativo para SharePoint, conector customizado para Confluence**: Azure AI Search possui indexador built-in para SharePoint Online, configurável com schedule de polling a cada 15–30 minutos e atendendo o requisito de atualização em 24h. O Confluence **não tem conector nativo** no Azure AI Search — a equipe precisará implementar um conector customizado via REST API do Confluence que consuma a API de conteúdo (`/rest/api/content`), mapeie metadados (título, URL, data de modificação, espaço) e alimente o Azure AI Search via push API. Esse esforço deve ser incluído explicitamente no planejamento do sprint de ingestão.
- **Metadados de origem preservados nativamente**: Azure AI Search mantém campos de metadados (título, URL, data de modificação) por documento, permitindo que a camada de geração cite a fonte e compare versões de documentos contraditórios com base em data — requisito do Product Specialist atendido pela plataforma, não por lógica customizada.
- **Zero overhead de stack Python em produção**: a SDK `Azure.Search.Documents` para .NET é oficial, mantida pela Microsoft e tem parity funcional com a versão Python. A equipe C#/.NET não precisa introduzir um segundo runtime nem gerenciar dependências transitivas de frameworks Python.
- **Operação sem MLOps**: Azure AI Search, Azure AI Document Intelligence e Azure OpenAI são PaaS — SLA gerenciado, scaling automático, backups, patches e atualizações são responsabilidade da Microsoft. A equipe opera configuração e monitoramento, não infraestrutura.
- **Interfaces de abstração obrigatórias**: o código de integração deve expor `ISearchRepository` e `ICompletionClient` como interfaces sobre Azure AI Search e Azure OpenAI respectivamente. Isso não afeta o prazo materialmente e reduz o custo de migração futura de "reescrever o sistema" para "implementar uma nova classe".

## Consequências

**Positivas:**
- Tempo de desenvolvimento do pipeline de ingestão estimado 40–60% menor que a alternativa open-source para as fontes com cobertura nativa (SharePoint + PDFs): conectores, OCR e chunking são configuração, não código.
- Billing consolidado na fatura Azure existente; sem novos contratos ou revisões jurídicas.
- Reindexação incremental automática via indexadores do Azure AI Search atende o SLA de 24h para SharePoint sem job scheduler customizado.
- Suporte nativo a filtros por metadados no retrieval — permite filtrar por fonte, data ou área no momento da busca sem pós-processamento.

**Negativas:**
- Custo recorrente por serviço: Azure AI Search (tier Standard S1 para ~12M tokens indexados) custa em torno de R$ 1.200–1.800/mês; somado ao custo do Azure OpenAI (estimado em ADR-0001) e ao Azure AI Document Intelligence (modelado nos Riscos residuais), o custo mensal operacional total fica na faixa de R$ 2.300–3.500/mês. LangChain + ChromaDB teriam custo de infra menor, mas com custo operacional de engenharia mais alto.
- O conector do Confluence precisa ser construído e mantido pela equipe — parcela do prazo de 3 meses é consumida por esse componente customizado, diferentemente do que ocorre com o conector nativo do SharePoint.
- Menor flexibilidade para estratégias de retrieval não convencionais: algoritmos de retrieval híbrido customizado, reranking com modelos próprios ou estratégias de multi-hop são mais difíceis de implementar dentro dos limites da API do Azure AI Search do que em código Python com LlamaIndex.
- Vendor lock-in duplo: o pipeline depende de Azure AI Search para indexação e Azure OpenAI para geração — migrado o risco pela adoção de interfaces de abstração no código (ver Decisão), mas a migração ainda requer reindexação do corpus se o vector store mudar.

**Riscos residuais:**
- A qualidade do chunking automático do Azure AI Search para documentos com tabelas complexas pode ser inferior ao chunking manual com LlamaIndex, que oferece controle granular. Mitigação: validar com amostra de PDFs reais na fase de discovery antes de fixar a estratégia de chunking.
- **Planilhas Excel perdem contexto estrutural no extrator padrão**: o indexador do Azure AI Search para arquivos XLSX concatena células como texto plano, descartando a relação coluna/linha. Para planilhas mensais com dados numéricos, isso degrada a qualidade das respostas. Mitigação: converter planilhas para Markdown estruturado (tabelas) como etapa de pré-processamento antes da indexação, via Azure Function ou custom skill. Validar com exemplos reais das planilhas da NovaTech na fase de discovery.
- **Custo do Azure AI Document Intelligence não está incluído na estimativa original**: o serviço cobra por página analisada (~US$ 0,01/página para o modelo Layout). Para ~180 documentos escaneados com média de 20 páginas, a indexação inicial custa ~US$ 36; reindexações adicionais (ex.: atualização de documentos ou reprocessamento de chunking) somam custo variável. Mitigação: adotar política de reindexação incremental (processar apenas documentos novos ou modificados, não o corpus inteiro) e monitorar o consumo de páginas mensalmente nos primeiros 3 meses de operação.
- Indexadores do SharePoint do Azure AI Search têm limitações documentadas para bibliotecas com mais de 100.000 itens e para permissões de site granulares — validar com a estrutura real do SharePoint da NovaTech.
- Preços dos serviços Azure mudam; o custo estimado deve ser reavaliado trimestralmente e antes do go-live.

## Alternativas consideradas

**LangChain/LlamaIndex + ChromaDB ou FAISS (open-source)**
- Prós: controle total sobre cada estágio do pipeline (chunking, embedding, retrieval, reranking); custo de infraestrutura de vector store mais baixo para o volume do projeto (~12M tokens cabem confortavelmente em FAISS em memória ou ChromaDB em uma VM pequena); ecossistema rico de integrações e estratégias de retrieval documentadas; conector para Confluence via biblioteca `atlassian-python-api` com maturidade estabelecida.
- Contras: LangChain e LlamaIndex são primariamente Python — introduzem um segundo runtime em uma equipe C#/.NET; ChromaDB/FAISS em produção requerem provisioning, backup, monitoramento e gestão de versão de índice que consomem tempo de engenharia; OCR para documentos escaneados exigiria integrar Tesseract ou serviço externo manualmente; não há SLA gerenciado — incidentes são responsabilidade da equipe.
- Por que não foi escolhida neste contexto: o prazo de 3 meses e a ausência de equipe MLOps tornam a operação de infraestrutura open-source inviável sem sacrificar escopo funcional. A flexibilidade adicional não é necessária para os requisitos atuais do projeto, e o custo de engenharia para construir e manter o que os serviços Azure já entregam prontos supera o custo operacional dos serviços gerenciados dentro do horizonte do projeto. Nota: a vantagem do conector Python para Confluence não compensa o custo total da alternativa open-source dado o contexto.
