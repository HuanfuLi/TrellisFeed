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

test('AppEvent includes GRAPH_UPDATED (unified graph-mutation signal)', async () => {
  const { eventBus } = await import('../src/lib/event-bus.ts');
  let received = null;
  const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => { received = e; });
  eventBus.emit({ type: 'GRAPH_UPDATED' });
  unsub();
  assert.equal(received?.type, 'GRAPH_UPDATED');
});

test('AppEvent includes ANCHOR_DELETED', async () => {
  const { eventBus } = await import('../src/lib/event-bus.ts');
  let received = null;
  const unsub = eventBus.subscribe('ANCHOR_DELETED', (e) => { received = e; });
  eventBus.emit({ type: 'ANCHOR_DELETED', payload: { anchorId: 'a1' } });
  unsub();
  assert.equal(received?.payload?.anchorId, 'a1');
});

test('AppEvent includes LOCALE_CHANGED (Phase 27 — Plan 04 mid-stream-abort dependency)', async () => {
  const { eventBus } = await import('../src/lib/event-bus.ts');
  let received = null;
  const unsub = eventBus.subscribe('LOCALE_CHANGED', (e) => { received = e; });
  eventBus.emit({ type: 'LOCALE_CHANGED', payload: { locale: 'zh' } });
  unsub();
  assert.equal(received?.type, 'LOCALE_CHANGED');
  assert.equal(received?.payload?.locale, 'zh');
});
