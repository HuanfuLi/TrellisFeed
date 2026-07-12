import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';

import { dispatchCli } from '../src/cli.ts';
import { atomicPromotePool, buildFrozenPool } from '../src/freeze/build.ts';
import { verifyFrozenPool } from '../src/freeze/verify.ts';

const sha = (value) => createHash('sha256').update(value).digest('hex');

async function approvedRun(overrides = {}) {
  const runDir = await mkdtemp(join(tmpdir(), 'questiontrace-freeze-run-'));
  for (const dir of ['normalized', 'preprocessed', 'codex-review', 'review']) await mkdir(join(runDir, dir));
  const fullText = overrides.fullText || 'Complete approved source text for the research instrument.';
  const contentHash = sha(fullText);
  const id = overrides.id || 'post-1';
  const normalized = { id, kind: overrides.kind || 'article', canonicalUrl: 'https://example.com/source', sourceName: 'Example Source', author: 'Author', title: 'Original title', publicationDate: '2026-01-02', language: 'en', fullText, contentHash, blocks: [{ id: 'b-1', kind: 'paragraph', text: fullText }], collectedAt: '2026-01-03T00:00:00.000Z', collectorVersion: 'collector-1', rawMetadata: {} };
  const draft = { displayTitle: 'Display title', hook: 'Accurate hook', shortSummary: 'Short summary', longSummary: 'Long summary', difficulty: 0.4, qualityScore: 0.8, interestingnessScore: 0.7, educationalValueScore: 0.9, viewpoint: 'mixed', topicRelevance: 0.95, concepts: [{ label: 'AI agents', description: 'Systems that pursue goals.', aliases: ['agents'], relatedConceptLabels: [], prerequisiteConceptLabels: [] }], claims: [{ text: 'Agents may change how work is organized.', stance: 'neutral', conceptLabels: ['AI agents'], sourceBlockIds: ['b-1'] }], suggestedQuestions: [{ text: 'What evidence supports this claim?', type: 'evidence', targetConceptLabels: ['AI agents'], targetClaimIndexes: [0], generic: false }], potentialCounterpoints: [], reliabilityConcerns: [], safetyConcerns: [], contentWarnings: [], rejectRecommended: false, rejectionReasons: [] };
  const preprocess = { status: 'preprocessed', candidateId: id, candidateContentHash: contentHash, cacheKey: 'cache-1', attempts: 1, draft, provenance: { provider: 'fixture', model: 'top-model', promptVersion: 'prompt-1', schemaVersion: 'schema-1' }, providerRequestId: 'req-1', stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } };
  const codex = overrides.missingCodex ? { status: 'blocked', reasonCode: 'missing_verdict', canAdvanceToHuman: false, requiresHumanApproval: true } : { status: 'advisory-ready', advisory: { verdict: 'advance_to_human', reasonCodes: [], fidelityNotes: 'faithful', reliabilityNotes: 'reviewed', candidateContentHash: contentHash, preprocessingVersion: 'fixture:top-model:prompt-1:schema-1' }, canAdvanceToHuman: true, requiresHumanApproval: true };
  const decision = { disposition: 'approved', reviewer: 'operator', notes: 'approved after source review', rubricVersion: 'rsd-8.7-v1', editedContentHash: overrides.staleHash || contentHash, rightsReview: { status: overrides.rights || 'cleared', reviewer: 'rights-reviewer', basis: 'documented permission', notes: 'recorded' }, scores: { quality: 0.8, interestingness: 0.7, educationalValue: 0.9, difficulty: 0.4 }, finalTopicTags: ['ai-agents'], review: { sourceQuality: 'pass', factualReliability: 'pass', contentRelevance: 'pass', hookAccuracy: 'pass', summaryFaithfulness: 'pass', suggestedQuestionUsefulness: 'pass', participantAppropriateness: 'pass', duplicateRisk: 'pass', biasRisk: 'pass', misinformationRisk: 'pass', contentWarnings: 'pass' }, candidateId: id, decidedAt: '2026-07-11T12:00:00.000Z', sequence: 1, codexVerdictHash: contentHash, operatorIsGateOfRecord: true };
  await writeFile(join(runDir, 'normalized', '0001.json'), JSON.stringify(normalized));
  await writeFile(join(runDir, 'preprocessed', 'cache-1.json'), JSON.stringify(preprocess));
  await writeFile(join(runDir, 'codex-review', 'cache-1.json'), JSON.stringify(codex));
  if (!overrides.missingDecision) await writeFile(join(runDir, 'review', 'decisions.jsonl'), `${JSON.stringify(decision)}\n`);
  return runDir;
}

