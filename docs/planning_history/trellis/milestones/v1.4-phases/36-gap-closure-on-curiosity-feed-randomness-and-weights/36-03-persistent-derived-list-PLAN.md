---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 03
type: execute
wave: 2
depends_on: [00, 01, 02]
files_modified:
  - app/src/services/post-queue.service.ts
  - app/src/services/concept-feed.service.ts
autonomous: true
requirements: [GAP-1, GAP-2]
gap_closure: true
must_haves:
  truths:
    - "QueueState extended with `derivedList: string[]` and `cyclePosition: number`; persisted to localStorage under existing key `echolearn_post_queue`"
    - "Existing localStorage payloads (without the new fields) load defensively to [] and 0 — no crash, no migration script"
    - "appendToDerivedList preserves WITHIN-CALL multiplicity (first append of ['a','a','a','a','b','b','b','b'] stores 8 entries) and dedups ACROSS calls (subsequent calls do NOT re-append IDs already in derivedList)"
    - "walkDerivedList(count, exploredIds) advances cyclePosition, wraps to 0 on overflow, lazily skips IDs in exploredIds, returns [] if every entry is explored without infinite-looping"
    - "resetForNewDay clears derivedList to [] and cyclePosition to 0"
    - "buildConceptBatch + refillQueue refactored to (a) call appendToDerivedList instead of producing a fresh per-call list, (b) use walkDerivedList to collect the next batch, (c) STILL filter explored anchors at buildConceptBatch (Phase 33 gap fix line 798 not regressed) AND lazy-skip at walk time"
    - "Important anchor weighting (2× entries when easeFactor < 1.5 OR leafState dying/falling/dead) preserved on FIRST append; subsequent appends dedup so importance is not re-weighted mid-day"
  artifacts:
    - path: app/src/services/post-queue.service.ts
      provides: "Persistent derived list + cyclic walker"
      contains: "appendToDerivedList"
    - path: app/src/services/concept-feed.service.ts
      provides: "refillQueue calls appendToDerivedList + walkDerivedList instead of using buildConceptBatch's array directly"
      contains: "postQueueService.appendToDerivedList"
  key_links:
    - from: "app/src/services/post-queue.service.ts QueueState"
      to: "localStorage echolearn_post_queue"
      via: "JSON.stringify in save() and JSON.parse in load()"
      pattern: "derivedList.*cyclePosition"
    - from: "app/src/services/concept-feed.service.ts refillQueue"
      to: "postQueueService.walkDerivedList"
      via: "function call replacing direct conceptIds array consumption"
      pattern: "walkDerivedList"
---

<objective>
Promote the derived list from a per-call ad-hoc array (rebuilt fresh every `refillQueue`) to a persistent, append-only data structure inside `QueueState` with a cyclic walker. Closes GAP-1 (rebuild loses cycle position) and GAP-2 (no cycle walker exists).

Per RESEARCH § Pattern 1, the storage extends `QueueState` (NOT a new service / new key — collocates daily cycle state). Per RESEARCH § "Removal-on-read semantics under append-only", the removal-on-read mechanism is **lazy skip at walk time** using `dailyReadService.getExploredAnchors()` — NOT physical splice (which corrupts cyclePosition).

Purpose: Honor CLAUDE.md "DO NOT DRIFT" pipeline design — derived list is append-only, queue is cyclic, queue serves 4 per swipe. Eliminate the "fresh array every refill" defect that loses cycle position and re-suggests the same concepts in the same order each refill.
Output:
- `post-queue.service.ts`: extended QueueState; new methods `getDerivedList`, `getCyclePosition`, `appendToDerivedList`, `walkDerivedList`; defensive load(); resetForNewDay clears new fields.
- `concept-feed.service.ts`: refillQueue's "Step 1: Build concept batch" refactored to call `appendToDerivedList(buildConceptBatch(questions))` then `walkDerivedList(batchSize, exploredIds)`. The single-line diff at line 1270-1271 grows to ~10 lines.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-RESEARCH.md
@.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-VALIDATION.md
@CLAUDE.md
@app/src/services/post-queue.service.ts
@app/src/services/concept-feed.service.ts
@app/src/services/daily-read.service.ts
@app/tests/services/derived-list.test.mjs
@app/tests/services/post-queue.test.mjs

