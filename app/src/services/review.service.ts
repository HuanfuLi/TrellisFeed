import type { FlashCard, ReviewSchedule, ServiceResult } from '../types';
import { today, addDays } from '../lib/date';
import { flashcardService } from './flashcard.service';
import { eventBus } from '../lib/event-bus';
import { questionService } from './question.service';

const SM2_INTERVALS = [1, 2, 4, 7, 15, 30];

function calcNextInterval(
  reviewCount: number,
  rating: number,
  easeFactor: number,
): { days: number; newEaseFactor: number } {
  const newEF = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02),
  );
  if (rating < 3) {
    return { days: 1, newEaseFactor: newEF };
  }
  const intervalIndex = Math.min(reviewCount, SM2_INTERVALS.length - 1);
  return { days: SM2_INTERVALS[intervalIndex], newEaseFactor: newEF };
}

export const reviewService = {
  async getTodayReviewItems(): Promise<ServiceResult<FlashCard[]>> {
    const due = flashcardService.getDue();
    return { success: true, data: due };
  },

  async getTodayReviewCount(): Promise<ServiceResult<number>> {
    const result = await this.getTodayReviewItems();
    return { success: true, data: result.data?.length ?? 0 };
  },

  async submitReview(
    cardId: string,
    rating: 1 | 2 | 3 | 4 | 5,
  ): Promise<ServiceResult<ReviewSchedule>> {
    const all = flashcardService.getAll();
    const card = all.find((c) => c.id === cardId);
    if (!card) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'FlashCard not found', retryable: false },
      };
    }

    const { days, newEaseFactor } = calcNextInterval(
      card.reviewSchedule.reviewCount,
      rating,
      card.reviewSchedule.easeFactor,
    );
    const newSchedule: ReviewSchedule = {
      // Pinned cards always come back tomorrow regardless of SM-2 rating
      nextReviewDate: card.pinned ? addDays(today(), 1) : addDays(today(), days),
      reviewCount: card.reviewSchedule.reviewCount + 1,
      easeFactor: newEaseFactor,
    };

    flashcardService.updateReviewSchedule(cardId, newSchedule);
    if (card.nodeId) {
      questionService.patchQuestion(card.nodeId, { lastReviewedAt: Date.now() });
    }
    eventBus.emit({ type: 'REVIEW_SUBMITTED', payload: { questionId: card.nodeId ?? cardId, rating } });

    // Bridge to REVIEW_COMPLETED with resolved anchorId for Trellis hero (Phase 25, per D-48)
    const resolvedQuestionId = card.nodeId ?? cardId;
    let resolvedAnchorId: string | undefined;
    try {
      const allQs = questionService.getAll();
      const q = allQs.find((x) => x.id === resolvedQuestionId);
      resolvedAnchorId = q?.anchorId ?? q?.parentId;
    } catch {
      // question lookup is best-effort; anchorId stays undefined
    }
    eventBus.emit({ type: 'REVIEW_COMPLETED', payload: { questionId: resolvedQuestionId, anchorId: resolvedAnchorId } });

    return { success: true, data: newSchedule };
  },

  async skipReview(cardId: string): Promise<ServiceResult<void>> {
    const all = flashcardService.getAll();
    const card = all.find((c) => c.id === cardId);
    if (!card) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'FlashCard not found', retryable: false },
      };
    }

    flashcardService.updateReviewSchedule(cardId, {
      ...card.reviewSchedule,
      nextReviewDate: addDays(today(), 1),
    });
    if (card.nodeId) {
      questionService.patchQuestion(card.nodeId, { lastReviewedAt: Date.now() });
    }
    return { success: true };
  },
};
