// Phase 51-01: shared anchor-resolution helper.
//
// Single source of truth for "given a Q&A node id, what's the concept anchor
// id?" Used by InfoFlow concept badges, PostDetailScreen contextLabel/pills,
// and any future surface that wants to deep-link to /anchor/:id from a
// Q&A-shaped reference (DailyPost.sourceQuestionIds[0], ConnectionMeta
// questionA/B, podcast questionIds, etc.).
//
// Design constraints (from 51-01-PLAN.md):
//   - Walks at most 2 hops up the parentId chain. Trellis is fixed-depth:
//     anchor → Q&A leaf. Anything deeper than `qa.parent.isAnchorNode` is
//     treated as an orphan and returns null — we deliberately don't try to
//     follow parent.parent because the data model doesn't guarantee that
//     shape and we'd risk returning a non-anchor id.
//   - questionService.getById is async (ServiceResult<Question>), so we use
//     the sync questionService.getAll().find(...) lookup. This is the same
//     pattern used by useTrellisData and PrunedSection consumers.
//   - Pure function. No side effects, no caching — callers run this once per
//     render per badge, which is a single localStorage parse + two array
//     scans (cheap).

import { questionService } from '../services/question.service.ts';

export function resolveAnchorId(qaId: string): string | null {
  if (!qaId) return null;
  // Include flagged questions in the lookup so off-topic Q&As that still
  // have an anchor reference can resolve. (The badge UI surfaces the
  // anchor, not the flagged-Q&A status — those are independent concerns.)
  const all = questionService.getAll({ includeFlagged: true });
  const qa = all.find((q) => q.id === qaId);
  if (!qa) return null;
  if (qa.isAnchorNode) return qa.id;
  if (!qa.parentId) return null;
  const parent = all.find((q) => q.id === qa.parentId);
  return parent?.isAnchorNode ? parent.id : null;
}
