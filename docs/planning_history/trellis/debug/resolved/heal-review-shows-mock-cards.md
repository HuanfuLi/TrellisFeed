---
status: resolved
trigger: "I clicked Heal 'Feynman Technique' and I am navigated to review page correctly, but I see mock flashcards like 'What is dialectical materalism' and 'Quantum entanglement'"
created: 2026-05-10T00:00:00Z
updated: 2026-05-10T01:00:00.000Z
resolution_commit: f86d273c
resolution_plan: .planning/phases/42-masonry-feed-layout/42-08-heal-review-empty-anchor-fix-PLAN.md
---

## Current Focus

hypothesis: ReviewScreen.tsx:299 — `isFiltered = Boolean(filteredItems && filteredItems.length > 0)` collapses "no matching cards" to "no filter active", so the anchor filter falls back to the entire today-due queue (`items`) when the anchor has 0 extracted flashcards. VineBloomCard surfaces this because heal-from-celebration commonly targets anchors whose QAs never had flashcards extracted (no chat sessions referencing them).
test: Read line 281-324 of ReviewScreen.tsx — confirm `isFiltered` collapses on length=0
expecting: CONFIRMED — `isFiltered=false` → reviewItems=items; "Feynman" cards 0 → user sees today's regular queue
next_action: Diagnose only per goal; report root cause + minimal fix

## Symptoms

expected: Tap Heal on "Feynman Technique" anchor → /review showing only Feynman Technique QAs
actual: Lands on /review showing flashcards titled "What is dialectical materialism" and "Quantum entanglement" (look like mock seeds OR unfiltered library)
errors: none reported
reproduction: Tap Heal CTA on VineBloomCard for "Feynman Technique" anchor in masonry feed
started: After Phase 42 Wave 4 (VineBloomCard shipped)

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-05-10
  checked: VineBloomCard.handleHeal at MasonryFeed.tsx:70-77
  found: Calls trellisActionsService.heal(node.anchor.id, anchorName, node.qaChildren.map(q => q.id)); navigates with result.state.
  implication: Code is identical to PlannerScreen.handleHeal (lines 79-87) which is the known-working call.

- timestamp: 2026-05-10
  checked: trellisActionsService.heal at trellis-actions.service.ts:54-72
  found: Returns { navigateTo: '/review', state: { anchorReview: { anchorId, qaIds, title } } }
  implication: Service contract is correct.

- timestamp: 2026-05-10
  checked: ReviewScreen.tsx:281-299 anchorReview consumption
  found: anchorFilteredItems = dedupeCards(allCards.filter(card => anchorReview.qaIds.some(qaId => card.nodeId === qaId))). isFiltered = Boolean(filteredItems && filteredItems.length > 0). reviewItems = isFiltered ? filteredItems! : items.
  implication: When anchorReview is set BUT no card in allCards matches qaIds, isFiltered is false → reviewItems falls back to `items` (today's full SM-2 due queue). User sees full library, not the filtered 0-card state.

- timestamp: 2026-05-10
  checked: flashcard.service.ts:174-204 createFlashcards (LLM extract)
  found: nodeId set via fuzzy keyword overlap (bestOverlap > 0) against questions. Cards inherit nodeId from "best match Question.id" — NOT necessarily a QA child of the user's tapped anchor.
  implication: A flashcard created from session about "Quantum entanglement" can have nodeId pointing to that Quantum question, NOT to any Feynman Technique QA. So filter `qaIds.some(qaId => card.nodeId === qaId)` legitimately returns 0 matches when the anchor has zero flashcards extracted for its specific QAs.

- timestamp: 2026-05-10
  checked: codebase-wide grep for "dialectical" / "materialism" / "Quantum entanglement"
  found: ZERO hits in app/src. The cards user sees are real user content, NOT mock seeds. Phase 38-04 commit 8829a68c removed all hardcoded mock seeds.
  implication: Operator's "mock flashcards" framing is misleading — these are real cards from other anchors that aren't being filtered out.

- timestamp: 2026-05-10
  checked: ReviewScreen render path when `done || reviewItems.length === 0` (line 519)
  found: Shows "All Done" screen with a finished message, NOT the full library.
  implication: When isFiltered=false the screen renders `items` (today's due cards) — that's the mismatch. User wanted Feynman QAs; got today's regular review queue.

## Resolution

root_cause: ReviewScreen.tsx:299 — `isFiltered = Boolean(filteredItems && filteredItems.length > 0)` silently fails open. When VineBloomCard.handleHeal navigates to /review with `state.anchorReview = { anchorId, qaIds, title }` for an anchor whose QAs have zero extracted flashcards (very common — flashcards are LLM-extracted from chat sessions, not from QA records, and many anchors have no related sessions), `anchorFilteredItems = []`, `filteredItems = []`, `isFiltered = false`, `reviewItems = items`. The user lands on /review and sees today's full SM-2 due queue (real cards from other anchors like "Quantum entanglement", "dialectical materialism") instead of either (a) Feynman-only cards, or (b) an explicit empty-state message saying "No flashcards exist yet for Feynman Technique."

NOT a regression from Phase 42 Wave 4. NOT residual mock seeds (commit 8829a68c removed those). NOT a missing navigate-state in VineBloomCard (state IS passed correctly). The bug pre-exists in PlannerScreen's heal/replant path too — Wave 4 just made it user-visible by promoting heal/replant into the celebration UX where users tap them more readily (and where the anchor with 0 extracted flashcards is statistically more likely because the celebration only appears once all daily posts are explored).
fix: Change ReviewScreen.tsx:299 from `isFiltered = Boolean(filteredItems && filteredItems.length > 0)` to `isFiltered = filteredItems !== null` (or equivalent: distinguish "filter not requested" from "filter requested but matched nothing"). When a filter is requested AND yields zero cards, render an explicit anchor-scoped empty state ("No flashcards yet for {title} — try a chat session about it first") rather than silently dumping the user into the full daily queue.

Optional follow-up (out of scope for the minimum fix): Have heal()'s navigation include the anchor's title in state so the empty-state message can use it, AND/OR seed flashcards from QA records on heal so the celebration UX always has cards to review.
verification: (pending; diagnose-only mode)
files_changed: []
