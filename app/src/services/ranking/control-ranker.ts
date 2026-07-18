import type { Post, Topic } from '../../domain/content.types.ts';
import type { PostRankingFeatures } from '../../domain/graph.types.ts';
import {
  DEFAULT_RECOMMENDATION_CONFIG,
  type RecommendationConfig,
} from '../recommendation-config.ts';

export interface ControlRankerPost {
  readonly post: Pick<Post, 'id' | 'conceptIds'>;
  readonly features: PostRankingFeatures;
}

export interface ControlSessionServed {
  readonly sourceId: string;
  readonly format: PostRankingFeatures['format'];
}

export interface ControlRankerInput {
  readonly posts: readonly ControlRankerPost[];
  readonly topic: Pick<Topic, 'id' | 'coreConceptIds'>;
  readonly seenPostIds: ReadonlySet<string>;
  readonly dismissedPostIds: ReadonlySet<string>;
  readonly sessionServed: readonly ControlSessionServed[];
}

type AllowedControlRankerInputKey =
  | 'posts'
  | 'topic'
  | 'seenPostIds'
  | 'dismissedPostIds'
  | 'sessionServed';

export type ControlRankerInputKeysAreExact =
  Exclude<keyof ControlRankerInput, AllowedControlRankerInputKey> extends never
    ? Exclude<AllowedControlRankerInputKey, keyof ControlRankerInput> extends never
      ? true
      : never
    : never;

export interface ControlComponentScores {
  readonly contentQuality: number;
  readonly topicRelevance: number;
  readonly generalInterestingness: number;
  readonly difficultyBalance: number;
  readonly diversity: number;
  readonly recentlySeenPenalty: number;
}

export interface ControlRankedCandidate {
  readonly postId: string;
  readonly candidate: ControlRankerPost;
  readonly score: number;
  readonly componentScores: ControlComponentScores;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

function weightedMean(values: readonly number[], weights: readonly number[]): number {
  const weightTotal = weights.reduce((total, weight) => total + weight, 0);
  if (weightTotal <= 0) return 0;
  return clamp01(values.reduce((total, value, index) => total + clamp01(value) * (weights[index] ?? 0), 0) / weightTotal);
}

function contentQuality(features: PostRankingFeatures, config: RecommendationConfig): number {
  const weights = config.contentQualitySubweights;
  return weightedMean(
    [features.qualityScore, features.educationalValueScore, features.interestingnessScore],
    [weights.quality, weights.educationalValue, weights.interestingness],
  );
}

function topicRelevance(post: Pick<Post, 'conceptIds'>, topic: Pick<Topic, 'coreConceptIds'>): number {
  if (topic.coreConceptIds.length === 0) return 0;
  const postConcepts = new Set(post.conceptIds);
  const overlap = new Set(topic.coreConceptIds.filter((conceptId) => postConcepts.has(conceptId))).size;
  return clamp01(overlap / topic.coreConceptIds.length);
}

function diversity(
  features: PostRankingFeatures,
  sessionServed: readonly ControlSessionServed[],
  config: RecommendationConfig,
): number {
  if (sessionServed.length === 0) return 1;
  const sourceRepetition = sessionServed.filter((served) => served.sourceId === features.sourceId).length / sessionServed.length;
  const formatRepetition = sessionServed.filter((served) => served.format === features.format).length / sessionServed.length;
  const weights = config.controlDiversitySubweights;
  return 1 - weightedMean(
    [sourceRepetition, formatRepetition],
    [weights.source, weights.format],
  );
}

function scoreCandidate(
  candidate: ControlRankerPost,
  input: ControlRankerInput,
  config: RecommendationConfig,
): ControlRankedCandidate {
  const components: ControlComponentScores = {
    contentQuality: contentQuality(candidate.features, config),
    topicRelevance: topicRelevance(candidate.post, input.topic),
    generalInterestingness: clamp01(candidate.features.interestingnessScore),
    difficultyBalance: clamp01(1 - Math.abs(clamp01(candidate.features.difficulty) - 0.5) * 2),
    diversity: clamp01(diversity(candidate.features, input.sessionServed, config)),
    recentlySeenPenalty: input.seenPostIds.has(candidate.post.id) ? 1 : 0,
  };
  const weights = config.controlWeights;
  const score = clamp01(
    weights.contentQuality * components.contentQuality
      + weights.topicRelevance * components.topicRelevance
      + weights.generalInterestingness * components.generalInterestingness
      + weights.difficultyBalance * components.difficultyBalance
      + weights.diversity * components.diversity
      - weights.recentlySeenPenalty * components.recentlySeenPenalty,
  );

  return {
    postId: candidate.post.id,
    candidate,
    score,
    componentScores: components,
  };
}

export function scoreControl(
  input: ControlRankerInput,
  config: RecommendationConfig = DEFAULT_RECOMMENDATION_CONFIG,
): ControlRankedCandidate[] {
  return input.posts
    .filter((candidate) => !input.dismissedPostIds.has(candidate.post.id))
    .map((candidate) => scoreCandidate(candidate, input, config))
    .sort((left, right) => right.score !== left.score
      ? right.score - left.score
      : left.postId.localeCompare(right.postId));
}
