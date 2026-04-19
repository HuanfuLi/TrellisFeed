// Trellis node action service: encapsulates heal, re-plant, prune, unprune,
// and hard-delete logic for dying/dead/pruned anchors (D-11 through D-18).
//
// Heal (D-11, D-12):   dying node → add to today's podcast + navigate to review filtered to anchor's Q&As
// Re-plant (D-13, D-14): dead node → reset flashcard schedules + reset question schedules + generate post + navigate to review
// Prune (D-15, D-17):  dying/dead → soft-delete via flagged=true + emit ANCHOR_DELETED so trellis removes it
// Unprune:             restore pruned node → flagged=false + emit GRAPH_UPDATED so trellis recomputes
// Hard-delete:         permanent removal via questionService.delete (already emits QUESTION_DELETED)
//
// Returns navigation intents rather than invoking navigate() directly — caller owns routing.

import type { Question, ReviewSchedule } from '../types';
import { podcastService } from './podcast.service';
import { questionService } from './question.service';
import { eventBus } from '../lib/event-bus';
import { today, addDays } from '../lib/date';

export interface AnchorReviewNavState {
  anchorReview: {
    anchorId: string;
    qaIds: string[];
    title: string;
  };
}

export interface DiscoverPostNavState {
  discoverMeta: {
    concept: string;
    title: string;
  };
}

export interface ActionNavigationResult {
  navigateTo: string;
  state: AnchorReviewNavState | DiscoverPostNavState;
}

// Bump a schedule to the "dying" zone (1 day overdue → yellow per computeLeafState).
// Preserves reviewCount >= 1 so the node isn't treated as an unreviewed "bud".
function dyingSchedule(prev?: ReviewSchedule): ReviewSchedule {
  return {
    nextReviewDate: addDays(today(), -1),
    reviewCount: Math.max(1, prev?.reviewCount ?? 0),
    easeFactor: prev?.easeFactor ?? 2.5,
  };
}

export const trellisActionsService = {
  /**
   * D-11/D-12: Heal a dying anchor. Adds the anchor to today's podcast (non-fatal
   * if no podcast exists) and returns navigation state so the caller can route
   * to /review filtered to the anchor's Q&A children.
   */
  heal(anchorId: string, anchorName: string, qaChildIds: string[]): ActionNavigationResult {
    // Fire-and-forget podcast queue add — non-fatal if it returns false
    try {
      podcastService.addConceptToPodcast(today(), anchorId);
    } catch {
      /* swallow — podcast add failures are non-fatal */
    }

    return {
      navigateTo: '/review',
      state: {
        anchorReview: {
          anchorId,
          qaIds: qaChildIds,
          title: anchorName,
        },
      },
    };
  },

  /**
   * D-13/D-14 (simplified): Re-plant a dead anchor by re-exposing the user to a
   * freshly generated post (reusing AnchorDetailScreen's "Learn as Post" flow —
   * navigates to `/posts/anchor-post-{id}` with discoverMeta; PostDetailScreen
   * streams the essay on mount).
   *
   * The anchor + its children are bumped to "dying" (1 day overdue, reviewCount
   * preserved >= 1) so leaf state becomes yellow — the user must still complete
   * a real review cycle to graduate the node back to green. Flashcards are
   * intentionally NOT reset; their own schedules age naturally.
   *
   * Returns synchronously — no post-generation await. PostDetailScreen owns
   * the streaming UX.
   */
  replant(
    anchorId: string,
    anchorQuestion: Question,
    qaChildIds: string[],
  ): ActionNavigationResult {
    questionService.patchQuestion(anchorId, {
      reviewSchedule: dyingSchedule(anchorQuestion.reviewSchedule),
    });

    const all = questionService.getAll({ includeFlagged: true });
    for (const qaId of qaChildIds) {
      const qa = all.find((q) => q.id === qaId);
      questionService.patchQuestion(qaId, {
        reviewSchedule: dyingSchedule(qa?.reviewSchedule),
      });
    }

    // Emit so useTrellisData recomputes — the dead anchor immediately demotes
    // to dying and the Suggested Moves list refreshes.
    eventBus.emit({ type: 'GRAPH_UPDATED' });

    const title = anchorQuestion.title ?? anchorQuestion.content ?? 'anchor';
    return {
      navigateTo: `/posts/anchor-post-${anchorId}`,
      state: {
        discoverMeta: {
          concept: title,
          title: `Understanding ${title}: A Complete Guide`,
        },
      },
    };
  },

  /**
   * D-15/D-17: Prune (archive) an anchor. Flips flagged=true so getPrunedQuestions
   * surfaces it, and emits ANCHOR_DELETED so the trellis removes it from rendering
   * (per RESEARCH Open Question 4 — same visual effect as deletion, but reversible).
   */
  prune(anchorId: string): { pruned: true } {
    questionService.patchQuestion(anchorId, { flagged: true, prunedFromTrellis: true });
    eventBus.emit({ type: 'ANCHOR_DELETED', payload: { anchorId } });
    return { pruned: true };
  },

  /**
   * Restore a pruned anchor back to the trellis. Flips flagged=false and emits
   * GRAPH_UPDATED to trigger useTrellisData recompute.
   */
  unpruneQuestion(anchorId: string): void {
    questionService.patchQuestion(anchorId, { flagged: false, prunedFromTrellis: false });
    eventBus.emit({ type: 'GRAPH_UPDATED' });
  },

  /**
   * Permanently remove a pruned anchor. questionService.delete already emits
   * QUESTION_DELETED so downstream subscribers handle cleanup.
   */
  async hardDelete(anchorId: string): Promise<void> {
    await questionService.delete(anchorId);
  },
};
