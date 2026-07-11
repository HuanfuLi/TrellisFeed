import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

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
