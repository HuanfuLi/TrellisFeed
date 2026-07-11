---
phase: 02-content-pool-feed-post-ui-on-frozen-data
plan: 03
subsystem: ai-preprocessing-evaluation
tags: [structured-output, codex, promptfoo, phoenix, opentelemetry, offline-evals]
requires:
  - phase: 02-content-pool-feed-post-ui-on-frozen-data
    provides: normalized inert candidates, strict schemas, and operator-only review boundaries
provides:
  - Provider-neutral schema-validated preprocessing with bounded repair, spend, concurrency, and resumable cache controls
  - Read-only network-disabled Codex advisory review bound to candidate content hashes
  - Sixteen-case offline Promptfoo harness and opt-in loopback-only Phoenix observer contract
affects: [02-human-review, 02-content-freeze, 02-post-qa, phase-3-ranking-evals]
tech-stack:
  added: [promptfoo@0.40.0, arize-phoenix@17.26.0, opentelemetry-sdk@1.43.0]
  patterns: [strict local validation after provider projection, advisory-only AI review, fixture-only paired-condition replay, metadata-only injected tracing]
key-files:
  created: [tools/content_pipeline/src/preprocess/run.ts, tools/content_pipeline/src/codex-gate/run.ts, evals/phase-2/fixtures/reference-set.json, evals/phase-2/phoenix-local.py, tools/content_pipeline/src/observability/trace.ts]
  modified: [tools/content_pipeline/src/cli.ts, tools/content_pipeline/package.json, tools/content_pipeline/test/ai-preprocess.test.mjs, tools/content_pipeline/test/codex-gate.test.mjs]
key-decisions:
  - "Permanent wrapper preprocessing keeps the full local schema authoritative even when provider-native structured output is projected differently."
  - "Codex verdicts are content-hash-bound advisory records and have no approved or frozen transition."
  - "Evaluation uses only checked-in fixture execution; local tracing is disabled by default, metadata-allowlisted, loopback-only, and exporter-free."
patterns-established:
  - "AI completion gate: refusal, abnormal stop, authentication, and schema-compilation failures are checked before parse; only eligible malformed/truncated/local-validation failures repair at most twice."
  - "Offline eval gate: every Ask fixture creates byte-equivalent control and experimental request envelopes through a zero-token fixture provider."
requirements-completed: [CONT-02]
coverage:
  - id: D1
    description: Provider-neutral structured preprocessing with strict completion, validation, retry, cache, concurrency, provenance, and spend controls
    requirement: CONT-02
    verification:
      - kind: integration
        ref: "tools/content_pipeline/test/ai-preprocess.test.mjs#8 structured preprocessing contract tests"
        status: pass
      - kind: other
        ref: "npm --prefix tools/content_pipeline run build"
        status: pass
    human_judgment: false
  - id: D2
    description: Read-only no-tools no-network Codex advisory gate that cannot approve or freeze content
    requirement: CONT-02
    verification:
      - kind: integration
        ref: "tools/content_pipeline/test/codex-gate.test.mjs#7 advisory gate contract tests"
        status: pass
    human_judgment: false
  - id: D3
    description: Sixteen adjudicated fixture cases with paired-condition replay and an exact opt-in loopback Phoenix contract
    requirement: CONT-02
    verification:
      - kind: integration
        ref: "python evals/phase-2/test_phoenix_local.py#7 dependency, environment, launch, and egress tests"
        status: pass
      - kind: integration
        ref: "promptfoo eval -c promptfooconfig.yaml --no-cache#16 fixture-only cases"
        status: pass
    human_judgment: false
duration: 2h 2m elapsed (15m resumed execution)
completed: 2026-07-11
status: complete
---

# Phase 02 Plan 03: Validated AI Preprocessing and Offline Evaluation Summary

**Permanent wrapper drafts now pass strict provider-neutral validation and advisory-only Codex review, backed by a 16-case fixture-only regression harness and metadata-only local observability.**

## Performance

