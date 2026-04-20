// Runtime API availability tracker (Phase 33 quota-burn fix, 2026-04-20).
//
// Distinguishes between "key is configured" (static — read from settings) and
// "key is currently live" (dynamic — if the backend returned a quota-exhausted
// or otherwise unrecoverable 403/API_QUOTA_EXCEEDED today, we stop trying
// until the day rolls over).
//
// Consumed by concept-feed.service.ts refillQueue:
//   availability.hasYoutubeKey = keyIsSet && isYoutubeRuntimeAvailable()
//   availability.hasTavilyKey  = keyIsSet && isTavilyRuntimeAvailable()
// When a key is flagged unavailable, assignStyles automatically redirects
// video/short/news weights to text-art for the rest of the day — zero
// additional YouTube/Tavily calls until midnight local reset.
//
// Day boundary: keys auto-re-enable when the system date advances. Google
// resets the YouTube quota at midnight Pacific (08:00 UTC), Tavily resets
// monthly, so day-based reset is a conservative estimate — it may re-try
// before quota actually refreshes, but those attempts just re-flip the flag.
//
// Zero transitive deps on i18n / locales — safe to import from any service.

const POST_HISTORY_DAY_KEY = 'echolearn_api_availability_day';

// Persistence so flags survive page reload within the same day.
// Uses localStorage directly (no postHistoryService import) to keep this
// module dep-free, mirroring concept-feed-dedup.ts's pattern.
interface PersistedState {
  day: string;
  youtubeDisabled: boolean;
  tavilyDisabled: boolean;
}

// Inline today() — mirrors post-queue.service.ts:19 and concept-feed-dedup.ts:32
// to avoid the i18next dep chain from lib/date.ts.
function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadState(): PersistedState {
  if (typeof localStorage === 'undefined') {
    return { day: today(), youtubeDisabled: false, tavilyDisabled: false };
  }
  try {
    const raw = localStorage.getItem(POST_HISTORY_DAY_KEY);
    if (!raw) return { day: today(), youtubeDisabled: false, tavilyDisabled: false };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (parsed.day !== today()) {
      // Day rolled over — reset flags, quotas should have reset too.
      return { day: today(), youtubeDisabled: false, tavilyDisabled: false };
    }
    return {
      day: parsed.day,
      youtubeDisabled: parsed.youtubeDisabled === true,
      tavilyDisabled: parsed.tavilyDisabled === true,
    };
  } catch {
    return { day: today(), youtubeDisabled: false, tavilyDisabled: false };
  }
}

function saveState(state: PersistedState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(POST_HISTORY_DAY_KEY, JSON.stringify(state));
  } catch {
    // localStorage full — silently drop; in-memory state still wins for the session.
  }
}

let _state: PersistedState = loadState();

function maybeResetForNewDay(): void {
  if (_state.day !== today()) {
    _state = { day: today(), youtubeDisabled: false, tavilyDisabled: false };
    saveState(_state);
  }
}

/**
 * Flag YouTube as unavailable for the rest of today. Subsequent calls to
 * `isYoutubeRuntimeAvailable()` return false until the date changes.
 * Called by concept-feed.service.ts when searchVideos returns
 * API_QUOTA_EXCEEDED (see youtube.service.ts:174-182).
 */
export function markYoutubeQuotaExhausted(): void {
  maybeResetForNewDay();
  _state = { ..._state, youtubeDisabled: true };
  saveState(_state);
}

/**
 * Flag Tavily as unavailable for the rest of today. Called when webSearch
 * rejects with a 403-class error (quota exhausted / key invalid).
 */
export function markTavilyQuotaExhausted(): void {
  maybeResetForNewDay();
  _state = { ..._state, tavilyDisabled: true };
  saveState(_state);
}

export function isYoutubeRuntimeAvailable(): boolean {
  maybeResetForNewDay();
  return !_state.youtubeDisabled;
}

export function isTavilyRuntimeAvailable(): boolean {
  maybeResetForNewDay();
  return !_state.tavilyDisabled;
}

/** Test-only reset. Do NOT call from production code. */
export function __resetApiAvailabilityForTesting(): void {
  _state = { day: today(), youtubeDisabled: false, tavilyDisabled: false };
  saveState(_state);
}
