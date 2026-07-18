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
    const token = gate.tryStart();
    if (!token) return false;
    calls += 1;
    try { await deferred; } finally { gate.finish(token); }
    return true;
  };

  const first = submit();
  const second = await submit();
  assert.equal(second, false);
  assert.equal(calls, 1);
  release();
  assert.equal(await first, true);
  const third = submit();
  release();
  assert.equal(await third, true);
  assert.equal(calls, 2);
});

test('a stale route owner cannot release the current route Ask lock', () => {
  const gate = new AskInFlightGate();
  const askA = gate.tryStart();
  assert.ok(askA);

  gate.reset();
  const askB = gate.tryStart();
  assert.ok(askB);

  assert.equal(gate.finish(askA), false, 'stale Ask A must not release Ask B');
  assert.equal(gate.tryStart(), null, 'Ask C remains rejected while Ask B is active');
  assert.equal(gate.finish(askB), true);
  assert.ok(gate.tryStart(), 'a new Ask may start only after Ask B finishes');
});

test('PostDetail uses the synchronous gate, aborts stale routes, and disables both Ask controls', () => {
  assert.match(source, /const askToken = askGateRef\.current\.tryStart\(\)/);
  assert.match(source, /askGateRef\.current\.finish\(askToken\)/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /routeGenerationRef\.current !== generation/);
  assert.equal((source.match(/disabled=\{isAsking\}/g) ?? []).length, 2);
  assert.match(source, /<OriginalContent\s+key=\{post\.id\}/);
});
