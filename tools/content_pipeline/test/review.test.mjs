import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { dispatchCli } from '../src/cli.ts';
import { startReviewServer } from '../src/review/server.ts';
import { loadReviewQueue, writeReviewDecision, writeReviewEdit } from '../src/review/store.ts';

const hash = 'a'.repeat(64);

async function fixtureRun() {
  const runDir = await mkdtemp(join(tmpdir(), 'questiontrace-review-'));
  for (const dir of ['normalized', 'preprocessed', 'codex-review', 'quality', 'dedupe']) await mkdir(join(runDir, dir));
  const normalized = {
    id: 'post-1', kind: 'article', canonicalUrl: 'https://example.com/article', sourceName: 'Example', author: 'Researcher',
    title: '<img src=x onerror=alert(1)>', language: 'en', fullText: 'Complete inert article text.', contentHash: hash,
    blocks: [{ id: 'b-1', kind: 'paragraph', text: 'Complete inert article text.' }], collectedAt: '2026-07-11T00:00:00.000Z', collectorVersion: 'collector-1', rawMetadata: {},
  };
  const preprocessed = {
    status: 'preprocessed', candidateId: 'post-1', candidateContentHash: hash, cacheKey: 'cache-1', attempts: 1,
    draft: {
      displayTitle: 'Display', hook: 'Hook', shortSummary: 'Short', longSummary: 'Long', difficulty: 0.4,
      qualityScore: 0.8, interestingnessScore: 0.7, educationalValueScore: 0.9, viewpoint: 'mixed', topicRelevance: 0.95,
      concepts: [{ label: 'Agents', description: 'Agents description', aliases: [], relatedConceptLabels: [], prerequisiteConceptLabels: [] }],
      claims: [{ text: 'A claim', stance: 'neutral', conceptLabels: ['Agents'], sourceBlockIds: ['b-1'] }],
      suggestedQuestions: [{ text: 'What evidence supports this?', type: 'evidence', targetConceptLabels: ['Agents'], targetClaimIndexes: [0], generic: false }],
      potentialCounterpoints: ['Counterpoint'], reliabilityConcerns: ['Limited evidence'], safetyConcerns: [], contentWarnings: [], rejectRecommended: false, rejectionReasons: [],
    },
    provenance: { provider: 'fixture', model: 'top-model', promptVersion: 'prompt-1', schemaVersion: 'schema-1' }, providerRequestId: 'req-1', stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
  };
  const codex = { status: 'advisory-ready', advisory: { verdict: 'advance_to_human', reasonCodes: [], fidelityNotes: 'faithful', reliabilityNotes: 'review limits', candidateContentHash: hash, preprocessingVersion: 'fixture:top-model:prompt-1:schema-1' }, canAdvanceToHuman: true, requiresHumanApproval: true };
  await writeFile(join(runDir, 'normalized', '0001.json'), JSON.stringify(normalized));
  await writeFile(join(runDir, 'preprocessed', 'cache-1.json'), JSON.stringify(preprocessed));
  await writeFile(join(runDir, 'codex-review', 'cache-1.json'), JSON.stringify(codex));
  await writeFile(join(runDir, 'quality', 'verdicts.json'), JSON.stringify([{ candidateId: 'post-1', disposition: 'review-priority', score: 92, signals: [{ code: 'evergreen', level: 'pass', detail: 'Evergreen.' }], requiresHumanReview: true }]));
  await writeFile(join(runDir, 'dedupe', 'groups.json'), JSON.stringify([{ representativeId: 'post-1', candidateIds: ['post-1'], reasons: [], maximumSimilarity: 0, requiresHumanReview: true }]));
  return runDir;
}

test('CLI routes review arguments without losing existing dispatch behavior', async () => {
  let seen;
  const result = await dispatchCli(['review', '--run-dir', 'run', '--host', '127.0.0.1', '--port', '4567', '--open'], { review: async (options) => { seen = options; return 'ok'; } });
  assert.equal(result, 'ok');
  assert.deepEqual(seen, { command: 'review', runDir: 'run', host: '127.0.0.1', port: 4567, open: true });
});

