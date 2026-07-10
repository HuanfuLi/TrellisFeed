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
import { dbExecute, dbQuery } from './db.service.ts';

// Phase 55-07: engagement state (a single JSON blob of saved/liked/dismissed
// ID arrays) persists to one row in the IndexedDB `engagement`
// table. The in-memory mirror is the synchronous read path; the legacy
// `trellis_engagement_v1` localStorage key is no longer written (cleared on the
// D-11 cutover sweep in db.service.ts clearAllTables).
const SQLITE_ROW_ID = 'engagement_state';

interface EngagementState {
  saved: string[];          // postIds
  liked: string[];          // postIds (recommendation signal — NOT displayed)
  dismissed: string[];      // anchorIds
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

  /**
   * Save a post (idempotent — no-op + no event if already saved).
   *
   * Phase 50 UAT G14: optional `snapshot` parameter. When provided, the post
   * snapshot is persisted to postHistoryService BEFORE the event fires, so
   * unopened stub posts (which only exist in the feed queue, not yet in
   * history) still surface on /saved. Without the snapshot, resolvePostsByIds
   * would silently drop the id at SavedScreen render time. Callers that have
   * the post object should pass it; callers that don't are unchanged.
   */
  savePost(postId: string, snapshot?: DailyPost): void {
    const state = loadState();
    if (state.saved.includes(postId)) return;
    state.saved.push(postId);
    saveState(state);
    if (snapshot) postHistoryService.addPost(snapshot);
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

  /**
   * Like a post (idempotent — no-op + no event if already liked).
   *
   * Phase 50 UAT G14: optional `snapshot` parameter — same rationale as
   * savePost. Persists the stub to postHistoryService so Liked tab surfaces
   * the post even before its body has been generated.
   */
  likePost(postId: string, snapshot?: DailyPost): void {
    const state = loadState();
    if (state.liked.includes(postId)) return;
    state.liked.push(postId);
    saveState(state);
    if (snapshot) postHistoryService.addPost(snapshot);
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
   * Returns the union of saved ∪ liked post IDs (NOT
   * dismissed anchor IDs). Consumed by `postHistoryService.purgeExpired()`
   * to pin engaged posts against the retention purge.
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

  /**
   * Wipe ONLY the dismissed-anchor list (saved + liked are user archives —
   * persist across days per operator intent confirmed during Phase 43 UAT).
   * Phase 43 (gap-closure 43-13) wires this into Force-New-Day in
   * SettingsDataScreen so the dev affordance produces the intended
   * "previously-hidden tiles return tomorrow" UX without nuking the user's
   * saved/liked archives.
   *
   * Idempotent: no-op + no event when dismissed.length === 0.
   *
   * Emits EXACTLY ONE ENGAGEMENT_CHANGED with kind: 'undismiss' and sentinel
   * id: '*' to signal "bulk reset" to subscribers. HomeScreen Effect B
   * (Phase 43-06 dual-effect canonical shape) re-reads
   * getDismissedAnchorIds() on this emit and refills dismissed-anchor tiles
   * in the feed.
   *
   * `reset()` (above) stays as the wholesale wipe for Clear-All-Data /
   * settingsService.reset() — that path still wants saved + liked cleared.
   */
  resetDismissedOnly(): void {
    const state = loadState();
    if (state.dismissed.length === 0) return; // idempotent — no-op + no event
    state.dismissed = [];
    saveState(state);
    eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'undismiss', id: '*' } });
  },
};
