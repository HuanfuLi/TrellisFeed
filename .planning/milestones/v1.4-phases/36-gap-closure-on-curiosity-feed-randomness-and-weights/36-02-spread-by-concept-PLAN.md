---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 02
type: execute
wave: 1
depends_on: [00]
files_modified:
  - app/src/services/concept-feed.service.ts
autonomous: true
requirements: [GAP-4]
gap_closure: true
must_haves:
  truths:
    - "spreadByConcept is exported from concept-feed.service.ts so the Wave 0 test can import it"
    - "When the queue is mixed across 2+ distinct concepts, no two adjacent posts share the same anchor key after spreadByConcept runs"
    - "spreadByConcept runs BEFORE spreadByStyle in the enqueueInterleaved mixer callback (rationale: spread by concept first establishes concept distribution; style spread's collision bumps then operate on a concept-spread array — RESEARCH § Pattern 3 Why-Concept-First)"
    - "Combined invariant: after both passes, no two adjacent posts share BOTH same concept AND same style (when bucket sizes allow)"
    - "Posts with empty sourceQuestionIds use post.id as fallback key — they are NOT clustered together (Pitfall 5)"
  artifacts:
    - path: app/src/services/concept-feed.service.ts
      provides: "Concept-axis spread function + new mixer wiring"
      contains: "function spreadByConcept"
  key_links:
    - from: "app/src/services/concept-feed.service.ts spreadByConcept"
      to: "spreadByStyle (existing) called sequentially after"
      via: "shared mixer callback in enqueueInterleaved at line 1437"
      pattern: "enqueueInterleaved\\(posts, .*spreadByConcept.*spreadByStyle"
---

<objective>
Add a concept-axis spread function `spreadByConcept` to `concept-feed.service.ts` and wire it into `refillQueue`'s `enqueueInterleaved` mixer callback BEFORE the existing `spreadByStyle`. Closes GAP-4 — current queue can hand a user 4 consecutive posts of the same anchor (e.g., one important anchor with 8 entries dominates the served window) because `spreadByStyle` interleaves by STYLE only, not by concept identity.

The fix is a 15-line clone of `spreadByStyle` keyed on `post.sourceQuestionIds[0] ?? post.id` (per RESEARCH § Pitfall 5), exported alongside `spreadByStyle` so the Wave 0 test imports it directly. The mixer callback in `refillQueue` is updated from `spreadByStyle` (single function reference) to an inline arrow `(combined) => { spreadByConcept(combined); spreadByStyle(combined); }`.

Purpose: Same concept does not appear back-to-back when the user has 2+ due anchors. Style variety preserved by the second pass.
Output: Modified `app/src/services/concept-feed.service.ts` exporting `spreadByConcept` AND `spreadByStyle` (the latter previously module-private becomes exported so the combined-invariant test in Wave 0 can call it).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-RESEARCH.md
@.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-VALIDATION.md
@CLAUDE.md
@app/src/services/concept-feed.service.ts
@app/tests/services/spread-by-concept.test.mjs
@app/tests/services/post-queue.test.mjs

<interfaces>
Existing private function (concept-feed.service.ts:619-670) — model for the new function:
```typescript
function spreadByStyle(posts: DailyPost[]): void {
  if (posts.length <= 2) return;
  const n = posts.length;
  const byStyle = new Map<string, DailyPost[]>();
  for (const p of posts) {
    const key = p.presentationStyle ?? 'unknown';
    const arr = byStyle.get(key) ?? [];
    arr.push(p);
    byStyle.set(key, arr);
  }
  const buckets = Array.from(byStyle.entries()).sort((a, b) => b[1].length - a[1].length);
  const result: (DailyPost | null)[] = new Array(n).fill(null);
  for (const [, items] of buckets) {
    const count = items.length;
    if (count === 0) continue;
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
  const leftover = posts.filter((p) => !result.includes(p));
  let cursor = 0;
  for (const p of leftover) {
    while (cursor < n && result[cursor] !== null) cursor++;
    if (cursor < n) result[cursor++] = p;
  }
  for (let i = 0; i < n; i++) posts[i] = result[i]!;
}
```

NEW function `spreadByConcept` differs ONLY in the key extractor:
```typescript
const key = p.sourceQuestionIds[0] ?? p.id;  // NOT p.presentationStyle
```

Existing call site (concept-feed.service.ts:1437):
```typescript
postQueueService.enqueueInterleaved(posts, spreadByStyle);
```