<interfaces>
QueueState extension (post-queue.service.ts) — new fields appended to existing interface:
```typescript
interface QueueState {
  date: string;
  posts: DailyPost[];
  cycleNumber: number;
  totalGenerated: number;
  totalServed: number;
  // Phase 36 GAP-1 + GAP-2 — persistent derived list + cyclic walker
  derivedList: string[];        // append-only conceptId list for the current day
  cyclePosition: number;        // walker index into derivedList
}
```

New service methods on `postQueueService`:
```typescript
getDerivedList(): string[];                                    // shallow copy
getCyclePosition(): number;
appendToDerivedList(conceptIds: string[]): void;               // dedup ACROSS calls (multiplicity preserved within call), no rebuild
walkDerivedList(count: number, exploredIds: Set<string>): string[];  // advances cyclePosition; wraps; lazy-skips explored
```

Refactored refillQueue Step 1 (concept-feed.service.ts ~line 1269-1271 → grows to ~10 lines):
```typescript
// BEFORE:
//   const conceptIds = buildConceptBatch(questions);
//   if (conceptIds.length === 0) return;
// AFTER:
const allDueConceptIds = buildConceptBatch(questions);  // STILL filters explored — line 798 not changed
postQueueService.appendToDerivedList(allDueConceptIds);  // dedup append; survives refill
const batchSize = Math.max(8, REFILL_THRESHOLD);          // collect enough to refill the queue meaningfully
const conceptIds = postQueueService.walkDerivedList(batchSize, exploredIds);
if (conceptIds.length === 0) return;                      // empty derived list OR all explored
```

Where `exploredIds` is the SAME `Set<string>` already computed at line 1264 from `dailyReadService.getExploredAnchors()` — re-use, don't re-compute.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend QueueState in post-queue.service.ts with derivedList + cyclePosition + four new methods</name>
  <files>app/src/services/post-queue.service.ts</files>
  <read_first>
    - app/src/services/post-queue.service.ts (entire file — 205 lines, all of it; you are extending it surgically)
    - app/tests/services/derived-list.test.mjs (Wave 0 — 10 tests; your implementation must make all 10 GREEN)
    - app/tests/services/post-queue.test.mjs (existing tests — your edits must NOT regress these)
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-RESEARCH.md (Pattern 1 → "What/Fix/Cycle position overflow behavior" + "Code Examples → Derived List Walk" + "Risk Register row 1 — localStorage migration" + "Pitfall 4 — derived list multiplicity preservation")
    - CLAUDE.md "Concept Feed Generation Pipeline" section (this is the design spec; you are implementing list 2/3 of the pipeline)
  </read_first>
  <behavior>
    - Wave 0 Test 1 (append-only across two calls): pass
    - Wave 0 Test 2 (dedup by id ACROSS calls): pass
    - Wave 0 Test 3 (persistence across loadQueue): pass
    - Wave 0 Test 4 (resetForNewDay clears new fields): pass
    - Wave 0 Test 5 (defensive load on legacy localStorage payload): pass
    - Wave 0 Test 6 (walkDerivedList(4, emptySet) advances cyclePosition by 4): pass
    - Wave 0 Test 7 (wrap to 0 after reaching length): pass
    - Wave 0 Test 8 (lazy skip explored): pass
    - Wave 0 Test 9 (returns [] when all explored, no infinite loop): pass
    - Wave 0 Test 10 (within-call multiplicity preserved on FIRST append; subsequent calls dedup ACROSS calls): pass — first append of `['a','a','a','a','a','a','a','a','b','b','b','b']` stores 8 'a' entries and 4 'b' entries; second append of `['a','b']` is a no-op (both already in derivedList). The 8/4 weighting survives unchanged.
    - Existing post-queue.test.mjs all still pass (FIFO, dequeue, needsRefill, cycleNumber, getYesterdayQueue, etc.)
  </behavior>
  <action>
Open `app/src/services/post-queue.service.ts`. Surgical edits:

