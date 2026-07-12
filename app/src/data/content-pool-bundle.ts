import type {
  Claim,
  Concept,
  FrozenPoolBundle,
  OriginalContentAsset,
  Post,
  SuggestedQuestion,
  Topic,
} from '../domain/content.types.ts';

export const PACKAGED_CONTENT_POOL_VERSION = 'v1';

export const CONTENT_POOL_FILENAMES = [
  'manifest.json',
  'topics.json',
  'posts.json',
  'concepts.json',
  'claims.json',
  'suggested_questions.json',
  'source_assets.json',
] as const;

export type ContentPoolFilename = typeof CONTENT_POOL_FILENAMES[number];
type ArtifactFilename = Exclude<ContentPoolFilename, 'manifest.json'>;

export interface PackagedPoolReader {
  readonly expectedVersion: string;
  readText(filename: ContentPoolFilename): Promise<string>;
}

export type ContentPoolErrorCode =
  | 'POOL_NOT_PACKAGED'
  | 'POOL_INVALID'
  | 'POOL_CHECKSUM_MISMATCH'
  | 'POOL_VERSION_MISMATCH';

export class ContentPoolBundleError extends Error {
  readonly code: ContentPoolErrorCode;

  constructor(code: ContentPoolErrorCode) {
    super(code);
    this.name = 'ContentPoolBundleError';
    this.code = code;
  }
}

const defaultReader: PackagedPoolReader = {
  expectedVersion: PACKAGED_CONTENT_POOL_VERSION,
  async readText() {
    throw new ContentPoolBundleError('POOL_NOT_PACKAGED');
  },
};

const artifactCollections: Record<ArtifactFilename, keyof Pick<FrozenPoolBundle,
  'topics' | 'posts' | 'concepts' | 'claims' | 'suggestedQuestions' | 'sourceAssets'>> = {
  'topics.json': 'topics',
  'posts.json': 'posts',
  'concepts.json': 'concepts',
  'claims.json': 'claims',
  'suggested_questions.json': 'suggestedQuestions',
  'source_assets.json': 'sourceAssets',
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const hasExactKeys = (value: Record<string, unknown>, required: string[], optional: string[] = []) => {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
};
const isText = (value: unknown, max: number) => typeof value === 'string' && value.length > 0 && value.length <= max;
const isId = (value: unknown) => isText(value, 128);
const isStringArray = (value: unknown, maxItems: number, itemMax = 128) => Array.isArray(value)
  && value.length <= maxItems
  && value.every((item) => isText(item, itemMax))
  && new Set(value).size === value.length;
const isScore = (value: unknown, max = 1) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const isDateTime = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const isHttpsUrl = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('https://')) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
};
const oneOf = (value: unknown, allowed: readonly string[]) => typeof value === 'string' && allowed.includes(value);

function validTopic(value: unknown): value is Topic {
  if (!isObject(value) || !hasExactKeys(value,
    ['id', 'name', 'shortDescription', 'hooks', 'coreConceptIds', 'testRubricId', 'contentPoolVersion'])) return false;
  return isId(value.id) && isText(value.name, 160) && isText(value.shortDescription, 800)
    && isStringArray(value.hooks, 50, 240) && isStringArray(value.coreConceptIds, 500)
    && isId(value.testRubricId) && isText(value.contentPoolVersion, 64);
}

