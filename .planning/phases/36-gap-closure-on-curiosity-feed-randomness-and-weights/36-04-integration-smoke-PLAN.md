---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 04
type: execute
wave: 3
depends_on: [01, 02, 03]
files_modified:
  - app/tests/services/refill-queue-integration.test.mjs
autonomous: true
requirements: [GAP-1, GAP-2, GAP-3, GAP-4]
gap_closure: true
must_haves:
  truths:
    - "End-to-end refillQueue smoke test exists, exercising all four GAP fixes against the live code path"
    - "Full test suite (`cd app && npm test`) is GREEN — i.e., no NEW failures vs. the pre-Phase-36 baseline (389 pass / 26 fail per STATE.md 2026-04-29 — pre-existing JSON-import-attribute failures may persist)"
    - "Distribution invariants hold across at least 5 simulated refill cycles in sequence (cyclePosition advances; derivedList stays append-only; styles are stratified ±1 each cycle)"
  artifacts:
    - path: app/tests/services/refill-queue-integration.test.mjs
      provides: "End-to-end smoke verifying all four invariants act together"
      contains: "refillQueue"
  key_links:
    - from: "app/tests/services/refill-queue-integration.test.mjs"
      to: "app/src/services/concept-feed.service.ts"
      via: "imports refillQueue + postQueueService"
      pattern: "refillQueue|postQueueService"
---

<objective>
Land an end-to-end integration smoke test that exercises the full refillQueue cycle with mocks for external APIs (LLM, YouTube, Tavily, image gen). The test verifies all four Phase 36 invariants in concert, not in isolation:
- (GAP-1) After refillQueue runs twice in a row, postQueueService.getDerivedList() length is monotonic non-decreasing.
- (GAP-2) After two refillQueue calls, postQueueService.getCyclePosition() has advanced (not stuck at 0); a third call wraps if length is exceeded.
- (GAP-3) Style counts in the resulting queue are within ±1 of round(N×weight) for each style.
- (GAP-4) No two adjacent posts in the resulting queue share the same anchor key.
- (Combined) After all-anchors-explored, refillQueue's allExplored cap gate fires correctly (no new generation).

Final phase gate: `cd app && npm test` reports zero NEW failures vs. the documented baseline.

Purpose: Catch any latent integration drift between Plans 36-01, 36-02, 36-03 that wave-isolated unit tests cannot see — e.g., a refactor that breaks downstream `assignStyles` consumption of `walkDerivedList`'s output.
Output: One new test file `app/tests/services/refill-queue-integration.test.mjs`. No production code changes.
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
@app/src/services/post-queue.service.ts
@app/src/services/style-assignment.ts
@app/tests/services/concept-batch-filter.test.mjs
@app/tests/services/concept-feed-cross-cycle-dedup.test.mjs
@app/tests/services/post-queue.test.mjs

<interfaces>
The full refillQueue chain consumed by this test:
- `conceptFeedService` is the export pattern; refillQueue is exported as a top-level function from concept-feed.service.ts
- Need to mock: chatStream/chatCompletion (provider/llm/index.ts), youtubeService, webSearch, settingsService.getSync(), dailyReadService.getExploredAnchors()
- Pattern reference: see how `concept-feed-cross-cycle-dedup.test.mjs` mocks these — REUSE that mock setup approach if it exists; otherwise build a minimal one.

Use `import.meta.env` is NOT defined under node --test by default — refillQueue's dev-mode console.info blocks all guard with `typeof import.meta !== 'undefined' && import.meta.env?.DEV` so they will safely no-op under the test.

