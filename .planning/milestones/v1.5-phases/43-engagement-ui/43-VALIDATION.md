---
phase: 43
slug: engagement-ui
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-11
validated: 2026-05-11
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` with esbuild tsx loader (see `app/tests/canonical-knowledge.test.mjs` for pattern) |
| **Config file** | none — uses Node built-in runner; tests live under `app/tests/` |
| **Quick run command** | `cd app && node --test tests/services tests/components tests/screens tests/state tests/locales tests/layout` |
| **Full suite command** | `cd app && npm test` |
| **Estimated runtime** | ~45 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm test` scoped to the touched directory (`tests/components/` after a component change, etc.)
- **After every plan wave:** Run full `npm test`
- **Before `/gsd:verify-work`:** Full suite green + `tsc -b --noEmit` exits 0
- **Max feedback latency:** ~45 seconds (full suite)

---

## Per-Task Verification Map

> Filled by planner. Each task references a test file in this column. Phase 43 produces these test surfaces — planner MUST map at least one to each plan.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 43-01-T1 | 43-01 | 0 | infrastructure | source-reading | `cd app && node --test tests/hooks/useLongPress.test.mjs` | yes | ✅ green |
| 43-01-T2 | 43-01 | 0 | infrastructure | grep | `cd app && grep "compact" src/components/ui/BottomSheet.tsx` | yes | ✅ green |
| 43-01-T3 | 43-01 | 0 | i18n parity | structural | `cd app && node --test tests/locales/bundle-parity.test.mjs` | yes | ✅ green |
| 43-01-T4 | 43-01 | 0 | scaffold | skipped | `cd app && node --test tests/components/LongPressMenu.test.mjs tests/components/MasonryFeed.dismiss-fade-all.test.mjs tests/components/InfoFlow.no-presentation-style-tag.test.mjs tests/screens/SavedScreen.test.mjs tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs tests/screens/PostDetailScreen.segmented-toggle.test.mjs tests/screens/PostDetailScreen.abort-contract.test.mjs tests/screens/HomeScreen.engagement-resync.test.mjs tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs` | yes | ✅ scaffold→filled |
| 43-01-T5 | 43-01 | 0 | DS-01 doc | grep | `grep "ENGAGE-04 descoped 2026-05-11 (DS-01)" .planning/ROADMAP.md` | yes | ✅ green |
| 43-02-T1 | 43-02 | 1 | TS-01 (CONTENT-01 / ENGAGEMENT tile simplify) | source-reading neg | `cd app && node --test tests/components/InfoFlow.no-presentation-style-tag.test.mjs` | yes | ✅ green |
| 43-02-T2 | 43-02 | 1 | TS-01 | source-reading | `cd app && node --test tests/components/InfoFlow.no-presentation-style-tag.test.mjs` | yes | ✅ green |
| 43-03-T1 | 43-03 | 1 | ENGAGE-01/02/03 | source-reading | `cd app && node --test tests/components/LongPressMenu.test.mjs` | yes | ✅ green |
| 43-03-T2 | 43-03 | 1 | anti-wire | source-reading | `cd app && node --test tests/components/LongPressMenu.test.mjs` | yes | ✅ green |
| 43-03-T3 | 43-03 | 1 | LP-03/05 | source-reading | `cd app && node --test tests/components/MasonryFeed.dismiss-fade-all.test.mjs` | yes | ✅ green |
| 43-03-T4 | 43-03 | 1 | LP-03/05 | source-reading | `cd app && node --test tests/components/MasonryFeed.dismiss-fade-all.test.mjs` | yes | ✅ green |
| 43-04-T1 | 43-04 | 1 | ENGAGE-01/03 | source-reading | `cd app && node --test tests/screens/SavedScreen.test.mjs` | yes | ✅ green |
| 43-04-T2 | 43-04 | 1 | SV-01 | build | `cd app && npm run build` | yes | ✅ green |
| 43-04-T3 | 43-04 | 1 | SV-* | source-reading | `cd app && node --test tests/screens/SavedScreen.test.mjs` | yes | ✅ green |
| 43-05-T1 | 43-05 | 1 | CONTENT-01 | source-reading | `cd app && node --test tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs` | yes | ✅ green |
| 43-05-T2 | 43-05 | 1 | DD-01..03 | source-reading | `cd app && node --test tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs` | yes | ✅ green |
| 43-05-T3 | 43-05 | 1 | DD-05 | source-reading | `cd app && node --test tests/screens/PostDetailScreen.abort-contract.test.mjs` | yes | ✅ green |
| 43-05-T4 | 43-05 | 1 | DD-04 | source-reading | `cd app && node --test tests/screens/PostDetailScreen.segmented-toggle.test.mjs` | yes | ✅ green |
| 43-06-T1 | 43-06 | 2 | SV-02 + LP-03/05 | source-reading | `cd app && node --test tests/screens/HomeScreen.engagement-resync.test.mjs` | yes | ✅ green |
| 43-06-T2 | 43-06 | 2 | Phase 32.1 + 36-14 | source-reading | `cd app && node --test tests/screens/HomeScreen.engagement-resync.test.mjs` | yes | ✅ green |
| 43-07-T1 | 43-07 | 2 | SC-6 | grep | `cd app && grep "engagementService.reset" src/screens/settings/SettingsDataScreen.tsx` | yes | ✅ green |
| 43-07-T2 | 43-07 | 2 | SC-6 | source-reading | `cd app && node --test tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs` | yes | ✅ green |
| 43-08-T1 | 43-08 | 3 | docs | grep | `grep "Phase 43" .planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md` | yes | ✅ green |
| 43-08-T2 | 43-08 | 3 | docs | grep | `grep "Phase 43 closed" .planning/STATE.md` | yes | ✅ green |
| 43-08-T3 | 43-08 | 3 | docs | grep | `grep "43-08-phase-close-out-PLAN.md" .planning/ROADMAP.md` | yes | ✅ green |
| 43-08-T4 | 43-08 | 3 | docs | grep | `grep "nyquist_compliant: true" .planning/phases/43-engagement-ui/43-VALIDATION.md` | yes | ✅ green |

