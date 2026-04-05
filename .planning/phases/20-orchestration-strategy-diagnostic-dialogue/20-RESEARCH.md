# Phase 20: Orchestration Strategy & Diagnostic Dialogue - Research

**Researched:** 2026-04-03
**Domain:** Learning orchestration, multi-turn LLM dialogue, portal card UI
**Confidence:** HIGH

## Summary

Phase 20 builds three features on top of a mature codebase: (1) a lightweight OrchestrationStrategy interface layered over `trajectoryAnalyzerService` to provide decentralized learning hints to feed, planner, and review services; (2) enhancing the existing single-shot check-in into a multi-turn Socratic diagnostic dialogue using the existing `chatStream` / `chatCompletion` LLM provider; and (3) replacing flat planner suggestion cards with portal cards that aggregate links to related posts, flashcards, and questions for each topic.

The existing trajectory infrastructure (`trajectoryAnalyzerService`, `suggestionScorer.service`, `moveGenerator.service`) provides all signal data needed. The strategy layer is a thin interface that translates signals into named hints (e.g., `retrieval`, `discovery`, `reinforcement`). Consumer services already have injection points: `plannerAutoGenService.generateAndStoreSuggestions` at the scoring step, and `conceptFeedService.getDailyPosts` at the weighted mix step.

The multi-turn dialogue extends the existing `submitCheckIn` flow. Instead of a single LLM call for signal extraction, the check-in becomes a conversation: initial text -> LLM follow-up question -> user reply -> updated signals. The UI reuses the existing `CheckInOutcome` area in PlannerScreen. Portal cards replace `MoveCard` and `ChunkCard` with a unified component that aggregates content counts per topic.

**Primary recommendation:** Define `OrchestrationStrategy` as a pure-function interface returning `StrategyHints` from `TrajectorySignal`, implement one default strategy, and have services import it directly (no eventBus needed for synchronous hint reads).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Light orchestration -- define an `OrchestrationStrategy` interface on top of `trajectoryAnalyzerService`. Services (feed, planner, review) check strategy hints independently rather than being controlled by a central orchestrator. Each service still makes its own decisions -- the strategy provides hints like "bias toward weak areas" or "prioritize retrieval over discovery". No central `LearningOrchestrator` controller.
- **D-02:** Enhance existing check-in in PlannerScreen to multi-turn Socratic dialogue. After user submits initial check-in text, LLM asks follow-up questions based on extracted signals (confusion areas, curiosity topics). Multi-turn conversation within the same check-in UI -- not a separate screen.
- **D-03:** Replace flat planner suggestions with portal cards. Each suggestion becomes a topic "portal" that links to related posts, flashcards, and questions about that concept. Portal card shows the topic, a brief description, and quick-access links/counts for each content type.
- **D-04:** No multi-device sync -- app is mobile-only, local persistence (localStorage + SQLite) is sufficient. No remote sync architecture needed.

### Claude's Discretion
- `OrchestrationStrategy` interface shape (what methods/hints it exposes)
- How services consume strategy hints (import strategy directly vs eventBus)
- Multi-turn check-in UX (how follow-up questions appear, how conversation ends)
- Portal card visual design (layout, iconography, content type indicators)
- How portal cards link to existing screens (navigation patterns, deep links)
- Whether to add a strategy selector in settings or just use a single default strategy

### Deferred Ideas (OUT OF SCOPE)
- **Full orchestration engine** -- Central `LearningOrchestrator` that actively controls all services. Too complex; light strategy approach preferred.
- **Separate diagnostic screen** -- Keep diagnostic dialogue within Planner, not a new screen.
- **Multi-device sync** -- Declined entirely. Mobile-only, local persistence is sufficient.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORCH-01 | Define OrchestrationStrategy interface on top of trajectoryAnalyzerService | Architecture Patterns: Strategy interface design, StrategyHints type |
| ORCH-02 | Feed service consumes strategy hints to bias post selection toward weak areas | Integration point at `conceptFeedService.getDailyPosts` weighted mix step |
| ORCH-03 | Planner scoring incorporates strategy hints (retrieval vs discovery mode) | Integration point at `suggestionScorer.scoreMove` weight adjustment |
| DIAG-01 | Multi-turn Socratic check-in -- LLM asks follow-up questions based on extracted signals | chatCompletion for follow-up generation, conversation state management |
| DIAG-02 | Conversation rendered within existing PlannerScreen check-in UI | Extend CheckInOutcome area with message thread rendering |
| DIAG-03 | Check-in signals (confusion, curiosity, confidence) update after each turn | Incremental signal merging via existing `mergeSignals` pattern |
| PORTAL-01 | Replace flat planner suggestions with portal cards | New PortalCard component replacing MoveCard + ChunkCard |
| PORTAL-02 | Portal card shows topic, description, and quick-access links to related posts/flashcards/questions | Content aggregation from questionService, flashcardService, conceptFeedService |
| PORTAL-03 | Portal card navigation uses existing moveNavigator pattern | Extend moveNavigator with portal-style multi-destination navigation |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI framework | Already in project |
| TypeScript | 5.9 | Type safety | Already in project |
| react-router-dom | 7.x | Navigation | Already in project, moveNavigator depends on it |
| lucide-react | latest | Icons | Already in project for all UI icons |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chatCompletion (internal) | -- | LLM calls for follow-up generation | Multi-turn dialogue (DIAG-01) |
| chatStream (internal) | -- | Streaming LLM responses | If follow-up responses should stream |
| eventBus (internal) | -- | Cross-component communication | PLANNER_UPDATED events after strategy changes |

