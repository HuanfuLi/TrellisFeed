# Phase 43: Engagement UI — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 43-engagement-ui
**Areas discussed:** Long-press menu UX, Saved-posts view, Deep-dive button + re-render UX, N connections micro-label (descoped) + Tile simplification (folded)

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Long-press menu UX | Menu surface, layout, confirmation feedback, current-state display | ✓ |
| Saved-posts view | Route + entry point + layout + liked-view co-location | ✓ |
| Deep-dive button + re-render UX | Placement, visual, streaming behavior, post-cache toggle | ✓ |
| N connections micro-label | Counting semantics, storage, placement, zero state | ✓ (later descoped) |

**User's choice:** All four areas selected for discussion.

---

## Long-press menu UX

### Q1 — Where does the long-press contextual menu render?

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom sheet (Recommended) | Slides up from bottom of viewport, anchored to viewport not the tile. Mobile-native pattern. | ✓ |
| Inline popover near tile | Anchored to tile (above/below/side); collision-detection risk in MasonryFeed half-width tiles | |
| Centered modal | Floating dialog with backdrop; heaviest visual | |

**User's choice:** Bottom sheet (Recommended).

### Q2 — How are Like / Save / Not interested arranged?

| Option | Description | Selected |
|--------|-------------|----------|
| 3 stacked rows with icon + label (Recommended) | Full-width rows with leading icon + i18n label; ≥44px tap targets | ✓ |
| 3 horizontal icons + small label below | Compact but cramped for zh/es/ja label widths | |
| 2×2 grid (3 actions + 1 cancel) | Heavier UI; backdrop tap already dismisses, explicit Cancel redundant | |

**User's choice:** 3 stacked rows with icon + label (Recommended).

### Q3 — How is the user confirmed when they tap Like / Save?

| Option | Description | Selected |
|--------|-------------|----------|
| Toast + persistent inline icon on tile (Recommended) | Brief toast + permanent corner icon on tile | ✓ |
| Toast only | Bottom/top toast confirms; tile shows no permanent state indicator | |
| Persistent inline icon only (silent action) | Tile gets corner icon, no transient toast | |

**User's choice:** Toast + persistent inline icon on tile (Recommended).

### Q4 — When the user long-presses an already-saved/liked tile, what does the menu show?

| Option | Description | Selected |
|--------|-------------|----------|
| Dynamic labels: 'Unsave' / 'Unlike' (Recommended) | Menu reads engagement state; labels + icons flip; tapping toggles off | ✓ |
| Static labels, with checkmark badge for active state | Labels stay 'Like'/'Save'; small checkmark on trailing edge | |
| Hide already-active actions | Saved → 'Save' row disappears from menu | |

**User's choice:** Dynamic labels: 'Unsave' / 'Unlike' (Recommended).

### Q5 (follow-up) — Dismiss tile behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Tile fades out immediately + ALL same-anchor tiles in current queue (Recommended) | One-frame consistency; 200ms framer-motion AnimatePresence fade-out | ✓ |
| Only the long-pressed tile dismisses; siblings persist until next refill | Smaller blast radius; could feel inconsistent | |
| All same-anchor tiles dismiss + show inline 'Undo' toast for 5s | Adds undo affordance + toast-with-action complexity | |

**User's choice:** Tile fades out immediately + ALL same-anchor tiles in current queue (Recommended).

**Move-on check:** "Move to Saved-posts view" selected.

---

## Saved-posts view

### Q1 — What route does the saved-posts view live at?

| Option | Description | Selected |
|--------|-------------|----------|
| /saved (Recommended) | Verb-aligned with menu action ('Save' → /saved); single-word URL | ✓ |
| /library | Broader noun; could expand to Liked, Read-it-later | |
| /bookmarks | Browser-bookmark mental model; matches the Bookmark icon | |

**User's choice:** /saved (Recommended).

### Q2 — How does the user navigate to the saved-posts view?

| Option | Description | Selected |
|--------|-------------|----------|
| Header icon on /home (Recommended) | Small Bookmark icon in HomeScreen header, parallel to existing affordances | ✓ |
| Link from Settings menu (Settings → Content or Features sub-page) | Less discoverable; keeps /home header uncluttered | |
| Both: header icon + settings link | Belt + suspenders | |
| Header icon + long-press menu shortcut | Header icon + 'View saved' row at bottom of menu | |

**User's choice:** Header icon on /home (Recommended).

### Q3 — How are saved posts rendered?

| Option | Description | Selected |
|--------|-------------|----------|
| Single-column list like PostHistoryScreen (Recommended) | Compact card pattern; image thumbnail + title + tag + date | ✓ |
| Re-use MasonryFeed component | Visual continuity but heavy re-render lifecycle; assumes mixed InfoFlowItem | |
| Single-column with snippet preview expanded | Pocket/Instapaper layout; wider rows, fewer items above the fold | |

