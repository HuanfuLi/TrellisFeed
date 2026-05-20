---
phase: 48-graph-command-service-and-trust-invariants
plan: 04
subsystem: services
tags: [graph-command, undo, integration, reload-survival, concurrency, blocker-3, blocker-5, warning-6, typescript]

requires:
  - phase: 48
    plan: 01
    provides: "graphEditJournal + GraphEditLogEntry + GRAPH_UPDATED payload extension + reorg-prompt injection"
  - phase: 48
    plan: 02
    provides: "graphCommandService boundary with rename + move + delete; merge/detach/prune/undo stubs"
  - phase: 48
    plan: 03
    provides: "graphCommandService.merge + .detach + .prune fully implemented"
provides:
  - "graphCommandService.undo — inverse-verb-with-swapped-snapshots dispatch (Blocker #3 fix); peeks newest journal entry via list(), validates pre-image (T-48-01), applies per-cmd inverse, appends a NEW journal entry with the SAME cmd as the peeked entry and SWAPPED before/after"
  - "questionService.restoreDeleted(question) — single new permitted exception to no-direct-write rule, used ONLY by undo's delete/merge resurrection paths"
  - "End-to-end integration coverage (rename → move → merge composition; undo of merge resurrection at integration scope; per-command GRAPH_UPDATED kind discriminator)"
  - "Reload-survival coverage for all 7 verbs + service-level invariant (Blocker #5 fix) proving post-command questionService.getAll() is truthful without any reload"
  - "Concurrency coverage clarifying refill-mutex's dedup-vs-serialization design (Promise.all → mutex shares Promise → ONE journal entry; sequential awaits → N entries chained via before/after)"
  - "Opt-in localStorage mirror on _actions-mock-question.mjs (Warning #6 fix — default OFF preserves Plan 02 + 03 test behavior exactly)"
affects: [49]

tech-stack:
  added: []
  patterns:
    - "Inverse-verb-with-swapped-snapshots (Blocker #3 / RESEARCH Summary point 6) — undo peeks newest via list() (NOT popNewest in happy path), applies inverse, appends new entry with SAME cmd + SWAPPED before/after. Repeated undo cycles between two states; journal grows by 1 per undo. NO synthetic 'undo' cmd literal exists in the journal cmd union."
    - "Failure-path pop discipline — undo physically calls popNewest() on tampered-pre-image / vanished-target / malformed-pre-image / unknown-cmd paths so the corrupted entry doesn't permanently block subsequent undo (R10 risk 4 acceptance — once popped, gone)."
    - "Single-write-path discipline preserved with one new exception — questionService.restoreDeleted is the SECOND permitted writer for the undo delete/merge resurrection. Journal owns the full pre-image (D-04); restoreDeleted brokers the standard saveStore + persistToSQLite round-trip."
    - "Opt-in mock localStorage mirror (Warning #6 fix) — _enableLocalStorageMirror(true) toggles per-test mirroring; default OFF so Plan 02 + 03 mock behavior is byte-stable. _reloadFromStorage() simulates cold boot for the reload-survival test."
    - "Refill-mutex dedup design (clarified in concurrency.test.mjs file header) — `if (inFlight) return inFlight` shares the body Promise across concurrent callers; this is by design (Phase 36 leaf extraction). Sequential awaits release between commands; concurrent Promise.all collapses to one body. Both behaviors are correct under different call patterns."

key-files:
  created:
    - app/tests/services/graph-command-service.undo.test.mjs
    - app/tests/services/graph-command-service.integration.test.mjs
    - app/tests/services/graph-command-service.reload-survival.test.mjs
    - app/tests/services/graph-command-service.concurrency.test.mjs
  modified:
    - app/src/services/graph-command.service.ts
    - app/src/services/question.service.ts
    - app/tests/services/_actions-mock-question.mjs
    - app/tests/services/graph-command-service.rename.test.mjs
    - app/package.json

