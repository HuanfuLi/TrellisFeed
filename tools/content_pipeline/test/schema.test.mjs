import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateFrozenPoolBundle } from '../src/schema/validate.ts';

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const load = (name) => JSON.parse(readFileSync(new URL(`../schemas/${name}.schema.json`, import.meta.url)));
const validators = new Map();
const compile = (name) => {
  if (!validators.has(name)) validators.set(name, ajv.compile(load(name)));
  return validators.get(name);
};
const now = '2026-07-11T12:00:00.000Z';

const records = {
  topic: { id: 't1', name: 'Topic', shortDescription: 'Description', hooks: ['Hook'], coreConceptIds: ['c1'], testRubricId: 'r1', contentPoolVersion: 'v1' },
  post: { id: 'p1', topicId: 't1', sourceUrl: 'https://example.com/p1', sourcePlatform: 'article', sourceName: 'Example', originalTitle: 'Original', displayTitle: 'Display', hook: 'Hook', shortSummary: 'Summary', language: 'en', collectedAt: now, qualityScore: 0.8, interestingnessScore: 0.7, educationalValueScore: 0.9, difficulty: 0.4, conceptIds: ['c1'], claimIds: ['cl1'], suggestedQuestionIds: ['sq1'], status: 'frozen' },
  concept: { id: 'c1', topicId: 't1', label: 'Concept', description: 'Description', aliases: [] },
  claim: { id: 'cl1', topicId: 't1', text: 'Claim', conceptIds: ['c1'] },
  'suggested-question': { id: 'sq1', postId: 'p1', topicId: 't1', text: 'Why?', type: 'clarification', targetConceptIds: ['c1'], generic: false },
  'user-question': { id: 'uq1', userId: 'u1', condition: 'control', topicId: 't1', postId: 'p1', text: 'Why?', source: 'typed', createdAt: now, extractedConceptIds: ['c1'] },
  'ai-answer': { id: 'a1', userQuestionId: 'uq1', postId: 'p1', answerText: 'Because.', citedPostIds: ['p1'], conceptIds: ['c1'], createdAt: now, modelName: 'mock' },
  recommendation: { id: 'r1', userId: 'u1', condition: 'experimental', topicId: 't1', postId: 'p1', generatedAt: now, strategy: 'deepen', score: 0.5, reasonText: 'Builds on this concept.' },
  'user-concept-state': { userId: 'u1', conceptId: 'c1', exposureCount: 1, questionCount: 0, savedPostCount: 0, skippedPostCount: 0, interestWeight: 0.2, uncertaintyWeight: 0.5, familiarityEstimate: 0.1 },
};

for (const [name, record] of Object.entries(records)) {
  test(`${name} schema accepts its exact canonical record and rejects extras/missing keys`, () => {
    const validate = compile(name);
    assert.equal(validate(record), true, JSON.stringify(validate.errors));
    assert.equal(validate({ ...record, html: '<b>active</b>' }), false);
    const missing = structuredClone(record);
    delete missing[Object.keys(record)[0]];
    assert.equal(validate(missing), false);
  });
}

test('record schemas reject invalid enums and out-of-range scores', () => {
  assert.equal(compile('post')({ ...records.post, sourcePlatform: 'tiktok' }), false);
  assert.equal(compile('post')({ ...records.post, qualityScore: 1.01 }), false);
  assert.equal(compile('suggested-question')({ ...records['suggested-question'], type: 'quiz' }), false);
  assert.equal(compile('user-question')({ ...records['user-question'], source: 'user' }), false);
  assert.equal(compile('recommendation')({ ...records.recommendation, score: -0.01 }), false);
  assert.equal(compile('user-concept-state')({ ...records['user-concept-state'], familiarityEstimate: 2 }), false);
});

const fixture = JSON.parse(readFileSync(new URL('../../../app/tests/fixtures/content-pool/minimal-valid-pool.json', import.meta.url)));
const mutate = (change) => { const copy = structuredClone(fixture); change(copy); return copy; };

test('content pool schema and cross-record contract accept the shared article/video fixture', () => {
  assert.deepEqual(validateFrozenPoolBundle(fixture), { valid: true, errors: [] });
});

for (const [name, bundle, path] of [
  ['dangling concept', mutate((x) => { x.posts[0].conceptIds = ['missing']; }), '/posts/0/conceptIds'],
  ['duplicate feed id', mutate((x) => { x.manifest.feedOrderPostIds = ['post-article', 'post-article']; }), '/manifest/feedOrderPostIds'],
  ['non-frozen post', mutate((x) => { x.posts[0].status = 'approved'; }), '/posts/0/status'],
  ['artifact-provided traversal path', mutate((x) => { x.sourceAssets[0].path = '../outside'; }), '/sourceAssets/0'],
  ['artifact-provided absolute path', mutate((x) => { x.sourceAssets[0].path = 'C:\\secrets'; }), '/sourceAssets/0'],
  ['manifest count mismatch', mutate((x) => { x.manifest.counts.posts = 99; }), '/manifest/counts/posts'],
  ['schema extra', mutate((x) => { x.posts[0].html = '<script>run()</script>'; }), '/posts/0'],
]) {
  test(`frozen bundle rejects ${name} with a stable path`, () => {
    const result = validateFrozenPoolBundle(bundle);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.path === path), JSON.stringify(result.errors));
  });
}

test('manifest hash consistency hook rejects mismatched computed hashes', () => {
  const result = validateFrozenPoolBundle(fixture, { 'posts.json': '0'.repeat(64) });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].path, '/manifest/artifactHashes/posts.json');
});

test('frozen pool manifest requires exactly the nine runtime artifact hash keys', () => {
  const missing = mutate((bundle) => { delete bundle.manifest.artifactHashes['global_edges.json']; });
  const missingResult = validateFrozenPoolBundle(missing);
  assert.equal(missingResult.valid, false);
  assert.ok(missingResult.errors.some((error) => error.path === '/manifest/artifactHashes/global_edges.json'), JSON.stringify(missingResult.errors));

  const extra = mutate((bundle) => { bundle.manifest.artifactHashes['retired-helper.json'] = '0'.repeat(64); });
  const extraResult = validateFrozenPoolBundle(extra);
  assert.equal(extraResult.valid, false);
  assert.ok(extraResult.errors.some((error) => error.path === '/manifest/artifactHashes'), JSON.stringify(extraResult.errors));
});

test('validation dependencies are pinned and have no install scripts or binary downloads', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
  assert.equal(pkg.dependencies.ajv, '8.20.0');
  assert.equal(pkg.dependencies['ajv-formats'], '3.0.1');
  for (const entry of Object.values(lock.packages)) assert.equal(entry.hasInstallScript, undefined);
});
