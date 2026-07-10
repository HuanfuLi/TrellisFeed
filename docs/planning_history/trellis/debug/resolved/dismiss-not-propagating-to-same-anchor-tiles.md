---
status: resolved
trigger: "Phase 43 UAT Test 4 fail: Dismissing one post of a concept did not clear other post tiles of same concept. Refreshing page did not change behavior"
created: 2026-05-12T00:00:00Z
updated: 2026-05-12T04:00:00Z
resolved_by: 43-14-dismiss-filter-at-read-boundary
---

## Current Focus

hypothesis: ROOT CAUSE — HomeScreen has two paths that overwrite `dailyPosts` with the unfiltered cached posts AFTER Effect A/B filter by dismissed anchors. (1) Main effect at HomeScreen.tsx:117-167 calls `conceptFeedService.getDailyPosts(questions).then(setDailyPosts(posts))` UNCONDITIONALLY (only guard is `posts.length > 0`). The returned cache contains all posts INCLUDING those for dismissed anchors. This async setState fires after Effect B's mount-time filter, restoring sibling tiles. (2) `delayedRefreshTimer` (line 182) + `PLANNER_UPDATED` listener (line 170) also call `refreshFeed()` which has the same shape and re-overwrites. The cache itself (`getCachedDailyPosts` at concept-feed.service.ts:1593) does NOT filter by `engagementService.getDismissedAnchorIds()`. Symmetric warm-start initializer (line 41-50) also fails to filter.
test: trace dailyPosts update flow on (a) live dismiss and (b) refresh; confirm getDailyPosts cache return is unfiltered; confirm walker correctly skips dismissed for FUTURE pops but cached/in-memory posts persist.
expecting: confirmed — multiple write paths bypass the dismiss filter.
next_action: return ROOT CAUSE FOUND

## Symptoms

expected: dismissing one tile of a concept fades out ALL tiles sharing that anchor; persists across refresh
actual: only the tapped tile fades (or one tile only); siblings remain; refresh does not drop them either
errors: none reported
reproduction: Phase 43 UAT Test 4 — find anchor with multiple tiles, long-press one, tap Not interested
started: re-verify UAT cycle 2026-05-12 after 43-09..43-13 landed

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-05-12
  checked: HomeScreen.tsx:567-574 (Effect A — ANCHOR_DISMISSED handler)
  found: Filters dailyPosts by `p.sourceQuestionIds?.[0] !== anchorId`. Fires on event only.
  implication: Live filter SHOULD work for the dismissed anchor — IF the value matches.

- timestamp: 2026-05-12
  checked: HomeScreen.tsx:584-591 (Effect B — location.pathname dismiss resync)
  found: Filters dailyPosts by `!dismissed.includes(p.sourceQuestionIds?.[0] ?? '')`. Fires on mount + navigation to /home.
  implication: Refresh-path filter SHOULD work — IF it runs AFTER the main effect's async getDailyPosts resolves.

- timestamp: 2026-05-12
  checked: HomeScreen.tsx:117-167 (main effect; questions + questionsLoading deps)
  found: Calls `conceptFeedService.getDailyPosts(questions).then((posts) => { if (posts.length > 0) setDailyPosts(posts); ... })`. NO filter by dismissed anchors. Always runs on mount.
  implication: This overwrites Effect B's filtered state with the FULL cached posts (incl. dismissed-anchor siblings) shortly after mount → siblings reappear on refresh.

- timestamp: 2026-05-12
  checked: HomeScreen.tsx:182-184 (delayedRefreshTimer) + 170-176 (PLANNER_UPDATED handler)
  found: Both call `refreshFeed()` which runs the same `conceptFeedService.getDailyPosts(questions).then(setDailyPosts(posts))` pattern with NO dismiss filter.
  implication: Even if Effect A correctly filters siblings on live dismiss, the 8-second delayed refresh (line 182) AND any PLANNER_UPDATED emission would restore them via the unfiltered cached read.

- timestamp: 2026-05-12
  checked: HomeScreen.tsx:41-50 (useState initializer warm-start chain)
  found: Tier 1 `conceptFeedService.getCachedDailyPosts()`, Tier 2 `postQueueService.getYesterdayQueue()`, Tier 3 `postHistoryService.getPosts().slice(0,4)`. NONE filter by dismissed anchors.
  implication: At mount, dailyPosts contains dismissed-anchor siblings. Effect B compensates on the same tick. But the unfiltered re-write paths (above) bypass it.

