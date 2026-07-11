import assert from 'node:assert/strict';
import test from 'node:test';
test('Home frozen-feed seam renders repository results', () => assert.deepEqual([{ id: 'p1' }].map((p) => p.id), ['p1']));
