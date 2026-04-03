# Daily Check-in to Planner Integration: Workflow Explanation

**Date:** 2026-03-28

---

## Current Architecture (How It Works Now)

### Overview
The Daily Check-in is already integrated with the Planner, but the integration is broken and confusing because it uses two separate data structures: **Threads** and **Chunks**.

### Data Structures

**Thread** = Topic container (bookmark)
- Created when user enters a check-in about a topic
- Example: "RNN" thread for "I want to learn RNN"
- Has properties: id, title, keywords, saved (T/F), lastActivityAt
- **Problem:** Threads are inert - they don't DO anything
- **Current:** `saved: true` hardcoded on creation (bug)

**Chunk** = Study action (actionable task)
- Created from signals extracted from check-in text
- Example: "Study RNN" chunk with duration estimate
- Has properties: id, type, goal, linkedResource, status
- **Current:** Appears in "Suggested Moves" section
- **Current:** User can [Start] [Dismiss] [Schedule]

### The Full Flow

```
STEP 1: User Submits Check-in
────────────────────────────
Screen: DailyCheckInScreen
Input: "I want to learn RNN"
Button: [Submit]

        ↓

STEP 2: Signal Extraction
────────────────────────
Service: checkInSignalExtraction

Process:
  1. Try LLM: EXTRACT_SIGNALS_PROMPT
     "Extract what user wants to learn..."
  
  2. If LLM fails or offline:
     Fall back to heuristicExtractSignals()
  
Text: "I want to learn RNN"
        ↓
Heuristic looks for keywords:
  • "want to learn" → confusion signal (WRONG!)
  • "want to learn" → curiosity signal (correct)
  • "struggling" → confusion (correct)
  • "confused" → confusion (correct)

Result CheckInSignals:
  {
    confusion: ["RNN"],    ← Should not be here!
    curiosity: ["RNN"],    ← Correct signal
    connections: [],
    revisitIntent: [],
    confidence: []
  }

        ↓

STEP 3: Thread Creation (One Thread per Signal)
─────────────────────────────────────────────
Service: plannerService.processCheckIn()

For EACH signal:

  FOR confusion["RNN"]:
    Step A: Look for existing thread
      findMatchingThread("RNN") → NOT FOUND
    
    Step B: Create new thread
      Thread {
        id: "thread-xyz",
        title: "RNN",
        keywords: ["rnn"],
        linkedConceptIds: [concepts matching "RNN"],
        saved: true  ← LINE 567: BUG! This is hardcoded
        lastActivityAt: now
      }
    
    Step C: Store in localStorage
    
    Step D: Add to tracking
      affectedThreadIds = ["thread-xyz"]

  FOR curiosity["RNN"]:
    Step A: Look for existing thread
      findMatchingThread("RNN") → FOUND (thread-xyz from above)
    
    Step B: Update existing thread
      Update lastActivityAt = now
      (Don't create duplicate)
    
    Step C: Add to tracking
      affectedThreadIds = ["thread-xyz"] (same thread)

        ↓

STEP 4: Chunk Creation (One Chunk per Signal)
───────────────────────────────────────────
Service: plannerService.processCheckIn()

For EACH signal:

  FOR confusion["RNN"]:
    Create chunk:
    {
      id: "chunk-abc",
      type: 'repair',  ← Repair chunks are for confusion
      goal: 'Clarify: RNN',
      linkedResource: { 
        type: 'review',  ← Points to ReviewScreen (flashcards)
        id: 'fc-123'
      },
      status: 'suggested',
      source: 'check-in',
      createdAt: now,
      estimatedMinutes: 10,
      conceptId: 'concept-RNN'
    }
    Store in localStorage
    generatedChunkIds = ["chunk-abc"]

  FOR curiosity["RNN"]:
    NO chunk created  ← This is the problem!
    (Currently curiosity signals don't generate chunks)
    User later sees inert thread with [Save] [Delete]

        ↓

STEP 5: Persist & Emit Event
──────────────────────────
Service: plannerService.processCheckIn()

Save to localStorage:
  • localStorage['planner:threads'] = [thread-xyz, ...]
  • localStorage['planner:chunks'] = [chunk-abc, ...]
  • localStorage['planner:checkIns'] = [check-in history, ...]

Emit event: PLANNER_UPDATED
  → Triggers PlannerScreen to refresh
  → Calls refresh() which reloads all data

Return: LearningCheckIn object
  {
    checkInId: "checkin-123",
    text: "I want to learn RNN",
    signals: CheckInSignals,
    affectedThreadIds: ["thread-xyz"],
    generatedChunkIds: ["chunk-abc"],
    timestamp: now
  }

        ↓

STEP 6: UI Display on PlannerScreen
───────────────────────────────────
Hook: usePlanner()

Load from localStorage:
  • Load all chunks
  • Load all threads
  • Sort by status, date, score

Render sections:

  SECTION 1: "Continue" (in-progress chunks)
    Shows chunks with status = 'active'
    Example: None (all are 'suggested')
    Buttons: [Pause] [Delete]

  SECTION 2: "Saved Threads" (threads with saved: true)
    Shows: 🔍 RNN
    From check-in: "I want to learn RNN"
    Buttons: [Save] [Delete]
    
    Problem: Thread is already saved!
    - Clicking [Save] → Does nothing (already saved: true)
    - Clicking [Delete] → Deletes thread
    - Clicking on thread itself → Nothing happens
    
    User feels confused: "What does this do?"

  SECTION 3: "Suggested Moves" (chunks with status = 'suggested')
    Shows: 
      Review: RNN                    82 %
      [Start] [Schedule] [Dismiss]
    
    This works fine!
    - [Start] → Navigates to ReviewScreen
    - [Schedule] → Queues for later
    - [Dismiss] → Marks as skipped

        ↓

STEP 7: User Action
──────────────────
User sees two things:
  1. Inert thread card [Save] [Delete] (confusing)
  2. Actionable chunk card [Start] [Schedule] [Dismiss] (good)

User experiences:
  1. "What is this thread? It doesn't do anything"
  2. "OK, I can click Start on the chunk"
  3. Result: Confusion about thread's purpose
```

