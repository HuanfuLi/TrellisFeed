import type { Recommendation } from '../domain/content.types.ts';
import type { RecommendationBatch } from '../domain/graph.types.ts';
import type { RecommendationResearchRecord } from '../types/index.ts';
import { dbExecute, dbQuery } from './db.service.ts';
import { hasAffirmativeResearchConsent } from './research-consent.service.ts';
import { enqueue, flushPendingUploads } from './upload-queue.service.ts';

interface RecommendationBatchRow extends Record<string, string | number | null> {
  data: string;
}

interface RecommendationRow extends Record<string, string | number | null> {
  data: string;
}

interface ResearchRecordRow extends Record<string, string | number | null> {
  id: string;
}

function parsePayload<T>(row: { data: string }): T {
  return JSON.parse(row.data) as T;
}

function projectRecord(
  recommendation: Recommendation,
  batch: RecommendationBatch,
  batchPosition: number,
): RecommendationResearchRecord {
  return {
    kind: 'recommendation',
    id: recommendation.id,
    userId: recommendation.userId,
    condition: recommendation.condition,
    topicId: recommendation.topicId,
    batchId: batch.id,
    sessionId: batch.sessionId,
    batchSeq: batch.seq,
    batchPosition,
    postId: recommendation.postId,
    generatedAt: recommendation.generatedAt,
    strategy: recommendation.strategy,
    score: recommendation.score,
    reasonText: recommendation.reasonText,
    ...(recommendation.contributingQuestionIds
      ? { contributingQuestionIds: [...recommendation.contributingQuestionIds] }
      : {}),
    ...(recommendation.contributingConceptIds
      ? { contributingConceptIds: [...recommendation.contributingConceptIds] }
      : {}),
    ...(recommendation.contributingPostIds
      ? { contributingPostIds: [...recommendation.contributingPostIds] }
      : {}),
    ...(recommendation.componentScores
      ? { componentScores: { ...recommendation.componentScores } }
      : {}),
  };
}

/** Converge ready recommendation batches into the durable research outbox. */
export async function projectRecommendationResearchRecords(): Promise<number> {
  if (!hasAffirmativeResearchConsent()) return 0;

  const batchRows = await dbQuery<RecommendationBatchRow>('SELECT * FROM recommendation_batches');
  let projectedCount = 0;
  for (const batchRow of batchRows) {
    const batch = parsePayload<RecommendationBatch>(batchRow);
    if (batch.status !== 'ready') continue;

    for (const [index, recommendationId] of batch.recommendationIds.entries()) {
      const existingRows = await dbQuery<ResearchRecordRow>(
        'SELECT * FROM research_records WHERE id = ?',
        [recommendationId],
      );
      if (existingRows.length > 0) continue;

      const recommendationRows = await dbQuery<RecommendationRow>(
        'SELECT * FROM recommendations WHERE id = ?',
        [recommendationId],
      );
      if (recommendationRows.length !== 1) continue;

      const record = projectRecord(
        parsePayload<Recommendation>(recommendationRows[0]),
        batch,
        index + 1,
      );
      await dbExecute(
        'INSERT OR REPLACE INTO research_records (id, kind, revision, data) VALUES (?, ?, ?, ?)',
        [record.id, 'recommendation', 1, JSON.stringify(record)],
      );
      await enqueue(record, { triggerFlush: false });
      projectedCount += 1;
    }
  }
  return projectedCount;
}

/** Capture after a successful batch save; boot projection repairs any missed window. */
export async function captureRecommendationResearch(): Promise<void> {
  const projectedCount = await projectRecommendationResearchRecords();
  if (projectedCount > 0) {
    void flushPendingUploads().catch(() => {});
  }
}
