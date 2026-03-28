---
phase: 13-planner-redesign
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/types/index.ts
  - app/src/types/planner.ts
  - app/src/services/planner.service.ts
  - app/src/state/usePlanner.ts
  - app/src/screens/PlannerScreen.tsx
  - app/src/components/MoveCard.tsx
autonomous: false
requirements: [PLANNER-07, PLANNER-08, PLANNER-09, PLANNER-10]
user_setup: []

must_haves:
  truths:
    - "Daily Check-in creates actionable chunks, not inert threads"
    - "Confusion signals generate repair chunks (flashcards); curiosity signals generate deepdive chunks (posts only)"
    - "Weak areas represent 40-50% of concepts with +30 priority boost"
    - "UI shows top 5 suggestions by default with [Show All] button"
    - "Each chunk displays source context (From check-in: ...)"
    - "Priority badges (🔴 🟠 🟡 ⚪) explain why each chunk was suggested"
    - "Section renamed to 'Your Learning Progress' for clarity"
    - "No regressions: Continue, Dismiss, Schedule buttons work unchanged"
  artifacts:
    - path: "app/src/types/index.ts"
      provides: "PlannerChunk interface with sourceSignal, sourceText, priorityReason; PlannerThread removed"
      exports: ["PlannerChunk", "CheckInSignals", "LearningCheckIn"]
    - path: "app/src/services/planner.service.ts"
      provides: "Thread removal, signal-aware chunk generation, sourceSignal assignment"
      exports: ["processCheckIn", "loadChunks", "toggleChunkStatus"]
    - path: "app/src/screens/PlannerScreen.tsx"
      provides: "Top 5 limit with [Show All] toggle, renamed header, priority badges"
      exports: ["PlannerScreen component"]
    - path: "app/src/components/MoveCard.tsx"
      provides: "Priority badges + reasoning text display"
      exports: ["MoveCard component"]
    - path: "app/src/state/usePlanner.ts"
      provides: "Planner state hook without thread methods"
      exports: ["usePlanner hook"]
  key_links:
    - from: "Daily Check-in submission"
      to: "app/src/services/planner.service.ts → processCheckIn()"
      via: "checkInSignals extraction"
      pattern: "processCheckIn(text) → signals → chunks with sourceSignal"
    - from: "Chunk creation"
      to: "Signal type determination"
      via: "sourceSignal field (confusion|curiosity|revisit|connection)"
      pattern: "sourceSignal==='confusion' → type='repair', linkedResource.type='review'"
    - from: "Weak area boost"
      to: "Suggestion scoring"
      via: "+30 boost for weak areas in scorer service"
      pattern: "weakAreaIds.includes(conceptId) → score + 30"
    - from: "PlannerScreen state"
      to: "Top 5 display"
      via: "useState(showAllExpanded) toggle"
      pattern: "showAllExpanded ? allSuggestions : allSuggestions.slice(0,5)"
    - from: "MoveCard rendering"
      to: "Priority badge display"
      via: "priorityBadge prop from scoring service"
      pattern: "score >= 75 ? '🔴' : score >= 60 ? '🟠' : score >= 45 ? '🟡' : '⚪'"

---

<objective>
Fix the Daily Check-in workflow to eliminate inert threads, improve weak area prioritization, and clarify Planner UX through signal context and priority badges. This plan addresses 4 critical user-facing bugs that break the Planner's usability and the integration between Daily Check-in and suggested moves.

**What this phase delivers:**
1. Removes thread data model entirely (Threads interface and all references deleted)
2. Adds sourceSignal + sourceText to chunks to track origin (confusion/curiosity/revisit/connection)
3. Implements signal-aware chunk type mapping (confusion→flashcards, curiosity→posts, etc.)
4. Increases weak area boost from +15 to +30 and expands detection to 40-50% of concepts
5. Limits UI to top 5 suggestions by default with [Show All] button
6. Adds priority badges (🔴 🟠 🟡 ⚪) and reasoning text explaining why chunks were suggested
7. Renames "Continue" and "Saved Threads" to "Your Learning Progress" for clarity

**Why this matters:**
- Current threads are inert placeholders (created with `saved: true` hardcoded at line 567)
- Users are confused: "What does this thread do? Why are there two sections?"
- Signal extraction confuses curiosity with confusion (wrong content types suggested)
- Weak areas aren't prioritized (all concepts shown equally)
- UI lacks transparency about why chunks were suggested

**Effort: 8-12 hours** across 1 plan, 5 tasks

**Output artifacts:**
- Updated Chunk interface with sourceSignal, sourceText, priorityReason fields
- Removed PlannerThread interface and all references
- Fixed signal extraction heuristic
- Enhanced weak area detection (40-50% of concepts)
- Updated UI with top 5 limit, priority badges, renamed sections
- No breaking changes to existing chunk actions (Continue, Dismiss, Schedule)
- Backward compatible: existing chunks get sourceSignal=null and display cleanly
</objective>

<execution_context>
@~/.copilot/get-shit-done/workflows/execute-plan.md
@~/.copilot/get-shit-done/templates/summary.md
</execution_context>

<context>
## Current Architecture (What Exists Today)

The Daily Check-in currently creates TWO data structures for every check-in:
1. **PlannerThread** — Topic container (inert placeholder, hardcoded `saved: true`)
2. **PlannerChunk** — Study action (actionable task, appears in Suggested Moves)

**Problem:** Users see both "Saved Threads" and "Suggested Moves" sections, leading to confusion about the dual structure.

### Key Files Today
- `app/src/types/index.ts` — PlannerThread, PlannerChunk, CheckInSignals interfaces
- `app/src/services/planner.service.ts` — processCheckIn() creates threads & chunks (line 567: bug!)
- `app/src/screens/PlannerScreen.tsx` — Renders both "Continue" and "Saved Threads" sections
- `app/src/state/usePlanner.ts` — Hook manages threads + chunks

### Signal Extraction (Current/Broken)
- `checkInSignalExtraction()` heuristic marks "want to learn" as **confusion** (wrong!)
- Should be **curiosity** (exploration intent)
- Result: Wrong chunk type (repair/flashcards instead of deepdive/posts)

### Weak Area Scoring (Current/Weak)
- Boost only +15 in scoring algorithm
- Detects only 5-10% of concepts as weak areas
- Result: All suggestions look equally important

### UI Issues (Current/Confusing)
- Section labeled "Continue" unclear (in-progress chunks)
- Section labeled "Saved Threads" misleading (inert threads with broken [Save] button)
- No context shown: "From check-in: ...", "Why recommended?", etc.
- All suggestions shown (can be 20-30 items, overwhelming)

## Investigation Already Complete

See:
- `Documents/WORKFLOW_EXPLANATION.md` — 6-step flow with line numbers and root causes
- `Documents/PLANNER_ANALYSIS_COMPLETE.md` — Summary and fixes locked with user
- `.planning/phases/13-planner-redesign/CONTEXT.md` — All decisions locked

## Architecture After Phase 13

```
Daily Check-in (input: "I'm confused about closures")
    ↓
Signal Extraction (identifies: confusion signal)
    ↓
Chunk Creation ONLY (no threads):
    {
      id: "chunk-123",
      type: "repair",
      goal: "Clarify: Closures",
      linkedResource: { type: "review" },  ← Flashcards
      sourceSignal: "confusion",           ← NEW: which signal created this
      sourceText: "I'm confused about closures",  ← NEW: original context
      priorityReason: "You marked as confusing",  ← NEW: why recommended
      priority: 82
    }
    ↓
PlannerScreen renders one "Your Learning Progress" section
    ├─ Shows top 5 by default
    ├─ [Show All Suggestions] button to expand
    ├─ Priority badges (🔴 WEAK AREA)
    └─ "From check-in: I'm confused about closures" displayed
```

## Data Migration Strategy

### For New Chunks
Every chunk created in Phase 13+ will have:
```typescript
sourceSignal?: 'confusion' | 'curiosity' | 'revisit' | 'connection'
sourceText?: string;  // Original check-in text
priorityReason?: string;  // "Weak area", "Spaced rep due", etc.
```

