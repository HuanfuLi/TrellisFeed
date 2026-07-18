import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validatePackageReferences } from '../../scripts/content-pool-package-validation.mjs';

const poolUrl = new URL('../../../data/content_pool_v1/', import.meta.url);
const read = (name) => JSON.parse(readFileSync(new URL(name, poolUrl), 'utf8'));
const baseManifest = read('manifest.json');
const baseCollections = {
  topics: read('topics.json'),
  posts: read('posts.json'),
  concepts: read('concepts.json'),
  claims: read('claims.json'),
  suggestedQuestions: read('suggested_questions.json'),
  sourceAssets: read('source_assets.json'),
};
const clone = (value) => structuredClone(value);

test('package reference validator accepts the frozen pool', () => {
  assert.doesNotThrow(() => validatePackageReferences(baseManifest, baseCollections));
});

for (const [name, mutate] of [
  ['duplicate post ID', (m, c) => { c.posts[1].id = c.posts[0].id; }],
  ['missing source asset', (m, c) => { c.sourceAssets.pop(); }],
  ['duplicate source asset', (m, c) => { c.sourceAssets[1].postId = c.sourceAssets[0].postId; }],
  ['mismatched source URL', (m, c) => { c.sourceAssets[0].sourceUrl = 'https://example.com/wrong'; }],
  ['cross-topic concept reference', (m, c) => {
    c.topics.push({ ...c.topics[0], id: 'topic-other', coreConceptIds: [] });
    c.concepts[0].topicId = 'topic-other';
  }],
  ['duplicate feed-order ID', (m) => { m.feedOrderPostIds[1] = m.feedOrderPostIds[0]; }],
]) {
  test(`package reference validator rejects ${name} before output`, () => {
    const manifest = clone(baseManifest);
    const collections = clone(baseCollections);
    mutate(manifest, collections);
    assert.throws(() => validatePackageReferences(manifest, collections));
  });
}
