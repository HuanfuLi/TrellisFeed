import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateFrozenPoolBundle } from '../../../tools/content_pipeline/src/schema/validate.ts';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/content-pool/minimal-valid-pool.json', import.meta.url)));

test('content pool schema validates the runtime fixture through executable validator logic', () => {
  assert.deepEqual(validateFrozenPoolBundle(fixture), { valid: true, errors: [] });
});

test('content pool schema fails closed on dangling references and extra active fields', () => {
  const dangling = structuredClone(fixture);
  dangling.suggestedQuestions[0].targetClaimIds = ['missing'];
  const danglingResult = validateFrozenPoolBundle(dangling);
  assert.equal(danglingResult.valid, false);
  assert.ok(danglingResult.errors.some((error) => error.path === '/suggestedQuestions/0/targetClaimIds'));

  const extra = structuredClone(fixture);
  extra.posts[0].html = '<img src=x onerror=alert(1)>';
  const extraResult = validateFrozenPoolBundle(extra);
  assert.equal(extraResult.valid, false);
  assert.ok(extraResult.errors.some((error) => error.path === '/posts/0'));
});