function validPost(value: unknown): value is Post {
  const required = ['id', 'topicId', 'sourceUrl', 'sourcePlatform', 'sourceName', 'originalTitle', 'displayTitle', 'hook', 'shortSummary', 'language', 'collectedAt', 'qualityScore', 'interestingnessScore', 'educationalValueScore', 'difficulty', 'conceptIds', 'claimIds', 'suggestedQuestionIds', 'status'];
  const optional = ['author', 'longSummary', 'durationSeconds', 'readingTimeMinutes', 'thumbnailUrl', 'originalPublishedAt', 'approvedAt', 'viewpoint'];
  if (!isObject(value) || !hasExactKeys(value, required, optional)) return false;
  if (!isId(value.id) || !isId(value.topicId) || !isHttpsUrl(value.sourceUrl)
    || !oneOf(value.sourcePlatform, ['youtube', 'article', 'blog', 'newsletter', 'x', 'reddit', 'news', 'other'])
    || !isText(value.sourceName, 200) || !isText(value.originalTitle, 500) || !isText(value.displayTitle, 500)
    || !isText(value.hook, 240) || !isText(value.shortSummary, 800)
    || !isText(value.language, 35) || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(value.language as string)
    || !isDateTime(value.collectedAt) || !isScore(value.qualityScore) || !isScore(value.interestingnessScore)
    || !isScore(value.educationalValueScore) || !isScore(value.difficulty)
    || !isStringArray(value.conceptIds, 500) || !isStringArray(value.claimIds, 500)
    || !isStringArray(value.suggestedQuestionIds, 100)
    || !oneOf(value.status, ['raw', 'preprocessed', 'approved', 'rejected', 'frozen'])) return false;
  if (value.author !== undefined && !isText(value.author, 200)) return false;
  if (value.longSummary !== undefined && !isText(value.longSummary, 2400)) return false;
  if (value.durationSeconds !== undefined && !isScore(value.durationSeconds, 86400)) return false;
  if (value.readingTimeMinutes !== undefined && !isScore(value.readingTimeMinutes, 1440)) return false;
  if (value.thumbnailUrl !== undefined && !isHttpsUrl(value.thumbnailUrl)) return false;
  if (value.originalPublishedAt !== undefined && !isDateTime(value.originalPublishedAt)) return false;
  if (value.approvedAt !== undefined && !isDateTime(value.approvedAt)) return false;
  return value.viewpoint === undefined || oneOf(value.viewpoint, ['supportive', 'critical', 'neutral', 'mixed']);
}

function validConcept(value: unknown): value is Concept {
  if (!isObject(value) || !hasExactKeys(value, ['id', 'topicId', 'label', 'description', 'aliases'], ['parentConceptIds', 'prerequisiteConceptIds'])) return false;
  return isId(value.id) && isId(value.topicId) && isText(value.label, 120) && isText(value.description, 800)
    && isStringArray(value.aliases, 100, 120)
    && (value.parentConceptIds === undefined || isStringArray(value.parentConceptIds, 100))
    && (value.prerequisiteConceptIds === undefined || isStringArray(value.prerequisiteConceptIds, 100));
}

function validClaim(value: unknown): value is Claim {
  if (!isObject(value) || !hasExactKeys(value, ['id', 'topicId', 'text', 'conceptIds'], ['stance'])) return false;
  return isId(value.id) && isId(value.topicId) && isText(value.text, 800) && isStringArray(value.conceptIds, 500)
    && (value.stance === undefined || oneOf(value.stance, ['pro', 'con', 'neutral', 'mixed']));
}

function validSuggestion(value: unknown): value is SuggestedQuestion {
  if (!isObject(value) || !hasExactKeys(value, ['id', 'postId', 'topicId', 'text', 'type', 'targetConceptIds', 'generic'], ['targetClaimIds'])) return false;
  return isId(value.id) && isId(value.postId) && isId(value.topicId) && isText(value.text, 240)
    && oneOf(value.type, ['clarification', 'evidence', 'counterpoint', 'connection', 'implication', 'example', 'reliability'])
    && isStringArray(value.targetConceptIds, 100)
    && (value.targetClaimIds === undefined || isStringArray(value.targetClaimIds, 100))
    && typeof value.generic === 'boolean';
}

function validAsset(value: unknown): value is OriginalContentAsset {
  if (!isObject(value) || !hasExactKeys(value, ['postId', 'kind', 'sourceUrl', 'sha256'], ['body', 'transcript'])) return false;
  if (!isId(value.postId) || !oneOf(value.kind, ['article', 'video']) || !isHttpsUrl(value.sourceUrl)
    || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) return false;
  if (value.kind === 'article') return isText(value.body, 2_000_000) && value.transcript === undefined;
  return isText(value.transcript, 2_000_000) && value.body === undefined;
}