**User's choice:** Single-column list like PostHistoryScreen (Recommended).

### Q4 — Does the liked-posts list get its own surface?

| Option | Description | Selected |
|--------|-------------|----------|
| No liked-list surface; like is private-only (Recommended) | Liked = lightweight signal; visible per-tile via corner heart icon | |
| Tabs inside /saved: 'Saved' \| 'Liked' | One screen, two lists; adds tab-state + i18n | ✓ |
| Separate /liked route | Symmetric to /saved; doubles surface area | |

**User's choice:** Tabs inside /saved: 'Saved' | 'Liked' — **diverged from Recommended.**
**Notes:** Operator opted to give the Like signal a browsable surface rather than keeping it private. Captured as a preference signal in CONTEXT.md `<specifics>` (operator wants the engagement layer to feel interactive and exploratory).

**Move-on check:** "Move to Deep-dive UX" selected.

---

## Deep-dive button + re-render UX

### Q1 — Where does the 'Deep dive' button live on PostDetailScreen?

| Option | Description | Selected |
|--------|-------------|----------|
| Below the essay body, above the takeaway (Recommended) | Natural reading endpoint; in-flow placement | ✓ |
| After the takeaway (between takeaway and Q&A section) | Further-down placement; lower discoverability | |
| Sticky CTA at bottom of viewport while reading essay | Floating button; layout complexity | |

**User's choice:** Below the essay body, above the takeaway (Recommended).

### Q2 — What does the button look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Full-width subtle button with icon + label (Recommended) | Centered, ~85% width, surface-variant background, primary-40 text + Sparkles/ArrowDownToLine icon | ✓ |
| Compact pill button, left-aligned | Less prominent, less discoverable | |
| Inline text link styled as a hyperlink | Lightest touch; lowest discoverability | |

**User's choice:** Full-width subtle button with icon + label (Recommended).

### Q3 — During the deep-dive stream, what does the user see?

| Option | Description | Selected |
|--------|-------------|----------|
| Button becomes a streaming target in-place (Recommended) | Button replaced by streaming markdown + skeleton-pulse; standard essay above stays visible | |
| Replace the standard body in-place; show 'Restore standard' button during/after | Standard body swapped for streaming deep text in same DOM slot | ✓ |
| Open a bottom sheet / modal with the deep stream | Modal slides up with streaming content; adds modal infrastructure | |

**User's choice:** Replace the standard body in-place; show 'Restore standard' button during/after — **diverged from Recommended.**
**Notes:** Operator opted for interactive in-place replacement over additive content. Pairs with Q4 (toggle pattern). Phase 41-02's AbortController contract handles the cancel-mid-stream cleanly.

### Q4 — After the deep version finishes streaming and is cached, how is standard vs deep presented?

| Option | Description | Selected |
|--------|-------------|----------|
| Append deep below standard with a divider; both visible (Recommended) | Single scroll, both versions browsable, no toggle state | |
| Toggle: button becomes 'Standard / Deep' segmented control | Segmented control switches active variant in body slot | ✓ |
| Replace standard with deep permanently once tapped | Destructive replace; standard version lost | |

**User's choice:** Toggle: button becomes 'Standard / Deep' segmented control — **diverged from Recommended.**
**Notes:** Operator wants both variants accessible but only one visible at a time; segmented control adds toggle state to PostDetailScreen but matches the interactive preference seen in Q3.

**Move-on check:** "Move to N connections label" selected.

---

## N connections micro-label (clarification → descope)

### Pre-question clarification

When presented with the initial four sub-questions on N connections semantics, the user requested clarification: "I need more context about this question. What are we discussing?"

The orchestrator re-explained the feature in plain language: "N connections in your graph" is a local-first social-proof signal showing the user's own knowledge-graph density around each tile's concept. The label would be computed from `buildCandidateContextPack` at queue-fill time per ROADMAP SC-4.

### User's response

> "I think we should skip this feature. The post tile is already too rich. We should try to simplify instead"

The original four sub-questions (counting semantics, storage/refresh, placement, zero state) were never answered. Instead, the area was descoped and replaced with a tile-simplification fold.

### Follow-up Q1 — What happens to the ENGAGE-04 requirement?

| Option | Description | Selected |
|--------|-------------|----------|
| Out of Scope (Recommended) | Definitive close; REQUIREMENTS.md row moves to Out of Scope; drops Phase 43 SC-4 | ✓ |
| Backlog / deferred to future milestone | Move to 'Deferred' section; surfaces in future audits | |
| Keep active, reassign to a later Phase / future milestone | Pick a target phase now | |

