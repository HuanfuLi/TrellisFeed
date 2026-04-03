# Planner Design Brainstorm: Complete Analysis & Recommendations

**Date:** 2026-03-28  
**Status:** Investigation Complete, Ready for Implementation  
**Output Files:**
- `/Users/Code/EchoLearn/Documents/WORKFLOW_EXPLANATION.md` — Detailed workflow documentation
- `/Users/huanfuli/.copilot/session-state/*/files/PLANNER_REDESIGN_PLAN.md` — Implementation plan

---

## 🎯 Executive Summary

You identified three critical issues with the Planner that make it non-functional:

1. **Daily Check-in creates inert threads** — User submits "I want to learn RNN", thread appears with [Save] [Delete] buttons that do nothing
2. **Suggested Moves doesn't prioritize** — All concepts shown equally (50-80%), no real recommendation
3. **UI is confusing** — "Continue" and "Saved Threads" labels don't explain what they are

**Investigation confirmed all three are valid.** Root causes identified and fixes proposed.

---

## 🔴 Root Causes Identified

### Issue 1: Auto-Saved Threads (Line 567 Bug)
```
Current code: saved: true hardcoded on thread creation
Problem: Thread appears already saved, [Save] button does nothing
Result: User confusion + broken workflow
```

**Fix:** Remove thread data model entirely (threads are inert placeholders)

### Issue 2: Wrong Signal → Chunk Mapping
```
Current: "I want to learn RNN" → confusion signal → repair chunk
Problem: Curiosity ≠ Confusion (different intents)
Result: Wrong content type for user (flashcards instead of posts)
```

**Fix:** Signal-aware chunk creation:
- Confusion → Review chunks (flashcards to repair understanding)
- Curiosity → Deepdive chunks (posts for exploration)
- Revisit → Review chunks (spaced repetition)
- Connection → Deepdive chunks (questions for exploration)

### Issue 3: Weak Area Detection Broken
```
Current: Weak area boost only +15, detects 5-10% of concepts
Problem: Most unreviewed concepts scored equally
Result: No prioritization, all suggestions look the same
```

**Fix:** Increase boost to +30, expand detection:
- Recent low performance (< 50% correct)
- Multiple failed attempts
- User confusion signals
- Overdue with declining ease factor

---

## ✨ Architecture Changes Proposed

### Current (Broken)
```
Daily Check-in
    ↓
Signal Extraction (confusion, curiosity, revisit, connection)
    ↓
Threads (inert placeholders) + Chunks (actionable tasks)
    ↓
PlannerScreen shows both sections
    ↓
User: "What is this thread? Why two sections?"
```

### Proposed (Fixed)
```
Daily Check-in
    ↓
Signal Extraction
    ↓
Chunks ONLY (with sourceSignal context: which signal created it)
    ↓
PlannerScreen shows one "Your Learning Progress" section
    ↓
User: "This chunk came from my check-in, and I know why"
```

**New Chunk Fields:**
```typescript
sourceSignal?: 'confusion' | 'curiosity' | 'revisit' | 'connection';
sourceText?: string;  // Original check-in text
```

---

## 📊 Your Locked Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Remove threads? | **YES** | Threads are inert, add complexity |
| Curiosity content type | **Posts only** | Exploration via articles, not flashcards |
| Rename "Continue"? | **YES → "Your Learning Progress"** | Clearer purpose |
| Delete "Saved Threads"? | **YES** | Replaced by sourceSignal context |
| Weak area boost | **+30** | Moderate priority (was +15) |
| Suggestions to show | **Top 5 default + [Show All]** | Less overwhelming |

---

## 🏗️ 12-Hour Implementation Plan

### Phase 13A: Fix Critical Issues (4 hours)

**Task 1A: Remove Thread Data Model** (2h)
- Delete PlannerThread interface
- Remove thread collection from state
- Remove "Saved Threads" UI section
- Files: types/index.ts, planner.service.ts, PlannerScreen.tsx

**Task 1B: Fix Signal Extraction** (1.5h)
- Fix heuristic: "want to learn" → curiosity (not confusion)
- Add more precise confusion detection
- File: checkInSignalExtraction.ts

**Task 1C: Update Chunk Generation** (1.5h)
- Signal-aware chunk types
- Add sourceSignal + sourceText fields
- File: planner.service.ts

### Phase 13B: Improve UX (4 hours)

**Task 2A: Boost Weak Areas** (1h)
- Increase boost from +15 to +30
- Expand weak area detection
- File: suggestionScorer.service.ts

**Task 2B: Top 5 Limit + [Show All]** (1.5h)
- Show only top 5 by default
- Add button to expand all
- File: PlannerScreen.tsx

