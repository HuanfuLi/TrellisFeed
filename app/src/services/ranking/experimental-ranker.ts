import type {
  Post,
  UserConceptState,
  UserQuestion,
} from '../../domain/content.types.ts';
import type {
  EmbeddingFingerprint,
  GlobalEdge,
  PostRankingFeatures,
} from '../../domain/graph.types.ts';
import { cosine } from '../../providers/embedding/index.ts';
import {
  DEFAULT_RECOMMENDATION_CONFIG,
  type ExperimentalRecommendationStrategy,
  type RecommendationConfig,
} from '../recommendation-config.ts';

export interface ComponentEvidence {
  readonly questionIds?: readonly string[];
  readonly conceptIds?: readonly string[];
  readonly postIds?: readonly string[];
  readonly claimIds?: readonly string[];
}

export interface ComponentResult {
  readonly value: number;
  readonly evidence: ComponentEvidence;
}

export interface ExperimentalCandidate {
  readonly post: Pick<Post, 'id' | 'conceptIds' | 'claimIds'>;
  readonly features: PostRankingFeatures;
}

export interface ExperimentalQuestion extends Pick<
  UserQuestion,
  'id' | 'postId' | 'createdAt' | 'extractedConceptIds' | 'extractedClaimIds' | 'unresolved'
> {
  readonly embeddingVector?: number[];
}

export interface ExperimentalRankerInput {
  readonly candidates: readonly ExperimentalCandidate[];
  readonly globalEdges: readonly GlobalEdge[];
  readonly questions: readonly ExperimentalQuestion[];
  readonly conceptStates: ReadonlyMap<string, UserConceptState>;
  readonly recentServed: readonly ExperimentalCandidate[];
  readonly viewedPosts: readonly ExperimentalCandidate[];
  readonly dismissedPostIds: ReadonlySet<string>;
  readonly embeddingFingerprint?: EmbeddingFingerprint;
  readonly now: () => number;
}

export type CandidateGenerationSource =
  | 'high_quality'
  | 'active_concept'
  | 'question_link'
  | 'claim_relation'
  | 'bridge'
  | 'echo';

export interface CandidateGenerationEvidence extends ComponentEvidence {
  readonly sources: readonly CandidateGenerationSource[];
  readonly recentlyViewed: boolean;
}

export interface GeneratedExperimentalCandidate extends ExperimentalCandidate {
  readonly generationEvidence: CandidateGenerationEvidence;
}

export interface ExperimentalComponentScores {
  readonly questionRelevance: ComponentResult;
  readonly conceptInterestMatch: ComponentResult;
  readonly continuityWithRecentPosts: ComponentResult;
  readonly noveltyOrContrast: ComponentResult;
  readonly contentQuality: ComponentResult;
  readonly difficultyFit: ComponentResult;
  readonly redundancyPenalty: ComponentResult;
}

export interface StrategySelection {
  readonly strategy: ExperimentalRecommendationStrategy;
  readonly affinity: number;
  readonly affinities: Readonly<Record<ExperimentalRecommendationStrategy, number>>;
  readonly evidence: ComponentEvidence;
}

export interface ExperimentalRankedCandidate {
  readonly postId: string;
  readonly candidate: ExperimentalCandidate;
  readonly score: number;
  readonly strategy: ExperimentalRecommendationStrategy;
  readonly componentScores: ExperimentalComponentScores;
  readonly contributingQuestionIds: readonly string[];
  readonly contributingConceptIds: readonly string[];
  readonly contributingPostIds: readonly string[];
  readonly contributingClaimIds: readonly string[];
}

interface WeightedLeg {
  readonly value: number;
  readonly weight: number;
  readonly available?: boolean;
}

