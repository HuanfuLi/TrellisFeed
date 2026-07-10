---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 01
type: execute
wave: 1
depends_on: [00]
files_modified:
  - app/src/services/style-assignment.ts
autonomous: true
requirements: [GAP-3]
gap_closure: true
must_haves:
  truths:
    - "Style counts in any 8-item batch are within ±1 of round(N × weight) for every style — every run, not just on average"
    - "When hasImageGenKey=false, image count is 0 — API redirect runs BEFORE stratification"
    - "Within-batch order remains random (Fisher-Yates) so the same style does not always appear at the same slot"
    - "Existing assignStyles tests in style-assignment.test.mjs still pass (drop-in replacement OR alongside-export, planner choice documented in action)"
  artifacts:
    - path: app/src/services/style-assignment.ts
      provides: "Stratified style allocation via largest-remainder"
      contains: "export function assignStylesStratified"
  key_links:
    - from: "app/src/services/style-assignment.ts"
      to: "app/src/services/concept-feed.service.ts (refillQueue line 1300)"
      via: "callsite — Wave 2 (Plan 36-03 doc note) optionally swaps assignStyles → assignStylesStratified at the call site, OR this plan replaces the body of assignStyles in place"
      pattern: "assignStyles\\(conceptIds, availability\\)"
---

