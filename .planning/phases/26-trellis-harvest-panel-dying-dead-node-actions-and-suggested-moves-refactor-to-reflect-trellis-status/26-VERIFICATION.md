---
phase: 26-trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status
verified: 2026-04-15T10:00:00Z
status: human_needed
score: 15/15 must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 15/15
  gaps_closed:
    - "Bottom sheets removed — no regression on panel layout or harvest flow"
    - "Panel order corrected to Dying | Fruit | Dead"
    - "Fruit column is now a direct-harvest button (no sheet)"
    - "Prune scissors moved to Suggested Moves rows with stopPropagation"
    - "PrunedSection extracted to standalone component, mounted at PlannerScreen bottom"
    - "prunedFromTrellis flag used for prune/unprune/filter (distinct from off-topic flagged)"
    - "hashStr import fix confirmed present in trellis-state.service.ts"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Harvest animation — fly-to-counter + confetti (re-test after simplification)"
    expected: "Tapping the Fruit button directly triggers fly particles from the fruit button center toward the header counter span, then a confetti burst fires 1.2s later. The credit counter increments immediately."
    why_human: "CSS keyframe animation (fruit-fly, Confetti component) cannot be verified without runtime rendering."
  - test: "Fruit column glow when count > 0"
    expected: "The Fruit button pulses with a warm amber glow (status-glow keyframe, 3s loop) when fruitNodes.length > 0. No glow when count is 0 and the button is disabled."
    why_human: "CSS animation visibility requires runtime rendering with at least one ripe fruit anchor."
  - test: "Heal flow — direct row tap (re-test after hashStr fix)"
    expected: "Tapping a dying anchor row in Suggested Moves adds its topic to today's podcast queue AND navigates to /review filtered to that anchor's Q&As. Both happen together."
    why_human: "Podcast add is fire-and-forget; verifying it queued requires inspecting podcast state after navigation. hashStr fix (commit 715e5ec4) unblocked this path — needs retest."
  - test: "Re-plant flow — schedule reset + post generation + review navigation (re-test after hashStr fix)"
    expected: "Tapping a dead anchor row resets SM-2 schedules to today, generates a post for the topic, shows 'Schedule reset - review to revive' toast, then navigates to /review filtered to that anchor."
    why_human: "Async side-effects require runtime inspection. hashStr fix unblocked real dead nodes appearing — needs retest."
  - test: "Prune button on Suggested Moves row — no sheet, direct archive"
    expected: "Tapping the scissors button on a dying or dead row calls trellisActionsService.prune() and shows 'Pruned — moved to archive' toast. The row disappears. PrunedSection at the bottom now shows that node. The row's main tap area (heal/replant) is NOT triggered (stopPropagation verified)."
    why_human: "stopPropagation behavior and PrunedSection appearance require visual confirmation. Prune animation removed in simplified UX — no scissors keyframe to verify."
  - test: "Suggested Moves priority ordering with real trellis data (re-test after hashStr fix)"
    expected: "With a mix of dead, dying, and healthy anchors: dead anchors appear first with Sprout icon and red 'Re-plant' badge; dying anchors second with Heart icon and yellow 'Heal' badge; autoGen moves third. Total count badge on section header reflects all three groups."
    why_human: "Requires real dying/dead nodes in trellis state. hashStr fix enables this path — needs retest."
  - test: "AutoGen dedup — same anchor not in both trellis rows and autoGen (re-test after hashStr fix)"
    expected: "If an autoGen move's conceptId matches a dying or dead anchor, that autoGen move is suppressed. The same anchor does not appear twice in Suggested Moves."
    why_human: "Requires specific state overlap between autoGen cache and trellis dying/dead state."
---

# Phase 26: Trellis Harvest Panel, Node Actions, Suggested Moves Refactor — Re-Verification Report

**Phase Goal:** Build the trellis harvest panel showing fruit/dying/dead counts with actionable UX (harvest, heal, re-plant, prune) and refactor the Planner's Suggested Moves section to be trellis-health-driven.
**Verified:** 2026-04-15T10:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after architecture simplification (bottom sheets removed, direct harvest, prune on rows, PrunedSection extracted)

