import assert from 'node:assert/strict';
import test from 'node:test';

const prompt = ({ postId, text }) => ({ postId, text });
test('post Q&A prompt is identical across study conditions', () => {
  assert.deepEqual(prompt({ condition: 'control', postId: 'p1', text: 'why?' }), prompt({ condition: 'experimental', postId: 'p1', text: 'why?' }));
});
