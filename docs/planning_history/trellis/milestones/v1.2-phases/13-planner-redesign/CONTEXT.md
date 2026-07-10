# Phase 13: Planner Redesign - Context

**Gathered:** 2026-03-28  
**Status:** Ready for planning  
**Investigation:** Complete (see Documents/WORKFLOW_EXPLANATION.md and Documents/PLANNER_ANALYSIS_COMPLETE.md)  
**Requirement IDs:** PLANNER-07, PLANNER-08, PLANNER-09, PLANNER-10

---

## Phase Boundary

Phase 13 is a focused redesign addressing critical bugs and UX issues in the Planner (Daily Check-in, Suggested Moves, thread/chunk confusion).

**What this phase delivers:**
1. Remove thread data model entirely (replace with sourceSignal context on chunks)
2. Fix signal extraction heuristic (confusion vs curiosity distinction)
3. Improve weak area detection (expand from 5-10% to 40-50% of concepts)
4. Clarify UI (priority badges, sourceSignal context, top 5 limit)
5. Rename sections for clarity ("Your Learning Progress", not "Continue")

**What this phase does NOT deliver:**
- New UI components (only enhanced existing components)
- New npm packages (uses existing architecture)
- New data models (adds sourceSignal field to existing Chunk interface)
- Separate Daily Check-in app (integrates with existing Planner)

---

## Implementation Decisions (LOCKED)

### Decision 1: Remove Threads Entirely

**Locked Decision:**
Threads data model is deleted. Chunks become the single source of truth for all suggestions/actions.

