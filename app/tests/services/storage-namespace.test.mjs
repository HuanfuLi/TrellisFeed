import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// Node has no IndexedDB, so db.service.ts exercises its LocalStorageBackend
// through the same dbExecute/dbQuery seam used by the app.
const store = new Map([
  ['questiontrace_db_tables', JSON.stringify({
    posts: [{ id: 'retired-post' }],
    post_queue: [{ id: 'retired-queue' }],
    sessions: [{ id: 'retired-session' }],
    post_history: [{ id: 'history-survivor', data: '{"viewedAt":1}' }],
  })],
]);
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

test('fallback migration drops retired tables while preserving survivor rows', async () => {
  assert.deepEqual(
    await dbQuery('SELECT * FROM post_history WHERE id = ?', ['history-survivor']),
    [{ id: 'history-survivor', data: '{"viewedAt":1}' }],
  );

  const persisted = JSON.parse(store.get('questiontrace_db_tables'));
  assert.equal('posts' in persisted, false);
  assert.equal('post_queue' in persisted, false);
  assert.equal('sessions' in persisted, false);
  assert.deepEqual(persisted.post_history, [{ id: 'history-survivor', data: '{"viewedAt":1}' }]);
});

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

test('IndexedDB v6 to v7 upgrade removes only retired stores and retains every survivor row', async () => {
  const { indexedDB: fakeIndexedDB } = await import('fake-indexeddb');
  const savedIndexedDB = globalThis.indexedDB;
  globalThis.indexedDB = fakeIndexedDB;

  const survivorStores = [
    'questions',
    'edge_weights',
    'post_history',
    'engagement',
    'research_records',
    'research_upload_queue',
    'research_upload_quarantine',
    'research_metadata',
    'content_pool_meta',
    'content_pool_topics',
    'content_pool_posts',
    'content_pool_concepts',
    'content_pool_claims',
    'content_pool_suggestions',
    'content_pool_assets',
    'content_pool_sources',
    'content_pool_global_edges',
    'content_pool_ranking_features',
    'user_questions',
    'ai_answers',
    'user_concept_states',
    'graph_contributions',
    'personal_graph_edges',
    'extraction_jobs',
    'recommendations',
    'recommendation_batches',
  ];
  const retiredStores = ['posts', 'post_queue', 'sessions'];

  try {
    await new Promise((resolve, reject) => {
      const request = fakeIndexedDB.deleteDatabase('questiontrace');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('fixture database deletion blocked'));
    });

    const v6 = await new Promise((resolve, reject) => {
      const request = fakeIndexedDB.open('questiontrace', 6);
      request.onupgradeneeded = () => {
        for (const name of [...survivorStores, ...retiredStores]) {
          request.result.createObjectStore(name);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const seed = v6.transaction([...survivorStores, ...retiredStores], 'readwrite');
    for (const name of [...survivorStores, ...retiredStores]) {
      seed.objectStore(name).put({ marker: `${name}-row` }, `${name}-key`);
    }
    await new Promise((resolve, reject) => {
      seed.oncomplete = () => resolve();
      seed.onerror = () => reject(seed.error);
      seed.onabort = () => reject(seed.error ?? new Error('fixture seed aborted'));
    });
    v6.close();

    const upgraded = await import(`../../src/services/db.service.ts?v7-upgrade=${Date.now()}`);
    for (const name of survivorStores) {
      assert.deepEqual(
        await upgraded.dbQuery(`SELECT * FROM ${name}`),
        [{ marker: `${name}-row` }],
        `${name} row must survive the v7 upgrade`,
      );
    }

    const v7 = await new Promise((resolve, reject) => {
      const request = fakeIndexedDB.open('questiontrace', 7);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    for (const name of survivorStores) assert.equal(v7.objectStoreNames.contains(name), true, name);
    for (const name of retiredStores) assert.equal(v7.objectStoreNames.contains(name), false, name);
    v7.close();
  } finally {
    if (savedIndexedDB === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = savedIndexedDB;
  }
});

test('IndexedDB creates, round-trips, and clears the quarantine store', async () => {
  const { indexedDB: fakeIndexedDB } = await import('fake-indexeddb');
  const savedIndexedDB = globalThis.indexedDB;
  globalThis.indexedDB = fakeIndexedDB;
  try {
    const indexedDbModule = await import('../../src/services/db.service.ts?quarantine-indexeddb');
    await indexedDbModule.dbExecute('DELETE FROM research_upload_quarantine');
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