interface QuestionRelation {
  readonly direct: boolean;
  readonly conceptIds: readonly string[];
  readonly claimIds: readonly string[];
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const uniqueSorted = (values: Iterable<string>): string[] => [...new Set(values)].sort((left, right) => left.localeCompare(right));

function weightedAvailable(legs: readonly WeightedLeg[]): number {
  const available = legs.filter((leg) => leg.available !== false && leg.weight > 0);
  const totalWeight = available.reduce((total, leg) => total + leg.weight, 0);
  if (totalWeight <= 0) return 0;
  return clamp01(available.reduce((total, leg) => total + clamp01(leg.value) * leg.weight, 0) / totalWeight);
}

function fingerprintsMatch(
  frozen: EmbeddingFingerprint | undefined,
  runtime: EmbeddingFingerprint | undefined,
): boolean {
  return frozen !== undefined
    && runtime !== undefined
    && frozen.provider === runtime.provider
    && frozen.model === runtime.model
    && frozen.dimensions === runtime.dimensions;
}

function vectorSimilarity(
  left: number[] | undefined,
  right: number[] | undefined,
  input: ExperimentalRankerInput,
  config: RecommendationConfig,
): { available: boolean; value: number } {
  const available = fingerprintsMatch(input.embeddingFingerprint, config.runtimeEmbeddingFingerprint)
    && left !== undefined
    && right !== undefined
    && left.length === input.embeddingFingerprint?.dimensions
    && right.length === input.embeddingFingerprint.dimensions;
  return {
    available,
    value: available ? clamp01(cosine(left, right)) : 0,
  };
}

function overlaps(left: readonly string[], right: readonly string[]): string[] {
  const rightSet = new Set(right);
  return uniqueSorted(left.filter((value) => rightSet.has(value)));
}

function edgeConnects(edge: GlobalEdge, left: string, right: string): boolean {
  return (edge.sourceId === left && edge.targetId === right)
    || (edge.sourceId === right && edge.targetId === left);
}

function relatedConcepts(
  leftConceptIds: readonly string[],
  rightConceptIds: readonly string[],
  edges: readonly GlobalEdge[],
): string[] {
  const result: string[] = [];
  for (const left of leftConceptIds) {
    for (const right of rightConceptIds) {
      if (left === right || edges.some((edge) => (
        edge.type === 'related_to' || edge.type === 'prerequisite_of'
      ) && edgeConnects(edge, left, right))) {
        result.push(left, right);
      }
    }
  }
  return uniqueSorted(result);
}

function opposingClaimIds(
  candidateClaimIds: readonly string[],
  referenceClaimIds: readonly string[],
  edges: readonly GlobalEdge[],
): string[] {
  const result: string[] = [];
  for (const candidateClaimId of candidateClaimIds) {
    for (const referenceClaimId of referenceClaimIds) {
      if (edges.some((edge) => edge.type === 'contrasts_with'
        && edgeConnects(edge, candidateClaimId, referenceClaimId))) {
        result.push(candidateClaimId, referenceClaimId);
      }
    }
  }
  return uniqueSorted(result);
}

function postRelatesToClaims(
  postId: string,
  claimIds: readonly string[],
  edges: readonly GlobalEdge[],
): string[] {
  const claimSet = new Set(claimIds);
  return uniqueSorted(edges
    .filter((edge) => (edge.type === 'supports' || edge.type === 'challenges')
      && edge.sourceId === postId
      && claimSet.has(edge.targetId))
    .map((edge) => edge.targetId));
}

function questionRelation(
  candidate: ExperimentalCandidate,
  question: ExperimentalQuestion,
  edges: readonly GlobalEdge[],
): QuestionRelation {
  const conceptIds = overlaps(candidate.post.conceptIds, question.extractedConceptIds);
  const questionClaimIds = question.extractedClaimIds ?? [];
  const claimIds = uniqueSorted([
    ...overlaps(candidate.post.claimIds, questionClaimIds),
    ...postRelatesToClaims(candidate.post.id, questionClaimIds, edges),
  ]);
  return {
    direct: conceptIds.length > 0 || claimIds.length > 0,
    conceptIds,
    claimIds,
  };
}

function contentQualityComponent(
  candidate: ExperimentalCandidate,
  config: RecommendationConfig,
): ComponentResult {
  const weights = config.contentQualitySubweights;
  return {
    value: weightedAvailable([
      { value: candidate.features.qualityScore, weight: weights.quality },
      { value: candidate.features.educationalValueScore, weight: weights.educationalValue },
      { value: candidate.features.interestingnessScore, weight: weights.interestingness },
    ]),
    evidence: { postIds: [candidate.post.id] },
  };
}

function questionRelevanceComponent(
  candidate: ExperimentalCandidate,
  input: ExperimentalRankerInput,
  config: RecommendationConfig,
): ComponentResult {
  const weights = config.questionRelevanceSubweights;
  let bestValue = 0;
  let bestQuestion: ExperimentalQuestion | undefined;
  let bestRelation: QuestionRelation = { direct: false, conceptIds: [], claimIds: [] };

  for (const question of [...input.questions].sort((left, right) => left.id.localeCompare(right.id))) {
    const relation = questionRelation(candidate, question, input.globalEdges);
    const semantic = vectorSimilarity(
      question.embeddingVector,
      candidate.features.summaryVector,
      input,
      config,
    );
    const conceptValue = question.extractedConceptIds.length > 0
      ? relation.conceptIds.length / question.extractedConceptIds.length
      : 0;
    const questionClaims = question.extractedClaimIds ?? [];
    const claimValue = questionClaims.length > 0
      ? relation.claimIds.length / questionClaims.length
      : 0;
    const value = weightedAvailable([
      { value: semantic.value, weight: weights.semantic, available: semantic.available },
      { value: conceptValue, weight: weights.concept },
      { value: claimValue, weight: weights.claim },
      { value: question.unresolved ? 1 : 0, weight: weights.unresolved },
    ]);
    if (value > bestValue) {
      bestValue = value;
      bestQuestion = question;
      bestRelation = relation;
    }
  }

  return {
    value: clamp01(bestValue),
    evidence: bestQuestion === undefined
      ? {}
      : {
          questionIds: [bestQuestion.id],
          conceptIds: bestRelation.conceptIds,
          claimIds: bestRelation.claimIds,
        },
  };
}

function activeStates(input: ExperimentalRankerInput): UserConceptState[] {
  return [...input.conceptStates.values()]
    .filter((state) => state.interestWeight > 0 || state.questionCount > 0 || state.exposureCount > 0)
    .sort((left, right) => left.conceptId.localeCompare(right.conceptId));
}

function conceptInterestComponent(
  candidate: ExperimentalCandidate,
  input: ExperimentalRankerInput,
  config: RecommendationConfig,
): ComponentResult {
  const directStates = candidate.post.conceptIds
    .map((conceptId) => input.conceptStates.get(conceptId))
    .filter((state): state is UserConceptState => state !== undefined);
  const active = activeStates(input);
  const proximityStates = active.filter((state) => candidate.post.conceptIds.some((candidateConceptId) => (
    input.globalEdges.some((edge) => (
      edge.type === 'related_to' || edge.type === 'prerequisite_of'
    ) && edgeConnects(edge, candidateConceptId, state.conceptId))
  )));
  const directValue = directStates.length === 0
    ? 0
    : directStates.reduce((total, state) => total + clamp01(state.interestWeight), 0) / directStates.length;
  const proximityValue = proximityStates.length === 0
    ? 0
    : Math.max(...proximityStates.map((state) => clamp01(state.interestWeight)));
  const weights = config.conceptInterestSubweights;

  return {
    value: weightedAvailable([
      { value: directValue, weight: weights.direct },
      { value: proximityValue, weight: weights.proximity },
    ]),
    evidence: {
      conceptIds: uniqueSorted([
        ...directStates.map((state) => state.conceptId),
        ...proximityStates.map((state) => state.conceptId),
      ]),
    },
  };
}

function continuityComponent(
  candidate: ExperimentalCandidate,
  input: ExperimentalRankerInput,
  config: RecommendationConfig,
): ComponentResult {
  let bestValue = 0;
  let bestPost: ExperimentalCandidate | undefined;
  let bestConceptIds: string[] = [];
  let bestClaimIds: string[] = [];
  const weights = config.continuitySubweights;

  for (const recent of input.recentServed) {
    const conceptIds = relatedConcepts(candidate.post.conceptIds, recent.post.conceptIds, input.globalEdges);
    const sharedClaims = overlaps(candidate.post.claimIds, recent.post.claimIds);
    const opposingClaims = opposingClaimIds(candidate.post.claimIds, recent.post.claimIds, input.globalEdges);
    const claimIds = uniqueSorted([...sharedClaims, ...opposingClaims]);
    const value = weightedAvailable([
      { value: conceptIds.length > 0 ? 1 : 0, weight: weights.concept },
      { value: claimIds.length > 0 ? 1 : 0, weight: weights.claim },
      {
        value: candidate.features.viewpoint !== undefined
          && recent.features.viewpoint !== undefined
          && candidate.features.viewpoint !== recent.features.viewpoint ? 1 : 0,
        weight: weights.viewpointTransition,
      },
      { value: candidate.features.sourceId !== recent.features.sourceId ? 1 : 0, weight: weights.sourceTransition },
    ]);
    if (value > bestValue) {
      bestValue = value;
      bestPost = recent;
      bestConceptIds = conceptIds;
      bestClaimIds = claimIds;
    }
  }

  return {
    value: bestValue,
    evidence: bestPost === undefined
      ? {}
      : { postIds: [bestPost.post.id], conceptIds: bestConceptIds, claimIds: bestClaimIds },
  };
}

function referencePosts(input: ExperimentalRankerInput): ExperimentalCandidate[] {
  const byId = new Map<string, ExperimentalCandidate>();
  for (const post of [...input.recentServed, ...input.viewedPosts]) byId.set(post.post.id, post);
  return [...byId.values()].sort((left, right) => left.post.id.localeCompare(right.post.id));
}

function noveltyComponent(
  candidate: ExperimentalCandidate,
  input: ExperimentalRankerInput,
  config: RecommendationConfig,
): ComponentResult {
  const references = referencePosts(input);
  const referenceClaimIds = uniqueSorted(references.flatMap((post) => post.post.claimIds));
  const claimIds = opposingClaimIds(candidate.post.claimIds, referenceClaimIds, input.globalEdges);
  const viewpointPostIds = references
    .filter((post) => candidate.features.viewpoint !== undefined
      && post.features.viewpoint !== undefined
      && candidate.features.viewpoint !== post.features.viewpoint)
    .map((post) => post.post.id);
  const active = activeStates(input);
  const underexploredConceptIds = candidate.post.conceptIds.filter((candidateConceptId) => {
    const ownState = input.conceptStates.get(candidateConceptId);
    return (ownState === undefined || ownState.exposureCount === 0)
      && active.some((state) => input.globalEdges.some((edge) => (
        edge.type === 'related_to' || edge.type === 'prerequisite_of'
      ) && edgeConnects(edge, candidateConceptId, state.conceptId)));
  });
  const weights = config.noveltySubweights;

  return {
    value: weightedAvailable([
      { value: claimIds.length > 0 ? 1 : 0, weight: weights.opposingClaim },
      { value: viewpointPostIds.length > 0 ? 1 : 0, weight: weights.viewpointChange },
      { value: underexploredConceptIds.length > 0 ? 1 : 0, weight: weights.underexploredNeighbor },
    ]),
    evidence: {
      claimIds,
      postIds: uniqueSorted(viewpointPostIds),
      conceptIds: uniqueSorted(underexploredConceptIds),
    },
  };
}

function difficultyFitComponent(
  candidate: ExperimentalCandidate,
  input: ExperimentalRankerInput,
  config: RecommendationConfig,
): ComponentResult {
  const states = candidate.post.conceptIds
    .map((conceptId) => input.conceptStates.get(conceptId))
    .filter((state): state is UserConceptState => state !== undefined);
  const familiarity = states.length === 0
    ? 0
    : states.reduce((total, state) => total + clamp01(state.familiarityEstimate), 0) / states.length;
  const target = clamp01(
    config.difficultyFitCurve.minimumTarget
      + familiarity * config.difficultyFitCurve.familiarityRange,
  );
  return {
    value: clamp01(1 - Math.abs(clamp01(candidate.features.difficulty) - target)),
    evidence: { conceptIds: uniqueSorted(states.map((state) => state.conceptId)) },
  };
}

function redundancyComponent(
  candidate: ExperimentalCandidate,
  input: ExperimentalRankerInput,
  config: RecommendationConfig,
): ComponentResult {
  const weights = config.redundancySubweights;
  let bestValue = 0;
  let bestPost: ExperimentalCandidate | undefined;
  let bestClaimIds: string[] = [];

  for (const viewed of input.viewedPosts) {
    const semantic = vectorSimilarity(
      candidate.features.summaryVector,
      viewed.features.summaryVector,
      input,
      config,
    );
    const claimIds = overlaps(candidate.post.claimIds, viewed.post.claimIds);
    const value = weightedAvailable([
      {
        value: semantic.value >= config.redundancyVectorThreshold ? semantic.value : 0,
        weight: weights.semantic,
        available: semantic.available,
      },
      { value: claimIds.length > 0 ? 1 : 0, weight: weights.claim },
      { value: candidate.features.sourceId === viewed.features.sourceId ? 1 : 0, weight: weights.source },
      { value: candidate.features.format === viewed.features.format ? 1 : 0, weight: weights.format },
    ]);
    if (value > bestValue) {
      bestValue = value;
      bestPost = viewed;
      bestClaimIds = claimIds;
    }
  }

  return {
    value: bestValue,
    evidence: bestPost === undefined ? {} : { postIds: [bestPost.post.id], claimIds: bestClaimIds },
  };
}

function componentsFor(
  candidate: ExperimentalCandidate,
  input: ExperimentalRankerInput,
  config: RecommendationConfig,
): ExperimentalComponentScores {
  return {
    questionRelevance: questionRelevanceComponent(candidate, input, config),
    conceptInterestMatch: conceptInterestComponent(candidate, input, config),
    continuityWithRecentPosts: continuityComponent(candidate, input, config),
    noveltyOrContrast: noveltyComponent(candidate, input, config),
    contentQuality: contentQualityComponent(candidate, config),
    difficultyFit: difficultyFitComponent(candidate, input, config),
    redundancyPenalty: redundancyComponent(candidate, input, config),
  };
}

function ageMs(question: ExperimentalQuestion, input: ExperimentalRankerInput): number {
  const createdAt = Date.parse(question.createdAt);
  return Number.isFinite(createdAt) ? Math.max(0, input.now() - createdAt) : 0;
}

function bridgeConceptIds(candidate: ExperimentalCandidate, input: ExperimentalRankerInput): string[] {
  const activeCandidateConcepts = candidate.post.conceptIds.filter((conceptId) => input.conceptStates.has(conceptId));
  if (activeCandidateConcepts.length >= 2) return uniqueSorted(activeCandidateConcepts);
  for (let leftIndex = 0; leftIndex < candidate.post.conceptIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidate.post.conceptIds.length; rightIndex += 1) {
      const left = candidate.post.conceptIds[leftIndex];
      const right = candidate.post.conceptIds[rightIndex];
      if (input.globalEdges.some((edge) => (
        edge.type === 'related_to' || edge.type === 'prerequisite_of'
      ) && edgeConnects(edge, left, right))) return uniqueSorted([left, right]);
    }
  }
  return candidate.post.conceptIds.length >= 2 ? uniqueSorted(candidate.post.conceptIds.slice(0, 2)) : [];
}

