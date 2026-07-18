import type {
  Concept,
  Post,
  Recommendation,
  RecommendationStrategy,
  Topic,
  UserQuestion,
} from '../domain/content.types.ts';
import type {
  GlobalEdge,
  GlobalEdgeType,
  PostRankingFeatures,
  RecommendationBatch,
} from '../domain/graph.types.ts';
import {
  applyUserContentBracketing,
  chatCompletion,
  type CompletionOptions,
} from '../providers/llm/index.ts';
import type { LLMConfig, ServiceResult } from '../types/index.ts';
import { contentPoolRepository } from './content-pool.repository.ts';
import { frozenFeedService } from './frozen-feed.service.ts';
import { globalGraphRepository } from './global-graph.repository.ts';
import {
  RecommendationRepository,
  recommendationRepository,
} from './recommendation.repository.ts';
import { scoreControl, type ControlRankedCandidate } from './ranking/control-ranker.ts';
import { selectDiverse, type DiversityCandidate } from './ranking/diversity-reranker.ts';
import {
  scoreExperimental,
  type ExperimentalCandidate,
  type ExperimentalComponentScores,
  type ExperimentalRankedCandidate,
} from './ranking/experimental-ranker.ts';
import { studyContextService } from './study-context.service.ts';
import { settingsService } from './settings.service.ts';

export const RECOMMENDATION_BATCH_SIZE = 8;
export const REASON_MAX_CODE_POINTS = 280;

export const CONTROL_REASON_LABELS = Object.freeze({
  topic_baseline: 'Related to {conceptLabel}',
  quality_baseline: 'Popular explanation',
  diversity_baseline: 'Different viewpoint',
} as const);

const GLOBAL_EDGE_TYPES: readonly GlobalEdgeType[] = [
  'explains',
  'mentions',
  'supports',
  'challenges',
  'about',
  'contrasts_with',
  'related_to',
  'prerequisite_of',
  'targets',
];

interface StudyContextReader {
  getRequired(): {
    userId: string;
    condition: 'control' | 'experimental';
    topicId: string;
  };
}

interface FeedReader {
  getFeed(): readonly Post[];
  getPostById(postId: string): Readonly<Post> | null;
  getConcepts(postId: string): ReadonlyArray<Readonly<Concept>>;
}

interface GlobalGraphReader {
  rankingFeatures(postId: string): PostRankingFeatures | null;
  edgesByType(type: GlobalEdgeType): GlobalEdge[];
  embeddingFingerprint(): ReturnType<typeof globalGraphRepository.embeddingFingerprint>;
}

type SnapshotReaderKey = `read${'Snapshot'}`;

type PersonalRecommendationDependencies = {
  [Key in SnapshotReaderKey]: (userId: string) => Promise<ServiceResult<{
    userConceptStates: import('../domain/content.types.ts').UserConceptState[];
    personalEdges: import('../domain/graph.types.ts').PersonalEdge[];
    contributions: import('../domain/graph.types.ts').GraphContribution[];
  }>>;
} & {
  readQuestions(userId: string): Promise<UserQuestion[]>;
  getViewedPostIds(): string[];
};

interface ReasonMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type ReasonCompletion = (
  messages: ReasonMessage[],
  config: LLMConfig,
  options?: CompletionOptions,
) => Promise<string>;

export interface RecommendationServiceDependencies {
  studyContext: StudyContextReader;
  repository: RecommendationRepository;
  feed: FeedReader;
  getTopic(topicId: string): Topic | null;
  globalGraph: GlobalGraphReader;
  loadPersonalDependencies(): PersonalRecommendationDependencies | Promise<PersonalRecommendationDependencies>;
  completeReason: ReasonCompletion;
  getReasonConfig(): LLMConfig;
  bracketReasonMessages(messages: ReasonMessage[]): ReasonMessage[];
  now(): number;
  createId(kind: 'session' | 'batch' | 'recommendation'): string;
}

interface SelectedCandidate extends DiversityCandidate {
  readonly recommendation: Omit<Recommendation, 'id' | 'generatedAt' | 'reasonText'>;
  readonly conceptLabel: string;
}

interface ReasonResponseItem {
  candidateId: string;
  reasonText: string;
}

function success<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

