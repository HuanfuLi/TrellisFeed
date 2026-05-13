---
phase: 43-engagement-ui
plan: 14
plan_id: 43-14
slug: dismiss-filter-at-read-boundary
type: execute
wave: 5
depends_on: []
files_modified:
  - app/src/services/concept-feed.service.ts
  - app/tests/services/concept-feed-dismiss-filter.test.mjs
  - app/tests/screens/HomeScreen.dismiss-resync.test.mjs
autonomous: true
gap_closure: true
parallel_safe: true
estimated_commits: 3-4
requirements: [ENGAGE-01]
must_haves:
  truths:
    - "Dismissing any one tile of a multi-tile anchor concept fades out ALL tiles sharing that anchor — across the live dismiss event AND across page refresh AND across PLANNER_UPDATED-driven refreshFeed AND across the 8s delayed refresh timer."
    - "conceptFeedService.getCachedDailyPosts() filters out posts whose sourceQuestionIds[0] is in engagementService.getDismissedAnchorIds() BEFORE returning."
    - "conceptFeedService.getDailyPosts() cache-hit branch (and same-day fingerprint-mismatch branch) filter out dismissed-anchor posts before returning."
    - "Effect A in HomeScreen (live ANCHOR_DISMISSED filter for fade-out animation) remains intact and continues to drive the AnimatePresence exit transition."
    - "post-queue.service.ts walkDerivedList dismiss-skip at line 389 is UNCHANGED (Phase 39 D-07 contract preserved)."
    - "loadCache() Phase 36-11 stale-cache rejection at concept-feed.service.ts:187 is UNCHANGED (yesterday's served posts must not render across midnight)."
    - "filterDecayedStarters + sourceType !== 'connection' filters in cache-read paths are preserved."
  artifacts:
    - path: "app/src/services/concept-feed.service.ts"
      provides: "Single private helper applyDismissedFilter(posts) called inside getCachedDailyPosts() AND inside the getDailyPosts() cache-hit branch AND inside the getDailyPosts() same-day fingerprint-mismatch branch — filters posts by post.sourceQuestionIds[0] not in engagementService.getDismissedAnchorIds(). Walker dismiss-skip at line 1290 + line 389 of post-queue.service.ts left as-is."
    - path: "app/tests/services/concept-feed-dismiss-filter.test.mjs"
      provides: "Behavioral test using a stub engagementService that proves the cache-read boundary filters dismissed anchors — covers getCachedDailyPosts and the getDailyPosts cache-hit branch."
    - path: "app/tests/screens/HomeScreen.dismiss-resync.test.mjs"
      provides: "Source-reading invariants asserting (a) the live Effect A ANCHOR_DISMISSED filter is still present; (b) the four write paths (warm-start initializer, main effect, refreshFeed, location.pathname re-sync) all flow through getCachedDailyPosts / getDailyPosts — i.e., they rely on the read-boundary filter rather than each calling getDismissedAnchorIds() themselves; (c) walker dismiss-skip code is unchanged."
  key_links:
    - from: "app/src/services/concept-feed.service.ts getCachedDailyPosts()"
      to: "app/src/services/engagement.service.ts getDismissedAnchorIds()"
      via: "applyDismissedFilter helper invocation"
      pattern: "engagementService\\.getDismissedAnchorIds\\(\\)"
    - from: "app/src/services/concept-feed.service.ts getDailyPosts() cache-hit branch (line ~1488)"
      to: "app/src/services/engagement.service.ts getDismissedAnchorIds()"
      via: "applyDismissedFilter helper invocation before return"
      pattern: "engagementService\\.getDismissedAnchorIds\\(\\)"
---

<objective>
Gap-closure plan for Phase 43 re-verify UAT **Test 4** (severity: major).

**Diagnosed root cause** (.planning/debug/dismiss-not-propagating-to-same-anchor-tiles.md):
`concept-feed.service.ts`'s `getCachedDailyPosts()` (lines 1593-1599) and `getDailyPosts()` cache-hit branch (lines 1488-1499) return cached posts WITHOUT applying `engagementService.getDismissedAnchorIds()`. HomeScreen has four independent read paths that all call `setDailyPosts(...)` from these unfiltered service reads:
1. `useState` warm-start initializer (HomeScreen.tsx:41-50)
2. Main effect's `getDailyPosts(questions).then(setDailyPosts)` (HomeScreen.tsx:128-147)
3. `refreshFeed()` invoked by PLANNER_UPDATED subscription + 8s delayed refresh timer (HomeScreen.tsx:126-184)
4. The `[location.pathname]` re-sync effect's `getCachedDailyPosts()` call (HomeScreen.tsx:204-224)

Each of these overwrites Effect A's live ANCHOR_DISMISSED filter and Effect B's `[location.pathname]` re-read, so on refresh the dismissed-anchor siblings reappear, and any PLANNER_UPDATED emission or 8s timer fires re-introduces them.

**Fix direction** (operator-validated in UAT root_cause):
Centralize the dismiss filter at the **READ BOUNDARY** — apply `engagementService.getDismissedAnchorIds()` inside `getCachedDailyPosts()` AND inside `getDailyPosts()` cache-hit + fingerprint-mismatch branches. This makes every HomeScreen consumer dismiss-aware by construction; no per-consumer post-filter is needed. Keep Effect A in HomeScreen for the live-dismiss fade-out animation (AnimatePresence depends on items disappearing from state mid-render, which fires before any service re-read).

