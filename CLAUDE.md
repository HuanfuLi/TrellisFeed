# Trellis — Claude Instructions

Project root instructions for Claude Code agents working on this repository.

> **Brand history:** Renamed EchoLearn → Trellis on 2026-05-07. The on-disk directory and the `~/.claude/projects/-Users-Code-EchoLearn/` auto-memory path are intentionally preserved for backwards compatibility. Current durable app storage uses IndexedDB with `IDB_NAME = 'trellis'` in `db.service.ts`; current localStorage keys use the `trellis_*` prefix. All user-facing surfaces — app name, bundle-facing copy, and product docs — say Trellis.

## Project Overview

Trellis is an AI-powered personalized learning platform (React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4 + Capacitor 8). Local-first, privacy-preserving. Multi-provider LLM support (OpenAI, Claude, Gemini, local endpoints like LM Studio). See `.planning/PROJECT.md` for full vision.

**Working directory for the app:** `app/`

**Test framework:** Node.js built-in `node --test` with esbuild tsx loader — see `app/tests/canonical-knowledge.test.mjs` for the pattern. Phase 27 locale tests avoid the JSON-import-attribute failure chain by importing `i18next` directly; follow the same pattern for any new pure-logic helpers.

## Style Conventions

- **Inline styles with CSS variables** (NOT Tailwind classes for most UI)
- Key CSS vars: `--primary-40`, `--surface`, `--surface-variant`, `--muted-foreground`, `--radius-xl`, `--shadow-1/2/3`
- Services return `ServiceResult<T> = { success, data?, error? }`
- localStorage for all user preferences via `settingsService`
- Event bus (`src/lib/event-bus.ts`) for cross-screen notifications (LOCALE_CHANGED, REVIEW_COMPLETED, etc.)
- **Settings sub-page navigation:** SettingsScreen is a menu with 4 sub-pages at `/settings/{ai,content,features,data}`. Sub-screens live in `src/screens/settings/`. Shared components (SectionHeader, SettingRow, MaterialSwitch, SelectInput, TextInput with password reveal) in `settings/SettingsShared.tsx`. Each sub-screen reads from `settingsService.getSync()`. Header `backTo` prop renders a back-arrow.

---

## Agent Delegation Policy (operator preference — applies to every task)

Claude (Opus / Fable) is the **planner and reviewer**, not the primary implementer. Spend Claude tokens on planning, discussion, architecture, and judgment. Hand off bulk execution to the external CLI agents below via `Bash`, then review what comes back.

### Routing table

| Work type | Delegate to | Command | Why |
|---|---|---|---|
| Mass reads (codebase sweeps, docs, images), UI-SPEC generation, other frontend/reading tasks | **Antigravity** (Gemini 3.1 Pro) | `agy` | Strong at reading and frontend/visual work; weak reasoning |
| Complex coding, refactors, research, debugging | **Codex** (GPT) | `codex --yolo` | Strong reasoning and coding; weak UX logic and aesthetics |
| Planning, discussion, design decisions, final review | **Claude** (this agent) | — | Best overall judgment; keep tokens here |

### Hard rules

1. **Antigravity must NEVER mutate code.** Gemini models are unreliable at coding. Use `agy` for read-only analysis and document generation only. If a task requires edits, route it to Codex or do it yourself.
2. **Antigravity must use Gemini 3.1 Pro.** Never a Flash model (e.g. Gemini 3.5 Flash).
3. **Claude reviews everything either agent produces** before it lands. Codex writes correct-but-inelegant code and has poor UX instincts; Antigravity's prose and specs need a factual check.
4. **Avoid implementing directly in Claude** when a delegate can do it. Reserve Claude edits for small, load-bearing, or judgment-heavy changes (anything in the "load-bearing" sections of this file).

---

## Heavy stores live in IndexedDB — never touch the retired localStorage keys (load-bearing)

Phase 55 moved every heavy store to IndexedDB. The 13 legacy keys are listed in `LEGACY_HEAVY_KEYS` (`db.service.ts`) and **deleted at every boot** by `clearLegacyHeavyLocalStorageKeys()`, called from `App.tsx` after hydration. Any direct `localStorage` read of one returns null; any direct write is discarded on next launch.

The migration missed four services, which kept doing raw read-modify-write against `trellis_questions` and friends. Because `questionService` had switched to an in-memory mirror hydrated from IndexedDB, **every newly created anchor and cluster was silently dropped**, leaving each classified Q&A with a dangling `parentId`. Fixed 2026-07-08.

### Rules

1. **All question mutations go through `questionService`.** Use `insertNode()` for new anchor/cluster nodes and `replaceAll()` for bulk rebuilds (reorg reconcile / revert) — both write through to IndexedDB. Never write `trellis_questions` directly. `canonical-knowledge.service.ts` must not name that key at all; `tests/services/anchor-persistence.test.mjs` enforces this.
2. **Generated post bodies are costly assets.** `patchPostEssayInCache` persists via `conceptFeedService.patchPost` + `postHistoryService.patchPost` — both, unconditionally. Post-history is the only durable full-content store, and is what keeps a body openable from `/post-history`, `/saved`, `/liked` after the midnight daily-cache rejection.
3. **`concept-feed-dedup.ts` keeps zero transitive deps** (so `node --test` can import it without the i18n JSON-import chain). Its post-history backing store is *injected* via `setSeenVideoIdHistorySource` from `concept-feed.service.ts`. Don't import `postHistoryService` there.
4. **`planner.service.ts` must not reimplement post lookup.** It delegates to `conceptFeedService.findClosestPost` behind a lazy `import()` (concept-feed imports planner, so a static import would cycle).
5. **`LocalStorageBackend` and `IndexedDBBackend` must implement the same SQL subset.** They are the last-resort fallback and the real backend; a statement one handles and the other silently ignores is a live data bug.

