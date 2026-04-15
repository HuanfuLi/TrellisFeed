---
phase: 26-trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status
verified: 2026-04-15T07:00:00Z
status: human_needed
score: 15/15 must-haves verified
human_verification:
  - test: "Harvest animation — fly-to-counter + confetti"
    expected: "Tapping 'Harvest All' in the fruit bottom sheet fires amber cherry particles flying from the status panel center to the header counter, then triggers a confetti burst 1.2s later. All particles share a unified animation (not per-fruit-type)."
    why_human: "CSS keyframe animation on DOM elements cannot be verified programmatically — requires visual inspection with at least one ripe fruit node present."
  - test: "Fruit column glow when count > 0"
    expected: "The Fruits column in the status panel pulses with a warm amber glow (status-glow keyframe, 3s loop) when any anchor has leafState==='fruit'. Column is inert when count is 0."
    why_human: "CSS animation visibility requires runtime rendering with real trellis state."
  - test: "Heal flow — parallel podcast add + review navigation"
    expected: "Tapping 'Heal' on a dying anchor in the bottom sheet (or in the Suggested Moves list) adds the topic to today's podcast queue AND navigates to /review with the anchor filtered. Both happen together, not sequentially as choices."
    why_human: "Podcast service side-effect (addConceptToPodcast) is fire-and-forget; verifying it actually queued requires inspecting podcast state after navigation."
  - test: "Re-plant flow — schedule reset + post generation + review navigation"
    expected: "Tapping 'Re-plant' on a dead anchor resets all flashcard and question SM-2 schedules to today (reviewCount=0, easeFactor=2.5), generates a new post for the anchor topic, shows a 'Schedule reset - review to revive' toast, then navigates to /review filtered to that anchor."
    why_human: "Async side-effects (post generation, localStorage schedule write) require runtime inspection with a dead node present."
  - test: "Prune animation — scissors cut + leaf fall"
    expected: "Tapping 'Prune' on a dying or dead node plays a scissors rotation animation (prune-cut keyframe, 0.3s) on the scissors icon, then the node card translates down 60px while fading out (prune-fall keyframe, 0.5s). After 0.8s the node disappears from the sheet and appears in the pruned archive below the status panel."
    why_human: "CSS keyframe animation sequence and timing requires live rendering."
  - test: "Suggested Moves priority ordering with real trellis data"
    expected: "With a mix of dead, dying, and healthy anchors: dead anchors appear first with Sprout icon and 'Re-plant' red badge; dying anchors appear second with Heart icon and 'Heal' yellow badge; autoGen moves appear third. The total count badge on the section header reflects all three groups combined."
    why_human: "Requires real trellis state (or seeded dead/dying nodes) and visual confirmation of render order."
  - test: "AutoGen dedup — no anchor appears in both trellis moves and autoGen"
    expected: "If an autoGen move's conceptId matches a dying or dead anchor, that autoGen move is suppressed from the list. The same anchor does not appear in two places in Suggested Moves."
    why_human: "Requires an autoGen move and a dying/dead node to target the same anchor concurrently to observe suppression."
---

# Phase 26: Trellis Harvest Panel, Node Actions, Suggested Moves Refactor — Verification Report

