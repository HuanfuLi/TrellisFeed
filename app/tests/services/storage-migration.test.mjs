// Wave 0 scaffold (55-01); turned green by 55-05.
//
// storage-migration (Phase 55 D-10/D-11/D-12/D-13) — boot-hydration delete-guard,
// GRAPH_UPDATED resync emit, Float32 BLOB codec round-trip, and WASMSQLiteBackend
// presence. The codec round-trip is behavioral (inlined here for now — 55-05 lands
// the real vectorToBase64/base64ToVector in question.service.ts). The remaining
// three are source-reading and are RED until 55-05 lands the migration.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';

// localStorage shim (verbatim from filter-classifier.unit.test.mjs lines 29-43).
const _store = new Map();
globalThis.localStorage = {
  getItem(k) {
    return _store.has(k) ? _store.get(k) : null;
  },
  setItem(k, v) {
    _store.set(k, String(v));
  },
  removeItem(k) {
    _store.delete(k);
  },
  clear() {
    _store.clear();
  },
};

const questionServiceSource = fs.readFileSync(
  new URL('../../src/services/question.service.ts', import.meta.url),
  'utf-8',
);
const dbServiceSource = fs.readFileSync(
  new URL('../../src/services/db.service.ts', import.meta.url),
  'utf-8',
);

// Inlined Float32 BLOB codec (D-13). 55-05 lands the canonical pair in
// question.service.ts; this scaffold pins the round-trip contract now so the
// implementation can be swapped to import the real exports later.
function vectorToBase64(vec) {
  const f32 = new Float32Array(vec);
  const u8 = new Uint8Array(f32.buffer);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return Buffer.from(s, 'binary').toString('base64');
}

function base64ToVector(b64) {
  const binary = Buffer.from(b64, 'base64').toString('binary');
  const u8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
  return Array.from(new Float32Array(u8.buffer));
}

describe('storage-migration (Phase 55 D-11/D-12/D-13)', () => {
  // D-13: Float32 BLOB codec round-trip (behavioral — green now).
  it('vectorToBase64 / base64ToVector round-trips with <= 1e-6 error', () => {
    const vec = Array.from({ length: 256 }, (_, i) => Math.sin(i * 0.1));
    const encoded = vectorToBase64(vec);
    const decoded = base64ToVector(encoded);
    assert.equal(decoded.length, vec.length, 'decoded length must match');
    for (let i = 0; i < vec.length; i++) {
      assert.ok(Math.abs(vec[i] - decoded[i]) < 1e-6, `index ${i}: ${vec[i]} vs ${decoded[i]}`);
    }
  });

  // D-12: delete-guard — hydrateFromSQLite is a no-op when the mirror has data
  // (prevents deleted rows being resurrected from SQLite). RED until 55-05.
  it('hydrateFromSQLite source contains "if (existing.length > 0) return" guard', () => {
    assert.match(
      questionServiceSource,
      /if\s*\(\s*existing\.length\s*>\s*0\s*\)\s*return/,
      'delete-guard must be present — prevents deleted rows being resurrected from SQLite',
    );
  });

  // D-12: GRAPH_UPDATED must be emitted after hydration so always-mounted screens
  // resync (CLAUDE.md no-refresh assumption). RED until 55-05.
  it('hydrateFromSQLite emits GRAPH_UPDATED after populating mirror', () => {
    const start = questionServiceSource.indexOf('hydrateFromSQLite');
    assert.ok(start !== -1, 'hydrateFromSQLite must exist in question.service.ts');
    const hydrateBlock = questionServiceSource.slice(start, start + 1200);
    assert.match(
      hydrateBlock,
      /GRAPH_UPDATED/,
      'hydrateFromSQLite must emit GRAPH_UPDATED so always-mounted screens resync',
    );
  });

  // D-10 (revised 2026-05-21): browser SQLite (oo1.OpfsDb / opfs-sahpool) proved
  // unworkable — OpfsDb needs COOP/COEP isolation (breaks YouTube embeds) and
  // opfs-sahpool's createSyncAccessHandle is Worker-only, so neither runs on the
  // main thread. Unified on a single IndexedDBBackend across web + native WebView.
  it('db.service.ts contains IndexedDBBackend class (unified backend)', () => {
    assert.match(
      dbServiceSource,
      /class\s+IndexedDBBackend/,
      'IndexedDBBackend must exist in db.service.ts (unified web + native backend)',
    );
  });
});
