---
phase: 29-final-polishment
log_type: uat-walkthrough
started: 2026-04-16
completed: 2026-04-16
operator: HuanfuLi
active_items: 23
skip_items: 4
total_items: 27
---

# 29 UAT Log

All `human_needed` items across archived v1.3 phases 20, 21, 22, 26.
Skip items (per D-23) are recorded for audit completeness but require NO walkthrough.

## Summary

| Column | Meaning |
|--------|---------|
| Item ID | `{source-phase}-UAT-{n}` (n = index from VERIFICATION.md human_verification list) |
| Source Phase | 20 / 21 / 22 / 26 |
| Test | Brief from VERIFICATION.md `test` field |
| Expected | From VERIFICATION.md `expected` field |
| Actual | What operator observed on device |
| Pass/Fail | PASS / FAIL / SKIP |
| Fix Commit | git SHA (if FAIL->fixed); --- otherwise |
| Date | YYYY-MM-DD item was tested |
| Notes | Deviation, workaround, context |

## Items

### Source Phase 20 --- Orchestration strategy + diagnostic dialogue (4 items)

| Item ID | Source Phase | Test | Expected | Actual | Pass/Fail | Fix Commit | Date | Notes |
|---------|-------------|------|----------|--------|-----------|-----------|------|-------|
| 20-UAT-1 | 20 | Portal card layout and content type indicators display correctly | Cards show topic name, description, colored border, and 3 tappable indicators with counts | Portal cards implemented in different style, functional | PASS | --- | 2026-04-16 | Restyled but functional |
| 20-UAT-2 | 20 | Diagnostic chat conversation flow (submit -> follow-up -> reply -> done) | Check-in text submits, LLM follow-up appears as left-aligned bubble, user reply renders right-aligned, Done ends flow | --- | SKIP | --- | 2026-04-16 | Feature deprecated and discarded |
| 20-UAT-3 | 20 | Navigation from portal card content type indicators to correct screens | Flashcard indicator -> /review with nodeId filter, Post indicator -> /posts/:id, Question indicator -> /ask/:id | Portal card navigation functional | PASS | --- | 2026-04-16 | Restyled but routing works |
| 20-UAT-4 | 20 | Portal card primary CTA navigates via moveNavigator | Tapping the primary button triggers navigateToMove and routes to the correct content | CTA navigation functional | PASS | --- | 2026-04-16 | Restyled but routing works |

### Source Phase 21 --- Review cap fix + generate-on-enter posts (4 active + 1 SKIP)

| Item ID | Source Phase | Test | Expected | Actual | Pass/Fail | Fix Commit | Date | Notes |
|---------|-------------|------|----------|--------|-----------|-----------|------|-------|
| 21-UAT-1 | 21 | Feed loads in <3s with card-face-only posts (no essay bodies) | Home feed renders quickly showing titles, teaser hooks, and images -- no long LLM waits | Cards render quickly, no essay delay | PASS | --- | 2026-04-16 | |
| 21-UAT-2 | 21 | Opening a post with empty bodyMarkdown shows streaming essay with no layout shift | UI shell (back button, title, carousel) renders immediately; essay text streams in progressively inside minHeight container | UI shell immediate, essay streams without layout shift | PASS | --- | 2026-04-16 | |
| 21-UAT-3 | 21 | Re-visiting a previously opened post loads cached essay instantly | No streaming indicator; essay body renders from localStorage cache | Cached essay loads instantly | PASS | --- | 2026-04-16 | |
| 21-UAT-4 | 21 | Daily goal progress bar updates across review sessions | N/A -- daily goal progress bar was removed in follow-up fix (36d6ea8b); completion progress bar used instead | --- | SKIP | --- | --- | D-23: REVIEW-03 descoped per feedback_daily_goal.md; already N/A in 21-VERIFICATION.md |
| 21-UAT-5 | 21 | Video/news posts stream summaries on-enter | Opening a video or news post triggers on-enter streaming of transcript/article summary | Summary streams on-enter | PASS | --- | 2026-04-16 | |

### Source Phase 22 --- Swipe navigation (9 active + 2 SKIP)

| Item ID | Source Phase | Test | Expected | Actual | Pass/Fail | Fix Commit | Date | Notes |
|---------|-------------|------|----------|--------|-----------|-----------|------|-------|
| 22-UAT-1 | 22 | Swipe between all 5 screens -- bottom nav highlight interpolates proportionally | Bottom nav icon/label colors animate smoothly as finger drags, not just on commit | Nav indicator moves in sync with finger | PASS | --- | 2026-04-16 | |
| 22-UAT-2 | 22 | Rubber-band resistance at edges (Home right-swipe, Settings left-swipe) | Drag feels heavier/sticky at edges, springs back on release | Resists and snaps back at edges | PASS | --- | 2026-04-16 | |
| 22-UAT-3 | 22 | Small swipe (< 20% screen width) snaps back | Short drag returns to original tab; no navigation commit | Snaps back on short swipe | PASS | --- | 2026-04-16 | |
| 22-UAT-4 | 22 | Tab tap triggers slide animation, not instant jump | (REVERTED) | --- | SKIP | --- | --- | D-23: SWIPE-09 reverted 2026-04-15 per 22-VERIFICATION.md addendum; replaced with instant transport |
| 22-UAT-5 | 22 | Non-adjacent tab tap (e.g. Home -> Settings) slides directly without intermediates | (REVERTED) | --- | SKIP | --- | --- | D-23: reverted 2026-04-15; non-adjacent taps now snap instantly |
| 22-UAT-6 | 22 | PostCarousel image swipe does not trigger tab navigation | Swiping the image carousel changes images, not tabs | Carousel swipe contained, no tab nav | PASS | --- | 2026-04-16 | |
| 22-UAT-7 | 22 | MindElixir graph pan does not trigger tab navigation | Panning inside the graph container moves the mindmap, not the tab strip | Graph pan contained, no tab nav | PASS | --- | 2026-04-16 | |
| 22-UAT-8 | 22 | Keyboard-open suppresses tab swipe (Ask screen input focus) | With virtual keyboard visible, horizontal swipe is ignored | Swipe blocked with keyboard open | PASS | --- | 2026-04-16 | |
| 22-UAT-9 | 22 | GraphScreen MindElixir renders correctly when first revealed via swipe | Mind map is visible and centered, not 0-width or collapsed | MindElixir renders correctly on first swipe | PASS | --- | 2026-04-16 | |
| 22-UAT-10 | 22 | Sub-screens (PostDetail, Review, etc.) render in overlay; swipe disabled there | Navigating to /posts/:id shows full-screen overlay, swiping does nothing | Sub-screen overlay, swipe disabled | PASS | --- | 2026-04-16 | |
| 22-UAT-11 | 22 | Scroll position preserved across tab switches | After scrolling Home feed down and switching to Ask and back, Home scroll position is preserved | Scroll position preserved | PASS | --- | 2026-04-16 | |

