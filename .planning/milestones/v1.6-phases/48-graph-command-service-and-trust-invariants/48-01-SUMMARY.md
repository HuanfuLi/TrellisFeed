---
phase: 48-graph-command-service-and-trust-invariants
plan: 01
subsystem: services
tags: [localStorage, journal, reorg-prompt, event-bus, typescript]

requires:
  - phase: 32.1
    provides: GRAPH_UPDATED unified event (extended here with optional payload)
  - phase: 47
    provides: classifyAndAnchorIncremental dedup pre-check (preserved unchanged)
provides:
  - "Append-only graph edit journal (N=10 FIFO retention) in localStorage at trellis_graph_edit_log"
  - "Canonical per-cmd phrasing for reorg-prompt injection (rename / move / merge / detach / prune / delete)"
  - "GraphEditLogEntry type + optional GRAPH_UPDATED payload extension ({ kind, anchorId? })"
  - "_doReorganize system prompt now contains 'Manual corrections to preserve:' block, byte-stable when journal unchanged"
affects: [48-02, 48-03, 48-04, 49]

tech-stack:
  added: []
  patterns:
    - "Leaf-module test isolation (refill-mutex.ts pattern) — service has no transitive deps on settings/llm/locales so node --test can import directly"
    - "Append-only journal as reorg-prompt constraint surface (D-01)"

key-files:
  created:
    - app/src/services/graph-edit-journal.service.ts
    - app/src/services/graph-edit-journal-phrasing.ts
    - app/tests/services/graph-edit-journal.test.mjs
    - app/tests/services/reorg-prompt-journal-injection.test.mjs
  modified:
    - app/src/types/index.ts
    - app/src/services/canonical-knowledge.service.ts

key-decisions:
  - "Reused unified GRAPH_UPDATED event (CLAUDE.md rule) — added optional payload { kind, anchorId? } instead of introducing a new event type"
  - "localStorage key trellis_graph_edit_log (Trellis brand prefix per CLAUDE.md)"
  - "N=10 FIFO retention via entries.slice(-MAX_ENTRIES) at save; QuotaExceededError caught (D-05)"
  - "Empty-case branch emits literal '(none)' line so byte-stability holds across empty→first-edit boundary"
  - "Journal phrasing module separated from service so phrasing changes don't trigger service-test reruns"

patterns-established:
  - "Leaf services for node --test importability: keep transitive deps minimal so tests can import production code directly without JSON-attribute fallout"
  - "Per-cmd canonical phrasing: each verb has one builder that returns a deterministic byte-stable string for the reorg-prompt 'Manual corrections to preserve' block"

requirements-completed: [GRAPH-04]

duration: 10min
completed: 2026-05-17
---

# Phase 48-01: Foundation Summary

**Append-only N=10 graph edit journal in localStorage + GraphEditLogEntry type + reorg-prompt injection point — every Phase 48 verb command now has a place to record its edit, and the next reorganizeMindmap LLM call will see prior manual corrections as preserve-this-name constraints.**

## Performance

- **Duration:** ~10 min (5 commits across 9 min elapsed)
- **Started:** 2026-05-17T21:28:22-04:00
- **Completed:** 2026-05-17T21:37:56-04:00
- **Tasks:** 4 (plan tasks; combined into 5 atomic commits per TDD discipline)
- **Files modified:** 6 (2 services + 2 tests + 1 type extension + 1 prompt injection)

## Accomplishments

- `graphEditJournal` service with `append/list/popNewest/clear` + N=10 cap + pre-image validator (`isValidPreImage` for T-48-01 tamper-resistance)
- `phraseJournalEntry` canonical-phrasing helper covering all six verbs (rename/move/merge/detach/prune/delete) with deterministic output for byte-stability
- `GraphEditLogEntry` type added to `app/src/types/index.ts`; `GRAPH_UPDATED` event extended with optional `payload: { kind, anchorId? }` (backwards-compatible — old emitters keep working)
- `canonical-knowledge.service.ts::_doReorganize` system-prompt builder now injects a `Manual corrections to preserve:` block between `Rules:` and the JSON instruction — populated from journal entries (or `(none)` when empty so the prefix is byte-stable across the empty→first-edit transition)

## Task Commits

Each task was committed atomically with TDD discipline (test → feat) on tasks 2/3 and 4:

1. **Task 1: GraphEditLogEntry type + GRAPH_UPDATED payload extension** — `177fd225` (feat)
2. **Tasks 2 + 3 RED: failing tests for graphEditJournal + phraseJournalEntry** — `b1758fa5` (test)
3. **Tasks 2 + 3 GREEN: graphEditJournal leaf module + canonical phrasing** — `15961424` (feat)
4. **Task 4 RED: failing source-reading invariants for reorg prompt injection** — `af5adb95` (test)
5. **Task 4 GREEN: inject graph-edit journal into reorganizeMindmap prompt** — `f8bc9336` (feat)

