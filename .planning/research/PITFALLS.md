# Domain Pitfalls: Trellis v1.5 Curiosity Feed v2 + Tech-Debt Hardening

**Project:** Trellis v1.5
**Domain:** Adding masonry layout, engagement signals, source diversity, richer essays, and tech-debt cleanup to an existing React 19 + Capacitor 8 local-first app
**Researched:** 2026-05-08
**Confidence:** HIGH (most pitfalls derived directly from codebase archaeology and known v1.4 incident history)

> **Scope:** These are pitfalls specific to ADDING v1.5 features. Pitfalls already learned in CLAUDE.md are cited but not restated: `position: fixed` + `overflow: auto` + Android WebView flicker (Header portal pattern), `import.meta.env.DEV` chain breaking `node --test` (leaf-module pattern), one-signal-per-semantic-event, `bodyMarkdown: ''` for deferred-streamer posts, always-mounted screens need `[location.pathname]` resync effects, dev affordances must mutate ALL date-stamped storage keys.

---

## Critical Pitfalls

### Pitfall 1: Native CSS Masonry Is Not Production-Ready — JS Column-Balancing Will Rebalance Mid-Scroll and Corrupt `cyclePosition`

**What goes wrong:**
A developer reaches for `grid-template-rows: masonry` or `display: masonry` to implement the Pinterest layout. The API is behind flags in Chrome 140+ and not yet available in Capacitor 8's bundled WebView (typically lags browser release by one major cycle). The build ships. The WebView falls back to standard grid — no masonry. Alternatively, a JS-driven masonry library (e.g., `masonic`, `react-masonry-css`) is chosen and dynamically balances columns on image-load. Each balance recomputes column assignments. If the rebalance happens while the user is mid-scroll, the scroll container's `scrollHeight` changes, causing Android Chromium's scroll anchor algorithm to snap the viewport to a different item. The user loses their place. On top of that: the feed's `cyclePosition` pointer in `post-queue.service.ts` is keyed to flat-index order. If a masonry lib virtualizes or reorders items to balance columns, the flat-index that `walkDerivedList` returned diverges from what the user sees. Posts that were "next" in the derived-list walk are skipped or repeated from the user's perspective.

**Why it happens:**
- CSS masonry browser support is experimental-flag-only as of mid-2025; Capacitor WebView ships an older Chromium build.
- JS masonry libs that do post-mount DOM rebalancing fire `ResizeObserver` on each image `onLoad`, triggering layout recalculation mid-scroll.
- The three-list pipeline's `cyclePosition` assumes a stable, flat ordering of posts as delivered. Any visual reordering that doesn't mirror the queue's pop order breaks the conceptual contract.

**How to avoid:**
- Use CSS `column-count: 2` (the CSS multi-column fallback, not masonry spec) for the variable-height two-column layout. It is universally supported, respects `overflow: auto`, and does NOT rebalance on image load — items flow down each column naturally. Requires explicit `break-inside: avoid` on card containers.
- Reserve the masonry CSS property for a phase when Capacitor ships Chromium 140+ WebView (monitor `@capacitor/android` changelogs).
- If a JS masonry lib is chosen, lock column assignments at first render using pre-specified aspect ratios from `post.videoMeta.thumbnailUrl` dimensions or a per-style aspect-ratio table. Never recalculate columns after mount. The image `onLoad` handler should only update local image-display state, never trigger a column rebalance.
- The queue's pop order defines display order. The masonry layout must display posts in queue-pop order top-to-bottom within each column (left-column first, then right), NOT per-column sorted by height. Do not let the masonry lib sort for visual balance.

**Warning signs:**
- `column-count` approach is abandoned in favor of a `grid` or absolute-position masonry layout after "performance testing" — check whether column reassignment is wired to image `onLoad`.
- `masonic` or similar lib is imported — these virtualize by scroll position, not by queue index, breaking the `cyclePosition` contract.
- User-visible symptom: "Feed jumps when images load" or "I keep seeing the same concept."

**Phase to address:** Masonry layout phase (first v1.5 feed phase). Decide column strategy before any layout code is written.

---

### Pitfall 2: Engagement Signals (Like/Save/Dismiss) Collide With the Lazy-Skip Walker — Dismiss ≠ Explored

