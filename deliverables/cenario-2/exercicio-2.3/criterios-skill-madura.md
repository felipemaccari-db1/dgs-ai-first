# Critérios de "skill madura" — quando uma skill técnica está pronta para o time

Mensuráveis, não vagos ("quando parecer boa" não é um critério aceitável). Uma skill Domain/Artifact é considerada **madura** quando **todos** os itens abaixo são verdadeiros:

| # | Critério | Como medir |
| --- | --- | --- |
| 1 | **Testada com ≥2 gerações reais** contra um agente de codificação (Copilot real ou um substituto isolado documentado), não só lida por um humano | Contar rodadas em `evidence/round-*/` com prompt+relatório+diff capturados |
| 2 | **≥1 gap real encontrado e corrigido entre rodadas**, com rastreabilidade explícita (qual regra ignorada → qual reescrita → qual evidência de correção) | Existência de uma "análise seguiu/ignorou" (rodada N) e uma "comparação" (rodada N → N+1) citando arquivo:linha |
| 3 | **Toda regra prescritiva tem pelo menos 1 exemplo DO/DON'T em código real**, não apenas prosa — regras só-prosa são o padrão que causou o gap desta própria feature (Regra 6, rodada 1) | Contagem: nº de regras vs. nº de exemplos DO/DON'T na skill; deve ser 1:1 ou justificado quando não for (ex.: regra puramente de processo, sem "shape" de código para ilustrar) |
| 4 | **≥1 anti-padrão documentado tem origem em um erro observado de verdade** (não hipotético), citando a evidência | Anti-padrão cita `evidence/round-N/...` como fonte |
| 5 | **O código gerado na rodada mais recente compila e (quando aplicável) passa em teste automatizado real** | `npm run build && npm test` verde, resultado citado com contagem de testes |
| 6 | **Aprovada em revisão** por pelo menos 1 pessoa além do autor (Tech Lead ou par) — nesta fase local, isso é o Verifier independente (author ≠ verifier) da skill `tlc-spec-driven` | `validation.md` com veredito PASS/gaps, não auto-avaliação do autor |

## Aplicação à skill `azure-functions-endpoint` (esta feature)

| Critério | Atingido? | Evidência |
| --- | --- | --- |
| 1 — ≥2 gerações reais | ✅ Sim | `evidence/round-1/` e `evidence/round-2/`, agente isolado (`a53d183e04306a00f`, `ac80cddedc7cc2f10`), prompt idêntico |
| 2 — gap real corrigido | ✅ Sim | Regra 6 (rodada 1: classe instanciada mas nunca lançada) → skill v2 ganhou exemplo 3 + anti-padrão nomeado → rodada 2: `handler.ts` usa `throw`/`instanceof` de verdade (`evidence/comparacao-v1-v2.md`) |
| 3 — toda regra com DO/DON'T | ⚠️ Parcial | Regras 1, 3/5 e 6 têm exemplo de código; regras 2, 4 e 7 são regras estruturais/negativas ("nunca fazer X") sem um "shape" de código específico a exemplificar — tratamento equivalente ao já aceito em `agents-md-tech-lead/spec.md` (REQ-06) para regras de processo. Não é um gap, é uma categoria diferente de regra. |
| 4 — anti-padrão com origem real | ✅ Sim | "Instanciar uma classe de erro sem nunca lançá-la..." cita `evidence/round-1/analise-v1.md` como origem |
| 5 — build/test verde | ✅ Sim | `npm run build && npm test` → 9/9 testes (`tests/unit/health-handler.test.ts`, 4 novos + 5 pré-existentes), ver `evidence/round-2/build-output.txt` e execução da T7 |
| 6 — revisão por não-autor | ✅ Sim (após esta rodada) | `validation.md` (Verifier independente, ver seção correspondente deste pacote) |

**Veredito: skill `azure-functions-endpoint` v2 é considerada MADURA** ao final deste ciclo — os 6 critérios são satisfeitos (critério 3 com uma exceção categorizada e justificada, não uma omissão).

## Skills são artefatos vivos — o que isso significa na prática

"Madura" não é permanente: se um próximo endpoint gerado com esta skill revelar uma regra nova sendo ignorada (ex.: um segundo tipo de erro custom no mesmo handler, cenário fora do que a rodada 2 testou — ver limitação registrada em `comparacao-v1-v2.md`), a skill volta a ser candidata a v3. O critério de maturidade descreve um **estado observado em uma data**, não uma certificação definitiva. Isso é o oposto do red flag da régua de nota ("skill escrita uma vez como definitiva").
