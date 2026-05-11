---
phase: 43-engagement-ui
status: complete
completed: 2026-05-11
requirements_closed: [ENGAGE-01, ENGAGE-02, ENGAGE-03, CONTENT-01]
requirements_descoped: [ENGAGE-04]
---

# Phase 43 — Engagement UI — Phase Summary

**Closed:** 2026-05-11
**Plans:** 8 / 8 complete
**Atomic commits:** 30 per-task commits across 43-01..43-07 (plus this Wave-3 close-out plan's 4 commits = ~34 total Phase 43 commits)
**Requirements closed:** ENGAGE-01, ENGAGE-02, ENGAGE-03, CONTENT-01 (user-facing UI surfaces shipped on top of Phase 39 service)
**Requirements descoped:** ENGAGE-04 (DS-01, 2026-05-11 — operator framing "tiles already too rich")

## Executive Summary

Phase 43 wired the Phase 39 engagement service (savePost / likePost / dismissAnchor) into the Phase 42 masonry feed and PostDetailScreen, shipping six user-visible surfaces in a single phase:

1. **Long-press contextual menu** — 480ms hold on any feed tile opens a bottom-sheet with Like / Save / Not interested rows. State-aware label flip (Save → Unsave when already saved). Toast confirmation + persistent corner-icon overlay on the tile.
2. **`/saved` view with Saved | Liked tabs** — header-icon entry from `/home`, single-column archive list mirroring `PostHistoryScreen` shape; ENGAGEMENT_CHANGED-driven in-place resync.
3. **Deep Dive button + Standard | Deep segmented toggle** — full-width subtle CTA below essay above takeaway; tap streams `depth: 'deep'` (350-600w) variant in-place; cached `bodyMarkdownDeep` exposes a segmented toggle on subsequent visits with no re-stream.
4. **HomeScreen engagement wiring** — Bookmark header icon → `/saved`, LongPressMenu host, dual-effect ANCHOR_DISMISSED resync (stable listener + `[location.pathname]` re-read), ENGAGEMENT_CHANGED → engagementVersion bump driving MasonryFeed corner-icon refresh.
5. **Force-New-Day engagement reset extension** — `engagementService.reset()` call added inside `SettingsDataScreen.handleForceNewDay`, ordered after `dailyReadService.reset()` and before the success toast.
6. **Presentation-style tag trim (TS-01)** — operator-bounded tile simplification: removed the "NEWS" chip from news tiles in `InfoFlow.tsx` + dropped the `infoFlow.newsTag` key from all 4 locale bundles.

Structure was **Wave 0** (43-01 shared infra: useLongPress hook + BottomSheet compact prop + 14 i18n keys × 4 locales + 9 test scaffolds + DS-01 doc-state edits) → **Wave 1** (43-02..43-05 parallel-safe across distinct file-touch surfaces) → **Wave 2** (43-06 + 43-07 — HomeScreen + Settings, also parallel-safe with each other) → **Wave 3** (43-08 close-out).

A plan-checker revision on 2026-05-11 folded the DS-01 ROADMAP/REQUIREMENTS doc edits forward from Wave 2 into Wave 0 (43-01 Task 5) so all Wave-1 executors read consistent descope state during execution — no mid-phase doc drift on parallel agents.

## Plan Table

| Plan ID | Slug                                          | Decisions Closed                                                                              | Tests                                                        | Commits |
| ------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------- |
| 43-01   | shared-infra-and-locales                      | useLongPress + BottomSheet compact + 14 i18n keys × 4 + 9 scaffolds + DS-01 doc reconciliation | 1 new source-reading + 2 parity counterweights green         | 7       |
| 43-02   | trim-presentation-style-tag                   | TS-01                                                                                         | 1 source-reading (negative + positive paired)                | 3       |
| 43-03   | longpress-menu-and-masonry-integration        | LP-01..LP-05                                                                                  | 2 source-reading (LongPressMenu anti-wire + MasonryFeed dismiss-fade) | 5       |
| 43-04   | saved-screen-and-route                        | SV-01..SV-04                                                                                  | 1 source-reading (SavedScreen 7 assertions)                  | 4       |
| 43-05   | postdetail-deep-dive-trigger                  | DD-01..DD-05                                                                                  | 3 source-reading (deep-dive-trigger + segmented-toggle + abort-contract) | 5       |
| 43-06   | homescreen-wiring                             | SV-02 entry + LP-03/05 dual-effect ANCHOR_DISMISSED + ENGAGEMENT_CHANGED                      | 1 source-reading (engagement-resync 11 assertions)           | 3       |
| 43-07   | force-new-day-engagement-reset                | SC-6 (DS-01 doc edits moved to 43-01 Wave 0 per revision 2026-05-11)                          | 1 source-reading (force-new-day-engagement-reset 4 assertions) | 3       |
| 43-08   | phase-close-out                               | docs only (PHASE-SUMMARY + STATE + ROADMAP + VALIDATION sign-off)                             | n/a                                                          | 4       |

**Total atomic commits across phase:** 34 (30 across 43-01..43-07 + 4 from this close-out plan).
**Average commits per plan:** ~4.25.
**Largest plan:** 43-01 (7 commits — useLongPress TDD RED+GREEN + BottomSheet + i18n + scaffolds + DS-01 docs + metadata).
**Smallest plans:** 43-02 + 43-06 + 43-07 (3 commits each).

## Success-Criteria Coverage

| SC                                          | Status   | Closed by                                                                | Evidence                                                                                              |
| ------------------------------------------- | -------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **SC-1 (long-press menu)**                  | Closed   | 43-03 (LongPressMenu component + MasonryFeed TileWrapper) + 43-06 (host) | `tests/components/LongPressMenu.test.mjs` (7 assertions incl. anti-wire); `MasonryFeed.dismiss-fade-all.test.mjs` (7 assertions) |
| **SC-2 (saved view)**                       | Closed   | 43-04 (SavedScreen + `/saved` route) + 43-06 (Bookmark icon entry)       | `tests/screens/SavedScreen.test.mjs` (7 assertions)                                                   |
| **SC-3 (Deep Dive button)**                 | Closed   | 43-05 (button + segmented toggle + dedicated deepAbortControllerRef)     | `tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs` (5 DD-01..03); `…segmented-toggle.test.mjs` (7 DD-04); `…abort-contract.test.mjs` (7 DD-05) |
| **SC-4 (N-connections label)**              | Descoped | DS-01 (43-01 Task 5 Wave-0 doc edits per revision 2026-05-11)            | ROADMAP SC-4 struck (italicized descope marker); REQUIREMENTS.md ENGAGE-04 row moved to Out of Scope + traceability + counts updated |
| **SC-5 (ANCHOR_DISMISSED resync)**          | Closed   | 43-06 (HomeScreen dual-effect ANCHOR_DISMISSED + `[location.pathname]`)  | `tests/screens/HomeScreen.engagement-resync.test.mjs` (11 assertions; Tests 1–5 cover the dual-effect chain)           |
| **SC-6 (Force-New-Day engagement reset)**   | Closed   | 43-07 (SettingsDataScreen.handleForceNewDay extension)                   | `tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs` (4 assertions incl. ordering invariant) |

**Plus folded scope SC-7 (TS-01 tile simplification — closed by 43-02):** `tests/components/InfoFlow.no-presentation-style-tag.test.mjs` (4 paired negative + positive assertions).

## Invariant Audit (Source-Reading Invariants Locked by Phase 43)

The phase added the following structural guarantees enforced by source-reading invariant tests. Each is a recurrence-prevention contract on top of the live code path:

- **LongPressMenu.tsx never references `CONCEPT_EXPLORED`, `eventBus.emit`, or `dailyReadService.markExplored`** — defense-in-depth anti-wire invariant. Engagement events are the ONLY emits from the menu (`engagementService.savePost/likePost/dismissAnchor` and the events those services emit). Same pattern as Phase 39/40 anti-wire tests. (43-03)
- **MasonryFeed.tsx preserves all Phase 42 invariants** — zero `column-count`, zero `break-inside`, zero `will-change`, zero `perspective`; height-accumulating split intact; `<MotionConfig reducedMotion="user">` still wraps; navigation-only video tiles (UAT-7+8) still enforced; comment de-collision around Detector D preserved (no literal `CONCEPT_EXPLORED` token surface in MasonryFeed source). (43-03)
- **InfoFlow.tsx no longer contains the `infoFlow.newsTag` t-call AND no locale bundle contains the `newsTag` key** — paired negative-grep across 1 source + 4 locales locks the TS-01 simplification both in code and locale data. Positive structural assertions on the preserved flex container + sourceQuestionTitles chip guard against over-deletion. (43-02)
- **SavedScreen.tsx renders Header with `backTo='/home'`** which auto-portals to `document.body` via `Header.tsx`'s `insideSwipeTab` detector; no transform / will-change / perspective on Header ancestors in the React tree. Phase 32.1 portal pattern preserved. (43-04)
- **PostDetailScreen.tsx maintains at least 4 pre-call AbortController guards + at least 5 signal-arg passes + cache-write guard on `patchPostEssayInCache`** — Phase 41-02 D-08 contract extended (3 → 16 guards, 4 → 6 signal-arg passes after Deep Dive added) without regression. `bodyMarkdownDeep` cache is NEVER written from a partial / aborted stream — cache-write fires only when `!ctrl.signal.aborted`. Cleanup cascade aborts BOTH controllers (existing + deepAbortControllerRef) on unmount + postId change. (43-05)
- **PostDetailScreen segmented-toggle onChange does NOT invoke `generatePostEssay` or `handleStartDeepDive`** — pure client-side `setActiveVariant(variant)` state mutation. Once `bodyMarkdownDeep` is cached, switching between Standard and Deep is free (no re-stream). DD-04 invariant. (43-05)
- **HomeScreen.tsx has a stable ANCHOR_DISMISSED listener (deps `[]`) AND a `[location.pathname]` re-read via `engagementService.getDismissedAnchorIds()`** — canonical Phase 36-14 sibling-effects shape. Effect A handles fast-path in-the-moment dismiss (user on `/home`); Effect B handles cross-screen dismiss return (user dismissed from PostDetail / SavedScreen → navigates back). Both filter `dailyPosts` in-place via `setDailyPosts(prev => prev.filter(...))`. NEITHER calls `conceptFeedService.getDailyPosts()` (LP-05 operator decision). (43-06)
- **HomeScreen.tsx's existing Phase 36-14 `[location.pathname]` effects (exploredAnchors resync + warm-start re-fallback) are preserved byte-for-byte** — the new Phase 43 Effect B joins as a sibling, not a replacement. `[location.pathname]` effect count went from 2 → 3 (matches the canonical Phase 36-14 sibling-effects shape). (43-06)
- **SettingsDataScreen.tsx `engagementService.reset()` is ordered after `dailyReadService.reset()` AND before the success toast inside the `handleForceNewDay` function body** — function-anchor extraction (`const handleForceNewDay` → `  };` body terminator) ensures the test cannot false-positive on the unrelated `dailyReadService.reset()` callsite in the "Reset Today" button handler at line ~306. Phase 36-14/15 anchor-pair pattern preserved. (43-07)
- **ROADMAP.md + REQUIREMENTS.md DS-01 descope reflected from Wave 0** — Phase 43 Requirements line lists ENGAGE-01..03 + CONTENT-01 + "ENGAGE-04 descoped 2026-05-11 (DS-01)"; SC-4 italicized as descope marker (5 other SC items intact); ENGAGE-04 active row moved to Out of Scope with rationale + reopen path (canonical-knowledge.service.ts:222 connectionCount); traceability matrix row flipped from Pending → Out of Scope (DS-01, 2026-05-11). (43-01 Task 5)

## Patterns Established

- **Wave-0 scaffold cadence** (skip-style stubs land before Wave-1 implementation so consumer plans fill assertions in-place) — extends Phase 27/37 scaffolding discipline into engagement-UI test surface.
- **Hook-out-of-loop refactor (TileWrapper pattern)** — when `useXxx` hooks need per-element binding inside a render loop, extract a parent-defined wrapper component that calls the hook at its own top level. Cleaner than memoized factory functions; preserves rules-of-hooks.
- **engagementVersion bump prop** — HomeScreen-owned re-render trigger keyed to `ENGAGEMENT_CHANGED`, propagated to MasonryFeed via `useMemo` dep array. Leaf cards stay purely props-driven (Phase 42 D-04 leaf-discipline). Avoids per-tile event-bus subscription.
- **AnimatePresence-per-column wrapping** — preserves the height-accumulating column split (Phase 42 D-02 invariant) while still triggering coordinated exit transitions for LP-05's same-anchor cascade.
- **Dedicated AbortController per logical stream (Pitfall 3)** — each independently-cancellable streaming flow owns its own ref; cleanup cascade aborts all controllers on unmount + postId change. Multi-controller pattern formalized.
- **Defer-to-streamer + cache-write guard** — `patchPostEssayInCache` fires only when `!signal.aborted`, guaranteeing `bodyMarkdownDeep` cache is never written from a partial / aborted stream.
- **Dual sibling-effects (canonical Phase 36-14 shape)** — stable event listener (deps `[]`) + `[location.pathname]` resync coexist as siblings; in-place filter on `dailyPosts` is the LP-05 operator decision (NEVER refetch from `conceptFeedService.getDailyPosts()`).
- **Sub-screen ENGAGEMENT_CHANGED re-sync via useEffect subscribe + `return unsub` cleanup** — sub-screen lifecycle handles cleanup automatically; no manual unsubscribe ref dance needed.
- **Source-reading test anchored on declaration (`const X = useCallback`) not bare identifier** — prevents region-slice false-positives from JSDoc comment occurrences. Same lesson learned in 43-05 abort-contract test.
- **Component-local sub-component extraction (TabButton + SavedRow + EmptyState)** — preferred over inline JSX when tab state branches the entire list rendering.
- **Dedicated test file per sub-decision (VALIDATION.md line 53 pattern)** — DD-04 in `segmented-toggle.test.mjs`, DD-01..03 in `deep-dive-trigger.test.mjs`, DD-05 in `abort-contract.test.mjs` — clear failure attribution at test-run time.

## Carry-Over Notes / UAT Items

Visual + device-only behaviors NOT testable in JSDOM that should be verified during operator UAT:

- **Long-press feel on Android WebView** — no native text-selection menu interference; menu opens at 480ms across all 4 tile types (image / text-art / video / news).
- **Bottom-sheet slide-in animation curve consistency** — compare side-by-side with existing modal vocabulary (TrellisStatusPanel and any other bottom-sheet usages).
- **Deep-stream replace-in-place is visually smooth** — no jarring content jump or scroll-position drift during stream chunks arriving.
- **Spanish dismiss-toast width** — Spanish toast copy "Entendido — no volverás a ver esto" is ~20% longer than English; verify `ToastContainer` doesn't wrap awkwardly on narrow Android screens.
- **4-locale UI render after locale switch** — cycle through en / zh / es / ja; verify long-press menu labels, /saved screen + empty states, deep-dive button + segmented control labels render natively (no missing-key fallbacks visible).
- **HomeScreen Bookmark icon position** — verify it doesn't shift the masonry first-tile position when added; toggle by temporarily removing the button to confirm layout invariance.
- **Force-New-Day toast confirmation appears AFTER engagementService.reset()** — order-of-operations side effect; the ordering invariant test asserts source-level ordering, but UAT verifies the runtime UX (toast renders, state cleared, no flicker).

### Future-Phase Reopen Path (ENGAGE-04 if operator changes mind)

The `buildCandidateContextPack` helper at `app/src/services/canonical-knowledge.service.ts:222` is unchanged and ready to consume. To reopen ENGAGE-04 in a future phase:

1. Add a `connectionCount?: number` field on `DailyPost`.
2. Populate it in `refillQueue` from `candidatePack.length` (or similar derivation).
3. Render the micro-label in tile leaf components.
4. Re-flip `REQUIREMENTS.md` ENGAGE-04 row from Out of Scope back to active + reset the traceability matrix.

No service-contract changes needed. Service-layer infrastructure is intact.

### Deferred Polish (Out of Phase 43 Scope, Per CONTEXT.md `<deferred>`)

- Broader tile-metadata audit beyond TS-01 (news source attribution, video channel byline, news date stamp).
- Like-based feed re-ranking / quality feedback loop.
- Dismiss cooldown (re-evaluate dismissed concepts after N days).
- Cross-device engagement sync (requires client/server split).
- Inline Undo toast for dismiss (operator-UAT-gated).
- Bulk operations on Saved / Liked.
- Search / filter inside Saved + Liked tabs.
- `resetDismissedOnly()` partial-reset API.
- Surface `deepError` via toast / inline retry button (43-05 captured but doesn't render).
- Scroll-position preservation across activeVariant toggles (43-05).
- CLAUDE.md addition documenting multi-controller cleanup cascade + DD-05 cache-write guard.

## Commit Cadence Audit

| Metric                           | Value                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Total atomic commits (43-01..07) | 30 (verified via `git log --oneline --all | grep -cE "\(43-0[1-7]\)"` = 30)                       |
| Total atomic commits (43-08)     | 4 (this plan's per-task commits — PHASE-SUMMARY + STATE + ROADMAP + VALIDATION)                    |
| Phase total                      | ~34 commits                                                                                        |
| Average per plan                 | ~4.25                                                                                              |
| Largest plan                     | 43-01 (7 commits — TDD RED+GREEN for useLongPress + BottomSheet + i18n + scaffolds + DS-01 + metadata) |
| Smallest plans                   | 43-02 + 43-06 + 43-07 (3 commits each)                                                             |
| Cadence pattern                  | Per-file atomic + paired source+test (Phase 37 D-03; reinforced in 39/40/41/42)                    |

The 7-commit count on 43-01 includes Task 1's TDD RED → GREEN split and the final metadata commit; the plan body anticipated ~5 logical task commits. The 4-5 commit range on 43-03 and 43-05 includes one source commit + one test commit per major surface (LongPressMenu + MasonryFeed for 43-03; Deep Dive source + 3 dedicated test files for 43-05). The 3-commit count on 43-02 / 43-06 / 43-07 is one source commit + one test commit + one metadata commit — the canonical "small wave-1 plan" shape.

Atomic cadence held throughout. No squash commits, no amends after push.

## Sub-Plan Summaries

- [43-01-shared-infra-and-locales-SUMMARY.md](./43-01-shared-infra-and-locales-SUMMARY.md) — useLongPress hook + BottomSheet compact prop + 14 i18n keys × 4 locales + 9 Wave-0 test scaffolds + DS-01 doc reconciliation (Wave 0 foundation)
- [43-02-trim-presentation-style-tag-SUMMARY.md](./43-02-trim-presentation-style-tag-SUMMARY.md) — TS-01 trim of `infoFlow.newsTag` chip from news tiles + 4 locale bundles (Wave 1 — parallel-safe)
- [43-03-longpress-menu-and-masonry-integration-SUMMARY.md](./43-03-longpress-menu-and-masonry-integration-SUMMARY.md) — LongPressMenu component (LP-01..LP-04) + MasonryFeed TileWrapper extraction + AnimatePresence column wrapping for LP-05 (Wave 1)
- [43-04-saved-screen-and-route-SUMMARY.md](./43-04-saved-screen-and-route-SUMMARY.md) — SavedScreen with Saved | Liked tabs (SV-01..SV-04) + `/saved` route registration (Wave 1)
- [43-05-postdetail-deep-dive-trigger-SUMMARY.md](./43-05-postdetail-deep-dive-trigger-SUMMARY.md) — Deep Dive button + Standard | Deep segmented toggle + dedicated deepAbortControllerRef extending DD-05 contract (Wave 1)
- [43-06-homescreen-wiring-SUMMARY.md](./43-06-homescreen-wiring-SUMMARY.md) — HomeScreen Bookmark header icon + LongPressMenu host + dual-effect ANCHOR_DISMISSED resync + ENGAGEMENT_CHANGED bump (Wave 2)
- [43-07-force-new-day-engagement-reset-SUMMARY.md](./43-07-force-new-day-engagement-reset-SUMMARY.md) — SettingsDataScreen.handleForceNewDay extended with engagementService.reset() (Wave 2)

## Test Baseline

Pre-Phase-43 baseline (post-42-08): `npm test` 766/772 main pass + 16/16 actions pass; the 5–6 main failures are pre-existing carry-overs from earlier phases (`concept-feed.test.mjs` ERR_MODULE_NOT_FOUND extensionless import, needsRefill 16-threshold stale, `walkDerivedList(16, ...)` constant stale, `getVineColor` date-dependent, postQueueService construction).

Post-Phase-43 baseline: same 5–6 pre-existing failures unchanged; **all 43-01..43-07 new tests green** (~50+ new test cases across 9 source-reading test files). `tsc -b --noEmit` exits 0 throughout the phase; `npm run build` exits 0 (1.73s, ~1.29 MB bundle).

## Ready for `/gsd:verify-work`

Phase 43 is structurally complete:

- All 8 plans landed with per-task atomic commits.
- All 4 user-facing requirements (ENGAGE-01..03 + CONTENT-01) shipped end-to-end (service + UI).
- ENGAGE-04 cleanly descoped (DS-01) with doc-state reflected across ROADMAP + REQUIREMENTS from Wave 0.
- VALIDATION.md sign-off complete (43-08 Task 4); `nyquist_compliant: true`.
- STATE.md current position reflects "Phase 43 closed" (43-08 Task 2).
- ROADMAP.md Phase 43 plans-list filled with all 8 checkboxes; progress table row updated (43-08 Task 3).

No carry-overs into Phase 44 / 45. Manual UAT items are device-only verifications listed above; not blockers for `/gsd:verify-work` automated gates.

---
*Phase: 43-engagement-ui*
*Closed: 2026-05-11*
