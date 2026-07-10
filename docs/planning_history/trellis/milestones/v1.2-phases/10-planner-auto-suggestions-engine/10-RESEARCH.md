# Phase 10: Planner Auto-Suggestions Engine - Research

**Researched:** 2026-03-27
**Domain:** Recommendation algorithm, temporal scheduling, state management
**Confidence:** HIGH

## Summary

Phase 10 adds auto-generated learning suggestions to the Planner when users accumulate sufficient knowledge (5+ question nodes) but have no planned activities. The system must:

1. **Aggregate trajectory signals** from review performance, question frequency, and engagement patterns
2. **Score suggestions deterministically** using weighted multi-factor algorithm (not AI or probabilistic)
3. **Trigger auto-generation** only when conditions are met (graph size + empty Planner)
4. **Refresh daily** using event-driven or time-based scheduling (tied to podcast completion or user-configurable time)
5. **Persist across restarts** using localStorage + SQLite write-through pattern (existing in codebase)

The recommendation algorithm is **template-based scoring** (deterministic weighting) rather than AI-powered, enabling fast, reproducible, and tunable suggestions. Daily refresh is event-driven where possible (podcast completion) with time-based fallback (24h since last refresh).

**Primary recommendation:** Implement template-based trajectory scoring with cached signals (6h TTL), event-driven refresh trigger on podcast completion, and localStorage-first persistence with SQLite backup.

---

## User Constraints (from CONTEXT.md)

*No CONTEXT.md exists for Phase 10; all decisions fall under the agent's discretion.*

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLANNER-01 | Auto-generate "Suggested Moves" when KG ≥ 5 nodes AND Planner empty | Trigger conditions mapped; scoring algorithm enables move ranking |
| PLANNER-02 | Display suggestions on Planner screen without user intervention | UI patterns exist (ChunkCard, SectionHeader); no new component types needed |
| PLANNER-03 | Refresh suggestions daily after podcast time | Event-driven pattern via eventBus; time-based fallback using localStorage lastRefresh timestamp |
| PLANNER-05 | Trajectory-aware scoring (review perf, question frequency, time since review) | Detailed scoring formula with weights (0.4/0.3/0.2/0.1); signal aggregation pattern researched |
| PLANNER-06 | Link suggestions to Posts, Questions, or Review sessions | Move types map to linkedResource (post, question, review); planner chunks already support linkedConceptIds |

---

## Standard Stack

### Core Services
| Service | Purpose | Existing | Notes |
|---------|---------|----------|-------|
| `trajectorAnalyzer.service.ts` | Aggregate signals from review/question/engagement | ✓ Create | Mimic `canonical-knowledge.service` patterns (signal extraction + caching) |
| `suggestionScorer.service.ts` | Apply weighted scoring formula to concepts | ✓ Create | Deterministic, no randomness; matches planner-signal approach in concept-feed |
| `moveGenerator.service.ts` | Convert scored concepts into PlannedMove objects | ✓ Create | Map types (review/deepdive/connection) to linkedResource |
| `plannerAutoGen.service.ts` | Check trigger conditions + run generation + persist | ✓ Create | Extends existing plannerService (read-only queries, new auto-gen flag) |
| `plannerService` | Existing chunks/threads/checkIns storage | ✓ Reuse | Extend with auto-gen flag on PlannerChunk; no schema change needed |

### Persistence Layer (No new dependencies)
| Technology | Current Use | Auto-Suggestions Use |
|------------|------------|----------------------|
| localStorage | PlannerChunk, PlannerThread, DailyPost cache | Store lastRefreshTimestamp, cached suggestions |
| SQLite (native) | Chunks, threads, edge weights | Backup auto-gen suggestions (write-through pattern) |
| Capacitor Preferences | Settings, theme | Optional: store refresh-time preference |

### Event System (No new dependencies)
| Pattern | Current Use | Auto-Suggestions Use |
|---------|------------|----------------------|
| eventBus | REVIEW_SUBMITTED, graph updates | PODCAST_COMPLETED (trigger refresh), AUTO_GEN_UPDATED (UI notification) |
| React hooks (usePlanner) | Planner state sync | Update on generation; no new hooks needed |

### UI Components (Reuse existing)
| Component | Current Use | Auto-Suggestions Use |
|-----------|------------|----------------------|
| ChunkCard | Display planned chunks | Display suggested moves (same component, status='suggested') |
| SectionHeader | Section labels + count badge | "Suggested Moves" section header |
| Card | Generic container | Move preview cards |
| Badge | Status/count indicators | Relevance score badge |

---

## Architecture Patterns

### 1. Trajectory Signal Aggregation

**What:** Extract behavioral metrics from user activity without AI analysis.

