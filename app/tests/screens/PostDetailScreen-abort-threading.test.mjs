// Phase 41 Plan 41-02 — PostDetailScreen abort-threading source-reading assertions.
//
// Covers SC-7(a) (all 3 async branches in essay useEffect have pre-call
// `if (abortController.signal.aborted) return` BEFORE the for-await opener),
// SC-7(b) (all 3 branches pass `{ signal: abortController.signal }` to the generator),
// SC-7(c) (generateConnectionPost + generateDiscoverPost in concept-feed.service.ts
// accept and thread `signal` through to chatStream).
//
// Strategy: source-reading per Phase 39/40/41 established pattern; no jsdom in test env
// (per VALIDATION.md). Counterweight verifies the AbortController + LOCALE_CHANGED
// subscribe cleanup pattern is preserved.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../../src/screens/PostDetailScreen.tsx', import.meta.url), 'utf8');
const FEED_SRC = readFileSync(new URL('../../src/services/concept-feed.service.ts', import.meta.url), 'utf8');

// Bound the essay useEffect block by the comment that opens it (the SECOND
// occurrence of "On-enter essay generation" in the file — the FIRST is the
// state-block comment near the top of the component) and the next useEffect
// (the cached-images effect for the carousel — distinguished by its preceding
// "Fetch cached images" comment marker).
function essayUseEffectBlock() {
  const firstMarker = SRC.indexOf('On-enter essay generation');
  assert.ok(firstMarker >= 0, 'essay marker "On-enter essay generation" must exist');
  // Skip the state-block comment ("On-enter essay generation state") and find
  // the useEffect-opening comment ("On-enter essay generation: stream bodyMarkdown").
  const start = SRC.indexOf('On-enter essay generation', firstMarker + 1);
  assert.ok(start > firstMarker, 'second "On-enter essay generation" marker (useEffect-opening comment) must exist');
  // Bound by the carousel useEffect that follows the essay useEffect.
  const end = SRC.indexOf('Fetch cached images', start);
  return SRC.slice(start, end > start ? end : start + 6000);
}

// ─── SC-7(a) ────────────────────────────────────────────────────────────────

test('SC-7(a): all 3 essay branches have pre-call `if (abortController.signal.aborted) return` BEFORE the for-await opener', () => {
  const block = essayUseEffectBlock();
  // Pre-call guards are characterized by: `if (abortController.signal.aborted) return;`
  // (optionally followed by an inline comment) on a line of its own immediately
  // preceding a `for await` opener. Permit any non-newline characters between the
  // `return;` and the line break so trailing `// Phase 41 SC-7 — pre-call guard`
  // comments don't break the match.
  const preGuardPattern = /if \(abortController\.signal\.aborted\) return;[^\n]*\n\s*for await/g;
  const matches = [...block.matchAll(preGuardPattern)];
  assert.ok(
    matches.length >= 3,
    `expected ≥3 pre-call abort guards immediately preceding for-await openers, got ${matches.length}`,
  );
});

// ─── SC-7(b) ────────────────────────────────────────────────────────────────

test('SC-7(b): generateConnectionPost call passes { signal: abortController.signal }', () => {
  const block = essayUseEffectBlock();
  assert.match(block, /generateConnectionPost\([\s\S]*?\{ signal: abortController\.signal \}/);
});

test('SC-7(b): generateDiscoverPost call passes { signal: abortController.signal }', () => {
  const block = essayUseEffectBlock();
  assert.match(block, /generateDiscoverPost\([\s\S]*?\{ signal: abortController\.signal \}/);
});

test('SC-7(b): generatePostEssay call still passes { signal: abortController.signal }', () => {
  const block = essayUseEffectBlock();
  assert.match(block, /generatePostEssay\([\s\S]*?\{ signal: abortController\.signal \}/);
});

// ─── SC-7(c) — generators accept and thread signal in concept-feed.service.ts ──

test('SC-7(c): generateConnectionPost signature has options?: { signal?: AbortSignal }', () => {
  // The signature spans multiple lines; assert the options bag appears before the
  // `): AsyncGenerator<string>` close.
  assert.match(
    FEED_SRC,
    /async \*generateConnectionPost\(\s*questionA[\s\S]*?options\?\: \{ signal\?: AbortSignal \}[\s\S]*?\): AsyncGenerator<string>/,
  );
});

test('SC-7(c): generateDiscoverPost signature has options?: { signal?: AbortSignal }', () => {
  assert.match(
    FEED_SRC,
    /async \*generateDiscoverPost\(\s*concept[\s\S]*?options\?\: \{ signal\?: AbortSignal \}[\s\S]*?\): AsyncGenerator<string>/,
  );
});

test('SC-7(c): generateConnectionPost body threads signal: options?.signal into chatStream', () => {
  const connStart = FEED_SRC.indexOf('async *generateConnectionPost');
  assert.ok(connStart >= 0, 'generateConnectionPost must exist');
  // Bound by the next named member after the generator (saveConnectionPost).
  const connEnd = FEED_SRC.indexOf('saveConnectionPost', connStart);
  assert.ok(connEnd > connStart, 'saveConnectionPost boundary must exist after generateConnectionPost');
  const connBlock = FEED_SRC.slice(connStart, connEnd);
  assert.match(connBlock, /signal: options\?\.signal/);
});

test('SC-7(c): generateDiscoverPost body threads signal: options?.signal into chatStream', () => {
  const discStart = FEED_SRC.indexOf('async *generateDiscoverPost');
  assert.ok(discStart >= 0, 'generateDiscoverPost must exist');
  const discEnd = FEED_SRC.indexOf('saveDiscoverPost', discStart);
  assert.ok(discEnd > discStart, 'saveDiscoverPost boundary must exist after generateDiscoverPost');
  const discBlock = FEED_SRC.slice(discStart, discEnd);
  assert.match(discBlock, /signal: options\?\.signal/);
});

// ─── Counterweight: LOCALE_CHANGED + AbortController cleanup pattern preserved ──

test('counterweight: existing AbortController + LOCALE_CHANGED subscribe + abort cleanup preserved', () => {
  assert.match(SRC, /eventBus\.subscribe\('LOCALE_CHANGED'/);
  assert.match(
    SRC,
    /abortController\.abort\(new DOMException\('Locale changed', 'AbortError'\)\)/,
  );
  // Cleanup return — abortController.abort() must be present in the useEffect cleanup.
  assert.match(SRC, /return \(\) => \{[\s\S]*?abortController\.abort\(\);[\s\S]*?\};/);
});

test('counterweight: D-15 scope comment block updated to mention Phase 41 SC-7', () => {
  // The original D-15 comment said only generatePostEssay branch threaded signal;
  // Phase 41 SC-7 expands to all 3 branches. Ensure the comment was updated.
  const block = essayUseEffectBlock();
  assert.match(block, /Phase 41 SC-7/);
});
