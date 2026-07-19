import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { ErrorObject, ValidateFunction } from 'ajv';
import type { GlobalEdgeRecord, RankingFeaturesArtifact, SourceRecord } from '../graph/build.ts';
import { validateFrozenPoolBundle } from '../schema/validate.ts';
import { RUNTIME_ARTIFACT_FILENAMES } from './runtime-artifacts.ts';

const TOP_LEVEL = new Set([...RUNTIME_ARTIFACT_FILENAMES, 'manifest.json', 'source_files', 'review_logs']);
const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');

const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020.js').default;
const addFormats = require('ajv-formats').default;
const artifactAjv = new Ajv2020({ allErrors: true, strict: true });
addFormats(artifactAjv);
const validateGlobalEdge: ValidateFunction = artifactAjv.compile(require('../../schemas/global-edge.schema.json'));
const validateSource: ValidateFunction = artifactAjv.compile(require('../../schemas/source.schema.json'));
const validateRankingFeatures: ValidateFunction = artifactAjv.compile(require('../../schemas/ranking-features.schema.json'));

type NodeKind = 'post' | 'concept' | 'claim' | 'suggested-question';
type NodeRecord = { id: string; topicId: string; kind: NodeKind };
const ENDPOINT_KINDS: Record<GlobalEdgeRecord['type'], { source: NodeKind[]; target: NodeKind[] }> = {
  explains: { source: ['post'], target: ['concept'] },
  mentions: { source: ['post'], target: ['concept'] },
  supports: { source: ['post'], target: ['claim'] },
  challenges: { source: ['post'], target: ['claim'] },
  about: { source: ['claim'], target: ['concept'] },
  contrasts_with: { source: ['claim'], target: ['claim'] },
  related_to: { source: ['concept'], target: ['concept'] },
  prerequisite_of: { source: ['concept'], target: ['concept'] },
  targets: { source: ['suggested-question'], target: ['concept', 'claim'] },
};

const schemaErrors = (label: string, index: number | undefined, errors: ErrorObject[] | null | undefined): string[] => (errors ?? []).map((error) => {
  const path = `${error.instancePath || '/'}${error.keyword === 'required' ? `/${String(error.params.missingProperty)}` : ''}`;
  return `${label}${index === undefined ? '' : `[${index}]`} schema ${path} ${error.message ?? error.keyword}`;
});

function validateGraphArtifacts(bundle: any, sources: SourceRecord[], globalEdges: GlobalEdgeRecord[], ranking: RankingFeaturesArtifact): string[] {
  const errors: string[] = [];
  sources.forEach((source, index) => {
    if (!validateSource(source)) errors.push(...schemaErrors('sources', index, validateSource.errors));
  });
  globalEdges.forEach((record, index) => {
    if (!validateGlobalEdge(record)) errors.push(...schemaErrors('global_edges', index, validateGlobalEdge.errors));
  });
  if (!validateRankingFeatures(ranking)) errors.push(...schemaErrors('ranking_features', undefined, validateRankingFeatures.errors));

  const nodeEntries: NodeRecord[] = [
    ...bundle.posts.map((record: any) => ({ id: record.id, topicId: record.topicId, kind: 'post' as const })),
    ...bundle.concepts.map((record: any) => ({ id: record.id, topicId: record.topicId, kind: 'concept' as const })),
    ...bundle.claims.map((record: any) => ({ id: record.id, topicId: record.topicId, kind: 'claim' as const })),
    ...bundle.suggestedQuestions.map((record: any) => ({ id: record.id, topicId: record.topicId, kind: 'suggested-question' as const })),
  ];
  const nodes = new Map<string, NodeRecord[]>();
  for (const node of nodeEntries) nodes.set(node.id, [...(nodes.get(node.id) ?? []), node]);
  for (const [id, records] of nodes) if (records.length !== 1) errors.push(`global graph node id is ambiguous across kinds: ${id}`);
  const node = (id: string): NodeRecord | undefined => nodes.get(id)?.length === 1 ? nodes.get(id)![0] : undefined;

  const edgeIds = new Set<string>();
  for (const record of globalEdges) {
    if (!record || typeof record !== 'object' || !(record.type in ENDPOINT_KINDS)) continue;
    if (edgeIds.has(record.id)) errors.push(`duplicate global edge id ${record.id}`);
    edgeIds.add(record.id);
    if (record.id !== `${record.type}:${record.sourceId}:${record.targetId}`) errors.push(`global edge id mismatch for ${record.id}`);
    const source = node(record.sourceId);
    const target = node(record.targetId);
    if (!source) errors.push(`dangling source endpoint ${record.sourceId} for ${record.id}`);
    if (!target) errors.push(`dangling target endpoint ${record.targetId} for ${record.id}`);
    if (!source || !target) continue;
    const legal = ENDPOINT_KINDS[record.type];
    if (!legal.source.includes(source.kind) || !legal.target.includes(target.kind)) {
      errors.push(`illegal endpoint kind for ${record.type}: ${source.kind}->${target.kind}`);
    }
    if (source.topicId !== target.topicId || record.topicId !== source.topicId || record.topicId !== target.topicId) {
      errors.push(`cross-topic edge ${record.id}`);
    }
  }

  const sourceById = new Map<string, SourceRecord>();
  for (const source of sources) {
    if (sourceById.has(source.id)) errors.push(`duplicate source id ${source.id}`);
    sourceById.set(source.id, source);
  }
  const postById = new Map(bundle.posts.map((post: any) => [post.id, post]));
  const rankedPostIds = new Set<string>();
  if (ranking && Array.isArray(ranking.posts)) for (const features of ranking.posts) {
    if (rankedPostIds.has(features.postId)) errors.push(`duplicate ranking features for ${features.postId}`);
    rankedPostIds.add(features.postId);
    const post: any = postById.get(features.postId);
    if (!post) { errors.push(`dangling ranking post ${features.postId}`); continue; }
    if (features.topicId !== post.topicId) errors.push(`cross-topic ranking features for ${features.postId}`);
    if (!post.conceptIds.includes(features.primaryConceptId)) errors.push(`primaryConceptId is not owned by post ${features.postId}`);
    const primary = node(features.primaryConceptId);
    if (!primary || primary.kind !== 'concept' || primary.topicId !== post.topicId) errors.push(`dangling primaryConceptId for ${features.postId}`);
    const source = sourceById.get(features.sourceId);
    if (!source) errors.push(`dangling sourceId for ${features.postId}`);
    else if (source.name !== post.sourceName || source.platform !== post.sourcePlatform || source.url !== post.sourceUrl) errors.push(`source metadata mismatch for ${features.postId}`);
  }
  if (rankedPostIds.size !== postById.size || [...postById.keys()].some((id) => !rankedPostIds.has(id as string))) errors.push('ranking features require exactly one row per post');

  const fingerprint = ranking?.embeddingFingerprint;
  if (fingerprint === null) {
    for (const features of ranking.posts ?? []) if ('summaryVector' in features) errors.push(`embedding fingerprint is null but ${features.postId} has summaryVector`);
  } else if (fingerprint && Number.isInteger(fingerprint.dimensions)) {
    for (const features of ranking.posts ?? []) {
      if (!Array.isArray(features.summaryVector) || features.summaryVector.length !== fingerprint.dimensions || features.summaryVector.some((value: unknown) => typeof value !== 'number' || !Number.isFinite(value))) {
        errors.push(`summaryVector dimensions do not match embedding fingerprint for ${features.postId}`);
      }
    }
  }
  return errors;
}