**What goes wrong:**
The lazy-skip walker in `post-queue.service.ts:walkDerivedList` skips concept anchors that appear in `dailyReadService.getExploredAnchors()`. A developer adds "Dismiss" as an engagement signal and wires `dismiss(postId)` to call `dailyReadService.markExplored(anchorId)` — the same path that Detectors A/B/C/D use. Two bugs follow immediately:

1. **Double-skip without vine credit:** A dismissed post fires `CONCEPT_EXPLORED`, incrementing VineProgress, awarding credits, and marking the anchor as explored — even though the user rejected the content, not engaged with it. The vine credits are now polluted.
2. **Dismissed = explored forever:** After dismiss, the anchor is in `exploredAnchors`. The walker lazy-skips it for the rest of the day. If the user later opens Ask and asks a question anchored to that concept, the feed will still skip it. The user's dismissal of one article killed all posts for that concept.

**Why it happens:**
- `markExplored` is the single-gate path to both vine progress and lazy-skip. It was designed for genuine engagement, not rejection signals.
- The event-bus rule (one signal per semantic event, from CLAUDE.md Phase 32.1 rule 6) makes it tempting to reuse `CONCEPT_EXPLORED` for dismiss.

**How to avoid:**
- Introduce a separate `dismissedPostIds: Set<string>` in a new `engagementService` (or as a field in `dailyReadService`), keyed to post IDs (not anchor IDs). The walker should check `dismissedPostIds.has(post.id)` before enqueueing that specific post, but NOT mark the anchor as explored.
- Emit a NEW event `POST_DISMISSED` — this is the ONE case where adding a new event type is justified: dismiss and explored are semantically distinct (rejection vs. completion). The walker subscribes to `POST_DISMISSED` to update the post-level skip set, not the anchor-level explored set.
- Like and Save do NOT interact with the walker at all — they annotate the post record in `post-history.service.ts` but do not affect derived-list walking.
- Write a source-reading test asserting `dismiss` does NOT call `markExplored` and does NOT emit `CONCEPT_EXPLORED`.

**Warning signs:**
- `dismiss` handler is wired to `dailyReadService.markExplored` or emits `CONCEPT_EXPLORED`.
- VineProgress completes unexpectedly after rapid dismissals.
- User reports "I dismissed one post and now I never see that topic again."

**Phase to address:** Engagement signals phase. Define the engagement-to-walker boundary in the CONTEXT doc before implementation.

---

### Pitfall 3: Engagement State Not Reset on Force-New-Day — Triples the Defense Required

**What goes wrong:**
Following the Phase 36 lesson (CLAUDE.md "Concept Feed Generation Pipeline → Numeric defaults"): dev affordances simulating wall-clock events must mutate ALL date-stamped storage keys, AND always-mounted screens must re-sync on navigation. When engagement signals (like/save/dismiss) are added to their own localStorage key (e.g., `trellis_engagement_state`), the `handleForceNewDay` handler in `SettingsDataScreen` will NOT know about this new key. On Force-New-Day: post-queue resets, daily-read resets, but engagement state carries over. Next-day feed starts with yesterday's dismissed posts already in the skip set and yesterday's liked posts still "liked" — wrong in both cases (dismissed posts should re-appear, liked posts are saved-permanently by design but VineProgress should not have them already counted).

**Why it happens:**
- `handleForceNewDay` was built to mutate a specific list of date-stamped keys (CLAUDE.md Phase 36 round-4 lesson). Adding a new date-scoped service without updating the handler is the classic drift failure.

**How to avoid:**
- Every date-scoped service (i.e., any service with a `date` field in its localStorage payload) MUST register a `reset()` method. `handleForceNewDay` MUST call `engagementService.reset()` alongside `dailyReadService.reset()`.
- Persist-across-days: like/save annotations belong in `post-history.service.ts` (SQLite/permanent). Dismiss-for-today belongs in the new engagement service with a date stamp. They are NOT the same store.
- Write a Force-New-Day test (matching the pattern in `tests/services/SettingsDataScreen.force-new-day.test.mjs`) that asserts `engagementService.reset()` is called.
- HomeScreen's `[location.pathname]` resync `useEffect` (Phase 36-14 canonical pattern) MUST re-pull engagement state if HomeScreen renders engagement annotations (like indicators, dismissal badges). Add a sibling effect alongside the existing `exploredAnchors` resync.

**Warning signs:**
- Yesterday's dismissed posts are missing from today's feed after Force-New-Day.
- Like/Save icons show stale state after navigating to `/home` following a Force-New-Day.
- `handleForceNewDay` does not call `engagementService.reset()` — a source-reading test catches this.