### Source Phase 26 --- Trellis harvest panel (7 items)

| Item ID | Source Phase | Test | Expected | Actual | Pass/Fail | Fix Commit | Date | Notes |
|---------|-------------|------|----------|--------|-----------|-----------|------|-------|
| 26-UAT-1 | 26 | Harvest animation -- fly-to-counter + confetti | Tapping the Fruit button directly triggers fly particles from the fruit button center toward the header counter span, then a confetti burst fires 1.2s later. The credit counter increments immediately. | Particles fly to counter, confetti fires, counter increments | PASS | --- | 2026-04-16 | |
| 26-UAT-2 | 26 | Fruit column glow when count > 0 | The Fruit button pulses with a warm amber glow (status-glow keyframe, 3s loop) when fruitNodes.length > 0. No glow when count is 0 and the button is disabled. | Amber glow pulses when count > 0, no glow at 0 | PASS | --- | 2026-04-16 | |
| 26-UAT-3 | 26 | Heal flow -- direct row tap | Tapping a dying anchor row in Suggested Moves adds its topic to today's podcast queue AND navigates to /review filtered to that anchor's Q&As. | Podcast queue + /review navigation works | PASS | --- | 2026-04-16 | |
| 26-UAT-4 | 26 | Re-plant flow -- schedule reset + post generation + review navigation | Tapping a dead anchor row resets SM-2 schedules to today, generates a post for the topic, shows toast, then navigates to /review filtered to that anchor. | Toast shown, schedules reset, navigates to review | PASS | --- | 2026-04-16 | |
| 26-UAT-5 | 26 | Prune button on Suggested Moves row -- no sheet, direct archive | Tapping the scissors button on a dying or dead row calls prune() and shows toast. The row disappears. PrunedSection shows the pruned item. Row's main tap area is NOT triggered (stopPropagation). | Prune works, PrunedSection shows item, stopPropagation works | PASS | --- | 2026-04-16 | Note: scissor animation on trellis graph not yet implemented (deferred to future phase) |
| 26-UAT-6 | 26 | Suggested Moves priority ordering with real trellis data | Dead anchors appear first with Sprout icon and red badge; dying anchors second with Heart icon and yellow badge; autoGen moves third. | Priority ordering correct: dead > dying > autoGen | PASS | --- | 2026-04-16 | |
| 26-UAT-7 | 26 | AutoGen dedup -- same anchor not in both trellis rows and autoGen | If an autoGen move's conceptId matches a dying or dead anchor, that autoGen move is suppressed. | Dedup works, no duplicate anchors | PASS | --- | 2026-04-16 | |

## Walkthrough-surfaced issues (inline fixes)

(Empty at scaffold; populated as operator surfaces bugs.)

| Issue | Surfaced During | Fix Commit | Re-test Result | Date |
|-------|-----------------|-----------|----------------|------|

## Sign-off

- [x] All 23 active items PASS (0 FAILs)
- [x] All 4 SKIP items documented (3 D-23 + 1 deprecated feature)
- [x] All walkthrough-surfaced issues fixed and re-tested (none surfaced)
- [x] Phase 20/21/22/26 VERIFICATION.md frontmatter flipped to `status: passed`
- [x] Operator sign-off: HuanfuLi 2026-04-16

## Post-sign-off supersession

### TD-01 SUPERSEDED by Phase 31 (recorded 2026-04-19)

| Entry | Value |
|-------|-------|
| Original item | TD-01 — curiosity-signal wiring at plannerAutoGen + concept-feed call sites |
| Superseded by | Phase 31 D-14 (31-CONTEXT.md) — generation-time weak-concept prioritization |
| Rationale | Phase 31's `buildConceptBatch` generates 2 posts per important concept (ease < 1.5 or dying/falling/dead LeafState) AT generation time. The Phase 29 runtime sort bias would double-layer the weighting. |
| Code evidence | applyStrategyBias removed from concept-feed.service.ts; plannerAutoGen.service.ts retains wiring |
| Closure commit | e6ca3d35 |
| Recorded by | Phase 33 TD-04 resolution (33-CONTEXT.md D-05) |