**Implementation pattern:**
```typescript
// Sourced from existing services:
// - flashcardService.getAll() → review metrics (performance, recency)
// - questionService.getAll() → question frequency, coverage
// - planner threads + checkIns → engagement signals

interface TrajectorySignal {
  reviewPerformance: number;        // Avg correctness on due flashcards (0-100)
  questionFrequency: number;        // Questions asked last 7 days
  timeSinceLastReview: number;      // Milliseconds (for all concepts)
  feedEngagement: number;           // Posts viewed last 7 days
  conceptCoverage: number;          // % of graph with reviews
  weakAreas: string[];              // Question IDs with <60% review score
}

// Cache signals for 6 hours to avoid expensive recalculation
export const trajectoryAnalyzer = {
  aggregateSignals(): TrajectorySignal {
    const allQuestions = questionService.getAll();
    const allCards = flashcardService.getAll();
    const dueCards = allCards.filter(c => c.reviewSchedule.nextReviewDate <= today());
    
    // Performance = avg correctness on due cards this week
    const avgCorrect = dueCards.length > 0
      ? dueCards.filter(c => c.reviewSchedule.easeFactor > 2.5).length / dueCards.length * 100
      : 50;
    
    // Question frequency = count created in last 7 days
    const week = Date.now() - 7 * 86400000;
    const recentQuestions = allQuestions.filter(q => q.createdAt > week);
    
    return {
      reviewPerformance: avgCorrect,
      questionFrequency: recentQuestions.length,
      timeSinceLastReview: Math.max(...allCards.map(c => Date.now() - (c.reviewSchedule.nextReviewDate))),
      feedEngagement: postsViewedLastWeek(), // Track via event-bus
      conceptCoverage: (allCards.length / allQuestions.length) * 100,
      weakAreas: findWeakAreas(allCards, 0.6),
    };
  }
};
```

**When to use:** On app boot, before checking trigger conditions; cache aggressively (6h TTL).

**Why this pattern:** Mirrors existing `concept-feed.service` which computes PlannerSignals similarly; avoids N+1 queries.

---

### 2. Deterministic Scoring Algorithm

**What:** Template-based weighting formula (no ML, no randomness) to rank suggestions.

**Formula:**
```
relevanceScore = (
  reviewPerf_weight × (100 - reviewPerformance) +       // 0.4: prioritize weak areas
  timeRecency_weight × (timeSinceLastReview / maxTime) +  // 0.3: prioritize overdue
  engagement_weight × (engagementStrength / maxEngage) +  // 0.2: popular topics
  coverage_weight × (1 - conceptCoverage / 100)          // 0.1: fill gaps
)

Clamped to [0, 100]
```

