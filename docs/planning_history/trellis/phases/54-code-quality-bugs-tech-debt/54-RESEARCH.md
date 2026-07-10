# Phase 54: Code Quality, Bugs & Tech Debt - Research

**Researched:** 2026-05-20
**Domain:** Codebase cleanup, bug fixes, test suite hygiene — React 19 + TypeScript 5.9 + Vite 7 + Capacitor 8
**Confidence:** HIGH (all findings verified against live code; test suite and tsc confirmed)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use a **severity × reach matrix**. Inventory all accumulated v1.4–v1.6 tech debt into a prioritized list, score each item on severity × reach, and resolve the top tier **regardless of theme**. This is the most thorough option.
- **D-02:** Items below the top tier are kept in the inventory and **formally re-accepted with a documented rationale** rather than fixed now. The inventory itself is a deliverable.
- **D-03:** CONCERNS.md candidate debt includes: hybrid SQLite/localStorage (data-drift risk), heavy service mocking (masks real issues), CapacitorHttp streaming fragility on Android, theme-transition coordination, SQLite encoding/serialization, web localStorage quota. Storage-key drift (`echolearn_*` vs `trellis_*` in older debug writeups) worth scoring too.
- **D-04:** **Whole-codebase sweep** for logic errors, edge cases, and race conditions — services + screens + hooks.
- **D-05:** Confirmed bugs are fixed and covered by tests where practical.
- **D-06:** Both debug sessions are already root-caused; implement the fixes per their writeups, then move both files to `.planning/debug/resolved/`.
  - `vine-chip-not-clearing-after-force-new-day` (status: diagnosed): fix = add `setExploredAnchors(dailyReadService.getExploredAnchors())` and `creditAwardedRef.current = dailyReadService.isCreditAwarded()` to HomeScreen's `[location.pathname] === '/home'` resync effect.
  - `feed-not-auto-populating-after-force-new-day` (status: investigating): fix = make `handleForceNewDay` mutate `trellis_daily_posts` date symmetrically with `trellis_post_queue`.
- **D-07:** Device-verified by the operator on 2026-05-20 — auto-gen podcast is working. QUALITY-03 is SATISFIED. No fix work, no diagnostics affordance needed. Close the related todo.
- **D-08:** Fix stale tests to assert the current correct contract; re-accept only where the gap is intentional. Goal: full suite + `tsc` green.

### Claude's Discretion

- Exact severity × reach scoring rubric (scale, weights) and inventory format/location.
- How deep the whole-codebase sweep goes per file before diminishing returns — bounded by the matrix.
- Whether a fixed bug warrants a new regression test (default: yes where practical).

### Deferred Ideas (OUT OF SCOPE)

- Numeric threshold / cosine tuning and filter/recommendation/feed-randomizer/"like" mechanism tuning → **Phase 55** (TUNE-01/02).
- UI polish, animations, navigation audit, doc archiving, CLAUDE.md drift correction → **Phase 56**.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUALITY-01 | Codebase audited for bugs (logic errors, edge cases, race conditions); confirmed bugs fixed | Bug audit findings in §Common Pitfalls + §Bug-Audit Surfaces; test strategy in §Validation Architecture |
| QUALITY-02 | Carried-over debug sessions resolved (`feed-not-auto-populating-after-force-new-day`, `vine-chip-not-clearing-after-force-new-day`) | §Debug Sessions: Current Status confirms BOTH fixes are already in production code — writeups need to be moved to `resolved/` |
| QUALITY-03 | Auto-generated podcast verified working on device and any defects fixed | §Debug Sessions: D-07 disposition — operator confirmed working 2026-05-20; close the todo |
| TECHDEBT-13 | Accumulated v1.4–v1.6 tech debt inventoried, prioritized, high-priority items resolved | §Tech Debt Inventory provides the raw candidate list for scoring |
| TECHDEBT-14 | Known-deferred test failures resolved or formally re-accepted; full suite + tsc green | §Test Suite & Type Check Baseline: confirmed 1,471 + 149 = 1,620 tests passing, 0 failures, tsc clean |

</phase_requirements>

---

## Summary

This is a cleanup/hardening phase with no new features. The most important finding from codebase investigation is that **both QUALITY-02 debug fixes are already implemented in the live codebase** — the debug writeup files still say "investigating" / "diagnosed" but the code patches landed during v1.5 (Phase 36-14 and Phase 36-15). The main tasks for QUALITY-02 are to verify the fixes are correct and complete, write any missing regression tests, and move the writeup files to `debug/resolved/`.

The test suite is fully green with **1,471 main tests + 149 action tests passing, 0 failures, 0 skipped**. `tsc -b --noEmit` is also clean with zero errors. The stale `buildFallbackPosts` test that was the canonical example of TECHDEBT-14 has already been fixed — `concept-feed.test.mjs` was updated to not import the removed builder. The TECHDEBT-14 task is essentially: confirm no new stale tests have accumulated, fix any lint warnings that are worth addressing (28 warnings identified), and formally document the intentionally-accepted gaps.

The tech debt inventory work (TECHDEBT-13) is the deepest open task. Raw material is available from CONCERNS.md, the Phase 45 dead-code sweep, and the audit below. The planner should create a scored severity × reach inventory document, then make fix decisions from the top of that list.