export function selectStrategy(
  candidate: ExperimentalCandidate,
  input: ExperimentalRankerInput,
  config: RecommendationConfig = DEFAULT_RECOMMENDATION_CONFIG,
): StrategySelection {
  const directQuestions = input.questions.filter((question) => questionRelation(
    candidate,
    question,
    input.globalEdges,
  ).direct);
  const recentQuestions = directQuestions.filter((question) => ageMs(question, input) < config.echoMinAgeMs);
  const echoQuestions = directQuestions.filter((question) => ageMs(question, input) >= config.echoMinAgeMs);
  const references = referencePosts(input);
  const referenceClaimIds = uniqueSorted(references.flatMap((post) => post.post.claimIds));
  const contrastClaimIds = opposingClaimIds(candidate.post.claimIds, referenceClaimIds, input.globalEdges);
  const contrastPostIds = references
    .filter((post) => candidate.features.viewpoint !== undefined
      && post.features.viewpoint !== undefined
      && candidate.features.viewpoint !== post.features.viewpoint)
    .map((post) => post.post.id);
  const bridgeIds = bridgeConceptIds(candidate, input);
  const candidateStates = candidate.post.conceptIds
    .map((conceptId) => input.conceptStates.get(conceptId))
    .filter((state): state is UserConceptState => state !== undefined);
  const deepenAffinity = candidateStates.length > 0
    ? Math.max(...candidateStates.map((state) => clamp01(state.interestWeight)))
    : contentQualityComponent(candidate, config).value;
  const affinities: Record<ExperimentalRecommendationStrategy, number> = {
    continue: recentQuestions.length > 0 ? 1 : directQuestions.length > 0 ? 0.5 : 0,
    echo: echoQuestions.length > 0 ? 1 : 0,
    contrast: contrastClaimIds.length > 0 ? 1 : contrastPostIds.length > 0 ? 0.75 : 0,
    bridge: bridgeIds.length >= 2
      ? candidateStates.filter((state) => bridgeIds.includes(state.conceptId)).length >= 2 ? 1 : 0.5
      : 0,
    deepen: deepenAffinity,
  };
  const eligible = new Set<ExperimentalRecommendationStrategy>(['deepen']);
  if (directQuestions.length > 0) eligible.add('continue');
  if (echoQuestions.length > 0) eligible.add('echo');
  if (contrastClaimIds.length > 0 || contrastPostIds.length > 0) eligible.add('contrast');
  if (bridgeIds.length >= 2) eligible.add('bridge');
  const maximum = Math.max(...[...eligible].map((strategy) => affinities[strategy]));
  const strategy = config.strategyTieBreakOrder.find((candidateStrategy) => (
    eligible.has(candidateStrategy) && affinities[candidateStrategy] === maximum
  )) ?? 'deepen';

  let evidence: ComponentEvidence;
  switch (strategy) {
    case 'continue':
      evidence = { questionIds: uniqueSorted(directQuestions.map((question) => question.id)) };
      break;
    case 'echo':
      evidence = { questionIds: uniqueSorted(echoQuestions.map((question) => question.id)) };
      break;
    case 'contrast':
      evidence = { claimIds: contrastClaimIds, postIds: uniqueSorted(contrastPostIds) };
      break;
    case 'bridge':
      evidence = { conceptIds: bridgeIds };
      break;
    default:
      evidence = { conceptIds: uniqueSorted(candidate.post.conceptIds) };
  }
  return { strategy, affinity: maximum, affinities, evidence };
}

