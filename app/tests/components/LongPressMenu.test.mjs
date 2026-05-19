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

// ─── Phase 50 Plan 50-07 — LongPressMenu API extension ─────────────────────
//
// Two new OPTIONAL props add picker-opener Save behavior (D-04) + Remove-from-
// collection row (drill-in context). Graceful degradation: callers without the
// new props (HomeScreen today) still get the legacy 3-row direct-toggle menu.

test('LP-50-07: props interface declares optional onOpenCollectionPicker + collectionContext', () => {
  const src = readSrc('src/components/LongPressMenu.tsx');
  // Optional props (note the ? before the colon) — required props would force
  // every existing callsite to update + break the graceful-degradation contract.
  assert.match(
    src,
    /onOpenCollectionPicker\?\s*:\s*\(\s*postId:\s*string\s*\)\s*=>\s*void/,
    'Must declare onOpenCollectionPicker?: (postId: string) => void',
  );
  assert.match(
    src,
    /collectionContext\?\s*:\s*\{\s*collectionId:\s*string;\s*collectionName:\s*string\s*\}/,
    'Must declare collectionContext?: { collectionId: string; collectionName: string }',
  );
});

test('LP-50-07: handleSave picker branch calls onOpenCollectionPicker(postId) BEFORE onClose() (Pitfall 4)', () => {
  const src = readSrc('src/components/LongPressMenu.tsx');
  // Locate the handleSave function body.
  const m = src.match(/const handleSave[\s\S]*?\n\s*\};/);
  assert.ok(m, 'handleSave function body must exist');
  const body = m[0];
  // Must branch on onOpenCollectionPicker presence.
  assert.match(body, /onOpenCollectionPicker\b/, 'handleSave must branch on onOpenCollectionPicker');
  // Picker call must appear BEFORE onClose() in the function source (sheet-flash prevention).
  const pickerIdx = body.indexOf('onOpenCollectionPicker(postId)');
  const closeIdx = body.indexOf('onClose()');
  assert.ok(pickerIdx >= 0, 'handleSave must call onOpenCollectionPicker(postId)');
  assert.ok(closeIdx >= 0, 'handleSave must call onClose()');
  assert.ok(
    pickerIdx < closeIdx,
    'onOpenCollectionPicker(postId) must appear BEFORE onClose() (RESEARCH Pitfall 4 — React 19 batches the state updates in one render cycle)',
  );
});

test('LP-50-07: graceful degradation — direct-toggle Save path preserved when onOpenCollectionPicker absent', () => {
  const src = readSrc('src/components/LongPressMenu.tsx');
  // When no picker is wired, the existing Save toggle must still call the
  // engagement service directly (so HomeScreen's current consumer doesn't break
  // until plan 50-09 wires onOpenCollectionPicker). Phase 50 UAT G14 allows
  // passing a post snapshot as the second argument so unopened posts surface
  // in /saved and collection drill-in.
  assert.match(src, /engagementService\.savePost\(\s*postId\s*(?:,\s*[^)]*)?\)/, 'Must preserve direct savePost call (fallback path)');
  assert.match(src, /engagementService\.removeSavedPost\(postId\)/, 'Must preserve direct removeSavedPost call (fallback path)');
  // Toasts on the fallback path stay byte-stable.
  assert.match(src, /toast\(t\('engagement\.toast\.saved'\),\s*'success'\)/);
  assert.match(src, /toast\(t\('engagement\.toast\.unsaved'\),\s*'info'\)/);
});

test('LP-50-07: Remove-from-collection row renders only when collectionContext provided', () => {
  const src = readSrc('src/components/LongPressMenu.tsx');
  // Conditional JSX render — match the open-paren or open-brace of the
  // conditional. Allows both `{collectionContext && (` and `{collectionContext && <`.
  assert.match(
    src,
    /\{\s*collectionContext\s*&&\s*[\(<]/,
    'Must conditionally render the Remove row guarded by `{collectionContext && ...}`',
  );
  // FolderMinus icon is the chosen indicator (UI-SPEC §Surface 9).
  assert.match(src, /\bFolderMinus\b/, 'Remove row must use FolderMinus lucide-react icon');
  // i18n label is the canonical key (already in en/zh/es/ja per 50-02).
  assert.match(src, /library\.collections\.removeFromCollection/, 'Remove row must use library.collections.removeFromCollection i18n key');
});

test('LP-50-07: Remove row handler calls collectionService.removePost + toast with Undo action', () => {
  const src = readSrc('src/components/LongPressMenu.tsx');
  // Remove handler exists.
  assert.match(src, /handleRemoveFromCollection/, 'Must declare handleRemoveFromCollection');
  // Calls the service mutator with the right argument order (collectionId, postId).
  assert.match(
    src,
    /collectionService\.removePost\(\s*collectionContext\.collectionId\s*,\s*postId\s*\)/,
    'Must call collectionService.removePost(collectionContext.collectionId, postId)',
  );
  // Undo toast: 3-arg toast() with action option (label + onAction).
  assert.match(src, /library\.collections\.toast\.removed/, 'Must reference library.collections.toast.removed i18n key');
  assert.match(
    src,
    /toast\([\s\S]*?action\s*:\s*\{[\s\S]*?label\s*:[\s\S]*?onAction\s*:/,
    'Must pass { action: { label, onAction } } as 3rd toast arg',
  );
  // Undo restores the membership by calling addPost on the same collection+post.
  assert.match(
    src,
    /collectionService\.addPost\(\s*collectionContext\.collectionId\s*,\s*postId\s*\)/,
    'Undo onAction must call collectionService.addPost(collectionId, postId)',
  );
});

test('LP-50-07: anti-wire invariants preserved (no eventBus.emit, no explored-anchor, no markExplored)', () => {
  const src = readSrc('src/components/LongPressMenu.tsx');
  const conceptExplored = (src.match(/CONCEPT_EXPLORED/g) || []).length;
  const eventBusEmit = (src.match(/eventBus\.emit/g) || []).length;
  const markExplored = (src.match(/dailyReadService\.markExplored/g) || []).length;
  assert.strictEqual(conceptExplored, 0, 'Anti-wire: must not reference CONCEPT_EXPLORED');
  assert.strictEqual(eventBusEmit, 0, 'Anti-wire: must not call eventBus.emit directly — emits flow through collectionService / engagementService');
  assert.strictEqual(markExplored, 0, 'Anti-wire: must not call dailyReadService.markExplored');
});
