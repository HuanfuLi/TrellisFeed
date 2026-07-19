import assert from 'node:assert/strict';
import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

import { buildFrozenPool } from '../../../tools/content_pipeline/src/freeze/build.ts';
import {
  packageContentPool,
  RUNTIME_CONTENT_POOL_FILES,
} from '../../scripts/content-pool-package-contract.mjs';
import { createFreshGraphPoolFixture } from '../fixtures/fresh-graph-pool-run.mjs';

globalThis.localStorage = {
  _store: new Map(),
  getItem(key) { return this._store.get(key) ?? null; },
  setItem(key, value) { this._store.set(key, String(value)); },
  removeItem(key) { this._store.delete(key); },
  clear() { this._store.clear(); },
};
globalThis.indexedDB = fakeIndexedDB;

const db = await import('../../src/services/db.service.ts?fresh-graph-pool-cutover');
const { ContentPoolRepository } = await import('../../src/services/content-pool.repository.ts');
const { ContentPoolBootService } = await import('../../src/services/content-pool-boot.service.ts');
const { FrozenFeedService } = await import('../../src/services/frozen-feed.service.ts');
const { GlobalGraphRepository } = await import('../../src/services/global-graph.repository.ts');
const { RecommendationRepository } = await import('../../src/services/recommendation.repository.ts');
const {
  CONTROL_REASON_LABELS,
  RecommendationService,
} = await import('../../src/services/recommendation.service.ts');

function packagedReader(generatedRoot, mutate = (filename, text) => text) {
  let expectedVersion;
  return {
    get expectedVersion() { return expectedVersion; },
    async initialize() {
      const manifest = JSON.parse(await readFile(join(generatedRoot, 'manifest.json'), 'utf8'));
      expectedVersion = manifest.contentPoolVersion;
      return this;
    },
    async readText(filename) {
      const text = await readFile(join(generatedRoot, filename), 'utf8');
      return mutate(filename, text);
    },
  };
}

const parseRows = (rows) => rows.map((row) => JSON.parse(row.data));

function recommendationHarness({
  condition,
  userId,
  contentPool,
  graph,
  feed,
  repository,
  spies,
}) {
  let sequence = 0;
  return new RecommendationService({
    studyContext: {
      getRequired: () => ({ userId, condition, topicId: 'ai-agents-future-work' }),
    },
    repository,
    feed,
    getTopic: (topicId) => contentPool.getTopic(topicId),
    globalGraph: graph,
    loadPersonalDependencies() {
      spies.personalLoads += 1;
      if (condition === 'control') throw new Error('control touched personal state');
      return {
        async readSnapshot() {
          return {
            success: true,
            data: { userConceptStates: [], personalEdges: [], contributions: [] },
          };
        },
        async readQuestions() { return []; },
        getViewedPostIds() { return []; },
      };
    },
    async completeReason(messages) {
      spies.reasonCalls += 1;
      const candidateIds = [
        ...messages.at(-1).content.matchAll(/"candidateId"\s*:\s*"([^"]+)"/g),
      ].map((match) => match[1]);
      return JSON.stringify({
        reasons: candidateIds.map((candidateId) => ({
          candidateId,
          reasonText: `Explore the frozen evidence behind ${candidateId}.`,
        })),
      });
    },
    getReasonConfig: () => ({
      provider: 'openai',
      model: 'offline-fixture',
      apiKey: 'offline-fixture-key',
      isConfigured: true,
    }),
    bracketReasonMessages: (messages) => messages,
    now: () => Date.parse('2026-07-19T12:00:00.000Z'),
    createId: (kind) => `${userId}-${kind}-${++sequence}`,
    captureResearch: async () => {},
  });
}

