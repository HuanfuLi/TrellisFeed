import type { EmbeddingFingerprint } from '../domain/graph.types.ts';

export type ExperimentalRecommendationStrategy = 'continue' | 'deepen' | 'contrast' | 'bridge' | 'echo';

export interface RecommendationConfig {
  readonly weights: {
    readonly questionRelevance: number;
    readonly conceptInterestMatch: number;
    readonly continuityWithRecentPosts: number;
    readonly noveltyOrContrast: number;
    readonly contentQuality: number;
    readonly difficultyFit: number;
    readonly redundancyPenalty: number;
  };
  readonly controlWeights: {
    readonly contentQuality: number;
    readonly topicRelevance: number;
    readonly generalInterestingness: number;
    readonly difficultyBalance: number;
    readonly diversity: number;
    readonly recentlySeenPenalty: number;
  };
  readonly echoMinAgeMs: number;
  readonly diversity: {
    readonly maxSameSourcePerSession: number;
    readonly maxSamePrimaryConceptRun: number;
    readonly sufficientHistoryQuestionCount: number;
  };
  readonly strategyTieBreakOrder: readonly ExperimentalRecommendationStrategy[];
  readonly videoProgressThreshold: number;
  readonly contentQualitySubweights: {
    readonly quality: number;
    readonly educationalValue: number;
    readonly interestingness: number;
  };
  readonly controlDiversitySubweights: {
    readonly source: number;
    readonly format: number;
  };
  readonly questionRelevanceSubweights: {
    readonly semantic: number;
    readonly concept: number;
    readonly claim: number;
    readonly unresolved: number;
  };
  readonly conceptInterestSubweights: {
    readonly direct: number;
    readonly proximity: number;
  };
  readonly continuitySubweights: {
    readonly concept: number;
    readonly claim: number;
    readonly viewpointTransition: number;
    readonly sourceTransition: number;
  };
  readonly noveltySubweights: {
    readonly opposingClaim: number;
    readonly viewpointChange: number;
    readonly underexploredNeighbor: number;
  };
  readonly redundancySubweights: {
    readonly semantic: number;
    readonly claim: number;
    readonly source: number;
    readonly format: number;
  };
  readonly redundancyVectorThreshold: number;
  readonly highQualityCandidateThreshold: number;
  readonly difficultyFitCurve: {
    readonly minimumTarget: number;
    readonly familiarityRange: number;
  };
  readonly runtimeEmbeddingFingerprint?: EmbeddingFingerprint;
}

function deepFreeze<T extends object>(value: T): T {
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return Object.freeze(value);
}

export const DEFAULT_RECOMMENDATION_CONFIG: RecommendationConfig = deepFreeze({
  weights: {
    questionRelevance: 0.25,
    conceptInterestMatch: 0.20,
    continuityWithRecentPosts: 0.15,
    noveltyOrContrast: 0.15,
    contentQuality: 0.15,
    difficultyFit: 0.10,
    redundancyPenalty: 0.20,
  },
  controlWeights: {
    contentQuality: 0.40,
    topicRelevance: 0.25,
    generalInterestingness: 0.15,
    difficultyBalance: 0.10,
    diversity: 0.10,
    recentlySeenPenalty: 0.20,
  },
  echoMinAgeMs: 86_400_000,
  diversity: {
    maxSameSourcePerSession: 2,
    maxSamePrimaryConceptRun: 2,
    sufficientHistoryQuestionCount: 3,
  },
  strategyTieBreakOrder: ['continue', 'echo', 'contrast', 'bridge', 'deepen'],
  videoProgressThreshold: 0.70,
  contentQualitySubweights: {
    quality: 1 / 3,
    educationalValue: 1 / 3,
    interestingness: 1 / 3,
  },
  controlDiversitySubweights: {
    source: 0.50,
    format: 0.50,
  },
  questionRelevanceSubweights: {
    semantic: 0.35,
    concept: 0.30,
    claim: 0.20,
    unresolved: 0.15,
  },
  conceptInterestSubweights: {
    direct: 0.75,
    proximity: 0.25,
  },
  continuitySubweights: {
    concept: 0.40,
    claim: 0.25,
    viewpointTransition: 0.20,
    sourceTransition: 0.15,
  },
  noveltySubweights: {
    opposingClaim: 0.50,
    viewpointChange: 0.25,
    underexploredNeighbor: 0.25,
  },
  redundancySubweights: {
    semantic: 0.40,
    claim: 0.25,
    source: 0.20,
    format: 0.15,
  },
  redundancyVectorThreshold: 0.85,
  highQualityCandidateThreshold: 0.65,
  difficultyFitCurve: {
    minimumTarget: 0.35,
    familiarityRange: 0.55,
  },
});