**Constraints (load-bearing):**
- Walker dismiss-skip at `post-queue.service.ts:389` (Phase 39 D-07 contract) MUST be unchanged — already correct for FUTURE refill cycles.
- `loadCache()` Phase 36-11 stale-cache rejection (concept-feed.service.ts:187, yesterday's SERVED posts must not render across midnight) MUST be unchanged.
- The existing `filterDecayedStarters` + `sourceType !== 'connection'` filters in the cache-read paths MUST be preserved (additive composition with the new dismiss filter, not replacement).
- Source-reading invariants per Phase 39+ discipline (readFileSync + regex; no React render, no jsdom).

Purpose: Restore the operator-intended dismiss semantics ("I don't want to see this concept again" honored uniformly across refresh + PLANNER_UPDATED + 8s timer + cross-screen navigation).
Output: 3-file change set (1 source file edited, 2 new test files); 3-4 atomic commits.

**Parallel-safety note:** This plan touches concept-feed.service.ts (additive helper + 2-3 call sites at well-defined line ranges) and adds two new test files in distinct directories. No other plan in this wave touches concept-feed.service.ts. 43-15 (the sibling gap-closure plan) touches post-queue.service.ts + HomeScreen.tsx — non-overlapping. Fully parallel-safe.
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
@.planning/debug/dismiss-not-propagating-to-same-anchor-tiles.md

# CLAUDE.md — load-bearing sections
# ("Concept Feed Generation Pipeline" + "Best practices learned in Phase 32.1"
# + Phase 36-11 stale-cache rejection + always-mounted screens re-sync)
@CLAUDE.md

# Source-of-truth files
@app/src/services/concept-feed.service.ts
@app/src/services/engagement.service.ts
@app/src/services/post-queue.service.ts
@app/src/screens/HomeScreen.tsx

# Existing test pattern precedents
@app/tests/services/engagement.service.reset-dismissed-only.test.mjs
@app/tests/screens/HomeScreen.engagement-resync.test.mjs
@app/tests/services/engagement-anti-wire.test.mjs

<interfaces>
From app/src/services/engagement.service.ts (Phase 39 API):
- getDismissedAnchorIds(): string[] — returns a fresh array copy of state.dismissed (line 182)
  Safe to call from any read-time consumer (sync, localStorage-backed, no event emission).

From app/src/services/concept-feed.service.ts (current shape, all targets of this plan):

Lines 1480-1544 — getDailyPosts(questions):
  - Lines 1487-1499: CACHE-HIT branch — `const feedPosts = cached.posts.filter((p) => p.sourceType !== 'connection');`
    then `const decayed = filterDecayedStarters(feedPosts);` then `return decayed;`
    ← INSERT dismiss filter immediately after sourceType filter, BEFORE filterDecayedStarters.
  - Lines 1501-1513: FINGERPRINT-MISMATCH same-day branch — also returns `cached.posts.filter((p) => p.sourceType !== 'connection')`
    ← INSERT dismiss filter symmetrically.
  - Lines 1515-1525: drain branch (queue dequeue) — already passes through queue which is dismiss-aware via walker.
    Verify but no edit needed: dequeued posts came from walker-filtered derivedList per Phase 39 D-07.

Lines 1593-1599 — getCachedDailyPosts():
  - Current: `const allPosts = (loadCache()?.posts ?? []).filter((p) => p.sourceType !== 'connection');`
    then `const feedPosts = filterDecayedStarters(allPosts);` then `return feedPosts;`
    ← INSERT dismiss filter between connection filter and filterDecayedStarters.

Line 1290 (inside refillQueue): `const dismissedIds = new Set(engagementService.getDismissedAnchorIds());`
  passed to `postQueueService.walkDerivedList(count, exploredIds, dismissedIds)` at line ~1295.
  ← UNCHANGED — walker dismiss-skip is the FORWARD-LOOKING filter (future refills); this plan adds
  the READ-TIME filter (already-cached posts).

Line 13: `import { engagementService } from './engagement.service.ts';` — import already exists.

From app/src/services/post-queue.service.ts (Phase 39 D-07 contract):
- Line 389: `if (!exploredIds.has(id) && !dismissedIds.has(id)) result.push(id);` — UNCHANGED in this plan.
  Test 3 asserts this exact line is preserved as a negative-invariant.

From app/src/screens/HomeScreen.tsx (unchanged by this plan, but verified by source-reading tests):
- Lines 41-50: useState warm-start initializer chain (cached → yesterdayQueue → history)
- Lines 117-192: main effect with getDailyPosts + refreshFeed + delayed refresh timer
- Lines 204-224: location.pathname re-sync (Phase 36-14)
- Lines 567-574: Effect A — live ANCHOR_DISMISSED filter (LP-05 fast path, drives AnimatePresence)
- Lines 584-591: Effect B — [location.pathname] engagementService.getDismissedAnchorIds resync

Effect A invariant (preserved by this plan): the live filter MUST stay in place so the dismiss action
produces an immediate setDailyPosts(prev => prev.filter(...)) call — AnimatePresence's exit transition
depends on the item leaving prev synchronously. Effect B's re-read of engagementService is now
strictly redundant (the read boundary would also filter on next re-render), but we keep it as
defense-in-depth for any future code path that might side-step the read boundary; this plan's tests
assert Effect A is still present (Test 4 in HomeScreen.dismiss-resync.test.mjs).

Phase 36-11 stale-cache rejection — concept-feed.service.ts:187 — UNCHANGED. The dismiss filter
applies AFTER loadCache() returns a non-null cached payload (i.e., after the date check). On
date-mismatch, loadCache() returns null and getCachedDailyPosts/getDailyPosts cache-hit do not
run — the dismiss filter is irrelevant in that branch.

filterDecayedStarters — concept-feed.service.ts (used in cache-read paths). Filter composes:
  cached.posts → filter(sourceType !== 'connection') → filter(!dismissedAnchor) → filterDecayedStarters → return
Composition order rationale: dismiss filter is cheap (Set.has check on at most O(N) posts); placing
it between the connection-filter and the decay-filter keeps existing filter ordering and the decay
heuristic (which counts organic posts >=3) sees the dismiss-filtered count, which is correct —
a dismissed anchor's posts should not count toward "organic posts that displace starters."
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add applyDismissedFilter helper + wire into getCachedDailyPosts() and getDailyPosts() cache-read branches</name>
  <files>app/src/services/concept-feed.service.ts</files>
  <read_first>
    - app/src/services/concept-feed.service.ts lines 1-220 (locate import of engagementService at line 13; locate loadCache at 168-210; locate saveCache + composition helpers)
    - app/src/services/concept-feed.service.ts lines 1480-1545 (getDailyPosts function — cache-hit branch + fingerprint-mismatch branch + drain branch)
    - app/src/services/concept-feed.service.ts lines 1593-1599 (getCachedDailyPosts)
    - app/src/services/concept-feed.service.ts lines 1285-1300 (refillQueue's existing walker invocation — REFERENCE ONLY, do NOT modify)
    - app/src/services/engagement.service.ts lines 182-184 (getDismissedAnchorIds return shape)
    - .planning/debug/dismiss-not-propagating-to-same-anchor-tiles.md "Resolution" section for the exact filter shape
  </read_first>
  <action>
    Single additive edit to `app/src/services/concept-feed.service.ts`.

    **Step 1 — Add a private helper near the top-of-module, immediately AFTER `saveCache` (line 218) and BEFORE `_backgroundGenerateTextArt` / other helpers.** Anchor on the existing `function saveCache(cache: ...)` block, place the new helper right after its closing brace.

    ```ts
    // Phase 43 gap-closure 43-14 — centralize the dismiss filter at the READ
    // BOUNDARY (operator-validated direction from .planning/debug/dismiss-not-
    // propagating-to-same-anchor-tiles.md). The walker dismiss-skip in
    // post-queue.service.ts walkDerivedList handles FUTURE refill cycles
    // (anchors not yet popped to in-memory _state.posts / cached.posts), but
    // for posts ALREADY popped or cached, the filter must run at every read
    // site that HomeScreen consumes. Doing it once here means the four
    // HomeScreen write paths (warm-start initializer, main effect, refreshFeed
    // via PLANNER_UPDATED + 8s delayed timer, [location.pathname] re-sync)
    // are dismiss-aware by construction — no per-consumer post-filter is
    // needed. Effect A's live ANCHOR_DISMISSED filter in HomeScreen.tsx:567-574
    // remains in place for the AnimatePresence fade-out animation (LP-05
    // fast path); Effect B at HomeScreen.tsx:584-591 is now strictly
    // redundant but kept as defense-in-depth.
    //
    // Filter shape: post.sourceQuestionIds[0] is the anchor.id (text/image/news/
    // video paths all assign sourceQuestionIds = [a.conceptId] per the pipeline;
    // see concept-feed.service.ts:977-1001 / 1109-1128 / 1170-1200 / 820). A
    // post with no sourceQuestionIds (e.g., legacy starter posts) passes the
    // filter (cannot be matched against a dismissed-anchor id).
    function applyDismissedFilter(posts: DailyPost[]): DailyPost[] {
      const dismissed = new Set(engagementService.getDismissedAnchorIds());
      if (dismissed.size === 0) return posts;
      return posts.filter((p) => {
        const anchorId = p.sourceQuestionIds?.[0];
        if (!anchorId) return true; // posts without an anchor are not dismissable
        return !dismissed.has(anchorId);
      });
    }
    ```

    **Step 2 — Edit `getCachedDailyPosts()` (lines 1593-1599).** Replace the existing body with:

    ```ts
      getCachedDailyPosts(): DailyPost[] {
        const allPosts = (loadCache()?.posts ?? []).filter((p) => p.sourceType !== 'connection');
        // Phase 43 gap-closure 43-14 — dismiss filter at read boundary.
        const visible = applyDismissedFilter(allPosts);
        // G4 / D-12: HomeScreen warm-start initializer also drops starters when 3+ organic exist.
        const feedPosts = filterDecayedStarters(visible);
        _backgroundGenerateTextArt(feedPosts);
        return feedPosts;
      },
    ```

    **Step 3 — Edit `getDailyPosts()` cache-hit branch (lines 1487-1499).** Replace:

    ```ts
        if (cached?.date === date && cached.fingerprint === fingerprint && cached.posts.length > 0) {
          const feedPosts = cached.posts.filter((p) => p.sourceType !== 'connection');
          // G4 / D-12: drop starter posts once the cache contains 3+ organic posts; also
          // write the trimmed cache back so they don't reappear on the next call.
          const decayed = filterDecayedStarters(feedPosts);
          if (decayed.length < feedPosts.length) {
            saveCache({ ...cached, posts: cached.posts.filter((p) => !STARTER_POST_IDS.has(p.id)) });
          }
          _backgroundGenerateTextArt(decayed);
          refillQueue(questions).catch(console.error);
          return decayed;
        }
    ```

    With:

    ```ts
        if (cached?.date === date && cached.fingerprint === fingerprint && cached.posts.length > 0) {
          const feedPosts = cached.posts.filter((p) => p.sourceType !== 'connection');
          // Phase 43 gap-closure 43-14 — dismiss filter at read boundary. Applied
          // BEFORE the decay heuristic so the organic-post count used by
          // filterDecayedStarters reflects what the user actually sees.
          const visible = applyDismissedFilter(feedPosts);
          // G4 / D-12: drop starter posts once the cache contains 3+ organic posts; also
          // write the trimmed cache back so they don't reappear on the next call.
          const decayed = filterDecayedStarters(visible);
          if (decayed.length < visible.length) {
            saveCache({ ...cached, posts: cached.posts.filter((p) => !STARTER_POST_IDS.has(p.id)) });
          }
          _backgroundGenerateTextArt(decayed);
          refillQueue(questions).catch(console.error);
          return decayed;
        }
    ```

    **Step 4 — Edit `getDailyPosts()` fingerprint-mismatch same-day branch (lines 1501-1513).** Replace:

    ```ts
        // Fingerprint mismatch but same day: update fingerprint, return cached
        const hasPostsForToday = cached?.date === date && cached.posts.length > 0;
        if (hasPostsForToday && cached.fingerprint !== fingerprint) {
          // G4 / D-12: also strip starters from the persisted cache when decay condition met.
          const trimmedPosts = filterDecayedStarters(cached.posts) === cached.posts
            ? cached.posts
            : cached.posts.filter((p) => !STARTER_POST_IDS.has(p.id));
          saveCache({ ...cached, fingerprint, posts: trimmedPosts });
          const feedPosts = trimmedPosts.filter((p) => p.sourceType !== 'connection');
          _backgroundGenerateTextArt(feedPosts);
          refillQueue(questions).catch(console.error);
          return feedPosts;
        }
    ```

    With (insert dismiss filter symmetrically before return):

    ```ts
        // Fingerprint mismatch but same day: update fingerprint, return cached
        const hasPostsForToday = cached?.date === date && cached.posts.length > 0;
        if (hasPostsForToday && cached.fingerprint !== fingerprint) {
          // G4 / D-12: also strip starters from the persisted cache when decay condition met.
          const trimmedPosts = filterDecayedStarters(cached.posts) === cached.posts
            ? cached.posts
            : cached.posts.filter((p) => !STARTER_POST_IDS.has(p.id));
          saveCache({ ...cached, fingerprint, posts: trimmedPosts });
          const feedPosts = trimmedPosts.filter((p) => p.sourceType !== 'connection');
          // Phase 43 gap-closure 43-14 — dismiss filter at read boundary
          // (symmetric with cache-hit branch above; covers the case where the
          // question set changed but the cached payload for today still holds
          // dismissed-anchor posts from before the dismiss).
          const visible = applyDismissedFilter(feedPosts);
          _backgroundGenerateTextArt(visible);
          refillQueue(questions).catch(console.error);
          return visible;
        }
    ```

    **Key details / invariants:**
    - DO NOT touch the drain branch at lines 1515-1525. Dequeued posts come from `postQueueService.dequeue` which serves the in-memory `_state.posts`; those posts were enqueued from the walker which already applies the dismiss-skip per Phase 39 D-07. Walker is the FORWARD-LOOKING filter; this plan adds the READ-TIME filter for ALREADY-CACHED posts.
    - DO NOT modify `loadCache()` (lines 168-210). Phase 36-11 stale-cache rejection at line 187 must be unchanged — that gate fires BEFORE any of the affected branches even run.
    - DO NOT modify the walker invocation at line 1290 (`const dismissedIds = new Set(engagementService.getDismissedAnchorIds());`). That is a SEPARATE call site governing the future-refill path.
    - DO NOT modify the `appendToCache(posts)` method at line 1628. It writes to cache, doesn't read; no dismiss filter applies at write time (posts are written THEN filtered on next read).
    - The `engagementService` import is already at line 13 — no import change needed.
    - filterDecayedStarters composition: dismiss filter runs BEFORE filterDecayedStarters in BOTH the helper-using getCachedDailyPosts AND the cache-hit branch. This ordering means the decay heuristic's "3+ organic posts" threshold sees the user-visible count, not the raw cached count — correct behavior because dismissed posts are not "in play" for the starter-decay decision.
    - The `_backgroundGenerateTextArt(...)` call in each branch should now operate on the dismiss-filtered post list, NOT the raw list. Dismissed anchors should not consume text-art generation budget. Update the argument in each branch (already done in the replacements above).

    **Atomic commit message:** `fix(43-14): centralize dismiss filter at concept-feed read boundary (getCachedDailyPosts + getDailyPosts cache-hit + fingerprint-mismatch)`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && grep -q "function applyDismissedFilter" src/services/concept-feed.service.ts && grep -c "applyDismissedFilter(" src/services/concept-feed.service.ts | grep -qE "^[3-9]$|^[0-9][0-9]+$" && grep -q "engagementService.getDismissedAnchorIds()" src/services/concept-feed.service.ts && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "function applyDismissedFilter" src/services/concept-feed.service.ts` returns 1 (helper declaration)
    - `grep -c "applyDismissedFilter(" src/services/concept-feed.service.ts` returns AT LEAST 3 (helper declaration + 3 invocations: getCachedDailyPosts, cache-hit branch, fingerprint-mismatch branch)
    - `grep -c "engagementService.getDismissedAnchorIds()" src/services/concept-feed.service.ts` returns AT LEAST 2 (helper body + line 1290 walker invocation — line 1290 untouched)
    - `cd app && npx tsc -b --noEmit` exits 0
    - `cd app && npm run build` exits 0
    - The drain branch at lines 1515-1525 is unchanged: `grep -c "saveCache({ date, fingerprint, posts: queuedPosts" src/services/concept-feed.service.ts` returns 1 (the drain branch save is preserved)
  </acceptance_criteria>
  <done>Cache-read boundary now filters dismissed-anchor posts uniformly; all four HomeScreen write paths inherit the filter without per-consumer changes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add concept-feed-dismiss-filter behavioral test (stubbed engagementService)</name>
  <files>app/tests/services/concept-feed-dismiss-filter.test.mjs</files>
  <read_first>
    - app/tests/services/post-queue-rehydrate.test.mjs (localStorage polyfill pattern + dynamic import via `await import(...)`)
    - app/tests/services/engagement.service.test.mjs (engagementService stub shape, if it exists; otherwise mirror polyfill from post-queue-rehydrate)
    - app/src/services/concept-feed.service.ts post-Task 1 (verify applyDismissedFilter shape + call sites)
  </read_first>
  <behavior>
    - Test 1: when engagementService.getDismissedAnchorIds() returns [], getCachedDailyPosts() returns posts UNFILTERED (modulo existing sourceType !== 'connection' and filterDecayedStarters)
    - Test 2: when getDismissedAnchorIds() returns ['anchor-A'], getCachedDailyPosts() drops every post whose sourceQuestionIds[0] === 'anchor-A' but keeps posts with other anchors
    - Test 3: when getDismissedAnchorIds() returns ['anchor-A', 'anchor-B'], getCachedDailyPosts() drops posts for BOTH anchors (multi-dismiss correctness)
    - Test 4: getCachedDailyPosts() with a post that has empty sourceQuestionIds keeps it (non-dismissable, edge case)
    - Test 5: getDailyPosts() cache-hit branch — when the cached payload's date === today + fingerprint matches + dismissed contains anchor-A, the returned array excludes anchor-A posts
    - Test 6: getDailyPosts() drain branch — when cache is empty and queue has posts, dismissed filter is NOT applied at this site (drain posts came from walker which already filtered). NEGATIVE assertion: dequeued posts pass through verbatim.
    - Test 7: walker dismiss-skip at post-queue.service.ts:389 is referenced by line number with the same negated-set predicate — NEGATIVE-INVARIANT source-reading assertion that this plan did NOT touch it.

    These cover the bug semantics (Tests 2/3/5), the edge case (Test 4), the null-state baseline (Test 1), the drain-branch invariance (Test 6), and the walker non-regression (Test 7).
  </behavior>
  <action>
    Create new file `app/tests/services/concept-feed-dismiss-filter.test.mjs`. The test file polyfills `localStorage`, stubs `postHistoryService` + `engagementService` via the import-hooks pattern used in `_trellis-mock-loader.mjs` siblings (OR inlines a localStorage-backed engagement stub the same way `post-queue-rehydrate.test.mjs` does), then drives `conceptFeedService.getCachedDailyPosts()` + `getDailyPosts()` against a hand-crafted localStorage cache payload.

    The simplest path: write the dismissed list directly to `localStorage['trellis_engagement_v1']` so the real `engagementService.getDismissedAnchorIds()` returns it; write the daily-posts cache to `localStorage['trellis_daily_posts']` with today's date + a known fingerprint; then dynamic-import `conceptFeedService` and call its methods.

    File contents:

    ```js
    // Phase 43 Plan 43-14 — concept-feed dismiss filter at the READ BOUNDARY.
    //
    // Asserts that conceptFeedService.getCachedDailyPosts() and
    // conceptFeedService.getDailyPosts() apply engagementService.getDismissedAnchorIds()
    // to filter cached posts before returning. Walker dismiss-skip at
    // post-queue.service.ts:389 (Phase 39 D-07) is left UNCHANGED and is a
    // sibling forward-looking filter for FUTURE refills; this test guards the
    // READ-TIME filter for ALREADY-CACHED posts.
    //
    // Pattern: localStorage polyfill + dynamic import. Mirrors
    // app/tests/services/post-queue-rehydrate.test.mjs polyfill shape.

    import assert from 'node:assert/strict';
    import { describe, it, beforeEach } from 'node:test';
    import { readFileSync } from 'node:fs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appRoot = path.resolve(__dirname, '..', '..');

    // localStorage polyfill BEFORE the dynamic import.
    globalThis.localStorage = {
      _store: new Map(),
      getItem(k) { return this._store.get(k) ?? null; },
      setItem(k, v) { this._store.set(k, String(v)); },
      removeItem(k) { this._store.delete(k); },
      clear() { this._store.clear(); },
    };
    // sessionStorage too (concept-feed uses it for connection posts)
    globalThis.sessionStorage = {
      _store: new Map(),
      getItem(k) { return this._store.get(k) ?? null; },
      setItem(k, v) { this._store.set(k, String(v)); },
      removeItem(k) { this._store.delete(k); },
      clear() { this._store.clear(); },
    };
    // Minimal IndexedDB stub (image cache touches it; harmless on no-op)
    if (!globalThis.indexedDB) {
      globalThis.indexedDB = { open: () => ({ onsuccess: null, onerror: null, result: null }) };
    }

    function todayStr() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    function makePost(id, { anchor, style } = {}) {
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
        sourceQuestionIds: anchor ? [anchor] : [],
        sourceQuestionTitles: [],
        keywords: [],
        generatedAt: Date.now(),
        origin: 'ai',
        ...(style ? { presentationStyle: style } : {}),
      };
    }

    function writeCache(posts, { fingerprint = 'fp-test' } = {}) {
      localStorage.setItem('trellis_daily_posts', JSON.stringify({
        date: todayStr(),
        fingerprint,
        posts,
        connectionCards: [],
      }));
    }

    function writeDismissed(anchorIds) {
      localStorage.setItem('trellis_engagement_v1', JSON.stringify({
        saved: [],
        liked: [],
        dismissed: anchorIds,
      }));
    }

    const { conceptFeedService } = await import('../../src/services/concept-feed.service.ts');

    describe('conceptFeedService — Phase 43 gap-closure 43-14 dismiss filter at read boundary', () => {
      beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      it('Test 1: empty dismissed list → getCachedDailyPosts returns posts unfiltered (baseline)', () => {
        writeCache([
          makePost('p1', { anchor: 'anchor-A' }),
          makePost('p2', { anchor: 'anchor-B' }),
          makePost('p3', { anchor: 'anchor-C' }),
        ]);
        writeDismissed([]);
        const result = conceptFeedService.getCachedDailyPosts();
        const ids = result.map(p => p.id).sort();
        assert.deepEqual(ids, ['p1', 'p2', 'p3'], 'all 3 posts must pass through when nothing is dismissed');
      });

      it('Test 2: dismiss anchor-A → getCachedDailyPosts drops all posts whose sourceQuestionIds[0] === anchor-A', () => {
        writeCache([
          makePost('p1', { anchor: 'anchor-A' }),
          makePost('p2', { anchor: 'anchor-A' }), // sibling of p1, same anchor
          makePost('p3', { anchor: 'anchor-A' }), // another sibling
          makePost('p4', { anchor: 'anchor-B' }),
          makePost('p5', { anchor: 'anchor-C' }),
        ]);
        writeDismissed(['anchor-A']);
        const result = conceptFeedService.getCachedDailyPosts();
        const ids = result.map(p => p.id).sort();
        assert.deepEqual(ids, ['p4', 'p5'], 'all 3 anchor-A posts must be filtered, anchor-B + anchor-C survive');
      });

      it('Test 3: dismiss multiple anchors → both anchors filtered', () => {
        writeCache([
          makePost('p1', { anchor: 'anchor-A' }),
          makePost('p2', { anchor: 'anchor-B' }),
          makePost('p3', { anchor: 'anchor-C' }),
          makePost('p4', { anchor: 'anchor-D' }),
        ]);
        writeDismissed(['anchor-A', 'anchor-C']);
        const result = conceptFeedService.getCachedDailyPosts();
        const ids = result.map(p => p.id).sort();
        assert.deepEqual(ids, ['p2', 'p4'], 'both anchor-A and anchor-C must be filtered');
      });

      it('Test 4: post with empty sourceQuestionIds is non-dismissable (edge case for legacy starter posts)', () => {
        writeCache([
          makePost('p1', { anchor: 'anchor-A' }),
          makePost('p-orphan', {}), // no anchor — empty sourceQuestionIds
        ]);
        writeDismissed(['anchor-A']);
        const result = conceptFeedService.getCachedDailyPosts();
        const ids = result.map(p => p.id).sort();
        assert.deepEqual(ids, ['p-orphan'], 'orphan post survives — empty sourceQuestionIds is non-dismissable');
      });

      it('Test 5: getDailyPosts() cache-hit branch — dismiss filter applies symmetric to getCachedDailyPosts', async () => {
        const fingerprint = 'fp-stable';
        writeCache([
          makePost('p1', { anchor: 'anchor-A' }),
          makePost('p2', { anchor: 'anchor-A' }),
          makePost('p3', { anchor: 'anchor-B' }),
        ], { fingerprint });
        writeDismissed(['anchor-A']);
        // Provide a question set with the same fingerprint so the cache-hit branch fires.
        // computeFingerprint signature is module-internal — but the cache stores its
        // result and the branch only requires equality. The simplest path: write the
        // same `fingerprint` we set in writeCache via the questions argument's
        // computed value. Empty questions array fingerprints to a known value; if
        // that doesn't match 'fp-stable', the branch falls through to drain.
        //
        // To guarantee the cache-hit branch fires regardless of fingerprint, write
        // the cache with whatever fingerprint computeFingerprint([]) returns. We
        // resolve this by calling getDailyPosts([]) ONCE to populate the cache with
        // a real fingerprint, then mutate localStorage to inject our test posts.
        // But that mutates posts mid-read — simpler approach is to assert via
        // getCachedDailyPosts which doesn't gate on fingerprint:
        const result = conceptFeedService.getCachedDailyPosts();
        const ids = result.map(p => p.id).sort();
        assert.deepEqual(ids, ['p3'], 'cache-hit semantics: dismissed anchor-A posts filtered, anchor-B survives');

        // Direct assertion against the cache-hit branch: call getDailyPosts with []
        // and assert the returned array does NOT contain anchor-A posts. The drain
        // branch will fire if fingerprint mismatches; in either branch, the dismiss
        // filter MUST apply.
        const direct = await conceptFeedService.getDailyPosts([]);
        const directIds = direct.map(p => p.id);
        assert.ok(
          !directIds.includes('p1') && !directIds.includes('p2'),
          'getDailyPosts() must not return anchor-A posts when anchor-A is dismissed',
        );
      });

      it('Test 6: drain branch unchanged — posts dequeued from postQueueService pass through verbatim (walker already filtered)', () => {
        // The drain branch at concept-feed.service.ts lines 1515-1525 takes from
        // postQueueService.dequeue() and writes to the daily cache. We assert via
        // SOURCE-READING that the drain branch does NOT call applyDismissedFilter
        // — the walker (post-queue.service.ts:389) already handled the
        // forward-looking filter for queued items.
        const src = readFileSync(path.join(appRoot, 'src/services/concept-feed.service.ts'), 'utf8');
        // Find the drain branch's saveCache call and grab its surrounding ~600 chars.
        const drainIdx = src.indexOf('saveCache({ date, fingerprint, posts: queuedPosts');
        assert.ok(drainIdx > 0, 'drain branch saveCache call must still exist');
        const region = src.slice(Math.max(0, drainIdx - 300), drainIdx + 300);
        assert.doesNotMatch(
          region,
          /applyDismissedFilter\(/,
          'drain branch must NOT call applyDismissedFilter — walker dismiss-skip at post-queue.service.ts:389 owns that filter for queued items',
        );
      });

      it('Test 7: NEGATIVE INVARIANT — walker dismiss-skip at post-queue.service.ts:389 is unchanged (Phase 39 D-07 contract)', () => {
        const queueSrc = readFileSync(path.join(appRoot, 'src/services/post-queue.service.ts'), 'utf8');
        // The exact predicate from line 389. If this regex stops matching, the
        // walker contract has been disturbed.
        assert.match(
          queueSrc,
          /!exploredIds\.has\(id\)\s*&&\s*!dismissedIds\.has\(id\)/,
          'walker dismiss-skip predicate at post-queue.service.ts:389 must be unchanged (Phase 39 D-07)',
        );
        // Walker still accepts dismissedIds as a required positional argument.
        assert.match(
          queueSrc,
          /walkDerivedList\(\s*count:\s*number,\s*exploredIds:\s*Set<string>,\s*dismissedIds:\s*Set<string>\s*\)/,
          'walkDerivedList signature must still take dismissedIds as a required positional argument',
        );
      });
    });
    ```

    Notes:
    - `await import` at the module level works in `.mjs` test files run via `node --test` (the existing post-queue-rehydrate.test.mjs uses the same pattern).
    - If the dynamic import fails because `concept-feed.service.ts` pulls in i18next or another browser-only chain, fall back to the SOURCE-READING-ONLY pattern (assert against the file text, not runtime behavior). The behavioral tests above are PREFERRED because they validate the actual mutation path; the source-reading fallback (Test 6/Test 7 already use it) is acceptable for Tests 1-5 as a fallback if dynamic import fails. Note: concept-feed.service.ts is NOT leaf-discipline — it imports llm provider, settings, dailyRead, postHistory, sourceDiversity, etc. If `await import` fails, switch ALL of Tests 1-5 to source-reading assertions (e.g., `assert.match(src, /applyDismissedFilter\(feedPosts\)/)` to prove the call site is wired correctly). Document the fallback in a comment at the top.

    **Atomic commit message:** `test(43-14): concept-feed dismiss-filter at read boundary (cache-hit + getCachedDailyPosts + walker non-regression)`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/services/concept-feed-dismiss-filter.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Test file exists at app/tests/services/concept-feed-dismiss-filter.test.mjs
    - Test count is 7
    - `cd app && node --test tests/services/concept-feed-dismiss-filter.test.mjs` exits 0
    - Tests 6 + 7 are SOURCE-READING (no runtime behavior — guards against regression in drain branch + walker)
    - If dynamic import fails: all tests fall back to source-reading and the test file documents the fallback at the top
  </acceptance_criteria>
  <done>Behavioral + source-reading invariants lock the dismiss-filter at the read boundary AND prove the walker dismiss-skip is untouched.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add HomeScreen.dismiss-resync source-reading test for the four write-path / Effect A invariants</name>
  <files>app/tests/screens/HomeScreen.dismiss-resync.test.mjs</files>
  <read_first>
    - app/tests/screens/HomeScreen.engagement-resync.test.mjs (Phase 43-06 source-reading pattern — primary precedent)
    - app/src/screens/HomeScreen.tsx lines 41-50 (warm-start initializer), 117-192 (main effect + refreshFeed + delayed timer), 204-224 (location.pathname re-sync), 567-574 (Effect A live ANCHOR_DISMISSED)
    - .planning/debug/dismiss-not-propagating-to-same-anchor-tiles.md "Evidence" section for each write-path's line range
  </read_first>
  <behavior>
    - Test 1: Effect A — live ANCHOR_DISMISSED filter on dailyPosts is still present (Phase 43-06 LP-05 fast path preserved)
    - Test 2: The four write paths (warm-start initializer, main effect getDailyPosts.then(setDailyPosts), refreshFeed inside PLANNER_UPDATED handler + delayed timer, [location.pathname] re-sync) all read from conceptFeedService — they DO NOT call engagementService.getDismissedAnchorIds() themselves (proves the filter centralization)
    - Test 3: Effect B at [location.pathname] still re-reads engagementService.getDismissedAnchorIds() (defense-in-depth kept; Phase 43-06 dual-effect canonical shape preserved)
    - Test 4: NEGATIVE — concept-feed.service.ts walker invocation line is untouched (refillQueue still passes engagementService.getDismissedAnchorIds() to walkDerivedList)
    - Test 5: COUNTERWEIGHT — concept-feed.service.ts applyDismissedFilter helper exists and is called from getCachedDailyPosts + cache-hit branch (proves this plan's edits landed, guards against regression of the centralization)
  </behavior>
  <action>
    Create new file `app/tests/screens/HomeScreen.dismiss-resync.test.mjs`.

    File contents:

    ```js
    // Phase 43 Plan 43-14 — source-reading invariants for HomeScreen + concept-feed
    // dismiss filter centralization at the READ BOUNDARY.
    //
    // Asserts:
    //   (1) Effect A (live ANCHOR_DISMISSED setDailyPosts(prev => prev.filter(...)))
    //       is still present in HomeScreen.tsx for the LP-05 fade-out animation.
    //   (2) The four HomeScreen write paths (warm-start initializer, main effect
    //       getDailyPosts, refreshFeed, [location.pathname] re-sync) read from
    //       conceptFeedService and DO NOT call
    //       engagementService.getDismissedAnchorIds() themselves — the filter is
    //       centralized at the cache-read boundary.
    //   (3) Effect B at [location.pathname] still references
    //       engagementService.getDismissedAnchorIds() — defense-in-depth preserved.
    //   (4) NEGATIVE — concept-feed walker invocation (refillQueue's
    //       walkDerivedList call) is UNCHANGED. Walker dismiss-skip at
    //       post-queue.service.ts:389 is the FORWARD-LOOKING filter; this plan
    //       only adds the READ-TIME filter.
    //   (5) COUNTERWEIGHT — concept-feed.service.ts now declares
    //       applyDismissedFilter and calls it from getCachedDailyPosts +
    //       getDailyPosts cache-hit branch.
    //
    // Pattern: readFileSync + regex; no React render; no jsdom. Mirrors
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
    const feedSrc = readFileSync(path.join(appRoot, 'src/services/concept-feed.service.ts'), 'utf8');
    const queueSrc = readFileSync(path.join(appRoot, 'src/services/post-queue.service.ts'), 'utf8');

    test('43-14 Test 1: Effect A live ANCHOR_DISMISSED filter is still present (LP-05 fast-path preserved)', () => {
      // The Effect A pattern from Phase 43-06: subscribe('ANCHOR_DISMISSED') →
      // setDailyPosts(prev => prev.filter(p => p.sourceQuestionIds?.[0] !== anchorId))
      assert.match(homeSrc, /eventBus\.subscribe\(\s*['"]ANCHOR_DISMISSED['"]/);
      assert.match(homeSrc, /setDailyPosts\(\s*prev\s*=>\s*prev\.filter/);
      assert.match(homeSrc, /sourceQuestionIds\??\.\??\[0\]\s*!==\s*anchorId/);
    });

    test('43-14 Test 2: HomeScreen write paths do NOT call engagementService.getDismissedAnchorIds() inline (filter is centralized at concept-feed read boundary)', () => {
      // The four write paths' bodies should rely on conceptFeedService methods,
      // not on inline engagement lookups. We assert via region scoping.
      //
      // Path 1: useState warm-start initializer (lines 41-50)
      const initStart = homeSrc.indexOf('useState<DailyPost[]>(() => {');
      assert.ok(initStart > 0, 'warm-start initializer must exist');
      const initEnd = homeSrc.indexOf('});', initStart);
      const initBody = homeSrc.slice(initStart, initEnd);
      assert.doesNotMatch(
        initBody,
        /engagementService\.getDismissedAnchorIds/,
        'warm-start initializer must NOT call getDismissedAnchorIds inline — filter is centralized at conceptFeedService.getCachedDailyPosts',
      );

      // Path 2: main effect (questions deps) — locate the getDailyPosts(questions).then(setDailyPosts) site
      const mainEffectIdx = homeSrc.indexOf('conceptFeedService.getDailyPosts(questions)');
      assert.ok(mainEffectIdx > 0, 'main effect getDailyPosts call must exist');
      // Slice ~500 chars around it — should NOT contain a local dismiss lookup
      const mainRegion = homeSrc.slice(Math.max(0, mainEffectIdx - 300), mainEffectIdx + 500);
      assert.doesNotMatch(
        mainRegion,
        /engagementService\.getDismissedAnchorIds/,
        'main effect must NOT inline a dismiss lookup — filter is centralized at conceptFeedService',
      );

      // Path 3: [location.pathname] re-sync — the warm-start re-fallback effect at lines 204-224
      // (NOT Effect B at 584-591). Both effects use [location.pathname], but Phase 36-14's
      // warm-start re-fallback reads conceptFeedService.getCachedDailyPosts. We assert
      // the cache re-fallback is still there AND does NOT inline a dismiss lookup.
      const reSyncIdx = homeSrc.indexOf("if (location.pathname !== '/home') return;");
      assert.ok(reSyncIdx > 0, 'location.pathname re-sync effect must exist');
      const reSyncEnd = homeSrc.indexOf('}, [location.pathname]', reSyncIdx);
      assert.ok(reSyncEnd > reSyncIdx, 'location.pathname re-sync must terminate');
      const reSyncBody = homeSrc.slice(reSyncIdx, reSyncEnd);
      // The Phase 36-14 effect uses getCachedDailyPosts (no inline dismiss lookup needed
      // because getCachedDailyPosts now filters at the read boundary).
      assert.match(
        reSyncBody,
        /conceptFeedService\.getCachedDailyPosts/,
        'Phase 36-14 re-sync effect must call getCachedDailyPosts (post-43-14 it filters dismissed inline)',
      );
    });

    test('43-14 Test 3: Effect B at [location.pathname] still references engagementService.getDismissedAnchorIds (defense-in-depth)', () => {
      // Effect B from Phase 43-06 (lines 584-591) — re-reads dismissedAnchorIds on
      // every nav to /home. Kept as defense-in-depth even though the read boundary
      // now also filters.
      assert.match(homeSrc, /engagementService\.getDismissedAnchorIds\(\)/);
      const dismissCallIdx = homeSrc.indexOf('engagementService.getDismissedAnchorIds()');
      const trailing = homeSrc.slice(dismissCallIdx, dismissCallIdx + 800);
      assert.match(
        trailing,
        /\}\s*,\s*\[location\.pathname\]\s*\)/,
        'Effect B at [location.pathname] must still reference getDismissedAnchorIds (defense-in-depth)',
      );
    });

    test('43-14 Test 4: NEGATIVE — concept-feed walker invocation in refillQueue is UNCHANGED', () => {
      // refillQueue still passes engagementService.getDismissedAnchorIds() into
      // postQueueService.walkDerivedList (Phase 39 D-07 — the forward-looking
      // filter for FUTURE refills).
      assert.match(
        feedSrc,
        /const\s+dismissedIds\s*=\s*new\s+Set\s*\(\s*engagementService\.getDismissedAnchorIds\(\)\s*\)/,
        'refillQueue must still build dismissedIds Set from engagementService — walker contract preserved',
      );
      assert.match(
        feedSrc,
        /walkDerivedList\([^)]*dismissedIds[^)]*\)/,
        'refillQueue must still pass dismissedIds to walkDerivedList',
      );
      // And the walker predicate at post-queue.service.ts:389 is unchanged
      assert.match(
        queueSrc,
        /!exploredIds\.has\(id\)\s*&&\s*!dismissedIds\.has\(id\)/,
        'walker dismiss-skip predicate must be unchanged (Phase 39 D-07 contract)',
      );
    });

    test('43-14 Test 5: COUNTERWEIGHT — concept-feed.service.ts declares applyDismissedFilter and calls it from cache-read sites', () => {
      // Helper exists
      assert.match(
        feedSrc,
        /function\s+applyDismissedFilter\s*\(\s*posts\s*:\s*DailyPost\[\]\s*\)\s*:\s*DailyPost\[\]/,
        'concept-feed.service.ts must declare function applyDismissedFilter(posts: DailyPost[]): DailyPost[]',
      );
      // Helper body uses engagementService.getDismissedAnchorIds and filters sourceQuestionIds[0]
      const helperStart = feedSrc.indexOf('function applyDismissedFilter');
      const helperEnd = feedSrc.indexOf('\n}', helperStart);
      assert.ok(helperEnd > helperStart, 'applyDismissedFilter body must terminate');
      const helperBody = feedSrc.slice(helperStart, helperEnd);
      assert.match(helperBody, /engagementService\.getDismissedAnchorIds\(\)/);
      assert.match(helperBody, /p\.sourceQuestionIds\??\.\??\[0\]/);

      // getCachedDailyPosts calls it
      const getCachedStart = feedSrc.indexOf('getCachedDailyPosts():');
      const getCachedEnd = feedSrc.indexOf('  },', getCachedStart);
      const getCachedBody = feedSrc.slice(getCachedStart, getCachedEnd);
      assert.match(
        getCachedBody,
        /applyDismissedFilter\(/,
        'getCachedDailyPosts() must call applyDismissedFilter',
      );

      // getDailyPosts cache-hit branch calls it. Locate the cache-hit guard and
      // assert the helper is called inside it.
      const cacheHitStart = feedSrc.indexOf('cached?.date === date && cached.fingerprint === fingerprint && cached.posts.length > 0');
      assert.ok(cacheHitStart > 0, 'cache-hit branch must exist');
      const cacheHitRegion = feedSrc.slice(cacheHitStart, cacheHitStart + 800);
      assert.match(
        cacheHitRegion,
        /applyDismissedFilter\(/,
        'getDailyPosts cache-hit branch must call applyDismissedFilter',
      );
    });
    ```

    **Atomic commit message:** `test(43-14): HomeScreen + concept-feed dismiss-filter centralization invariants`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/screens/HomeScreen.dismiss-resync.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Test file exists at app/tests/screens/HomeScreen.dismiss-resync.test.mjs
    - Test count is 5
    - `cd app && node --test tests/screens/HomeScreen.dismiss-resync.test.mjs` exits 0
    - Test 4 asserts walker code is NOT touched (regression guard)
    - Test 5 asserts the dismiss filter is actually wired at the read boundary (positive counterweight)
  </acceptance_criteria>
  <done>Source-reading invariants lock the centralization pattern + the four-write-path Effect A invariant.</done>
</task>

<task type="auto">
  <name>Task 4: Re-run UAT Test 4 + run full test suite + document closure in SUMMARY</name>
  <files>.planning/phases/43-engagement-ui/43-14-dismiss-filter-at-read-boundary-SUMMARY.md</files>
  <read_first>
    - .planning/phases/43-engagement-ui/43-UAT.md (Test 4 expected behavior + failure reason)
    - Tasks 1-3 of this plan (verify all artifacts landed)
  </read_first>
  <action>
    1. Run the full test suite from `app/`:
       ```bash
       cd /Users/Code/EchoLearn/app
       node --test tests/services tests/screens tests/components tests/state tests/locales tests/layout
       npx tsc -b --noEmit
       npm run build
       ```
       All must exit 0. If any fail, fix before proceeding (do NOT continue with a broken build).

    2. Execute UAT Test 4 manually (post-merge dev build):
       - Start the dev server (cd app && npm run dev)
       - Generate a feed with at least one anchor that has multiple tiles (text + image + video sharing the same anchor)
       - Long-press one tile → Not interested → toast confirms
       - ALL sibling tiles fade out via AnimatePresence
       - Refresh the page (Cmd-R)
       - The dismissed anchor's tiles do NOT reappear (cache-read boundary filters them)
       - Wait 8s for the delayed refresh timer to fire — the dismissed anchor's tiles still do not reappear
       - Trigger a PLANNER_UPDATED event (e.g., ask a question, complete a review) — same anchor still dismissed
       - Navigate to /planner → back to /home (exercises [location.pathname] re-sync) — same anchor still dismissed

    3. Write `.planning/phases/43-engagement-ui/43-14-dismiss-filter-at-read-boundary-SUMMARY.md`:

       ```markdown
       ---
       phase: 43-engagement-ui
       plan: 14
       plan_id: 43-14
       slug: dismiss-filter-at-read-boundary
       status: complete
       gap_closure: true
       closed_gap: "UAT Test 4 — Dismiss not propagating to same-anchor tiles (major)"
       commits: <fill with hashes>
       ---

       # Plan 43-14 — Dismiss filter at read boundary — SUMMARY

       **Closed:** <date>
       **Gap closed:** Phase 43 UAT Test 4 (major) — dismissing one tile of a multi-tile
       anchor concept now fades out ALL sibling tiles AND persists across refresh,
       PLANNER_UPDATED, the 8s delayed refresh timer, and cross-screen navigation.

       ## Root cause (confirmed)

       `concept-feed.service.ts`'s `getCachedDailyPosts()` and `getDailyPosts()` cache-hit
       branch returned cached posts WITHOUT filtering by
       `engagementService.getDismissedAnchorIds()`. HomeScreen's four independent write
       paths (warm-start initializer, main effect, refreshFeed via PLANNER_UPDATED + 8s
       timer, `[location.pathname]` re-sync) all called `setDailyPosts(...)` from these
       unfiltered service reads, overwriting Effect A's live dismiss filter on the next
       render. Walker dismiss-skip at `post-queue.service.ts:389` handled FUTURE refill
       cycles correctly; the bug was on the READ side for already-cached / in-memory
       posts.

       ## Fix

       Centralized the dismiss filter at the READ BOUNDARY:
       - New private helper `applyDismissedFilter(posts)` in `concept-feed.service.ts`
         applies `engagementService.getDismissedAnchorIds()` to filter
         `post.sourceQuestionIds[0]` not in the dismissed set.
       - Called from `getCachedDailyPosts()` (between connection filter and
         `filterDecayedStarters`).
       - Called from `getDailyPosts()` cache-hit branch (same position) AND
         fingerprint-mismatch same-day branch (symmetric).
       - Drain branch UNCHANGED — posts dequeued from `postQueueService` were already
         walker-filtered per Phase 39 D-07.

       ## Invariants preserved

       - `post-queue.service.ts:389` walker dismiss-skip — UNCHANGED.
       - `loadCache()` Phase 36-11 stale-cache rejection — UNCHANGED.
       - HomeScreen Effect A live ANCHOR_DISMISSED filter — UNCHANGED (drives
         AnimatePresence fade-out).
       - HomeScreen Effect B `[location.pathname]` engagement re-read — UNCHANGED
         (defense-in-depth).
       - `filterDecayedStarters` + `sourceType !== 'connection'` compose correctly with
         the new filter (dismiss runs first; decay heuristic sees user-visible count).

       ## Tests

       - `app/tests/services/concept-feed-dismiss-filter.test.mjs` — 7 tests covering
         empty-dismissed baseline, single-anchor dismiss, multi-anchor dismiss, orphan
         posts, cache-hit-branch parity, drain-branch non-invocation, walker contract
         non-regression.
       - `app/tests/screens/HomeScreen.dismiss-resync.test.mjs` — 5 tests covering
         Effect A presence, four-write-path delegation to read boundary, Effect B
         defense-in-depth, walker non-regression, applyDismissedFilter wiring
         counterweight.

       ## UAT Test 4 — re-tested

       - Long-press dismiss on one of three same-anchor tiles → ALL three fade out
         (AnimatePresence 200ms exit transition, Effect A).
       - Page refresh → dismissed anchor still gone (cache-read boundary filter).
       - 8s delayed refresh timer fires → dismissed anchor still gone.
       - PLANNER_UPDATED → refreshFeed → dismissed anchor still gone.
       - Navigate to /planner → back to /home → dismissed anchor still gone (Phase 36-14
         re-fallback effect now reads through the filtered cache).

       ## Files changed

       - `app/src/services/concept-feed.service.ts` — 1 helper added, 3 call sites wired
       - `app/tests/services/concept-feed-dismiss-filter.test.mjs` — NEW (7 tests)
       - `app/tests/screens/HomeScreen.dismiss-resync.test.mjs` — NEW (5 tests)

       ## Commits

       - `<hash>` fix(43-14): centralize dismiss filter at concept-feed read boundary
       - `<hash>` test(43-14): concept-feed dismiss-filter behavioral + non-regression
       - `<hash>` test(43-14): HomeScreen + concept-feed dismiss-filter centralization invariants
       ```

    4. Commit the SUMMARY:
       ```bash
       cd /Users/Code/EchoLearn
       node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(43-14): close gap-closure plan with UAT Test 4 re-verification" --files .planning/phases/43-engagement-ui/43-14-dismiss-filter-at-read-boundary-SUMMARY.md
       ```
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/services tests/screens tests/components tests/state tests/locales tests/layout && npx tsc -b --noEmit && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - Full test suite exits 0
    - tsc -b --noEmit exits 0
    - npm run build exits 0
    - SUMMARY.md exists with the structure above
    - UAT Test 4 manually re-verified — all 5 trigger paths show dismissed anchor persistently filtered
  </acceptance_criteria>
  <done>Phase 43 UAT Test 4 closed; SUMMARY documents root cause + fix + invariants + tests + commit chain.</done>
</task>

</tasks>

<verification>
- `cd app && npx tsc -b --noEmit` exits 0
- `cd app && node --test tests/services tests/screens tests/components tests/state tests/locales tests/layout` exits 0
- `cd app && npm run build` exits 0
- Manual UAT Test 4 (post-merge):
  - Find an anchor with multiple tiles (text + image + video). Long-press one → Not interested.
  - All sibling tiles fade out (AnimatePresence).
  - Refresh page → siblings stay gone.
  - Wait 8s (delayed refresh timer) → siblings stay gone.
  - Ask a question (PLANNER_UPDATED) → siblings stay gone.
  - Navigate /planner → /home → siblings stay gone.
- Manual non-regression spot-check:
  - Phase 36-14 warm-start re-fallback still works after Force-New-Day (yesterday's queue rehydrates correctly into today's feed; tested via Settings → Data → Force New Day → /home).
  - Walker still skips dismissed anchors during refill — verified by inspecting next queue refill cycle in dev console (look for `[refillQueue] batch styles` log with no dismissed-anchor concepts in the batch).
</verification>

<success_criteria>
- `applyDismissedFilter` helper exists in concept-feed.service.ts and is called from getCachedDailyPosts + getDailyPosts cache-hit branch + fingerprint-mismatch branch
- Walker dismiss-skip at post-queue.service.ts:389 is UNCHANGED (negative-invariant tests guard regression)
- loadCache Phase 36-11 stale-cache rejection is UNCHANGED
- HomeScreen Effect A (live ANCHOR_DISMISSED) still drives AnimatePresence
- HomeScreen Effect B (location.pathname re-read) preserved as defense-in-depth
- 2 new test files; 12 total new test assertions (7 + 5)
- 3-4 atomic commits (source change, behavioral test, source-reading test, SUMMARY)
- UAT Test 4 re-verifies green across all 5 trigger paths (live dismiss, refresh, 8s timer, PLANNER_UPDATED, location.pathname)
</success_criteria>

<output>
After completion, the existing 43-14-...-SUMMARY.md (created in Task 4) documents:
- Helper insertion site in concept-feed.service.ts (after saveCache, around line 220)
- 3 call sites wired (getCachedDailyPosts ~line 1595, cache-hit ~line 1492, fingerprint-mismatch ~line 1510)
- 2 new test files + assertion counts (7 + 5 = 12)
- 4 atomic commit hashes
- UAT Test 4 status: closed (re-verified across all 5 trigger paths)
- Walker + loadCache + Effect A + Effect B all preserved (regression-guarded)
</output>
</content>
</invoke>