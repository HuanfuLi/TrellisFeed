import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, it } from 'node:test';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

const POOL_TABLES = [
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
  'user_concept_states',
  'graph_contributions',
  'personal_graph_edges',
  'extraction_jobs',
  'recommendations',
  'recommendation_batches',
];

function makeLocalStorage() {
  return {
    _store: new Map(),
    getItem(key) { return this._store.get(key) ?? null; },
    setItem(key, value) { this._store.set(key, String(value)); },
    removeItem(key) { this._store.delete(key); },
    clear() { this._store.clear(); },
  };
}

globalThis.localStorage = makeLocalStorage();
globalThis.indexedDB = fakeIndexedDB;

const indexedDbModule = await import('../../src/services/db.service.ts?content-pool-indexeddb');
const bundleModule = await import('../../src/data/content-pool-bundle.ts');
const repositoryModule = await import('../../src/services/content-pool.repository.ts');

const fixture = JSON.parse(readFileSync(
  new URL('../fixtures/content-pool/minimal-valid-pool.json', import.meta.url),
  'utf8',
));

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const clone = (value) => JSON.parse(JSON.stringify(value));

function fixtureReader(mutator = () => {}) {
  const bundle = clone(fixture);
  bundle.sources = [
    { id: 'source-article', name: 'Example Journal', platform: 'article', url: 'https://example.com/article' },
    { id: 'source-video', name: 'Example Channel', platform: 'youtube', url: 'https://www.youtube.com/watch?v=example' },
  ];
  bundle.globalEdges = [
    { id: 'explains:post-article:concept-1', topicId: 'topic-1', type: 'explains', sourceId: 'post-article', targetId: 'concept-1' },
    { id: 'mentions:post-video:concept-1', topicId: 'topic-1', type: 'mentions', sourceId: 'post-video', targetId: 'concept-1' },
    { id: 'about:claim-1:concept-1', topicId: 'topic-1', type: 'about', sourceId: 'claim-1', targetId: 'concept-1' },
  ];
  bundle.rankingFeatures = {
    embeddingFingerprint: null,
    posts: [
      { postId: 'post-article', topicId: 'topic-1', primaryConceptId: 'concept-1', sourceId: 'source-article', format: 'article', qualityScore: 0.9, educationalValueScore: 0.9, interestingnessScore: 0.8, difficulty: 0.3, viewpoint: 'neutral' },
      { postId: 'post-video', topicId: 'topic-1', primaryConceptId: 'concept-1', sourceId: 'source-video', format: 'video', qualityScore: 0.8, educationalValueScore: 0.8, interestingnessScore: 0.9, difficulty: 0.4 },
    ],
  };
  for (const asset of bundle.sourceAssets) {
    asset.sha256 = sha256(asset.kind === 'article' ? asset.body : asset.digest);
  }
  mutator(bundle);
  const artifacts = {
    'topics.json': JSON.stringify(bundle.topics),
    'posts.json': JSON.stringify(bundle.posts),
    'concepts.json': JSON.stringify(bundle.concepts),
    'claims.json': JSON.stringify(bundle.claims),
    'suggested_questions.json': JSON.stringify(bundle.suggestedQuestions),
    'source_assets.json': JSON.stringify(bundle.sourceAssets),
    'sources.json': JSON.stringify(bundle.sources),
    'global_edges.json': JSON.stringify(bundle.globalEdges),
    'ranking_features.json': JSON.stringify(bundle.rankingFeatures),
  };
  for (const [filename, text] of Object.entries(artifacts)) {
    bundle.manifest.artifactHashes[filename] = sha256(text);
  }
  const files = { 'manifest.json': JSON.stringify(bundle.manifest), ...artifacts };
  return {
    expectedVersion: 'v1',
    async readText(filename) {
      assert.ok(Object.hasOwn(files, filename), `unexpected packaged filename: ${filename}`);
      return files[filename];
    },
  };
}

