# Phase 31: Curiosity feed redesign — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 31-curiosity-feed-redesign-post-lifecycle-and-display
**Areas discussed:** Progress visualization, Concept transparency, Post ordering & queue, Post lifecycle & storage, Post type mixing, Mid-day questions, Queue design, Inline video, Warm start, Post history, Misc UX

---

## Progress Visualization Style

| Option | Description | Selected |
|--------|-------------|----------|
| Gentle checklist with concept names | Soft vertical list with checkmarks, no bar | |
| Stepping stones / trail | Horizontal dot stepper, filled = explored | |
| Garden / growth metaphor | Seed-to-sprout illustrations tied to trellis | ✓ |
| Soft radial / ring | Apple activity ring style | |

**User's choice:** Garden / growth metaphor

### Sub-decision: Illustration literalness

| Option | Description | Selected |
|--------|-------------|----------|
| Abstract botanical | Dots that bloom with color + scale animation | |
| Stylized sprouts | Tiny plant icons in a row, seed → leaf | |
| Single plant growing | One plant progressing through stages | ✓ |
| Mini garden plot | Planter box with slots per concept | |

**User's choice:** Single plant growing through stages

### Sub-decision: Concept names visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Plant only, names elsewhere | Progress card is plant + label, names on feed posts | |
| Plant with concept names below | Plant on top, checklist below, self-contained | |
| Plant with concept names on tap | Tap to expand checklist, compact by default | ✓ |

**User's choice:** Tap to expand

### Sub-decision: Compact header version

| Option | Description | Selected |
|--------|-------------|----------|
| Tiny plant + fraction | Small growth stage icon + "2/5" | |
| Just fraction + leaf icon | Drop plant, show leaf + "2/5" | |
| No compact header at all | Plant card scrolls away entirely | |

**User's choice:** None of the above — user redesigned: horizontal vine growing left-to-right with leaves/flowers, NO fraction numbers at all. Same vine for both inline and compact header. Small potted plant anchored on left.

---

## Concept Transparency in Feed

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle badge on concept posts | Leaf icon on concept post corners | |
| Visual styling difference | Green border or tint on concept posts | |
| No in-feed indicators | Checklist in vine is only place | |
| Section headers | Group under "Today's concepts" label | |

**User's choice:** None — user specified: NO changes to post cards. Compact header is clickable/expandable showing uncovered concepts. Small down arrow affordance. Tap again or outside to collapse.

---

## Post Ordering & Queue

| Option | Description | Selected |
|--------|-------------|----------|
| Uncovered concepts first | Dynamic reordering as user explores | ✓ (at generation time) |
| Fixed order | Set when generated, stays put | |
| Uncovered first on initial load | Prioritized once, then locked | |

**Notes:** Later refined — priority applied at generation time into FIFO queue, not dynamic reordering.

### Queue buffer design

User specified: 8-post FIFO buffer, serve 4 at a time, auto-refill to 8. Driven by derived concept list (today's due concepts from SM-2). New questions appended, explored concepts removed. Priority: weak concepts (low ease OR dying/falling) get 2 posts, others get 1. Queue is a true FIFO — pop from front, push to back. No pointer needed.

### Empty queue state

User specified: botanical loading state + "Posts not interesting?" button → opens device email client. Also accessible from Settings. Feedback is just email compose, zero in-app UI.

### App open + background generation

| Option | Description | Selected |
|--------|-------------|----------|
| On app open only | Top-up if < 8 | |
| After previous session | Background generate for next time | |
| Both | Background when possible, top-up on open | ✓ |

---

## Post Type Mixing

### Distribution evolution

User rejected image-less as a planned style (ugly, short height, visual inconsistency). Proposed new "suggestion post" type. Multiple rounds of ratio adjustment:

Final ratios:
- 10% image (reduced from initial 15% — expensive)
- 25% text-art
- 5% suggestion ("You may also like:")
- 20% news (increased)
- 15% YouTube landscape video
- 25% YouTube shorts (increased)

### Style assignment per concept

| Option | Description | Selected |
|--------|-------------|----------|
| Per-concept style rotation | Track used styles, guarantee variety | |
| Random with global ratio | Random per post, batch totals match ratios | ✓ |

### Posts per concept per cycle

| Option | Description | Selected |
|--------|-------------|----------|
| One post per concept | Equal coverage before cycling | |
| Variable by importance | Weak areas get 2, others get 1 | ✓ |

### Importance criteria

| Option | Description | Selected |
|--------|-------------|----------|
| SM-2 ease factor only | Low ease = weak = 2 posts | |
| Trellis leaf state only | Dying/falling = 2 posts | |
| Combined (either triggers) | Low ease OR dying/falling = 2 posts | ✓ |

---

## Inline Video Playback

User specified: Landscape videos playable inline (no detail page required), no summary generation on inline play. Both landscape and portrait videos stop playback on swipe-away.

---

## Mid-Day Questions

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate generation | Generate 1-2 posts right away | |
| Next queue refill | Include in next refill cycle naturally | ✓ |
| Both with priority | 1 immediate + include in future refills | |

---

## Warm Start

User specified: Show yesterday's 8 unviewed queue posts as initial feed. Generate today's in background. Pull-up serves from today's fresh queue. Edge case (empty queue): show last 4 from yesterday as recap.

---

## Post Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Today only | Fresh start each day | |
| Rolling window | Keep N days, auto-purge older | ✓ (7 days default) |
| Keep everything | Full history | Configurable option |

**Notes:** Posts are assets (user paid API cost). Default 7-day, configurable to "keep all" in Settings > Data & Privacy > Developer.

### Post history access

| Option | Description | Selected |
|--------|-------------|----------|
| No history access | Stored but invisible | |
| Simple history screen | Past posts grouped by day | ✓ |

**Entry points:** Both vine area (history icon) and Settings > Data.

### Feed dismiss

User specified: No feed-level dismiss. Delete only from PostDetailScreen. No swipe-to-dismiss (conflicts with screen-switching gestures).

---

## Generation Pipeline

User specified: (1) pre-check API keys, (2) YouTube/Tavily parallel fetch for assigned styles, (3) reassign failures to text-art, (4) one batch LLM call for all remaining. Efficient — avoids wasted LLM generation and minimizes API calls.

---

## Rate Limiting

User specified: Daily cap = multiplier × today's concept count. Default multiplier = 5. Bonus post cap after completion = 8 max. Both configurable in Settings > Data & Privacy > Developer.

---

## Scroll-to-Top

User specified: Floating button at bottom-right after pixel distance threshold. Exact value at Claude's discretion.

---

## Starter Posts

| Option | Description | Selected |
|--------|-------------|----------|
| Replace entirely | All 3 become app-tutorial posts | ✓ |
| Mix | Keep 1 learning-science, add 2 tutorials | |
| Expand | Keep 3 existing + add tutorials | |

---

## Claude's Discretion

- Vine SVG/CSS implementation details
- Exact scroll-to-top pixel threshold
- Exact SM-2 ease threshold for importance
- Starter post tutorial content
- History screen layout
- Queue refill debouncing
- Botanical loading state illustration

## Deferred Ideas

None — discussion stayed within phase scope
