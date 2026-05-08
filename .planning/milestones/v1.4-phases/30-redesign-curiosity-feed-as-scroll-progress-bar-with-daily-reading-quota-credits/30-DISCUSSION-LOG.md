# Phase 30: Redesign curiosity feed — Discussion Log (v2)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 30-redesign-curiosity-feed-as-scroll-progress-bar-with-daily-reading-quota-credits
**Areas discussed:** Reading definition, Collapsing header, Card states, Quota target, PostDetailScreen tracking, Concept grouping, Non-concept items, Signal mechanism
**Note:** v2 re-scope after v1 UAT failure. v1 tracked "scroll past = read" with a fixed sticky header. User rejected: too passive, greeting replacement looked bad.

---

## Reading Definition (v2 — replaces v1 D-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Open post + scroll 70% | User taps post, scrolls past 70%. Passive proof of engagement. | |
| Open post + ask follow-up | User taps post AND asks follow-up question. Active engagement. | |
| Either action counts | Scroll 70% OR follow-up OR 30s dwell — any triggers credit. | ✓ |

**User's choice:** Either action counts
**Notes:** Three paths to mark a concept explored. Most forgiving.

---

## Collapsing Header (v2 — replaces v1 D-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Title scrolls away, bar always visible | Progress bar fixed at top from start. Title scrolls under. | |
| Title + bar both visible, title collapses | iOS-style collapsing header. | |
| Transform CURIOSITY FEED card into progress bar | Card lives inline. When scrolled to top, sticks and compresses. Greeting pushed out naturally. | ✓ |

**User's choice:** Transform CURIOSITY FEED card (custom idea)
**Notes:** User proposed: modify the existing CURIOSITY FEED banner to become the progress bar. When scrolled to top, squeeze greeting out and transform card into compact header.

---

## Card Visual States

| Option | Description | Selected |
|--------|-------------|----------|
| Card → thin bar | Full card with icon/title/bar shrinks to thin bar when sticky. 200ms CSS transition. | ✓ |
| Card stays full-size when sticky | Sticks in original form. Simpler but wastes space. | |

**User's choice:** Card → thin bar

---

## Quota Target

| Option | Description | Selected |
|--------|-------------|----------|
| Unique concepts in today's feed | Count distinct anchorIds. Natural and achievable. | ✓ |
| Fixed daily target (e.g. 3) | Consistent but may be unachievable. | |
| You decide | | |

**User's choice:** Unique concepts in today's feed

---

## PostDetailScreen Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| Scroll 70% of essay | IntersectionObserver at 70% depth. | |
| Scroll 70% OR 30s dwell | Either scrolling deep or staying 30s. | ✓ |
| Scroll 70% OR follow-up | Two distinct engagement paths. | |

**User's choice:** Scroll 70% OR spend 30s on post
**Notes:** Plus asking follow-up also counts (decided in separate question).

---

## Concept Grouping

| Option | Description | Selected |
|--------|-------------|----------|
| Use anchor node IDs | Group by anchorId. Already in post data. | ✓ |
| Topic/title clustering | Fuzzy clustering. Less precise. | |
| You decide | | |

**User's choice:** Use anchor node IDs

---

## Non-Concept Feed Items

| Option | Description | Selected |
|--------|-------------|----------|
| Excluded from quota | News, videos, connections = bonus content. Don't affect bar. | ✓ |
| Include everything | All items count. Dilutes theme. | |
| Separate bonus indicator | Badge on non-concept items. | |

**User's choice:** Excluded from quota

---

## Signal Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Event bus | CONCEPT_EXPLORED event. HomeScreen subscribes. Same as REVIEW_COMPLETED. | ✓ |
| Service + polling | Direct service write, HomeScreen re-reads on focus. | |
| React context | Shared state. Works with always-mounted screens. | |

**User's choice:** Event bus

---

## Bento Card

Deferred to UI-SPEC design review. v1 implementation caused layout issues (big empty space). Will decide during `/gsd:ui-phase`.

---

## Claude's Discretion

- CSS transition details for card-to-bar animation
- IntersectionObserver thresholds and sentinel placement
- Timer implementation for 30s dwell
- Empty state icon/illustration
- Progress card styling in both states
