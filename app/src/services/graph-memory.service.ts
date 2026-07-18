import type { UserConceptState, UserQuestion } from '../domain/content.types.ts';
import type {
  GraphContribution,
  PersonalEdge,
} from '../domain/graph.types.ts';
import { eventBus } from '../lib/event-bus.ts';
import type { ServiceResult, UserInteractionEvent } from '../types/index.ts';
import { dbExecute, dbQuery, type Row } from './db.service.ts';
import { globalGraphRepository } from './global-graph.repository.ts';

export const VIDEO_PROGRESS_THRESHOLD = 0.5;

export const GRAPH_MEMORY_RULES = {
  feed_impression: { interest: 0.05, counts: { exposureCount: 1 } },
  post_open: { interest: 0.10, counts: { exposureCount: 1 } },
  source_click: { interest: 0.20 },
  video_progress: { interest: 0.20 },
  question_submit: { interest: 0.30, counts: { questionCount: 1 } },
  save_post: { interest: 0.25, counts: { savedPostCount: 1 } },
  not_interested: { interest: -0.15, counts: { skippedPostCount: 1 } },
  repeated_skip: { interest: -0.10 },
  clarification_or_confusion: { uncertainty: 0.15 },
  repeated_question: { uncertainty: 0.10 },
  repeat_exposure: { familiarity: 0.05 },
  deeper_question: { familiarity: 0.10 },
  followed_echo: { familiarity: 0.10 },
} as const;

type GraphMemoryRule = keyof typeof GRAPH_MEMORY_RULES;
type CountField = 'exposureCount' | 'questionCount' | 'savedPostCount' | 'skippedPostCount';

interface StoredRow extends Row {
  id: string;
  user_id: string;
  data: string;
}

interface ContributionRow extends StoredRow {
  concept_id: string;
}

type StateRow = ContributionRow;

interface ResearchRecordRow extends Row {
  id: string;
  kind: string;
  data: string;
}

interface EventPayload {
  conceptIds?: unknown;
  progress?: unknown;
  followedEcho?: unknown;
  questionType?: unknown;
}

type EventWithPayload = UserInteractionEvent & { payload?: EventPayload };

export interface GraphMemorySnapshot {
  userConceptStates: UserConceptState[];
  personalEdges: PersonalEdge[];
  contributions: GraphContribution[];
}

const DEEP_QUESTION_TYPES = new Set(['evidence', 'counterpoint', 'implication']);
const UNCERTAIN_QUESTION_TYPES = new Set(['clarification', 'confusion']);

function success<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

function failure<T>(message: string): ServiceResult<T> {
  return {
    success: false,
    error: { code: 'DATABASE_ERROR', message, retryable: true },
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 1_000_000_000) / 1_000_000_000));
}

function parseData<T>(row: { data: string }): T {
  return JSON.parse(row.data) as T;
}

function sortBy<T>(values: T[], key: (value: T) => string): T[] {
  return values.sort((left, right) => key(left).localeCompare(key(right)));
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))].sort();
}

function contributionRule(event: EventWithPayload): GraphMemoryRule | null {
  if (event.eventType === 'video_progress') {
    const progress = typeof event.payload?.progress === 'number'
      ? event.payload.progress
      : event.durationMs;
    return typeof progress === 'number' && progress > VIDEO_PROGRESS_THRESHOLD
      ? 'video_progress'
      : null;
  }
  if (Object.hasOwn(GRAPH_MEMORY_RULES, event.eventType)) {
    return event.eventType as GraphMemoryRule;
  }
  return null;
}

function eventQuestionType(event: EventWithPayload): string | undefined {
  return typeof event.payload?.questionType === 'string' ? event.payload.questionType : undefined;
}