NEW call site:
```typescript
postQueueService.enqueueInterleaved(posts, (combined) => {
  // Concept-axis spread FIRST: establishes concept distribution.
  spreadByConcept(combined);
  // Style-axis spread SECOND: refines style variety within the concept-spread layout.
  // Style spread's collision-bumps may move posts past concept boundaries —
  // accepted tradeoff (RESEARCH § Pattern 3 Why-Concept-First).
  spreadByStyle(combined);
});
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add spreadByConcept function and wire it into enqueueInterleaved before spreadByStyle</name>
  <files>app/src/services/concept-feed.service.ts</files>
  <read_first>
    - app/src/services/concept-feed.service.ts lines 619-670 (the existing spreadByStyle — your new function is the same shape with one different line)
    - app/src/services/concept-feed.service.ts lines 1420-1442 (the refillQueue tail where enqueueInterleaved is called — line 1437 is the surgical edit point)
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-RESEARCH.md (Pattern 3 in full + Pitfall 5; the concept-key-with-fallback for empty sourceQuestionIds)
    - app/tests/services/spread-by-concept.test.mjs (Wave 0 — 7 assertions you must satisfy)
    - CLAUDE.md "Concept Feed Generation Pipeline" section ("DO NOT DRIFT" — three-list pipeline; you are improving step 3 of the queue, not adding a fourth list)
    - CLAUDE.md "Best practices learned in Phase 32.1" rules 1, 2, 6 (one signal per event — this plan does NOT add events; rule 6 is about not adding parallel events; you only add a function)
  </read_first>
  <behavior>
    - Test 1 (Wave 0): 6 posts, 3 of each of 2 concepts → no adjacent same-concept after spreadByConcept
    - Test 2 (Wave 0): single-concept input — length preserved, no crash
    - Test 3 (Wave 0): empty array does not throw
    - Test 4 (Wave 0): single-element array unchanged
    - Test 5 (Wave 0): 6 of A + 2 of B → max-run of A is ≤ 2
    - Test 6 (Wave 0): empty sourceQuestionIds posts (starter posts) — fallback key = post.id; they are NOT clustered
    - Test 7 (Wave 0 combined): spreadByConcept then spreadByStyle → no adjacent share BOTH concept AND style
    - Integration (no Wave 0 unit test, but enforced by acceptance criteria + Plan 36-04 smoke): refillQueue's enqueueInterleaved mixer now calls BOTH spread passes in the documented order.
  </behavior>
  <action>
Open `app/src/services/concept-feed.service.ts`. Two surgical edits:

**EDIT 1 — Add `spreadByConcept` function and EXPORT both spread helpers.** Insert directly AFTER the existing `spreadByStyle` definition (after line 670). The new code:

```typescript
/**
 * Concept-axis spread (Phase 36 GAP-4) — same algorithm as spreadByStyle but
 * groups by anchor identity instead of style. Mirrors the stride placement +
 * collision-bump pattern verbatim; only the key extractor differs.
 *
 * Why this exists: spreadByStyle interleaves by style label only — if one
 * anchor has 8 entries (important / overdue) and another has 4, the 2:1
 * concept ratio persists in every served window REGARDLESS of style spread.
 * The user feels "every other post is about anchor A" even when each post
 * is a different style. Spreading on the concept axis first establishes
 * concept distribution; spreadByStyle then refines style variety within it.
 *
 * Key extractor: post.sourceQuestionIds[0] ?? post.id  (Pitfall 5 — posts
 * with empty sourceQuestionIds — starter / connection / suggestion — get
 * a unique fallback key so they are NOT all clustered together).
 *
 * Call order in the mixer is concept FIRST, style SECOND (RESEARCH §
 * Pattern 3 Why-Concept-First): if style spread runs first then concept
 * spread, style spread's collision-bumps move posts past concept boundaries
 * and concept spread has to re-sort, producing worse separation. Reverse
 * order keeps the concept distribution stable while style spread refines
 * within it.
 */
