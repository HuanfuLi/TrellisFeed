// Phase 43 Plan 43-03 — source-reading invariants for LongPressMenu.
//
// Behavioral coverage uses source-reading (readFileSync + grep / regex) instead
// of a rendered-DOM test harness because the existing test infrastructure in
// app/tests/ avoids loading the i18n + framer-motion + React DOM chain under
// node --test. This mirrors the canonical pattern at
// app/tests/components/InfoFlow.video-tap-emit.test.mjs.
//
// Reference: app/src/components/ChatMessage.tsx:119-140 (long-press pattern source),
// app/src/services/engagement.service.ts (Phase 39 consumer surface),
// .planning/phases/43-engagement-ui/43-VALIDATION.md.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');

function readSrc(rel) {
  return readFileSync(path.join(appRoot, rel), 'utf8');
}

test('LP-01: LongPressMenu renders BottomSheet with compact prop', () => {
  const src = readSrc('src/components/LongPressMenu.tsx');
  assert.match(src, /<BottomSheet[\s\S]*?compact/, 'LongPressMenu must render <BottomSheet compact>');
});

test('LP-02: 3 rows with Heart, Bookmark, EyeOff icons + 3 row handlers', () => {
  const src = readSrc('src/components/LongPressMenu.tsx');
  assert.match(src, /\bHeart\b/, 'Must import/render Heart icon');
  assert.match(src, /\bBookmark\b/, 'Must import/render Bookmark icon');
  assert.match(src, /\bEyeOff\b/, 'Must import/render EyeOff icon');
  assert.match(src, /handleLike/, 'Must have handleLike row handler');
  assert.match(src, /handleSave/, 'Must have handleSave row handler');
  assert.match(src, /handleDismiss/, 'Must have handleDismiss row handler');
});

test('LP-04: Save/Like row labels flip via engagementService.isSaved / isLiked', () => {
  const src = readSrc('src/components/LongPressMenu.tsx');
  assert.match(src, /engagementService\.isSaved\(postId\)/, 'Must read isSaved(postId) at render');
  assert.match(src, /engagementService\.isLiked\(postId\)/, 'Must read isLiked(postId) at render');
  assert.match(src, /engagement\.menu\.unsave/, 'Must reference engagement.menu.unsave i18n key for active state');
  assert.match(src, /engagement\.menu\.unlike/, 'Must reference engagement.menu.unlike i18n key for active state');
  assert.match(src, /engagement\.menu\.save/, 'Must reference engagement.menu.save i18n key for inactive state');
  assert.match(src, /engagement\.menu\.like/, 'Must reference engagement.menu.like i18n key for inactive state');
  assert.match(src, /engagement\.menu\.dismiss/, 'Must reference engagement.menu.dismiss i18n key');
});

test('LP: row tap calls engagementService method + emits toast + closes sheet', () => {
  const src = readSrc('src/components/LongPressMenu.tsx');
  assert.match(src, /engagementService\.savePost\(\s*postId\s*(?:,\s*[^)]*)?\)/);
  assert.match(src, /engagementService\.removeSavedPost\(postId\)/);
  assert.match(src, /engagementService\.likePost\(\s*postId\s*(?:,\s*[^)]*)?\)/);
  assert.match(src, /engagementService\.unlikePost\(postId\)/);
  assert.match(src, /engagementService\.dismissAnchor\(anchorId\)/);
  assert.match(src, /toast\(t\('engagement\.toast\.saved'\)/);
  assert.match(src, /toast\(t\('engagement\.toast\.dismissed'\)/);
  // onClose called from each of 3 row handlers (handleSave / handleLike / handleDismiss).
  const onCloseCalls = (src.match(/onClose\(\)/g) || []).length;
  assert.ok(onCloseCalls >= 3, `Expected onClose() called from each of 3 row handlers; found ${onCloseCalls}`);
});

test('LP-03: toast variant mapping — save/like = success; unsave/unlike/dismiss = info', () => {
  const src = readSrc('src/components/LongPressMenu.tsx');
  assert.match(src, /toast\(t\('engagement\.toast\.saved'\),\s*'success'\)/);
  assert.match(src, /toast\(t\('engagement\.toast\.liked'\),\s*'success'\)/);
  assert.match(src, /toast\(t\('engagement\.toast\.unsaved'\),\s*'info'\)/);
  assert.match(src, /toast\(t\('engagement\.toast\.unliked'\),\s*'info'\)/);
  assert.match(src, /toast\(t\('engagement\.toast\.dismissed'\),\s*'info'\)/);
});

test('Anti-wire: LongPressMenu MUST NOT emit explored-anchor or call eventBus directly', () => {
  const src = readSrc('src/components/LongPressMenu.tsx');
  const conceptExplored = (src.match(/CONCEPT_EXPLORED/g) || []).length;
  const eventBusEmit = (src.match(/eventBus\.emit/g) || []).length;
  const markExplored = (src.match(/dailyReadService\.markExplored/g) || []).length;
  assert.strictEqual(conceptExplored, 0, 'Anti-wire: LongPressMenu must not reference CONCEPT_EXPLORED (engagementService owns all emits)');
  assert.strictEqual(eventBusEmit, 0, 'Anti-wire: LongPressMenu must not call eventBus.emit directly');
  assert.strictEqual(markExplored, 0, 'Anti-wire: LongPressMenu must not call dailyReadService.markExplored');
});

test('LP: row minHeight 56px (≥44px WCAG floor; UI-SPEC §1)', () => {
  const src = readSrc('src/components/LongPressMenu.tsx');
  assert.match(src, /minHeight:\s*['"]56px['"]/);
});

test('LP: direct-toggle Save path preserved', () => {
  const src = readSrc('src/components/LongPressMenu.tsx');
  assert.match(src, /engagementService\.savePost\(\s*postId\s*(?:,\s*[^)]*)?\)/, 'Must preserve direct savePost call (fallback path)');
  assert.match(src, /engagementService\.removeSavedPost\(postId\)/, 'Must preserve direct removeSavedPost call (fallback path)');
  // Toasts on the fallback path stay byte-stable.
  assert.match(src, /toast\(t\('engagement\.toast\.saved'\),\s*'success'\)/);
  assert.match(src, /toast\(t\('engagement\.toast\.unsaved'\),\s*'info'\)/);
});

test('LP-50-07: anti-wire invariants preserved (no eventBus.emit, no explored-anchor, no markExplored)', () => {
  const src = readSrc('src/components/LongPressMenu.tsx');
  const conceptExplored = (src.match(/CONCEPT_EXPLORED/g) || []).length;
  const eventBusEmit = (src.match(/eventBus\.emit/g) || []).length;
  const markExplored = (src.match(/dailyReadService\.markExplored/g) || []).length;
  assert.strictEqual(conceptExplored, 0, 'Anti-wire: must not reference CONCEPT_EXPLORED');
  assert.strictEqual(eventBusEmit, 0, 'Anti-wire: must not call eventBus.emit directly — emits flow through engagementService');
  assert.strictEqual(markExplored, 0, 'Anti-wire: must not call dailyReadService.markExplored');
});
