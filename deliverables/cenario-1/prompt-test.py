"""
Script de teste automatizado de prompts — NovaTech RAG Assistant
Exercício 1.2 Tech Lead — Prompt Engineering como Artefato de Arquitetura

Este script demonstra o conceito de enforcement determinístico pós-geração.
Não requer dependências externas além da stdlib do Python 3.

Uso:
    python prompt-test.py

Para testar com respostas reais do LLM, substitua os valores em SAMPLE_RESPONSES
pelas respostas obtidas ao colar os prompts no Claude ou no Azure OpenAI.
"""

from __future__ import annotations
import re
import sys
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Definição dos casos de teste
# ---------------------------------------------------------------------------

@dataclass
class Check:
    name: str
    description: str

@dataclass
class TestCase:
    id: str
    question: str
    context_chunks: list[str]
    checks: list[Check]
    trap: str = ""  # armadilha de alucinação que este caso detecta, se houver


TIERS_INVALIDOS = ["Platinum", "Diamond", "Bronze", "Premium", "VIP"]
TIERS_VALIDOS = ["Gold", "Silver", "Standard"]
FONTE_PATTERN = re.compile(r"\[FONTE:", re.IGNORECASE)
PORTUGUES_STOPWORDS = {
    "não", "para", "que", "com", "uma", "dos", "das", "por", "são", "está",
    "de", "da", "do", "em", "ao", "os", "as", "ou", "se", "na", "no",
    "após", "desta", "estão", "excluídas", "recomendo", "escalar",
}


TEST_CASES: list[TestCase] = [
    TestCase(
        id="TC-01",
        question="Qual o prazo de devolução?",
        context_chunks=[
            "POL-001, seção 3.2: Mercadorias podem ser devolvidas em até 7 dias úteis "
            "após o recebimento, exceto cargas classificadas como perigosas (classes 1 a 6 da ANTT).",
        ],
        checks=[
            Check("cita_fonte", "Resposta deve conter [FONTE:"),
            Check("menciona_prazo", "Resposta deve mencionar '7 dias'"),
            Check("idioma_portugues", "Resposta deve estar em português"),
        ],
    ),
    TestCase(
        id="TC-02",
        question="Posso devolver carga perigosa?",
        context_chunks=[
            "POL-001, seção 3.2: Mercadorias podem ser devolvidas em até 7 dias úteis "
            "após o recebimento, exceto cargas classificadas como perigosas (classes 1 a 6 da ANTT). "
            "O cliente deve abrir chamado no portal e anexar fotos da mercadoria.",
        ],
        checks=[
            Check("cita_fonte", "Resposta deve conter [FONTE:"),
            Check("nega_devolucao_perigosa", "Resposta NÃO deve confirmar devolução de carga perigosa"),
            Check("idioma_portugues", "Resposta deve estar em português"),
        ],
        trap="Inversão de regra: a exceção (carga perigosa NÃO pode ser devolvida) "
             "é frequentemente confundida com a regra geral pelo modelo.",
    ),
    TestCase(
        id="TC-03",
        question="Qual o SLA do cliente Gold?",
        context_chunks=[
            "SLA-2024: Tabela de SLA por tipo de cliente. "
            "Gold: resposta em até 2h, resolução em até 24h. "
            "Silver: resposta em até 4h, resolução em até 48h. "
            "Standard: resposta em até 8h, resolução em até 72h.",
        ],
        checks=[
            Check("cita_fonte", "Resposta deve conter [FONTE:"),
            Check("menciona_2h", "Resposta deve mencionar prazo de resposta '2h'"),
            Check("menciona_24h", "Resposta deve mencionar prazo de resolução '24h'"),
            Check("idioma_portugues", "Resposta deve estar em português"),
        ],
    ),
    TestCase(
        id="TC-04",
        question="Qual o SLA do cliente Platinum?",
        context_chunks=[
            "SLA-2024: Tabela de SLA por tipo de cliente. Tiers existentes: Gold, Silver, Standard. "
            "Gold: resposta em até 2h, resolução em até 24h. "
            "Silver: resposta em até 4h, resolução em até 48h. "
            "Standard: resposta em até 8h, resolução em até 72h.",
        ],
        checks=[
            Check("sem_tier_invalido", "Resposta NÃO deve confirmar existência do tier Platinum"),
            Check("cita_fonte", "Resposta deve conter [FONTE:"),
            Check("indica_tier_inexistente", "Resposta deve indicar que o tier não existe"),
            Check("idioma_portugues", "Resposta deve estar em português"),
        ],
        trap="Alucinação de tier: 'Platinum' não existe. Modelos tendem a inventar "
             "SLAs plausíveis (ex: 1h/12h) para tiers desconhecidos.",
    ),
    TestCase(
        id="TC-05",
        question="Quanto custa o frete para 600kg para Manaus?",
        context_chunks=[
            "PROC-042-v2, seção 2: Frete especial para cargas acima de 500kg: "
            "valor base × multiplicador regional. "
            "Região Norte: 1.8. Região Sul: 1.3. Região Sudeste: 1.1. "
            "Região Nordeste: 1.5. Região Centro-Oeste: 1.4.",
        ],
        checks=[
            Check("cita_fonte", "Resposta deve conter [FONTE:"),
            Check("menciona_multiplicador_norte", "Resposta deve mencionar multiplicador 1.8 (Região Norte)"),
            Check("cita_v2", "Resposta deve citar PROC-042-v2, não a versão antiga"),
            Check("idioma_portugues", "Resposta deve estar em português"),
        ],
    ),
    TestCase(
        id="TC-06",
        question="Qual o frete para 300kg para Salvador?",
        context_chunks=[
            "PROC-042-v2, seção 2: Frete especial para cargas acima de 500kg: "
            "valor base × multiplicador regional. [Tabela de multiplicadores por região]",
        ],
        checks=[
            Check("indica_sem_resposta", "Resposta deve indicar que não encontrou a informação"),
            Check("sem_valor_inventado", "Resposta NÃO deve inventar um multiplicador ou valor"),
            Check("idioma_portugues", "Resposta deve estar em português"),
        ],
        trap="Ausência de cobertura: frete abaixo de 500kg não está documentado. "
             "Modelos tendem a extrapolar e aplicar o multiplicador incorretamente.",
    ),
]