test('fresh graph pool freezes, packages, boots, and persists both first recommendation batches offline', async (t) => {
  const fixture = await createFreshGraphPoolFixture();
  t.after(async () => { await rm(fixture.root, { recursive: true, force: true }); });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network is forbidden in fresh-pool regression'); };
  t.after(() => { globalThis.fetch = originalFetch; });

  const poolRoot = join(fixture.root, 'pool');
  const generatedRoot = join(fixture.root, 'generated');
  const publicRoot = join(fixture.root, 'public');
  const frozen = await buildFrozenPool({
    runDir: fixture.runDir,
    output: poolRoot,
    version: 'fresh-graph-pool-v1',
  });
  assert.equal(frozen.approvedCount, 12);

  const manifest = JSON.parse(await readFile(join(poolRoot, 'manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest.artifactHashes), RUNTIME_CONTENT_POOL_FILES.slice(1));
  assert.ok(Object.values(manifest.artifactHashes).every((hash) => /^[a-f0-9]{64}$/.test(hash)));
  assert.deepEqual(packageContentPool({ poolRoot, generatedRoot, publicRoot }), {
    contentPoolVersion: 'fresh-graph-pool-v1',
    postCount: 12,
  });
  assert.deepEqual((await readdir(publicRoot)).sort(), [...RUNTIME_CONTENT_POOL_FILES].sort());
  assert.deepEqual(
    (await readdir(generatedRoot)).sort(),
    [...RUNTIME_CONTENT_POOL_FILES, 'index.ts'].sort(),
  );

  // A runtime graph-byte mismatch fails before graph loading or recommendation persistence.
  await db.clearAllTables();
  const tamperedReader = await packagedReader(generatedRoot, (filename, text) => (
    filename === 'global_edges.json' ? `${text} ` : text
  )).initialize();
  let tamperedGraphLoads = 0;
  const tamperedBoot = new ContentPoolBootService({
    contentPool: new ContentPoolRepository({ reader: tamperedReader }),
    globalGraph: { async load() { tamperedGraphLoads += 1; return { success: true }; } },
  });
  assert.notEqual((await tamperedBoot.hydrate()).status, 'ready');
  assert.equal(tamperedGraphLoads, 0);
  assert.equal((await db.dbQuery('SELECT * FROM recommendations')).length, 0);
  assert.equal((await db.dbQuery('SELECT * FROM recommendation_batches')).length, 0);

  // A durable ready pool whose graph indexes cannot load remains behind recovery.
  await db.clearAllTables();
  const failureReader = await packagedReader(generatedRoot).initialize();
  const graphFailureBoot = new ContentPoolBootService({
    contentPool: new ContentPoolRepository({ reader: failureReader }),
    globalGraph: {
      async load() {
        return {
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'fixture graph failure', retryable: true },
        };
      },
    },
  });
  assert.deepEqual(await graphFailureBoot.hydrate(), {
    status: 'error',
    version: 'fresh-graph-pool-v1',
    errorCode: 'POOL_STORED_CORRUPT',
  });
  assert.equal((await db.dbQuery('SELECT * FROM recommendations')).length, 0);
  assert.equal((await db.dbQuery('SELECT * FROM recommendation_batches')).length, 0);

  // The production repository chain imports, indexes, and serves both conditions.
  await db.clearAllTables();
  const reader = await packagedReader(generatedRoot).initialize();
  const contentPool = new ContentPoolRepository({ reader });
  const graph = new GlobalGraphRepository();
  const boot = new ContentPoolBootService({ contentPool, globalGraph: graph });
  assert.deepEqual(await boot.hydrate(), { status: 'ready', version: 'fresh-graph-pool-v1' });

  const feed = new FrozenFeedService(contentPool, () => new Set());
  const repository = new RecommendationRepository();
  const controlSpies = { personalLoads: 0, reasonCalls: 0 };
  const controlService = recommendationHarness({
    condition: 'control',
    userId: 'fixture-control',
    contentPool,
    graph,
    feed,
    repository,
    spies: controlSpies,
  });
  const controlBatch = await controlService.beginSession('control-first');
  assert.equal(controlBatch.success, true, controlBatch.error?.message);
  assert.equal(controlBatch.data.status, 'ready');
  assert.equal(controlBatch.data.recommendationIds.length, 8);
  assert.deepEqual(controlSpies, { personalLoads: 0, reasonCalls: 0 });

  const controlRows = parseRows(await db.dbQuery(
    'SELECT * FROM recommendations WHERE user_id = ?',
    ['fixture-control'],
  ));
  const controlStrategies = new Set(['topic_baseline', 'quality_baseline', 'diversity_baseline']);
  assert.equal(controlRows.length, 8);
  assert.ok(controlRows.every((row) => controlStrategies.has(row.strategy)));
  assert.ok(controlRows.every((row) => (
    row.reasonText === CONTROL_REASON_LABELS.quality_baseline
    || row.reasonText === CONTROL_REASON_LABELS.diversity_baseline
    || /^Related to .+$/u.test(row.reasonText)
  )));
  assert.ok(controlRows.every((row) => !Object.hasOwn(row, 'contributingQuestionIds')));

  const experimentalSpies = { personalLoads: 0, reasonCalls: 0 };
  const experimentalService = recommendationHarness({
    condition: 'experimental',
    userId: 'fixture-experimental',
    contentPool,
    graph,
    feed,
    repository,
    spies: experimentalSpies,
  });
  const experimentalBatch = await experimentalService.beginSession('experimental-first');
  assert.equal(experimentalBatch.success, true, experimentalBatch.error?.message);
  assert.equal(experimentalBatch.data.status, 'ready');
  assert.equal(experimentalBatch.data.recommendationIds.length, 8);
  assert.deepEqual(experimentalSpies, { personalLoads: 1, reasonCalls: 1 });

  const experimentalRows = parseRows(await db.dbQuery(
    'SELECT * FROM recommendations WHERE user_id = ?',
    ['fixture-experimental'],
  ));
  const experimentalStrategies = new Set(['continue', 'deepen', 'contrast', 'bridge', 'echo']);
  const fixturePostIds = new Set(feed.getFeed().map((post) => post.id));
  const fixtureConceptIds = new Set(feed.getFeed().flatMap((post) => (
    feed.getConcepts(post.id).map((concept) => concept.id)
  )));
  assert.equal(experimentalRows.length, 8);
  assert.ok(experimentalRows.every((row) => experimentalStrategies.has(row.strategy)));
  for (const row of experimentalRows) {
    const conceptIds = row.contributingConceptIds ?? [];
    const postIds = row.contributingPostIds ?? [];
    assert.ok(conceptIds.length + postIds.length > 0, `${row.id} must carry frozen trace IDs`);
    assert.ok(conceptIds.every((id) => fixtureConceptIds.has(id)));
    assert.ok(postIds.every((id) => fixturePostIds.has(id)));
  }

  const allBatches = parseRows(await db.dbQuery('SELECT * FROM recommendation_batches'));
  assert.equal(allBatches.length, 2);
  assert.ok(allBatches.every((batch) => batch.status === 'ready'));
  assert.equal(allBatches.some((batch) => batch.status === 'building'), false);
  assert.equal((await db.dbQuery('SELECT * FROM recommendations')).length, 16);
});
