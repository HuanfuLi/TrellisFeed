/**
 * Move Generation Logic
 *
 * Transforms ranked concept nodes into typed PlannedMove objects.
 * Each concept gets one move type based on its learning status:
 *
 *   review   — concept has flashcards due for review
 *   read     — concept has a related feed post to explore
 *   compare  — concept has a connection post linking it to another concept
 *   podcast  — weak area; AI podcast would reinforce it
 */

import type { Question, TrajectorySignal, PlannedMove, PlannedMoveType } from '../types';
import { flashcardService } from './flashcard.service';
import { conceptFeedService } from './concept-feed.service';
import { podcastService } from './podcast.service';
import { today } from '../lib/date';

// ── Move type determination ────────────────────────────────────────────────

/** Concepts already in today's podcast — cached per generation cycle. */
let _todayPodcastIds: Set<string> | null = null;

function getTodayPodcastIds(): Set<string> {
  if (!_todayPodcastIds) {
    _todayPodcastIds = new Set(podcastService.getTodayConceptIds(today()));
  }
  return _todayPodcastIds;
}

function decideMoveType(
  concept: Question,
  signals: TrajectorySignal,
): { moveType: PlannedMoveType; linkedPostId?: string } {
  // If it's a weak area AND not already in today's podcast, suggest adding to podcast.
  if (signals.weakAreas.includes(concept.id) && !getTodayPodcastIds().has(concept.id)) {
    return { moveType: 'podcast' };
  }

  // If flashcard is due or concept hasn't been reviewed recently, suggest review.
  const allCards = flashcardService.getAll();
  const conceptCards = allCards.filter((c) => c.nodeId === concept.id);
  const hasDueCard = conceptCards.some((c) => c.reviewSchedule.nextReviewDate <= today());
  if (hasDueCard) return { moveType: 'review' };

  // If concept has related nodes, try to find a connection post.
  if (concept.relatedQuestionIds.length > 0) {
    const conceptIds = [concept.id, ...concept.relatedQuestionIds];
    const connectionPost = conceptFeedService.findClosestPost(conceptIds, true);
    if (connectionPost) return { moveType: 'compare', linkedPostId: connectionPost.id };
  }

  // Try to find a feed post for this concept.
  const feedPost = conceptFeedService.findClosestPost([concept.id, ...concept.relatedQuestionIds]);
  if (feedPost) return { moveType: 'read', linkedPostId: feedPost.id };

  // Fall back to review if no posts are available.
  return { moveType: 'review' };
}

// ── Reason generation ──────────────────────────────────────────────────────

function buildReason(
  moveType: PlannedMoveType,
  concept: Question,
  score: number,
): string {
  const daysSinceReview = concept.lastReviewedAt
    ? Math.round((Date.now() - concept.lastReviewedAt) / (24 * 60 * 60 * 1000))
    : null;

  switch (moveType) {
    case 'review':
      return daysSinceReview !== null && daysSinceReview > 0
        ? `Time to review: ${daysSinceReview} day${daysSinceReview !== 1 ? 's' : ''} ago`
        : 'Flashcard due for review';
    case 'read':
      return score >= 70
        ? 'High relevance to your current learning path'
        : 'Explore this concept further';
    case 'compare':
      return `${concept.relatedQuestionIds.length} related concept${concept.relatedQuestionIds.length !== 1 ? 's' : ''} to connect`;
    case 'podcast':
      return 'Weak area — add to today\'s podcast review';
  }
}

// ── Time estimates ─────────────────────────────────────────────────────────

const MOVE_TIME_MS: Record<PlannedMoveType, number> = {
  review: 5 * 60 * 1000,    // 5 min
  read: 10 * 60 * 1000,     // 10 min
  compare: 7 * 60 * 1000,   // 7 min
  podcast: 15 * 60 * 1000,  // 15 min
};

// ── Linked resource ────────────────────────────────────────────────────────

function buildLinkedResource(
  moveType: PlannedMoveType,
  concept: Question,
  linkedPostId?: string,
): PlannedMove['linkedResource'] {
  switch (moveType) {
    case 'review':
      return { type: 'review', id: concept.id };
    case 'read':
      return linkedPostId ? { type: 'post', id: linkedPostId } : { type: 'review', id: concept.id };
    case 'compare':
      return linkedPostId ? { type: 'post', id: linkedPostId } : undefined;
    case 'podcast':
      return { type: 'question', id: concept.id };
  }
}

// ── ID generation ──────────────────────────────────────────────────────────

let idCounter = 0;
function newMoveId(): string {
  return `move-${Date.now()}-${++idCounter}`;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate PlannedMove objects from a ranked list of concept nodes.
 *
 * @param rankedConcepts  - Output from `rankConcepts()`.
 * @param signals         - User trajectory (needed for reason text).
 * @returns               Array of PlannedMove ready for storage.
 */
export function generateMoves(
  rankedConcepts: Array<{ concept: Question; score: number }>,
  signals: TrajectorySignal,
): PlannedMove[] {
  const now = Date.now();

  // Reset today's podcast ID cache for this generation cycle
  _todayPodcastIds = null;

  const allMoves = rankedConcepts.map(({ concept, score }) => {
    const { moveType, linkedPostId } = decideMoveType(concept, signals);
    const reason = buildReason(moveType, concept, score);

    return {
      id: newMoveId(),
      title: concept.title ?? concept.summary ?? concept.content.slice(0, 60),
      conceptId: concept.id,
      keywords: concept.keywords.slice(0, 4),
      moveType,
      relevanceScore: score,
      reason,
      targetTime: MOVE_TIME_MS[moveType],
      linkedResource: buildLinkedResource(moveType, concept, linkedPostId),
      isAutoGenerated: true,
      createdAt: now,
    };
  });

  // Enforce max 1 podcast move per batch (highest scored one wins)
  let podcastSeen = false;
  return allMoves.filter((m) => {
    if (m.moveType === 'podcast') {
      if (podcastSeen) return false;
      podcastSeen = true;
    }
    return true;
  });
}
