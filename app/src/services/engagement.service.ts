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
import { collectionService } from './collection.service.ts';
import { dbExecute, dbQuery } from './db.service.ts';

const STORAGE_KEY = 'trellis_engagement_v1';
// Phase 55 D-09/D-12: engagement state (a single JSON blob of saved/liked/
// dismissed/savedPodcasts ID arrays) write-throughs to one row in the SQLite
// `engagement` table. localStorage mirror stays the synchronous read path.
const SQLITE_ROW_ID = 'engagement_state';

interface EngagementState {
  saved: string[];          // postIds
  liked: string[];          // postIds (recommendation signal — NOT displayed)
  dismissed: string[];      // anchorIds
  savedPodcasts: string[];  // podcast IDs — surfaced in the Saved tab alongside posts
}

function freshState(): EngagementState {
  return { saved: [], liked: [], dismissed: [], savedPodcasts: [] };
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
      // Additive field (no migration — pre-feature payloads load with []).
      savedPodcasts: Array.isArray(p.savedPodcasts) ? p.savedPodcasts : [],
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
  // SQLite write-through (D-09/D-12) — fire-and-forget single-row upsert.
  void dbExecute('INSERT OR REPLACE INTO engagement (id, data) VALUES (?, ?)', [
    SQLITE_ROW_ID,
    JSON.stringify(state),
  ]).catch(() => { /* SQLite unavailable — localStorage mirror is the read path */ });
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
      || cur.dismissed.length > 0 || cur.savedPodcasts.length > 0;
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
      savedPodcasts: Array.isArray(parsed?.savedPodcasts) ? parsed!.savedPodcasts : [],
    };
    const restored = next.saved.length || next.liked.length || next.dismissed.length || next.savedPodcasts.length;
    if (restored) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'save', id: '*' } });
    }
  } catch {
    // SQLite unavailable — silently skip
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
   * the post object (LongPressMenu host, CollectionPickerSheet host) should
   * pass it; callers that don't are unchanged.
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

  // ─── Saved podcasts ────────────────────────────────────────────────────────
  //
  // Podcasts are saved by ID only (leaf discipline — this module must NOT import
  // the heavy podcast.service, which would break node --test loadability). The
  // SavedScreen resolves IDs to DailyPodcast objects via podcastService.getAll()
  // at read time, mirroring the post-resolution pattern.

  /** Save a podcast (idempotent — no-op + no event if already saved). */
  savePodcast(podcastId: string): void {
    const state = loadState();
    if (state.savedPodcasts.includes(podcastId)) return;
    state.savedPodcasts.push(podcastId);
    saveState(state);
    eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'save-podcast', id: podcastId } });
  },

  /** Remove a saved podcast (idempotent — no-op + no event if not saved). */
  removeSavedPodcast(podcastId: string): void {
    const state = loadState();
    if (!state.savedPodcasts.includes(podcastId)) return;
    state.savedPodcasts = state.savedPodcasts.filter(id => id !== podcastId);
    saveState(state);
    eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'unsave-podcast', id: podcastId } });
  },

  isPodcastSaved(podcastId: string): boolean {
    return loadState().savedPodcasts.includes(podcastId);
  },

  getSavedPodcastIds(): string[] {
    return [...loadState().savedPodcasts];
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
   * Returns the union of saved ∪ liked ∪ collection-member post IDs (NOT
   * dismissed anchor IDs). Consumed by `postHistoryService.purgeExpired()`
   * to pin engaged posts against the retention purge so a post saved or
   * collection-anchored >retentionDays ago is not silently dropped from
   * the snapshot store.
   *
   * Phase 50 D-09: collection membership pins a post against the 7-day
   * rolling history purge. If a user adds a post to "For thesis" but does
   * NOT save it globally, the post still survives purge ("they kept it for
   * a reason"). The union is computed lazily here — `purgeExpired()` calls
   * this method ONCE per invocation, not once per candidate post.
   *
   * Import direction is one-way: engagementService → collectionService →
   * postHistoryService (no circular dep — collectionService MUST NOT
   * import engagementService; enforced in plan 50-03).
   */
  getPinnedIds(): Set<string> {
    const s = loadState();
    const collectionMembers = collectionService.getAllMemberPostIds();
    return new Set<string>([...s.saved, ...s.liked, ...collectionMembers]);
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