---

## Architecture Change Summary

After the first UAT round the following simplifications were applied and are now the canonical implementation:

1. **Bottom sheets removed entirely** from TrellisStatusPanel. D-09 is voided — the bottom-sheet-per-column UX was replaced with a flatter layout.
2. **Panel layout:** Dying | Fruit | Dead (in that order). Fruit is the centered primary-styled harvest button. Dying/Dead are display-only counters with no onClick.
3. **Actions moved to Suggested Moves rows.** Heal on dying row tap. Re-plant on dead row tap. Scissors prune button on every dying/dead row (stopPropagation so it does not also trigger heal/replant). Calls `trellisActionsService.prune()` directly — no animation overlay.
4. **PrunedSection** extracted to `app/src/components/trellis/PrunedSection.tsx`, mounted at the bottom of PlannerScreen after Suggested Moves. Auto-refreshes on ANCHOR_DELETED / CLASSIFICATION_COMPLETED / QUESTION_DELETED events.
5. **`prunedFromTrellis` flag** on `Question` type distinguishes trellis-pruned nodes from off-topic-flagged questions. `prune()` sets both `flagged:true` and `prunedFromTrellis:true`. `getPrunedQuestions()` filters by `prunedFromTrellis === true`.
6. **Runtime fixes applied:** `hashStr` import added to `trellis-state.service.ts` (commit 715e5ec4); prune scissors animation enhanced (commit 983a9688, though animation itself was subsequently removed in simplification — the plain prune call remains).

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Fruit credits accumulate and persist across app restarts | VERIFIED | `trellis-credits.service.ts` — `STORAGE_KEY = 'trellis_fruit_credits'`, `getTotal()` / `add(count)` with parseInt + isFinite guard |
| 2 | HARVEST_COMPLETED event triggers trellis recompute | VERIFIED | `types/index.ts:670` has the event; `useTrellisData.ts:36` subscribes with cleanup |
| 3 | Status panel renders Dying | Fruit | Dead in that exact column order | VERIFIED | `TrellisStatusPanel.tsx:146-173` — Dying div, then Fruit button, then Dead div in JSX order |
| 4 | Fruit column is a button that directly calls handleHarvest (no sheet) | VERIFIED | `TrellisStatusPanel.tsx:153-166` — `<button ref={fruitRef} onClick={handleHarvest} ...>` with no BottomSheet in the file |
| 5 | Dying and Dead columns are display-only (no onClick) | VERIFIED | `TrellisStatusPanel.tsx:146-150, 169-173` — both are plain `<div>` elements; the only `onClick` in the file is line 155 on the fruit button |
| 6 | Suggested Moves dying rows have scissors prune button that does not trigger heal | VERIFIED | `PlannerScreen.tsx:249-262` — `onClick={(e) => { e.stopPropagation(); handlePrune(node.anchor.id); }}` on scissors button within dying row |
| 7 | Suggested Moves dead rows have scissors prune button that does not trigger re-plant | VERIFIED | `PlannerScreen.tsx:201-214` — same stopPropagation pattern on dead row's scissors button |
| 8 | PrunedSection mounted at the bottom of PlannerScreen after Suggested Moves | VERIFIED | `PlannerScreen.tsx:330-331` — `{/* ── Pruned archive (bottom of page) ──────────────────────────── */}` then `<PrunedSection />` after all Suggested Moves JSX |
| 9 | PrunedSection subscribes to ANCHOR_DELETED / CLASSIFICATION_COMPLETED / QUESTION_DELETED | VERIFIED | `PrunedSection.tsx:22-26` — eventBus.subscribe for all three events with cleanup |
| 10 | prunedFromTrellis flag is set on prune, cleared on unprune, and used as the filter in getPrunedQuestions | VERIFIED | `trellis-actions.service.ts:124` — `patchQuestion(anchorId, { flagged: true, prunedFromTrellis: true })`; line 135 — `prunedFromTrellis: false`; `question.service.ts:497` — `q.prunedFromTrellis === true` |
| 11 | Fruit glow animation on button when count > 0 | VERIFIED (code) | `TrellisStatusPanel.tsx:119` — `animation: fruitNodes.length > 0 ? 'status-glow 3s ease-in-out infinite' : undefined`; keyframe at lines 125-128 |
| 12 | Fruit counter visible in Planner header upper-right | VERIFIED | `PlannerScreen.tsx:97-117` — `<Header right={...}>` with Cherry icon and `<span ref={counterRef}>{credits}</span>` |
| 13 | Suggested Moves priority: dead first, dying second, filtered autoGen third | VERIFIED | `PlannerScreen.tsx:172-282` — deadNodes.map then dyingNodes.map then visibleAutoMoves.map in that sequence |
| 14 | AutoGen moves deduped against dying/dead anchor IDs (D-23) | VERIFIED | `PlannerScreen.tsx:48-52` — `dyingDeadIds` Set built from dead+dying IDs; `filteredAutoMoves = autoMoves.filter(move => !dyingDeadIds.has(move.conceptId))` |
| 15 | suggestedChunks system completely removed | VERIFIED | No occurrences of `suggestedChunks`, `ChunkCard`, `SIGNAL_DOT_COLOR`, `handleRegenerateChunk`, or `usePlanner` destructure in PlannerScreen.tsx |

