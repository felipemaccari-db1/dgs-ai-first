# PR-0003 — Skill técnica `azure-functions-endpoint` (Domain): autoria + ciclo de teste empírico

**Branch:** nenhuma criada nesta feature — instrução explícita do usuário nesta sessão foi não commitar nada; este documento registra as mudanças como se fosse um PR, mas o working tree permanece com as mudanças não commitadas (ver Checklist).
**Autor:** Tech Lead (Exercício 2.3)
**Status:** Pronto para revisão local

## Objetivo

Escrever a skill Domain `azure-functions-endpoint` (hoje 0 bytes) de forma prescritiva, com regras concretas, exemplos DO/DON'T e anti-padrões, e provar empiricamente — com um agente de codificação isolado, não por leitura própria — que a skill muda o comportamento de geração de código. Definir critérios mensuráveis de "skill madura".

## Mudanças

- `skills/domain/azure-functions-endpoint.md`: skill v1 → v2. v1 cobre contexto, 7 regras prescritivas, 2 exemplos DO/DON'T (registro `app.http` v4; validação Zod de query params) e 4 anti-padrões. v2 adiciona um 3º exemplo DO/DON'T (classes de erro customizadas: lançar + mapear por `instanceof`, não apenas instanciar) e um anti-padrão nomeado, ambos derivados de um gap real encontrado na rodada 1.
- `src/functions/health/{handler.ts,validator.ts,checks.ts}` e `src/shared/errors.ts`: gerados pelo agente isolado na rodada 2 (skill v2) — estado final que fica no working tree. O estado da rodada 1 (skill v1) foi capturado em `evidence/round-1/` antes de ser sobrescrito.
- `tests/unit/health-handler.test.ts`: 4 testes cobrindo checagem rasa (200), `deep=true` saudável vs. com falha simulada (503, valida o mapeamento `instanceof`/log estruturado da Regra 6), e erro de validação Zod (400).
- `.specs/features/azure-functions-endpoint-skill/`: spec, tasks, evidência das duas rodadas (`prompt.txt`, `agent-report.md`, `endpoint.diff`, `build-output.txt` por rodada), análise v1, comparação v1→v2, critérios de skill madura, e `validation.md` (Verifier independente).

## Ferramenta de teste (desvio de plano registrado, não escondido)

GitHub Copilot CLI está instalado mas não autenticado nesta máquina (mesma limitação ambiental documentada em `PR-0001` e `PR-0002`). O ciclo de teste usou um **sub-agente Claude isolado** (Agent tool, sem histórico da conversa, sem acesso a `AGENTS.md`, `docs/`, `.specs/`, `.claude/` ou qualquer skill além da skill-alvo) como substituto — mesma decisão já aprovada nas duas features anteriores, reaplicada sem repetir a pergunta ao usuário.

## Achado real da rodada 1 (não hipotético)

A skill v1 tinha a Regra 6 (classes de erro customizadas) só em prosa, sem exemplo de código — diferente das demais regras. O agente isolado seguiu a letra (criou `DependencyUnavailableError`, a instanciou) mas nunca a lançou nem mapeou por `instanceof`: a decisão de status HTTP continuou vindo de uma variável local, o exato acoplamento que a regra deveria evitar. Isso não teria sido descoberto por revisão de texto da skill — só apareceu no código gerado. A skill v2 fechou esse gap com um exemplo concreto; a rodada 2 confirma a correção (`evidence/comparacao-v1-v2.md`).

## Checklist de validation gates

- [x] `npm run build` (`tsc -p .`) — passa sem erros nas duas rodadas
- [x] `npm test` (`vitest run`) — 9/9 testes (5 pré-existentes de `feedback` + 4 novos de `health`)
- [x] Duas rodadas de evidência real (agente isolado) em `evidence/round-1/` e `evidence/round-2/`, mesmo prompt verbatim
- [x] Análise seguiu/ignorou cobre as 7 regras nas duas rodadas, sem omitir a única não-conformidade (Regra 6, parcial)
- [x] Toda reescrita v1→v2 é rastreável a um achado real da rodada 1 (nenhuma mudança cosmética)
- [x] Critérios de "skill madura" mensuráveis, aplicados à própria skill desta feature (ver `criterios-skill-madura.md`)
- [ ] Commits — deliberadamente não feitos nesta feature (instrução do usuário); ver nota acima

## Como revisar

1. Ler `skills/domain/azure-functions-endpoint.md` isoladamente — checar as 7 regras + 3 exemplos DO/DON'T + anti-padrões.
2. Ler `evidence/round-1/agent-report.md` e `evidence/round-1/endpoint.diff` — confirmar que o agente respeitou o isolamento (não citou `AGENTS.md`/`docs/`/`.specs/`).
3. Ler `evidence/round-1/analise-v1.md` — confirmar que o único gap (Regra 6) é real, com trecho de código citado.
4. Comparar `skills/domain/azure-functions-endpoint.md` (diff da skill) com o gap da análise — confirmar que a reescrita é cirúrgica.
5. Ler `evidence/round-2/endpoint.diff` — confirmar `throw`/`instanceof` de verdade, não outra instanciação solta.
6. Rodar `npm run build && npm test` — confirmar 9/9.
7. Ler `validation.md` (Verifier independente) para o veredito final.