_Tasks 2 + 3 collapsed into one feat commit since journal mechanics + phrasing are co-changed (one without the other doesn't compile)._

## Files Created/Modified

- `app/src/services/graph-edit-journal.service.ts` — 185 lines; leaf module (no transitive deps); `graphEditJournal` singleton + `GRAPH_EDIT_LOG_KEY` constant + `isValidPreImage` helper
- `app/src/services/graph-edit-journal-phrasing.ts` — 124 lines; `phraseJournalEntry(entry)` returns canonical prompt-string per cmd; deterministic byte-stable
- `app/src/types/index.ts` — added `GraphEditLogEntry` interface + extended `GRAPH_UPDATED` event with optional `payload` field
- `app/src/services/canonical-knowledge.service.ts` — `_doReorganize` system-prompt builder now imports `graphEditJournal` + `phraseJournalEntry`; injects "Manual corrections to preserve:" block (with `(none)` empty-case)
- `app/tests/services/graph-edit-journal.test.mjs` — 299 lines; 21 tests covering append/list/popNewest/clear, N=10 retention, localStorage persistence + reload survival, QuotaExceededError handling, isValidPreImage shape checks
- `app/tests/services/reorg-prompt-journal-injection.test.mjs` — 142 lines; 8 source-reading invariants asserting the prompt builder imports the journal, calls `phraseJournalEntry`, and contains the expected literal markers in the right position

## Decisions Made

- **Reused unified `GRAPH_UPDATED` event** — added optional `payload: { kind, anchorId? }` rather than introducing parallel events (CLAUDE.md rule: "Don't reintroduce CLASSIFICATION_COMPLETED... extend GRAPH_UPDATED with a payload field instead of adding a parallel event").
- **localStorage key `trellis_graph_edit_log`** — Trellis brand prefix per the CLAUDE.md i18n + storage convention.
- **N=10 FIFO via slice(-MAX_ENTRIES) at save time** — simpler than checking on append; caps quota usage at ~10 KB.
- **`(none)` empty-case literal** — keeps the reorg prompt byte-stable across the empty→first-edit transition so provider KV-cache (Phase 35 discipline) doesn't break on the first manual correction.
- **Leaf-module isolation** — `graph-edit-journal.service.ts` only imports the `GraphEditLogEntry` type. No transitive deps on settings/llm-provider/locales bundles so `node --test` can import it directly (same pattern as `refill-mutex.ts`).

## Deviations from Plan

None — plan executed exactly as written. TDD ordering preserved on tasks 2/3 (collapsed to one RED + one GREEN since the modules co-change) and task 4 (independent RED + GREEN).

## Issues Encountered

- **Pre-existing test failures discovered.** Running `cd app && npm test` after task 4 surfaced 4 failures across 3 files (`tests/concept-feed.test.mjs`, `tests/services/trellis-state.test.mjs`, `tests/services/trellis-replant.test.mjs`). Verified via `git stash` of all Plan 48-01 changes that these failures predate this plan and have unrelated root causes (stale fixture dates, removed `buildFallbackPosts` export). Documented in `deferred-items.md` alongside this SUMMARY; **not addressed in Phase 48** per executor scope-boundary rule.

## Next Phase Readiness

- Plan 48-02 can now `import { graphEditJournal, GraphEditLogEntry } from './graph-edit-journal.service'` for its rename/move/delete command appends.
- The reorg-prompt injection point is live — once verb commands start writing journal entries (Plans 48-02/03), the next `reorganizeMindmap` call will see them as constraints.
- Backwards-compat: every existing `eventBus.emit({ type: 'GRAPH_UPDATED' })` call site keeps working since `payload` is optional.

## Self-Check: PASSED

- ✅ All 29 Plan 48-01 tests pass (`cd app && node --test tests/services/graph-edit-journal.test.mjs tests/services/reorg-prompt-journal-injection.test.mjs`)
- ✅ Full suite: 981/985 pass — the 4 failing tests are pre-existing and documented in `deferred-items.md` with stash-verified non-causation
- ✅ Atomic commits with conventional-commit format (feat/test prefixes; phase-plan scope `48-01`)
- ✅ All `must_haves.truths` from plan frontmatter satisfied (journal persistence across reload; `Manual corrections to preserve:` block byte-stable when journal unchanged; `(none)` literal present in empty case; undo strategy preserved for Plan 48-04 — no `cmd:'undo'` literal introduced)
- ✅ All `key_links` patterns present (`graphEditJournal.list()` ref in canonical-knowledge.service.ts; `trellis_graph_edit_log` key ref in graph-edit-journal.service.ts)

---
*Phase: 48-graph-command-service-and-trust-invariants*
*Completed: 2026-05-17*
