import assert from 'node:assert/strict';
import test from 'node:test';

test('AppEvent includes REVIEW_COMPLETED', async () => {
  const { eventBus } = await import('../src/lib/event-bus.ts');
  let received = null;
  const unsub = eventBus.subscribe('REVIEW_COMPLETED', (e) => { received = e; });
  eventBus.emit({ type: 'REVIEW_COMPLETED', payload: { questionId: 'q1', anchorId: 'a1' } });
  unsub();
  assert.equal(received?.type, 'REVIEW_COMPLETED');
  assert.equal(received?.payload?.anchorId, 'a1');
});

test('AppEvent includes CLASSIFICATION_COMPLETED', async () => {
  const { eventBus } = await import('../src/lib/event-bus.ts');
  let received = null;
  const unsub = eventBus.subscribe('CLASSIFICATION_COMPLETED', (e) => { received = e; });
  eventBus.emit({ type: 'CLASSIFICATION_COMPLETED', payload: { anchorId: 'a1', anchorName: 'Transformer' } });
  unsub();
  assert.equal(received?.payload?.anchorName, 'Transformer');
});

test('AppEvent includes ANCHOR_DELETED', async () => {
  const { eventBus } = await import('../src/lib/event-bus.ts');
  let received = null;
  const unsub = eventBus.subscribe('ANCHOR_DELETED', (e) => { received = e; });
  eventBus.emit({ type: 'ANCHOR_DELETED', payload: { anchorId: 'a1' } });
  unsub();
  assert.equal(received?.payload?.anchorId, 'a1');
});
