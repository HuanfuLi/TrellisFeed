---
phase: 43-engagement-ui
plan: 15
plan_id: 43-15
slug: force-new-day-dedup
type: execute
wave: 5
depends_on: []
files_modified:
  - app/src/services/post-queue.service.ts
  - app/src/screens/HomeScreen.tsx
  - app/src/services/infiniteScroll.service.ts
  - app/tests/services/post-queue-remove-by-id.test.mjs
  - app/tests/screens/HomeScreen.force-new-day-dedup.test.mjs
autonomous: true
gap_closure: true
parallel_safe: true
estimated_commits: 5-6
requirements: [ENGAGE-01]
must_haves:
  truths:
    - "After Force-New-Day + swipe-for-more, no React 'Encountered two children with the same key' warnings appear — each post id renders exactly once across initial dailyPosts and any freshly-popped queue batches."
    - "Yesterday-snapshot posts surfaced via warm-start fallback do NOT also remain dequeueable from postQueueService._state.posts — the two stores are mutually exclusive after the warm-start seeds dailyPosts (Approach A — structural fix)."
    - "Defense-in-depth: HomeScreen.tsx handleLoad concat at line 263 dedups newPosts against existing dailyPosts by id BEFORE setDailyPosts; infiniteScrollService.seenPostIds is seeded with dailyPosts ids during Effect A warm-start fallback so service-level dedup at infiniteScroll.service.ts:50 also catches overlaps (Approach B — guard at render boundary)."
    - "Phase 36-11 stale-cache rejection (yesterday's SERVED posts must not render across midnight) — PRESERVED. loadCache() at concept-feed.service.ts:187 still returns null on date mismatch."
    - "Phase 36-14 tier-2 warm-start re-fallback (HomeScreen tier-2 reads postQueueService.getYesterdayQueue()) — PRESERVED. Dev-affordance Force-New-Day still produces a populated feed."
    - "Numeric defaults: MAX_QUEUE_SIZE = 32, REFILL_THRESHOLD = 24, loadNextBatch default limit = 8 — UNCHANGED."
    - "STORAGE_KEY_YESTERDAY durable-snapshot contract preserved — Plan 36-09's getYesterdayQueue() still returns the unmodified snapshot."
  artifacts:
    - path: "app/src/services/post-queue.service.ts"
      provides: "New removeByIds(ids: string[]) helper that splices matching post ids out of _state.posts and persists. Used by HomeScreen Effect A warm-start fallback to keep the queue and dailyPosts mutually exclusive after Force-New-Day rehydration."
    - path: "app/src/screens/HomeScreen.tsx"
      provides: "Two warm-start tier-2 fallback sites (line ~41-50 useState initializer + line ~204-224 [location.pathname] re-sync) now call postQueueService.removeByIds(yesterdayQueue.slice(0,8).map(p=>p.id)) AND infiniteScrollService.seedSeen(ids) after seeding dailyPosts. handleLoad concat at line ~263 wraps setDailyPosts in an id-based dedup of newPosts against prev."
    - path: "app/src/services/infiniteScroll.service.ts"
      provides: "New seedSeen(ids: string[]) method that adds the given ids to the seenPostIds Set so loadNextBatch's existing dedup at line 50 also catches warm-start overlaps."
    - path: "app/tests/services/post-queue-remove-by-id.test.mjs"
      provides: "Behavioral test for removeByIds: idempotent, persists to localStorage, only removes matching ids, no-op on empty input. Walker code at line 389 + load() rehydration at lines 78-121 UNCHANGED (negative-invariant)."
    - path: "app/tests/screens/HomeScreen.force-new-day-dedup.test.mjs"
      provides: "Source-reading invariants for: (a) tier-2 fallback sites call removeByIds + seedSeen after seeding dailyPosts; (b) handleLoad concat at line 263 has id-based dedup; (c) loadCache stale-cache rejection (Phase 36-11) is preserved; (d) Phase 36-14 tier-2 re-fallback structure is preserved."
  key_links:
    - from: "app/src/screens/HomeScreen.tsx warm-start initializer (line ~41-50)"
      to: "app/src/services/post-queue.service.ts removeByIds()"
      via: "function call after yesterdayQueue.slice(0, 8) seeding"
      pattern: "postQueueService\\.removeByIds\\("
    - from: "app/src/screens/HomeScreen.tsx [location.pathname] re-sync (line ~204-224)"
      to: "app/src/services/post-queue.service.ts removeByIds()"
      via: "function call after yesterdayQueue.slice(0, 8) seeding"
      pattern: "postQueueService\\.removeByIds\\("
    - from: "app/src/screens/HomeScreen.tsx warm-start initializer + re-sync"
      to: "app/src/services/infiniteScroll.service.ts seedSeen()"
      via: "function call seeding the deduplication Set"
      pattern: "infiniteScrollService\\.seedSeen\\("
    - from: "app/src/screens/HomeScreen.tsx handleLoad (line ~263)"
      to: "id-based dedup against prev"
      via: "Set-based filter before setDailyPosts spread"
      pattern: "new\\s+Set\\(prev\\.map"
---

<objective>
Gap-closure plan for Phase 43 re-verify UAT **Test 12** (severity: blocker).

**Diagnosed root cause** (.planning/debug/duplicate-post-keys-after-force-new-day.md):
After Force-New-Day, the same yesterday-snapshot post set lives in TWO independent stores:
1. `STORAGE_KEY_YESTERDAY` ('trellis_post_queue_yesterday') — the durable snapshot written by `postQueueService.load()` at `post-queue.service.ts:87-93` on date mismatch.
2. `postQueueService._state.posts` — the in-memory live queue, rehydrated by `load()` at `post-queue.service.ts:107-114` from the SAME `parsed.posts` payload.

Both arrays draw from a common parent. HomeScreen Effect A's tier-2 fallback (at `HomeScreen.tsx:41-50` initializer AND `:204-224` re-sync) seeds `dailyPosts` from store 1 (the snapshot). User swipes → `loadNextBatch` → `postQueueService.dequeue(8)` returns 8 posts from store 2. The first 8 of each overlap heavily (75% per user's 6-of-8 collision log) because the snapshot is pre-spread and `_state.posts` is post-spread, but both contain the same id set with style-biased ordering. `HomeScreen.tsx:263` concats via `setDailyPosts(prev => [...prev, ...newPosts])` with NO id-based dedup. `infiniteScrollService.seenPostIds` is never seeded from warm-start fallback, so its service-level dedup at `infiniteScroll.service.ts:50` is empty. Result: duplicate React keys → DEV warning storm.

The deeper architectural cause is that the Phase 36 "new-day rehydration" design intent — that the rehydrated `_state.posts` becomes today's feed via `getDailyPosts` → `dequeue` → `saveCache` — relies on `getDailyPosts` being called after the rehydration. It is wired only to the `[questions, questionsLoading]` useEffect at `HomeScreen.tsx:117`, which does NOT re-run on /home navigation when questions are unchanged (Force-New-Day leaves the question set intact). So the rehydrated `_state.posts` is never drained into the daily cache; the warm-start fallback peeks at the snapshot AND the queue still holds the full payload — collision is structural.

**Fix direction** (operator-validated in UAT root_cause):
Adopt **BOTH** approaches for defense-in-depth (UAT root_cause "Many fix plans will choose to do **both**: (A) for the underlying state hygiene + (B) as a defense-in-depth guard at the render boundary"):
- **Approach A — Mutually exclusive stores (structural fix):** When the warm-start fallback seeds `dailyPosts` from `getYesterdayQueue()`, also remove those same ids from `_state.posts` so `loadNextBatch` cannot return them again.
- **Approach B — Defensive id-dedup (render-boundary guard):** Add id-based dedup at the concat boundary in `HomeScreen.tsx:263` AND seed `infiniteScrollService.seenPostIds` from `dailyPosts` during the warm-start fallback, so the service-level dedup at `infiniteScroll.service.ts:50` also catches any future overlap.

