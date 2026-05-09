// Engagement service — Phase 39 (D-03/D-04/D-05/D-06/D-08).
//
// Local-first leaf service that owns save / like / dismiss state for posts and
// concept anchors. Modeled on `daily-read.service.ts` MINUS the date-keyed
// reset (engagement persists cross-day per Phase 39 success criterion #5).
//
// Leaf-module discipline (Phase 37 D-01 / D-08):
//   - No JSON imports, no `react-i18next`, no `lib/date.ts` (would re-introduce
//     the i18next dependency chain and break `node --test` loadability).
//   - Sync API; localStorage-backed.
//   - ID-only storage with snapshot resolution via postHistoryService at read
//     time (D-03 — avoid duplicating the post-history snapshot store).
//
// Event-emission rules (D-05 — one signal per semantic action; D-06 anti-wire):
//   - savePost / removeSavedPost / likePost / unlikePost / undismissAnchor:
//     emit EXACTLY ONE engagement-change event with the appropriate `kind`.
//   - dismissAnchor: emit EXACTLY ONE anchor-dismiss event. Never also an
//     engagement-change event. Never any explored-anchor signal — D-06
//     anti-wire invariant; the walker is the consumer of the dismiss event.
//   - undismissAnchor: emit EXACTLY ONE engagement-change event with
//     kind 'undismiss'. Never also an anchor-dismiss event.
//   - reset(): emits NOTHING (D-08 — wholesale wipe, UI consumers should re-read).
//   - All mutators are idempotent: re-saving an already-saved post is a no-op
//     AND does NOT re-emit (membership check before push+emit).

import type { DailyPost } from '../types/index.ts';
import { eventBus } from '../lib/event-bus.ts';
import { postHistoryService } from './post-history.service.ts';

const STORAGE_KEY = 'trellis_engagement_v1';

interface EngagementState {
  saved: string[];      // postIds
  liked: string[];      // postIds
  dismissed: string[];  // anchorIds
}

function freshState(): EngagementState {
  return { saved: [], liked: [], dismissed: [] };
}

function loadState(): EngagementState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return freshState();
    const p = parsed as Partial<EngagementState>;
    return {
      saved: Array.isArray(p.saved) ? p.saved : [],
      liked: Array.isArray(p.liked) ? p.liked : [],
      dismissed: Array.isArray(p.dismissed) ? p.dismissed : [],
    };
  } catch {
    return freshState();
  }
}

function saveState(state: EngagementState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage quota exceeded — silently drop
  }
}

function resolvePostsByIds(ids: string[]): DailyPost[] {
  // Resolve through postHistoryService at read time (D-03). Preserves the
  // saved-/liked-id INSERTION order (the user-action sequence), NOT history
  // order. Posts not found in history are silently dropped (D-04 edge case
  // — graceful degradation when post-history was wiped via Clear-All-Data).
  const all = postHistoryService.getPosts();
  const byId = new Map<string, DailyPost>();
  for (const p of all) byId.set(p.id, p);
  const out: DailyPost[] = [];
  for (const id of ids) {
    const p = byId.get(id);
    if (p) out.push(p);
  }
  return out;
}

export const engagementService = {
  // ─── Saved posts ─────────────────────────────────────────────────────────

  /** Save a post (idempotent — no-op + no event if already saved). */
  savePost(postId: string): void {
    const state = loadState();
    if (state.saved.includes(postId)) return;
    state.saved.push(postId);
    saveState(state);
    eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'save', id: postId } });
  },

  /** Remove a saved post (idempotent — no-op + no event if not saved). */
  removeSavedPost(postId: string): void {
    const state = loadState();
    if (!state.saved.includes(postId)) return;
    state.saved = state.saved.filter(id => id !== postId);
    saveState(state);
    eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'unsave', id: postId } });
  },

  isSaved(postId: string): boolean {
    return loadState().saved.includes(postId);
  },

  getSavedPostIds(): string[] {
    return [...loadState().saved];
  },

  /** Resolve saved IDs to full DailyPost objects via postHistoryService. */
  getSavedPosts(): DailyPost[] {
    return resolvePostsByIds(loadState().saved);
  },

  // ─── Likes ───────────────────────────────────────────────────────────────

  /** Like a post (idempotent — no-op + no event if already liked). */
  likePost(postId: string): void {
    const state = loadState();
    if (state.liked.includes(postId)) return;
    state.liked.push(postId);
    saveState(state);
    eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'like', id: postId } });
  },

  /** Unlike a post (idempotent — no-op + no event if not liked). */
  unlikePost(postId: string): void {
    const state = loadState();
    if (!state.liked.includes(postId)) return;
    state.liked = state.liked.filter(id => id !== postId);
    saveState(state);
    eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'unlike', id: postId } });
  },

  isLiked(postId: string): boolean {
    return loadState().liked.includes(postId);
  },

  getLikedPostIds(): string[] {
    return [...loadState().liked];
  },

  /** Resolve liked IDs to full DailyPost objects via postHistoryService. */
  getLikedPosts(): DailyPost[] {
    return resolvePostsByIds(loadState().liked);
  },

  // ─── Dismissed anchors ───────────────────────────────────────────────────

  /**
   * Dismiss an anchor (idempotent). Emits EXACTLY ONE anchor-dismiss event.
   * Does NOT emit any engagement-change event here — D-06 anti-wire invariant;
   * the walker (concept-feed.service.ts) subscribes specifically to this event.
   */
  dismissAnchor(anchorId: string): void {
    const state = loadState();
    if (state.dismissed.includes(anchorId)) return;
    state.dismissed.push(anchorId);
    saveState(state);
    eventBus.emit({ type: 'ANCHOR_DISMISSED', payload: { anchorId } });
  },

  /**
   * Undismiss an anchor (idempotent). Emits EXACTLY ONE engagement-change
   * event with kind 'undismiss'. Does NOT emit any anchor-dismiss event
   * here — D-06.
   */
  undismissAnchor(anchorId: string): void {
    const state = loadState();
    if (!state.dismissed.includes(anchorId)) return;
    state.dismissed = state.dismissed.filter(id => id !== anchorId);
    saveState(state);
    eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'undismiss', id: anchorId } });
  },

  isDismissed(anchorId: string): boolean {
    return loadState().dismissed.includes(anchorId);
  },

  getDismissedAnchorIds(): string[] {
    return [...loadState().dismissed];
  },

  // ─── Cross-module helper (D-04) ──────────────────────────────────────────

  /**
   * Returns the union of saved ∪ liked post IDs (NOT dismissed anchor IDs).
   * Consumed by `postHistoryService.purgeExpired()` to pin saved/liked posts
   * against the retention purge so a post saved >retentionDays ago is not
   * silently dropped from the snapshot store.
   */
  getPinnedIds(): Set<string> {
    const s = loadState();
    return new Set<string>([...s.saved, ...s.liked]);
  },

  // ─── Test/dev affordance (D-08) ──────────────────────────────────────────

  /**
   * Wipe all three collections to []. Phase 43 wires this into the
   * Force-New-Day handler in SettingsDataScreen alongside `dailyReadService.reset()`.
   * Emits NOTHING — wholesale wipe is not a per-id change; UI consumers
   * should re-read on Force-New-Day rather than chase per-action events.
   */
  reset(): void {
    saveState(freshState());
  },
};