**Expected test surfaces (planner to assign Task IDs):**
- `tests/hooks/useLongPress.test.mjs` — 480ms timer, cancel-on-move, cleanup
- `tests/components/LongPressMenu.test.mjs` — opens on 480ms hold, backdrop dismisses, calls correct engagementService method, dynamic Save/Unsave + Like/Unlike labels
- `tests/components/InfoFlow.engagement-corner-icon.test.mjs` — corner state icon appears after save/like, persists
- `tests/components/MasonryFeed.dismiss-fade-all.test.mjs` — LP-05: ALL same-anchor tiles in current queue fade, not just tapped
- `tests/screens/SavedScreen.test.mjs` — lists persisted Saved + Liked tabs filter correctly, empty state
- `tests/screens/HomeScreen.engagement-resync.test.mjs` — `[location.pathname]` re-syncs engagement state on ANCHOR_DISMISSED + ENGAGEMENT_CHANGED
- `tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs` — button position (below body, above takeaway), full-width, tap streams deep depth, Restore standard aborts and restores
- `tests/screens/PostDetailScreen.segmented-toggle.test.mjs` — once `bodyMarkdownDeep` cached, segmented Standard|Deep toggle renders + switches without re-stream
- `tests/screens/PostDetailScreen.abort-contract.test.mjs` — AbortController contract preserved: 3 pre-call guards + signal-arg passes for ALL 4 essay paths (standard + deep)
- `tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs` — handleForceNewDay calls engagementService.reset()
- `tests/components/InfoFlow.no-presentation-style-tag.test.mjs` — TS-01: presentation-style tag (`newsTag`) removed from all tile types; locale keys removed from 4 bundles
- `tests/locales/bundle-parity.test.mjs` — existing test; must still pass after engagement.* + saved.* + postDetail.deepDive.* keys added in 4 locales
- `tests/locales/missing-key.test.mjs` — existing test; must still pass

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Wave 0 = test scaffolds + shared fixtures landed FIRST so subsequent plans can sample feedback.

