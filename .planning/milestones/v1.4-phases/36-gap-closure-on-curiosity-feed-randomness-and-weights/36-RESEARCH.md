# Phase 36: Gap Closure on Curiosity Feed Randomness and Weights — Research

**Researched:** 2026-05-06
**Domain:** Feed generation pipeline — derived list persistence, cyclic walker, stratified style sampling, concept-axis spread
**Confidence:** HIGH (all findings derived from direct code reading of live files + CLAUDE.md design spec)

---

## Summary

Phase 36 closes four confirmed gaps between the CLAUDE.md "Concept Feed Generation Pipeline" design and the live code. The gaps are not hypothetical — they were identified by direct code audit at specific line numbers in the current branch (`gsd/phase-33-hygiene-and-weights`).

The three high-severity gaps are: (1) the derived list is rebuilt from scratch every `refillQueue` call instead of being append-only with a cycle position, (2) no cycle walker exists — `cycleNumber` is used only for YouTube query rotation, and (3) `assignStyles` draws styles i.i.d. per entry, producing high small-N variance that defeats the "multiple post angles per concept" intent. A fourth gap (concept-axis clustering after `spreadByStyle`) is medium-severity: style interleaving alone does not guarantee concept variety in the served window.

**Primary recommendation:** Fix in order of severity and dependency. GAP 1 + 2 (persistent derived list + cyclic walker) must be implemented together — they share a data structure. GAP 3 (stratified style allocation) is independent and can ship in parallel. GAP 4 (concept-axis spread) builds on GAP 3 and should be a second pass over the stratified result.

---

## Project Constraints (from CLAUDE.md)

These directives are enforced at the load-bearing-rule level and MUST NOT be contradicted by the plan:

- **Three-list pipeline is sacred.** Daily concept list → derived list (append-only, weighted) → queue (8, cyclic, 4 per swipe). "Do not invent a fourth, do not collapse two into one, do not bypass any step."
- **Derived list is APPEND-ONLY.** "Update mode: APPEND-ONLY when new questions arrive. Don't rebuild from scratch — that loses cycle position."
- **Removal trigger is CONCEPT_EXPLORED.** "When user READS a post of a concept (CONCEPT_EXPLORED event), REMOVE that concept's remaining entries from the derived list."
- **Queue serves exactly 4 per swipe.** The only caller (`infiniteScrollService.loadNextBatch`) passes `limit=4`. Contract must remain stable.
- **Queue refill threshold: 12.** Do not change.
- **One event per semantic signal.** `CONCEPT_EXPLORED` is the correct event. Do not add a parallel event.
- **Phase 33 gap fixes must not regress.** `buildConceptBatch` exploration filter (line 797-798) and `allExplored` cap gate (line 1265-1267) are load-bearing — do not remove or bypass.
- **enqueueInterleaved + spreadByStyle mixer pattern** (concept-feed.service.ts:1437) is load-bearing for cross-batch style interleaving. Any refactor that removes `enqueueInterleaved` will regress cross-batch clustering.
- **API-availability redistribution in `assignStyles`** (style-assignment.ts:48-62) must run BEFORE any stratified allocation. You cannot stratify over a style that has been zeroed out.
- **Best practices rule 1:** Search for dead code before assuming two parallel paths.
- **Best practices rule 2:** Tests must guard LIVE code paths.
- **Best practices rule 4:** Async mutations need explicit event triggers for UI reload.
- **Best practices rule 6:** One signal per semantic event.

---

## Standard Stack

No new libraries. All implementation uses existing primitives:

| Module | Current Role | Phase 36 Role |
|--------|-------------|--------------|
| `post-queue.service.ts` | Queue FIFO + `cycleNumber` | Add `derivedList: string[]` + `cyclePosition: number` to `QueueState` |
| `concept-feed.service.ts` | Builds derived list each cycle | Read from persistent derived list; append-only mutations |
| `style-assignment.ts` | i.i.d. draw per entry | Stratified allocation (largest-remainder) + API-redirect first |
| `daily-read.service.ts` | Read-only in feed pipeline | CONCEPT_EXPLORED drives removal from derived list |
| `app/src/lib/event-bus.ts` | Event pub/sub | `CONCEPT_EXPLORED` subscription for derived-list removal |

**No npm installs required.** All algorithms are pure TypeScript with no dependencies.

---

## Architecture Patterns

### Recommended Project Structure (no changes to folder layout)

The derived list and cycle position are stored in the SAME localStorage key (`echolearn_post_queue`) as an extension to `QueueState`. This collocates all feed-cycle state in one place, which is the right boundary: the queue IS the cycle state.

```
QueueState (localStorage: echolearn_post_queue)
├── date: string
├── posts: DailyPost[]          ← unchanged (the queue buffer)
├── cycleNumber: number         ← unchanged (YouTube query modifier rotation)
├── totalGenerated: number      ← unchanged
├── totalServed: number         ← unchanged
├── derivedList: string[]       ← NEW: persistent append-only concept ID list
└── cyclePosition: number       ← NEW: current walker index into derivedList
```