describe('content pool schema and backend parity', () => {
  beforeEach(async () => {
    await indexedDbModule.clearAllTables();
  });

  it('schema upgrade creates every content pool object store', async () => {
    await indexedDbModule.getDB();
    const request = fakeIndexedDB.open('questiontrace');
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    for (const table of POOL_TABLES) {
      assert.equal(db.objectStoreNames.contains(table), true, `${table} must exist`);
    }
    db.close();
  });

  it('IndexedDB backend executes insert, query, delete, and clear through the DB seam', async () => {
    for (const table of POOL_TABLES) {
      await indexedDbModule.dbExecute(
        `INSERT OR REPLACE INTO ${table} (id, version, data) VALUES (?, ?, ?)`,
        [`${table}:row`, 'v1', '{}'],
      );
      assert.equal(
        (await indexedDbModule.dbQuery(`SELECT * FROM ${table} WHERE version = ?`, ['v1'])).length,
        1,
      );
      await indexedDbModule.dbExecute(`DELETE FROM ${table} WHERE version = ?`, ['v1']);
      assert.equal((await indexedDbModule.dbQuery(`SELECT * FROM ${table}`)).length, 0);
    }

    for (const table of POOL_TABLES) {
      await indexedDbModule.dbExecute(
        `INSERT OR REPLACE INTO ${table} (id, version, data) VALUES (?, ?, ?)`,
        [`${table}:clear`, 'v1', '{}'],
      );
    }
    await indexedDbModule.clearAllTables();
    for (const table of POOL_TABLES) {
      assert.equal((await indexedDbModule.dbQuery(`SELECT * FROM ${table}`)).length, 0);
    }
  });

  it('fallback backend supports the same content-pool SQL subset', async () => {
    const savedIndexedDB = globalThis.indexedDB;
    delete globalThis.indexedDB;
    globalThis.localStorage = makeLocalStorage();
    const fallback = await import('../../src/services/db.service.ts?content-pool-fallback');
    try {
      for (const table of POOL_TABLES) {
        await fallback.dbExecute(
          `INSERT OR REPLACE INTO ${table} (id, version, data) VALUES (?, ?, ?)`,
          [`${table}:row`, 'v1', '{}'],
        );
        assert.equal((await fallback.dbQuery(`SELECT * FROM ${table} WHERE version = ?`, ['v1'])).length, 1);
        await fallback.dbExecute(`DELETE FROM ${table} WHERE version = ?`, ['v1']);
        assert.equal((await fallback.dbQuery(`SELECT * FROM ${table}`)).length, 0);
      }
    } finally {
      globalThis.indexedDB = savedIndexedDB;
    }
  });
});

