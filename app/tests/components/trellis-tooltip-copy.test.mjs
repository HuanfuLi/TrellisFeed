import assert from 'node:assert/strict';
import test from 'node:test';

test('pluralize handles singular and plural', async () => {
  const mod = await import('../../src/components/trellis/TrellisTooltip.tsx');
  assert.equal(mod.pluralize(1, 'card'), '1 card');
  assert.equal(mod.pluralize(3, 'card'), '3 cards');
  assert.equal(mod.pluralize(1, 'day'), '1 day');
  assert.equal(mod.pluralize(7, 'day'), '7 days');
});

test('resolveHealthCopy returns exact UI-SPEC copy per state', async () => {
  const mod = await import('../../src/components/trellis/TrellisTooltip.tsx');
  assert.equal(mod.resolveHealthCopy('green', 0, 0), 'On track — keep going');
  assert.equal(mod.resolveHealthCopy('dying', 2, 0), 'Due soon — 2 cards need a quick review');
  assert.equal(mod.resolveHealthCopy('falling', 1, 0), 'Slipping — 1 card overdue by a week');
  assert.equal(mod.resolveHealthCopy('dead', 3, 0), 'Needs attention — 3 cards long overdue');
  assert.equal(mod.resolveHealthCopy('blossom', 0, 0), 'Mastered — beautifully done');
  assert.equal(mod.resolveHealthCopy('fruit', 0, 14), 'Sustained mastery — 14 days strong');
  assert.equal(mod.resolveHealthCopy('bud', 0, 0), 'Newly planted');
});

test('LEAF_STATE_COLOR covers all 7 states', async () => {
  const { LEAF_STATE_COLOR } = await import('../../src/components/trellis/TrellisLeaf.tsx');
  const expected = ['bud', 'green', 'dying', 'falling', 'dead', 'blossom', 'fruit'];
  for (const s of expected) {
    assert.ok(LEAF_STATE_COLOR[s], `missing color for ${s}`);
    assert.match(LEAF_STATE_COLOR[s], /^var\(--/, `${s} should be a CSS var`);
  }
});