**Phase to address:** Engagement signals phase AND tech-debt hygiene phase (update Force-New-Day handler when engagement service lands).

---

### Pitfall 4: Source Diversity Domain-Reputation Lookup Blocks the Refill Mutex

**What goes wrong:**
Source diversity scoring requires a per-domain reputation lookup — either a local hardcoded allowlist or a network call to a scoring API. This lookup is placed inside `refillQueue`'s body, which is wrapped in `_refillMutex.run(...)`. If the lookup is async (network call or even a slow synchronous allowlist scan over many domains), it extends the mutex hold time. The refill mutex was designed to serialize LLM generation calls (one refill body at a time). Adding a slow domain-lookup inside the mutex means:

1. Rapid swipes now queue behind the domain lookup, not just the LLM call. The refill threshold of 16 posts was sized for LLM latency, not LLM + domain-lookup latency.
2. If the domain lookup fails (network error, timeout), the mutex's `try/finally` releases correctly per Phase 36-12's design — but the LLM posts were never generated. The refill returns empty, the queue drains, and the user sees "No more posts" during a domain-lookup outage.

**Why it happens:**
- Source diversity is conceptually part of "building the post," so developers put it inside `refillQueue`.
- The mutex hold time was designed around a single concern (LLM), not a pipeline of concerns.

**How to avoid:**
- Domain reputation lookup must be a pre-computed, synchronous lookup against a local allowlist. No network calls inside `refillQueue`. If a reputation database is fetched from the network, fetch it once at app start and cache in module scope — the lookup inside `refillQueue` reads from the cached copy synchronously.
- Source diversity filtering (deduplicate Tavily results by domain before building posts) happens in the Tavily result set, BEFORE the LLM generation call, but within the same `_refillMutex.run(...)` block. Keep it synchronous and O(N_results) where N ≤ 10 (Tavily page size).
- "Diversity filter starves concept of all candidates" is a silent zero-results bug: if the allowlist is too strict and all Tavily results for a concept are from blocked domains, `buildConceptBatch` returns zero posts for that concept. Add a fallback: if all candidates are filtered, allow the lowest-scoring blocked domain as a last resort rather than returning empty.
- Write a test asserting that with all-blocked Tavily results, at least one post is still generated (the fallback fires).

**Warning signs:**
- `refillQueue` body contains `await fetch(...)` for domain scoring.
- User sees "No more posts" after enabling source diversity.
- Refill takes noticeably longer than without source diversity (measure with `console.time`).

**Phase to address:** Source diversity phase.

---

### Pitfall 5: Richer Essays Break the Existing AbortController Contract — Two Unmount Paths

**What goes wrong:**
Richer essays (longer 400-600 word target, tighter source grounding, citation rendering) increase the streaming window from ~5 seconds to ~15-20 seconds. The existing `PostDetailScreen` already has a correct AbortController setup (CLAUDE.md "D-06 + D-16" comments at lines 283-386) — one controller aborts on locale change AND on unmount. The risk for v1.5 is that a developer:

1. **Adds a second async call inside the streaming loop** (e.g., a source-citation fetch for citation rendering) without threading the same `abortController.signal`. The citation fetch completes after unmount, calls `setState`, and React emits a "cannot update unmounted component" warning — and potentially corrupts `patchPostEssayInCache`.
2. **Increases essay length targets in the prompt** without increasing the `post-essay.service.ts` body slice limit (currently `bodyMarkdown.slice(0, 2000)` in `generateEssayMeta`). At 400-600 words, the slice truncates the body before it reaches the meta call, making `whyCare`/`takeaway`/`quickAskPrompts` less grounded. This is a silent quality regression, not a crash.
3. **Adds a `generateCitationBlock` call after `generateEssayMeta`** (outside the existing abort-guard chain) that runs after the user has already navigated away.

**Why it happens:**
- The existing abort chain is multi-step: stream → check aborted → meta call → check aborted → patch cache. Each step manually checks `abortController.signal.aborted`. A new call added after step 3 is easy to forget the check on.
- Longer streaming means longer exposure windows for all the intermediate checks.