**EDIT 1 — Extend the QueueState interface (lines 15-21).** Append two new fields:

```typescript
interface QueueState {
  date: string;
  posts: DailyPost[];
  cycleNumber: number;
  totalGenerated: number;
  totalServed: number;
  // Phase 36 GAP-1 + GAP-2 — persistent derived list + cyclic walker.
  // CLAUDE.md "Concept Feed Generation Pipeline" list 2/3 (derived list,
  // append-only) and walker position into list 3/3 (the queue is fed by
  // walking this list cyclically, 4 per swipe per design).
  derivedList: string[];
  cyclePosition: number;
}
```

**EDIT 2 — Update freshState() (line 32-34) to initialize the new fields:**

```typescript
function freshState(): QueueState {
  return {
    date: today(),
    posts: [],
    cycleNumber: 0,
    totalGenerated: 0,
    totalServed: 0,
    derivedList: [],
    cyclePosition: 0,
  };
}
```

**EDIT 3 — Make load() defensive against legacy payloads (lines 36-49).** Replace the existing function body with:

```typescript
function load(): QueueState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Partial<QueueState>;
    if (parsed.date !== today()) {
      // Date mismatch — return fresh (warm-start handled by caller).
      return freshState();
    }
    // Phase 36 GAP-1 — defensive read for users on the prior schema.
    // localStorage payloads written before 2026-05-06 lack derivedList +
    // cyclePosition. Treat missing fields as their fresh defaults so the
    // queue does NOT crash on load — the new walker will append on next
    // refill cycle and the user's day starts as if cycle position = 0.
    return {
      date: parsed.date ?? today(),
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      cycleNumber: typeof parsed.cycleNumber === 'number' ? parsed.cycleNumber : 0,
      totalGenerated: typeof parsed.totalGenerated === 'number' ? parsed.totalGenerated : 0,
      totalServed: typeof parsed.totalServed === 'number' ? parsed.totalServed : 0,
      derivedList: Array.isArray(parsed.derivedList) ? parsed.derivedList : [],
      cyclePosition: typeof parsed.cyclePosition === 'number' ? parsed.cyclePosition : 0,
    };
  } catch {
    return freshState();
  }
}
```

**EDIT 4 — Add four new service methods.** Insert AFTER the existing `getYesterdayQueue()` method (after line 204, BEFORE the closing `};` on line 205). New code:

```typescript
  // ─── Phase 36 GAP-1 + GAP-2 — persistent derived list + cyclic walker ───

  /** Get a shallow copy of the persistent derived list (list 2/3 of the pipeline). */
  getDerivedList(): string[] {
    return [..._state.derivedList];
  },

  /** Walker position into the derived list. Wraps to 0 on overflow. */
  getCyclePosition(): number {
    return _state.cyclePosition;
  },

  /**
   * Append-only — dedup ACROSS calls by conceptId equality. Within a single
   * call, multiplicity is PRESERVED (a first-time append of ['a','a','a','a',
   * 'b','b','b','b'] stores 8 entries because none of the IDs are present in
   * derivedList yet). Subsequent calls with overlapping IDs are no-ops for
   * those IDs (so a second append of ['a','b'] adds zero entries — the 8/4
   * importance weighting from the first call survives unchanged).
   *
   * Rationale (RESEARCH § Pitfall 4): Importance weighting is encoded as
   * multiplicity (an important anchor gets 8 entries, normal anchor 4 entries
   * — see buildConceptBatch BASE_ENTRIES_PER_CONCEPT). buildConceptBatch
   * upstream filters out explored anchors and assigns multiplicities, then
   * passes the weighted list here. We must preserve those multiplicities on
   * first append, AND we must dedup across calls so subsequent refills do not
   * re-append the same anchor's entries (which would either double-weight or
   * inflate the derived list unboundedly).
   *
   * Implementation: seed `existing` ONCE from the current derivedList before
   * the loop, then ONLY check membership inside the loop — do NOT mutate
   * `existing` per iteration. Within-call duplicates pass the check (none are
   * in the seeded `existing` set) so multiplicity is preserved; cross-call
   * duplicates are caught because the seed reflects what's already persisted.
   */
  appendToDerivedList(conceptIds: string[]): void {
    if (conceptIds.length === 0) return;
    // Seed ONCE before loop — captures what's already persisted across calls.
    // Do NOT mutate this set inside the loop; that would deduplicate
    // within-call, destroying importance multiplicity (Plan 36-00 Test 10,
    // RESEARCH § Pitfall 4).
    const existing = new Set(_state.derivedList);
    let added = 0;
    for (const id of conceptIds) {
      if (existing.has(id)) continue;
      _state.derivedList.push(id);
      added++;
    }
    if (added > 0) save(_state);
  },

  /**
   * Walk the derived list to collect `count` non-explored conceptIds, advancing
   * cyclePosition for each step taken. Wraps to position 0 on overflow.
   *
   * Lazy removal-on-read (RESEARCH § "Removal-on-read semantics under append-only"):
   * exploredIds gates which conceptIds are RETURNED (skipped if explored), but
   * cyclePosition advances PAST them too — so explored entries don't hang the
   * walker.
   *
   * Termination: walks at most `2 * derivedList.length` steps to avoid an
   * infinite loop when every entry is explored. Returns whatever it found
   * (possibly empty — caller has an early-return guard).
   */
  walkDerivedList(count: number, exploredIds: Set<string>): string[] {
    const len = _state.derivedList.length;
    if (len === 0) return [];
    const result: string[] = [];
    const maxSteps = len * 2;
    let steps = 0;
    while (result.length < count && steps < maxSteps) {
      const id = _state.derivedList[_state.cyclePosition];
      _state.cyclePosition = (_state.cyclePosition + 1) % len;
      steps++;
      if (!exploredIds.has(id)) result.push(id);
    }
    save(_state);
    return result;
  },
```

