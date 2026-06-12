# ADR-0001 — Escolha do modelo de LLM para o pipeline RAG

**Status**: Aceito

> Revisado em 2026-06-12 após análise crítica de objeções arquiteturais. A decisão original sobreviveu ao processo; mitigações incorporadas nos Riscos residuais. Nenhuma objeção mudou a escolha do modelo.

## Contexto

O pipeline RAG da NovaTech precisa de um LLM para gerar respostas a chamados de suporte interno, consumindo chunks recuperados de ~1.200 documentos (SharePoint + Confluence + planilhas). O modelo opera como último estágio do pipeline: recebe a pergunta do usuário, os chunks relevantes e instruções de grounding, e retorna a resposta exibida no Teams.

**Forças técnicas que condicionam a escolha:**

- **Volume de tokens**: 320 chamados/dia × 60% com consulta a documentos = ~192 chamadas RAG/dia. Estimando ~5.000 tokens de entrada (prompt de sistema + chunks + pergunta) e ~700 de saída por chamada, o volume mensal é de aproximadamente 33M tokens de entrada e 4M de saída.
- **Janela de contexto**: documentos contraditórios identificados em ao menos 3 procedimentos exigem que múltiplas versões sejam enviadas ao modelo simultaneamente. Chunks com overlap de 10% elevam o tamanho médio de contexto; janelas abaixo de 32K tokens são arriscadas para casos com vários documentos relevantes.
- **Requisito de não alucinar**: o Product Specialist exige citação de fonte obrigatória e proibição de inventar informações. O modelo precisa operar com grounding estrito — o que depende mais de temperatura, prompt e arquitetura RAG do que do modelo em si, mas o modelo deve suportar instrução de grounding sem degradar a qualidade da resposta.
- **Stack existente**: Azure (Microsoft 365 E3 + Azure AI Services) já contratado e em uso. A equipe é C#/.NET. Adicionar um segundo provedor de nuvem ou um vendor fora do ecossistema Microsoft cria overhead de procurement, conformidade (LGPD/GDPR) e revisão de contrato de dados.
- **Prazo**: 3 meses. Integrações que exigem novos contratos ou infraestrutura de GPU reduzem o tempo disponível para desenvolvimento.

## Decisão

Adotar **Azure OpenAI Service com GPT-4o** como modelo de geração do pipeline RAG.

- **Sem novo contrato de dados**: os documentos corporativos já estão no Azure; o Azure OpenAI Service não usa dados dos clientes para treinar modelos e opera dentro da conformidade do Microsoft 365 E3 já assinado. Alternativas fora do ecossistema exigiriam DPA adicional e revisão jurídica.
- **Integração zero-friction com o stack**: SDK oficial para .NET (`Azure.AI.OpenAI`), autenticação via Entra ID (sem gerenciar chaves de API separadas), e billing consolidado na fatura Azure já existente.
- **Janela de contexto de 128K tokens**: suficiente para enviar múltiplos chunks de documentos contraditórios simultaneamente, atendendo o requisito de mostrar ambas as versões com indicação de data.
- **Custo previsível dentro da faixa aceitável**: ao volume estimado (~33M tokens de entrada + ~4M de saída/mês), o custo com GPT-4o fica em torno de R$ 900–1.200/mês (a preços de junho/2026 — validar antes do go-live). Modelos open-source evitariam esse custo, mas exigiriam infraestrutura GPU com capex equivalente ou superior.
- **Azure AI Content Safety disponível nativamente**: o serviço já incluso no Azure AI Services permite adicionar camada de detecção de conteúdo sem engenharia adicional, reduzindo o risco de respostas fora do escopo.

**Pré-condição de arquitetura**: a decisão pressupõe que o GPT-4o esteja disponível com quota suficiente na região **Brasil South**. Essa disponibilidade deve ser verificada junto ao portal Azure e ao time de suporte da Microsoft antes do início do desenvolvimento. Caso indisponível, a alternativa aceita é East US 2 com validação jurídica prévia de conformidade LGPD para dados em trânsito fora do Brasil.

## Consequências

**Positivas:**
- Uma única console de gerenciamento, IAM e billing para toda a stack — sem credenciais extras nem contratos adicionais.
- Suporte a system prompts com instrução de grounding explícita (ex.: "responda apenas com base nos documentos fornecidos") bem documentado e testado em produção por outros clientes Azure.
- Deploy em região Azure Brasil South disponível, mantendo dados em território nacional.