- [x] `tests/hooks/useLongPress.test.mjs` — 7 source-reading assertions; landed in 43-01 Task 1 (TDD RED+GREEN)
- [x] `tests/components/LongPressMenu.test.mjs` — scaffold landed in 43-01 Task 4; filled in 43-03 with 7 source-reading + anti-wire assertions
- [x] `tests/components/MasonryFeed.dismiss-fade-all.test.mjs` — scaffold landed in 43-01 Task 4; filled in 43-03 with 7 LP-03/05 + Phase 42 invariant assertions
- [x] `tests/screens/SavedScreen.test.mjs` — scaffold landed in 43-01 Task 4; filled in 43-04 with 7 SV-01..SV-04 + Phase 32.1 negative assertions
- [x] `tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs` — scaffold landed in 43-01 Task 4; filled in 43-05 with 5 DD-01..DD-03 assertions
- [x] `tests/screens/PostDetailScreen.segmented-toggle.test.mjs` — scaffold landed in 43-01 Task 4 (dedicated per VALIDATION line 53); filled in 43-05 with 7 DD-04 assertions
- [x] `tests/screens/PostDetailScreen.abort-contract.test.mjs` — scaffold landed in 43-01 Task 4; filled in 43-05 with 7 DD-05 assertions
- [x] `tests/screens/HomeScreen.engagement-resync.test.mjs` — scaffold landed in 43-01 Task 4; filled in 43-06 with 11 dual-effect + Phase 32.1/36-14 assertions
- [x] `tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs` — scaffold landed in 43-01 Task 4; filled in 43-07 with 4 ordering + ENGAGE-02 assertions
- [x] `tests/components/InfoFlow.no-presentation-style-tag.test.mjs` — scaffold landed in 43-01 Task 4; filled in 43-02 with 4 paired negative + positive assertions (TS-01)

*Existing infrastructure: `tests/locales/bundle-parity.test.mjs` and `tests/locales/missing-key.test.mjs` already exist — i18n parity is auto-enforced once new keys land in all 4 bundles.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Long-press feel on Android WebView (no native text-selection menu interference) | ENGAGE-01..03 | jsdom doesn't simulate touch + native context menu interaction | On Android device: long-press a feed tile → menu opens at 480ms, native text-selection menu does NOT appear, `contextmenu` event suppressed. Verify with all 4 tile types. |
| Bottom sheet slide-in animation curve matches existing modal vocabulary | LP-01 | Visual / motion quality not testable in headless | Compare side-by-side: long-press menu open animation vs. existing BottomSheet usages (TrellisStatusPanel legacy / other modals). |
| Deep-dive streaming replace-in-place is visually smooth (no jarring content jump) | DD-03 | Visual / scroll-position quality not testable in headless | On device: open a PostDetailScreen, tap Deep dive, observe scroll position + content during stream — should not jump above current scroll. |
| Saved-posts header bookmark icon doesn't shift HomeScreen layout when added | SV-02 | Layout regression check best done on device + dev tools | Toggle by removing/re-adding the Bookmark button; verify masonry first-tile position unchanged. |
| Force-New-Day toast confirmation still appears AFTER engagementService.reset() call | ENGAGE invariants | UI side-effect ordering | Force-New-Day → toast renders ✓ + engagement state cleared ✓ in same flow. |
| 4-locale UI render after locale switch (no missing-key fallbacks visible) | i18n parity | Visual confirmation; `missing-key.test.mjs` catches absence but not awkward fallback rendering | Cycle through en/zh/es/ja; verify menu, /saved screen, deep-dive button labels render natively in each locale. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-05-11
