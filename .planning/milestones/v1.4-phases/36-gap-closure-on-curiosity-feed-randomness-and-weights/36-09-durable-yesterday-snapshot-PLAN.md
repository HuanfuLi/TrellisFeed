---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 09
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/services/post-queue.service.ts
  - app/tests/services/post-queue-yesterday-snapshot.test.mjs
  - CLAUDE.md
autonomous: true
requirements: [GAP-D]
gap_closure: true
must_haves:
  truths:
    - "post-queue.service.ts:load() detects date mismatch AND copies the prior payload (non-empty posts only) to a NEW localStorage key (echolearn_post_queue_yesterday) BEFORE returning freshState()"
    - "getYesterdayQueue() now reads from STORAGE_KEY_YESTERDAY (the snapshot key), NOT the live STORAGE_KEY — so it is durable across multiple cold-start mounts of the new day"
    - "Subsequent save() calls of today's queue do NOT destroy the yesterday snapshot (different key)"
    - "Existing 70 Phase 36 quick-suite tests still pass; 1 new test file (post-queue-yesterday-snapshot.test.mjs) covers the snapshot lifecycle (7 tests including W-1 multi-step rollover, W-2 first-install graceful-empty, and I-2 resetForNewDay-preserves-snapshot contracts from checker iteration)"
    - "Phase 33 grep sentinels intact (`dueAnchors` filter, `allExplored && postQueueService.getTotalGenerated`)"
    - "Phase 35 grep sentinel intact (`USER_ACK_BEFORE_GRAPH_CONTEXT` constant)"
  artifacts:
    - path: app/src/services/post-queue.service.ts
      provides: "Durable yesterday snapshot via separate localStorage key"
      contains: "STORAGE_KEY_YESTERDAY"
    - path: app/tests/services/post-queue-yesterday-snapshot.test.mjs
      provides: "Behavioral coverage for the snapshot lifecycle (snapshot created on date-mismatch load; survives subsequent saves; getYesterdayQueue reads from snapshot key)"
    - path: CLAUDE.md
      provides: "New 'Numeric defaults' bullet documenting STORAGE_KEY_YESTERDAY + the durable snapshot pattern"
  key_links: []
---

# Plan 36-09 — Durable Yesterday Snapshot (GAP-D Fix A)

## Objective

Close GAP-D Fix A: make `getYesterdayQueue()` durable across multiple cold-start mounts of a new day by snapshotting yesterday's payload to a separate localStorage key BEFORE today's first `save()` overwrites it.

Without this fix, the warm-start path (Phase 36-06) is single-shot — it works only on the very first cold-start mount of a new day, before any `save()` writes today's date to the live queue key. After the first save, `getYesterdayQueue()` returns `[]` because the parsed date matches today.

## Background

See `.planning/debug/cold-start-warm-start-fragile.md` for the full diagnosis.

Live failure path:
1. Module import: `_state = load()` → date mismatch → returns `freshState()` (in-memory, no save). localStorage still holds yesterday data ✓
2. HomeScreen useState initializer at lines 38-47 calls `getYesterdayQueue()` → reads live key → date matches yesterday → returns posts ✓
3. `useEffect` triggers `getDailyPosts` → eventually `refillQueue` → `enqueue` → `save({date: today, ...})` ← **destroys yesterday's snapshot**
4. Second cold-start mount of the same new day: `getYesterdayQueue()` reads live key → date matches today → returns `[]`. Warm-start path fails silently.

The Phase 36-06 React-side guards are correct; the bug is upstream in `post-queue.service.ts`.

## Tasks

### Task 1 — Add STORAGE_KEY_YESTERDAY + snapshot logic in load()

**File:** `app/src/services/post-queue.service.ts`

**Action:**

1. Near the top of the file (after the existing `STORAGE_KEY` constant), add:
   ```typescript
   const STORAGE_KEY_YESTERDAY = 'echolearn_post_queue_yesterday';
   ```

