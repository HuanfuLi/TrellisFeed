import type { SourcePlatform, Viewpoint } from './content.types';

export type { Recommendation, UserConceptState } from './content.types';

export type GlobalEdgeType =
  | 'explains'
  | 'mentions'
  | 'supports'
  | 'challenges'
  | 'about'
  | 'contrasts_with'
  | 'related_to'
  | 'prerequisite_of'
  | 'targets';

export interface GlobalEdge {
  id: string;
  topicId: string;
  type: GlobalEdgeType;
  sourceId: string;
  targetId: string;
}

export interface SourceRecord {
  id: string;
  name: string;
  platform: SourcePlatform;
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
  viewpoint?: Viewpoint;
  summaryVector?: number[];
}

export type PersonalEdgeType =
  | 'viewed'
  | 'asked'
  | 'under'
  | 'asks_about'
  | 'interested_in'
  | 'confused_about'
  | 'revisited'
  | 'saved'
  | 'skipped'
  | 'echoed_by'
  | 'served';

export interface PersonalEdge {
  id: string;
  userId: string;
  type: PersonalEdgeType;
  sourceId: string;
  targetId: string;
  createdAt: string;
}

export interface GraphContribution {
  id: string;
  userId: string;
  conceptId: string;
  eventId: string;
  rule: string;
  delta: {
    interest?: number;
    uncertainty?: number;
    familiarity?: number;
    counts?: Record<string, number>;
  };
  createdAt: string;
}

export interface ExtractionJob {
  id: string;
  questionId: string;
  status: 'pending' | 'succeeded' | 'failed';
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationBatch {
  id: string;
  userId: string;
  sessionId: string;
  seq: number;
  recommendationIds: string[];
  status: 'building' | 'ready';
  diversityCounters: {
    sourceCounts: Record<string, number>;
    recentPrimaryConceptIds: string[];
  };
  createdAt: string;
}
