---
phase: 26-trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status
plan: 03
subsystem: ui
tags: [trellis, bottom-sheet, actions, heal, replant, prune, sm-2, lucide-react]

requires:
  - phase: 26-01
    provides: BottomSheet, getPrunedQuestions, trellisCreditsService
  - phase: 26-02
    provides: TrellisStatusPanel (3-column + sheets), fly-to-counter choreography, PlannerScreen mount point
  - phase: 25
    provides: TrellisAnchorNode + leafState, fcMap-based leaf computation, blossom date service
provides:
  - trellisActionsService (heal, replant, prune, unpruneQuestion, hardDelete) returning navigation intents
  - Dying bottom sheet row actions (Heal + Prune)
  - Dead bottom sheet row actions (Re-plant + Prune)
  - Prune animation (scissors rotate → leaf fall, 0.8s total) with CSS keyframes prune-cut + prune-fall
  - Pruned archive section under the status panel with Restore + Delete forever affordances
affects: [26-04 suggested moves refactor (reads same panel + trellis layout)]

tech-stack:
  added: []
  patterns:
    - "Action service returns navigation intents ({ navigateTo, state }) rather than invoking navigate() directly — caller owns routing"
    - "Replant resets flashcard schedules as authoritative SM-2 source (RESEARCH Pitfall 2) — computeLeafState reads fcMap first, so resetting only Question.reviewSchedule would be invisible to the trellis"
    - "Prune reuses ANCHOR_DELETED event for trellis removal instead of introducing a new event — same visual effect, different semantics"
    - "Pruning animation decoupled from state flip via 0.8s setTimeout so the scissors cut + leaf fall play before flagged=true takes effect"

key-files:
  created:
    - app/src/services/trellis-actions.service.ts
  modified:
    - app/src/components/trellis/TrellisStatusPanel.tsx

key-decisions:
  - "heal() fires podcastService.addConceptToPodcast inside try/catch and ignores its boolean return — non-fatal if no podcast exists for today"
  - "replant() resets BOTH flashcards (by nodeId match) AND anchor/Q&A Question schedules — fcMap is authoritative for leaf state, but clearing Question.lastReviewedAt also prevents the 'anchorEverReviewed' fallback in computeLeafState from keeping the node out of 'bud'"
  - "replant() awaits conceptFeedService.generateMorePosts so caller knows post landed before navigation; wrapped in try/catch to keep navigation non-blocking if post generation fails"
  - "prune() emits ANCHOR_DELETED (reuses existing event) instead of defining PRUNE_COMPLETED — identical trellis recompute path, less event surface"
  - "unpruneQuestion() emits CLASSIFICATION_COMPLETED with empty anchorName — existing subscriber only uses the event type for recompute, payload is cosmetic"
  - "Prune animation delays state flip by 800ms (300ms scissors cut + 500ms leaf fall) so user sees the visual completion before the item disappears from the bottom sheet"
  - "Pruned section rendered as collapsible dashed pill under the 3-column panel (not inside any sheet) so it is accessible without opening a dying/dead sheet"
  - "handleHardDelete wraps questionService.delete (via service) which already emits QUESTION_DELETED — no duplicate event needed"
  - "Action buttons use inline styles with CSS variables (--node-mint / #4FB3A0) to maintain the project's no-Tailwind convention"

patterns-established:
  - "Action service layer between UI and domain services: TrellisStatusPanel stays declarative, trellisActionsService owns side-effect sequencing"
  - "Schedule reset utility (freshSchedule()) returning { nextReviewDate: today(), reviewCount: 0, easeFactor: 2.5 } — candidate for extraction if replant logic spreads"
  - "Two-button row layout (primary action + Prune) shared between dying and dead sheets via renderActionableItem closure"

requirements-completed: [D-11, D-12, D-13, D-14, D-15, D-17, D-18]

duration: 5min
completed: 2026-04-15
---

# Phase 26 Plan 03: Trellis Node Actions (Heal, Re-plant, Prune) Summary