function contributionDelta(
  rule: GraphMemoryRule,
  event: EventWithPayload,
  prior: GraphContribution[],
): GraphContribution['delta'] {
  const configured = GRAPH_MEMORY_RULES[rule];
  const delta: GraphContribution['delta'] = {};
  if ('interest' in configured) delta.interest = configured.interest;
  if ('uncertainty' in configured) delta.uncertainty = configured.uncertainty;
  if ('familiarity' in configured) delta.familiarity = configured.familiarity;
  if ('counts' in configured) delta.counts = { ...configured.counts };

  if (rule === 'post_open' || rule === 'feed_impression') {
    const priorExposures = prior.reduce(
      (total, item) => total + (item.delta.counts?.exposureCount ?? 0),
      0,
    );
    if (priorExposures >= 2) {
      delta.familiarity = (delta.familiarity ?? 0) + GRAPH_MEMORY_RULES.repeat_exposure.familiarity;
    }
  }

  if (rule === 'question_submit') {
    const questionType = eventQuestionType(event);
    if (questionType && UNCERTAIN_QUESTION_TYPES.has(questionType)) {
      delta.uncertainty = (delta.uncertainty ?? 0) + GRAPH_MEMORY_RULES.clarification_or_confusion.uncertainty;
    }
    if (prior.some((item) => item.rule === 'question_submit')) {
      delta.uncertainty = (delta.uncertainty ?? 0) + GRAPH_MEMORY_RULES.repeated_question.uncertainty;
    }
    if (questionType && DEEP_QUESTION_TYPES.has(questionType)) {
      delta.familiarity = (delta.familiarity ?? 0) + GRAPH_MEMORY_RULES.deeper_question.familiarity;
    }
  }

  if (event.payload?.followedEcho === true) {
    delta.familiarity = (delta.familiarity ?? 0) + GRAPH_MEMORY_RULES.followed_echo.familiarity;
  }
  return delta;
}

class GraphMemoryService {
  private mutationQueue: Promise<void> = Promise.resolve();

  applyEvent(event: UserInteractionEvent): Promise<ServiceResult<string[]>> {
    return this.enqueue(() => this.applyEventNow(event as EventWithPayload));
  }

  applyQuestionExtraction(
    question: UserQuestion,
    conceptIds: string[],
    claimIds: string[],
  ): Promise<ServiceResult<string[]>> {
    return this.enqueue(() => this.applyQuestionExtractionNow(question, conceptIds, claimIds));
  }

  async conceptState(userId: string, conceptId: string): Promise<ServiceResult<UserConceptState | null>> {
    try {
      const rows = await dbQuery<StateRow>('SELECT * FROM user_concept_states WHERE user_id = ?', [userId]);
      const row = rows.find((candidate) => candidate.concept_id === conceptId);
      return success(row ? parseData<UserConceptState>(row) : null);
    } catch {
      return failure('The user concept state could not be read.');
    }
  }

  async readSnapshot(userId: string): Promise<ServiceResult<GraphMemorySnapshot>> {
    try {
      const [stateRows, edgeRows, contributionRows] = await Promise.all([
        dbQuery<StateRow>('SELECT * FROM user_concept_states WHERE user_id = ?', [userId]),
        dbQuery<StoredRow>('SELECT * FROM personal_graph_edges WHERE user_id = ?', [userId]),
        dbQuery<ContributionRow>('SELECT * FROM graph_contributions WHERE user_id = ?', [userId]),
      ]);
      return success({
        userConceptStates: sortBy(stateRows.map(parseData<UserConceptState>), (state) => `${state.userId}:${state.conceptId}`),
        personalEdges: sortBy(edgeRows.map(parseData<PersonalEdge>), (edge) => edge.id),
        contributions: sortBy(contributionRows.map(parseData<GraphContribution>), (item) => item.id),
      });
    } catch {
      return failure('The graph-memory snapshot could not be read.');
    }
  }

