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

test('loadAll() purges fc-seed-* cards with sessionId=seed (UAT Bug 3)', async () => {
  storage.clear();
  storage.set(STORAGE_KEY, JSON.stringify([
    mkSeed(1), mkSeed(2), mkSeed(3), mkSeed(4), mkSeed(5),
    mkReal('fc-real-1'),
  ]));

  const { flashcardService } = await import(`../../src/services/flashcard.service.ts?seed-purge=${Date.now()}`);
  const all = flashcardService.getAll();

  assert.equal(all.length, 1, 'all 5 fc-seed-* cards must be purged; one real card kept');
  assert.equal(all[0].id, 'fc-real-1');
});

test('loadAll() writes back the purged array so the migration is self-disabling', async () => {
  storage.clear();
  storage.set(STORAGE_KEY, JSON.stringify([mkSeed(1), mkReal('fc-real-1')]));

  const { flashcardService } = await import(`../../src/services/flashcard.service.ts?seed-purge-writeback=${Date.now()}`);
  flashcardService.getAll();

  const persistedRaw = storage.get(STORAGE_KEY);
  const persisted = JSON.parse(persistedRaw);
  assert.equal(persisted.length, 1, 'storage must be rewritten without the seed card');
  assert.equal(persisted[0].id, 'fc-real-1');
});

test('loadAll() does NOT touch cards with fc-seed-* id but different sessionId (defensive AND-gate)', async () => {
  storage.clear();
  // Hypothetical: a legitimate card that happens to have an fc-seed-shaped id
  // (e.g., from a user-imported set). The AND-gate on sessionId === 'seed'
  // ensures we only strip the original placeholder records.
  storage.set(STORAGE_KEY, JSON.stringify([
    { ...mkReal('fc-seed-imported'), sessionId: 'user-import' },
  ]));

  const { flashcardService } = await import(`../../src/services/flashcard.service.ts?seed-purge-andgate=${Date.now()}`);
  const all = flashcardService.getAll();
  assert.equal(all.length, 1, 'cards with fc-seed-* id but sessionId != "seed" must NOT be purged');
});

test('loadAll() is a no-op when storage holds no seed cards', async () => {
  storage.clear();
  storage.set(STORAGE_KEY, JSON.stringify([mkReal('fc-real-1'), mkReal('fc-real-2')]));

  const { flashcardService } = await import(`../../src/services/flashcard.service.ts?seed-purge-noop=${Date.now()}`);
  const all = flashcardService.getAll();
  assert.equal(all.length, 2);

  // Storage should be byte-identical when no purge happens (no spurious writeback).
  const after = storage.get(STORAGE_KEY);
  const expected = JSON.stringify([mkReal('fc-real-1'), mkReal('fc-real-2')]);
  assert.equal(after, expected, 'no writeback when no seed cards present');
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

test('source: purgeStaleSeedCards writes back when purged > 0', () => {
  assert.match(
    source,
    /purged\s*>\s*0[\s\S]{0,160}localStorage\.setItem\(\s*STORAGE_KEY/,
    'flashcard.service.ts must call localStorage.setItem(STORAGE_KEY, ...) when purged > 0 so the migration is self-disabling.',
  );
});