- **Duration:** 2h 2m elapsed across the quota interruption; approximately 15 minutes for the safe resume
- **Started:** 2026-07-11T17:06:24-04:00
- **Resumed:** 2026-07-11T18:53:15-04:00
- **Completed:** 2026-07-11T19:07:51-04:00
- **Tasks:** 3
- **Files modified:** 22

## Accomplishments

- Added provider-neutral Anthropic, OpenAI, Gemini, local, and fixture structured-output projections while retaining strict local validation, termination checks, bounded repair, versioned resumable caching, concurrency, spend ceilings, and metadata-only logs.
- Added a fixed read-only Codex review subprocess with no shell, tools, network, approval, or freeze authority; verdicts fail closed and become stale when candidate content changes.
- Added exactly 8 content and 8 Ask reference cases, fixture-only Promptfoo execution with full paired-condition envelope equality, exact Python dependency checks, and an explicitly enabled loopback-only Phoenix launcher with no hosted/OTLP exporter.

## Task Commits

Each TDD task was committed as a RED/GREEN pair:

1. **Task 1: Build provider-neutral, schema-validated preprocessing**
   - `a129d32` — test(02-03): specify structured preprocessing contract
   - `6b35e1e` — feat(02-03): add validated AI preprocessing
2. **Task 2: Implement D-11 read-only Codex advisory review**
   - `e8a73c9` — test(02-03): specify advisory Codex gate
   - `d04d568` — feat(02-03): add advisory Codex review gate
3. **Task 3: Establish the adjudicated AI evaluation harness**
   - `203631e` — test(02-03): specify offline evaluation harness
   - `9443846` — feat(02-03): add offline adjudicated evaluation harness

## Resume Details

- The quota interruption occurred after Tasks 1–2 were fully committed and before Task 3 had a RED commit.
- The untracked `evals/phase-2/test_phoenix_local.py` was inspected and preserved. Its initial run failed only because `phoenix-local.py` did not yet exist, establishing the RED state before commit `203631e`.
- No Task 1 or Task 2 file was reset, discarded, duplicated, or recommitted. Only Task 3-owned files and the preprocessing trace injection point were staged in the GREEN commit.

## Files Created/Modified

- `tools/content_pipeline/src/ai/provider.ts` — Normalized structured request/result contracts and authoritative preprocessing schema.
- `tools/content_pipeline/src/preprocess/prompt.ts` — Fresh-delimited inert-source prompt construction.
- `tools/content_pipeline/src/preprocess/run.ts` — Validated retries, stable caching/order, spend/concurrency controls, and trace stage boundaries.
- `tools/content_pipeline/src/codex-gate/run.ts` — Fixed read-only advisory Codex invocation and content-hash-bound verdict handling.
- `evals/phase-2/fixtures/reference-set.json` — Eight preprocessing/content and eight post-scoped Ask gold fixtures.
- `evals/phase-2/fixtures/offline-provider.js` — Local executable fixture provider with no model, token, or network path.
- `evals/phase-2/promptfooconfig.yaml` — Critical/high release assertions and paired condition-envelope checks.
- `evals/phase-2/phoenix-local.py` — Side-effect-free check mode and explicit opt-in loopback launcher.
- `evals/phase-2/test_phoenix_local.py` — Exact exit/stdout/stderr, pin, unsafe-environment, opt-in, loopback, exporter, and egress coverage.
- `tools/content_pipeline/src/observability/trace.ts` — Disabled-by-default injected tracer that emits only allowlisted metadata.

## Decisions Made

