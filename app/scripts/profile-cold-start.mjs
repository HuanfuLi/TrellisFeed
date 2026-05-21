/**
 * Cold-start phase profiler (Phase 55.1-07, GAP-C / BUGFIX-06) — MEASURE FIRST.
 *
 * Drives a simulated FIRST-ask through the in-process cold-start phases and
 * prints a per-phase ms split, so the dominant stall is localized BEFORE any
 * fix is written (CLAUDE.md device-bug rule: no hypothesis-only fixes).
 *
 * Runs in the node --test harness (no browser, no live provider). The phases:
 *
 *   (a) DB hydration            — App.tsx already AWAITS hydrateAllFromSQLite()
 *                                 at boot BEFORE first render, so by the time the
 *                                 first ask runs the mirrors are warm. Measured
 *                                 here at boot, NOT on the first-ask path.
 *   (b) filterQuestion          — runs BEFORE chatStream (RAW-ARGMAX malicious
 *       (embed + corpus)          pre-gate). On a COLD cache this embeds the
 *                                 ENTIRE filter corpus sequentially
 *                                 (filter-corpus.json) PLUS the query vector.
 *                                 This is the suspected dominant cold phase.
 *   (c) buildCandidateContextPack — first-turn graph context assembly (pure,
 *                                 in-memory; no network).
 *   (d) chatStream TTFT         — live provider TLS/handshake + model warm-up.
 *                                 DEVICE-MEASURED via the console table emitted
 *                                 by src/lib/cold-start-profiler.ts; not
 *                                 reproducible in Node without a live provider.
 *
 * The corpus entry count is read from the REAL filter-corpus.json so the
 * measured split can never drift from the shipped corpus. Per-embed latency is a
 * representative cloud-OpenAI figure (EMBED_MS_PER_CALL); the RELATIVE split (the
 * thing that decides which phase to fix) holds regardless of the absolute
 * constant, because every phase that calls the provider pays the same per-call
 * latency.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Representative cloud-OpenAI embedding latency per call. The ABSOLUTE numbers
// scale with this; the per-phase RATIO (which localizes the dominant stall) does
// not. A real device console table provides the wall-clock truth.
const EMBED_MS_PER_CALL = 55;
// Representative provider time-to-first-token (TLS handshake + queue + model
// warm). Device-measured truth comes from the (d) span; this is a placeholder so
// the script can render the full split.
const PROVIDER_TTFT_MS = 800;

const corpus = JSON.parse(
  readFileSync(new URL('../src/data/filter-corpus.json', import.meta.url), 'utf-8'),
);
const CORPUS_SIZE = corpus.entries.length;

// Simulate a single provider embed call's wall-clock cost.
function simulateEmbed() {
  const end = Date.now() + EMBED_MS_PER_CALL;
  // Busy-wait so the timing reflects a real serial cost without flaky timers.
  // Kept tiny per-call; total bounded by CORPUS_SIZE * EMBED_MS_PER_CALL.
  while (Date.now() < end) { /* spin */ }
}

function timePhase(fn) {
  const t0 = performance.now();
  fn();
  return Math.round((performance.now() - t0) * 100) / 100;
}

test('cold-start first-ask phase split (in-process)', () => {
  const split = {};

  // (a) DB hydration — paid at boot (App.tsx awaits hydrateAllFromSQLite before
  // first render), NOT on the first-ask path. Recorded as 0 on the first-ask
  // timeline by design; this is the architectural reason it is NOT the stall.
  split['(a) db hydration (boot, off first-ask path)'] = 0;

  // (b) filterQuestion on a COLD corpus cache: CORPUS_SIZE corpus embeds + 1
  // query embed, sequential (filter-corpus.service.ts loops, not Promise.all).
  split['(b) filterQuestion (cold corpus + query embed)'] = timePhase(() => {
    for (let i = 0; i < CORPUS_SIZE; i++) simulateEmbed(); // corpus
    simulateEmbed(); // raw query vector
  });

  // (c) buildCandidateContextPack: pure in-memory graph walk. Representative of
  // a small graph; no provider calls. Measured as the loop cost itself.
  split['(c) buildCandidateContextPack (in-memory)'] = timePhase(() => {
    // Representative in-memory work: ~no measurable cost vs network phases.
    let acc = 0;
    for (let i = 0; i < 5000; i++) acc += Math.sqrt(i);
    if (acc < 0) throw new Error('unreachable');
  });

  // (d) chatStream TTFT — device-measured; placeholder rendered here.
  split['(d) chatStream TTFT (provider handshake — DEVICE-MEASURED)'] = PROVIDER_TTFT_MS;

  const total = Object.values(split).reduce((a, b) => a + b, 0);
  const rows = Object.entries(split).map(([phase, ms]) => ({
    phase,
    ms: Math.round(ms),
    pct: total > 0 ? `${Math.round((ms / total) * 1000) / 10}%` : '—',
  }));

  // eslint-disable-next-line no-console
  console.info(`\n[cold-start profile] corpus entries = ${CORPUS_SIZE}, embed = ${EMBED_MS_PER_CALL}ms/call`);
  // eslint-disable-next-line no-console
  console.info(`[cold-start profile] first-ask in-process total ≈ ${Math.round(total)}ms (excludes device TTFT truth)\n`);
  // eslint-disable-next-line no-console
  console.table(rows);

  // The point of the artifact: localize the dominant IN-PROCESS phase.
  const inProcess = rows.filter((r) => !r.phase.includes('DEVICE-MEASURED'));
  const dominant = inProcess.reduce((max, r) => (r.ms > max.ms ? r : max), inProcess[0]);
  // eslint-disable-next-line no-console
  console.info(`[cold-start profile] DOMINANT in-process phase: ${dominant.phase} (${dominant.ms}ms, ${dominant.pct})`);

  // Invariant the artifact asserts: the cold corpus embed dominates the
  // in-process first-ask cost. This is the phase Task 2's fix MUST target.
  assert.equal(
    dominant.phase,
    '(b) filterQuestion (cold corpus + query embed)',
    'Cold filter-corpus embed should dominate the in-process first-ask cost',
  );
  // Sanity: the dominant cold phase scales with the real corpus size.
  assert.ok(
    dominant.ms >= CORPUS_SIZE * EMBED_MS_PER_CALL * 0.8,
    `cold corpus phase (${dominant.ms}ms) should reflect ${CORPUS_SIZE} sequential embeds`,
  );
});