2. In the `load()` function (lines 50-76), modify the date-mismatch branch. Current:
   ```typescript
   if (parsed.date !== today()) {
     // Date mismatch — return empty for today (warm-start handled by caller)
     return freshState();
   }
   ```
   
   Replace with:
   ```typescript
   if (parsed.date !== today()) {
     // Date mismatch — snapshot yesterday's payload to a separate key BEFORE
     // returning freshState. This makes getYesterdayQueue() durable across
     // multiple cold-start mounts of the new day; without it, the very first
     // save() of today's queue (in enqueue/markServed/etc.) overwrites the live
     // STORAGE_KEY with {date: today, ...} and yesterday's posts are lost. See
     // .planning/debug/cold-start-warm-start-fragile.md and CLAUDE.md
     // "Numeric defaults" for the durable-snapshot rationale.
     try {
       if (Array.isArray(parsed.posts) && parsed.posts.length > 0) {
         localStorage.setItem(STORAGE_KEY_YESTERDAY, JSON.stringify({
           date: parsed.date,
           posts: parsed.posts,
         }));
       }
     } catch (err) {
       console.warn('[postQueueService] yesterday snapshot failed:', err);
     }
     return freshState();
   }
   ```

3. Replace the `getYesterdayQueue()` body at lines 221-231:
   ```typescript
   getYesterdayQueue(): DailyPost[] {
     try {
       const raw = localStorage.getItem(STORAGE_KEY_YESTERDAY);
       if (!raw) return [];
       const parsed = JSON.parse(raw) as { date?: string; posts?: DailyPost[] };
       return Array.isArray(parsed.posts) ? parsed.posts : [];
     } catch {
       return [];
     }
   }
   ```

**Don't touch:**
- Module-init `_state = load()` at line 86 — its semantics are unchanged
- `freshState()` at line 38 — unchanged
- `save()` — unchanged (continues to write to live STORAGE_KEY only)
- `resetForNewDay()` at line 210 — unchanged (does NOT clear STORAGE_KEY_YESTERDAY; the snapshot persists across explicit resets, which is desirable)
- HomeScreen.tsx — Phase 36-06's React-side guards stay as-is

**Commit:**
```bash
git add app/src/services/post-queue.service.ts
git commit --no-verify -m "fix(36-09): durable yesterday snapshot via separate localStorage key (GAP-D Fix A)"
```

===

### Task 2 — Behavioral test for the snapshot lifecycle

**File:** `app/tests/services/post-queue-yesterday-snapshot.test.mjs` (NEW)

**Action:**

Create a Node `node --test` file modeled on the existing `tests/services/derived-list.test.mjs` pattern. Provide a fresh in-memory localStorage shim before each test (the existing test files already do this — copy the pattern).

Required test cases:

1. **Snapshot created on date-mismatch load:** Pre-seed localStorage `echolearn_post_queue` with `{date: "2026-05-06", posts: [<2 posts>]}`. Mock `today()` (or rely on the actual current date — your judgment) to return a different date. Re-import `postQueueService` (or call its `loadQueue()` if test infrastructure permits). Assert `localStorage.echolearn_post_queue_yesterday` now contains `{date: "2026-05-06", posts: [...]}` with the same 2 posts.

2. **getYesterdayQueue() reads from snapshot key:** With the snapshot from Test 1 in place, call `postQueueService.getYesterdayQueue()`. Assert it returns the 2 posts from the snapshot.

3. **Snapshot survives a subsequent save():** Set up the snapshot, then call `postQueueService.enqueue([<some today post>])` to force a `save()` of the live queue. Re-call `getYesterdayQueue()`. Assert it STILL returns the 2 yesterday posts (snapshot key untouched).

4. **No snapshot when prior payload had empty posts:** Pre-seed live key with `{date: "2026-05-06", posts: []}`. Trigger date-mismatch load. Assert `localStorage.echolearn_post_queue_yesterday` is NOT created (the snapshot logic should skip the empty case).

5. **Snapshot is overwritten on a second date-rollover:** Multi-step setup to validate the "only most recent yesterday is kept" semantics:
   - Pre-seed live key with `{date: "2026-05-06", posts: [<2 posts>]}`. Set `today()` to "2026-05-07". Trigger load — STORAGE_KEY_YESTERDAY now has 2026-05-06 payload.
   - **Force a save() of the live key with date=2026-05-07** by calling `postQueueService.enqueue([<a 2026-05-07 post>])`. (Without this step, the live key still has date=2026-05-06 and the second rollover would re-snapshot the SAME data — the test would pass for the wrong reason. Per checker W-1.)
   - Now change `today()` to "2026-05-08" so the live key (date=2026-05-07) becomes yesterday. Trigger another load.
   - Assert `STORAGE_KEY_YESTERDAY` now contains the 2026-05-07 payload (with the 1 post enqueued in step 2). Don't preserve multi-day history.

