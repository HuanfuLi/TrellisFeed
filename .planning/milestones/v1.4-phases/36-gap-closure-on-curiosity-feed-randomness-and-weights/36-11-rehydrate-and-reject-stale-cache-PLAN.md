---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 11
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/services/concept-feed.service.ts
  - app/src/services/post-queue.service.ts
  - app/src/services/feed-spread.ts
  - app/tests/services/post-queue.test.mjs
  - app/tests/services/post-queue-rehydrate.test.mjs
  - app/tests/services/concept-feed-cache-date.test.mjs
  - CLAUDE.md
autonomous: true
requirements: [GAP-D-round3-b, GAP-D-round3-c, GAP-D-round3-d]
gap_closure: true
must_haves:
  truths:
    - "loadCache() in concept-feed.service.ts returns null when cached.date !== today() — stale daily-posts caches do NOT render. Closes round-3 sub-issue (b cause #2) AND sub-issue (d) — second Force-New-Day no longer renders previous-state served posts."
    - "load() in post-queue.service.ts rehydrates _state.posts (and derivedList + cyclePosition) from parsed.posts on date mismatch, AFTER snapshotting to STORAGE_KEY_YESTERDAY. Yesterday's UNSERVED queue carries across midnight into today's live queue."
    - "After rehydration, load() runs spreadByConcept then spreadByStyle on _state.posts to re-balance the cold-start window. Closes round-3 sub-issue (c) — no more video → news → video → news pattern on cold-start."
    - "Counters reset on rehydration: _state.totalGenerated and _state.totalServed go to 0 (new day's totals start fresh). cycleNumber retains continuity across days (informational only)."
    - "Plan 36-09 contract preserved: STORAGE_KEY_YESTERDAY snapshot still written; getYesterdayQueue() still functional. Plan 36-09's 7 tests + 36-09's 3 updated post-queue.test.mjs cases continue to pass."
  artifacts:
    - path: app/src/services/concept-feed.service.ts
      provides: "Date-rejection in loadCache; mixers (spreadByConcept, spreadByStyle) imported by post-queue.service.ts for rehydration use"
    - path: app/src/services/post-queue.service.ts
      provides: "Rehydration logic in load() date-mismatch branch + spread-call after rehydrate"
    - path: app/tests/services/concept-feed-cache-date.test.mjs
      provides: "loadCache returns null on date mismatch test (3 cases)"
    - path: app/tests/services/post-queue-rehydrate.test.mjs
      provides: "Rehydration + re-interleave behavioral tests (5 cases)"
  key_links:
    - via: "import"
      from: app/src/services/post-queue.service.ts
      pattern: "spreadByConcept|spreadByStyle"
---

# Plan 36-11 — Reject Stale Daily-Posts Cache + Rehydrate Yesterday's Unserved Queue

## Objective

Close round-3 sub-issues (b), (c), and (d) — yesterday's unserved queue must auto-populate today's feed (not stay orphaned in a snapshot key); the served-posts cache must not carry across midnight; and the rehydrated cold-start window must be style-balanced.

## Background

See `.planning/phases/36-.../36-UAT.md` round-3 Gaps section. Key insight: Plan 36-09's `STORAGE_KEY_YESTERDAY` snapshot is currently orphaned — `getYesterdayQueue()` returns it as a static fallback render, but no path consumes it back into `_state.posts`. So `swipe-for-more` dequeues from an empty in-memory queue. Combined with the date-independent `getCachedDailyPosts` (which keeps yesterday's served posts visible across midnight), the cold-start UX is broken.

The fix is a single load-bearing change in `load()`: rehydrate from the snapshot, re-interleave, then return. Symmetric on the cache side: reject stale cached posts in `loadCache()` so the cold-start fall-through path actually fires.

## Tasks

### Task 1 — `loadCache()` rejects stale caches

**File:** `app/src/services/concept-feed.service.ts`

**Action:**

In `loadCache()` (around lines 165-192), add a date-equality check after the `parsed.date` validation. If `parsed.date !== today()`, return `null`:

```typescript
function loadCache(): CachedDailyPosts | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedDailyPosts>;
    if (
      typeof parsed?.date !== 'string' ||
      typeof parsed?.fingerprint !== 'string' ||
      !Array.isArray(parsed?.posts)
    ) {
      return null;
    }
    // Phase 36-11: stale cache rejection. The served-posts cache must NOT
    // carry across midnight — yesterday's served posts have already been
    // shown to the user and should not render as "today's feed". This is the
    // symmetric counterpart to post-queue.service.ts's load() rehydration.
    // See .planning/phases/36-.../36-UAT.md round-3 sub-issue (b cause #2)
    // and (d) — second Force-New-Day was rendering the previous-state served
    // posts because of this missing date check.
    if (parsed.date !== today()) return null;
    // ... rest unchanged ...
  }
}
```

`today()` is already imported from `lib/date.ts` (used elsewhere in this file).

Note: `getCachedDailyPosts()` (line ~1507) calls `loadCache()` so this propagates automatically — no separate edit needed there.

**Don't touch:**
- `saveCache()` — its date is the cache's own date stamp; we don't change writes
- `getDailyPosts` cache-hit branch (line ~1407) — already does its own `cached?.date === date` check; the new `loadCache` rejection makes the check redundant but harmless

**Commit:**
```bash
git add app/src/services/concept-feed.service.ts
git commit --no-verify -m "fix(36-11): loadCache rejects stale daily-posts cache (round-3 sub-issues b#2, d)"
```

===

### Task 2 — `load()` rehydrates queue + re-interleaves

**File:** `app/src/services/post-queue.service.ts`

**Action:**

1. At the top of the file (after the existing imports, around lines 1-5), add:
   ```typescript
   import { spreadByConcept, spreadByStyle } from './feed-spread';
   ```

2. Replace the `load()` function's date-mismatch branch (around lines 64-83) with the rehydration version:
   ```typescript
   if (parsed.date !== today()) {
     // Snapshot yesterday's payload to STORAGE_KEY_YESTERDAY (Plan 36-09 contract).
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
     // Phase 36-11: rehydrate today's _state from yesterday's UNSERVED queue.
     // Yesterday's snapshot contains posts that were generated but never popped
     // by the user — they remain valid content and should auto-populate today's
     // feed (no manual swipe needed, no LLM-pipeline wait). Counters reset to 0
     // (new day's totals start fresh). cycleNumber inherits for continuity.
     // After rehydrating, re-interleave by spreadByConcept + spreadByStyle to
     // balance the style mix — yesterday's leftover is style-biased toward
     // minority styles (text-art was popped first as plurality), so renders
     // as video → news → video → news without re-interleave. See round-3
     // sub-issue (c). The mixers mutate the array in place.
     const rehydrated: DailyPost[] = Array.isArray(parsed.posts) ? parsed.posts : [];
     if (rehydrated.length > 0) {
       spreadByConcept(rehydrated);
       spreadByStyle(rehydrated);
     }
     return {
       date: today(),
       posts: rehydrated,
       cycleNumber: typeof parsed.cycleNumber === 'number' ? parsed.cycleNumber : 0,
       totalGenerated: 0,
       totalServed: 0,
       derivedList: Array.isArray(parsed.derivedList) ? parsed.derivedList : [],
       cyclePosition: typeof parsed.cyclePosition === 'number' ? parsed.cyclePosition : 0,
     };
   }
   ```

**Don't touch:**
- The `freshState()` function — still used when localStorage is empty / unparseable
- The same-day branch (lines 89-97) — unchanged
- `getYesterdayQueue()` (lines 252+) — unchanged; STORAGE_KEY_YESTERDAY is still written, still readable

**Commit:**
```bash
git add app/src/services/post-queue.service.ts
git commit --no-verify -m "fix(36-11): load() rehydrates _state.posts from yesterday's snapshot + re-interleave (round-3 sub-issues b#1, c)"
```

===

### Task 3 — Behavioral tests

**Files:** Two new test files.

**File A:** `app/tests/services/concept-feed-cache-date.test.mjs` (NEW)

Following the `app/tests/services/post-queue-yesterday-snapshot.test.mjs` pattern (Node `node --test` + tsx loader), test loadCache date-rejection. Required cases (3 total):

1. **`getCachedDailyPosts` returns [] when cached.date is yesterday's date.** Setup: `localStorage.setItem('echolearn_daily_posts', JSON.stringify({ date: '<yesterday>', fingerprint: 'fp', posts: [<valid post>] }))`. Assert `conceptFeedService.getCachedDailyPosts()` returns `[]`.
2. **`getCachedDailyPosts` returns posts when cached.date is today.** Setup: same but with `today()` as date. Assert returns the post array.
3. **`getCachedDailyPosts` returns [] when localStorage is empty.** No setup. Assert returns `[]`.