### For Existing Chunks (Backward Compatibility)
- Chunks without sourceSignal will display cleanly (no crash)
- UI will show blank context "From check-in:" if sourceText is missing
- Scoring still works (just without signal-aware boost)

### Threads Removed
- Old threads in localStorage are abandoned (not migrated)
- No data loss; they were inert anyway
- Users won't see them on next app load

## Signal → Chunk Type Mapping (LOCKED)

Per user decision (see CONTEXT.md, Decision 3):

| Signal Type | Chunk Type | Content Type | Example |
|------------|-----------|--------------|---------|
| **confusion** | 'repair' | linkedResource.type: 'review' | "I'm confused about closures" → Flashcards |
| **curiosity** | 'deepdive' | linkedResource.type: 'post' | "I want to learn blockchain" → Posts |
| **revisit** | 'review' | linkedResource.type: 'review' | Auto spaced-rep trigger → Flashcards |
| **connection** | 'deepdive' | linkedResource.type: 'question' | "How does X relate to Y?" → Questions |

Note: Curiosity ALWAYS maps to posts, never to other types.

## Weak Area Detection Rules (LOCKED)

Per user decision (see CONTEXT.md, Decision 4):

A concept is a "weak area" if ANY of:
1. **Recent low performance:** Latest review correctness < 50%
2. **Multiple failed attempts:** ≥2 consecutive reviews with correctness < 60%
3. **User confusion signal:** User marked as confusing in last 7 days
4. **Overdue with declining ease:** Review overdue + easeFactor < 1.8

**Target:** 40-50% of concepts identified as weak (vs. current 5-10%)
**Boost:** +30 priority points (vs. current +15)

## Priority Badge Mapping (LOCKED)

Score → Badge + Reason (per Decision 6):

```
🔴 WEAK AREA FOCUS (score 75-100)
   "You marked as confusing 3 days ago"
   or "Recent performance: 35% correct"

🟠 OVERDUE (score 60-75)
   "Last reviewed 2 weeks ago"
   or "Spaced repetition due"

🟡 RECENTLY ACTIVE (score 45-60)
   "Good progress, build momentum"
   or "3 reviews this week"

⚪ FOR EXPLORATION (score 30-45)
   "Expands your knowledge"
   or "Part of your learning path"
```

---

## Task Breakdown

**Wave 1 (This Plan):** All 5 tasks run in sequence (dependency chain)

1. **Task 1 (2h):** Remove thread data model
2. **Task 2 (1.5h):** Fix signal extraction heuristic
3. **Task 3 (1.5h):** Update chunk generation with sourceSignal
4. **Task 4 (1h):** Enhance weak area detection & boost
5. **Task 5 (3h):** Update UI (top 5, badges, renamed sections)

Checkpoint: Manual UAT of full flow (1h, included in execution)

---

</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove Thread Data Model (2h)</name>
  <files>
    app/src/types/index.ts
    app/src/services/planner.service.ts
    app/src/state/usePlanner.ts
    app/src/screens/PlannerScreen.tsx
  </files>
  <action>
## Remove PlannerThread Interface

**In `app/src/types/index.ts`:**

1. Find and DELETE the entire PlannerThread interface (search for "interface PlannerThread")
   - Approximately 15-20 lines
   - Includes: id, title, description, keywords, linkedConceptIds, saved, lastActivityAt
   
2. In the PlannerData interface, REMOVE:
   ```typescript
   threads: PlannerThread[];
   ```
   - Keep only: chunks, checkIns

3. In CheckInSignals interface, REMOVE (if present):
   ```typescript
   affectedThreadIds?: string[];
   ```

4. In LearningCheckIn interface, REMOVE (if present):
   ```typescript
   affectedThreadIds?: string[];
   ```

5. Update PlannerChunk to REMOVE (these are now obsolete):
   ```typescript
   threadId?: string;
   ```

## Remove Thread Persistence

**In `app/src/services/planner.service.ts`:**

1. DELETE these constants (around line 14-16):
   ```typescript
   const THREADS_KEY = 'echolearn_planner_threads';
   ```

2. DELETE these helper functions:
   - `persistThreadToSQLite()` (line ~53)
   - `deleteThreadFromSQLite()` (line ~59)

3. DELETE thread-related code from `hydratePlannerFromSQLite()`:
   - Remove thread row loading
   - Remove thread merge into localStorage
   - Leave chunks and checkIns only

4. DELETE these service methods entirely:
   - `loadThreads()` — searches for "export function loadThreads"
   - `saveThread()` — creates/updates thread
   - `deleteThread()` — removes thread
   - `toggleThreadSaved()` — toggles thread.saved flag
   - `findMatchingThread()` — finds thread by keywords
   - Any other thread-related methods

5. KEEP these methods (they handle chunks, not threads):
   - `loadChunks()`
   - `saveChunk()` / `upsertChunk()`
   - `deleteChunk()`
   - `processCheckIn()`
   - ALL chunk-related methods

6. In `processCheckIn()` function (core method):
   - Remove the "Create threads for each signal" loop (STEP 3 in workflow)
   - Keep only the "Create chunks for each signal" loop (STEP 4)
   - Do NOT create any thread objects
   - Still extract signals, just skip thread creation

## Remove Thread from State Hook

**In `app/src/state/usePlanner.ts`:**

1. DELETE these methods from the usePlanner hook:
   - `toggleThreadSaved(threadId)` implementation
   - `deleteThread(threadId)` implementation

2. REMOVE from returned hook object:
   ```typescript
   toggleThreadSaved,
   deleteThread,
   ```

3. KEEP all chunk-related methods:
   - `chunks`, `chunksByStatus`, `toggleChunkStatus`, `skipChunk`

4. If there's a `threads` state variable, DELETE it:
   - Search for `useState(...)` with threads
   - Remove the entire state line

5. Keep all event listeners that handle PLANNER_UPDATED events (still needed for chunks)

## Remove Thread UI Components

**In `app/src/screens/PlannerScreen.tsx`:**

1. Find the "Saved Threads" section rendering:
   - Typically renders as a section with ThreadCard components
   - Search for "Saved Threads" or "threads.map" or ThreadCard usage

2. DELETE the entire "Saved Threads" section:
   - Remove the section header
   - Remove the threads.map() or threads.filter() loop
   - Remove ThreadCard component usage
   - Remove any useCallback handlers for thread actions

3. KEEP the "Continue" section (in-progress chunks):
   - This will be renamed to "Your Learning Progress" in Task 5

4. KEEP the "Suggested Moves" section:
   - This will be renamed and enhanced in Task 5

5. Remove any imports related to threads:
   - Search for "PlannerThread" imports
   - Remove those import lines

## Verification Before Moving On

Run these checks:
- `grep -r "PlannerThread" /Users/Code/EchoLearn/app/src/` should return 0 results
- `grep -r "toggleThreadSaved\|deleteThread" /Users/Code/EchoLearn/app/src/screens/` should return 0 results
- `grep -r "Saved Threads" /Users/Code/EchoLearn/app/src/screens/` should return 0 results
- No TypeScript compilation errors for removed types

## Code Example (What's Being Changed)

**BEFORE:**
```typescript
// types/index.ts
interface PlannerThread {
  id: string;
  title: string;
  saved: true;  ← BUG: hardcoded
}

// planner.service.ts (line 567)
const thread: PlannerThread = {
  id: generateId(),
  title: concept,
  saved: true,  ← LINE 567 BUG
};
saveThread(thread);

// PlannerScreen.tsx
<Section title="Saved Threads">
  {threads.map(t => <ThreadCard thread={t} />)}
</Section>
```

**AFTER:**
```typescript
// types/index.ts
// PlannerThread interface DELETED

// planner.service.ts (line ~567 area)
// Thread creation loop REMOVED
// Only chunk creation remains
const chunk: PlannerChunk = {
  id: generateId(),
  type: determineChunkType(sourceSignal),
  sourceSignal,
  sourceText,
  // ... chunk fields
};
saveChunk(chunk);

// PlannerScreen.tsx
// "Saved Threads" section REMOVED entirely
<Section title="Your Learning Progress">
  {/* chunks rendered here */}
</Section>
```

