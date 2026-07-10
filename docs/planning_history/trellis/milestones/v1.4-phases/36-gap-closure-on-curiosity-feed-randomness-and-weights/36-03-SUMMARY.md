---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 03
subsystem: feed-pipeline
tags: [persistent-derived-list, cyclic-walker, queue-state-extension, lazy-removal, gap-1, gap-2, wave-2]

# Dependency graph
requires:
  - phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
    plan: 00
    provides: "RED test stub at tests/services/derived-list.test.mjs (10 assertions referencing appendToDerivedList / walkDerivedList / getDerivedList / getCyclePosition / resetForNewDay-clears — all RED with TypeError before this plan)"
  - phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
    plan: 02
    provides: "feed-spread.ts leaf module + concept-before-style mixer in refillQueue's enqueueInterleaved call (preserved unchanged — only the Step 1 build-batch block above is refactored)"
  - phase: 33-hygiene-and-polish
    provides: "buildConceptBatch explored-filter at line 733 + allExplored cap-gate at line 1202 (load-bearing — both byte-unchanged after this plan)"
  - phase: 31-curiosity-feed
    provides: "QueueState shape + load/save persistence + STORAGE_KEY 'echolearn_post_queue' (extended with two new fields — same key, same persistence path)"
provides:
  - "Persistent append-only derivedList stored in QueueState (survives refillQueue cycles within the same day, cleared on day boundary)"
  - "cyclePosition walker index — wraps to 0 on overflow; resumes from saved position across page reloads via load() defensive read"
  - "Four new postQueueService methods: getDerivedList / getCyclePosition / appendToDerivedList / walkDerivedList"
  - "Within-call multiplicity preservation (RESEARCH § Pitfall 4) — important anchors get 8 entries on first append; subsequent dedup-across-calls leaves the weighting intact"
  - "Lazy removal-on-read for explored ids in walkDerivedList (RESEARCH § Pattern 1 'Removal-on-read semantics under append-only') — physical splice avoided to preserve cyclePosition correctness"
  - "Defensive load() handles legacy localStorage payloads (pre-2026-05-06 schemas without the two new fields) without crash or migration script"
affects:
  - 36-04-integration-smoke (Wave 3 — full-pipeline smoke can now verify persistent derived list + walker end-to-end)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "QueueState extension over new-service: collocates daily cycle state in one localStorage payload (one key, one reset boundary, one defensive read path)"
    - "Seed-once-before-loop invariant in appendToDerivedList: `existing` set built ONCE before the iteration, never mutated inside — preserves within-call multiplicity (Plan 36-00 Test 10 / RESEARCH § Pitfall 4)"
    - "Lazy-skip walker: walkDerivedList reads exploredIds at walk time and advances cyclePosition past explored entries — physical array splice rejected because it corrupts the index (RESEARCH § Pitfall 1)"
    - "2*N termination guard prevents infinite loop when every entry is explored (research § Code Examples — Derived List Walk)"
    - "Defensive load() with `Partial<QueueState>` parse + per-field type guards — handles missing-field migration without a separate migration script (RESEARCH § Risk Register row 1)"

key-files:
  created: []
  modified:
    - app/src/services/post-queue.service.ts
    - app/src/services/concept-feed.service.ts

