// Phase 50 Plan 50-01 — Collection type + COLLECTIONS_CHANGED AppEvent union member.
//
// Behavior asserted (per 50-01-PLAN.md <behavior> block):
//   - Importing `Collection` from `app/src/types` yields the documented shape.
//   - `eventBus.emit({ type: 'COLLECTIONS_CHANGED', ... })` round-trips correctly
//     for every `kind` literal in the discriminated payload union.
//   - The shape mirrors ENGAGEMENT_CHANGED / GRAPH_UPDATED precedent (CLAUDE.md
//     §"Event bus — unified GRAPH_UPDATED": one signal per semantic event).
//
// Type-level invariants (compile-time, enforced by `tsc -b --noEmit`):
//   - `eventBus.emit({ type: 'COLLECTIONS_CHANGED', payload: { kind: 'bogus', ... } })`
//     is rejected by tsc (covered by source-grep + tsc gate in <verify>).
//   - `eventBus.subscribe('COLLECTIONS_CHANGED', e => e.payload.kind)` narrows.

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const TYPES_PATH = path.resolve(import.meta.dirname, '../src/types/index.ts');

test('Collection interface is exported from app/src/types with the D-03 shape', () => {
  const source = fs.readFileSync(TYPES_PATH, 'utf-8');
  // D-03: { id: string; name: string; postIds: string[]; createdAt: number; updatedAt: number }
  assert.match(source, /export interface Collection\s*\{/, 'Collection interface must be exported');
  // Each field must appear inside (or near) the interface; substring grep is sufficient
  // because tsc -b would catch shape drift downstream.
  const matchBlock = source.match(/export interface Collection\s*\{([\s\S]*?)\}/);
  assert.ok(matchBlock, 'Collection interface block must be parseable');
  const body = matchBlock[1];
  assert.match(body, /id\s*:\s*string/, 'Collection.id must be string');
  assert.match(body, /name\s*:\s*string/, 'Collection.name must be string');
  assert.match(body, /postIds\s*:\s*string\[\]/, 'Collection.postIds must be string[]');
  assert.match(body, /createdAt\s*:\s*number/, 'Collection.createdAt must be number');
  assert.match(body, /updatedAt\s*:\s*number/, 'Collection.updatedAt must be number');
});

test('AppEvent union includes COLLECTIONS_CHANGED with discriminated kind payload', () => {
  const source = fs.readFileSync(TYPES_PATH, 'utf-8');
  // Plan-level grep gate: literal `type: 'COLLECTIONS_CHANGED'` must appear at least once
  // (used by 50-01-PLAN.md <verify> automated step).
  assert.match(source, /type:\s*'COLLECTIONS_CHANGED'/, 'AppEvent union must declare COLLECTIONS_CHANGED');
  // All 5 kind literals from D-03 + Claude's Discretion must appear in the payload union.
  const kinds = ['create', 'rename', 'delete', 'add-post', 'remove-post'];
  for (const k of kinds) {
    // Each kind literal must appear as a quoted string somewhere after COLLECTIONS_CHANGED
    // and before the next `| {` union seam — simple substring assertion is sufficient
    // because tsc would catch any actual narrowing mistake.
    assert.ok(
      source.includes(`'${k}'`),
      `COLLECTIONS_CHANGED kind union must include '${k}'`
    );
  }
  // collectionId field is required per Claude's Discretion in 50-CONTEXT.md.
  assert.match(
    source,
    /COLLECTIONS_CHANGED[\s\S]{0,400}collectionId\s*:\s*string/,
    'COLLECTIONS_CHANGED payload must carry collectionId: string'
  );
});

test('eventBus emits + subscribes COLLECTIONS_CHANGED for every kind literal', async () => {
  const { eventBus } = await import('../src/lib/event-bus.ts');
  const kinds = ['create', 'rename', 'delete', 'add-post', 'remove-post'];
  for (const kind of kinds) {
    let received = null;
    const unsub = eventBus.subscribe('COLLECTIONS_CHANGED', (e) => { received = e; });
    eventBus.emit({
      type: 'COLLECTIONS_CHANGED',
      payload: { kind, collectionId: `c-${kind}` },
    });
    unsub();
    assert.equal(received?.type, 'COLLECTIONS_CHANGED', `kind=${kind}: event delivered`);
    assert.equal(received?.payload?.kind, kind, `kind=${kind}: payload.kind preserved`);
    assert.equal(received?.payload?.collectionId, `c-${kind}`, `kind=${kind}: collectionId preserved`);
  }
});
