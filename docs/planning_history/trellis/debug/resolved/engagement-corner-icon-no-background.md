---
status: resolved
trigger: "engagement-corner-icon-no-background — saved/liked corner icons have no contrasting background and blend into image/thumbnail backgrounds"
created: 2026-05-11T10:00:00Z
updated: 2026-05-11T13:40:00Z
---

## Current Focus

hypothesis: Corner icons in MasonryFeed.tsx TileWrapper render as bare lucide-react SVG icons inside an absolutely-positioned <div> with NO chip/background div, NO padding, NO borderRadius — only a faint drop-shadow filter. On image/video tiles with busy thumbnails, the small 14px icons get lost.
test: Read the rendering site (MasonryFeed.tsx:387-419) + verify CSS variable inventory for both themes (.dark class block in index.css)
expecting: Bare Bookmark/Heart JSX with no surrounding chip → confirmed
next_action: Return diagnosis (goal: find_root_cause_only)

## Symptoms

expected: |
  Saved → Bookmark corner icon on tile; Liked → Heart corner icon. Both legible against any tile background (image, text-art, video thumbnail, news) via a small round chip backdrop that auto-flips between light/dark themes.
actual: |
  Icons render WITHOUT any background chip — only a drop-shadow filter. On busy image/video thumbnails the 14px icon disappears into the tile content.
errors: None
reproduction: Phase 43 UAT Test 3. Save or like any tile with an image/video thumbnail.
started: Phase 43-03 (commits c08883df..d1b0efd8) when corner-icon overlay was first introduced.

## Eliminated

(none — straightforward styling gap, no investigation branches to rule out)

## Evidence

- timestamp: 2026-05-11T10:02:00Z
  checked: app/src/components/MasonryFeed.tsx lines 387-419 (cornerOverlay JSX)
  found: |
    Outer div has position:absolute, top:8px, right:8px, zIndex:10, flexDirection:column, gap:4px, pointerEvents:none — NO background, NO padding, NO borderRadius.
    Inner Bookmark icon: size={14}, fill="var(--primary-40)", color="var(--primary-40)", style={ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }
    Inner Heart icon: size={14}, fill="var(--node-salmon)", color="var(--node-salmon)", style={ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }
    Drop-shadow alone is insufficient against image/video thumbnails — a chip backdrop is needed.
  implication: This is the sole render site for the corner overlay. No other component contributes.

- timestamp: 2026-05-11T10:03:00Z
  checked: app/src/index.css — :root vs .dark CSS variable inventory
  found: |
    Light theme (root): --card=#FFFFFF, --surface=#FFFBF5, --surface-variant=#F5F0E8, --primary-40=#558B2F, --node-salmon=#FFAB91, --shadow-1, --shadow-2
    Dark theme (.dark class on documentElement): --card=#181818, --surface=#111111, --surface-variant=#1F1F1F, --primary-40=#4CAF50, --node-salmon=#1E2326 (deliberately dark tinted grey, not coral)
    Dark mode toggle: app/src/lib/theme.ts:13 → document.documentElement.classList.toggle('dark', ...) — uses '.dark' class, NOT [data-theme="dark"]
  implication: |
    --node-salmon is INVERTED in dark mode (#FFAB91 light → #1E2326 dark). Currently the Heart icon uses var(--node-salmon) for fill/color, which means in dark mode the heart turns nearly black — invisible regardless of backdrop. This is a SECOND bug stacked on top of the missing backdrop.
    Suitable backdrop values: light theme = semi-transparent dark scrim (e.g., rgba(0,0,0,0.45-0.55)); dark theme = semi-transparent light scrim (e.g., rgba(255,255,255,0.18-0.22)). Backdrop can be a single CSS var that flips on .dark, OR a fixed rgba pair that works on either tile content.

- timestamp: 2026-05-11T10:04:00Z
  checked: Dark-mode behavior of icon fill colors
  found: |
    Heart fill uses var(--node-salmon) → light=#FFAB91 (peachy salmon, fine) but dark=#1E2326 (near-black grey — invisible).
    Bookmark fill uses var(--primary-40) → light=#558B2F (olive green, fine) and dark=#4CAF50 (vibrant green, fine).
  implication: |
    Fix must address BOTH (a) missing chip backdrop AND (b) Heart fill color disappearing in dark mode. Using a fixed accent-red (e.g., #E57373 or rgba-based salmon) for Heart instead of var(--node-salmon) is the cleanest fix.

## Resolution

root_cause: |
  In app/src/components/MasonryFeed.tsx TileWrapper (lines 387-419), the cornerOverlay JSX renders raw lucide-react <Bookmark> and <Heart> icons inside a bare absolutely-positioned <div>. The outer container has no background, padding, or border-radius — only a drop-shadow filter on each icon, which is insufficient against image/video thumbnails. Additionally, the Heart's fill uses var(--node-salmon), which is intentionally redefined as near-black in dark mode (.dark { --node-salmon: #1E2326 }) for use as a dark-mode block tint — making the heart icon itself disappear in dark mode regardless of any backdrop.

fix: |
  Wrap EACH icon in its own circular chip <span> (one per icon, since two icons can stack vertically). Apply:
    - backgroundColor: var(--corner-icon-bg) — declare in :root as rgba(255,255,255,0.78) and in .dark as rgba(0,0,0,0.55) [OR use rgba(0,0,0,0.55) light + rgba(255,255,255,0.20) dark as the inverse — operator preference per UAT note]
    - borderRadius: 999px (or '50%' since chip is square)
    - padding: 6px (yields ~26px chip around a 14px icon)
    - display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
    - boxShadow: 'var(--shadow-1)' to lift off thumbnail
    - Drop the per-icon drop-shadow filter once chip is in place (it becomes redundant)
  ALSO swap Heart's fill/color from var(--node-salmon) to a fixed accent that survives both themes — recommend '#E57373' (Material red 300, readable on both light and dark chip backgrounds). Or keep the salmon-only-in-light branch by gating on theme; the fixed-color approach is simpler and matches the "no per-theme branching" style.
  Optional: declare two new CSS vars in index.css to keep the inline style theme-aware without JS:
    :root  { --corner-chip-bg: rgba(0, 0, 0, 0.55); --corner-chip-fg-saved: #FFFFFF; --corner-chip-fg-liked: #E57373; }
    .dark  { --corner-chip-bg: rgba(255, 255, 255, 0.20); --corner-chip-fg-saved: #FFFFFF; --corner-chip-fg-liked: #FF8A80; }
  Then the chip uses background: var(--corner-chip-bg) and icon fill/color uses the matching --corner-chip-fg-* var.

verification: (not applied — diagnose-only mode per <mode> goal: find_root_cause_only)

files_changed: []