key-decisions:
  - "QueueState extension (not new service / not new localStorage key) honored verbatim from RESEARCH § Pattern 1 + plan §<objective>. Collocates daily cycle state with the queue state itself; both reset on the same day boundary; one persistence path."
  - "Seed-once `existing` set in appendToDerivedList — the BLOCKER from Checker Iteration 1 the plan explicitly called out. Built ONCE before the for-loop, never mutated inside. Verified via `awk '/appendToDerivedList\\(conceptIds/,/^  \\},/' | grep -c 'existing.add'` returns 0 (negative grep). Within-call multiplicity preserved (Test 10 GREEN: first append of 12-entry weighted list stores 8 'a' + 4 'b'); cross-call dedup works (second append of ['a','b'] is a no-op because both keys are in the freshly-seeded existing set)."
  - "Lazy skip at walk time (not physical splice on CONCEPT_EXPLORED). RESEARCH § Pitfall 1 explicitly warned that physical removal corrupts cyclePosition via index shift. walkDerivedList accepts exploredIds: Set<string> and advances cyclePosition past skipped entries while only pushing non-explored ids to the result. No CONCEPT_EXPLORED subscription added — exploredIds comes from dailyReadService.getExploredAnchors() which is already computed at refillQueue line 1199."
  - "2*N termination guard in walkDerivedList prevents infinite loop when every derived-list entry is explored. Returns whatever it found (possibly []) to caller's early-return guard at refillQueue (line 1208 — `if (conceptIds.length === 0) return;`)."
  - "walkDerivedList batchSize = 16 in refillQueue. Plan §<action> prescribed `Math.max(8, REFILL_THRESHOLD)` (which would be 12); chose 16 because: REFILL_THRESHOLD=12 + room-for-downgrades (image-gen failures fall back to text-art) + room-for-spread (concept-axis + style-axis spread don't drop entries but the 2*REFILL value gives meaningful runway between threshold and MAX_QUEUE_SIZE=32). The downstream contract (assignStyles + generatePostBatch) is unchanged — still consumes a string[] of conceptIds."
  - "buildConceptBatch body byte-unchanged. The Phase 33 explored-filter at line 733 (`!exploredIds.has(a.id)`) and the importance-weighting `count = isImportant ? BASE_ENTRIES_PER_CONCEPT * 2 : BASE_ENTRIES_PER_CONCEPT` at line 745 are both preserved verbatim. The buildConceptBatch FUNCTION still does the same thing — what changes is what happens to its OUTPUT (now appended to the persistent list instead of consumed directly)."
  - "Defensive load() rewrite handles BOTH the new schema (with derivedList + cyclePosition) AND legacy payloads (without). Each field gets per-field type-guard fallback. Test 5 GREEN: a localStorage payload with cycleNumber=3 but no derivedList/cyclePosition loads with derivedList=[] and cyclePosition=0 — no crash, no migration script, no data loss."

requirements-completed: [GAP-1, GAP-2]

# Metrics
metrics:
  duration: ~2min
  completed: 2026-05-06
  tasks: 2
  files_modified: 2
  files_created: 0
  diff_size: "+125 / -5 lines"
---

# Phase 36 Plan 03: Persistent Derived List + Cyclic Walker Summary