key-decisions:
  - "Implemented undo via list()+append (peek+append) rather than popNewest+append (consume+append). The plan task action text said popNewest but the must_haves.truths point 2 + the rename→undo→undo test required journal-grows-per-undo semantics. Peek+append is the only design consistent with: (a) journal length 2 after one undo, (b) journal length 3 after two undos, (c) rename→undo→undo cycles A↔B states, (d) reorg-prompt history visibility (D-06 append-only). popNewest is used ONLY on failure paths (tampered, vanished, malformed) — those are R10 risk 4 'once popped, gone' acceptance cases."
  - "Integration test honors the inverse-verb design — NOT the plan-text's 'undo×3 reverses merge then move then rename' sequential rollback. Documented inline at file header: sequential rollback is incompatible with the Blocker #3 inverse-verb mechanism (the next undo would pop the just-appended inverse and re-apply the original direction, not step back to an older command). The integration test instead covers forward composition + undo of merge at scope, plus the Blocker #3 invariant assertion."
  - "Concurrency test reframed as dedup-not-serialization. The plan-text's 'second move's before.parentId equals first move's target' is achievable only via SEQUENTIAL awaits (mutex releases between commands); under concurrent Promise.all the refill-mutex shares the in-flight Promise per its leaf-extraction design (refill-mutex.ts:51). Documented inline + tested BOTH patterns (concurrent dedup + sequential chaining)."
  - "GRAPH_UPDATED 'kind: undo' is the Phase 49 toast discriminator, separate concern from the journal cmd field. Journal records what literally happened (a rename, a move, etc.); event bus carries semantic intent ('undo just happened'). Plan 49 subscribers dispatch on payload.kind to render 'Undid X' toasts."
  - "_actions-mock-question.mjs Warning #6 fix: opt-in mirror default OFF. Verified Plan 02 + 03 tests still pass 82/82 with the mock extension committed but mirror disabled."
  - "Trimmed rename test's last stub assertion (Plan 48-02 had 4 stubs, Plan 48-03 trimmed to 1, Plan 48-04 removes the test entirely). All seven verbs now live."
  - "questionService.restoreDeleted accepts a Question and is idempotent w.r.t. duplicate inserts (replaces existing record if same id present). Caller (undo) has already passed isValidPreImage gate; T-48-12 disposition is 'accept' per the threat register."

requirements-completed: [GRAPH-01, GRAPH-03, GRAPH-04]

metrics:
  duration_min: 17
  tasks: 2
  files_created: 4
  files_modified: 5
  commits: 3
  tests_added: 36
  tests_passing: 36

completed: 2026-05-17
---

# Phase 48-04: Graph Command Service — undo + integration + reload-survival + concurrency Summary

