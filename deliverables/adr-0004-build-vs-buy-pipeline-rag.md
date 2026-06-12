# ADR-0004 — Build vs Buy para o pipeline de RAG

**Status**: Proposto

## Contexto

O pipeline RAG da NovaTech precisa ingerir ~1.200 documentos (SharePoint + Confluence + planilhas mensais), indexá-los para busca semântica e servir ~192 consultas RAG/dia ao bot de suporte no Teams. A decisão central é se esse pipeline será construído com frameworks open-source (LangChain/LlamaIndex + ChromaDB/FAISS) ou montado com serviços gerenciados Azure (Azure AI Search + Azure OpenAI).

**Forças técnicas que condicionam a escolha:**

- **Complexidade de ingestão**: ~15% dos documentos são escaneados e requerem OCR; PDFs com tabelas complexas exigem extração estruturada — ambos os casos demandam estágios especializados de pré-processamento antes de qualquer indexação.
- **Fontes heterogêneas**: SharePoint (M365 E3), Confluence e planilhas exigem conectores de leitura e mapeamento de metadados; conectores nativos reduzem o volume de código de integração a manter.
- **Requisito de atualização em 24h**: novos documentos publicados precisam estar disponíveis para consulta no máximo 24 horas depois — o que exige pipeline de reindexação incremental confiável, não um processo manual.
- **Stack existente**: Azure (M365 E3 + Azure AI Services) já contratado. A equipe é C#/.NET. Adicionar dependências Python em produção (LangChain, LlamaIndex e seus ecossistemas são primariamente Python) introduz overhead de runtime, containerização e manutenção poliglota.
- **Prazo de 3 meses**: o tempo disponível cobre discovery, desenvolvimento e go-live. Infraestrutura de vector store auto-hospedada (ChromaDB/FAISS) requer provisioning, monitoramento, backup e tuning — tarefas que consomem parcela significativa do prazo sem entregar valor de negócio diretamente.
- **Ausência de equipe MLOps**: não há time dedicado para operar infraestrutura de ML. Serviços gerenciados transferem a carga operacional para o vendor.

**Requisitos do Product Specialist que impactam a escolha:**

- Citação de fonte obrigatória em toda resposta — requer que o pipeline preserve e propague metadados de origem do chunk até a resposta final.
- Documentos contraditórios devem exibir ambas as versões com data — requer que o retrieval retorne múltiplos documentos com metadados de versão intactos.
- Atualização máxima de 24h após publicação — requer trigger de reindexação automática, não periódica manual.

## Decisão

Adotar **Azure AI Search + Azure OpenAI como plataforma gerenciada para o pipeline RAG**, sem frameworks open-source de orquestração em produção.

- **OCR e extração de documentos sem engenharia adicional**: Azure AI Document Intelligence (incluído no Azure AI Services já contratado) processa PDFs escaneados e tabelas complexas com extração estruturada pronta para uso — elimina a necessidade de construir e manter um estágio de pré-processamento customizado para os ~15% de documentos escaneados e os PDFs com tabelas.
- **Conectores nativos para SharePoint e reindexação automática**: Azure AI Search possui indexadores built-in para SharePoint Online e pode ser configurado com schedule de polling a cada 15–30 minutos, atendendo o requisito de atualização em 24h sem código adicional.
- **Metadados de origem preservados nativamente**: Azure AI Search mantém campos de metadados (título, URL, data de modificação) por documento, permitindo que a camada de geração cite a fonte e compare versões de documentos contraditórios com base em data — requisito do Product Specialist atendido pela plataforma, não por lógica customizada.
- **Zero overhead de stack Python em produção**: a SDK `Azure.Search.Documents` para .NET é oficial, mantida pela Microsoft e tem parity funcional com a versão Python. A equipe C#/.NET não precisa introduzir um segundo runtime nem gerenciar dependências transitivasde frameworks Python.
- **Operação sem MLOps**: Azure AI Search, Azure AI Document Intelligence e Azure OpenAI são PaaS — SLA gerenciado, scaling automático, backups, patches e atualizações são responsabilidade da Microsoft. A equipe opera configuração e monitoramento, não infraestrutura.

## Consequências

**Positivas:**
- Tempo de desenvolvimento do pipeline de ingestão estimado 40–60% menor que a alternativa open-source: conectores, OCR e chunking são configuração, não código.
- Billing consolidado na fatura Azure existente; sem novos contratos ou revisões jurídicas.
- Reindexação incremental automática via indexadores do Azure AI Search atende o SLA de 24h sem job scheduler customizado.
- Suporte nativo a filtros por metadados no retrieval — permite filtrar por fonte, data ou área no momento da busca sem pós-processamento.

**Negativas:**
- Custo recorrente por serviço: Azure AI Search (tier Standard S1 para ~12M tokens indexados) custa em torno de R$ 1.200–1.800/mês; somado ao custo do Azure OpenAI (estimado em ADR-0001), o custo mensal operacional total fica na faixa de R$ 2.100–3.000/mês. LangChain + ChromaDB teriam custo de infra menor, mas com custo operacional de engenharia mais alto.
- Menor flexibilidade para estratégias de retrieval não convencionais: algoritmos de retrieval híbrido customizado, reranking com modelos próprios ou estratégias de multi-hop são mais difíceis de implementar dentro dos limites da API do Azure AI Search do que em código Python com LlamaIndex.
- Vendor lock-in duplo: o pipeline depende de Azure AI Search para indexação e Azure OpenAI para geração — migrar qualquer um dos dois exige reescrever integrações e reindexar o corpus.

**Riscos residuais:**
- A qualidade do chunking automático do Azure AI Search para documentos com tabelas complexas pode ser inferior ao chunking manual com LlamaIndex, que oferece controle granular. Mitigação: validar com amostra de PDFs reais na fase de discovery antes de fixar a estratégia de chunking.
- Indexadores do SharePoint do Azure AI Search têm limitações documentadas para bibliotecas com mais de 100.000 itens e para permissões de site granulares — validar com a estrutura real do SharePoint da NovaTech.
- Preços dos serviços Azure mudam; o custo estimado deve ser reavaliado trimestralmente e antes do go-live.

## Alternativas consideradas

**LangChain/LlamaIndex + ChromaDB ou FAISS (open-source)**
- Prós: controle total sobre cada estágio do pipeline (chunking, embedding, retrieval, reranking); custo de infraestrutura de vector store mais baixo para o volume do projeto (~12M tokens cabem confortavelmente em FAISS em memória ou ChromaDB em uma VM pequena); ecossistema rico de integrações e estratégias de retrieval documentadas.
- Contras: LangChain e LlamaIndex são primariamente Python — introduzem um segundo runtime em uma equipe C#/.NET; ChromaDB/FAISS em produção requerem provisioning, backup, monitoramento e gestão de versão de índice que consomem tempo de engenharia; OCR para documentos escaneados exigiria integrar Tesseract ou serviço externo manualmente; conectores para SharePoint e Confluence precisariam ser construídos ou mantidos via bibliotecas de terceiros; não há SLA gerenciado — incidentes são responsabilidade da equipe.
- Por que não foi escolhida neste contexto: o prazo de 3 meses e a ausência de equipe MLOps tornam a operação de infraestrutura open-source inviável sem sacrificar escopo funcional. A flexibilidade adicional não é necessária para os requisitos atuais do projeto, e o custo de engenharia para construir e manter o que os serviços Azure já entregam prontos supera o custo operacional dos serviços gerenciados dentro do horizonte do projeto.