**Score:** 15/15 truths verified (7 require human confirmation for runtime behavior)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/trellis/TrellisStatusPanel.tsx` | Simplified: 3-column panel (Dying div / Fruit button / Dead div) + harvest handler + fly particles + confetti | VERIFIED | 212 lines. No BottomSheet, no navigate hook, no sheet-related handlers. Cherry/Leaf/XCircle icons. handleHarvest directly clears blossom dates, adds credits, emits HARVEST_COMPLETED, triggers particles. |
| `app/src/components/trellis/PrunedSection.tsx` | Standalone pruned archive component at PlannerScreen bottom | VERIFIED | 135 lines. Reads from questionService.getPrunedQuestions(). Subscribes to 3 eventBus events for auto-refresh. Restore (RotateCcw) and Delete (Trash2) buttons per row. |
| `app/src/screens/PlannerScreen.tsx` | TrellisStatusPanel + prune-on-row + PrunedSection + trellis-driven suggested moves | VERIFIED | 334 lines. Scissors prune button on dead rows (line 201-214) and dying rows (line 249-262), both with stopPropagation. PrunedSection at line 331. |
| `app/src/services/trellis-actions.service.ts` | heal / replant / prune / unprune / hardDelete; prune sets prunedFromTrellis | VERIFIED | 149 lines. prune() sets both `flagged: true` and `prunedFromTrellis: true`. unpruneQuestion() clears both. |
| `app/src/types/index.ts` | Question.prunedFromTrellis field + HARVEST_COMPLETED event | VERIFIED | Line 33: `prunedFromTrellis?: boolean` with explanatory comment. Line 670: HARVEST_COMPLETED event type. |
| `app/src/services/question.service.ts` | getPrunedQuestions filters by prunedFromTrellis=true | VERIFIED | Lines 495-499: filters `q.flagged === true && q.prunedFromTrellis === true`. patchQuestion at line 522 is a spread-merge accepting any Partial<Question> including prunedFromTrellis. |
| `app/src/services/trellis-state.service.ts` | hashStr imported (runtime fix) | VERIFIED | Line 6: `import { generateVinePath, getLeafPosition, getVineColor, hashStr, type VinePathSpec } from './trellis-layout.service.ts'` — used at lines 240 and 269. |
| `app/src/components/ui/BottomSheet.tsx` | Exists but unused by this phase (available for future use) | VERIFIED | File exists at 74 lines. Zero imports from any phase-26 file (TrellisStatusPanel no longer imports it). |
| `app/src/services/trellis-credits.service.ts` | Fruit credit persistence | VERIFIED | localStorage with `trellis_fruit_credits` key, getTotal/add with integer parse guard. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TrellisStatusPanel.tsx` | `trellis-credits.service.ts` | `trellisCreditsService.add(count)` | WIRED | Line 50 — returns new total, passed to onCreditsChange |
| `TrellisStatusPanel.tsx` | `trellis-blossom-dates.service.ts` | `clearBlossomDate()` per fruit node | WIRED | Line 49 — called in fruitNodes.forEach inside handleHarvest |
| `TrellisStatusPanel.tsx` | `event-bus.ts` | `emit HARVEST_COMPLETED` | WIRED | Line 52 — `eventBus.emit({ type: 'HARVEST_COMPLETED', payload: { count } })` |
| `PlannerScreen.tsx` | `trellis-actions.service.ts` | `prune(anchorId)` on scissors click | WIRED | Line 91 — `trellisActionsService.prune(anchorId)` called in handlePrune; invoked at lines 202 and 250 |
| `PlannerScreen.tsx` | `trellis-actions.service.ts` | `replant()` on dead row tap | WIRED | Lines 68-78 — handleReplant awaits replant(), then navigate() |
| `PlannerScreen.tsx` | `trellis-actions.service.ts` | `heal()` on dying row tap | WIRED | Lines 80-88 — handleHeal calls heal() and navigates |
| `PrunedSection.tsx` | `trellis-actions.service.ts` | `unpruneQuestion / hardDelete` | WIRED | Lines 29 and 34-35 — both handlers call the service |
| `PrunedSection.tsx` | `question.service.ts` | `getPrunedQuestions()` | WIRED | Line 16 — useState initializer; line 21 — refresh callback |
| `trellis-actions.service.ts` | `question.service.ts` | `patchQuestion prunedFromTrellis` | WIRED | Line 124 — `{ flagged: true, prunedFromTrellis: true }` and line 135 — false case |
| `PlannerScreen.tsx` | `useTrellisData.ts` | `layout.nodes for trellis move derivation` | WIRED | Line 35 — `const { layout } = useTrellisData()` |
| `PlannerScreen.tsx` | `usePlannerAutoGen.ts` | `autoMoves filtered by dyingDeadIds` | WIRED | Lines 48-52 — Set + filter |

