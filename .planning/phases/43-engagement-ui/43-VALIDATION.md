---
phase: 43
slug: engagement-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
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
| TBD | — | — | ENGAGE-01..03 | unit + integration | `cd app && node --test tests/...` | — | ⬜ pending |

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

- [ ] `tests/hooks/useLongPress.test.mjs` — stubs covering 480ms timer behavior (extracted from ChatMessage.tsx:119-140)
- [ ] `tests/components/LongPressMenu.test.mjs` — stubs covering bottom-sheet flow (LP-01..LP-04)
- [ ] `tests/components/MasonryFeed.dismiss-fade-all.test.mjs` — stub covering LP-05 (all same-anchor tiles fade)
- [ ] `tests/screens/SavedScreen.test.mjs` — stubs covering SV-01..SV-04 (route, tabs, empty)
- [ ] `tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs` — stubs covering DD-01..DD-04
- [ ] `tests/screens/PostDetailScreen.abort-contract.test.mjs` — stubs PRESERVING DD-05 invariants
- [ ] `tests/components/InfoFlow.no-presentation-style-tag.test.mjs` — stub covering TS-01

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
