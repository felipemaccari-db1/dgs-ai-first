# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **documentation and architecture design project** — not a runnable application. It contains Architectural Decision Records (ADRs) and educational exercises for designing an LLM-powered RAG pipeline for NovaTech, a logistics company. All content is written in Portuguese.

There are no build, test, lint, or deploy commands. The entire output is Markdown files.

## Repository Structure

```
deliverables/   # Final ADR artifacts (the main output)
docs/           # Exercise specifications and NovaTech simulation data
```

### `deliverables/`
- `00-adr-base-prompt.md` — Prompt engineering rationale and the master prompt template used to generate ADRs
- `00-adr-base-prompt-devils-advocate.md` — Devil's advocate base prompt for adversarial review
- `adr-XXXX-<title>.md` — Accepted ADRs (four so far)
- `adr-XXXX-objections.md` — Adversarial objections raised during review of each ADR

### `docs/`
- `exercicio-fase-1-entendimento.md` — Comprehensive learning exercises organized by role (DM, Product Specialist, Developer, Tech Lead, QA)
- `anexo-a-documentacao-simulada-novatech.md` — Simulated NovaTech source documents (the RAG corpus)
- `anexo-b-chunks-referencia-rag.md` — Expected RAG chunks and coverage map (pergunta → chunks esperados)
- Individual NovaTech policy/procedure files (`POL-001`, `PROC-042`, `SLA-2024`, `FAQ`) — source documents the pipeline will index

## ADR Format and Workflow

All ADRs follow the Nygard format and are written using the prompt template in `deliverables/00-adr-base-prompt.md`. The workflow is:

1. **Generate** the ADR using the master prompt template (see file for exact structure)
2. **Review** adversarially using the devil's advocate prompt (`00-adr-base-prompt-devils-advocate.md`) → output goes to `adr-XXXX-objections.md`
3. **Update** the ADR with a revision note at the top and change status to `Aceito`
4. **Commit** with message: `docs(adr-XXXX): accept <title> after adversarial review`

ADR filename convention: `deliverables/adr-XXXX-titulo-em-kebab-case.md`

ADR internal structure:
```
# ADR-XXXX — [Título]
**Status**: Aceito
> [Optional revision note]
## Contexto
## Decisão
## Consequências
  - Positivas / Negativas / Riscos residuais
## Alternativas consideradas
```

## System Context (for generating new ADRs)

When producing any ADR or architectural analysis for this project, use this system context:

- **Product**: Internal support bot on Microsoft Teams (NovaTech, logistics)
- **Pipeline**: RAG over ~1,200 internal documents (SharePoint ~800 + Confluence ~400 + Excel ~50)
- **Volume**: 320 support tickets/day, ~60% requiring document lookup (~192 RAG calls/day)
- **Stack**: Azure (Microsoft 365 E3 + Azure AI Services already provisioned), C#/.NET
- **Deadline**: 3-month timeline (discovery + development + go-live)
- **Business goal**: Reduce average ticket search time from 12 min to under 2 min
- **Total indexed data**: ~12M tokens; ~15% of docs require OCR; contradictions found in ≥3 procedures

## Accepted Decisions Summary

| ADR | Decision |
|-----|----------|
| ADR-0001 | Azure OpenAI Service with GPT-4o (128K context, pinned version, golden dataset validation required) |
| ADR-0002 | Dynamic context management: 8K token ceiling, 12-chunk max, 3 turns intact, summarization after 5+ turns, Redis TTL 4h |
| ADR-0003 | Index both contradictory document versions with vigency metadata; inject conditional prompt only when contradiction detected; 5-day SLA for resolution |
| ADR-0004 | Azure AI Search + Azure OpenAI (managed) over LangChain/ChromaDB (open-source); native SharePoint connector, custom Confluence connector, Azure AI Document Intelligence for OCR |

## Key Architectural Principles Established

- **Context is a constrained resource**: every token allocation is explicit — system prompt, chunks, history, metadata each have a budget
- **Contradictions are a data problem, not a model problem**: don't filter at generation time; surface both versions with dates
- **Retrieval is deterministic; generation is probabilistic**: quality depends more on indexing, chunking, and retrieval than on the model
- **Lost-in-the-middle effect is real**: chunk ordering within context matters; most important content goes first or last
- **Grounding must be verifiable**: a golden dataset of ≥50 Q&A pairs (including contradictory docs and OCR-sourced chunks) is a mandatory pre-go-live gate
