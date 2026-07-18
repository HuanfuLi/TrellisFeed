import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const { AskInFlightGate } = await import('../../src/lib/ask-in-flight.ts');
const source = readFileSync(new URL('../../src/screens/PostDetailScreen.tsx', import.meta.url), 'utf8');

test('AskInFlightGate rejects a second same-tick submission until the first finishes', async () => {
  const gate = new AskInFlightGate();
  let calls = 0;
  let release;
  const deferred = new Promise((resolve) => { release = resolve; });
  const submit = async () => {
    if (!gate.tryStart()) return false;
    calls += 1;
    try { await deferred; } finally { gate.finish(); }
    return true;
  };

  const first = submit();
  const second = await submit();
  assert.equal(second, false);
  assert.equal(calls, 1);
  release();
  assert.equal(await first, true);
  assert.equal(await submit(), true);
  assert.equal(calls, 2);
});

test('PostDetail uses the synchronous gate, aborts stale routes, and disables both Ask controls', () => {
  assert.match(source, /askGateRef\.current\.tryStart\(\)/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /routeGenerationRef\.current !== generation/);
  assert.equal((source.match(/disabled=\{isAsking\}/g) ?? []).length, 2);
  assert.match(source, /<OriginalContent\s+key=\{post\.id\}/);
});
