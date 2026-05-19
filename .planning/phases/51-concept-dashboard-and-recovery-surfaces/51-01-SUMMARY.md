---
phase: 51-concept-dashboard-and-recovery-surfaces
plan: 01
subsystem: concept-recovery-surfaces
tags: [retrieve-03, retrieve-04, anchor-detail, infoflow, i18n, thin-enrichment]
requires: []
provides:
  - "shared resolveAnchorId(qaId) helper (app/src/lib/anchor-resolution.ts)"
  - "LeafStateBadge component (app/src/components/concept/LeafStateBadge.tsx)"
  - "AnchorDetailScreen leaf-state badge + recovery-mode Flashcards button morph + Appears-in footer"
  - "InfoFlow concept badges tappable to /anchor/:id with binary amber attention dot"
  - "PostDetailScreen contextLabel + connection pills tappable to /anchor/:id"
  - "SavedScreen route-state { conceptFilterTitle, openTab? } consumer"
  - "PodcastScreen route-state { conceptFilterQaIds, conceptTitle } consumer + clear banner"
  - "i18n keys graph.anchor.{reviewNow, appearsIn, appearsInSaved/Collections/Podcasts, leafState.*}, podcast.filteredBy, common.clear across en/zh/es/ja"
affects: []
tech-stack:
  added: []
  patterns:
    - "Sync qa→anchor resolution via questionService.getAll().find() (questionService.getById is async ServiceResult)"
    - "Source-reading test guards instead of full React render"
    - "Hooks declared BEFORE early-return so useQuestions loading→resolved doesn't trip Rules of Hooks"
key-files:
  created:
    - app/src/lib/anchor-resolution.ts
    - app/src/components/concept/LeafStateBadge.tsx
    - app/tests/lib/anchor-resolution.test.mjs
    - app/tests/screens/AnchorDetailScreen.recovery.test.mjs
    - app/tests/components/InfoFlow.badge-nav.test.mjs
    - app/tests/screens/SavedScreen.routeFilter.test.mjs
  modified:
    - app/src/screens/AnchorDetailScreen.tsx
    - app/src/components/InfoFlow.tsx
    - app/src/screens/PostDetailScreen.tsx
    - app/src/screens/SavedScreen.tsx
    - app/src/screens/PodcastScreen.tsx
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json
decisions:
  - "Plan is thin enrichment, not rebuild — no useConceptDashboard hook, no 4-tab restructure, no ConceptXxxSection components"
  - "Feed-tile badge dot stays binary single-color amber (operator-locked, CLAUDE.md tile-simplicity rule)"
  - "AnchorDetailScreen keeps its primary identity (Flashcards + Learn-as-Post + Knowledge Summary + Q&A list); recovery layers ON TOP"
  - "i18n keys land in Task 2's commit (not Task 7) because i18next typed t() surface is derived from en.json — without keys, every later file fails tsc. Task 7 became verification-only."
  - "Route-state cleared after consumption via navigate(replace) so back-navigation / remount doesn't re-apply"
  - "PodcastScreen auto-opens All Podcasts sub-view when conceptFilter is set (otherwise filter is invisible until user taps History)"
metrics:
  duration: "22m"
  completed: "2026-05-19T11:01:09Z"
  tasks: 8
  commits: 8
  files-changed: 14
  tests-added: 44 (7 anchor-resolution + 19 AnchorDetailScreen + 10 InfoFlow + 8 SavedScreen)
  tests-total: 1304 main + 149 actions = 1453 (all pass)
---

# Phase 51 Plan 01: Concept Dashboard and Recovery Surfaces — Thin Enrichment Summary

Phase 51-01 ships RETRIEVE-03 and RETRIEVE-04 as a thin enrichment of the existing AnchorDetailScreen plus four small entry-point upgrades — not the rich aggregation dashboard the research recommended. One shared helper, one new presentational component, surgical edits to five screens/components, four locale bundles with seven new key blocks, and four test files. No new hooks, no new sections, no tabbed restructure.

## One-liner

