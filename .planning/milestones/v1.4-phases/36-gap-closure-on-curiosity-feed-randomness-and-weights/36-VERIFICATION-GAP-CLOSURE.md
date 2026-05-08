---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
verification_scope: gap-closure (plans 36-06, 36-07, 36-08, 36-09, 36-10)
verified: 2026-05-06T18:00:00Z
round_2_verified: 2026-05-07T07:30:00Z
status: passed
round_2_status: passed
score: 24/24 must-haves verified (across 5 gap-closure plans)
round_2_score: 10/10 must-haves verified (plans 36-09 + 36-10)
re_verification: false
parent_verification: 36-VERIFICATION.md
parent_status: passed (13/13)
---

# Phase 36 Gap Closure Verification Report

**Phase Goal (gap-closure scope):** Close the 3 gaps surfaced during UAT round 1 (cold-start empty feed, style mix imbalance, video completion signal absent) AND the round-2 gap (GAP-D: cold-start warm-start path is single-shot — destroyed by today's first save), without regressing the 13 must-haves from the original Phase 36 verification.

**Verified:** 2026-05-06T18:00:00Z (round 1) → extended 2026-05-07T07:30:00Z (round 2)
**Status:** PASSED (round 1) → PASSED (round 2)
**Re-verification:** No — initial verification of the gap-closure addition (36-06, 36-07, 36-08, then additive 36-09, 36-10).
**Parent report:** `36-VERIFICATION.md` (13/13 must-haves passed for the original Wave 0..05 work)

This report covers the five gap-closure plans (36-06, 36-07, 36-08 in round 1; 36-09, 36-10 in round 2). The original Phase 36 must-haves are re-confirmed at the end via Phase 33 sentinel greps + Phase 36 wiring greps.

---

## Goal Achievement

### Observable Truths — Plan 36-06 (Cold-start warm-start guard, GAP-A)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | On a cold start of a new day, the feed shows yesterday's leftover posts immediately (warm-start state from getYesterdayQueue is preserved) | VERIFIED | `HomeScreen.tsx:122` wraps `setDailyPosts(posts)` in `if (posts.length > 0)` — empty getDailyPosts() return no longer overwrites the warm-start initializer at lines 38-47 |
| 2 | The "error generating post, please check your settings" UI does NOT fire when getDailyPosts returns [] but a warm-start fallback is already on screen | VERIFIED | `HomeScreen.tsx:134` — error gate now reads `posts.length === 0 && questions.length > 0 && !warmStartHadPostsRef.current`; ref captured pre-fetch at line 63 |
| 3 | When BOTH the warm-start fallback AND today's getDailyPosts are empty AND questions exist, the genuine error UI still fires | VERIFIED | Same condition at line 134 — `!warmStartHadPostsRef.current` is true when no warm-start was seeded; the original 6cda914e error-gate intent (genuinely broken API keys) is preserved |

**Score (36-06):** 3/3 truths verified

### Observable Truths — Plan 36-07 (Walker termination guard, GAP-B)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 4 | walkDerivedList(N, exploredIds) returns up to N entries regardless of len; the count argument is fully respected | VERIFIED | `post-queue.service.ts:344` — `const maxSteps = Math.max(count * 2, len)`; the buggy `len * 2` cap is gone (grep `const maxSteps = len \* 2;` returns 0) |
| 5 | Specifically: walkDerivedList(16, new Set()) on a 4-entry derivedList returns 16 entries (4 wraps × 4 = 16) | VERIFIED | `derived-list.test.mjs` Test 11 GREEN — asserts `out.length === 16` and exact ordering `[a,b,c,d]×4`; cyclePosition wraps to 0 |
| 6 | text-art count satisfies floor(N×0.55)=8 across 16 entries | VERIFIED | `refill-queue-integration.test.mjs` Test 7 GREEN — asserts `counts['text-art'] >= Math.floor(16 * STYLE_WEIGHTS['text-art'])` (= 8) on a single-anchor derivedList |
| 7 | Termination semantics preserved: returns [] when all explored, no infinite loop | VERIFIED | `derived-list.test.mjs` Test 9 (all-explored → []) + Test 12 (skip 'a' multi-wrap, no infinite loop, returns 8 non-'a' entries) — both GREEN; `Math.max(count * 2, len)` only RAISES the floor, never lowers vs. `len * 2` |

**Score (36-07):** 4/4 truths verified

### Observable Truths — Plan 36-08 (Video completion signal, GAP-C)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 8 | Video posts in PostDetailScreen fire CONCEPT_EXPLORED via YouTube postMessage detector (ENDED OR ≥80%) | VERIFIED | `PostDetailScreen.tsx:151` Detector D useEffect; line 183 parses `data.event === 'onStateChange' && data.info === 0` (ENDED); line 191 parses `info.currentTime / info.duration >= 0.8` (heartbeat threshold) |
| 9 | Short posts in feed fire CONCEPT_EXPLORED on tap-to-play | VERIFIED | `InfoFlow.tsx:441-442` — `dailyReadService.markExplored(anchorId)` + `eventBus.emit({type: 'CONCEPT_EXPLORED', payload: {anchorId}})` inside short-card onClick at line 426 |
| 10 | Idempotent (no double-fire on rapid replay) | VERIFIED | Three layers: (1) `PostDetailScreen.tsx:117` — `if (hasEmittedRef.current) return;`; (2) `PostDetailScreen.tsx:118` — `dailyReadService.isExplored` early return; (3) `InfoFlow.tsx:440` — `if (anchorId && !dailyReadService.isExplored(anchorId))` guard before emit; outer `videoPlaying !== post.id` at line 427 also blocks re-fire on rapid replay |
| 11 | Origin allowlist prevents foreign frame spoofing | VERIFIED | `PostDetailScreen.tsx:169` — `if (event.origin !== 'https://www.youtube.com' && event.origin !== 'https://www.youtube-nocookie.com') return;` |
| 12 | YouTubeEmbed iframe src includes enablejsapi=1 | VERIFIED | `YouTubeEmbed.tsx:24` — `?playsinline=1&rel=0&enablejsapi=1`; InfoFlow video iframe at `InfoFlow.tsx:344` and short iframe at `InfoFlow.tsx:467` also include `enablejsapi=1` |
| 13 | Existing Detectors A/B/C unchanged | VERIFIED | `PostDetailScreen.tsx:124` — `Detector A: Scroll 70% sentinel (IntersectionObserver)`; `PostDetailScreen.tsx:139` — `Detector B: 30s dwell timer`; both byte-stable |
| 14 | No new event types introduced (CONCEPT_EXPLORED reused) | VERIFIED | InfoFlow emits `type: 'CONCEPT_EXPLORED'` (same shape as PostDetailScreen.tsx:121); test `InfoFlow.short-tap-emit.test.mjs` Test 3 enforces exactly 1 occurrence in InfoFlow.tsx |

**Score (36-08):** 7/7 truths verified

**Round 1 Combined Score:** 14/14 gap-closure truths verified

---

## Round 2 — Plans 36-09 + 36-10 (GAP-D)

**Round 2 Goal:** Close GAP-D by (A) making `getYesterdayQueue()` durable across multiple cold-start mounts of a new day via a separate localStorage snapshot key, and (B) providing a deterministic dev affordance to verify the cold-start warm-start path without waiting for midnight.

### Round 2 Observable Truths

#### Plan 36-09 — Durable Yesterday Snapshot (GAP-D Fix A)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| R2-1 | `post-queue.service.ts:load()` detects date mismatch AND copies the prior payload (non-empty posts only) to a NEW localStorage key (`echolearn_post_queue_yesterday`) BEFORE returning `freshState()` | VERIFIED | `post-queue.service.ts:64-82` — `if (parsed.date !== today())` branch contains a try/catch wrapping `Array.isArray(parsed.posts) && parsed.posts.length > 0` guard then `localStorage.setItem(STORAGE_KEY_YESTERDAY, JSON.stringify({date: parsed.date, posts: parsed.posts}))` BEFORE the `return freshState()` at line 82. Constant declared at line 15. |
| R2-2 | `getYesterdayQueue()` reads from `STORAGE_KEY_YESTERDAY` (the snapshot key), NOT the live `STORAGE_KEY` — so it is durable across multiple cold-start mounts of the new day | VERIFIED | `post-queue.service.ts:252-261` — `localStorage.getItem(STORAGE_KEY_YESTERDAY)` at line 254; no stale-date check needed (snapshot key is implicitly yesterday). Grep confirms zero remaining references to `STORAGE_KEY` inside the `getYesterdayQueue` body. |
| R2-3 | Subsequent `save()` calls of today's queue do NOT destroy the yesterday snapshot (different key) | VERIFIED | `save()` at line 103-109 writes only to `STORAGE_KEY` (live key). `enqueue()`, `dequeue()`, `incrementCycle()`, `resetForNewDay()`, `loadQueue()`, `appendToDerivedList()`, `walkDerivedList()` all call `save(_state)` — none touch `STORAGE_KEY_YESTERDAY`. Test 3 in `post-queue-yesterday-snapshot.test.mjs` GREEN: enqueue forces a save, then `getYesterdayQueue()` still returns the original 2 yesterday posts. |
| R2-4 | Existing 70 Phase 36 quick-suite tests still pass; 1 new test file (`post-queue-yesterday-snapshot.test.mjs`) covers the snapshot lifecycle (7 tests: snapshot-on-load, read-from-snapshot, survives-save, skip-empty, W-1 multi-step rollover, W-2 first-install, I-2 resetForNewDay-preserves) | VERIFIED | `node --test [11 files]` reports `tests 81 / pass 81 / fail 0` (70 prior + 7 snapshot + 4 force-new-day = 81). All 7 cases in `post-queue-yesterday-snapshot.test.mjs` GREEN. |
| R2-5 | Phase 33 grep sentinels intact (`dueAnchors` filter, `allExplored && postQueueService.getTotalGenerated`) | VERIFIED | `grep -c "dueAnchors" app/src/services/concept-feed.service.ts` returns 2; `grep -c "allExplored && postQueueService.getTotalGenerated" app/src/services/concept-feed.service.ts` returns 1. Phase 33 Wave-3 cap-gate byte-unchanged. |
| R2-6 | Phase 35 grep sentinel intact (`USER_ACK_BEFORE_GRAPH_CONTEXT` constant) | VERIFIED | `grep -c "USER_ACK_BEFORE_GRAPH_CONTEXT" app/src/state/useQuestions.ts` returns 3 (constant declaration + 2 references in the askStreaming Pass 1 + Pass 2 message arrays). |

**Score (36-09):** 6/6 truths verified

#### Plan 36-10 — Dev "Force New Day" Affordance (GAP-D Fix B)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| R2-7 | `SettingsDataScreen.tsx` Developer section gains a "Force new day (dev)" button gated behind `import.meta.env.DEV` — production users do NOT see it | VERIFIED | `SettingsDataScreen.tsx:177` — `{import.meta.env.DEV && (` wraps the SettingRow at lines 178-186. Vite tree-shakes the dead branch in production builds. The label `"Force new day (dev)"` and button text `"Roll back date"` confirmed at lines 179 + 183. Inserted between the trellisDevMode hint paragraph (line 170-172) and the postRetention SettingRow (line 187), keeping the Developer card visually coherent. |
| R2-8 | Tapping the button: (a) reads `localStorage.echolearn_post_queue`, (b) mutates `parsed.date` to yesterday's ISO date, (c) writes back, (d) calls `postQueueService.loadQueue()`, (e) shows a toast, (f) navigates to `/home` so the cold-start path runs | VERIFIED | `SettingsDataScreen.tsx:77-97` `handleForceNewDay`: line 79 reads `localStorage.getItem('echolearn_post_queue')`, line 87 computes yesterday via `new Date(Date.now() - 86400000).toISOString().slice(0, 10)`, line 88 mutates `parsed.date`, line 89 writes back, line 90 `postQueueService.loadQueue()`, line 91 `toast(...)`, line 92 `navigate('/home')`. Try/catch wraps the whole handler with a `console.warn` + error toast on the catch arm. |
| R2-9 | Strings are hardcoded English (NOT i18n bundled) because the button is dev-only and DOES NOT ship in production builds — see CLAUDE.md i18n workflow exemption rationale in the inline comment | VERIFIED | `SettingsDataScreen.tsx:173-176` — JSX comment block above the gated SettingRow explicitly cites the CLAUDE.md i18n workflow exemption: "this button is gated by import.meta.env.DEV and never reaches production users, so the i18n workflow's 'all 4 bundles per UI string' rule does NOT apply." Strings `"Force new day (dev)"`, `"Roll back date"`, the description text, and all 3 toast messages use hardcoded English literals. No `t(...)` calls inside the gated block. |
| R2-10 | Source-reading test asserts the `import.meta.env.DEV` gate is present AND the `navigate('/home')` call is wired AND the `postQueueService.loadQueue` call is wired | VERIFIED | `SettingsDataScreen.force-new-day.test.mjs` (4 tests, all GREEN): Test 1 asserts `source.includes('import.meta.env.DEV &&')`; Test 2 asserts `source.includes('const handleForceNewDay')`; Test 3 asserts `/handleForceNewDay[\s\S]*?postQueueService\.loadQueue\(\)[\s\S]*?\}/`; Test 4 asserts `/handleForceNewDay[\s\S]*?navigate\(['"]\/home['"]\)[\s\S]*?\}/`. Region matches confirm the calls are inside the handler body, not elsewhere in the file. |

**Score (36-10):** 4/4 truths verified

**Round 2 Combined Score:** 10/10 truths verified

---

### Round 2 Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/services/post-queue.service.ts` | `STORAGE_KEY_YESTERDAY` constant + load() snapshot branch + getYesterdayQueue reads from snapshot | VERIFIED | Constant at line 15; snapshot block at lines 65-81; getYesterdayQueue body at lines 252-261. resetForNewDay at line 235 unchanged (does NOT clear the snapshot — Test 7 / I-2 invariant). save() at line 103 unchanged. |
| `app/tests/services/post-queue-yesterday-snapshot.test.mjs` | 7 behavioral tests | VERIFIED | File exists, 252 lines, all 7 it() blocks GREEN. localStorage polyfill at lines 18-24 enables Node test execution. Dynamic import of post-queue.service.ts at line 71 (after polyfill seed). |
| `app/src/screens/settings/SettingsDataScreen.tsx` | Dev-only Force-new-day button + handler | VERIFIED | Handler at lines 77-97; gated SettingRow at lines 173-186; `postQueueService` imported at line 16; `useNavigate` imported at line 3. The button is positioned AFTER the trellisDevMode hint paragraph and BEFORE the postRetention SettingRow per plan §step 2. |
| `app/tests/screens/SettingsDataScreen.force-new-day.test.mjs` | 4 source-reading regression tests | VERIFIED | File exists, 56 lines, all 4 it() blocks GREEN. Pattern follows `HomeScreen.warm-start-guard.test.mjs` (Plan 36-06): readFileSync + assert.match/includes against the source. |
| `CLAUDE.md` | New "Numeric defaults" bullet documenting STORAGE_KEY_YESTERDAY | VERIFIED | Line 74 contains the new bullet with the full rationale: live-key destruction by first save, snapshot read path, link to `.planning/debug/cold-start-warm-start-fragile.md`. Sentinel grep `STORAGE_KEY_YESTERDAY` in CLAUDE.md returns 1 (new). |

---

### Round 2 Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `post-queue.service.ts:load()` (date-mismatch branch) | `STORAGE_KEY_YESTERDAY` localStorage key | `localStorage.setItem(STORAGE_KEY_YESTERDAY, JSON.stringify({date, posts}))` | WIRED | Snapshot fires at line 74 BEFORE `return freshState()` at line 82; gated by `Array.isArray(parsed.posts) && parsed.posts.length > 0` to avoid persisting empty payloads. |
| `getYesterdayQueue()` consumer (HomeScreen useState initializer) | `STORAGE_KEY_YESTERDAY` snapshot | `localStorage.getItem(STORAGE_KEY_YESTERDAY)` at line 254 | WIRED | HomeScreen.tsx:38-47 initializer (Phase 36-06) reads `postQueueService.getYesterdayQueue()`; under round-2 fix this now reads the durable snapshot regardless of how many save() calls have fired today. |
| `SettingsDataScreen.handleForceNewDay` | `postQueueService.loadQueue()` | direct call at line 90 | WIRED | After mutating `localStorage.echolearn_post_queue.date` to yesterday at line 89, `loadQueue()` reloads the in-memory `_state` from the now-stale payload. The reload itself triggers load()'s date-mismatch branch → snapshot fires → in-memory `_state` becomes a freshState. |
| `SettingsDataScreen.handleForceNewDay` | `navigate('/home')` | react-router-dom useNavigate | WIRED | Line 92 calls `navigate('/home')`; preserves SPA mount lifecycle (vs `window.location.assign` which would hard-reload). HomeScreen's useState initializer runs cleanly on the navigate-triggered remount → reads the durable yesterday snapshot. |

---

### Round 2 Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| HomeScreen warm-start render (round-2 path) | `dailyPosts` initial state | `postQueueService.getYesterdayQueue()` reading `STORAGE_KEY_YESTERDAY` | Yes — durable persisted snapshot from prior day's load() | FLOWING |
| Force-new-day → cold-start verification | localStorage `echolearn_post_queue.date` | mutated to yesterday's ISO date by handler | Yes — triggers next loadQueue's date-mismatch branch which fires the snapshot | FLOWING |

---

### Round 2 Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 36 quick suite (11 files, 70 prior + 7 + 4 = 81 total) | `cd app && node --test tests/services/derived-list.test.mjs tests/services/style-assignment-stratified.test.mjs tests/services/spread-by-concept.test.mjs tests/services/refill-queue-integration.test.mjs tests/services/style-assignment.test.mjs tests/services/post-queue.test.mjs tests/services/post-queue-yesterday-snapshot.test.mjs tests/screens/HomeScreen.warm-start-guard.test.mjs tests/screens/PostDetailScreen.video-detector.test.mjs tests/components/InfoFlow.short-tap-emit.test.mjs tests/screens/SettingsDataScreen.force-new-day.test.mjs` | tests=81, pass=81, fail=0, suites=11 | PASS |
| TypeScript clean | `cd app && npx tsc -b --noEmit` | exit 0, no output | PASS |
| Phase 33 dueAnchors filter sentinel | `grep -c "dueAnchors" app/src/services/concept-feed.service.ts` | 2 (unchanged) | PASS |
| Phase 33 allExplored cap-gate sentinel | `grep -c "allExplored && postQueueService.getTotalGenerated" app/src/services/concept-feed.service.ts` | 1 (unchanged) | PASS |
| Phase 35 USER_ACK_BEFORE_GRAPH_CONTEXT sentinel | `grep -c "USER_ACK_BEFORE_GRAPH_CONTEXT" app/src/state/useQuestions.ts` | 3 (unchanged: 1 const + 2 refs) | PASS |
| CLAUDE.md MAX_QUEUE_SIZE sentinel | `grep -c "MAX_QUEUE_SIZE" CLAUDE.md` | 1 (unchanged) | PASS |
| CLAUDE.md html,body overflow sentinel | `grep -c "html, body { overflow: hidden }" CLAUDE.md` | 3 (unchanged) | PASS |
| CLAUDE.md minWidth: 0 sentinel | `grep -c "minWidth: 0" CLAUDE.md` | 2 (unchanged) | PASS |
| CLAUDE.md USER_ACK sentinel | `grep -c "USER_ACK_BEFORE_GRAPH_CONTEXT" CLAUDE.md` | 2 (unchanged) | PASS |
| CLAUDE.md ANCHOR_PRE_CHECK sentinel | `grep -c "ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD" CLAUDE.md` | 1 (unchanged) | PASS |
| CLAUDE.md STORAGE_KEY_YESTERDAY (NEW) | `grep -n "STORAGE_KEY_YESTERDAY" CLAUDE.md` | line 74 (new bullet present) | PASS |

---

### Round 2 Requirements Coverage

| GAP ID | Plan(s) | Description | Status | Evidence |
|--------|---------|-------------|--------|---------|
| GAP-D | 36-09 + 36-10 | Cold-start warm-start path is single-shot — destroyed by today's first save(). User reported on round-2 UAT: "It's in the new day but the app is not showing cold start? Also, should add a dev feature in Settings page to force a new day." | CLOSED | (A) Durable yesterday snapshot via separate `STORAGE_KEY_YESTERDAY` localStorage key — survives any number of save() calls of today's queue (Plan 36-09, 7/7 lifecycle tests GREEN). (B) Dev-only "Force new day" button under Settings → Developer, gated behind `import.meta.env.DEV`, mutates queue date + reloads + navigates to /home (Plan 36-10, 4/4 source-reading tests GREEN). |

---

### Round 2 Anti-Patterns Scan

| File | TODO/FIXME/STUB | Empty implementations | Hardcoded empty data | Status |
|------|-----------------|------------------------|----------------------|--------|
| `app/src/services/post-queue.service.ts` (round-2 region: STORAGE_KEY_YESTERDAY constant + load() snapshot branch + getYesterdayQueue body) | None — comment block at lines 7-14 documents the durable-snapshot rationale, not a TODO | `getYesterdayQueue` returns `[]` only when `localStorage.getItem` returns null OR JSON parse throws — both are intentional graceful paths (Test 6 W-1 first-install) | None — the empty array return is the documented graceful-empty contract for "no snapshot exists yet" | CLEAN |
| `app/src/screens/settings/SettingsDataScreen.tsx` (round-2 region: handleForceNewDay handler + gated SettingRow) | None — comment block at lines 72-76 documents the dev-only intent, comment block at 173-176 documents the i18n exemption | None — the catch arm at line 95 logs + toasts, doesn't swallow silently | None — hardcoded English strings are the explicit design decision, NOT a stub (test R2-9 enforces this) | CLEAN |
| `app/tests/services/post-queue-yesterday-snapshot.test.mjs` (NEW, 252 lines, 7 tests) | None | None | All assertions use real DailyPost stubs via `makePost(id, overrides)` helper at lines 49-69; localStorage polyfill at lines 18-24 mirrors the global localStorage contract | CLEAN |
| `app/tests/screens/SettingsDataScreen.force-new-day.test.mjs` (NEW, 56 lines, 4 tests) | None | None | Source-reading via `readFileSync` — no stubbed data | CLEAN |
| `CLAUDE.md` (round-2 addition: 1 new bullet at line 74) | None | None | None | CLEAN |

No anti-patterns detected in the round-2 region. The try/catch in load()'s snapshot block (lines 72-81) is a defensive guard with a `console.warn` — not a stub; the `return freshState()` at line 82 still fires regardless of snapshot success/failure (correct error-handling pattern: snapshot is best-effort, freshState is the contract).

---

### Round 2 Human Verification Required

| Test | What To Do | Expected | Why Human |
|------|-----------|----------|-----------|
| GAP-D end-to-end retest (real cold-start) | Tap Settings → Data & Privacy → Developer → "Roll back date". Then close and re-open the app. Then close and re-open AGAIN (this is the round-2 critical case — the second mount tests durability) | First open: yesterday's posts appear immediately (warm-start), then ~8s later replaced by today's freshly-generated batch. Second open: SAME warm-start posts appear, NOT empty (durable snapshot proven on the second mount). No "Check your API keys" toast either time. | Multiple mount cycles + visual feed render is human-perceptible only |
| Dev affordance toast and navigation | Tap "Roll back date" with no posts in queue (fresh install, no Q&As) | Toast: "No post queue to roll back. Generate some posts first." (info severity). No navigation. | Toast UI is human-perceptible only |
| Production tree-shaking confirmation (one-time) | Run `npm run build` and grep the dist bundle for "Force new day (dev)" | Empty grep result (string tree-shaken from production build). | Requires building the app |

These items do not block phase goal — all automated invariants are GREEN. The retest recipes can be executed by the operator using the round-2 affordance itself (the dev button removes the wait-for-midnight blocker).

---

### Round 2 Gaps Summary

No gaps. All 10 round-2 must-haves verified GREEN across plans 36-09 and 36-10. GAP-D is closed end-to-end:

- **Fix A (36-09):** `STORAGE_KEY_YESTERDAY = 'echolearn_post_queue_yesterday'` constant; `load()` snapshots `parsed.{date,posts}` to this key on date-mismatch BEFORE returning freshState (gated by `posts.length > 0`); `getYesterdayQueue()` reads from this snapshot key. resetForNewDay does NOT clear the snapshot (preserves warm-start fallback for the user-facing "Reset today" button). 7 lifecycle tests + 3 updated existing post-queue.test.mjs cases (read-from-snapshot contract) all GREEN.
- **Fix B (36-10):** `handleForceNewDay` handler at SettingsDataScreen.tsx:77-97; SettingRow gated behind `{import.meta.env.DEV && (...)}` at lines 177-186. Handler reads localStorage → mutates date to yesterday → writes back → calls `postQueueService.loadQueue()` → toasts → `navigate('/home')`. Hardcoded English strings (i18n exemption documented inline). 4 source-reading regression tests GREEN.

Phase 33 regression-safety preserved: `dueAnchors.filter` and `allExplored && getTotalGenerated() >= maxPosts` are byte-unchanged. Phase 35 `USER_ACK_BEFORE_GRAPH_CONTEXT` byte-stable system prompt invariant byte-unchanged. Phase 36 Wave 0..04 wiring (appendToDerivedList + walkDerivedList + spreadByConcept-before-spreadByStyle) byte-unchanged. All 14 round-1 must-haves still VERIFIED.

Test count delta: +11 new round-2 tests (7 + 4) all GREEN. Phase 36 quick suite expands from 70 to 81 passing tests across 11 files.

Round-2 status flip: `36-UAT.md` Test 1 was `result: issue` (severity: major) before this fix. With round-2 closure verified, the operator can flip Test 1's `result` from `issue` to `pass` after performing the human verification recipes above. This verification report does NOT mutate the UAT file — that's the operator's call once they've run the manual retest using the new dev affordance.

---

### Original Phase 36 Must-Have Regression Check (re-confirmed at round-2)

The original `36-VERIFICATION.md` passed 13/13 must-haves. Round-1 (plans 36-06/07/08) added 14 gap-closure must-haves. Round-2 (plans 36-09/10) adds 10 more, all without regressing prior invariants. Sentinel greps for the most critical regression-prone invariants:

| Original Must-Have | Sentinel | Result | Status |
|--------------------|----------|--------|--------|
| Phase 33: dueAnchors explored-filter at buildConceptBatch | `grep -n "dueAnchors" app/src/services/concept-feed.service.ts` | 2 occurrences (unchanged) | NO REGRESSION |
| Phase 33: allExplored cap-gate at refillQueue | `grep -n "allExplored && postQueueService.getTotalGenerated" app/src/services/concept-feed.service.ts` | 1 occurrence (unchanged) | NO REGRESSION |
| Phase 35: USER_ACK_BEFORE_GRAPH_CONTEXT byte-stable system prompt | `grep -n "USER_ACK_BEFORE_GRAPH_CONTEXT" app/src/state/useQuestions.ts` | 3 occurrences: 1 const declaration + 2 refs in Pass 1/Pass 2 (unchanged) | NO REGRESSION |
| Phase 36 GAP-1+2: appendToDerivedList + walkDerivedList wired into refillQueue | `grep -n "appendToDerivedList\|walkDerivedList" app/src/services/concept-feed.service.ts` | unchanged | NO REGRESSION |
| Phase 36 GAP-4: spreadByConcept BEFORE spreadByStyle in mixer | unchanged | unchanged | NO REGRESSION |
| Phase 36 GAP-A (round-1 36-06): HomeScreen warm-start guard `if (posts.length > 0)` + `!warmStartHadPostsRef.current` | unchanged | unchanged | NO REGRESSION |
| Phase 36 GAP-B (round-1 36-07): walkDerivedList `Math.max(count * 2, len)` termination guard | unchanged | unchanged | NO REGRESSION |
| Phase 36 GAP-C (round-1 36-08): Detector D postMessage + enablejsapi=1 + short tap-emit | unchanged | unchanged | NO REGRESSION |
| All 70 Phase 36 round-1 quick-suite tests still GREEN | `node --test [11 test files]` | tests=81, pass=81, fail=0 (70 prior + 11 new) | NO REGRESSION (additive only) |

All 13 original must-haves + 14 round-1 must-haves remain VERIFIED. Round-2 additions are strictly additive — they introduce a new localStorage key, a new test file (post-queue-yesterday-snapshot.test.mjs), a new dev-gated SettingRow, and a new test file (SettingsDataScreen.force-new-day.test.mjs). Updates to existing post-queue.test.mjs (3 cases, lines 147-179) re-aligned to the new getYesterdayQueue contract — the original behavior under test was the bug being fixed; the contract update is the intentional outcome of GAP-D Fix A.

---

_Verified: 2026-05-06T18:00:00Z (round 1) → extended 2026-05-07T07:30:00Z (round 2)_
_Verifier: Claude (gsd-verifier)_