**Rationale:**
- Threads are inert placeholders (don't do anything)
- `saved: true` hardcoded at line 567 creates confusion
- Thread + Chunk dual structure adds complexity
- Removing threads simplifies architecture

**Implementation Impact:**
- Delete PlannerThread interface from types/index.ts
- Remove threads collection from state
- Delete "Saved Threads" UI section
- Remove thread-related service methods

---

### Decision 2: Add sourceSignal Context to Chunks

**Locked Decision:**
Every chunk carries metadata about its origin:
```typescript
sourceSignal?: 'confusion' | 'curiosity' | 'revisit' | 'connection';
sourceText?: string;  // Original check-in text
```

**Rationale:**
- Users need to know WHY chunk was created
- "From check-in: ..." transparency
- Enables better analytics and feedback loop
- Makes Daily Check-in feel integrated

**Implementation Impact:**
- Update Chunk interface in types/index.ts
- Update chunk creation in planner.service.ts
- Display sourceSignal + sourceText in UI
- Add signal badge to MoveCard (🤔 Confusion vs 🔍 Curiosity)

---

### Decision 3: Signal-Aware Chunk Type Mapping

**Locked Decision:**
Signal type determines chunk content type:

```
confusion → Chunk {
  type: 'repair',
  linkedResource: { type: 'review' }  ← Flashcards
}

curiosity → Chunk {
  type: 'deepdive',
  linkedResource: { type: 'post' }  ← POSTS ONLY
}

revisit → Chunk {
  type: 'review',
  linkedResource: { type: 'review' }  ← Flashcards
}

connection → Chunk {
  type: 'deepdive',
  linkedResource: { type: 'question' }  ← Questions
}
```

**Rationale:**
- "I'm confused about X" → needs repair (flashcards)
- "I want to learn X" → needs exploration (posts)
- Spaced rep trigger → needs review (flashcards)
- Related concepts → needs deep exploration (questions)

**Implementation Impact:**
- Fix heuristic in checkInSignalExtraction.ts
- Update chunk generation in planner.service.ts
- Each signal type has explicit content type

---

### Decision 4: Weak Area Prioritization

**Locked Decision:**
- Increase weak area boost from +15 to +30
- Expand weak area detection: 40-50% of concepts (vs current 5-10%)
- Detection signals:
  * Recent low performance (< 50% correctness)
  * Multiple failed attempts
  * User confusion signals
  * Overdue with declining ease factor

**Rationale:**
- Current +15 boost doesn't differentiate
- Too few weak areas detected (5-10%)
- Users need clear prioritization

**Implementation Impact:**
- Update suggestionScorer.service.ts (line 61: boost +15→+30)
- Enhance weak area detection logic (add more signals)
- Test scoring to ensure 40-50% weak area identification

---

### Decision 5: UI Top 5 Default + [Show All]

**Locked Decision:**
- Show top 5 suggestions by default
- Add [Show All N suggestions] button
- Don't overwhelm UI with all suggestions

**Rationale:**
- Current: all suggestions shown (overwhelming)
- Top 5 maintains focus on priorities
- [Show All] available for power users

**Implementation Impact:**
- Update PlannerScreen.tsx (slice top 5, add toggle)
- Add [Show All] button below top 5
- CSS for expanded state

---

### Decision 6: Priority Badges + Reasoning Text

**Locked Decision:**
Display priority level + reason for each suggestion:

```
🔴 WEAK AREA FOCUS (score 75-100)
   "You marked as confusing 3 days ago"

🟠 OVERDUE (score 60-75)
   "Last reviewed 2 weeks ago"

🟡 RECENTLY ACTIVE (score 45-60)
   "Good progress, build momentum"

⚪ FOR EXPLORATION (score 30-45)
   "Expands your knowledge"
```

**Rationale:**
- Users need to understand WHY suggested
- Transparency builds trust
- Helps users learn algorithm logic

**Implementation Impact:**
- Update MoveCard.tsx (add badge + reasoning)
- Update suggestionScorer.service.ts (return reasoning data)
- CSS for badge styling

---

## Canonical References

**Mandatory reads before implementation:**

### Current State Analysis
- `Documents/WORKFLOW_EXPLANATION.md` — 6-step flow showing current architecture
- `Documents/PLANNER_ANALYSIS_COMPLETE.md` — Summary, root causes, decisions

### Related Phases
- `.planning/phases/10-planner-auto-suggestions-engine/` — Move generation (Phase 10)
- `.planning/phases/11-planner-retry-milestone-cards/` — Retry logic (Phase 11)

### Key Files to Modify
- `app/src/types/index.ts` — Chunk interface, PlannerThread removal
- `app/src/services/planner.service.ts` — Thread removal, chunk generation
- `app/src/utils/checkInSignalExtraction.ts` — Heuristic fix
- `app/src/services/suggestionScorer.service.ts` — Weak area boost
- `app/src/screens/PlannerScreen.tsx` — UI cleanup, top 5 limit
- `app/src/components/MoveCard.tsx` — Badges, reasoning text

---

## Design Principles

1. **Organic Integration:** Daily Check-in → Signals → Chunks (no intermediate Thread layer)
2. **Transparency:** Every chunk shows its source and why it was suggested
3. **Simplicity:** Single data structure (Chunks), not Threads + Chunks
4. **Prioritization:** Weak areas clearly identified and ranked first
5. **Clarity:** UI sections have self-explanatory names

---

## Must-Have Truths

1. **Threads must be completely removed** — No thread references in code after Phase 13
2. **Every chunk must have sourceSignal** — Track which signal created it
3. **Weak areas must be 40-50% of concepts** — Not 5-10% like current
4. **Curiosity → Posts only** — Never flashcards or Q&As
5. **Top 5 by default** — Don't overwhelm users with all suggestions
6. **No regression** — Existing features (Continue, Dismiss, Schedule) work unchanged

---

## Testing Implications

### Unit Tests
- Signal extraction heuristic (confusion vs curiosity)
- Weak area detection (40-50% identification)
- Chunk generation by signal type
- Scoring algorithm (+30 boost)

### Integration Tests
- Daily Check-in flow (input → signal → chunk)
- Weak area prioritization (top suggestions are weak areas)
- UI rendering (top 5 display, [Show All] button)
- Navigation (each chunk type navigates to correct screen)

### Manual UAT
- Web: Check-in, suggested moves, weak area prioritization
- Mobile: Same flows on Capacitor
- Regression: All existing buttons work

---

## Effort Estimate

- **Task 1: Remove threads** — 2 hours
- **Task 2: Fix signal extraction** — 1.5 hours
- **Task 3: Update chunk generation** — 1.5 hours
- **Task 4: Boost weak areas** — 1 hour
- **Task 5: Top 5 UI limit** — 1.5 hours
- **Task 6: Priority badges** — 2 hours
- **Task 7: Rename headers** — 0.5 hours
- **Task 8: Manual testing** — 2 hours
- **Total:** 12 hours

---

## Success Criteria

✅ Daily Check-in creates actionable chunks (not inert threads)  
✅ Curiosity signals generate post chunks; confusion generates flashcard chunks  
✅ Weak areas effectively prioritized (40-50% of concepts, +30 boost)  
✅ Top 5 suggestions shown by default, [Show All] available  
✅ Each chunk displays "From check-in: ..." context  
✅ Priority badges show why chunk was suggested  
✅ UI renamed to "Your Learning Progress" for clarity  
✅ All existing features work without regression  

---

_Phase 13 Context | Locked Decisions | 2026-03-28_