No new npm packages needed. All functionality builds on existing internal services and the LLM provider layer.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/
│   ├── orchestration-strategy.service.ts  # NEW: OrchestrationStrategy interface + default impl
│   ├── diagnostic-dialogue.service.ts     # NEW: Multi-turn check-in conversation logic
│   ├── trajectoryAnalyzer.service.ts      # EXISTING: Signal aggregation (unchanged)
│   ├── suggestionScorer.service.ts        # MODIFIED: Accept StrategyHints in scoring
│   ├── concept-feed.service.ts            # MODIFIED: Accept StrategyHints in post selection
│   ├── planner.service.ts                 # MODIFIED: submitCheckIn becomes multi-turn
│   └── plannerAutoGen.service.ts          # MODIFIED: Pass strategy to scoring pipeline
├── components/
│   ├── PortalCard.tsx                     # NEW: Replaces MoveCard + ChunkCard
│   ├── DiagnosticChat.tsx                 # NEW: Multi-turn conversation thread UI
│   └── MoveCard.tsx                       # REMOVED (replaced by PortalCard)
├── types/
│   └── index.ts                           # MODIFIED: Add strategy + dialogue types
└── screens/
    └── PlannerScreen.tsx                  # MODIFIED: Portal cards + diagnostic dialogue
```

### Pattern 1: OrchestrationStrategy Interface (ORCH-01)

**What:** A pure-function interface that translates TrajectorySignal into actionable hints for consumer services. No central controller -- each service reads hints independently.

**When to use:** Whenever a service needs to know the current learning mode (retrieval-focused, discovery-focused, reinforcement-focused).

**Recommended interface shape:**

```typescript
// src/services/orchestration-strategy.service.ts

export type LearningMode = 'retrieval' | 'discovery' | 'reinforcement' | 'balanced';

export interface StrategyHints {
  /** Current recommended learning mode based on trajectory. */
  mode: LearningMode;
  /** 0-1 weight bias toward weak areas in scoring. Higher = more weak-area focus. */
  weakAreaBias: number;
  /** 0-1 weight for new content discovery vs retrieval of known content. */
  discoveryWeight: number;
  /** Concept IDs to prioritize (from weak areas + confusion signals). */
  priorityConceptIds: string[];
  /** Topics to surface (from curiosity signals). */
  curiosityTopics: string[];
}

export interface OrchestrationStrategy {
  /** Compute strategy hints from current trajectory signals. */
  computeHints(signals: TrajectorySignal, checkInSignals?: CheckInSignals): StrategyHints;
}
```

**Default strategy logic:**
- If `weakAreas.length > 3` or `reviewPerformance < 40` --> mode: `retrieval`, weakAreaBias: 0.7
- If `conceptCoverage > 70` and `feedEngagement > 10` --> mode: `discovery`, discoveryWeight: 0.6
- If `timeSinceLastReview > 3 days` --> mode: `reinforcement`, weakAreaBias: 0.5
- Otherwise --> mode: `balanced`, weights at 0.5

**Why synchronous import, not eventBus:** Strategy hints are derived from cached TrajectorySignal (6-hour cache). They are computed on-demand, not pushed. Services call `strategy.computeHints(signals)` when they need it. This avoids event timing issues and keeps the dependency graph simple.

### Pattern 2: Strategy Hint Consumption (ORCH-02, ORCH-03)

**What:** Each consumer service checks strategy hints at its decision point and adjusts behavior accordingly.

**Feed service (ORCH-02) -- bias post selection:**
```typescript
// In conceptFeedService.getDailyPosts:
const hints = defaultStrategy.computeHints(signals, recentCheckInSignals);