async function outputPath(prefix = 'pool') { const root = await mkdtemp(join(tmpdir(), 'questiontrace-freeze-out-')); return join(root, prefix); }
async function snapshot(root) {
  const files = [];
  async function walk(dir) { for (const entry of await readdir(dir, { withFileTypes: true })) { const path = join(dir, entry.name); if (entry.isDirectory()) await walk(path); else files.push([path.slice(root.length + 1).replaceAll('\\', '/'), await readFile(path, 'utf8')]); } }
  await walk(root); return files.sort(([a], [b]) => a.localeCompare(b));
}

test('CLI routes freeze and verify-only arguments and propagates handler failure', async () => {
  let seen;
  await dispatchCli(['freeze', '--run-dir', 'run', '--output', 'pool', '--version', 'v1'], { freeze: async (options) => { seen = options; return { ok: true }; } });
  assert.deepEqual(seen, { command: 'freeze', runDir: 'run', output: 'pool', version: 'v1', verifyOnly: false });
  await assert.rejects(dispatchCli(['freeze', '--output', 'pool', '--verify-only'], { freeze: async () => { throw new Error('verification failed'); } }), /verification failed/);
});

test('approved current two-gate input freezes deterministically and verifies', async () => {
  const runDir = await approvedRun(); const first = await outputPath('pool-a'); const second = await outputPath('pool-b');
  await buildFrozenPool({ runDir, output: first, version: 'v1' });
  await buildFrozenPool({ runDir, output: second, version: 'v1' });
  assert.deepEqual(await snapshot(first), await snapshot(second));
  const result = await verifyFrozenPool(first);
  assert.equal(result.valid, true);
  const manifest = JSON.parse(await readFile(join(first, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.feedOrderPostIds, ['post-1']);
  assert.equal(manifest.approvedCount, 1);
  assert.equal((await readdir(join(first, 'source_files'))).length, 1);
});

test('freeze blocks missing/stale operator approval, Codex gate, rights review, and secrets', async () => {
  for (const [name, run, pattern] of [
    ['missing approval', await approvedRun({ missingDecision: true }), /operator approval/i],
    ['stale approval', await approvedRun({ staleHash: '0'.repeat(64) }), /stale/i],
    ['missing Codex', await approvedRun({ missingCodex: true }), /Codex/i],
    ['rights', await approvedRun({ rights: 'missing' }), /rights/i],
    ['secret', await approvedRun({ fullText: 'OPENAI_API_KEY=sk-example-secret-material' }), /secret/i],
  ]) await assert.rejects(buildFrozenPool({ runDir: run, output: await outputPath(name), version: 'v1' }), pattern, name);
});

test('freeze rejects traversal IDs and existing destinations without mutation', async () => {
  const runDir = await approvedRun({ id: '../escape' });
  await assert.rejects(buildFrozenPool({ runDir, output: await outputPath(), version: 'v1' }), /candidate id|path/i);
  const validRun = await approvedRun(); const output = await outputPath(); await mkdir(output); await writeFile(join(output, 'keep.txt'), 'keep');
  await assert.rejects(buildFrozenPool({ runDir: validRun, output, version: 'v1' }), /already exists/i);
  assert.equal(await readFile(join(output, 'keep.txt'), 'utf8'), 'keep');
});

test('verification detects tampering, dangling source ownership, and checksum changes', async () => {
  const output = await outputPath(); await buildFrozenPool({ runDir: await approvedRun(), output, version: 'v1' });
  const postsPath = join(output, 'posts.json'); const posts = JSON.parse(await readFile(postsPath, 'utf8')); posts[0].hook = 'tampered'; await writeFile(postsPath, JSON.stringify(posts));
  const result = await verifyFrozenPool(output);
  assert.equal(result.valid, false); assert.ok(result.errors.some((error) => /hash|checksum/i.test(error)));
});

test('failed staging is cleaned and atomic promotion refuses overwrite', async () => {
  const output = await outputPath('pool'); const parent = dirname(output);
  await assert.rejects(buildFrozenPool({ runDir: await approvedRun({ fullText: 'OPENAI_API_KEY=sk-no-freeze' }), output, version: 'v1' }));
  assert.ok(!(await readdir(parent)).some((name) => name.startsWith(`.${basename(output)}.staging-`)));
  const source = await outputPath('staged'); await mkdir(source); await writeFile(join(source, 'value'), 'new'); await mkdir(output); await writeFile(join(output, 'value'), 'old');
  await assert.rejects(atomicPromotePool(source, output), /already exists/i);
  assert.equal(await readFile(join(output, 'value'), 'utf8'), 'old');
});