**Constraints (load-bearing):**
- **Phase 36-11 stale-cache rejection** (yesterday's SERVED posts must not render across midnight) — MUST keep. `loadCache()` at `concept-feed.service.ts:187` returning null on date mismatch is unchanged.
- **Phase 36-14 tier-2 warm-start re-fallback** (otherwise the dev affordance leaves an empty feed) — MUST keep. The warm-start fallback path that seeds `dailyPosts` from `getYesterdayQueue()` is preserved; we just remove the seeded ids from `_state.posts` to prevent the overlap.
- **STORAGE_KEY_YESTERDAY snapshot** (Plan 36-09 contract — `getYesterdayQueue()` reads the snapshot key, not the live key) — UNCHANGED. The snapshot itself is read-only here; only `_state.posts` is mutated by `removeByIds`.
- **Numeric defaults** — `MAX_QUEUE_SIZE = 32`, `REFILL_THRESHOLD = 24`, `loadNextBatch` default `limit = 8` — UNCHANGED.
- **Walker dismiss-skip at post-queue.service.ts:389** — UNCHANGED (Phase 39 D-07 contract; the sibling Plan 43-14 also guards this).
- **Walker termination guard `maxSteps = Math.max(count * 2, len)`** at `post-queue.service.ts:383` — UNCHANGED (Phase 36 GAP-B closure).
- **Phase 36-11 rehydration semantics** — `load()`'s date-mismatch branch still rehydrates `_state.posts` from `parsed.posts` and writes the snapshot. The fix is downstream: HomeScreen's warm-start fallback now claims its 8-post slice by ALSO removing it from `_state.posts` post-rehydration, so the two stores stop overlapping.
- Source-reading invariants per Phase 39+ discipline.

Purpose: Restore the operator-intended new-day rehydration flow (yesterday's UNSERVED queue auto-populates today's feed AFTER Force-New-Day without duplicate-key warnings).
Output: 5-file change set (2 source files edited, 1 source file edited additively, 2 new test files); 5-6 atomic commits.

**Parallel-safety note:** This plan touches post-queue.service.ts (additive method) + HomeScreen.tsx (two tier-2 fallback sites + handleLoad concat) + infiniteScroll.service.ts (additive method). The sibling 43-14 touches concept-feed.service.ts + new test files in distinct directories. Distinct file-touch surfaces → fully parallel-safe.

**Execution order within this plan:** Task 1 (add removeByIds to post-queue.service.ts) and Task 2 (add seedSeen to infiniteScroll.service.ts) must complete BEFORE Task 3 (HomeScreen edits) because Task 3 imports the new methods. Tasks 4-5 (tests) can run after Tasks 1-3.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/43-engagement-ui/43-UAT.md
@.planning/phases/43-engagement-ui/43-CONTEXT.md
@.planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md
@.planning/phases/43-engagement-ui/43-13-engagement-reset-dismissed-only-PLAN.md
@.planning/debug/duplicate-post-keys-after-force-new-day.md

# CLAUDE.md — load-bearing sections referenced
# ("Concept Feed Generation Pipeline" numeric defaults + new-day rehydration +
# always-mounted screens; "Best practices learned in Phase 32.1" rules 2 + 6)
@CLAUDE.md

# Source-of-truth files
@app/src/services/post-queue.service.ts
@app/src/services/infiniteScroll.service.ts
@app/src/screens/HomeScreen.tsx
@app/src/screens/settings/SettingsDataScreen.tsx

# Test pattern precedents
@app/tests/services/post-queue-rehydrate.test.mjs
@app/tests/services/post-queue-yesterday-snapshot.test.mjs
@app/tests/services/post-queue-dedup.test.mjs
@app/tests/screens/HomeScreen.warm-start-refallback.test.mjs

<interfaces>
From app/src/services/post-queue.service.ts (current shape, plan target):

Lines 149-152: `let _state: QueueState = load();` + `export const postQueueService = {` — module singleton.

Lines 233-239 — dequeue:
  ```ts
  dequeue(count: number): DailyPost[] {
    const items = _state.posts.splice(0, count);
    _state.totalServed += items.length;
    save(_state);
    return items;
  },
  ```
  ← INSERT a new `removeByIds(ids: string[]): number` method nearby (after dequeue, before `size()` on line 242). Returns the number of removed posts for caller assertions/tests.

Lines 78-121 — load() date-mismatch branch — UNCHANGED.
Lines 369-393 — walkDerivedList — UNCHANGED.

The save() helper at lines 141-147 persists `_state` to STORAGE_KEY (the LIVE key, not STORAGE_KEY_YESTERDAY). `removeByIds` calls save(_state) after the splice; STORAGE_KEY_YESTERDAY is untouched.

From app/src/services/infiniteScroll.service.ts (current shape, additive plan target):

Line 18: `let seenPostIds: Set<string> = new Set();` — module-local state.
Lines 23-104: `export const infiniteScrollService = { initialize, loadNextBatch, enqueuePosts, getPendingCount, reset, getSeenPostIds, getOffset };`
  ← INSERT a new `seedSeen(ids: string[]): void` method after initialize() (line 33) and before loadNextBatch (line 46).

The existing `getSeenPostIds(): Set<string>` returns a copy — keeps the test surface unchanged.

From app/src/screens/HomeScreen.tsx (current shape, plan targets):

Lines 41-50 — useState warm-start initializer:
  ```ts
  const [dailyPosts, setDailyPosts] = useState<DailyPost[]>(() => {
    const cached = conceptFeedService.getCachedDailyPosts();
    if (cached.length > 0) return cached;
    postQueueService.loadQueue();
    const yesterday = postQueueService.getYesterdayQueue();
    if (yesterday.length > 0) return yesterday.slice(0, 8);
    return postHistoryService.getPosts().slice(0, 4);
  });
  ```
  ← After the tier-2 `if (yesterday.length > 0)` branch returns, we need to ALSO remove those 8 ids from _state.posts AND seed seenPostIds. Since useState initializers MUST be pure (Strict Mode safe), we move the side-effects into a useEffect that runs once on mount AFTER the initializer.

  ACTUALLY — the useState initializer pattern: returning `yesterday.slice(0, 8)` is pure. The side-effects (removeByIds + seedSeen) belong in a `useEffect(() => { ... }, [])` mount-once effect that:
    (a) checks if dailyPosts at mount-time was seeded from the yesterday-queue fallback
    (b) if so, removes those ids from _state.posts AND seeds seenPostIds

  The cleanest way: add a separate `useRef` to the useState init that records whether the yesterday-queue branch fired, then a useEffect reads the ref and calls the mutations.

  Actually-cleanest approach: hoist the side-effects to a useEffect that runs once on mount, mirrors the initializer's fallback chain, and applies mutations when the yesterday-queue branch fires. The useState initializer remains pure (returns the slice); the useEffect handles the splice + seed. (This is structurally similar to how warmStartHadPostsRef is captured at line 66.)

  See Task 3 action body for the exact code shape.

Lines 204-224 — [location.pathname] re-sync (Phase 36-14):
  ```ts
  useEffect(() => {
    if (location.pathname !== '/home') return;
    const cached = conceptFeedService.getCachedDailyPosts();
    if (cached.length > 0) {
      setDailyPosts(cached);
      return;
    }
    postQueueService.loadQueue();
    const yesterdayQueue = postQueueService.getYesterdayQueue();
    if (yesterdayQueue.length > 0) {
      setDailyPosts(yesterdayQueue.slice(0, 8));
      return;
    }
    setDailyPosts([]);
  }, [location.pathname]);
  ```
  ← ADD `postQueueService.removeByIds(slice.map(p=>p.id))` AND `infiniteScrollService.seedSeen(slice.map(p=>p.id))` immediately AFTER `setDailyPosts(yesterdayQueue.slice(0, 8))`. Hoist the slice into a const so we don't compute it twice.

Lines 229-272 — handleLoad concat:
  ```ts
  setDailyPosts((prev) => [...prev, ...newPosts]);
  ```
  ← REPLACE with id-based dedup:
  ```ts
  setDailyPosts((prev) => {
    const seen = new Set(prev.map(p => p.id));
    const fresh = newPosts.filter(p => !seen.has(p.id));
    return fresh.length === newPosts.length
      ? [...prev, ...newPosts]
      : [...prev, ...fresh];
  });
  ```

The infiniteScrollService import at line 14 already exists — no import change needed for HomeScreen.

From app/src/services/infiniteScroll.service.ts loadNextBatch (line 50):
  ```ts
  const deduplicated = batch.filter((post) => !seenPostIds.has(post.id));
  ```
  ← UNCHANGED. The existing dedup mechanism is correct; we only need to ensure `seenPostIds` is properly SEEDED from the warm-start fallback (currently it's not). After Task 2 adds `seedSeen` and Task 3 calls it, this dedup at line 50 will catch any overlap that `removeByIds` somehow missed — defense-in-depth.

From app/src/screens/settings/SettingsDataScreen.tsx handleForceNewDay (lines 77-149):
  UNCHANGED by this plan. The handler still mutates `trellis_post_queue.date` to yesterday, calls `postQueueService.loadQueue()`, mutates `trellis_daily_posts.date`, calls `dailyReadService.reset()` + `engagementService.resetDismissedOnly()`, then `navigate('/home')`. The fix is downstream in how HomeScreen handles the rehydrated state.

Phase 36-11 stale-cache rejection at concept-feed.service.ts:187 — UNCHANGED. The fix is symmetric to and compatible with this gate.

Phase 36-14 tier-2 warm-start re-fallback structure — PRESERVED with the additional cleanup step.

CLAUDE.md "Concept Feed Generation Pipeline" — invariants honored:
  - Numeric defaults unchanged.
  - Yesterday-queue snapshot (`STORAGE_KEY_YESTERDAY`) read by `getYesterdayQueue()` — unchanged.
  - "New-day rehydration": load() still rehydrates _state.posts from parsed.posts; the new step is that HomeScreen's warm-start fallback claims its 8-post slice by removing those ids so the two stores stop overlapping.
  - "Always-mounted screens must explicitly re-read service state on navigation" — the [location.pathname] re-sync remains; we ADD a service-state mutation step alongside the read.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add postQueueService.removeByIds(ids) helper</name>
  <files>app/src/services/post-queue.service.ts</files>
  <read_first>
    - app/src/services/post-queue.service.ts full file (locate dequeue at 233-239, save at 141-147, module-singleton _state at 149)
    - .planning/debug/duplicate-post-keys-after-force-new-day.md "Resolution" section
    - app/tests/services/post-queue-dedup.test.mjs (existing dedup test pattern; mirror for new helper)
  </read_first>
  <action>
    Single additive edit to `app/src/services/post-queue.service.ts`.

    Insert a new `removeByIds(ids: string[]): number` method on the exported `postQueueService` object IMMEDIATELY AFTER the existing `dequeue` method (line 239) and BEFORE `size()` (line 242):

    ```ts
      /**
       * Remove specific posts from the in-memory queue by id. Persists the
       * mutated state to STORAGE_KEY (the LIVE key — STORAGE_KEY_YESTERDAY
       * snapshot is read-only and untouched).
       *
       * Phase 43 gap-closure 43-15 — used by HomeScreen's warm-start tier-2
       * fallback after Force-New-Day. The fallback seeds dailyPosts from
       * postQueueService.getYesterdayQueue() (the durable snapshot at
       * STORAGE_KEY_YESTERDAY); without this helper, those same posts also
       * remain in _state.posts (rehydrated from the same parsed.posts payload
       * by load() at lines 107-114) and would be re-popped via dequeue(8) on
       * the next swipe-for-more, producing duplicate React keys (UAT Test 12
       * blocker — see .planning/debug/duplicate-post-keys-after-force-new-day.md).
       *
       * Idempotent: ids not present in _state.posts are silently ignored.
       * Empty input is a no-op (no save). Returns the number of posts actually
       * removed for caller assertions / tests.
       *
       * Does NOT decrement totalServed — these posts have NOT been served to
       * the user via dequeue; they have been seeded as the user's "yesterday's
       * leftover" feed via the warm-start fallback, which is a DIFFERENT
       * delivery path. (totalServed tracks queue-served count, which is a
       * separate metric.)
       *
       * Does NOT mutate the STORAGE_KEY_YESTERDAY snapshot — that snapshot
       * is the durable cross-cold-start record (Plan 36-09); getYesterdayQueue()
       * MUST continue to return the unmodified yesterday payload regardless
       * of how many warm-start mounts have run.
       */
      removeByIds(ids: string[]): number {
        if (ids.length === 0) return 0;
        const removeSet = new Set(ids);
        const before = _state.posts.length;
        _state.posts = _state.posts.filter(p => !removeSet.has(p.id));
        const removed = before - _state.posts.length;
        if (removed > 0) save(_state);
        return removed;
      },
    ```

    **Key details:**
    - Insert position: directly after the existing `dequeue` method's closing `},` on line 239. Use the same 2-space indentation as adjacent methods.
    - The method mutates `_state.posts` in place via reassignment (`_state.posts = _state.posts.filter(...)`). This is consistent with the existing `dequeue` shape that uses `splice(0, count)` — both mutate the module-singleton `_state.posts`.
    - The method calls `save(_state)` only when at least one post was actually removed. This avoids spurious localStorage writes for no-op calls.
    - The method does NOT touch STORAGE_KEY_YESTERDAY. Plan 36-09's `getYesterdayQueue()` reads from that snapshot and must continue to return the unmodified payload across cold-starts.
    - The method does NOT touch `totalServed` — these posts were not served via the queue's dequeue path. (If a future caller wants the symmetric semantic — "I just served N posts to the user via warm-start, count them" — we can add a `markServed` variant; out of scope for this plan.)
    - The method does NOT touch `derivedList` or `cyclePosition`. The derived list is the cyclic walker's source-of-truth and is independent of the served-posts queue (CLAUDE.md "Concept Feed Generation Pipeline" — three-list model).

    **Atomic commit message:** `feat(43-15): add postQueueService.removeByIds for warm-start dedup`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && grep -q "removeByIds(ids: string\[\]): number" src/services/post-queue.service.ts && grep -q "STORAGE_KEY_YESTERDAY" src/services/post-queue.service.ts && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "removeByIds" src/services/post-queue.service.ts` returns AT LEAST 2 (method declaration + JSDoc reference)
    - `grep -c "STORAGE_KEY_YESTERDAY" src/services/post-queue.service.ts` returns AT LEAST 2 (existing snapshot write + JSDoc reference) — proves the JSDoc cross-references the snapshot contract
    - Walker code at line 389 is unchanged: `grep -q "!exploredIds.has(id) && !dismissedIds.has(id)" src/services/post-queue.service.ts` returns 0 (still present)
    - Dequeue method at line 234 is unchanged: `grep -q "_state.posts.splice(0, count)" src/services/post-queue.service.ts`
    - `cd app && npx tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>postQueueService.removeByIds available; walker + dequeue + snapshot semantics unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Add infiniteScrollService.seedSeen(ids) helper</name>
  <files>app/src/services/infiniteScroll.service.ts</files>
  <read_first>
    - app/src/services/infiniteScroll.service.ts full file (locate seenPostIds at line 18; initialize at line 29; loadNextBatch dedup at line 50)
    - app/tests/services/infiniteScroll.service.test.mjs (pattern reference)
  </read_first>
  <action>
    Single additive edit to `app/src/services/infiniteScroll.service.ts`.

    Insert a new `seedSeen(ids: string[]): void` method on the exported `infiniteScrollService` object IMMEDIATELY AFTER `initialize` (line 33) and BEFORE `loadNextBatch` (line 46):

    ```ts
      /**
       * Seed the dedup set with externally-known post ids. Used by HomeScreen's
       * warm-start tier-2 fallback (Phase 43 gap-closure 43-15) so the
       * yesterday-queue posts surfaced via dailyPosts are also caught by the
       * loadNextBatch dedup at line ~50 — defense-in-depth against any future
       * code path that bypasses postQueueService.removeByIds().
       *
       * Idempotent: ids already in the set are silently ignored. Respects the
       * 500-id eviction policy from loadNextBatch (large seeds are bounded).
       *
       * Pair with postQueueService.removeByIds(ids) at the same call site —
       * removeByIds is the structural fix (mutually exclusive stores);
       * seedSeen is the render-boundary guard.
       */
      seedSeen(ids: string[]): void {
        for (const id of ids) {
          seenPostIds.add(id);
          if (seenPostIds.size > 500) {
            const oldest = seenPostIds.values().next().value;
            if (oldest) seenPostIds.delete(oldest);
          }
        }
      },
    ```

    **Key details:**
    - Position: between `initialize()` (lines 29-33) and `loadNextBatch()` (line 46). Keep alphabetical/logical grouping by adding it in the "state mutation" cluster.
    - The 500-id eviction policy mirrors loadNextBatch's existing pattern (line 53-56) so the dedup set doesn't grow unbounded.
    - DO NOT modify `seenPostIds` declaration at line 18 or `loadNextBatch` at line 46 — the existing dedup at line 50 will pick up the seeded ids automatically.
    - DO NOT modify `reset()` at line 85 — that method clears `seenPostIds` on session reset, which is the correct behavior; warm-start seed runs on subsequent mount.

    **Atomic commit message:** `feat(43-15): add infiniteScrollService.seedSeen for warm-start dedup defense-in-depth`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && grep -q "seedSeen(ids: string\[\]): void" src/services/infiniteScroll.service.ts && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "seedSeen" src/services/infiniteScroll.service.ts` returns AT LEAST 2 (declaration + JSDoc reference)
    - `loadNextBatch` dedup at line 50 unchanged: `grep -q "batch.filter((post) => !seenPostIds.has(post.id))" src/services/infiniteScroll.service.ts`
    - `cd app && npx tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>infiniteScrollService.seedSeen available; existing dedup mechanism untouched.</done>
</task>

<task type="auto">
  <name>Task 3: Wire removeByIds + seedSeen + concat-dedup into HomeScreen</name>
  <files>app/src/screens/HomeScreen.tsx</files>
  <read_first>
    - app/src/screens/HomeScreen.tsx lines 1-50 (imports + useState initializer)
    - app/src/screens/HomeScreen.tsx lines 200-275 (location.pathname re-sync + handleLoad)
    - .planning/debug/duplicate-post-keys-after-force-new-day.md "Resolution" section for the precise call sites
    - Tasks 1-2 of this plan must be complete (the new methods must exist on the singleton objects)
  </read_first>
  <action>
    Three edits to `app/src/screens/HomeScreen.tsx`. Edit in order.

    **Edit 1 — useState warm-start initializer + companion mount-once useEffect (lines 41-50).**

    The useState initializer must stay PURE (Strict Mode safe). Move the side-effects (`removeByIds` + `seedSeen`) into a mount-once useEffect that runs AFTER the initializer.

    Replace the existing useState initializer (lines 41-50) with the same initializer body but capture a ref recording whether the tier-2 (yesterdayQueue) branch fired AND the slice of ids that was seeded:

    ```ts
      // Phase 43 gap-closure 43-15 — warm-start tier metadata captured at
      // useState construction time. Read by the mount-once useEffect below to
      // (a) splice the seeded ids out of postQueueService._state.posts so
      // loadNextBatch cannot re-pop them (the duplicate-key root cause from
      // UAT Test 12); (b) seed infiniteScrollService.seenPostIds as
      // defense-in-depth at the service-level dedup boundary. See
      // .planning/debug/duplicate-post-keys-after-force-new-day.md.
      const warmStartTierRef = useRef<{ tier: 'cache' | 'yesterday' | 'history' | 'empty'; seededIds: string[] }>({ tier: 'empty', seededIds: [] });

      const [dailyPosts, setDailyPosts] = useState<DailyPost[]>(() => {
        // Warm start (D-30): If today's cache is empty, show yesterday's remaining queue
        const cached = conceptFeedService.getCachedDailyPosts();
        if (cached.length > 0) {
          warmStartTierRef.current = { tier: 'cache', seededIds: cached.map(p => p.id) };
          return cached;
        }
        postQueueService.loadQueue();
        const yesterday = postQueueService.getYesterdayQueue();
        if (yesterday.length > 0) {
          const slice = yesterday.slice(0, 8);
          warmStartTierRef.current = { tier: 'yesterday', seededIds: slice.map(p => p.id) };
          return slice;
        }
        // D-32 fallback: show last 4 from history
        const history = postHistoryService.getPosts().slice(0, 4);
        warmStartTierRef.current = { tier: 'history', seededIds: history.map(p => p.id) };
        return history;
      });
    ```

    Then add a NEW mount-once useEffect IMMEDIATELY AFTER the existing `warmStartHadPostsRef` declaration (line 66) and the related state declarations. Position: BEFORE the existing `useEffect(() => { ... }, [questions, questionsLoading]);` at line 117. Best location: after the engagement-state declarations cluster (around lines 80-90) and before the existing exploredAnchors-related effects:

    ```ts
      // Phase 43 gap-closure 43-15 — mount-once: if the warm-start initializer
      // seeded dailyPosts from the yesterday-queue tier, remove those ids from
      // postQueueService._state.posts AND seed infiniteScrollService.seenPostIds
      // so the next loadNextBatch (swipe-for-more) cannot re-pop them.
      //
      // PRIMARY: removeByIds makes the two stores (warm-start dailyPosts +
      // postQueueService._state.posts) mutually exclusive — the structural
      // fix per UAT Test 12 root_cause approach (A).
      //
      // DEFENSE-IN-DEPTH: seedSeen primes infiniteScrollService.seenPostIds so
      // the existing dedup at infiniteScroll.service.ts:50 also catches any
      // future overlap — approach (B) from UAT root_cause.
      //
      // Cache tier (Plan 36-11 stale-cache rejection passed; today's served
      // posts) does NOT need this cleanup — those posts came from the cache,
      // not from _state.posts. History tier likewise. Only the yesterday-tier
      // path needs the splice + seed.
      //
      // See .planning/debug/duplicate-post-keys-after-force-new-day.md.
      useEffect(() => {
        const { tier, seededIds } = warmStartTierRef.current;
        if (tier === 'yesterday' && seededIds.length > 0) {
          postQueueService.removeByIds(seededIds);
          infiniteScrollService.seedSeen(seededIds);
        } else if (tier === 'cache' || tier === 'history') {
          // Seed the seenPostIds set even for cache + history tiers — if a
          // future loadNextBatch ever returns one of these ids (e.g., a
          // post-history fallback that ended up in trellis_post_queue),
          // service-level dedup catches it.
          if (seededIds.length > 0) {
            infiniteScrollService.seedSeen(seededIds);
          }
        }
      }, []);
    ```

    **Edit 2 — [location.pathname] re-sync (lines 204-224).**

    Replace the existing effect body with the same logic PLUS the symmetric removeByIds + seedSeen calls in the yesterday-queue branch:

    ```ts
      // Re-sync feed from cache when navigating back to /home.
      // Mirrors the line-41 useState initializer's fallback chain (tier 1: cache,
      // tier 2: yesterday's rehydrated queue). The initializer runs ONCE at mount
      // — HomeScreen is always-mounted in SwipeTabContainer, so navigate('/home')
      // does NOT remount it. Without this re-fallback, after Plan 36-15's
      // SettingsDataScreen mutation invalidates the daily-posts cache,
      // getCachedDailyPosts() returns [] and the feed renders empty — the
      // rehydrated _state.posts (Plan 36-11 Task 2) sits unreachable until the
      // next async getDailyPosts run (which is mount-only, not navigation-fired).
      // Phase 36-14 — closes the runtime half of round-4 sub-issue (b).
      //
      // Phase 43 gap-closure 43-15 — when tier-2 (yesterday-queue) fires, also
      // remove the seeded ids from _state.posts so loadNextBatch cannot re-pop
      // them (the duplicate-key root cause from UAT Test 12). seedSeen is the
      // defense-in-depth at the service-level dedup boundary.
      useEffect(() => {
        if (location.pathname !== '/home') return;
        const cached = conceptFeedService.getCachedDailyPosts();
        if (cached.length > 0) {
          setDailyPosts(cached);
          // Seed seenPostIds for cache tier too (defense-in-depth)
          if (cached.length > 0) infiniteScrollService.seedSeen(cached.map(p => p.id));
          return;
        }
        // Tier-2 fallback: yesterday's UNSERVED queue, rehydrated by
        // postQueueService.load()'s date-mismatch branch (Plan 36-11 Task 2).
        // This is the runtime mirror of the line-41 useState initializer's tier 2.
        postQueueService.loadQueue();
        const yesterdayQueue = postQueueService.getYesterdayQueue();
        if (yesterdayQueue.length > 0) {
          const slice = yesterdayQueue.slice(0, 8);
          setDailyPosts(slice);
          // Phase 43 gap-closure 43-15 — splice the seeded ids out of
          // _state.posts so loadNextBatch cannot re-pop them on the next
          // swipe-for-more. seedSeen primes the service-level dedup as
          // defense-in-depth. See .planning/debug/duplicate-post-keys-after-
          // force-new-day.md.
          const seededIds = slice.map(p => p.id);
          postQueueService.removeByIds(seededIds);
          infiniteScrollService.seedSeen(seededIds);
          return;
        }
        // Both tiers empty — preserve current behavior (set to empty so the
        // generic empty-state rendering takes over). The async getDailyPosts
        // flow elsewhere will repopulate when its triggers fire.
        setDailyPosts([]);
      }, [location.pathname]);
    ```

    **Edit 3 — handleLoad concat with id-based dedup (line 263).**

    Locate the existing concat at line 263:
    ```ts
            setDailyPosts((prev) => [...prev, ...newPosts]);
    ```

    Replace with id-based dedup:
    ```ts
            // Phase 43 gap-closure 43-15 — id-based dedup at the render boundary.
            // Defense-in-depth against any future code path that bypasses both
            // postQueueService.removeByIds() (the structural fix) AND
            // infiniteScrollService.seenPostIds dedup at the service-level
            // boundary. If a duplicate id somehow reaches here, it must NOT
            // produce a duplicate React key in MasonryFeed. See
            // .planning/debug/duplicate-post-keys-after-force-new-day.md UAT Test 12.
            setDailyPosts((prev) => {
              const seen = new Set(prev.map(p => p.id));
              const fresh = newPosts.filter(p => !seen.has(p.id));
              if (fresh.length === newPosts.length) {
                return [...prev, ...newPosts];
              }
              if (import.meta.env.DEV && fresh.length < newPosts.length) {
                console.warn(
                  `[HomeScreen handleLoad] dropped ${newPosts.length - fresh.length} duplicate post(s) at concat boundary — should not happen with 43-15 fixes in place`,
                );
              }
              return [...prev, ...fresh];
            });
    ```

    **Key details / invariants:**
    - The existing `infiniteScrollService` import at line 14 already covers the `seedSeen` call. The existing `postQueueService` import at line 15 already covers the `removeByIds` call. No import changes needed.
    - DO NOT change the `loadNextBatch` invocation at line 238 (`infiniteScrollService.loadNextBatch(questionsRef.current, 8)`) — its dedup at line 50 will already catch any leaked overlap thanks to seedSeen.
    - DO NOT change the `conceptFeedService.appendToCache(newPosts)` call at line 262 — appending duplicates to the cache is already filtered there (cache appendToCache has its own existingIds dedup at concept-feed.service.ts:1633).
    - DO NOT remove or modify Effect A (line 567) or Effect B (line 584). Those handle the dismiss-resync path (Plan 43-06 / sibling Plan 43-14); they are independent of this plan's queue-dedup work.
    - The `warmStartTierRef` ref shape is intentional — capturing tier discriminator + seededIds in one ref keeps the useState initializer pure (no setState inside it) and the companion useEffect can dispatch on tier.
    - History tier seeding (Edit 1's `else if` branch) is precautionary: postHistoryService.getPosts() draws from `trellis_post_history`, separate from the queue, so overlap is unlikely. But seedSeen is a cheap O(N) Set.add — including it costs nothing and prevents a hypothetical future regression.

    **Atomic commit messages (3 commits — one per edit):**
    1. `fix(43-15): capture warm-start tier + seeded ids in HomeScreen useState init`
    2. `fix(43-15): wire removeByIds + seedSeen into HomeScreen warm-start tier-2 fallback (initializer + location.pathname re-sync)`
    3. `fix(43-15): id-based dedup in HomeScreen handleLoad concat (defense-in-depth)`

    OR a single commit if the executor prefers cohesion: `fix(43-15): wire warm-start tier dedup + concat dedup in HomeScreen`. Either cadence is acceptable per CLAUDE.md atomic-commits guidance; the 3-commit variant tells a clearer review story.
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && grep -q "postQueueService.removeByIds(" src/screens/HomeScreen.tsx && grep -q "infiniteScrollService.seedSeen(" src/screens/HomeScreen.tsx && grep -q "new Set(prev.map" src/screens/HomeScreen.tsx && grep -q "warmStartTierRef" src/screens/HomeScreen.tsx && npx tsc -b --noEmit && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "postQueueService.removeByIds(" src/screens/HomeScreen.tsx` returns AT LEAST 2 (mount-once useEffect + location.pathname re-sync)
    - `grep -c "infiniteScrollService.seedSeen(" src/screens/HomeScreen.tsx` returns AT LEAST 2 (mount-once useEffect + location.pathname re-sync; cache + history tiers also seed seenPostIds for defense-in-depth)
    - `grep -c "new Set(prev.map" src/screens/HomeScreen.tsx` returns AT LEAST 1 (handleLoad concat dedup)
    - `grep -c "warmStartTierRef" src/screens/HomeScreen.tsx` returns AT LEAST 4 (declaration + 3 tier-branch assignments in initializer + 1 read in mount-once useEffect)
    - `cd app && npx tsc -b --noEmit` exits 0
    - `cd app && npm run build` exits 0
    - Existing exploredAnchors-resync + dismiss-resync effects at lines 540+ + 567+ + 584+ are UNCHANGED
  </acceptance_criteria>
  <done>HomeScreen now claims its warm-start slice via removeByIds + seedSeen AND defensive id-dedup guards the concat boundary.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Add post-queue-remove-by-id behavioral test</name>
  <files>app/tests/services/post-queue-remove-by-id.test.mjs</files>
  <read_first>
    - app/tests/services/post-queue-rehydrate.test.mjs (localStorage polyfill + makePost factory pattern)
    - app/tests/services/post-queue-dedup.test.mjs (dedup test shape)
    - app/src/services/post-queue.service.ts post-Task 1 (verify removeByIds shape)
  </read_first>
  <behavior>
    - Test 1: removeByIds([]) is a no-op (no save, no mutation)
    - Test 2: removeByIds(['nonexistent']) returns 0 and does not mutate _state.posts
    - Test 3: removeByIds(['p1','p3']) on a queue of [p1,p2,p3,p4] returns 2 and leaves [p2,p4]
    - Test 4: removeByIds is idempotent (calling twice returns 0 the second time)
    - Test 5: removeByIds persists the mutation to localStorage[STORAGE_KEY] — next loadQueue() reflects the removed state
    - Test 6: removeByIds does NOT touch STORAGE_KEY_YESTERDAY — the snapshot is read-only
    - Test 7: removeByIds does NOT decrement totalServed (separate metric for dequeue path)
    - Test 8: removeByIds does NOT mutate derivedList or cyclePosition (walker state independent of served-posts queue)
    - Test 9: NEGATIVE INVARIANT — walker code at line 389 is unchanged (Phase 39 D-07)
    - Test 10: NEGATIVE INVARIANT — load() date-mismatch rehydration at lines 78-121 is unchanged (Phase 36-11 contract)
  </behavior>
  <action>
    Create new file `app/tests/services/post-queue-remove-by-id.test.mjs`.

    File contents:

    ```js
    // Phase 43 Plan 43-15 — postQueueService.removeByIds behavioral test.
    //
    // Validates the new helper that removes specific post ids from _state.posts.
    // Used by HomeScreen warm-start tier-2 fallback to keep dailyPosts and the
    // dequeueable queue mutually exclusive after Force-New-Day. See
    // .planning/debug/duplicate-post-keys-after-force-new-day.md.
    //
    // Pattern: localStorage polyfill + dynamic import (mirrors
    // post-queue-rehydrate.test.mjs).

    import assert from 'node:assert/strict';
    import { describe, it, beforeEach } from 'node:test';
    import { readFileSync } from 'node:fs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appRoot = path.resolve(__dirname, '..', '..');

    globalThis.localStorage = {
      _store: new Map(),
      getItem(k) { return this._store.get(k) ?? null; },
      setItem(k, v) { this._store.set(k, String(v)); },
      removeItem(k) { this._store.delete(k); },
      clear() { this._store.clear(); },
    };

    const STORAGE_KEY = 'trellis_post_queue';
    const STORAGE_KEY_YESTERDAY = 'trellis_post_queue_yesterday';

    function todayStr() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    function makePost(id) {
      return {
        id,
        date: todayStr(),
        title: `Post ${id}`,
        teaser: { hook: '', preview: '' },
        bodyMarkdown: '',
        whyCare: '',
        takeaway: '',
        quickAskPrompts: [],
        narrativeMode: 'example-first',
        contextLabel: '',
        sourceType: 'recent',
        sourceQuestionIds: [],
        sourceQuestionTitles: [],
        keywords: [],
        generatedAt: Date.now(),
        origin: 'ai',
      };
    }

    const { postQueueService } = await import('../../src/services/post-queue.service.ts');

    describe('postQueueService.removeByIds — Phase 43 gap-closure 43-15', () => {
      beforeEach(() => {
        localStorage.clear();
        postQueueService.loadQueue();
      });

      it('Test 1: removeByIds([]) is a no-op — returns 0, no save', () => {
        const seed = { date: todayStr(), posts: [makePost('p1'), makePost('p2')], cycleNumber: 0, totalGenerated: 2, totalServed: 0, derivedList: [], cyclePosition: 0 };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        postQueueService.loadQueue();
        const removed = postQueueService.removeByIds([]);
        assert.equal(removed, 0, 'empty input returns 0');
        assert.equal(postQueueService.size(), 2, 'queue unchanged');
      });

      it('Test 2: removeByIds with no matches returns 0 and does not mutate', () => {
        const seed = { date: todayStr(), posts: [makePost('p1'), makePost('p2')], cycleNumber: 0, totalGenerated: 2, totalServed: 0, derivedList: [], cyclePosition: 0 };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        postQueueService.loadQueue();
        const removed = postQueueService.removeByIds(['nonexistent-x', 'nonexistent-y']);
        assert.equal(removed, 0);
        assert.equal(postQueueService.size(), 2);
        const queue = postQueueService.getQueue();
        assert.deepEqual(queue.map(p => p.id), ['p1', 'p2']);
      });

      it('Test 3: removeByIds([p1,p3]) removes both and returns 2', () => {
        const seed = { date: todayStr(), posts: [makePost('p1'), makePost('p2'), makePost('p3'), makePost('p4')], cycleNumber: 0, totalGenerated: 4, totalServed: 0, derivedList: [], cyclePosition: 0 };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        postQueueService.loadQueue();
        const removed = postQueueService.removeByIds(['p1', 'p3']);
        assert.equal(removed, 2);
        assert.equal(postQueueService.size(), 2);
        assert.deepEqual(postQueueService.getQueue().map(p => p.id), ['p2', 'p4']);
      });

      it('Test 4: removeByIds is idempotent — second call returns 0', () => {
        const seed = { date: todayStr(), posts: [makePost('p1'), makePost('p2'), makePost('p3')], cycleNumber: 0, totalGenerated: 3, totalServed: 0, derivedList: [], cyclePosition: 0 };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        postQueueService.loadQueue();
        const r1 = postQueueService.removeByIds(['p1', 'p2']);
        const r2 = postQueueService.removeByIds(['p1', 'p2']);
        assert.equal(r1, 2);
        assert.equal(r2, 0);
        assert.equal(postQueueService.size(), 1);
      });

      it('Test 5: removeByIds persists to localStorage[STORAGE_KEY]', () => {
        const seed = { date: todayStr(), posts: [makePost('p1'), makePost('p2'), makePost('p3')], cycleNumber: 0, totalGenerated: 3, totalServed: 0, derivedList: [], cyclePosition: 0 };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        postQueueService.loadQueue();
        postQueueService.removeByIds(['p2']);
        const raw = localStorage.getItem(STORAGE_KEY);
        assert.ok(raw, 'localStorage[STORAGE_KEY] still populated');
        const parsed = JSON.parse(raw);
        assert.deepEqual(parsed.posts.map(p => p.id), ['p1', 'p3']);
      });

      it('Test 6: removeByIds does NOT touch STORAGE_KEY_YESTERDAY snapshot', () => {
        // Seed a yesterday snapshot independently
        localStorage.setItem(STORAGE_KEY_YESTERDAY, JSON.stringify({
          date: 'yesterday',
          posts: [makePost('y1'), makePost('y2'), makePost('y3')],
        }));
        const seed = { date: todayStr(), posts: [makePost('p1'), makePost('p2')], cycleNumber: 0, totalGenerated: 2, totalServed: 0, derivedList: [], cyclePosition: 0 };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        postQueueService.loadQueue();

        postQueueService.removeByIds(['p1']);

        const snapRaw = localStorage.getItem(STORAGE_KEY_YESTERDAY);
        const snap = JSON.parse(snapRaw);
        assert.deepEqual(
          snap.posts.map(p => p.id),
          ['y1', 'y2', 'y3'],
          'STORAGE_KEY_YESTERDAY snapshot must be unchanged after removeByIds (Plan 36-09 contract preserved)',
        );
      });

      it('Test 7: removeByIds does NOT decrement totalServed (separate metric for dequeue path)', () => {
        const seed = { date: todayStr(), posts: [makePost('p1'), makePost('p2')], cycleNumber: 0, totalGenerated: 5, totalServed: 3, derivedList: [], cyclePosition: 0 };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        postQueueService.loadQueue();
        postQueueService.removeByIds(['p1']);
        assert.equal(postQueueService.getTotalServed(), 3, 'totalServed must NOT decrement on removeByIds (only dequeue path mutates it)');
      });

      it('Test 8: removeByIds does NOT mutate derivedList or cyclePosition', () => {
        const seed = { date: todayStr(), posts: [makePost('p1'), makePost('p2')], cycleNumber: 0, totalGenerated: 2, totalServed: 0, derivedList: ['anchor-a', 'anchor-b', 'anchor-c'], cyclePosition: 2 };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        postQueueService.loadQueue();
        postQueueService.removeByIds(['p1']);
        assert.deepEqual(postQueueService.getDerivedList(), ['anchor-a', 'anchor-b', 'anchor-c']);
        assert.equal(postQueueService.getCyclePosition(), 2);
      });

      it('Test 9: NEGATIVE INVARIANT — walker code at line 389 is unchanged (Phase 39 D-07)', () => {
        const src = readFileSync(path.join(appRoot, 'src/services/post-queue.service.ts'), 'utf8');
        assert.match(
          src,
          /!exploredIds\.has\(id\)\s*&&\s*!dismissedIds\.has\(id\)/,
          'walker dismiss-skip predicate must be unchanged',
        );
        assert.match(
          src,
          /maxSteps\s*=\s*Math\.max\(count\s*\*\s*2,\s*len\)/,
          'walker termination guard must be unchanged (Phase 36 GAP-B)',
        );
      });

      it('Test 10: NEGATIVE INVARIANT — load() date-mismatch rehydration is unchanged (Phase 36-11)', () => {
        const src = readFileSync(path.join(appRoot, 'src/services/post-queue.service.ts'), 'utf8');
        // The rehydration block: snapshot to STORAGE_KEY_YESTERDAY, then rehydrate _state.posts
        assert.match(
          src,
          /localStorage\.setItem\(STORAGE_KEY_YESTERDAY/,
          'Plan 36-09 snapshot write must be preserved',
        );
        assert.match(
          src,
          /spreadByConcept\(rehydrated\)/,
          'Phase 36-11 re-interleave (spreadByConcept) must be preserved',
        );
        assert.match(
          src,
          /spreadByStyle\(rehydrated\)/,
          'Phase 36-11 re-interleave (spreadByStyle) must be preserved',
        );
      });
    });
    ```

    **Atomic commit message:** `test(43-15): postQueueService.removeByIds behavioral + walker non-regression`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/services/post-queue-remove-by-id.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Test file exists at app/tests/services/post-queue-remove-by-id.test.mjs
    - Test count is 10
    - `cd app && node --test tests/services/post-queue-remove-by-id.test.mjs` exits 0
    - Test 6 asserts STORAGE_KEY_YESTERDAY untouched
    - Tests 9 + 10 assert walker + load() rehydration unchanged
  </acceptance_criteria>
  <done>Behavioral + source-reading non-regression invariants lock removeByIds AND prove walker + load() rehydration are unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Add HomeScreen.force-new-day-dedup source-reading test</name>
  <files>app/tests/screens/HomeScreen.force-new-day-dedup.test.mjs</files>
  <read_first>
    - app/tests/screens/HomeScreen.warm-start-refallback.test.mjs (Phase 36-14 source-reading pattern)
    - app/tests/screens/HomeScreen.engagement-resync.test.mjs (Phase 43-06 pattern)
    - app/src/screens/HomeScreen.tsx post-Task 3 (verify wiring landed)
    - app/src/services/concept-feed.service.ts (loadCache Phase 36-11 stale-cache rejection)
  </read_first>
  <behavior>
    - Test 1: HomeScreen tier-2 (yesterday-queue) warm-start fallback at the useState initializer captures the seeded slice ids in warmStartTierRef (regex: warmStartTierRef.current = { tier: 'yesterday', seededIds: ...})
    - Test 2: A mount-once useEffect reads warmStartTierRef and calls postQueueService.removeByIds(seededIds) + infiniteScrollService.seedSeen(seededIds) on tier === 'yesterday'
    - Test 3: The [location.pathname] re-sync effect also calls removeByIds + seedSeen in its yesterday-queue branch
    - Test 4: HomeScreen.handleLoad concat uses id-based dedup (new Set(prev.map(p => p.id)) + filter)
    - Test 5: NEGATIVE INVARIANT — Phase 36-11 stale-cache rejection at concept-feed.service.ts:187 is preserved (loadCache returns null on date mismatch)
    - Test 6: NEGATIVE INVARIANT — Phase 36-14 tier-2 warm-start re-fallback structure is preserved (the [location.pathname] re-sync still reads getCachedDailyPosts first AND falls through to getYesterdayQueue)
    - Test 7: NEGATIVE INVARIANT — numeric defaults at post-queue.service.ts preserved (MAX_QUEUE_SIZE = 32, REFILL_THRESHOLD = 24); loadNextBatch default limit = 8 at infiniteScroll.service.ts
    - Test 8: COUNTERWEIGHT — new methods exist on the service singletons (post-queue.service.ts declares removeByIds; infiniteScroll.service.ts declares seedSeen)
  </behavior>
  <action>
    Create new file `app/tests/screens/HomeScreen.force-new-day-dedup.test.mjs`.

    File contents:

    ```js
    // Phase 43 Plan 43-15 — source-reading invariants for HomeScreen
    // warm-start dedup AND defensive concat dedup AND Phase 36-11 / 36-14 /
    // numeric-defaults non-regression.
    //
    // Asserts:
    //   (1) warm-start initializer captures tier + seededIds in warmStartTierRef
    //   (2) mount-once useEffect calls removeByIds + seedSeen on yesterday tier
    //   (3) [location.pathname] re-sync calls removeByIds + seedSeen in
    //       yesterday-queue branch
    //   (4) handleLoad concat uses id-based dedup
    //   (5) loadCache Phase 36-11 stale-cache rejection PRESERVED
    //   (6) Phase 36-14 tier-2 warm-start re-fallback structure PRESERVED
    //   (7) Numeric defaults preserved
    //   (8) removeByIds + seedSeen exist as service singleton methods
    //
    // Pattern: readFileSync + regex. No React render, no jsdom. Mirrors
    // app/tests/screens/HomeScreen.engagement-resync.test.mjs.

    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appRoot = path.resolve(__dirname, '..', '..');
    const homeSrc = readFileSync(path.join(appRoot, 'src/screens/HomeScreen.tsx'), 'utf8');
    const queueSrc = readFileSync(path.join(appRoot, 'src/services/post-queue.service.ts'), 'utf8');
    const infScrollSrc = readFileSync(path.join(appRoot, 'src/services/infiniteScroll.service.ts'), 'utf8');
    const feedSrc = readFileSync(path.join(appRoot, 'src/services/concept-feed.service.ts'), 'utf8');

    test('43-15 Test 1: warm-start initializer captures tier + seededIds in warmStartTierRef', () => {
      // Ref declaration
      assert.match(
        homeSrc,
        /warmStartTierRef\s*=\s*useRef</,
        'warmStartTierRef declaration must exist',
      );
      // The yesterday branch assigns tier: 'yesterday' with seededIds populated
      assert.match(
        homeSrc,
        /tier:\s*['"]yesterday['"]/,
        'yesterday tier discriminator must be set',
      );
      assert.match(
        homeSrc,
        /seededIds:\s*\w+\.map\(p\s*=>\s*p\.id\)/,
        'seededIds must be derived from slice.map(p => p.id) (or similar)',
      );
    });

    test('43-15 Test 2: mount-once useEffect dispatches on yesterday tier and calls removeByIds + seedSeen', () => {
      // Locate the mount-once useEffect that reads warmStartTierRef.current
      const refReadIdx = homeSrc.indexOf('warmStartTierRef.current');
      assert.ok(refReadIdx > 0, 'warmStartTierRef.current must be read somewhere');
      // The reading site should be inside a useEffect with empty deps
      const region = homeSrc.slice(refReadIdx, refReadIdx + 800);
      assert.match(region, /tier\s*===\s*['"]yesterday['"]/, 'must branch on tier === yesterday');
      assert.match(region, /postQueueService\.removeByIds\(/);
      assert.match(region, /infiniteScrollService\.seedSeen\(/);
      // The effect deps array must be empty (mount-once)
      // Search for the closing `}, [])` near the end of the region
      assert.match(region, /\},\s*\[\]\)/);
    });

    test('43-15 Test 3: [location.pathname] re-sync calls removeByIds + seedSeen in yesterday-queue branch', () => {
      const reSyncStart = homeSrc.indexOf("if (location.pathname !== '/home') return;");
      assert.ok(reSyncStart > 0, '[location.pathname] re-sync must exist');
      const reSyncEnd = homeSrc.indexOf('}, [location.pathname]', reSyncStart);
      const reSyncBody = homeSrc.slice(reSyncStart, reSyncEnd);
      assert.match(reSyncBody, /postQueueService\.getYesterdayQueue\(\)/);
      assert.match(reSyncBody, /postQueueService\.removeByIds\(/);
      assert.match(reSyncBody, /infiniteScrollService\.seedSeen\(/);
    });

    test('43-15 Test 4: handleLoad concat uses id-based dedup', () => {
      // The setDailyPosts((prev) => {...}) form with new Set(prev.map(p => p.id))
      assert.match(
        homeSrc,
        /setDailyPosts\(\s*\(\s*prev\s*\)\s*=>\s*\{[\s\S]*?new\s+Set\s*\(\s*prev\.map\(/,
        'handleLoad concat must use Set-based id dedup',
      );
      assert.match(
        homeSrc,
        /newPosts\.filter\(\s*p\s*=>\s*!\s*seen\.has\(p\.id\)/,
        'newPosts must be filtered against the prev id Set',
      );
    });

    test('43-15 Test 5: NEGATIVE — Phase 36-11 stale-cache rejection at loadCache() is unchanged', () => {
      // loadCache returns null when parsed.date !== today() — this is the
      // gate that fires after Force-New-Day (today's cache.date set to
      // yesterday by SettingsDataScreen.handleForceNewDay).
      assert.match(
        feedSrc,
        /if\s*\(\s*parsed\.date\s*!==\s*today\(\)\s*\)\s*\{[\s\S]*?return\s+null/,
        'Phase 36-11 stale-cache rejection in loadCache() must be preserved',
      );
    });

    test('43-15 Test 6: NEGATIVE — Phase 36-14 tier-2 warm-start re-fallback structure is preserved', () => {
      // The [location.pathname] re-sync effect must still:
      //   1. Read conceptFeedService.getCachedDailyPosts()
      //   2. Fall through to postQueueService.getYesterdayQueue() if cached is empty
      const reSyncStart = homeSrc.indexOf("if (location.pathname !== '/home') return;");
      const reSyncEnd = homeSrc.indexOf('}, [location.pathname]', reSyncStart);
      const reSyncBody = homeSrc.slice(reSyncStart, reSyncEnd);

      const cacheCallIdx = reSyncBody.indexOf('conceptFeedService.getCachedDailyPosts');
      const queueCallIdx = reSyncBody.indexOf('postQueueService.getYesterdayQueue');
      assert.ok(cacheCallIdx > 0, 'getCachedDailyPosts must still be read first');
      assert.ok(queueCallIdx > 0, 'getYesterdayQueue fallback must still be present');
      assert.ok(queueCallIdx > cacheCallIdx, 'queue fallback must come AFTER cache check');
    });

    test('43-15 Test 7: NEGATIVE — numeric defaults preserved (MAX_QUEUE_SIZE=32, REFILL_THRESHOLD=24, loadNextBatch limit=8)', () => {
      assert.match(queueSrc, /MAX_QUEUE_SIZE\s*=\s*32\b/);
      assert.match(queueSrc, /REFILL_THRESHOLD\s*=\s*24\b/);
      assert.match(infScrollSrc, /loadNextBatch\([^)]*limit\s*=\s*8\b/);
    });

    test('43-15 Test 8: COUNTERWEIGHT — removeByIds + seedSeen exist as service singleton methods', () => {
      assert.match(queueSrc, /removeByIds\(\s*ids:\s*string\[\]\s*\)\s*:\s*number/);
      assert.match(infScrollSrc, /seedSeen\(\s*ids:\s*string\[\]\s*\)\s*:\s*void/);
    });
    ```

    **Atomic commit message:** `test(43-15): HomeScreen warm-start dedup invariants + Phase 36-11/36-14 non-regression`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/screens/HomeScreen.force-new-day-dedup.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Test file exists at app/tests/screens/HomeScreen.force-new-day-dedup.test.mjs
    - Test count is 8
    - `cd app && node --test tests/screens/HomeScreen.force-new-day-dedup.test.mjs` exits 0
    - Tests 5 + 6 + 7 are NEGATIVE INVARIANTS (regression guards for Phase 36-11 + Phase 36-14 + numeric defaults)
  </acceptance_criteria>
  <done>Source-reading invariants lock the warm-start dedup wiring AND prove Phase 36-11 + 36-14 + numeric defaults are intact.</done>
</task>

<task type="auto">
  <name>Task 6: Run full suite + manually re-verify UAT Test 12 + commit SUMMARY</name>
  <files>.planning/phases/43-engagement-ui/43-15-force-new-day-dedup-SUMMARY.md</files>
  <read_first>
    - .planning/phases/43-engagement-ui/43-UAT.md (Test 12 expected behavior + failure reason + root_cause)
    - Tasks 1-5 of this plan (verify all artifacts landed)
  </read_first>
  <action>
    1. Run the full test suite from `app/`:
       ```bash
       cd /Users/Code/EchoLearn/app
       node --test tests/services tests/screens tests/components tests/state tests/locales tests/layout
       npx tsc -b --noEmit
       npm run build
       ```
       All must exit 0.

    2. Execute UAT Test 12 manually (post-merge dev build):
       - Start the dev server (cd app && npm run dev)
       - Have an existing day's worth of generated posts (≥32 in the queue)
       - Open browser DevTools console — enable "Preserve log" and clear it
       - Settings → Data → Force New Day → confirm
       - Land on /home
       - Pull up / swipe-for-more once (triggers loadNextBatch → dequeue(8))
       - Verify the console shows NO "Encountered two children with the same key" React DEV warnings
       - Note: the `[HomeScreen loadNextBatch] popped 8 posts, styles: {...}` log MAY still appear (it's a normal info log); only the duplicate-key warning is the gap signal.
       - Optionally also verify post-history + saved + liked archives are unchanged (Test 9 — confirms 43-13 still holds and we didn't disturb engagement persistence).

    3. Write `.planning/phases/43-engagement-ui/43-15-force-new-day-dedup-SUMMARY.md`:

       ```markdown
       ---
       phase: 43-engagement-ui
       plan: 15
       plan_id: 43-15
       slug: force-new-day-dedup
       status: complete
       gap_closure: true
       closed_gap: "UAT Test 12 — Duplicate React keys after Force-New-Day (blocker)"
       commits: <fill with hashes>
       ---

       # Plan 43-15 — Force-New-Day dedup — SUMMARY

       **Closed:** <date>
       **Gap closed:** Phase 43 UAT Test 12 (blocker) — after Force-New-Day +
       swipe-for-more, the home feed no longer emits React duplicate-key warnings.
       Each post id renders exactly once across the initial dailyPosts seed and any
       subsequent dequeue batches.

       ## Root cause (confirmed)

       Yesterday-snapshot posts existed in TWO independent stores after
       Force-New-Day: STORAGE_KEY_YESTERDAY (the durable snapshot read by
       getYesterdayQueue) AND postQueueService._state.posts (rehydrated from the
       same parsed.posts payload by load()). HomeScreen's warm-start tier-2 fallback
       seeded dailyPosts from store 1; the next loadNextBatch → dequeue(8) pulled
       overlapping ids from store 2. handleLoad's concat at line 263 had no id-dedup;
       infiniteScrollService.seenPostIds was never seeded from warm-start fallback,
       so its service-level dedup at line 50 was empty. Result: duplicate React keys.

       The deeper architectural cause: Phase 36's "new-day rehydration" design intent
       (the rehydrated _state.posts becomes today's feed via getDailyPosts → dequeue
       → saveCache) relies on getDailyPosts being called after rehydration. That
       call is wired only to [questions, questionsLoading] useEffect at line 117,
       which does NOT re-run on /home navigation when questions are unchanged —
       Force-New-Day leaves the question set intact. So the rehydrated _state.posts
       is never drained into the daily cache; warm-start peeks at the snapshot AND
       the queue still holds the full payload — collision is structural.

       ## Fix (both approaches — defense-in-depth)

       **Approach A (structural):**
       - New `postQueueService.removeByIds(ids: string[]): number` helper splices
         specific ids out of _state.posts AND persists. STORAGE_KEY_YESTERDAY +
         totalServed + derivedList + cyclePosition all UNCHANGED.
       - HomeScreen warm-start initializer captures tier + seededIds in
         `warmStartTierRef`. A mount-once useEffect dispatches on tier === 'yesterday'
         and calls `postQueueService.removeByIds(seededIds) +
         infiniteScrollService.seedSeen(seededIds)`.
       - HomeScreen [location.pathname] re-sync (Phase 36-14) symmetrically calls
         removeByIds + seedSeen in its yesterday-queue branch.

       **Approach B (render-boundary guard):**
       - New `infiniteScrollService.seedSeen(ids: string[]): void` primes
         seenPostIds with externally-known ids; the existing dedup at line 50
         picks up the overlap.
       - HomeScreen handleLoad concat at line 263 now does Set-based id dedup:
         `setDailyPosts((prev) => { const seen = new Set(prev.map(p => p.id)); const fresh = newPosts.filter(p => !seen.has(p.id)); ... })`.
       - Cache + history warm-start tiers also seed seenPostIds for completeness.

       ## Invariants preserved

       - `STORAGE_KEY_YESTERDAY` durable snapshot — UNCHANGED (Plan 36-09).
       - `load()` date-mismatch rehydration (lines 78-121) — UNCHANGED (Phase 36-11).
       - `loadCache()` stale-cache rejection (concept-feed.service.ts:187) — UNCHANGED.
       - `walkDerivedList` dismiss-skip + termination guard (post-queue.service.ts:389/383) — UNCHANGED.
       - Numeric defaults: `MAX_QUEUE_SIZE = 32`, `REFILL_THRESHOLD = 24`,
         `loadNextBatch` default `limit = 8` — UNCHANGED.
       - `dequeue()` semantics (splice + totalServed increment + save) — UNCHANGED.
       - Phase 36-14 tier-2 warm-start re-fallback structure (getCachedDailyPosts →
         fall through to getYesterdayQueue) — UNCHANGED, augmented with the dedup
         step in the yesterday branch.
       - Phase 43-06 dual-effect dismiss resync — UNCHANGED.

       ## Tests

       - `app/tests/services/post-queue-remove-by-id.test.mjs` — 10 tests covering
         empty input, no-match, match-and-remove, idempotence, localStorage persist,
         STORAGE_KEY_YESTERDAY untouched, totalServed unchanged, derivedList
         unchanged, walker non-regression, load() rehydration non-regression.
       - `app/tests/screens/HomeScreen.force-new-day-dedup.test.mjs` — 8 tests covering
         warmStartTierRef capture, mount-once useEffect dispatch, [location.pathname]
         re-sync wiring, handleLoad concat dedup, Phase 36-11 stale-cache preserved,
         Phase 36-14 tier-2 structure preserved, numeric defaults preserved,
         service-method counterweight.

       ## UAT Test 12 — re-tested

       - Generate ≥32 posts in the queue.
       - Settings → Data → Force New Day → confirm.
       - Land on /home.
       - Pull-up swipe-for-more.
       - DevTools console: NO "Encountered two children with the same key" warnings.
       - Test 9 (Force-New-Day Resets ONLY Dismissed) re-verified: saved + liked
         archives still present.

       ## Files changed

       - `app/src/services/post-queue.service.ts` — 1 method added (removeByIds)
       - `app/src/services/infiniteScroll.service.ts` — 1 method added (seedSeen)
       - `app/src/screens/HomeScreen.tsx` — warmStartTierRef + mount-once useEffect +
         [location.pathname] re-sync edit + handleLoad concat dedup
       - `app/tests/services/post-queue-remove-by-id.test.mjs` — NEW (10 tests)
       - `app/tests/screens/HomeScreen.force-new-day-dedup.test.mjs` — NEW (8 tests)

       ## Commits

       - `<hash>` feat(43-15): add postQueueService.removeByIds for warm-start dedup
       - `<hash>` feat(43-15): add infiniteScrollService.seedSeen for warm-start dedup defense-in-depth
       - `<hash>` fix(43-15): wire warm-start tier dedup + concat dedup in HomeScreen
       - `<hash>` test(43-15): postQueueService.removeByIds behavioral + walker non-regression
       - `<hash>` test(43-15): HomeScreen warm-start dedup invariants + Phase 36-11/36-14 non-regression
       ```

    4. Commit the SUMMARY:
       ```bash
       cd /Users/Code/EchoLearn
       node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(43-15): close gap-closure plan with UAT Test 12 re-verification" --files .planning/phases/43-engagement-ui/43-15-force-new-day-dedup-SUMMARY.md
       ```
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/services tests/screens tests/components tests/state tests/locales tests/layout && npx tsc -b --noEmit && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - Full test suite exits 0
    - tsc -b --noEmit exits 0
    - npm run build exits 0
    - SUMMARY.md exists with root_cause + fix + invariants + test list + commit chain
    - UAT Test 12 manually re-verified — no duplicate-key warnings after Force-New-Day + swipe-for-more
    - UAT Test 9 also still passes (43-13 not regressed)
  </acceptance_criteria>
  <done>Phase 43 UAT Test 12 closed; SUMMARY documents both approaches (A + B), invariants preserved, tests + commit chain.</done>
</task>

</tasks>

<verification>
- `cd app && npx tsc -b --noEmit` exits 0
- `cd app && node --test tests/services tests/screens tests/components tests/state tests/locales tests/layout` exits 0
- `cd app && npm run build` exits 0
- Manual UAT Test 12 (post-merge):
  - Have ≥32 generated posts (visible in Settings → cache stats or via dev console).
  - Settings → Data → Force New Day → confirm.
  - Land on /home. Open DevTools console (preserve log enabled, clear console).
  - Pull-up swipe-for-more.
  - NO "Encountered two children with the same key" React DEV warnings.
  - `[HomeScreen loadNextBatch] popped 8 posts, styles: {...}` info log MAY still appear (normal).
- Manual non-regression spot-check:
  - UAT Test 9 (Force-New-Day Resets ONLY Dismissed): saved + liked archives still present after Force-New-Day. 43-13 not regressed.
  - UAT Test 4 (Dismiss propagates to same-anchor tiles): sibling plan 43-14 closes this; if 43-14 also lands, dismiss + Force-New-Day should both behave correctly.
  - Phase 36-14 warm-start re-fallback: navigate /settings/data → /home → feed shows yesterday's leftover queue (positive case).
  - Phase 36-11 stale-cache rejection: dev console shows no "stale cache rendered" symptoms.
</verification>

<success_criteria>
- postQueueService.removeByIds exists and is called from HomeScreen's two tier-2 fallback sites
- infiniteScrollService.seedSeen exists and is called from HomeScreen's warm-start fallback sites
- HomeScreen.handleLoad concat has id-based dedup at the render boundary
- warmStartTierRef captures tier + seededIds in useState init; mount-once useEffect dispatches the dedup
- Phase 36-11 stale-cache rejection — PRESERVED
- Phase 36-14 tier-2 warm-start re-fallback — PRESERVED
- STORAGE_KEY_YESTERDAY snapshot contract — PRESERVED (untouched by removeByIds)
- Walker dismiss-skip + termination guard at post-queue.service.ts:389/383 — PRESERVED
- Numeric defaults (MAX_QUEUE_SIZE=32, REFILL_THRESHOLD=24, limit=8) — PRESERVED
- 2 new test files; 18 total new test assertions (10 + 8)
- 5-6 atomic commits (or 3-4 if Task 3's three edits are bundled)
- UAT Test 12 re-verifies green (no duplicate-key warnings)
- UAT Test 9 still passes (43-13 not regressed)
</success_criteria>

<output>
After completion, the existing 43-15-...-SUMMARY.md (created in Task 6) documents:
- Both approaches landed (A — structural via removeByIds; B — render-boundary via seedSeen + concat dedup)
- 3 source files edited + 2 new test files
- 5-6 atomic commit hashes
- UAT Test 12 status: closed (re-verified after Force-New-Day + swipe-for-more)
- All preserved invariants enumerated: Phase 36-11, Phase 36-14, STORAGE_KEY_YESTERDAY, walker, numeric defaults
- Regression-guarded by the test suite — negative invariants assert the preserved files
</output>
</content>
</invoke>