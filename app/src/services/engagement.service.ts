// Engagement service — Phase 39 (D-03/D-04/D-05/D-06/D-08).
//
// Local-first leaf service that owns save / like / dismiss state for immutable
// frozen post IDs. Engagement persists across days.
//
// Leaf-module discipline (Phase 37 D-01 / D-08):
//   - No JSON imports, no `react-i18next`, no `lib/date.ts` (would re-introduce
//     the i18next dependency chain and break `node --test` loadability).
//   - Sync mirror API with DB-seam write-through and boot hydration.
//   - ID-only storage. Immutable content resolves through frozenFeedService at
//     the screen/facade boundary, never through an engagement snapshot.
//
// Event-emission rules (one signal per semantic action):
//   - save/remove, like/unlike, and dismiss/undismiss emit one engagement event.
//   - reset(): emits NOTHING (D-08 — wholesale wipe, UI consumers should re-read).
//   - All mutators are idempotent: re-saving an already-saved post is a no-op
//     AND does NOT re-emit (membership check before push+emit).

import { eventBus } from '../lib/event-bus.ts';
import { dbExecute, dbQuery } from './db.service.ts';
import { interactionLog } from './interaction-log.service.ts';

// Phase 55-07: engagement state (a single JSON blob of saved/liked/dismissed
// ID arrays) persists to one row in the IndexedDB `engagement`
// table. The in-memory mirror is the synchronous read path; the legacy
// `trellis_engagement_v1` localStorage key is no longer written (cleared on the
// D-11 cutover sweep in db.service.ts clearAllTables).
const SQLITE_ROW_ID = 'engagement_state';

interface EngagementState {
  saved: string[];          // postIds
  liked: string[];          // postIds (recommendation signal — NOT displayed)
  dismissed: string[];      // frozen postIds
}

function freshState(): EngagementState {
  return { saved: [], liked: [], dismissed: [] };
}

// Phase 55-07: engagement state persists ONLY to IndexedDB (single-row blob).
// The module-level `_state` is the synchronous read+write mirror (starts empty,
// hydrated from IndexedDB at boot). No localStorage write for `trellis_engagement_v1`.
let _state: EngagementState = freshState();

function loadState(): EngagementState {
  // Return a copy with fresh arrays so callers that mutate (push/filter) don't
  // corrupt the mirror until they call saveState.
  return {
    saved: [..._state.saved],
    liked: [..._state.liked],
    dismissed: [..._state.dismissed],
  };
}

function saveState(state: EngagementState): void {
  _state = {
    saved: [...state.saved],
    liked: [...state.liked],
    dismissed: [...state.dismissed],
  };
  // IndexedDB write-through (D-09/D-12) — fire-and-forget single-row upsert.
  void dbExecute('INSERT OR REPLACE INTO engagement (id, data) VALUES (?, ?)', [
    SQLITE_ROW_ID,
    JSON.stringify(state),
  ]).catch(() => { /* IndexedDB unavailable — in-memory mirror is the read path */ });
}

let _hydratedEngagement = false;

/**
 * Boot hydration (D-12). Restore the engagement mirror from SQLite's single row
 * when the localStorage mirror is empty (D-11 clean-cutover state). Guarded so a
 * populated mirror is never overwritten. Emits ENGAGEMENT_CHANGED (bulk sentinel
 * id '*') so saved/liked consumers re-read (no-refresh assumption).
 */
export async function hydrateEngagementFromSQLite(): Promise<void> {
  if (_hydratedEngagement) return;
  _hydratedEngagement = true;
  try {
    const cur = loadState();
    const hasData = cur.saved.length > 0 || cur.liked.length > 0
      || cur.dismissed.length > 0;
    if (hasData) return; // mirror already has data — trust it
    const rows = await dbQuery<{ id: string; data: string }>(
      'SELECT * FROM engagement WHERE id = ?', [SQLITE_ROW_ID],
    );
    if (rows.length === 0) return;
    let parsed: Partial<EngagementState> | null = null;
    try { parsed = JSON.parse(rows[0].data) as Partial<EngagementState>; } catch { return; }
    const next: EngagementState = {
      saved: Array.isArray(parsed?.saved) ? parsed!.saved : [],
      liked: Array.isArray(parsed?.liked) ? parsed!.liked : [],
      dismissed: Array.isArray(parsed?.dismissed) ? parsed!.dismissed : [],
    };
    const restored = next.saved.length || next.liked.length || next.dismissed.length;
    if (restored) {
      _state = next;
      eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'save', id: '*' } });
    }
  } catch {
    // IndexedDB unavailable — silently skip
  }
}

export const engagementService = {
  // ─── Saved posts ─────────────────────────────────────────────────────────

  /** Save a frozen post ID (idempotent — no-op + no event if already saved). */
  savePost(postId: string): void {
    const state = loadState();
    if (state.saved.includes(postId)) return;
    state.saved.push(postId);
    saveState(state);
    eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'save', id: postId } });
    void interactionLog.record('save_post', { postId })
      .catch(() => { /* research logging observes but never blocks engagement */ });
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

  // ─── Likes ───────────────────────────────────────────────────────────────

  /** Like a frozen post ID (idempotent — no-op + no event if already liked). */
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

  // ─── Dismissed anchors ───────────────────────────────────────────────────

  dismissPost(postId: string): void {
    const state = loadState();
    if (state.dismissed.includes(postId)) return;
    state.dismissed.push(postId);
    saveState(state);
    eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'dismiss', id: postId } });
    void interactionLog.record('not_interested', { postId })
      .catch(() => { /* research logging observes but never blocks engagement */ });
  },

  undismissPost(postId: string): void {
    const state = loadState();
    if (!state.dismissed.includes(postId)) return;
    state.dismissed = state.dismissed.filter(id => id !== postId);
    saveState(state);
    eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'undismiss', id: postId } });
  },

  isPostDismissed(postId: string): boolean {
    return loadState().dismissed.includes(postId);
  },

  getDismissedPostIds(): string[] {
    return [...loadState().dismissed];
  },

  // ─── Test/dev affordance (D-08) ──────────────────────────────────────────

  /** Wipe all three collections without synthesizing per-ID events. */
  reset(): void {
    saveState(freshState());
  },

};