**Phase Goal:** Build the trellis harvest panel showing fruit/dying/dead counts with actionable bottom sheets (harvest, heal, re-plant, prune) and refactor the Planner's Suggested Moves section to be trellis-health-driven.
**Verified:** 2026-04-15T07:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Fruit credits can be accumulated and persisted across app restarts | VERIFIED | `trellis-credits.service.ts` — `STORAGE_KEY = 'trellis_fruit_credits'`, `getTotal()` / `add(count)` with parseInt + isFinite guard |
| 2 | HARVEST_COMPLETED event triggers trellis recompute | VERIFIED | `types/index.ts:669` has the event type; `useTrellisData.ts:36` subscribes with cleanup at line 42 |
| 3 | BottomSheet component slides up from bottom with overlay | VERIFIED | `BottomSheet.tsx` — `translateY(0)`/`translateY(100%)` transform, `zIndex: 500` overlay, `cubic-bezier(0.32, 0.72, 0, 1)` transition |
| 4 | Pruned questions can be queried separately from normal questions | VERIFIED | `question.service.ts:495-499` — `getPrunedQuestions()` filters `flagged === true && isAnchorNode === true` |
| 5 | 3-column status panel visible between trellis hero and suggested moves | VERIFIED | `TrellisStatusPanel.tsx` renders Cherry/Leaf/XCircle columns; `PlannerScreen.tsx:115-121` mounts it between `<TrellisHero />` and Suggested Moves section |
| 6 | Each column shows lucide icon + count for fruit/dying/dead | VERIFIED | `TrellisStatusPanel.tsx:73-75` — fruitNodes/dyingNodes/deadNodes derived from leafState; columns at lines 323-345 render Cherry/Leaf/XCircle with counts |
| 7 | Fruit column glows softly when count > 0 | VERIFIED (code) | `fruitGlow` const at line 170-176 applies `status-glow` keyframe when `fruitNodes.length > 0`; keyframe at lines 295-298 — animation visible only at runtime |
| 8 | Fruit counter visible in Planner header upper-right | VERIFIED | `PlannerScreen.tsx:93-111` — `<Header right={...}>` with Cherry icon, `<span ref={counterRef}>{credits}</span>` |
| 9 | Tapping a dying node triggers parallel flashcard review navigation AND podcast queue addition | VERIFIED (code) | `trellis-actions.service.ts:43-61` — `heal()` calls `podcastService.addConceptToPodcast()` fire-and-forget, returns navigate intent to `/review` with `anchorReview` state |
| 10 | Dead node re-plant resets SM-2 schedule for all linked flashcards | VERIFIED | `trellis-actions.service.ts:76-96` — `replant()` filters all flashcards by `nodeId === anchorId || qaChildIds.includes(nid)`, calls `flashcardService.updateReviewSchedule(card.id, freshSchedule())` for each |
| 11 | Dying and dead nodes show prune action (scissors icon) | VERIFIED | `TrellisStatusPanel.tsx:266-287` — `renderActionableItem()` closure renders Prune button with `<Scissors size={14} />` for both dying and dead sheets |
| 12 | Pruning archives the node (flagged=true) and removes it from trellis | VERIFIED | `trellis-actions.service.ts:123-126` — `prune()` calls `patchQuestion(anchorId, { flagged: true })` then emits `ANCHOR_DELETED` event |
| 13 | Pruned section accessible from PlannerScreen | VERIFIED | `TrellisStatusPanel.tsx:349-443` — "Pruned (N)" dashed pill rendered when `prunedNodes.length > 0`, toggles collapsible list with Restore/Delete forever per item |
| 14 | suggestedChunks system completely removed from PlannerScreen | VERIFIED | No occurrences of `suggestedChunks`, `ChunkCard`, `SIGNAL_DOT_COLOR`, `handleRegenerateChunk`, `usePlanner`, or `PlannerChunk` in `PlannerScreen.tsx` |
| 15 | Suggested moves list shows dead first, dying second, filtered autoGen third | VERIFIED | `PlannerScreen.tsx:167-249` — dead nodes (Sprout icon, Re-plant badge) → dying nodes (Heart icon, Heal badge) → `visibleAutoMoves.map(PortalCard)` |

