# Phase 26: Trellis Harvest Panel, Dying/Dead Node Actions, Suggested Moves Refactor - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a 3-column status panel between the trellis hero and suggested moves on PlannerScreen that surfaces actionable trellis states: harvest ripe fruits (earn credits), heal dying nodes (review + podcast), and re-plant dead nodes (read post + flashcard review). Refactor suggested moves to be trellis-health-driven with autoGen as supplement. Add fruit credit counter to Planner header. Add pruning (soft-delete + archive) for unwanted dying/dead nodes.

**Out of scope (deferred to future phases):**
- Credit spending mechanic (cosmetic unlocks, themes, etc.)
- Seasonal trellis themes
- Settings page for trellis preferences
- GraphScreen/mindmap integration with trellis actions

</domain>

<decisions>
## Implementation Decisions

### Harvest Mechanic & Credits
- **D-01:** Harvesting ripe fruits earns visible currency ("fruits" or credits) stored persistently. Spending mechanic deferred to a future phase — just accumulate for now.
- **D-02:** Users may harvest multiple fruits in a single batch event (e.g. tap "Harvest all" in the bottom sheet).
- **D-03:** Harvest celebration: collection animation (fruits fly from trellis into the counter) followed by confetti burst. Since batch harvest is possible, animation must NOT be per-fruit-type — use a unified collection + confetti pattern.
- **D-04:** Fruit/credit counter displayed at the upper-right corner of the Planner header bar (the existing `<Header title="Planner" />` component). Show accumulated total.
- **D-05:** When ripe fruits exist (fruit count > 0), the fruits column in the status panel should glow/shine softly to remind user to harvest. No aggressive notification — just a subtle visual cue.
- **D-06:** After harvesting, fruit nodes on the trellis reset — they become green leaves again (the anchor still exists, still healthy, just no longer fruiting). The blossom date is cleared so the fruit lifecycle restarts.