function candidateGenerationEvidence(
  candidate: ExperimentalCandidate,
  input: ExperimentalRankerInput,
  config: RecommendationConfig,
): CandidateGenerationEvidence | null {
  const sources: CandidateGenerationSource[] = [];
  const questionIds: string[] = [];
  const conceptIds: string[] = [];
  const claimIds: string[] = [];
  const postIds: string[] = [];
  const quality = contentQualityComponent(candidate, config).value;
  if (quality >= config.highQualityCandidateThreshold) sources.push('high_quality');

  const active = activeStates(input);
  const activeIds = active.map((state) => state.conceptId);
  const directActive = overlaps(candidate.post.conceptIds, activeIds);
  const nearbyActive = relatedConcepts(candidate.post.conceptIds, activeIds, input.globalEdges)
    .filter((conceptId) => activeIds.includes(conceptId) || candidate.post.conceptIds.includes(conceptId));
  if (directActive.length > 0 || nearbyActive.length > 0) {
    sources.push('active_concept');
    conceptIds.push(...directActive, ...nearbyActive);
  }

  for (const question of input.questions) {
    const relation = questionRelation(candidate, question, input.globalEdges);
    if (relation.direct) {
      sources.push('question_link');
      questionIds.push(question.id);
      conceptIds.push(...relation.conceptIds);
      claimIds.push(...relation.claimIds);
      if (ageMs(question, input) >= config.echoMinAgeMs) sources.push('echo');
    }
  }

  const activeClaimIds = uniqueSorted(input.questions.flatMap((question) => question.extractedClaimIds ?? []));
  const relatedClaims = postRelatesToClaims(candidate.post.id, activeClaimIds, input.globalEdges);
  const referenceClaims = uniqueSorted(referencePosts(input).flatMap((post) => post.post.claimIds));
  const opposingClaims = opposingClaimIds(candidate.post.claimIds, referenceClaims, input.globalEdges);
  if (relatedClaims.length > 0 || opposingClaims.length > 0) {
    sources.push('claim_relation');
    claimIds.push(...relatedClaims, ...opposingClaims);
    postIds.push(...referencePosts(input).map((post) => post.post.id));
  }

  const bridgeIds = bridgeConceptIds(candidate, input);
  if (bridgeIds.length >= 2) {
    sources.push('bridge');
    conceptIds.push(...bridgeIds);
  }
  const uniqueSources = [...new Set(sources)];
  if (uniqueSources.length === 0) return null;
  return {
    sources: uniqueSources,
    questionIds: uniqueSorted(questionIds),
    conceptIds: uniqueSorted(conceptIds),
    claimIds: uniqueSorted(claimIds),
    postIds: uniqueSorted(postIds),
    recentlyViewed: input.viewedPosts.some((viewed) => viewed.post.id === candidate.post.id),
  };
}