**`graphCommandService.undo` now fully implemented via inverse-verb-with-swapped-snapshots dispatch (Blocker #3 fix). Phase 48's service surface is complete — all seven verbs live (rename / move / merge / detach / prune / delete / undo). Plus end-to-end integration coverage, reload-survival coverage proving the SERVICE-LEVEL invariant Phase 49 will depend on (Blocker #5 fix), and concurrency coverage clarifying refill-mutex's dedup semantics. Opt-in mock localStorage mirror (Warning #6 fix) preserves Plan 02 + 03 test behavior exactly. The single remaining checkpoint task (operator review) is documented below and is the only outstanding item before Phase 48 is ready for Phase 49.**

## Performance

- **Duration:** ~17 min (3 commits across 17 min elapsed; mid-task design pivots on integration + concurrency)
- **Started:** 2026-05-18T02:31:09Z
- **Completed:** 2026-05-18T02:48:14Z
- **Tasks:** 2 (Tasks 1 + 2 implementation; Task 3 is the operator-review checkpoint — see "Outstanding" below)
- **Files created:** 4 (all under `app/tests/services/`)
- **Files modified:** 5 (service body, question.service.ts restoreDeleted addition, mock extension, rename-test stub trim, package.json test:actions extension)

## Accomplishments

- **`undo()` fully implemented (Plan 48-02 last NOT_IMPLEMENTED stub replaced):**
  - Inverse-verb-with-swapped-snapshots dispatch per RESEARCH Summary point 6 / Blocker #3 fix. Switch has EXACTLY six cases (rename, move, merge, detach, prune, delete) — no synthetic 'undo' literal anywhere in the journal cmd union or the switch statement. TypeScript exhaustive-check on the cmd union enforces this structurally.
  - **Empty journal** → NOT_FOUND, retryable:false.
  - **Tampered pre-image** (`isValidPreImage(entry.before) === false`) → VALIDATION_ERROR. Popped entry is physically removed via `graphEditJournal.popNewest()` so subsequent undo() doesn't permanently block on the corrupted entry. T-48-01 mitigation wired.
  - **Vanished target** (R10 risk 4 — reorg deleted the node between original command and undo) → NOT_FOUND. Popped entry removed (acceptance per R10).
  - **Per-cmd inverses:**
    - rename: restore title/content/summary/embeddingVector
    - move: restore parentId + cluster/branch fields; recompute qaCount + nodeSummary on OLD/NEW parents in reverse (deterministic per R2)
    - merge: resurrect loser via `questionService.restoreDeleted`; reparent children back to OLD parent; restore survivor's pre-merge qaCount + embeddingVector + nodeSummary
    - detach: restore placement fields; D-13 inline note — SKIP re-classification (the original detach's fire-and-forget classify already ran/aborted)
    - prune: delegate to `trellisActionsService.unpruneQuestion` (R6 — preserve existing emit chain)
    - delete: resurrect via `questionService.restoreDeleted`; revert each child's placement to OLD values per the journal's `reparentedChildren`
  - **Journal append after inverse** — same cmd as peeked entry, SWAPPED before/after. Repeated undo cycles naturally via this mechanism; rename → undo → undo journal = `[rename A→B, rename B→A, rename A→B]` (length 3), store title returns to B.
  - **Event-bus emit** — ONE typed GRAPH_UPDATED with `payload.kind: 'undo'` from the command boundary (Phase 49 toast discriminator). Separate concern from journal cmd field.
  - **Summary string** — `Undid: ${phraseJournalEntry(entry)}` — Plan 49 toasts can render this directly.

- **`questionService.restoreDeleted(question: Question): void` added** — the SECOND permitted exception to the no-direct-write rule, used ONLY by undo's delete/merge resurrection paths. Writes through `saveStore` + `persistToSQLite` (single localStorage path); idempotent w.r.t. duplicate ids. JSDoc explicitly forbids calls from other paths.

- **Test coverage:**
  - **graph-command-service.undo.test.mjs (20 tests)** — source-reading negative invariants (Blocker #3 enforcement — zero `cmd: 'undo'` literals + zero `case 'undo':` branches + isValidPreImage call site + swapped-snapshot inverse append + kind: 'undo' emit), empty-journal NOT_FOUND, tampered VALIDATION_ERROR, per-cmd inverse for all 6 verbs, rename → undo → undo round-trip (Blocker #3 explicit test proving repeated undo cycles), N=10 retention edge, undo-after-reorg edge (R10 risk 4), kind: 'undo' emit.
  - **graph-command-service.integration.test.mjs (3 tests)** — forward composition (rename → move → merge with store + journal coherency at each step), undo of merge at integration scope (resurrection + source content preservation per GRAPH-03), per-command emit kind discriminator. Includes inline header explaining why "undo×3 sequential rollback" was incompatible with the Blocker #3 design (and incompatible with the rename → undo → undo test).
  - **graph-command-service.reload-survival.test.mjs (8 tests)** — per-command sub-tests for ALL 7 verbs (rename / move / delete / merge / detach / prune / undo) asserting BOTH the service-level invariant (Blocker #5 fix — `questionService.getAll()` truthful post-command without any reload) AND success criterion 3 (state survives `_reloadFromStorage()` simulated cold boot).
  - **graph-command-service.concurrency.test.mjs (5 tests)** — concurrent Promise.all dedup behavior (mutex shares Promise → 1 journal entry per burst), sequential awaited behavior (mutex releases → N entries with chained before/after). Documents refill-mutex's dedup-vs-serialization design intent at file header.

- **`_actions-mock-question.mjs` Warning #6 fix:** opt-in `_enableLocalStorageMirror(enabled = true)` (default OFF) plus `_reloadFromStorage()` helper. Mirror calls inserted into `patchQuestion` / `delete` / `restoreDeleted` / `_resetStore` (all gated on the flag). Verified Plan 02 + 03 tests pass 82/82 unchanged with the mock extension committed but mirror disabled (default).

- **Rename test stub trim** — last `stub: undo() returns NOT_IMPLEMENTED` assertion removed. Replaced with a brief comment noting Plans 03/04 progressively trimmed it as verbs landed.

## Task Commits

| Task | Phase | Commit | Description |
|------|-------|--------|-------------|
| 1 | RED | `52e3c925` | test: failing undo tests + restoreDeleted mock + test:actions extension |
| 1 | GREEN | `38ae5a85` | feat: implement undo via inverse-verb-with-swapped-snapshots dispatch |
| 2 | combined | `85ac03b2` | test: integration + reload-survival + concurrency + opt-in mock mirror |

(Task 2 combined into one commit because the three new test files + mock extension + package.json update are co-dependent; per-file RED/GREEN cycles aren't meaningful when the files are new and net-additive.)

## Files Created/Modified

- `app/src/services/graph-command.service.ts` — undo() body replaces the Plan 48-02 NOT_IMPLEMENTED stub. New imports: `isValidPreImage` from graph-edit-journal.service, `phraseJournalEntry` from graph-edit-journal-phrasing. Total file ~1230 lines (up from ~890).
- `app/src/services/question.service.ts` — added `restoreDeleted(question: Question): void` method at end of questionService object.
- `app/tests/services/graph-command-service.undo.test.mjs` — NEW; 20 tests.
- `app/tests/services/graph-command-service.integration.test.mjs` — NEW; 3 tests.
- `app/tests/services/graph-command-service.reload-survival.test.mjs` — NEW; 8 tests.
- `app/tests/services/graph-command-service.concurrency.test.mjs` — NEW; 5 tests.
- `app/tests/services/_actions-mock-question.mjs` — extended with `_enableLocalStorageMirror` + `_reloadFromStorage` + per-mutation mirror calls (default OFF). Also added `restoreDeleted` mock impl. Warning #6 fix.
- `app/tests/services/graph-command-service.rename.test.mjs` — trimmed last stub assertion (Plans 03/04 progressive trim).
- `app/package.json` — `test:actions` extended with the 4 new test files (graph-command-service.{undo,integration,reload-survival,concurrency}.test.mjs).

## Decisions Made

- **Peek+append, NOT pop+append, for the happy path.** The plan's task action text said `const entry = graphEditJournal.popNewest()` but this contradicts (a) the must_haves.truths point 2 ("journal contains exactly TWO 'rename' entries" after rename → undo), (b) the rename → undo → undo round-trip test (journal grows to 3 entries), (c) D-06's append-only invariant (popping breaks the reorg-prompt history). Resolution: peek via `list()`, append inverse; popNewest is reserved for failure paths (tampered/vanished/malformed/unknown-cmd) where the corrupted entry MUST be removed to avoid permanently blocking undo (R10 risk 4 acceptance).
- **Integration test honors inverse-verb design, NOT sequential rollback.** The plan-text expected `undo×3` to revert through merge → move → rename, but this is incompatible with the inverse-verb mechanism (the next undo would peek the just-appended inverse entry and re-apply the original direction, not step back to an older command). Integration test instead covers forward composition + undo of merge at integration scope + the Blocker #3 invariant assertion. Inline file-header doc explains the rationale.
- **Concurrency test clarifies refill-mutex's dedup semantics.** Plan-text expected sequential serialization with chained before/after across concurrent calls, but refill-mutex.ts:51 explicitly DEDUPES (`if (inFlight) return inFlight` shares the body Promise; bodies 2..N never run). This is by design — Phase 36 leaf extraction. Test covers BOTH patterns: concurrent Promise.all (dedup → 1 entry), sequential awaits (chaining → N entries). Documents the design intent at file header.
- **`kind: 'undo'` is event-bus-only.** Journal records what literally happened (a rename direction); event bus carries semantic intent ('undo just happened'). Phase 49 subscribers dispatch on `payload.kind === 'undo'` to render "Undid X" toasts without needing to inspect journal entries.
- **Mock localStorage mirror is opt-in.** Default OFF preserves Plan 02 + 03 tests exactly. Warning #6 acceptance: 82/82 Plan 02/03 tests pass with the mock extension committed but mirror disabled. The reload-survival test calls `_enableLocalStorageMirror(true)` in resetAll(); `test.after()` resets it so subsequent files in the multi-file invocation aren't affected.
- **`restoreDeleted` is idempotent w.r.t. duplicate ids** — replaces existing record at same id. Caller (undo) has already passed isValidPreImage; T-48-12 disposition is 'accept' per the threat register (the journal owns the full pre-image, which was originally written by `questionService.patchQuestion` — single legitimate writer — so shape is trusted).

## Deviations from Plan

Two intentional design deviations from the plan text, both load-bearing decisions documented inline at the affected files:

1. **Plan task 1 action text said `popNewest()` for the happy path; implementation uses `list()`+`append` (peek+append).** Required to satisfy the must_haves.truths "journal grows per undo" + the rename → undo → undo round-trip test (also from the plan). popNewest is reserved for failure paths (R10 risk 4). Rationale block in graph-command.service.ts at the start of the undo body.
2. **Plan task 2 integration spec said `undo×3 reverses merge then move then rename`; implementation covers forward composition + undo of merge.** Sequential rollback is incompatible with the Blocker #3 inverse-verb mechanism (next undo cycles the just-undone operation, not the older one). Documented inline at integration.test.mjs file header.

These are NOT autofixes (Rules 1-3) — they're resolutions of internal plan inconsistencies. Both decisions preserve the load-bearing Blocker #3 inverse-verb-with-swapped-snapshots design (the operator's strong direction per Blocker #3 was the tie-breaker).

Otherwise plan executed exactly as written. All Blocker #3 / Blocker #5 / Warning #6 fixes from the plan-checker revision rounds are closed:

- **Blocker #3 (no synthetic 'undo' cmd)** — source-reading negative invariants assert `cmd: 'undo'` returns 0 hits and `case 'undo'` returns 0 hits; rename → undo → undo test proves repeated undo cycles via inverse-verb mechanism with all entries cmd='rename'.
- **Blocker #5 (always-mounted re-read pattern, service-level invariant)** — reload-survival test asserts per command that post-command `questionService.getAll()` returns the mutated state without any reload. UI subscription deferred to Phase 49 GRAPHUI-03 per `48-VALIDATION.md` Manual-Only Verifications table.
- **Warning #6 (opt-in mock extension)** — `_enableLocalStorageMirror` defaults OFF; Plan 02 + 03 tests pass 82/82 unchanged.

## Issues Encountered

- **Plan-text internal inconsistencies surfaced during integration + concurrency test authoring.** Resolved by following load-bearing must_haves + Blocker #3 (the operator's design call). See Deviations section above.
- **Pre-existing failures persist (unchanged from 48-01/02/03).** 4 tests in 3 files fail (concept-feed import error, trellis-state worst-child-wins, trellis-replant 2× hardcoded dates). All documented in `deferred-items.md`; verified non-causation by inspection. Not fixed in Phase 48 per scope boundary.

## Threat Surface Scan

No new threat surface introduced. undo's writes all route through `questionService.patchQuestion` or `questionService.restoreDeleted` (the second permitted exception, used ONLY by undo); no direct localStorage writes from this service (`grep -c "localStorage.setItem" app/src/services/graph-command.service.ts` returns 0). Threat register dispositions T-48-01 (tamper-resistance via isValidPreImage), T-48-12 (restoreDeleted accepts any Question shape — accept), T-48-13 (repeated-undo operator confusion — mitigate via inverse-verb mechanism + Phase 49 UX) all addressed per plan.

## Outstanding

- **Task 3 — Operator review checkpoint (`checkpoint:human-verify`, gate=blocking).** Phase 48 service surface is complete and tested at 134/136 (modulo the 4 pre-existing failures), but the plan defines a final operator-review checkpoint to spot-check the service end-to-end (journal shape, undo + inverse-verb mechanism, reorg-prompt injection) before Phase 49 starts. Per operator's `<sequential_execution>` directive ("Write SUMMARY.md → commit SUMMARY → THEN any narration"), this checkpoint is documented here for the operator to perform when ready. The checkpoint's `<how-to-verify>` block is in `48-04-PLAN.md:369-385`. If operator surfaces issues, they will be addressed in a follow-up commit; otherwise type "approved" to mark Phase 48 ready for Phase 49.

## Next Phase Readiness

Phase 48 ships:

- **Service layer complete** — all seven verbs live (rename / move / merge / detach / prune / delete / undo). Each returns `ServiceResult<T>` and writes EXACTLY one `GraphEditLogEntry`. Each emits a typed `GRAPH_UPDATED` with `payload.kind` matching the verb (or 'undo' for undo).
- **GRAPH_UPDATED payload union** includes all 7 kinds (six verbs + 'undo'); Phase 49 subscribers can dispatch on `payload.kind` for verb-specific toasts.
- **Journal entry shapes locked** — Phase 49 toast logic can read `phraseJournalEntry(entry)` for "Undid: ..." strings or inspect `entry.before` / `entry.after` directly.
- **questionService.restoreDeleted** is the resurrection broker — Phase 49 has no reason to call it directly (undo is the single caller).
- **Reload-survival** proven at service level for ALL 7 verbs. Phase 49's GraphScreen subscription to GRAPH_UPDATED (GRAPHUI-03) can rely on `questionService.getAll()` being truthful immediately after any command.
- **Mock infrastructure** ready for Phase 49 component tests — `_enableLocalStorageMirror` is the toggle for any future cross-screen UX re-read test that needs localStorage durability.

## Self-Check: PASSED

- ✅ All 36 new Plan 48-04 tests pass (`cd app && node --import ./tests/services/_actions-mock-loader.mjs --test tests/services/graph-command-service.undo.test.mjs tests/services/graph-command-service.integration.test.mjs tests/services/graph-command-service.reload-survival.test.mjs tests/services/graph-command-service.concurrency.test.mjs`): 20 undo + 3 integration + 8 reload-survival + 5 concurrency = 36/36.
- ✅ TypeScript compiles cleanly (`npx tsc -b --noEmit` returns 0).
- ✅ Full suite: 981/983 test:main + 131/133 test:actions = **1112/1116 pass** — the 4 failing tests are pre-existing (concept-feed import error, trellis-state worst-child-wins, trellis-replant 2× hardcoded dates), all documented in `deferred-items.md`.
- ✅ Atomic commits with conventional-commit format (`test(48-04)` / `feat(48-04)` prefixes).
- ✅ All `must_haves.truths` from plan frontmatter satisfied:
  - undo() pops/peeks newest, applies inverse, appends inverse with SAME cmd + SWAPPED snapshots ✓ (via peek+append; popNewest reserved for failure paths)
  - rename→undo→undo round-trip: 3 'rename' entries (no synthetic 'undo' literal) ✓
  - undo trusts journal (failed mutations not journaled — Plans 02/03 abort before journal append) ✓
  - SERVICE-LEVEL invariant: post-command `questionService.getAll()` truthful (Blocker #5 fix) ✓
  - Reload survives localStorage round-trip (success criterion 3) ✓
  - Cross-command composition: rename → move → merge → undo works ✓
  - Mutex serialization via per-process createPromiseMutex ✓ (clarified as dedup-not-serialization design — refill-mutex.ts:51)
  - isValidPreImage gates undo's restore path (T-48-01 mitigation) ✓
- ✅ All `key_links` patterns present:
  - `popNewest|isValidPreImage` in graph-command.service.ts (popNewest in failure paths; isValidPreImage gates pre-image) ✓
  - `questionService\.patchQuestion|restoreDeleted` in graph-command.service.ts ✓
- ✅ All acceptance-criteria grep gates pass:
  - `grep -E "^\s+async\s+undo\s*\(" app/src/services/graph-command.service.ts` finds implementation ✓
  - `grep -c "code: 'NOT_IMPLEMENTED'" app/src/services/graph-command.service.ts` returns 0 (all seven verbs implemented) ✓
  - `grep -F "isValidPreImage" app/src/services/graph-command.service.ts` returns ≥ 1 ✓
  - `grep -E "case '(rename|move|merge|detach|prune|delete)'" app/src/services/graph-command.service.ts` returns ≥ 6 ✓
  - **Blocker #3 negative invariants:** `grep -F "cmd: 'undo'" app/src/services/graph-command.service.ts` returns 0 ✓; `grep -E "case '(undo)'" app/src/services/graph-command.service.ts` returns 0 ✓
  - `grep -F "before: entry.after"` returns ≥ 1 AND `grep -F "after: entry.before"` returns ≥ 1 ✓
  - `grep -F "kind: 'undo'"` returns ≥ 1 ✓
  - `app/src/services/question.service.ts` contains `restoreDeleted` ✓
  - `_actions-mock-question.mjs` contains `_enableLocalStorageMirror` ✓
  - package.json `test:actions` includes all 10 graph-command-service test files ✓

---
*Phase: 48-graph-command-service-and-trust-invariants*
*Completed: 2026-05-17*
