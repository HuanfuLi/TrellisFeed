import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function candidateRecords(index) {
  const ordinal = String(index).padStart(2, '0');
  const candidateId = `fixture-post-${ordinal}`;
  const content = [
    `Offline source ${ordinal} examines a distinct part of reliable agent workflows.`,
    'It contains inert local evidence for recommendation integration testing only.',
  ].join(' ');
  const contentHash = sha256(content);
  const conceptLabel = `Workflow concept ${ordinal}`;
  const cacheKey = `fixture-cache-${ordinal}`;
  const viewpoint = ['supportive', 'critical', 'neutral', 'mixed'][(index - 1) % 4];
  const source = {
    id: candidateId,
    kind: 'article',
    canonicalUrl: `https://example.test/research/${ordinal}`,
    sourceName: `Offline Source ${ordinal}`,
    author: `Fixture Author ${ordinal}`,
    title: `Original fixture article ${ordinal}`,
    publicationDate: `2026-01-${ordinal}`,
    language: 'en',
    fullText: content,
    contentHash,
    blocks: [{ id: `${candidateId}-block-1`, kind: 'paragraph', text: content }],
    collectedAt: `2026-02-${ordinal}T00:00:00.000Z`,
    collectorVersion: 'offline-fixture-1',
    rawMetadata: {},
  };
  const draft = {
    displayTitle: `Reliable workflow evidence ${ordinal}`,
    hook: `Inspect workflow signal ${ordinal}.`,
    shortSummary: `A local summary of workflow concept ${ordinal}.`,
    longSummary: `This approved offline fixture explains workflow concept ${ordinal} without any network dependency.`,
    difficulty: 0.25 + ((index % 5) * 0.1),
    qualityScore: 0.7 + ((index % 4) * 0.05),
    interestingnessScore: 0.72 + ((index % 3) * 0.06),
    educationalValueScore: 0.74 + ((index % 4) * 0.05),
    viewpoint,
    topicRelevance: 0.95,
    concepts: [{
      label: conceptLabel,
      description: `A deterministic fixture concept for post ${ordinal}.`,
      aliases: [`workflow ${ordinal}`],
      relatedConceptLabels: [],
      prerequisiteConceptLabels: [],
    }],
    claims: [{
      text: `Workflow evidence ${ordinal} supports a distinct reliability practice.`,
      stance: index % 2 === 0 ? 'con' : 'pro',
      conceptLabels: [conceptLabel],
      sourceBlockIds: [`${candidateId}-block-1`],
    }],
    suggestedQuestions: [{
      text: `What evidence supports workflow practice ${ordinal}?`,
      type: 'evidence',
      targetConceptLabels: [conceptLabel],
      targetClaimIndexes: [0],
      generic: false,
    }],
    potentialCounterpoints: [],
    reliabilityConcerns: [],
    safetyConcerns: [],
    contentWarnings: [],
    rejectRecommended: false,
    rejectionReasons: [],
  };
  const preprocess = {
    status: 'preprocessed',
    candidateId,
    candidateContentHash: contentHash,
    cacheKey,
    attempts: 1,
    draft,
    provenance: {
      provider: 'fixture',
      model: 'offline-model',
      promptVersion: 'offline-prompt-1',
      schemaVersion: 'offline-schema-1',
    },
    providerRequestId: `offline-request-${ordinal}`,
    stopReason: 'end_turn',
    usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
  };
  const codex = {
    status: 'advisory-ready',
    advisory: {
      verdict: 'advance_to_human',
      reasonCodes: [],
      fidelityNotes: 'Offline fixture matches its inert source.',
      reliabilityNotes: 'Deterministic local test evidence.',
      candidateContentHash: contentHash,
      preprocessingVersion: 'fixture:offline-model:offline-prompt-1:offline-schema-1',
    },
    canAdvanceToHuman: true,
    requiresHumanApproval: true,
  };
  const decision = {
    disposition: 'approved',
    notes: 'Approved synthetic offline integration fixture.',
    editedContentHash: contentHash,
    candidateId,
    decidedAt: `2026-07-19T00:${ordinal}:00.000Z`,
    sequence: index,
    codexVerdictHash: contentHash,
    operatorIsGateOfRecord: true,
  };
  return { candidateId, cacheKey, source, preprocess, codex, decision };
}

export async function createFreshGraphPoolFixture() {
  const root = await mkdtemp(join(tmpdir(), 'questiontrace-fresh-graph-cutover-'));
  const runDir = join(root, 'run');
  for (const directory of ['normalized', 'preprocessed', 'codex-review', 'review']) {
    await mkdir(join(runDir, directory), { recursive: true });
  }

  const decisions = [];
  for (let index = 1; index <= 12; index += 1) {
    const record = candidateRecords(index);
    await writeFile(
      join(runDir, 'normalized', `${record.candidateId}.json`),
      JSON.stringify(record.source),
    );
    await writeFile(
      join(runDir, 'preprocessed', `${record.cacheKey}.json`),
      JSON.stringify(record.preprocess),
    );
    await writeFile(
      join(runDir, 'codex-review', `${record.cacheKey}.json`),
      JSON.stringify(record.codex),
    );
    decisions.push(JSON.stringify(record.decision));
  }
  await writeFile(join(runDir, 'review', 'decisions.jsonl'), `${decisions.join('\n')}\n`);
  return { root, runDir };
}