// Adjust weighted mix based on hints
if (hints.mode === 'retrieval') {
  // Increase weight for posts covering weak areas
  // Decrease weight for pure discovery posts
}
if (hints.priorityConceptIds.length > 0) {
  // Boost posts whose sourceQuestionIds overlap with priorityConceptIds
}
```

**Planner scoring (ORCH-03) -- adjust weights:**
```typescript
// In suggestionScorer.scoreMove:
// Accept optional StrategyHints parameter
export function scoreMove(
  concept: Question,
  signals: TrajectorySignal,
  hints?: StrategyHints
): number {
  // Existing formula unchanged when no hints
  // When hints present, adjust WEIGHTS dynamically:
  // - retrieval mode: increase reviewPerformance weight (0.4 -> 0.55), decrease feedEngagement weight
  // - discovery mode: increase feedEngagement + conceptCoverage weights
  // - weakAreaBias multiplies the isWeakArea boost (30 * weakAreaBias)
}
```

### Pattern 3: Multi-Turn Diagnostic Dialogue (DIAG-01, DIAG-02, DIAG-03)

**What:** Extend the single-shot check-in into a multi-turn conversation. After initial text submission, the LLM generates a follow-up question targeting confusion/curiosity areas. User can respond, generating further follow-ups. Conversation ends when user dismisses or after 3 turns max.

**Conversation flow:**
1. User types initial check-in text, presses "Check In"
2. System extracts initial signals (existing `extractSignals`)
3. LLM generates a Socratic follow-up question based on extracted signals
4. Follow-up appears in the check-in area as a conversation bubble
5. User can respond (text or voice) or tap "Done" to end
6. Each user response triggers incremental signal extraction + merging
7. After conversation ends (user dismisses or max turns reached), generate final chunks

**Service design:**
```typescript
// src/services/diagnostic-dialogue.service.ts

export interface DialogueTurn {
  role: 'user' | 'assistant';
  content: string;
  signals?: CheckInSignals;  // Extracted after each user turn
  timestamp: number;
}

export interface DiagnosticSession {
  id: string;
  turns: DialogueTurn[];
  mergedSignals: CheckInSignals;
  status: 'active' | 'completed';
  createdAt: number;
}

export const diagnosticDialogueService = {
  /** Start a new diagnostic session with initial user text. */
  async startSession(initialText: string): Promise<DiagnosticSession>;

  /** Generate a Socratic follow-up question based on current signals. */
  async generateFollowUp(session: DiagnosticSession): Promise<string>;

  /** Process user reply: extract signals, merge, return updated session. */
  async processReply(session: DiagnosticSession, reply: string): Promise<DiagnosticSession>;

  /** Finalize session: generate chunks from merged signals. */
  async finalize(session: DiagnosticSession): Promise<LearningCheckIn>;
};
```

**Follow-up generation prompt pattern:**
```
You are a learning coach having a diagnostic conversation. Based on the user's
learning check-in, ask ONE follow-up question that helps clarify their understanding.

Focus on:
- Areas they mentioned as confusing: {confusion signals}
- Topics they're curious about: {curiosity signals}

