import assert from 'node:assert/strict';
import test from 'node:test';

// Mock localStorage before importing the service
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
  get length() { return store.size; },
  key: (i) => [...store.keys()][i] ?? null,
};

const { getRateLimitStatus, incrementAskCount, getAskCount } = await import(
  '../src/services/ask-rate-limiter.service.ts'
);

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

test.beforeEach(() => {
  store.clear();
});

test('getRateLimitStatus with limit=0 returns unlimited (canAsk true, no reset date)', () => {
  const status = getRateLimitStatus(0);
  assert.equal(status.count, 0);
  assert.equal(status.canAsk, true);
  assert.equal(status.nearLimit, false);
  assert.equal(status.resetDate, '');
});

test('getRateLimitStatus with count at 80% of limit returns nearLimit true', () => {
  // Set count to 8 with limit 10 => 80%
  store.set('echolearn_ask_rate_limit', JSON.stringify({ count: 8, yearMonth: currentYearMonth() }));
  const status = getRateLimitStatus(10);
  assert.equal(status.count, 8);
  assert.equal(status.canAsk, true);
  assert.equal(status.nearLimit, true);
  assert.ok(status.resetDate.length > 0);
});

test('getRateLimitStatus with count at limit returns canAsk false', () => {
  store.set('echolearn_ask_rate_limit', JSON.stringify({ count: 10, yearMonth: currentYearMonth() }));
  const status = getRateLimitStatus(10);
  assert.equal(status.count, 10);
  assert.equal(status.canAsk, false);
  assert.equal(status.nearLimit, true);
});

test('getRateLimitStatus with count below 80% returns nearLimit false', () => {
  store.set('echolearn_ask_rate_limit', JSON.stringify({ count: 5, yearMonth: currentYearMonth() }));
  const status = getRateLimitStatus(10);
  assert.equal(status.count, 5);
  assert.equal(status.canAsk, true);
  assert.equal(status.nearLimit, false);
});

test('incrementAskCount increments count from 0 to 1', () => {
  incrementAskCount();
  assert.equal(getAskCount(), 1);
});

test('incrementAskCount with stale yearMonth resets to 1', () => {
  store.set('echolearn_ask_rate_limit', JSON.stringify({ count: 42, yearMonth: '2020-01' }));
  incrementAskCount();
  assert.equal(getAskCount(), 1);
});

test('getRateLimitStatus with stale yearMonth resets count to 0', () => {
  store.set('echolearn_ask_rate_limit', JSON.stringify({ count: 99, yearMonth: '2020-01' }));
  const status = getRateLimitStatus(10);
  assert.equal(status.count, 0);
  assert.equal(status.canAsk, true);
});

test('resetDate is the 1st of next month formatted as readable string', () => {
  const status = getRateLimitStatus(10);
  // Should contain a month name and "1" for the day
  assert.match(status.resetDate, /\w+ 1, \d{4}/);
});