# ---------------------------------------------------------------------------
# Avaliadores determinísticos
# ---------------------------------------------------------------------------

def check_cita_fonte(response: str) -> tuple[bool, str]:
    ok = bool(FONTE_PATTERN.search(response))
    return ok, "" if ok else "Padrão [FONTE: não encontrado na resposta"

def check_idioma_portugues(response: str) -> tuple[bool, str]:
    words = set(response.lower().split())
    matches = words & PORTUGUES_STOPWORDS
    ok = len(matches) >= 2
    return ok, "" if ok else f"Poucas palavras em português encontradas: {matches}"

def check_menciona_prazo(response: str) -> tuple[bool, str]:
    ok = "7 dia" in response.lower()
    return ok, "" if ok else "'7 dias' não encontrado na resposta"

def check_nega_devolucao_perigosa(response: str) -> tuple[bool, str]:
    lower = response.lower()
    afirmacoes_erradas = [
        "carga perigosa pode", "cargas perigosas podem", "sim, pode devolver",
        "é possível devolver carga perigosa", "pode ser devolvida",
    ]
    found = [s for s in afirmacoes_erradas if s in lower]
    ok = len(found) == 0
    return ok, "" if ok else f"Resposta contém afirmação incorreta: {found}"

def check_menciona_2h(response: str) -> tuple[bool, str]:
    ok = "2h" in response or "2 hora" in response.lower()
    return ok, "" if ok else "Prazo de resposta '2h' não encontrado"

def check_menciona_24h(response: str) -> tuple[bool, str]:
    ok = "24h" in response or "24 hora" in response.lower()
    return ok, "" if ok else "Prazo de resolução '24h' não encontrado"

def check_sem_tier_invalido(response: str) -> tuple[bool, str]:
    # Detecta se a resposta *confirma* um tier inválido — não apenas o menciona.
    # Ex: "Platinum tem SLA de 1h" é falha; "Platinum não existe" é correto.
    lower = response.lower()
    confirmacoes = [
        r"platinum\s+(tem|possui|é|e\s|:)",
        r"diamond\s+(tem|possui|é|e\s|:)",
        r"sla\s+(do|para o?)\s+platinum",
        r"platinum.*resposta em",
        r"platinum.*resolução em",
    ]
    found = [p for p in confirmacoes if re.search(p, lower)]
    ok = len(found) == 0
    return ok, "" if ok else f"Resposta confirma tier inválido: padrões detectados: {found}"

def check_indica_tier_inexistente(response: str) -> tuple[bool, str]:
    lower = response.lower()
    indicadores = [
        "não existe", "nao existe", "não encontrado", "nao encontrado",
        "não há", "nao ha", "não consta", "nao consta",
    ]
    ok = any(ind in lower for ind in indicadores)
    return ok, "" if ok else "Resposta não indica que o tier é inexistente"

def check_menciona_multiplicador_norte(response: str) -> tuple[bool, str]:
    ok = "1.8" in response or "1,8" in response
    return ok, "" if ok else "Multiplicador 1.8 (Região Norte) não encontrado"

def check_cita_v2(response: str) -> tuple[bool, str]:
    lower = response.lower()
    ok = "proc-042-v2" in lower or "proc-042v2" in lower or "042-v2" in lower
    return ok, "" if ok else "Versão correta PROC-042-v2 não citada (pode estar usando versão desatualizada)"

def check_indica_sem_resposta(response: str) -> tuple[bool, str]:
    lower = response.lower()
    indicadores = [
        "não encontrei", "nao encontrei", "não há informação", "nao ha informacao",
        "não está documentado", "não consta", "recomendo escalar",
        "não tenho essa informação",
    ]
    ok = any(ind in lower for ind in indicadores)
    return ok, "" if ok else "Resposta não indica ausência de informação quando deveria"

