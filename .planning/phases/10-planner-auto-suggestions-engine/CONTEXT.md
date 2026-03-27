# Phase 10: Planner Auto-Suggestions Engine - Context & Decisions

**Discussed:** 2026-03-27  
**Locked Decisions:** 4/4

---

## Phase Goal
Auto-generate "Suggested Moves" in the Planner when users accumulate knowledge (5+ questions) but have empty planned activities. Refresh daily using event-driven or time-based triggers.

---

## Locked Design Decisions

### 1. Post Linking Strategy ✅
**Decision:** Use **Conceptual Graph** linking (existing architecture)

**Rationale:**
- Leverages existing graph relationships already computed in `conceptFeedService`
- Aligns with current post-question linking patterns
- Avoids redundant tag indexing or question ID scanning
- Scalable as knowledge graph grows

**Implementation implication:**
- Suggestions link to posts via `linkedConceptIds` 
- Graph traversal finds related posts using existing graph service
- No new indexing layer needed

---

### 2. Podcast Generation Time Configuration ✅
**Decision:** Single consolidated setting "Podcast Generation Time" with toggle for auto-generation

**Rationale:**
- Current settings have overlapping "Sleep Time" and "Advance Minutes" (confusing)
- Consolidating into one "Podcast Generation Time" setting reduces confusion
- User toggle controls whether suggestions auto-refresh on that schedule
- Cleaner UX: one clear time control, one clear toggle (auto vs manual refresh)

**Implementation details:**
- Add `podcastGenerationTime` to CapacitorPreferences (replace/consolidate Sleep Time)
- Add `autoGenerateSuggestionsOnTime` boolean toggle (default: true)
- Trigger logic: 
  - **Primary:** PODCAST_COMPLETED event (when podcast finishes at scheduled time)
  - **Fallback:** 24h elapsed check at startup if podcast event doesn't fire
  - **Manual:** Users can refresh "Suggested Moves" button anytime

**Settings screen changes:**
- Consolidate Sleep Time + Advance Minutes into single "Podcast Generation Time" picker
- Add toggle: "Auto-refresh suggestions at podcast time"
- Settings sync: Capacitor Preferences → localStorage

---

### 3. Weak Area Threshold ✅
**Decision:** Review score < 60% correctness marks concept as "weak"

**Rationale:**
- Industry standard for spaced repetition (SM-2 algorithm threshold)
- Aligns with research confidence level for priority scoring (0.4 weight)
- Concept scoring formula: `(100 - reviewPerformance)` gives proportional priority
- At 60% threshold: weak concepts get 40-point boost in relevance score

**Implementation:**
```typescript
const weakAreas = allCards
  .filter(c => c.reviewSchedule.easeFactor < 2.5 || correctnessRate < 0.6)
  .map(c => c.nodeId);

// In scoring: weak areas prioritized at 0.4 weight
const perfScore = (100 - signals.reviewPerformance) / 100;
```

---

### 4. Cold-Start Diversity ✅
**Decision:** Equalize all concepts when user has < 5 completed reviews

**Rationale:**
- New users need broad exposure to build knowledge graph
- Ranking by recency/frequency introduces bias too early
- Equalization encourages exploration of all topics
- Prevents "Matthew effect" where popular topics dominate early

**Implementation:**
```typescript
if (signals.completedReviews < 5) {
  // Return all concepts without ranking by score
  return concepts.slice(0, 8).map(id => ({id, score: 50})); // Equal score
} else {
  // Standard scoring applies
  return rankMoves(concepts, signals);
}
```

---

## Gray Areas Resolved

| Question | Decision | Owner |
|----------|----------|-------|
| How to link suggestions to relevant posts? | Conceptual graph via existing graph service | Planner team |
| When/how often refresh suggestions? | On podcast time (configurable) + 24h fallback | Settings + scheduler |
| What defines "weak" concept? | Review score < 60% | Scoring algorithm |
| How to handle new users? | Equalize suggestions for diversity | Cold-start mitigation |

---

## Design Guardrails

### What This Phase DOES Include
✅ Auto-generation trigger (KG ≥ 5 nodes + empty Planner)  
✅ Deterministic scoring (template-based, not AI)  
✅ Daily refresh (event-driven + time-based fallback)  
✅ Persistence (localStorage + SQLite backup)  
✅ UI display (reuse ChunkCard, SectionHeader)  
✅ Settings consolidation (Podcast Generation Time toggle)  

### What This Phase DOES NOT Include
❌ Manual suggestion tuning per-user (deferred to Phase 11)  
❌ ML/probabilistic ranking (template-based only)  
❌ Search/filtering suggestions (Phase 12 feature)  
❌ Suggestion dismissal with feedback (Phase 11)  
❌ A/B testing suggestion algorithms (Phase 13)  

---

## Downstream Artifacts

**For gsd-planner:**
- Scoring weights locked: 0.4 (performance) / 0.3 (recency) / 0.2 (engagement) / 0.1 (coverage)
- Cold-start handling: equalize for diversity
- Settings consolidation: one time picker + toggle
- Trigger conditions: KG ≥ 5 nodes + empty Planner

**For gsd-phase-researcher (if re-run):**
- Post linking: Use conceptual graph (no new research needed)
- Scheduling: Event-driven primary, time-based fallback (patterns proven)
- Persistence: localStorage + SQLite write-through (existing pattern)
- UI reuse: ChunkCard, SectionHeader, Badge (all ready)

---

## Testing Implications

**Unit tests (for scoring & triggers):**
- Weak area detection (< 60% threshold)
- Cold-start equalization (< 5 reviews)
- Deterministic scoring reproducibility
- 24h cooldown enforcement

**Integration tests:**
- Settings consolidation (podcast time + toggle sync)
- Event-driven refresh on PODCAST_COMPLETED
- Fallback timer at app startup
- localStorage → SQLite persistence

**Manual UAT:**
- Settings UX: Podcast Generation Time + toggle clarity
- Suggestion refresh: Timing accuracy, no duplicate refreshes
- Cold-start UX: New user sees equalized suggestions
- Weak area priority: Struggling concepts rank higher

---

## Notes & Follow-ups

**Deferred ideas (for future phases):**
- Per-user tuning (letting users adjust weights)
- Feedback-driven ranking (dismissing suggestions)
- A/B testing suggestion algorithms

**Open questions for planning phase:**
- Should "Suggested Moves" section always appear, or only when suggestions exist?
- Max suggestions per refresh: 5, 8, or unlimited?
- Should suggestions expire after 24h if not interacted?

