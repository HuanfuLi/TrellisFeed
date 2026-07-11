import assert from 'node:assert/strict';
import test from 'node:test';

const store = new Map();
globalThis.localStorage = {
  get length() { return store.size; },
  key(index) { return Array.from(store.keys())[index] ?? null; },
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); },
  clear() { store.clear(); },
};

const { dbExecute, dbQuery } = await import('../../src/services/db.service.ts');
const { eventBus } = await import('../../src/lib/event-bus.ts');
const serviceUrl = new URL('../../src/services/study-context.service.ts', import.meta.url);
let serviceInstance = 0;

async function freshStudyContext() {
  serviceInstance += 1;
  const freshUrl = new URL(serviceUrl);
  freshUrl.searchParams.set('instance', String(serviceInstance));
  const module = await import(freshUrl.href);
  return module.studyContextService;
}

test('study context binds one durable identity and rejects a conflicting re-bind', async () => {
  await dbExecute('DELETE FROM research_metadata');
  const original = {
    userId: '1042',
    condition: 'experimental',
    topicId: 'topic-opaque-1',
    boundAt: '2026-07-11T00:00:00.000Z',
  };

  const unbound = await freshStudyContext();
  await unbound.hydrate();
  assert.equal(unbound.getOptional(), null);
  assert.throws(() => unbound.getRequired(), /not bound/i);

  const emitted = [];
  const unsubscribe = eventBus.subscribe('RESEARCH_IDENTITY_BOUND', (event) => emitted.push(event.payload));
  await unbound.bindOnce(original);
  unsubscribe();
  const rows = await dbQuery('SELECT * FROM research_metadata WHERE id = ?', ['identity']);
  assert.deepEqual(rows, [{ id: 'identity', data: JSON.stringify(original) }]);
  assert.deepEqual(emitted, [{ userId: '1042', condition: 'experimental', topicId: 'topic-opaque-1' }]);

  // A distinct service instance proves the identity is read through dbQuery,
  // rather than remaining only in the first module's synchronous mirror.
  const rehydrated = await freshStudyContext();
  await rehydrated.hydrate();
  assert.equal(rehydrated.getRequired().condition, 'experimental');

  await assert.rejects(
    () => rehydrated.bindOnce({ ...original, condition: 'control' }),
    /already bound/i,
  );
  assert.deepEqual(rehydrated.getRequired(), original);

  assert.deepEqual(Object.keys(rehydrated).sort(), [
    'bindOnce', 'getOptional', 'getRequired', 'hydrate', 'isBound',
  ]);
  assert.equal('setCondition' in rehydrated, false);
  assert.equal('logout' in rehydrated, false);
  assert.equal('clear' in rehydrated, false);
});
