import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(here, p), 'utf8');

// ── Plan 27-04 (D-22) —  Mid-stream abort on LOCALE_CHANGED ──
//
// Pragmatic mix: 3 static-grep "plumbing present" proofs covering Pass 1 AND
// Pass 2 of askStreaming + 1 behavioral stubbed-async-iterator test. React
// integration isn't needed here — the invariants are:
//   (a) CompletionOptions.signal exists and is composed into the provider fetch
//   (b) useQuestions subscribes to LOCALE_CHANGED and aborts one shared
//       controller used by BOTH streaming loops (Pass 1 + Pass 2)
//   (c) Every buildAndSave path is gated behind an `aborted` check and toasts

test('CompletionOptions accepts optional signal (D-22 plumb-through)', () => {
  const llm = read('../../src/providers/llm/index.ts');
  assert.match(llm, /signal\?:\s*AbortSignal/, 'CompletionOptions.signal must be declared');
  assert.match(llm, /composeSignal/, 'providers/llm must expose composeSignal helper');
  assert.match(llm, /signal:\s*composeSignal\(/, 'provider fetch calls must compose caller signal with timeout');
});

test('useQuestions subscribes to LOCALE_CHANGED and calls abortController.abort', () => {
  const uq = read('../../src/state/useQuestions.ts');
  assert.match(uq, /eventBus\.subscribe\(['"]LOCALE_CHANGED['"]/, 'must subscribe to LOCALE_CHANGED');
  assert.match(uq, /new AbortController\(\)/, 'must create AbortController');
  assert.match(uq, /abortController\.abort/, 'subscriber must abort on LOCALE_CHANGED');
  assert.match(uq, /abortController\.signal\.aborted/, 'must guard buildAndSave behind aborted check');
  assert.match(uq, /ask\.localeChangedDiscarded/, 'must toast with ask.localeChangedDiscarded key');
  assert.match(uq, /signal:\s*abortController\.signal/, 'must pass signal to chatStream');
});

test('useQuestions passes signal to BOTH streaming passes (Pass 1 + Pass 2)', () => {
  const uq = read('../../src/state/useQuestions.ts');
  const signalCallSiteMatches = uq.match(/signal:\s*abortController\.signal/g) ?? [];
  assert.ok(
    signalCallSiteMatches.length >= 2,
    `Both Pass 1 and Pass 2 chatStream calls must receive abortController.signal — found ${signalCallSiteMatches.length} occurrence(s)`,
  );
  const abortChecks = uq.match(/abortController\.signal\.aborted/g) ?? [];
  assert.ok(
    abortChecks.length >= 3,
    `Expected >=3 aborted-check guards (Pass 1 loop, Pass 2 loop, pre-buildAndSave) — found ${abortChecks.length}`,
  );
});

// BEHAVIORAL — no React needed: a controllable async iterator that halts
// when an external AbortSignal fires. Mirrors the shape of chatStream.
test('aborting a chatStream-like async iterator halts accumulation', async () => {
  const ac = new AbortController();
  async function* fakeStream() {
    for (let i = 0; i < 10; i++) {
      if (ac.signal.aborted) return;
      await new Promise((r) => setTimeout(r, 5));
      yield String(i);
    }
  }
  let accumulated = '';
  const stream = fakeStream();
  const run = (async () => {
    for await (const t of stream) {
      if (ac.signal.aborted) break;
      accumulated += t;
    }
  })();
  setTimeout(() => ac.abort(), 12); // abort ~after 2nd token
  await run;
  assert.ok(accumulated.length < 10, `expected partial, got "${accumulated}"`);
  const saved = accumulated;
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(accumulated, saved, 'no growth after abort');
});