<objective>
Replace the i.i.d. style draw inside `assignStyles` with a stratified largest-remainder (Hamilton's method) allocation followed by a Fisher-Yates shuffle. Closes GAP-3 — the small-N variance defect where N=8 batches sample image with E[count]=0.8 → most batches produce zero image posts.

**Implementation choice (locked in this plan, MUST be honored):** REPLACE the i.i.d. body of `assignStyles` in place, AND additionally export a named `assignStylesStratified` symbol that is just an alias / re-export of `assignStyles`. Rationale: (a) the existing `style-assignment.test.mjs` distribution tests use N=100 over 100 runs — they pass with stratified allocation too (counts are CLOSER to target, not further); (b) Wave 0's `style-assignment-stratified.test.mjs` imports `assignStylesStratified` by name — exporting the alias makes both test files GREEN with one implementation; (c) every existing call site (concept-feed.service.ts:1300, et al.) keeps working without churn.

Purpose: Eliminate small-N style absence (image / suggestion missing from 8-entry batches).
Output: Modified `app/src/services/style-assignment.ts` exporting `assignStyles` (now stratified) AND `assignStylesStratified` (alias).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-RESEARCH.md
@.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-VALIDATION.md
@CLAUDE.md
@app/src/services/style-assignment.ts
@app/tests/services/style-assignment.test.mjs
@app/tests/services/style-assignment-stratified.test.mjs

<interfaces>
Pre-existing public surface of style-assignment.ts (PRESERVED — do NOT change signatures):
```typescript
export const STYLE_WEIGHTS: Record<string, number>;
export interface ApiAvailability {
  hasYoutubeKey: boolean; hasTavilyKey: boolean; hasImageGenKey: boolean;
}
export interface StyleAssignment { conceptId: string; style: PresentationStyle; }
export function assignStyles(conceptIds: string[], availability: ApiAvailability): StyleAssignment[];
export function reassignFailures(assignments: StyleAssignment[], failedIds: Set<string>): StyleAssignment[];
```

NEW export added by this plan:
```typescript
// Alias of assignStyles — exists so the Wave 0 test file
// (style-assignment-stratified.test.mjs) can import the stratified function
// by an unambiguous name without renaming every existing call site.
export const assignStylesStratified = assignStyles;
```

Algorithm to embed (largest-remainder + Fisher-Yates) — copy verbatim into action:
```typescript
// 1. styleNames + cumulative-threshold setup (lines 64-71) → REMOVED
// 2. result = conceptIds.map(... Math.random() ...) (lines 73-77) → REPLACED with:

// Step A: list (style, exact-quota) for non-zero weights
const sum = Object.values(weights).reduce((a, b) => a + (b > 0 ? b : 0), 0);
const items: Array<{ style: PresentationStyle; count: number; rem: number }> = [];
for (const [s, w] of Object.entries(weights)) {
  if (w <= 0) continue;
  const exact = (conceptIds.length * w) / sum;
  const count = Math.floor(exact);
  items.push({ style: s as PresentationStyle, count, rem: exact - count });
}

// Step B: distribute deficit by largest remainder
const deficit = conceptIds.length - items.reduce((s, x) => s + x.count, 0);
items.sort((a, b) => b.rem - a.rem);
for (let i = 0; i < deficit; i++) items[i].count++;

// Step C: build slots array
const slots: PresentationStyle[] = [];
for (const { style, count } of items) {
  for (let i = 0; i < count; i++) slots.push(style);
}

// Step D: Fisher-Yates shuffle (in place, Math.random)
for (let i = slots.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [slots[i], slots[j]] = [slots[j], slots[i]];
}

// Step E: zip with conceptIds
const result = conceptIds.map((conceptId, i) => ({ conceptId, style: slots[i] }));
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace i.i.d. body of assignStyles with largest-remainder stratified allocation</name>
  <files>app/src/services/style-assignment.ts</files>
  <read_first>
    - app/src/services/style-assignment.ts (current file — read all 107 lines so you know what's there before you cut)
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-RESEARCH.md (Pattern 2 + Code Examples → Largest-Remainder Stratified Allocation; Pitfall 2 + Pitfall 3)
    - app/tests/services/style-assignment.test.mjs (the existing tests that MUST still pass after your edit — pay attention to lines 27-57 percentage tests)
    - app/tests/services/style-assignment-stratified.test.mjs (Wave 0 — read so you know what `assignStylesStratified` shape is being asserted)
    - CLAUDE.md (no specific section — but constraint: don't introduce new dependencies; pure TypeScript only)
  </read_first>
  <behavior>
    - Test 1 (Wave 0 N=8): image count ∈ {0,1,2}, text-art ∈ {3,4,5} — every run, not just on average
    - Test 2 (Wave 0 small-N): N=2 returns 2 valid assignments, no crash; N=3 has text-art ≥ 1
    - Test 3 (Wave 0 API redirect first): hasImageGenKey=false → 0 image entries even when N=20
    - Test 4 (Wave 0 randomness): two consecutive calls produce different orderings (Fisher-Yates is non-deterministic)
    - Test 5 (existing test compatibility): 100 runs of N=100 — image % is 5-15, suggestion % is 2-10 (existing test passes; with stratified allocation the result is even more tightly bounded)
    - Test 6 (existing test compatibility): hasYoutubeKey=false redistributes video+short to text-art; hasTavilyKey=false redistributes news; hasImageGenKey=false redistributes image (existing redistribution branch unchanged)
    - Test 7 (existing reassignFailures): unchanged — function untouched
  </behavior>
  <action>
Open `app/src/services/style-assignment.ts`. Make the following surgical edits:

1. **KEEP unchanged (lines 1-62):**
   - The header comment block lines 1-25 (re-balance history is documentation, do NOT delete)
   - `export const STYLE_WEIGHTS` (lines 18-25)
   - `export interface StyleAssignment` (lines 27-30)
   - `export interface ApiAvailability` (lines 32-36)
   - The `assignStyles` function header through line 62 — the API-availability redistribution block (`if (!availability.hasYoutubeKey)` etc.) must run FIRST. Per RESEARCH § Pitfall 2: stratified allocation operates on EFFECTIVE weights, not raw STYLE_WEIGHTS.

2. **REPLACE lines 64-77** (the cumulative-threshold + i.i.d. draw) with the largest-remainder + Fisher-Yates allocation. The new block sits exactly where the old one was, BEFORE the dev-mode instrumentation at line 79-87. New code:

```typescript
  // ─── Stratified allocation (Phase 36 GAP-3) ──────────────────────────────
  // Replaces the prior i.i.d. draw that produced E[image]=0.8 in N=8 batches
  // (most batches contained ZERO image posts — operator-confirmed defect).
  // Largest-remainder (Hamilton's method) gives provable ±1 of round(N×w) per
  // style, every run. Fisher-Yates shuffle then randomizes within-batch ORDER
  // so the COUNTS are exact but the SEQUENCE is varied.
  //
  // CRITICAL: this runs on `weights` (effective, post-API-redirect) NOT on
  // STYLE_WEIGHTS — see RESEARCH § Pitfall 2. The redistribution block above
  // must execute first.
  const sum = Object.values(weights).reduce<number>((a, b) => a + (b > 0 ? b : 0), 0);
  const items: Array<{ style: PresentationStyle; count: number; rem: number }> = [];
  for (const [s, w] of Object.entries(weights)) {
    if (w <= 0) continue;
    const exact = (conceptIds.length * w) / sum;
    const count = Math.floor(exact);
    items.push({ style: s as PresentationStyle, count, rem: exact - count });
  }
  const deficit = conceptIds.length - items.reduce((acc, x) => acc + x.count, 0);
  items.sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < deficit; i++) items[i].count++;

  const slots: PresentationStyle[] = [];
  for (const { style, count } of items) {
    for (let i = 0; i < count; i++) slots.push(style);
  }
  // Fisher-Yates shuffle (in place, Math.random — non-deterministic by design;
  // tests assert COUNTS, not sequences, see RESEARCH § Risk Register row 3).
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const result = conceptIds.map((conceptId, i) => ({ conceptId, style: slots[i] }));
```

3. **KEEP unchanged (the dev-mode instrumentation lines 79-87 in the current file, now slightly relocated):** Make sure the `if (typeof import.meta !== 'undefined' && import.meta.env?.DEV)` block continues to print `counts` BEFORE `return result`. This block is load-bearing for diagnostics and was added in 2026-04-21.

4. **KEEP unchanged (`reassignFailures` lines 92-106):** Touch nothing.

5. **ADD at end of file** (after `reassignFailures`, before EOF):

```typescript
// Phase 36 GAP-3 — alias for unambiguous import in tests / external callers
// that want to reference the stratified algorithm by name. The body of
// assignStyles IS the stratified algorithm now (replaced i.i.d. on 2026-05-06).
// Kept as a separate export so the Wave 0 test file
// `tests/services/style-assignment-stratified.test.mjs` resolves cleanly.
export const assignStylesStratified = assignStyles;
```

6. **Edge cases your implementation MUST handle (caught by tests):**
   - Empty conceptIds (`conceptIds.length === 0`): the `Math.floor(0 × w)` is 0, deficit is 0, slots is empty, `result` is []. No crash. (Existing tests don't cover this; Wave 0 test 6 uses N=2; an N=0 path is unreachable in production because callers gate at `conceptIds.length === 0`.)
   - Small-N where N < count of available styles (N=2, 6 styles): all floors are 0, deficit=2, top 2 by rem get +1, slots has 2 entries, shuffle of 2 is valid. (Wave 0 Test 6.)
   - sum could be 0 if every weight has been zeroed (no APIs, image off, etc.) — defensive: if sum === 0, push N copies of 'text-art' into slots and return. (This shouldn't happen because text-art always retains weight, but cover the edge.)

Add the sum-zero defense BEFORE the items loop:

```typescript
  if (sum <= 0) {
    // Pathological: every weight zeroed. Should not happen — text-art always
    // retains its base 0.55 (and absorbs redistributions). Return all-text-art.
    const fallback: PresentationStyle = 'text-art';
    return conceptIds.map((conceptId) => ({ conceptId, style: fallback }));
  }