### Testing this area

The Node suite is a **false-green risk here** — much of it reads source text rather than executing writes. In Node there is no `indexedDB`, so `db.service` falls back to `LocalStorageBackend`, a real backend behind the same `dbQuery`/`dbExecute` seam: assert durability *through `dbQuery`*, not through the in-memory mirror. See `tests/services/anchor-persistence.test.mjs`. A source-reading test that asserts a retired key is *present* actively pins the bug in place — three such tests did.

---

## Concept Feed Generation Pipeline (load-bearing — read before touching `concept-feed.service.ts` or `post-queue.service.ts`)

The home feed is driven by THREE LISTS in a strict pipeline. **Do not invent a fourth, do not collapse two into one, do not bypass any step.** Re-explained 5+ times — must not drift.

```
1. DAILY CONCEPT LIST  — anchor nodes (q.isAnchorNode === true) filtered by SM-2 due
                          dates. Same source consumed by flashcard + podcast services.
                          Updated when a new question creates a new anchor.
            │ derived from
            ▼
2. DERIVED LIST  — for each concept in (1): assign post style (image/text-art/video/
                   news/suggestion) AND multiplicity (more entries for important/
                   overdue concepts). APPEND-ONLY when new questions arrive (don't
                   rebuild — that loses cycle position). Implemented as
                   postQueueService.appendToDerivedList(ids[]) — dedups by conceptId.
                   Removal: when user READS a post (CONCEPT_EXPLORED event), concept
                   is added to dailyReadService.getExploredAnchors(). The walker
                   (postQueueService.walkDerivedList) LAZILY skips explored ids at
                   walk time; physical splice would corrupt cyclePosition.
            │ feeds
            ▼
3. QUEUE  — length 8, cyclic walker over the derived list. Maintains a CYCLE
            POSITION (index into derived list). User swipes for more → pops 4 →
            walker advances → refills toward 8. Wraps at end. Empty derived list
            (all read) → "No more posts" toast appropriate.
```

### Numeric defaults

