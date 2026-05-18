// Phase 50 Plan 50-02 — Wave 0 RED scaffold for collectionService.
//
// Covers RETRIEVE-02 (collection CRUD + idempotence + COLLECTIONS_CHANGED
// emission). Turned GREEN by plan 50-03 which implements the service. Until
// then, every `it()` body fails via `assert.fail(...)` so a `node --test` run
// surfaces missing behavior as deterministic red.
//
// Pattern: engagement.service.test.mjs (localStorage shim + dynamic import).
// The actual service file `src/services/collection.service.ts` does NOT yet
// exist — plan 50-03 creates it. This scaffold intentionally does NOT import
// from that path so node --test can collect the file without an unresolved
// module error before 50-03 ships.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// localStorage polyfill (same shim as engagement.service.test.mjs).
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const STORAGE_KEY = 'trellis_collections_v1';
const TURNED_GREEN_BY = 'plan 50-03 (collectionService implementation)';

describe('collectionService — Phase 50 Wave 0 RED scaffold', () => {
  it('createCollection persists to trellis_collections_v1 + emits COLLECTIONS_CHANGED { kind: "create" }', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: createCollection(name) must write to ${STORAGE_KEY} AND emit COLLECTIONS_CHANGED event with payload.kind === 'create'.`);
  });

  it('createCollection validates name: empty rejected', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: createCollection('') must return ServiceResult { success: false } (CONTEXT D-04 name validation).`);
  });

  it('createCollection validates name: >50 chars rejected', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: createCollection('x'.repeat(51)) must return ServiceResult { success: false } (UI-SPEC nameTooLong).`);
  });

  it('createCollection validates name: case-insensitive dedup rejected', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: after createCollection('Foo'), createCollection('foo') must fail (UI-SPEC nameDuplicate).`);
  });

  it('addPost is idempotent: adding the same postId twice does not duplicate', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: addPost(cid, 'p1') then addPost(cid, 'p1') must result in a single membership entry.`);
  });

  it('addPost emits COLLECTIONS_CHANGED with kind: "add-post"', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: addPost emits COLLECTIONS_CHANGED { kind: 'add-post', collectionId, postId }.`);
  });

  it('removePost is idempotent: removing a non-member is a no-op (no event emitted)', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: removePost(cid, 'never-added') must NOT emit COLLECTIONS_CHANGED.`);
  });

  it('removePost emits COLLECTIONS_CHANGED with kind: "remove-post" when membership existed', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: after addPost then removePost, COLLECTIONS_CHANGED { kind: 'remove-post' } is emitted exactly once on remove.`);
  });

  it('renameCollection emits COLLECTIONS_CHANGED with kind: "rename"', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: renameCollection(cid, 'NewName') emits { kind: 'rename', collectionId, name }.`);
  });

  it('deleteCollection emits COLLECTIONS_CHANGED with kind: "delete"', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: deleteCollection(cid) emits { kind: 'delete', collectionId }; posts remain in Saved (UI-SPEC deleteConfirm).`);
  });

  it('getAllMemberPostIds returns the union of all collection memberships', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: with collections A=[p1,p2] and B=[p2,p3], getAllMemberPostIds() === ['p1','p2','p3'] (D-09 union feeds engagementService.getPinnedIds).`);
  });

  it('reset() clears storage WITHOUT emitting any COLLECTIONS_CHANGED event', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: reset() must NOT emit COLLECTIONS_CHANGED (anti-wire invariant — same shape as engagementService.reset()).`);
  });
});
