// Phase 43 Plan 43-05 — DD-01..DD-03 source-reading invariants for the
// PostDetailScreen Deep-dive trigger.
//
// What this guards (locked at PostDetailScreen.tsx by 43-05 Task 1):
//   - DD-01: deep-dive controls slot rendered between the scroll-70% sentinel
//            (PostDetailScreen.tsx:scrollSentinelRef) and the takeaway block.
//   - DD-02: DeepDiveButton uses Sparkles + var(--primary-40) + i18n key
//            posts.detail.deepDive.cta.
//   - DD-03: streaming state slot accumulates into streamingDeep without
//            overwriting post.bodyMarkdown; Restore Standard handler aborts the
//            dedicated deep controller AND flips activeVariant back to 'standard'.
//
// DD-04 segmented-toggle assertions live in the sibling segmented-toggle.test.mjs
// per VALIDATION.md line 53. DD-05 abort-contract assertions live in
// abort-contract.test.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const src = readFileSync(path.join(appRoot, 'src/screens/PostDetailScreen.tsx'), 'utf8');

test('DD-01: deep-dive controls slot rendered between scroll sentinel and takeaway', () => {
  const sentinelIdx = src.indexOf('scrollSentinelRef');
  const renderIdx = src.indexOf('renderDeepDiveControls');
  const takeawayIdx = src.indexOf('takeawayHeading');
  assert.ok(sentinelIdx > 0, 'scrollSentinelRef must exist in source');
  assert.ok(renderIdx > 0, 'renderDeepDiveControls must be declared');
  assert.ok(takeawayIdx > 0, 'takeawayHeading i18n key must be referenced');
  // The renderDeepDiveControls INVOCATION must appear after the sentinel JSX and
  // before the takeaway block. Find the *invocation* (last occurrence) — the
  // function declaration comes earlier in the file.
  const invocationIdx = src.lastIndexOf('renderDeepDiveControls()');
  assert.ok(invocationIdx > 0, 'renderDeepDiveControls() must be invoked in the render tree');
  // Locate the scroll-sentinel JSX line (different from the ref declaration above).
  const sentinelJsxIdx = src.indexOf('ref={scrollSentinelRef}');
  assert.ok(sentinelJsxIdx > 0, 'scrollSentinelRef must be attached to a JSX element');
  assert.ok(sentinelJsxIdx < invocationIdx, 'renderDeepDiveControls() must render AFTER the scroll-sentinel JSX');
  assert.ok(invocationIdx < takeawayIdx, 'renderDeepDiveControls() must render BEFORE the takeaway block');
});

test('DD-02: DeepDiveButton uses posts.detail.deepDive.cta + Sparkles icon + primary-40 text', () => {
  assert.match(src, /t\(['"]posts\.detail\.deepDive\.cta['"]\)/);
  assert.match(src, /\bSparkles\b/);
  assert.match(src, /var\(--primary-40\)/);
});

test('DD-03: streaming-deep state + Restore Standard handler + body slot streams streamingDeep', () => {
  assert.match(src, /streamingDeep/);
  assert.match(src, /isStreamingDeep/);
  assert.match(src, /handleRestoreStandard/);
  assert.match(src, /t\(['"]posts\.detail\.deepDive\.restoreStandard['"]\)/);
  // Body slot conditional includes deep variant render path.
  assert.match(src, /activeVariant\s*===\s*['"]deep['"]/);
  assert.match(src, /post\.bodyMarkdownDeep/);
});

test('DD-03: handleRestoreStandard aborts the deep controller and resets activeVariant to standard', () => {
  // Locate the handler body — bounded by the next handler declaration.
  const handlerStart = src.indexOf('handleRestoreStandard = useCallback');
  assert.ok(handlerStart > 0, 'handleRestoreStandard must be declared via useCallback');
  // Slice a generous window forward; the handler body is short (4 statements).
  const region = src.slice(handlerStart, handlerStart + 800);
  assert.match(region, /deepAbortControllerRef\.current\?\.abort\(\)/, 'must call deepAbortControllerRef.current?.abort()');
  assert.match(region, /setActiveVariant\(['"]standard['"]\)/, 'must reset activeVariant to standard');
  assert.match(region, /setStreamingDeep\(['"]['"]\)/, 'must clear streamingDeep accumulator');
});

test('DD-03: standard post.bodyMarkdown is NEVER overwritten by the deep stream (separate state slot)', () => {
  // handleStartDeepDive accumulates into setStreamingDeep, and on success patches
  // bodyMarkdownDeep via setPost spread. It must NOT directly assign bodyMarkdown.
  const handlerStart = src.indexOf('handleStartDeepDive = useCallback');
  const handlerEnd = src.indexOf('handleRestoreStandard = useCallback');
  assert.ok(handlerStart > 0 && handlerEnd > handlerStart, 'both handlers must be declared');
  const region = src.slice(handlerStart, handlerEnd);
  assert.match(region, /bodyMarkdownDeep/, 'deep handler must patch bodyMarkdownDeep');
  // No literal `bodyMarkdown:` (without Deep suffix) assignment inside the deep handler scope.
  assert.doesNotMatch(region, /bodyMarkdown:\s*[^D]/, 'deep handler must not assign bodyMarkdown directly');
});
