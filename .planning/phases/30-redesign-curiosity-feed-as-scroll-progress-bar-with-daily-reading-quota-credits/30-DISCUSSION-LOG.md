# Phase 30: Redesign curiosity feed as scroll progress bar with daily reading quota credits - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 30-redesign-curiosity-feed-as-scroll-progress-bar-with-daily-reading-quota-credits
**Areas discussed:** Progress bar behavior, Daily quota & credits, Reading detection, Visual design, Zero-post & edge states, Curiosity Feed island fate, Bento grid interaction, Credits amount & i18n

---

## Progress Bar Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| Posts viewed | Each post that enters viewport and is read increments the bar. Discrete, satisfying progression. | ✓ |
| Scroll position | Bar reflects how far down the feed you've scrolled. Simple but doesn't distinguish skimming from reading. | |
| Concepts explored | Track unique concepts/anchors represented in viewed posts. Encourages breadth over volume. | |

**User's choice:** Posts viewed
**Notes:** Clear cause-effect preferred over scroll position gaming or concept-level abstraction.

---

## Progress Bar Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Sticky top, replaces greeting | The 'Good Evening' banner transforms into a compact sticky progress header. Always visible. | ✓ |
| Inline above feed | Progress bar sits above the first post card, scrolls away with the feed. | |
| Floating pill overlay | Small floating pill at top of screen showing progress, overlays content. | |

**User's choice:** Sticky top, replaces greeting
**Notes:** Greeting banner considered too vague — progress bar is a meaningful replacement.

---

## Daily Quota Target

| Option | Description | Selected |
|--------|-------------|----------|
| Match daily posts count | Quota = however many posts the feed generated today. Always achievable. | ✓ |
| Fixed daily target | Set a fixed number regardless of feed size. May be unachievable. | |
| User-configurable | Let user set their own daily reading goal in Settings. | |

**User's choice:** Match daily posts count
**Notes:** Natural scaling with content availability. No arbitrary numbers.

---

## Reward on Completion

| Option | Description | Selected |
|--------|-------------|----------|
| Trellis credits + animation | Reuse existing trellis credits system. Confetti + credits fly to counter. | ✓ |
| Animation only, no credits | Just a satisfying visual celebration. Progress itself is the reward. | |
| New 'reading credits' type | Separate credit currency for reading. More complex. | |

**User's choice:** Trellis credits + animation
**Notes:** Reusing existing credits system keeps economy simple and unified.

---

## Reading Detection

| Option | Description | Selected |
|--------|-------------|----------|
| Viewport dwell time | Post counts as read when >50% visible for ~2 seconds. Anti-gaming. | |
| Scroll past threshold | Post counts as read once user scrolls past its bottom edge. Simplest. | ✓ |
| Tap to mark read | Post only counts when user explicitly taps. Most accurate but adds friction. | |

**User's choice:** Scroll past threshold
**Notes:** Simplest implementation chosen. Fast-scroll gaming accepted as non-issue.

---

## Read State Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, localStorage | Track read post IDs in localStorage with daily reset. Progress survives restart. | ✓ |
| Session only | Progress resets when app is closed/refreshed. | |

**User's choice:** Yes, localStorage
**Notes:** Same pattern as trellis credits.

---

## Zero-Post State

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden progress bar | Progress header doesn't render. Feed shows encouraging empty state. | ✓ |
| Show bar at 0/0 | Display the progress bar empty with a message. | |

**User's choice:** Hidden progress bar
**Notes:** No awkward 0/0 bar.

---

## Post-Quota Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Feed stays browsable | Posts remain scrollable. Bar stays at 100%. No gate. | ✓ |
| Collapse feed to summary | Feed collapses to summary card. Posts hidden unless expanded. | |

**User's choice:** Feed stays browsable
**Notes:** No friction after completion. Credits awarded once, bar is decorative after.

---

## Curiosity Feed Island Fate

| Option | Description | Selected |
|--------|-------------|----------|
| Remove entirely | Progress bar replaces it. No duplication. | |
| Keep as compact summary | Shrink to mini card with concept topics. | |
| Transform into bento card | Move feed info into bento grid as a new card showing concept topics. | ✓ |

**User's choice:** Transform into bento card
**Notes:** Shows concept topics covered today. Different info from the progress bar (qualitative vs quantitative).

---

## Bento Card Content

| Option | Description | Selected |
|--------|-------------|----------|
| Concept topics covered | Shows names of concepts explored today. Complements progress bar. | ✓ |
| Mini progress ring | Compact circular progress indicator. Same info as sticky bar. | |
| Drop the bento card idea | Sticky progress bar is enough. | |

**User's choice:** Concept topics covered
**Notes:** Adds value by showing qualitative info (topic names) vs the bar's quantitative info (count).

---

## Bento Grid Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Bento scrolls under sticky bar | Progress bar is fixed at top. All content scrolls underneath. | ✓ |
| Bar appears on scroll past bento | Bar hidden initially, fades in after user scrolls past bento grid. | |

**User's choice:** Bento scrolls under sticky bar
**Notes:** Always visible, clean.

---

## Credits Amount

| Option | Description | Selected |
|--------|-------------|----------|
| 1 credit per quota | Complete all posts = +1 credit. Balanced with harvest. | ✓ |
| Scaled by post count | Credits = number of posts read. More generous. | |
| You decide | Let Claude pick. | |

**User's choice:** 1 credit per quota
**Notes:** Simple. Balanced with harvest (also 1 credit each).

---

## i18n

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, full i18n | All labels go into en.json + zh/es/ja bundles. Phase 27 workflow. | ✓ |
| English only for now | Ship hardcoded English. Translate later. | |

**User's choice:** Yes, full i18n
**Notes:** New keys under `home.feed.*` namespace. All 4 locales in same PR.

---

## Claude's Discretion

- Exact confetti particle count, animation duration, and easing curves
- Progress bar height, padding, and exact sticky positioning
- Bento card layout, icon choice, and truncation behavior for topic names
- IntersectionObserver vs manual scroll listener for read detection
- Whether the empty state message includes an icon/illustration

## Deferred Ideas

None — discussion stayed within phase scope
