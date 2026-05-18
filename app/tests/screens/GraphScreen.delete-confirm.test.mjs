/**
 * GraphScreen.delete-confirm.test.mjs — Phase 49-03
 *
 * 7 tests (numbered 7–13 to match the plan inventory) on GraphScreen's merge +
 * delete confirm wiring + reorganize modal migration + W-1 (no pickMode in this
 * plan). Source-reading approach.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../src/screens/GraphScreen.tsx');

// Test 7 — merge derivation BEFORE modal opens (B-2: no `.data ?? []`).
test('Test 7 — merge confirm pre-derives loserQaCount + survivorQaCount via questionService.getAll({ includeFlagged: true })', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // Find the mergeConfirm block boundaries (between `{mergeConfirm` and the next
  // closing `})()}` IIFE) so we can scope assertions to that block.
  const mergeIdx = src.indexOf('{mergeConfirm &&');
  assert.ok(mergeIdx > -1, 'must contain a `{mergeConfirm && ...` IIFE render block');
  // Scan ~3000 chars from the merge block start to capture the entire IIFE.
  const mergeBlock = src.slice(mergeIdx, mergeIdx + 3500);
  // Required derivation in the same IIFE body:
  assert.match(
    mergeBlock,
    /questionService\.getAll\(\s*\{\s*includeFlagged:\s*true\s*\}\s*\)/,
    'merge IIFE must call questionService.getAll({ includeFlagged: true })',
  );
  assert.match(
    mergeBlock,
    /loserQaCount\s*=\s*[\s\S]+?\.filter\([\s\S]+?parentId\s*===\s*mergeConfirm\.loser\.id[\s\S]+?\.length/,
    'merge IIFE must derive loserQaCount via .filter(q => q.parentId === mergeConfirm.loser.id).length',
  );
  assert.match(
    mergeBlock,
    /survivorQaCount\s*=\s*[\s\S]+?\.filter\([\s\S]+?parentId\s*===\s*mergeConfirm\.survivor\.id[\s\S]+?\.length/,
    'merge IIFE must derive survivorQaCount via .filter(q => q.parentId === mergeConfirm.survivor.id).length',
  );
  // B-2 — no `.data ?? []` anywhere in the GraphScreen.
  assert.equal(
    /\.data\s*\?\?\s*\[\s*\]/.test(src),
    false,
    'GraphScreen must NOT use `.data ?? []` (B-2 — questionService.getAll returns Question[] directly)',
  );
});

// Test 8 — merge ConfirmDialog renders MergeConfirmPreview as children.
//          onConfirm awaits graphCommandService.merge(loser.id, survivor.id).
//          On success → toast w/ result.data.reparentedCount + close modal.
//          On failure → toast error + keep modal open.
test('Test 8 — merge ConfirmDialog mounts MergeConfirmPreview; onConfirm awaits merge + uses reparentedCount', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // <ConfirmDialog ... <MergeConfirmPreview ... /> ...</ConfirmDialog> must appear.
  assert.match(src, /<ConfirmDialog\b/, 'must mount <ConfirmDialog>');
  assert.match(src, /<MergeConfirmPreview\b/, 'must mount <MergeConfirmPreview> as children');
  // The merge onConfirm must call graphCommandService.merge with (loser.id, survivor.id).
  assert.match(
    src,
    /graphCommandService\.merge\(\s*mergeConfirm\.loser\.id\s*,\s*mergeConfirm\.survivor\.id\s*\)/,
    'merge onConfirm must call graphCommandService.merge(mergeConfirm.loser.id, mergeConfirm.survivor.id) per D-08',
  );
  // The success branch must use result.data.reparentedCount in the toast interpolation.
  // Accept either `result.data.reparentedCount` (assertion-style access) OR
  // `result.data?.reparentedCount` (optional-chain — required because ServiceResult
  // is not a discriminated union in this codebase; see 49-01 deviation #3).
  assert.match(
    src,
    /reparentedCount:\s*result\.data\??\.\s*reparentedCount/,
    'success toast must interpolate result.data.reparentedCount or result.data?.reparentedCount (B-3 service-reported value)',
  );
  // Success branch must reference the merged toast key.
  assert.match(
    src,
    /graph\.correction\.toast\.merged/,
    'success toast must use the graph.correction.toast.merged key',
  );
  // Failure branch must NOT call setMergeConfirm(null) — modal must stay open per the plan.
  // Heuristic: inside the merge onConfirm body, the else (failure) branch must NOT contain
  // setMergeConfirm(null) on the same code path as the toast(error).
  // We assert by finding the merge IIFE body and confirming exactly one setMergeConfirm(null)
  // appears AFTER the success toast and BEFORE the else branch.
  const mergeIdx = src.indexOf('{mergeConfirm &&');
  const mergeBlock = src.slice(mergeIdx, mergeIdx + 4000);
  const successSetIdx = mergeBlock.indexOf("setMergeConfirm(null)");
  const elseIdx = mergeBlock.indexOf('} else {');
  assert.ok(successSetIdx > -1, 'merge IIFE must call setMergeConfirm(null) on success');
  assert.ok(elseIdx > -1, 'merge IIFE must have an else branch for the failure path');
  assert.ok(
    successSetIdx < elseIdx,
    'setMergeConfirm(null) must occur on the success branch (before the else), not in the failure branch',
  );
  // Confirm there is NO setMergeConfirm(null) between the else and the closing of the else block.
  const afterElse = mergeBlock.slice(elseIdx, mergeBlock.length);
  // Stop scanning at the next onCancel handler (which legitimately uses setMergeConfirm).
  const onCancelIdx = afterElse.indexOf('onCancel');
  const failureBody = afterElse.slice(0, onCancelIdx > -1 ? onCancelIdx : afterElse.length);
  assert.equal(
    /setMergeConfirm\(null\)/.test(failureBody),
    false,
    'failure branch must KEEP the modal open (no setMergeConfirm(null) in the else body)',
  );
});

// Test 9 — delete derivation BEFORE modal opens (B-2: no `.data ?? []`).
test('Test 9 — delete confirm pre-derives qaChildCount via questionService.getAll({ includeFlagged: true })', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  const deleteIdx = src.indexOf('{deleteConfirm &&');
  assert.ok(deleteIdx > -1, 'must contain a `{deleteConfirm && ...` IIFE render block');
  const deleteBlock = src.slice(deleteIdx, deleteIdx + 3500);
  assert.match(
    deleteBlock,
    /questionService\.getAll\(\s*\{\s*includeFlagged:\s*true\s*\}\s*\)/,
    'delete IIFE must call questionService.getAll({ includeFlagged: true })',
  );
  assert.match(
    deleteBlock,
    /qaChildCount\s*=\s*[\s\S]+?\.filter\([\s\S]+?parentId\s*===\s*deleteConfirm\.node\.id[\s\S]+?\.length/,
    'delete IIFE must derive qaChildCount via .filter(q => q.parentId === deleteConfirm.node.id).length',
  );
});

// Test 10 — delete flow: handleCorrectionAction('delete') opens setDeleteConfirm.
//           ConfirmDialog has destructive:true + title interpolates node.title.
//           Body interpolates qaChildCount + parentCluster (or uses bodyEmpty when 0).
//           onConfirm calls graphCommandService.delete(node.id) — no boolean param.
test('Test 10 — delete dispatch + destructive ConfirmDialog + delete service call (no boolean param)', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // handleCorrectionAction's delete branch must setDeleteConfirm({ node }).
  assert.match(
    src,
    /case\s+['"]delete['"]:[\s\S]*?setDeleteConfirm\(\s*\{\s*node\s*\}\s*\)/,
    'handleCorrectionAction case "delete" must call setDeleteConfirm({ node })',
  );
  // ConfirmDialog must use destructive={true}.
  assert.match(src, /destructive=\{true\}/, 'delete ConfirmDialog must pass destructive={true}');
  // Title must interpolate the node title (template key + node.title fallback).
  assert.match(
    src,
    /graph\.correction\.delete\.title/,
    'delete dialog must use the graph.correction.delete.title key',
  );
  assert.match(
    src,
    /title:\s*deleteConfirm\.node\.title/,
    'delete title interpolation must pass title: deleteConfirm.node.title',
  );
  // Body must reference both bodyWithChildren AND bodyEmpty variants.
  assert.match(src, /graph\.correction\.delete\.bodyWithChildren/, 'must use bodyWithChildren key');
  assert.match(src, /graph\.correction\.delete\.bodyEmpty/, 'must use bodyEmpty key (count === 0 case)');
  // Service call MUST be a single-arg invocation — no boolean param per B-3.
  // Match `graphCommandService.delete(deleteConfirm.node.id)` exactly — one arg.
  assert.match(
    src,
    /graphCommandService\.delete\(\s*deleteConfirm\.node\.id\s*\)/,
    'delete onConfirm must call graphCommandService.delete(deleteConfirm.node.id) with NO boolean param (B-3)',
  );
  // Success toast uses graph.correction.toast.deleted key.
  assert.match(src, /graph\.correction\.toast\.deleted/, 'success toast must use the deleted key');
});

// Test 11 — reorganize migration: inline modal block at GraphScreen.tsx:518-535 is REMOVED;
//           replaced with <ConfirmDialog open={showReorgConfirm} ...>.
test('Test 11 — inline reorganize modal removed; replaced with <ConfirmDialog open={showReorgConfirm}', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // The inline modal had this shape — assert it's GONE.
  // Specifically: an inline block guarded by `{showReorgConfirm && (` followed
  // immediately by a <div> with the zIndex:300 backdrop and an inline `<p>`
  // for the modal title. The migration replaces this with <ConfirmDialog ... />.
  assert.equal(
    /\{showReorgConfirm\s*&&\s*\(\s*<div/.test(src),
    false,
    'inline reorganize modal `{showReorgConfirm && (<div ...>)}` must be removed',
  );
  // Must have <ConfirmDialog open={showReorgConfirm} ...> instead.
  assert.match(
    src,
    /<ConfirmDialog[\s\S]{0,400}open=\{showReorgConfirm\}/,
    'must mount <ConfirmDialog open={showReorgConfirm} ...> in place of the inline modal',
  );
  // The same dialog must wire the existing handleReorganize handler.
  assert.match(
    src,
    /onConfirm=\{handleReorganize\}/,
    'reorganize ConfirmDialog must wire onConfirm={handleReorganize}',
  );
});

// Test 12 — Phase 48 contract: merge + delete route via graphCommandService.
//           No direct questionService.patchQuestion for graph edits.
test('Test 12 — merge + delete write paths route through graphCommandService (no patchQuestion for graph edits)', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // Must reference both service methods exactly.
  assert.match(src, /graphCommandService\.merge\(/, 'must call graphCommandService.merge for merges');
  assert.match(src, /graphCommandService\.delete\(/, 'must call graphCommandService.delete for deletes');
  // Must NOT call questionService.patchQuestion at all in this file. (GraphScreen
  // doesn't currently use patchQuestion; this test guards against regression.)
  assert.equal(
    /questionService\.patchQuestion\(/.test(src),
    false,
    'GraphScreen must NOT call questionService.patchQuestion directly — graph edits go through graphCommandService (Phase 48 contract)',
  );
});

// Test 13 — W-1: NO pickMode state declared in this plan's GraphScreen changes.
//           Plan 49-04 owns pickMode entirely.
test('Test 13 — no pickMode state in GraphScreen (W-1: Plan 49-04 owns pickMode)', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.equal(
    /\bpickMode\b/.test(src),
    false,
    'GraphScreen must NOT reference pickMode in this plan — Plan 49-04 introduces it',
  );
  assert.equal(
    /setPickMode\b/.test(src),
    false,
    'GraphScreen must NOT reference setPickMode in this plan — Plan 49-04 introduces it',
  );
});
