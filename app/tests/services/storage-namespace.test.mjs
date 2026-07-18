import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// Node has no IndexedDB, so db.service.ts exercises its LocalStorageBackend
// through the same dbExecute/dbQuery seam used by the app.
const store = new Map();
globalThis.localStorage = {
  get length() { return store.size; },
  key(index) { return Array.from(store.keys())[index] ?? null; },
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); },
  clear() { store.clear(); },
};

const { dbExecute, dbQuery } = await import('../../src/services/db.service.ts');
const { FILTER_CORPUS_CACHE_KEY } = await import('../../src/services/filter-corpus.service.ts');

const activeStorageOwners = [
  ['db.service.ts', [
    "const IDB_NAME = 'questiontrace'",
    "const PREFIX = 'questiontrace_db_'",
  ]],
  ['settings.service.ts', ["const STORAGE_KEY = 'questiontrace_settings'"]],
  ['daily-read.service.ts', ["const STORAGE_KEY = 'questiontrace_daily_read'"]],
  ['filter-corpus.service.ts', ["FILTER_CORPUS_CACHE_KEY = 'questiontrace_filter_corpus_emb_v1'"]],
];

function sourceFor(relativePath) {
  return fs.readFileSync(new URL(`../../src/services/${relativePath}`, import.meta.url), 'utf-8');
}

test('research persistence stores round-trip through the dbQuery seam', async () => {
  const rows = [
    {
      table: 'research_records',
      columns: 'id, kind, revision, data',
      values: ['record-1', 'event', 1, '{"eventType":"post_opened"}'],
    },
    {
      table: 'research_upload_queue',
      columns: 'id, data',
      values: ['queue-1', '{"recordIds":["record-1"]}'],
    },
    {
      table: 'research_metadata',
      columns: 'id, data',
      values: ['last_upload', '{"at":0}'],
    },
    {
      table: 'research_upload_quarantine',
      columns: 'id, data',
      values: ['quarantine-1', '{"reason":"invalid_record"}'],
    },
  ];

  for (const { table } of rows) {
    await dbExecute(`DELETE FROM ${table}`);
  }

  for (const { table, columns, values } of rows) {
    const placeholders = values.map(() => '?').join(', ');
    await dbExecute(
      `INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${placeholders})`,
      values,
    );
    const persisted = await dbQuery(`SELECT * FROM ${table} WHERE id = ?`, [values[0]]);
    assert.deepEqual(persisted, [Object.fromEntries(columns.split(', ').map((column, index) => [column, values[index]]))]);
  }
});

test('active persistence owners remain in the questiontrace namespace', () => {
  assert.match(FILTER_CORPUS_CACHE_KEY, /^questiontrace_/);

  for (const [file, expectedDefinitions] of activeStorageOwners) {
    const source = sourceFor(file);
    for (const definition of expectedDefinitions) {
      assert.ok(source.includes(definition), `${file} must define ${definition}`);
    }

    // Restrict the negative scan to executable key definitions. This excludes
    // comments and db.service.ts's intentional LEGACY_HEAVY_KEYS delete-list.
    assert.doesNotMatch(
      source,
      /^(?!\s*\/\/|\s*\*)\s*(?:export\s+)?const\s+\w*(?:KEY|NAME|PREFIX)\w*\s*=\s*['"](?:trellis_|echolearn_)/m,
      `${file} must not define an active legacy storage key`,
    );
  }
});

test('IndexedDB creates, round-trips, and clears the quarantine store', async () => {
  const { indexedDB: fakeIndexedDB } = await import('fake-indexeddb');
  const savedIndexedDB = globalThis.indexedDB;
  globalThis.indexedDB = fakeIndexedDB;
  try {
    const indexedDbModule = await import('../../src/services/db.service.ts?quarantine-indexeddb');
    await indexedDbModule.dbExecute(
      'INSERT OR REPLACE INTO research_upload_quarantine (id, data) VALUES (?, ?)',
      ['quarantine-idb', '{"reason":"invalid_record"}'],
    );
    assert.equal(
      (await indexedDbModule.dbQuery('SELECT * FROM research_upload_quarantine')).length,
      1,
    );
    await indexedDbModule.clearAllTables();
    assert.equal(
      (await indexedDbModule.dbQuery('SELECT * FROM research_upload_quarantine')).length,
      0,
    );
  } finally {
    if (savedIndexedDB === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = savedIndexedDB;
  }
});