**Score:** 15/15 truths verified (7 require human confirmation for runtime behavior)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/services/trellis-credits.service.ts` | Fruit credit CRUD (localStorage) | VERIFIED | 39 lines — `getTotal()`, `add(count)` with `trellis_fruit_credits` key, integer parse + isFinite guard, silent quota fallback |
| `app/src/components/ui/BottomSheet.tsx` | Reusable slide-up bottom sheet | VERIFIED | 74 lines — fixed overlay zIndex 500, slide-up panel with cubic-bezier, optional title+drag-handle, inline styles only |
| `app/src/types/index.ts` | HARVEST_COMPLETED in AppEvent union | VERIFIED | Line 669: `{ type: 'HARVEST_COMPLETED'; payload: { count: number } }` |
| `app/src/state/useTrellisData.ts` | Subscribes to HARVEST_COMPLETED | VERIFIED | Lines 36/42 — subscribe + unsubscribe in useEffect cleanup |
| `app/src/services/question.service.ts` | getPrunedQuestions method | VERIFIED | Lines 495-499 — filters `flagged === true && isAnchorNode === true` |
| `app/src/components/trellis/TrellisStatusPanel.tsx` | 3-column panel + bottom sheets + harvest logic + node actions + pruned section | VERIFIED | 619 lines — all harvest, heal, re-plant, prune, restore, hard-delete handlers present; 4 CSS keyframes (status-glow, fruit-fly, prune-cut, prune-fall); 3 BottomSheets; pruned archive section |
| `app/src/screens/PlannerScreen.tsx` | TrellisStatusPanel + header counter + trellis-driven suggested moves | VERIFIED | Lines 14-17 imports TrellisStatusPanel/trellisCreditsService/trellisActionsService; lines 42-59 dead/dying derivation + dedup; lines 167-249 priority-ordered rendering |
| `app/src/services/trellis-actions.service.ts` | Heal, re-plant, prune action logic | VERIFIED | 149 lines — heal/replant/prune/unpruneQuestion/hardDelete; replant resets flashcard + question schedules via freshSchedule() |
| `app/src/state/usePlanner.ts` | Deprecated (no consumers) | VERIFIED | Line 2-4 has `@deprecated Phase 26 D-22` JSDoc block |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TrellisStatusPanel.tsx` | `trellis-credits.service.ts` | `trellisCreditsService.add()` | WIRED | Line 84 — `const newTotal = trellisCreditsService.add(count)` |
| `TrellisStatusPanel.tsx` | `trellis-blossom-dates.service.ts` | `clearBlossomDate()` | WIRED | Lines 29, 83 — imported and called per fruit node |
| `TrellisStatusPanel.tsx` | `event-bus.ts` | `emit HARVEST_COMPLETED` | WIRED | Line 86 — `eventBus.emit({ type: 'HARVEST_COMPLETED', payload: { count } })` |
| `trellis-actions.service.ts` | `flashcard.service.ts` | `updateReviewSchedule for re-plant` | WIRED | Line 81 — `flashcardService.updateReviewSchedule(card.id, freshSchedule())` |
| `trellis-actions.service.ts` | `podcast.service.ts` | `addConceptToPodcast for heal` | WIRED | Line 46 — `podcastService.addConceptToPodcast(today(), anchorId)` |
| `trellis-actions.service.ts` | `question.service.ts` | `patchQuestion for prune/replant` | WIRED | Lines 85, 92, 124, 135 — patchQuestion called for replant schedule reset and prune/unprune |
| `PlannerScreen.tsx` | `useTrellisData.ts` | `layout.nodes for trellis move derivation` | WIRED | Line 34 — `const { layout } = useTrellisData()` |
| `PlannerScreen.tsx` | `usePlannerAutoGen.ts` | `autoMoves filtered by dyingDeadIds` | WIRED | Lines 47-51 — `dyingDeadIds` Set built from dead+dying anchor IDs, `filteredAutoMoves = autoMoves.filter(move => !dyingDeadIds.has(move.conceptId))` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `TrellisStatusPanel.tsx` | `fruitNodes / dyingNodes / deadNodes` | `nodes` prop → `useTrellisData` → `buildTrellisState` → localStorage flashcards | Yes — trellis state computed from SM-2 schedule data, not hardcoded | FLOWING |
| `TrellisStatusPanel.tsx` | `prunedNodes` | `questionService.getPrunedQuestions()` → localStorage questions filter | Yes — reads live localStorage store | FLOWING |
| `PlannerScreen.tsx` | `credits` | `useState(() => trellisCreditsService.getTotal())` → `trellis_fruit_credits` localStorage | Yes — reads localStorage key on mount, updated via `setCredits` callback from TrellisStatusPanel | FLOWING |
| `PlannerScreen.tsx` | `deadNodes / dyingNodes / filteredAutoMoves` | `layout.nodes` from `useTrellisData`, `autoMoves` from `usePlannerAutoGen` | Yes — both hooks read from live services | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable entry points available without a dev server. All core behaviors require visual rendering.

---

### Requirements Coverage (D-01 through D-23)

