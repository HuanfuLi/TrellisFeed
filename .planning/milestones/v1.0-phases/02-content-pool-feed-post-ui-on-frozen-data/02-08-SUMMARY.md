---
phase: 02-content-pool-feed-post-ui-on-frozen-data
plan: 08
subsystem: post-qa-research-transport
tags: [post-qa, raw-filter, indexeddb, condition-parity, d1, export]
requires:
  - phase: 02-content-pool-feed-post-ui-on-frozen-data
    plan: 05
    provides: checksum-verified ready frozen content repository
provides:
  - Condition-neutral post-bounded Ask coordinator with RAW-ARGMAX pre-gate
  - Canonical UserQuestion and AIAnswer persistence plus same-post hydration
  - Revisioned canonical Q&A upload, D1 ingest migration, and CSV export
affects: [02-09, 03-graph-memory-recommendation-engine, 04-study-infrastructure]
tech-stack:
  added: []
  patterns: [raw-before-context gate, complete-response persistence, canonical-to-derived projection, metadata-only AI observation]
key-files:
  created: [app/src/services/post-qa.service.ts, app/src/services/ai-observability.service.ts, research-backend/migrations/0002_canonical_qa.sql]
  modified: [app/src/services/db.service.ts, app/src/screens/PostDetailScreen.tsx, app/src/services/interaction-log.service.ts, research-backend/src/worker.ts, research-backend/src/export.ts]
key-decisions:
  - "Study condition is a canonical persistence field only; it never enters prompt, grounding, provider, model, retry, or answer behavior."
  - "Canonical local question/answer rows are the only durable UI thread source; revisioned research records are derived only after both canonical rows exist."
  - "AI observation remains disabled unless a sink is injected and accepts metadata allowlist fields only."
patterns-established:
  - "Ask boundary: untouched raw filter -> ready current post -> bounded stable blocks -> shared main provider -> complete canonical write."
  - "Research boundary: canonical DB existence check -> derived revision -> existing bounded outbox -> server-owned identity ingest."
requirements-completed: [ASK-01]
coverage:
  - id: D1
    description: Canonical Q&A stores survive restart and hydrate only complete same-user same-post turns
    requirement: ASK-01
    verification:
      - kind: integration
        ref: "app/tests/services/post-qa.service.test.mjs#canonical persistence survives hydrate through the dbQuery seam"
        status: pass
    human_judgment: false
  - id: D2
    description: Raw-gated frozen-post Ask is condition-neutral and persists only normal complete responses
    requirement: ASK-01
    verification:
      - kind: integration
        ref: "app/tests/services/post-qa.service.test.mjs + post-qa.condition-parity.test.mjs"
        status: pass
      - kind: other
        ref: "Promptfoo offline Phase 2 reference set (16/16)"
        status: pass
    human_judgment: false
  - id: D3
    description: Canonical projection traverses the existing bounded upload seam and backend monotonic ingest/export
    requirement: ASK-01
    verification:
      - kind: integration
        ref: "app/tests/services/interaction-log.service.test.mjs + upload-queue.service.test.mjs"
        status: pass
      - kind: integration
        ref: "research-backend npm test (30/30)"
        status: pass
    human_judgment: false
duration: 19min
completed: 2026-07-11
status: complete
---

# Phase 02 Plan 08: Canonical Post-Bounded Ask Summary

**Both study conditions now share one raw-gated, frozen-post-grounded Ask path whose complete answers survive restart and flow through one privacy-bounded research ingest/export seam.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-07-11T23:38:22Z
- **Completed:** 2026-07-11T23:57:12Z
- **Tasks:** 3
- **Files modified:** 20

## Accomplishments

- Added parity-safe IndexedDB/fallback stores for exact RSD `UserQuestion` and `AIAnswer` records, boot hydration, and complete same-user/same-post thread assembly.
- Added one typed/suggested Ask coordinator with untouched malicious filtering before context, deterministic off-topic redirect, bounded approved post blocks, shared main-model streaming, one 60% retry, completion-only persistence, and allowlisted observation.
- Added strict canonical Q&A projection, unchanged bounded outbox delivery, server-owned monotonic D1 ingest, a real 0001→0002 migration, and complete spreadsheet-safe export fields.

## Task Commits

