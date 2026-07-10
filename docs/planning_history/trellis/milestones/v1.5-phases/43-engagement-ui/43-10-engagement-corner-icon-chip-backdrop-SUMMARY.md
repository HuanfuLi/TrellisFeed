---
phase: 43-engagement-ui
plan: 10
plan_id: 43-10
slug: engagement-corner-icon-chip-backdrop
subsystem: ui/feed
status: complete
gap_closure: true
parallel_safe: true
tags: [engagement, masonry-feed, dark-mode, css-vars, gap-closure, cosmetic]
requirements: [ENGAGE-01, ENGAGE-03]
dependency_graph:
  requires:
    - "Phase 39 engagementService (isSaved/isLiked surface)"
    - "Phase 43-03 MasonryFeed cornerOverlay JSX"
    - "Phase 43-06 HomeScreen engagementVersion plumbing"
  provides:
    - "Theme-aware --corner-chip-bg / --corner-chip-fg-saved / --corner-chip-fg-liked CSS vocabulary"
    - "Dark-mode-safe Heart icon (no longer absorbed into --node-salmon dark-mode tint)"
    - "Source-reading regression test locking chip structure"
  affects:
    - "MasonryFeed corner icon legibility on image/video/news thumbnails (both themes)"
tech-stack:
  added: []
  patterns:
    - "CSS-var per-theme flip via :root + .dark class selector (matches existing --shadow-*, --primary-40 pattern)"
    - "Inline-style chip wrapping with rgba semi-transparent backdrop + var(--shadow-1) lift"
key-files:
  created:
    - app/tests/components/MasonryFeed.corner-chip.test.mjs
  modified:
    - app/src/index.css
    - app/src/components/MasonryFeed.tsx
    - app/tests/components/MasonryFeed.dismiss-fade-all.test.mjs
decisions:
  - "Chip backdrop is theme-flipped via two new CSS vars rather than gated by JS or a fixed neutral rgba: lets the chip absorb future palette refinements without touching MasonryFeed.tsx."
  - "Heart fg migrates to --corner-chip-fg-liked rather than a fixed accent literal: keeps the per-theme tuning (#E57373 light / #FF8A80 dark) declarative in index.css."
  - "Per-icon drop-shadow filter removed (NOT kept additively): chip box-shadow provides the lift, and stacking both would crush contrast on already-dark scrims."
  - "Rule 1 deviation: dismiss-fade-all.test.mjs LP-03 assertion rewired from the drop-shadow literal to var(--corner-chip-bg) — same spirit, new execution. New full chip invariant set lives in MasonryFeed.corner-chip.test.mjs (Task 3 owns the spec)."
metrics:
  duration: "~6m"
  completed: "2026-05-11T10:37:22Z"
  tasks: 3
  files_changed: 4
  commits: 3
---

# Phase 43 Plan 10: Engagement Corner Icon Chip Backdrop Summary

Gap closure for UAT Test 3 (severity: cosmetic). Wraps the saved/liked corner icons in MasonryFeed in a theme-flipped 26x26 circular chip so the signals stay legible against busy image/video/news tile thumbnails, AND fixes the latent Heart-disappears-in-dark-mode bug by migrating Heart's fill/color off `--node-salmon` (which is repurposed as a dark-mode block tint, `#1E2326`) onto the new `--corner-chip-fg-liked` token.

## What changed

### 1. New CSS vocabulary (`app/src/index.css`)

Added three additive vars to both theme blocks. Line ranges:

- `:root` block, lines **82-87** (placed immediately after the existing `--shadow-*` declarations to group with the visual-lift tokens):
  ```css
  --corner-chip-bg: rgba(0, 0, 0, 0.55);
  --corner-chip-fg-saved: #FFFFFF;
  --corner-chip-fg-liked: #E57373;
  ```
- `.dark` block, lines **244-250** (placed immediately after the `--node-*` dark tint block, anchored to the same neighborhood as `--node-salmon`):
  ```css
  --corner-chip-bg: rgba(255, 255, 255, 0.20);
  --corner-chip-fg-saved: #FFFFFF;
  --corner-chip-fg-liked: #FF8A80;
  ```

All three vars now appear exactly twice in `index.css` (once per theme block). `--node-salmon` definitions are untouched (still 3 occurrences — semantics preserved for `--bento-review-bg` and other consumers).

### 2. MasonryFeed cornerOverlay rewrite (`app/src/components/MasonryFeed.tsx`)

`cornerOverlay` block, lines **387-450** (was lines 387-419 pre-change). Each icon now sits inside a circular chip `<span>`:

```jsx
<span
  style={{
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '26px',
    borderRadius: '999px',
    backgroundColor: 'var(--corner-chip-bg)',
    boxShadow: 'var(--shadow-1)',
  }}
>
  <Bookmark size={14} fill="var(--corner-chip-fg-saved)" color="var(--corner-chip-fg-saved)" />
</span>
```

Key migrations:

| Surface              | Before                               | After                              |
|----------------------|--------------------------------------|------------------------------------|
| Chip backdrop        | none (bare div, no bg)               | `var(--corner-chip-bg)` semi-scrim |
| Bookmark fill/color  | `var(--primary-40)`                  | `var(--corner-chip-fg-saved)`      |
| Heart fill/color     | `var(--node-salmon)` (dark-mode bug) | `var(--corner-chip-fg-liked)`      |
| Lift mechanism       | per-icon `filter: drop-shadow(...)`  | chip `boxShadow: var(--shadow-1)`  |
| Inter-icon gap       | `4px`                                | `6px` (compensates for chip Ø)     |
| `pointerEvents`      | `'none'` on parent                   | `'none'` on parent (preserved)     |
| Tile-type gate       | `isConcept && (isSaved || isLiked)`  | unchanged                          |

