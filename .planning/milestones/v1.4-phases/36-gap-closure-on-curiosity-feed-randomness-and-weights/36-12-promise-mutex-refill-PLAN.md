---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 12
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/services/concept-feed.service.ts
  - app/src/services/post-queue.service.ts
  - app/tests/services/post-queue.test.mjs
  - app/tests/services/refill-mutex.test.mjs
  - CLAUDE.md
autonomous: true
requirements: [GAP-D-round3-e]
gap_closure: true
must_haves:
  truths:
    - "_queueRefillRunning changes from `boolean` to `Promise<void> | null`. In-flight callers AWAIT the same promise instead of bailing — `await refillQueue()` in generateMorePosts no longer no-ops when a background refill is already running."
    - "REFILL_THRESHOLD bumped from 12 to 16 in post-queue.service.ts. Larger headroom so background refill rarely loses the race against fast swiping; forward-looking for double-column feed which needs more posts and larger buffer."
    - "Only one refillQueue body executes at a time (no duplicate LLM calls). Subsequent callers receive the same Promise and await it, then dequeue against the now-populated queue."
    - "refillQueue's existing finally block clears the mutex, AND the rejection path also clears the mutex so a failed refill does not permanently lock subsequent callers."
    - "Closes round-3 sub-issue (e): after Force New Day, first-swipe sees the in-flight refill complete (not bail) and returns posts; queue does not silently empty between swipes."
  artifacts:
    - path: app/src/services/concept-feed.service.ts
      provides: "Promise-based mutex on refillQueue; in-flight callers await"
    - path: app/src/services/post-queue.service.ts
      provides: "REFILL_THRESHOLD = 16 (bumped from 12)"
    - path: app/tests/services/refill-mutex.test.mjs
      provides: "Concurrency tests: single LLM body call when 3 callers race; await-pattern receives populated queue (4 cases)"
  key_links:
    - via: "constant"
      from: app/src/services/post-queue.service.ts
      pattern: "REFILL_THRESHOLD = 16"
---

# Plan 36-12 — Promise-Mutex Refill + REFILL_THRESHOLD Bump

## Objective

Close round-3 sub-issue (e): the queue auto-refill silently no-ops when an in-flight background refill is already running, leaving fast-swiping users with empty-state followed by an LLM call wait.

Bump REFILL_THRESHOLD 12 → 16 to give the background refill more headroom against rapid swiping AND to prepare for the planned double-column feed (which dequeues more per swipe).

## Background

See `.planning/phases/36-.../36-UAT.md` round-3 sub-issue (e). The current `_queueRefillRunning` boolean mutex causes `await refillQueue()` callers in `generateMorePosts` to receive `undefined` immediately when the flag is held, then dequeue against an unchanged (still-empty) queue, then return `[]`. The user's swipe sees no result; only the SECOND swipe (after the original bg refill flips the flag back) actually triggers a fresh refill.

Root cause is at `concept-feed.service.ts:1169-1172`:
```typescript
export async function refillQueue(questions: Question[]): Promise<void> {
  if (_queueRefillRunning) return;     // ← silent bail
  if (!postQueueService.needsRefill()) return;
  _queueRefillRunning = true;
  try { ... } finally { _queueRefillRunning = false; }
}
```

Promise-based mutex: in-flight callers receive the same Promise and await its completion. Single LLM body executes per refill cycle; multiple awaiters resolve when it finishes.

## Tasks

### Task 1 — Promise-mutex in refillQueue

**File:** `app/src/services/concept-feed.service.ts`

**Action:**

1. Locate the `_queueRefillRunning` declaration (search for `let _queueRefillRunning` — likely module-scope near line 1100-1170).

2. Change the type and initial value:
   ```typescript
   // Phase 36-12: Promise-based mutex (was boolean).
   // Multiple callers can race after Force-New-Day or rapid swipes; the
   // boolean version made `await refillQueue()` callers silently no-op when
   // a refill was already in flight, leaving generateMorePosts to dequeue
   // against an unchanged empty queue. The Promise reference lets in-flight
   // callers await the same Promise, see it resolve, then dequeue from the
   // now-populated queue. Single LLM body per cycle preserved.
   // See .planning/phases/36-.../36-UAT.md round-3 sub-issue (e).
   let _refillInFlight: Promise<void> | null = null;
   ```

   (Rename from `_queueRefillRunning` → `_refillInFlight` for clarity.)