### Status Panel Layout & Interaction
- **D-07:** 3-column landscape panel between trellis hero and suggested moves. Each column shows: lucide icon + count. No emoji. Keep it concise.
- **D-08:** Three columns: Ripe Fruits (harvestable) | Dying (yellow + falling states) | Dead (fallen state).
- **D-09:** Tapping a column opens a bottom sheet with the list of affected nodes and action buttons. Reuse/extend the existing suggested moves bottom sheet pattern.
- **D-10:** Icons from lucide-react library. Find appropriate icons for each column (e.g. cherry/apple for fruits, leaf/droplet for dying, skull/x-circle for dead — exact icons are Claude's discretion).

### Dying Node Actions (Heal)
- **D-11:** When user taps a dying node in the bottom sheet, they get TWO parallel actions triggered together: (1) start flashcard review for that anchor's Q&As, AND (2) add the topic to today's podcast queue. Both happen in parallel, not either/or.
- **D-12:** If healing succeeds (user completes review, node's overdue Q&As are caught up), the leaf returns to green state on the trellis via the existing REVIEW_COMPLETED event pipeline.

### Dead Node Actions (Re-plant)
- **D-13:** When user taps a dead node, the system generates a post for the user to read (reuse the existing "Learn as post" / concept anchor post generation pattern), then directs user to review the EXISTING flashcards for that question. Do NOT generate new duplicate flashcards — use the ones already persisted in the DB from when the question was first asked.
- **D-14:** Re-planting effectively resets the node's review schedule so it re-enters the SM-2 cycle from the beginning.

### Pruning (Truncate/Scissors)
- **D-15:** Dying and dead nodes show a "prune" action (scissors icon) in addition to heal/re-plant.
- **D-16:** Pruning is a two-step soft delete: first archives to a "Pruned" section (node hidden from trellis but data preserved), then user can hard-delete from the pruned section later.
- **D-17:** Prune animation: scissors cutting motion on the vine stem, then the leaf/blossom falls away. Keep it simple but satisfying.
- **D-18:** Pruned section accessible from somewhere on PlannerScreen (Claude's discretion on placement — could be a small link/button near the status panel or in settings).

### Suggested Moves Refactor
- **D-19:** Trellis health is the primary source for suggested moves. AutoGen is a supplement for healthy-garden states.
- **D-20:** Priority ordering in suggested moves list: (1) Dead nodes — re-plant actions, (2) Dying nodes — heal actions, (3) AutoGen moves — filtered to exclude any node already surfaced as dying/dead to prevent duplicates.
- **D-21:** Ripe fruits do NOT appear in suggested moves — they are handled exclusively in the status panel with the glow indicator.
- **D-22:** Remove the `suggestedChunks` / check-in-derived chunks system entirely. The input source (Learning Check-In) was removed in Phase 25. Only autoGen moves remain as the non-trellis source.
- **D-23:** AutoGen dedup filter: before rendering autoGen moves, check if the move's target anchor/Q&A overlaps with any dying/dead node. If so, skip it — trellis action already covers that node.

### Claude's Discretion
- Exact lucide icon choices for the 3 panel columns
- Pruned section placement on PlannerScreen
- Bottom sheet internal layout (card style, spacing, button sizes)
- Confetti particle count and animation duration
- How the scissors prune animation is implemented (CSS, Framer Motion, or Lottie)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Trellis System (Phase 25)
- `.planning/phases/25-anime-knowledge-tree-for-planner-page-motivational-review-visualization/25-CONTEXT.md` — Full trellis decision log (D-01 through D-55)
- `.planning/phases/25-anime-knowledge-tree-for-planner-page-motivational-review-visualization/25-UI-SPEC.md` — UI design contract for trellis hero
- `app/src/services/trellis-state.service.ts` — `buildTrellisState`, `computeLeafState`, `TrellisAnchorNode`, `LeafState` types
- `app/src/state/useTrellisData.ts` — React hook providing `TrellisLayout` with eventBus subscriptions
- `app/src/services/trellis-layout.service.ts` — Vine generation, leaf positioning, botanical categories

### Review & Flashcard System
- `app/src/services/review.service.ts` — `submitReview`, SM-2 scheduling, REVIEW_COMPLETED event emission
- `app/src/services/flashcard.service.ts` — FlashCard CRUD, review schedule updates, `getAll()`, `getDue()`
- `app/src/services/trellis-blossom-dates.service.ts` — Blossom date persistence (localStorage)

### Planner & Suggested Moves
- `app/src/screens/PlannerScreen.tsx` — Current layout: TrellisHero → Suggested Moves
- `app/src/state/usePlannerAutoGen.ts` — AutoGen moves hook (`moves`, `accept`, `dismiss`, `refresh`)
- `app/src/services/plannerAutoGen.service.ts` — `getMoves()`, `shouldAutoGenerate()`, move generation
- `app/src/state/usePlanner.ts` — `suggestedChunks` (to be removed), `deleteChunk`

### Post & Podcast Systems
- `app/src/services/concept-feed.service.ts` — Post generation for concept anchors
- `app/src/services/podcast.service.ts` — Podcast generation and queue management

### Existing UI Components
- `app/src/components/ui/Header.tsx` — `Header` component with `HEADER_HEIGHT` (where fruit counter goes)
- `app/src/components/ui/Card.tsx` — Card component for bottom sheet items
- `app/src/components/ui/Badge.tsx` — Badge for counts/labels
- `app/src/components/ui/Button.tsx` — Action buttons in bottom sheet
- `app/src/components/Confetti.tsx` — Existing confetti component from ReviewScreen (reuse for harvest)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Confetti` component (`app/src/components/Confetti.tsx`) — reuse for harvest celebration, may need parameterization for color/intensity
- `useTrellisData` hook — already provides full layout with node states, can derive fruit/dying/dead counts directly
- `plannerAutoGenService.getMoves()` — autoGen engine stays, just needs dedup filter against trellis nodes
- `eventBus` with `REVIEW_COMPLETED` — existing pipeline for leaf state updates after review
- `flashcardService.getAll()` — can filter by `nodeId` to find existing flashcards for a given question (no regeneration needed)
- `Header` component — needs extension to support a right-side element (fruit counter)

### Established Patterns
- Bottom sheet: no existing bottom sheet component — PlannerScreen renders suggested moves inline. May need a new `BottomSheet` component or use the existing Card-based inline expand pattern
- Inline styles with CSS variables (project convention — no Tailwind)
- `ServiceResult<T>` pattern for all service calls
- `eventBus.emit` / `eventBus.subscribe` for cross-component reactivity
- localStorage for persistence (settings, blossom dates, flashcards, questions)

### Integration Points
- `PlannerScreen.tsx` — status panel inserted between `<TrellisHero />` and Suggested Moves section
- `Header` component — fruit counter added as right-side element
- `trellis-blossom-dates.service.ts` — `clearBlossomDate()` called when fruit is harvested (resets to green)
- `questionService.patchQuestion()` — for pruning (set `flagged: true` for soft delete)
- `review.service.ts` — for heal action (route to review with anchor filter)
- `podcast.service.ts` — for heal action (add topic to today's podcast queue)
- `concept-feed.service.ts` — for re-plant action (generate post for dead node's topic)

</code_context>

<specifics>
## Specific Ideas

- Harvest animation: fruits fly from trellis into the header counter with a collection arc, then confetti burst. Must handle batch harvest (multiple fruits at once) — unified animation, not per-fruit-type.
- Prune animation: scissors cutting motion on the vine stem, leaf/blossom falls away. Simple but satisfying.
- Status panel fruit column: soft glow/shine when count > 0 to gently remind user to harvest. Not aggressive — ambient invitation.
- Dying node heal = parallel actions: flashcard review starts AND topic added to today's podcast queue simultaneously.
- Dead node re-plant = sequential: generate post for reading → then direct to existing flashcards for review. No new flashcard generation.
- Pruned nodes: two-step deletion. Archive first (hidden from trellis), hard-delete available in a pruned section later. Prevents accidental loss.

</specifics>

<deferred>
## Deferred Ideas

- Credit/fruit spending mechanic (cosmetic unlocks, seasonal themes, trellis materials, ambient creatures)
- Streak bonuses for consecutive harvests
- Social sharing of garden state
- Pruned section as a full "garden history" with replant-from-archive capability

</deferred>

---

*Phase: 26-trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status*
*Context gathered: 2026-04-14*
