---
phase: 43-engagement-ui
plan: 11
plan_id: 43-11
slug: homescreen-bookmark-inline-with-greeting
subsystem: homescreen-engagement-ui
tags: [ui, homescreen, bookmark, scroll-flow, gap-closure, uat-test-5]
gap_closure: true
wave: 4
sub_wave: 4B
requires: [43-06]
provides:
  - "HomeScreen Bookmark icon participates in normal scroll flow (inline in greeting row)"
  - "No visual overlap between Bookmark icon and compact VineProgress bar slide-in"
  - "Source-reading regression test locking inline-Bookmark shape + compact-bar preservation"
affects:
  - "app/src/screens/HomeScreen.tsx (deleted lines 651-679 fixed-position block; wrapped greeting at lines 727-729 in flex row)"
  - "app/tests/screens/HomeScreen.engagement-resync.test.mjs (Rule 1 deviation: rewired stale SV-02 layering assertion)"
tech-stack:
  added: []
  patterns:
    - "Inline flex-row wrapper (display:flex / justifyContent:space-between / gap:12px) around greeting <h1> + trailing icon button"
    - "marginRight: -8px optical alignment trick (same as Header.tsx back button's marginLeft: -8px)"
    - "Source-reading regression test discipline (pure regex + indexOf, no React render / no jsdom)"
key-files:
  created:
    - app/tests/screens/HomeScreen.bookmark-inline-greeting.test.mjs
  modified:
    - app/src/screens/HomeScreen.tsx
    - app/tests/screens/HomeScreen.engagement-resync.test.mjs
decisions:
  - "Delete the entire fixed-position block + intent comment (no stub button, no aspirational comment) — clean signal that the new inline-greeting-row is THE bookmark site."
  - "Add margin: 0 to the wrapped <h1> to neutralize UA-default vertical margin inside the flex row (prevents row height jitter)."
  - "Rule 1 deviation: rewire engagement-resync.test.mjs's stale 'SV-02 layering: fixed position + zIndex 195' assertion to its inverse (must NOT be position:fixed, must NOT carry zIndex 195) — preserves the spirit (no regression to overlap shape) while ceding the new inline-flex-row invariants to the new HomeScreen.bookmark-inline-greeting.test.mjs."
metrics:
  duration: "single session, ~10 minutes wall-clock"
  completed: 2026-05-11
  tasks: 2
  files_created: 1
  files_modified: 2
  commits: 2
---

# Phase 43 Plan 43-11: HomeScreen Bookmark Inline with Greeting Summary

Closes Phase 43 UAT Test 5 (minor) — relocated the HomeScreen Bookmark icon from a fixed-position viewport-anchored button (zIndex 195) to an inline element inside the greeting flex row, so it scrolls away with page content and no longer overlaps the compact VineProgress bar slide-in (zIndex 190).

## Context