export function generateCandidates(
  input: ExperimentalRankerInput,
  config: RecommendationConfig = DEFAULT_RECOMMENDATION_CONFIG,
): GeneratedExperimentalCandidate[] {
  const generated = new Map<string, GeneratedExperimentalCandidate>();
  for (const candidate of input.candidates) {
    if (input.dismissedPostIds.has(candidate.post.id)) continue;
    const evidence = candidateGenerationEvidence(candidate, input, config);
    if (evidence === null) continue;
    generated.set(candidate.post.id, { ...candidate, generationEvidence: evidence });
  }
  return [...generated.values()].sort((left, right) => left.post.id.localeCompare(right.post.id));
}

function mergedEvidence(
  components: ExperimentalComponentScores,
  strategy: StrategySelection,
): Required<ComponentEvidence> {
  const evidence = [...Object.values(components).map((component) => component.evidence), strategy.evidence];
  return {
    questionIds: uniqueSorted(evidence.flatMap((item) => item.questionIds ?? [])),
    conceptIds: uniqueSorted(evidence.flatMap((item) => item.conceptIds ?? [])),
    postIds: uniqueSorted(evidence.flatMap((item) => item.postIds ?? [])),
    claimIds: uniqueSorted(evidence.flatMap((item) => item.claimIds ?? [])),
  };
}