  async snapshot(): Promise<ServiceResult<GraphMemorySnapshot>> {
    try {
      const [stateRows, edgeRows, contributionRows] = await Promise.all([
        dbQuery<StateRow>('SELECT * FROM user_concept_states'),
        dbQuery<StoredRow>('SELECT * FROM personal_graph_edges'),
        dbQuery<ContributionRow>('SELECT * FROM graph_contributions'),
      ]);
      return success({
        userConceptStates: sortBy(stateRows.map(parseData<UserConceptState>), (state) => `${state.userId}:${state.conceptId}`),
        personalEdges: sortBy(edgeRows.map(parseData<PersonalEdge>), (edge) => edge.id),
        contributions: sortBy(contributionRows.map(parseData<GraphContribution>), (item) => item.id),
      });
    } catch {
      return failure('The graph-memory snapshot could not be created.');
    }
  }

  replayFromLog(userId: string): Promise<ServiceResult<string[]>> {
    return this.enqueue(async () => {
      try {
        const rows = await dbQuery<ResearchRecordRow>('SELECT * FROM research_records');
        const events = rows
          .filter((row) => row.kind === 'event')
          .map((row) => parseData<EventWithPayload>(row))
          .filter((event) => event.userId === userId)
          .sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id));
        await this.clearUserDerivedState(userId);
        const affected = new Set<string>();
        for (const event of events) {
          const result = await this.applyEventNow(event);
          if (!result.success) return result;
          for (const conceptId of result.data ?? []) affected.add(conceptId);
        }
        return success([...affected].sort());
      } catch {
        return failure('Graph memory could not be replayed from the canonical event log.');
      }
    });
  }

  repairOnBoot(): Promise<ServiceResult<number>> {
    return this.enqueue(async () => {
      try {
        const [recordRows, contributionRows] = await Promise.all([
          dbQuery<ResearchRecordRow>('SELECT * FROM research_records'),
          dbQuery<ContributionRow>('SELECT * FROM graph_contributions'),
        ]);
        const knownIds = new Set(contributionRows.map((row) => row.id));
        const events = recordRows
          .filter((row) => row.kind === 'event')
          .map((row) => parseData<EventWithPayload>(row))
          .sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id));
        let repaired = 0;
        for (const event of events) {
          const rule = contributionRule(event);
          if (!rule) continue;
          const expectedIds = this.resolveConceptIds(event)
            .map((conceptId) => `${event.id}:${conceptId}:${rule}`);
          const missingIds = expectedIds.filter((id) => !knownIds.has(id));
          if (missingIds.length === 0) continue;
          const result = await this.applyEventNow(event, false);
          if (!result.success) return failure('Graph-memory boot repair could not apply a missing event.');
          repaired += missingIds.length;
          for (const id of expectedIds) knownIds.add(id);
        }
        return success(repaired);
      } catch {
        return failure('Graph memory could not be repaired from the canonical event log.');
      }
    });
  }

  private enqueue<T>(operation: () => Promise<ServiceResult<T>>): Promise<ServiceResult<T>> {
    const pending = this.mutationQueue.then(operation, operation);
    this.mutationQueue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  private async applyEventNow(
    event: EventWithPayload,
    writePersonalEdge = true,
  ): Promise<ServiceResult<string[]>> {
    try {
      const conceptIds = this.resolveConceptIds(event);
      const rule = contributionRule(event);
      const existingRows = await dbQuery<ContributionRow>(
        'SELECT * FROM graph_contributions WHERE user_id = ?',
        [event.userId],
      );
      const existing = existingRows.map(parseData<GraphContribution>);
      const duplicateEvent = existing.some((item) => item.eventId === event.id);

      if (rule) {
        for (const conceptId of conceptIds) {
          const prior = existing.filter(
            (item) => item.conceptId === conceptId && item.eventId !== event.id &&
              (item.createdAt < event.timestamp ||
                (item.createdAt === event.timestamp && item.eventId.localeCompare(event.id) < 0)),
          );
          await this.writeContribution({
            id: `${event.id}:${conceptId}:${rule}`,
            userId: event.userId,
            conceptId,
            eventId: event.id,
            rule,
            delta: contributionDelta(rule, event, prior),
            createdAt: event.timestamp,
          });
          if (rule === 'not_interested' && prior.some((item) => item.rule === 'not_interested')) {
            await this.writeContribution({
              id: `${event.id}:${conceptId}:repeated_skip`,
              userId: event.userId,
              conceptId,
              eventId: event.id,
              rule: 'repeated_skip',
              delta: contributionDelta('repeated_skip', event, prior),
              createdAt: event.timestamp,
            });
          }
        }
        for (const conceptId of conceptIds) await this.rebuildConceptState(event.userId, conceptId);
      }

      const edgeChanged = writePersonalEdge
        ? await this.writeInteractionEdge(event, duplicateEvent)
        : false;
      if ((rule && conceptIds.length > 0) || edgeChanged) {
        eventBus.emit({
          type: 'GRAPH_UPDATED',
          payload: { kind: 'interaction', affectedIds: conceptIds },
        });
      }
      return success(conceptIds);
    } catch {
      return failure('The interaction could not be applied to graph memory.');
    }
  }

  private async applyQuestionExtractionNow(
    question: UserQuestion,
    rawConceptIds: string[],
    rawClaimIds: string[],
  ): Promise<ServiceResult<string[]>> {
    try {
      const conceptIds = uniqueStrings(rawConceptIds);
      const claimIds = uniqueStrings(rawClaimIds);
      const syntheticEvent: EventWithPayload = {
        id: question.id,
        userId: question.userId,
        condition: question.condition,
        topicId: question.topicId,
        timestamp: question.createdAt,
        eventType: 'question_submit',
        postId: question.postId,
        questionId: question.id,
        payload: { conceptIds, questionType: question.questionType },
      };
      const existingRows = await dbQuery<ContributionRow>(
        'SELECT * FROM graph_contributions WHERE user_id = ?',
        [question.userId],
      );
      const existing = existingRows.map(parseData<GraphContribution>);
      for (const conceptId of conceptIds) {
        const prior = existing.filter(
          (item) => item.conceptId === conceptId && item.eventId !== question.id &&
            (item.createdAt < question.createdAt ||
              (item.createdAt === question.createdAt && item.eventId.localeCompare(question.id) < 0)),
        );
        await this.writeContribution({
          id: `${question.id}:${conceptId}:question_submit`,
          userId: question.userId,
          conceptId,
          eventId: question.id,
          rule: 'question_submit',
          delta: contributionDelta('question_submit', syntheticEvent, prior),
          createdAt: question.createdAt,
        });
        await this.rebuildConceptState(question.userId, conceptId);
      }
      for (const targetId of [...conceptIds, ...claimIds]) {
        await this.writeEdge({
          id: `${question.id}:asks_about:${targetId}`,
          userId: question.userId,
          type: 'asks_about',
          sourceId: question.id,
          targetId,
          createdAt: question.createdAt,
        });
      }
      if (conceptIds.length > 0 || claimIds.length > 0) {
        eventBus.emit({
          type: 'GRAPH_UPDATED',
          payload: { kind: 'interaction', affectedIds: [...conceptIds, ...claimIds].sort() },
        });
      }
      return success(conceptIds);
    } catch {
      return failure('Question extraction could not be applied to graph memory.');
    }
  }

  private resolveConceptIds(event: EventWithPayload): string[] {
    const payloadConceptIds = uniqueStrings(event.payload?.conceptIds);
    if (payloadConceptIds.length > 0) return payloadConceptIds;
    if (!event.postId) return [];
    try {
      const concepts = new Set<string>();
      const features = globalGraphRepository.rankingFeatures(event.postId);
      if (features?.primaryConceptId) concepts.add(features.primaryConceptId);
      for (const edge of globalGraphRepository.edgesFrom(event.postId)) {
        if (edge.type === 'mentions') concepts.add(edge.targetId);
      }
      return [...concepts].sort();
    } catch {
      return [];
    }
  }

  private async writeContribution(contribution: GraphContribution): Promise<void> {
    await dbExecute(
      'INSERT OR REPLACE INTO graph_contributions (id, user_id, concept_id, data) VALUES (?, ?, ?, ?)',
      [contribution.id, contribution.userId, contribution.conceptId, JSON.stringify(contribution)],
    );
  }

  private async rebuildConceptState(userId: string, conceptId: string): Promise<void> {
    const rows = await dbQuery<ContributionRow>(
      'SELECT * FROM graph_contributions WHERE user_id = ?',
      [userId],
    );
    const contributions = rows
      .map(parseData<GraphContribution>)
      .filter((item) => item.conceptId === conceptId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
    const counts: Record<CountField, number> = {
      exposureCount: 0,
      questionCount: 0,
      savedPostCount: 0,
      skippedPostCount: 0,
    };
    let interest = 0;
    let uncertainty = 0;
    let familiarity = 0;
    let lastActivatedAt: string | undefined;
    for (const contribution of contributions) {
      interest += contribution.delta.interest ?? 0;
      uncertainty += contribution.delta.uncertainty ?? 0;
      familiarity += contribution.delta.familiarity ?? 0;
      for (const field of Object.keys(counts) as CountField[]) {
        counts[field] += contribution.delta.counts?.[field] ?? 0;
      }
      if (!lastActivatedAt || contribution.createdAt > lastActivatedAt) {
        lastActivatedAt = contribution.createdAt;
      }
    }
    const state: UserConceptState = {
      userId,
      conceptId,
      ...counts,
      ...(lastActivatedAt ? { lastActivatedAt } : {}),
      interestWeight: clamp(interest),
      uncertaintyWeight: clamp(uncertainty),
      familiarityEstimate: clamp(familiarity),
    };
    await dbExecute(
      'INSERT OR REPLACE INTO user_concept_states (id, user_id, concept_id, data) VALUES (?, ?, ?, ?)',
      [`${userId}:${conceptId}`, userId, conceptId, JSON.stringify(state)],
    );
  }

  private async writeInteractionEdge(event: EventWithPayload, duplicateEvent: boolean): Promise<boolean> {
    if (!event.postId) return false;
    let type: PersonalEdge['type'] | null = null;
    if (event.eventType === 'post_open') {
      if (duplicateEvent) return false;
      const rows = await dbQuery<StoredRow>('SELECT * FROM personal_graph_edges WHERE user_id = ?', [event.userId]);
      const alreadyViewed = rows
        .map(parseData<PersonalEdge>)
        .some((edge) => edge.type === 'viewed' && edge.targetId === event.postId);
      type = alreadyViewed ? 'revisited' : 'viewed';
    } else if (event.eventType === 'save_post') {
      type = 'saved';
    } else if (event.eventType === 'not_interested') {
      type = 'skipped';
    }
    if (!type) return false;
    await this.writeEdge({
      id: `${event.userId}:${type}:${event.postId}`,
      userId: event.userId,
      type,
      sourceId: event.userId,
      targetId: event.postId,
      createdAt: event.timestamp,
    });
    return true;
  }

  private async writeEdge(edge: PersonalEdge): Promise<void> {
    await dbExecute(
      'INSERT OR REPLACE INTO personal_graph_edges (id, user_id, data) VALUES (?, ?, ?)',
      [edge.id, edge.userId, JSON.stringify(edge)],
    );
  }

  private async clearUserDerivedState(userId: string): Promise<void> {
    await dbExecute('DELETE FROM user_concept_states WHERE user_id = ?', [userId]);
    await dbExecute('DELETE FROM graph_contributions WHERE user_id = ?', [userId]);
    await dbExecute('DELETE FROM personal_graph_edges WHERE user_id = ?', [userId]);
  }
}

export const graphMemoryService = new GraphMemoryService();
