---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 07
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/services/post-queue.service.ts
  - app/tests/services/derived-list.test.mjs
  - app/tests/services/refill-queue-integration.test.mjs
  - CLAUDE.md
autonomous: true
requirements: [GAP-B]
gap_closure: true
must_haves:
  truths:
    - "walkDerivedList(N, exploredIds) returns up to N entries regardless of whether exploredIds is empty — the count argument is fully respected. When ALL entries are explored, the walker returns []. Pre-fix maxSteps = len*2 silently capped returns at len×2 when count > len×2; post-fix maxSteps = Math.max(count*2, len) removes that cap."
    - "Specifically: walkDerivedList(16, new Set()) on a 4-entry derivedList returns 16 entries (4 wraps × 4 = 16) — the regression case Phase 36-04 missed."
    - "When the user has 1 non-important anchor (BASE_ENTRIES_PER_CONCEPT=4 → derivedList.length=4), text-art count satisfies floor(N×0.55)=8 across the 16 returned entries from a single refill cycle (text-art's remainder 0.80 beats minority remainders 0.60 at N=16, allowing the dominant style its bonus slot)."
    - "Existing termination semantics preserved: when ALL entries are explored, walker returns [] without infinite-loop (still bounded; max steps no longer below `count` and no longer below `len × 2`)."
  artifacts:
    - path: app/src/services/post-queue.service.ts
      provides: "walkDerivedList with corrected termination guard `Math.max(count * 2, len)`"
      contains: "Math.max(count * 2, len)"
    - path: app/tests/services/derived-list.test.mjs
      provides: "Regression test asserting walkDerivedList(16, new Set()) on a 4-entry list returns 16 entries"
      contains: "walkDerivedList(16, new Set())"
    - path: app/tests/services/refill-queue-integration.test.mjs
      provides: "Integration assertion that text-art count satisfies floor(N×0.55) at N=16"
      contains: "floor(N * 0.55)"
    - path: CLAUDE.md
      provides: "Walker termination-guard contract documented in Concept Feed Generation Pipeline section"
      contains: "Math.max(count * 2, len)"
  key_links:
    - from: "app/src/services/post-queue.service.ts:301 (maxSteps termination guard)"
      to: "app/src/services/style-assignment.ts (assignStyles called with the walker's output length)"
      via: "concept-feed.service.ts:1218 walkDerivedList(16, exploredIds) → assignStylesStratified consumes the returned conceptIds"
      pattern: "walkDerivedList\\(16"
---

<objective>
Close GAP-B (MAJOR — Phase 36 regression): the `walkDerivedList` termination guard at `post-queue.service.ts:301` (`const maxSteps = len * 2`) silently caps the returned batch at 2× derivedList.length entries, regardless of the requested `count`. With a single non-important anchor (BASE_ENTRIES_PER_CONCEPT=4 → derivedList.length=4), `maxSteps=8` truncates `walkDerivedList(16, ...)` to 8 entries → `assignStylesStratified` operates on N=8 instead of the intended N=16. At N=8 the largest-remainder math pins text-art at its floor (4/8 = 50%) because text-art's remainder (0.40) loses to all four minority 0.80 remainders. The N=16 walk request was deliberately sized to clear this threshold (text-art's remainder 0.80 BEATS minority 0.60 → text-art = 9/16 = 56%, hitting the design target). The cap defeats Phase 36-01's stratified-allocation design.

Phase 36-04 integration smoke (`refill-queue-integration.test.mjs:79-95`) only exercised `walkDerivedList(2, ...)` on a 4-entry list — count << maxSteps, so the truncation case was untested. Per CLAUDE.md "Phase 32.1 lessons" rule 2 (tests must guard the live code path), this is exactly the kind of escape that the existing test gave false confidence on.