**Task 2C: Priority Badges + Reasoning** (2h)
- Add priority badges (🔴 🟠 🟡 ⚪)
- Add reasoning text for each chunk
- Files: MoveCard.tsx, suggestionScorer.service.ts

**Task 2D: Rename Headers** (0.5h)
- "Continue" → "Your Learning Progress"
- "Suggested Moves" → "Recommended Study Plan"
- File: PlannerScreen.tsx

### Phase 13C: Testing (2 hours)

**Task 3A: Manual Validation**
- Test all signal types (confusion, curiosity, revisit, connection)
- Verify chunk routing (posts, flashcards, questions)
- Test weak area prioritization
- Validate UI display

---

## 📋 Expected UI After Redesign

### Before (Current Broken)
```
SECTION 1: Continue
  (empty or minimal)

SECTION 2: Saved Threads
  🔍 RNN
  [Save] [Delete]
  ← Confusing: what does this do?

SECTION 3: Suggested Moves
  Review: RNN                    82 %
  Review: Promises               78 %
  Review: Event Loop             75 %
  ... (all concepts equally ranked)
  [Start] [Schedule] [Dismiss]
```

### After (Fixed)
```
SECTION 1: Your Learning Progress

🔴 WEAK AREA FOCUS: Clarify Closures
  From check-in: "I'm confused about closures"
  Latest review: 35% correct
  Priority: 82/100
  [Start Review] [Schedule] [Dismiss]

🟡 EXPLORE: Blockchain Fundamentals
  From check-in: "I want to learn blockchain"
  Estimated: 10 minutes (posts)
  Priority: 65/100
  [Start Deep Dive] [Schedule] [Dismiss]

🟠 OVERDUE: Promise Resolution
  Last reviewed: 2 weeks ago
  Ease declining
  Priority: 60/100
  [Resume Review] [Schedule] [Dismiss]

[Show All 8+ Suggestions]
```

---

## 🎯 Data Migration Strategy

For users with existing data:

```javascript
// OLD
localStorage['planner:threads'] = [
  { id: 'thread-xyz', title: 'RNN', saved: true, ... }
]
localStorage['planner:chunks'] = [
  { id: 'chunk-abc', type: 'repair', ... }
]

// NEW
localStorage['planner:chunks'] = [
  {
    id: 'chunk-abc',
    type: 'repair',
    sourceSignal: 'confusion',        ← NEW
    sourceText: 'I want to learn RNN' ← NEW
    // ... rest of chunk data
  }
]
// threads collection DELETED
```

---

## ✅ Benefits of This Redesign

### For Users
1. **Clarity** — One clear section "Your Learning Progress" (not threads + moves)
2. **Context** — Each chunk shows why it was suggested ("From check-in...")
3. **Actionability** — Everything is something they can DO (not inert)
4. **Prioritization** — Clear priority badges (weak area, overdue, etc.)
5. **Control** — Top 5 by default, can expand to see all

### For Developers
1. **Simplicity** — Single data structure (chunks only)
2. **Maintainability** — No thread/chunk confusion in codebase
3. **Type Safety** — sourceSignal field makes intent explicit
4. **Testing** — Simpler data model = easier tests
5. **Future Features** — Can add more signal types without complexity

---

## 🚀 Implementation Readiness

- ✅ Root causes identified
- ✅ Proposed architecture documented
- ✅ User decisions locked
- ✅ Task breakdown completed
- ✅ Effort estimated (12 hours)
- ✅ Data migration strategy planned
- ✅ UI mockups created
- ✅ No new dependencies needed

**Ready to create Phase 13 or implement as gap-closure?**

---

## 📁 Reference Documents

For detailed information, see:

1. **WORKFLOW_EXPLANATION.md**
   - Detailed 6-step flow with line numbers
   - Current problems explained
   - Proposed solution architecture
   - Data migration path
   - **Location:** `/Users/Code/EchoLearn/Documents/WORKFLOW_EXPLANATION.md`

2. **PLANNER_REDESIGN_PLAN.md**
   - Complete implementation tasks
   - Code examples
   - Test cases
   - **Location:** Session workspace

3. **Investigation Summary**
   - Root cause analysis
   - Files to modify
   - Priority levels
   - **Location:** Session workspace

---

## Next Steps

1. ✅ Review investigation findings (complete)
2. ✅ Understand current architecture (WORKFLOW_EXPLANATION.md)
3. ⏳ Decide: Create Phase 13 or gap-closure?
4. ⏳ Implement tasks 1A-3A in order
5. ⏳ Test before merging

**Are you ready to proceed with Phase 13 implementation?**

---

_Analysis completed: 2026-03-28 | Ready for implementation_
