---
phase: 26-trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status
status: documented
created: 2026-04-15
scope: UX simplifications and bug fixes made during UAT after the initial 4-plan execution completed
---

# Phase 26 Addendum — UAT-driven Refactors

Execution of plans 26-01 through 26-04 landed the architecture the original PLAN + RESEARCH called for: a 3-column status panel with bottom sheets for fruit/dying/dead, scissors prune animation, Suggested Moves refactor, and flashcard-review-based re-plant. During human UAT the user requested several UX simplifications and surfaced two runtime bugs. This addendum captures those changes so the rest of the phase docs can remain a record of the originally-planned intent.

---

## 1. Runtime bugs discovered during UAT

### 1.1 `hashStr is not defined` in `trellis-state.service.ts`
- **Detected:** UAT test #3 (heal flow) when user disabled Trellis Dev Mode and the service tried to read real localStorage data.
- **Root cause:** Pre-existing — logged in `deferred-items.md` pre-phase. The function was used at two call sites but never imported.
- **Fix:** Added `hashStr` to the existing import from `trellis-layout.service.ts`.
- **Commit:** `715e5ec4`.

### 1.2 Heal → Review showed 17 identical flashcards
- **Detected:** UAT test #3 — user healed a "Spaced Repetition" anchor and saw 17 duplicate flashcards in the review stack.
- **Root cause:** Legacy data. Prior ask flows had generated duplicate flashcards under the same nodeId. `anchorFilteredItems` in `ReviewScreen.tsx` returned every copy.
- **Fix:** Display-layer dedupe in `ReviewScreen.tsx` — `anchorFilteredItems` and `clusterFilteredItems` now dedupe by `${front}|${back}` signature (first occurrence wins). Storage is not modified.
- **Commit:** `3eb270be`.

### 1.3 Prune counter didn't update for legacy (non-anchor) nodes
- **Detected:** UAT — user pruned a dying node, the Pruned (N) pill stayed at 0 because `getPrunedQuestions()` filtered by `isAnchorNode === true` but trellis leaves also include `legacyNodes` without that flag.
- **Fix:** Added `prunedFromTrellis?: boolean` field to `Question`. `trellisActionsService.prune()` sets both `flagged: true` and `prunedFromTrellis: true`; `unpruneQuestion()` clears both. `getPrunedQuestions()` now filters by `prunedFromTrellis === true`. This cleanly separates user-pruned-from-trellis from off-topic flagged questions.
- **Commit:** `70cffae7`.

---

## 2. UX simplifications requested by user

### 2.1 Bottom sheets removed (voids D-09 and D-17)

**Before:** Tapping Fruit / Dying / Dead column opened a BottomSheet listing the affected nodes, with harvest / heal / re-plant / prune buttons inside. Prune triggered a scissors-cut + leaf-fall animation before the node was archived.

**After:** No sheets. The 3-column panel is reordered to **Dying | Fruit | Dead** with Fruit styled as the centered primary-action harvest button. Tapping Fruit harvests directly (no list sheet). Dying and Dead columns are display-only counters with no click handler.

**Actions moved to Suggested Moves rows:**
- Heal: tap the dying row (existing behavior)
- Re-plant: tap the dead row (existing behavior)
- **Prune: new scissors icon button on every dying/dead row, `stopPropagation` so it doesn't also trigger heal/re-plant. No animation — direct service call + toast.**

