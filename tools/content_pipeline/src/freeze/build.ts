import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { compileGlobalGraph, type ConceptRelationInput, type EmbeddingBuildConfig } from '../graph/build.ts';
import { validateFrozenPoolBundle } from '../schema/validate.ts';
import { loadReviewQueue, type ReviewCandidate, type ReviewDecision } from '../review/store.ts';
import { RUNTIME_ARTIFACT_FILENAMES } from './runtime-artifacts.ts';
import { verifyFrozenPool } from './verify.ts';

export type FreezeInput = { runDir: string; output: string; version: string; embedding?: EmbeddingBuildConfig };
export type FreezeAudit = { candidateId: string; contentHash: string; codexVerdictHash: string; operatorDecisionSequence: number; frozenPostSha256: string };

const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const jsonText = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

async function readRawCandidateCount(runDir: string, fallback: number): Promise<number> {
  try { const report = JSON.parse(await readFile(join(runDir, 'collection-report.json'), 'utf8')); return Number.isInteger(report.candidateCount) && report.candidateCount >= fallback ? report.candidateCount : fallback; }
  catch { return fallback; }
}

async function filesBelow(root: string, relativeRoot = ''): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(join(root, relativeRoot), { withFileTypes: true })) {
    const rel = relativeRoot ? `${relativeRoot}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...await filesBelow(root, rel)); else output.push(rel);
  }
  return output.sort();
}

function safeSegment(value: string, label: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) || value.includes('..') || value.includes('/') || value.includes('\\') || isAbsolute(value)) throw new Error(`${label} contains an unsafe path or candidate id`);
  return value;
}

function ensureInside(root: string, child: string): string {
  const output = resolve(root, child); const rel = relative(resolve(root), output);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('derived path escapes frozen pool root');
  return output;
}

function approvalFor(candidate: ReviewCandidate): ReviewDecision {
  const decision = candidate.latestDecision;
  if (!decision || decision.disposition !== 'approved' || decision.operatorIsGateOfRecord !== true) throw new Error(`explicit operator approval is missing for ${candidate.id}`);
  if (decision.editedContentHash !== candidate.contentHash) throw new Error(`operator approval is stale for ${candidate.id}`);
  if (!candidate.codexCurrent || candidate.codex.status !== 'advisory-ready') throw new Error(`current advancing Codex verdict is missing for ${candidate.id}`);
  if (decision.codexVerdictHash !== candidate.contentHash) throw new Error(`operator approval has a stale Codex verdict for ${candidate.id}`);
  return decision;
}

function assertNoSecrets(candidates: ReviewCandidate[]): void {
  const patterns = [/\b(?:OPENAI|ANTHROPIC|GEMINI)_API_KEY\s*=/i, /\bsk-[A-Za-z0-9_-]{12,}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
  for (const candidate of candidates) {
    const material = `${candidate.source.fullText}\n${JSON.stringify(candidate.draft)}`;
    if (patterns.some((pattern) => pattern.test(material))) throw new Error(`secret-like material detected in ${candidate.id}`);
  }
}

function sourcePlatform(candidate: ReviewCandidate): 'youtube' | 'x' | 'reddit' | 'article' {
  if (candidate.source.kind === 'video') return 'youtube';
  const declared = candidate.source.rawMetadata?.platform;
  if (declared === 'x' || declared === 'reddit') return declared;
  const hostname = new URL(candidate.source.canonicalUrl).hostname.toLowerCase();
  if (['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(hostname)) return 'x';
  if (['reddit.com', 'www.reddit.com'].includes(hostname)) return 'reddit';
  return 'article';
}

function project(candidates: ReviewCandidate[], version: string) {
  const topicId = 'ai-agents-future-work';
  const conceptsByLabel = new Map<string, any>();
  for (const candidate of candidates) for (const concept of candidate.draft.concepts) {
    const key = concept.label.normalize('NFKC').trim().toLocaleLowerCase('en-US');
    if (!conceptsByLabel.has(key)) conceptsByLabel.set(key, { id: `concept-${sha256(key).slice(0, 20)}`, topicId, label: concept.label, description: concept.description, aliases: [...concept.aliases].sort(), parentConceptIds: [], prerequisiteConceptIds: [] });
  }
  const conceptId = (label: string): string => {
    const result = conceptsByLabel.get(label.normalize('NFKC').trim().toLocaleLowerCase('en-US'));
    if (!result) throw new Error(`unknown concept label ${label}`); return result.id;
  };
  const concepts = [...conceptsByLabel.values()].sort((a, b) => a.id.localeCompare(b.id));
  const relationLabels = new Map<string, { related: Set<string>; prerequisite: Set<string> }>();
  for (const candidate of candidates) for (const concept of candidate.draft.concepts) {
    const id = conceptId(concept.label);
    const collected = relationLabels.get(id) ?? { related: new Set<string>(), prerequisite: new Set<string>() };
    for (const label of concept.relatedConceptLabels) collected.related.add(label);
    for (const label of concept.prerequisiteConceptLabels) collected.prerequisite.add(label);
    relationLabels.set(id, collected);
  }
  const conceptRelations: ConceptRelationInput[] = [...relationLabels].sort(([left], [right]) => left.localeCompare(right)).map(([id, labels]) => ({
    conceptId: id,
    relatedConceptLabels: [...labels.related].sort(),
    prerequisiteConceptLabels: [...labels.prerequisite].sort(),
  }));
  const posts: any[] = []; const claims: any[] = []; const suggestedQuestions: any[] = []; const sourceAssets: any[] = [];
  for (const candidate of candidates.sort((a, b) => a.id.localeCompare(b.id))) {
    const postId = safeSegment(candidate.id, 'candidate id'); const decision = approvalFor(candidate);
    const postClaims = candidate.draft.claims.map((claim: any, index: number) => ({ id: `claim-${postId}-${String(index + 1).padStart(2, '0')}`, topicId, text: claim.text, stance: claim.stance, conceptIds: claim.conceptLabels.map(conceptId) }));
    const postQuestions = candidate.draft.suggestedQuestions.map((question: any, index: number) => ({ id: `question-${postId}-${String(index + 1).padStart(2, '0')}`, postId, topicId, text: question.text, type: question.type, targetConceptIds: question.targetConceptLabels.map(conceptId), targetClaimIds: question.targetClaimIndexes.map((target: number) => postClaims[target]?.id).filter(Boolean), generic: question.generic }));
    claims.push(...postClaims); suggestedQuestions.push(...postQuestions);
    const postConceptIds = [...new Set(candidate.draft.concepts.map((concept: any) => conceptId(concept.label)))].sort();
    const platform = sourcePlatform(candidate);
    posts.push({
      id: postId, topicId, sourceUrl: candidate.source.canonicalUrl, sourcePlatform: platform,
      sourceName: candidate.source.sourceName || new URL(candidate.source.canonicalUrl).hostname,
      ...(candidate.source.author ? { author: candidate.source.author } : {}), originalTitle: candidate.source.title,
      displayTitle: candidate.draft.displayTitle, hook: candidate.draft.hook, shortSummary: candidate.draft.shortSummary,
      longSummary: candidate.draft.longSummary, language: candidate.source.language || 'en',
      ...(candidate.source.durationSeconds !== undefined ? { durationSeconds: candidate.source.durationSeconds } : { readingTimeMinutes: Math.max(1, Math.ceil(candidate.source.fullText.split(/\s+/).length / 220)) }),
      ...(candidate.source.publicationDate ? { originalPublishedAt: new Date(`${candidate.source.publicationDate}T00:00:00.000Z`).toISOString() } : {}),
      collectedAt: candidate.source.collectedAt, approvedAt: decision.decidedAt,
      qualityScore: candidate.draft.qualityScore, interestingnessScore: candidate.draft.interestingnessScore,
      educationalValueScore: candidate.draft.educationalValueScore, difficulty: candidate.draft.difficulty,
      viewpoint: candidate.draft.viewpoint, conceptIds: postConceptIds, claimIds: postClaims.map((claim: any) => claim.id),
      suggestedQuestionIds: postQuestions.map((question: any) => question.id), status: 'frozen',
    });
    const videoDigest = candidate.source.kind === 'video' ? [
      candidate.draft.longSummary,
      'Central claims:', ...candidate.draft.claims.map((claim: any) => `- ${claim.text}`),
      'Concepts:', ...candidate.draft.concepts.map((concept: any) => `- ${concept.label}: ${concept.description}`),
      ...(candidate.draft.potentialCounterpoints.length ? ['Counterpoints:', ...candidate.draft.potentialCounterpoints.map((item: string) => `- ${item}`)] : []),
      ...(candidate.draft.reliabilityConcerns.length ? ['Reliability notes:', ...candidate.draft.reliabilityConcerns.map((item: string) => `- ${item}`)] : []),
    ].join('\n') : undefined;
    const assetText = candidate.source.kind === 'video' ? videoDigest! : candidate.source.fullText;
    sourceAssets.push({
      postId, kind: candidate.source.kind, sourceUrl: candidate.source.canonicalUrl,
      ...(candidate.source.kind === 'video' ? { videoId: candidate.source.videoId, digest: videoDigest } : { body: candidate.source.fullText }),
      sha256: sha256(assetText),
    });
  }
  const topics = [{ id: topicId, name: 'AI agents & future work', shortDescription: 'How AI agents may reshape work, organizations, and human roles.', hooks: posts.map((post) => post.hook).slice(0, 50), coreConceptIds: concepts.map((concept) => concept.id), testRubricId: 'ai-agents-future-work-v1', contentPoolVersion: version }];
  return { topics, posts, concepts, conceptRelations, claims, suggestedQuestions, sourceAssets };
}

export async function atomicPromotePool(staging: string, destination: string): Promise<void> {
  try { await access(destination); throw new Error(`frozen pool destination already exists: ${destination}`); }
  catch (error) { if (error instanceof Error && !('code' in error && error.code === 'ENOENT')) throw error; }
  await rename(staging, destination);
}

export async function buildFrozenPool(input: FreezeInput) {
  safeSegment(input.version, 'version');
  const destination = resolve(input.output); const parent = dirname(destination);
  await mkdir(parent, { recursive: true });
  try { await access(destination); throw new Error(`frozen pool destination already exists: ${destination}`); }
  catch (error) { if (error instanceof Error && !('code' in error && error.code === 'ENOENT')) throw error; }
  const staging = resolve(parent, `.${basename(destination)}.staging-${process.pid}-${Date.now()}`);
  if (dirname(staging) !== parent || !basename(staging).startsWith(`.${basename(destination)}.staging-`)) throw new Error('unsafe staging path');
  await mkdir(staging, { recursive: false });
  try {
    const queue = await loadReviewQueue(input.runDir);
    if (!queue.length) throw new Error('no review candidates found');
    const candidates = queue.filter((candidate) => candidate.latestDecision?.disposition === 'approved');
    if (!candidates.length) throw new Error('explicit operator approval is missing for every candidate');
    for (const candidate of candidates) approvalFor(candidate);
    assertNoSecrets(candidates);
    const projected = project(candidates, input.version);
    const graph = await compileGlobalGraph({
      posts: projected.posts,
      concepts: projected.concepts,
      conceptRelations: projected.conceptRelations,
      claims: projected.claims,
      suggestedQuestions: projected.suggestedQuestions,
    }, input.embedding);
    const texts: Record<string, string> = {
      'topics.json': jsonText(projected.topics), 'posts.json': jsonText(projected.posts), 'concepts.json': jsonText(projected.concepts),
      'claims.json': jsonText(projected.claims), 'suggested_questions.json': jsonText(projected.suggestedQuestions), 'source_assets.json': jsonText(projected.sourceAssets),
      'sources.json': jsonText(graph.sources), 'global_edges.json': jsonText(graph.globalEdges), 'ranking_features.json': jsonText(graph.rankingFeatures),
    };
    const hashes = Object.fromEntries(RUNTIME_ARTIFACT_FILENAMES.map((filename) => [filename, sha256(texts[filename])]));
    const decisions = candidates.map(approvalFor);
    const rawCandidateCount = await readRawCandidateCount(input.runDir, queue.length);
    const manifest: any = {
      contentPoolVersion: input.version, generatedAt: decisions.map((decision) => decision.decidedAt).sort().at(-1),
      preprocessingModelVersions: [...new Set(candidates.map((candidate) => `${candidate.preprocess.provenance.provider}:${candidate.preprocess.provenance.model}:${candidate.preprocess.provenance.promptVersion}:${candidate.preprocess.provenance.schemaVersion}`))].sort(),
      collectorVersions: [...new Set(candidates.map((candidate) => candidate.source.collectorVersion))].sort(),
      promptVersions: [...new Set(candidates.map((candidate) => candidate.preprocess.provenance.promptVersion))].sort(),
      schemaVersions: [...new Set(candidates.map((candidate) => candidate.preprocess.provenance.schemaVersion))].sort(),
      rawCandidateCount, approvedCount: projected.posts.length, rejectedCount: rawCandidateCount - projected.posts.length,
      sourceFormatDistribution: Object.fromEntries(['article', 'video'].map((kind) => [kind, candidates.filter((candidate) => candidate.source.kind === kind).length])),
      stanceDistribution: Object.fromEntries(['supportive', 'critical', 'neutral', 'mixed'].map((stance) => [stance, projected.posts.filter((post) => post.viewpoint === stance).length])),
      reviewProcedureSummary: 'Codex advisory fidelity/reliability gate followed by an explicit operator decision: approve, needs edit, or reject. Operator decisions are the gate of record.',
      counts: { topics: projected.topics.length, posts: projected.posts.length, concepts: projected.concepts.length, claims: projected.claims.length, suggestedQuestions: projected.suggestedQuestions.length, sourceAssets: projected.sourceAssets.length },
      artifactHashes: hashes, feedOrderPostIds: projected.posts.map((post) => post.id), fixedFilenames: [], bundleFileHashes: {},
    };
    const validation = validateFrozenPoolBundle({
      manifest,
      topics: projected.topics,
      posts: projected.posts,
      concepts: projected.concepts,
      claims: projected.claims,
      suggestedQuestions: projected.suggestedQuestions,
      sourceAssets: projected.sourceAssets,
    });
    if (!validation.valid) throw new Error(`frozen pool projection invalid: ${validation.errors.map((error) => `${error.path} ${error.message}`).join('; ')}`);
    for (const [filename, text] of Object.entries(texts)) await writeFile(ensureInside(staging, filename), text, { flag: 'wx' });
    await mkdir(ensureInside(staging, 'source_files'));
    for (const asset of projected.sourceAssets) await writeFile(ensureInside(staging, `source_files/${safeSegment(asset.postId, 'post id')}.txt`), asset.body ?? asset.digest, { flag: 'wx' });
    await mkdir(ensureInside(staging, 'review_logs'));
    const audits: FreezeAudit[] = candidates.map((candidate, index) => ({ candidateId: candidate.id, contentHash: candidate.contentHash, codexVerdictHash: candidate.codex.status === 'advisory-ready' ? candidate.codex.advisory.candidateContentHash : '', operatorDecisionSequence: approvalFor(candidate).sequence, frozenPostSha256: sha256(jsonText(projected.posts[index])) }));
    await writeFile(ensureInside(staging, 'review_logs/approval-audit.json'), jsonText(audits), { flag: 'wx' });
    const immutableFiles = await filesBelow(staging);
    manifest.fixedFilenames = immutableFiles;
    manifest.bundleFileHashes = Object.fromEntries(await Promise.all(immutableFiles.map(async (filename) => [filename, sha256(await readFile(ensureInside(staging, filename)))])));
    await writeFile(ensureInside(staging, 'manifest.json'), jsonText(manifest), { flag: 'wx' });
    const verification = await verifyFrozenPool(staging);
    if (!verification.valid) throw new Error(`staged frozen pool verification failed: ${verification.errors.join('; ')}`);
    await atomicPromotePool(staging, destination);
    return { output: destination, version: input.version, approvedCount: projected.posts.length, verified: true, graphWarnings: graph.warnings };
  } catch (error) {
    if (dirname(staging) === parent && basename(staging).startsWith(`.${basename(destination)}.staging-`)) await rm(staging, { recursive: true, force: true });
    throw error;
  }
}
