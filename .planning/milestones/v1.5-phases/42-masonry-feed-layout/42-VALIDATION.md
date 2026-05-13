---
phase: 42
slug: masonry-feed-layout
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-09
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` (per CLAUDE.md "Test framework") |
| **Config file** | None — `app/package.json` test scripts |
| **Quick run command** | `cd app && node --test tests/components/MasonryFeed.layout.test.mjs tests/components/MasonryFeed.celebration.test.mjs` |
| **Full suite command** | `cd app && npm test` (runs `test:main` then `test:actions`) |
| **Estimated runtime** | ~3-5s quick, ~30s full |

---

## Sampling Rate

- **After every task commit:** Run quick command (≤ 5s)
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green AND `cd app && npx tsc -b --noEmit` exit 0
- **Max feedback latency:** 5 seconds per task

---

## Per-Task Verification Map

> Test files filled by gsd-planner once task IDs are assigned. Reference shape from RESEARCH.md "Phase Requirements → Test Map" section.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 42-05-T1 | 42-05 | 3 | MASONRY-01 | source-reading + behavioral | `node --test tests/components/MasonryFeed.layout.test.mjs` | ✅ created plan 42-05 | ✅ green |
| 42-03-T1+T2 | 42-03 | 2 | MASONRY-01 | source-reading | `node --test tests/lib/no-card-slide-in.test.mjs` | ✅ created plan 42-05 (test); plan 42-03 made it pass | ✅ green |
| (existing) | (regression) | - | MASONRY-01 | source-reading (regression) | `node --test tests/components/InfoFlow.video-tap-emit.test.mjs` | ✅ pre-existing | ✅ green |
| 42-05-T2 | 42-05 | 3 | MASONRY-02 | source-reading | `node --test tests/components/MasonryFeed.celebration.test.mjs` | ✅ created plan 42-05 | ✅ green |
| 42-05-T3 | 42-05 | 3 | MASONRY-02 | source-reading | `node --test tests/screens/HomeScreen.no-more-posts-toast.test.mjs` | ✅ created plan 42-05 | ✅ green |
| (existing) | (regression) | - | MASONRY-02 | source-reading (regression) | `node --test tests/locales/bundle-parity.test.mjs` | ✅ pre-existing | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/components/MasonryFeed.layout.test.mjs` — source-reading + behavioral assertions for MASONRY-01 (height-accumulating split, no `column-count`/`break-inside`, no `transform`/`will-change`/`filter`/`contain`/`perspective` on root or column wrappers, `motion.div` only on leaf tiles)
- [ ] `tests/components/MasonryFeed.celebration.test.mjs` — VineBloomCard renders when `allExplored && layout.nodes.length > 0`; consumes `useTrellisData` (no new service surface)
- [ ] `tests/lib/no-card-slide-in.test.mjs` — negative grep across `app/src/` confirming `card-slide-in` keyframe + 3 callsites removed
- [ ] `tests/screens/HomeScreen.no-more-posts-toast.test.mjs` — source-reading negative assertion (`toast(...noMorePosts...)` gone)
- [ ] No framework install — `node --test` is Node built-in; project already uses it

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scroll position survives `/home` → `/posts/:id` → back | MASONRY-01 (SC-3) | Validated by SwipeTabContainer always-mounted slot architecture; behavioral test would just exercise the architecture, not the user-visible UX | Open `/home`, scroll halfway down feed, tap any post, navigate back. Scroll position must be preserved. |
| framer-motion entrance animation visible on swipe-for-more | MASONRY-01 (SC-4) | RAF/animation timing not deterministic in node:test JSDOM | Trigger swipe-for-more, observe new tiles fade-up with stagger; existing tiles silent |
| Vine-bloom celebration card visual aesthetic | MASONRY-02 (SC-5) | Brand-fit judgment | Force-explore all anchors → confirm celebration card renders at feed bottom, full-width, vine illustration + suggested-tomorrow plan visible |
| `prefers-reduced-motion` honors user OS setting | (UI-SPEC §4 + research finding) | Requires OS-level setting toggle | Set System Preferences → Reduce Motion → ON; reload `/home`; trigger refill; tiles must NOT fade-up (instant render) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-09
