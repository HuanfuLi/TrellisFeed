import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Plan 36-02 took option (a) from the Wave-0 forward signal: spreadByConcept
// + spreadByStyle were extracted into a leaf module (`feed-spread.ts`) with
// zero transitive deps on settings.service / locales bundles, so Node's ESM
// loader can import it directly without hitting ERR_IMPORT_ATTRIBUTE_MISSING
// on en.json. concept-feed.service.ts re-exports both for runtime callers,
// so production behavior is unchanged.
import { spreadByConcept, spreadByStyle } from '../../src/services/feed-spread.ts';

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
  it('2 concepts x 3 each: no adjacent same-concept after spread', () => {
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
    assert.ok(runMax <= 2, `longest A-run = ${runMax}, expected at most 2 (stride spread)`);
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

  it('combined spreadByConcept + spreadByStyle: no two adjacent share BOTH concept AND style', () => {
    // Plan 36-02 wires spreadByConcept BEFORE spreadByStyle in enqueueInterleaved.
    // This test simulates that order on a representative payload.
    const posts = [
      makePost('a1', ['A'], 'text-art'), makePost('a2', ['A'], 'image'),
      makePost('a3', ['A'], 'text-art'),
      makePost('b1', ['B'], 'text-art'), makePost('b2', ['B'], 'suggestion'),
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