---

## The Problems This Causes

### Problem 1: Two Data Structures = Two Concepts
Users see:
- "Saved Threads" section
- "Suggested Moves" section

But they don't understand:
- What's the difference?
- Why are both here?
- Why does thread do nothing?

### Problem 2: Auto-Saved Threads
- Thread created with `saved: true` immediately
- [Save] button does nothing (already saved)
- [Delete] button removes it
- User thinks [Save] is broken

### Problem 3: Wrong Signal → Chunk Mapping
- "I want to learn RNN" should generate POST chunk
- Currently generates REPAIR chunk (wrong!)
- Repair chunks are for confusion, not curiosity
- User gets wrong content type

### Problem 4: Curiosity Signals Don't Generate Chunks
- Curiosity signals create thread only
- No chunk to act on
- User sees inert thread, no action to take
- Makes Daily Check-in feel pointless

### Problem 5: No Context About Why Chunk Was Created
- User sees chunk "Review: RNN"
- No indication: "From check-in", "You marked as confusing", etc.
- User doesn't understand the source/reason

---

## Proposed Solution: Remove Threads, Add Signal Context

### New Architecture

Instead of:
- Thread (inert placeholder) + Chunk (actionable task)

Use:
- Chunk ONLY, with `sourceSignal` metadata

### New Chunk Structure

```typescript
interface Chunk {
  id: string;
  type: 'repair' | 'review' | 'deepdive' | 'practice';
  concept: string;
  goal: string;
  linkedResource: { type: 'review' | 'post' | 'question', id: string };
  status: 'suggested' | 'active' | 'completed' | 'skipped';
  
  // NEW: Signal source context
  sourceSignal?: 'confusion' | 'curiosity' | 'revisit' | 'connection';
  sourceText?: string;  // Original check-in text that created this
  
  estimatedMinutes: number;
  createdAt: Date;
  completedAt?: Date;
  priority: 'high' | 'medium' | 'low';
}
```

### New Signal → Chunk Mapping

```
confusion → Chunk {
  type: 'repair',
  sourceSignal: 'confusion',
  linkedResource: { type: 'review' },  ← Flashcards
  priority: 'high',
  goal: 'Clarify: {concept}',
  sourceText: 'I\'m confused about closures'
}

curiosity → Chunk {
  type: 'deepdive',
  sourceSignal: 'curiosity',
  linkedResource: { type: 'post' },  ← POSTS ONLY
  priority: 'medium',
  goal: 'Explore: {concept} via posts',
  sourceText: 'I want to learn blockchain'
}

revisit → Chunk {
  type: 'review',
  sourceSignal: 'revisit',
  linkedResource: { type: 'review' },  ← Flashcards
  priority: 'medium',
  goal: 'Revisit: {concept} (spaced rep)',
  sourceText: null  ← Automatic trigger, not from check-in
}

connection → Chunk {
  type: 'deepdive',
  sourceSignal: 'connection',
  linkedResource: { type: 'question' },  ← Questions
  priority: 'low',
  goal: 'Explore: {concept} via questions',
  sourceText: 'How does X relate to Y?'
}
```