---

### D-01 through D-23 Decision Status

| Decision | Description | Status | Notes |
|----------|-------------|--------|-------|
| D-01 | Credits accumulated and persisted via localStorage | SATISFIED | trellis-credits.service.ts — `trellis_fruit_credits` key |
| D-02 | Batch harvest — single Fruit button harvests all | SATISFIED | handleHarvest iterates all fruitNodes in one call |
| D-03 | Unified fly-to-counter + confetti, not per-fruit-type | SATISFIED | Particles all originate from fruitRef center; particleCount = Math.min(count, 8) |
| D-04 | Fruit counter in upper-right of Planner header | SATISFIED | PlannerScreen.tsx:97-117 — `<Header right={...}>` with Cherry + credits span |
| D-05 | Fruit column glows when count > 0 | SATISFIED (code) | status-glow keyframe on fruitButtonStyle when fruitNodes.length > 0; runtime confirmation pending |
| D-06 | Harvested fruit nodes reset to green (blossom date cleared) | SATISFIED | clearBlossomDate per fruit node in handleHarvest; HARVEST_COMPLETED triggers trellis recompute |
| D-07 | 3-column panel between trellis hero and suggested moves | SATISFIED | PlannerScreen.tsx:121-127 — panel in correct DOM position |
| D-08 | Three columns: Ripe Fruits / Dying / Dead with correct leafState filters | SATISFIED | TrellisStatusPanel.tsx:41-43 — fruit='fruit', dying='yellow'/'falling', dead='fallen' |
| D-09 | ~~Bottom sheets for each column~~ | VOIDED | User explicitly removed bottom sheets. Replaced with direct harvest (Fruit) and Suggested Moves row actions (Dying/Dead). The BottomSheet component exists but is unused by this phase. |
| D-10 | Lucide icons for each column | SATISFIED | Cherry (fruit button), Leaf (dying div), XCircle (dead div) — TrellisStatusPanel.tsx:12, 147, 161, 170 |
| D-11 | Heal = parallel: review navigation + podcast queue add | SATISFIED | trellis-actions.service.ts:45-49 fire-and-forget podcast add, then returns review nav state |
| D-12 | Heal success → node returns to green via REVIEW_COMPLETED pipeline | SATISFIED | Existing pipeline unchanged; no new work needed |
| D-13 | Re-plant: generate post + use existing flashcards (no new ones) | SATISFIED | replant() calls conceptFeedService.generateMorePosts, uses existing flashcardService.getAll() |
| D-14 | Re-plant resets SM-2 schedule | SATISFIED | replant() resets all linked flashcards and anchor/Q&A question schedules via freshSchedule() |
| D-15 | Dying and dead nodes show prune action (scissors icon) | SATISFIED | PlannerScreen.tsx dead row: line 201-214; dying row: line 249-262 |
| D-16 | Two-step soft delete: archive first, hard-delete from pruned section | SATISFIED | prune() → flagged+prunedFromTrellis; PrunedSection shows Delete forever (hardDelete) |
| D-17 | ~~Prune animation: scissors cut + leaf fall~~ | VOIDED | Architecture simplification removed the prune animation. Pruning is now an instant service call + toast. Acceptable UX tradeoff per user decision. |
| D-18 | Pruned section accessible from PlannerScreen | SATISFIED | PrunedSection at PlannerScreen bottom; dashed "Pruned (N)" pill toggles list |
| D-19 | Trellis health is primary source for suggested moves | SATISFIED | dead/dying derived from layout.nodes before autoGen rendering |
| D-20 | Priority: dead (re-plant) → dying (heal) → autoGen | SATISFIED | PlannerScreen.tsx:172-282 — deadNodes.map → dyingNodes.map → visibleAutoMoves.map |
| D-21 | Ripe fruits NOT in suggested moves | SATISFIED | fruit leafState not included in deadNodes or dyingNodes filter expressions |
| D-22 | suggestedChunks / ChunkCard system removed | SATISFIED | Zero occurrences of suggestedChunks / ChunkCard / SIGNAL_DOT_COLOR / handleRegenerateChunk in PlannerScreen.tsx |
| D-23 | AutoGen dedup against dying/dead anchors | SATISFIED | dyingDeadIds Set + filteredAutoMoves filter — PlannerScreen.tsx:48-52 |

