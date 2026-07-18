import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { buildFrozenPool } from '../src/freeze/build.ts';
import { verifyFrozenPool } from '../src/freeze/verify.ts';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;

async function approvedRun() {
  const runDir = await mkdtemp(join(tmpdir(), 'questiontrace-graph-run-'));
  for (const dir of ['normalized', 'preprocessed', 'codex-review', 'review']) await mkdir(join(runDir, dir));
  const fullText = 'Complete approved source text for the graph fixture.';
  const contentHash = sha(fullText);
  const normalized = {
    id: 'post-graph', kind: 'article', canonicalUrl: 'https://example.com/graph', sourceName: 'Graph Source',
    author: 'Author', title: 'Graph title', publicationDate: '2026-01-02', language: 'en', fullText, contentHash,
    blocks: [{ id: 'block-1', kind: 'paragraph', text: fullText }], collectedAt: '2026-01-03T00:00:00.000Z',
    collectorVersion: 'collector-1', rawMetadata: {},
  };
  const draft = {
    displayTitle: 'Graph display title', hook: 'Graph hook', shortSummary: 'Graph short summary', longSummary: 'Graph long summary',
    difficulty: 0.4, qualityScore: 0.8, interestingnessScore: 0.7, educationalValueScore: 0.9, viewpoint: 'mixed', topicRelevance: 0.95,
    concepts: [{ label: 'AI agents', description: 'Systems that pursue goals.', aliases: ['agents'], relatedConceptLabels: [], prerequisiteConceptLabels: [] }],
    claims: [{ text: 'Agents may change work.', stance: 'pro', conceptLabels: ['AI agents'], sourceBlockIds: ['block-1'] }],
    suggestedQuestions: [{ text: 'What evidence supports this?', type: 'evidence', targetConceptLabels: ['AI agents'], targetClaimIndexes: [0], generic: false }],
    potentialCounterpoints: [], reliabilityConcerns: [], safetyConcerns: [], contentWarnings: [], rejectRecommended: false, rejectionReasons: [],
  };
  const preprocess = {
    status: 'preprocessed', candidateId: normalized.id, candidateContentHash: contentHash, cacheKey: 'cache-graph', attempts: 1, draft,
    provenance: { provider: 'fixture', model: 'model', promptVersion: 'prompt-1', schemaVersion: 'schema-1' },
    providerRequestId: 'request-1', stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
  };
  const codex = {
    status: 'advisory-ready', advisory: { verdict: 'advance_to_human', reasonCodes: [], fidelityNotes: 'faithful', reliabilityNotes: 'reviewed', candidateContentHash: contentHash, preprocessingVersion: 'fixture:model:prompt-1:schema-1' },
    canAdvanceToHuman: true, requiresHumanApproval: true,
  };
  const decision = {
    disposition: 'approved', notes: 'approved', editedContentHash: contentHash, candidateId: normalized.id,
    decidedAt: '2026-07-11T12:00:00.000Z', sequence: 1, codexVerdictHash: contentHash, operatorIsGateOfRecord: true,
  };
  await writeFile(join(runDir, 'normalized', '0001.json'), JSON.stringify(normalized));
  await writeFile(join(runDir, 'preprocessed', 'cache-graph.json'), JSON.stringify(preprocess));
  await writeFile(join(runDir, 'codex-review', 'cache-graph.json'), JSON.stringify(codex));
  await writeFile(join(runDir, 'review', 'decisions.jsonl'), `${JSON.stringify(decision)}\n`);
  return runDir;
}

async function frozenFixture() {
  const root = await mkdtemp(join(tmpdir(), 'questiontrace-graph-pool-'));
  const output = join(root, 'pool');
  await buildFrozenPool({ runDir: await approvedRun(), output, version: 'graph-v1' });
  return output;
}

async function rewriteHashedArtifact(root, filename, mutate) {
  const path = join(root, filename);
  const value = JSON.parse(await readFile(path, 'utf8'));
  mutate(value);
  const text = jsonText(value);
  await writeFile(path, text);
  const manifestPath = join(root, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.bundleFileHashes[filename] = sha(text);
  await writeFile(manifestPath, jsonText(manifest));
}

test('freeze graph artifacts replace untyped helpers and enter the immutable hash contract', async () => {
  const output = await frozenFixture();
  const names = await readdir(output);
  const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));

  for (const filename of ['sources.json', 'global_edges.json', 'ranking_features.json']) {
    assert.ok(names.includes(filename));
    assert.ok(manifest.fixedFilenames.includes(filename));
    assert.match(manifest.bundleFileHashes[filename], /^[a-f0-9]{64}$/);
  }
  assert.equal(names.includes('post_concept_edges.json'), false);
  assert.equal(names.includes('post_claim_edges.json'), false);
  const ranking = JSON.parse(await readFile(join(output, 'ranking_features.json'), 'utf8'));
  assert.equal(ranking.embeddingFingerprint, null);
  assert.ok(ranking.posts.every((post) => !('summaryVector' in post)));
  assert.deepEqual(await verifyFrozenPool(output), { valid: true, errors: [] });
});

test('freeze graph verification rejects dangling, illegal-kind, and cross-topic edges distinctly', async () => {
  const cases = [
    ['dangling', (edges) => { const record = edges.find(({ type }) => type === 'explains'); record.targetId = 'missing-concept'; record.id = `${record.type}:${record.sourceId}:${record.targetId}`; }, /dangling target endpoint/],
    ['illegal-kind', (edges) => { const record = edges.find(({ type }) => type === 'explains'); record.targetId = 'claim-post-graph-01'; record.id = `${record.type}:${record.sourceId}:${record.targetId}`; }, /illegal endpoint kind for explains: post->claim/],
    ['cross-topic', (edges) => { const record = edges.find(({ type }) => type === 'explains'); record.topicId = 'other-topic'; }, /cross-topic edge/],
  ];
  for (const [label, mutate, pattern] of cases) {
    const output = await frozenFixture();
    await rewriteHashedArtifact(output, 'global_edges.json', mutate);
    const result = await verifyFrozenPool(output);
    assert.equal(result.valid, false, label);
    assert.ok(result.errors.some((error) => pattern.test(error)), `${label}: ${result.errors.join('; ')}`);
  }
});

test('freeze graph verification rejects partial embedding population', async () => {
  const output = await frozenFixture();
  await rewriteHashedArtifact(output, 'ranking_features.json', (ranking) => { ranking.posts[0].summaryVector = [1, 2]; });
  const result = await verifyFrozenPool(output);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /fingerprint is null|summaryVector/i.test(error)));
});