**EDIT 5 — `resetForNewDay` (line 183-186)**: NO change needed — it calls `freshState()` which now returns the new fields initialized correctly. Leave the function body alone, but VERIFY the test passes.

**Verify:**
1. `cd app && node --test tests/services/derived-list.test.mjs` → 10/10 pass.
2. `cd app && node --test tests/services/post-queue.test.mjs tests/services/post-queue-dedup.test.mjs` → 0 failures (no regression in existing FIFO/dedup tests).
3. `cd app && npx tsc -b --noEmit` → exit 0.

**Constraints (MUST honor):**
- Do NOT change `enqueue` / `enqueueInterleaved` / `dequeue` / `needsRefill` / `getCycleNumber` / `incrementCycle` — leave them untouched.
- Do NOT add a separate localStorage key. Everything piggybacks on `echolearn_post_queue` to keep daily cycle state collocated.
- Do NOT introduce a CONCEPT_EXPLORED subscription here. Lazy skip at walk time (using `exploredIds` argument) is the chosen mechanism per RESEARCH.
- The `STORAGE_KEY` constant (line 6) is unchanged.
- **DO NOT mutate `existing` inside the appendToDerivedList loop.** That is the exact bug the checker flagged. Seed before the loop, read-only inside.

**Commit message:** `feat(36-03 Task 1): extend QueueState with derivedList + cyclic walker (closes GAP-1 + GAP-2)`
  </action>
  <verify>
    <automated>cd app &amp;&amp; node --test tests/services/derived-list.test.mjs tests/services/post-queue.test.mjs tests/services/post-queue-dedup.test.mjs 2>&amp;1 | grep -E "tests|pass|fail" | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - app/src/services/post-queue.service.ts contains `derivedList: string[];` in the QueueState interface (verify: `grep -c "derivedList: string\\[\\]" app/src/services/post-queue.service.ts` >= 1)
    - app/src/services/post-queue.service.ts contains `cyclePosition: number;` in the QueueState interface (verify: grep returns at least 1)
    - app/src/services/post-queue.service.ts contains all four new methods (verify: ALL of these greps return >= 1: `grep -c "appendToDerivedList(conceptIds" app/src/services/post-queue.service.ts`, `grep -c "walkDerivedList(count" app/src/services/post-queue.service.ts`, `grep -c "getDerivedList()" app/src/services/post-queue.service.ts`, `grep -c "getCyclePosition()" app/src/services/post-queue.service.ts`)
    - The freshState() function initializes both new fields (verify: `grep -A 10 "function freshState" app/src/services/post-queue.service.ts` shows `derivedList: []` and `cyclePosition: 0`)
    - The load() function defensively reads both new fields (verify: `grep -B 2 -A 2 "Array.isArray(parsed.derivedList)" app/src/services/post-queue.service.ts` finds the line; same for `typeof parsed.cyclePosition`)
    - `appendToDerivedList` does NOT mutate its dedup set inside the loop (verify: `grep -A 12 "appendToDerivedList(conceptIds" app/src/services/post-queue.service.ts | grep -c "existing.add"` returns 0; only `existing.has` should appear inside the loop)
    - `cd app && node --test tests/services/derived-list.test.mjs` exits 0 (Wave 0 — all 10 tests now GREEN, including Test 10 multiplicity preservation)
    - `cd app && node --test tests/services/post-queue.test.mjs tests/services/post-queue-dedup.test.mjs` exits 0 (existing tests, no regression)
    - `cd app && npx tsc -b --noEmit` exits 0
    - STORAGE_KEY remains 'echolearn_post_queue' — no new localStorage keys (verify: `grep -c "STORAGE_KEY = 'echolearn_post_queue'" app/src/services/post-queue.service.ts` returns 1; `grep -c "localStorage.setItem('echolearn_derived" app/src/services/post-queue.service.ts` returns 0)
    - walkDerivedList has the 2× length termination guard (verify: `grep -A 8 "walkDerivedList" app/src/services/post-queue.service.ts | grep -c "len \\* 2"` >= 1)
  </acceptance_criteria>
  <done>QueueState extended; four new methods land; freshState + load defensive; appendToDerivedList preserves within-call multiplicity (existing seeded once before loop, never mutated inside); Wave 0 derived-list test 10/10 pass; existing post-queue tests no-regression; tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Refactor concept-feed.service.ts refillQueue Step 1 to use append + walk</name>
  <files>app/src/services/concept-feed.service.ts</files>
  <read_first>
    - app/src/services/concept-feed.service.ts lines 760-815 (buildConceptBatch — KEEP UNCHANGED; it still filters explored anchors and weights important × 2)
    - app/src/services/concept-feed.service.ts lines 1234-1442 (refillQueue full body — your edit is at lines 1269-1271, ~3 lines becoming ~10 lines)
    - app/src/services/post-queue.service.ts (the four new methods you are now consuming)
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-RESEARCH.md (Pattern 1 → "refillQueue flow change")
    - CLAUDE.md "Concept Feed Generation Pipeline" section ("DO NOT DRIFT" — the three-list architecture; specifically the rule that `buildConceptBatch`'s explored-filter must remain since it gates new appends; and "Numeric defaults" → MAX_QUEUE_SIZE = 32 + REFILL_THRESHOLD = 12)
    - CLAUDE.md "Best practices learned in Phase 32.1" rule 1 (search for dead code before assuming) and rule 2 (tests guard live paths) — your refactor must keep the explored-filter at buildConceptBatch:798 alive (Phase 33 gap fix).
  </read_first>
  <behavior>
    - First refillQueue call of the day: buildConceptBatch returns weighted IDs (e.g., 8 entries for an important anchor, 4 for normal) → appendToDerivedList accepts them → walkDerivedList returns batchSize entries → flow proceeds as before
    - Second refillQueue call (same day): buildConceptBatch may return SAME or fewer IDs (some explored) → appendToDerivedList dedups across calls → walkDerivedList resumes from saved cyclePosition → user sees DIFFERENT slice of the derived list (no more "fresh array every cycle" defect)
    - All anchors explored (allExplored=true): buildConceptBatch returns []; appendToDerivedList no-op; walkDerivedList returns [] (lazy-skip on every entry); refillQueue early-returns at the existing guard
    - Refill across page reloads (loadQueue inside the same day): cyclePosition restored from localStorage; walkDerivedList resumes correctly
    - The Phase 33 gap fix at buildConceptBatch:798 (`!exploredIds.has(a.id)` filter) is PRESERVED — no edits to buildConceptBatch
    - The Phase 33 allExplored cap gate at line 1267 (`if (allExplored && getTotalGenerated() >= maxPosts) return;`) is PRESERVED — no edits to that line
  </behavior>
  <action>
Open `app/src/services/concept-feed.service.ts`. ONE surgical edit at the refillQueue Step 1 site (lines 1269-1271 in the current file; line numbers may shift slightly after Plan 36-02's edit lands).

**Locate the block:** Search for the comment `// Step 1: Build concept batch for this cycle` followed by:
```typescript
    const conceptIds = buildConceptBatch(questions);
    if (conceptIds.length === 0) return;
```

**REPLACE that 2-line block with:**

```typescript
    // Step 1: Build concept batch + append-only persist + cyclic walk
    // (Phase 36 GAP-1 + GAP-2). buildConceptBatch still filters explored anchors
    // (Phase 33 gap fix line ~798 — DO NOT remove that filter; it gates fresh
    // appends). The derived list is now PERSISTED in QueueState and grows
    // append-only across refill cycles within the same day; the walker resumes
    // from saved cyclePosition rather than restarting from index 0 each time.
    //
    // Removal-on-read is LAZY: walkDerivedList skips conceptIds in `exploredIds`
    // (already computed at line 1264). Physical splice would corrupt the walker's
    // index — see RESEARCH § Pitfall 1.
    const dueConceptIds = buildConceptBatch(questions);
    postQueueService.appendToDerivedList(dueConceptIds);
    // Walk batchSize entries — large enough to refill the queue past REFILL_THRESHOLD
    // (12) up toward MAX_QUEUE_SIZE (32). 16 leaves room for downgrades + spread.
    const conceptIds = postQueueService.walkDerivedList(16, exploredIds);
    if (conceptIds.length === 0) return;
```

**CRITICAL — verify these things stay intact:**
1. Line ~1264 still computes `exploredIds`:
   ```typescript
   const exploredIds = new Set(dailyReadService.getExploredAnchors());
   ```
   You are RE-USING this same Set — don't recompute it.
2. Line ~1267 still has the cap gate:
   ```typescript
   if (allExplored && postQueueService.getTotalGenerated() >= maxPosts) return;
   ```
   Don't touch.
3. `buildConceptBatch` (lines 794-814) is UNCHANGED. Don't touch its body. The explored-filter at line 798 is load-bearing.
4. The downstream flow (line 1273 onward — `availability` computation, `assignStyles`, pre-fetch, etc.) consumes `conceptIds` — still a `string[]`, still gated by an early-return on length===0. The contract for downstream is identical.

**Verify:**
1. `cd app && node --test tests/services/derived-list.test.mjs` → 10/10 pass (still GREEN from Task 1).
2. `cd app && node --test tests/services/spread-by-concept.test.mjs` → 7/7 pass (Plan 36-02 still GREEN — no concept-feed.service.ts regression).
3. `cd app && node --test tests/services/concept-batch-filter.test.mjs tests/services/concept-feed-cross-cycle-dedup.test.mjs tests/services/post-queue.test.mjs tests/services/post-queue-dedup.test.mjs tests/services/style-assignment.test.mjs tests/services/style-assignment-stratified.test.mjs` → 0 failures.
4. `cd app && npx tsc -b --noEmit` → exit 0.

**Commit message:** `feat(36-03 Task 2): refillQueue uses appendToDerivedList + walkDerivedList (closes GAP-1 + GAP-2 wiring)`
  </action>
  <verify>
    <automated>cd app &amp;&amp; node --test tests/services/derived-list.test.mjs tests/services/spread-by-concept.test.mjs tests/services/concept-batch-filter.test.mjs tests/services/concept-feed-cross-cycle-dedup.test.mjs tests/services/post-queue.test.mjs tests/services/style-assignment-stratified.test.mjs 2>&amp;1 | grep -E "tests|pass|fail" | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - app/src/services/concept-feed.service.ts contains the call `postQueueService.appendToDerivedList(dueConceptIds)` (verify: `grep -c "postQueueService.appendToDerivedList(dueConceptIds)" app/src/services/concept-feed.service.ts` returns 1)
    - app/src/services/concept-feed.service.ts contains the call `postQueueService.walkDerivedList(16, exploredIds)` (verify: `grep -c "postQueueService.walkDerivedList(16, exploredIds)" app/src/services/concept-feed.service.ts` returns 1)
    - The previous direct consumption pattern is gone (verify: `grep -c "const conceptIds = buildConceptBatch(questions);" app/src/services/concept-feed.service.ts` returns 0; instead `dueConceptIds = buildConceptBatch(questions)` appears once)
    - buildConceptBatch body unchanged — explored-filter still at the comparable line (verify: `grep -c "!exploredIds.has(a.id)" app/src/services/concept-feed.service.ts` returns 1)
    - Phase 33 cap-gate intact (verify: `grep -c "allExplored && postQueueService.getTotalGenerated() >= maxPosts" app/src/services/concept-feed.service.ts` returns 1)
    - `cd app && node --test tests/services/derived-list.test.mjs` exits 0 (still GREEN after the wiring lands)
    - `cd app && node --test tests/services/spread-by-concept.test.mjs tests/services/concept-batch-filter.test.mjs tests/services/concept-feed-cross-cycle-dedup.test.mjs tests/services/post-queue.test.mjs tests/services/post-queue-dedup.test.mjs tests/services/style-assignment.test.mjs tests/services/style-assignment-stratified.test.mjs` exits 0 (no regression)
    - `cd app && npx tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>refillQueue Step 1 uses appendToDerivedList + walkDerivedList; buildConceptBatch unchanged; Phase 33 explored-filter and cap-gate preserved; all derived-list + adjacent tests GREEN; tsc clean.</done>
</task>

</tasks>

<verification>
- `cd app && node --test tests/services/derived-list.test.mjs` exits 0 (GAP-1 + GAP-2 + REGRESSION all pass — 10/10)
- `cd app && node --test tests/services/post-queue.test.mjs tests/services/post-queue-dedup.test.mjs` exits 0 (no regression in queue FIFO/dedup)
- `cd app && node --test tests/services/spread-by-concept.test.mjs tests/services/concept-batch-filter.test.mjs tests/services/concept-feed-cross-cycle-dedup.test.mjs` exits 0 (no regression in concept-feed pipeline)
- `cd app && npx tsc -b --noEmit` exits 0
- buildConceptBatch is byte-unchanged (verify: `git diff app/src/services/concept-feed.service.ts -- | grep -E "^[+-].*function buildConceptBatch|^[+-].*BASE_ENTRIES_PER_CONCEPT"` shows zero +/- lines for the function definition / constant)
- Phase 33 explored-filter and allExplored cap-gate are byte-unchanged
</verification>

<success_criteria>
Plan complete when:
- [ ] QueueState extended with derivedList + cyclePosition; freshState + load + resetForNewDay all aware
- [ ] Four new postQueueService methods land (getDerivedList, getCyclePosition, appendToDerivedList, walkDerivedList)
- [ ] appendToDerivedList preserves within-call multiplicity (seeded `existing` set ONCE before loop, never mutated inside)
- [ ] refillQueue Step 1 uses append + walk instead of consuming buildConceptBatch directly
- [ ] Wave 0 derived-list test 10/10 GREEN (including Test 10 multiplicity preservation)
- [ ] No regression in any existing post-queue / concept-batch / concept-feed test
- [ ] tsc clean
- [ ] buildConceptBatch body byte-unchanged
- [ ] Phase 33 gap fixes preserved (explored-filter at buildConceptBatch + allExplored cap gate)
- [ ] No new localStorage keys
- [ ] Two atomic commits (Task 1 = post-queue extension; Task 2 = concept-feed wiring) OR one combined commit if executor prefers
</success_criteria>

<output>
After completion, create `.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-03-SUMMARY.md` with:
- Diff size for both files (lines added/removed)
- Wave 0 derived-list test results (paste node --test summary — 10/10 expected)
- Confirmation of buildConceptBatch byte-unchanged
- Confirmation of Phase 33 explored-filter + cap-gate preserved
- Git commit hash(es)
</output>
</output>