Fix: replace `const maxSteps = len * 2` with `const maxSteps = Math.max(count * 2, len)`. Rationale (chosen over the `fullLoops < 2` alternative from RESEARCH):
- `Math.max(count * 2, len)` is a one-line drop-in; preserves the existing while-loop structure
- The `* 2` factor preserves the original lazy-skip headroom: walker can scan up to twice the request size to skip explored entries before terminating
- The `len` floor preserves the existing "at least one full pass possible even when count < len" property (matters for Test 9's all-explored case)
- The `fullLoops < 2` alternative from RESEARCH would need a parallel `fullLoops` counter and a `cyclePosition === 0` reset detection — more code, same effect
- Single-line change keeps the diff minimal and the contract obvious

Purpose: Restore the design intent that `walkDerivedList(16, ...)` actually returns 16 entries (modulo lazy-skip), so the stratified allocator receives N=16 and text-art lands at its 56% target instead of the floor-pinned 50%.

Output: One-line code change in post-queue.service.ts + extension of derived-list.test.mjs with the missed truncation-case test + integration assertion in refill-queue-integration.test.mjs that text-art ≥ floor(N×0.55) at N=16 + CLAUDE.md documentation of the walker contract.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT.md
@.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-RESEARCH.md
@.planning/debug/style-mix-imbalance.md
@CLAUDE.md
@app/src/services/post-queue.service.ts
@app/src/services/style-assignment.ts
@app/src/services/concept-feed.service.ts
@app/tests/services/derived-list.test.mjs
@app/tests/services/refill-queue-integration.test.mjs

<interfaces>
The walker function in scope (post-queue.service.ts:297-311):
```typescript
walkDerivedList(count: number, exploredIds: Set<string>): string[] {
  const len = _state.derivedList.length;
  if (len === 0) return [];
  const result: string[] = [];
  const maxSteps = len * 2;          // ← THE BUG: ignores `count`
  let steps = 0;
  while (result.length < count && steps < maxSteps) {
    const id = _state.derivedList[_state.cyclePosition];
    _state.cyclePosition = (_state.cyclePosition + 1) % len;
    steps++;
    if (!exploredIds.has(id)) result.push(id);
  }
  save(_state);
  return result;
}
```

Caller (concept-feed.service.ts:1218):
```typescript
const conceptIds = postQueueService.walkDerivedList(16, exploredIds);
```

Math walkthrough at N=8 vs N=16 (from style-mix-imbalance.md):
- N=8: text-art exact=4.40, floor=4, rem=0.40. Minority styles each rem=0.80. Top-4 remainders: image/news/video/short — text-art LOSES → text-art = 4/8 = 50%
- N=16: text-art exact=8.80, floor=8, rem=0.80. Minority styles each rem=0.60. text-art's 0.80 BEATS all → text-art = 9/16 = 56%

STYLE_WEIGHTS (style-assignment.ts:9-16):
```typescript
{ image: 0.10, 'text-art': 0.55, suggestion: 0.05, news: 0.10, video: 0.10, short: 0.10 }
```

The fix `Math.max(count * 2, len)` evaluations:
- count=2, len=4: max(4, 4) = 4 → walker can do 4 steps (2 per loop × 2 = enough for count=2 with explored skips). Test 8 (current) still passes.
- count=16, len=4: max(32, 4) = 32 → walker can do 32 steps; with all unexplored, returns 16 in 16 steps; with all explored, terminates after 32 steps with [].
- count=4, len=6 (Test 6): max(8, 6) = 8 → walker can do 8 steps; returns 4 in 4 steps. Unchanged.
- count=4, len=3 (Test 9): max(8, 3) = 8; with all 3 explored → walker does 8 steps, all skipped, returns []. Unchanged behavior.

All 10 existing derived-list.test.mjs cases continue to pass under `Math.max(count * 2, len)`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix walker termination guard in post-queue.service.ts</name>
  <files>app/src/services/post-queue.service.ts</files>
  <read_first>
    - app/src/services/post-queue.service.ts (full walkDerivedList method at lines 284-311 + the docstring above it)
    - .planning/debug/style-mix-imbalance.md (full diagnosis with N=8 vs N=16 math walkthrough)
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT.md (Gap 2 missing field)
    - app/tests/services/derived-list.test.mjs (existing 10 tests — verify the fix preserves all of them)
  </read_first>
  <action>
    Edit `app/src/services/post-queue.service.ts` line 301:

REPLACE:
```typescript
    const maxSteps = len * 2;
```

WITH (verbatim — copy exactly):
```typescript
    // Phase 36 GAP-B fix: termination must scale with `count`, not just with len.
    // Original `len * 2` silently capped walkDerivedList(16, ...) at 8 entries
    // when len=4 (single non-important anchor case), causing assignStylesStratified
    // to receive N=8 instead of N=16 — at N=8 the largest-remainder math pins
    // text-art at its floor (4/8 = 50%) because text-art's remainder 0.40 loses
    // to minority 0.80. At N=16, text-art's 0.80 beats minority 0.60 → 9/16 = 56%.
    // Math.max preserves the original `len * 2` lazy-skip headroom while ALSO
    // guaranteeing the walker can fulfill the count request (modulo all-explored).
    // See .planning/debug/style-mix-imbalance.md for the full math walkthrough.
    const maxSteps = Math.max(count * 2, len);
```

Also UPDATE the docstring at lines 293-295 (currently):
```typescript
   * Termination: walks at most `2 * derivedList.length` steps to avoid an
   * infinite loop when every entry is explored. Returns whatever it found
   * (possibly empty — caller has an early-return guard).
```

REPLACE with (verbatim):
```typescript
   * Termination: walks at most `Math.max(count * 2, derivedList.length)` steps
   * to avoid an infinite loop when every entry is explored. The `count * 2`
   * factor preserves the lazy-skip headroom (walker can scan up to twice the
   * request size to skip explored entries); the `len` floor preserves the
   * "at least one full pass" property when count < len. Returns whatever it
   * found (possibly empty — caller has an early-return guard). See Phase 36
   * GAP-B closure (post-queue.service.ts comment + .planning/debug/style-mix-imbalance.md).
```

NO other changes. Do NOT touch `style-assignment.ts` (Phase 36-01 math is correct). Do NOT touch `concept-feed.service.ts` (the `walkDerivedList(16, exploredIds)` caller is already correct). Do NOT change BASE_ENTRIES_PER_CONCEPT.
  </action>
  <verify>
    <automated>cd app && grep -c "Math.max(count \* 2, len)" src/services/post-queue.service.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Math.max(count \* 2, len)" app/src/services/post-queue.service.ts` returns 1
    - `grep -c "const maxSteps = len \* 2;" app/src/services/post-queue.service.ts` returns 0 (old line removed)
    - `grep -c "Phase 36 GAP-B fix" app/src/services/post-queue.service.ts` returns 1
    - All 10 existing derived-list.test.mjs tests still pass: `cd app && node --test tests/services/derived-list.test.mjs` reports `tests 10 / pass 10 / fail 0`
    - Phase 33 fix preservation sentinel: `grep -c "dueAnchors.filter" app/src/services/concept-feed.service.ts` returns ≥1 (anchor-explored filter must survive — Task 1 explicitly does NOT touch concept-feed.service.ts, this is a no-op verification focus)
    - Phase 33 fix preservation sentinel: `grep -c "allExplored && postQueueService.getTotalGenerated" app/src/services/concept-feed.service.ts` returns ≥1 (allExplored cap-gate must survive — same no-op invariant)
    - `cd app && npx tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>
    Single line in post-queue.service.ts changed from `len * 2` to `Math.max(count * 2, len)` with comment block explaining GAP-B; docstring updated to match; all existing tests pass; tsc clean.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add regression tests for walker truncation case + N=16 stratification</name>
  <files>app/tests/services/derived-list.test.mjs, app/tests/services/refill-queue-integration.test.mjs</files>
  <read_first>
    - app/tests/services/derived-list.test.mjs (existing 10 tests — find the right insertion point)
    - app/tests/services/refill-queue-integration.test.mjs (existing 6 tests — find Test 3 stratification block to extend)
    - app/src/services/style-assignment.ts (STYLE_WEIGHTS export — import for the floor calculation)
    - .planning/debug/style-mix-imbalance.md (math walkthrough — confirms what the test should assert)
  </read_first>
  <behavior>
    - Derived-list test 11: `walkDerivedList(16, new Set())` on a 4-entry list returns 16 entries (the missed truncation case). Asserts `out.length === 16` AND that the contents are the input list cycled 4 times: `[a,b,c,d, a,b,c,d, a,b,c,d, a,b,c,d]`.
    - Derived-list test 12: `walkDerivedList(8, new Set(['a']))` on a 4-entry list `[a,b,c,d]` returns 6 entries (only b/c/d, cycled twice — `a` lazy-skipped 2× but cyclePosition still advances past those steps). Asserts `out.length === 6` AND `out.every(id => id !== 'a')`.
    - Refill-queue-integration test 7: simulate one full pipeline cycle with len=4 derived list. Append 4 unique IDs, walk 16, run assignStylesStratified, count text-art occurrences. Assert `textArtCount >= Math.floor(16 * STYLE_WEIGHTS['text-art'])` (= 8) — the integration assertion that would have caught GAP-B pre-merge.
  </behavior>
  <action>
    EDIT 1 — `app/tests/services/derived-list.test.mjs`: append two new `it()` blocks AFTER the existing Test 10 (currently the last one, around line 119), BEFORE the closing `});` of the `describe(...)` block. Insert (verbatim):

```javascript
  // Test 11 — Phase 36 GAP-B regression: walker honors `count` when count > len * 2
  // Pre-fix: walkDerivedList(16, emptySet) on a 4-entry list returned only 8 entries
  // because maxSteps was hard-capped at len * 2 = 8. assignStylesStratified then
  // operated on N=8 (text-art floor-pinned at 50%) instead of N=16 (text-art = 56%).
  // See .planning/debug/style-mix-imbalance.md for the math walkthrough.
  it('walkDerivedList(16, emptySet) on 4-entry list returns 16 entries (4 wraps)', () => {
    postQueueService.appendToDerivedList(['a', 'b', 'c', 'd']);
    const out = postQueueService.walkDerivedList(16, new Set());
    assert.equal(out.length, 16, 'walker must return the requested count, not be capped at len * 2');
    // Contents are the input list cycled 4 times — exact ordering reflects 4 full passes
    assert.deepEqual(out, ['a','b','c','d','a','b','c','d','a','b','c','d','a','b','c','d']);
    // cyclePosition wraps back to 0 after 16 steps (16 mod 4 = 0)
    assert.equal(postQueueService.getCyclePosition(), 0, 'cyclePosition wraps to 0 after 16 steps on a 4-entry list');
  });

  // Test 12 — Phase 36 GAP-B regression: explored skips do not break count fulfillment
  // when count requires multiple wraps. Pre-fix: with len=4 and one explored id,
  // maxSteps=8 = exactly len*2, so the walker would terminate at 6 returns (8 steps
  // - 2 skips of 'a'). Post-fix: maxSteps = max(16, 4) = 16, so the walker can do
  // up to 16 steps, but it terminates EARLY when result.length === count = 8.
  // Wait — re-checking: with count=8 and 'a' explored on a 4-entry list, after
  // 12 steps (3 full loops, skipping 'a' 3 times), result has 9 entries — already
  // exceeded count=8 at step 11 (3 'b'+3 'c'+3 'd' = 9, but result.length<count
  // breaks out at 8). Final result = 8 entries, all non-'a'.
  it('walkDerivedList(8, exploredSet) advances past skipped ids while honoring count', () => {
    postQueueService.appendToDerivedList(['a', 'b', 'c', 'd']);
    const out = postQueueService.walkDerivedList(8, new Set(['a']));
    assert.equal(out.length, 8, 'walker must return count=8 entries, skipping `a` lazily');
    assert.ok(out.every(id => id !== 'a'), 'no explored id should appear in the output');
    // Sanity: contents are b/c/d cycled — first wrap [b,c,d], second wrap [b,c,d], third partial [b,c]
    assert.deepEqual(out, ['b','c','d','b','c','d','b','c']);
  });