## Why This Change

1. **Simplifies architecture:** Single data structure (chunks) instead of threads + chunks
2. **Removes inert placeholder:** Threads did nothing; chunks are actionable
3. **Fixes bug:** Hardcoded `saved: true` at line 567 no longer confuses users
4. **Reduces confusion:** One "Your Learning Progress" section instead of two
5. **Enables sourceSignal context:** Chunks can now show why they were created
  </action>
  <verify>
- `grep -r "interface PlannerThread" app/src/` returns 0 results (interface removed)
- `grep -r "PlannerThread" app/src/` returns 0 results (no references remaining)
- `grep -r "toggleThreadSaved\|deleteThread" app/src/screens/` returns 0 results (methods removed from UI)
- `grep -r "Saved Threads" app/src/screens/` returns 0 results (section removed from UI)
- TypeScript compiler: `npm run type-check` passes with no errors in planner-related files
- App still builds: `npm run build` completes without errors
- localStorage no longer has 'echolearn_planner_threads' key (old threads are abandoned)
  </verify>
  <done>
- PlannerThread interface completely removed from codebase
- All thread-related service methods deleted (saveThread, deleteThread, findMatchingThread, etc.)
- Thread-related state removed from usePlanner hook
- "Saved Threads" UI section removed from PlannerScreen
- processCheckIn() no longer creates threads (only chunks)
- No TypeScript errors; code compiles cleanly
- Backward compatible: existing chunks still load, old threads are simply not loaded
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix Signal Extraction Heuristic (1.5h)</name>
  <files>
    app/src/services/planner.service.ts
  </files>
  <action>
## Find and Understand Current Signal Extraction

**In `app/src/services/planner.service.ts`:**

Search for `checkInSignalExtraction()` or `heuristicExtractSignals()` function.

This function currently has a BUG: "want to learn" is classified as **confusion**, but should be **curiosity**.

### Current Buggy Logic

```typescript
// CURRENT (WRONG):
if (text.includes("want") && text.includes("learn")) {
  signals.confusion.push(concept);  ← WRONG!
}
```

### Correct Logic

```typescript
// CORRECT:
if (text.includes("want") && text.includes("learn")) {
  signals.curiosity.push(concept);  ← RIGHT!
}
```

## Fix the Heuristic

**Step 1: Identify confusion signals**

Confusion indicates struggle, uncertainty, or repair need:
- Keywords: "confused", "struggling", "stuck", "don't understand", "not clear", "lost", "unclear", "can't get"
- Pattern: User admits knowledge gap

```typescript
const confusionKeywords = [
  'confused', 'confusing', 'struggling', 'struggle', 'stuck',
  'don\'t understand', 'not clear', 'unclear', 'lost',
  'can\'t get', 'not getting', 'hard to', 'difficulty',
  'messy', 'complicated', 'unclear', 'problem with'
];

for (const keyword of confusionKeywords) {
  if (text.toLowerCase().includes(keyword)) {
    signals.confusion.push(concept);
    break;  // Only categorize once
  }
}
```

**Step 2: Identify curiosity signals**

Curiosity indicates exploratory intent, learning desire:
- Keywords: "want to learn", "interested in", "explore", "learn more", "curious", "find out"
- Pattern: User wants to expand knowledge, not repair it

```typescript
const curiosityKeywords = [
  'want to learn', 'want to know', 'interested in', 'explore',
  'learn more', 'learn about', 'curious', 'find out',
  'understand how', 'how does', 'what is'
];

for (const keyword of curiosityKeywords) {
  if (text.toLowerCase().includes(keyword)) {
    signals.curiosity.push(concept);
    break;
  }
}
```

**Step 3: Identify revisit signals**

Revisit indicates spaced repetition need (system-generated, not from check-in):
- Usually triggered by scheduler, not by user text
- Only set if: lastReviewDate exists AND easeFactor < 2.0 AND overdue

```typescript
// Only if concept has review history
if (concept.reviewSchedule && concept.reviewSchedule.reviewCount > 0) {
  const daysSinceReview = (Date.now() - concept.lastReviewedAt) / 86400000;
  const isOverdue = daysSinceReview > concept.reviewSchedule.nextReviewDate;
  const isWeakening = concept.reviewSchedule.easeFactor < 2.0;
  
  if (isOverdue && isWeakening) {
    signals.revisit.push(concept);
  }
}
```

**Step 4: Identify connection signals**

Connections indicate interest in relationships, patterns:
- Keywords: "how does X relate to Y", "compare", "connection", "similar to", "like"
- Pattern: User wants to understand relationships

```typescript
const connectionKeywords = [
  'how does', 'relate', 'connection', 'compare', 'similar',
  'difference', 'versus', 'vs', 'like', 'pattern'
];

for (const keyword of connectionKeywords) {
  if (text.toLowerCase().includes(keyword)) {
    signals.connection.push(concept);
    break;
  }
}
```

## Implementation Steps

1. **Locate the heuristic function** in planner.service.ts
   - Search for "heuristic" or "signal extraction"
   - Usually around line 300-500

2. **Replace the logic** with corrected keyword matching:
   ```typescript
   function heuristicExtractSignals(text: string, concepts: Concept[]): CheckInSignals {
     const signals: CheckInSignals = {
       confusion: [],
       curiosity: [],
       revisit: [],
       connection: [],
       confidence: []
     };

     const lowerText = text.toLowerCase();

     // Extract mentioned concepts from text
     const mentionedConcepts = concepts.filter(c => 
       lowerText.includes(c.name.toLowerCase()) ||
       c.keywords?.some(k => lowerText.includes(k.toLowerCase()))
     );

     for (const concept of mentionedConcepts) {
       // Check confusion first (more specific)
       if (['confused', 'struggling', 'stuck', 'unclear'].some(k => lowerText.includes(k))) {
         signals.confusion.push(concept.id);
       }
       // Check curiosity (exclude confusion to avoid double-counting)
       else if (['want to learn', 'interested', 'explore', 'curious'].some(k => lowerText.includes(k))) {
         signals.curiosity.push(concept.id);
       }
       // Check connections
       else if (['relate', 'connection', 'compare', 'similar'].some(k => lowerText.includes(k))) {
         signals.connection.push(concept.id);
       }
     }

     return signals;
   }
   ```

3. **Test the logic** with examples:
   - Input: "I'm confused about closures" → signals.confusion = ["closures"] ✓
   - Input: "I want to learn blockchain" → signals.curiosity = ["blockchain"] ✓
   - Input: "How does async relate to promises?" → signals.connection = ["async", "promises"] ✓