Make existing concept-linked surfaces tappable (InfoFlow badges, PostDetail contextLabel + connection pills) so users can reach `/anchor/:id`, and have AnchorDetailScreen show a leaf-state badge + recovery-mode Flashcards button + bounded "Appears in" footer linking back to SavedScreen and PodcastScreen with pre-applied concept filter — all without restructuring the screen.

## What shipped

### Task 1 — `feat(51-01): add resolveAnchorId helper + LeafStateBadge component` (`7187fc3c`)

- `app/src/lib/anchor-resolution.ts`: `resolveAnchorId(qaId)` returns the anchor id given an anchor id (passthrough), a Q&A id whose parent is an anchor, or `null` for orphan / parent-not-anchor / unknown. Walks at most 2 hops (Trellis fixed-depth).
- `app/src/components/concept/LeafStateBadge.tsx`: presentational pill mapping each of 7 LeafStates to color + 8px dot + i18n label. Uses inline styles + CSS variables (project convention). Renders nothing on null/undefined.
- `app/tests/lib/anchor-resolution.test.mjs`: 7 tests covering all five plan branches plus empty input + empty store.

### Task 2 — `feat(51-01): AnchorDetailScreen — LeafStateBadge + recovery button + Appears-in footer` (`29f59399`)

- LeafStateBadge renders between title and stats when `leafState` is non-null. computeLeafState reads anchor + qaChildren reviewSchedule directly (no fcMap override — that's the trellis layout's concern, not this read-only badge).
- Flashcards button morphs by leaf state: `flashcardsBg` picks amber `#f59e0b` for dying, red `#ef4444` for falling, `var(--muted-foreground)` for dead; healthy states keep `var(--primary-40)`. `flashcardsLabel` swaps to `t('graph.anchor.reviewNow')` when `recoveryActive && anchorCardCount > 0`. Button stays clickable in every state.
- Appears-in footer below the Q&A list: three link-out buttons (Saved / In collections / Podcasts) rendered only when at least one count > 0. Navigates with `{ conceptFilterTitle }` or `{ conceptFilterQaIds, conceptTitle }` route state.
- Hooks declared before early-return so `useQuestions` loading→resolved doesn't trip Rules of Hooks. setTick subscribes to 6 event types (GRAPH_UPDATED, REVIEW_COMPLETED, ENGAGEMENT_CHANGED, COLLECTIONS_CHANGED, FLASHCARDS_CREATED, PODCAST_GENERATION_COMPLETED) to keep the counts live without refresh.
- All four locale bundles updated with `graph.anchor.{reviewNow, appearsIn, appearsInSaved/Collections/Podcasts, leafState.bud/green/dying/falling/dead/blossom/fruit}`, `podcast.filteredBy`, `common.clear`. See "Deviations" below for why locale changes landed here rather than Task 7.

### Task 3 — `feat(51-01): InfoFlow concept badges — tappable + binary amber attention dot` (`c8d7492f`)

- Both card branches (NewsCard ~line 266, ConceptCard ~line 443) wrap their `sourceQuestionTitles` pill in a `<button>` that navigates to `/anchor/${anchorId}` when the qaId→anchor walk resolves. `e.stopPropagation()` prevents the tile-level open-post handler from also firing.
- `getBadgeLeafSignal(qaId)` returns `'attention'` only for `leafState ∈ {dying, falling, dead}` — single binary signal. Operator-locked per CLAUDE.md feed-tile simplicity rule; the 7-state palette stays exclusive to AnchorDetailScreen.
- Hit-target padding bumped from `3px 8px` to `6px 10px` (≥32px touch target).
- Disabled state (no onClick) when no anchor resolves; visuals identical.

### Task 4 — `feat(51-01): PostDetailScreen — tappable contextLabel + connection pills` (`08fbca69`)

- `useMemo` blocks resolve `conceptAnchorId` from `post.sourceQuestionIds[0]` and `connectionAnchorIds[0..1]` from `connectionMeta.questionA/B.id`.
- contextLabel becomes a primary-40 link when the anchor resolves; static text when not. `" · ${narrativeMode}"` suffix stays static either way.
- Connection pills get `role="button" / onClick / onKeyDown` (Enter + Space) when their anchor resolves; same node-mint / node-sky background colors as before.
- Detectors A/B/C/D untouched. `enablejsapi=1` survives in YouTubeEmbed. Q&A follow-up handler unchanged.