- `MAX_QUEUE_SIZE` = **32** (`post-queue.service.ts`). Refill threshold = **24** (bumped from 16 on 2026-05-10 alongside masonry feed; gives 24-post runway so a single 8-pop swipe doesn't drop the queue below the threshold without triggering refill — pair with `walkDerivedList(24, ...)` in `concept-feed.service.ts:1275`). Walker batch size kept proportional so a single refill restores ~one swipe of headroom (8) on top of the threshold.
- Refill mutex: `createPromiseMutex()` from `app/src/services/refill-mutex.ts`. `concept-feed.service.ts` instantiates `_refillMutex` and wraps `refillQueue`'s body in `_refillMutex.run(...)`. In-flight callers await the same Promise instead of bailing; single LLM body per cycle. Mutex's `try/finally` clears the in-flight reference on BOTH success AND error so a failed refill cannot permanently lock subsequent callers. Tests at `tests/services/refill-mutex.test.mjs`.
- Posts served per swipe-for-more: **8** (bumped from 4 on 2026-05-10 — masonry feed half-width tiles consume twice as fast as the prior InlineInfoFlow single-column. `loadNextBatch` default `limit = 8`, `generateMorePosts` default `count = 8`, HomeScreen call site passes `8` explicitly).
- Style weights: `app/src/services/style-assignment.ts:9-16` (`STYLE_WEIGHTS`).
- Daily generation cap: `dailyGenerationCapMultiplier × max(anchors.length, 3)` — **gated by `allExplored`**. Cap only fires AFTER vine is finished; before that, generation is bounded by `buildConceptBatch` returning `[]` when all anchors explored. Rationale: local-first OSS (users provide own keys), unbounded pre-finished generation is not a cost concern. Revisit if a key-brokered commercial mode ships.
- Walker termination guard: `walkDerivedList`'s `maxSteps = Math.max(count * 2, len)` (`post-queue.service.ts:301`). The `count * 2` factor preserves lazy-skip headroom; the `len` floor preserves "at least one full pass possible" when `count < len`. **Do not regress to `len * 2`** — that was the Phase 36 GAP-B bug pinning text-art at 50% (floor) instead of 56% (floor + bonus at N=16). Tests at `tests/services/derived-list.test.mjs` (Test 11/12) + `tests/services/refill-queue-integration.test.mjs` (Test 7).
- Yesterday-queue snapshot: the durable snapshot is stored in IndexedDB under `SQLITE_ROW_ID_YESTERDAY = 'queue_yesterday'` in `post-queue.service.ts`, with `_yesterday` as the synchronous in-memory read mirror for `getYesterdayQueue()`. `hydrateQueueFromSQLite()` and `normalizeState()` populate that snapshot on date mismatch before today's queue is rehydrated. The old localStorage key `trellis_post_queue_yesterday` is legacy-only and appears in `db.service.ts` solely as a stale key to purge after IndexedDB hydration.
- **New-day rehydration:** `load()`'s date-mismatch branch in `post-queue.service.ts` snapshots yesterday's payload to `STORAGE_KEY_YESTERDAY` AND rehydrates today's `_state.posts` + `derivedList` + `cyclePosition` from `parsed.posts`. Yesterday's UNSERVED queue auto-populates today's feed. Counters reset to 0; `cycleNumber` inherits. After rehydration, `spreadByConcept` then `spreadByStyle` re-interleave to balance style mix. Symmetric counterpart in `concept-feed.service.ts`: `loadCache()` returns `null` when `cached.date !== today()` so yesterday's SERVED posts do NOT render across midnight.
- **Always-mounted screens must explicitly re-read service state on navigation.** HomeScreen, PlannerScreen, AskScreen, GraphScreen, SettingsScreen are always-mounted slots in `SwipeTabContainer`. `useState(() => svc.get())` initializers fire ONCE at app boot — never on `navigate('/home')`. Any screen reading from a service whose state can change while another screen is foreground (e.g., `dailyReadService` reset by Force-New-Day) MUST add a `useEffect` re-reading the service when its `location.pathname` matches the screen's route. HomeScreen.tsx has the canonical pattern: one effect re-syncs `dailyPosts` from `conceptFeedService.getCachedDailyPosts()` with fallback to `postQueueService.getYesterdayQueue()`; another sibling re-syncs `exploredAnchors` + `creditAwardedRef` from `dailyReadService`. Tests at `tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` and `HomeScreen.warm-start-refallback.test.mjs`. Related: when a dev affordance simulates a wall-clock event the service can't observe (e.g., Force-New-Day), the dev handler must call every service `reset()` AND mutate every date-stamped storage key the natural event would have triggered.

### Files

- `app/src/services/concept-feed.service.ts` — `buildConceptBatch`, `refillQueue`, `generateMorePosts`
- `app/src/services/post-queue.service.ts` — `_state.posts` is the queue; `derivedList` + `cyclePosition` persisted in QueueState
- `app/src/services/style-assignment.ts` — `assignStyles` weights
- `app/src/services/dailyRead.service.ts` — `getExploredAnchors` (consumed by VineProgress + walker lazy-skip)
- `app/src/hooks/useInfiniteScroll.ts` + `app/src/services/infiniteScroll.service.ts` — swipe-for-more entry point

### Closed gaps (don't reopen)

- Derived list is append-only with cycle position (Phase 36 GAP-1+2; tests at `derived-list.test.mjs`).
- Style sampling is stratified via largest-remainder + Fisher-Yates — guarantees ±1 of `round(N×weight)` per style (Phase 36 GAP-3; tests at `style-assignment-stratified.test.mjs`).
- Mixer runs `spreadByConcept` BEFORE `spreadByStyle` (Phase 36 GAP-4; tests at `spread-by-concept.test.mjs`).
- Removal-on-read wired: `buildConceptBatch` filters explored anchors AND walker lazy-skips them.
- Walker `maxSteps = Math.max(count * 2, len)` so `walkDerivedList(16, ...)` returns 16 even when `len=4` (Phase 36 GAP-B).

### Intentional design choices

- Each concept gets `BASE_ENTRIES_PER_CONCEPT` (4) entries, doubled to 8 if important (`easeFactor < 1.5` OR `leafState ∈ {dying, falling, dead}`). Importance changes mid-day are accepted as a next-day approximation — design says "append-only when new questions arrive," not "rebuild importance continuously."
- Queue serves variable count (whatever's available) instead of strictly 4 per swipe (out of scope for Phase 36).

### When in doubt

Derived list is **append-only** (grows on new question, shrinks on read). Queue is **cyclic** over that list. Queue serves **4 per swipe**. Implement what the design says.

___

## Video post completion signals (Phase 36 GAP-C → Phase 42 UAT-7+8 — load-bearing)

Video posts have explicit completion-signal detectors so the lazy-skip walker sees `CONCEPT_EXPLORED` events for video engagement. Without them, watching a video never increments vine progress and the walker re-suggests the same concept.

**Phase 42 UAT-7+8 (2026-05-09):** Inline-play removed from feed cards. The operator rejected the play-icon-in-center overlay ("blocking view") and asked for the inline-play feature to be removed entirely. Feed video tiles are now navigation-only — tap → PostDetailScreen, which owns the iframe AND Detector D. The thumbnail-tap inline-play emit was deleted. Detector D is now the SOLE feed-level video signal.

### Detector inventory (PostDetailScreen.tsx)

| Detector | Where | Trigger | Post types covered |
|----------|-------|---------|---------------------|
| A — scroll 70% sentinel | `PostDetailScreen.tsx:124-137` | IntersectionObserver fires on essay sentinel | text/image/news |
| B — 30s dwell timer | `PostDetailScreen.tsx:139-149` | setTimeout(30_000) on resolvedAnchorId | all post types reaching detail |
| C — Q&A follow-up | `PostDetailScreen.tsx:406-411` | handleAsk on user submit | all post types reaching detail |
| D — YouTube IFrame API postMessage | `PostDetailScreen.tsx` (after Detector B) | window 'message': `onStateChange info=0` (ENDED) OR `currentTime/duration >= 0.8` | video — engagement after navigate |

### Rules

1. **Don't remove `enablejsapi=1`** from YouTubeEmbed.tsx iframe srcs. Without it, IFrame Player API postMessage is closed and Detector D receives nothing. Source-of-truth check: `grep -c "enablejsapi=1" app/src/components/YouTubeEmbed.tsx` must return ≥1.
2. **Don't remove the origin allowlist** from Detector D (`event.origin` must be `youtube.com` or `youtube-nocookie.com`). Otherwise any iframe can spoof concept-explored signals.
3. **Don't re-introduce inline play in feed cards.** No `<iframe src="youtube.com/embed/...">` in `InfoFlow.tsx`, no `videoPlaying` state, no `dailyReadService.markExplored` or `CONCEPT_EXPLORED` emit. The operator rejected the inline-play UX. Enforced by `tests/components/InfoFlow.video-tap-emit.test.mjs` — every assertion is now a NEGATIVE invariant.
4. **Don't introduce new event types** for video completion. Reuse `CONCEPT_EXPLORED` (one signal per semantic event).
5. **Don't refactor PostDetailScreen.tsx's video render branch** to a native `<video>`. The current `YouTubeEmbed` is correct; the postMessage path is preferred over swapping renderers.
6. **Feed video card thumbnail aspect is `5/4` (landscape, wider-than-tall).** Operator-chosen over portrait crop, which would destroy vertical framing of 16:9 source thumbnails. `object-fit: cover` keeps the central subject vertically intact and crops ~40px each horizontal edge.

___

## Header positioning (Phase 32.1 — load-bearing, do not regress)

The `Header` component (`app/src/components/ui/Header.tsx`) auto-portals based on context:

- **Inside `SwipeTabContext`** (top-level swipe-tab screens: Settings, Planner, Graph, Ask) → renders **in-tree**, anchored to the slot's `transform: translateZ(0)` containing block (`SwipeTabContainer.tsx:245`). Each tab's header floats with its slot when off-screen.
- **Outside `SwipeTabContext`** (sub-screens via Outlet: PostDetail, settings sub-pages, Question/Anchor/Cluster detail) → renders via **`createPortal(headerNode, document.body)`**. Anchors to the viewport, immune to any ancestor's `transform`/`overflow`/`will-change`/`filter`/`contain`.

### Why this exists

`position: fixed` Headers inside `overflow: auto` ancestors flicker on Android Chromium WebView (fixed children become scroll-relative). Recurred multiple times: commits `8df7980c`, `a7203a65`, `2dcef5d7`, `73d657a0`, `b4965feb`, `808c6e85`. The portal-vs-in-tree split makes regression structurally impossible.

### Rules

1. **Don't add `transform`/`will-change`/`filter`/`contain`/`perspective`** to any ancestor of a `Header` in the React tree. In-tree Headers (top-level swipe screens) depend on the slot's translateZ(0) being the only containing-block creator.
2. **Don't render a Header inside a screen that's both always-mounted AND always-visible.** SwipeTabContainer slots are always-mounted but only ONE is visible at a time (others off-screen via translateX). New layouts where multiple Headers could be visible at once will stack.
3. **Don't move `Header.tsx` out of the portal-vs-in-tree pattern.** "Always in-tree" reintroduces sub-screen flicker; "always portal" makes top-level swipe Headers globally visible (operator-caught at `808c6e85`).

---

## ChatInput flex shrink (Phase 33 UAT-4 — load-bearing)

`app/src/components/ChatInput.tsx`: the `<input type="text">` MUST keep `minWidth: 0` alongside its `flex: 1` inline style. Without it, `flex-basis: auto` refuses to shrink the input below intrinsic content width on Android WebView, and the `flexShrink: 0` Send button overflows off-screen.

### Rules

1. **Never remove `minWidth: 0`** from the ChatInput input. `tests/components/ChatInput.flex-shrink.test.mjs` enforces this.
2. **Don't grow ChatInput buttons past their current 44px** without re-checking the overflow math.

---

## Root overflow clip — both axes (Phase 33 UAT-4 — load-bearing)

`html, body { overflow: hidden }` is load-bearing on BOTH axes. Body is never the right place for app scroll. Every screen owns its own `overflow: auto` scroll container.

**Why horizontal:** SwipeTabContainer strip is **500vw wide** (5 slots × 100vw). Without clip the document is horizontally scrollable. Android WebView keyboard-open on a focused input in an off-center slot triggers `scrollIntoView`, shifting `document.scrollLeft` — app drifts left, not recovered on close.

**Why vertical:** `body { min-height: 100vh }` uses `vh` which does NOT shrink with the keyboard (unlike `dvh`). Keyboard-open: SwipeTabContainer slots shrink (100dvh) but body stays at initial viewport height → body becomes vertically scrollable. That creates a second scroll container nested outside every screen's own `overflow: auto`, producing direction-change blocking on AskScreen + keyboard, and body scroll drags ChatInput off-screen behind the keyboard.

Three layers of defense:

1. **`html, body { overflow: hidden }`** in `app/src/index.css` — primary.
2. **`overflowX: 'hidden'`** on the App root div (`app/src/App.tsx`) — React-layer belt.
3. **`document.scrollingElement.scrollLeft = 0`** in `SwipeTabContainer.onFocusOut` — recovery path.

### Rules

1. Don't remove `html, body { overflow: hidden }` from index.css. `tests/layout/root-horizontal-clip.test.mjs` enforces all three layers.
2. Don't add a scrolling region outside SwipeTabContainer at the page root.
3. Don't remove `overflowX: 'hidden'` from the App root or the `scrollLeft = 0` reset in `onFocusOut`.
4. **Never rely on body scroll** — no `window.scrollTo`, `document.body.scrollTop`, etc. Use the screen's inner scroll container.

## SwipeTabContainer resize + keyboard (Phase 33 UAT-4 — load-bearing)

`app/src/components/SwipeTabContainer.tsx` owns the 5-wide horizontal strip's `translateX` (`stripX`). Two invariants:

1. **`resync()` gates on width change.** Reads `getScreenWidth()`, compares to `screenWidthRef.current`, **returns early if unchanged**. Height-only resize events (keyboard open/close) must be no-ops. Android WebView fires `visualViewport.resize` repeatedly during keyboard animations and `window.innerWidth` can transiently report pixel-ratio-adjusted values — unconditional re-snap drifts the active slot mid-animation.
2. **Focus-out forces a re-snap** (deferred one frame so the close-resize finishes first) AND resets `document.scrollingElement.scrollLeft`.

### Rules

1. Don't remove the `newWidth === screenWidthRef.current` early-return in `resync()`. `tests/components/SwipeTabContainer.resize-guard.test.mjs` enforces it.
2. Don't remove `onFocusOut` re-snap or scrollLeft reset.
3. **Don't install `@capacitor/keyboard` with `resize: 'none'`** as a workaround — users rely on default `adjustResize` so input scrolls above the keyboard. Fix layout bugs at the stripX level.

---

## Feed cold start — an empty feed is not an error (load-bearing)

`getDailyPosts()` returns `[]` on a cold start **by design**: today's queue is empty and `refillQueue` is still working in the background. A real refill can take **minutes** (measured at 144s against a local LM Studio endpoint — LLM + YouTube + Tavily, serially).

HomeScreen used to call that `[]` a failure and render *"Couldn't generate posts — check your API keys"* immediately, with a single 8s timer as its only recovery. A refill slower than 8s left the error on screen permanently, because `/home` is always-mounted and never remounts. Users with perfectly valid keys saw an API-key error. Fixed 2026-07-08.

`refillQueue` now emits **`FEED_REFILL_COMPLETED`** `{ added, error? }` exactly once per cycle that actually runs.

### Rules

1. **Never treat an empty `getDailyPosts()` result as an error.** It means "still refilling". Stay in the loading state and let `FEED_REFILL_COMPLETED` decide.
2. **Emit from inside the mutex body, in a `finally`.** Concurrent callers await the *same* in-flight Promise, so emitting outside `_refillMutex.run` fires once per caller. The `finally` covers the cycle's two "nothing to do" early returns (daily cap, empty concept batch) — without it a listener waits on a spinner forever.
3. **`attempted > 0 && generated === 0` is the only signal a broken API key produces.** `generatePostBatch` catches and logs per-branch LLM failures, so zero posts from a non-empty concept batch must be reported as `error`. `attempted === 0` (nothing to generate) is a normal empty state.
4. **The HomeScreen subscriber must no-op when the feed already has posts.** Refreshing a populated feed calls `getDailyPosts` → `refillQueue` → `FEED_REFILL_COMPLETED` again: an infinite loop.
5. Don't reintroduce a timer-based recovery. The event is the signal.

Tests: `tests/screens/HomeScreen.empty-questions-no-error.test.mjs`.

---

## Event bus — unified GRAPH_UPDATED (Phase 32.1)

There is **ONE event for graph mutations**: `GRAPH_UPDATED`. Used by `commitClassificationResult` (canonical-knowledge.service.ts), `trellisActionsService.replant`/`unpruneQuestion`, and any future code mutating anchors/clusters/questions.

Subscribers must use `GRAPH_UPDATED` only:
- `useTrellisData.ts` — recomputes trellis on graph mutations
- `useQuestions.ts` — reloads from store so HomeScreen/PlannerScreen pick up async-created anchors (load-bearing — without this, fresh-install home/planner stay empty after the first question)
- `PrunedSection.tsx` — refreshes pruned-archive list

### Don't reintroduce CLASSIFICATION_COMPLETED

Was a semantic duplicate of `GRAPH_UPDATED` — both fired at identical moments. Two events for one signal let subscribers desync from emitters. Deleted in `b2061554`. If you need a more specific signal in the future, **extend `GRAPH_UPDATED` with a payload field** (e.g., `{ kind: 'classification' | 'replant' | 'prune', anchorId?: string }`) instead of adding a parallel event.

---

## News post pipeline — defer body to on-open streaming (Phase 32.1)

News posts (`sourceType: 'news'`, `presentationStyle: 'news'`) follow a **two-phase content model**:

| Phase | Where | What | LLM? |
|---|---|---|---|
| Creation (refillQueue news branch) | `concept-feed.service.ts:892-925` | Tavily web-search + DailyPost shell with `bodyMarkdown: ''` | NO |
| Display (user opens post) | `post-essay.service.ts:133` `generateNewsEssay` | Stream a 150-250 word essay grounded in `sources[0].snippet` | YES — `chatStream` |

### Invariants (test-enforced at `tests/services/post-essay.service.test.mjs`)

The news creation block in `concept-feed.service.ts` MUST:
- Set `bodyMarkdown: ''` (an empty string literal — anything else makes `PostDetailScreen.tsx:237` skip the streamer)
- Populate `newsMeta.sources[0].snippet` with the Tavily content blob
- NOT call `chatCompletion` / `chatStream` eagerly
- NOT assign `result.content` to `bodyMarkdown` (the 2026-04-19 regression fixed at `3263af4e`)

### Don't recreate `news.service.ts`

Orphan deleted in `db918264`. All news post construction lives in `concept-feed.service.ts`'s news branch. Don't add a second path.

---

## Anchor name normalization (Phase 32.1 — guard at the data layer)

Mindmap design: `Knowledge → Branch (discipline) → Cluster (domain) → Concept Anchor (concept noun) → QAs`. Anchor titles MUST be **clean concept noun phrases**, not question paraphrases.

`canonical-knowledge.service.ts` enforces this at TWO layers:

1. **Prompt-side (best-effort):** `buildStepPrompt('anchor', ...)` adds GOOD/BAD examples constraint when LLM creates new anchors (`93162265`).
2. **Post-LLM guard (defensive):** `normalizeAnchorName()` runs in `commitClassificationResult` BEFORE any anchor lookup or persistence. Strips question prefixes (`what is`, `why does`, ...), trailing `and (why|how|...)` clauses, truncates to 3 words if still too long, title-cases (`b2061554`).

Examples: `"Spaced repetition and why does it work"` → `"Spaced Repetition"`; `"What is spaced repetition?"` → `"Spaced Repetition"`; `"How do transformers handle attention?"` → `"Transformers Handle Attention"`.

### Don't bypass the guard

Route any new classification path or anchor-creation site through `normalizeAnchorName()` before persistence. Both `classifyAndAnchor` and the incremental pipeline go through `commitClassificationResult` — keep it that way.

Anchors created BEFORE `b2061554` keep their old names. No migration — operator can manually rename or Clear-All-Data + re-classify.

---

## Classification dedup — embedding pre-check (Phase 33 UAT-4 — load-bearing)

The by-layer pipeline (step 1 branch → step 2 cluster → step 3 anchor) was an intentional token-saving pivot for large mindmaps. Structural flaw for cross-cutting concepts: the LLM commits to a branch at step 1 based on branch names only, before seeing which anchors exist elsewhere — duplicate anchors across branches.

Fix: **O(N_anchors) cosine pre-check BEFORE the tree descent** in `classifyAndAnchorIncremental`:

1. **Pre-check (structural):** Embed the question content. Compare against every existing anchor's `embeddingVector`. If cosine ≥ `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD` (0.82), reuse that anchor AND adopt its `branchLabel` + `clusterLabel`. Skip tree descent. **Zero LLM tokens on the match path.**
2. **Opportunistic backfill:** Anchors created before this feature have no `embeddingVector`. Backfill up to `ANCHOR_BACKFILL_PER_CLASSIFICATION` (8) per call — embed `anchor.title`, persist via `questionService.patchQuestion`.
3. **Normalize anchor lookup on BOTH sides** in `commitClassificationResult`. Both `result.anchorName` AND stored `q.title` go through `normalizeAnchorName`.
4. **Case-insensitive NEW coercion at step 1 + step 2.** If LLM returns `{"index":"NEW","name":"psychology"}` and "Psychology" already exists, coerce to selection.

### Rules

1. Don't remove the pre-check from `classifyAndAnchorIncremental`. `tests/services/classification-dedup.test.mjs` enforces it runs BEFORE `buildStepPrompt('branch')`.
2. Don't raise threshold above 0.95 or drop below 0.75 (same test enforces band).
3. Don't bypass `normalizeAnchorName` on either side of anchor lookup.
4. Don't remove LLM-NEW coercion guards at step 1/step 2.
5. Threshold tuning is empirical: lower to 0.78 if missed dedups; raise to 0.85 if wrong merges.

---

## Question filter — RAW-ARGMAX gate + dual-vector scoring (Phase 47 UAT-5 + Phase 55 — load-bearing)

`app/src/services/question-filter.service.ts:layer2Embedding` decides the label with a **scale-invariant RAW-ARGMAX rule** (Phase 55, replacing the old absolute off-topic/malicious thresholds — see `.planning/phases/55-algorithm-mechanism-tuning/55-FILTER-TUNING-REPORT.md`). It still embeds **two query vectors** (the Phase 47 dual-vector split — preserved and now load-bearing for the security property):

- **raw content vector** — `embedText(content)`, no prior-answer prefix.
- **contextualized vector** — `priorAnswer.slice(0, 240) + ' ' + content` (D-11). When `context.priorAnswer` is empty/undefined it aliases the raw vector (no extra embed on first-turn questions).

**Decision:**
- **Malicious gate (security-critical):** argmax over the **RAW** vectors only — malicious iff `rawMal ≥ floor && rawMal ≥ rawOff && rawMal ≥ rawOn`. Context never enters this comparison, so a benign preamble cannot dilute the malicious score (the structural buried-payload defense). The `floor` comes from `resolveMaliciousFloor`: a validated per-`(provider,model,dims)` table (`VALIDATED_MALICIOUS_FLOORS`) for tested models, else corpus auto-calibration clamped to `[MALICIOUS_FLOOR_MIN, MALICIOUS_FLOOR_MAX]` = `[0.35, 0.70]`.
- **Benign off/on split:** relative comparison on the **contextualized** vectors — off-topic iff `ctxOff − ctxOn ≥ OFF_TOPIC_MARGIN` (0.02), else on-topic (so unrelated/ambiguous/cross-lingual input defaults to on-topic, never flagged). Off-topic only flags; it carries no security weight.

### Why this exists

The original D-11 single-contextualized-vector design let a 240-char benign prefix drop a verbatim jailbreak's cosine from **0.977 (raw)** to **0.755 (contextualized)** — buried-payload evasion. The Phase 47 dual-vector fix scored malicious on the raw vector. Phase 55 then replaced the absolute thresholds (mis-calibrated per embedding model: 4% malicious recall on OpenAI-3-small@256 at 0.82) with RAW-ARGMAX, lifting malicious recall 41%→96% and accuracy to 96.5–98.8% across qwen3-8b + OpenAI configs, **while keeping buried-payload closed by construction** (the malicious gate compares only raw vectors). Validated cross-model; buried-03 (educational preamble + extraction payload) blocks on all three configs.

### Rules

1. **Never let context enter the malicious decision.** The malicious gate compares `rawMal/rawOff/rawOn` only — all from `embedText(content)`. `Test 18d` (benign 240-char preamble + verbatim mal-en-001 → `malicious`) and the golden buried-payload fixture are the load-bearing guards. Test 18a asserts the cold-cache embed order is `[rawQuery, contextualizedQuery, ...corpus]`.
2. **Don't reintroduce absolute off-topic/malicious cosine thresholds.** The whole Phase 55 point is scale-invariance. The only absolute number in the malicious path is the `floor`, and it must stay clamped to `[0.35, 0.70]` in `resolveMaliciousFloor` (debug override included) — this is the security minimum that replaced the old `[0.78, 0.85]` clamp.
3. **Don't drop the contextVec → rawVec aliasing** when no priorAnswer (avoids a duplicate embed).
4. **Tuning a new model:** add a measured floor to `VALIDATED_MALICIOUS_FLOORS` (use `app/scripts/tune-decision-rule.mjs`); untested models auto-calibrate. Never widen the `[0.35, 0.70]` hard band. The anchor-dedup classifier (`canonical-knowledge.service.ts`) is SEPARATE and keeps its own `[0.78, 0.85]` band — RAW-ARGMAX does not touch it.

---

## Ask-chat system prompt — byte-stable across turns (Phase 35 — load-bearing)

`app/src/state/useQuestions.ts:askStreaming` constructs a **byte-stable** system prompt (identity directive + safety directive + `WEB_SEARCH_TOOL_PROMPT` only — no per-turn dynamic content). The per-turn `formatCandidateContextPack(candidatePack)` lives in a tail-position assistant message AFTER `...historyMessages`:

```typescript
[
  { role: 'system', content: systemPrompt },                       // byte-stable
  ...historyMessages,                                              // append-only
  { role: 'user', content: USER_ACK_BEFORE_GRAPH_CONTEXT },        // byte-stable ack
  { role: 'assistant', content: assistantContextMessage },         // dynamic per-turn
  { role: 'user', content },                                       // current turn
]
```

Pass 2 (web-search) reuses the SAME `assistantContextMessage` and `USER_ACK_BEFORE_GRAPH_CONTEXT` closure values in the same position so Pass 1's prefix is still warm in the provider cache.

### Why this exists

Provider KV-cache (Anthropic, OpenAI, Gemini all support automatic prefix caching with 5-min TTL) is keyed on byte prefix. Previous shape interpolated `formatCandidateContextPack(candidatePack)` directly into the system prompt — candidate pack changes every turn, moving the cache-break boundary to the FIRST byte after `WEB_SEARCH_TOOL_PROMPT`. Every Ask turn paid full re-attention. Moving the dynamic context to a tail-position assistant message keeps the system + history prefix byte-stable.

The `USER_ACK_BEFORE_GRAPH_CONTEXT = 'Here is the knowledge graph context for this turn:'` constant exists because chat templates that strictly require user/assistant alternation (Qwen 3.5 via LM Studio's jinja template throws `"No user query found in messages"` on bare `assistant → user`) need a user message before the assistant context to render. The constant is byte-stable so cache benefit is preserved.

Public framing for this fix landed in `LabPresentation/SCRIPTS.md` slide 4.7.

### Rules

1. **Never re-introduce dynamic content into the system prompt** of `useQuestions.ts:askStreaming`. `tests/state/useQuestions-system-prompt-stability.test.mjs` enforces this with a source-reading negative assertion.
2. **Don't drop the assistant-tail context message either.** Same test asserts `formatCandidateContextPack` IS referenced inside `role: 'assistant'` content in BOTH chatStream calls.
3. **Pass 1 and Pass 2 must reuse the SAME `assistantContextMessage` AND `USER_ACK_BEFORE_GRAPH_CONTEXT` closure values.** Single declaration each, two references each. The user-ack constant must NOT be inlined as a literal string.
4. **Don't bypass `applyLocaleDirective`'s expectations.** It merges `Respond in {locale}.` into the FIRST `role: 'system'` message. Static `systemPrompt` must remain that first message.
5. **5-minute provider TTL is an inherent limit, not a Phase 35 bug.** Long-idle conversations still pay full re-attention; longer-session caching may need explicit `cache_control` markers (Anthropic-only) in a future phase.
6. **Other one-shot LLM call sites** (`concept-feed`, `planner`, `podcast`, `post-essay`, `post-context-qa`, `flashcard`, `canonical-knowledge` non-descent paths, `AskScreen.tsx:86` session-title) intentionally interpolate dynamic content into their system prompts. They have no multi-turn history → no benefit from Phase 35 discipline. Don't "consistency-fix" them.

---

## Best practices learned in Phase 32.1 (avoid the same mistakes)

1. **Search for dead code BEFORE assuming "two parallel paths."** Verify both ARE called before factoring out a shared helper.
2. **Tests must guard the LIVE code path, not aspirational/dead code.** A test on an unreachable file gives false confidence.
3. **`position: fixed` + `overflow: auto` + Android Chromium WebView = bug class.** Use Portal to `document.body` (sub-screens) or rely on parent `translateZ(0)` containing block (top-level swipe slots).
4. **Async classification needs an explicit re-read trigger.** Emit an event that store consumers reload from. Otherwise UI shows pre-async state forever.
5. **Hardcoded fallbacks vs. defer-to-streamer.** Post types deferring to on-open generation MUST set `bodyMarkdown: ''`. A "preview" snippet makes `PostDetailScreen` skip the streamer.
6. **One signal per semantic event.** Two events for the same outcome let subscribers drift.
7. **Don't ship hypothesis-only fixes for device-only bugs.** Add diagnostic logs over confident-but-untested fixes.
8. **When the operator says "I've explained this 5+ times," document in three places:** CLAUDE.md, auto-memory, inline comment at the load-bearing site.

---

## i18n Workflow (Phase 27+)

Trellis supports 4 locales: **English** (canonical), **Simplified Chinese**, **Spanish**, **Japanese**.

### Bundle files

- `app/src/locales/en.json` — **canonical** (hand-authored)
- `app/src/locales/{zh,es,ja}.json` — translations

Infrastructure: `app/src/locales/index.ts` (i18next init, `SUPPORTED_LOCALES`, `LOCALE_NAMES`, data-locale listener), `app/src/locales/i18n.d.ts` (module augmentation for type-safe `t()` keys), `app/src/lib/locale.ts` (`normalizeLocale`, `detectInitialLocale`, `detectDeviceLocale`), `app/src/providers/llm/locale-directive.ts` (central `applyLocaleDirective`), `app/src/services/youtube-locale-url.ts` (`buildYoutubeSearchUrl`).

### The ONE rule (no exceptions)

**Runtime LLM translation is PROHIBITED.** The app's `llmProvider` must NEVER be invoked to translate UI copy at runtime. Any `chatCompletion`/`chatStream` for translation is a bug. `applyLocaleDirective` is for telling the LLM what locale to respond in during normal Q&A, NOT for translating UI copy. See `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_i18n_translation.md`.

### Adding a new UI string — EN-first workflow

Every PR adding a user-visible string MUST land all 4 locale bundles in the SAME PR.

1. Add canonical EN value to `en.json` under the right namespace.
2. Run the Sonnet subagent (prompt at `app/scripts/translate-locales.md`) three times — once per non-EN locale.
3. Human-review generated translations: proper nouns (don't translate "Trellis", "OpenAI", "Claude"), interpolation placeholders (`{{name}}` verbatim), length (Spanish runs ~20% longer).
4. Commit all 4 bundles + code in one PR. `bundle-parity.test.mjs` blocks merges where key sets diverge.

### Namespaces

Top-level groups: `common.*`, `home.*`, `planner.*` (incl. `planner.trellis.*`), `ask.*` (incl. `ask.{drawer,history,welcome,suggestedPrompts,rateLimit,postThread}`), `review.*` (incl. `review.{library,miniMap,session,done}.*`), `graph.*` (incl. `graph.{anchor,cluster,reorganizeModal,selected,toast}`), `podcast.*` (incl. `podcast.{player,generateCard,knowledgeToday,insertBanner,toast}.*`), `posts.*` (incl. `posts.{detail,qa,connection,image}.*`), `settings.*` (16 sub-namespaces incl. `menu`, `titles`, `sections`, `fields`, `descriptions`, `placeholders`, `providerLabels`, `voices`, `themes`, `toast`, `confirm`, `test`, `planner`, `buttons`, `cacheStats`, `usageTable`, `zerotier`, `about`), `onboarding.*` (incl. `onboarding.{welcome,consent,llm}.*`), `questionDetail.*`.

### Validation (run from `app/`)

```bash
node --test tests/locales/bundle-parity.test.mjs   # asserts identical key sets
node --test tests/locales/missing-key.test.mjs     # asserts fallback renders EN
tsc -b --noEmit                                    # typos in t('...') keys fail compilation
npm test                                           # full suite
```

### What NOT to translate

- **Proper nouns:** Trellis, OpenAI, Claude, Gemini, YouTube, Tavily, API, TTS, LLM, SM-2, iOS, Android, Capacitor, GPT, SQLite, Nano Banana, ZeroTier
- **LLM system prompts** — stay English so the LLM understands; user-facing RESPONSE is translated via `applyLocaleDirective`
- **Tavily web-search queries** — intentionally English for broader coverage. `web-search-no-locale.test.mjs` enforces this.
- **Cross-locale branded labels** — "Language / 语言 / Idioma / 言語" in language pickers; "Continue · 继续 · Continuar · 続ける"; "Choose your language · 选择语言 · Elige tu idioma · 言語を選択" in Onboarding language step. MUST NEVER enter `en.json`.
- **Provider/model identifiers:** `gpt-4o`, `claude-sonnet-4-6`, `gemini-3.1-flash-image-preview`, `llama3`, etc.
- **Settings test result emoji prefix:** `'✓'` / `'✗'` — color logic (`.startsWith('✓')`) depends on it.
- **Static content blurbs:** HomeScreen `MILESTONE_POOL` (5 trivia/milestone cards) deferred to a future content-localization phase.

### Reference docs

- `.planning/phases/27-add-i18n-l10n-support/27-CONTEXT.md` — 24 locked decisions (D-01..D-24)
- `.planning/phases/27-add-i18n-l10n-support/27-RESEARCH.md` — technical research, patterns, pitfalls
- `.planning/phases/27-add-i18n-l10n-support/27-VALIDATION.md` — Nyquist test contract
- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_i18n_translation.md` — durable rule