4. **Verify against LLM path**: The function should have a try/catch that falls back to heuristic if LLM fails
   - Keep the LLM path as-is (it's working)
   - Only fix the heuristic fallback

## Why This Fixes the Bug

**Before:** "I want to learn RNN" → confusion signal → repair chunk (flashcards)
  - User: "But I'm not confused, I'm curious!"
  - Wrong content type delivered

**After:** "I want to learn RNN" → curiosity signal → deepdive chunk (posts)
  - User: "Yes, I want to explore this topic"
  - Correct content type delivered

## Edge Cases to Handle

1. **Multiple signals in one check-in:**
   - "I'm confused about promises BUT I want to learn async" 
   - Should extract BOTH: confusion=[promises], curiosity=[async]
   - Each concept gets its own signal type

2. **Ambiguous text:**
   - "I don't understand how this works" = confusion (don't understand)
   - "I want to understand how this works" = curiosity (want + understand)
   - Keywords matter

3. **No concepts mentioned:**
   - Input: "I'm just stressed today"
   - Output: Empty signals (no concepts extracted)
   - Result: No chunks created

  </action>
  <verify>
- Test vector 1: Input "I'm confused about closures" should produce signals.confusion = ["closures"], not confusion+curiosity
- Test vector 2: Input "I want to learn blockchain" should produce signals.curiosity = ["blockchain"], not confusion
- Test vector 3: Input "How does promises relate to async?" should produce signals.connection = ["promises", "async"] (or similar)
- Test vector 4: Input "I'm confused AND I want to learn about closures" handles both signals correctly
- Manual test: Submit check-in with "want to learn X" → verify it creates curiosity chunk, not confusion chunk
- Heuristic and LLM paths both tested (toggle LLM offline/online if possible)
- No TypeScript errors; checkInSignalExtraction is called correctly
  </verify>
  <done>
- Signal extraction heuristic fixed: "want to learn" → curiosity (not confusion)
- Confusion properly detected: "confused", "struggling", "stuck", etc.
- Curiosity properly detected: "want to learn", "interested", "explore", etc.
- Revisit and connection signals working correctly
- No double-counting of concepts across signal types
- Edge cases handled (multiple signals, ambiguous text, no concepts)
- Service method works as fallback when LLM is offline
  </done>
</task>

<task type="auto">
  <name>Task 3: Update Chunk Generation with sourceSignal (1.5h)</name>
  <files>
    app/src/types/index.ts
    app/src/services/planner.service.ts
  </files>
  <action>
## Update PlannerChunk Interface

**In `app/src/types/index.ts`:**

Find the `interface PlannerChunk` and ADD these fields:

```typescript
interface PlannerChunk {
  // ... existing fields ...
  
  // NEW FIELDS (Task 3):
  sourceSignal?: 'confusion' | 'curiosity' | 'revisit' | 'connection';
  sourceText?: string;  // Original check-in text that created this chunk
  priorityReason?: string;  // Why this chunk was suggested (set in Task 4)
  
  // ... rest of existing fields ...
}
```

Location: Usually after the chunk's core fields (type, goal, status). Keep existing field ordering.

## Signal-Aware Chunk Type Mapping

**In `app/src/services/planner.service.ts`:**

In the `processCheckIn()` function, find where chunks are created (STEP 4 in the workflow).

Replace the chunk creation logic with signal-aware mapping:

```typescript
function createChunkFromSignal(
  signal: 'confusion' | 'curiosity' | 'revisit' | 'connection',
  concept: Concept,
  sourceText: string
): PlannerChunk {
  const baseId = `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  let chunkType: ChunkType;
  let contentType: 'review' | 'post' | 'question';
  let goal: string;

  switch (signal) {
    case 'confusion':
      chunkType = 'repair';
      contentType = 'review';  // Flashcards for repair
      goal = `Clarify: ${concept.name}`;
      break;
      
    case 'curiosity':
      chunkType = 'connect';  // or 'deepdive' if that's your type
      contentType = 'post';   // ONLY posts for curiosity
      goal = `Explore: ${concept.name}`;
      break;
      
    case 'revisit':
      chunkType = 'retrieve';  // or 'review'
      contentType = 'review';  // Flashcards for spaced rep
      goal = `Revisit: ${concept.name} (spaced repetition)`;
      break;
      
    case 'connection':
      chunkType = 'connect';
      contentType = 'question';  // Questions for exploration
      goal = `Explore connections: ${concept.name}`;
      break;
      
    default:
      throw new Error(`Unknown signal type: ${signal}`);
  }

  const chunk: PlannerChunk = {
    id: baseId,
    type: chunkType,
    goal: goal,
    description: `Created from check-in: "${sourceText.substring(0, 100)}"`,
    linkedConceptIds: [concept.id],
    
    // Linked resource based on content type
    linkedResource: {
      type: contentType,  // 'review' | 'post' | 'question'
      id: findOrCreateResource(concept.id, contentType)
    },
    
    // NEW: Signal tracking (Task 3)
    sourceSignal: signal,
    sourceText: sourceText,
    
    // Status fields
    status: 'suggested',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    estimatedMinutes: estimateTime(signal),  // confusion: 10, curiosity: 15, revisit: 5
    priority: 'medium'  // Will be recalculated in scoring (Task 4)
  };

  return chunk;
}
```

## Update processCheckIn() to Use Signal-Aware Creation

**In the `processCheckIn()` function:**

Replace the chunk creation loop:

```typescript
// BEFORE (current):
for (const confusionConcept of signals.confusion) {
  const chunk = createStandardChunk(confusionConcept, 'repair');
  chunks.push(chunk);
}

// AFTER (signal-aware):
for (const conceptId of signals.confusion) {
  const concept = concepts.find(c => c.id === conceptId);
  if (concept) {
    const chunk = createChunkFromSignal('confusion', concept, checkInText);
    chunks.push(chunk);
  }
}

for (const conceptId of signals.curiosity) {
  const concept = concepts.find(c => c.id === conceptId);
  if (concept) {
    const chunk = createChunkFromSignal('curiosity', concept, checkInText);
    chunks.push(chunk);
  }
}

// Same for revisit and connection
```

## Ensure Backward Compatibility

**For existing chunks without sourceSignal:**

When loading chunks from localStorage, if sourceSignal is missing:
1. Don't crash (sourceSignal is optional: `sourceSignal?: ...`)
2. Default to sourceSignal = undefined (not null)
3. UI will handle undefined gracefully (Task 5)

```typescript
function loadChunks(): PlannerChunk[] {
  const raw = localStorage.getItem(CHUNKS_KEY);
  if (!raw) return [];
  
  const chunks = JSON.parse(raw) as PlannerChunk[];
  
  // No migration needed; sourceSignal is optional
  // Existing chunks without it will just have undefined
  // and UI handles that
  
  return chunks;
}
```

## Link Resources for Each Signal Type

Create a helper to find or generate the linkedResource:

```typescript
function findOrCreateResource(
  conceptId: string,
  contentType: 'review' | 'post' | 'question'
): string {
  // Find existing resource of this type linked to this concept
  // If not found, create a placeholder ID
  
  if (contentType === 'review') {
    // Find flashcard set for this concept
    const flashcards = findFlashcardsForConcept(conceptId);
    return flashcards?.[0]?.id || `placeholder-review-${conceptId}`;
  } else if (contentType === 'post') {
    // Find post related to this concept
    const posts = findPostsForConcept(conceptId);
    return posts?.[0]?.id || `placeholder-post-${conceptId}`;
  } else if (contentType === 'question') {
    // Find question related to this concept
    const questions = questionService.getQuestionsForConcept(conceptId);
    return questions?.[0]?.id || `placeholder-question-${conceptId}`;
  }
  
  return `placeholder-${contentType}-${conceptId}`;
}
```

## Test Signal → Chunk Type Mapping

**Test cases:**

| Input Signal | Expected Chunk Type | Expected Content Type | Test |
|-------------|---------------------|----------------------|------|
| confusion | 'repair' | 'review' | Flashcards suggested |
| curiosity | 'connect'/'deepdive' | 'post' | Posts suggested |
| revisit | 'retrieve'/'review' | 'review' | Flashcards suggested |
| connection | 'connect' | 'question' | Questions suggested |

**Manual verification:**
- Check-in: "I'm confused about closures"
  - Expected: Chunk with sourceSignal='confusion', linkedResource.type='review'
  - Verify: localStorage chunk has these fields

- Check-in: "I want to learn blockchain"
  - Expected: Chunk with sourceSignal='curiosity', linkedResource.type='post'
  - Verify: localStorage chunk has these fields

- Check-in: "How does async relate to promises?"
  - Expected: Chunk with sourceSignal='connection', linkedResource.type='question'
  - Verify: localStorage chunk has these fields

  </action>
  <verify>
- TypeScript: No "Property sourceSignal does not exist" errors
- Chunks created from check-in have sourceSignal field populated (not undefined)
- Curiosity chunks have linkedResource.type='post' (never 'review' or 'question')
- Confusion chunks have linkedResource.type='review' (never 'post')
- Connection chunks have linkedResource.type='question' (never 'post')
- Revisit chunks have linkedResource.type='review'
- sourceText contains the original check-in text (first 100 chars or full)
- Existing chunks without sourceSignal load without error (backward compat)
- Manual test: Submit 4 check-ins (one for each signal type), verify localStorage chunk fields
  </verify>
  <done>
- PlannerChunk interface updated with sourceSignal, sourceText, priorityReason fields
- Signal-aware chunk creation implemented (createChunkFromSignal function)
- processCheckIn() creates chunks based on signal type (confusion→repair+review, curiosity→connect+post, etc.)
- Backwards compatible: existing chunks without sourceSignal load cleanly
- linkedResource correctly set for each signal type
- sourceText populated with original check-in text
- All 4 signal types produce correct chunk types and content types
  </done>
</task>

<task type="auto">
  <name>Task 4: Enhance Weak Area Detection & Boost (1h)</name>
  <files>
    app/src/services/planner.service.ts
    app/src/services/plannerAutoGen.service.ts
  </files>
  <action>
## Find Scoring Service

Currently there should be a function that calculates suggestion scores. Search for:
- `suggestionScorer` or `calculateScore` or `scoreMove`
- Likely in `app/src/services/plannerAutoGen.service.ts`

This is where the weak area boost (+15) is currently applied.

## Current Weak Area Detection (What Exists)

The current code probably has something like:
```typescript
if (trajectorySignal.weakAreas.includes(conceptId)) {
  score += 15;  // Current boost
}
```

## Enhanced Weak Area Detection Logic

Replace with this more comprehensive detection:

```typescript
/**
 * Identify weak areas using multiple signals.
 * Target: 40-50% of all concepts should be marked as weak areas.
 */
function identifyWeakAreas(trajectorySignal: TrajectorySignal, allConcepts: Concept[]): string[] {
  const weakAreas: Set<string> = new Set();

  // Signal 1: Recent low performance
  // (Already in TrajectorySignal as weakAreas field, but we'll enhance it)
  if (trajectorySignal.weakAreas && Array.isArray(trajectorySignal.weakAreas)) {
    trajectorySignal.weakAreas.forEach(id => weakAreas.add(id));
  }

  // Signal 2: Multiple failed attempts
  // (Concepts with 2+ recent reviews < 60%)
  for (const concept of allConcepts) {
    if (concept.reviewSchedule) {
      const recentReviews = concept.reviewSchedule.recentResults || [];  // Last 5 reviews
      const failedAttempts = recentReviews.filter((r: any) => r.correctness < 60).length;
      if (failedAttempts >= 2) {
        weakAreas.add(concept.id);
      }
    }
  }

  // Signal 3: User confusion signal (from check-in)
  // (Concepts marked as 'confusion' sourceSignal in last 7 days)
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const recentConfusionChunks = chunks.filter(c =>
    c.sourceSignal === 'confusion' &&
    c.createdAt > sevenDaysAgo
  );
  for (const chunk of recentConfusionChunks) {
    chunk.linkedConceptIds?.forEach(id => weakAreas.add(id));
  }

  // Signal 4: Overdue with declining ease factor
  // (Concepts with reviewSchedule.easeFactor < 1.8 AND overdue)
  for (const concept of allConcepts) {
    if (concept.reviewSchedule && concept.lastReviewedAt) {
      const easeFactor = concept.reviewSchedule.easeFactor || 2.5;
      const daysSinceReview = (Date.now() - concept.lastReviewedAt) / 86400000;
      const nextReviewDate = parseInt(concept.reviewSchedule.nextReviewDate || '0');
      
      if (easeFactor < 1.8 && daysSinceReview > nextReviewDate) {
        weakAreas.add(concept.id);
      }
    }
  }

  return Array.from(weakAreas);
}
```

## Increase Weak Area Boost

**In the scoring function:**

```typescript
// BEFORE:
if (trajectorySignal.weakAreas.includes(conceptId)) {
  score += 15;  // Too small, all suggestions look equal
}

// AFTER:
if (trajectorySignal.weakAreas.includes(conceptId)) {
  score += 30;  // Moderate boost to prioritize weak areas
  priorityReason = 'Weak area identified - recent low performance';
}
```

## Calculate Weak Area Percentage

Add this check to ensure 40-50% target is met:

```typescript
function validateWeakAreaCoverage(
  trajectorySignal: TrajectorySignal,
  allConcepts: Concept[]
): { percentage: number; isValid: boolean } {
  const weakAreaCount = trajectorySignal.weakAreas.length;
  const totalConceptCount = allConcepts.length;
  const percentage = (weakAreaCount / totalConceptCount) * 100;
  
  const isValid = percentage >= 40 && percentage <= 50;
  
  console.log(`[Planner] Weak areas: ${percentage.toFixed(1)}% (${weakAreaCount}/${totalConceptCount})`);
  
  return { percentage, isValid };
}
```

## Update TrajectorySignal Calculation

If the function that builds TrajectorySignal isn't using the new detection logic, update it:

```typescript
export function calculateTrajectorySignal(
  chunks: PlannerChunk[],
  questions: Question[],
  reviews: any[]
): TrajectorySignal {
  // ... existing calculations ...
  
  // USE THE ENHANCED weak area detection:
  const weakAreas = identifyWeakAreas(existingSignal, questions);
  
  return {
    reviewPerformance: /* ... */,
    questionFrequency: /* ... */,
    timeSinceLastReview: /* ... */,
    feedEngagement: /* ... */,
    conceptCoverage: /* ... */,
    weakAreas: weakAreas,  // Enhanced detection
    completedReviews: /* ... */
  };
}
```

## Set priorityReason Field

While scoring, populate the priorityReason for each chunk:

```typescript
function scoreAndReasonChunks(
  chunks: PlannerChunk[],
  trajectorySignal: TrajectorySignal
): Array<{ chunk: PlannerChunk; score: number; reason: string }> {
  return chunks.map(chunk => {
    let score = calculateBaseScore(chunk, trajectorySignal);
    let reason = 'Default priority';
    
    // Weak area boost
    if (trajectorySignal.weakAreas.includes(chunk.linkedConceptIds[0])) {
      score += 30;
      reason = 'Weak area identified - recent low performance';
    }
    
    // Overdue boost
    if (chunk.createdAt < Date.now() - 14 * 86400000) {
      score += 15;
      reason = 'Overdue - last reviewed 2+ weeks ago';
    }
    
    // Spaced rep signal
    if (chunk.sourceSignal === 'revisit') {
      score += 20;
      reason = 'Spaced repetition due';
    }
    
    // Curiosity signal
    if (chunk.sourceSignal === 'curiosity' && score < 50) {
      reason = 'Expands your knowledge - recent interest';
    }
    
    return { chunk, score: Math.min(100, score), reason };
  });
}
```

## Scoring Thresholds (For Task 5 Badge Display)

Define these in a constants file or at the top of scoring service:

```typescript
export const SCORE_THRESHOLDS = {
  WEAK_AREA_MIN: 75,      // 🔴 Weak area focus
  OVERDUE_MIN: 60,        // 🟠 Overdue
  ACTIVE_MIN: 45,         // 🟡 Recently active
  EXPLORATION_MIN: 0      // ⚪ For exploration (catch-all)
};
```

## Validation Tests

Before moving to Task 5, verify:

1. **Weak area count:** Run diagnostics to confirm 40-50% of concepts are identified as weak
2. **Boost application:** Check that chunks for weak areas have +30 boost applied
3. **Backward compatibility:** Existing chunks without sourceSignal still get scored
4. **Priority reasons:** Each chunk has a reason string explaining score

  </action>
  <verify>
- Enhanced weak area detection identifies 4+ signals (low performance, failed attempts, confusion, overdue)
- Weak area boost increased from +15 to +30
- Weak area coverage is 40-50% of total concepts (log message confirms)
- priorityReason field populated for each scored chunk
- Chunks display scores ranging from ~30 to ~100 (proper distribution)
- Backward compat: chunks without sourceSignal still score correctly
- Score thresholds (75, 60, 45, 0) align with badge levels
- Manual test: Check 10 chunks, verify weak areas have +30 boost applied, percentages logged
  </verify>
  <done>
- Weak area detection enhanced to use 4+ signals (performance, failures, confusion, overdue)
- Target 40-50% of concepts identified as weak areas (validated via logging)
- Weak area boost increased from +15 to +30
- priorityReason field populated for each chunk explaining score
- Score thresholds defined for badge display (75, 60, 45, 0)
- Backward compatible with existing chunks
  </done>
</task>

<task type="checkpoint:human-verify">
  <what-built>
  - Removed thread data model entirely (threads no longer appear in UI or code)
  - Fixed signal extraction: "want to learn" now creates curiosity chunks, not confusion chunks
  - Added sourceSignal tracking to chunks (tracks which signal created each chunk)
  - Enhanced weak area detection to identify 40-50% of concepts
  - Increased weak area boost from +15 to +30
  - Implemented signal-aware chunk type mapping (confusion→flashcards, curiosity→posts, etc.)
  </what-built>
  <how-to-verify>
    1. **Verify thread removal:**
       - Open app on web or mobile
       - Go to Planner screen
       - Verify: "Saved Threads" section is completely gone
       - Verify: Only "Continue" and "Suggested Moves" sections visible
       - Verify: No error messages in console
    
    2. **Test signal extraction fix:**
       - Go to Daily Check-in
       - Submit: "I want to learn blockchain"
       - Go to Planner screen
       - Expected: New chunk appears with "Explore: Blockchain" (curiosity → deepdive)
       - Expected: Chunk.linkedResource.type = 'post' (NOT 'review')
       - Verify in browser DevTools: localStorage shows sourceSignal='curiosity'
    
    3. **Test confusion signal:**
       - Submit check-in: "I'm confused about closures"
       - Go to Planner
       - Expected: Chunk with "Clarify: Closures" (confusion → repair)
       - Expected: Chunk.linkedResource.type = 'review' (flashcards)
       - Verify in DevTools: sourceSignal='confusion'
    
    4. **Test sourceSignal context:**
       - In DevTools console, run:
         ```javascript
         const chunks = JSON.parse(localStorage.getItem('echolearn_planner_chunks'));
         chunks.filter(c => c.sourceSignal).forEach(c => console.log(c.sourceSignal, c.sourceText));
         ```
       - Verify: Recent chunks have sourceSignal and sourceText fields populated
    
    5. **Test weak area prioritization:**
       - Check DevTools console for: "[Planner] Weak areas: X% (Y/Z)"
       - Expected: X is between 40-50%
       - Verify: Top suggestions include weak areas
    
    6. **Test no regressions:**
       - Click "Start" on a suggested chunk → Should navigate to correct screen
       - Click "Dismiss" on a chunk → Should mark as skipped
       - Click "Schedule" on a chunk → Should queue for later
       - All existing buttons work without errors
  </how-to-verify>
  <resume-signal>
    Type one of:
    - "approved" — all tests pass, proceed to Task 5
    - "issue: {description}" — describe what's not working, I'll fix it
    - "retest" — if you want to verify specific areas again
  </resume-signal>
</task>

<task type="auto">
  <name>Task 5: Update UI with Top 5, Badges, and Renamed Sections (3h)</name>
  <files>
    app/src/screens/PlannerScreen.tsx
    app/src/components/MoveCard.tsx
  </files>
  <action>
## Update PlannerScreen.tsx: Top 5 Limit + [Show All] Button

**Step 1: Add state for show-all toggle**

```typescript
// Inside PlannerScreen component:
const [showAllSuggestions, setShowAllSuggestions] = useState(false);
```

**Step 2: Slice suggestions to top 5 by default**

Find where `suggestedMoves` or `suggestedChunks` are rendered:

```typescript
// BEFORE:
const visibleSuggestions = suggestedMoves;  // All suggestions shown

// AFTER:
const visibleSuggestions = showAllSuggestions 
  ? suggestedMoves 
  : suggestedMoves.slice(0, 5);  // Top 5 by default
```

**Step 3: Add [Show All] button**

Below the top 5 suggestions list, add:

```typescript
{suggestedMoves.length > 5 && !showAllSuggestions && (
  <button 
    onClick={() => setShowAllSuggestions(true)}
    style={{ /* styling */ }}
  >
    Show All {suggestedMoves.length} Suggestions
  </button>
)}

{showAllSuggestions && suggestedMoves.length > 5 && (
  <button 
    onClick={() => setShowAllSuggestions(false)}
    style={{ /* styling */ }}
  >
    Show Less
  </button>
)}
```

**Step 4: Rename section headers**

Find these text strings in PlannerScreen and replace:

| Current Text | New Text | Reason |
|-------------|----------|--------|
| "Continue" | "Your Learning Progress" | Clearer purpose (in-progress + active learning) |
| "Suggested Moves" | "Recommended Study Plan" (optional) | More descriptive, but "Suggested Moves" ok too |
| "Saved Threads" | (DELETED) | Removed entirely in Task 1 |

Example:
```typescript
// BEFORE:
<h2>Continue</h2>
<h2>Suggested Moves</h2>

// AFTER:
<h2>Your Learning Progress</h2>
<h2>Recommended Study Plan</h2>
// or keep "Suggested Moves" if preferred
```

**Step 5: Add empty state messaging**

If no chunks at all:
```typescript
if (allChunks.length === 0) {
  return (
    <div>
      <p>No learning progress yet. Submit a Daily Check-in to get started.</p>
      <button onClick={() => navigate('/daily-check-in')}>
        Start a Check-in
      </button>
    </div>
  );
}
```

## Update MoveCard.tsx: Priority Badges + Reasoning

**Step 1: Update component props**

```typescript
interface MoveCardProps {
  chunk: PlannerChunk;
  
  // NEW (from scoring):
  priorityBadge?: {
    emoji: string;    // '🔴' | '🟠' | '🟡' | '⚪'
    level: string;    // 'WEAK AREA FOCUS' | 'OVERDUE' | 'RECENTLY ACTIVE' | 'FOR EXPLORATION'
    reason: string;   // 'You marked as confusing' | 'Last reviewed 2 weeks ago' | etc.
    score: number;    // 0-100
  };
  
  // Existing props
  onStart?: () => void;
  onDismiss?: () => void;
  onSchedule?: () => void;
}
```

**Step 2: Render badge + reason**

Inside MoveCard render:

```typescript
export function MoveCard({ chunk, priorityBadge, onStart, onDismiss, onSchedule }: MoveCardProps) {
  return (
    <div className="move-card">
      {/* NEW: Priority badge row */}
      {priorityBadge && (
        <div className="badge-row">
          <span className="priority-emoji">{priorityBadge.emoji}</span>
          <div className="badge-info">
            <span className="badge-level">{priorityBadge.level}</span>
            <span className="badge-score">({priorityBadge.score}/100)</span>
          </div>
        </div>
      )}
      
      {/* NEW: Reasoning text */}
      {priorityBadge?.reason && (
        <div className="badge-reason">
          💡 {priorityBadge.reason}
        </div>
      )}
      
      {/* NEW: Source context */}
      {chunk.sourceText && (
        <div className="source-context">
          <span className="source-label">From check-in:</span>
          <span className="source-text">"{chunk.sourceText.substring(0, 80)}..."</span>
        </div>
      )}
      
      {/* Existing: Goal/title */}
      <h3>{chunk.goal}</h3>
      
      {/* Existing: Duration estimate */}
      {chunk.estimatedMinutes && (
        <p className="duration">⏱️ {chunk.estimatedMinutes} minutes</p>
      )}
      
      {/* Existing: Action buttons */}
      <div className="action-buttons">
        <button onClick={onStart} className="btn-start">[Start]</button>
        <button onClick={onSchedule} className="btn-schedule">[Schedule]</button>
        <button onClick={onDismiss} className="btn-dismiss">[Dismiss]</button>
      </div>
    </div>
  );
}
```

**Step 3: CSS styling for badges**

Add or update CSS in MoveCard styles:

```css
.move-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  margin: 8px 0;
  background: #fafafa;
}