**Summary: 21/23 SATISFIED, 2 VOIDED (D-09, D-17). No decisions BLOCKED.**

Voided decisions reflect intentional UX simplifications approved by the user, not omissions.

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `TrellisStatusPanel.tsx` | `fruitNodes / dyingNodes / deadNodes` | `nodes` prop → `useTrellisData` → `buildTrellisState` → localStorage flashcards + SM-2 schedule | Yes — computed from real review schedule data | FLOWING |
| `PrunedSection.tsx` | `prunedNodes` | `questionService.getPrunedQuestions()` → localStorage questions filtered by `prunedFromTrellis === true` | Yes — reads live localStorage store | FLOWING |
| `PlannerScreen.tsx` | `credits` | `useState(() => trellisCreditsService.getTotal())` + `onCreditsChange` callback from TrellisStatusPanel | Yes — reads `trellis_fruit_credits` localStorage key | FLOWING |
| `PlannerScreen.tsx` | `deadNodes / dyingNodes / filteredAutoMoves` | `layout.nodes` from `useTrellisData`, `autoMoves` from `usePlannerAutoGen` | Yes — both hooks read from live services backed by localStorage | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable entry points available without a dev server. All core behaviors require visual rendering.

---

### Anti-Patterns Found

No blockers. No stubs. No TODO/FIXME comments in phase-26-authored files.

The simplified TrellisStatusPanel (212 lines vs. 619 in the earlier version) reads `fruitRef.current.getBoundingClientRect()` in JSX at lines 181-182 during particle rendering. This is the same minor pattern noted in the original verification — particle position is pinned by CSS at harvest time and does not cause visible defects.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `TrellisStatusPanel.tsx` | 181-182 | `getBoundingClientRect()` called during particle render | Info | No user-visible defect — position computed once at harvest time |

Pre-existing TypeScript errors in `GraphScreen.tsx`, `canonical-knowledge.service.ts`, `review.service.ts`, and `trellis-state.service.ts` (documented in `deferred-items.md`) are out of scope for this phase. The root `tsconfig.json` (`npx tsc --noEmit`) compiles clean.

---

### Human Verification Required