**Negativas:**
- Custo recorrente por token: diferentemente de Ollama, há custo operacional mensal diretamente proporcional ao volume. Picos de uso (campanhas, treinamentos) impactam a fatura imediatamente.
- Dependência de disponibilidade do serviço Azure OpenAI: incidentes na plataforma Azure afetam o bot diretamente. Não há fallback local sem trabalho adicional de engenharia.
- Vendor lock-in: migrar para outro provedor no futuro exige reescrever integrações, renegociar contratos e revalidar conformidade.

**Riscos residuais:**

- GPT-4o pode ainda gerar respostas plausíveis mas incorretas quando os chunks recuperados forem de baixa qualidade (ex.: OCR ruim nos 15% de documentos escaneados). O risco não é eliminado pela escolha do modelo — é mitigado pela qualidade do pipeline de indexação e pelo prompt de grounding.

- **[Mitigação obrigatória — qualidade]** O comportamento de grounding deve ser validado antes do go-live com um golden dataset de ≥50 pares pergunta/resposta baseados em documentos reais da NovaTech, incluindo casos com documentos contraditórios e chunks provenientes de OCR. A ausência desse benchmark deixa o requisito de "não alucinar" sem evidência objetiva de atendimento.

- **[Mitigação obrigatória — versionamento]** A versão do modelo (ex.: `gpt-4o-2024-11-20`) deve ser pinned explicitamente no deployment do Azure OpenAI. O Azure OpenAI depreca versões com aviso de ~6 meses, e cada nova versão pode alterar comportamentos de instrução de grounding. Um processo de revalidação com o golden dataset deve ser executado antes de qualquer upgrade de versão.

- Preços do Azure OpenAI mudam sem aviso prévio; o custo estimado deve ser reavaliado no início de cada trimestre. **[Mitigação adicionada]** Definir um teto orçamentário mensal aceitável para o serviço (sugestão: R$ 2.500/mês) e acionar revisão da arquitetura se o custo real superar esse valor por dois meses consecutivos, considerando a viabilidade de migração para um modelo open-source dedicado no Azure.

- Quota por região pode limitar throughput em picos; provisionar quota com antecedência junto à Microsoft.

- **[Mitigação obrigatória — resiliência]** Implementar circuit breaker na camada de orquestração do pipeline. Em caso de indisponibilidade ou timeout do Azure OpenAI, retornar os chunks recuperados diretamente ao usuário com mensagem explícita de degradação ("sistema operando em modo reduzido — exibindo documentos relevantes sem síntese"). Isso mantém o valor central do sistema sem exigir infraestrutura adicional.

## Alternativas consideradas

**Claude via API (Anthropic)**
- Prós: janela de contexto de 200K tokens (a maior das três opções); taxas de alucinação reportadas como baixas em benchmarks de QA com grounding; SDK Python/TypeScript maduro.
- Contras: dados dos documentos corporativos sairiam do ecossistema Azure e transitariam para servidores da Anthropic, exigindo DPA separado e revisão jurídica — overhead estimado de 3–6 semanas no prazo de 3 meses do projeto; SDK .NET não oficial e menos mantido; billing fora da fatura Azure; sem integração nativa com Entra ID.
- Por que não foi escolhida neste contexto: a stack é 100% Azure/Microsoft e o prazo não absorve a burocracia de um segundo contrato de dados internacional. A vantagem de contexto (200K vs 128K) não justifica o custo de conformidade dado o tamanho médio dos documentos do projeto.

**Modelos open-source via Ollama (ex.: Llama 3, Mistral)**
- Prós: sem custo por token; dados nunca saem da infraestrutura própria; possibilidade de fine-tuning futuro no domínio de logística.
- Contras: exige provisionar e operar VMs com GPU no Azure (ex.: NC-series), com custo de infraestrutura mensal possivelmente superior ao custo de tokens do GPT-4o; latência de inferência tipicamente maior em hardware compartilhado; modelos open-source de 7B–13B parâmetros apresentam desempenho inferior em português técnico e em seguir instruções de grounding estritas; sem SLA gerenciado, a operação do servidor de inferência vira responsabilidade da equipe de 3 meses.
- Por que não foi escolhida neste contexto: o projeto não tem equipe de MLOps nem orçamento de GPU no escopo. O custo total de ownership (infra + operação) supera o custo de tokens do Azure OpenAI dentro do horizonte de 12 meses, e a qualidade em português técnico é inferior sem fine-tuning — que também está fora do escopo. **Nota:** se o volume mensal superar consistentemente o teto orçamentário definido nos Riscos residuais, esta alternativa deve ser reavaliada com dados reais de custo.