```

EDIT 2 — `app/tests/services/refill-queue-integration.test.mjs`: append one new `it()` block AFTER the existing Test 6 (currently the last one), BEFORE the closing `});` of the `describe(...)` block. Insert (verbatim):

```javascript
  // Test 7 — Phase 36 GAP-B regression: text-art ≥ floor(N×0.55) at N=16
  // The single-anchor case (len=4) was the GAP-B blind spot. Pre-fix: walkDerivedList(16, ...)
  // returned 8 entries due to the maxSteps=len*2 cap, assignStylesStratified pinned text-art
  // at 4/8 = 50%. Post-fix: walker returns 16, text-art's remainder 0.80 beats minority 0.60,
  // text-art = 9/16 = 56%, satisfying floor(16 * 0.55) = 8.
  // See .planning/debug/style-mix-imbalance.md for the math walkthrough.
  it('GAP-B regression — text-art count ≥ floor(N × 0.55) at N=16 with single-anchor derivedList', () => {
    postQueueService.appendToDerivedList(['anchor1', 'anchor1', 'anchor1', 'anchor1']);
    const conceptIds = postQueueService.walkDerivedList(16, new Set());
    assert.equal(conceptIds.length, 16, 'walker must return 16 entries — pre-fix bug returned 8');

    const assignments = assignStylesStratified(conceptIds, allAvailable);
    assert.equal(assignments.length, 16, 'one assignment per conceptId');

    const counts = {};
    for (const a of assignments) counts[a.style] = (counts[a.style] ?? 0) + 1;
    const textArtFloor = Math.floor(16 * STYLE_WEIGHTS['text-art']);
    assert.ok(
      (counts['text-art'] ?? 0) >= textArtFloor,
      `text-art count must be >= floor(16 * 0.55) = ${textArtFloor}; got ${counts['text-art'] ?? 0}. ` +
      `Pre-Phase-36-07 bug: walker truncated to N=8, text-art floor-pinned at 4/8 = 50%. ` +
      `Post-fix: text-art should land at 9/16 = 56% (largest-remainder bonus).`,
    );
  });
