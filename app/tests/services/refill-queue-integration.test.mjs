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
//
// Note: spread helpers are imported from the leaf module `feed-spread.ts`
// (same path used by spread-by-concept.test.mjs) instead of from
// concept-feed.service.ts. Importing concept-feed.service.ts under
// `node --test` crashes via the i18n chain (en.json import-attribute), and
// the leaf module is the runtime source — concept-feed.service.ts merely
// re-exports the same symbols. CLAUDE.md i18n testing rule honored.

// Dynamic imports (await import) — required because post-queue.service.ts
// touches localStorage at module-load time. The polyfill above must run
// FIRST, then the module loads cleanly. STYLE_WEIGHTS is still imported
// from style-assignment.ts (drift-proof) — any future weight tuning
// auto-flows into this test without edits.
const { postQueueService } = await import('../../src/services/post-queue.service.ts');
// import STYLE_WEIGHTS from style-assignment.ts to avoid drift if weights are tuned
const { assignStylesStratified, STYLE_WEIGHTS } = await import('../../src/services/style-assignment.ts');
const { spreadByConcept, spreadByStyle } = await import('../../src/services/feed-spread.ts');

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
});
