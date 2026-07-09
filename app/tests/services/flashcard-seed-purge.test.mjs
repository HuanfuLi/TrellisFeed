// UAT Bug 3 (Phase 51 verify-work, 2026-05-19): one-time migration that
// purges placeholder seed cards (fc-seed-1..fc-seed-5) left behind by
// pre-Phase-38-04 installs. The original fix (commit 8829a68c) removed
// makeSeedCards from source but shipped no data cleanup for existing
// users — the 5 cards persisted as "due today" forever even though the
// code that created them was gone.
//
// Source-reading test for the migration shape + a behavioral test
// driving loadAll() through a localStorage shim.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FLASHCARD_PATH = resolve(__dirname, '../../src/services/flashcard.service.ts');
const source = readFileSync(FLASHCARD_PATH, 'utf-8');

// localStorage shim (same pattern as trellis-state.test.mjs)
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

const STORAGE_KEY = 'trellis_flashcards';

// Minimal seed-card record matching the original makeSeedCards shape.
const mkSeed = (n) => ({
  id: `fc-seed-${n}`,
  sessionId: 'seed',
  front: `seed ${n} front`,
  back: `seed ${n} back`,
  createdAt: 1700000000000,
  reviewSchedule: { nextReviewDate: '2026-05-19', reviewCount: 1, easeFactor: 2.5 },
});

// Minimal legitimate card.
const mkReal = (id, sessionId = 'sess-real') => ({
  id,
  sessionId,
  front: 'real front',
  back: 'real back',
  createdAt: 1700000000000,
  reviewSchedule: { nextReviewDate: '2026-05-20', reviewCount: 0, easeFactor: 2.5 },
});

// Phase 55-07: flashcards are an in-memory mirror (IndexedDB-backed), not
// localStorage. The seed-purge migration now runs in loadAll() against the
// in-memory mirror. These tests seed the mirror through the public save() API
// (save appends, getAll purges) instead of seeding the localStorage key.

test('loadAll() purges fc-seed-* cards with sessionId=seed (UAT Bug 3)', async () => {
  const { flashcardService } = await import('../../src/services/flashcard.service.ts');
  flashcardService.clear();
  flashcardService.save([mkSeed(1), mkSeed(2), mkSeed(3), mkSeed(4), mkSeed(5), mkReal('fc-real-1')]);
  const all = flashcardService.getAll();

  assert.equal(all.length, 1, 'all 5 fc-seed-* cards must be purged; one real card kept');
  assert.equal(all[0].id, 'fc-real-1');
});

test('loadAll() writes back the purged array so the migration is self-disabling', async () => {
  const { flashcardService } = await import('../../src/services/flashcard.service.ts');
  flashcardService.clear();
  flashcardService.save([mkSeed(1), mkReal('fc-real-1')]);
  // First read purges and writes back the cleaned mirror.
  flashcardService.getAll();
  // Second read sees no seed cards — the mirror was rewritten.
  const persisted = flashcardService.getAll();
  assert.equal(persisted.length, 1, 'mirror must be rewritten without the seed card');
  assert.equal(persisted[0].id, 'fc-real-1');
});

test('loadAll() does NOT touch cards with fc-seed-* id but different sessionId (defensive AND-gate)', async () => {
  const { flashcardService } = await import('../../src/services/flashcard.service.ts');
  flashcardService.clear();
  // A legitimate card with an fc-seed-shaped id but sessionId != 'seed'.
  flashcardService.save([{ ...mkReal('fc-seed-imported'), sessionId: 'user-import' }]);
  const all = flashcardService.getAll();
  assert.equal(all.length, 1, 'cards with fc-seed-* id but sessionId != "seed" must NOT be purged');
});

test('loadAll() is a no-op when the store holds no seed cards', async () => {
  const { flashcardService } = await import('../../src/services/flashcard.service.ts');
  flashcardService.clear();
  flashcardService.save([mkReal('fc-real-1'), mkReal('fc-real-2')]);
  const all = flashcardService.getAll();
  assert.equal(all.length, 2);
  // A second read returns the same two cards (no spurious mutation).
  assert.deepEqual(flashcardService.getAll().map((c) => c.id), ['fc-real-1', 'fc-real-2']);
});

test('source: purgeStaleSeedCards filter is AND-gated on id-prefix and sessionId', () => {
  // Regression sentinel — if someone weakens the guard to just id prefix,
  // a user-imported card with that id is at risk of being silently dropped.
  assert.match(
    source,
    /fc-seed-[\s\S]{0,80}sessionId\s*===\s*['"]seed['"]/,
    'flashcard.service.ts purgeStaleSeedCards must AND-gate on BOTH id prefix AND sessionId === "seed".',
  );
});

test('source: loadAll writes back the purged array when purged > 0 (self-disabling)', () => {
  // Phase 55-07: writeback now mutates the in-memory mirror (_store = cards)
  // instead of localStorage.setItem.
  assert.match(
    source,
    /purged\s*>\s*0[\s\S]{0,160}_store\s*=\s*cards/,
    'flashcard.service.ts must rewrite the in-memory mirror (_store = cards) when purged > 0 so the migration is self-disabling.',
  );
});