| Decision | Plan | Description | Status | Evidence |
|----------|------|-------------|--------|----------|
| D-01 | 26-01 | Credits accumulated and persisted via localStorage | SATISFIED | `trellis-credits.service.ts` — `trellis_fruit_credits` key |
| D-02 | 26-02 | Batch harvest via "Harvest All" | SATISFIED | `TrellisStatusPanel.tsx:456-477` — Harvest All button |
| D-03 | 26-02 | Unified fly-to-counter + confetti, not per-fruit-type | SATISFIED | `handleHarvest` fires all particles from same origin; `particleCount = Math.min(count, 8)` |
| D-04 | 26-02 | Fruit counter in upper-right of Planner header | SATISFIED | `PlannerScreen.tsx:93-111` — `<Header right={...}>` with Cherry + credits span |
| D-05 | 26-02 | Fruit column glows when count > 0 | SATISFIED (code) | `fruitGlow` applied when `fruitNodes.length > 0`; requires runtime confirmation |
| D-06 | 26-02 | Harvested fruit nodes reset to green (blossom date cleared) | SATISFIED | `clearBlossomDate(n.anchor.id)` per fruit node; HARVEST_COMPLETED triggers trellis recompute |
| D-07 | 26-02 | 3-column panel between trellis hero and suggested moves | SATISFIED | `PlannerScreen.tsx:113-121` — panel mounted in correct position |
| D-08 | 26-02 | Three columns: Ripe Fruits (fruit) / Dying (yellow+falling) / Dead (fallen) | SATISFIED | `TrellisStatusPanel.tsx:73-75` — exact filter expressions match D-08 |
| D-09 | 26-01/26-02 | Bottom sheets for each column with node lists | SATISFIED | `BottomSheet` component; 3 instances in `TrellisStatusPanel` |
| D-10 | 26-02 | Lucide icons for columns (Cherry/Leaf/XCircle) | SATISFIED | `TrellisStatusPanel.tsx:328/336/341` |
| D-11 | 26-03 | Heal = parallel: flashcard review navigation + podcast queue | SATISFIED | `heal()` calls addConceptToPodcast (fire-and-forget) and returns review nav state |
| D-12 | 26-03 | Heal succeeds when review completed → node returns to green | SATISFIED | Existing REVIEW_COMPLETED pipeline unchanged; no new work needed per plan |
| D-13 | 26-03 | Re-plant: generate post + existing flashcards (no new ones) | SATISFIED | `replant()` calls `conceptFeedService.generateMorePosts()` but uses existing flashcards only |
| D-14 | 26-03 | Re-plant resets SM-2 schedule | SATISFIED | `replant()` resets all linked flashcards and anchor/Q&A question schedules via `freshSchedule()` |
| D-15 | 26-03 | Dying and dead nodes show prune action | SATISFIED | `renderActionableItem()` adds Scissors Prune button to both sheets |
| D-16 | 26-01/26-03 | Two-step soft delete: archive first, hard-delete from pruned section | SATISFIED | `prune()` → `flagged: true`; pruned section shows Delete forever button |
| D-17 | 26-03 | Prune animation: scissors cut + leaf fall | SATISFIED (code) | CSS keyframes `prune-cut` + `prune-fall`, 0.8s total delay before state flip |
| D-18 | 26-03 | Pruned section accessible from PlannerScreen | SATISFIED | Dashed pill "Pruned (N)" below status panel, toggles collapsible list |
| D-19 | 26-04 | Trellis health is primary source for suggested moves | SATISFIED | Dead/dying nodes derived from layout.nodes before autoGen moves |
| D-20 | 26-04 | Priority: dead (re-plant) → dying (heal) → autoGen | SATISFIED | `PlannerScreen.tsx:167-249` — render order matches spec |
| D-21 | 26-04 | Ripe fruits NOT in suggested moves | SATISFIED | fruit leafState excluded from both `deadNodes` and `dyingNodes` filters |
| D-22 | 26-04 | suggestedChunks / ChunkCard system removed | SATISFIED | Zero occurrences of suggestedChunks/ChunkCard/SIGNAL_DOT_COLOR/handleRegenerateChunk in PlannerScreen.tsx |
| D-23 | 26-04 | AutoGen dedup against dying/dead anchors | SATISFIED | `dyingDeadIds` Set + `filteredAutoMoves` filter in PlannerScreen component body |

All 23 decisions: 23/23 SATISFIED

---

### Anti-Patterns Found

No blockers. No stubs. No TODOs in phase-26-authored files.