def check_sem_valor_inventado(response: str) -> tuple[bool, str]:
    multiplicadores_validos = ["1.8", "1.3", "1.1", "1.5", "1.4", "1,8", "1,3", "1,1", "1,5", "1,4"]
    numeros_suspeitos = re.findall(r"\b1[.,]\d\b", response)
    invalidos = [n for n in numeros_suspeitos if n not in multiplicadores_validos]
    ok = len(invalidos) == 0
    return ok, "" if ok else f"Possível valor inventado na resposta: {invalidos}"


EVALUATORS = {
    "cita_fonte": check_cita_fonte,
    "idioma_portugues": check_idioma_portugues,
    "menciona_prazo": check_menciona_prazo,
    "nega_devolucao_perigosa": check_nega_devolucao_perigosa,
    "menciona_2h": check_menciona_2h,
    "menciona_24h": check_menciona_24h,
    "sem_tier_invalido": check_sem_tier_invalido,
    "indica_tier_inexistente": check_indica_tier_inexistente,
    "menciona_multiplicador_norte": check_menciona_multiplicador_norte,
    "cita_v2": check_cita_v2,
    "indica_sem_resposta": check_indica_sem_resposta,
    "sem_valor_inventado": check_sem_valor_inventado,
}


# ---------------------------------------------------------------------------
# Respostas de exemplo
# Substitua pelos valores reais obtidos ao testar o system prompt v2 no Claude.
# ---------------------------------------------------------------------------

SAMPLE_RESPONSES: dict[str, str] = {
    "TC-01": (
        "O prazo de devolução é de 7 dias úteis após o recebimento da mercadoria. "
        "Atenção: cargas perigosas (classes 1 a 6 da ANTT) estão excluídas desta regra. "
        "[FONTE: POL-001, seção 3.2]"
    ),
    "TC-02": (
        "Não. Cargas perigosas (classes 1 a 6 da ANTT) não podem ser devolvidas, "
        "conforme a exceção explícita da política de devoluções. "
        "[FONTE: POL-001, seção 3.2]"
    ),
    "TC-03": (
        "Para clientes Gold, o SLA é: resposta em até 2h e resolução em até 24h. "
        "[FONTE: SLA-2024]"
    ),
    "TC-04": (
        "O tier 'Platinum' não existe na tabela de SLA atual. "
        "Os tiers disponíveis são Gold, Silver e Standard. "
        "Verifique se o cliente está cadastrado em um desses tiers. "
        "[FONTE: SLA-2024]"
    ),
    "TC-05": (
        "Para frete especial de 600kg com destino a Manaus (Região Norte), "
        "o cálculo é: valor base × 1.8. "
        "[FONTE: PROC-042-v2, seção 2]"
    ),
    "TC-06": (
        "Não encontrei essa informação na documentação disponível. "
        "A tabela de frete especial cobre apenas cargas acima de 500kg. "
        "Recomendo escalar para o supervisor ou verificar diretamente com a área Comercial."
    ),
}


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def run_tests(responses: dict[str, str]) -> int:
    total_checks = 0
    failed_checks = 0

    print("=" * 70)
    print("RELATÓRIO DE TESTES — NovaTech RAG Prompt v2")
    print("=" * 70)

    for tc in TEST_CASES:
        response = responses.get(tc.id, "")
        tc_failed = 0

        print(f"\n{tc.id} — {tc.question}")
        if tc.trap:
            print(f"  [ARMADILHA] {tc.trap}")

        if not response:
            print("  [SKIP] Sem resposta fornecida para este caso")
            continue

        for chk in tc.checks:
            evaluator = EVALUATORS.get(chk.name)
            if not evaluator:
                print(f"  [ERRO] Avaliador '{chk.name}' não encontrado")
                continue

            ok, reason = evaluator(response)
            total_checks += 1
            status = "PASS" if ok else "FAIL"
            if not ok:
                failed_checks += 1
                tc_failed += 1
                print(f"  [{status}] {chk.description}")
                print(f"         → {reason}")
            else:
                print(f"  [{status}] {chk.description}")

        if tc_failed == 0:
            print(f"  → Caso aprovado ({len(tc.checks)} checks)")
        else:
            print(f"  → {tc_failed}/{len(tc.checks)} checks falharam")

    print("\n" + "=" * 70)
    passed = total_checks - failed_checks
    print(f"RESULTADO: {passed}/{total_checks} checks passaram")
    if failed_checks == 0:
        print("STATUS: APROVADO")
    else:
        print(f"STATUS: REPROVADO ({failed_checks} falhas)")
    print("=" * 70)

    return failed_checks


if __name__ == "__main__":
    exit_code = run_tests(SAMPLE_RESPONSES)
    sys.exit(0 if exit_code == 0 else 1)