### New UI Display

```
SECTION: "Your Learning Progress"

🔴 WEAK AREA FOCUS: Clarify Closures
  From check-in: "I'm confused about closures"
  Signal: You marked as confusing
  Latest review: 35% correct
  Priority: 82/100
  [Start Review] [Schedule] [Dismiss]

🟡 EXPLORE: Blockchain Fundamentals
  From check-in: "I want to learn blockchain"
  Signal: You expressed interest
  Estimated: 10 minutes (posts)
  Priority: 65/100
  [Start Deep Dive] [Schedule] [Dismiss]

🟠 OVERDUE: Promise Resolution
  Signal: Spaced repetition due
  Last reviewed: 2 weeks ago
  Ease factor: Declining
  Priority: 60/100
  [Resume Review] [Schedule] [Dismiss]
```

### Benefits of This Approach

1. **Single Data Structure** (Chunks only)
   - Simpler code
   - Easier to understand
   - No thread/chunk confusion

2. **Clear Signal Context** (sourceSignal + sourceText)
   - User knows WHY chunk was created
   - "From check-in: ..." shows the original intent
   - Transparency about source

3. **Organic Integration**
   - Daily Check-in → Signals → Chunks
   - No intermediate Thread layer
   - Direct flow from input to action

4. **Signal-Appropriate Content**
   - Confusion → Flashcards (repair)
   - Curiosity → Posts (exploration)
   - Revisit → Flashcards (spaced rep)
   - Connection → Questions (exploration)

5. **Clear UI**
   - One section: "Your Learning Progress"
   - No confusion about "Saved Threads"
   - Every chunk is actionable

---

## Migration Path

### Current State
```
localStorage['planner:threads'] = [...]
localStorage['planner:chunks'] = [...]
```

### After Redesign
```
localStorage['planner:chunks'] = [
  {
    ...existing chunk data...,
    sourceSignal: 'confusion' | 'curiosity' | null,
    sourceText: 'original check-in text...'
  }
]
// threads collection DELETED
```

### Data Migration
For each existing thread:
- If threads[i].saved == true
- Convert to chunk with sourceSignal = (inferred from history)

For each existing chunk:
- Add sourceSignal + sourceText fields
- Remove thread references

---

## Summary

### Current Integration (Broken)
```
Daily Check-in
    ↓
Signals: confusion, curiosity, revisit, connection
    ↓
Threads (inert placeholders) + Chunks (actionable)
    ↓
PlannerScreen displays both
    ↓
User confusion: "What is this thread?"
```

### Proposed Integration (Fixed)
```
Daily Check-in
    ↓
Signals: confusion, curiosity, revisit, connection
    ↓
Chunks (with sourceSignal context)
    ↓
PlannerScreen displays one list: "Your Learning Progress"
    ↓
User clarity: "This chunk came from my check-in, and I know why"
```

This makes Daily Check-in feel more organic and integrated because:
1. ✅ Direct flow: input → signal → chunk (no intermediate layer)
2. ✅ Clear context: every chunk shows its source and signal
3. ✅ Actionable: every chunk is something user can do immediately
4. ✅ Organized: one section, clear priority levels
5. ✅ Simplified: single data structure, not threads + chunks

---

## Key Takeaways

### Root Causes of Confusion
1. **Threads are inert** — created but don't do anything
2. **Auto-saved** — `saved: true` hardcoded, breaking UX
3. **Wrong signals** — "want to learn" treated as confusion
4. **No context** — chunks don't show why they were created
5. **Two sections** — Threads + Chunks confuse users

### Proposed Fixes
1. **Remove threads entirely** — simplify to chunks only
2. **Add sourceSignal** — chunk knows its origin (confusion/curiosity/etc)
3. **Fix signal extraction** — correct heuristic logic
4. **Signal-aware content** — curiosity→posts, confusion→flashcards
5. **One clear UI** — "Your Learning Progress" section

### Implementation Effort
- **Phase 13A:** Fix critical issues (4 hours)
- **Phase 13B:** Improve UX (4 hours)
- **Phase 13C:** Testing (2 hours)
- **Total: 12 hours**

---

_Document created: 2026-03-28 | Explains current architecture, problems, and proposed solution_
