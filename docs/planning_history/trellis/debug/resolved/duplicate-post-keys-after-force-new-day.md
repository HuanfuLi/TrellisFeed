---
status: resolved
trigger: "Phase 43 UAT Test 12 — After Force-New-Day, React DEV warnings spam: Encountered two children with the same key, post-2026-05-12-video-anchor-{id}-{uuid}. Multiple distinct anchor IDs implicated. loadNextBatch log shows popped 8 posts, styles: {video: 6, news: 2}."
created: 2026-05-12T07:16:42Z
updated: 2026-05-12T07:22:00Z
resolved_by: 43-15-force-new-day-dedup
---

## Current Focus

hypothesis: CONFIRMED. Force-New-Day produces a double-population of the same posts: (1) HomeScreen Effect A's tier-2 fallback seeds `dailyPosts` from `postQueueService.getYesterdayQueue()` (yesterday's snapshot at STORAGE_KEY_YESTERDAY), AND (2) `postQueueService.load()`'s date-mismatch branch rehydrates `_state.posts` from the SAME parsed.posts payload. Both arrays draw from the same yesterday-snapshot post set. `loadNextBatch` then dequeues from `_state.posts` — overlapping with what HomeScreen already has in `dailyPosts`. The `[...prev, ...newPosts]` concat at HomeScreen.tsx:263 produces duplicate React keys.
test: complete (traced + matches user evidence)
expecting: matched
next_action: emit ROOT CAUSE FOUND

## Symptoms

expected: After triggering Force New Day (Settings → Data), HomeScreen re-renders the masonry feed without React DEV warnings about duplicate keys. Each unique post id appears exactly once in the rendered children array.
actual: Console floods with React DEV warnings: "Encountered two children with the same key, post-2026-05-12-video-anchor-{id}-{uuid}". Multiple distinct anchor IDs implicated (1778057902568, 1778058314904, 1777471536383, 1777471733834, 1777469881037, 1777471605284). Mostly video posts + one news. loadNextBatch log: "popped 8 posts, styles: {video: 6, news: 2}".
errors: React DEV warnings only (no thrown errors). Render still completes.
reproduction: Phase 43 UAT Test 12. (1) Run dev build. (2) Have an existing day's worth of generated posts. (3) Settings → Data → "Force new day (dev)". (4) Land on /home. (5) Pull up to swipe for more.
started: After Phase 43 gap-closure 43-13 + post-gap follow-ups (engagementService.resetDismissedOnly partial reset, archive consolidation, post persistence fix, patchPostEssayInCache writes-to-all-4-caches).

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-05-12T07:18:00Z
  checked: SettingsDataScreen.tsx handleForceNewDay (lines 78-149)
  found: Sets trellis_post_queue.date = yesterday AND trellis_daily_posts.date = yesterday, then calls postQueueService.loadQueue(). Phase 43-13 also added engagementService.resetDismissedOnly() at line 142. Does NOT call postQueueService.resetForNewDay() — only the "Reset today" button at line 311 does that.
  implication: Both storage keys now carry the yesterday stamp, which means BOTH the served-posts cache (loadCache) AND the queue (postQueueService.load) will trip their date-mismatch branches simultaneously.