**User's choice:** Out of Scope (Recommended).

### Follow-up Q2 — How does 'simplify instead' interact with Phase 43?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 43 stays focused; simplification is a separate future idea (Recommended) | Deferred Idea in CONTEXT.md; future phase scopes a proper tile audit | |
| Fold a small tile-metadata audit into Phase 43 | Audit existing metadata while touching tiles for save/like corner icon | ✓ |
| Pause Phase 43, plant a tile-simplification phase first, then come back | Reorders v1.5 Wave 3; delays engagement UI | |

**User's choice:** Fold a small tile-metadata audit into Phase 43 — **diverged from Recommended.**
**Notes:** Operator wants the simplification work landed alongside the engagement UI rather than in a future phase. Bounded by the next questions.

### Follow-up Q3 — Which existing tile elements are candidates for trimming?

| Option | Description | Selected |
|--------|-------------|----------|
| News post source attribution (top row: domain favicon + source name) | News tiles' attribution row | |
| News post date stamp | Date on news tiles | |
| Concept presentation-style tag (image / text-art / video / news label) | Small chip indicating post style | ✓ |
| Video channel-name byline | Channel name under video tile title | |

**User's choice:** Concept presentation-style tag only.

### Follow-up Q4 — How wide should the audit go?

| Option | Description | Selected |
|--------|-------------|----------|
| Bounded: only trim what conflicts visually with the new save/like corner icons (Recommended) | Reactive audit; trim only what competes with new corner overlay | |
| Bounded: trim only the elements selected in the previous question | Whatever was ticked gets cut, full stop; no broader audit | ✓ |
| Open audit: planner identifies and proposes further trims during planning | Above selections + planner-proposed additional cuts in PLAN.md | |

**User's choice:** Bounded: trim only the elements selected in the previous question — **diverged from Recommended.**
**Notes:** Operator wants the narrowest possible audit: only the presentation-style tag, full stop.

### Follow-up Q5 — Which tile types are in scope for the audit?

| Option | Description | Selected |
|--------|-------------|----------|
| All tile types (concept image / text-art / video / news / suggestion / connection / milestone) (Recommended) | One pass, consistent visual language | ✓ |
| News + Video tiles only (the visually densest) | Image / text-art / suggestion already lighter | |
| Only concept tiles; leave connection + milestone alone | Connection/milestone have specific celebration purposes | |

**User's choice:** All tile types (Recommended).

---

## Wrap-up

| Option | Description | Selected |
|--------|-------------|----------|
| I'm ready for context (Recommended) | Lock decisions; write CONTEXT.md and DISCUSSION-LOG.md | ✓ |
| Force-New-Day reset granularity | Discuss whether saves+likes also wipe alongside dismisses | |
| HomeScreen ANCHOR_DISMISSED re-sync mechanics | Discuss refetch vs in-place client filter | |
| Both of the above | Discuss both before locking | |

**User's choice:** I'm ready for context (Recommended).

---

## Claude's Discretion

The following areas were not directly asked about; CONTEXT.md captures them as Claude's discretion at planning time:

- Bottom-sheet implementation (custom inline-styled component recommended; no new dependency).
- Long-press hook factoring (extract `useLongPress(ms, callback)` recommended; three consumers justify the hook).
- Long-press menu animation timing (200-250ms slide-up, ease-out, `<MotionConfig reducedMotion="user">` per Phase 42 D-03).
- Saved/Liked tab interaction (tap-only recommended; swipe deferred).
- Sort order in Saved + Liked tabs (most-recent-saved-first by default).
- Empty state copy for Saved + Liked tabs (hand-authored EN + Sonnet-translated zh/es/ja).
- Segmented-control implementation for DD-04 (custom inline-styled recommended).
- "Restore standard" mid-stream copy.
- HomeScreen `ANCHOR_DISMISSED` re-sync mechanic (in-place client filter recommended over refetch).
- Tile corner-icon overlay placement for save/like state (top-right recommended; two-icon stacking when both states active is Claude's call).
- Test file naming.
- Force-New-Day reset granularity (full reset per Phase 39 D-08; no API extension).

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section:

- Broader tile-metadata audit beyond TS-01.
- Like-based feed re-ranking.
- Dismiss cooldown.
- Cross-device engagement sync.
- Undo toast for dismiss.
- Bulk operations on Saved / Liked.
- Search / filter inside Saved + Liked tabs.
- `/liked` as a separate route.
- Tile-metadata simplification follow-up phase.
- `resetDismissedOnly()` API method.
- N connections / familiarity micro-label revisit (Out of Scope this phase; future cycle could reopen).