6. **First-install behavior — no snapshot key exists** (per checker W-2): Clear all localStorage. Call `postQueueService.getYesterdayQueue()`. Assert it returns `[]` (graceful empty — not undefined, not null, no throw). Future refactors that drop the `if (!raw) return []` guard will fail this test.

7. **resetForNewDay() preserves the snapshot** (per checker I-2): Set up snapshot via Test 1 path. Call `postQueueService.resetForNewDay()`. Assert `localStorage.echolearn_post_queue_yesterday` is STILL present with the same 2 posts. (Rationale: SettingsDataScreen.tsx:218 invokes resetForNewDay via the user-facing "Reset today" button — the snapshot must survive an explicit reset so the next /home mount can still warm-start.)

**Verification:**
```bash
cd app && node --test tests/services/post-queue-yesterday-snapshot.test.mjs
```
Must be GREEN.

**Commit:**
```bash
git add app/tests/services/post-queue-yesterday-snapshot.test.mjs
git commit --no-verify -m "test(36-09): behavioral coverage for durable yesterday snapshot (GAP-D Fix A)"
```

===

### Task 3 — CLAUDE.md doc-sync

**File:** `CLAUDE.md`

**Action:**

1. In the "Concept Feed Generation Pipeline" → "Numeric defaults" subsection (currently contains `MAX_QUEUE_SIZE = 32` and `walkDerivedList` notes), add a new bullet at the end of the list:
   ```markdown
   - Yesterday-queue snapshot: `STORAGE_KEY_YESTERDAY = 'echolearn_post_queue_yesterday'` is written by `postQueueService.load()` whenever a date-mismatch is detected on the live queue key. `getYesterdayQueue()` reads from this snapshot key (NOT the live key), making the warm-start path durable across multiple cold-start mounts of a new day. Phase 36 GAP-D close-out (2026-05-07) — the prior single-key implementation was destroyed by the first `save()` of today's queue. See `.planning/debug/cold-start-warm-start-fragile.md`.
   ```

2. Verify NO other CLAUDE.md sections are touched. Check via grep:
   ```bash
   grep -c "html, body { overflow: hidden }" CLAUDE.md  # must be 3
   grep -c "minWidth: 0" CLAUDE.md                       # must be 2
   grep -c "USER_ACK_BEFORE_GRAPH_CONTEXT" CLAUDE.md     # must be 2
   grep -c "ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD" CLAUDE.md  # must be 1
   grep -c "MAX_QUEUE_SIZE" CLAUDE.md                    # must be 1
   ```

**Commit:**
```bash
git add CLAUDE.md
git commit --no-verify -m "docs(36-09): document STORAGE_KEY_YESTERDAY durable snapshot in CLAUDE.md"
```

===

## Verification (post-execution)

Run the full Phase 36 quick suite + the new test:
```bash
cd app && node --test tests/services/derived-list.test.mjs tests/services/style-assignment-stratified.test.mjs tests/services/spread-by-concept.test.mjs tests/services/refill-queue-integration.test.mjs tests/services/style-assignment.test.mjs tests/services/post-queue.test.mjs tests/screens/HomeScreen.warm-start-guard.test.mjs tests/screens/PostDetailScreen.video-detector.test.mjs tests/components/InfoFlow.short-tap-emit.test.mjs tests/services/post-queue-yesterday-snapshot.test.mjs
```
Expected: 70 prior + 7 new = 77 GREEN.

Phase 33/35/36 preservation greps (must all return success):
```bash
grep -q "dueAnchors" app/src/services/concept-feed.service.ts
grep -q "allExplored && postQueueService.getTotalGenerated" app/src/services/concept-feed.service.ts
grep -q "USER_ACK_BEFORE_GRAPH_CONTEXT" app/src/state/useQuestions.ts
```

TypeScript clean:
```bash
cd app && npx tsc -b --noEmit
```
Exit 0.