**Primary recommendation:** Wave 0 writes the scored tech-debt inventory (this is a deliverable per D-02). QUALITY-02 fixes are a source verification + `debug/resolved/` file moves. QUALITY-03 is a todo close. TECHDEBT-14 is a lint/test sweep. QUALITY-01 (bug audit) is the most open-ended work — the planner should allocate the most time there.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Force-New-Day vine-chip resync | Frontend (HomeScreen state) | Service (dailyReadService) | Bug lives in React state being stale after `navigate()` — fixed by [location.pathname] resync effect |
| Force-New-Day feed repopulation | Settings handler (SettingsDataScreen) | Service (concept-feed, post-queue) | Bug was handleForceNewDay not mutating the daily-posts cache key — fixed by symmetric mutation |
| Auto-gen podcast scheduling | Foreground scheduler (scheduler.service.ts) | Service (podcast.service.ts) | 60s poll + appStateChange trigger; fires at most once/day per localStorage flag |
| localStorage quota | Service layer (multiple) | App layer (settings) | Each service owns its own key; post history has 7-day rolling purge via postHistoryService.purgeExpired() called from HomeScreen mount effect |
| Tech-debt scoring | Planning artifact (inventory doc) | Codebase audit | Severity × reach matrix is a deliverable, not a runtime concern |

---

## Debug Sessions: Current Status

### QUALITY-02 Bug A — vine-chip-not-clearing-after-force-new-day

**Status: ALREADY FIXED in live code** [VERIFIED: grep of HomeScreen.tsx:667-672]

The fix described in the debug writeup (`setExploredAnchors(dailyReadService.getExploredAnchors())` + `creditAwardedRef.current = dailyReadService.isCreditAwarded()` inside a `[location.pathname]` effect) is present at `app/src/screens/HomeScreen.tsx:667-672`:

```typescript
// Phase 36-14 — closes round-4 sub-issue (a).
useEffect(() => {
  if (location.pathname === '/home') {
    setExploredAnchors(dailyReadService.getExploredAnchors());
    creditAwardedRef.current = dailyReadService.isCreditAwarded();
  }
}, [location.pathname]);
```

A regression guard test exists at `app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` (3 assertions) — currently passing.

**Phase 54 task:** Verify the test still covers the fix accurately, then move `.planning/debug/vine-chip-not-clearing-after-force-new-day.md` to `.planning/debug/resolved/`.

### QUALITY-02 Bug B — feed-not-auto-populating-after-force-new-day

**Status: ALREADY FIXED in live code** [VERIFIED: grep of SettingsDataScreen.tsx:95-127]

The debug writeup says "investigating" and predicts the fix requires mutating `trellis_daily_posts`. That exact mutation was added at `app/src/screens/settings/SettingsDataScreen.tsx:118-127` (Phase 36-15):

```typescript
const dailyRaw = localStorage.getItem('trellis_daily_posts');
if (dailyRaw) {
  try {
    const dailyParsed = JSON.parse(dailyRaw);
    dailyParsed.date = yesterday;
    localStorage.setItem('trellis_daily_posts', JSON.stringify(dailyParsed));
  } catch {
    // Malformed cache — leave it; loadCache() will reject on parse failure anyway.
  }
}
```

A regression guard test exists at `app/tests/screens/SettingsDataScreen.force-new-day.test.mjs` (assertion: `localStorage.setItem('trellis_daily_posts', ...)` is present in the handler body) — currently passing.

