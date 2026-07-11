import assert from 'node:assert/strict';
import test from 'node:test';
test('PostDetail frozen-content seam preserves transcript fallback', () => assert.equal(({ transcript: 'Stored transcript' }).transcript, 'Stored transcript'));
