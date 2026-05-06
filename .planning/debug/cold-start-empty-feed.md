---
status: diagnosed
trigger: "Cold start of a new day shows empty feed + error generating post"
created: 2026-05-06T00:00:00Z
updated: 2026-05-06T00:00:00Z
---

## Current Focus

hypothesis: getDailyPosts() returns [] on new-day cold start, useEffect unconditionally calls setDailyPosts([]) + setGenerationError(true), overwriting the warm-start posts the useState initializer correctly placed from getYesterdayQueue()
test: trace the two code paths (useState initializer vs useEffect) on a new-day cold start
expecting: confirmed — useState initializer sets warm-start posts, then useEffect wipes them 200ms later
next_action: root cause confirmed — return diagnosis

## Symptoms

expected: Cold start of a new day immediately shows posts (from yesterday's persisted queue) while refillQueue runs in background. "Error generating post, please check your settings" should NOT appear.
actual: Feed is empty and shows "Couldn't generate posts / Check your API keys in Settings" error state on first launch of a new day.
errors: UI renders generationError=true state — AlertCircle + "home.feed.generationErrorTitle" + "home.feed.generationErrorBody" (= "Check your API keys in Settings")
reproduction: Launch app on a new day (date rollover since last session). Must have questions and a prior day's queue in localStorage.
started: Pre-Phase 36 (commit 6cda914e on 2026-04-18 introduced the conflict). Phase 36 did not cause this.

## Eliminated

- hypothesis: getYesterdayQueue() is dead code (Hypothesis 1 from investigation_directions)
  evidence: grep shows HomeScreen.tsx:43 imports and calls postQueueService.getYesterdayQueue(). The method IS wired.
  timestamp: 2026-05-06

- hypothesis: Phase 36 regression
  evidence: Git blame shows the bug-creating commit (6cda914e) is from 2026-04-18, well before Phase 36 (which started 2026-05-06). Phase 36-03 added derivedList/cyclePosition to QueueState and refactored refillQueue but did not touch HomeScreen's cold-start path. Pre-existing drift.
  timestamp: 2026-05-06

- hypothesis: refillQueue() throws and surfaces as catch in useEffect
  evidence: getDailyPosts() calls refillQueue(questions).catch(console.error) as fire-and-forget. The useEffect's .catch at line 106 only fires if getDailyPosts() rejects, not if refillQueue rejects. getDailyPosts() resolves with [] (not rejects) on cold start.
  timestamp: 2026-05-06

## Evidence

- timestamp: 2026-05-06
  checked: HomeScreen.tsx:38-47 (useState initializer)
  found: On cold start (new day), getCachedDailyPosts() returns [] (yesterday's cache), then loadQueue() + getYesterdayQueue() reads localStorage directly and returns yesterday's posts. useState initializer sets dailyPosts = yesterday.slice(0, 8). This part works correctly.
  implication: The warm-start mechanism IS wired and does work on mount.

- timestamp: 2026-05-06
  checked: HomeScreen.tsx:95-112 (useEffect — getDailyPosts call)
  found: After questionsLoading=false, useEffect fires and calls getDailyPosts(questions). This resolves with [] on cold start. Then setDailyPosts([]) is called unconditionally at line 100, wiping the warm-start posts. Then posts.length === 0 && questions.length > 0 → setGenerationError(true) at line 102-104.
  implication: The useEffect unconditionally overwrites dailyPosts with [], then flags an error. The warm-start posts are lost ~200ms after mount.

- timestamp: 2026-05-06
  checked: concept-feed.service.ts:1434-1462 (getDailyPosts no-cache path)
  found: On a new day with no today's cache: (1) postQueueService.loadQueue() returns freshState (date mismatch → freshState). (2) dequeue(size()) returns [] because size()=0. (3) refillQueue fires in background. (4) Since questions.length > 0, returns []. This is intentional design — getDailyPosts does NOT use yesterday's queue; it expects the today's queue drain path (line 1435-1443) to be populated, but on day 1 of a new day the queue is fresh/empty.
  implication: getDailyPosts returning [] on cold start is by design. The bug is that the caller (HomeScreen useEffect) does not account for this being a normal/expected cold-start return value.

- timestamp: 2026-05-06
  checked: post-queue.service.ts:50-86 (load() and module-level initialization)
  found: Line 86 — `let _state: QueueState = load()`. On module import (new day), load() sees date mismatch and returns freshState() immediately. getYesterdayQueue() (lines 220-231) reads localStorage directly and bypasses _state — so it sees the un-reset yesterday data. But loadQueue() (called in useState initializer line 42) just calls `_state = load()` again → still freshState.
  implication: getYesterdayQueue works correctly because it reads localStorage directly. The _state reset happens at module load, before getYesterdayQueue is called. The chain is correct.

- timestamp: 2026-05-06
  checked: git log — commit chronology
  found: 8b344916 (2026-04-17 21:55) added warm-start useState initializer. 6cda914e (2026-04-18 00:47) added the error gate `posts.length === 0 && questions.length > 0 → setGenerationError(true)` WITHOUT adding a guard to skip setDailyPosts([]) when warm-start posts are already showing.
  implication: The conflict was created 2h42m after warm-start was implemented. The error gate (intended for "LLM returned nothing / API keys bad") did not account for the cold-start normal case where getDailyPosts intentionally returns [].

## Resolution

root_cause: |
  HomeScreen.tsx useEffect (line 95-112) unconditionally calls setDailyPosts(posts) with posts=[] on
  cold start (new day). This overwrites the warm-start posts that the useState initializer (line 38-47)
  correctly placed from getYesterdayQueue(). Then the empty-array check at line 102-104
  (posts.length === 0 && questions.length > 0 → setGenerationError(true)) triggers the error UI.

  Two design intents conflict:
  1. Warm-start (D-30, commit 8b344916): useState initializer shows yesterday's queue while today's
     feed loads. This works correctly in isolation.
  2. Error gate (commit 6cda914e): useEffect sets generationError=true when getDailyPosts() returns [].
     getDailyPosts() returning [] IS the expected behavior on a new-day cold start (no today's queue
     yet; refillQueue fires in background). The error gate treats "no posts ready yet" the same as
     "API key missing/broken."

  The fix must make the useEffect's setDailyPosts call conditional: do NOT overwrite dailyPosts with
  [] if the current dailyPosts is already populated (warm-start posts are showing). And do NOT set
  generationError=true when getDailyPosts() returns [] for the normal "queue not yet filled" cold-start
  case vs the true error case.

fix: not applied (find_root_cause_only mode)
verification: not applied
files_changed: []
