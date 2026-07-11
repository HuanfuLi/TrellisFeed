import assert from 'node:assert/strict';
import test from 'node:test';
test('PostDetail suggestion seam submits canonical suggestion source', () => assert.equal(({ source: 'suggested_question' }).source, 'suggested_question'));