3. Replace the `refillQueue` function signature/body:
   ```typescript
   export async function refillQueue(questions: Question[]): Promise<void> {
     // In-flight: return the same promise so concurrent callers await it,
     // not a no-op (which would cause silent dequeue-empty in generateMorePosts).
     if (_refillInFlight) return _refillInFlight;
     if (!postQueueService.needsRefill()) return;

     // Capture the in-flight Promise so concurrent callers await this exact
     // execution. The Promise must clear in BOTH success AND error paths so
     // a failed refill does not permanently lock subsequent callers.
     _refillInFlight = (async () => {
       try {
         // ─── existing refillQueue body, unchanged ─────────────────
         // (the block from `const settings = settingsService.getSync();`
         //  through `postQueueService.incrementCycle();`)
       } finally {
         _refillInFlight = null;
       }
     })();
     return _refillInFlight;
   }
   ```

   Mechanically: wrap the existing try/finally body in an `(async () => { try { /* body */ } finally { _refillInFlight = null; } })()` IIFE assigned to `_refillInFlight`. The function's outer `try/finally` becomes the IIFE's `try/finally`. The `try { ... } catch { ... }` chain inside the body remains as-is (existing code handles step-level failures).

4. Update any other read of `_queueRefillRunning` in the file (`grep -n "_queueRefillRunning" app/src/services/concept-feed.service.ts` to confirm there's only the one declaration + the `if (_queueRefillRunning) return` check; both are addressed by the rename).

**Don't touch:**
- The body of refillQueue (Step 1 — Step 7) — semantics inside the mutex are unchanged
- `generateMorePosts`'s `await refillQueue()` retry pattern (line ~1583) — it now correctly awaits the in-flight Promise instead of silently no-opping
- `getDailyPosts`'s `refillQueue(questions).catch(console.error)` background calls — still fire-and-forget; if mutex is held, they receive the Promise and let it resolve (no extra work)

**Commit:**
```bash
git add app/src/services/concept-feed.service.ts
git commit --no-verify -m "fix(36-12): Promise-based mutex on refillQueue (closes round-3 sub-issue e)"
```

===

### Task 2 — Bump REFILL_THRESHOLD 12 → 16

**File:** `app/src/services/post-queue.service.ts`

**Action:**

1. Change line 21:
   ```typescript
   // Phase 36-12: bumped from 12 → 16. The mutex fix in Plan 36-12 Task 1
   // eliminates the silent-no-op race, but a larger headroom further reduces
   // the chance of the user encountering empty-state during rapid swiping.
   // Forward-looking: the planned double-column feed dequeues more per swipe,
   // so the buffer needs to be larger to maintain the same UX guarantees.
   const REFILL_THRESHOLD = 16;
   ```

2. Confirm MAX_QUEUE_SIZE = 32 is unchanged (line 22). The new threshold leaves a 16-post runway between threshold and cap, which is safe.

**Don't touch:**
- `MAX_QUEUE_SIZE` — bumping it would touch the image pre-generation budget; out of scope
- `needsRefill()` — its `< REFILL_THRESHOLD` comparison naturally picks up the new value

**Commit:**
```bash
git add app/src/services/post-queue.service.ts
git commit --no-verify -m "feat(36-12): bump REFILL_THRESHOLD 12 → 16 (rapid-swipe + double-column readiness)"
```

===

### Task 2.5 — Update existing post-queue.test.mjs threshold test (BLOCKER fix per plan-checker)

**File:** `app/tests/services/post-queue.test.mjs`

**Action:**

The existing test at lines 68-73 (`'needsRefill returns true when size < 12, false when >= 12'`) hardcodes the threshold. Update both the label and the enqueue count to 16:

REPLACE:
```javascript
  it('needsRefill returns true when size < 12, false when >= 12', () => {
    assert.equal(postQueueService.needsRefill(), true);
    const posts = Array.from({ length: 12 }, (_, i) => makePost(`r${i}`));
    postQueueService.enqueue(posts);
    assert.equal(postQueueService.needsRefill(), false);
  });
```

WITH:
```javascript
  it('needsRefill returns true when size < 16, false when >= 16 (Phase 36-12)', () => {
    assert.equal(postQueueService.needsRefill(), true);
    const posts = Array.from({ length: 16 }, (_, i) => makePost(`r${i}`));
    postQueueService.enqueue(posts);
    assert.equal(postQueueService.needsRefill(), false);
  });
```

Verify no other test in `post-queue.test.mjs` hardcodes 12 (e.g., grep for `length: 12` and `>= 12` / `< 12`):
```bash
grep -n "12" app/tests/services/post-queue.test.mjs
```

**Commit:**
```bash
git add app/tests/services/post-queue.test.mjs
git commit --no-verify -m "test(36-12): update needsRefill threshold test 12 → 16"
```

===

### Task 3 — Concurrency tests

**File:** `app/tests/services/refill-mutex.test.mjs` (NEW)

**Action:**

Following the `app/tests/services/refill-queue-integration.test.mjs` pattern (Node `node --test` + tsx loader, mocks for LLM/YouTube/Tavily/imageGen).

Required test cases (4 total):

1. **Single LLM body executes when 3 callers race.** Mock `chatCompletion` so it counts call invocations and returns after a 50ms delay. Setup: 1 anchor in localStorage. Fire `Promise.all([refillQueue(qs), refillQueue(qs), refillQueue(qs)])`. Assert: `chatCompletion.callCount === 1` (or however many calls a SINGLE refill body makes — the key is that 3 races collapse to 1 body execution).

2. **All 3 awaiters resolve at the same point.** Same setup. After `await Promise.all([refillQueue(qs), refillQueue(qs), refillQueue(qs)])`, assert all three Promise resolutions occurred AND `postQueueService.size() > 0` (queue was populated by the single body and all awaiters see the result).

3. **Failed refill clears mutex (next caller fires fresh body).** Mock `chatCompletion` to throw on first call, succeed on second. First call: `await refillQueue(qs)` → completes (with empty queue, since body threw). Second call: `await refillQueue(qs)` → SHOULD trigger a fresh LLM body call (mutex was cleared in finally). Assert: queue size > 0 after second call. Assert: chatCompletion call count === 2.

4. **`generateMorePosts` await-pattern returns posts when refill is in-flight.** Setup: queue empty, anchor present, mock chatCompletion to delay 30ms. Fire `refillQueue(qs)` (don't await — it's now in-flight). Then call `await conceptFeedService.generateMorePosts(qs, 4)`. Assert returned array length > 0 (the await inside generateMorePosts received the in-flight Promise, awaited it, dequeued from the populated queue).

**Verification:**
```bash
cd app && node --test tests/services/refill-mutex.test.mjs
```
4 GREEN expected.

Existing refill-queue-integration test must still pass:
```bash
cd app && node --test tests/services/refill-queue-integration.test.mjs
```

**Commit:**
```bash
git add app/tests/services/refill-mutex.test.mjs
git commit --no-verify -m "test(36-12): Promise-mutex concurrency + generateMorePosts await coverage"
```

===

### Task 4 — CLAUDE.md numeric defaults sync

**File:** `CLAUDE.md`

**Action:**

In the "Numeric defaults" block, update the REFILL_THRESHOLD line:

**Find:**
```markdown
- Queue refill threshold: **12** (bumped from 8 on 2026-04-21 when image pre-generation moved into `refillQueue`; earlier refill gives runway so the queue doesn't empty mid-swipe while image-gen is still in flight)
```

**Replace with:**
```markdown
- Queue refill threshold: **16** (bumped from 12 on 2026-05-07; Phase 36-12 mutex-fix eliminates the silent-no-op race in `_refillInFlight`, and the larger threshold further reduces empty-state during rapid swiping; forward-looking for the planned double-column feed which dequeues more per swipe). Earlier history: 8 → 12 on 2026-04-21 when image pre-generation moved into `refillQueue`.
```

Add a new bullet after the threshold line:

```markdown
- Refill mutex: `_refillInFlight: Promise<void> | null` (Phase 36-12). In-flight callers await the same Promise instead of bailing; single LLM body per refill cycle. See `concept-feed.service.ts` refillQueue and `tests/services/refill-mutex.test.mjs`.
```

**Commit:**
```bash
git add CLAUDE.md
git commit --no-verify -m "docs(36-12): document refill threshold bump + Promise mutex"
```

===

## Verification (post-execution)

Combined Phase 36 quick suite + new test:
```bash
cd app && node --test tests/services/derived-list.test.mjs tests/services/style-assignment-stratified.test.mjs tests/services/spread-by-concept.test.mjs tests/services/refill-queue-integration.test.mjs tests/services/style-assignment.test.mjs tests/services/post-queue.test.mjs tests/services/post-queue-yesterday-snapshot.test.mjs tests/services/refill-mutex.test.mjs tests/screens/HomeScreen.warm-start-guard.test.mjs tests/screens/PostDetailScreen.video-detector.test.mjs tests/components/InfoFlow.short-tap-emit.test.mjs tests/screens/SettingsDataScreen.force-new-day.test.mjs
```
Expected: 81 prior + 4 new = 85 GREEN (or 89 if Plan 36-11 also lands).

TypeScript clean:
```bash
cd app && npx tsc -b --noEmit
```
Exit 0.

Phase preservation greps:
```bash
grep -q "STORAGE_KEY_YESTERDAY" app/src/services/post-queue.service.ts
grep -q "USER_ACK_BEFORE_GRAPH_CONTEXT" app/src/state/useQuestions.ts
grep -q "REFILL_THRESHOLD = 16" app/src/services/post-queue.service.ts
```