```

NOTE: `STYLE_WEIGHTS` is already imported at the top of refill-queue-integration.test.mjs from style-assignment.ts (verified at line 34 — drift-proof). `assignStylesStratified` is also already imported (line 34). `allAvailable` is the existing test fixture at line 37.

NO other test changes. Do NOT modify Test 6 (allExplored gate) — its semantics are independent of GAP-B.
  </action>
  <verify>
    <automated>cd app && node --test tests/services/derived-list.test.mjs tests/services/refill-queue-integration.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `cd app && node --test tests/services/derived-list.test.mjs` reports `tests 12 / pass 12 / fail 0` (was 10/10, +2)
    - `cd app && node --test tests/services/refill-queue-integration.test.mjs` reports `tests 7 / pass 7 / fail 0` (was 6/6, +1)
    - `cd app && npm test` reports pass count ≥ 425 (Phase 36 baseline 422 + 3 from this plan), fail count ≤ 26 (unchanged)
    - `grep -c "walkDerivedList(16, new Set())" app/tests/services/derived-list.test.mjs` returns ≥1
    - `grep -c "Math.floor(16 \* STYLE_WEIGHTS\['text-art'\])" app/tests/services/refill-queue-integration.test.mjs` returns ≥1
    - `cd app && npx tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>
    derived-list.test.mjs has 12 GREEN tests; refill-queue-integration.test.mjs has 7 GREEN tests; both new tests would have caught GAP-B pre-merge; full npm test reports +3 pass and 0 new fail.
  </done>