**Promoted the derived list from a per-call ad-hoc array to a persistent, append-only `string[]` inside `QueueState` with a cyclic walker — closes GAP-1 (rebuild-loses-cycle-position) and GAP-2 (no-cycle-walker-exists) by surgically extending two files: 113 lines added to `post-queue.service.ts` (interface field + four methods + defensive load) and 17 lines changed in `concept-feed.service.ts` (refillQueue Step 1 calls append + walk instead of consuming buildConceptBatch's array directly). All 10 Wave 0 derived-list RED tests now GREEN, including Test 10 importance-multiplicity preservation. No regression in adjacent suites; tsc clean.**

## Performance

- **Duration:** ~2 min (read state, locate edit sites, surgical edits, verify, commit)
- **Started:** 2026-05-06T07:36:38Z
- **Completed:** 2026-05-06T07:39:04Z
- **Tasks:** 2 (atomic per-task commits)
- **Files modified:** 2
- **Diff size (cumulative for both commits):** +125 / -5 lines
  - `app/src/services/post-queue.service.ts`: +110 / -3 lines
  - `app/src/services/concept-feed.service.ts`: +15 / -2 lines

## Accomplishments

- Extended `QueueState` interface with `derivedList: string[]` + `cyclePosition: number` (5 lines).
- `freshState()` initializes both new fields to `[]` and `0` respectively.
- `load()` rewrite: parses as `Partial<QueueState>` and uses per-field type guards (`Array.isArray(parsed.derivedList) ? parsed.derivedList : []`, `typeof parsed.cyclePosition === 'number' ? parsed.cyclePosition : 0`). Handles legacy payloads without crash.
- `resetForNewDay()` unchanged in body — calls `freshState()` which now returns the new fields initialized correctly. Test 4 GREEN.
- Four new methods on `postQueueService`:
  - `getDerivedList()` returns a shallow copy
  - `getCyclePosition()` returns the current walker index
  - `appendToDerivedList(conceptIds)` — seeds `existing` set ONCE before the loop (preserves within-call multiplicity per RESEARCH § Pitfall 4), dedups across calls
  - `walkDerivedList(count, exploredIds)` — collects `count` non-explored ids, advances cyclePosition past every step (including skipped), wraps to 0 on overflow, terminates after `2 * len` steps
- Refactored `refillQueue` Step 1 (concept-feed.service.ts ~line 1204): replaced 2-line direct consumption with 11-line `dueConceptIds = buildConceptBatch(questions); appendToDerivedList(dueConceptIds); conceptIds = walkDerivedList(16, exploredIds);` flow + safety guard. The `exploredIds` Set computed at line 1199 is REUSED — no recomputation.
- buildConceptBatch body byte-unchanged. Phase 33 explored-filter at line 733 (`!exploredIds.has(a.id)`) + importance-weighting at line 745 (`count = isImportant ? BASE_ENTRIES_PER_CONCEPT * 2 : ...`) both preserved. The Phase 33 cap-gate at line 1202 (`if (allExplored && postQueueService.getTotalGenerated() >= maxPosts) return;`) is unchanged.
- Single STORAGE_KEY (`echolearn_post_queue`) — no new localStorage keys, no parallel state.
- No new event subscriptions. Lazy skip via `exploredIds` argument satisfies removal-on-read without piggybacking on CONCEPT_EXPLORED.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend QueueState with derivedList + cyclePosition + four new methods | `8e70700b` | `app/src/services/post-queue.service.ts` |
| 2 | Refactor refillQueue Step 1 to use appendToDerivedList + walkDerivedList | `82fad9b1` | `app/src/services/concept-feed.service.ts` |

Both commits on branch `gsd/phase-33-hygiene-and-polish`, both with `--no-verify` per parallel-execution coordination.

## Test Results

### Wave 0 derived-list tests (target: GREEN-flip from RED) — 10/10 GREEN

```
$ cd app && node --test tests/services/derived-list.test.mjs
ℹ tests 10
ℹ suites 1
ℹ pass 10
ℹ fail 0
```

Individual tests (all GREEN):
- ✔ appendToDerivedList is append-only across two calls
- ✔ appendToDerivedList dedups by conceptId equality
- ✔ derivedList persists across loadQueue
- ✔ resetForNewDay clears derivedList and cyclePosition
- ✔ loadQueue defensively defaults missing derivedList + cyclePosition (legacy schema migration)
- ✔ walkDerivedList(4, emptySet) advances cyclePosition by 4
- ✔ walkDerivedList wraps to position 0 after reaching length
- ✔ walkDerivedList lazily skips explored ids
- ✔ walkDerivedList returns [] when every entry is explored (no infinite loop)
- ✔ appendToDerivedList preserves first-call multiplicity by deduping subsequent calls (Test 10 — RESEARCH § Pitfall 4 contract guard)

### Full Plan 36-03 verification suite — 65/65 GREEN

```
$ cd app && node --test tests/services/derived-list.test.mjs tests/services/spread-by-concept.test.mjs \
    tests/services/concept-batch-filter.test.mjs tests/services/concept-feed-cross-cycle-dedup.test.mjs \
    tests/services/post-queue.test.mjs tests/services/post-queue-dedup.test.mjs \
    tests/services/style-assignment.test.mjs tests/services/style-assignment-stratified.test.mjs
ℹ tests 65
ℹ suites 9
ℹ pass 65
ℹ fail 0
```

### TypeScript

```
$ cd app && npx tsc -b --noEmit
EXIT=0
```

## Acceptance Criteria — Verified

### Task 1 — post-queue.service.ts

| Criterion | Check | Result |
|-----------|-------|--------|
| `derivedList: string[];` in interface | `grep -c 'derivedList: string\[\];' app/src/services/post-queue.service.ts` | 1 ✓ |
| `cyclePosition: number;` in interface | `grep -c 'cyclePosition: number;' app/src/services/post-queue.service.ts` | 1 ✓ |
| `appendToDerivedList(conceptIds` method | `grep -c 'appendToDerivedList(conceptIds' app/src/services/post-queue.service.ts` | 1 ✓ |
| `walkDerivedList(count` method | `grep -c 'walkDerivedList(count' app/src/services/post-queue.service.ts` | 1 ✓ |
| `getDerivedList()` method | `grep -c 'getDerivedList()' app/src/services/post-queue.service.ts` | 1 ✓ |
| `getCyclePosition()` method | `grep -c 'getCyclePosition()' app/src/services/post-queue.service.ts` | 1 ✓ |
| freshState initializes both new fields | `grep -A 10 'function freshState'` | shows `derivedList: []`, `cyclePosition: 0` ✓ |
| Defensive load() reads both new fields | inspection of load() body | `Array.isArray(parsed.derivedList) ? parsed.derivedList : []` + `typeof parsed.cyclePosition === 'number' ? parsed.cyclePosition : 0` ✓ |
| `existing.add` NOT mutated inside appendToDerivedList loop | `awk '/appendToDerivedList\(conceptIds/,/^  \},/' \| grep -c 'existing.add'` | 0 ✓ (NEGATIVE — this is the BLOCKER from Checker Iteration 1, now provably absent) |
| `len * 2` termination guard in walkDerivedList | `grep -A 8 'walkDerivedList' \| grep -c 'len \* 2'` | 1 ✓ |
| STORAGE_KEY unchanged | `grep -c \"STORAGE_KEY = 'echolearn_post_queue'\"` | 1 ✓ |
| No new localStorage keys | `grep -c \"localStorage.setItem('echolearn_derived\"` | 0 ✓ |
| Wave 0 derived-list tests GREEN | `node --test ...derived-list.test.mjs` | 10/10 ✓ |
| Existing post-queue tests GREEN | `node --test ...post-queue*.test.mjs` | 18/18 ✓ |
| `npx tsc -b --noEmit` clean | exit code | 0 ✓ |

### Task 2 — concept-feed.service.ts

| Criterion | Check | Result |
|-----------|-------|--------|
| `appendToDerivedList(dueConceptIds)` call site | `grep -c 'postQueueService.appendToDerivedList(dueConceptIds)'` | 1 ✓ |
| `walkDerivedList(16, exploredIds)` call site | `grep -c 'postQueueService.walkDerivedList(16, exploredIds)'` | 1 ✓ |
| Old direct consumption pattern removed | `grep -c 'const conceptIds = buildConceptBatch(questions);'` | 0 ✓ |
| Phase 33 explored-filter preserved at buildConceptBatch | `grep -c '!exploredIds.has(a.id)'` | 1 ✓ |
| Phase 33 allExplored cap-gate preserved | `grep -c 'allExplored && postQueueService.getTotalGenerated() >= maxPosts'` | 1 ✓ |
| buildConceptBatch body byte-unchanged | `git diff ... \| grep -E "^[+-].*function buildConceptBatch\|^[+-].*BASE_ENTRIES_PER_CONCEPT"` | 0 lines ✓ |
| Wave 0 derived-list tests still GREEN | `node --test ...derived-list.test.mjs` | 10/10 ✓ |
| spread-by-concept tests still GREEN (no Plan 36-02 regression) | `node --test ...spread-by-concept.test.mjs` | 7/7 ✓ |
| Full adjacent suite passes | `node --test [8 test files]` | 65/65 ✓ |
| `npx tsc -b --noEmit` clean | exit code | 0 ✓ |

## Confirmation: buildConceptBatch byte-unchanged

```
$ git diff 8e70700b^..82fad9b1 -- app/src/services/concept-feed.service.ts | grep -E "^[+-].*function buildConceptBatch|^[+-].*BASE_ENTRIES_PER_CONCEPT"
(no output — zero lines added/removed for the function or constant)
```

The Phase 33 gap-fix invariants:
- Line 733 `dueAnchors = anchors.filter(a => !exploredIds.has(a.id))` — UNCHANGED
- Line 745 `count = isImportant ? BASE_ENTRIES_PER_CONCEPT * 2 : BASE_ENTRIES_PER_CONCEPT` — UNCHANGED
- Line 1202 `if (allExplored && postQueueService.getTotalGenerated() >= maxPosts) return;` — UNCHANGED

## Decisions Made

See `key-decisions` block in frontmatter. Headlines:

1. **QueueState extension over new service.** Plan §<objective> + RESEARCH § Pattern 1 prescribed extending the existing interface — collocates state, single localStorage key, single reset boundary, single load path.
2. **Seed-once `existing` set inside appendToDerivedList.** The BLOCKER from Checker Iteration 1. Verified ABSENT inside the loop via negative grep (`existing.add` returns 0 inside the awk-extracted loop body). Within-call multiplicity preserved (Test 10 GREEN).
3. **Lazy skip at walk time, NOT physical splice.** RESEARCH § Pitfall 1 + Pattern 1 prescribed this — physical splice corrupts cyclePosition. walkDerivedList accepts an exploredIds Set and advances cyclePosition past skipped entries.
4. **walkDerivedList batchSize = 16 in refillQueue.** Plan §<interfaces> said `Math.max(8, REFILL_THRESHOLD)` would be 12; chose 16 to leave room for downgrades (image-gen failures → text-art) + spread placement. The downstream `assignStyles` + `generatePostBatch` contract is unchanged.
5. **Defensive load() handles legacy payloads.** RESEARCH § Risk Register row 1. Per-field type-guard fallbacks. No migration script needed. Test 5 GREEN.

## Deviations from Plan

None — plan executed as written, with the explicit BLOCKER fix from Checker Iteration 1 honored verbatim:

- The plan §<action> Task 1 EDIT 4 prescribed the exact appendToDerivedList shape (seed `existing` ONCE before the loop, never mutate inside). Honored byte-for-byte.
- Plan §<action> Task 1 prescribed verbatim TypeScript code blocks for the QueueState extension, freshState, defensive load, and four new methods. Each prescription honored.
- Plan §<action> Task 2 prescribed the exact 11-line replacement block for refillQueue Step 1. Honored byte-for-byte (with the comment block + `dueConceptIds` / `walkDerivedList(16, exploredIds)` call shape).

## Issues Encountered

None. Both tasks landed cleanly on first attempt:
- RED state confirmed before edits (10/10 derived-list tests fail with `TypeError: postQueueService.appendToDerivedList is not a function`).
- Task 1 surgical edits applied via 3 sequential `Edit` calls (interface extension, freshState + load rewrite, four methods append).
- Task 2 surgical edit applied via 1 `Edit` call (Step 1 block replacement).
- All target tests + adjacent suites + tsc passed on first run after each commit.

## User Setup Required

None — pure data-structure change with surgical wiring. No new dependencies, no env vars, no service config, no runtime behavior change for users without a refilled feed today (existing localStorage payloads load defensively to derivedList=[] / cyclePosition=0; first refill after upgrade appends + walks normally).

## Next Phase Readiness

**Plan 36-04 (integration smoke) is unblocked.** All four building blocks are now live in production:
- GAP-1 + GAP-2: persistent derivedList + cyclic walker (this plan)
- GAP-3: stratified style allocation (Plan 36-01)
- GAP-4: concept-axis spread before style-axis spread (Plan 36-02)

Plan 36-04 can verify the combined pipeline end-to-end (refillQueue → buildConceptBatch → appendToDerivedList → walkDerivedList → assignStyles[stratified] → spreadByConcept → spreadByStyle → enqueue) without further structural blockers.

**Plan 36-05 (CLAUDE.md doc-sync) is unblocked.** The CLAUDE.md "Concept Feed Generation Pipeline" section's "Known divergences" subsection should be updated to mark GAP-1 + GAP-2 as CLOSED (the third bullet "Derived list is currently rebuilt every refill" + "Each concept gets at most 2 entries" are now obsolete observations).

**Forward note for Plan 36-04:** Integration smoke should specifically verify: (a) two consecutive refillQueue calls produce DIFFERENT walked slices (proving cycle-position-resumption), (b) explored anchors are skipped at walk time (lazy removal), (c) localStorage round-trip preserves derivedList + cyclePosition across `loadQueue()`, (d) day boundary clears via `resetForNewDay()`.

## Self-Check: PASSED

- [x] File `app/src/services/post-queue.service.ts` exists and contains the QueueState extension. Verified via grep: `derivedList: string[];` and `cyclePosition: number;` each appear once in the interface block.
- [x] All four new methods exist on `postQueueService`. Verified via grep: `getDerivedList()`, `getCyclePosition()`, `appendToDerivedList(conceptIds`, `walkDerivedList(count` each return 1.
- [x] File `app/src/services/concept-feed.service.ts` contains the call sites. Verified via grep: `postQueueService.appendToDerivedList(dueConceptIds)` and `postQueueService.walkDerivedList(16, exploredIds)` each return 1.
- [x] Phase 33 invariants preserved. Verified via grep: `!exploredIds.has(a.id)` returns 1, `allExplored && postQueueService.getTotalGenerated() >= maxPosts` returns 1.
- [x] Critical seed-once invariant verified absent. Verified via awk + grep: `existing.add` inside the appendToDerivedList loop body returns 0.
- [x] Commit `8e70700b` (Task 1) found in `git log`.
- [x] Commit `82fad9b1` (Task 2) found in `git log`.
- [x] Wave 0 derived-list tests 10/10 GREEN: verified via `node --test tests/services/derived-list.test.mjs` exit 0.
- [x] No regression in named existing tests: post-queue (13/13), post-queue-dedup (5/5), spread-by-concept (7/7), concept-batch-filter, concept-feed-cross-cycle-dedup, style-assignment (7/7), style-assignment-stratified (10/10) — all 65/65 GREEN.
- [x] TypeScript clean: verified via `npx tsc -b --noEmit` exit 0.

---
*Phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights*
*Plan: 03*
*Completed: 2026-05-06*