export function spreadByConcept(posts: DailyPost[]): void {
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
    if (count === 0) continue;
    const stride = n / count;
    for (let i = 0; i < count; i++) {
      let slot = Math.floor(i * stride + stride / 2);
      if (slot >= n) slot = n - 1;
      let probe = slot;
      let tries = 0;
      while (result[probe] !== null && tries < n) {
        probe = (probe + 1) % n;
        tries++;
      }
      result[probe] = items[i];
    }
  }
  const leftover = posts.filter((p) => !result.includes(p));
  let cursor = 0;
  for (const p of leftover) {
    while (cursor < n && result[cursor] !== null) cursor++;
    if (cursor < n) result[cursor++] = p;
  }
  for (let i = 0; i < n; i++) posts[i] = result[i]!;
}
```

**EDIT 2 — promote `spreadByStyle` to exported.** Change the function declaration on line 619 from `function spreadByStyle(...)` to `export function spreadByStyle(...)`. The existing implementation is otherwise unchanged. The Wave 0 test (Test 7 — combined invariant) imports `spreadByStyle` to verify the call-order-matters guarantee.

**EDIT 3 — wire the new mixer at line 1437.** REPLACE:
```typescript
postQueueService.enqueueInterleaved(posts, spreadByStyle);
```
WITH:
```typescript
// Phase 36 GAP-4 — run concept-axis spread BEFORE style-axis spread so
// dominant anchors (important / overdue with 2× entries) don't cluster
// in the served window. See spreadByConcept JSDoc + RESEARCH § Pattern 3.
postQueueService.enqueueInterleaved(posts, (combined) => {
  spreadByConcept(combined);
  spreadByStyle(combined);
});
```

**Constraints (CLAUDE.md compliance):**
- Do NOT add any new event subscriptions. The lazy-skip approach in Plan 36-03 means no CONCEPT_EXPLORED listener is needed here either — this plan is pure post-array-mutation logic, no events.
- Do NOT change `spreadByStyle`'s body. It remains exactly as written, only the keyword `export` is added.
- Do NOT change `enqueueInterleaved`'s signature. The mixer is still `(combined: DailyPost[]) => void`.
- Do NOT change `BASE_ENTRIES_PER_CONCEPT` (currently 4). That's a Plan 36-03 constraint too.

**Verify:**
1. `cd app && node --test tests/services/spread-by-concept.test.mjs` → 7/7 pass.
2. `cd app && npx tsc -b --noEmit` → exit 0.
3. `cd app && node --test tests/services/post-queue.test.mjs tests/services/post-queue-dedup.test.mjs tests/services/concept-batch-filter.test.mjs tests/services/concept-feed-cross-cycle-dedup.test.mjs` → all still pass (no regression in queue or feed-pipeline tests).

**Commit message:** `feat(36-02): add spreadByConcept + wire into refillQueue mixer (closes GAP-4)`
  </action>
  <verify>
    <automated>cd app &amp;&amp; node --test tests/services/spread-by-concept.test.mjs 2>&amp;1 | grep -E "tests|pass|fail" | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - app/src/services/concept-feed.service.ts contains `export function spreadByConcept` (verify: `grep -c "export function spreadByConcept" app/src/services/concept-feed.service.ts` returns 1)
    - app/src/services/concept-feed.service.ts contains `export function spreadByStyle` (verify: `grep -c "export function spreadByStyle" app/src/services/concept-feed.service.ts` returns 1)
    - The new spreadByConcept function uses the fallback key extractor (verify: `grep -c "p.sourceQuestionIds\\[0\\] ?? p.id" app/src/services/concept-feed.service.ts` returns at least 1)
    - The mixer callback at the enqueueInterleaved call site references BOTH functions in the right order (verify: `grep -A 3 "Phase 36 GAP-4" app/src/services/concept-feed.service.ts` finds `spreadByConcept(combined);` and `spreadByStyle(combined);` in that order)
    - `cd app && node --test tests/services/spread-by-concept.test.mjs` exits 0 (Wave 0 test now GREEN — 7/7 pass)
    - `cd app && npx tsc -b --noEmit` exits 0
    - Existing tests do NOT regress: `cd app && node --test tests/services/post-queue.test.mjs tests/services/post-queue-dedup.test.mjs tests/services/concept-batch-filter.test.mjs tests/services/concept-feed-cross-cycle-dedup.test.mjs` exits 0
    - No new event names introduced (verify: `git diff app/src/services/concept-feed.service.ts | grep -c "eventBus.emit\\|eventBus.subscribe"` returns 0 — no new event lines added; CLAUDE.md best-practice rule 6 honored)
    - The previous mixer `postQueueService.enqueueInterleaved(posts, spreadByStyle);` line is gone (verify: `grep -c "enqueueInterleaved(posts, spreadByStyle)" app/src/services/concept-feed.service.ts` returns 0)
  </acceptance_criteria>
  <done>spreadByConcept exported; spreadByStyle exported; mixer wires both in concept-first/style-second order; Wave 0 test GREEN; no regressions; tsc clean; no new events.</done>
</task>

</tasks>

<verification>
- `cd app && node --test tests/services/spread-by-concept.test.mjs` → 7/7 pass
- `cd app && node --test tests/services/post-queue.test.mjs tests/services/post-queue-dedup.test.mjs tests/services/concept-batch-filter.test.mjs tests/services/concept-feed-cross-cycle-dedup.test.mjs` → 0 failures
- `cd app && npx tsc -b --noEmit` exits 0
- spreadByConcept exported AND used at the enqueueInterleaved call site
- No new event names added to the codebase (CLAUDE.md best-practice rule 6 preserved)
</verification>

<success_criteria>
Plan complete when:
- [ ] `spreadByConcept` function exists in concept-feed.service.ts, uses the `sourceQuestionIds[0] ?? id` key extractor
- [ ] `spreadByStyle` is now exported (was previously module-private)
- [ ] enqueueInterleaved call site updated to call spreadByConcept BEFORE spreadByStyle
- [ ] Wave 0 spread-by-concept.test.mjs GREEN (7/7)
- [ ] No regressions in existing tests
- [ ] tsc clean
- [ ] No new event names added
- [ ] Single atomic commit `feat(36-02): add spreadByConcept + wire into refillQueue mixer (closes GAP-4)`
</success_criteria>

<output>
After completion, create `.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-02-SUMMARY.md` with:
- Diff size (lines added/removed)
- Wave 0 spread-by-concept test results (paste node --test summary)
- No-regression confirmation for the 4 named existing tests
- Confirmation that no new events were added (`git diff ... | grep eventBus` = 0)
- Git commit hash
</output>
