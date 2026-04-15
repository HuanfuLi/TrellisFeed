import assert from 'node:assert/strict';
import test from 'node:test';

// Minimal localStorage shim
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.has(k) ? storage.get(k) : null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

// D-01: getTotal returns 0 when localStorage key is absent
test('getTotal returns 0 when localStorage key is absent', async () => {
  storage.clear();
  const { trellisCreditsService } = await import('../../src/services/trellis-credits.service.ts');
  assert.equal(trellisCreditsService.getTotal(), 0);
});

// D-01: add(5) returns 5; add(2) increments to 7; persists to trellis_fruit_credits key
test('add accumulates and persists to trellis_fruit_credits', async () => {
  storage.clear();
  const { trellisCreditsService } = await import('../../src/services/trellis-credits.service.ts');
  const first = trellisCreditsService.add(5);
  assert.equal(first, 5, 'add(5) should return 5');
  const second = trellisCreditsService.add(2);
  assert.equal(second, 7, 'add(2) on top of 5 should return 7');
  // Verify persistence: raw key must equal "7"
  assert.equal(storage.get('trellis_fruit_credits'), '7');
});

// D-01: getTotal reads the persisted value (simulates app restart)
test('getTotal reflects previously persisted value', async () => {
  storage.clear();
  storage.set('trellis_fruit_credits', '12');
  const { trellisCreditsService } = await import('../../src/services/trellis-credits.service.ts');
  assert.equal(trellisCreditsService.getTotal(), 12);
});

// D-02: corrupted localStorage value returns 0 (isFinite guard)
test('getTotal returns 0 when localStorage value is "NaN"', async () => {
  storage.clear();
  storage.set('trellis_fruit_credits', 'NaN');
  const { trellisCreditsService } = await import('../../src/services/trellis-credits.service.ts');
  assert.equal(trellisCreditsService.getTotal(), 0);
});

test('getTotal returns 0 when localStorage value is a non-numeric string', async () => {
  storage.clear();
  storage.set('trellis_fruit_credits', 'abc');
  const { trellisCreditsService } = await import('../../src/services/trellis-credits.service.ts');
  assert.equal(trellisCreditsService.getTotal(), 0);
});

// Negative/zero guard: add(0) is a no-op (returns current total unchanged)
test('add(0) is a no-op and returns current total', async () => {
  storage.clear();
  storage.set('trellis_fruit_credits', '3');
  const { trellisCreditsService } = await import('../../src/services/trellis-credits.service.ts');
  const result = trellisCreditsService.add(0);
  assert.equal(result, 3, 'add(0) should return unchanged total');
  assert.equal(storage.get('trellis_fruit_credits'), '3');
});

// Negative guard: add(-3) should not decrement (clamped to 0 contribution)
test('add(-3) does not decrement the total', async () => {
  storage.clear();
  storage.set('trellis_fruit_credits', '5');
  const { trellisCreditsService } = await import('../../src/services/trellis-credits.service.ts');
  const result = trellisCreditsService.add(-3);
  assert.equal(result, 5, 'add(-3) should not reduce the total below current value');
});