async function digest(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requireValidShape(bundle: FrozenPoolBundle): void {
  const manifest = bundle.manifest as unknown;
  const base = ['contentPoolVersion', 'generatedAt', 'preprocessingModelVersions', 'rawCandidateCount', 'approvedCount', 'rejectedCount', 'reviewProcedureSummary', 'counts', 'artifactHashes', 'feedOrderPostIds'];
  const extended = [...base, 'collectorVersions', 'promptVersions', 'schemaVersions', 'sourceFormatDistribution', 'stanceDistribution', 'fixedFilenames', 'bundleFileHashes'];
  const hasExtended = isObject(manifest) && hasExactKeys(manifest, extended);
  if (!isObject(manifest) || (!hasExactKeys(manifest, base) && !hasExtended)
    || !isText(manifest.contentPoolVersion, 64) || !isDateTime(manifest.generatedAt)
    || !isStringArray(manifest.preprocessingModelVersions, 50, 200)
    || (hasExtended && (!isStringArray(manifest.collectorVersions, 50, 200)
    || !isStringArray(manifest.promptVersions, 50, 200)
    || !isStringArray(manifest.schemaVersions, 50, 200)))
    || !Number.isInteger(manifest.rawCandidateCount) || (manifest.rawCandidateCount as number) < 0
    || !Number.isInteger(manifest.approvedCount) || (manifest.approvedCount as number) < 0
    || !Number.isInteger(manifest.rejectedCount) || (manifest.rejectedCount as number) < 0
    || (hasExtended && (!isObject(manifest.sourceFormatDistribution) || !hasExactKeys(manifest.sourceFormatDistribution, ['article', 'video']) || !Object.values(manifest.sourceFormatDistribution).every((count) => Number.isInteger(count) && (count as number) >= 0)
    || !isObject(manifest.stanceDistribution) || !hasExactKeys(manifest.stanceDistribution, ['supportive', 'critical', 'neutral', 'mixed']) || !Object.values(manifest.stanceDistribution).every((count) => Number.isInteger(count) && (count as number) >= 0)))
    || !isText(manifest.reviewProcedureSummary, 4000)
    || !isObject(manifest.counts) || !hasExactKeys(manifest.counts, ['topics', 'posts', 'concepts', 'claims', 'suggestedQuestions', 'sourceAssets'])
    || !Object.values(manifest.counts).every((count) => Number.isInteger(count) && (count as number) >= 0)
    || !isObject(manifest.artifactHashes) || !hasExactKeys(manifest.artifactHashes, Object.keys(artifactCollections))
    || !Object.values(manifest.artifactHashes).every((hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash))
    || !isStringArray(manifest.feedOrderPostIds, Number.MAX_SAFE_INTEGER)
    || (hasExtended && (!isStringArray(manifest.fixedFilenames, Number.MAX_SAFE_INTEGER, 300)
    || !isObject(manifest.bundleFileHashes) || !Object.values(manifest.bundleFileHashes).every((hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash))))) throw new ContentPoolBundleError('POOL_INVALID');
  if (!Array.isArray(bundle.topics) || !bundle.topics.every(validTopic)
    || !Array.isArray(bundle.posts) || !bundle.posts.every(validPost)
    || !Array.isArray(bundle.concepts) || !bundle.concepts.every(validConcept)
    || !Array.isArray(bundle.claims) || !bundle.claims.every(validClaim)
    || !Array.isArray(bundle.suggestedQuestions) || !bundle.suggestedQuestions.every(validSuggestion)
    || !Array.isArray(bundle.sourceAssets) || !bundle.sourceAssets.every(validAsset)) throw new ContentPoolBundleError('POOL_INVALID');
}

function requireValidReferences(bundle: FrozenPoolBundle): void {
  const topics = new Map(bundle.topics.map((record) => [record.id, record]));
  const posts = new Map(bundle.posts.map((record) => [record.id, record]));
  const concepts = new Map(bundle.concepts.map((record) => [record.id, record]));
  const claims = new Map(bundle.claims.map((record) => [record.id, record]));
  const suggestions = new Map(bundle.suggestedQuestions.map((record) => [record.id, record]));
  const collections = [bundle.topics, bundle.posts, bundle.concepts, bundle.claims, bundle.suggestedQuestions];
  if (collections.some((records) => new Set(records.map((record) => record.id)).size !== records.length)) throw new ContentPoolBundleError('POOL_INVALID');
  for (const topic of bundle.topics) {
    if (topic.contentPoolVersion !== bundle.manifest.contentPoolVersion
      || topic.coreConceptIds.some((id) => concepts.get(id)?.topicId !== topic.id)) throw new ContentPoolBundleError('POOL_INVALID');
  }
  for (const concept of bundle.concepts) {
    if (!topics.has(concept.topicId)
      || [...(concept.parentConceptIds ?? []), ...(concept.prerequisiteConceptIds ?? [])].some((id) => !concepts.has(id))) throw new ContentPoolBundleError('POOL_INVALID');
  }
  for (const claim of bundle.claims) {
    if (!topics.has(claim.topicId) || claim.conceptIds.some((id) => concepts.get(id)?.topicId !== claim.topicId)) throw new ContentPoolBundleError('POOL_INVALID');
  }
  for (const post of bundle.posts) {
    if (!topics.has(post.topicId) || post.status !== 'frozen'
      || post.conceptIds.some((id) => concepts.get(id)?.topicId !== post.topicId)
      || post.claimIds.some((id) => claims.get(id)?.topicId !== post.topicId)
      || post.suggestedQuestionIds.some((id) => suggestions.get(id)?.postId !== post.id)) throw new ContentPoolBundleError('POOL_INVALID');
  }
  for (const suggestion of bundle.suggestedQuestions) {
    if (posts.get(suggestion.postId)?.topicId !== suggestion.topicId
      || suggestion.targetConceptIds.some((id) => concepts.get(id)?.topicId !== suggestion.topicId)
      || (suggestion.targetClaimIds ?? []).some((id) => claims.get(id)?.topicId !== suggestion.topicId)) throw new ContentPoolBundleError('POOL_INVALID');
  }
  const order = bundle.manifest.feedOrderPostIds;
  if (order.length !== posts.size || new Set(order).size !== posts.size || order.some((id) => !posts.has(id))) throw new ContentPoolBundleError('POOL_INVALID');
  const counts = bundle.manifest.counts;
  if (counts.topics !== bundle.topics.length || counts.posts !== bundle.posts.length
    || counts.concepts !== bundle.concepts.length || counts.claims !== bundle.claims.length
    || counts.suggestedQuestions !== bundle.suggestedQuestions.length || counts.sourceAssets !== bundle.sourceAssets.length
    || bundle.manifest.approvedCount !== bundle.posts.length) throw new ContentPoolBundleError('POOL_INVALID');
  const assetIds = bundle.sourceAssets.map((asset) => asset.postId);
  if (assetIds.length !== posts.size || new Set(assetIds).size !== posts.size
    || bundle.sourceAssets.some((asset) => posts.get(asset.postId)?.sourceUrl !== asset.sourceUrl)) throw new ContentPoolBundleError('POOL_INVALID');
}

export async function validateBundledContentPool(
  bundle: FrozenPoolBundle,
  artifactTexts: Readonly<Record<ArtifactFilename, string>>,
  expectedVersion: string,
): Promise<void> {
  requireValidShape(bundle);
  if (bundle.manifest.contentPoolVersion !== expectedVersion) throw new ContentPoolBundleError('POOL_VERSION_MISMATCH');
  requireValidReferences(bundle);
  for (const filename of Object.keys(artifactCollections) as ArtifactFilename[]) {
    if (await digest(artifactTexts[filename]) !== bundle.manifest.artifactHashes[filename]) {
      throw new ContentPoolBundleError('POOL_CHECKSUM_MISMATCH');
    }
  }
  for (const asset of bundle.sourceAssets) {
    const text = asset.kind === 'article' ? asset.body! : asset.transcript!;
    if (await digest(text) !== asset.sha256) throw new ContentPoolBundleError('POOL_CHECKSUM_MISMATCH');
  }
}

export async function loadBundledContentPool(reader: PackagedPoolReader = defaultReader): Promise<FrozenPoolBundle> {
  const texts = {} as Record<ContentPoolFilename, string>;
  for (const filename of CONTENT_POOL_FILENAMES) texts[filename] = await reader.readText(filename);
  try {
    const bundle: FrozenPoolBundle = {
      manifest: JSON.parse(texts['manifest.json']),
      topics: JSON.parse(texts['topics.json']),
      posts: JSON.parse(texts['posts.json']),
      concepts: JSON.parse(texts['concepts.json']),
      claims: JSON.parse(texts['claims.json']),
      suggestedQuestions: JSON.parse(texts['suggested_questions.json']),
      sourceAssets: JSON.parse(texts['source_assets.json']),
    };
    const artifacts = Object.fromEntries(
      (Object.keys(artifactCollections) as ArtifactFilename[]).map((filename) => [filename, texts[filename]]),
    ) as Record<ArtifactFilename, string>;
    await validateBundledContentPool(bundle, artifacts, reader.expectedVersion);
    return bundle;
  } catch (error) {
    if (error instanceof ContentPoolBundleError) throw error;
    throw new ContentPoolBundleError('POOL_INVALID');
  }
}