**How to avoid:**
- Any new async call added to the `PostDetailScreen` essay-generation `useEffect` MUST receive `{ signal: abortController.signal }` and be preceded by an explicit `if (abortController.signal.aborted) return;` guard. This is the D-08 pattern. Add a source-reading test for each new call site.
- Raise the `bodyMarkdown.slice(0, 2000)` cap in `generateEssayMeta` to `slice(0, 4000)` to accommodate richer essays before any quality work begins.
- Citation rendering should be part of the ReactMarkdown pipeline (inline link rendering, not a separate fetch) — avoid any network calls triggered by the rendered essay body.
- For RTL/CJK layout impact: longer essays in Japanese and Chinese will wrap at different line lengths. Spanish essays at 400 words run ~480 words equivalent width. Add a max-height + scroll on the essay container BEFORE increasing word counts, not after observing overflow.

**Warning signs:**
- A new `async function` is added inside the `PostDetailScreen` essay `useEffect` without a call to `abortController.signal.aborted` before it.
- `generateEssayMeta` is called with `accumulated` that is always truncated to exactly 2000 chars (the current slice limit) — signals the slice cap is too small for the new essay length.
- "Cannot update unmounted component" warnings in the console after navigating away mid-stream.

**Phase to address:** Richer essays phase. Raise the slice cap and audit the abort chain before lengthening the prompt.

---

## Moderate Pitfalls

### Pitfall 6: Masonry Scroll-Position Restoration After Back-Navigation Is Not Wired

**What goes wrong:**
Current single-column InfoFlow uses a `scrollRef` on `HomeScreen`'s scroll container. When the user taps a card and navigates to `PostDetailScreen`, the scroll container is still mounted (always-mounted HomeScreen slot, `SwipeTabContainer` keeps it off-screen via `translateX`). On return (back navigation via `navigate(-1)` or `Header backTo`), the scroll container retains its `scrollTop` — this is effectively free for the single-column layout.

Pinterest masonry with two columns changes this: if the masonry layout is JS-driven and recalculates column heights on mount/remount, the `scrollTop` value may not correspond to the same visual item because item heights may have changed (image aspect ratios settling, theme re-evaluation). The user returns to a different visual position than where they left off.

**Why it happens:**
- CSS `column-count: 2` does NOT remount on back-navigation (the DOM node stays alive in the always-mounted slot). Scroll is automatically preserved. Problem doesn't exist.
- A JS masonry lib that uses absolute positioning (masonic, react-virtualized) stores position-to-item mappings internally. On remount or window resize, it recalculates. If it considers a `ResizeObserver` on the SwipeTabContainer slot's becoming `visible` (translateX = 0) a "resize event," it may invalidate its position map and reset scroll to 0.

**How to avoid:**
- Use CSS `column-count: 2` (recommended in Pitfall 1). Scroll is preserved automatically.
- If a JS masonry lib is chosen: override its resize behavior so it does NOT recalculate when the SwipeTabContainer fires a resize event due to slot becoming visible (width did not change — Pitfall directly related to CLAUDE.md SwipeTabContainer `resync()` early-return guard). This requires forking or patching the lib's resize handler.
- Test the back-navigation flow explicitly: navigate to card, return, assert `scrollTop` matches pre-navigation value.

**Warning signs:**
- User returns from PostDetail to HomeScreen and sees the top of the feed.
- A JS masonry lib's resize handler is wired to `ResizeObserver` on the slot container (will re-trigger on translateX change).

**Phase to address:** Masonry layout phase. Validate scroll-restoration in UAT before shipping.

---

### Pitfall 7: Source-Reading Invariant Tests Snap on i18n Leaf-Module Refactor Import-Line Changes

**What goes wrong:**
Four source-reading tests use regex patterns against raw TypeScript source to assert structural invariants. If the i18n leaf-module refactor renames or moves imports in the files these tests guard, the regex may match an import line instead of the intended call site, producing a false-positive pass — or match nothing and produce a false-negative fail.

The specific tests at risk:
- `tests/state/useQuestions-system-prompt-stability.test.mjs` — asserts `formatCandidateContextPack` appears inside `role: 'assistant'` content, NOT inside `role: 'system'`. If the refactor adds an import named `formatCandidateContextPack` at the top of `useQuestions.ts`, the import line matches the "is referenced in assistant content" regex before the `role:` context is established.
- `tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` and `HomeScreen.warm-start-refallback.test.mjs` — use anchor-pair extraction to assert specific `useEffect` structures. If the refactor moves `dailyReadService` import to a leaf module with a different name, the anchor string changes.
- `tests/screens/SettingsDataScreen.force-new-day.test.mjs` — asserts `dailyReadService.reset()` appears in `handleForceNewDay`. If the service is re-exported from a leaf module under a different local name, the grep misses it.