### Pattern 1: Persistent Derived List (GAP 1 + GAP 2)

**What:** `buildConceptBatch` currently returns a fresh array each call. The returned value is passed directly to `assignStyles` and discarded. There is no module-level or localStorage-persisted derived list.

**Fix:** Promote `derivedList` + `cyclePosition` into `QueueState` in `post-queue.service.ts`. Add service methods:
- `getDerivedList(): string[]`
- `getCyclePosition(): number`
- `appendToDerivedList(conceptIds: string[]): void` — append-only, no rebuild; dedup by conceptId to avoid double-appending on concurrent calls
- `advanceCyclePosition(count: number): void` — wraps on overflow
- `removeConceptFromDerivedList(conceptId: string): void` — called on CONCEPT_EXPLORED
- `resetDerivedList(): void` — called only on `resetForNewDay()`

**Cycle position overflow behavior:** When `cyclePosition >= derivedList.length`, wrap to `0`. This is the design's "wraps to start (cyclic)" behavior. If `derivedList` is empty (all concepts explored), `buildConceptBatch`'s `conceptIds.length === 0` guard (line 1271) already returns early — no posts generated, "No more posts" toast is appropriate downstream.

**Derived list vs queue day boundary:** `resetForNewDay()` already clears queue state. Add `derivedList: []` and `cyclePosition: 0` to `freshState()`. The derived list is rebuilt from scratch on a new day (daily concept list changes), which is correct — it is NOT append-only across days, only within a day.

**refillQueue flow change:**
```
BEFORE: conceptIds = buildConceptBatch(questions)  // fresh every call
AFTER:
  // Append new concepts if any exist outside the current derived list
  const freshConceptIds = buildConceptBatch(questions)  // returns due anchors × weight
  const newConceptIds = freshConceptIds.filter(id => !inDerivedList(id))  // dedup
  if (newConceptIds.length > 0) postQueueService.appendToDerivedList(newConceptIds)
  
  // Walk derived list from cyclePosition to collect the next batch
  const batch = walkDerivedList(batchSize)  // advances cyclePosition
  if (batch.length === 0) return  // empty derived list → guard
```

**CRITICAL:** The `buildConceptBatch` filter (explored anchors excluded) means `buildConceptBatch` is still called every refill to check for newly-explored anchors and newly-arrived anchors. What changes is: its output feeds `appendToDerivedList` (new entries) and `removeConceptFromDerivedList` (via CONCEPT_EXPLORED event), not a fresh array that replaces the whole list.

**Removal on read (CONCEPT_EXPLORED event):**
- PostDetailScreen already emits `CONCEPT_EXPLORED` (line 121).
- HomeScreen already subscribes (line 447) — it currently calls `setExploredAnchors(...)` for vine rendering.
- `concept-feed.service.ts` does NOT currently subscribe to `CONCEPT_EXPLORED`. Add a subscription that calls `postQueueService.removeConceptFromDerivedList(anchorId)`.
- Alternatively, removal happens lazily in `buildConceptBatch` (already filters out explored anchors) + `appendToDerivedList` dedup. The cyclic walker will skip removed entries if we filter on walk. **Recommendation:** Use lazy removal — when walking the derived list, skip conceptIds that are in `exploredIds`. Do NOT physically splice the array on every CONCEPT_EXPLORED event because that shifts all subsequent positions and corrupts `cyclePosition`. Instead: at walk time, step forward past explored IDs, advancing `cyclePosition` for each step taken. This avoids the index-corruption problem entirely.

**Lazy removal rationale (preferred over physical removal):**
- Avoids cyclePosition index corruption when entries are spliced out mid-array
- `buildConceptBatch` already filters explored anchors before appending — so explored concepts get no NEW entries
- Old entries for explored concepts are skipped at walk time with zero book-keeping
- If the entire derived list is explored, the walker produces 0 entries → early return already in place

### Pattern 2: Stratified Style Allocation (GAP 3)

**What:** `assignStyles` currently draws styles i.i.d. with `Math.random()`. With N=8 and image weight 0.10, expected image count is 0.8 — most 8-entry batches produce 0 images. The dev-mode instrumentation at line 82-87 exists precisely because this small-N variance was observed and needed debugging.