**Rationale (user's words):** The sheets were duplication — users can already see dying/dead nodes in Suggested Moves below. The sheets made the UI feel two layers deep when it didn't need to be.

**Voided decisions:**
- **D-09** (per-column bottom sheet for listing affected nodes) — voided
- **D-17** (prune scissors + leaf-fall animation) — voided (prune is now instant)

**Code:** `TrellisStatusPanel.tsx` rewritten as a flat 3-column panel with the Fruit button + fly-to-counter + confetti. All sheet logic, sheet state, `renderActionableItem`, `prune-cut`/`prune-fall` keyframes, and `navigate` imports removed. Prune button added to dying/dead rows in `PlannerScreen.tsx`.

**Commit:** `553240fb`.

### 2.2 PrunedSection moved to bottom of Planner

**Before:** "Pruned (N)" pill + collapsible list was rendered by `TrellisStatusPanel` directly below the 3-column panel.

**After:** Extracted to `app/src/components/trellis/PrunedSection.tsx` — mounted at the bottom of `PlannerScreen` after the Suggested Moves section. Subscribes to `ANCHOR_DELETED`, `CLASSIFICATION_COMPLETED`, and `QUESTION_DELETED` events for auto-refresh. No prop drilling.

**Rationale:** Logical visual hierarchy — pruned content belongs at page bottom (archive), not mid-page where the active-work sections live.

**Commit:** `70cffae7`.

### 2.3 Re-plant rewired to Learn-as-post flow

**Before (D-13/D-14 as originally planned):** Re-plant reset SM-2 schedules on all linked flashcards and questions to zero, then awaited `conceptFeedService.generateMorePosts([anchorQuestion])`, then navigated to `/review` filtered to the anchor's Q&As.

**Problems:**
1. Tapping Re-plant was noticeably slow (2–5 seconds) because of the awaited post generation before navigation.
2. The SM-2 full reset wiped useful history.
3. Routing to flashcard review felt wrong — user requested a richer re-exposure.

**After:**
- `replant()` is now **synchronous**. Drops flashcard reset, drops the `await`.
- Schedules are bumped to **dying** (`nextReviewDate: yesterday`, `reviewCount: Math.max(1, prev)`, easeFactor preserved) so `computeLeafState` returns `yellow`. Anchor visibly moves from the Dead column to the Dying column. User must complete a real review cycle to graduate back to green.
- Navigation target: `/posts/anchor-post-{anchorId}` with `discoverMeta`, reusing the exact flow from `AnchorDetailScreen`'s "Learn as Post" button. `PostDetailScreen` handles streaming generation on mount.
- Emits `CLASSIFICATION_COMPLETED` so `useTrellisData` recomputes immediately.

**Rationale (user's words):** Re-plant should be re-exposure, not a SM-2 nuke. Reuse the post-generation flow we already have. Speed matters — an awaited post-gen made the tap feel broken.

**Modified decisions:**
- **D-13** (re-plant resets all flashcards + Q&A schedules + generates post) — modified: no flashcard reset; schedules bumped to dying (not reset); post still generated but via PostDetailScreen's on-mount streaming, not an awaited service call.
- **D-14** (re-plant navigates to review) — voided: now navigates to post detail.

**Commit:** `374c76f1`.

### 2.4 Prune UX simplified to instant service call
- Removed the 1-second delay + setTimeout + pruningId state machine + prune-cut/prune-fall keyframes from the prune flow.
- Prune is now a single service call: `trellisActionsService.prune(anchorId)` — flips `flagged:true` + `prunedFromTrellis:true`, emits `ANCHOR_DELETED`. Toast confirms archive. Trellis recompute removes the node from the dying/dead column in the same tick; PrunedSection refreshes from its event subscription.

### 2.5 Scissors prune animation (intermediate fix, now superseded)
Briefly enhanced to multi-snip motion with larger rotation + scale pulse (commit `983a9688`) during the UAT round 2 phase, but became dead code when 2.1 removed sheets entirely. The old keyframe lives only in git history.

---

## 3. BottomSheet primitive retained
`app/src/components/ui/BottomSheet.tsx` is no longer used by Phase 26 code but kept as a reusable primitive for future work. A `minHeight: 45vh` was added during UAT round 1 (commit `23d66df4`) — that fix applies to any future consumer, not this phase.

---

## 4. Updated decision scoreboard

| ID | Original intent | Final state |
|----|-----------------|-------------|
| D-01..D-06 | Fruit column design, harvest flow, credits, confetti | SATISFIED |
| D-07 | 3-column status panel | SATISFIED (order changed to Dying \| Fruit \| Dead) |
| D-08 | Fruit column glow when count > 0 | SATISFIED (now on the Fruit harvest button) |
| **D-09** | Bottom sheets per column | **VOIDED** |
| D-10 | Panel position between TrellisHero and Suggested Moves | SATISFIED |
| D-11, D-12 | Heal = podcast add + review nav | SATISFIED (action moved to Suggested Moves row tap) |
| **D-13** | Re-plant = flashcard reset + post gen + review nav | **MODIFIED** — bump to dying + Learn-as-post flow, no flashcard reset |
| **D-14** | Re-plant → /review | **VOIDED** — now → /posts/anchor-post-{id} |
| D-15, D-16, D-18 | Prune archives node, pruned section, restore + hard-delete | SATISFIED |
| **D-17** | Prune scissors-cut + leaf-fall animation | **VOIDED** |
| D-19 | Suggested Moves trellis-health-driven | SATISFIED |
| D-20 | Dead → Dying → AutoGen priority order | SATISFIED |
| D-21 | Fruit nodes excluded from moves | SATISFIED |
| D-22 | suggestedChunks/ChunkCard removed | SATISFIED |
| D-23 | AutoGen dedup against dying/dead | SATISFIED |

**Score:** 19 satisfied, 1 modified, 3 voided — all three voids and the modification were explicit user requests during UAT. Net outcome: the phase goal (trellis-health-driven Planner UX) is met via a simpler design.

---

## 5. Commits landed during UAT (chronological)

1. `b7fdef07` — foundation primitives (plan 26-01, part 1)
2. `bc3a35e3` — BottomSheet + getPrunedQuestions (plan 26-01, part 2)
3. `565cc7c9` — plan 26-01 docs
4. `1ccf17f2`, `bab3c286`, `157e4861`, `c4ef4538` — plan 26-02 (status panel, harvest flow, PlannerScreen wiring)
5. `f683a517`, `ea579f84`, `29a9d6ac` — plan 26-03 (node actions service, sheet action buttons)
6. `aa043247`, `bc0f3d35`, `d12da10e` — plan 26-04 (Suggested Moves refactor, usePlanner deprecation)
7. `4b10993d` — HUMAN-UAT persistence
8. `715e5ec4` — hashStr import fix (blocker from test #3)
9. `983a9688` — scissors animation enhancement (later voided by sheet removal)
10. `e384b992` — UAT round 1 status update
11. `70cffae7` — prune counter fix + PrunedSection extraction
12. `3eb270be` — flashcard dedupe (17-dupes bug)
13. `23d66df4` — BottomSheet minHeight
14. `553240fb` — status panel simplification (sheets removed)
15. `374c76f1` — re-plant → Learn-as-post flow
16. `361a4d62` — swipe visibility-hide removal (cross-cutting, documented in Phase 22 addendum)
17. `ae55409c` — BottomNavigation tap = instant (cross-cutting, Phase 22 addendum)