- timestamp: 2026-05-12T07:18:30Z
  checked: postQueueService.load() date-mismatch branch (post-queue.service.ts:78-121)
  found: When parsed.date !== today(), the function (a) snapshots parsed.posts (yesterday's full payload) to STORAGE_KEY_YESTERDAY at lines 87-93, and (b) rehydrates the in-memory _state.posts from the SAME parsed.posts at lines 107-114. No save() is called after load(), so on-disk STORAGE_KEY remains yesterday-stamped until the next save trigger.
  implication: Yesterday's full UNSERVED queue (e.g., [P1..P32]) is now in TWO places at once: STORAGE_KEY_YESTERDAY (for getYesterdayQueue) AND in-memory _state.posts (for dequeue).

- timestamp: 2026-05-12T07:19:00Z
  checked: concept-feed.service.ts loadCache() (lines 168-210) + getCachedDailyPosts() (lines 1593-1599)
  found: loadCache returns null when parsed.date !== today() (Phase 36-11 stale-cache rejection, line 187). After Force-New-Day, trellis_daily_posts.date = yesterday, so getCachedDailyPosts() returns []. This is the intentional Phase 36-11 design — yesterday's already-served posts must not re-render today.
  implication: HomeScreen Effect A's tier-1 check (cached.length > 0) fails, forcing the tier-2 yesterday-queue fallback.

- timestamp: 2026-05-12T07:19:30Z
  checked: HomeScreen.tsx Effect A — [location.pathname] re-sync effect (lines 204-224)
  found: When location.pathname becomes /home (after navigate('/home') from SettingsDataScreen), the effect (a) calls conceptFeedService.getCachedDailyPosts() → [] (stale-rejected); (b) falls through to postQueueService.getYesterdayQueue() → returns the full yesterday snapshot (e.g., [P1..P32]); (c) setDailyPosts(yesterdayQueue.slice(0, 8)) at line 217 — first 8 of yesterday's snapshot.
  implication: dailyPosts state now contains 8 post objects whose ids ALSO exist in postQueueService._state.posts (which was rehydrated from the same parent set). The two arrays draw from a common parent.

- timestamp: 2026-05-12T07:20:00Z
  checked: infiniteScrollService.loadNextBatch (lines 46-65) → conceptFeedService.generateMorePosts (lines 1650-1671) → postQueueService.dequeue (lines 234-239)
  found: generateMorePosts calls postQueueService.dequeue(count) which executes _state.posts.splice(0, count) — the first 8 posts of the rehydrated _state.posts. These come from the SAME yesterday-snapshot parent set as dailyPosts. infiniteScrollService.seenPostIds is local to loadNextBatch only — it starts empty at initialize() and is NEVER seeded from dailyPosts, so it does not dedupe against the warm-start fallback contents.
  implication: The 8 dequeued posts have ids that strongly overlap with the 8-post warm-start subset already in dailyPosts. The dequeue's splice ordering is post-spread (load() ran spreadByConcept+spreadByStyle in place at lines 107-111), while getYesterdayQueue returns pre-spread ordering (snapshot at line 89 ran BEFORE the spread). Same SET of ids, different orderings → partial overlap when slicing the first 8 of each.

- timestamp: 2026-05-12T07:20:30Z
  checked: HomeScreen.tsx handleLoad (lines 229-272) — the swipe-for-more handler
  found: At line 263, setDailyPosts((prev) => [...prev, ...newPosts]) — concatenates the 8 freshly-popped posts to the existing dailyPosts. No id-based dedup against prev.
  implication: After concat, dailyPosts contains BOTH the warm-start seed (8 yesterday-snapshot posts) AND 8 dequeued posts. The overlap in id sets produces duplicate keys — which is exactly what React's reconciler warns about.

- timestamp: 2026-05-12T07:21:00Z
  checked: User-reported logs from UAT Test 12
  found: (1) "popped 8 posts, styles: {video: 6, news: 2}" — all 8 popped posts are video/news. (2) 6 distinct anchor IDs in dup-key warnings — 5 video + 1 news. (3) style-assignment log "n=24 → {text-art: 13, image: 3, video: 5, news: 2, suggestion: 1}" is from a separate background refillQueue (n=24 = dailyGenerationCapMultiplier × anchors after refresh).
  implication: 6 of the 8 dequeued posts (75% overlap) had IDs already in dailyPosts. The video+news bias confirms the spread ordering thesis — yesterday's UNSERVED queue is style-biased toward minority styles (per comment at post-queue.service.ts:103-106), so the first 8 of the pre-spread snapshot AND the first 8 of the post-spread _state.posts both concentrate on video/news, maximizing collision.

- timestamp: 2026-05-12T07:21:30Z
  checked: MasonryFeed.tsx (lines 633-648)
  found: Each rendered tile uses `key={itemId}` where `itemId = getId(item)` = `item.post.id` for concept items. Two items in `infoFlowItems` (HomeScreen.tsx:417-459) with the same post.id produce two TileWrappers with the same React key.
  implication: This is the direct site where the warning is emitted. The duplicate is upstream in dailyPosts → infoFlowItems.

- timestamp: 2026-05-12T07:22:00Z
  checked: Phase 36 mental model — "yesterday's UNSERVED queue auto-populates today's feed"
  found: The design intent (per post-queue.service.ts:97-106 + CLAUDE.md "New-day rehydration") is that the rehydrated _state.posts IS today's feed, served via getDailyPosts → dequeue → saveCache → return. That path (concept-feed.service.ts:1515-1525) writes the dequeued posts to trellis_daily_posts and returns them.
  implication: The intended flow IS: load() rehydrates _state.posts; getDailyPosts dequeues all of them in one shot into the daily cache; HomeScreen uses cached posts via tier-1. BUT getDailyPosts is only fired from the [questions, questionsLoading] useEffect at HomeScreen.tsx:117 — which does NOT re-run on /home navigation when questions are unchanged (Force-New-Day doesn't mutate questions). So after Force-New-Day, the rehydrated _state.posts is NEVER dequeued into the daily cache. HomeScreen Effect A then peeks at the same snapshot via getYesterdayQueue, AND loadNextBatch later pops from the still-full _state.posts — collision.

## Resolution

root_cause: |
  After Force-New-Day, the same set of yesterday-snapshot posts is held in TWO independent stores:
    (a) STORAGE_KEY_YESTERDAY (the durable snapshot) — read by postQueueService.getYesterdayQueue()
    (b) postQueueService._state.posts (the live in-memory queue, rehydrated by load() in its date-mismatch branch)
  HomeScreen Effect A (HomeScreen.tsx:204-224) seeds `dailyPosts` from (a) via the tier-2 warm-start fallback, because tier-1 (conceptFeedService.getCachedDailyPosts) returns [] under Phase 36-11's stale-cache rejection. When the user then swipes for more, loadNextBatch → generateMorePosts → postQueueService.dequeue(8) pops the first 8 posts from (b) — which draws from the SAME post set. HomeScreen.tsx:263 concatenates them via setDailyPosts(prev => [...prev, ...newPosts]) with no id-dedup against prev. Result: dailyPosts contains the same post id twice; MasonryFeed at line 635 binds two TileWrappers to the same React key → "Encountered two children with the same key" warnings.

  The deeper architectural cause is that the Phase 36 "new-day rehydration" design intent — that the rehydrated _state.posts becomes today's feed via getDailyPosts → dequeue → saveCache — relies on getDailyPosts being called after the rehydration. Today, getDailyPosts is wired only to the [questions, questionsLoading] useEffect at HomeScreen.tsx:117, which does NOT re-run on /home navigation when questions are unchanged (Force-New-Day leaves the question set intact). So the rehydrated _state.posts is never dequeued into the daily cache; the warm-start fallback peeks at the snapshot AND the queue still holds the full payload — collision is structural, not coincidental.

fix: (pending — diagnose-only mode)
verification: (pending — diagnose-only mode)
files_changed: []
