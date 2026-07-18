import { createHash } from 'node:crypto';

export const GLOBAL_EDGE_TYPES = [
  'explains',
  'mentions',
  'supports',
  'challenges',
  'about',
  'contrasts_with',
  'related_to',
  'prerequisite_of',
  'targets',
] as const;

export type GlobalEdgeType = typeof GLOBAL_EDGE_TYPES[number];

export interface GlobalEdgeRecord {
  id: string;
  topicId: string;
  type: GlobalEdgeType;
  sourceId: string;
  targetId: string;
}

export interface SourceRecord {
  id: string;
  name: string;
  platform: 'youtube' | 'article' | 'blog' | 'newsletter' | 'x' | 'reddit' | 'news' | 'other';
  url: string;
}

export interface EmbeddingFingerprint {
  provider: string;
  model: string;
  dimensions: number;
}

export interface PostRankingFeatures {
  postId: string;
  topicId: string;
  primaryConceptId: string;
  sourceId: string;
  format: 'video' | 'article' | 'social' | 'other';
  qualityScore: number;
  educationalValueScore: number;
  interestingnessScore: number;
  difficulty: number;
  viewpoint?: 'supportive' | 'critical' | 'neutral' | 'mixed';
  summaryVector?: number[];
}

export interface RankingFeaturesArtifact {
  embeddingFingerprint: EmbeddingFingerprint | null;
  posts: PostRankingFeatures[];
}

export interface GraphBuildWarning {
  code: 'unresolved-concept-label';
  conceptId: string;
  relation: 'related_to' | 'prerequisite_of';
  label: string;
}

interface GraphPostInput {
  id: string;
  topicId: string;
  sourceUrl: string;
  sourcePlatform: SourceRecord['platform'];
  sourceName: string;
  shortSummary: string;
  qualityScore: number;
  educationalValueScore: number;
  interestingnessScore: number;
  difficulty: number;
  viewpoint?: PostRankingFeatures['viewpoint'];
  conceptIds: string[];
  claimIds: string[];
  suggestedQuestionIds: string[];
}

interface GraphConceptInput {
  id: string;
  topicId: string;
  label: string;
  aliases: string[];
}

interface GraphClaimInput {
  id: string;
  topicId: string;
  stance?: 'pro' | 'con' | 'neutral' | 'mixed';
  conceptIds: string[];
}

interface GraphSuggestedQuestionInput {
  id: string;
  postId: string;
  topicId: string;
  targetConceptIds: string[];
  targetClaimIds?: string[];
}

export interface ConceptRelationInput {
  conceptId: string;
  relatedConceptLabels: string[];
  prerequisiteConceptLabels: string[];
}

export interface GlobalGraphInput {
  posts: GraphPostInput[];
  concepts: GraphConceptInput[];
  conceptRelations?: ConceptRelationInput[];
  claims: GraphClaimInput[];
  suggestedQuestions: GraphSuggestedQuestionInput[];
}

export interface EmbeddingBuildConfig extends EmbeddingFingerprint {
  embed(text: string): Promise<number[]>;
}

export interface CompiledGlobalGraph {
  sources: SourceRecord[];
  globalEdges: GlobalEdgeRecord[];
  rankingFeatures: RankingFeaturesArtifact;
  warnings: GraphBuildWarning[];
}

const normalizeLabel = (value: string): string => value.normalize('NFKC').trim().toLocaleLowerCase('en-US');
const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const sourceKey = (post: GraphPostInput): string => JSON.stringify([post.sourceName, post.sourcePlatform, post.sourceUrl]);

function formatFor(platform: SourceRecord['platform']): PostRankingFeatures['format'] {
  if (platform === 'youtube') return 'video';
  if (['article', 'blog', 'newsletter', 'news'].includes(platform)) return 'article';
  if (platform === 'x' || platform === 'reddit') return 'social';
  return 'other';
}

function edge(type: GlobalEdgeType, topicId: string, sourceId: string, targetId: string): GlobalEdgeRecord {
  return { id: `${type}:${sourceId}:${targetId}`, topicId, type, sourceId, targetId };
}