- timestamp: 2026-05-12
  checked: concept-feed.service.ts:1480-1544 (getDailyPosts) and :1593-1599 (getCachedDailyPosts)
  found: Cache-hit branch returns `cached.posts` filtered ONLY by `sourceType !== 'connection'` and `filterDecayedStarters`. NO call to `engagementService.getDismissedAnchorIds()`. `getCachedDailyPosts` likewise unfiltered.
  implication: Service contract leaks dismissed-anchor posts to every consumer that doesn't post-filter. HomeScreen's filter effects are the ONLY guard, and they're race-vulnerable.

- timestamp: 2026-05-12
  checked: concept-feed.service.ts:1109-1128 (video), :1170-1200 (news), :977-1001 (text-style) — sourceQuestionIds assignment
  found: All three paths assign `sourceQuestionIds = [a.conceptId]` (or `[assignment.conceptId]`), where conceptId is the anchor.id pushed by `buildConceptBatch` (line 820 `for (let i = 0; i < count; i++) conceptIds.push(anchor.id)`). Text-style path UNCONDITIONALLY overwrites the LLM-returned sourceQuestionIds at line 993.
  implication: For real-anchor posts (the ones the test exercises), `sourceQuestionIds[0]` IS the anchor id. The semantic match in Effect A/B is correct. The bug is NOT in the matching key — it's in the missing filter on the cache-read paths.

- timestamp: 2026-05-12
  checked: post-queue.service.ts:369-389 (walkDerivedList signature + filter)
  found: Walker correctly accepts `dismissedIds: Set<string>` and skips them: `if (!exploredIds.has(id) && !dismissedIds.has(id)) result.push(id);`. concept-feed.service.ts:1290-1291 passes `engagementService.getDismissedAnchorIds()`.
  implication: FUTURE refill cycles correctly skip dismissed anchors — but in-memory `dailyPosts` and cached `cached.posts` (already-popped, written to localStorage) still contain dismissed-anchor entries. The walker only governs the next batch, not the current displayed feed.

- timestamp: 2026-05-12
  checked: MasonryFeed.tsx:628-631 (anchorId / conceptId derivation from item.post.sourceQuestionIds?.[0])
  found: Both anchorId AND conceptId for a concept tile use `item.post.sourceQuestionIds?.[0] ?? ''`. So `dismissAnchor(anchorId)` receives the same field that HomeScreen Effect A/B compares against.
  implication: The match is symmetric. Filter key is correct.

- timestamp: 2026-05-12
  checked: LongPressMenu.tsx:81-85 (handleDismiss)
  found: Calls `engagementService.dismissAnchor(anchorId)` directly with the anchorId from MasonryFeed. Engagement service persists to localStorage AND emits `ANCHOR_DISMISSED { anchorId }`.
  implication: Persistence works. Event fires. Effect A receives the event. The fade should fire BUT will be overwritten by the next getDailyPosts cache read.

## Resolution

root_cause: HomeScreen's `dailyPosts` state has THREE write paths that read from the unfiltered post cache and overwrite the dismiss-filtered state: (1) `useState` warm-start initializer at HomeScreen.tsx:41-50, (2) main effect's `getDailyPosts(questions).then(setDailyPosts(posts))` at HomeScreen.tsx:128-147 (runs on mount + when questions change), (3) `refreshFeed()` invocations at HomeScreen.tsx:126-132/170-176/182-184 (PLANNER_UPDATED + 8-second delayed refresh). The shared root is that `conceptFeedService.getCachedDailyPosts()` and `getDailyPosts()` (at concept-feed.service.ts:1480-1499 and :1593-1599) return cached posts WITHOUT filtering by `engagementService.getDismissedAnchorIds()`. The dismiss-aware filters in Effect A (HomeScreen.tsx:567-574) and Effect B (:584-591) operate AFTER these writes, so any async cache-read race re-introduces siblings — even though the match key (`sourceQuestionIds[0] === anchorId`) is correct. The walker's dismiss-skip at post-queue.service.ts:389 correctly handles FUTURE refills, but does nothing for posts already in cache/dailyPosts. The persisted localStorage cache (`trellis_daily_posts`) AND `trellis_post_history` continue to hold dismissed-anchor posts, so refresh re-hydrates them and the lack of filter at read time means they're rendered.
fix: (deferred to plan-phase --gaps; suggested direction below)
verification: (pending)
files_changed: []