Ask a question that feels natural, like a tutor, not a quiz.
Keep it to 1-2 sentences. Be specific to what they said.
```

**Max turns:** 3 exchanges (initial + 2 follow-ups). This prevents conversation fatigue while extracting useful signal depth.

### Pattern 4: Portal Card Design (PORTAL-01, PORTAL-02, PORTAL-03)

**What:** A unified card component that represents a topic as a "portal" -- showing the topic name, description, and quick-access links to all related content types (posts, flashcards, questions).

**Content aggregation logic:**
```typescript
interface PortalCardData {
  conceptId: string;
  title: string;
  description: string;
  relatedPosts: number;      // Count of posts with matching sourceQuestionIds
  relatedFlashcards: number;  // Count of flashcards with matching nodeId
  relatedQuestions: number;   // Count of Q&As under this concept
  primaryAction: 'review' | 'read' | 'compare' | 'discover';
  linkedResource?: PlannedMove['linkedResource'];
}
```

**Visual design recommendation:**
```
+-----------------------------------------------+
| [Icon] TOPIC NAME                      [badge] |
| Brief description of the concept               |
|                                                 |
| [BookOpen 3] [FileText 2] [HelpCircle 5]      |
|  Flashcards    Posts       Questions            |
|                                                 |
| [Primary CTA]                    [Skip]        |
+-----------------------------------------------+
```

- Content type indicators are tappable -- each navigates to the relevant screen filtered by concept
- Primary CTA navigates via existing `moveNavigator` pattern
- Card left-border color follows existing CHUNK_TYPE_CONFIG / MOVE_TYPE_CONFIG convention
- Content counts use `flashcardService.getAll().filter(c => c.nodeId === conceptId)`, `conceptFeedService.findClosestPost([conceptId])`, and `questionService.getAll().filter(q => q.id === conceptId || q.relatedQuestionIds.includes(conceptId))`

**Navigation from portal card content indicators:**
- Flashcards count tap -> `/review` with concept filter via location.state (existing pattern from Phase 12)
- Posts count tap -> `/posts/:id` of closest post (existing `findClosestPost`)
- Questions count tap -> `/ask/:id` of the concept question (existing route)

### Anti-Patterns to Avoid
- **Central orchestrator controller:** D-01 explicitly rejects this. Do NOT create a class that manages service lifecycles or forces execution order.
- **Event-driven strategy propagation:** Strategy hints are synchronous computations from cached data. Using eventBus for strategy changes adds complexity with no benefit.
- **Unbounded dialogue turns:** Cap at 3 turns. LLM conversations can spiral; the goal is signal extraction, not chatting.
- **Separate diagnostic screen:** D-02 explicitly requires multi-turn conversation within PlannerScreen, not a new route.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM conversation management | Custom message history | Extend existing `chatCompletion` with conversation array | The LLM provider already handles multi-message arrays |
| Signal extraction | New extraction logic | Extend existing `extractSignals` + `heuristicExtractSignals` | Battle-tested heuristic + LLM merge pattern already in planner.service.ts |
| Navigation from portal cards | Custom routing | `moveNavigator.navigateToMove` + `parseMoveNavigationState` | Phase 12 established this exact pattern |
| Content counting/aggregation | Database queries | Filter from existing `getAll()` service methods | All data is in-memory from localStorage; O(n) filtering is fine for <1000 items |

**Key insight:** The existing codebase has all the primitives. This phase is about composition and UI, not new infrastructure.

## Common Pitfalls

### Pitfall 1: Strategy Hint Staleness
**What goes wrong:** Strategy hints computed from 6-hour-cached signals may not reflect a check-in that just happened.
**Why it happens:** `trajectoryAnalyzerService` caches signals for 6 hours. If a user does a check-in that reveals confusion, the strategy hints won't update until cache expires.
**How to avoid:** After diagnostic dialogue finalization, call `trajectoryAnalyzerService.invalidateCache()` so the next strategy computation uses fresh data. The check-in already writes new signals to localStorage.
**Warning signs:** User does check-in expressing confusion, but feed still shows discovery-heavy content.

### Pitfall 2: Multi-Turn State Loss on Navigation
**What goes wrong:** User starts diagnostic dialogue, navigates away (taps Home), comes back, and the conversation is gone.
**Why it happens:** React component state is destroyed on unmount. PlannerScreen re-mounts with fresh state.
**How to avoid:** Persist active diagnostic session to localStorage (like existing check-in persistence pattern). On PlannerScreen mount, check for active session and offer to resume or discard.
**Warning signs:** "I was in the middle of a check-in and it disappeared."

### Pitfall 3: Portal Card Content Count Stale After Action
**What goes wrong:** User generates flashcards from a question, returns to Planner, portal card still shows old count.
**Why it happens:** Portal card computed counts at render time but didn't re-render after data changed in another screen.
**How to avoid:** Listen to `PLANNER_UPDATED` and other relevant eventBus events to trigger re-render. Or compute counts inside the component with a dependency on the planner state hook.
**Warning signs:** Content counts don't match reality after navigating back.

### Pitfall 4: LLM Follow-Up Quality
**What goes wrong:** LLM generates generic follow-up questions that don't reference what the user actually said.
**Why it happens:** Prompt doesn't include enough context from the user's check-in and extracted signals.
**How to avoid:** Include both the raw user text AND the extracted signals in the follow-up generation prompt. Reference specific confusion/curiosity items by name.
**Warning signs:** Follow-up questions feel boilerplate rather than personalized.

### Pitfall 5: Portal Card Replacing MoveCard Before Full Migration
**What goes wrong:** Some code paths still reference MoveCard after PortalCard is introduced, causing inconsistent UI.
**Why it happens:** MoveCard is used in PlannerScreen for auto-generated moves. ChunkCard is used for check-in-generated chunks. Both need to be replaced.
**How to avoid:** Replace both MoveCard usage in PlannerScreen AND ChunkCard with PortalCard. Keep MoveCard component file if it's used elsewhere, but update PlannerScreen imports.
**Warning signs:** Mix of old-style and new-style cards on the same screen.

## Code Examples

### OrchestrationStrategy Default Implementation
```typescript
// src/services/orchestration-strategy.service.ts
import type { TrajectorySignal, CheckInSignals } from '../types';