**Dying anchors gain a Heal button that queues them into today's podcast and deep-links to review; dead anchors gain a Re-plant button that resets all linked flashcard + question schedules, generates a fresh post, and routes to review; both expose a scissors-animated Prune that soft-archives into a new pruned section below the panel.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-15T05:57:10Z
- **Completed:** 2026-04-15T06:01:57Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `trellisActionsService` encapsulates all node action business logic: heal (podcast + review navigation), replant (flashcard + question schedule reset + post generation + review navigation), prune (soft-archive via flagged=true + ANCHOR_DELETED event), unpruneQuestion (restore + CLASSIFICATION_COMPLETED recompute), hardDelete (permanent removal)
- Dying bottom sheet now surfaces two buttons per node: Heal (Heart icon, mint bg) and Prune (Scissors icon); tapping Heal fires podcast add + navigates to /review with anchorReview state so the review session filters to this anchor's Q&As
- Dead bottom sheet now surfaces Re-plant (Sprout icon, teal bg) + Prune; tapping Re-plant awaits schedule reset across all linked flashcards and the anchor + Q&A children, generates a post via `conceptFeedService.generateMorePosts`, toasts "Schedule reset - review to revive", and navigates to /review
- Prune action plays a composed animation: scissors icon rotates −25° (0.3s cubic-bezier) then the whole row translates +60px downward while fading (0.5s) — after 0.8s the flagged field flips and the pruned archive refreshes
- Pruned archive accessible from a dashed pill under the 3-column panel (hidden when empty); expands to a compact list where each item exposes Restore (RotateCcw) and Delete forever (Trash2) buttons

## Task Commits

1. **Task 1: trellis-actions.service.ts** — `f683a517` (feat)
2. **Task 2: Wire actions + pruned section into TrellisStatusPanel** — `ea579f84` (feat)

_Plan metadata commit follows this SUMMARY._

## Files Created/Modified

- `app/src/services/trellis-actions.service.ts` (created) — 149 lines, exports `trellisActionsService` with 5 methods: heal, replant, prune, unpruneQuestion, hardDelete. `freshSchedule()` helper centralises the `{ nextReviewDate: today(), reviewCount: 0, easeFactor: 2.5 }` reset shape.
- `app/src/components/trellis/TrellisStatusPanel.tsx` (modified) — added imports (useNavigate, trellisActionsService, questionService, toast, Heart/Scissors/Sprout/RotateCcw/Trash2 icons, Question type), pruned state + animation state, handleHeal / handleReplant / handlePrune / handleUnprune / handleHardDelete, `renderActionableItem` closure for the two-button row pattern, pruned section with collapsible list, two new CSS keyframes (prune-cut, prune-fall).

## Decisions Made

- heal() and replant() return `{ navigateTo, state }` intents rather than calling `navigate()` directly — keeps the service pure and testable and lets the component control the timing (e.g. closing the sheet before navigation).
- replant() resets BOTH flashcard schedules (authoritative per Pitfall 2) AND Question.reviewSchedule + lastReviewedAt — clearing lastReviewedAt is what moves the anchor back to 'bud' state when there are no flashcards, because computeLeafState uses it as a fallback signal.
- prune() reuses the existing ANCHOR_DELETED event instead of defining PRUNE_COMPLETED. The subscriber in useTrellisData only needs a recompute trigger; semantics differ (deletion vs. archive) but the effect on the trellis is identical, and pruning remains reversible via unpruneQuestion.
- Prune animation driven by a single `pruningId` state + CSS keyframes. The 800ms delay before the flagged flip gives the user unambiguous feedback that the scissors cut and the leaf is falling before the row disappears.
- The pruned archive lives below the 3-column panel (not inside a bottom sheet) so users can see their archive count at a glance without tapping through a dying/dead sheet — matches the Planner's surface-everything ethos.

## Deviations from Plan

None — plan executed exactly as written. TypeScript compiled clean on first attempt for both tasks.

## Issues Encountered

None.

## User Setup Required

None — no external services, no environment variables, no CLI tools.

## Next Phase Readiness

- Plan 26-04 (Suggested Moves refactor) can read the same `layout.nodes` from `useTrellisData` already mounted in PlannerScreen; the trellis panel is fully actionable so the Suggested Moves can focus on trellis-aware move generation without revisiting the action layer.
- `trellisActionsService` is a single import for any future caller needing heal/replant/prune — pattern ready to reuse from `AnchorDetailScreen` or from trellis tooltips if per-leaf actions are added later.
- No blockers, no deferred items specific to this plan (pre-existing unused-import warnings in `PlannerScreen.tsx` etc. remain from Plan 26-02 and are logged separately in `deferred-items.md`).

## Self-Check

- File `app/src/services/trellis-actions.service.ts`: CHECK
- File `app/src/components/trellis/TrellisStatusPanel.tsx` (modified): CHECK
- Commit `f683a517`: CHECK
- Commit `ea579f84`: CHECK

## Self-Check: PASSED

---
*Phase: 26-trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status*
*Completed: 2026-04-15*
