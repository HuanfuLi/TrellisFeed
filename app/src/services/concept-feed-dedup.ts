// Cross-cycle YouTube videoId dedup helper (Phase 32.1-02 / UAT-31-2 fix).
// Promotes the per-call seenVideoIds Set (originally added in Phase 31-08 inside
// generatePostBatch at concept-feed.service.ts:685) to module scope so duplicates
// are blocked across multiple refillQueue invocations within a session.
//
// Persistence (added 2026-04-19, supersedes the original D-02 in-memory-only choice):
//   - On first access in a session, lazily backfill the seen-set from videoIds already
//     persisted by postHistoryService. This makes the dedup survive page reloads and
//     app restarts on Capacitor Android, fixing the "same YouTube video keeps
//     reappearing on swipe-for-more" symptom.
//   - We deliberately do NOT import postHistoryService here — that would pull
//     settings.service → llm-provider chain → i18n bundles, breaking this module's
//     "zero transitive deps" property used by node --test (see deferred-items.md).
//     Instead the history source is INJECTED via setSeenVideoIdHistorySource; the
//     dependency points inward, so this module still imports nothing.
//     This used to read `trellis_post_history` from localStorage directly, but the
//     IndexedDB migration retired that key (the boot sweep deletes it), so the
//     backfill silently became a no-op and videos began repeating across restarts.
// Reset semantics:
//   - Cleared on day boundary (maybeResetForNewDay()) — yesterday's videoIds don't
//     block today's pool. The history-backed backfill respects the same day cutoff.
//
// This module has zero transitive deps on i18n / locales bundles, so it can be
// imported directly from `node --test` without the JSON-import-attribute chain.

/** Returns the videoIds of posts generated on `day`. Injected — see module header. */
type VideoIdHistorySource = (day: string) => string[];

let _historySource: VideoIdHistorySource | null = null;
let _seenVideoIds = new Set<string>();
let _trackedDay: string = currentDay();
let _backfilledFromHistory = false;

/**
 * Register the post-history backing store for the lazy backfill. Called once at
 * import time by concept-feed.service.ts, which already depends on
 * postHistoryService. Without a source the backfill is skipped (node --test).
 */
export function setSeenVideoIdHistorySource(source: VideoIdHistorySource): void {
  _historySource = source;
}

// Inline today() to avoid i18next dependency chain from lib/date.ts
// (mirrors post-queue.service.ts:18-25 pattern).
function currentDay(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * If the day has rolled over since we started tracking, clear the dedup set
 * (and the backfill flag, so today's history is reloaded). Without this,
 * yesterday's videoIds would block today's generation forever.
 * Called implicitly from hasSeenVideoId / addSeenVideoId so consumers don't
 * need to remember to call it.
 */
function maybeResetForNewDay(): void {
  const today = currentDay();
  if (today !== _trackedDay) {
    _seenVideoIds = new Set<string>();
    _trackedDay = today;
    _backfilledFromHistory = false;
  }
}

/**
 * Lazy backfill from post history. Runs once per session/day.
 * Only seeds today's videoIds — older entries don't block today's pool.
 * No-ops when no source is registered (node --test).
 */
function maybeBackfillFromHistory(): void {
  if (_backfilledFromHistory) return;
  _backfilledFromHistory = true;
  if (!_historySource) return;
  try {
    for (const vid of _historySource(_trackedDay)) {
      if (typeof vid === 'string' && vid.length > 0) _seenVideoIds.add(vid);
    }
  } catch {
    // Ignore — a failing history read shouldn't break dedup.
  }
}

export function hasSeenVideoId(videoId: string): boolean {
  maybeResetForNewDay();
  maybeBackfillFromHistory();
  return _seenVideoIds.has(videoId);
}

export function addSeenVideoId(videoId: string): void {
  maybeResetForNewDay();
  maybeBackfillFromHistory();
  _seenVideoIds.add(videoId);
}

/** Test-only reset. Do NOT call from production code. */
export function __resetSeenVideoIdsForTesting(): void {
  _seenVideoIds = new Set<string>();
  _trackedDay = currentDay();
  _backfilledFromHistory = false;
}