UAT Test 5 (Phase 43 gap #3 — minor):

- Expected: Bookmark icon positioned inline with greeting, scrolls with the page like a normal element; when user scrolls down and compact VineProgress bar appears at top, the Bookmark icon is already scrolled out of view — no overlap.
- Actual (pre-43-11): Bookmark icon was a standalone `position: fixed` `<button>` at `top: calc(var(--safe-area-top) + 8px), right: 16px, zIndex: 195`, placed OUTSIDE the scroll container as a sibling of the compact VineProgress bar (also `position: fixed`, `top: var(--safe-area-top), zIndex: 190`). The bookmark never scrolled away and visually interfered with the compact bar.

Debug session at `.planning/debug/bookmark-icon-viewport-fixed.md` confirmed the root cause (CONFIRMED, no further test needed) and proposed the inline-flex-row resolution that operator greenlit. Phase 43-11 executes that resolution.

## What Changed

### Source edits (HomeScreen.tsx)

**Deleted lines 651-679** (the entire fixed-position Bookmark block + its 6-line preceding intent comment):

```jsx
{/* Phase 43-06 SV-02: Bookmark icon entry to /saved. Position fixed scoped
    to the HomeScreen swipe slot via SwipeTabContainer's translateZ(0)
    containing block (CLAUDE.md "Header positioning"). Placed BEFORE the
    scroll container so overflow:auto cannot clip it. zIndex 195 sits
    above the compact VineProgress bar (zIndex 190) and below any modal
    surface. WCAG 44×44 floor enforced via minWidth/minHeight. */}
<button
  type="button"
  aria-label={t('saved.title')}
  onClick={() => navigate('/saved')}
  style={{
    position: 'fixed',
    top: 'calc(var(--safe-area-top) + 8px)',
    right: '16px',
    zIndex: 195,
    /* ...rest of fixed-position styling... */
  }}
>
  <Bookmark size={22} />
</button>
```

**Wrapped lines 727-729** (the inline greeting `<h1>`) in a flex row that now contains BOTH the greeting AND the new inline Bookmark button:

```jsx
{/* Inline greeting row — scrolls away naturally. Bookmark
    relocated here from a fixed-position viewport-anchored button
    per 43-11 gap closure (UAT Test 5). The icon now participates
    in normal scroll flow and disappears when scrolled past, so it
    no longer overlaps the compact VineProgress bar slide-in. */}
<div
  style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  }}
>
  <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
    {getGreeting()}
  </h1>
  <button
    type="button"
    aria-label={t('saved.title')}
    onClick={() => navigate('/saved')}
    style={{
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '8px',
      marginRight: '-8px',
      minWidth: '44px',
      minHeight: '44px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--muted-foreground)',
    }}
  >
    <Bookmark size={22} />
  </button>
</div>
```

Preserved:

- `aria-label={t('saved.title')}` — a11y unchanged.
- `onClick={() => navigate('/saved')}` — entry point unchanged (the only Saved-screen entry on HomeScreen).
- `Bookmark size={22}` — icon size unchanged.
- WCAG 44x44 tap floor via `minWidth: 44px` + `minHeight: 44px`.
- `marginRight: -8px` optical alignment (Header.tsx back-button precedent — 8px internal padding offset by -8px margin so the icon glyph aligns to the 16px container padding-right).

Untouched:

- Compact VineProgress bar at lines 681-705 (zIndex 190) — explicitly preserved.
- All other HomeScreen code (LongPressMenu host, MasonryFeed wiring, dual-effect dismiss resync, etc.).

### Test edits

**New file:** `app/tests/screens/HomeScreen.bookmark-inline-greeting.test.mjs` — 6 source-reading invariants:

1. `zIndex: 195` NOT in HomeScreen.tsx (deleted fixed-position block).
2. `top: 'calc(var(--safe-area-top) + 8px)'` offset NOT in source.
3. Greeting wrapped in flex row with `justifyContent: 'space-between'` (pre-window scoped to ~600 chars before `{getGreeting()}`).
4. Exactly one `navigate('/saved')` call (the inline Bookmark).
5. WCAG 44x44 tap floor (minWidth + minHeight 44px) preserved (post-window scoped to ~1200 chars after `{getGreeting()}`).
6. Compact VineProgress bar at `zIndex: 190` preserved.

**Rule 1 deviation:** `app/tests/screens/HomeScreen.engagement-resync.test.mjs` line 114-121 — the existing 43-06 test "SV-02 layering: fixed position + zIndex 195 (above compact VineProgress bar at 190)" guarded the now-deleted fixed-position shape. The plan-stated acceptance criteria required this existing test to pass post-edit.

Rewired the assertion to its inverse (Rule 1 fix — same pattern 43-10 used for `MasonryFeed.dismiss-fade-all.test.mjs`): Bookmark must still exist + navigate to /saved with the WCAG floor, but must NOT regress to `position: fixed` + `zIndex: 195`. Test name updated to `'SV-02 layering (43-11 update): Bookmark is INLINE in the greeting row, NOT fixed-position'` with an inline comment explaining the 43-11 deviation and pointing to `HomeScreen.bookmark-inline-greeting.test.mjs` for the new positive-invariants set.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Stale assertion in HomeScreen.engagement-resync.test.mjs**

- **Found during:** Task 1 verification (`node --test tests/screens/HomeScreen.engagement-resync.test.mjs`).
- **Issue:** Existing test "SV-02 layering: fixed position + zIndex 195" asserted `assert.match(region, /position:\s*['"]fixed['"]/)` + `assert.match(region, /zIndex:\s*195/)` on the bookmark block — both intentionally deleted by 43-11.
- **Fix:** Rewired the assertion to its inverse so the spirit (no regression to the overlap shape) is preserved; new HomeScreen.bookmark-inline-greeting.test.mjs owns the positive inline-flex-row invariants. Renamed the test to "SV-02 layering (43-11 update): Bookmark is INLINE in the greeting row, NOT fixed-position" + 4-line inline comment explaining the deviation.
- **Files modified:** `app/tests/screens/HomeScreen.engagement-resync.test.mjs`.
- **Commit:** `1513d883` (batched with Task 1 — the source edit and its corresponding stale-test fix are one semantic change).

No other deviations.

## Verification

- `grep "zIndex: 195"` in HomeScreen.tsx — 0 hits.
- `grep "calc(var(--safe-area-top) + 8px)"` in HomeScreen.tsx — 0 hits.
- `grep "justifyContent: 'space-between'"` in HomeScreen.tsx — 2 hits (line 706 new flex row + line 803 unrelated existing).
- `grep "marginRight: '-8px'"` in HomeScreen.tsx — 1 hit (inline Bookmark button).
- `grep "navigate('/saved')"` in HomeScreen.tsx — 1 hit (preserved entry point).
- `grep "zIndex: 190"` in HomeScreen.tsx — 1 hit (compact VineProgress bar preserved).
- `npx tsc -b --noEmit` — exit 0.
- `node --test tests/screens/HomeScreen.engagement-resync.test.mjs` — 11/11 pass.
- `node --test tests/screens/HomeScreen.bookmark-inline-greeting.test.mjs` — 6/6 pass.
- `node --test tests/screens/*.mjs` — 130/130 pass (no other screen-test regression).

Manual UAT (post-merge, operator-confirmable on device):

- Open HomeScreen — greeting + Bookmark icon on the same row.
- Scroll down — Bookmark scrolls out of view naturally.
- Continue scrolling — compact VineProgress bar slides in at top WITHOUT any Bookmark overlap.
- Tap inline Bookmark — navigates to /saved.

## Commits

| Hash | Type | Description |
| ---- | ---- | ----------- |
| `1513d883` | fix | move HomeScreen Bookmark from fixed-position to inline greeting row (+ Rule 1 stale-test rewire) |
| `9c8e5641` | test | source-reading regression for inline Bookmark + compact bar preservation |

Total: 2 atomic commits (within the plan-stated 2-3 budget).

## Phase 43 UAT Test 5 Status

Resolved (positioning gap → inline + scroll-aware). Closes Phase 43 gap #3 (severity: minor). Phase 43 gap-closure track now has plans 43-09 (BottomSheet portal + clearance), 43-10 (corner-icon chip backdrop), 43-11 (this plan), 43-12 (deep dive controls), and 43-13 (engagement reset dismissed-only) all landed.

## Self-Check: PASSED

- `app/src/screens/HomeScreen.tsx` modified — FOUND.
- `app/tests/screens/HomeScreen.engagement-resync.test.mjs` modified — FOUND.
- `app/tests/screens/HomeScreen.bookmark-inline-greeting.test.mjs` created — FOUND.
- Commit `1513d883` — FOUND in `git log`.
- Commit `9c8e5641` — FOUND in `git log`.