describe('bundled content pool import', () => {
  beforeEach(async () => {
    await indexedDbModule.clearAllTables();
  });

  it('validates the packaged graph pool in-process without network acquisition', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = async () => { fetchCalls += 1; throw new Error('network forbidden'); };
    try {
      const bundle = await bundleModule.loadBundledContentPool();
      assert.equal(bundle.manifest.contentPoolVersion, bundleModule.PACKAGED_CONTENT_POOL_VERSION);
      assert.equal(bundle.posts.length, bundle.manifest.counts.posts);
      assert.ok(bundle.sources.length > 0);
      assert.ok(bundle.globalEdges.length > 0);
      assert.equal(bundle.rankingFeatures.posts.length, bundle.posts.length);
      assert.equal(fetchCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('validates and exposes a ready version only after durable import', async () => {
    const repository = new repositoryModule.ContentPoolRepository({ reader: fixtureReader() });
    const snapshot = await repository.hydrate();

    assert.equal(snapshot.status, 'ready');
    assert.equal(repository.getReadyVersion(), 'v1');
    assert.equal(repository.getPost('post-article')?.displayTitle, 'Why Feedback Loops Matter');
    assert.equal(repository.getTopic('topic-1')?.contentPoolVersion, 'v1');
    assert.deepEqual(repository.getConcepts('post-article').map((record) => record.id), ['concept-1']);
    assert.deepEqual(repository.getClaims('post-article').map((record) => record.id), ['claim-1']);
    assert.deepEqual(repository.getSuggestedQuestions('post-video').map((record) => record.id), ['sq-video']);
    assert.match(repository.getOriginalContent('post-article')?.body ?? '', /<script>/);

    const meta = await indexedDbModule.dbQuery('SELECT * FROM content_pool_meta WHERE version = ?', ['v1']);
    assert.equal(meta[0].status, 'ready');
    assert.equal((await indexedDbModule.dbQuery('SELECT * FROM content_pool_posts WHERE version = ?', ['v1'])).length, 2);
    assert.equal((await indexedDbModule.dbQuery('SELECT * FROM content_pool_sources WHERE version = ?', ['v1'])).length, 2);
    assert.equal((await indexedDbModule.dbQuery('SELECT * FROM content_pool_global_edges WHERE version = ?', ['v1'])).length, 3);
    assert.equal((await indexedDbModule.dbQuery('SELECT * FROM content_pool_ranking_features WHERE version = ?', ['v1'])).length, 2);
  });

  it('reuses an identical ready version without mutating it', async () => {
    const first = new repositoryModule.ContentPoolRepository({ reader: fixtureReader() });
    await first.hydrate();
    const writes = [];
    const database = {
      query: indexedDbModule.dbQuery,
      execute: async (sql, values) => { writes.push(sql); return indexedDbModule.dbExecute(sql, values); },
    };
    const second = new repositoryModule.ContentPoolRepository({ reader: fixtureReader(), database });

    assert.equal((await second.hydrate()).status, 'ready');
    assert.deepEqual(writes, []);
  });

  it('refuses replacement of an immutable ready version', async () => {
    const repository = new repositoryModule.ContentPoolRepository({ reader: fixtureReader() });
    await repository.hydrate();
    const changed = await bundleModule.loadBundledContentPool(fixtureReader());
    changed.manifest.artifactHashes['posts.json'] = '9'.repeat(64);

    const snapshot = await repository.importBundledVersion(changed);
    assert.equal(snapshot.status, 'error');
    assert.equal(snapshot.errorCode, 'POOL_READY_IMMUTABLE');
    assert.equal((await indexedDbModule.dbQuery('SELECT * FROM content_pool_posts')).length, 2);
  });

  it('keeps interrupted imports hidden and cleans them before retry', async () => {
    let failOnce = true;
    const database = {
      query: indexedDbModule.dbQuery,
      execute: async (sql, values) => {
        if (failOnce && /INSERT OR REPLACE INTO content_pool_posts/.test(sql)) {
          failOnce = false;
          throw new DOMException('simulated quota secret-token-123', 'QuotaExceededError');
        }
        return indexedDbModule.dbExecute(sql, values);
      },
    };
    const repository = new repositoryModule.ContentPoolRepository({ reader: fixtureReader(), database });
    const failed = await repository.hydrate();
    assert.equal(failed.status, 'error');
    assert.equal(failed.errorCode, 'POOL_IMPORT_FAILED');
    assert.doesNotMatch(JSON.stringify(failed), /secret-token-123/);
    assert.equal(repository.getPost('post-article'), null);
    assert.equal((await indexedDbModule.dbQuery('SELECT * FROM content_pool_meta WHERE version = ?', ['v1']))[0].status, 'importing');

    const retried = new repositoryModule.ContentPoolRepository({ reader: fixtureReader(), database });
    assert.equal((await retried.hydrate()).status, 'ready');
    assert.equal(retried.getPost('post-video')?.id, 'post-video');
  });

  it('retries a failed hydration on the same repository without a reload', async () => {
    const packaged = fixtureReader();
    let available = false;
    const reader = {
      expectedVersion: packaged.expectedVersion,
      async readText(filename) {
        if (!available) throw new bundleModule.ContentPoolBundleError('POOL_NOT_PACKAGED');
        return packaged.readText(filename);
      },
    };
    const repository = new repositoryModule.ContentPoolRepository({ reader });
    assert.equal((await repository.hydrate()).status, 'error');

    available = true;
    assert.equal((await repository.hydrate()).status, 'ready');
    assert.equal(repository.getReadyVersion(), 'v1');
  });

  for (const [name, mutate, code] of [
    ['checksum mismatch', (bundle) => { bundle.manifest.artifactHashes['posts.json'] = '0'.repeat(64); }, 'POOL_CHECKSUM_MISMATCH'],
    ['count mismatch', (bundle) => { bundle.manifest.counts.posts += 1; }, 'POOL_INVALID'],
    ['reference mismatch', (bundle) => { bundle.posts[0].conceptIds = ['missing']; }, 'POOL_INVALID'],
    ['version mismatch', (bundle) => { bundle.manifest.contentPoolVersion = 'v2'; }, 'POOL_VERSION_MISMATCH'],
    ['non-frozen post', (bundle) => { bundle.posts[0].status = 'approved'; }, 'POOL_INVALID'],
  ]) {
    it(`rejects ${name} before writing visible rows`, async () => {
      const reader = fixtureReader(mutate);
      if (name === 'checksum mismatch') reader.readText = async (filename) => {
        const clean = fixtureReader();
        if (filename === 'manifest.json') {
          const manifest = JSON.parse(await clean.readText(filename));
          manifest.artifactHashes['posts.json'] = '0'.repeat(64);
          return JSON.stringify(manifest);
        }
        return clean.readText(filename);
      };
      const repository = new repositoryModule.ContentPoolRepository({ reader });
      const snapshot = await repository.hydrate();
      assert.equal(snapshot.status, 'error');
      assert.equal(snapshot.errorCode, code);
      assert.equal(repository.getReadyVersion(), null);
      assert.equal((await indexedDbModule.dbQuery('SELECT * FROM content_pool_posts')).length, 0);
    });
  }

  it('rejects a hash-valid graph with a dangling endpoint before marking it ready', async () => {
    const repository = new repositoryModule.ContentPoolRepository({ reader: fixtureReader((bundle) => {
      bundle.globalEdges.push({
        id: 'related_to:concept-1:missing-concept',
        topicId: 'topic-1',
        type: 'related_to',
        sourceId: 'concept-1',
        targetId: 'missing-concept',
      });
    }) });

    const snapshot = await repository.hydrate();
    assert.equal(snapshot.status, 'error');
    assert.equal(snapshot.errorCode, 'POOL_INVALID');
    assert.equal(repository.getReadyVersion(), null);
    const meta = await indexedDbModule.dbQuery('SELECT * FROM content_pool_meta WHERE version = ?', ['v1']);
    assert.equal(meta[0].status, 'importing');
  });

  it('fails closed when a ready stored version is corrupt instead of repairing it', async () => {
    const first = new repositoryModule.ContentPoolRepository({ reader: fixtureReader() });
    await first.hydrate();
    await indexedDbModule.dbExecute('DELETE FROM content_pool_posts WHERE record_id = ?', ['post-video']);

    const second = new repositoryModule.ContentPoolRepository({ reader: fixtureReader() });
    const snapshot = await second.hydrate();
    assert.equal(snapshot.status, 'error');
    assert.equal(snapshot.errorCode, 'POOL_STORED_CORRUPT');
    assert.equal(second.getPost('post-article'), null);
    assert.equal((await indexedDbModule.dbQuery('SELECT * FROM content_pool_posts')).length, 1);
  });
});