</task>

<task type="auto">
  <name>Task 3: Document walker termination contract in CLAUDE.md</name>
  <files>CLAUDE.md</files>
  <read_first>
    - CLAUDE.md (entire "Concept Feed Generation Pipeline" section — find the "Numeric defaults" subsection and the "Known divergences" subsection)
    - .planning/debug/style-mix-imbalance.md (root_cause section)
  </read_first>
  <action>
    Add ONE new bullet to the "Numeric defaults" subsection of CLAUDE.md "Concept Feed Generation Pipeline" section. Find the subsection (currently has 4 bullets: queue refill threshold, posts per swipe, style weights, daily generation cap, queue maximum size).

INSERT after the "Queue maximum size" bullet (the one added by 36-05):

```markdown
- Walker termination guard: `walkDerivedList`'s `maxSteps = Math.max(count * 2, len)` (in `post-queue.service.ts:301`). The `count * 2` factor preserves lazy-skip headroom (walker can scan up to twice the request size to skip explored entries); the `len` floor preserves the "at least one full pass possible" property when `count < len`. **Do not regress to `len * 2`** — that was the Phase 36 GAP-B bug that pinned text-art at 50% (floor) instead of the design-target 56% (floor + bonus at N=16). Single-anchor users (derivedList.length=4) hit the truncation: `walkDerivedList(16, ...)` returned only 8 entries, so `assignStylesStratified` operated on N=8 where text-art's remainder 0.40 loses to minority 0.80. At the design's intended N=16, text-art's 0.80 beats minority 0.60. See `.planning/debug/style-mix-imbalance.md` for the full math walkthrough; regression tests at `app/tests/services/derived-list.test.mjs` (Test 11/12) and `app/tests/services/refill-queue-integration.test.mjs` (Test 7).
```

ALSO update the "Known divergences from design" subsection. Find the line:
```
- Each concept gets at most 2 entries (1 + isImportant), not weighted by style mix.
```

(That line was rewritten by 36-05 to: `BASE_ENTRIES_PER_CONCEPT (4) entries by default, doubled to 8 if important` — verify the exact current wording before editing.)

