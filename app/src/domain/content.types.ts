export type StudyCondition = 'control' | 'experimental';

export interface Topic {
  id: string;
  name: string;
  shortDescription: string;
  hooks: string[];
  coreConceptIds: string[];
  testRubricId: string;
  contentPoolVersion: string;
}

export type SourcePlatform = 'youtube' | 'article' | 'blog' | 'newsletter' | 'x' | 'reddit' | 'news' | 'other';
export type Viewpoint = 'supportive' | 'critical' | 'neutral' | 'mixed';
export type PostStatus = 'raw' | 'preprocessed' | 'approved' | 'rejected' | 'frozen';

export interface Post {
  id: string;
  topicId: string;
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  sourceName: string;
  author?: string;
  originalTitle: string;
  displayTitle: string;
  hook: string;
  shortSummary: string;
  longSummary?: string;
  language: string;
  durationSeconds?: number;
  readingTimeMinutes?: number;
  thumbnailUrl?: string;
  originalPublishedAt?: string;
  collectedAt: string;
  approvedAt?: string;
  qualityScore: number;
  interestingnessScore: number;
  educationalValueScore: number;
  difficulty: number;
  viewpoint?: Viewpoint;
  conceptIds: string[];
  claimIds: string[];
  suggestedQuestionIds: string[];
  status: PostStatus;
}

export interface Concept {
  id: string;
  topicId: string;
  label: string;
  description: string;
  aliases: string[];
  parentConceptIds?: string[];
  prerequisiteConceptIds?: string[];
}

export interface Claim {
  id: string;
  topicId: string;
  text: string;
  stance?: 'pro' | 'con' | 'neutral' | 'mixed';
  conceptIds: string[];
}

export interface SuggestedQuestion {
  id: string;
  postId: string;
  topicId: string;
  text: string;
  type: 'clarification' | 'evidence' | 'counterpoint' | 'connection' | 'implication' | 'example' | 'reliability';
  targetConceptIds: string[];
  targetClaimIds?: string[];
  generic: boolean;
}

export interface UserQuestion {
  id: string;
  userId: string;
  condition: StudyCondition;
  topicId: string;
  postId: string;
  text: string;
  source: 'typed' | 'suggested_question';
  suggestedQuestionId?: string;
  createdAt: string;
  extractedConceptIds: string[];
  extractedClaimIds?: string[];
  questionType?: string;
  unresolved?: boolean;
  aiAnswerId?: string;
}

export interface AIAnswer {
  id: string;
  userQuestionId: string;
  postId: string;
  answerText: string;
  citedPostIds: string[];
  citedSourceUrls?: string[];
  conceptIds: string[];
  claimIds?: string[];
  createdAt: string;
  modelName: string;
}

export type RecommendationStrategy = 'topic_baseline' | 'quality_baseline' | 'diversity_baseline' | 'continue' | 'deepen' | 'contrast' | 'bridge' | 'echo';

export interface Recommendation {
  id: string;
  userId: string;
  condition: StudyCondition;
  topicId: string;
  postId: string;
  generatedAt: string;
  strategy: RecommendationStrategy;
  score: number;
  reasonText: string;
  contributingQuestionIds?: string[];
  contributingConceptIds?: string[];
  contributingPostIds?: string[];
  componentScores?: Record<string, number>;
}

export interface UserConceptState {
  userId: string;
  conceptId: string;
  exposureCount: number;
  questionCount: number;
  savedPostCount: number;
  skippedPostCount: number;
  lastActivatedAt?: string;
  interestWeight: number;
  uncertaintyWeight: number;
  familiarityEstimate: number;
}

export interface OriginalContentAsset {
  postId: string;
  kind: 'article' | 'video';
  sourceUrl: string;
  body?: string;
  videoId?: string;
  digest?: string;
  sha256: string;
}

export interface FrozenPoolManifest {
  contentPoolVersion: string;
  generatedAt: string;
  preprocessingModelVersions: string[];
  collectorVersions?: string[];
  promptVersions?: string[];
  schemaVersions?: string[];
  rawCandidateCount: number;
  approvedCount: number;
  rejectedCount: number;
  sourceFormatDistribution?: Record<'article' | 'video', number>;
  stanceDistribution?: Record<'supportive' | 'critical' | 'neutral' | 'mixed', number>;
  reviewProcedureSummary: string;
  counts: Record<'topics' | 'posts' | 'concepts' | 'claims' | 'suggestedQuestions' | 'sourceAssets', number>;
  artifactHashes: Record<'topics.json' | 'posts.json' | 'concepts.json' | 'claims.json' | 'suggested_questions.json' | 'source_assets.json', string>;
  feedOrderPostIds: string[];
  fixedFilenames?: string[];
  bundleFileHashes?: Record<string, string>;
}

export interface FrozenPoolBundle {
  manifest: FrozenPoolManifest;
  topics: Topic[];
  posts: Post[];
  concepts: Concept[];
  claims: Claim[];
  suggestedQuestions: SuggestedQuestion[];
  sourceAssets: OriginalContentAsset[];
}