**Why it happens:**
- Source-reading tests grep or regex raw source files. Import line changes are syntactically outside their intended scope but textually within their match window.
- The i18n refactor touches import sections across many service files simultaneously (it's a breadth-first sweep), increasing the chance of collateral regex matches.

**How to avoid:**
- Run the FULL test suite (`npm test`) after EVERY batch of i18n leaf-module extractions, not just after the whole refactor is complete. The refactor should be done file-by-file with a green test baseline after each file.
- Before starting the refactor, grep for all source-reading tests: `grep -rl "readFileSync\|fs\.read" app/tests/`. Audit each one against the files the refactor will touch.
- When renaming a service's import (e.g., `import { dailyReadService } from './daily-read.service'` → `import { dailyReadService } from './daily-read.leaf'`), check whether any source-reading test asserts the string `dailyReadService` in a file that's being touched. Update the test's expected import path simultaneously.
- The anchor-pair extraction pattern (used in HomeScreen tests) is robust to file restructuring as long as the function NAME in the source stays the same. Preserve function names during refactor; rename files not functions.

**Warning signs:**
- A source-reading test changes from FAIL to PASS during the refactor without any logic change — this is a false-positive caused by the import line matching.
- `npm test` passes but a specific invariant test's match is against an import line (`import.*formatCandidateContextPack`) rather than a usage site.

**Phase to address:** i18n leaf-module refactor phase (first v1.5 phase). Run tests after each file, not batch.

---

### Pitfall 8: Engagement State localStorage Key Not Listed in the `trellis_*` Migration Registry

**What goes wrong:**
`legacy-migration.service.ts` migrated all `echolearn_*` keys to `trellis_*` keys at v1.4. If engagement signals add a new `trellis_engagement_state` key, this key will not have a legacy migration entry — that's fine. But if a developer accidentally uses `echolearn_engagement_*` as the key name (copy-paste from an older service file that hasn't been fully rebranded), there is no runtime migration and the key is silently orphaned on upgrade. The user's engagement history vanishes. (Note: the `echolearn_*` prefix is historical: pre-2026-05-07 brand. All such keys were one-shot migrated to `trellis_*` by `legacy-migration.service.ts`. New code MUST use `trellis_*`.)

More commonly: the CLAUDE.md "Brand history" note says `localStorage keys use trellis_*` but the SQLite connection name is still `'echolearn'`. A developer working on engagement signals may reach for the SQLite connection (reasonable, since like/save are permanent records) but use the wrong connection name string literal. (SQLite connection name `'echolearn'` is intentionally preserved; only localStorage keys were rebranded.)

**Why it happens:**
- Brand rename happened in v1.4 (commit `9e5d1f38`). New developers (or agent threads) reading the codebase see both `echolearn` (in SQLite) and `trellis_` (in localStorage) and may cross them up.
- Copy-paste from existing services that have both names in proximity.

**How to avoid:**
- All new localStorage keys MUST use the `trellis_` prefix. Add a lint check or source-reading test asserting `localStorage.setItem('echolearn_` never appears in `src/services/`.
- SQLite connection name `'echolearn'` is intentionally preserved. If engagement signals are persisted to SQLite (like/save permanent records), use the existing `db.service.ts` connection — do NOT create a new connection with a new name.
- Engagement service must use `trellis_engagement_state` for its date-scoped localStorage payload. Document this explicitly in the service file's header comment.

**Warning signs:**
- `grep -r "echolearn_" app/src/services/` returns results in files created after v1.4.
- User reports engagement state vanishing after app update.

**Phase to address:** Engagement signals phase.

---

### Pitfall 9: Dependency Sweep — framer-motion `will-change` on Masonry Cards Creates a New Containing Block, Breaks Portalled Headers

**What goes wrong:**
The masonry card entrance animation (a common touch: cards fade/slide in as they appear in viewport) uses `framer-motion`'s `<motion.div>` with `animate={{ opacity: 1, y: 0 }}`. framer-motion adds `will-change: transform` to animating elements. Per CLAUDE.md "Header positioning": `transform`/`will-change`/`filter`/`contain`/`perspective` on any ancestor of an in-tree `Header` creates a new containing block that breaks `position: fixed` headers inside that ancestor.