One minor pattern noted in `TrellisStatusPanel.tsx` line 606-608: fly-to-counter particles re-read `panelRef.current.getBoundingClientRect()` inside JSX render (called on every render while `flyParticles.length > 0`). This is a minor inefficiency but does not affect correctness — the particle position is pinned by CSS at the moment of particle creation.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `TrellisStatusPanel.tsx` | 588-590 | `getBoundingClientRect()` called in JSX render for particle container position | Info | No user-visible defect; position computed once at harvest time. Not a stub. |

Pre-existing TypeScript errors in `GraphScreen.tsx`, `canonical-knowledge.service.ts`, `review.service.ts`, and `trellis-state.service.ts` (documented in `deferred-items.md`) are explicitly out of scope for this phase.

---

### Human Verification Required

#### 1. Harvest animation — fly-to-counter + confetti

**Test:** With at least one anchor in `fruit` leafState (requires a question whose review schedule indicates >= 3 consecutive on-time reviews), open the Planner screen, tap the Fruits column, and tap "Harvest All."
**Expected:** Up to 8 amber circular particles animate from the center of the status panel flying in an arc toward the header credit counter. After ~1.2s, a confetti burst fires. The credit counter increments immediately on tap.
**Why human:** CSS keyframe animations (fruit-fly, confetti) cannot be asserted programmatically.

#### 2. Fruit column glow when count > 0

**Test:** With at least one fruit node, inspect the Fruits column on the status panel.
**Expected:** The Fruits column has a soft pulsing amber box-shadow (3s loop). No glow when count is 0.
**Why human:** CSS animation visibility requires runtime rendering.

#### 3. Heal flow — parallel podcast add + review navigation

**Test:** With a dying node (yellow or falling leafState), tap the Dying column, then tap "Heal" on any anchor.
**Expected:** The review screen opens filtered to that anchor's Q&As (confirm via the session title shown). In the Podcast screen, today's podcast now includes that anchor's topic (check podcast queue).
**Why human:** The podcast add is fire-and-forget — verifying it actually succeeded requires checking the podcast service state after navigation, which cannot be done without a running app.

#### 4. Re-plant flow — schedule reset + post generation + review navigation

**Test:** With a dead node (fallen leafState), tap the Dead column, then tap "Re-plant." Observe the toast and the review session.
**Expected:** Toast "Schedule reset - review to revive" appears. Review screen opens filtered to that anchor. In the Home screen feed, a new post has been generated for the anchor's topic. Revisiting the Planner shows the anchor no longer in the Dead column (pending next SM-2 review).
**Why human:** Post generation is async and requires LLM call. Schedule reset persistence requires localStorage inspection.

#### 5. Prune animation — scissors cut + leaf fall

**Test:** With a dying or dead node visible in a bottom sheet, tap "Prune."
**Expected:** The scissors icon on the Prune button rotates −25° and back (0.3s). The node card translates down 60px while fading to opacity 0 (0.5s). After 0.8s the node disappears from the sheet and "Pruned (1)" appears below the status panel.
**Why human:** Sequential CSS animation timing requires visual inspection.

#### 6. Suggested Moves priority ordering with real data

**Test:** With a mix of dead, dying, and healthy anchors with autoGen moves, open the Planner.
**Expected:** Dead anchors appear first (Sprout icon, red "Re-plant" badge), dying anchors second (Heart icon, yellow "Heal" badge), autoGen third (PortalCard style). Total count badge in the section header sums all three groups.
**Why human:** Requires live trellis data to observe correct priority rendering.

#### 7. AutoGen dedup — same anchor not shown twice

**Test:** Engineer a state where autoGen produces a move whose conceptId matches a currently dying or dead anchor (may require inspecting/editing localStorage autoGen cache).
**Expected:** That autoGen move does not appear in Suggested Moves. The dying/dead trellis row covers it exclusively.
**Why human:** Requires specific overlap between autoGen state and trellis state to observe.

---

### Gaps Summary

No gaps. All 23 phase decisions are implemented with substantive, wired code. TypeScript compiles clean (`exit: 0` on root config). Seven human verification items cover animation, side-effect confirmation, and priority rendering — none block the core functionality from being code-complete.

---

_Verified: 2026-04-15T07:00:00Z_
_Verifier: Claude (gsd-verifier)_
