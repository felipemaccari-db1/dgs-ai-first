# MCP Architecture — Validation

**Date**: 2026-07-05
**Spec**: `.specs/features/mcp-architecture/spec.md`
**Diff range**: `162b435..88bb93a` (branch `feature/mcp-architecture`, branched from `feature/agents-md-tech-lead`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

No `tasks.md` exists for this feature (Design → Execute apparently ran without a formalized task-breakdown file). This is a process gap relative to the skill's normal Specify→Design→Tasks→Execute flow, but it is not fatal: the 8 commits on the branch (`44ca890` Specify → `8c50743` Design → `c9ee257`/`7dc7ae1` config → `a5feb76`/`31196cd` script+evidence → `d3fefd5` runbook → `88bb93a` doc close-out + PR) map 1:1 onto the spec's 5 requirements, so completion is checked directly against `spec.md` ACs below rather than against a task list that doesn't exist.

| Deliverable | Status | Notes |
| --- | --- | --- |
| `.mcp/mcp.json` populated | ✅ Done | commit `c9ee257`, reconciled `7dc7ae1` |
| `docs/mcp-architecture.md` | ✅ Done | commit `7dc7ae1`, `88bb93a` |
| `scripts/mcp-health-check.ts` | ✅ Done | commit `a5feb76` |
| `scripts/output/run-output-{normal,degraded}.txt` | ✅ Done | commits `a5feb76`, `31196cd` |
| `docs/runbooks/mcp-contingency.md` | ✅ Done | commit `d3fefd5` |
| `docs/pull-requests/PR-0002-mcp-architecture.md` | ✅ Done | commit `88bb93a` |
| `tasks.md` | ❌ Missing | Not a spec requirement itself, but a skill-process gap — noted, not fixed (out of this Verifier's remit to author it retroactively) |

---

## Spec-Anchored Acceptance Criteria

### P1: Tech Lead documenta MCP como infraestrutura gerenciada (REQ-01, REQ-02, REQ-05)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1 — `mcpServers` populated with ≥4 entries (`filesystem`,`git`,`memory`,`everything`), each `command`/`args` non-empty | Exactly these 4 keys, no empty command/args | `.mcp/mcp.json:2-31` — 4 keys, verified programmatically: `node -e "console.log(Object.keys(require('./.mcp/mcp.json').mcpServers))"` → `['filesystem','git','memory','everything']`; each has non-empty `command`/`args` | ✅ PASS |
| AC2 — "Versionamento" section names the versioned file + concrete review mechanism | Names `.mcp/mcp.json` + a review mechanism, not generic "versionar no git" | `docs/mcp-architecture.md:140-150` (section 4) — names `.mcp/mcp.json` explicitly, mechanism = "branch + PR-como-markdown" with 3 concrete sub-steps (diff literal, health-check gate, SLA approval) | ✅ PASS |
| AC3 — "Monitoramento" section defines UP/DOWN/DEGRADED operationally + when/how the health check runs | Operational definitions + concrete trigger | `docs/mcp-architecture.md:119-136` (section 3) — table defining the 3 states precisely (line 125-127) + "quando rodar" naming `npm run mcp:health` manually before a work session (line 132) | ✅ PASS |
| AC4 — diagram lists, per `mcpServers` key, consumer/role + access scope | Consumer + scope per server | `docs/mcp-architecture.md:14-30` (mermaid) + `:34-40` (table) — all 4 servers have consumer(s) and scope listed | ✅ PASS |
| AC5 — diagram server-set == `.mcp/mcp.json` key-set, exactly | Identical sets, no extra/missing | Diagram table (`docs/mcp-architecture.md:34-40`) lists exactly `filesystem`, `git`, `memory`, `everything` (filesystem appears on 2 rows but is 1 distinct server). Independently re-derived `.mcp/mcp.json` key-set = `{filesystem, git, memory, everything}` (see AC1 evidence). Sets match exactly — 4/4, no extra, no missing. | ✅ PASS |
| AC6 — `filesystem` entry distinguishes rw (`./src`,`./specs`,`./skills`) from ro (`./docs/novatech`,`./data/retrieval-corpus`) | Explicit rw/ro split matching the given mapping | `docs/mcp-architecture.md:36-37` — two rows, `rw` vs `ro por convenção`, exact path lists match the spec's given mapping | ✅ PASS (see also flagged limitation below — the "ro" label is honestly qualified as convention, not enforcement — this is correct behavior, not a gap) |
| AC7 — approval section names a single approver role, no committee | "Tech Lead" only, explicit no-committee | `docs/mcp-architecture.md:100` — "**Aprovador único**: o **Tech Lead**... Não há comitê ou conselho de revisão" | ✅ PASS |
| AC8 — approval requires scope + justification declared pre-merge, no exception | Declaration of scope+justification mandatory | `docs/mcp-architecture.md:102-107` — numbered list requires both, plus "Um PR que adicione uma entrada... sem essas duas informações declaradas não deve ser mergeado" | ✅ PASS |
| AC9 — concrete max review SLA | A named number of business days | `docs/mcp-architecture.md:109` — "até **1 dia útil**" | ✅ PASS |

### P1: Script de health check executado de verdade (REQ-03, REQ-04)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1 — reads `.mcp/mcp.json` from disk (not hardcoded), iterates every key | Real file read, no hardcoded server list | `scripts/mcp-health-check.ts:93-120` (`loadMcpConfig` reads `MCP_CONFIG_PATH` via `readFile`), `:356` (`Object.entries(servers)` iterates all keys) — independently confirmed by editing `.mcp/mcp.json` (adding a 5th `hanging-probe` entry) and observing the script pick it up without code changes (see Sensor #3 below) | ✅ PASS |
| AC2 — real MCP protocol check (`tools/list`), not just binary-exists | Real JSON-RPC `initialize`+`tools/list` handshake | `scripts/mcp-health-check.ts:302-324` — `client.request("initialize", ...)` then `client.request("tools/list")`; independently re-verified by hand-rolling a separate `initialize`→`tools/list` handshake against `@cyanheads/git-mcp-server` outside the script — returned 28 tools, matching the doc's claim (see Discrimination Sensor below) | ✅ PASS |
| AC3 — `filesystem` check confirms `docs/novatech/` visibility specifically | Real listing call against that path, not just "process up" | `scripts/mcp-health-check.ts:227-271` (`checkFilesystemAccess`) calls `tools/call` with the discovered list-directory tool against `FILESYSTEM_PROBE_DIR` (`docs/novatech`, `:34`) | ✅ PASS |
| AC4 — bounded timeout per server, DOWN + clear message, continues others, non-zero exit if any DOWN, never aborts on first failure | Isolated per-server failure, no global abort | `scripts/mcp-health-check.ts:279-339` (`checkServer`, `Promise.race` against `timeoutMs`), `:369` (`Promise.all` — all servers checked concurrently, independent of each other's outcome), `:378-379` (non-zero exit if not all UP). **Independently re-tested**, not just read: injected a 5th server (`command: "sleep", args: ["120"]`) into `.mcp/mcp.json`, ran `npm run mcp:health` — wall-clock ≈7.8s (bounded by the 8s `DEFAULT_TIMEOUT_MS`), the 4 real servers still reported correctly (`UP`/`UP`/`UP`/`UP`), the hanging one reported `DOWN — sem resposta dentro do timeout de 8000ms`, exit code 1. File restored, `git diff` clean afterward. | ✅ PASS |
| AC5 — literal stdout of a real run captured in repo + exact command documented | Real captured output, command named | `scripts/output/run-output-normal.txt`, `scripts/output/run-output-degraded.txt`; command `npm run mcp:health` named in `docs/mcp-architecture.md:132`. **Independently re-run twice by this Verifier** (see Discrimination Sensor #1/#2) — outputs reproduce exactly (per-server verdicts and the DEGRADED cause message match byte-for-byte modulo the absolute path prefix, which is machine-specific and expected to vary). | ✅ PASS |

### P1: Plano de contingência degrada em vez de travar (REQ-04)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1 — per-server detection signal + degraded behavior | All 4 servers covered | `docs/runbooks/mcp-contingency.md:26-32` — table with a row for `filesystem` DOWN, `filesystem` DEGRADED, `git`, `memory`, `everything` (5 rows covering 4 servers, `filesystem` split into 2 states) | ✅ PASS |
| AC2 — `filesystem`/`docs/novatech` loss: SHALL warn + ask for alternative source or decline, SHALL NOT fabricate from memory | Explicit warn/decline instruction + explicit fabrication ban | `docs/runbooks/mcp-contingency.md:29` — "o agente **SHALL NOT** responder... usando conhecimento geral/memória... deve dizer explicitamente 'não consigo acessar docs/novatech agora'... (a) pedir... (b) declarar que não pode responder" | ✅ PASS |
| AC3 — multi-server-down cumulative/partial degradation, not a single global "stop everything" rule | Explicit cumulative model, explicit rejection of the global-stop anti-pattern | `docs/runbooks/mcp-contingency.md:36-46` — "cada server ausente reduz a capacidade... de forma independente e cumulativa — não existe uma regra global única de 'se qualquer server cair, pare tudo'" + a worked combined-failure example (`git` DOWN + `filesystem` DEGRADED simultaneously) showing partial continuation | ✅ PASS |

**Status**: ✅ All 20 acceptance criteria across REQ-01/02/03/04/05 PASS. No spec-precision gaps found — every criterion in this spec already specifies a precise, checkable outcome, and the artifacts hit it.

---

## Discrimination Sensor (adapted: no unit tests exist for this mostly-documentation feature — sensor = independent reproduction + fact-check of strong claims)

| # | What was tested | Method | Result |
| --- | --- | --- | --- |
| 1 | Normal run reproduces `run-output-normal.txt` | Ran `npm run mcp:health` for real on this checkout (not trusting the captured file) | ✅ Matches — 4/4 `UP`, exit 0, identical to `scripts/output/run-output-normal.txt` |
| 2 | Degraded run reproduces `run-output-degraded.txt` | Backed up `.mcp/mcp.json`, removed `./docs/novatech` from `filesystem`'s args (same simulation the doc claims was done), ran `npm run mcp:health`, restored the file, confirmed `git diff .mcp/mcp.json` empty afterward | ✅ Matches — `filesystem` reported `DEGRADED` (not DOWN, not UP) with cause message naming `docs/novatech` and the exact "Access denied - path outside allowed directories" text, other 3 servers `UP`, exit 1 — byte-identical to `scripts/output/run-output-degraded.txt` (only the absolute path differs, which is machine-specific) |
| 3 | Timeout isolation claim (REQ-03 AC4) — "one hung server never blocks/aborts checking of the others" | Injected a 5th fake server (`command: "sleep", args: ["120"]`) into `.mcp/mcp.json`, ran the script, restored the file | ✅ Confirmed by execution, not by reading the code: total wall-clock ≈7.8s (bounded by the 8s timeout, not by the 120s sleep), the other 4 servers reported correctly while the fake one reported `DOWN` with a timeout message. No leftover process (`ps aux` after showed nothing) — `killChild`'s process-group kill works as claimed. |
| 4 | Malformed-JSON edge case (spec Edge Cases, folded into REQ-03) | Backed up `.mcp/mcp.json`, wrote invalid JSON (`{not valid json`), ran the script, restored the file | ✅ Confirmed: script printed a clear config error (`.mcp/mcp.json não é um JSON válido: ...`) and exited 1 — no raw stack trace, no unhandled exception |
| 5 | Central security claim: `mcp-server-git` (npm) is "not a real MCP server," a telemetry canary hitting `vulnerable-live.workers.dev` | Ran `npm view mcp-server-git` (confirmed description: "Security research canary — not for production use... theinfosecguy/npx-canary") and `npm pack mcp-server-git@0.0.2` + inspected the unpacked `index.js`/`package.json` directly (did not execute the package) | ✅ **Independently confirmed, not taken on faith.** `package.json`'s `postinstall` is `node index.js`; `index.js` POSTs `{package, hostname, cwd, ...}` to `https://npx-canary-log.vulnerable-live.workers.dev/log` and implements zero MCP protocol surface — it is exactly the telemetry beacon `docs/mcp-architecture.md:6` and `PR-0002:23` describe, not a paraphrase or exaggeration |
| 6 | `@cyanheads/git-mcp-server` "28 tools" claim | Hand-rolled a separate `initialize`→`notifications/initialized`→`tools/list` JSON-RPC handshake against the package directly (outside the project's script), independent of `mcp-health-check.ts`'s own code path | ✅ Confirmed — real handshake returned exactly 28 tools |
| 7 | "Mutant" hunt — looked for a claim in `docs/mcp-architecture.md` / `mcp-contingency.md` phrased as strong enforcement ("garante"/"impede"/"nunca") that doesn't hold up technically | Grepped both docs for enforcement language, cross-checked each hit against actual code/config behavior | ⚠️ **No hidden overclaim found** — the one place that could have been an overclaim (the `filesystem` rw/ro split) is explicitly and correctly *un*-claimed: `docs/mcp-architecture.md:88-94` states outright that "nada no processo do server impede a escrita" against the "read-only" paths and that the separation is "convenção do time... não controle técnico do server" — this is the document being honest about a limitation, not a mutant. The approval-policy "não deve ser mergeado" language (line 107) is a process/should-not, never phrased as a technical block, so it doesn't overclaim either. This item is reported as a clean check, not a gap. |

**Sensor depth**: lightweight, adapted (7 independent reproductions/fact-checks in lieu of unit-test mutation, proportional to a documentation+single-script feature).
**Result**: 7/7 checks confirmed the artifacts' claims by independent execution or inspection — 0 discrepancies found. Working tree restored to clean after every mutation (`git status --porcelain .mcp/mcp.json` empty at each restore point).

---

## Edge Cases (from spec.md)

- [x] `.mcp/mcp.json` malformed JSON / missing `mcpServers` → clean config error, exit non-zero, no unhandled exception (Sensor #4)
- [x] GitHub Copilot CLI auth failure → documented pivot to isolated Claude subagent, same precedent as `agents-md-tech-lead` (`context.md:27-31`, `PR-0002-mcp-architecture.md:25-27`) — disclosed, not silently swapped. Note: unlike the sibling feature, no `evidence/round-*` transcript files exist for this pivot in this feature's directory; the disclosure lives only in prose in `context.md`/`PR-0002`, which is weaker evidence than the sibling feature's `copilot-cli-auth-failure.txt`. Flagged as a minor evidence-rigor gap, not a functional one — the deliverable (the script) is real and independently verified regardless of which tool wrote it.
- [x] No server responds (e.g., no network for `npx` first resolution) → each server reported DOWN individually per the code path exercised in Sensor #3 (same isolation mechanism, no first-failure abort)

---

## Code Quality

| Principle | Status | Note |
| --- | --- | --- |
| Minimum code | ✅ | `mcp-health-check.ts` is ~390 lines, no speculative abstraction beyond what a stdio JSON-RPC client + per-server timeout genuinely requires |
| Surgical changes | ✅ | Diff scoped to `.mcp/`, `docs/mcp-architecture.md`, `docs/runbooks/`, `scripts/`, `.specs/features/mcp-architecture/`, `docs/pull-requests/PR-0002...md`, plus `package.json`/`package-lock.json` (adding `tsx`/`@types/node`, both genuinely needed to run the script) |
| No scope creep | ✅ | AGENTS.md sections, skills, other exercises untouched, consistent with the spec's explicit Out-of-Scope table |
| Matches existing patterns | ✅ | PR-as-markdown reuses `PR-0001`'s structure; doc reuses `docs/runbooks/` and `docs/pull-requests/` conventions already in the scaffold |
| No `any`/`@ts-ignore`/bare `console.*` misuse | ✅ | `scripts/mcp-health-check.ts` uses `console.log`/`console.error`, but this is explicitly permitted by AGENTS.md ("só é tolerado em scripts de uma vez fora de `src/`") and the script itself cites that rule inline (`:12-14`) |
| Build gate scope note | ⚠️ (non-blocking) | `tsconfig.json` only `include`s `src`/`tests` — `scripts/` is never type-checked by `npm run build`. This is consistent with AGENTS.md's own build-gate wording ("DEVE passar... antes de qualquer commit que toque `src/`"), so it's not a violation, but it does mean the "build gate" doesn't actually cover this feature's new code. I independently ran `npx tsc --noEmit --strict ... scripts/mcp-health-check.ts` standalone — 0 errors — so the code is in fact strict-mode clean, just not verified by the project's own gate command. |
| Spec-anchored outcome check | ✅ | Every AC above traces to a precise, checkable outcome (exact file, exact section, exact behavior) — none needed a "spec-precision gap" flag |
| Documented guidelines followed | ✅ | `AGENTS.md` (console.log scoping), `docs/pull-requests/PR-0001-...` (PR format), `docs/cenario-2/anexo-c-...` (`.mcp.json` reference shape) |

---

## Gate Check

- **Gate command**: `npm run build` (`tsc -p .`) — the only automated gate applicable; there is no test suite for this feature (documentation + one utility script, no `src/` changes)
- **Result** (run live by this Verifier): `tsc -p .` — exit 0, no errors
- **Test count before/after feature**: unchanged (0 → 0; this feature adds no `src/`/`tests/` code)
- **Manual verification runs performed by this Verifier** (in lieu of a test suite): 2 real `npm run mcp:health` executions (normal + degraded) + 2 additional fault-injection runs (hanging server, malformed JSON) — see Discrimination Sensor
- **Failures**: none

---

## Fix Plans

No blocking issues found. One non-blocking observation logged (not fixed, per Verifier role — reporting only):

### Observation 1: Copilot CLI pivot for this feature lacks a captured failure artifact

- **What**: `context.md`/`PR-0002-mcp-architecture.md` narrate that the Copilot CLI pivot precedent from `agents-md-tech-lead` was "repeated," but unlike the sibling feature (which has `evidence/round-1/copilot-cli-auth-failure.txt`), this feature's directory has no equivalent captured transcript for *this* feature's attempt (if one was made) — the claim rests on prose referencing the earlier feature's evidence, not this feature's own.
- **Priority**: Minor/cosmetic — the actual deliverable (`scripts/mcp-health-check.ts`) is real, independently executed, and behaviorally verified regardless of which tool authored it; this only affects the auditability of the tooling-substitution claim itself, not the feature's functional correctness.

### Observation 2 (informational, not a fix): `scripts/` not covered by `npm run build`

- Already accurately scoped by AGENTS.md's own wording (build gate applies to commits touching `src/`); not treated as a gap. Documented above for visibility only.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| REQ-01 | Pending | ✅ Verified |
| REQ-02 | Pending | ✅ Verified |
| REQ-03 | Pending | ✅ Verified |
| REQ-04 | Pending | ✅ Verified |
| REQ-05 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 20/20 acceptance criteria PASS, 0 spec-precision gaps
**Sensor**: 7/7 independent reproductions/fact-checks confirmed (2 real script re-runs matching captured output byte-for-byte modulo machine path, 2 fault-injection tests — hanging server + malformed JSON — both behaving exactly as documented, 2 independent fact-checks of the strongest claims in the doc — the `mcp-server-git` telemetry-canary finding and the `@cyanheads/git-mcp-server` 28-tools claim — both confirmed by direct package inspection / hand-rolled protocol handshake rather than trusting the doc's prose, 1 targeted search for an unsupported "enforcement" claim that came back clean)
**Gate**: `npm run build` — 1 passed, 0 failed (no test suite applicable; this feature adds no `src/`/`tests/` code)

**What works**:
- `.mcp/mcp.json` really configures 4 working servers; independently re-verified the `git` server's "28 tools" claim and the discarded `mcp-server-git` package's actual telemetry-beacon behavior by direct package inspection, not by trusting the document's prose.
- The health-check script's core safety property — one hung/misbehaving server never blocks or aborts the check of the others, and reports DOWN within a bounded, documented timeout — was verified by actually injecting a hanging fake server and timing the run, not just by reading the `Promise.race`/`Promise.all` code.
- The captured "normal" and "degraded" run outputs are genuinely reproducible: reran both scenarios independently (including physically removing/restoring the `docs/novatech` path in `.mcp/mcp.json`) and got matching per-server verdicts and cause messages.
- The runbook's central behavioral guarantee (warn-and-ask-for-alternative-source instead of fabricating from memory, plus cumulative rather than all-or-nothing degradation across multiple simultaneous failures) is present, explicit, and textually strong ("SHALL NOT... usando conhecimento geral/memória").
- The document is honest about its own biggest technical limitation (no real rw/ro enforcement for `filesystem` outside Docker) instead of hiding it or overclaiming enforcement — this is exactly the kind of self-disclosure the "mutant hunt" was looking for evidence *against*, and none was found.

**Issues found**: 1 minor evidence-rigor observation (Copilot CLI pivot for this feature not independently evidenced with its own transcript, unlike the sibling feature) — non-blocking, does not affect functional correctness of any deliverable.

**Next steps**: None required to close this feature. Optional future hygiene: capture a `context.md`-adjacent transcript file for this feature's own Copilot CLI attempt (if one exists) to match the sibling feature's evidentiary rigor; automate `npm run mcp:health` in CI (already logged as an explicit Deferred Idea in `context.md`, not a requirement of this spec).

Working tree confirmed clean at the end of this validation (`git status --porcelain` empty in `deliverables/cenario-2/novatech-assistant/` except for this new `validation.md` file).