The always-mounted HomeScreen slot is an in-tree header slot (inside `SwipeTabContext`). If a `<motion.div>` wrapping a masonry card is an ancestor of... wait, HomeScreen's Header is above the feed, not inside the cards. The real risk: if the masonry card wrapper becomes a containing block via `will-change: transform`, AND a portalled sub-screen Header is somehow rendered adjacent to it during a transition, the stacking context changes. More concretely: the existing `SwipeTabContainer.tsx:245` translateZ(0) containing block is intentionally the ONLY containing block creator in the top-level slot chain. Adding `will-change: transform` on individual masonry cards does NOT break this — they are leaf nodes, not ancestors of the Header. This is a false alarm for the in-tree case.

The real risk is on `PostDetailScreen` (a portalled sub-screen). If a card's entrance animation is still running when the user taps through to PostDetail, the animating `will-change: transform` element is in the HomeScreen subtree (not PostDetail's subtree). PostDetailScreen's Header is portalled to `document.body` — immune. No regression here either.

The ACTUAL risk: a developer, trying to animate the masonry grid container itself with framer-motion (not individual cards), wraps `<InfoFlow />` or the scroll container in a `<motion.div>`. This creates a `will-change: transform` on an ancestor of the in-tree HomeScreen Header. This breaks the containing block chain and HomeScreen's header may flicker.

