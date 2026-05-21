import type { FlashCard, ReviewSchedule, ServiceResult } from '../types/index.ts';
import { today, addDays, nowMs as clockNowMs } from '../lib/date.ts';
import { flashcardService } from './flashcard.service.ts';
import { eventBus } from '../lib/event-bus.ts';
import { questionService } from './question.service.ts';

export const SM2_INTERVALS = [1, 2, 4, 7, 15, 30];

// Helper: days overdue from an ISO 'YYYY-MM-DD' nextReviewDate.
// Returns 0 for empty/invalid dates (no schedule yet) and clamps negative
// (not-yet-due) results to 0.
export function daysOverdue(nextReviewDate: string, nowMs: number = clockNowMs()): number {
  if (!nextReviewDate) return 0;
  const [y, m, d] = nextReviewDate.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const due = new Date(y, m - 1, d);
  return Math.max(0, Math.floor((nowMs - due.getTime()) / 86400000));
}

// Gap C (Phase 51 UAT, 2026-05-19): SM-2 was naive about missed reviews.
// `calcNextInterval` previously computed the next interval as if the user
// had reviewed on the originally-scheduled day — a card 7 days overdue + a
// pass rating got the same future interval as one reviewed on time. The
// underlying cognitive model (Ebbinghaus / SuperMemo) says retention has
// decayed during the gap; the next interval should reflect that.
//
// Two corrections:
//
//   1. Medium penalty (gentle decay). For moderately-overdue cards that
//      the user still passes, shave half a day off the SM-2 base interval
//      for every day of overdue accumulation. Floor at 1 day so we never
//      schedule into the past.
//
//   2. Large-gap reset (hard decay). When the gap exceeds 2× the
//      previously-scheduled interval, retention has likely dropped past
//      the SM-2 ladder's modeling window. Treat the card as new: reset
//      `reviewCount` to 0 so the next pass starts at SM2_INTERVALS[0] (1
//      day) and re-climbs the ladder. This intentionally also resets the
//      ladder for cards the user passes after a long absence — the
//      memory benefit of long-gap retrieval still applies (easeFactor
//      bump from rating), but the ladder restarts.
//
// Fail behavior (rating < 3) is unchanged: 1-day repeat, reviewCount
// kept incrementing by the caller as before. Whether to reset on FAIL
// is a separate question (Anki SM-2 standard does; ours doesn't); this
// commit is intentionally scoped to overdue/missed-review correctness
// per operator's verify-work concern.
//
// `newReviewCount` is returned so the caller doesn't need to know the
// reset rule — the function owns the SM-2 ladder state transition.
export function calcNextInterval(
  current: ReviewSchedule,
  rating: number,
  nowMs: number = clockNowMs(),
): { days: number; newEaseFactor: number; newReviewCount: number } {
  const { reviewCount, easeFactor, nextReviewDate } = current;
  const newEF = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02),
  );
  if (rating < 3) {
    return { days: 1, newEaseFactor: newEF, newReviewCount: reviewCount + 1 };
  }
  const overdue = daysOverdue(nextReviewDate, nowMs);
  // The interval the user JUST failed to hit on time — used to decide reset.
  const previousInterval =
    reviewCount > 0
      ? SM2_INTERVALS[Math.min(reviewCount - 1, SM2_INTERVALS.length - 1)]
      : 1;
  if (overdue > 2 * previousInterval) {
    // Hard reset: gap was too long for the SM-2 ladder to predict — restart.
    return { days: 1, newEaseFactor: newEF, newReviewCount: 0 };
  }
  const intervalIndex = Math.min(reviewCount, SM2_INTERVALS.length - 1);
  const baseDays = SM2_INTERVALS[intervalIndex];
  // Medium penalty: shave half a day off the SM-2 base per overdue day.
  const penalizedDays = Math.max(1, baseDays - Math.floor(overdue / 2));
  return { days: penalizedDays, newEaseFactor: newEF, newReviewCount: reviewCount + 1 };
}

export const reviewService = {
  async getTodayReviewItems(): Promise<ServiceResult<FlashCard[]>> {
    // Gap B (Phase 51 UAT, 2026-05-19): sort oldest-overdue first so the
    // most-decayed cards surface before merely-due-today ones. Within the
    // same nextReviewDate (e.g., two cards both due today), preserve
    // insertion order. ISO 'YYYY-MM-DD' strings compare lexicographically,
    // which matches chronological order without a Date() round-trip.
    const due = flashcardService.getDue().slice().sort((a, b) => {
      const aDate = a.reviewSchedule.nextReviewDate || '9999-12-31';
      const bDate = b.reviewSchedule.nextReviewDate || '9999-12-31';
      return aDate.localeCompare(bDate);
    });
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

    const { days, newEaseFactor, newReviewCount } = calcNextInterval(
      card.reviewSchedule,
      rating,
    );
    const newSchedule: ReviewSchedule = {
      // Pinned cards always come back tomorrow regardless of SM-2 rating.
      nextReviewDate: card.pinned ? addDays(today(), 1) : addDays(today(), days),
      // Gap C: function owns the SM-2 ladder transition (incl. large-gap reset).
      reviewCount: newReviewCount,
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
      resolvedAnchorId = q?.parentId;
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
