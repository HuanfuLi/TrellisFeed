import type { RecommendationStrategy } from '../../domain/content.types.ts';
import type { PostRankingFeatures } from '../../domain/graph.types.ts';
import {
  DEFAULT_RECOMMENDATION_CONFIG,
  type RecommendationConfig,
} from '../recommendation-config.ts';

export interface DiversityCandidate {
  readonly postId: string;
  readonly score: number;
  readonly sourceId: string;
  readonly primaryConceptId: string;
  readonly format: PostRankingFeatures['format'];
  readonly strategy: RecommendationStrategy;
}

export interface DiversitySessionCounters {
  readonly sourceCounts: Readonly<Record<string, number>>;
  readonly recentPrimaryConceptIds: readonly string[];
  readonly historyQuestionCount: number;
}

export interface DiversitySelectionResult<T extends DiversityCandidate> {
  readonly selected: T[];
  readonly nextCounters: {
    readonly sourceCounts: Record<string, number>;
    readonly recentPrimaryConceptIds: string[];
  };
}

interface MutableDiversityState {
  readonly sourceCounts: Record<string, number>;
  recentPrimaryConceptIds: string[];
}

const safeScore = (candidate: DiversityCandidate): number => Number.isFinite(candidate.score)
  ? candidate.score
  : Number.NEGATIVE_INFINITY;

function scoreThenPostId<T extends DiversityCandidate>(left: T, right: T): number {
  const leftScore = safeScore(left);
  const rightScore = safeScore(right);
  return rightScore !== leftScore
    ? rightScore - leftScore
    : left.postId.localeCompare(right.postId);
}

function consecutiveTailCount(values: readonly string[], value: string): number {
  let count = 0;
  for (let index = values.length - 1; index >= 0 && values[index] === value; index -= 1) count += 1;
  return count;
}

function canAppend(
  candidate: DiversityCandidate,
  state: MutableDiversityState,
  config: RecommendationConfig,
): boolean {
  const sourceCount = state.sourceCounts[candidate.sourceId] ?? 0;
  if (sourceCount >= config.diversity.maxSameSourcePerSession) return false;
  return consecutiveTailCount(state.recentPrimaryConceptIds, candidate.primaryConceptId)
    < config.diversity.maxSamePrimaryConceptRun;
}

function appendCandidate(
  candidate: DiversityCandidate,
  state: MutableDiversityState,
  config: RecommendationConfig,
): void {
  state.sourceCounts[candidate.sourceId] = (state.sourceCounts[candidate.sourceId] ?? 0) + 1;
  state.recentPrimaryConceptIds = [
    ...state.recentPrimaryConceptIds,
    candidate.primaryConceptId,
  ].slice(-config.diversity.maxSamePrimaryConceptRun);
}

function initialState(counters: DiversitySessionCounters, config: RecommendationConfig): MutableDiversityState {
  return {
    sourceCounts: Object.fromEntries(Object.entries(counters.sourceCounts).map(([sourceId, count]) => [
      sourceId,
      Math.max(0, Math.trunc(Number.isFinite(count) ? count : 0)),
    ])),
    recentPrimaryConceptIds: [...counters.recentPrimaryConceptIds]
      .slice(-config.diversity.maxSamePrimaryConceptRun),
  };
}

function stateAfter<T extends DiversityCandidate>(
  selected: readonly T[],
  counters: DiversitySessionCounters,
  config: RecommendationConfig,
): MutableDiversityState | null {
  const state = initialState(counters, config);
  for (const candidate of selected) {
    if (!canAppend(candidate, state, config)) return null;
    appendCandidate(candidate, state, config);
  }
  return state;
}

function dedupeAndSort<T extends DiversityCandidate>(scored: readonly T[]): T[] {
  const sorted = [...scored].sort(scoreThenPostId);
  const byPostId = new Map<string, T>();
  for (const candidate of sorted) {
    if (!byPostId.has(candidate.postId)) byPostId.set(candidate.postId, candidate);
  }
  return [...byPostId.values()];
}

function selectGreedy<T extends DiversityCandidate>(
  candidates: readonly T[],
  batchSize: number,
  counters: DiversitySessionCounters,
  config: RecommendationConfig,
): T[] {
  const remaining = [...candidates];
  const selected: T[] = [];
  const usedFormats = new Set<PostRankingFeatures['format']>();
  const state = initialState(counters, config);

  while (selected.length < batchSize) {
    const legal = remaining.filter((candidate) => canAppend(candidate, state, config));
    if (legal.length === 0) break;
    const highestScore = safeScore(legal[0]);
    const tied = legal
      .filter((candidate) => safeScore(candidate) === highestScore)
      .sort((left, right) => {
        const leftAddsFormat = usedFormats.has(left.format) ? 1 : 0;
        const rightAddsFormat = usedFormats.has(right.format) ? 1 : 0;
        return leftAddsFormat !== rightAddsFormat
          ? leftAddsFormat - rightAddsFormat
          : left.postId.localeCompare(right.postId);
      });
    const chosen = tied[0];
    selected.push(chosen);
    usedFormats.add(chosen.format);
    appendCandidate(chosen, state, config);
    remaining.splice(remaining.findIndex((candidate) => candidate.postId === chosen.postId), 1);
  }

  return selected;
}

const isReservedStrategy = (candidate: DiversityCandidate): boolean => (
  candidate.strategy === 'contrast' || candidate.strategy === 'bridge'
);

function reserveProgressionSlot<T extends DiversityCandidate>(
  selected: readonly T[],
  allCandidates: readonly T[],
  counters: DiversitySessionCounters,
  config: RecommendationConfig,
): T[] {
  if (counters.historyQuestionCount < config.diversity.sufficientHistoryQuestionCount
    || selected.some(isReservedStrategy)) return [...selected];

  const selectedIds = new Set(selected.map((candidate) => candidate.postId));
  const reserves = allCandidates
    .filter((candidate) => isReservedStrategy(candidate) && !selectedIds.has(candidate.postId))
    .sort(scoreThenPostId);
  const removalIndexes = selected
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) => {
      const scoreOrder = safeScore(left.candidate) - safeScore(right.candidate);
      return scoreOrder !== 0
        ? scoreOrder
        : right.candidate.postId.localeCompare(left.candidate.postId);
    });

  for (const reserve of reserves) {
    for (const removal of removalIndexes) {
      const replacement = [...selected];
      replacement[removal.index] = reserve;
      if (stateAfter(replacement, counters, config) !== null) return replacement;
    }
  }
  return [...selected];
}

export function selectDiverse<T extends DiversityCandidate>(
  scored: readonly T[],
  batchSize: number,
  counters: DiversitySessionCounters,
  config: RecommendationConfig = DEFAULT_RECOMMENDATION_CONFIG,
): DiversitySelectionResult<T> {
  const size = Math.max(0, Math.trunc(Number.isFinite(batchSize) ? batchSize : 0));
  const candidates = dedupeAndSort(scored);
  const greedy = selectGreedy(candidates, size, counters, config);
  const selected = reserveProgressionSlot(greedy, candidates, counters, config);
  const nextState = stateAfter(selected, counters, config);
  if (nextState === null) throw new Error('Diversity reranker produced an invalid hard-cap sequence');

  return {
    selected,
    nextCounters: {
      sourceCounts: nextState.sourceCounts,
      recentPrimaryConceptIds: nextState.recentPrimaryConceptIds,
    },
  };
}