**How to avoid:**
- Animate individual masonry CARDS with `<motion.div>`, never the scroll container or InfoFlow root.
- Alternatively, use CSS `animation` (not framer-motion) for card entrance: `@keyframes fadeSlideIn` with `opacity` and `transform` only. Avoids adding framer-motion's automatic `will-change` to the DOM.
- If using framer-motion on cards, pass `layout={false}` and do not set `layoutId` — layout animations recalculate bounding boxes, causing the `ResizeObserver` cascade described in Pitfall 6.
- Source-reading test: assert the HomeScreen scroll container does NOT have `framer-motion` `motion.*` on its root div (or assert no `will-change` in the container's inline style).

**Warning signs:**
- HomeScreen Header flickers or repositions during card entrance animations.
- A `<motion.div>` wraps the `<InfoFlow />` component rather than individual cards inside it.

**Phase to address:** Masonry layout phase. Animation choice is an implementation detail that must be locked early.

---

### Pitfall 10: `walkDerivedList` Test Coverage at N=4 Masks Single-Concept Masonry Regression (Repeat of GAP-B Pattern)

**What goes wrong:**
Phase 36 GAP-B was discovered in UAT, not in tests, because integration smoke tests called `walkDerivedList(2, ...)` on a 4-entry derived list — N=2 is within the `count * 2 = 4 = len` boundary, so truncation didn't fire. The masonry phase will change the number of posts fetched per refill call (a 2-column layout with 4 rows visible pops 8 posts per swipe, not 4, to fill both columns). If the refill call increases `count` from 16 to 32 without also checking that `maxSteps = Math.max(count * 2, len)` still holds for single-anchor users (`len = 4`), the walker will return `min(32*2=64, 4)` → still 4, fine. But the stratified style allocator (`assignStylesStratified`) now receives N=32 entries from a 4-entry derived list, which means 28 of the 32 are repeats of the same 4 anchors. The largest-remainder allocation works correctly on N=32, but all 32 are the same concept — the `spreadByConcept` mixer has nothing to spread.

**Why it happens:**
- Changing the posts-per-swipe constant or the refill batch size without auditing downstream invariants (style allocation, spreadByConcept, cyclePosition arithmetic) is the pattern that bit Phase 36.
- The v1.5 double-column layout is explicitly called out in CLAUDE.md as the forward-looking reason for the refill threshold increase from 12 to 16. Changing the posts-per-swipe default from 4 to 8 will require re-auditing ALL of those numeric defaults.

**How to avoid:**
- Before changing posts-per-swipe for the double-column layout: audit `MAX_QUEUE_SIZE`, `REFILL_THRESHOLD`, `walkDerivedList(count, ...)` call sites, and `assignStylesStratified(N)` expected output. Write the regression test for the new N BEFORE changing the constant (RED-first as per Phase 36 discipline).
- Add a dedicated test: `walkDerivedList(8, single-anchor-4-entry-derived-list)` → assert returns exactly 8 entries (4 unique + 4 repeats cycling), all from the same anchor.
- The `spreadByConcept` mixer must handle the degenerate case where all entries are the same concept — it should not infinite-loop or return an empty array.

**Warning signs:**
- Posts-per-swipe constant is bumped from 4 to 8 without a corresponding refill-queue-integration test at N=8.
- `spreadByConcept` throws or returns [] for a single-concept derived list.

**Phase to address:** Masonry layout phase (if posts-per-swipe changes) or a future posts-per-swipe phase.

---

## Minor Pitfalls

### Pitfall 11: i18n Refactor — `_actions-mock-loader.mjs` Doesn't Stub New Leaf Modules

**What goes wrong:**
The `test:actions` script registers `_actions-mock-loader.mjs` via `--import` to stub LLM/SQLite/i18n dependencies for trellis-actions tests. When the i18n leaf-module refactor extracts a new module (e.g., `engagement-locale.leaf.ts`), that module may transitively import `src/locales/index.ts` (which pulls `import.meta.env.DEV`). If the new leaf module is not stubbed in `_actions-mock-loader.mjs`, any trellis-actions test that imports a service using the new leaf module will fail with the `import.meta.env.DEV` chain error. This is the exact pattern that caused the 10 carried test failures from v1.4.

**How to avoid:**
- Every new leaf module extracted during the i18n refactor must be listed in `_actions-mock-loader.mjs` (or its stub registry). Check the existing pattern from Phase 36 leaf modules (`feed-spread.ts`, `refill-mutex.ts`).
- Run `npm run test:actions` after each new leaf module extraction to catch the failure immediately.
- The leaf-module pattern rule (CLAUDE.md): pure-logic helpers that must be testable under `node --test` must NOT import from `src/locales/index.ts` — stub the locale dependency or accept it as a parameter.

**Warning signs:**
- `test:actions` fails after a leaf-module extraction with `import.meta.env` is not defined.
- A new leaf module imports `useTranslation` or `i18next` directly rather than accepting locale as a parameter.

**Phase to address:** i18n leaf-module refactor phase (first v1.5 phase).

---

### Pitfall 12: Dependency Sweep — React 19 Minor Bump May Change `useEffect` Double-Invocation Behavior Under StrictMode

**What goes wrong:**
React 19 in Strict Mode intentionally double-invokes `useEffect` setup+cleanup in development. This was used in Phase 36 to design the `useRef(dailyPosts.length > 0)` snapshot pattern (StrictMode-safe, commit `06` in Phase 36 round 2). A React 19.x minor bump that changes StrictMode behavior (historically: React 18.0 introduced double-invoke for `useEffect`; React 18.1 adjusted timing) could change the execution order of the `useState` initializer snapshot vs. the `useEffect` resync, causing the HomeScreen warm-start fallback to mis-fire.

**How to avoid:**
- Lock React to `^19.2.0` (current minor) in package.json and review changelogs before bumping.
- The StrictMode double-invoke pattern is tested structurally in `HomeScreen.warm-start-guard.test.mjs` — run this test against any React upgrade candidate in isolation first.
- Do not bump React mid-feature-phase. Reserve dependency bumps for the tech-debt hygiene phase.

**Warning signs:**
- Warm-start feed shows empty on cold-start in development (Strict Mode) but works in production builds.
- HomeScreen shows briefly then re-fetches (double-invoke timing changed).

**Phase to address:** Tech-debt dependency sweep phase. Not a feature phase.

---

### Pitfall 13: Like/Save Annotations Stored in `post-history.service.ts` Without a Schema Migration

**What goes wrong:**
`post-history.service.ts` writes post snapshots to SQLite via `db.service.ts`. Adding `liked: boolean` and `saved: boolean` columns to an existing SQLite table without a migration script causes `SQLITE_ERROR: table post_history has no column named liked` on first write after upgrade. The error is silent at the service level (ServiceResult `{ success: false }`) but the like/save action appears to work to the user (optimistic UI) — then vanishes on next app restart.

**Why it happens:**
- SQLite schema is not automatically migrated when the app upgrades. `@capacitor-community/sqlite` requires explicit `ALTER TABLE` migrations run in a migration script keyed to a version number.
- Optimistic UI hides the write failure from the user.

**How to avoid:**
- Any schema change to `post_history` (or any other SQLite table) MUST have an accompanying migration in `db.service.ts` with a version bump. Check the existing migration pattern in that file before adding columns.
- Alternatively, store like/save in a separate localStorage key (simpler, no migration needed). Given that Trellis is local-first with user-managed keys, localStorage is acceptable for engagement annotations.
- Write an integration test that opens an old-schema DB (without the new columns), runs the migration, and confirms the new columns exist and old data is preserved.

**Warning signs:**
- `ServiceResult<{ liked: boolean }>` returns `{ success: false }` in logs after upgrade.
- Like/Save state is correct immediately after tap (optimistic) but missing after app restart.

**Phase to address:** Engagement signals phase. Decide storage location (SQLite vs localStorage) before writing any like/save write path.

---

## Phase-Specific Warning Table

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Masonry layout | Native CSS masonry not supported in Capacitor WebView | Use CSS `column-count: 2` (Pitfall 1) |
| Masonry layout | Column rebalance on image load corrupts cyclePosition | Lock column assignment at first render (Pitfall 1) |
| Masonry layout | Back-navigation scroll position lost with JS masonry lib | Validate scroll-restore in UAT; prefer CSS columns (Pitfall 6) |
| Masonry layout | framer-motion on scroll container breaks Header containing block | Animate individual cards only (Pitfall 9) |
| Masonry layout | posts-per-swipe bump breaks style allocation at small N | Write RED test before changing the constant (Pitfall 10) |
| Engagement signals | Dismiss wired to markExplored → vine credit pollution | Separate dismiss skip set from explored anchor set (Pitfall 2) |
| Engagement signals | Engagement state not reset on Force-New-Day | `engagementService.reset()` in `handleForceNewDay` (Pitfall 3) |
| Engagement signals | Like/Save schema migration missing from SQLite | Migration script or localStorage storage decision (Pitfall 13) |
| Engagement signals | New (incorrect) `echolearn_` localStorage key after v1.4 rebrand — historical prefix, pre-2026-05-07 | Lint check: no `echolearn_` in new service files (Pitfall 8) |
| Source diversity | Domain lookup inside refill mutex holds lock too long | Synchronous local allowlist only; no network inside `_refillMutex.run()` (Pitfall 4) |
| Source diversity | Strict filter silently returns zero posts for a concept | Fallback: allow lowest-blocked domain when all filtered (Pitfall 4) |
| Richer essays | New async call in PostDetailScreen essay useEffect missing abort guard | D-08 pattern: every call gets `signal` + aborted-check (Pitfall 5) |
| Richer essays | `generateEssayMeta` slice cap too small for richer essays | Raise `slice(0, 2000)` to `slice(0, 4000)` before lengthening prompt (Pitfall 5) |
| Richer essays | CJK/RTL essay overflow at higher word counts | Add max-height + scroll on essay container first (Pitfall 5) |
| i18n leaf-module refactor | Source-reading invariant tests false-positive on import lines | Run `npm test` after each file; audit regex targets before refactor (Pitfall 7) |
| i18n leaf-module refactor | New leaf modules not stubbed in `_actions-mock-loader.mjs` | Add to stub registry immediately after extraction (Pitfall 11) |
| Tech-debt dependency sweep | React 19 minor bump changes StrictMode double-invoke timing | Lock version; bump only in tech-debt phase; validate warm-start test (Pitfall 12) |

---

## Sources

- CLAUDE.md (all load-bearing sections cited throughout) — HIGH confidence (primary source)
- `.planning/PROJECT.md` (v1.4 phase history, v1.5 goal definition) — HIGH confidence
- [CSS Masonry — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Masonry_layout) — masonry browser support status — MEDIUM confidence
- [Chrome for Developers: Brick by brick, CSS Masonry](https://developer.chrome.com/blog/masonry-update) — Chromium flag status — MEDIUM confidence
- [Masonry in React: A Performance Hell](https://medium.com/@colecodes/masonry-in-react-a-performance-hell-fb779f5fcebd) — JS masonry rebalance pitfalls — MEDIUM confidence
- [localStorage storage event does not fire in same tab](https://www.xjavascript.com/blog/forcing-local-storage-events-to-fire-in-the-same-window/) — cross-tab sync caveat — HIGH confidence
- [AbortController + React useEffect cleanup](https://www.j-labs.pl/en/tech-blog/how-to-use-the-useeffect-hook-with-the-abortcontroller/) — unmount abort patterns — HIGH confidence
- [Motion (framer-motion) animation performance](https://motion.dev/docs/performance) — will-change caveats — MEDIUM confidence
- Phase 36 incident history (GAP-A, GAP-B, GAP-C, GAP-D from `.planning/PROJECT.md`) — HIGH confidence