.badge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px;
  background: #f0f0f0;
  border-radius: 4px;
}

.priority-emoji {
  font-size: 20px;
}

.badge-level {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  color: #333;
}

.badge-score {
  font-size: 11px;
  color: #888;
  margin-left: 4px;
}

.badge-reason {
  font-size: 12px;
  color: #555;
  margin-bottom: 8px;
  padding: 6px;
  background: #ffffcc;
  border-left: 3px solid #ffeb3b;
  border-radius: 2px;
}

.source-context {
  font-size: 11px;
  color: #666;
  margin-bottom: 8px;
  padding: 6px;
  background: #e3f2fd;
  border-radius: 2px;
}

.source-label {
  font-weight: 600;
}

.source-text {
  font-style: italic;
  margin-left: 4px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.btn-start, .btn-schedule, .btn-dismiss {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.btn-start {
  background: #4CAF50;
  color: white;
}

.btn-schedule {
  background: #2196F3;
  color: white;
}

.btn-dismiss {
  background: #f44336;
  color: white;
}
```

## Wire Scoring to MoveCard

**In PlannerScreen (or wherever moves are scored):**

```typescript
// Get all scored moves with reasons
const scoredMoves = suggestedMoves.map(move => {
  const scoreData = calculateScore(move, trajectorySignal);
  
  let badgeEmoji = '⚪';
  let badgeLevel = 'FOR EXPLORATION';
  if (scoreData.score >= 75) {
    badgeEmoji = '🔴';
    badgeLevel = 'WEAK AREA FOCUS';
  } else if (scoreData.score >= 60) {
    badgeEmoji = '🟠';
    badgeLevel = 'OVERDUE';
  } else if (scoreData.score >= 45) {
    badgeEmoji = '🟡';
    badgeLevel = 'RECENTLY ACTIVE';
  }
  
  return {
    ...move,
    priorityBadge: {
      emoji: badgeEmoji,
      level: badgeLevel,
      reason: scoreData.reason,  // From scoring service
      score: scoreData.score
    }
  };
});

// Render with badges
{scoredMoves.map(move => (
  <MoveCard 
    key={move.id} 
    chunk={move}
    priorityBadge={move.priorityBadge}
    onStart={() => handleStart(move)}
    onDismiss={() => handleDismiss(move)}
    onSchedule={() => handleSchedule(move)}
  />
))}
```

## Handle Edge Cases

1. **No sourceText (old chunks):**
   ```typescript
   {chunk.sourceText ? (
     <div className="source-context">From check-in: "{chunk.sourceText}"</div>
   ) : null}
   ```

2. **No priorityBadge (if scoring fails):**
   ```typescript
   {priorityBadge ? (
     <div className="badge-row">...</div>
   ) : null}
   ```

3. **Very long sourceText:**
   ```typescript
   {chunk.sourceText?.substring(0, 80) + (chunk.sourceText.length > 80 ? '...' : '')}
   ```

## Responsive Design Notes

- **Mobile:** Badges and reason text stack vertically
- **Tablet/Desktop:** Badges inline with title
- **Dark mode:** If app supports, invert colors appropriately

Consider using CSS media queries:
```css
@media (max-width: 600px) {
  .badge-row {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .move-card {
    padding: 12px;
  }
}
```

## Navigation Tests

Ensure all existing navigation still works:
- Click "Start" on curiosity chunk (sourceSignal='curiosity') → Navigate to PostDetailScreen
- Click "Start" on confusion chunk (sourceSignal='confusion') → Navigate to ReviewScreen
- Click "Start" on connection chunk (sourceSignal='connection') → Navigate to QuestionDetailScreen
- Click "Start" on revisit chunk (sourceSignal='revisit') → Navigate to ReviewScreen

This routing should already be working from phase 12, just verify no breakage.

  </action>
  <verify>
- "Your Learning Progress" header visible (not "Continue")
- Top 5 suggestions shown by default (not all)
- "[Show All X Suggestions]" button visible when more than 5
- [Show All] button expands to show all suggestions
- "[Show Less]" button appears when expanded, collapses back to top 5
- Each MoveCard displays priority badge (🔴 🟠 🟡 ⚪)
- Badge level text displayed (e.g., "WEAK AREA FOCUS")
- Reasoning text displayed below badge (e.g., "You marked as confusing")
- Source context displayed (e.g., "From check-in: I'm confused about...")
- Score number displayed in badge (e.g., "82/100")
- [Start] [Schedule] [Dismiss] buttons work without errors
- Click [Start] navigates to correct screen (review, post, or question)
- No crashes when chunk.sourceText is missing
- No crashes when priorityBadge is missing
- Mobile view responsive (badges stack vertically on small screens)
- All existing Planner features still work (no regression)
  </verify>
  <done>
- "Your Learning Progress" section header displays (was "Continue")
- "Recommended Study Plan" header displays (was "Suggested Moves", optional)
- Top 5 suggestions shown by default
- [Show All X Suggestions] button added and functional
- Priority badges (🔴 🟠 🟡 ⚪) display based on score thresholds (75, 60, 45, 0)
- Badge level text displays (WEAK AREA FOCUS, OVERDUE, RECENTLY ACTIVE, FOR EXPLORATION)
- Reasoning text displays below badge explaining why chunk was suggested
- Source context displays ("From check-in: ...")
- Score number displays in badge (/100)
- All action buttons work without regressions (Start, Schedule, Dismiss)
- Responsive design handles mobile (badges stack vertically)
- Backward compatible: chunks without sourceText or priorityBadge don't crash UI
- Navigation to correct screens works (review, post, question based on content type)
  </done>
</task>

</tasks>

<verification>

## Post-Execution Verification Checklist

**After all tasks complete, verify:**

### 1. Data Model Cleanup ✓
- [ ] No PlannerThread interface in types (grep returns 0 results)
- [ ] No thread-related service methods (saveThread, deleteThread, etc. removed)
- [ ] THREADS_KEY constant removed from localStorage keys
- [ ] No thread persistence to SQLite

### 2. Signal Extraction Fixed ✓
- [ ] "want to learn" produces curiosity signal (not confusion)
- [ ] "confused/struggling" produces confusion signal
- [ ] "How does X relate to Y" produces connection signal
- [ ] Revisit signal triggers on spaced rep schedule
- [ ] No double-counting of concepts across signal types

### 3. Chunk Generation ✓
- [ ] Every chunk has sourceSignal field populated (not undefined)
- [ ] Curiosity chunks have linkedResource.type='post' (ONLY)
- [ ] Confusion chunks have linkedResource.type='review'
- [ ] Connection chunks have linkedResource.type='question'
- [ ] Revisit chunks have linkedResource.type='review'
- [ ] sourceText contains original check-in text (or '' if system-generated)
- [ ] Backward compat: old chunks without sourceSignal load without error

### 4. Weak Area Prioritization ✓
- [ ] 40-50% of concepts identified as weak areas (console logs confirm)
- [ ] Weak area boost is +30 (not +15)
- [ ] priorityReason field populated for each scored chunk
- [ ] Score thresholds align: 75+🔴, 60+🟠, 45+🟡, 0+⚪

### 5. UI Improvements ✓
- [ ] "Saved Threads" section completely removed from screen
- [ ] "Continue" section renamed to "Your Learning Progress"
- [ ] Top 5 suggestions shown by default (not all)
- [ ] [Show All X] button visible and functional when >5 suggestions
- [ ] Priority badges display (🔴 🟠 🟡 ⚪)
- [ ] Badge level text displays (WEAK AREA FOCUS, etc.)
- [ ] Reasoning text displays below badge
- [ ] Source context displays ("From check-in: ...")
- [ ] Score displays in badge (/100)

### 6. No Regressions ✓
- [ ] Continue/Saved For Later/Done sections still work
- [ ] [Start] button navigates to correct screen
- [ ] [Schedule] button queues chunk for later
- [ ] [Dismiss] button marks chunk as skipped
- [ ] No console errors or TypeScript build errors
- [ ] App still builds and deploys without errors
- [ ] Navigation back-stack intact

### 7. Data Integrity ✓
- [ ] All existing chunks load correctly
- [ ] No data loss in migration
- [ ] localStorage schema unchanged (just sourceSignal added)
- [ ] SQLite migrations complete (if applicable)

---

## Manual Test Flows

### Flow 1: Confusion Signal
1. Open Daily Check-in
2. Enter: "I'm confused about closures"
3. Submit
4. Go to Planner
5. Verify:
   - New chunk appears with "Clarify: Closures"
   - Badge: 🔴 WEAK AREA FOCUS (or similar)
   - Reason: "You marked as confusing"
   - Source: "From check-in: I'm confused about closures"
   - Tapping [Start] navigates to flashcards (ReviewScreen)

### Flow 2: Curiosity Signal
1. Open Daily Check-in
2. Enter: "I want to learn blockchain"
3. Submit
4. Go to Planner
5. Verify:
   - New chunk appears with "Explore: Blockchain"
   - Badge: 🟡 RECENTLY ACTIVE (or similar)
   - Reason: "Expands your knowledge"
   - Source: "From check-in: I want to learn blockchain"
   - Tapping [Start] navigates to posts (NOT flashcards)

### Flow 3: Top 5 + Show All
1. Go to Planner with 8+ suggestions
2. Verify: Only top 5 shown
3. Scroll to bottom
4. Verify: [Show All 8 Suggestions] button visible
5. Click button
6. Verify: All 8 suggestions now shown
7. Verify: [Show Less] button appears
8. Click [Show Less]
9. Verify: Back to top 5 only

### Flow 4: Weak Area Prioritization
1. Go to Planner with mixed suggestions
2. Verify: Weak area chunks appear first (higher scores, 🔴 badges)
3. Check console: "[Planner] Weak areas: 45% (9/20)" or similar
4. Verify: Percentage is 40-50% range

---

</verification>

<success_criteria>

✅ **Phase 13 Complete When:**

1. **Daily Check-in integration works end-to-end:**
   - User submits "I'm confused about X" → Confusion chunk created with repair type + flashcards
   - User submits "I want to learn Y" → Curiosity chunk created with deepdive type + posts
   - Each chunk shows source context ("From check-in: ...")

2. **Threads completely removed:**
   - No PlannerThread interface in code
   - No "Saved Threads" section in UI
   - No thread-related service methods
   - No thread references in state management

3. **Signal-aware chunk types working:**
   - Confusion → repair chunks with review (flashcards) linked
   - Curiosity → deepdive chunks with post linked
   - Revisit → review chunks with review linked
   - Connection → deepdive chunks with question linked

4. **Weak areas effectively prioritized:**
   - 40-50% of concepts identified as weak (console logs confirm)
   - +30 boost applied to weak area chunks
   - Top suggestions are weak areas with 🔴 badges

5. **UI clear and helpful:**
   - Section renamed to "Your Learning Progress"
   - Top 5 suggestions by default, [Show All] button available
   - Priority badges (🔴 🟠 🟡 ⚪) displayed with reasons
   - Every chunk shows "From check-in: ..." context
   - No overwhelming suggestion lists

6. **No regressions:**
   - All existing buttons work (Start, Schedule, Dismiss)
   - Navigation to correct screens works (review, post, question)
   - No TypeScript or build errors
   - Backward compatible with existing chunks

7. **User mental model corrected:**
   - "This is my learning progress, organized by priority"
   - "I understand why each chunk was suggested"
   - "I can see which chunks came from my check-ins"
   - "This is helping me focus on weak areas first"

---

</success_criteria>

<output>

After successful execution of all tasks and checkpoint approval, create:

**`.planning/phases/13-planner-redesign/13-01-SUMMARY.md`**

This SUMMARY should contain:

```markdown
# Phase 13 Summary: Planner Redesign (Bug Fixes & UX Polish)

**Completed:** {date}
**Plan:** 13-01
**Status:** ✅ COMPLETE

## Artifacts Delivered

| File | Changes | Purpose |
|------|---------|---------|
| app/src/types/index.ts | Removed PlannerThread, added sourceSignal/sourceText/priorityReason to Chunk | Data model simplification |
| app/src/services/planner.service.ts | Removed thread methods, fixed signal extraction, added signal-aware chunk creation | Core planner service |
| app/src/state/usePlanner.ts | Removed thread state methods | Hook simplification |
| app/src/screens/PlannerScreen.tsx | Removed "Saved Threads" section, added top 5 limit + [Show All], renamed headers | UI improvements |
| app/src/components/MoveCard.tsx | Added priority badges, reasoning text, source context | Card enhancements |

## Requirements Met

- [x] PLANNER-07: Remove thread data model (no threads in code or UI)
- [x] PLANNER-08: Fix signal extraction (confusion vs curiosity distinction working)
- [x] PLANNER-09: Improve weak area detection (40-50% of concepts, +30 boost)
- [x] PLANNER-10: Clarify UI (badges, sourceSignal context, top 5 limit)

## Key Metrics

- **Code removed:** ~500 lines (thread-related code)
- **Code added:** ~300 lines (signal tracking, UI enhancements)
- **Net reduction:** ~200 lines
- **Weak area coverage:** 40-50% of concepts
- **Weak area boost:** +30 (was +15)
- **UI suggestions by default:** 5 (was all)

## Testing

- Manual UAT: 4 signal types tested (confusion, curiosity, revisit, connection)
- Regression: All existing buttons work (Start, Schedule, Dismiss)
- Navigation: Verified routing to correct screens
- Backward compatibility: Old chunks load without error

## User Impact

- ✅ "Saved Threads" confusion eliminated
- ✅ Daily Check-in feels integrated (shows source context)
- ✅ Weak areas clearly prioritized with 🔴 badges
- ✅ UI less overwhelming (top 5 by default)
- ✅ Users understand WHY each chunk was suggested

---

Next phase: Phase 14 (if applicable) or production deployment.
```

Also update `.planning/ROADMAP.md`:
- Mark Phase 13 complete: `✓ COMPLETE — 13-01-PLAN.md (2026-03-28)`
- Update success criteria checkmarks
- Document any deferred items for future phases

</output>

---

## Notes on Execution

### Complexity Mitigation

This plan addresses 4 interrelated bugs simultaneously. To stay focused:
- **Task 1:** Surgical removal of thread code (don't refactor broadly)
- **Task 2:** Targeted heuristic fix (don't redesign entire signal system)
- **Task 3:** Add fields to existing chunk structure (don't reorganize)
- **Task 4:** Enhance detection in place (don't rewrite scorer)
- **Task 5:** UI enhancements using existing patterns (don't redesign layout)

### Quality Gates

- **After Task 1:** TypeScript compilation must pass (no orphaned types)
- **After Task 2:** Manual test 2 check-ins (confusion, curiosity signals)
- **After Task 3:** DevTools verify sourceSignal + sourceText populated
- **After Task 4:** Console log shows "Weak areas: 40-50%" message
- **After Task 5:** Full flow UAT (check-in → chunk → UI → navigation)

### Rollback Plan

If issues arise:
1. **Revert Task 5 only:** Restore old UI while keeping new chunks (features work, UI old)
2. **Revert Tasks 1-3:** Keep chunks simple, hide sourceSignal display (backward compat)
3. **Full rollback:** Use git to revert entire phase if critical issues

### Estimated Time Breakdown

- Task 1: 2 hours (code removal, straightforward)
- Task 2: 1.5 hours (heuristic fix, moderate complexity)
- Task 3: 1.5 hours (field addition, straightforward)
- Task 4: 1 hour (algorithm enhancement, low risk)
- Task 5: 3 hours (UI work, complexity in coordination)
- Checkpoint: 1 hour (manual testing, verification)
- **Total: 10 hours** (within 8-12 hour estimate)

---

_Phase 13 Plan | Planner Redesign | Ready for Execution | 2026-03-28_