STYLE_WEIGHTS is imported from `app/src/services/style-assignment.ts` to avoid drift if weights are tuned. Sum of current weights is 1.00 (0.10 + 0.55 + 0.05 + 0.10 + 0.10 + 0.10 = 1.00).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write integration smoke test for the full Phase 36 refill pipeline</name>
  <files>app/tests/services/refill-queue-integration.test.mjs</files>
  <read_first>
    - app/tests/services/concept-feed-cross-cycle-dedup.test.mjs (existing pattern for mocking the refill pipeline — copy its mock-loader setup if present)
    - app/tests/services/post-queue.test.mjs (the localStorage polyfill pattern)
    - app/src/services/concept-feed.service.ts (refillQueue function — read enough to know what mocks are needed; specifically lines 1234-1442)
    - app/src/services/style-assignment.ts (STYLE_WEIGHTS export — import this rather than re-declaring the literal in the test)
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-RESEARCH.md (Validation Architecture — list of GAP-mapped tests + Pitfall 4 multiplicity contract)
    - CLAUDE.md "Concept Feed Generation Pipeline" + "Numeric defaults" (REFILL_THRESHOLD = 12, MAX_QUEUE_SIZE = 32, BASE_ENTRIES_PER_CONCEPT = 4)
  </read_first>
  <behavior>
    - Test 1 (GAP-1 derivedList monotonic ACROSS calls): two appendToDerivedList calls — first with ['A','B'], second with ['A','C']. Assert getDerivedList().length === 3 ('A' deduplicated across calls; 'C' added). This validates ACROSS-CALL dedup, NOT within-call dedup. Within-call multiplicity preservation is covered by Plan 36-00 Test 10.
    - Test 2 (GAP-2 cyclePosition advances): After first refill, cyclePosition > 0 (walkDerivedList collected entries). After second refill, cyclePosition has advanced further. After enough refills to exceed derivedList.length, cyclePosition wraps (< previous max).
    - Test 3 (GAP-3 stratification): After one refill that produced N >= 8 posts, style counts in the resulting queue are within ±1 of round(N × weight) for every style with weight > 0. STYLE_WEIGHTS sum = 1.00.
    - Test 4 (GAP-4 concept spread): Resulting queue has no two adjacent posts sharing the same anchor key (when ≥ 2 anchors are due).
    - Test 5 (Composition smoke): 3 unique IDs ['A','B','C'] appended; walkDerivedList(3, emptySet) returns 3 entries. Each fed through assignStylesStratified + spread to build a 3-post queue.
    - Test 6 (allExplored gate): Mark all anchors as explored via exploredIds set → walkDerivedList returns []. (Caller's early-return guard is what stops generation; no posts enter queue.)

    Notes on mocking strategy: refillQueue is heavy. If the existing test mock infrastructure (concept-feed-cross-cycle-dedup.test.mjs) does not already isolate refillQueue from its async dependencies, this test may need to use a SIMPLIFIED variant — e.g., instead of calling refillQueue() directly, construct the same conceptId batch + assignment + spread pipeline in-test using the exported helpers (assignStylesStratified, spreadByConcept, spreadByStyle, postQueueService.appendToDerivedList, postQueueService.walkDerivedList).

    The simplified path is acceptable because:
    1. Each individual function is already covered by Wave 0 + Wave 1 + Wave 2 unit tests.
    2. The integration concern this test guards is "do they compose correctly?" which the simplified pipeline tests directly.
    3. Mocking refillQueue's full async chain (LLM + YouTube + Tavily + image gen) is high-effort and introduces test fragility.

    Pick the path of least resistance — if concept-feed-cross-cycle-dedup.test.mjs already provides a refillQueue mock harness, REUSE it; otherwise use the simplified path. Document the choice in a top-of-file comment.
  </behavior>
  <action>
First, read `app/tests/services/concept-feed-cross-cycle-dedup.test.mjs` to discover whether it has a usable refillQueue mock harness. If yes, model your test on it. If no, use the SIMPLIFIED PATH below.

**Simplified path** — verifies the composition of Phase 36 helpers without mocking external APIs:

Create `app/tests/services/refill-queue-integration.test.mjs`:

```javascript
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill (post-queue.test.mjs pattern)
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

// SIMPLIFIED INTEGRATION PATH (Phase 36 — see plan 36-04 for rationale):
// We test composition of the Phase 36 helpers (appendToDerivedList,
// walkDerivedList, assignStylesStratified, spreadByConcept, spreadByStyle)
// directly, without mocking refillQueue's full async chain (LLM/YouTube/
// Tavily/image-gen). The unit-test coverage in Waves 0-2 already validates
// each helper in isolation; this file validates that they COMPOSE.

const { postQueueService } = await import('../../src/services/post-queue.service.ts');
const { assignStylesStratified, STYLE_WEIGHTS } = await import('../../src/services/style-assignment.ts');
const { spreadByConcept, spreadByStyle } = await import('../../src/services/concept-feed.service.ts');

const allAvailable = { hasYoutubeKey: true, hasTavilyKey: true, hasImageGenKey: true };

function makePost(id, anchorIds, style) {
  return {
    id, date: '2026-05-06', title: id,
    teaser: { hook: '', preview: '' }, bodyMarkdown: '', whyCare: '', takeaway: '',
    quickAskPrompts: [], narrativeMode: 'example-first', contextLabel: '',
    sourceType: 'recent', sourceQuestionIds: anchorIds, sourceQuestionTitles: [],
    keywords: [], generatedAt: Date.now(), origin: 'ai',
    presentationStyle: style,
  };
}

function conceptKey(p) {
  return p.sourceQuestionIds[0] ?? p.id;
}

describe('refill-queue integration (Phase 36 GAP-1..4 composition)', () => {
  beforeEach(() => {
    localStorage.clear();
    postQueueService.loadQueue();
  });

  it('GAP-1 — derivedList grows monotonically across calls; cross-call dedup eliminates repeats', () => {
    // Cycle 1: 2 unique IDs appended
    postQueueService.appendToDerivedList(['A', 'B']);
    const len1 = postQueueService.getDerivedList().length;
    assert.equal(len1, 2, 'first call appends both unique IDs');

    // Cycle 2: 'A' is already present (cross-call dedup), 'C' is new
    postQueueService.appendToDerivedList(['A', 'C']);
    const len2 = postQueueService.getDerivedList().length;
    assert.equal(len2, 3, "'A' deduplicated across calls; 'C' added");
    assert.ok(len2 >= len1, 'derivedList is monotonic non-decreasing');

    // Cycle 3: another already-present concept and a new one
    postQueueService.appendToDerivedList(['B', 'D']);
    const len3 = postQueueService.getDerivedList().length;
    assert.equal(len3, 4, "'B' deduplicated; 'D' added");
    assert.ok(len3 >= len2, 'still monotonic');
  });

  it('GAP-2 — cyclePosition advances and wraps across multiple walks', () => {
    postQueueService.appendToDerivedList(['A', 'B', 'C', 'D']);
    assert.equal(postQueueService.getCyclePosition(), 0);

    const w1 = postQueueService.walkDerivedList(2, new Set());
    assert.deepEqual(w1, ['A', 'B']);
    assert.equal(postQueueService.getCyclePosition(), 2);

    const w2 = postQueueService.walkDerivedList(2, new Set());
    assert.deepEqual(w2, ['C', 'D']);
    assert.equal(postQueueService.getCyclePosition(), 0, 'wrapped to 0');

    // Subsequent walk should resume from 0
    const w3 = postQueueService.walkDerivedList(1, new Set());
    assert.deepEqual(w3, ['A']);
    assert.equal(postQueueService.getCyclePosition(), 1);
  });

  it('GAP-3 — stratification across simulated refill: 12 conceptIds → ±1 of round(12×w)', () => {
    const conceptIds = ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D'];
    const assignments = assignStylesStratified(conceptIds, allAvailable);
    const counts = {};
    for (const a of assignments) counts[a.style] = (counts[a.style] ?? 0) + 1;

    // STYLE_WEIGHTS sum = 1.00 (0.10 + 0.55 + 0.05 + 0.10 + 0.10 + 0.10).
    // Imported from style-assignment.ts to avoid drift if weights are tuned.
    const sum = Object.values(STYLE_WEIGHTS).reduce((a, b) => a + b, 0);
    for (const [style, weight] of Object.entries(STYLE_WEIGHTS)) {
      const expected = Math.round(12 * weight / sum);
      const actual = counts[style] ?? 0;
      assert.ok(Math.abs(actual - expected) <= 1,
        `${style}: actual=${actual}, expected=${expected} ±1`);
    }
  });

  it('GAP-4 — combined concept + style spread: no adjacent shares BOTH', () => {
    // 8-post batch: 4 of A, 4 of B; alternating styles
    const posts = [
      makePost('a1', ['A'], 'text-art'), makePost('a2', ['A'], 'video'),
      makePost('a3', ['A'], 'text-art'), makePost('a4', ['A'], 'image'),
      makePost('b1', ['B'], 'text-art'), makePost('b2', ['B'], 'news'),
      makePost('b3', ['B'], 'text-art'), makePost('b4', ['B'], 'short'),
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

  it('Composition smoke — append/walk/stratify/spread chain produces a usable queue', () => {
    // Simulate one refill cycle with 3 unique anchors due:
    postQueueService.appendToDerivedList(['A', 'B', 'C']);
    const conceptIds = postQueueService.walkDerivedList(3, new Set());
    assert.equal(conceptIds.length, 3, 'walk returns all 3 unique IDs');

    const assignments = assignStylesStratified(conceptIds, allAvailable);
    assert.equal(assignments.length, 3);

    // Build mock posts from assignments
    const posts = assignments.map((a, i) => makePost(`p${i}`, [a.conceptId], a.style));
    spreadByConcept(posts);
    spreadByStyle(posts);
    assert.equal(posts.length, 3);

    // Persist as queue
    postQueueService.enqueue(posts);
    assert.equal(postQueueService.size(), 3);
  });

  it('All-explored — walkDerivedList returns [] (caller early-returns)', () => {
    postQueueService.appendToDerivedList(['A', 'B', 'C']);
    const walked = postQueueService.walkDerivedList(8, new Set(['A', 'B', 'C']));
    assert.deepEqual(walked, [], 'all-explored produces []');
  });
});
```

**Verify:**
1. `cd app && node --test tests/services/refill-queue-integration.test.mjs` → 6/6 pass.
2. `cd app && npx tsc -b --noEmit` → exit 0.
3. `cd app && npm test` — record total pass/fail. Confirm count is `>= 389 pass / <= 26 fail` (the documented pre-Phase-36 baseline from STATE.md 2026-04-29). Phase 36 should have ADDED tests (Wave 0's 27 new assertions across 3 files + this plan's 6) so pass count should be HIGHER than 389; fail count should be UNCHANGED at 26 (pre-existing JSON-import-attribute issues).

**If `npm test` shows NEW failures (fail count > 26):** Diagnose first — look at the diff between failing test names this run vs. STATE.md baseline. If the new failures are CAUSED by Phase 36 changes, that is a regression and the executor must investigate before completing this plan. Common causes: a Wave 1/2 change broke a non-Phase-36 test that imports the modified file. Do NOT silence failing tests; instead, return to the responsible plan (36-01/02/03) for revision.

**Commit message:** `test(36-04): integration smoke for Phase 36 GAP-1..4 composition (closes integration concern)`
  </action>
  <verify>
    <automated>cd app &amp;&amp; node --test tests/services/refill-queue-integration.test.mjs 2>&amp;1 | grep -E "tests|pass|fail" | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - File app/tests/services/refill-queue-integration.test.mjs exists
    - File contains 6 `it(...)` blocks (verify: `grep -cE "^  it\\(" app/tests/services/refill-queue-integration.test.mjs` returns 6)
    - File imports postQueueService, assignStylesStratified, STYLE_WEIGHTS, spreadByConcept, spreadByStyle (verify: `grep -E "postQueueService|assignStylesStratified|STYLE_WEIGHTS|spreadByConcept|spreadByStyle" app/tests/services/refill-queue-integration.test.mjs | wc -l` >= 5)
    - STYLE_WEIGHTS is imported from style-assignment.ts, NOT redeclared as a literal (verify: `grep -c "import.*STYLE_WEIGHTS.*style-assignment" app/tests/services/refill-queue-integration.test.mjs` >= 1; `grep -c "const STYLE_WEIGHTS = {" app/tests/services/refill-queue-integration.test.mjs` returns 0)
    - Test 3 comment correctly states `STYLE_WEIGHTS sum = 1.00` (verify: `grep -c "sum = 1.00" app/tests/services/refill-queue-integration.test.mjs` >= 1; `grep -c "sum = 1.05" app/tests/services/refill-queue-integration.test.mjs` returns 0)
    - Running `cd app && node --test tests/services/refill-queue-integration.test.mjs` exits 0
    - `cd app && npm test` reports total pass count >= 389 + 27 = 416 (Wave 0 added 27, this plan adds 6 → 33 new, baseline was 389; baseline included the existing tests that survive)
    - `cd app && npm test` reports fail count <= 26 (no NEW failures vs. baseline; pre-existing JSON-import-attribute failures may persist)
    - `cd app && npx tsc -b --noEmit` exits 0
    - The simplified-path comment is present at the top of the file (verify: `grep -c "SIMPLIFIED INTEGRATION PATH" app/tests/services/refill-queue-integration.test.mjs` >= 1)
  </acceptance_criteria>
  <done>Integration smoke file lands; 6/6 GREEN; full npm test reports no NEW failures vs. the 389/26 baseline; tsc clean; STYLE_WEIGHTS imported (no drift); Test 3 comment correct.</done>
</task>

</tasks>

<verification>
- `cd app && node --test tests/services/refill-queue-integration.test.mjs` → 6/6 pass
- `cd app && npm test` shows pass count >= prior baseline + new tests; fail count <= 26 (no NEW failures)
- `cd app && npx tsc -b --noEmit` exit 0
</verification>

<success_criteria>
Plan complete when:
- [ ] refill-queue-integration.test.mjs exists with 6 tests
- [ ] All 6 tests GREEN
- [ ] STYLE_WEIGHTS imported from style-assignment.ts (no inline duplicate)
- [ ] Test 3 comment accurately states `sum = 1.00`
- [ ] Test 1 validates ACROSS-call dedup (length=3 after two appends), not within-call dedup
- [ ] Test 5 walks 3 unique IDs (matches input cardinality)
- [ ] Full npm test no-NEW-failure check passes (fail count unchanged from baseline)
- [ ] tsc clean
- [ ] Single atomic commit
</success_criteria>

<output>
After completion, create `.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-04-SUMMARY.md` with:
- New test file's 6/6 result
- Full npm test count (paste pass / fail summary line)
- Comparison vs. baseline (389 pass / 26 fail per STATE.md): explicit assertion that fail count is UNCHANGED
- If any new test files in Waves 0-2 produced unexpected suite-level effects, document them
- Git commit hash
</output>
</output>
