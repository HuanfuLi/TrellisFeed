---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 00
type: execute
wave: 0
depends_on: []
files_modified:
  - app/tests/services/derived-list.test.mjs
  - app/tests/services/style-assignment-stratified.test.mjs
  - app/tests/services/spread-by-concept.test.mjs
autonomous: true
requirements: [GAP-1, GAP-2, GAP-3, GAP-4]
gap_closure: false
must_haves:
  truths:
    - "Three new test files exist on disk and are discoverable by node --test"
    - "All three files import their target modules (post-queue.service, style-assignment, concept-feed) so when impl lands the asserts execute against the live code path"
    - "Each test file is RED (assertions describe target behavior that does NOT yet exist) but does not crash node --test — failures should be plain assertion failures, not import errors"
  artifacts:
    - path: app/tests/services/derived-list.test.mjs
      provides: "GAP-1 + GAP-2 invariants (append-only, persistence, reset, walker advance/wrap/lazy-skip)"
      contains: "appendToDerivedList"
    - path: app/tests/services/style-assignment-stratified.test.mjs
      provides: "GAP-3 invariants (stratified count ±1 of round(N×w))"
      contains: "assignStylesStratified"
    - path: app/tests/services/spread-by-concept.test.mjs
      provides: "GAP-4 invariants (no same-concept-adjacent when 2+ concepts)"
      contains: "spreadByConcept"
  key_links:
    - from: "app/tests/services/derived-list.test.mjs"
      to: "app/src/services/post-queue.service.ts"
      via: "dynamic import"
      pattern: "post-queue.service"
    - from: "app/tests/services/style-assignment-stratified.test.mjs"
      to: "app/src/services/style-assignment.ts"
      via: "dynamic import"
      pattern: "style-assignment"
    - from: "app/tests/services/spread-by-concept.test.mjs"
      to: "app/src/services/concept-feed.service.ts"
      via: "dynamic import (or extracted helper)"
      pattern: "spreadByConcept"
---

<objective>
Land three RED test files covering Phase 36's four behavior gaps BEFORE any implementation. Per CLAUDE.md Phase 32.1 lesson #2, tests must guard the LIVE code path — writing them first ensures the executor agents in Waves 1 and 2 know exactly what shape and signature their new functions must have. Each file is a stub that imports the target module and asserts the desired behavior; the assertions WILL FAIL until Waves 1 and 2 implement (GREEN flip is the success signal for those plans).

Purpose: Establish behavioral contracts in code form so Wave 1 and Wave 2 executors implement against tests rather than re-deriving from RESEARCH.md.
Output: Three new test files at app/tests/services/. All three are RED at end of this plan, GREEN by end of Wave 2.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-RESEARCH.md
@.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-VALIDATION.md
@CLAUDE.md
@app/tests/services/style-assignment.test.mjs
@app/tests/services/post-queue.test.mjs
@app/src/services/style-assignment.ts
@app/src/services/post-queue.service.ts

<interfaces>
<!-- Existing exports the new tests will import. Wave 1 and Wave 2 add new exports. -->

From app/src/services/style-assignment.ts (current — Wave 0 reference only):
```typescript
export const STYLE_WEIGHTS: Record<string, number>;     // 0.10/0.55/0.05/0.10/0.10/0.10
export interface ApiAvailability {
  hasYoutubeKey: boolean; hasTavilyKey: boolean; hasImageGenKey: boolean;
}
export interface StyleAssignment { conceptId: string; style: PresentationStyle; }
export function assignStyles(conceptIds: string[], availability: ApiAvailability): StyleAssignment[];
export function reassignFailures(assignments: StyleAssignment[], failedIds: Set<string>): StyleAssignment[];
```

From app/src/services/post-queue.service.ts (current — Wave 0 reference only):
```typescript
// QueueState is INTERNAL — Wave 2 extends it with derivedList + cyclePosition.
export const postQueueService: {
  getQueue(): DailyPost[];
  enqueue(posts: DailyPost[]): void;
  enqueueInterleaved(posts: DailyPost[], mixer: (combined: DailyPost[]) => void): void;
  dequeue(count: number): DailyPost[];
  size(): number;
  needsRefill(): boolean;
  getCycleNumber(): number;
  incrementCycle(): void;
  resetForNewDay(): void;
  loadQueue(): void;
  getYesterdayQueue(): DailyPost[];
  // Wave 2 ADDS: getDerivedList, getCyclePosition, appendToDerivedList, walkDerivedList
};
```