1. **Task 1: Add canonical Q&A stores and same-post thread hydration** — `a386195` (test), `1c624ac` (feat)
2. **Task 2: Implement raw-gated, frozen-post-grounded Ask and condition parity** — `10eaf7f` (test), `625237a` (feat)
3. **Task 3: Project canonical Q&A through the existing upload/backend/export seam** — `c0d0e99` (test), `ca398ba` (feat)
4. **Acceptance hardening: canonical boot/detail hydration** — `0221067` (fix)

## Files Created/Modified

- `app/src/services/post-qa.service.ts` — Canonical repositories, stable grounding selector, raw-gated coordinator, streaming completion gate, and condition-neutral request construction.
- `app/src/services/ai-observability.service.ts` — Disabled-by-default, metadata-only observer allowlist.
- `app/src/services/db.service.ts` and `app/src/App.tsx` — Q&A stores, IndexedDB version upgrade, reset coverage, and boot hydration.
- `app/src/screens/PostDetailScreen.tsx` — Shared coordinator integration, canonical thread reload, successful follow-up exploration, and once-only research projection/events.
- `app/src/services/interaction-log.service.ts`, `research-wire-contract.ts`, and `types/research.ts` — Canonical-derived revision and strict client wire validation.
- `research-backend/migrations/0002_canonical_qa.sql`, `src/validation.ts`, `src/worker.ts`, and `src/export.ts` — Canonical columns, allowlisted ingest, monotonic upsert, and export.
- Four app service tests and three backend tests — DB-seam durability, branch spies, condition parity, outbox limits, backend conflicts, and export coverage.

## Decisions Made

- The current condition is accepted only to populate the canonical question record; all behavioral dependencies are constructed without it.
- Off-topic input persists the same deterministic gentle redirect for both conditions without spending provider tokens.
- Canonical UI threads are reconstructed from DB pairs; legacy `ChatSession` is retained only as an in-memory rendering shell for the still-transitional PostDetail screen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Shared streaming adapters ignored the requested output cap**
- **Found during:** Task 2
- **Issue:** OpenAI/local and Claude stream bodies hard-coded 4096 tokens, so `maxTokens: 800` was not honored.
- **Fix:** Routed `CompletionOptions.maxTokens` into every affected stream request and native fallback.
- **Files modified:** `app/src/providers/llm/index.ts`
- **Verification:** Ask tests assert 800; app build and full suite pass.
- **Committed in:** `625237a`

**2. [Rule 2 - Missing Critical] Boot/detail flow did not consume canonical Q&A hydration**
- **Found during:** Plan acceptance review
- **Issue:** The new stores were durable, but first render and PostDetail still treated legacy session messages as the display source.
- **Fix:** Added canonical boot hydration, rebuilt detail messages from same-post canonical pairs, and stopped saving new turns into the legacy session store.
- **Files modified:** `app/src/App.tsx`, `app/src/screens/PostDetailScreen.tsx`
- **Verification:** build passes; DB restart/thread tests and full 899-test app suite pass.
- **Committed in:** `0221067`

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical functionality). **Impact:** Both fixes enforce explicit plan contracts without changing scope or condition behavior.

## Issues Encountered

- The literal Promptfoo command in the plan resolves `-c promptfooconfig.yaml` from the repository root under `npm --prefix`, producing an empty-config error. Running the same pinned binary with `-c evals/phase-2/promptfooconfig.yaml` executed the intended offline suite: 16/16 passed, zero live-provider tokens.
- Lint remains green with 24 pre-existing warnings and zero errors.

## User Setup Required

None - no external service configuration required.

## Test Results

- Focused app plan suite — 42/42 passed.
- Full app suite — 899/899 passed.
- Research backend — 30/30 passed.
- SQLite migrations `0001_init.sql` then `0002_canonical_qa.sql` — applied successfully; canonical columns and unique question index verified.
- Promptfoo offline reference set — 16/16 passed, zero tokens.
- `npm run lint` — passed with 0 errors and 24 pre-existing warnings.
- `npm run build` — passed.

## Next Phase Readiness

- Plan 02-09 can bind the final packaged artifact while reusing the canonical Ask and research transport boundaries.
- No unresolved HIGH threat remains; every Plan 02-08 STRIDE mitigation has automated green evidence.

## Self-Check: PASSED

- Confirmed all required created artifacts exist.
- Confirmed seven `02-08` production/TDD commits are present.
- Re-ran every task verification, acceptance criterion, backend migration, plan-level eval, full app suite, lint, and build.

---
*Phase: 02-content-pool-feed-post-ui-on-frozen-data*
*Completed: 2026-07-11*