export type LearningMode = 'retrieval' | 'discovery' | 'reinforcement' | 'balanced';

export interface StrategyHints {
  mode: LearningMode;
  weakAreaBias: number;
  discoveryWeight: number;
  priorityConceptIds: string[];
  curiosityTopics: string[];
}

export interface OrchestrationStrategy {
  computeHints(signals: TrajectorySignal, checkInSignals?: CheckInSignals): StrategyHints;
}

export const defaultStrategy: OrchestrationStrategy = {
  computeHints(signals, checkInSignals) {
    const { weakAreas, reviewPerformance, conceptCoverage, feedEngagement, timeSinceLastReview } = signals;
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    let mode: LearningMode = 'balanced';
    let weakAreaBias = 0.5;
    let discoveryWeight = 0.5;

    if (weakAreas.length > 3 || reviewPerformance < 40) {
      mode = 'retrieval';
      weakAreaBias = 0.7;
      discoveryWeight = 0.3;
    } else if (conceptCoverage > 70 && feedEngagement > 10) {
      mode = 'discovery';
      weakAreaBias = 0.3;
      discoveryWeight = 0.6;
    } else if (timeSinceLastReview > THREE_DAYS_MS) {
      mode = 'reinforcement';
      weakAreaBias = 0.5;
      discoveryWeight = 0.3;
    }

    return {
      mode,
      weakAreaBias,
      discoveryWeight,
      priorityConceptIds: [...weakAreas, ...(checkInSignals?.revisitIntent?.map(() => '') ?? [])].filter(Boolean),
      curiosityTopics: checkInSignals?.curiosity ?? [],
    };
  },
};
```

### Diagnostic Follow-Up Prompt
```typescript
// In diagnostic-dialogue.service.ts
function buildFollowUpPrompt(signals: CheckInSignals, userText: string): string {
  const parts: string[] = [];
  if (signals.confusion.length > 0) {
    parts.push(`Areas of confusion: ${signals.confusion.join(', ')}`);
  }
  if (signals.curiosity.length > 0) {
    parts.push(`Curiosity topics: ${signals.curiosity.join(', ')}`);
  }
  if (signals.confidence.length > 0) {
    parts.push(`Confident areas: ${signals.confidence.join(', ')}`);
  }

  return `You are a learning coach having a diagnostic conversation with a student.

The student said: "${userText}"

Extracted signals:
${parts.join('\n')}

Ask ONE specific follow-up question that helps you understand their learning state better.
Focus on the confusion or curiosity areas. Be conversational and warm, like a tutor.
Keep it to 1-2 sentences. Do not repeat what they said.`;
}
```

### Portal Card Content Aggregation
```typescript
// Helper to build PortalCardData from a concept
function buildPortalData(conceptId: string, title: string, description: string): PortalCardData {
  const allCards = flashcardService.getAll();
  const allPosts = conceptFeedService.getCachedPosts();
  const allQuestions = questionService.getAll();

  return {
    conceptId,
    title,
    description,
    relatedFlashcards: allCards.filter(c => c.nodeId === conceptId).length,
    relatedPosts: allPosts.filter(p =>
      Array.isArray(p.sourceQuestionIds) && p.sourceQuestionIds.includes(conceptId)
    ).length,
    relatedQuestions: allQuestions.filter(q =>
      q.id === conceptId || q.relatedQuestionIds?.includes(conceptId)
    ).length,
    primaryAction: 'review', // determined by existing decideMoveType logic
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-shot check-in | Multi-turn Socratic dialogue | Phase 20 | Richer signal extraction |
| Flat MoveCard/ChunkCard | Portal cards with content aggregation | Phase 20 | Unified topic gateways |
| Implicit trajectory usage | Explicit OrchestrationStrategy interface | Phase 20 | Services have consistent hint access |
| Fixed scoring weights | Strategy-adjusted dynamic weights | Phase 20 | Context-aware suggestion ranking |

## Open Questions

1. **Strategy selector in settings?**
   - What we know: CONTEXT.md lists this as Claude's discretion
   - What's unclear: Whether users would benefit from choosing between strategies
   - Recommendation: Start with single default strategy. Add settings toggle only if there's a clear UX benefit. The strategy should be invisible to users per D-01 specifics ("should feel invisible").

2. **Follow-up streaming vs non-streaming**
   - What we know: Both `chatCompletion` and `chatStream` are available
   - What's unclear: Whether follow-up questions should stream character-by-character
   - Recommendation: Use `chatCompletion` (non-streaming) for follow-ups. They are 1-2 sentences -- streaming adds UX complexity for minimal benefit. Save streaming for longer responses.

3. **Portal card content counts: live vs cached**
   - What we know: All data is in localStorage, getAll() calls are cheap
   - What's unclear: Whether re-computing counts on every render is acceptable
   - Recommendation: Compute on render. With <1000 items in each store, filtering is sub-millisecond. No memoization needed unless profiling shows otherwise.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node --test) |
| Config file | none (script in package.json) |
| Quick run command | `cd app && node --test tests/trajectoryAnalyzer.test.mjs` |
| Full suite command | `cd app && node --test tests/**/*.test.mjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORCH-01 | OrchestrationStrategy.computeHints returns correct mode based on signals | unit | `cd app && node --test tests/orchestration-strategy.test.mjs` | Wave 0 |
| ORCH-02 | Feed service applies strategy hints to bias post selection | unit | `cd app && node --test tests/concept-feed.test.mjs` | Exists (extend) |
| ORCH-03 | scoreMove accepts StrategyHints and adjusts weights | unit | `cd app && node --test tests/suggestionScorer.test.mjs` | Exists (extend) |
| DIAG-01 | diagnosticDialogueService generates follow-up from signals | unit | `cd app && node --test tests/diagnostic-dialogue.test.mjs` | Wave 0 |
| DIAG-02 | Conversation renders within PlannerScreen check-in area | manual-only | Manual visual verification | N/A |
| DIAG-03 | Signals merge incrementally after each turn | unit | `cd app && node --test tests/diagnostic-dialogue.test.mjs` | Wave 0 |
| PORTAL-01 | PortalCard replaces flat suggestions | manual-only | Manual visual verification | N/A |
| PORTAL-02 | Portal card shows topic, description, content counts | unit | `cd app && node --test tests/services/portal-card.test.mjs` | Wave 0 |
| PORTAL-03 | Portal card navigation uses moveNavigator | unit | `cd app && node --test tests/services/portal-card.test.mjs` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd app && node --test tests/orchestration-strategy.test.mjs tests/diagnostic-dialogue.test.mjs tests/suggestionScorer.test.mjs`
- **Per wave merge:** `cd app && node --test tests/**/*.test.mjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/orchestration-strategy.test.mjs` -- covers ORCH-01 (strategy hint computation)
- [ ] `tests/diagnostic-dialogue.test.mjs` -- covers DIAG-01, DIAG-03 (follow-up generation, signal merging)
- [ ] `tests/services/portal-card.test.mjs` -- covers PORTAL-02, PORTAL-03 (content aggregation, navigation)
- [ ] Extend `tests/suggestionScorer.test.mjs` -- covers ORCH-03 (strategy-adjusted scoring)

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `trajectoryAnalyzer.service.ts`, `planner.service.ts`, `plannerAutoGen.service.ts`, `suggestionScorer.service.ts`, `moveGenerator.service.ts`, `PlannerScreen.tsx`, `MoveCard.tsx`, `moveNavigator.ts`
- Types: `types/index.ts` -- TrajectorySignal, CheckInSignals, PlannerChunk, PlannedMove interfaces
- LLM provider: `providers/llm/index.ts` -- chatCompletion, chatStream signatures

### Secondary (MEDIUM confidence)
- Existing test patterns: `tests/trajectoryAnalyzer.test.mjs`, `tests/suggestionScorer.test.mjs`, `tests/plannerAutoGen.test.mjs`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies; all patterns from existing codebase
- Architecture: HIGH -- Strategy pattern is well-understood; integration points clearly identified in source
- Pitfalls: HIGH -- Based on actual codebase patterns (cache invalidation, state persistence, eventBus)

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable -- no external dependency changes expected)