**File B:** `app/tests/services/post-queue-rehydrate.test.mjs` (NEW)

Required cases (5 total):

1. **`load()` rehydrates _state.posts from yesterday's payload on date mismatch.** Setup: write `{ date: <yesterday>, posts: [<5 posts>], derivedList: [...], cyclePosition: 3 }` to `echolearn_post_queue`. Call `postQueueService.loadQueue()`. Assert `getQueue().length === 5` AND `getDerivedList().length` matches AND `getCyclePosition() === 3`.
2. **Counters reset to 0 on rehydrate.** Same setup, but parsed payload also contains `totalGenerated: 100, totalServed: 80`. After loadQueue: `getTotalGenerated() === 0` AND `getTotalServed() === 0`.
3. **STORAGE_KEY_YESTERDAY is still written (Plan 36-09 preserved).** Same setup. After loadQueue: `localStorage.getItem('echolearn_post_queue_yesterday')` parses to `{ date: <yesterday>, posts: [<5 posts>] }`. Asserts both fixes coexist.
4. **Empty parsed.posts → fresh state, no rehydrate.** Setup: `{ date: <yesterday>, posts: [] }`. After loadQueue: `getQueue().length === 0` (still freshState-equivalent), no STORAGE_KEY_YESTERDAY write.
5. **Re-interleave applied: rehydrated _state.posts has spreadByStyle ordering.** Setup: write payload with 8 posts where the input has runs of same-style: `[video, video, video, video, news, news, news, news]`. After loadQueue, assert (a) `getQueue().length === 8` (no posts dropped); (b) histogram preserved (`getQueue().filter(p => p.presentationStyle === 'video').length === 4` AND same for news); (c) NO two adjacent posts share the same style after the spread runs (spreadByStyle's contract for N posts where each style count ≤ N/2). This is a stronger assertion than "no 4-runs" — it directly catches the `video → news → video → news` regression even though that's a 1-run pattern.

**Verification:**
```bash
cd app && node --test tests/services/concept-feed-cache-date.test.mjs tests/services/post-queue-rehydrate.test.mjs
```
8 GREEN expected (3 + 5).

Plan 36-09's tests must still pass:
```bash
cd app && node --test tests/services/post-queue-yesterday-snapshot.test.mjs tests/services/post-queue.test.mjs
```

**Commit:**
```bash
git add app/tests/services/concept-feed-cache-date.test.mjs app/tests/services/post-queue-rehydrate.test.mjs
git commit --no-verify -m "test(36-11): rehydration + cache date-rejection coverage"
```

===

### Task 3.5 — Update existing post-queue.test.mjs date-mismatch case (BLOCKER fix per plan-checker)

**File:** `app/tests/services/post-queue.test.mjs`

**Action:**

The existing test at lines 75-89 ("loadQueue with date mismatch resets to empty queue, cycle 0") was correct under the old contract (date mismatch returned `freshState`). Plan 36-11 Task 2 changes that contract to rehydration. The test will fail without an update.

REPLACE the existing block (lines 75-89) with a rehydration-aware version:

```javascript
  it('loadQueue with date mismatch rehydrates posts + cycleNumber, resets totals, snapshots to STORAGE_KEY_YESTERDAY', () => {
    // Phase 36-11: load() now rehydrates _state.posts (and derivedList +
    // cyclePosition) from yesterday's parsed.posts on date mismatch, AFTER
    // snapshotting to STORAGE_KEY_YESTERDAY. Counters (totalGenerated +
    // totalServed) reset to 0; cycleNumber inherits.
    postQueueService.enqueue([makePost('x'), makePost('y')]);
    postQueueService.incrementCycle();
    assert.equal(postQueueService.size(), 2);
    assert.equal(postQueueService.getCycleNumber(), 1);

    // Overwrite localStorage with a stale date
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    raw.date = '1999-01-01';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));

    postQueueService.loadQueue();
    // Rehydrated: posts + cycleNumber preserved
    assert.equal(postQueueService.size(), 2, 'posts rehydrated from yesterday');
    assert.equal(postQueueService.getCycleNumber(), 1, 'cycleNumber inherited');
    // Snapshot written
    const yest = JSON.parse(localStorage.getItem('echolearn_post_queue_yesterday'));
    assert.equal(yest.date, '1999-01-01');
    assert.equal(yest.posts.length, 2);
  });
```

Note: also check whether the test `'loadQueue with same date preserves queue contents'` at line 91 (now shifted) needs any tweak — should still work as-is (same-date branch is unchanged in Plan 36-11).

**Commit:**
```bash
git add app/tests/services/post-queue.test.mjs
git commit --no-verify -m "test(36-11): update date-mismatch test for rehydration semantics (was: assert empty)"
```

===

### Task 3.6 — Fix stale comment in feed-spread.ts (minor; per plan-checker)

**File:** `app/src/services/feed-spread.ts`

**Action:**

Line 16 currently says "n ≤ 12 in production (MAX_QUEUE_SIZE = 12)". MAX_QUEUE_SIZE is actually 32 and after Plan 36-12 lands the rehydrated cap could be a full queue of 32. Update:

```typescript
// Both functions mutate `posts` in place. They are O(n²) worst-case (the
// collision-bump probe + leftover-fill scan) but n ≤ 32 in production
// (MAX_QUEUE_SIZE = 32; rehydration on new day from Plan 36-11 may reach
// this cap), so this is negligible.
```

**Commit:**
```bash
git add app/src/services/feed-spread.ts
git commit --no-verify -m "docs(36-11): correct stale n-bound comment in feed-spread (12 → 32)"
```

===

### Task 4 — CLAUDE.md doc sync

**File:** `CLAUDE.md`

**Action:**

Add a paragraph under the "Concept Feed Generation Pipeline" section, near the existing GAP-D bullet about STORAGE_KEY_YESTERDAY. Keep it terse:

```markdown
- **New-day rehydration (Phase 36-11):** `load()`'s date-mismatch branch in
  `post-queue.service.ts` snapshots yesterday's payload to
  `STORAGE_KEY_YESTERDAY` (Plan 36-09) AND rehydrates today's `_state.posts`
  + `derivedList` + `cyclePosition` from `parsed.posts`. Yesterday's UNSERVED
  queue auto-populates today's feed (no manual swipe needed). Counters
  (`totalGenerated`, `totalServed`) reset to 0; `cycleNumber` inherits.
  After rehydration, `spreadByConcept` then `spreadByStyle` re-interleave
  the rehydrated posts to balance the style mix (yesterday's leftover skews
  toward minority styles since text-art is plurality and gets popped first).
  Symmetric counterpart in `concept-feed.service.ts`: `loadCache()` returns
  `null` when `cached.date !== today()` so yesterday's SERVED posts do NOT
  render across midnight. The two together implement: served posts archived
  in `postHistoryService` (DB), unserved posts surface as today's first
  source ahead of the LLM pipeline.
```

**Commit:**
```bash
git add CLAUDE.md
git commit --no-verify -m "docs(36-11): document new-day queue rehydration + stale-cache rejection"
```

===

## Verification (post-execution)

Full Phase 36 quick suite + new tests:
```bash
cd app && node --test tests/services/derived-list.test.mjs tests/services/style-assignment-stratified.test.mjs tests/services/spread-by-concept.test.mjs tests/services/refill-queue-integration.test.mjs tests/services/style-assignment.test.mjs tests/services/post-queue.test.mjs tests/services/post-queue-yesterday-snapshot.test.mjs tests/services/post-queue-rehydrate.test.mjs tests/services/concept-feed-cache-date.test.mjs tests/screens/HomeScreen.warm-start-guard.test.mjs tests/screens/PostDetailScreen.video-detector.test.mjs tests/components/InfoFlow.short-tap-emit.test.mjs tests/screens/SettingsDataScreen.force-new-day.test.mjs
```
Expected: 80 prior (1 was rewritten in Task 3.5, not added) + 8 new (5 rehydrate + 3 cache-date) = 88 GREEN (or 89 if Plan 36-13 lands an extra test).

TypeScript clean:
```bash
cd app && npx tsc -b --noEmit
```
Exit 0.

Phase preservation greps:
```bash
grep -q "STORAGE_KEY_YESTERDAY" app/src/services/post-queue.service.ts
grep -q "USER_ACK_BEFORE_GRAPH_CONTEXT" app/src/state/useQuestions.ts
grep -q "MAX_QUEUE_SIZE" CLAUDE.md
```