**Weights rationale:**
- **0.4 review performance:** Struggling concepts matter most (remedial learning)
- **0.3 recency:** Overdue reviews prevent decay (spaced repetition principle)
- **0.2 engagement:** Reinforce curiosity (topics you've asked about)
- **0.1 coverage:** Gradually breadth (don't ignore cold starts)

**Implementation:**
```typescript
export const suggestionScorer = {
  scoreMove(conceptId: string, signals: TrajectorySignal): number {
    const concept = questionService.get(conceptId);
    if (!concept) return 0;
    
    const lastReviewCard = flashcardService.getAll()
      .filter(c => c.nodeId === conceptId)
      .sort((a, b) => b.reviewSchedule.nextReviewDate.localeCompare(a.reviewSchedule.nextReviewDate))[0];
    
    const timeSince = lastReviewCard
      ? Date.now() - new Date(lastReviewCard.reviewSchedule.nextReviewDate).getTime()
      : 30 * 86400000; // 30d default if never reviewed
    
    const perfScore = (100 - signals.reviewPerformance) / 100;
    const recencyScore = Math.min(timeSince / (30 * 86400000), 1); // Max 30d
    const engageScore = concept.relatedQuestionIds.length / 10; // Normalized
    const coverageScore = 1 - (signals.conceptCoverage / 100);
    
    return Math.min(100,
      0.4 * perfScore * 100 +
      0.3 * recencyScore * 100 +
      0.2 * engageScore * 100 +
      0.1 * coverageScore * 100
    );
  },
  
  rankMoves(concepts: string[], signals: TrajectorySignal): Array<{id: string; score: number}> {
    return concepts
      .map(id => ({id, score: this.scoreMove(id, signals)}))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8); // Top 8
  }
};
```

**When to use:** During auto-generation trigger; run once per refresh cycle.

**Why deterministic:** Reproducible for testing, tunable (weights can be adjusted), fast (no API calls).

---

### 3. Move Generation & Type Mapping

**What:** Convert scored concepts into rich move objects with linked resources.

**Move types:**
- `review`: Link to related flashcard → "Review now"
- `deepdive`: Link to related post → "Explore this"
- `connection`: Link to 2+ related concepts → "See connections"
- `podcast`: AI-generated podcast on weak area (deferred; use placeholder for v1.1)

**Implementation:**
```typescript
interface PlannedMove extends PlannerChunk {
  moveType: 'review' | 'deepdive' | 'connection' | 'podcast';
  relevanceScore: number;
  linkedResource?: {
    type: 'post' | 'question' | 'review';
    id: string;
  };
  isAutoGenerated: true;
}

export const moveGenerator = {
  generateMoves(concepts: string[], signals: TrajectorySignal): PlannedMove[] {
    return concepts.map((conceptId, idx) => {
      const concept = questionService.get(conceptId);
      const score = suggestionScorer.scoreMove(conceptId, signals);
      
      // Determine move type: review if weak, deepdive if recent questions, connection if related
      let moveType: PlannedMove['moveType'] = 'review';
      let linkedResourceId = flashcardService.findByNodeId(conceptId)?.[0].id;
      let linkedResourceType: 'post' | 'question' | 'review' = 'review';
      
      if (concept?.relatedQuestionIds.length > 2) {
        moveType = 'connection';
        linkedResourceType = 'question';
        linkedResourceId = concept.relatedQuestionIds[0];
      } else if (signals.questionFrequency > 3) {
        moveType = 'deepdive';
        linkedResourceType = 'post';
        // Find related post from concept-feed (would require service call)
      }
      
      return {
        id: `move-${conceptId}-${Date.now()}`,
        type: moveType,
        goal: `${moveType === 'review' ? '📚 Review' : moveType === 'deepdive' ? '🔗 Deep Dive' : '🎯 Connect'}: ${concept?.title || conceptId}`,
        description: `Why: ${score > 75 ? 'Critical review' : score > 50 ? 'Time to revisit' : 'Build breadth'}`,
        linkedConceptIds: [conceptId],
        status: 'suggested',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        relevanceScore: score,
        moveType,
        linkedResource: { type: linkedResourceType, id: linkedResourceId },
        isAutoGenerated: true,
      } as PlannedMove;
    });
  }
};
```

**When to use:** After scoring; maps concepts → chunks for planner persistence.

---

### 4. Auto-Generation Trigger & Conditions

**What:** Check 5+ nodes + empty Planner conditions; run generation once per day.

**Trigger logic:**
```typescript
export const plannerAutoGen = {
  shouldAutoGenerate(): boolean {
    const allQuestions = questionService.getAll();
    const chunks = plannerService.getAll().chunks;
    
    // Condition 1: 5+ knowledge nodes
    const hasEnoughKnowledge = allQuestions.length >= 5;
    
    // Condition 2: Empty Planner (no active or pending chunks, only suggested)
    const activePending = chunks.filter(c => 
      c.status === 'in_progress' || c.status === 'saved_for_later'
    );
    const plannerIsEmpty = activePending.length === 0;
    
    // Condition 3: Last refresh > 24h ago (or never)
    const lastRefresh = localStorage.getItem('echolearn_suggestions_refresh');
    const refreshDue = !lastRefresh || (Date.now() - parseInt(lastRefresh, 10)) > 86400000;
    
    return hasEnoughKnowledge && plannerIsEmpty && refreshDue;
  },
  
  async generateAndStoreSuggestions(): Promise<PlannedMove[]> {
    if (!this.shouldAutoGenerate()) return [];
    
    const signals = trajectoryAnalyzer.aggregateSignals();
    const allConcepts = questionService.getAll().map(q => q.id);
    const rankedConcepts = suggestionScorer.rankMoves(allConcepts, signals).map(m => m.id);
    const moves = moveGenerator.generateMoves(rankedConcepts, signals);
    
    // Store suggestions in planner
    moves.forEach(move => {
      plannerService.createChunk(move);
    });
    
    // Mark refresh timestamp
    localStorage.setItem('echolearn_suggestions_refresh', Date.now().toString());
    
    // Emit event for UI refresh
    eventBus.emit({ type: 'AUTO_GEN_UPDATED', payload: { moves, count: moves.length } });
    
    return moves;
  }
};
```

**When to use:** On app boot (in usePlanner hook), on planner state changes (user adds/completes chunk).

---

### 5. Daily Refresh Scheduling

**What:** Trigger generation daily using event-driven + time-based patterns.

**Pattern A: Event-driven (preferred)**
```typescript
// Subscribe to podcast completion event
eventBus.subscribe('PODCAST_COMPLETED', () => {
  localStorage.setItem('echolearn_suggestions_refresh', (Date.now() - 86401000).toString()); // Force refresh
  plannerAutoGen.generateAndStoreSuggestions();
});
```

**Pattern B: Time-based fallback**
```typescript
// On app boot, check if 24h elapsed
export function checkDailyRefresh(): void {
  if (plannerAutoGen.shouldAutoGenerate()) {
    plannerAutoGen.generateAndStoreSuggestions();
  }
}

// In main app initialization or usePlanner hook
useEffect(() => {
  checkDailyRefresh();
}, []);
```

**Why both:** Event-driven is ideal for podcasts (correlates with learning moment); time-based ensures refresh even if user skips podcasts.

---

### 6. State Persistence

**Storage strategy (reuse existing patterns):**

| Data | Storage | Fallback | TTL | Sync |
|------|---------|----------|-----|------|
| Suggested chunks (PlannedMove) | localStorage | SQLite (write-through) | N/A | On change |
| lastRefreshTimestamp | localStorage | None | 24h | On change |
| cachedTrajectorySignals | localStorage (optional) | None | 6h | On demand |

**No new persistence layer needed;** extend existing planner service with isAutoGenerated flag.

```typescript
// Extend PlannerChunk type (in types/index.ts)
export interface PlannerChunk {
  // ... existing fields ...
  isAutoGenerated?: boolean;  // true for auto-gen suggestions
}
```

---

### 7. UI Integration

**Existing components reused:**
- **ChunkCard:** Renders suggested moves (status='suggested' already has dismiss/save/start buttons)
- **PlannerScreen:** Add "Suggested Moves" section after active chunks
- **SectionHeader:** Label section with count

**No new components needed.** The existing chunk UI already shows type icons (retrieve, repair, connect, create) which map well to move types.

**Display order:**
1. Active chunks (in_progress)
2. Saved chunks (saved_for_later)
3. **Suggested moves section** ← auto-generated
4. Completed chunks (done)

---

## Don't Hand-Roll

| Problem | ❌ Don't Build | ✅ Use Instead | Why |
|---------|--------------|--------------|-----|
| Caching trajectory signals | Custom in-memory cache | localStorage + 6h timestamp check | Already handle storage quota, TTL logic |
| Scheduling daily refresh | setInterval, cron abstraction | eventBus + time-based fallback | Respects app lifecycle, works on mobile |
| Recommendation ranking | Custom ML model, probabilistic | Weighted formula template | Deterministic, fast, testable, tunable |
| Persisting suggestions | Custom serialization | Existing plannerService + SQLite | Write-through already proven in codebase |
| Converting concepts to moves | Custom mapper | Existing PlannerChunk + moveType + linkedResource | Type-safe, reuses chunk UI |

**Key insight:** Recommendation algorithms often look simple but hide complexity in edge cases (cold start, concept retirement, scoring skew). Template-based deterministic scoring avoids these traps by being stateless and tunable.

---

## Common Pitfalls

### Pitfall 1: Trigger Thrashing (Constant Regeneration)

**What goes wrong:** Auto-generation triggers every time planner state changes → suggestions regenerate 10× per session → flickering UI, lost user dismissals.

**Why it happens:** Naive implementation triggers on every `shouldAutoGenerate()` check without debouncing.

**How to avoid:** Store `lastRefreshTimestamp` and enforce **strict 24h cooldown**. Even on manual retry, track attempts separately.

```typescript
// ✗ Wrong: Triggers every state change
useEffect(() => {
  if (planner.chunks.length === 0) {
    plannerAutoGen.generateAndStoreSuggestions(); // May run 5x in one session
  }
}, [planner.chunks]);

// ✓ Right: Enforce 24h cooldown
useEffect(() => {
  if (plannerAutoGen.shouldAutoGenerate()) {
    plannerAutoGen.generateAndStoreSuggestions().then(() => {
      localStorage.setItem('echolearn_suggestions_refresh', Date.now().toString());
    });
  }
}, []);
```

**Warning signs:** Suggestions changing while user scrolls; "New suggestions" toast appearing multiple times per minute.

---

### Pitfall 2: Empty Trigger Ambiguity

**What goes wrong:** Unclear what "empty Planner" means → suggestions auto-gen when user has dismissed all moves → poor experience.

**Why it happens:** Conflating "no planned chunks" with "no saved or in-progress chunks" — dismissed chunks should not be counted.

**How to avoid:** Define "empty Planner" as **strictly zero chunks with status in ['in_progress', 'saved_for_later']**. Dismissed/deleted chunks don't count.

```typescript
// ✓ Correct definition
const plannerIsEmpty = chunks.filter(c => 
  c.status === 'in_progress' || c.status === 'saved_for_later'
).length === 0;

// ✗ Wrong: Counts dismissed chunks
const plannerIsEmpty = chunks.length === 0;
```

**Warning signs:** Suggestions reappear after user dismisses them; user sees "New suggestions" immediately after clearing Planner.

---

### Pitfall 3: Scoring Skew (One Factor Dominates)

**What goes wrong:** One weight (e.g., recency) overwhelms others → suggestions are always "old concepts," not "weak concepts" → feels repetitive.

**Why it happens:** Weights not calibrated to signal scale; one metric naturally ranges 0-100 while another ranges 0-10.

**How to avoid:** **Normalize all factors to [0, 1]** before applying weights. Test weighting against known user profiles.

```typescript
// ✗ Wrong: Raw values, not normalized
score = 0.4 * reviewPerf + 0.3 * timeSince + 0.2 * engagement;
// reviewPerf: 0-100; timeSince: 0-2,592,000,000ms; engagement: 0-10 → not comparable

// ✓ Right: Normalized [0, 1]
const perfNorm = (100 - reviewPerformance) / 100;       // [0, 1]
const timeNorm = Math.min(timeSince / (30*86400000), 1); // [0, 1], capped at 30d
const engageNorm = engagement / 10;                      // [0, 1]
score = 0.4 * perfNorm * 100 + 0.3 * timeNorm * 100 + ...; // All [0, 100]
```

**Warning signs:** Suggestions always from one category (always overdue, never weak areas); user perception: "these aren't helpful."

---

### Pitfall 4: Cold-Start (New Users Have No Signals)

**What goes wrong:** New user with 5 concepts but no reviews → trajectory signals are all zeros → suggestions useless or missing.

**Why it happens:** AggregateSignals assumes historical review data; doesn't handle first-week users.

**How to avoid:** Provide **sensible defaults for new users**: equal weight to all concepts, prefer variety over ranking.

```typescript
// ✓ Fallback for cold-start
export const trajectoryAnalyzer = {
  aggregateSignals(): TrajectorySignal {
    // ... normal aggregation ...
    // If no review data, use question creation recency + keyword overlap
    if (signals.reviewPerformance === 0) {
      signals.reviewPerformance = 50; // Neutral
      signals.questionFrequency = recentQuestions.length; // Prioritize new learning
    }
    return signals;
  }
};
```

**Warning signs:** New users see no suggestions; or suggestions are random; new user feels stuck.

---

### Pitfall 5: Podcast Time Not Configurable

**What goes wrong:** System hardcodes 8 AM refresh, but user listens to podcast at 11 PM → no suggestions when they plan.

**Why it happens:** Event-driven refresh tied to fixed time, not user preference.

**How to avoid:** Allow user to set preferred refresh time in Settings; default to "after podcast" if podcast is scheduled, else 8 AM.

```typescript
// Store in Capacitor Preferences or localStorage
const SETTINGS_KEY = 'echolearn_refresh_settings';

interface RefreshSettings {
  refreshTrigger: 'podcast' | 'manual' | 'time';
  refreshTime?: string; // e.g., '21:00' (9 PM)
  enabled: boolean;
}

// Default: if user has podcast scheduled, use podcast trigger; else 8 AM
```

**Warning signs:** User says "I never see suggestions when I need them"; suggestions arrive at wrong time.

---

## Code Examples

### Example 1: Full Trigger + Generation Flow
```typescript
// Source: Pattern from Phase 10 PLAN.md + existing services

export const plannerAutoGen = {
  /**
   * Check if auto-generation should run.
   * Criteria: 5+ nodes, empty planner, 24h+ since last refresh
   */
  shouldAutoGenerate(): boolean {
    const questions = questionService.getAll();
    const chunks = plannerService.getAll().chunks;
    const active = chunks.filter(c => ['in_progress', 'saved_for_later'].includes(c.status));
    
    const lastRefresh = localStorage.getItem('echolearn_suggestions_refresh');
    const refreshDue = !lastRefresh || Date.now() - parseInt(lastRefresh, 10) > 86400000;
    
    return questions.length >= 5 && active.length === 0 && refreshDue;
  },

  /**
   * Generate and store suggestions, emit update event.
   */
  async generateAndStoreSuggestions(): Promise<PlannedMove[]> {
    const signals = trajectoryAnalyzer.aggregateSignals();
    const concepts = questionService.getAll().map(q => q.id);
    const scored = suggestionScorer.rankMoves(concepts, signals);
    const moves = moveGenerator.generateMoves(scored.map(s => s.id), signals);
    
    // Remove old auto-generated suggestions
    const oldChunks = plannerService.getAll().chunks.filter(c => c.isAutoGenerated);
    oldChunks.forEach(c => plannerService.deleteChunk(c.id));
    
    // Store new suggestions
    moves.forEach(move => plannerService.createChunk(move));
    
    // Update refresh timestamp
    localStorage.setItem('echolearn_suggestions_refresh', Date.now().toString());
    
    // Notify UI
    eventBus.emit({ type: 'AUTO_GEN_UPDATED', payload: { moves } });
    
    return moves;
  },
};

// Usage in usePlanner hook:
export function usePlanner() {
  const [planner, setPlanner] = useState(() => plannerService.getAll());
  
  useEffect(() => {
    // On mount, check if refresh due
    if (plannerAutoGen.shouldAutoGenerate()) {
      plannerAutoGen.generateAndStoreSuggestions();
    }
  }, []);
  
  // Listen for manual refresh button or app resume
  useEffect(() => {
    const unsubFromResume = eventBus.subscribe('APP_RESUMED', () => {
      if (plannerAutoGen.shouldAutoGenerate()) {
        plannerAutoGen.generateAndStoreSuggestions();
      }
    });
    return unsubFromResume;
  }, []);
}
```

---

### Example 2: Trajectory Signal Extraction
```typescript
// Source: Mimics concept-feed.service pattern for PlannerSignals

interface TrajectorySignal {
  reviewPerformance: number;    // Avg correctness [0, 100]
  questionFrequency: number;    // Count last 7d
  timeSinceLastReview: number;  // Milliseconds
  feedEngagement: number;       // Posts viewed [0, 100]
  conceptCoverage: number;      // % of graph reviewed [0, 100]
  weakAreas: string[];          // Concept IDs with <60% correctness
}

export const trajectoryAnalyzer = {
  // Cache key
  _cacheKey: 'echolearn_trajectory_signals',
  _cacheTTL: 6 * 3600 * 1000, // 6 hours
  
  aggregateSignals(): TrajectorySignal {
    // Try cache first
    const cached = this._getCache();
    if (cached) return cached;
    
    // Extract signals
    const allQuestions = questionService.getAll();
    const allCards = flashcardService.getAll();
    const week = Date.now() - 7 * 86400000;
    
    // Review performance: correctness on cards due this week
    const dueThisWeek = allCards.filter(c => {
      const nextReview = new Date(c.reviewSchedule.nextReviewDate).getTime();
      return nextReview <= Date.now();
    });
    const reviewPerf = dueThisWeek.length > 0
      ? (dueThisWeek.filter(c => c.reviewSchedule.easeFactor >= 2.5).length / dueThisWeek.length) * 100
      : 50; // Default neutral
    
    // Question frequency: created last 7 days
    const questionFreq = allQuestions.filter(q => q.createdAt > week).length;
    
    // Time since last review: earliest next-review date
    const timeSinceReview = allCards.length > 0
      ? Math.max(...allCards.map(c => {
        const nextDate = new Date(c.reviewSchedule.nextReviewDate).getTime();
        return Date.now() - nextDate;
      }))
      : 30 * 86400000; // Default 30d if no cards
    
    // Feed engagement: track via events (simplified: count posts viewed)
    const feedEngag = this._getFeedEngagement();
    
    // Concept coverage: % of questions with at least 1 review
    const conceptCover = allQuestions.length > 0
      ? (allCards.filter(c => c.nodeId && new Set(allQuestions.map(q => q.id)).has(c.nodeId)).length 
         / allQuestions.length) * 100
      : 0;
    
    // Weak areas: concepts with correctness < 60%
    const weak = allQuestions.filter(q => {
      const cards = allCards.filter(c => c.nodeId === q.id);
      if (cards.length === 0) return false;
      const avg = cards.reduce((s, c) => s + c.reviewSchedule.easeFactor, 0) / cards.length;
      return avg < 2.5; // SM-2 easeFacto < 2.5 = struggling
    }).map(q => q.id);
    
    const signal: TrajectorySignal = {
      reviewPerformance: Math.min(reviewPerf, 100),
      questionFrequency: questionFreq,
      timeSinceLastReview: timeSinceReview,
      feedEngagement: feedEngag,
      conceptCoverage: conceptCover,
      weakAreas: weak,
    };
    
    this._setCache(signal);
    return signal;
  },
  
  _getCache(): TrajectorySignal | null {
    try {
      const raw = localStorage.getItem(this._cacheKey);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      const age = Date.now() - (cached.timestamp ?? 0);
      if (age > this._cacheTTL) return null;
      return cached.signal;
    } catch {
      return null;
    }
  },
  
  _setCache(signal: TrajectorySignal): void {
    try {
      localStorage.setItem(this._cacheKey, JSON.stringify({
        signal,
        timestamp: Date.now(),
      }));
    } catch { /* ignore storage errors */ }
  },
  
  _getFeedEngagement(): number {
    // Simplified: count from eventBus POST_VIEWED events last 7d
    // TODO: Implement event tracking in concept-feed.service
    return 0; // Placeholder
  },
};
```

---

### Example 3: Scoring & Ranking
```typescript
// Source: deterministic weighting pattern

export const suggestionScorer = {
  /**
   * Score a single concept based on trajectory signals.
   * Returns [0, 100] relevance score.
   */
  scoreMove(conceptId: string, signals: TrajectorySignal): number {
    const concept = questionService.get(conceptId);
    if (!concept) return 0;
    
    // Find most recent review of this concept
    const relatedCards = flashcardService.getAll().filter(c => c.nodeId === conceptId);
    const lastReviewDate = relatedCards.length > 0
      ? new Date(relatedCards[0].reviewSchedule.nextReviewDate).getTime()
      : Date.now() - (30 * 86400000); // Assume 30d ago if never reviewed
    
    const timeSinceReview = Math.max(0, Date.now() - lastReviewDate);
    const maxTime = 30 * 86400000; // 30 days
    
    // Normalize factors to [0, 1]
    const perfNorm = Math.min(100 - signals.reviewPerformance, 100) / 100;
    const timeNorm = Math.min(timeSinceReview / maxTime, 1);
    const engageNorm = Math.min(concept.relatedQuestionIds.length / 10, 1);
    const coverageNorm = 1 - Math.min(signals.conceptCoverage / 100, 1);
    
    // Weighted sum
    const score = (
      0.4 * perfNorm * 100 +
      0.3 * timeNorm * 100 +
      0.2 * engageNorm * 100 +
      0.1 * coverageNorm * 100
    );
    
    return Math.min(Math.max(score, 0), 100);
  },
  
  /**
   * Rank all concepts and return top N.
   */
  rankMoves(conceptIds: string[], signals: TrajectorySignal, limit = 8): Array<{id: string; score: number}> {
    return conceptIds
      .map(id => ({ id, score: this.scoreMove(id, signals) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },
};

// Usage:
const signals = trajectoryAnalyzer.aggregateSignals();
const allConcepts = questionService.getAll().map(q => q.id);
const topSuggestions = suggestionScorer.rankMoves(allConcepts, signals, 8);
console.log(topSuggestions); // [{id: 'q-123', score: 87}, ...]
```

---

### Example 4: Move Generation
```typescript
// Source: Maps scored concepts to PlannedMove chunks

interface PlannedMove extends PlannerChunk {
  moveType: 'review' | 'deepdive' | 'connection' | 'podcast';
  relevanceScore: number;
  isAutoGenerated: true;
}

export const moveGenerator = {
  /**
   * Convert ranked concept IDs into PlannedMove chunks.
   * Each move links to a resource (flashcard, post, question).
   */
  generateMoves(conceptIds: string[], signals: TrajectorySignal): PlannedMove[] {
    return conceptIds.map((conceptId, index) => {
      const concept = questionService.get(conceptId);
      const score = suggestionScorer.scoreMove(conceptId, signals);
      
      // Determine move type
      let moveType: 'review' | 'deepdive' | 'connection' | 'podcast' = 'review';
      let linkedResource: {type: 'post' | 'question' | 'review'; id: string} | undefined;
      
      if (signals.weakAreas.includes(conceptId) && score > 70) {
        moveType = 'review'; // Critical review
        linkedResource = { type: 'review', id: this._findReviewCardFor(conceptId) || conceptId };
      } else if (concept?.relatedQuestionIds.length! > 2) {
        moveType = 'connection'; // Explore connections
        linkedResource = { type: 'question', id: concept!.relatedQuestionIds[0] };
      } else if (signals.questionFrequency > 3) {
        moveType = 'deepdive'; // Deep dive post
        linkedResource = { type: 'post', id: this._findRelatedPost(conceptId) || conceptId };
      }
      
      const reasonMap = {
        review: score > 70 ? 'Time for a critical review' : 'Ready to revisit',
        deepdive: 'Popular topic — dig deeper',
        connection: 'Explore related concepts',
        podcast: 'AI-generated deep dive (coming soon)',
      };
      
      return {
        id: `move-${conceptId}-${Date.now()}-${index}`,
        type: 'retrieve', // Meta type (maps to UI icon)
        goal: `${this._getMoveIcon(moveType)} ${concept?.title || conceptId}`,
        description: reasonMap[moveType],
        linkedConceptIds: [conceptId],
        threadId: undefined,
        status: 'suggested',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        moveType,
        relevanceScore: score,
        linkedResource,
        isAutoGenerated: true,
      } as PlannedMove;
    });
  },
  
  _getMoveIcon(moveType: string): string {
    const icons: Record<string, string> = {
      review: '📚',
      deepdive: '🔗',
      connection: '🎯',
      podcast: '🎙️',
    };
    return icons[moveType] || '⭐';
  },
  
  _findReviewCardFor(conceptId: string): string | null {
    const card = flashcardService.getAll().find(c => c.nodeId === conceptId);
    return card?.id ?? null;
  },
  
  _findRelatedPost(conceptId: string): string | null {
    // TODO: Query concept-feed for related post
    return null;
  },
};
```

---

## State of the Art

| Aspect | Approach | Why It Matters |
|--------|----------|----------------|
| **Suggestion algorithm** | Template-based scoring (not ML) | Reproducible, tunable, fast; avoids cold-start problems |
| **Daily refresh timing** | Event-driven (podcast) + time-based fallback | Aligns with learning moment; robust if events don't fire |
| **Persistence** | localStorage first, SQLite backup | Mobile-safe; respects app lifecycle; no new dependencies |
| **UI integration** | Reuse ChunkCard + existing layout | Reduces code; consistent interaction patterns |
| **Signal caching** | 6-hour TTL on localStorage | Avoids expensive aggregation every app boot |

**Deprecated/outdated:**
- ~~Probabilistic suggestion (99% of users get same ranked list) → Now deterministic template-based
- ~~Fixed 8 AM refresh → Now event-driven + configurable fallback
- ~~AI-powered move generation → Now rule-based type mapping (future AI optional)

---

## Open Questions

1. **Post linking:** How to find "related posts" for deepdive suggestions?
   - Current concept-feed computes DailyPost from questions; may need reverse index.
   - Recommendation: Extend conceptFeedService with `getPostsByConceptId(id)`.

2. **Podcast time default:** If user has no podcast scheduled, what time for fallback refresh?
   - Currently hardcoded to 8 AM in PLAN.md.
   - Recommendation: Allow user to set in Settings; default to 8 AM or first app launch.

3. **Move type icons:** Should moves use their own visual style, or inherit chunk type icons?
   - Current PLAN.md maps move types to emoji (📚, 🔗, 🎙️).
   - Recommendation: Use emoji for now; consider extending IconConfig later if needed.

4. **Weak area threshold:** Is 60% correctness (SM-2 easeFactor 2.5) the right cutoff?
   - May vary by user; could be a setting.
   - Recommendation: Start with 60%; add tuning option in future if user feedback suggests adjustment.

5. **Cold-start diversity:** For new users with 5 concepts but no reviews, should suggestions include all concepts equally?
   - Current algorithm may produce unbalanced scores.
   - Recommendation: Detect cold-start (no review history) and equalize scores; add `isNewUser` heuristic.

---

## Environment Availability

| Dependency | Required By | Available | Fallback |
|------------|------------|-----------|----------|
| localStorage | Signal caching, refresh timestamp | ✓ | None; feature broken |
| SQLite (native) | Persistence backup | ✓ Native / ✗ Web | localStorage-only on web (acceptable) |
| eventBus | Podcast completion trigger, UI notify | ✓ | Time-based refresh only; less ideal |
| flashcardService | Review metrics aggregation | ✓ | Feature blocked |
| questionService | Concept enumeration, scoring | ✓ | Feature blocked |
| plannerService | Chunk storage + query | ✓ | Feature blocked |

**No external dependencies beyond existing services.** All required data sources already available.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured (Wave 0 gap) |
| Config file | TBD — no vitest/jest config in repo |
| Quick run command | TBD — recommend `npm test` or `npm run test:watch` |
| Full suite command | TBD — recommend `npm test -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLANNER-01 | shouldAutoGenerate() returns true when KG ≥ 5 AND planner empty | unit | `npm test -- --run src/services/plannerAutoGen.test.ts` | ❌ Wave 0 |
| PLANNER-01 | shouldAutoGenerate() returns false when KG < 5 | unit | `npm test -- --run src/services/plannerAutoGen.test.ts` | ❌ Wave 0 |
| PLANNER-02 | Suggestions render in Planner screen with correct status='suggested' | component | `npm test -- --run src/screens/PlannerScreen.test.tsx` | ❌ Wave 0 |
| PLANNER-03 | Suggestions regenerate after 24h elapsed (lastRefresh check) | unit | `npm test -- --run src/services/plannerAutoGen.test.ts` | ❌ Wave 0 |
| PLANNER-05 | scoreMove() returns higher scores for weak concepts | unit | `npm test -- --run src/services/suggestionScorer.test.ts` | ❌ Wave 0 |
| PLANNER-05 | Weighting formula: perfScore (0.4) dominates timeScore (0.3) | unit | `npm test -- --run src/services/suggestionScorer.test.ts` | ❌ Wave 0 |
| PLANNER-06 | PlannedMove links to review/post/question via linkedResource | unit | `npm test -- --run src/services/moveGenerator.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Quick validation (trigger conditions, basic scoring)
  - Command: `npm test -- --run src/services/planner*.test.ts` (if configured)
- **Per wave merge:** Full suite + UI rendering
  - Command: `npm test -- --run` (full suite)
- **Phase gate:** All tests passing before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/services/trajectoryAnalyzer.test.ts` — Signal aggregation correctness, cache TTL
- [ ] `src/services/suggestionScorer.test.ts` — Weighting formula, normalization, edge cases (cold-start, all zeros)
- [ ] `src/services/moveGenerator.test.ts` — Move type mapping, linkedResource construction
- [ ] `src/services/plannerAutoGen.test.ts` — Trigger conditions (5 nodes, empty, 24h cooldown), generation flow
- [ ] `src/screens/PlannerScreen.test.tsx` — Suggested Moves section rendering, user interactions (add/dismiss)
- [ ] Test framework setup: `npm install --save-dev vitest` (or jest); create vitest.config.ts
- [ ] `tests/fixtures/trajectorySignals.fixture.ts` — Mock signals for deterministic testing
- [ ] `tests/setup.ts` — localStorage mock, eventBus mock for unit tests

**Recommendation:** Start with trajectoryAnalyzer tests (data correctness) → scoreMove tests (algorithm) → integration tests (full flow). This order validates each layer before composition.

---

## Sources

### Primary (HIGH confidence)
- **Existing codebase analysis** — planner.service.ts, flashcard.service.ts, concept-feed.service.ts, graph.service.ts
  - Sourced: Storage patterns (localStorage + SQLite), event-bus usage, signal aggregation (concept-feed)
- **PLAN.md (Phase 10)** — Technical approach section with scoring formula and trajectory model
  - Sourced: Weighting rationale, move types, data model interfaces
- **Type definitions** — types/index.ts
  - Sourced: PlannerChunk, Question, FlashCard, ReviewSchedule interfaces

### Secondary (MEDIUM confidence)
- **Pattern extraction** — Mirrored from similar services (conceptFeedService, questionService)
  - Sourced: Cache patterns, signal aggregation, service export structure

---

## Metadata

**Confidence breakdown:**
- **Standard Stack: HIGH** — All dependencies already in codebase; no new libraries needed
- **Architecture Patterns: HIGH** — Patterns directly sourced from existing services (concept-feed, planner, flashcard)
- **Scoring Algorithm: HIGH** — Explicit formula in PLAN.md with clear weighting rationale
- **UI Integration: HIGH** — Existing components (ChunkCard, SectionHeader) fully capable
- **Event-Driven Scheduling: MEDIUM** — eventBus exists; podcast event type TBD (requires coordination with podcast service)
- **Persistence: HIGH** — localStorage + SQLite write-through fully proven in existing services

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable domain, re-check if scoreweighting tuning begins)

---

_End of Phase 10 Research — Ready for Planning_