export async function verifyFrozenPool(root: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) if (!TOP_LEVEL.has(entry.name)) errors.push(`unexpected artifact ${entry.name}`);
    for (const name of TOP_LEVEL) if (!entries.some((entry) => entry.name === name)) errors.push(`missing artifact ${name}`);
    for (const entry of entries) if ((await lstat(join(root, entry.name))).isSymbolicLink()) errors.push(`symbolic link forbidden: ${entry.name}`);
    if (errors.length) return { valid: false, errors };
    const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
    const texts = Object.fromEntries(await Promise.all(RUNTIME_ARTIFACT_FILENAMES.map(async (filename) => [filename, await readFile(join(root, filename), 'utf8')])));
    for (const filename of RUNTIME_ARTIFACT_FILENAMES) if (sha256(texts[filename]) !== manifest.artifactHashes?.[filename]) errors.push(`checksum/hash mismatch for ${filename}`);
    const bundle = {
      manifest, topics: JSON.parse(texts['topics.json']), posts: JSON.parse(texts['posts.json']), concepts: JSON.parse(texts['concepts.json']),
      claims: JSON.parse(texts['claims.json']), suggestedQuestions: JSON.parse(texts['suggested_questions.json']), sourceAssets: JSON.parse(texts['source_assets.json']),
    };
    const validation = validateFrozenPoolBundle(bundle, manifest.artifactHashes);
    if (!validation.valid) errors.push(...validation.errors.map((error) => `${error.path} ${error.message}`));
    const sourceNames = (await readdir(join(root, 'source_files'))).sort();
    const expectedNames = bundle.sourceAssets.map((asset: any) => `${asset.postId}.txt`).sort();
    if (JSON.stringify(sourceNames) !== JSON.stringify(expectedNames)) errors.push('source file ownership mismatch');
    for (const asset of bundle.sourceAssets) {
      const text = await readFile(join(root, 'source_files', `${asset.postId}.txt`), 'utf8');
      if (sha256(text) !== asset.sha256 || text !== (asset.body ?? asset.digest)) errors.push(`source asset checksum mismatch for ${asset.postId}`);
    }
    const sources = JSON.parse(texts['sources.json']);
    const globalEdges = JSON.parse(texts['global_edges.json']);
    const rankingFeatures = JSON.parse(texts['ranking_features.json']);
    errors.push(...validateGraphArtifacts(bundle, sources, globalEdges, rankingFeatures));
    if ((await readdir(join(root, 'review_logs'))).some((name) => name !== 'approval-audit.json')) errors.push('unexpected review log artifact');
    const actualFiles: string[] = [];
    async function walk(relativeRoot = ''): Promise<void> {
      for (const entry of await readdir(join(root, relativeRoot), { withFileTypes: true })) {
        const rel = relativeRoot ? `${relativeRoot}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(rel); else if (rel !== 'manifest.json') actualFiles.push(rel);
      }
    }
    await walk(); actualFiles.sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(manifest.fixedFilenames)) errors.push('manifest fixed filenames do not match artifact');
    if (JSON.stringify(Object.keys(manifest.bundleFileHashes ?? {}).sort()) !== JSON.stringify(actualFiles)) errors.push('manifest bundle hashes do not cover every immutable file');
    for (const filename of actualFiles) if (sha256(await readFile(join(root, ...filename.split('/')))) !== manifest.bundleFileHashes?.[filename]) errors.push(`bundle checksum mismatch for ${filename}`);
  } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  return { valid: errors.length === 0, errors };
}