```

7. **Verify:** Run `cd app && node --test tests/services/style-assignment.test.mjs tests/services/style-assignment-stratified.test.mjs` — expect BOTH to be GREEN.

8. **Run TypeScript check:** `cd app && npx tsc -b --noEmit` exit code must be 0.

9. **Commit message:** `feat(36-01): stratified style allocation via largest-remainder (closes GAP-3)`
  </action>
  <verify>
    <automated>cd app &amp;&amp; node --test tests/services/style-assignment-stratified.test.mjs tests/services/style-assignment.test.mjs 2>&amp;1 | grep -E "tests|pass|fail" | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - app/src/services/style-assignment.ts contains the line `export const assignStylesStratified = assignStyles;` (verify: `grep -c "assignStylesStratified = assignStyles" app/src/services/style-assignment.ts` >= 1)
    - app/src/services/style-assignment.ts NO LONGER contains the i.i.d. cumulative threshold pattern (verify: `grep -c "r < c.threshold" app/src/services/style-assignment.ts` returns 0)
    - app/src/services/style-assignment.ts contains largest-remainder markers (verify: ALL of the following greps return ≥1: `grep -c "Math.floor(exact)" app/src/services/style-assignment.ts`, `grep -c "items.sort" app/src/services/style-assignment.ts`, `grep -c "Fisher-Yates" app/src/services/style-assignment.ts`)
    - The API-availability redistribution block (`weights['text-art'] += weights.video + weights.short`) is still present — verify ABOVE the new stratified code (verify: `grep -n "weights\\['text-art'\\] += weights.video" app/src/services/style-assignment.ts` returns a line number; `grep -n "Math.floor(exact)" app/src/services/style-assignment.ts` returns a LARGER line number)
    - `cd app && node --test tests/services/style-assignment-stratified.test.mjs` exits 0 (Wave 0 test now GREEN — 10/10 pass)
    - `cd app && node --test tests/services/style-assignment.test.mjs` exits 0 (existing tests STILL pass)
    - `cd app && npx tsc -b --noEmit` exits 0
    - `reassignFailures` function body unchanged (verify: `grep -A 8 "export function reassignFailures" app/src/services/style-assignment.ts` shows the original signature and body untouched — argument names `assignments`, `failedConceptIds` preserved)
  </acceptance_criteria>
  <done>assignStyles is now stratified (largest-remainder + Fisher-Yates); assignStylesStratified is exported as alias; API-redirect block runs first; existing tests pass; new Wave 0 stratified tests are GREEN; tsc clean.</done>
</task>

</tasks>

<verification>
- `cd app && node --test tests/services/style-assignment-stratified.test.mjs` → 10/10 pass
- `cd app && node --test tests/services/style-assignment.test.mjs` → all existing tests pass (image % 5-15, suggestion % 2-10, etc.)
- `cd app && npx tsc -b --noEmit` exits 0
- `cd app && grep -c "Math.random() \* sum" app/src/services/style-assignment.ts` returns 0 (i.i.d. removed)
</verification>

<success_criteria>
Plan complete when:
- [ ] `assignStyles` body uses largest-remainder + Fisher-Yates (i.i.d. replaced in place)
- [ ] `assignStylesStratified` exported as alias to `assignStyles`
- [ ] API-availability redistribution still runs FIRST (line ordering preserved)
- [ ] Wave 0 stratified test file is GREEN (10/10)
- [ ] Existing style-assignment.test.mjs still GREEN
- [ ] tsc clean
- [ ] Single atomic commit `feat(36-01): stratified style allocation via largest-remainder (closes GAP-3)`
</success_criteria>

<output>
After completion, create `.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-01-SUMMARY.md` with:
- Diff size (lines added/removed in style-assignment.ts)
- Test result counts (paste node --test summary)
- Confirmation that the dev-mode instrumentation block still runs
- Git commit hash
</output>