### Task 5 — `feat(51-01): SavedScreen — accept route state for concept pre-filter` (`131bd97f`)

- `useEffect` on mount reads `{ conceptFilterTitle, openTab }` from `useLocation().state`. Pre-applies filter chip and (optionally) switches active tab.
- Route state cleared via `navigate(location.pathname, { replace: true, state: null })` to prevent back-navigation re-applying.
- Existing chip-clear handler intact — pre-applied filter is just an initial value, not a lock.

### Task 6 — `feat(51-01): PodcastScreen — accept concept filter route state + clear banner` (`57e4b90c`)

- New local state `conceptFilter: { qaIds: Set<string>; title: string } | null`. `useMemo` derives `visiblePodcasts = podcasts.filter(p => p.questionIds.some(id => conceptFilter.qaIds.has(id)))`.
- Mount-time consume effect auto-opens the All Podcasts sub-view so the filter is immediately visible (otherwise user lands on today's player and never sees it).
- Banner above the list: `"Filtered by {{concept}}"` + Clear button. Tapping Clear resets `conceptFilter` and restores the full list.
- Surgical route-state clear preserves any other fields (Planner moveState lives on the same `location.state`).
- Today's player, Knowledge Today, audio playback, delete confirmation all untouched.

### Task 7 — i18n bundles (folded into Task 2's commit `29f59399`)

i18next's typed `t()` surface is derived from `en.json`; without the keys in place, the AnchorDetailScreen / PodcastScreen edits in Tasks 2/6 fail tsc. The cleanest resolution was to land all four locale bundles inside the Task 2 commit so `bundle-parity.test.mjs` stays green at every commit boundary. Task 7's deliverable (keys present in all four locales, parity test passes) is achieved; no separate commit was created.

### Task 8 — `test(51-01): source-pattern guards for recovery surfaces + badge nav` (`b939f8e9`)

- `app/tests/screens/AnchorDetailScreen.recovery.test.mjs` (19 tests): LeafStateBadge placement gated on leafState; Flashcards button morph (recoveryActive flag, amber/red/muted bg, reviewNow label, computed binding); Appears-in footer (4 service imports, three counts, gated render, link-out route states); preserved-identity invariants (Flashcards CTA, Learn-as-Post CTA, Knowledge Summary, Q&A list, no useConceptDashboard, no 4-tab structure).
- `app/tests/components/InfoFlow.badge-nav.test.mjs` (10 tests): resolveAnchorId import; getBadgeLeafSignal helper; useNavigate inside ConceptCard; `e.stopPropagation() + navigate(/anchor/:id)` in BOTH badge handlers; binary amber dot ONLY (no red/muted tile-level); disabled state for orphans; padding bump 3×8 → 6×10; preserved Phase 42 invariants (no CONCEPT_EXPLORED emit, no inline iframe).
- `app/tests/screens/SavedScreen.routeFilter.test.mjs` (8 tests): useLocation import + call; conceptFilterTitle/openTab consumed; all four Tab values accepted; navigate(replace) clear pattern; one-shot per mount (empty deps); preserved chip Clear handler.

## Files

### Created

- `app/src/lib/anchor-resolution.ts` — shared `resolveAnchorId(qaId)` helper
- `app/src/components/concept/LeafStateBadge.tsx` — 7-state leaf-state pill
- `app/tests/lib/anchor-resolution.test.mjs` — 7 tests
- `app/tests/screens/AnchorDetailScreen.recovery.test.mjs` — 19 tests
- `app/tests/components/InfoFlow.badge-nav.test.mjs` — 10 tests
- `app/tests/screens/SavedScreen.routeFilter.test.mjs` — 8 tests

### Modified

- `app/src/screens/AnchorDetailScreen.tsx` — LeafStateBadge + recovery button + Appears-in footer + event-bus subscriptions
- `app/src/components/InfoFlow.tsx` — useNavigate, tappable badges with stopPropagation, binary amber dot helper
- `app/src/screens/PostDetailScreen.tsx` — useMemo'd conceptAnchorId / connectionAnchorIds; contextLabel + connection pills as deep-links
- `app/src/screens/SavedScreen.tsx` — useLocation consumer effect
- `app/src/screens/PodcastScreen.tsx` — conceptFilter state, visiblePodcasts useMemo, filter banner
- `app/src/locales/en.json`, `zh.json`, `es.json`, `ja.json` — 17 new keys per locale

## Decisions Made

### D-01: Sync resolveAnchorId via questionService.getAll().find() (not async getById)

`questionService.getById` returns `Promise<ServiceResult<Question>>` and is async by design. The plan assumed sync access, but a sync helper is needed for per-render badge resolution (called in JSX). Switched to `questionService.getAll({ includeFlagged: true }).find()` which is sync and matches the pattern used by `useTrellisData` and `PrunedSection`. Performance is acceptable for typical anchor counts (≤50 anchors × ≤5 Q&As).

### D-02: Hooks before early-return in AnchorDetailScreen

The original screen had an early-return for `!anchor || !anchor.isAnchorNode` BEFORE any hooks. Adding `useState` + `useEffect` after that early-return would violate Rules of Hooks when `useQuestions` loading→resolved flips `anchor` from undefined to defined on the same component instance. Solution: declared the setTick + eventBus subscriptions BEFORE the early-return.

### D-03: i18n keys landed with the first consumer (Task 2), not Task 7

i18next's typed `t()` surface is derived from `typeof en.json` via module augmentation (see `app/src/locales/i18n.d.ts`). Without the keys, every `t('graph.anchor.reviewNow')` etc. call in Tasks 2/3/6 fails `tsc -b --noEmit`. Adding only `en.json` would break `bundle-parity.test.mjs` between commits. Landing all four locale bundles in the Task 2 commit keeps the tree green at every commit boundary. Task 7 is then folded into Task 2.

### D-04: PodcastScreen auto-opens All Podcasts sub-view when filter is set

The filter banner lives in the All Podcasts sub-view (not the default today's-player view). If the user arrived from AnchorDetailScreen with `conceptFilterQaIds` set, landing on today's player would hide the filter entirely until they manually tap History. Setting `showAllPodcasts(true)` at mount when conceptFilter is present makes the filter immediately visible.

### D-05: Surgical route-state clear in PodcastScreen

`location.state` is shared between this plan's `conceptFilterQaIds / conceptTitle` and the existing Planner concept-insertion (`moveState`). A blanket `navigate(replace, state: null)` would clobber the Planner state mid-flow. The implementation strips ONLY `conceptFilterQaIds` and `conceptTitle` from `state`, preserving any other fields, and sets state to `null` only when nothing else remains.

### D-06: Binary amber tile-badge dot (not 3-color)

Operator-locked rule from CLAUDE.md "feed-tile simplicity" + auto-memory `feedback_tile_simplicity_preference.md`. Tiles already too rich; ONE binary signal — amber dot when concept needs attention (dying/falling/dead), nothing otherwise. The richer 7-color palette lives on AnchorDetailScreen's LeafStateBadge where users have actively navigated to a single concept.

## Deviations from Plan

### [Rule 3 — Blocking] i18n keys landed in Task 2 commit, not Task 7

- **Found during:** Task 2 (first `tsc -b --noEmit` after AnchorDetailScreen edits)
- **Issue:** i18next types are derived from en.json. Without `graph.anchor.reviewNow` etc. defined, every `t('graph.anchor.reviewNow')` call fails type-check with TS2345.
- **Fix:** Added all 17 new keys to all 4 locale bundles inside the Task 2 commit. `bundle-parity.test.mjs` stays green at every commit boundary; Task 7's deliverable (parity + key presence) is satisfied without a separate commit.
- **Files modified:** `app/src/locales/en.json`, `zh.json`, `es.json`, `ja.json`
- **Commit:** `29f59399` (Task 2)

### [Rule 3 — Blocking] Used `questionService.getAll()` instead of `questionService.getById(qaId)` in resolveAnchorId

- **Found during:** Task 1 (smoke test of helper)
- **Issue:** Plan assumed `questionService.getById(id)` returns `Question | undefined` synchronously. Actually returns `Promise<ServiceResult<Question>>`. Async access in a per-render badge resolver would either require Suspense or stale-state-on-mount workarounds.
- **Fix:** Use `questionService.getAll({ includeFlagged: true }).find((q) => q.id === id)` which is sync (localStorage parse, ~<1ms). Same pattern as `useTrellisData`.
- **Files modified:** `app/src/lib/anchor-resolution.ts`
- **Commit:** `7187fc3c` (Task 1)

### [Rule 3 — Blocking] Hooks declared before early-return in AnchorDetailScreen

- **Found during:** Task 2 (first render test simulation in head)
- **Issue:** Adding `useState` + `useEffect` AFTER the existing `!anchor || !anchor.isAnchorNode` early-return violates Rules of Hooks when `useQuestions` async data flips `anchor` from undefined→defined on the same component instance.
- **Fix:** Moved setTick + eventBus.subscribe calls BEFORE the early-return.
- **Files modified:** `app/src/screens/AnchorDetailScreen.tsx`
- **Commit:** `29f59399` (Task 2)

### [Rule 2 — Critical] Symlinked node_modules into the worktree

- **Found during:** Task 1 smoke test (`Cannot find package '@capacitor/core'`)
- **Issue:** The agent worktree under `.claude/worktrees/` had no `node_modules`. Direct `.ts` imports in node tests require the full dependency tree.
- **Fix:** `ln -s /Users/Code/EchoLearn/app/node_modules .` inside the worktree's `app/` directory. The main repo's node_modules satisfies all transitive deps (same package.json + lockfile checked in at base commit).
- **Files modified:** N/A (symlink, not tracked)
- **Note:** This is per-worktree environment setup, not a code change. The symlink is ignored by git (the .gitignore for app/node_modules covers it).

## Threat Flags

None. Phase 51-01 adds zero new network endpoints, no auth surfaces, no file-system access, no schema changes. All data joins are local-only sync localStorage reads. Navigation deep-links to `/anchor/:id` use the existing route — no new routes registered.

## Self-Check: PASSED

Verified files exist:
- FOUND: app/src/lib/anchor-resolution.ts
- FOUND: app/src/components/concept/LeafStateBadge.tsx
- FOUND: app/tests/lib/anchor-resolution.test.mjs
- FOUND: app/tests/screens/AnchorDetailScreen.recovery.test.mjs
- FOUND: app/tests/components/InfoFlow.badge-nav.test.mjs
- FOUND: app/tests/screens/SavedScreen.routeFilter.test.mjs

Verified commits exist:
- FOUND: 7187fc3c (Task 1: helper + LeafStateBadge)
- FOUND: 29f59399 (Task 2: AnchorDetailScreen + i18n)
- FOUND: c8d7492f (Task 3: InfoFlow badges)
- FOUND: 08fbca69 (Task 4: PostDetailScreen)
- FOUND: 131bd97f (Task 5: SavedScreen)
- FOUND: 57e4b90c (Task 6: PodcastScreen)
- FOUND: b939f8e9 (Task 8: tests)

Verified gates:
- `tsc -b --noEmit` from `app/` exits cleanly (0 errors)
- `node --test tests/locales/bundle-parity.test.mjs` passes (en/zh/es/ja parity)
- `node --test tests/locales/missing-key.test.mjs` passes (EN fallback)
- `npm test` from `app/` passes (1304 main + 149 actions = 1453 tests, all pass)
- No useConceptDashboard hook in any modified file
- No 4-tab AnchorDetailScreen restructure
- All AnchorDetailScreen identity-preservation tests pass

## TDD Gate Compliance

Plan frontmatter type is `execute`, not `tdd`, so the per-plan RED/GREEN/REFACTOR cycle doesn't apply. Tasks 1 and 8 had `tdd="true"` and both followed the TDD intent: Task 1's test file lands in the same commit as the helper (RED+GREEN combined since the helper is small and pure); Task 8's tests are source-reading invariants that lock the existing implementation against future regression.