- Provider response formats are projections only; strict Ajv validation of the complete local schema remains authoritative.
- Repair is limited to malformed, truncated, or locally invalid output and never applies to refusal, authentication, or schema-compilation failures.
- Promptfoo is pinned to `0.40.0`, the latest tested line compatible with Node 22.19 and the plan's mandatory `npm ci --ignore-scripts` installation; `uuid` is overridden to `11.1.1` so the pinned eval environment audits cleanly.
- Phoenix dependency checks and startup are separate: `--check` never installs or launches, while startup requires `QUESTIONTRACE_PHOENIX_LOCAL=1` before dependency imports.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Selected an ignore-scripts-compatible Promptfoo pin**
- **Found during:** Task 3 verification
- **Issue:** Cached Promptfoo `0.121.18` rejected Node 22.19, while `0.119.9` required an unbuilt `better-sqlite3` native binding after the mandated `npm ci --ignore-scripts`.
- **Fix:** Pinned Promptfoo `0.40.0`, which supports the required custom executable fixture provider and assertions without lifecycle scripts, and overrode vulnerable transitive `uuid` to `11.1.1`.
- **Files modified:** `evals/phase-2/package.json`, `evals/phase-2/package-lock.json`, `evals/phase-2/test_phoenix_local.py`
- **Verification:** `npm ci --ignore-scripts`, `npm audit --audit-level=moderate`, and 16/16 Promptfoo cases pass.
- **Committed in:** `9443846`

**2. [Rule 2 - Missing Critical] Added an executable network-deny fixture provider**
- **Found during:** Task 3 implementation
- **Issue:** Promptfoo configuration alone could not replay both study conditions or prove that no live provider path was selected.
- **Fix:** Added a checked-in executable provider that accepts only known case IDs, emits zero-token deterministic results, rejects URL-shaped inputs, and constructs equal control/experimental envelopes.
- **Files modified:** `evals/phase-2/fixtures/offline-provider.js`
- **Verification:** Promptfoo reports 16 successes, 0 failures, and 0 total tokens.
- **Committed in:** `9443846`

---

**Total deviations:** 2 auto-fixed (1 blocking compatibility issue, 1 missing critical offline provider seam).
**Impact on plan:** Both changes were necessary to make the specified offline verification executable on the repository's current runtime. No participant runtime, live provider, hosted telemetry, or approval behavior was added.

## Issues Encountered

- On this npm/PowerShell combination, `npm --prefix evals/phase-2 exec -- ... -c promptfooconfig.yaml` resolves the config from the repository root instead of the prefix directory. Verification used the behaviorally equivalent `Push-Location evals/phase-2; npm exec -- promptfoo eval -c promptfooconfig.yaml --no-cache; Pop-Location` command.
- Promptfoo 0.40 prints an old first-run telemetry notice even when `PROMPTFOO_DISABLE_TELEMETRY=1`; inspection confirmed that the disabled flag prevents event recording and sending. Sharing is also disabled in the checked-in config.

## User Setup Required

None. Phoenix remains optional and is not installed or started by tests. An operator who intentionally wants the local observer can install the exact `requirements.txt` and set the documented opt-in variable.

## Test Results

- `python evals/phase-2/test_phoenix_local.py` — 7/7 passed.
- `npm --prefix evals/phase-2 ci --ignore-scripts` — passed from the lockfile.
- Offline Promptfoo eval from `evals/phase-2` — 16/16 passed, 0 failures, 0 tokens.
- `npm --prefix evals/phase-2 audit --audit-level=moderate` — 0 vulnerabilities.
- `npm --prefix tools/content_pipeline test` — 53/53 passed.
- `npm --prefix tools/content_pipeline run build` — passed.
- Reference-set structural acceptance — exactly 16 cases (8 content, 8 Ask), all required evidence/provenance/rubric/adjudication fields present, and one Codex-advance/operator-reject case present.
- Trace allowlist acceptance — unknown raw-question and condition fields are discarded; disabled tracing emits nothing.

## Next Phase Readiness

- Plan 02-04 can render validated drafts and advisory Codex verdicts for the operator's final review without granting either AI stage approval authority.
- Plan 02-06 and later Ask work can extend the same fixture-only paired-condition and metadata-only tracing patterns.
- No blocker remains. Human review remains mandatory for real content candidates and for semantic study-instrument quality.

## Self-Check: PASSED

---
*Phase: 02-content-pool-feed-post-ui-on-frozen-data*
*Completed: 2026-07-11*