**Confirmation: `var(--node-salmon)` no longer referenced anywhere in MasonryFeed.tsx** (grep count = 0; explanatory comment also paraphrased to avoid the literal substring that the regression test scans for).

**Confirmation: `filter: 'drop-shadow` no longer referenced anywhere in MasonryFeed.tsx** (grep count = 0; replaced by chip box-shadow at the chip-span level).

### 3. Source-reading regression test (`app/tests/components/MasonryFeed.corner-chip.test.mjs`)

6 source-reading invariants, region-scoped via `indexOf('const cornerOverlay')` ... `indexOf(') : null;')`:

1. `var(--corner-chip-bg)` appears >= 2 times in the cornerOverlay region (one per chip span).
2. `var(--corner-chip-fg-saved)` and `var(--corner-chip-fg-liked)` each appear >= 2 times (fill + color per icon).
3. `var(--node-salmon)` does NOT appear (regression guard against Heart-in-dark-mode bug).
4. `width: '26px'`, `height: '26px'`, and `borderRadius: '999px'` each appear >= 2 times.
5. `index.css` declares all three new vars in BOTH `:root` and `.dark` (split-at-`.dark`-selector approach).
6. `filter: 'drop-shadow` does NOT appear in the cornerOverlay region.

**TS annotation note:** The function `cornerOverlayRegion()` is intentionally written WITHOUT a `: string` return-type annotation. The .mjs runs under `node --test` with no TypeScript loader, so a TS annotation would be a syntax error. Plan-checker flagged this up front; the test file ships without the annotation.

## Rule 1 deviation: dismiss-fade-all.test.mjs LP-03 assertion

`app/tests/components/MasonryFeed.dismiss-fade-all.test.mjs:44` previously asserted the literal `drop-shadow(0 1px 2px rgba(0,0,0,0.25))` substring as the corner-icon visibility guarantee. Task 2 removed that filter (replaced by chip box-shadow), which would have caused that test to fail.

**Resolution (Rule 1 — auto-fix bug introduced by current task):** Rewired the assertion to expect `var(--corner-chip-bg)` instead. Same spirit (corner-icon visibility against busy thumbnails), new execution. The full chip invariant set is now owned by `MasonryFeed.corner-chip.test.mjs` (Task 3); the dismiss-fade test retains a lightweight smoke check that the chip CSS var is wired up.

This is the only deviation. No architectural changes, no scope creep, no auth gates.

## Commits

| # | Hash       | Task                                  | Message                                                                  |
|---|------------|---------------------------------------|--------------------------------------------------------------------------|
| 1 | `9723f020` | Task 1                                | feat(43-10): add --corner-chip-* CSS vars to :root and .dark            |
| 2 | `9a42322b` | Task 2 (+ Rule 1 test deviation)      | fix(43-10): wrap engagement corner icons in CSS-var chip backdrop       |
| 3 | `38e320c7` | Task 3                                | test(43-10): source-reading regression for corner-icon chip backdrop    |

All commits use `--no-verify` per the parallel-execution wave protocol (sub-wave 4A alongside 43-09/12/13).

## Verification results

| Check                                                            | Result      |
|------------------------------------------------------------------|-------------|
| `npx tsc -b --noEmit`                                            | exit 0      |
| `node --test tests/components/MasonryFeed.corner-chip.test.mjs`  | 6/6 pass    |
| `node --test tests/components/MasonryFeed.dismiss-fade-all.test.mjs` | 7/7 pass |
| `node --test $(find tests/components -name '*.test.mjs')`        | 111/111 pass|
| `node --test $(find tests/screens -name '*.test.mjs')`           | 124/124 pass|
| `npm run build`                                                  | exit 0      |

Pre-existing failures in `tests/concept-feed.test.mjs` + `tests/services/post-queue.test.mjs` were observed during the broader `npm run test:main` sweep. **Confirmed pre-existing** via `git stash` + re-run against the unmodified HEAD that 43-10 branched from. They reference stale numeric constants (`walkDerivedList(16, ...)`, `<16` refill threshold) that contradict CLAUDE.md's documented post-2026-05-10 values (24). **Out of scope per the scope boundary rule** — logged to `.planning/phases/43-engagement-ui/deferred-items.md` for a later hygiene plan or verifier sweep.

## Phase 43 UAT Test 3 status

**Cosmetic gap resolved.**

- Saved/Liked corner icons now backed by a theme-aware chip → legible against busy image, video, and news thumbnails in BOTH light and dark themes.
- Heart icon visible in dark mode (no longer absorbed into the `--node-salmon` dark-mode block tint).
- Chip is a passive read-only signal (`pointerEvents: 'none'` preserved); no tap-target regression.
- No motion vocabulary additions (Phase 42 D-03 already covers tile entrance/exit; chip rides along).

Post-merge manual UAT still recommended on physical device:
- Save + Like multiple tiles with image/video/news thumbnails
- Toggle light ↔ dark theme and confirm chip backdrop flips appropriately
- Confirm chip does NOT block long-press menu open (pointer-events: none preserved)

## Self-Check: PASSED

- File `app/src/index.css` modified — chip vars present at lines 85-87 (`:root`) and 248-250 (`.dark`). FOUND.
- File `app/src/components/MasonryFeed.tsx` modified — cornerOverlay rewritten lines 387-450. FOUND.
- File `app/tests/components/MasonryFeed.corner-chip.test.mjs` created — 6 tests, all pass. FOUND.
- File `app/tests/components/MasonryFeed.dismiss-fade-all.test.mjs` modified — LP-03 assertion rewired. FOUND.
- Commit `9723f020` exists in git log. FOUND.
- Commit `9a42322b` exists in git log. FOUND.
- Commit `38e320c7` exists in git log. FOUND.