export async function compileGlobalGraph(input: GlobalGraphInput, embedding?: EmbeddingBuildConfig): Promise<CompiledGlobalGraph> {
  const posts = [...input.posts].sort((left, right) => left.id.localeCompare(right.id));
  const concepts = [...input.concepts].sort((left, right) => left.id.localeCompare(right.id));
  const claims = [...input.claims].sort((left, right) => left.id.localeCompare(right.id));
  const questions = [...input.suggestedQuestions].sort((left, right) => left.id.localeCompare(right.id));
  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));
  const claimById = new Map(claims.map((claim) => [claim.id, claim]));
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const labels = new Map<string, GraphConceptInput[]>();
  for (const concept of concepts) {
    for (const label of [concept.label, ...concept.aliases]) {
      const key = `${concept.topicId}\u0000${normalizeLabel(label)}`;
      labels.set(key, [...(labels.get(key) ?? []), concept]);
    }
  }

  const sourceByKey = new Map<string, SourceRecord>();
  for (const post of posts) {
    const key = sourceKey(post);
    if (!sourceByKey.has(key)) sourceByKey.set(key, {
      id: `source-${sha256(key).slice(0, 20)}`,
      name: post.sourceName,
      platform: post.sourcePlatform,
      url: post.sourceUrl,
    });
  }
  const sources = [...sourceByKey.values()].sort((left, right) => left.id.localeCompare(right.id));

  const edges = new Map<string, GlobalEdgeRecord>();
  const addEdge = (record: GlobalEdgeRecord): void => { edges.set(record.id, record); };

  for (const claim of claims) for (const conceptId of [...claim.conceptIds].sort()) {
    addEdge(edge('about', claim.topicId, claim.id, conceptId));
  }
  for (const question of questions) {
    for (const conceptId of [...question.targetConceptIds].sort()) addEdge(edge('targets', question.topicId, question.id, conceptId));
    for (const claimId of [...(question.targetClaimIds ?? [])].sort()) addEdge(edge('targets', question.topicId, question.id, claimId));
  }

  const contrastingClaims = new Map<string, Set<string>>();
  for (let index = 0; index < claims.length; index += 1) {
    const left = claims[index];
    if (left.stance !== 'pro' && left.stance !== 'con') continue;
    for (let otherIndex = index + 1; otherIndex < claims.length; otherIndex += 1) {
      const right = claims[otherIndex];
      if (right.topicId !== left.topicId || right.stance === left.stance || (right.stance !== 'pro' && right.stance !== 'con')) continue;
      if (!left.conceptIds.some((conceptId) => right.conceptIds.includes(conceptId))) continue;
      addEdge(edge('contrasts_with', left.topicId, left.id, right.id));
      addEdge(edge('contrasts_with', left.topicId, right.id, left.id));
      contrastingClaims.set(left.id, new Set([...(contrastingClaims.get(left.id) ?? []), right.id]));
      contrastingClaims.set(right.id, new Set([...(contrastingClaims.get(right.id) ?? []), left.id]));
    }
  }

  const warnings: GraphBuildWarning[] = [];
  const resolveLabel = (owner: GraphConceptInput, relation: GraphBuildWarning['relation'], label: string): GraphConceptInput | undefined => {
    const matches = labels.get(`${owner.topicId}\u0000${normalizeLabel(label)}`) ?? [];
    if (matches.length === 1) return matches[0];
    warnings.push({ code: 'unresolved-concept-label', conceptId: owner.id, relation, label });
    return undefined;
  };
  for (const relation of [...(input.conceptRelations ?? [])].sort((left, right) => left.conceptId.localeCompare(right.conceptId))) {
    const owner = conceptById.get(relation.conceptId);
    if (!owner) continue;
    for (const label of [...relation.relatedConceptLabels].sort()) {
      const target = resolveLabel(owner, 'related_to', label);
      if (target && target.id !== owner.id) addEdge(edge('related_to', owner.topicId, owner.id, target.id));
    }
    for (const label of [...relation.prerequisiteConceptLabels].sort()) {
      const prerequisite = resolveLabel(owner, 'prerequisite_of', label);
      if (prerequisite && prerequisite.id !== owner.id) addEdge(edge('prerequisite_of', owner.topicId, prerequisite.id, owner.id));
    }
  }

  const primaryByPost = new Map<string, string>();
  for (const post of posts) {
    if (!post.conceptIds.length) throw new Error(`post ${post.id} has no concept from which to derive primaryConceptId`);
    const counts = new Map([...post.conceptIds].sort().map((conceptId) => [conceptId, 0]));
    const postQuestions = post.suggestedQuestionIds.map((id) => questionById.get(id)).filter((value): value is GraphSuggestedQuestionInput => value !== undefined);
    for (const question of postQuestions) for (const conceptId of question.targetConceptIds) {
      if (counts.has(conceptId)) counts.set(conceptId, counts.get(conceptId)! + 1);
    }
    for (const claimId of post.claimIds) for (const conceptId of claimById.get(claimId)?.conceptIds ?? []) {
      if (counts.has(conceptId)) counts.set(conceptId, counts.get(conceptId)! + 1);
    }
    const primaryConceptId = [...counts].sort(([leftId, leftCount], [rightId, rightCount]) => rightCount - leftCount || leftId.localeCompare(rightId))[0][0];
    primaryByPost.set(post.id, primaryConceptId);

    for (const conceptId of [...post.conceptIds].sort()) addEdge(edge('mentions', post.topicId, post.id, conceptId));
    addEdge(edge('explains', post.topicId, post.id, primaryConceptId));
    // A concept targeted by at least two of a post's reviewed questions is promoted to explains.
    const targetCounts = new Map<string, number>();
    for (const question of postQuestions) for (const conceptId of question.targetConceptIds) targetCounts.set(conceptId, (targetCounts.get(conceptId) ?? 0) + 1);
    for (const [conceptId, count] of [...targetCounts].sort(([left], [right]) => left.localeCompare(right))) {
      if (count >= 2 && post.conceptIds.includes(conceptId)) addEdge(edge('explains', post.topicId, post.id, conceptId));
    }
    for (const claimId of [...post.claimIds].sort()) {
      addEdge(edge('supports', post.topicId, post.id, claimId));
      for (const contrastingId of [...(contrastingClaims.get(claimId) ?? [])].sort()) addEdge(edge('challenges', post.topicId, post.id, contrastingId));
    }
  }

  const rankingPosts = await Promise.all(posts.map(async (post): Promise<PostRankingFeatures> => {
    const source = sourceByKey.get(sourceKey(post))!;
    const summaryVector = embedding ? await embedding.embed(post.shortSummary) : undefined;
    if (embedding && (summaryVector?.length !== embedding.dimensions || summaryVector.some((value) => !Number.isFinite(value)))) {
      throw new Error(`embedding for ${post.id} must contain ${embedding.dimensions} finite dimensions`);
    }
    return {
      postId: post.id,
      topicId: post.topicId,
      primaryConceptId: primaryByPost.get(post.id)!,
      sourceId: source.id,
      format: formatFor(post.sourcePlatform),
      qualityScore: post.qualityScore,
      educationalValueScore: post.educationalValueScore,
      interestingnessScore: post.interestingnessScore,
      difficulty: post.difficulty,
      ...(post.viewpoint ? { viewpoint: post.viewpoint } : {}),
      ...(summaryVector ? { summaryVector } : {}),
    };
  }));

  return {
    sources,
    globalEdges: [...edges.values()].sort((left, right) => left.id.localeCompare(right.id)),
    rankingFeatures: {
      embeddingFingerprint: embedding ? { provider: embedding.provider, model: embedding.model, dimensions: embedding.dimensions } : null,
      posts: rankingPosts,
    },
    warnings: warnings.sort((left, right) => left.conceptId.localeCompare(right.conceptId) || left.relation.localeCompare(right.relation) || left.label.localeCompare(right.label)),
  };
}