Append ONE new closed-divergence entry under "Known divergences from design" (the strikethrough section) — add a NEW strikethrough bullet at the bottom of the closed list:

```markdown
- ~~Walker silently capped batch size at `derivedList.length × 2` regardless of requested count~~ — **CLOSED via Phase 36 GAP-B fix (Plan 36-07)**: `maxSteps = Math.max(count * 2, len)` lets `walkDerivedList(16, ...)` return 16 entries even when `len=4` (single-anchor case); restores text-art's 56% target via the largest-remainder bonus that requires N≥12.
```

NO other changes to CLAUDE.md. Do NOT touch other load-bearing sections (Phase 33 fixes, classification dedup, ChatInput, Header positioning, etc.) — those rules are byte-stable and out of scope.
  </action>
  <verify>
    <automated>grep -c "Math.max(count \* 2, len)" CLAUDE.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Math.max(count \* 2, len)" CLAUDE.md` returns ≥1 (was 0)
    - `grep -c "Phase 36 GAP-B" CLAUDE.md` returns ≥1
    - `grep -c "Walker termination guard" CLAUDE.md` returns ≥1
    - `grep -c "Walker silently capped batch size" CLAUDE.md` returns 1 (the new strikethrough entry)
    - Other load-bearing sections unchanged — verify byte stability via:
      - `grep -c "html, body { overflow: hidden }" CLAUDE.md` returns 3 (unchanged from Phase 35)
      - `grep -c "minWidth: 0" CLAUDE.md` returns 2 (unchanged)
      - `grep -c "USER_ACK_BEFORE_GRAPH_CONTEXT" CLAUDE.md` returns 2 (unchanged)
      - `grep -c "ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD" CLAUDE.md` returns 1 (unchanged)
      - `grep -c "MAX_QUEUE_SIZE" CLAUDE.md` returns ≥1 (Phase 36-05 entry preserved)
  </acceptance_criteria>
  <done>
    CLAUDE.md "Numeric defaults" has new walker termination guard bullet referencing Math.max(count*2, len); "Known divergences from design" has new strikethrough entry naming Phase 36 GAP-B / Plan 36-07; all other load-bearing rule sections byte-stable.
  </done>
</task>

</tasks>

<verification>
Phase-level checks for this plan:

```bash
# 1. Walker fix in place
grep -c "Math.max(count \* 2, len)" app/src/services/post-queue.service.ts
# Expect: 1

# 2. Old buggy guard gone
grep -c "const maxSteps = len \* 2;" app/src/services/post-queue.service.ts
# Expect: 0

# 3. New regression tests pass
cd app && node --test tests/services/derived-list.test.mjs
# Expect: tests 12 / pass 12 / fail 0
cd app && node --test tests/services/refill-queue-integration.test.mjs
# Expect: tests 7 / pass 7 / fail 0

# 4. CLAUDE.md updated
grep -c "Phase 36 GAP-B" CLAUDE.md
# Expect: ≥1

# 5. Other load-bearing rules byte-stable
grep -c "html, body { overflow: hidden }" CLAUDE.md   # Expect: 3
grep -c "USER_ACK_BEFORE_GRAPH_CONTEXT" CLAUDE.md     # Expect: 2

# 6. Full npm test no new failures
cd app && npm test
# Expect: pass count ≥ 425, fail count ≤ 26

# 7. tsc clean
cd app && npx tsc -b --noEmit
# Expect: exit 0
```
</verification>

<success_criteria>
- [ ] post-queue.service.ts:301 uses `Math.max(count * 2, len)` with explanatory comment
- [ ] Walker docstring updated to match the new termination contract
- [ ] derived-list.test.mjs has 12 GREEN tests (added Test 11 for the truncation case + Test 12 for explored-skip with multi-wrap)
- [ ] refill-queue-integration.test.mjs has 7 GREEN tests (added Test 7 for floor(N×0.55) at N=16)
- [ ] CLAUDE.md "Concept Feed Generation Pipeline" updated with walker termination guard bullet + GAP-B closure entry
- [ ] No regression in existing tests (Phase 36 baseline 422 pass / 26 fail preserved; +3 from this plan = ≥425 pass)
- [ ] tsc clean
- [ ] Other CLAUDE.md load-bearing sections byte-stable (Phase 33/35 invariants preserved)
</success_criteria>

<output>
After completion, create `.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-07-SUMMARY.md`
</output>