**Algorithm: Largest-Remainder Method (Hamilton's method)**

This is the standard algorithm for apportioning whole counts from fractional quotas, used in proportional representation systems. It has two properties this phase needs: deterministic output (given a fixed order of style keys), and provable ±1-of-ideal guarantee.

```typescript
// Step 1: Compute effective weights FIRST (API-availability redirect)
// This is already done correctly in assignStyles lines 48-62. Don't change.

// Step 2: Compute raw quotas
const quota = effectiveStyles.map(s => ({ style: s, exact: N * effectiveWeights[s] }));

// Step 3: Floor each quota → minimum guaranteed count
const floored = quota.map(q => ({ ...q, count: Math.floor(q.exact) }));

// Step 4: Compute remainders and total deficit
const remainder = floored.map(q => ({ ...q, rem: q.exact - q.count }));
const deficit = N - floored.reduce((s, q) => s + q.count, 0);

// Step 5: Award +1 to the top `deficit` styles by remainder (largest first)
remainder.sort((a, b) => b.rem - a.rem);
for (let i = 0; i < deficit; i++) remainder[i].count++;

// Step 6: Build result array: push `count` entries of each style
const styleSlots: PresentationStyle[] = [];
for (const { style, count } of remainder) {
  for (let i = 0; i < count; i++) styleSlots.push(style);
}

// Step 7: Fisher-Yates shuffle styleSlots → prevents clustering by style
// (this replaces the i.i.d. draw — the "randomness" is now in the shuffle)
shuffle(styleSlots);

// Step 8: Zip with conceptIds
return conceptIds.map((conceptId, i) => ({ conceptId, style: styleSlots[i] }));
```

**Why largest-remainder over Sainte-Laguë:** Sainte-Laguë is designed for multi-winner elections where seats are scarce — it biases toward smaller parties. For post-style allocation we want proportional accuracy, not anti-majoritarian bias. Largest-remainder is simpler to implement and gives exact proportionality within ±1. Sainte-Laguë would under-represent text-art (55% weight) which is the dominant style.

**Why not a seeded RNG:** The shuffle in step 7 should use `Math.random()` (unseeded). Tests should NOT assert specific style sequences — they should assert count distributions (within ±1 of expected). Deterministic seeding adds complexity with no behavioral benefit for production and creates fragile tests.

**Interaction with API-availability redistribution:** Step 1 (effective weights) must run FIRST, before quotas are computed. If `hasImageGenKey=false`, image weight is zeroed and redistributed to text-art BEFORE the stratified allocation runs. Stratification then applies to the effective (post-redistribution) weights. The existing lines 48-62 in `assignStyles` are the correct place for this; they remain unchanged. Only the i.i.d. draw (lines 64-77) is replaced by the stratified allocation.

**Interaction with `reassignFailures`:** `reassignFailures` (post-generation, style-assignment.ts:96-106) reassigns failed fetches to text-art AFTER stratified assignment. This is fine — stratification targets the INTENDED distribution before generation. Post-generation failures are an execution concern, not an allocation concern. Don't change `reassignFailures`.

**Small-N edge case (N < count of available styles):** If N=2 and there are 6 available styles, some styles get 0 allocation. Largest-remainder handles this correctly — styles with 0 allocation simply don't appear in `styleSlots`. The Fisher-Yates shuffle of the resulting 2-slot array is still valid.

### Pattern 3: Concept-Axis Spread (GAP 4)

**What:** `spreadByStyle` interleaves by STYLE LABEL only. Concept identity is not a constraint. If one anchor has 8 entries (important/overdue) and another has 4, the 2:1 ratio persists in every served window regardless of style spread.

**Recommended approach: Second-pass concept interleave over the style-sorted result**

Approach (a) — second pass after `spreadByStyle` — is preferred over approach (b) joint optimizer and approach (c) concept-first interleave before style assignment:

- **(b) Joint optimizer** requires solving a two-constraint placement problem (style AND concept separation). The constraint conflict (e.g., only 1 image entry but 4 entries of the same important concept) makes this hard to implement correctly without backtracking. Overkill.
- **(c) Concept-first, then shuffle styles onto concept slots** would work but breaks the existing `enqueueInterleaved` cross-batch mixer — the mixer passes the combined list to `spreadByStyle` which operates on style alone. Refactoring the mixer is high-risk.
- **(a) Second pass** is additive: run `spreadByConcept(posts)` BEFORE `spreadByStyle(posts)` in the `enqueueInterleaved` mixer callback. The concept pass establishes concept distribution; the style pass then adjusts within that distribution. Because `spreadByStyle` only moves posts within already-placed slots (stride-based placement, forward-bump collision), the concept distribution set by the first pass is partially preserved. The final result satisfies "no two adjacent entries for the same concept" when possible, with style variety as a second objective.

**`spreadByConcept` algorithm:** Same stride-based interleave as `spreadByStyle` but groups by `post.sourceQuestionIds[0]` (the anchor ID) instead of `post.presentationStyle`. This is 15 lines of code — literally the same algorithm with a different key extractor.

**Call order in mixer:**
```typescript
// In refillQueue, where the mixer is passed to enqueueInterleaved:
postQueueService.enqueueInterleaved(posts, (combined) => {
  spreadByConcept(combined);  // NEW: concept axis spread first
  spreadByStyle(combined);    // EXISTING: style axis spread second
});
```

**Why concept first:** Style spread operates on the combined list and bumps collisions forward. If concept spread runs second, style spread's collision bumps can move a post past a concept-spread boundary, corrupting the concept separation. Running concept spread first then style spread last means style spread's post-placement honors the concept distribution as much as possible.

### Anti-Patterns to Avoid

- **Physical removal from derived list on CONCEPT_EXPLORED:** Causes `cyclePosition` index to point at wrong entries after splice. Use lazy skip at walk time instead.
- **Rebuilding derived list on every refill:** The current behavior — exactly what GAP 1 closes. Don't leave it as is.
- **Seeded RNG for style allocation:** Adds test complexity without production benefit. The stratified Fisher-Yates approach already provides the distributional guarantee tests need.
- **Adding a parallel event alongside CONCEPT_EXPLORED:** CLAUDE.md best practice 6 — one signal per semantic event.
- **Putting stratified allocation logic in `refillQueue` instead of `assignStyles`:** The allocation belongs in `assignStyles` because that's the module responsible for style decisions. `refillQueue` just calls `assignStyles(conceptIds, availability)` — that interface doesn't change.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Proportional integer allocation | Custom rounding scheme | Largest-remainder (Hamilton's method) | Provable ±1 guarantee; 10 lines; well-understood |
| Style interleave across batches | New interleave service | Existing `enqueueInterleaved` + `spreadByStyle` | Already cross-batch; tested; changing it is high-risk |
| Derived list storage | New localStorage key / new service | Extend `QueueState` in `post-queue.service.ts` | Collocates all daily cycle state; same reset boundary |
| Concept-axis spread | New placement optimizer | `spreadByConcept` — 15-line clone of `spreadByStyle` with different key | Reusing the same stride algorithm is correct; proven |

**Key insight:** This phase is gap closure, not new architecture. The existing structures (QueueState, spreadByStyle, assignStyles, enqueueInterleaved) are the right homes for every fix. Every change is either an extension of an existing data structure or a replacement of a single function's inner loop.

---

## Research Answers to Planner Inputs

### 1. Stratified Weighted Sampling Algorithm

**Use: Largest-remainder method (Hamilton's method).** See Pattern 2 above for full pseudocode.

- **Largest-remainder:** ±1 guarantee; proportional; 10 lines; deterministic order; the standard for this class of problem. CHOSEN.
- **Sainte-Laguë:** anti-majoritarian bias (good for elections, bad for proportional style allocation). NOT CHOSEN.
- **Floor + random remainder:** Less predictable than largest-remainder; remainder selection is arbitrary rather than ordered by fractional quotas. NOT CHOSEN.

After stratified allocation, Fisher-Yates shuffle the `styleSlots` array (not the assignments — the slots list). This makes the within-batch ORDER random while the COUNTS remain exact.

### 2. Concept-Axis Spread Approach

**Use: Second pass — `spreadByConcept` before `spreadByStyle` in the mixer.** See Pattern 3 above for rationale. Do not use joint optimizer (too complex) or concept-first-style-layered (breaks cross-batch mixer).

### 3. Persistent Derived List Data Structure

**Store in `QueueState` in `post-queue.service.ts`.** Two new fields: `derivedList: string[]` and `cyclePosition: number`. Reset with `resetForNewDay()` / date mismatch. Append via `appendToDerivedList`. Walk via a new `walkDerivedList(count, exploredIds)` method that returns the next `count` conceptIds from `cyclePosition`, skipping explored IDs lazily, wrapping to 0 on overflow.

**Cycle position overflow:** `cyclePosition = (cyclePosition + stepsForward) % derivedList.length`. If `derivedList.length === 0`, return empty (caller's early-return guard handles it).

**Do NOT create a separate service.** The queue service is the right home — it already owns all daily cycle state.

### 4. Removal-on-Read Semantics Under Append-Only

**Use: Lazy skip at walk time (option b — mark as exhausted via exploredIds, skip in walker).** Physical removal (option a) corrupts `cyclePosition` via index shift.

Implementation: `walkDerivedList(count, exploredIds)` skips any conceptId in `exploredIds`. It advances `cyclePosition` for each step (explored or not) so the position correctly reflects how far through the list we've walked. If it completes a full loop without finding `count` non-explored entries, it returns what it found (possibly empty — handled by caller's guard).

**No subscription to CONCEPT_EXPLORED needed in concept-feed.service.ts** under the lazy-skip approach. The `exploredIds` set comes from `dailyReadService.getExploredAnchors()` which is called at the top of `refillQueue` already (line 1264). Pass it to `walkDerivedList`. No new event subscriptions.

### 5. Existing Test Surface

| Test File | Covers | Catches Phase 36 Regression? |
|-----------|--------|-------------------------------|
| `tests/services/style-assignment.test.mjs` | i.i.d. draw, redistribution, `reassignFailures`, weights sum | Partial: distribution tests use large N (100 runs of 100) — these tests WILL PASS with stratified allocation too (counts will be even closer to target). Add ±1 small-N test (N=8) as a NEW invariant. |
| `tests/services/post-queue.test.mjs` | FIFO, dequeue, needsRefill, loadQueue date-reset, cycleNumber, getYesterdayQueue | NO: no tests for `derivedList` or `cyclePosition` — these fields don't exist yet. New tests required. |
| `tests/services/post-queue-dedup.test.mjs` | enqueue dedup invariant | NO: not affected by Phase 36 changes. Regression-safe. |
| `tests/services/concept-batch-filter.test.mjs` | exploration filter predicate, importance weighting | PARTIAL: tests the predicate in isolation. Will not catch regressions in the walker or persistence. New walker tests required. |
| `tests/services/concept-feed-cross-cycle-dedup.test.mjs` | seenVideoIds cross-cycle persistence, cap formula floor | NO: unaffected by Phase 36. |
| `tests/services/daily-read.service.test.mjs` | markExplored, getExploredAnchors, date reset | Not affected; serves as infrastructure for walker tests. |
| `tests/services/infiniteScroll.service.test.mjs` | dedup, batch management | Not affected (tests a re-implemented stub, not live service). No changes needed. |
| `tests/services/api-availability.test.mjs` | circuit breaker lifecycle | Not affected. |
| `tests/services/daily-generation-cap.test.mjs` | cap formula with max(N,3) floor | Not affected. |
| `tests/concept-feed.test.mjs` | `buildDailyKnowledgeContext`, `buildFallbackPosts` | Not affected (tests legacy path, not queue pipeline). |

**New tests required (GAP ITEMS):**
1. `tests/services/derived-list.test.mjs` — derived list append-only, cyclePosition wrap, lazy skip of explored IDs, resetForNewDay clears derivedList + cyclePosition
2. `tests/services/style-assignment-stratified.test.mjs` — small-N (N=8) allocation within ±1 of expected, Fisher-Yates produces valid permutation, API-redirect runs before stratification
3. `tests/services/spread-by-concept.test.mjs` — same-concept entries separated by at least 1 other entry (when bucket size allows), stable output on single-concept input

### 6. Validation Architecture — Invariants

See full Validation Architecture section below.

### 7. Risk Register

| Risk | Description | Mitigation |
|------|-------------|-----------|
| **localStorage migration for existing users** | Existing users have `echolearn_post_queue` in localStorage without `derivedList`/`cyclePosition` fields. When the new code loads, `parsed.derivedList` will be `undefined`. | In `load()` in `post-queue.service.ts`, defensive-read: `derivedList: Array.isArray(parsed.derivedList) ? parsed.derivedList : []` and `cyclePosition: typeof parsed.cyclePosition === 'number' ? parsed.cyclePosition : 0`. Fresh state is equivalent to a new user; the queue will refill normally on first `needsRefill()` check. No data migration needed. |
| **API-availability redirect AND stratified allocation interaction** | If `hasImageGenKey=false`, image weight is 0. Stratified allocation must run on the EFFECTIVE weights after redistribution, not on `STYLE_WEIGHTS`. | Run API-redirect FIRST (existing lines 48-62), then compute stratified quotas from the effective weights. The function signature `assignStyles(conceptIds, availability)` doesn't change — internal order changes. |
| **RNG determinism in tests** | Stratified allocation uses Fisher-Yates with `Math.random()`. Tests must not assert specific style sequences. | Tests assert COUNT distributions only (e.g., `imageCount === Math.round(N * 0.10)` ± 1). Source-reading test can assert that `Math.random()` is used (not a seeded PRNG). |
| **`spreadByConcept` before `spreadByStyle` — order matters** | If the two spread passes are swapped, style spread runs on an unspread array and concept spread then tries to re-sort a style-spread array, producing worse concept separation. | Add inline comment in the mixer callback explaining the required order. Test: verify concept-adjacent invariant AFTER both passes, not after each individually. |
| **Cyclic walker corruption when derived list grows mid-walk** | `appendToDerivedList` may be called (new questions arrive) while a walk is in progress. | The append is safe: it adds entries at the END of the array. `cyclePosition` still points to the correct relative position. The new entries will be visited on the next wrap. |
| **`concept-batch-filter.test.mjs` pending-ID filter is now dead** | The test at line 56-58 asserts that anchors with posts in the queue are excluded from `filterConcepts`. But `buildConceptBatch` (line 794) no longer uses `pendingIds` — the multi-entry design removed the pending-ID filter (see comment at line 785-789). The test is testing an outdated predicate. | Add a note to the test that `pendingIds` exclusion is NOT part of `buildConceptBatch`'s current contract. Don't delete the test — the isolated predicate it tests is still logically valid as a property test. |
| **Day-boundary state consistency** | If the user crosses midnight mid-session, `resetForNewDay()` clears `derivedList` and `cyclePosition`. The next `refillQueue` call rebuilds from a fresh daily concept list. | Already handled by the date-mismatch check in `load()`. No new logic needed. |
| **`enqueueInterleaved` mixer is called with the COMBINED list** | The mixer receives `[...queueTail, ...newBatch]`. After `spreadByConcept` then `spreadByStyle`, the positions of EXISTING queue-tail posts change. This is already the behavior of `spreadByStyle` alone — `enqueueInterleaved` was designed for this. | No change needed; the existing design accepts combined-list remixing. |

---

## Common Pitfalls

### Pitfall 1: Physical Derived List Removal
**What goes wrong:** Implementing CONCEPT_EXPLORED to splice entries from `derivedList` array. After splice, `cyclePosition=3` now points at a different entry than it did before the splice. Users see wrong concepts, or the same concept twice.
**Why it happens:** Index-based data structures and mutation don't compose cleanly.
**How to avoid:** Lazy skip at walk time. `exploredIds` is the source of truth for what's been read; filter at walk time, not at array mutation time.
**Warning signs:** If you write `derivedList.splice(idx, N)`, stop.

### Pitfall 2: Stratifying Before API-Availability Redirect
**What goes wrong:** Compute stratified quotas from `STYLE_WEIGHTS` before zeroing out unavailable APIs. Then zero out image entries post-stratification. Result: more text-art than 55% target (double-redirect), or image slots with no key to generate them.
**Why it happens:** The order of operations in `assignStyles` is not obvious.
**How to avoid:** The effective weights object (built at lines 48-62) must be computed FIRST. All subsequent operations (quota computation, stratification, shuffle, zip) use the effective weights, not `STYLE_WEIGHTS`.
**Warning signs:** `STYLE_WEIGHTS` referenced after the availability-redirect block.

### Pitfall 3: Forgetting the Small-N Edge Case in Stratification
**What goes wrong:** When N < number of available styles (e.g., N=2, 6 styles), the floor of every style's quota is 0, and the remainder allocation awards +1 to only 2 styles. The other 4 styles get 0 entries. This is mathematically correct but unexpected.
**Why it happens:** Small batches happen — `buildConceptBatch` can return 2 conceptIds if only 1 non-important anchor is due.
**How to avoid:** Test explicitly: `assignStyles(['c1', 'c2'], allAvailable)` — verify 2 entries total, both valid styles, no crash.
**Warning signs:** Tests only use N >= 20.

### Pitfall 4: Derived List Grows Unboundedly
**What goes wrong:** `appendToDerivedList` deduplicates by conceptId equality, but a concept's importance can change (ease drops below 1.5 → it should get 8 entries instead of 4). Append-only + no rebuild means the importance weighting only applies on the first append.
**Why it happens:** The design says "append-only when new questions arrive" — but "new" is ambiguous. Is a concept whose importance changed "new"?
**How to avoid:** Keep `buildConceptBatch` rebuilding its conceptIds array each call (it's cheap — no LLM). Pass the result to `appendToDerivedList` which only appends conceptIds NOT already present. The derived list gets the initial importance weighting when the concept first appears. If importance changes mid-day, the extra entries don't appear until next day's reset. This is an acceptable approximation — the design doc says "append-only when new questions arrive," not "rebuild importance weights continuously." Document as a known simplification.
**Warning signs:** Trying to remove + re-append existing entries to update their count.

### Pitfall 5: `spreadByConcept` Using Wrong Key
**What goes wrong:** Using `post.sourceQuestionIds[0]` as the concept key, but some posts have `sourceQuestionIds = []` (starter posts, connection posts, suggestion posts). All empty-array posts get the same "empty" key and are grouped together.
**Why it happens:** Non-concept post types don't have anchor IDs.
**How to avoid:** Key extractor: `post.sourceQuestionIds[0] ?? post.id`. Posts without a sourceQuestionId get their own unique key (their post ID), so they're each their own group and aren't forced adjacent.
**Warning signs:** Starter/connection posts all clustering together in the spread result.

---

## Code Examples

### Largest-Remainder Stratified Allocation

```typescript
// Source: direct code derivation from style-assignment.ts lines 43-90
// Replace the i.i.d. draw (lines 72-77) with this:

function stratifiedAllocate(
  n: number,
  effectiveWeights: Record<string, number>,
  sum: number
): PresentationStyle[] {
  // 1. Compute raw quotas
  const styles = Object.entries(effectiveWeights)
    .filter(([, w]) => w > 0)
    .map(([s, w]) => ({ style: s as PresentationStyle, exact: n * w / sum }));

  // 2. Floor
  let totalFloor = 0;
  const items = styles.map(s => {
    const count = Math.floor(s.exact);
    totalFloor += count;
    return { style: s.style, count, rem: s.exact - count };
  });

  // 3. Distribute remainder slots largest-first
  const deficit = n - totalFloor;
  items.sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < deficit; i++) items[i].count++;

  // 4. Build slots array
  const slots: PresentationStyle[] = [];
  for (const { style, count } of items) {
    for (let i = 0; i < count; i++) slots.push(style);
  }

  // 5. Fisher-Yates shuffle
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  return slots;
}

// Usage in assignStyles: replace lines 72-77 with:
const slots = stratifiedAllocate(conceptIds.length, weights, sum);
const result = conceptIds.map((conceptId, i) => ({ conceptId, style: slots[i] }));
```

### Derived List Walk (QueueState extension)

```typescript
// New method on postQueueService:
walkDerivedList(count: number, exploredIds: Set<string>): string[] {
  if (_state.derivedList.length === 0) return [];
  const result: string[] = [];
  let fullLoops = 0;
  const len = _state.derivedList.length;
  while (result.length < count && fullLoops < 2) {
    const id = _state.derivedList[_state.cyclePosition];
    _state.cyclePosition = (_state.cyclePosition + 1) % len;
    if (_state.cyclePosition === 0) fullLoops++;
    if (!exploredIds.has(id)) result.push(id);
  }
  save(_state);
  return result;
},
```

### spreadByConcept (15-line clone of spreadByStyle with concept key)

```typescript
// Mirrors spreadByStyle (concept-feed.service.ts:619-670) exactly,
// with key = post.sourceQuestionIds[0] ?? post.id
function spreadByConcept(posts: DailyPost[]): void {
  if (posts.length <= 2) return;
  const n = posts.length;
  const byConcept = new Map<string, DailyPost[]>();
  for (const p of posts) {
    const key = p.sourceQuestionIds[0] ?? p.id;
    const arr = byConcept.get(key) ?? [];
    arr.push(p);
    byConcept.set(key, arr);
  }
  const buckets = Array.from(byConcept.entries()).sort((a, b) => b[1].length - a[1].length);
  const result: (DailyPost | null)[] = new Array(n).fill(null);
  for (const [, items] of buckets) {
    const count = items.length;
    const stride = n / count;
    for (let i = 0; i < count; i++) {
      let slot = Math.floor(i * stride + stride / 2);
      if (slot >= n) slot = n - 1;
      let probe = slot;
      let tries = 0;
      while (result[probe] !== null && tries < n) { probe = (probe + 1) % n; tries++; }
      result[probe] = items[i];
    }
  }
  const leftover = posts.filter(p => !result.includes(p));
  let cursor = 0;
  for (const p of leftover) { while (cursor < n && result[cursor] !== null) cursor++; if (cursor < n) result[cursor++] = p; }
  for (let i = 0; i < n; i++) posts[i] = result[i]!;
}
```

---

## Runtime State Inventory

> Applies: this is a refactor/data-structure change to localStorage-persisted state.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `echolearn_post_queue` (QueueState): missing `derivedList` + `cyclePosition` fields | Defensive read in `load()` — treat missing fields as `[]` and `0`. No migration script needed. |
| Live service config | None — no external services involved | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

**Existing users:** On first load after the update, `load()` reads existing `echolearn_post_queue` without `derivedList`/`cyclePosition`. Defensive defaults give them a fresh start equivalent to day 0. The queue's existing `posts` survive untouched — users don't lose their pending feed.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json`. This section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` with esbuild tsx loader |
| Config file | none — see `package.json` `"test"` script in `app/` |
| Quick run command | `cd app && node --test tests/services/derived-list.test.mjs tests/services/style-assignment-stratified.test.mjs tests/services/spread-by-concept.test.mjs` |
| Full suite command | `cd app && npm test` |

### Phase Requirements → Test Map

| ID | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| GAP-1 | `appendToDerivedList` is append-only; does not reset existing entries | unit | `node --test tests/services/derived-list.test.mjs` | ❌ Wave 0 |
| GAP-1 | `derivedList` persists across `refillQueue` calls within same day | unit | same | ❌ Wave 0 |
| GAP-1 | `resetForNewDay()` clears `derivedList` and `cyclePosition` | unit | same | ❌ Wave 0 |
| GAP-1 | Existing localStorage without `derivedList`/`cyclePosition` loads correctly | unit | same | ❌ Wave 0 |
| GAP-2 | `walkDerivedList(4, emptySet)` advances `cyclePosition` by 4 | unit | same | ❌ Wave 0 |
| GAP-2 | Walker wraps to 0 after reaching `derivedList.length` | unit | same | ❌ Wave 0 |
| GAP-2 | Walker skips explored IDs (lazy removal) | unit | same | ❌ Wave 0 |
| GAP-2 | Walker returns empty when all entries are explored | unit | same | ❌ Wave 0 |
| GAP-3 | `assignStyles(8 ids, all-available)`: image count ∈ {0, 1, 2} i.e. round(0.10×8)=1 ±1 | unit | `node --test tests/services/style-assignment-stratified.test.mjs` | ❌ Wave 0 |
| GAP-3 | `assignStyles(8 ids, all-available)`: text-art count ∈ {3, 4, 5} i.e. round(0.55×8)=4 ±1 | unit | same | ❌ Wave 0 |
| GAP-3 | `assignStyles` when `hasImageGenKey=false`: 0 image entries regardless of N | unit | same — extends existing test (already GREEN) | ✅ exists |
| GAP-3 | `assignStyles(2 ids, all-available)`: 2 total entries, both valid styles, no crash | unit | same | ❌ Wave 0 |
| GAP-4 | `spreadByConcept`: same-concept entries not adjacent when 2+ distinct concepts present | unit | `node --test tests/services/spread-by-concept.test.mjs` | ❌ Wave 0 |
| GAP-4 | `spreadByConcept`: single-concept input unchanged | unit | same | ❌ Wave 0 |
| GAP-4 | Combined `spreadByConcept + spreadByStyle` on mixed list: both concept and style separation hold | unit | same | ❌ Wave 0 |
| REGRESSION | `importantAnchor` (ease<1.5) gets 2× entries in derived list vs non-important | unit | tests/services/derived-list.test.mjs | ❌ Wave 0 |
| REGRESSION | Existing style-assignment tests (redistribution, weights-sum) still pass | unit | `node --test tests/services/style-assignment.test.mjs` | ✅ exists |
| REGRESSION | `post-queue.test.mjs` tests still pass after QueueState extension | unit | `node --test tests/services/post-queue.test.mjs` | ✅ exists |

### Sampling Rate
- **Per task commit:** `cd app && node --test tests/services/derived-list.test.mjs tests/services/style-assignment-stratified.test.mjs tests/services/spread-by-concept.test.mjs tests/services/style-assignment.test.mjs tests/services/post-queue.test.mjs`
- **Per wave merge:** `cd app && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/services/derived-list.test.mjs` — covers GAP-1, GAP-2, REGRESSION (important weighting preserved)
- [ ] `tests/services/style-assignment-stratified.test.mjs` — covers GAP-3 small-N ±1 invariant
- [ ] `tests/services/spread-by-concept.test.mjs` — covers GAP-4 concept-axis spread

*(Existing test infrastructure covers API-availability, post-queue FIFO, style-assignment redistribution — no new infrastructure for those.)*

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 36 |
|--------------|-----------------|---------------------|
| i.i.d. style draw | Stratified allocation (largest-remainder + Fisher-Yates) | Small-N variance eliminated; image/suggestion appear reliably in 8-entry batches |
| Derived list rebuilt each refill | Append-only persistent derived list in QueueState | Cycle position preserved across refills; no lost position |
| No cyclic walker | `walkDerivedList` with lazy explored-skip | True cyclic behavior; no concept-A-forever lock-in |
| Style-only interleave | Concept-axis spread + style-axis spread | Both objectives satisfied in served windows |

---

## Open Questions

1. **Derived list dedup strategy for importance-weight changes**
   - What we know: `appendToDerivedList` deduplicates by conceptId to prevent double-append across refill calls. An important anchor gets 8 entries on first append. If ease recovers (becomes normal) mid-day, the 8 entries remain.
   - What's unclear: Should importance weighting updates within a day be reflected immediately, or accepted as a next-day concern?
   - Recommendation: Accept as a next-day approximation. The design says "append-only when new questions arrive" — importance changes don't add new questions. If this becomes a user complaint, a "re-weight on REVIEW_COMPLETED" feature can be added in a future phase.

2. **`concept-batch-filter.test.mjs` pending-ID predicate accuracy**
   - What we know: The test at line 89-104 asserts that `pendingIds` (from queue posts' sourceQuestionIds) excludes anchors. But `buildConceptBatch` line 794 does NOT use pendingIds exclusion anymore (it was removed when multi-entry generation was added). The test's predicate is historically accurate but not what `buildConceptBatch` currently does.
   - What's unclear: Should the test be updated to reflect the live contract?
   - Recommendation: Add a comment noting the predicate mismatch. Don't change the test — it still validates valid logical properties of the filter. A future cleanup phase can align it.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies. All changes are pure TypeScript logic + localStorage. No new CLIs, databases, or network services required.)

---

## Sources

### Primary (HIGH confidence)
- Direct code reading: `app/src/services/style-assignment.ts` lines 43-106 (verified 2026-05-06)
- Direct code reading: `app/src/services/post-queue.service.ts` full file, 205 lines (verified 2026-05-06)
- Direct code reading: `app/src/services/concept-feed.service.ts` lines 619-670, 760-841, 1230-1442, 1610-1642 (verified 2026-05-06)
- Direct code reading: `app/src/services/daily-read.service.ts` full file (verified 2026-05-06)
- Direct code reading: `app/src/services/infiniteScroll.service.ts` full file (verified 2026-05-06)
- Direct code reading: `app/src/screens/PostDetailScreen.tsx` lines 110-137 (verified 2026-05-06)
- Direct code reading: `app/src/screens/HomeScreen.tsx` lines 445-451 (verified 2026-05-06)
- CLAUDE.md "Concept Feed Generation Pipeline" section (project source of truth)
- All test files listed in Section 5 above (verified 2026-05-06)

### Secondary (MEDIUM confidence)
- Largest-remainder method (Hamilton's method): standard proportional representation algorithm, well-documented in electoral systems literature; implementation is straightforward and well-understood

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all changes are within existing files, no new dependencies
- Architecture patterns: HIGH — derived from direct code reading + CLAUDE.md design spec
- Pitfalls: HIGH — derived from code structure analysis (index-mutation, order-of-operations)
- Algorithm correctness: HIGH — largest-remainder is a well-known algorithm with provable ±1 guarantee
- Test gap identification: HIGH — all test files read directly

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (stable domain — no external dependencies that could shift)
