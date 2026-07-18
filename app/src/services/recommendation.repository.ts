import type { Recommendation } from '../domain/content.types.ts';
import type { RecommendationBatch } from '../domain/graph.types.ts';
import type { ServiceResult } from '../types/index.ts';
import { dbExecute, dbQuery, type Row } from './db.service.ts';

interface RecommendationRow extends Row {
  id: string;
  user_id: string;
  data: string;
}

interface RecommendationBatchRow extends Row {
  id: string;
  user_id: string;
  session_id: string;
  data: string;
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

function parsePayload<T>(row: { data: string }): T {
  return JSON.parse(row.data) as T;
}

export class RecommendationRepository {
  async saveBatch(
    batch: RecommendationBatch,
    recommendations: Recommendation[],
  ): Promise<ServiceResult<void>> {
    try {
      const expectedIds = new Set(batch.recommendationIds);
      if (
        expectedIds.size !== batch.recommendationIds.length
        || recommendations.length !== batch.recommendationIds.length
        || recommendations.some((item) => (
          !expectedIds.has(item.id)
          || item.userId !== batch.userId
        ))
      ) {
        return failure('Recommendation rows do not match the batch ledger.');
      }

      for (const recommendation of recommendations) {
        await dbExecute(
          'INSERT OR REPLACE INTO recommendations (id, user_id, data) VALUES (?, ?, ?)',
          [recommendation.id, recommendation.userId, JSON.stringify(recommendation)],
        );
      }
      await dbExecute(
        'INSERT OR REPLACE INTO recommendation_batches (id, user_id, session_id, data) VALUES (?, ?, ?, ?)',
        [batch.id, batch.userId, batch.sessionId, JSON.stringify(batch)],
      );
      return success(undefined);
    } catch {
      return failure('The recommendation batch could not be persisted.');
    }
  }

  async readBatch(batchId: string): Promise<ServiceResult<RecommendationBatch | null>> {
    try {
      const rows = await dbQuery<RecommendationBatchRow>(
        'SELECT * FROM recommendation_batches WHERE id = ?',
        [batchId],
      );
      return success(rows[0] ? parsePayload<RecommendationBatch>(rows[0]) : null);
    } catch {
      return failure('The recommendation batch could not be read.');
    }
  }

  async readSessionBatches(
    userId: string,
    sessionId: string,
  ): Promise<ServiceResult<RecommendationBatch[]>> {
    try {
      const rows = await dbQuery<RecommendationBatchRow>(
        'SELECT * FROM recommendation_batches WHERE session_id = ?',
        [sessionId],
      );
      const batches = rows
        .filter((row) => row.user_id === userId)
        .map((row) => parsePayload<RecommendationBatch>(row))
        .sort((left, right) => left.seq - right.seq);
      return success(batches);
    } catch {
      return failure('Recommendation session batches could not be read.');
    }
  }

  async readRecommendation(id: string): Promise<ServiceResult<Recommendation | null>> {
    try {
      const rows = await dbQuery<RecommendationRow>(
        'SELECT * FROM recommendations WHERE id = ?',
        [id],
      );
      return success(rows[0] ? parsePayload<Recommendation>(rows[0]) : null);
    } catch {
      return failure('The recommendation could not be read.');
    }
  }
}

export const recommendationRepository = new RecommendationRepository();
