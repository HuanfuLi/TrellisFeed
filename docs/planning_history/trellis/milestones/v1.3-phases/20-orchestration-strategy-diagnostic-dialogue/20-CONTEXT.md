# Phase 20: Orchestration Strategy & Diagnostic Dialogue - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Formalize the trajectory-to-planner pipeline with an `OrchestrationStrategy` interface for decentralized learning hints. Enhance the existing Planner check-in into a multi-turn Socratic diagnostic dialogue. Replace flat planner suggestions with portal cards that serve as unified topic gateways to posts, flashcards, and questions.

</domain>

<decisions>
## Implementation Decisions

### Orchestration Strategy (Light)
- **D-01:** Light orchestration — define an `OrchestrationStrategy` interface on top of `trajectoryAnalyzerService`. Services (feed, planner, review) check strategy hints independently rather than being controlled by a central orchestrator. Each service still makes its own decisions — the strategy provides hints like "bias toward weak areas" or "prioritize retrieval over discovery". No central `LearningOrchestrator` controller.

### Diagnostic Dialogue
- **D-02:** Enhance existing check-in in PlannerScreen to multi-turn Socratic dialogue. After user submits initial check-in text, LLM asks follow-up questions based on extracted signals (confusion areas, curiosity topics). Multi-turn conversation within the same check-in UI — not a separate screen.

### Content Portals
- **D-03:** Replace flat planner suggestions with portal cards. Each suggestion becomes a topic "portal" that links to related posts, flashcards, and questions about that concept. Portal card shows the topic, a brief description, and quick-access links/counts for each content type.

### Declined Scope
- **D-04:** No multi-device sync — app is mobile-only, local persistence (localStorage + SQLite) is sufficient. No remote sync architecture needed.

### Claude's Discretion
- `OrchestrationStrategy` interface shape (what methods/hints it exposes)
- How services consume strategy hints (import strategy directly vs eventBus)
- Multi-turn check-in UX (how follow-up questions appear, how conversation ends)
- Portal card visual design (layout, iconography, content type indicators)
- How portal cards link to existing screens (navigation patterns, deep links)
- Whether to add a strategy selector in settings or just use a single default strategy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Trajectory & Signal System (existing — Phase 20 builds on top)
- `app/src/services/trajectoryAnalyzer.service.ts` — `TrajectorySignal` aggregation, 6-hour cache, `aggregateSignals()`, `recordFeedView()`
- `app/src/types/index.ts` — `TrajectorySignal`, `CheckInSignals`, `LearningCheckIn`, `PlannerChunk`, `PlannerData`
- `app/src/services/suggestionScorer.service.ts` — `scoreMove()` using `TrajectorySignal`
- `app/src/services/moveGenerator.service.ts` — `generateMoves()` using `TrajectorySignal`

### Planner System (existing — check-in enhancement + portal cards)
- `app/src/services/plannerAutoGen.service.ts` — Auto-suggestion pipeline, uses `trajectoryAnalyzerService`
- `app/src/services/planner.service.ts` — Chunk CRUD, `submitCheckIn()`, localStorage + SQLite persistence
- `app/src/screens/PlannerScreen.tsx` — Planner UI, check-in input, `CheckInOutcome` component, suggestion display
- `app/src/state/usePlanner.ts` — Planner state hook
- `app/src/state/usePlannerAutoGen.ts` — Auto-suggestion state hook

### Feed & Content Services (consumers of strategy hints)
- `app/src/services/concept-feed.service.ts` — Daily post generation, weighted mix
- `app/src/services/flashcard.service.ts` — FlashCard storage, review scheduling
- `app/src/services/question.service.ts` — Question storage

### Navigation (portal card linking)
- `app/src/lib/moveNavigator.ts` — Move navigation utility (existing pattern for linking to content)
- `app/src/components/BottomNavigation.tsx` — App navigation structure

### Original Milestone 2 Roadmap
- `/Users/Code/EchoLearn/ROADMAP.md` — Original Phase 17-19 descriptions for Milestone 2

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `trajectoryAnalyzerService.aggregateSignals()` — Already computes reviewPerformance, questionFrequency, timeSinceLastReview, feedEngagement, conceptCoverage, weakAreas. Ready to be consumed by a strategy layer.
- `plannerAutoGen.service.ts` — Full pipeline from signal aggregation → move generation → scoring → chunk creation. Strategy hints can be injected at the scoring step.
- `submitCheckIn()` in `planner.service.ts` — Single-shot LLM extraction of `CheckInSignals` (confidence, confusion, curiosity, revisitIntent). Can be extended for multi-turn.
- `CheckInOutcome` component — Renders extracted signals and generated chunks. Can be extended to show conversation turns.
- `moveNavigator.ts` — Existing pattern for navigating from suggestions to posts/flashcards/questions.

### Established Patterns
- `ServiceResult<T>` for all service returns
- `eventBus` for cross-component communication
- `chatCompletion` / `chatStream` for LLM interactions
- `mockSettingsService` for localStorage persistence

### Integration Points
- `plannerAutoGen.service.ts` `generateSuggestions()` — inject strategy hints before scoring
- `concept-feed.service.ts` `getDailyPosts()` — bias post selection toward strategy-recommended topics
- `PlannerScreen.tsx` check-in UI — extend for multi-turn conversation
- `PlannerScreen.tsx` suggestion display — replace with portal cards

</code_context>

<specifics>
## Specific Ideas

- The orchestration strategy should feel invisible to the user — it just makes the app smarter about what to surface and when.
- Diagnostic dialogue should feel natural, like talking to a tutor: "You mentioned X is confusing — can you tell me what part feels unclear?" Not a quiz or form.
- Portal cards should feel like doorways into a topic — one tap to see everything the app knows about that concept across posts, flashcards, and questions.
- The ~40% of trajectory infrastructure already built means this phase can focus on the strategy layer and UX improvements rather than rebuilding foundations.

</specifics>

<deferred>
## Deferred Ideas

- **Full orchestration engine** — Central `LearningOrchestrator` that actively controls all services. Too complex; light strategy approach preferred.
- **Separate diagnostic screen** — Keep diagnostic dialogue within Planner, not a new screen.
- **Multi-device sync** — Declined entirely. Mobile-only, local persistence is sufficient.

</deferred>

---

*Phase: 20-orchestration-strategy-diagnostic-dialogue*
*Context gathered: 2026-04-05*