**Phase 54 task:** Verify the fix is complete (confirm HomeScreen's `[location.pathname]` resync effect + the SettingsDataScreen patch together produce the expected behavior end-to-end), then move `.planning/debug/feed-not-auto-populating-after-force-new-day.md` to `.planning/debug/resolved/`. Update the debug file's `root_cause`, `fix`, and `verification` fields before moving.

### QUALITY-03 — Auto-gen podcast

**Status: CLOSED per D-07** [ASSUMED — operator device-verified 2026-05-20]

The todo at `.planning/todos/pending/2026-05-09-inspect-auto-gen-podcast-working-or-not-and-debug.md` should be moved to `.planning/todos/` done/archive. No code changes needed.

Scheduler wiring for reference: `App.tsx:336` calls `startScheduler()` on mount; `scheduler.service.ts` polls every 60s and on `appStateChange`, fires podcast generation when `settings.podcast.autoGenerate` is true and the current time is past `(sleepTime − advanceMinutes)`. The `trellis_scheduler_podcast_done` key gates one-per-day execution.

---

## Storage Key Audit — Current Live Names

[VERIFIED: grep of app/src/**/*.ts, *.tsx]

All localStorage keys use `trellis_*` prefix. The `echolearn_*` → `trellis_*` migration is handled by `app/src/services/legacy-migration.service.ts` (called in `main.tsx` on every boot, idempotent). The debug writeups reference legacy `echolearn_*` names from before the 2026-05-07 rename — this is the source of confusion. **The fixes must target the `trellis_*` keys**, which is what the code already does.

Key reference for Force-New-Day fixes:

| Service/Screen | Storage Key | Role in Force-New-Day |
|---|---|---|
| `post-queue.service.ts:11` | `trellis_post_queue` | Mutated by handleForceNewDay (date rolled to yesterday) |
| `post-queue.service.ts:20` | `trellis_post_queue_yesterday` | Written by `load()` on date-mismatch; read by `getYesterdayQueue()` |
| `concept-feed.service.ts:34` | `trellis_daily_posts` | Mutated by handleForceNewDay (date rolled to yesterday) — Phase 36-15 fix |
| `daily-read.service.ts:17` | `trellis_daily_read` | Reset by `dailyReadService.reset()` in handleForceNewDay |
| `engagement.service.ts:31` | `trellis_engagement_v1` | `resetDismissedOnly()` called by handleForceNewDay (preserves saves/likes) |

SQLite connection name `'echolearn'` is intentionally preserved for backwards compat (CLAUDE.md brand-history note).

---

## Test Suite & Type Check Baseline

[VERIFIED: npm test + tsc run 2026-05-20]

| Check | Result | Count |
|---|---|---|
| `npm run test:main` | PASS | 1,471 tests, 0 fail, 0 skip |
| `npm run test:actions` | PASS | 149 tests, 0 fail, 0 skip |
| `npx tsc -b --noEmit` | CLEAN | 0 errors |
| `npm run lint` | 28 warnings, 0 errors | — |

**The test suite is fully green.** TECHDEBT-14's canonical example (`buildFallbackPosts` stale test) was already resolved: `app/tests/concept-feed.test.mjs` was updated to remove the import of the deleted builder; the comment at the top of that file documents the history. Currently 2 tests in that file, both passing.

**No `test.skip`, `describe.skip`, or `.skip` calls exist** in any test file — grep confirms zero results.

**Zero `@ts-ignore` or `@ts-expect-error` directives** exist in `app/src/` — TypeScript suppression debt is clean.

### Single-test run syntax

```bash
# Run one test file (Node 26 has native .ts stripping — no loader needed for most tests)
cd app && node --test tests/screens/HomeScreen.exploredAnchors-resync.test.mjs

# Run tests requiring the actions mock loader (trellis-actions + graph-command-service tests)
cd app && node --import ./tests/services/_actions-mock-loader.mjs --test tests/services/trellis-heal.test.mjs
```

### Lint warnings catalog (28 total)

These are warnings, not errors. Phase 54 should assess severity:

| File | Line | Warning | Severity |
|---|---|---|---|
| `AnchorDetailScreen.tsx:101` | 101 | `useMemo` has unnecessary dep `tick` | LOW — `tick` is intentionally captured (see comment at line 43); lint false-positive |
| `CollectionDrillInScreen.tsx:320` | 320 | `useEffect` missing dep `collection` | LOW — intentionally scoped to `collection?.name` only |
| `HomeScreen.tsx:337` | 337 | `console.info` in loadNextBatch | MEDIUM — diagnostic log, harmless but adds noise in prod |
| `HomeScreen.tsx:591` | 591 | `useMemo` unnecessary dep `questions` | LOW — intentional for performance |
| `PodcastScreen.tsx:102` | 102 | Unused `eslint-disable` for `no-unused-vars` | LOW — stale suppression, safe to remove |
| `PostDetailScreen.tsx:274,520` | 274, 520 | `useEffect` missing dep `post` / `post.sourceType` | LOW — intentionally scoped to `post?.id` to avoid excessive re-runs |
| `SavedScreen.tsx:700` | 700 | `useMemo` unnecessary deps `collections` and `savedPosts` | LOW — intentional |
| `canonical-knowledge.service.ts:759` | 759 | `console.debug` in pre-check hit | LOW — DEV-only gated |
| `concept-feed.service.ts` | 568,952,994,1458,1481,1500 | `console.info` diagnostic logs | MEDIUM — useful for debugging refill pipeline; consider whether prod should silence |
| `imageGeneration.service.ts` | 159, 209 | `console.info` success log | LOW — useful, DEV-gated at 159 |
| `scheduler.native.ts` | 106, 111 | `console.log` notifications | MEDIUM — should be `console.info` |
| `scheduler.service.ts` | 76,84,113,137,172,178,190 | `console.log` scheduler lifecycle | MEDIUM — diagnostic, useful but violates `no-console` rule (only `warn`/`error` allowed) |
| `style-assignment.ts:117` | 117 | `console.info` style counts | LOW — diagnostic |
| `trajectoryAnalyzer.service.ts:127` | 127 | `console.debug` weak areas | LOW — planner debug |

**Recommendation for Phase 54:** Convert scheduler.service.ts `console.log` → `console.info` (they're lifecycle events, not debug noise) — this removes the majority of lint warnings in one targeted edit. Or convert to `console.warn`. Check the ESLint config to see if `console.info` is allowed.

---

## Tech Debt Inventory (Raw Material for D-01 Scoring)

The planner should create a scored artifact (e.g., `54-TECH-DEBT-INVENTORY.md`) from this raw material. Severity = impact if it causes a bug (1-5). Reach = how many users/flows are affected (1-5). Score = S × R. Items ≥12 should be resolved this phase; items 6–11 re-accepted with rationale; items ≤5 noted only.

### From CONCERNS.md (D-03 candidates)

| Item | Source | Nature | Severity est. | Reach est. |
|---|---|---|---|---|
| Hybrid SQLite/localStorage dual-backend | CONCERNS.md | Data drift risk if one store updates but not the other; no sync layer | 3 | 4 |
| Heavy service mocking | CONCERNS.md | Mocks can mask real-world performance/data issues; tests pass but device fails | 2 | 3 |
| CapacitorHttp streaming fragility on Android | CONCERNS.md | LLM streaming must fall back to native `fetch`; comment at `providers/llm/index.ts:183` acknowledges this | 3 | 3 |
| Theme-transition coordination (OS↔React↔CSS vars) | CONCERNS.md | `appStateChange` handler in `App.tsx:357` re-applies theme; matchMedia doesn't fire on Capacitor resume | 2 | 2 |
| SQLite encoding/serialization | CONCERNS.md | Non-text data must be explicitly serialized; `db.service.ts` uses JSON blobs stored as TEXT | 2 | 2 |
| localStorage quota | CONCERNS.md | `trellis_post_history` grows unbounded until `purgeExpired()` runs at HomeScreen mount; quota exceeded errors silently swallowed | 3 | 3 |
| Storage-key naming drift in debug docs | D-03/CONTEXT.md | Debug writeups reference `echolearn_*`; live code uses `trellis_*`; migration service handles runtime but docs mislead | 1 | 2 |

### From Phase 45 Dead-Code Sweep (deferred-needs-domain-review)

[VERIFIED: 45-DEAD-CODE-SWEEP.md + current grep of app/src]

| Symbol | File | Current call sites | Phase 54 recommendation |
|---|---|---|---|
| `recordFeedView` | `trajectoryAnalyzer.service.ts:63` | 1 (declaration only — no live call site) | Review: either wire to a call site or delete |
| `replaceBlossomDates` | `trellis-blossom-dates.service.ts:42` | 1 (declaration only) | Low-risk: test/reset seam; re-accept with rationale |
| `recordStructuralSignalPatch` | `canonical-knowledge.service.ts:1285` | 1 (declaration only) | Review: if no live call site after v1.6, delete |
| `hasReorgBackup` | `canonical-knowledge.service.ts:1558` | 1 (declaration only) | Safety-related rollback; re-accept or add call site |
| `revertReorganization` | `canonical-knowledge.service.ts:1562` | 1 (declaration only) | Same as above; re-accept or add call site |
| `getMoveDestination` | `lib/moveNavigator.ts:195` | 1 (declaration only — no call site found in src or tests) | Review: likely dead since planner-state refactor |
| `usePlanner` | `state/usePlanner.ts` | 0 call sites (marked `@deprecated` Phase 26 D-22) | Safe to delete — declared dead explicitly |
| `useTodayQuestions` | `state/useQuestions.ts:416` | 1 (declaration only) | Review: plausible public API seam; re-accept or delete |
| `ConnectionPostScreen` | `screens/ConnectionPostScreen.tsx` | Not wired into App.tsx routes | Strong deletion candidate — not routed |
| `nanoBananaProvider` | `providers/nanoBanana.provider.ts:181` | 1 (declaration only) | Provider singleton; integration-adjacent; re-accept |
| `hapticImpactMedium` | `lib/haptics.ts:24` | 2 call sites in `GraphScreen.tsx:1153,1170` | LIVE — not dead |
| `cancelNativeNotifications` | `scheduler.native.ts:122` | 1 (declaration only) | Platform bridge; re-accept or wire to a teardown |
| `InlineInfoFlow` | `components/InfoFlow.tsx` | Preserved export only; no HomeScreen wiring | Re-accept: explicit compatibility export per Phase 42 decision |

### New debt introduced in v1.6 phases

| Item | Source | Nature |
|---|---|---|
| `console.log` in scheduler.service.ts (8 instances) | ESLint audit | Violates no-console rule; should be `console.info`/`console.warn` |
| Stale `eslint-disable` at `PodcastScreen.tsx:102` | ESLint `--report-unused` | `@typescript-eslint/no-unused-vars` suppression no longer needed; safe to remove |
| Large background image (4.5 MB) in build | Phase 45 perf audit | `trellis-bg-default.png` at `app/src/assets/planner-trellis/trellis-bg-default.png` bloats the Capacitor bundle; P2 |
| 1.29 MB `index.js` chunk | Phase 45 perf audit | No code-splitting applied; dynamic import warnings; P2 for web, less critical for Capacitor where assets are local |
| Missing call sites for `recordFeedView` | trajectoryAnalyzer | Trajectory analytics service exports a function that is never called — analytics pipeline is incomplete or abandoned |

### Architecture / Design debt (lower priority)

| Item | Nature | Risk |
|---|---|---|
| `postHistoryService.purgeExpired()` called only at HomeScreen mount | If user never visits HomeScreen, history grows unbounded | LOW — user always starts at /home |
| `dailyReadService` fully stateless (localStorage read on every call) | Correct design but O(N reads) per session for explored anchors | LOW — typical N < 20 per day |
| `_state` in `post-queue.service.ts` is module-level mutable singleton | Async callers could race on `_state.posts.splice()` — but JS is single-threaded so no true race | LOW — JS event loop prevents interleaving |
| `generateMorePosts` awaits `refillQueue` when queue is empty, then immediately dequeues | If refill produces 0 posts (e.g., all concepts explored, cap hit), user sees empty swipe | MEDIUM — guarded by `allExplored` cap logic but edge case if anchors=0 |
| API keys stored in localStorage (plain JSON, `trellis_settings`) | No Capacitor SecureStorage — key exposure risk if WebView storage is accessible | MEDIUM — noted in CONCERNS.md security section; accepted scope for local-first |

---

## Bug-Audit Surfaces

High-risk surfaces for QUALITY-01 logic/edge/race sweep (D-04). Research identifies these as the highest-value targets; the planner should allocate dedicated audit tasks for each cluster.

### Cluster 1: concept-feed pipeline (HIGHEST RISK)

`app/src/services/concept-feed.service.ts` (2,148 lines) + `post-queue.service.ts` (433 lines)

- **Edge: anchors.length === 0 before first question is asked** — `buildConceptBatch` returns `[]`, `refillQueue` returns early, `getDailyPosts` returns empty. HomeScreen shows error state. Test that `generationError` is NOT set when `questions.length === 0` (first-time user — no API key error, just empty).
- **Edge: `generateMorePosts` when `allExplored` is true and `bonusCap` is 0** — returns `[]` immediately; infinite-scroll shows no-more-posts. Trace the cap gate at line 1702.
- **Race: `refillQueue` called concurrently from `getDailyPosts` + `generateMorePosts`** — mutex at `_refillMutex` handles this correctly per tests, but verify `getInFlight()` is never permanently set after an error (try/finally clears it — correct).
- **Edge: `dequeue(8)` when `_state.posts.length < 8`** — returns partial array. Check that loadNextBatch handles this without showing a stale "no more posts" toast.
- **Walker: `walkDerivedList` with `len=0`** — `maxSteps = Math.max(count * 2, len) = Math.max(16, 0) = 16`; loop runs 16 steps on empty list, returns `[]`. Correct but worth verifying the empty-array return doesn't trigger a false error.

### Cluster 2: Always-mounted screen resync (MEDIUM RISK)

CLAUDE.md documents this as a recurring bug class. HomeScreen has two `[location.pathname]` resync effects (Phase 36-14 + Phase 43-06). Check that all state that can change while off-screen is covered:

- `exploredAnchors` — covered by Phase 36-14 effect ✓
- `creditAwardedRef` — covered by Phase 36-14 effect ✓
- `dailyPosts` — covered by Phase 36-14 effect (tier1/tier2 re-read) ✓
- `engagementVersion` — covered by Phase 43-06 effect ✓
- `trellisCreditsService.getTotal()` for harvest credit display — **check: is this re-read on navigation?**
- `suggestedMoveCount` (planner) — refreshed inside the `[questions, questionsLoading]` effect only; may be stale after navigating away and back if planner updates while off-screen

### Cluster 3: dailyReadService / vine state (MEDIUM RISK)

- `getConceptQuota` returns the count of anchor nodes up to `MAX_CONCEPT_QUOTA` — verify what happens when `questions` array is empty (returns 0 quota, which suppresses vine display). Is this the intended behavior for first-time users?
- `isCreditAwarded()` reads localStorage on every call — no caching, correct for freshness. But `creditAwardedRef` in HomeScreen is a `useRef` that only re-reads on navigation to `/home`. If a user earns credit and then immediately navigates away and back without a new CONCEPT_EXPLORED event, is `creditAwardedRef` re-read? **Yes — the Phase 36-14 effect re-reads it on every `/home` navigation.** Correct.

### Cluster 4: question-filter dual-vector (MEDIUM RISK)

`app/src/services/question-filter.service.ts` (304 lines)

- **D-19 AbortSignal** — checked before each `await` in `layer2Embedding`. Verify that a pre-aborted signal is handled correctly at the first `await embedText(content, embConfig)` call (line 173). Test exists: `filter-classifier.unit.test.mjs` Test D-19.
- **`hasPriorAnswer` aliasing** — when `priorAnswer` is empty, `contextVec = rawVec` (no duplicate embedText call). Verify this aliasing is correct: `rawVec` is assigned first, then `contextVec = hasPriorAnswer ? await embedText(...) : rawVec`. Correct — the cost optimization works.
- **Edge: all corpus embeddings are null** (corpus uninitialized) — `loadCorpusEmbeddings` returns `[]`; cosine comparison finds no match; defaults to `on-topic`. Correct per D-12 graceful degradation.

### Cluster 5: classification pre-check (LOWER RISK)

`canonical-knowledge.service.ts` — `classifyAndAnchorIncremental` embedding pre-check at `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD = 0.82`. Tests in `classification-dedup.test.mjs` cover this. Audit focus: verify that `backfillAnchorEmbeddings` does not interfere with classification correctness when the store has no embeddings yet (first install).

### Cluster 6: scheduler + podcast auto-gen (LOWER RISK — confirmed working)

Per D-07, auto-gen is device-verified working. Light audit to confirm:
- `trellis_scheduler_podcast_done` key is cleared on date-mismatch (confirm it's a daily flag, not permanent)
- `generatePodcast` error is caught and does not crash the scheduler loop

---

## Architecture Patterns

### Standard Source-Reading Test Pattern

All Phase 54 regression tests should follow the existing pattern (no React render harness needed for source-level invariants):

```javascript
// app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs (canonical example)
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME_PATH = resolve(__dirname, '../../src/screens/HomeScreen.tsx');
const source = readFileSync(HOME_PATH, 'utf-8');

describe('...', () => {
  it('...', () => {
    assert.match(source, /pattern/);
  });
});
```

### Runtime Service Test Pattern

For tests that exercise service logic (not source reading):

```javascript
// Node 26 has native .ts stripping — import .ts files directly
import { postQueueService } from '../src/services/post-queue.service.ts';
// localStorage mock needed — use globalThis.localStorage = { ... }
```

### Tech Debt Inventory Format

For the TECHDEBT-13 deliverable, use a scored table:

```markdown
| # | Item | File(s) | Severity (1-5) | Reach (1-5) | Score | Decision |
|---|------|---------|----------------|-------------|-------|----------|
| T1 | ... | ... | 4 | 4 | 16 | FIX |
| T2 | ... | ... | 2 | 3 | 6 | RE-ACCEPT: rationale |
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| New event for dailyReadService reset | Custom `DAILY_READ_RESET` event | Extend existing `[location.pathname]` resync pattern | CLAUDE.md: "One signal per semantic event"; adding events fragments subscribers |
| localStorage mutex for quota errors | Custom write-guard | Silent catch + `console.warn` (existing pattern) | localStorage quota errors are exceptional on mobile; quota guard adds complexity for rare case |
| Custom test runner | Hand-rolled test framework | `node:test` + `node:assert/strict` | Already established; 227 test files using it |

---

## Common Pitfalls

### Pitfall 1: Touching a debug writeup before confirming live code is correct

**What goes wrong:** The debug file says "fix not yet applied" but the code already has the fix. A developer reads only the debug file, "applies" the fix again, and creates a regression.
**Why it happens:** Debug writeups are point-in-time documents; fixes land later without updating the writeup's `fix:` field.
**How to avoid:** Always grep the live source before writing any code for a debug fix. For both QUALITY-02 bugs: the fix is already in place.
**Warning signs:** Debug file `fix: (not applied — find_root_cause_only mode)` but the Phase 36-14/36-15 commit references appear in source comments.

### Pitfall 2: Breaking a load-bearing invariant while cleaning up

**What goes wrong:** "Cleanup" removes a comment, refactors a service, or changes a localStorage key name, inadvertently breaking a behavior that CLAUDE.md describes as load-bearing.
**Why it happens:** Load-bearing invariants are distributed across CLAUDE.md, inline comments, and test files. A developer might see "dead code" that is actually a compatibility shim.
**How to avoid:** Before deleting any symbol, check: (a) does a test assert its presence? (b) does CLAUDE.md mention it? (c) does it appear in `debug/resolved/` writeups as a known-important path?
**Warning signs:** Removing anything from `concept-feed.service.ts` that the feed pipeline section of CLAUDE.md describes.

### Pitfall 3: Fixing an eslint-disable without understanding why it exists

**What goes wrong:** Removing a `// eslint-disable-next-line react-hooks/exhaustive-deps` without reading the adjacent comment causes ESLint auto-fix to add the missing dep, which introduces an infinite re-render or stale closure bug.
**Why it happens:** ESLint exhaustive-deps warnings are often intentionally suppressed for performance or correctness reasons (e.g., `post?.id` scope intentionality in PostDetailScreen).
**How to avoid:** For every disabled exhaustive-deps warning: read the surrounding 10 lines of context, understand WHY the dep is excluded, only remove the disable if the exclusion is actually wrong.
**Warning signs:** Calls to `setDailyPosts`, `setExploredAnchors`, `setSuggestedMoveCount` inside effects with deps other than `[]` or `[location.pathname]`.

### Pitfall 4: Misidentifying `usePlanner` deletion scope

**What goes wrong:** Deleting `usePlanner` without checking all downstream test imports breaks the `test:main` suite.
**Why it happens:** The hook is `@deprecated` with no live call sites in screens, but a test might import it for contract verification.
**How to avoid:** Run `grep -rn "usePlanner" app/src app/tests` before deleting. Currently: 1 hit (declaration only), no test imports.

### Pitfall 5: Over-reaching the scope boundary into Phase 55/56

**What goes wrong:** During the bug audit, a developer notices a cosine threshold that "seems wrong" and tunes it, or sees a UI spacing issue and fixes it, inadvertently doing Phase 55/56 work inside Phase 54.
**Why it happens:** Cleanup phases invite scope creep because "while I'm here..." is tempting.
**How to avoid:** Per CONTEXT.md deferred: threshold/mechanism tuning → Phase 55; UI polish/nav audit/doc archiving → Phase 56. If found during audit: log it, don't fix it.

---

## Code Examples

### Verified: How to add a state to an always-mounted screen's resync effect

```typescript
// Source: app/src/screens/HomeScreen.tsx:667-672
// Pattern: [location.pathname] resync for always-mounted SwipeTabContainer screens
useEffect(() => {
  if (location.pathname === '/home') {
    setExploredAnchors(dailyReadService.getExploredAnchors());
    creditAwardedRef.current = dailyReadService.isCreditAwarded();
  }
}, [location.pathname]);
```

Adding new state to resync: add a setter call inside the `if (location.pathname === '/home')` block. Never create a duplicate effect — extend the existing one.

### Verified: How handleForceNewDay mutates both date-stamped keys

```typescript
// Source: app/src/screens/settings/SettingsDataScreen.tsx:80-127
// Both trellis_post_queue AND trellis_daily_posts must have date rolled to yesterday
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
// Patch post queue:
parsed.date = yesterday;
localStorage.setItem('trellis_post_queue', JSON.stringify(parsed));
postQueueService.loadQueue();
// Patch daily posts cache (Phase 36-15 — symmetric mutation):
const dailyParsed = JSON.parse(dailyRaw);
dailyParsed.date = yesterday;
localStorage.setItem('trellis_daily_posts', JSON.stringify(dailyParsed));
// Reset daily read + dismissed anchors:
dailyReadService.reset();
engagementService.resetDismissedOnly();
navigate('/home');
```

### Verified: Tech debt inventory format (from Phase 45 precedent)

```markdown
// Source: .planning/milestones/v1.5-phases/45-code-quality-sweep/45-DEAD-CODE-SWEEP.md
// Use the same evidence-first table format for TECHDEBT-13 deliverable
| Symbol | Location | Targeted evidence | Disposition | Rationale |
|---|---|---|---|---|
| usePlanner | state/usePlanner.ts:19 | grep finds 0 non-declaration call sites | deferred-needs-domain-review | ... |
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `buildFallbackPosts` used for fallback content | Removed; `postHistoryService.getPosts()` provides history fallback | Phase 36 (commit 72f4795c, 2026-04-03) | concept-feed.test.mjs no longer imports removed symbol |
| `echolearn_*` localStorage keys | `trellis_*` keys + `legacy-migration.service.ts` migration shim | Phase 36 (brand rename 2026-05-07) | Debug writeups reference old names but live code uses new names |
| Boolean `_queueRefillRunning` mutex | Promise-based `createPromiseMutex()` | Phase 36-12 | In-flight callers await the same Promise instead of bailing |
| `CONCEPT_EXPLORED` only trigger for exploredAnchors | `[location.pathname]` resync effect + `CONCEPT_EXPLORED` | Phase 36-14 | Fixes vine-chip staleness after Force-New-Day |
| Single contextualized vector for all filter labels | Dual-vector (raw for malicious, contextualized for off-topic) | Phase 47 UAT-5 | Prevents buried-payload jailbreak evasion |

**Deprecated/still present (safe to remove):**
- `usePlanner` hook (`state/usePlanner.ts`) — `@deprecated` since Phase 26 D-22; no call sites
- `ConnectionPostScreen` (`screens/ConnectionPostScreen.tsx`) — exported but not wired into App.tsx routes

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Operator device-verified auto-gen podcast working on 2026-05-20 (D-07) | Debug Sessions: QUALITY-03 | If podcast is not actually working, Phase 54 needs a fix task — but this is stated as a locked decision |

---

## Open Questions

1. **What is the intended fate of `recordFeedView` and the trajectory analytics service?**
   - What we know: `trajectoryAnalyzer.service.ts` exports `recordFeedView` and `recordStructuralSignalPatch`; neither has a live call site in `app/src`; the service itself has internal state (`SIGNAL_CACHE_KEY`, `FEED_VIEWS_KEY`)
   - What's unclear: Is this a partially-implemented future analytics feature, or is it abandoned dead code?
   - Recommendation: Confirm with operator. If abandoned, delete the service and its localStorage keys. If planned for Phase 55+ (recommendation signals), re-accept with that rationale.

2. **Should `console.log` in `scheduler.service.ts` become `console.info` or be silenced entirely?**
   - What we know: ESLint rule allows `warn` and `error` only. Scheduler logs are useful for debugging podcast trigger timing.
   - What's unclear: Whether the operator wants to preserve the diagnostic logs for device debugging.
   - Recommendation: Change `console.log` → `console.info` in `scheduler.service.ts` and `scheduler.native.ts` (8 + 2 calls). This resolves 10 of 28 lint warnings and preserves the diagnostic value — if the ESLint rule allows `info`. If `info` is also forbidden, downgrade to `console.warn`.

3. **Does `trellisCreditsService.getTotal()` need a resync on HomeScreen navigation?**
   - What we know: The Phase 57/58 rewards shop will need credit balance to stay in sync on always-mounted PlannerScreen/HomeScreen. CONTEXT.md for Phase 58 mentions `CREDITS_CHANGED` + `[location.pathname]` resync.
   - What's unclear: Whether any current screen reads credits and shows stale values.
   - Recommendation: Out of scope for Phase 54 (no rewards UI yet). Note as a Phase 57/58 invariant — the pattern is already established.

---

## Environment Availability

Step 2.6: Environment audit for Phase 54 (code/config changes only).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `node --test` runner | ✓ | v26.0.0 (native .ts stripping) | — |
| TypeScript | `tsc -b --noEmit` | ✓ | ~5.9.3 | — |
| ESLint | `npm run lint` | ✓ | (in devDeps) | — |
| Vite | Build verification | ✓ | ^7.3.1 | — |

No external services required for this phase (no new features, no network calls in tests).

---

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (v26.0.0, native .ts stripping — no loader needed) |
| Config file | `app/package.json` scripts `test:main` + `test:actions` |
| Quick run command | `cd app && node --test tests/path/to/specific.test.mjs` |
| Full suite command | `cd app && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUALITY-02 (vine-chip) | HomeScreen re-reads `exploredAnchors` from `dailyReadService` on `/home` navigation | Source-reading | `cd app && node --test tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` | ✅ |
| QUALITY-02 (vine-chip) | HomeScreen re-reads `creditAwardedRef` from `dailyReadService.isCreditAwarded()` on `/home` navigation | Source-reading | (same file, Test 2) | ✅ |
| QUALITY-02 (feed) | `handleForceNewDay` mutates `trellis_daily_posts.date` symmetrically with `trellis_post_queue.date` | Source-reading | `cd app && node --test tests/screens/SettingsDataScreen.force-new-day.test.mjs` | ✅ |
| QUALITY-03 | Auto-gen podcast todo closed; no diagnostics build needed | Manual (operator verified) | N/A | Manual only |
| TECHDEBT-13 | Tech-debt inventory document exists with severity × reach scores | Artifact | `ls .planning/phases/54-code-quality-bugs-tech-debt/54-TECH-DEBT-INVENTORY.md` | ❌ Wave 0 |
| TECHDEBT-14 | Full test suite + tsc pass with 0 failures | Suite | `cd app && npm test` + `cd app && npx tsc -b --noEmit` | ✅ (baseline confirmed) |
| TECHDEBT-14 | No stale `test.skip` or disabled tests remain | Source-reading | `grep -rn "test\.skip\|describe\.skip" app/tests` → 0 results | ✅ |
| QUALITY-01 | Bug audit confirms `anchors.length === 0` path does not show error state | Unit | `cd app && node --test tests/screens/HomeScreen.empty-questions-no-error.test.mjs` | ❌ Wave 0 |
| QUALITY-01 | Bug audit confirms `generateMorePosts` with `allExplored=true` and `bonusCap=0` returns `[]` without crashing | Unit | `cd app && node --test tests/services/concept-feed-bonus-cap.test.mjs` | ❌ Wave 0 |
| QUALITY-01 (lint) | Lint warnings are resolved or formally re-accepted | Source + lint | `cd app && npm run lint 2>&1 | grep "problems"` → 0 errors | ✅ (0 errors; warnings addressable) |

### Sampling Rate

- **Per task commit:** `cd app && npm test` (full suite, 1620 tests, ~35s)
- **Per wave merge:** Full suite + `tsc -b --noEmit` + `npm run lint`
- **Phase gate:** Full suite green + tsc clean + lint 0 errors before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/phases/54-TECH-DEBT-INVENTORY.md` — the inventory document is a deliverable (TECHDEBT-13); create in Wave 0 as a scored table. Not a test file — an artifact.
- [ ] `tests/screens/HomeScreen.empty-questions-no-error.test.mjs` — covers QUALITY-01 edge case: `questions.length === 0` + feed empty should NOT set `generationError = true`
- [ ] `tests/services/concept-feed-bonus-cap.test.mjs` — covers QUALITY-01 edge case: `generateMorePosts` when `allExplored=true` and `bonusCap=0` returns `[]` cleanly

*(Existing `HomeScreen.exploredAnchors-resync.test.mjs` and `SettingsDataScreen.force-new-day.test.mjs` already cover QUALITY-02; no new test files needed for those.)*

---

## Security Domain

> `security_enforcement` not explicitly set to `false` in config.json — section required.

This phase makes no changes to auth, session management, or cryptography. The relevant ASVS concern for cleanup phases is input validation consistency.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth layer changes |
| V3 Session Management | No | No session changes |
| V4 Access Control | No | No ACL changes |
| V5 Input Validation | Partial | The `normalizeAnchorName()` guard in `canonical-knowledge.service.ts` must remain on all classification paths — do not bypass during cleanup |
| V6 Cryptography | No | API keys in localStorage is existing accepted scope |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Accidentally removing the dual-vector filter during cleanup | Tampering | `tests/services/filter-classifier.unit.test.mjs` Test 18d asserts malicious scoring uses raw vector — do not regress |
| Removing `normalizeAnchorName()` from classification paths | Tampering | `canonical-knowledge.service.ts` guard is load-bearing per CLAUDE.md — never bypass |

---

## Sources

### Primary (HIGH confidence — verified by live code inspection)

- `app/src/screens/HomeScreen.tsx` — vine-chip resync effect at lines 667-672; feed resync at 275-306; purgeExpired call at 382
- `app/src/screens/settings/SettingsDataScreen.tsx` — handleForceNewDay at lines 78-149; trellis_daily_posts mutation at 118-127
- `app/src/services/daily-read.service.ts` — stateless design; reset() synchronous write; STORAGE_KEY at line 17
- `app/src/services/post-queue.service.ts` — STORAGE_KEY `trellis_post_queue` at line 11; STORAGE_KEY_YESTERDAY at line 20; dequeue() at line 234
- `app/src/services/concept-feed.service.ts` — STORAGE_KEY `trellis_daily_posts` at line 34; loadCache() date-rejection; refill mutex at 1256
- `app/src/services/legacy-migration.service.ts` — echolearn_* → trellis_* migration logic
- `app/tests/` — 227 test files; 0 skip/fail confirmed by `npm test` run
- `app/package.json` — test commands; Node 26 native .ts stripping
- `.planning/milestones/v1.5-phases/45-code-quality-sweep/45-DEAD-CODE-SWEEP.md` — deferred symbol inventory

### Secondary (MEDIUM confidence)

- `.planning/debug/vine-chip-not-clearing-after-force-new-day.md` — root cause diagnosis (correct but fix already shipped)
- `.planning/debug/feed-not-auto-populating-after-force-new-day.md` — hypothesis writeup (fix already shipped)
- `.planning/milestones/v1.6-MILESTONE-AUDIT.md` — v1.6 tech debt reconciliation; confirmed clean
- `.planning/milestones/v1.5-MILESTONE-AUDIT.md` — v1.5 known deferred debt (buildFallbackPosts — resolved)

---

## Metadata

**Confidence breakdown:**
- QUALITY-02 debug sessions: HIGH — live code confirmed both fixes present; existing passing tests
- TECHDEBT-14 test suite: HIGH — `npm test` run confirmed 1,620 passing, 0 failing
- TECHDEBT-13 inventory: MEDIUM — raw material comprehensive but severity/reach scores need operator input
- QUALITY-01 bug audit: MEDIUM — highest-risk surfaces identified; actual bugs require code-read audit in planning

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (stable codebase; no fast-moving deps)