export function scoreExperimental(
  input: ExperimentalRankerInput,
  config: RecommendationConfig = DEFAULT_RECOMMENDATION_CONFIG,
): ExperimentalRankedCandidate[] {
  const weights = config.weights;
  return generateCandidates(input, config)
    .map((generated): ExperimentalRankedCandidate => {
      const candidate: ExperimentalCandidate = { post: generated.post, features: generated.features };
      const componentScores = componentsFor(candidate, input, config);
      const score = clamp01(
        weights.questionRelevance * componentScores.questionRelevance.value
          + weights.conceptInterestMatch * componentScores.conceptInterestMatch.value
          + weights.continuityWithRecentPosts * componentScores.continuityWithRecentPosts.value
          + weights.noveltyOrContrast * componentScores.noveltyOrContrast.value
          + weights.contentQuality * componentScores.contentQuality.value
          + weights.difficultyFit * componentScores.difficultyFit.value
          - weights.redundancyPenalty * componentScores.redundancyPenalty.value,
      );
      const strategy = selectStrategy(candidate, input, config);
      const evidence = mergedEvidence(componentScores, strategy);
      return {
        postId: candidate.post.id,
        candidate,
        score,
        strategy: strategy.strategy,
        componentScores,
        contributingQuestionIds: evidence.questionIds,
        contributingConceptIds: evidence.conceptIds,
        contributingPostIds: evidence.postIds,
        contributingClaimIds: evidence.claimIds,
      };
    })
    .sort((left, right) => right.score !== left.score
      ? right.score - left.score
      : left.postId.localeCompare(right.postId));
}