Wave-1 / Wave-2 NEW exports the tests refer to (these do NOT exist yet — that's why the tests are RED):
- `assignStylesStratified(conceptIds, availability): StyleAssignment[]` (Plan 36-01)
- `spreadByConcept(posts: DailyPost[]): void` (Plan 36-02 — exported from concept-feed.service.ts)
- `postQueueService.appendToDerivedList(ids: string[]): void` (Plan 36-03)
- `postQueueService.walkDerivedList(count: number, exploredIds: Set<string>): string[]` (Plan 36-03)
- `postQueueService.getDerivedList(): string[]` (Plan 36-03)
- `postQueueService.getCyclePosition(): number` (Plan 36-03)

</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write RED test file derived-list.test.mjs (GAP-1 + GAP-2 + REGRESSION)</name>
  <files>app/tests/services/derived-list.test.mjs</files>
  <read_first>
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-RESEARCH.md (section "Pattern 1: Persistent Derived List", "Code Examples → Derived List Walk", "Validation Architecture → Phase Requirements → Test Map")
    - app/tests/services/post-queue.test.mjs (the localStorage polyfill + makePost helper pattern at lines 1-46 — REUSE this pattern verbatim)
    - app/src/services/post-queue.service.ts (current QueueState shape; you are testing methods it doesn't have yet — that's intentional)
    - CLAUDE.md "Concept Feed Generation Pipeline" section ("DO NOT DRIFT" — these tests encode the design)
  </read_first>
  <behavior>
    - Test 1 (GAP-1 append-only): appendToDerivedList(['a','b']) then appendToDerivedList(['c']) leaves getDerivedList() === ['a','b','c'] (no rebuild)
    - Test 2 (GAP-1 dedup): appendToDerivedList(['a','b']) then appendToDerivedList(['a','c']) results in ['a','b','c'] (a not double-appended)
    - Test 3 (GAP-1 persistence): after appendToDerivedList(['a','b','c']), call loadQueue() (simulates page reload from localStorage) — getDerivedList() still returns ['a','b','c']
    - Test 4 (GAP-1 reset): resetForNewDay() clears derivedList to [] and cyclePosition to 0
    - Test 5 (GAP-1 migration): pre-populate localStorage with a QueueState payload that LACKS derivedList + cyclePosition fields, call loadQueue() — getDerivedList() === [] and getCyclePosition() === 0 (no crash, defensive defaults)
    - Test 6 (GAP-2 walker advance): appendToDerivedList(['a','b','c','d','e','f']); walkDerivedList(4, new Set()) returns ['a','b','c','d'] AND getCyclePosition() === 4
    - Test 7 (GAP-2 walker wrap): appendToDerivedList(['a','b','c']); walkDerivedList(2, emptySet) → ['a','b'], cyclePosition=2; walkDerivedList(2, emptySet) → ['c','a'] (wrap to index 0), cyclePosition=1
    - Test 8 (GAP-2 lazy skip): appendToDerivedList(['a','b','c','d']); walkDerivedList(3, new Set(['b'])) returns ['a','c','d'] (b skipped); cyclePosition advanced past b
    - Test 9 (GAP-2 all explored): appendToDerivedList(['a','b','c']); walkDerivedList(4, new Set(['a','b','c'])) returns [] (no infinite loop — completes ≤2 full passes)
    - Test 10 (REGRESSION important weighting preservation): wave 2 will refactor buildConceptBatch to call appendToDerivedList. This test asserts that calling appendToDerivedList(['a','a','a','a','a','a','a','a']) with 8 dup IDs upstream-deduped to a single 'a' entry (since dedup is by conceptId equality per RESEARCH § Pitfall 4). Document inline as "import-time importance is preserved on FIRST append; subsequent calls do not re-weight." (Note: the upstream caller — Wave 2 — passes already-weighted IDs; this test simply guards the dedup-on-append behavior so importance from the FIRST appendToDerivedList call survives a second call with overlapping IDs.)

    Test layout: copy the post-queue.test.mjs preamble verbatim (localStorage polyfill, dynamic import, beforeEach with localStorage.clear() + postQueueService.loadQueue()).

    All 10 tests will FAIL with `TypeError: postQueueService.appendToDerivedList is not a function` (or similar) — that is correct and expected. Plan 36-03 makes them GREEN.
  </behavior>
  <action>
Create app/tests/services/derived-list.test.mjs. Reuse the EXACT preamble pattern from app/tests/services/post-queue.test.mjs lines 1-46:

```javascript
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill for Node
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const STORAGE_KEY = 'echolearn_post_queue';
const { postQueueService } = await import('../../src/services/post-queue.service.ts');

describe('derived list (GAP-1 + GAP-2)', () => {
  beforeEach(() => {
    localStorage.clear();
    postQueueService.loadQueue();
  });

  // Test 1 — append-only across two calls
  it('appendToDerivedList is append-only across two calls', () => {
    postQueueService.appendToDerivedList(['a', 'b']);
    postQueueService.appendToDerivedList(['c']);
    assert.deepEqual(postQueueService.getDerivedList(), ['a', 'b', 'c']);
  });

  // Test 2 — dedup on append
  it('appendToDerivedList dedups by conceptId equality', () => {
    postQueueService.appendToDerivedList(['a', 'b']);
    postQueueService.appendToDerivedList(['a', 'c']);
    assert.deepEqual(postQueueService.getDerivedList(), ['a', 'b', 'c']);
  });

  // Test 3 — persistence across loadQueue (simulated page reload)
  it('derivedList persists across loadQueue', () => {
    postQueueService.appendToDerivedList(['a', 'b', 'c']);
    postQueueService.loadQueue();
    assert.deepEqual(postQueueService.getDerivedList(), ['a', 'b', 'c']);
  });

  // Test 4 — resetForNewDay clears derivedList and cyclePosition
  it('resetForNewDay clears derivedList and cyclePosition', () => {
    postQueueService.appendToDerivedList(['a', 'b']);
    // walk a step so cyclePosition advances
    postQueueService.walkDerivedList(1, new Set());
    postQueueService.resetForNewDay();
    assert.deepEqual(postQueueService.getDerivedList(), []);
    assert.equal(postQueueService.getCyclePosition(), 0);
  });

  // Test 5 — migration: existing localStorage without new fields still loads
  it('loadQueue defensively defaults missing derivedList + cyclePosition', () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        date: today,
        posts: [],
        cycleNumber: 3,
        totalGenerated: 0,
        totalServed: 0,
        // intentionally NO derivedList, NO cyclePosition
      }),
    );
    postQueueService.loadQueue();
    assert.deepEqual(postQueueService.getDerivedList(), []);
    assert.equal(postQueueService.getCyclePosition(), 0);
  });

  // Test 6 — walker advances cyclePosition by `count`
  it('walkDerivedList(4, emptySet) advances cyclePosition by 4', () => {
    postQueueService.appendToDerivedList(['a', 'b', 'c', 'd', 'e', 'f']);
    const out = postQueueService.walkDerivedList(4, new Set());
    assert.deepEqual(out, ['a', 'b', 'c', 'd']);
    assert.equal(postQueueService.getCyclePosition(), 4);
  });

  // Test 7 — walker wraps to 0 on overflow
  it('walkDerivedList wraps to position 0 after reaching length', () => {
    postQueueService.appendToDerivedList(['a', 'b', 'c']);
    const first = postQueueService.walkDerivedList(2, new Set());
    assert.deepEqual(first, ['a', 'b']);
    assert.equal(postQueueService.getCyclePosition(), 2);
    const second = postQueueService.walkDerivedList(2, new Set());
    assert.deepEqual(second, ['c', 'a']);
    assert.equal(postQueueService.getCyclePosition(), 1);
  });

  // Test 8 — walker lazily skips explored ids
  it('walkDerivedList lazily skips explored ids', () => {
    postQueueService.appendToDerivedList(['a', 'b', 'c', 'd']);
    const out = postQueueService.walkDerivedList(3, new Set(['b']));
    assert.deepEqual(out, ['a', 'c', 'd']);
  });

  // Test 9 — walker returns empty when all explored, no infinite loop
  it('walkDerivedList returns [] when every entry is explored', () => {
    postQueueService.appendToDerivedList(['a', 'b', 'c']);
    const out = postQueueService.walkDerivedList(4, new Set(['a', 'b', 'c']));
    assert.deepEqual(out, []);
  });

  // Test 10 — REGRESSION: importance weighting preserved by upstream caller
  // (Wave 2's buildConceptBatch passes already-weighted IDs. appendToDerivedList
  // dedups so subsequent calls don't double-weight. This test guards the dedup-on-
  // append contract. See RESEARCH § Pitfall 4.)
  it('appendToDerivedList preserves first-call multiplicity by deduping subsequent calls', () => {
    // Wave 2 caller: anchor "a" is important → 8 entries; "b" is normal → 4 entries.
    // First append carries the weighting:
    postQueueService.appendToDerivedList(['a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'b', 'b', 'b', 'b']);
    // Second append (next refill, same anchors due) — dedup means new identical IDs are skipped:
    postQueueService.appendToDerivedList(['a', 'b']);
    const list = postQueueService.getDerivedList();
    // First-call weighting survives: a still appears 8 times, b 4 times.
    assert.equal(list.filter(x => x === 'a').length, 8);
    assert.equal(list.filter(x => x === 'b').length, 4);
  });
});
```

Run `cd app && node --test tests/services/derived-list.test.mjs` — expect 10 RED failures (TypeError: not a function or similar). Save the file and commit. Plan 36-03 will make these tests GREEN.
  </action>
  <verify>
    <automated>cd app &amp;&amp; node --test tests/services/derived-list.test.mjs 2>&amp;1 | grep -E "tests 10|fail 10|tests:|fail:" | head -3</automated>
  </verify>
  <acceptance_criteria>
    - File app/tests/services/derived-list.test.mjs exists
    - File contains 10 `it(...)` blocks (verify: `grep -cE "^  it\\(" app/tests/services/derived-list.test.mjs` returns 10)
    - File imports postQueueService from '../../src/services/post-queue.service.ts' (verify: grep finds the dynamic import)
    - File contains references to all four NEW method names: `appendToDerivedList`, `getDerivedList`, `walkDerivedList`, `getCyclePosition` (verify: `grep -E "appendToDerivedList|walkDerivedList|getDerivedList|getCyclePosition" app/tests/services/derived-list.test.mjs | wc -l` >= 10)
    - Running `cd app && node --test tests/services/derived-list.test.mjs` exits with non-zero (tests RED) but does NOT crash with import error (assertion failures only)
    - Test file uses the EXACT localStorage polyfill pattern from post-queue.test.mjs (verify: `grep -A 5 "localStorage polyfill for Node" app/tests/services/derived-list.test.mjs` finds the polyfill)
  </acceptance_criteria>
  <done>10 tests defined, file exists, RED at run time (failures are assertion failures, not import errors), pattern matches post-queue.test.mjs preamble verbatim.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Write RED test file style-assignment-stratified.test.mjs (GAP-3)</name>
  <files>app/tests/services/style-assignment-stratified.test.mjs</files>
  <read_first>
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-RESEARCH.md (section "Pattern 2: Stratified Style Allocation", "Code Examples → Largest-Remainder Stratified Allocation", "Validation Architecture")
    - app/tests/services/style-assignment.test.mjs (existing test pattern; new file mirrors the import + describe shape)
    - app/src/services/style-assignment.ts (current STYLE_WEIGHTS; you are testing a function `assignStylesStratified` that does NOT yet exist — that's intentional)
  </read_first>
  <behavior>
    - Test 1 (GAP-3 small-N image): assignStylesStratified(8 ids, all-available) — image count is in {0, 1, 2} (round(0.10×8)=1 ±1)
    - Test 2 (GAP-3 small-N text-art): assignStylesStratified(8 ids, all-available) — text-art count is in {3, 4, 5} (round(0.55×8)=4 ±1)
    - Test 3 (GAP-3 small-N total): assignStylesStratified(8 ids, all-available) — total assignments equal 8 (no missing or extra)
    - Test 4 (GAP-3 small-N each style ≥ floor): for N=12, count of each style >= floor(12 × weight) (largest-remainder lower bound)
    - Test 5 (GAP-3 zero variance over 50 runs): run assignStylesStratified(8) 50 times — every single run has image count ∈ {0,1,2}, text-art ∈ {3,4,5}, suggestion ∈ {0,1}, news ∈ {0,1,2}, video ∈ {0,1,2}, short ∈ {0,1,2} (Hamilton's method bounds within ±1 EVERY run, not just on average)
    - Test 6 (GAP-3 N=2 small-N edge): assignStylesStratified(2 ids, all-available) — 2 results, both styles in valid set, no crash
    - Test 7 (GAP-3 N=3 distribution): assignStylesStratified(3 ids, all-available) — text-art count >= 1 (since 3 × 0.55 = 1.65, floor = 1)
    - Test 8 (GAP-3 API-redirect first): assignStylesStratified(20 ids, hasImageGenKey=false) — image count === 0 (redirect runs BEFORE stratification)
    - Test 9 (GAP-3 API-redirect first, no YouTube): assignStylesStratified(20 ids, hasYoutubeKey=false) — video count + short count === 0
    - Test 10 (GAP-3 randomness — different runs different orders): two runs of assignStylesStratified(20 ids, all-available) produce different style sequences (Fisher-Yates shuffle is non-deterministic). Use a tolerance: at least 1 of 50 paired runs differs (extremely likely with proper shuffle, virtually impossible with fixed order).

    All tests will FAIL with `assignStylesStratified is not a function` (or named-import error). Plan 36-01 makes them GREEN.
  </behavior>
  <action>
Create app/tests/services/style-assignment-stratified.test.mjs:

```javascript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Pure logic — no localStorage / fetch needed.
const styleMod = await import('../../src/services/style-assignment.ts');
const { assignStylesStratified, STYLE_WEIGHTS } = styleMod;

const allAvailable = { hasYoutubeKey: true, hasTavilyKey: true, hasImageGenKey: true };

function counts(result) {
  const c = { image: 0, 'text-art': 0, suggestion: 0, news: 0, video: 0, short: 0 };
  for (const r of result) c[r.style] = (c[r.style] ?? 0) + 1;
  return c;
}

describe('style-assignment-stratified (GAP-3)', () => {
  it('N=8 image count ∈ {0, 1, 2} (round(0.10×8)=1 ±1)', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `c${i}`);
    const c = counts(assignStylesStratified(ids, allAvailable));
    assert.ok(c.image >= 0 && c.image <= 2, `image=${c.image} out of {0,1,2}`);
  });

  it('N=8 text-art count ∈ {3, 4, 5} (round(0.55×8)=4 ±1)', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `c${i}`);
    const c = counts(assignStylesStratified(ids, allAvailable));
    assert.ok(c['text-art'] >= 3 && c['text-art'] <= 5, `text-art=${c['text-art']} out of {3,4,5}`);
  });

  it('N=8 total assignments equal N', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `c${i}`);
    const result = assignStylesStratified(ids, allAvailable);
    assert.equal(result.length, 8);
  });

  it('N=12: each style count ≥ floor(12 × weight) (largest-remainder lower bound)', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `c${i}`);
    const c = counts(assignStylesStratified(ids, allAvailable));
    // Sum effective weights so we can compute proper floor
    const sum = Object.values(STYLE_WEIGHTS).reduce((a, b) => a + b, 0);
    for (const [style, weight] of Object.entries(STYLE_WEIGHTS)) {
      const expectedFloor = Math.floor(12 * weight / sum);
      assert.ok(c[style] >= expectedFloor, `${style}=${c[style]} < floor(${expectedFloor})`);
    }
  });

  it('over 50 runs of N=8, EVERY run has image ∈ {0,1,2}, text-art ∈ {3,4,5}', () => {
    for (let run = 0; run < 50; run++) {
      const ids = Array.from({ length: 8 }, (_, i) => `c${i}`);
      const c = counts(assignStylesStratified(ids, allAvailable));
      assert.ok(c.image >= 0 && c.image <= 2, `run ${run}: image=${c.image}`);
      assert.ok(c['text-art'] >= 3 && c['text-art'] <= 5, `run ${run}: text-art=${c['text-art']}`);
    }
  });

  it('N=2 small-N edge: returns 2 valid assignments, no crash', () => {
    const result = assignStylesStratified(['c1', 'c2'], allAvailable);
    assert.equal(result.length, 2);
    const valid = new Set(['image', 'text-art', 'suggestion', 'news', 'video', 'short']);
    for (const r of result) assert.ok(valid.has(r.style));
  });

  it('N=3: text-art appears at least once (floor(3×0.55/sum)=1)', () => {
    const ids = ['c1', 'c2', 'c3'];
    const c = counts(assignStylesStratified(ids, allAvailable));
    assert.ok(c['text-art'] >= 1, `N=3 text-art=${c['text-art']} should be ≥ 1`);
  });

  it('hasImageGenKey=false: image count is 0 regardless of N', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `c${i}`);
    const c = counts(assignStylesStratified(ids, { ...allAvailable, hasImageGenKey: false }));
    assert.equal(c.image, 0);
  });

  it('hasYoutubeKey=false: video+short count is 0', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `c${i}`);
    const c = counts(assignStylesStratified(ids, { ...allAvailable, hasYoutubeKey: false }));
    assert.equal(c.video + c.short, 0);
  });

  it('Fisher-Yates produces different orders across runs', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `c${i}`);
    let differences = 0;
    for (let pair = 0; pair < 50; pair++) {
      const a = assignStylesStratified(ids, allAvailable).map(r => r.style).join(',');
      const b = assignStylesStratified(ids, allAvailable).map(r => r.style).join(',');
      if (a !== b) differences++;
    }
    assert.ok(differences > 0, 'expected at least 1 of 50 paired runs to differ in order');
  });
});
```

Run `cd app && node --test tests/services/style-assignment-stratified.test.mjs` — expect 10 RED failures (assignStylesStratified is undefined). Save and commit.
  </action>
  <verify>
    <automated>cd app &amp;&amp; node --test tests/services/style-assignment-stratified.test.mjs 2>&amp;1 | grep -E "tests 10|fail|tests:" | head -3</automated>
  </verify>
  <acceptance_criteria>
    - File app/tests/services/style-assignment-stratified.test.mjs exists
    - File contains 10 `it(...)` blocks (verify: `grep -cE "^  it\\(" app/tests/services/style-assignment-stratified.test.mjs` returns 10)
    - File references `assignStylesStratified` symbol (verify: `grep -c "assignStylesStratified" app/tests/services/style-assignment-stratified.test.mjs` >= 10)
    - File imports STYLE_WEIGHTS from style-assignment.ts (verify: grep finds it)
    - Running `cd app && node --test tests/services/style-assignment-stratified.test.mjs` produces test failures (NOT module-load errors) — assertions are reached, function call fails because it's undefined
  </acceptance_criteria>
  <done>10 tests defined, RED, 10 references to assignStylesStratified.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Write RED test file spread-by-concept.test.mjs (GAP-4)</name>
  <files>app/tests/services/spread-by-concept.test.mjs</files>
  <read_first>
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-RESEARCH.md (section "Pattern 3: Concept-Axis Spread", "Code Examples → spreadByConcept", "Pitfall 5")
    - app/src/services/concept-feed.service.ts lines 619-670 (spreadByStyle implementation — your spreadByConcept is an exact-shape clone with key=sourceQuestionIds[0]??id)
    - app/tests/services/post-queue.test.mjs (the makePost helper at lines 13-34 — REUSE for DailyPost stubs, the test does not need localStorage)
  </read_first>
  <behavior>
    - Test 1 (GAP-4 separation when 2 concepts): 6 posts, 3 with sourceQuestionIds=['A'], 3 with ['B'] — after spreadByConcept, no two adjacent posts share the same anchor key
    - Test 2 (GAP-4 single concept input unchanged length): 5 posts all sourceQuestionIds=['A'] — spreadByConcept returns 5 posts (length preserved); no crash
    - Test 3 (GAP-4 empty input): spreadByConcept([]) does not throw
    - Test 4 (GAP-4 1-post input unchanged): spreadByConcept on 1 post — array unchanged
    - Test 5 (GAP-4 dominant concept distribution): 8 posts, 6 with ['A'], 2 with ['B'] — A entries are spread, none of A's 6 posts are in 3+ consecutive positions (proves stride-based placement is real)
    - Test 6 (GAP-4 starter/connection key fallback): mix of posts where some have sourceQuestionIds=[] and post.id='post-1' / 'post-2' — these fallback-key posts are NOT all clustered together (RESEARCH § Pitfall 5)
    - Test 7 (GAP-4 combined with spreadByStyle invariant): 6 posts, varied (concept,style) tuples — apply spreadByConcept then spreadByStyle and assert no two adjacent posts share BOTH same concept AND same style (combined invariant satisfied as much as bucket sizes allow)

    All tests will FAIL with `spreadByConcept is not a function` (or import error). Plan 36-02 exports spreadByConcept from concept-feed.service.ts and makes these GREEN.
  </behavior>
  <action>
Create app/tests/services/spread-by-concept.test.mjs:

```javascript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Pure logic — concept-feed.service.ts requires settings.service which requires
// localStorage. Add the polyfill from post-queue.test.mjs.
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const cfMod = await import('../../src/services/concept-feed.service.ts');
const { spreadByConcept } = cfMod;

function makePost(id, anchorIds = [], style = 'text-art') {
  return {
    id,
    date: '2026-05-06',
    title: `Post ${id}`,
    teaser: { hook: '', preview: '' },
    bodyMarkdown: '',
    whyCare: '',
    takeaway: '',
    quickAskPrompts: [],
    narrativeMode: 'example-first',
    contextLabel: '',
    sourceType: 'recent',
    sourceQuestionIds: anchorIds,
    sourceQuestionTitles: [],
    keywords: [],
    generatedAt: Date.now(),
    origin: 'ai',
    presentationStyle: style,
  };
}

function conceptKey(p) {
  return p.sourceQuestionIds[0] ?? p.id;
}

describe('spread-by-concept (GAP-4)', () => {
  it('2 concepts × 3 each: no adjacent same-concept after spread', () => {
    const posts = [
      makePost('a1', ['A']), makePost('a2', ['A']), makePost('a3', ['A']),
      makePost('b1', ['B']), makePost('b2', ['B']), makePost('b3', ['B']),
    ];
    spreadByConcept(posts);
    for (let i = 1; i < posts.length; i++) {
      assert.notEqual(conceptKey(posts[i]), conceptKey(posts[i - 1]),
        `index ${i} shares concept with ${i - 1}: ${conceptKey(posts[i])}`);
    }
  });

  it('single concept input: length preserved, no crash', () => {
    const posts = [
      makePost('a1', ['A']), makePost('a2', ['A']), makePost('a3', ['A']),
      makePost('a4', ['A']), makePost('a5', ['A']),
    ];
    spreadByConcept(posts);
    assert.equal(posts.length, 5);
  });

  it('empty array does not throw', () => {
    const posts = [];
    assert.doesNotThrow(() => spreadByConcept(posts));
    assert.equal(posts.length, 0);
  });

  it('single-element array unchanged', () => {
    const posts = [makePost('only', ['A'])];
    spreadByConcept(posts);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].id, 'only');
  });

  it('dominant concept (6 of 8): no 3+ A in consecutive positions', () => {
    const posts = [
      makePost('a1', ['A']), makePost('a2', ['A']), makePost('a3', ['A']),
      makePost('a4', ['A']), makePost('a5', ['A']), makePost('a6', ['A']),
      makePost('b1', ['B']), makePost('b2', ['B']),
    ];
    spreadByConcept(posts);
    let runMax = 1, run = 1;
    for (let i = 1; i < posts.length; i++) {
      if (conceptKey(posts[i]) === conceptKey(posts[i - 1])) { run++; runMax = Math.max(runMax, run); }
      else run = 1;
    }
    assert.ok(runMax <= 2, `longest A-run = ${runMax}, expected ≤ 2 (stride spread)`);
  });

  it('starter/connection posts (empty sourceQuestionIds) NOT clustered (Pitfall 5)', () => {
    // Each empty-sourceQuestionIds post has its own unique key (= post.id)
    // so they should be treated as separate buckets, not lumped together.
    const posts = [
      makePost('starter-1', []), makePost('starter-2', []),
      makePost('a1', ['A']), makePost('a2', ['A']), makePost('a3', ['A']),
      makePost('starter-3', []),
    ];
    spreadByConcept(posts);
    // Find positions of starter posts
    const starterPositions = posts
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.sourceQuestionIds.length === 0)
      .map(({ i }) => i);
    // The three starters should NOT be in three consecutive positions
    const consecutive = starterPositions[2] - starterPositions[0] === 2;
    assert.ok(!consecutive, `starters at ${starterPositions} are 3-consecutive; should be spread`);
  });

  it('combined spreadByConcept + spreadByStyle: no two adjacent share BOTH concept AND style', async () => {
    // Plan 36-02 wires spreadByConcept BEFORE spreadByStyle in enqueueInterleaved.
    // This test simulates that order on a representative payload.
    const { spreadByStyle } = cfMod;
    const posts = [
      makePost('a1', ['A'], 'text-art'), makePost('a2', ['A'], 'image'),
      makePost('a3', ['A'], 'text-art'),
      makePost('b1', ['B'], 'text-art'), makePost('b2', ['B'], 'video'),
      makePost('b3', ['B'], 'text-art'),
    ];
    spreadByConcept(posts);
    spreadByStyle(posts);
    for (let i = 1; i < posts.length; i++) {
      const sameConcept = conceptKey(posts[i]) === conceptKey(posts[i - 1]);
      const sameStyle = posts[i].presentationStyle === posts[i - 1].presentationStyle;
      assert.ok(!(sameConcept && sameStyle),
        `index ${i} shares BOTH concept and style with ${i - 1}`);
    }
  });
});
```

Run `cd app && node --test tests/services/spread-by-concept.test.mjs` — expect 7 RED failures (spreadByConcept undefined). Save and commit.

Note the localStorage polyfill is required because importing concept-feed.service.ts pulls in settings.service which touches localStorage.
  </action>
  <verify>
    <automated>cd app &amp;&amp; node --test tests/services/spread-by-concept.test.mjs 2>&amp;1 | grep -E "tests 7|fail|tests:" | head -3</automated>
  </verify>
  <acceptance_criteria>
    - File app/tests/services/spread-by-concept.test.mjs exists
    - File contains 7 `it(...)` blocks (verify: `grep -cE "^  it\\(" app/tests/services/spread-by-concept.test.mjs` returns 7)
    - File references `spreadByConcept` symbol (verify: `grep -c "spreadByConcept" app/tests/services/spread-by-concept.test.mjs` >= 7)
    - File imports from '../../src/services/concept-feed.service.ts' (verify: grep finds the import path)
    - File contains the localStorage polyfill (verify: `grep -c "localStorage polyfill" app/tests/services/spread-by-concept.test.mjs` >= 0; presence of `globalThis.localStorage` >= 1)
    - Running `cd app && node --test tests/services/spread-by-concept.test.mjs` exits non-zero with assertion or undefined-function failures (NOT a module-not-found error)
  </acceptance_criteria>
  <done>7 tests defined; RED; references spreadByConcept; localStorage polyfill present.</done>
</task>

</tasks>

<verification>
Phase-level (after this plan):
- All three new test files exist on disk in app/tests/services/.
- Running `cd app && node --test tests/services/derived-list.test.mjs tests/services/style-assignment-stratified.test.mjs tests/services/spread-by-concept.test.mjs` exits non-zero (RED is expected).
- No new module-load / syntax errors — assertion failures or undefined-function errors only.
- Existing tests still pass: `cd app && node --test tests/services/style-assignment.test.mjs tests/services/post-queue.test.mjs` exit 0.
</verification>

<success_criteria>
Plan complete when:
- [ ] app/tests/services/derived-list.test.mjs exists with 10 it() blocks; references appendToDerivedList, walkDerivedList, getDerivedList, getCyclePosition; uses post-queue.test.mjs preamble pattern
- [ ] app/tests/services/style-assignment-stratified.test.mjs exists with 10 it() blocks; references assignStylesStratified
- [ ] app/tests/services/spread-by-concept.test.mjs exists with 7 it() blocks; references spreadByConcept; has localStorage polyfill
- [ ] All three files are RED (assertion failures or undefined-symbol errors), NOT module-load errors
- [ ] Existing test suites unaffected (post-queue.test.mjs and style-assignment.test.mjs still pass)
- [ ] Atomic git commit landing all three files together with message `test(36-00): add RED test stubs for derived list / stratified style / concept spread (Wave 0)`
</success_criteria>

<output>
After completion, create `.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-00-SUMMARY.md` summarizing:
- Three test files added (with line counts and test counts)
- RED status confirmed (paste the failing test summary from node --test output)
- No regressions in existing suites
- Git commit hash
</output>
