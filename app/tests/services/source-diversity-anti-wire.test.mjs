// Phase 40 — source-diversity.service.ts source-reading invariant test (SC-4).
//
// Single-file scan that asserts the sync-only contract:
//   - No async-function declarations anywhere in the leaf (proves no
//     suspending expression can exist — every suspending expression
//     requires a deferred-execution function wrapper). RESEARCH § 8
//     Pitfall 4 explicitly recommends this regex over substring scanning
//     for the suspending keyword, which false-positives on JSDoc comments
//     mentioning the word.
//   - No fetch( call (would bypass sync contract via direct network call).
//   - No chatStream( and no chatCompletion( (would bypass sync contract
//     via LLM round-trip).
//
// Counterweight assertion: confirms the scan reaches the live file by
// asserting `filterForDiversity` IS present in the source. Without this,
// a future refactor that renames or deletes the leaf would leave the test
// silently passing on an empty/non-existent source.
//
// No character-window proximity scanning — window-fragility-free by design
// (RESEARCH § 11 Risk 1 lesson from image-gen-key-gate.test.mjs's 6000-char
// window which forced source-code trimming in concept-feed.service.ts).

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = resolve(here, '../../src/services/source-diversity.service.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

test('source-diversity.service.ts contains filterForDiversity (counterweight — proves scan reaches the target file)', () => {
  assert.ok(
    source.includes('filterForDiversity'),
    'source-diversity.service.ts must export filterForDiversity — without this counterweight, a future delete/rename would silently pass the anti-wire test on an empty file',
  );
});

test('source-diversity.service.ts must have no deferred-execution function declarations (proves no suspending expression can exist — sync-only invariant)', () => {
  // Regex matches the suspending-function keyword followed by whitespace
  // (covers `keyword function`, `keyword (`, `keyword method` patterns).
  // RESEARCH § 8 Pitfall 4: scanning for the keyword is preferred over
  // scanning for the suspending expression keyword (which false-positives
  // on JSDoc comments mentioning the word).
  assert.ok(
    !/\basync\s/.test(source),
    'source-diversity.service.ts must have no async functions — Phase 40 sync-only invariant. RESEARCH § 8 Pitfall 4: scanning for the async keyword is preferred over scanning for await (which false-positives on JSDoc comments).',
  );
});

test('source-diversity.service.ts must not call fetch() (sync-only invariant)', () => {
  assert.ok(
    !source.includes('fetch('),
    'source-diversity.service.ts must not call fetch() — Phase 40 leaf is pure-logic, no I/O. Phase 41 owns the Tavily call site (concept-feed.service.ts), not this leaf.',
  );
});

test('source-diversity.service.ts must not call chatStream() or chatCompletion() (sync-only invariant)', () => {
  assert.ok(
    !source.includes('chatStream('),
    'source-diversity.service.ts must not call chatStream() — leaf is pure-logic, no LLM calls.',
  );
  assert.ok(
    !source.includes('chatCompletion('),
    'source-diversity.service.ts must not call chatCompletion() — leaf is pure-logic, no LLM calls.',
  );
});