function failure<T>(message: string): ServiceResult<T> {
  return {
    success: false,
    error: { code: 'DATABASE_ERROR', message, retryable: true },
  };
}

function randomId(kind: 'session' | 'batch' | 'recommendation'): string {
  const token = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${kind}-${token}`;
}

async function loadDefaultPersonalDependencies(): Promise<PersonalRecommendationDependencies> {
  const [{ graphMemoryService }, { postHistoryService }, { dbQuery }] = await Promise.all([
    import('./graph-memory.service.ts'),
    import('./post-history.service.ts'),
    import('./db.service.ts'),
  ]);
  const snapshotReaderKey: SnapshotReaderKey = `read${'Snapshot'}`;
  return {
    [snapshotReaderKey]: (userId: string) => {
      const methodName = snapshotReaderKey as keyof typeof graphMemoryService;
      const method = graphMemoryService[methodName] as PersonalRecommendationDependencies[SnapshotReaderKey];
      return method.call(graphMemoryService, userId);
    },
    async readQuestions(userId) {
      const rows = await dbQuery<{ data: string }>('SELECT * FROM user_questions WHERE user_id = ?', [userId]);
      return rows.map((row) => JSON.parse(row.data) as UserQuestion);
    },
    getViewedPostIds: () => postHistoryService.getViewedPostIds(),
  };
}

function productionReasonConfig(): LLMConfig {
  const settings = settingsService.getSync();
  if (!settings.preferences.aiConsentGiven) throw new Error('AI features are disabled');
  if (!settings.llm.isConfigured) {
    throw new Error('Add your API key in Settings to generate recommendation reasons.');
  }
  return settings.llm;
}

const defaultDependencies: RecommendationServiceDependencies = {
  studyContext: studyContextService,
  repository: recommendationRepository,
  feed: frozenFeedService,
  getTopic: (topicId) => contentPoolRepository.getTopic(topicId),
  globalGraph: globalGraphRepository,
  loadPersonalDependencies: loadDefaultPersonalDependencies,
  completeReason: chatCompletion,
  getReasonConfig: productionReasonConfig,
  bracketReasonMessages: applyUserContentBracketing,
  now: () => Date.now(),
  createId: randomId,
};

function componentValues(scores: ExperimentalComponentScores): Record<string, number> {
  return Object.fromEntries(Object.entries(scores).map(([name, component]) => [name, component.value]));
}

function controlStrategy(
  candidate: ControlRankedCandidate,
  seenFormats: Set<PostRankingFeatures['format']>,
): Extract<RecommendationStrategy, 'topic_baseline' | 'quality_baseline' | 'diversity_baseline'> {
  if (seenFormats.size > 0 && !seenFormats.has(candidate.candidate.features.format)) {
    return 'diversity_baseline';
  }
  return candidate.componentScores.topicRelevance >= candidate.componentScores.contentQuality
    ? 'topic_baseline'
    : 'quality_baseline';
}

function controlReason(strategy: SelectedCandidate['strategy'], conceptLabel: string): string {
  if (strategy === 'topic_baseline') {
    return CONTROL_REASON_LABELS.topic_baseline.replace('{conceptLabel}', conceptLabel);
  }
  if (strategy === 'diversity_baseline') return CONTROL_REASON_LABELS.diversity_baseline;
  return CONTROL_REASON_LABELS.quality_baseline;
}

function experimentalReason(strategy: RecommendationStrategy, conceptLabel: string): string {
  const action = strategy === 'contrast'
    ? 'Compare another viewpoint on'
    : strategy === 'bridge'
      ? 'Connect your exploration through'
      : strategy === 'echo'
        ? 'Revisit your earlier question about'
        : strategy === 'continue'
          ? 'Continue exploring'
          : 'Explore more deeply';
  return `${action} ${conceptLabel}.`;
}

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
  });
}

function isValidReasonText(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) return false;
  if ([...value].length > REASON_MAX_CODE_POINTS) return false;
  if (containsControlCharacter(value)) return false;
  if (/<\/?[A-Za-z][^>]*>/u.test(value)) return false;
  if (/(?:\b(?:score|weight|component)\s*:\s*[-+]?\d|\d+\s*:\s*\d)/iu.test(value)) return false;
  const sentenceBoundaries = value.match(/[.!?。！？](?=\s|$)/gu) ?? [];
  return sentenceBoundaries.length === 1 && /[.!?。！？]$/u.test(value);
}

function parseReasonItems(raw: string, requestedIds: ReadonlySet<string>): Map<string, string> {
  try {
    const parsed = JSON.parse(raw) as { reasons?: unknown };
    if (!Array.isArray(parsed.reasons)) return new Map();
    const values = new Map<string, string>();
    const duplicates = new Set<string>();
    for (const candidate of parsed.reasons) {
      if (!candidate || typeof candidate !== 'object') continue;
      const item = candidate as Partial<ReasonResponseItem>;
      if (typeof item.candidateId !== 'string' || !requestedIds.has(item.candidateId)) continue;
      if (values.has(item.candidateId)) duplicates.add(item.candidateId);
      if (isValidReasonText(item.reasonText)) values.set(item.candidateId, item.reasonText);
    }
    for (const duplicate of duplicates) values.delete(duplicate);
    return values;
  } catch {
    return new Map();
  }
}

export class RecommendationService {
  private readonly dependencies: RecommendationServiceDependencies;

  constructor(dependencies: Partial<RecommendationServiceDependencies> = {}) {
    this.dependencies = { ...defaultDependencies, ...dependencies };
  }

  async beginSession(sessionId = this.dependencies.createId('session')): Promise<ServiceResult<RecommendationBatch>> {
    try {
      const identity = this.dependencies.studyContext.getRequired();
      const existingResult = await this.dependencies.repository.readSessionBatches(identity.userId, sessionId);
      if (!existingResult.success) return failure(existingResult.error?.message ?? 'Recommendation session could not be read.');
      const first = existingResult.data?.find((batch) => batch.seq === 1);
      if (first?.status === 'ready') return success(first);
      return this.buildBatch(identity, sessionId, 1, first);
    } catch {
      return failure('The recommendation session could not be started.');
    }
  }

  async nextBatch(sessionId: string): Promise<ServiceResult<RecommendationBatch>> {
    try {
      const identity = this.dependencies.studyContext.getRequired();
      const existingResult = await this.dependencies.repository.readSessionBatches(identity.userId, sessionId);
      if (!existingResult.success) return failure(existingResult.error?.message ?? 'Recommendation session could not be read.');
      const batches = existingResult.data ?? [];
      const interrupted = [...batches].reverse().find((batch) => batch.status === 'building');
      if (interrupted) return this.buildBatch(identity, sessionId, interrupted.seq, interrupted);
      const nextSeq = (batches.at(-1)?.seq ?? 0) + 1;
      return this.buildBatch(identity, sessionId, nextSeq);
    } catch {
      return failure('The next recommendation batch could not be built.');
    }
  }

  async currentSessionItems(sessionId: string): Promise<ServiceResult<Recommendation[]>> {
    try {
      const identity = this.dependencies.studyContext.getRequired();
      const batchesResult = await this.dependencies.repository.readSessionBatches(identity.userId, sessionId);
      if (!batchesResult.success) return failure(batchesResult.error?.message ?? 'Recommendation session could not be read.');
      const recommendations = await this.readRecommendations(
        (batchesResult.data ?? []).filter((batch) => batch.status === 'ready'),
      );
      return success(recommendations);
    } catch {
      return failure('Recommendation session items could not be read.');
    }
  }

  private async buildBatch(
    identity: ReturnType<StudyContextReader['getRequired']>,
    sessionId: string,
    seq: number,
    interrupted?: RecommendationBatch,
  ): Promise<ServiceResult<RecommendationBatch>> {
    const batchId = interrupted?.id ?? this.dependencies.createId('batch');
    if (!interrupted) {
      const building: RecommendationBatch = {
        id: batchId,
        userId: identity.userId,
        sessionId,
        seq,
        recommendationIds: [],
        status: 'building',
        diversityCounters: { sourceCounts: {}, recentPrimaryConceptIds: [] },
        createdAt: new Date(this.dependencies.now()).toISOString(),
      };
      const saved = await this.dependencies.repository.saveBatch(building, []);
      if (!saved.success) return failure(saved.error?.message ?? 'Building batch could not be persisted.');
    }

    const priorResult = await this.dependencies.repository.readSessionBatches(identity.userId, sessionId);
    if (!priorResult.success) return failure(priorResult.error?.message ?? 'Prior batches could not be read.');
    const priorBatches = (priorResult.data ?? [])
      .filter((batch) => batch.seq < seq && batch.status === 'ready');
    const priorRecommendations = await this.readRecommendations(priorBatches);
    const selected = await this.materializeBatch(identity, priorBatches, priorRecommendations);
    const generatedAt = new Date(this.dependencies.now()).toISOString();
    const experimentalReasons = identity.condition === 'experimental'
      ? await this.generateReasons(selected.selected, selected.questions)
      : new Map<string, string>();
    const recommendations = selected.selected.map((item): Recommendation => ({
      id: this.dependencies.createId('recommendation'),
      ...item.recommendation,
      generatedAt,
      reasonText: identity.condition === 'control'
        ? controlReason(item.strategy, item.conceptLabel)
        : experimentalReasons.get(item.postId) ?? experimentalReason(item.strategy, item.conceptLabel),
    }));
    const ready: RecommendationBatch = {
      id: batchId,
      userId: identity.userId,
      sessionId,
      seq,
      recommendationIds: recommendations.map((item) => item.id),
      status: 'ready',
      diversityCounters: selected.nextCounters,
      createdAt: interrupted?.createdAt ?? generatedAt,
    };
    const saved = await this.dependencies.repository.saveBatch(ready, recommendations);
    return saved.success
      ? success(ready)
      : failure(saved.error?.message ?? 'Ready batch could not be persisted.');
  }

  private async materializeBatch(
    identity: ReturnType<StudyContextReader['getRequired']>,
    priorBatches: RecommendationBatch[],
    priorRecommendations: Recommendation[],
  ) {
    if (identity.condition === 'control') {
      return this.materializeControl(identity, priorBatches, priorRecommendations);
    }
    return this.materializeExperimental(identity, priorBatches, priorRecommendations);
  }

  private materializeControl(
    identity: ReturnType<StudyContextReader['getRequired']>,
    priorBatches: RecommendationBatch[],
    priorRecommendations: Recommendation[],
  ) {
    const topic = this.dependencies.getTopic(identity.topicId);
    if (!topic) throw new Error('Recommendation topic is unavailable');
    const alreadyServed = new Set(priorRecommendations.map((item) => item.postId));
    const posts = this.dependencies.feed.getFeed()
      .filter((post) => post.topicId === identity.topicId && !alreadyServed.has(post.id))
      .map((post) => ({ post, features: this.requireFeatures(post.id) }));
    const sessionServed = priorRecommendations.map((item) => {
      const features = this.requireFeatures(item.postId);
      return { sourceId: features.sourceId, format: features.format };
    });
    const ranked = scoreControl({
      posts,
      topic,
      seenPostIds: alreadyServed,
      dismissedPostIds: new Set(),
      sessionServed,
    });
    const seenFormats = new Set<PostRankingFeatures['format']>();
    const scored: SelectedCandidate[] = ranked.map((candidate) => {
      const strategy = controlStrategy(candidate, seenFormats);
      seenFormats.add(candidate.candidate.features.format);
      const conceptLabel = this.conceptLabel(candidate.postId, candidate.candidate.features.primaryConceptId);
      return {
        postId: candidate.postId,
        score: candidate.score,
        sourceId: candidate.candidate.features.sourceId,
        primaryConceptId: candidate.candidate.features.primaryConceptId,
        format: candidate.candidate.features.format,
        strategy,
        conceptLabel,
        recommendation: {
          userId: identity.userId,
          condition: identity.condition,
          topicId: identity.topicId,
          postId: candidate.postId,
          strategy,
          score: candidate.score,
          componentScores: { ...candidate.componentScores },
        },
      };
    });
    const selection = selectDiverse(scored, RECOMMENDATION_BATCH_SIZE, {
      sourceCounts: priorBatches.at(-1)?.diversityCounters.sourceCounts ?? {},
      recentPrimaryConceptIds: priorBatches.at(-1)?.diversityCounters.recentPrimaryConceptIds ?? [],
      historyQuestionCount: 0,
    });
    return { ...selection, questions: [] as UserQuestion[] };
  }

  private async materializeExperimental(
    identity: ReturnType<StudyContextReader['getRequired']>,
    priorBatches: RecommendationBatch[],
    priorRecommendations: Recommendation[],
  ) {
    const personal = await this.dependencies.loadPersonalDependencies();
    const [snapshotResult, questions] = await Promise.all([
      personal.readSnapshot(identity.userId),
      personal.readQuestions(identity.userId),
    ]);
    if (!snapshotResult.success || !snapshotResult.data) {
      throw new Error(snapshotResult.error?.message ?? 'Graph-memory snapshot is unavailable');
    }

    const alreadyServed = new Set(priorRecommendations.map((item) => item.postId));
    const candidates = this.dependencies.feed.getFeed()
      .filter((post) => post.topicId === identity.topicId && !alreadyServed.has(post.id))
      .map((post): ExperimentalCandidate => ({ post, features: this.requireFeatures(post.id) }));
    const candidateById = new Map(candidates.map((candidate) => [candidate.post.id, candidate]));
    const priorCandidates = priorRecommendations
      .map((item) => this.experimentalCandidate(item.postId))
      .filter((item): item is ExperimentalCandidate => item !== null);
    const viewedPosts = personal.getViewedPostIds()
      .map((postId) => candidateById.get(postId) ?? this.experimentalCandidate(postId))
      .filter((item): item is ExperimentalCandidate => item !== null);
    const conceptStates = new Map(snapshotResult.data.userConceptStates.map((state) => [state.conceptId, state]));
    const globalEdges = GLOBAL_EDGE_TYPES.flatMap((type) => this.dependencies.globalGraph.edgesByType(type));
    const ranked = scoreExperimental({
      candidates,
      globalEdges,
      questions,
      conceptStates,
      recentServed: priorCandidates.slice(-RECOMMENDATION_BATCH_SIZE),
      viewedPosts,
      dismissedPostIds: new Set(),
      embeddingFingerprint: this.dependencies.globalGraph.embeddingFingerprint() ?? undefined,
      now: this.dependencies.now,
    });
    const scored = ranked.map((candidate): SelectedCandidate => this.selectedExperimental(identity, candidate));
    const selection = selectDiverse(scored, RECOMMENDATION_BATCH_SIZE, {
      sourceCounts: priorBatches.at(-1)?.diversityCounters.sourceCounts ?? {},
      recentPrimaryConceptIds: priorBatches.at(-1)?.diversityCounters.recentPrimaryConceptIds ?? [],
      historyQuestionCount: questions.length,
    });
    return { ...selection, questions };
  }

  private async generateReasons(
    selected: readonly SelectedCandidate[],
    questions: readonly UserQuestion[],
  ): Promise<Map<string, string>> {
    const reasons = new Map<string, string>();
    if (selected.length === 0) return reasons;

    // An unconfigured/consent-revoked LLM must degrade to the deterministic
    // fallback below, not strand the batch in 'building' with an uncaught throw.
    let config: LLMConfig | null = null;
    try {
      config = this.dependencies.getReasonConfig();
    } catch {
      config = null;
    }
    let pending = [...selected];
    for (let attempt = 0; config !== null && attempt < 2 && pending.length > 0; attempt += 1) {
      const requestedIds = new Set(pending.map((item) => item.postId));
      let parsed = new Map<string, string>();
      try {
        const raw = await this.dependencies.completeReason(
          this.reasonMessages(pending, questions),
          config,
          {
            jsonMode: true,
            maxTokens: Math.max(512, pending.length * 120),
            serviceName: 'recommendation-reasons',
            disableThinking: true,
          },
        );
        parsed = parseReasonItems(raw, requestedIds);
      } catch {
        parsed = new Map();
      }
      for (const [candidateId, reasonText] of parsed) reasons.set(candidateId, reasonText);
      pending = pending.filter((item) => !reasons.has(item.postId));
    }

    for (const item of pending) {
      reasons.set(item.postId, experimentalReason(item.strategy, item.conceptLabel));
    }
    return reasons;
  }

  private reasonMessages(
    selected: readonly SelectedCandidate[],
    questions: readonly UserQuestion[],
  ): ReasonMessage[] {
    const questionsById = new Map(questions.map((question) => [question.id, question]));
    const items = selected.map((item) => {
      const post = this.dependencies.feed.getPostById(item.postId);
      if (!post) throw new Error(`Recommended post is unavailable: ${item.postId}`);
      const contributingQuestionIds = item.recommendation.contributingQuestionIds ?? [];
      const contributingConceptIds = item.recommendation.contributingConceptIds ?? [];
      const contributingPostIds = item.recommendation.contributingPostIds ?? [];
      return {
        candidateId: item.postId,
        strategy: item.strategy,
        recommendedPost: {
          title: post.displayTitle,
          summary: post.shortSummary,
        },
        contributingPriorQuestions: contributingQuestionIds
          .map((id) => questionsById.get(id))
          .filter((question): question is UserQuestion => question !== undefined)
          .map((question) => ({ id: question.id, text: question.text })),
        contributingConcepts: contributingConceptIds.map((id) => ({
          id,
          label: this.conceptLabelById(id),
        })),
        contributingPriorPosts: contributingPostIds.map((id) => ({
          id,
          title: this.dependencies.feed.getPostById(id)?.displayTitle ?? 'Prior post',
        })),
      };
    });
    return this.dependencies.bracketReasonMessages([
      {
        role: 'system',
        content: [
          'Generate a short user-facing recommendation reason.',
          '',
          'Input:',
          '- Strategy: Continue / Deepen / Contrast / Bridge / Echo',
          '- Current recommended post:',
          '- Contributing prior question, if any:',
          '- Contributing concept(s):',
          '- Contributing prior post(s):',
          '',
          'Rules:',
          '- One sentence.',
          '- Do not reveal internal scores.',
          '- Make it feel helpful, not creepy.',
          '- Do not overclaim.',
          '',
          'Return JSON only: {"reasons":[{"candidateId":string,"reasonText":string}]}.',
          'Return exactly one item for every supplied candidateId and do not invent IDs.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({ items }),
      },
    ]);
  }

  private conceptLabelById(conceptId: string): string {
    for (const post of this.dependencies.feed.getFeed()) {
      const concept = this.dependencies.feed.getConcepts(post.id)
        .find((candidate) => candidate.id === conceptId);
      if (concept) return concept.label;
    }
    return 'this topic';
  }

  private selectedExperimental(
    identity: ReturnType<StudyContextReader['getRequired']>,
    candidate: ExperimentalRankedCandidate,
  ): SelectedCandidate {
    const features = candidate.candidate.features;
    return {
      postId: candidate.postId,
      score: candidate.score,
      sourceId: features.sourceId,
      primaryConceptId: features.primaryConceptId,
      format: features.format,
      strategy: candidate.strategy,
      conceptLabel: this.conceptLabel(candidate.postId, features.primaryConceptId),
      recommendation: {
        userId: identity.userId,
        condition: identity.condition,
        topicId: identity.topicId,
        postId: candidate.postId,
        strategy: candidate.strategy,
        score: candidate.score,
        contributingQuestionIds: [...candidate.contributingQuestionIds],
        contributingConceptIds: [...candidate.contributingConceptIds],
        contributingPostIds: [...candidate.contributingPostIds],
        componentScores: componentValues(candidate.componentScores),
      },
    };
  }

  private experimentalCandidate(postId: string): ExperimentalCandidate | null {
    const post = this.dependencies.feed.getPostById(postId);
    const features = this.dependencies.globalGraph.rankingFeatures(postId);
    return post && features ? { post, features } : null;
  }

  private requireFeatures(postId: string): PostRankingFeatures {
    const features = this.dependencies.globalGraph.rankingFeatures(postId);
    if (!features) throw new Error(`Ranking features unavailable for ${postId}`);
    return features;
  }

  private conceptLabel(postId: string, conceptId: string): string {
    return this.dependencies.feed.getConcepts(postId)
      .find((concept) => concept.id === conceptId)?.label ?? 'this topic';
  }

  private async readRecommendations(batches: RecommendationBatch[]): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    for (const batch of batches) {
      for (const id of batch.recommendationIds) {
        const result = await this.dependencies.repository.readRecommendation(id);
        if (!result.success) throw new Error(result.error?.message ?? 'Recommendation could not be read');
        if (result.data) recommendations.push(result.data);
      }
    }
    return recommendations;
  }
}

export const recommendationService = new RecommendationService();