Tests 3, 4, 5, and 7 from the first UAT round were blocked by the `hashStr is not defined` runtime error. That error is now fixed (commit 715e5ec4). The action mechanics they test (heal, re-plant, prune stopPropagation, autoGen dedup) are now reachable with real trellis data. All 7 tests need a re-run under the simplified UX flow.

#### 1. Harvest animation — fly-to-counter + confetti

**Test:** With at least one anchor in `fruit` leafState, open the Planner screen and tap the Fruit button directly (center column of the status panel).
**Expected:** The button shows the count and "Harvest" label. Up to 8 amber circular particles animate from the fruit button center toward the header credit counter span. After ~1.2s, a confetti burst fires. The credit counter increments immediately on tap.
**Why human:** CSS keyframe animations (fruit-fly, Confetti component) cannot be asserted programmatically.

#### 2. Fruit column glow when count > 0

**Test:** With at least one fruit node, inspect the Fruit button.
**Expected:** Button has a soft pulsing amber box-shadow (status-glow keyframe, 3s loop) and a warm amber background. When count is 0, the button is disabled with neutral surface-variant background and no glow.
**Why human:** CSS animation visibility requires runtime rendering.

#### 3. Heal flow — Suggested Moves row tap (re-test after hashStr fix)

**Test:** With a dying node (yellow or falling leafState) visible in the Suggested Moves list, tap the row (not the scissors button).
**Expected:** The review screen opens filtered to that anchor's Q&As (confirm via the session title). In the Podcast screen, today's podcast now includes that anchor's topic.
**Why human:** Podcast add is fire-and-forget — verifying it queued requires checking podcast service state after navigation. First run was blocked by hashStr error; needs retest.

#### 4. Re-plant flow — dead row tap (re-test after hashStr fix)

**Test:** With a dead node (fallen leafState) in Suggested Moves, tap the row (not the scissors button).
**Expected:** Toast "Schedule reset - review to revive" appears. Review screen opens filtered to that anchor. In the Home screen feed, a new post has been generated for the anchor's topic. Re-opening Planner shows the anchor no longer in the Dead group (pending next SM-2 cycle).
**Why human:** Post generation is async and requires LLM call. Schedule reset persistence requires localStorage inspection. First run was blocked by hashStr error.

#### 5. Prune button — no sheet, direct archive (re-test with simplified flow)

**Test:** With a dying or dead node in Suggested Moves, tap only the scissors button (not the row).
**Expected:** "Pruned — moved to archive" toast appears. The row disappears. The "Pruned (N)" pill appears or increments at the bottom of PlannerScreen. Tapping the main row area is NOT triggered (the heal/re-plant action does NOT fire).
**Why human:** stopPropagation behavior requires interaction testing. The prune-cut/prune-fall animations from the original implementation are no longer present — this is the expected simplified behavior. Previous test was for the bottom-sheet version.

#### 6. Suggested Moves priority ordering with real trellis data (re-test after hashStr fix)

**Test:** With a mix of dead, dying, and healthy anchors with autoGen moves, open the Planner.
**Expected:** Dead anchors appear first (Sprout icon, red "Re-plant" badge), dying anchors second (Heart icon, yellow "Heal" badge), autoGen third (PortalCard style). The total count badge sums all three groups.
**Why human:** Requires live trellis data. First run passed; this is a regression check under the simplified UX.

#### 7. AutoGen dedup — same anchor not shown in both trellis rows and autoGen (re-test after hashStr fix)

**Test:** Engineer a state where an autoGen move's conceptId matches a currently dying or dead anchor.
**Expected:** That autoGen move does not appear in Suggested Moves. Only the dying/dead trellis row covers that anchor.
**Why human:** Requires specific overlap between autoGen cache and trellis state. First run was blocked by hashStr error.

---

### Gaps Summary

No gaps. The architecture simplification is fully implemented and consistent. All 23 D-decisions are satisfied or explicitly voided (D-09 bottom-sheet UX, D-17 prune animation). Seven human verification items cover animation, side-effect confirmation, and the four tests that need rerun after the hashStr runtime fix. None block core functionality.

---

_Verified: 2026-04-15T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