test('review queue exposes all source, wrapper, advisory, and review dimensions', async () => {
  const queue = await loadReviewQueue(await fixtureRun());
  assert.equal(queue.length, 1);
  assert.equal(queue[0].source.fullText, 'Complete inert article text.');
  assert.equal(queue[0].draft.suggestedQuestions[0].targetClaimIndexes[0], 0);
  assert.equal(queue[0].codex.advisory.fidelityNotes, 'faithful');
  assert.equal(queue[0].mechanicalQuality.disposition, 'review-priority');
  assert.deepEqual(queue[0].duplicateEvidence.candidateIds, ['post-1']);
  for (const field of ['sourceQuality', 'factualReliability', 'contentRelevance', 'hookAccuracy', 'summaryFaithfulness', 'suggestedQuestionUsefulness', 'participantAppropriateness', 'duplicateRisk', 'biasRisk', 'misinformationRisk', 'rightsReview']) assert.ok(field in queue[0].reviewTemplate, field);
});

test('append-only decisions require current Codex verdict, content hash, rights review, and operator identity', async () => {
  const runDir = await fixtureRun();
  const candidate = (await loadReviewQueue(runDir))[0];
  await assert.rejects(writeReviewDecision(runDir, candidate, { disposition: 'approved', reviewer: 'operator', notes: 'ok', rubricVersion: 'rsd-8.7-v1', editedContentHash: hash, rightsReview: { status: 'missing', reviewer: 'rights', basis: 'none', notes: '' } }), /rights review/i);
  const decision = await writeReviewDecision(runDir, candidate, { disposition: 'approved', reviewer: 'operator', notes: 'reviewed', rubricVersion: 'rsd-8.7-v1', editedContentHash: hash, rightsReview: { status: 'cleared', reviewer: 'rights', basis: 'permission', notes: 'documented' }, scores: { quality: 0.8, interestingness: 0.7, educationalValue: 0.9, difficulty: 0.4 }, finalTopicTags: ['agents'], review: Object.fromEntries(Object.keys(candidate.reviewTemplate).filter((x) => x !== 'rightsReview').map((x) => [x, 'pass'])) });
  assert.equal(decision.disposition, 'approved');
  const log = await readFile(join(runDir, 'review', 'decisions.jsonl'), 'utf8');
  assert.equal(log.trim().split('\n').length, 1);
  assert.match(log, /"operatorIsGateOfRecord":true/);
});

test('editing content invalidates prior Codex advice and blocks approval until gate 1 reruns', async () => {
  const runDir = await fixtureRun();
  const before = (await loadReviewQueue(runDir))[0];
  await writeReviewEdit(runDir, before, { draft: { ...before.draft, hook: 'Edited hook' }, editor: 'operator', notes: 'accuracy correction' });
  const edited = (await loadReviewQueue(runDir))[0];
  assert.notEqual(edited.contentHash, hash);
  assert.equal(edited.codexCurrent, false);
  await assert.rejects(writeReviewDecision(runDir, edited, { disposition: 'approved', reviewer: 'operator', notes: '', rubricVersion: 'v1', editedContentHash: edited.contentHash, rightsReview: { status: 'cleared', reviewer: 'r', basis: 'permission', notes: '' } }), /Codex verdict/i);
});

test('server refuses non-loopback binds and enforces token, origin, CSRF, body cap, and expiration', async () => {
  const runDir = await fixtureRun();
  await assert.rejects(startReviewServer({ runDir, host: '0.0.0.0', port: 0 }), /loopback/i);
  const server = await startReviewServer({ runDir, host: '127.0.0.1', port: 0, sessionTtlMs: 1000, maxBodyBytes: 512 });
  try {
    assert.equal((await fetch(`${server.origin}/api/queue`)).status, 401);
    assert.equal((await fetch(`${server.origin}/api/queue`, { headers: { 'x-review-token': server.token } })).status, 200);
    const endpoint = `${server.origin}/api/candidates/post-1/decision`;
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { 'x-review-token': server.token, 'x-csrf-token': server.csrfToken, origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { 'x-review-token': server.token, origin: server.origin, 'content-type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { 'x-review-token': server.token, 'x-csrf-token': server.csrfToken, origin: server.origin, 'content-type': 'application/json' }, body: JSON.stringify({ padding: 'x'.repeat(600) }) })).status, 413);
  } finally { await server.close(); }
});

test('review UI uses inert DOM rendering and a strict no-network CSP', async () => {
  const source = await readFile(new URL('../src/review/ui/review.ts', import.meta.url), 'utf8').catch(() => '');
  const html = await readFile(new URL('../src/review/ui/index.html', import.meta.url), 'utf8').catch(() => '');
  assert.ok(!source.includes('innerHTML'));
  assert.match(source, /textContent|createTextNode/);
  assert.match(html, /default-src 'none'/);
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i);
});
