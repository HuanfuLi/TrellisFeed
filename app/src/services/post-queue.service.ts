// Post queue service — 8-post FIFO buffer with localStorage persistence (Phase 31, D-10/D-11).
// Stores a daily queue of DailyPost items, auto-resets on new day (date mismatch).

import type { DailyPost } from '../types/index.ts';
// Phase 36-11: rehydration on date-mismatch re-interleaves yesterday's leftover
// queue via spreadByConcept + spreadByStyle. These are leaf functions in
// feed-spread.ts (zero transitive deps on settings/locales chains, so this
// import is safe under node --test).
import { spreadByConcept, spreadByStyle } from './feed-spread.ts';
import { eventBus } from '../lib/event-bus.ts';
import { dbExecute, dbQuery } from './db.service.ts';

// Phase 55-07: IndexedDB is the SOLE persistence for the queue state. The
// in-memory `_state` is the synchronous read+write mirror; it starts EMPTY
// (freshState()) at module init and is populated from IndexedDB by
// hydrateQueueFromSQLite() at boot. The whole QueueState serializes to one row
// keyed by SQLITE_ROW_ID; the durable yesterday snapshot is a SECOND row keyed
// by SQLITE_ROW_ID_YESTERDAY. No localStorage write for `trellis_post_queue`.
const SQLITE_ROW_ID = 'queue_state';
// Phase 36 GAP-D Fix A (2026-05-07), re-homed to IndexedDB in 55-07: durable
// yesterday snapshot. The live queue row is overwritten by the very first save()
// of today's queue, so a single-row getYesterdayQueue() would be destroyed
// within milliseconds of any new-day cold start. We snapshot yesterday's payload
// to a SEPARATE IndexedDB row (and an in-memory mirror for sync reads) in the
// date-mismatch branch BEFORE rehydrating today's _state, making the warm-start
// path durable across multiple cold-start mounts of the new day. See
// .planning/debug/cold-start-warm-start-fragile.md and the CLAUDE.md "Numeric
// defaults" bullet for the durable-snapshot rationale.
const SQLITE_ROW_ID_YESTERDAY = 'queue_yesterday';

// In-memory mirror of the durable yesterday snapshot (sync read path for
// getYesterdayQueue()). Populated by hydrateQueueFromSQLite() on a date mismatch
// and by the date-mismatch branch of normalizeState().
let _yesterday: { date: string; posts: DailyPost[] } | null = null;
// 2026-04-21 bump: refill threshold 8 → 12. refillQueue now pre-generates
// images before enqueue (moved from pop-time to enqueue-time), so each
// refill cycle takes longer. Triggering refill earlier (at 12 remaining
// instead of 8) gives more runway so the user doesn't hit an empty queue
// mid-swipe while image generation is still in flight.
//
// Phase 36-12: bumped from 12 → 16. The mutex fix in Plan 36-12 Task 1
// eliminates the silent-no-op race, but a larger headroom further reduces
// the chance of the user encountering empty-state during rapid swiping.
// Phase 42 UAT (2026-05-10): masonry feed lands → operator bumps refill
// threshold 16 → 24 to keep more runway in the buffer (each swipe-for-more
// now pops 8 posts instead of 4, so the prior 16 threshold drained twice
// as fast). MAX_QUEUE_SIZE held at 32 — increasing further risks longer
// initial load waits without a proportional UX gain.
const REFILL_THRESHOLD = 24;
const MAX_QUEUE_SIZE = 32;

interface QueueState {
  date: string;
  posts: DailyPost[];
  cycleNumber: number;
  totalGenerated: number;
  totalServed: number;
  // Phase 36 GAP-1 + GAP-2 — persistent derived list + cyclic walker.
  // CLAUDE.md "Concept Feed Generation Pipeline" list 2/3 (derived list,
  // append-only) and walker position into list 3/3 (the queue is fed by
  // walking this list cyclically, 4 per swipe per design).
  derivedList: string[];
  cyclePosition: number;
}

// Inline today() to avoid i18next dependency chain from lib/date.ts.
function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function freshState(): QueueState {
  return {
    date: today(),
    posts: [],
    cycleNumber: 0,
    totalGenerated: 0,
    totalServed: 0,
    derivedList: [],
    cyclePosition: 0,
  };
}

// Apply the LOAD-BEARING 3-list-pipeline normalization to a parsed QueueState
// payload (CLAUDE.md "Concept Feed Generation Pipeline" / "New-day rehydration").
// This is the exact body the prior load() ran against the localStorage payload —
// re-homed here so it runs against the IndexedDB-loaded payload during hydrate.
// Do NOT change the numeric defaults or the rehydration semantics.
function normalizeState(parsed: Partial<QueueState>): QueueState {
  if (parsed.date !== today()) {
    // Date mismatch — snapshot yesterday's payload to the durable yesterday
    // mirror + IndexedDB row BEFORE rehydrating today's _state. This makes
    // getYesterdayQueue() durable across multiple cold-start mounts of the new
    // day (Plan 36-09 contract); without it, the very first save() of today's
    // queue overwrites the live row and yesterday's posts are lost. See
    // .planning/debug/cold-start-warm-start-fragile.md and CLAUDE.md "Numeric
    // defaults" for the durable-snapshot rationale.
    if (Array.isArray(parsed.posts) && parsed.posts.length > 0) {
      // Copy the posts array — the rehydration below reuses parsed.posts as the
      // live _state.posts and mutates it in place (spreadByConcept/spreadByStyle,
      // enqueue), which would otherwise corrupt the yesterday snapshot via shared
      // reference.
      const snapshot = { date: parsed.date ?? '', posts: [...parsed.posts] };
      _yesterday = snapshot;
      void dbExecute('INSERT OR REPLACE INTO post_queue (id, data) VALUES (?, ?)', [
        SQLITE_ROW_ID_YESTERDAY,
        JSON.stringify(snapshot),
      ]).catch(() => { /* IndexedDB unavailable — in-memory mirror is the read path */ });
    }
    // Phase 36-11: rehydrate today's _state from yesterday's UNSERVED queue.
    // Yesterday's snapshot contains posts that were generated but never popped
    // by the user — they remain valid content and should auto-populate today's
    // feed (no manual swipe needed, no LLM-pipeline wait). Counters reset to 0
    // (new day's totals start fresh). cycleNumber inherits for continuity.
    // After rehydrating, re-interleave by spreadByConcept + spreadByStyle to
    // balance the style mix — yesterday's leftover is style-biased toward
    // minority styles (text-art was popped first as plurality), so renders
    // as video → news → video → news without re-interleave. See round-3
    // sub-issue (c). The mixers mutate the array in place.
    const rehydrated: DailyPost[] = Array.isArray(parsed.posts) ? parsed.posts : [];
    if (rehydrated.length > 0) {
      spreadByConcept(rehydrated);
      spreadByStyle(rehydrated);
    }
    return {
      date: today(),
      posts: rehydrated,
      cycleNumber: typeof parsed.cycleNumber === 'number' ? parsed.cycleNumber : 0,
      totalGenerated: 0,
      totalServed: 0,
      derivedList: Array.isArray(parsed.derivedList) ? parsed.derivedList : [],
      cyclePosition: typeof parsed.cyclePosition === 'number' ? parsed.cyclePosition : 0,
    };
  }
  // Phase 36 GAP-1 — defensive read for payloads on the prior schema, which
  // lack derivedList + cyclePosition. Treat missing fields as their fresh
  // defaults so the queue does NOT crash — the walker will append on the next
  // refill cycle and the day starts as if cycle position = 0.
  return {
    date: parsed.date ?? today(),
    posts: Array.isArray(parsed.posts) ? parsed.posts : [],
    cycleNumber: typeof parsed.cycleNumber === 'number' ? parsed.cycleNumber : 0,
    totalGenerated: typeof parsed.totalGenerated === 'number' ? parsed.totalGenerated : 0,
    totalServed: typeof parsed.totalServed === 'number' ? parsed.totalServed : 0,
    derivedList: Array.isArray(parsed.derivedList) ? parsed.derivedList : [],
    cyclePosition: typeof parsed.cyclePosition === 'number' ? parsed.cyclePosition : 0,
  };
}

function save(state: QueueState): void {
  // IndexedDB write-through (D-09/D-12) — fire-and-forget single-row upsert.
  // No localStorage write for `trellis_post_queue` anymore.
  void dbExecute('INSERT OR REPLACE INTO post_queue (id, data) VALUES (?, ?)', [
    SQLITE_ROW_ID,
    JSON.stringify(state),
  ]).catch(() => { /* IndexedDB unavailable — in-memory mirror is the read path */ });
}

// The mirror starts EMPTY (clean cutover). hydrateQueueFromSQLite() populates it
// from IndexedDB at boot (App.tsx awaits before first render).
let _state: QueueState = freshState();

let _hydratedQueue = false;

/**
 * Boot hydration (D-12). When the in-memory mirror is empty (D-11 clean-cutover
 * state) restore the queue state from SQLite's single row. Guarded so a
 * populated mirror is never overwritten. Re-runs the same-day / new-day branch
 * logic of load() against the SQLite payload so the 3-list pipeline semantics
 * (derived-list append-only, cyclic queue, new-day rehydration) are preserved.
 * Emits GRAPH_UPDATED so always-mounted screens resync (no-refresh assumption).
 */
export async function hydrateQueueFromSQLite(): Promise<void> {
  if (_hydratedQueue) return;
  _hydratedQueue = true;
  try {
    // First restore the durable yesterday snapshot so getYesterdayQueue() works
    // on a warm-start mount even if today's queue row drives a same-day branch.
    try {
      const yRows = await dbQuery<{ id: string; data: string }>(
        'SELECT * FROM post_queue WHERE id = ?', [SQLITE_ROW_ID_YESTERDAY],
      );
      if (yRows.length > 0) {
        const ySnap = JSON.parse(yRows[0].data) as { date: string; posts: DailyPost[] };
        if (Array.isArray(ySnap.posts)) _yesterday = ySnap;
      }
    } catch { /* no yesterday snapshot — fine */ }

    if (_state.posts.length > 0 || _state.derivedList.length > 0) return; // mirror has data — trust it
    const rows = await dbQuery<{ id: string; data: string }>(
      'SELECT * FROM post_queue WHERE id = ?', [SQLITE_ROW_ID],
    );
    if (rows.length === 0) return;
    let parsed: Partial<QueueState>;
    try { parsed = JSON.parse(rows[0].data) as Partial<QueueState>; } catch { return; }
    // Run the LOAD-BEARING normalization against the IndexedDB payload — this is
    // where the date-mismatch rehydration + yesterday-snapshot + defensive-default
    // branches now run (moved off the module-init localStorage read).
    _state = normalizeState(parsed);
    // Persist the normalized state back so a same-day branch's defaults / a
    // new-day rehydration are durable for the next mount.
    save(_state);
    if (_state.posts.length > 0 || _state.derivedList.length > 0) {
      eventBus.emit({ type: 'GRAPH_UPDATED' });
    }
  } catch {
    // IndexedDB unavailable — silently skip
  }
}

export const postQueueService = {
  /** Get a shallow copy of the current queue. */
  getQueue(): DailyPost[] {
    return [..._state.posts];
  },

  /**
   * Append posts to the end of the queue. Deduplicates by id across both
   * existing queue items AND within the incoming batch. Caps at MAX_QUEUE_SIZE.
   *
   * Phase 33 gap fix (2026-04-20): the prior dedup filtered the incoming batch
   * against `existingIds` only, so duplicates WITHIN `posts` both passed through
   * and landed side-by-side in the queue. With UUID-suffixed IDs (makePostId)
   * this shouldn't occur, but the defense-in-depth invariant makes the queue's
   * uniqueness structural — any future ID-generator bug drops silently here
   * (with a dev-mode warn) instead of manifesting as linked-playback or other
   * shared-state React bugs downstream.
   */
  enqueue(posts: DailyPost[]): void {
    const seen = new Set(_state.posts.map(p => p.id));
    const fresh: DailyPost[] = [];
    const duplicates: string[] = [];
    for (const p of posts) {
      if (seen.has(p.id)) {
        duplicates.push(p.id);
        continue;
      }
      seen.add(p.id);
      fresh.push(p);
    }
    if (duplicates.length > 0 && typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.warn('[postQueueService] Rejected duplicate post IDs at enqueue:', duplicates);
    }
    const capacity = MAX_QUEUE_SIZE - _state.posts.length;
    const added = fresh.slice(0, Math.max(0, capacity));
    _state.posts.push(...added);
    _state.totalGenerated += added.length;
    save(_state);
  },

  /**
   * Enqueue + interleave in one step: combines the unserved queue tail with
   * the new batch, runs a caller-supplied mixer over the combined list, then
   * replaces the queue's posts with the mixed result.
   *
   * Why it exists (2026-04-21): plain `enqueue` concatenates — so the user's
   * next pop of `count` posts slices a window out of `[batch1, batch2, ...]`
   * that may land entirely inside one batch's single-style tail, producing
   * the observed "many text-art in a row, then many video in a row" feed.
   * Interleaving at enqueue time mixes the freshly-generated batch WITH
   * whatever's still pending from prior cycles, so cross-batch clustering
   * can't happen.
   *
   * The mixer is passed in (rather than importing spreadByStyle here) to
   * avoid a post-queue ↔ concept-feed circular import. The mixer mutates
   * its input array in place; this method treats it as producing the final
   * post order.
   *
   * Dedup against existing queue is preserved (same rules as `enqueue`).
   * `totalGenerated` counts only the fresh additions, not the re-mixed tail.
   */
  enqueueInterleaved(posts: DailyPost[], mixer: (combined: DailyPost[]) => void): void {
    const seen = new Set(_state.posts.map(p => p.id));
    const fresh: DailyPost[] = [];
    const duplicates: string[] = [];
    for (const p of posts) {
      if (seen.has(p.id)) { duplicates.push(p.id); continue; }
      seen.add(p.id);
      fresh.push(p);
    }
    if (duplicates.length > 0 && typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.warn('[postQueueService] Rejected duplicate post IDs at enqueueInterleaved:', duplicates);
    }
    const combined = [..._state.posts, ...fresh];
    const capped = combined.slice(0, MAX_QUEUE_SIZE);
    mixer(capped);
    const addedCount = Math.min(fresh.length, MAX_QUEUE_SIZE - _state.posts.length);
    _state.posts = capped;
    _state.totalGenerated += Math.max(0, addedCount);
    save(_state);
  },

  /** Remove and return the first `count` posts from the queue (FIFO). */
  dequeue(count: number): DailyPost[] {
    const items = _state.posts.splice(0, count);
    _state.totalServed += items.length;
    save(_state);
    return items;
  },

  /**
   * Remove specific posts from the in-memory queue by id. Persists the
   * mutated state to STORAGE_KEY (the LIVE key — STORAGE_KEY_YESTERDAY
   * snapshot is read-only and untouched).
   *
   * Phase 43 gap-closure 43-15 — `removeByIds` is invoked by HomeScreen's
   * warm-start tier-2 fallback after Force-New-Day. The fallback seeds
   * dailyPosts from postQueueService.getYesterdayQueue() (the durable
   * snapshot at STORAGE_KEY_YESTERDAY); without this helper, those same posts also
   * remain in _state.posts (rehydrated from the same parsed.posts payload
   * by load() at lines 107-114) and would be re-popped via dequeue(8) on
   * the next swipe-for-more, producing duplicate React keys (UAT Test 12
   * blocker — see .planning/debug/duplicate-post-keys-after-force-new-day.md).
   *
   * Idempotent: ids not present in _state.posts are silently ignored.
   * Empty input is a no-op (no save). Returns the number of posts actually
   * removed for caller assertions / tests.
   *
   * Does NOT decrement totalServed — these posts have NOT been served to
   * the user via dequeue; they have been seeded as the user's "yesterday's
   * leftover" feed via the warm-start fallback, which is a DIFFERENT
   * delivery path. (totalServed tracks queue-served count, which is a
   * separate metric.)
   *
   * Does NOT mutate the STORAGE_KEY_YESTERDAY snapshot — that snapshot
   * is the durable cross-cold-start record (Plan 36-09); getYesterdayQueue()
   * MUST continue to return the unmodified yesterday payload regardless
   * of how many warm-start mounts have run.
   */
  removeByIds(ids: string[]): number {
    if (ids.length === 0) return 0;
    const removeSet = new Set(ids);
    const before = _state.posts.length;
    _state.posts = _state.posts.filter(p => !removeSet.has(p.id));
    const removed = before - _state.posts.length;
    if (removed > 0) save(_state);
    return removed;
  },

  /** Current queue length. */
  size(): number {
    return _state.posts.length;
  },

  /** True when queue has fewer than REFILL_THRESHOLD posts. */
  needsRefill(): boolean {
    return _state.posts.length < REFILL_THRESHOLD;
  },

  /** Current generation cycle number for today. */
  getCycleNumber(): number {
    return _state.cycleNumber;
  },

  /** Total posts generated today (actual count, not estimated). */
  getTotalGenerated(): number {
    return _state.totalGenerated;
  },

  /** Total posts served (dequeued) today. */
  getTotalServed(): number {
    return _state.totalServed;
  },

  /** Increment the cycle counter (after a generation batch completes). */
  incrementCycle(): void {
    _state.cycleNumber++;
    save(_state);
  },

  /**
   * Reset the queue for a new day — clears posts, resets cycle to 0. Does NOT
   * clear the durable yesterday snapshot (the "Reset today" button preserves
   * yesterday's leftover so getYesterdayQueue() still works).
   */
  resetForNewDay(): void {
    _state = freshState();
    save(_state);
  },

  /**
   * Full wipe of BOTH the live queue AND the yesterday snapshot (in-memory +
   * IndexedDB). Used by Clear-All-Data; without clearing _yesterday a stale
   * yesterday mirror would survive a Clear-All-Data until the next reload.
   */
  resetAll(): void {
    _state = freshState();
    _yesterday = null;
    void dbExecute('DELETE FROM post_queue WHERE id = ?', [SQLITE_ROW_ID]).catch(() => { /* ignore */ });
    void dbExecute('DELETE FROM post_queue WHERE id = ?', [SQLITE_ROW_ID_YESTERDAY]).catch(() => { /* ignore */ });
  },

  /**
   * Re-normalize the current in-memory queue state (detects date mismatch and
   * triggers the new-day rehydration + yesterday snapshot). Phase 55-07: the
   * queue mirror is in-memory + IndexedDB, so this re-runs normalizeState over
   * the live _state rather than re-reading localStorage. The dev Force-New-Day
   * affordance rolls _state.date back via simulateDateRollback() then calls this.
   */
  loadQueue(): void {
    _state = normalizeState(_state);
    save(_state);
  },

  /**
   * DEV-ONLY (Force-New-Day): roll the in-memory queue date back to `date` so
   * the next loadQueue() detects a mismatch and runs the new-day rehydration +
   * yesterday-snapshot path. Replaces the old dev affordance that mutated the
   * `trellis_post_queue` localStorage key directly (which no longer backs the
   * mirror). Returns true if there was a queue to roll back.
   */
  simulateDateRollback(date: string): boolean {
    if (_state.posts.length === 0 && _state.derivedList.length === 0) return false;
    _state = { ..._state, date };
    return true;
  },

  /**
   * Peek at yesterday's leftover queue (durable across cold-start mounts of the
   * new day). Reads from STORAGE_KEY_YESTERDAY — the snapshot key written by
   * load() in its date-mismatch branch — NOT the live STORAGE_KEY (which gets
   * overwritten by the first save() of today's queue). See Phase 36 GAP-D Fix A
   * and .planning/debug/cold-start-warm-start-fragile.md.
   */
  getYesterdayQueue(): DailyPost[] {
    // Reads the in-memory yesterday snapshot (durable mirror of the IndexedDB
    // `queue_yesterday` row). NOT the live queue (which the first save() of
    // today's queue would overwrite). See Phase 36 GAP-D Fix A.
    return _yesterday && Array.isArray(_yesterday.posts) ? [..._yesterday.posts] : [];
  },

  // ─── Phase 36 GAP-1 + GAP-2 — persistent derived list + cyclic walker ───

  /** Get a shallow copy of the persistent derived list (list 2/3 of the pipeline). */
  getDerivedList(): string[] {
    return [..._state.derivedList];
  },

  /** Walker position into the derived list. Wraps to 0 on overflow. */
  getCyclePosition(): number {
    return _state.cyclePosition;
  },

  /**
   * Append-only — dedup ACROSS calls by conceptId equality. Within a single
   * call, multiplicity is PRESERVED (a first-time append of ['a','a','a','a',
   * 'b','b','b','b'] stores 8 entries because none of the IDs are present in
   * derivedList yet). Subsequent calls with overlapping IDs are no-ops for
   * those IDs (so a second append of ['a','b'] adds zero entries — the 8/4
   * importance weighting from the first call survives unchanged).
   *
   * Rationale (RESEARCH § Pitfall 4): Importance weighting is encoded as
   * multiplicity (an important anchor gets 8 entries, normal anchor 4 entries
   * — see buildConceptBatch BASE_ENTRIES_PER_CONCEPT). buildConceptBatch
   * upstream filters out explored anchors and assigns multiplicities, then
   * passes the weighted list here. We must preserve those multiplicities on
   * first append, AND we must dedup across calls so subsequent refills do not
   * re-append the same anchor's entries (which would either double-weight or
   * inflate the derived list unboundedly).
   *
   * Implementation: seed `existing` ONCE from the current derivedList before
   * the loop, then ONLY check membership inside the loop — do NOT mutate
   * `existing` per iteration. Within-call duplicates pass the check (none are
   * in the seeded `existing` set) so multiplicity is preserved; cross-call
   * duplicates are caught because the seed reflects what's already persisted.
   */
  appendToDerivedList(conceptIds: string[]): void {
    if (conceptIds.length === 0) return;
    // Seed ONCE before loop — captures what's already persisted across calls.
    // Do NOT mutate this set inside the loop; that would deduplicate
    // within-call, destroying importance multiplicity (Plan 36-00 Test 10,
    // RESEARCH § Pitfall 4).
    const existing = new Set(_state.derivedList);
    let added = 0;
    for (const id of conceptIds) {
      if (existing.has(id)) continue;
      _state.derivedList.push(id);
      added++;
    }
    if (added > 0) save(_state);
  },

  /**
   * Walk the derived list to collect `count` non-explored conceptIds, advancing
   * cyclePosition for each step taken. Wraps to position 0 on overflow.
   *
   * Lazy removal-on-read (RESEARCH § "Removal-on-read semantics under append-only"):
   * exploredIds gates which conceptIds are RETURNED (skipped if explored), but
   * cyclePosition advances PAST them too — so explored entries don't hang the
   * walker.
   *
   * Termination: walks at most `Math.max(count * 2, derivedList.length)` steps
   * to avoid an infinite loop when every entry is explored. The `count * 2`
   * factor preserves the lazy-skip headroom (walker can scan up to twice the
   * request size to skip explored entries); the `len` floor preserves the
   * "at least one full pass" property when count < len. Returns whatever it
   * found (possibly empty — caller has an early-return guard). See Phase 36
   * GAP-B closure (post-queue.service.ts comment + .planning/debug/style-mix-imbalance.md).
   */
  // Phase 39 D-07: dismissedIds is REQUIRED positional (not defaulted) so future callers must explicitly opt in to the dismiss-skip behavior.
  walkDerivedList(count: number, exploredIds: Set<string>, dismissedIds: Set<string>): string[] {
    const len = _state.derivedList.length;
    if (len === 0) return [];
    const result: string[] = [];
    // Phase 36 GAP-B fix: termination must scale with `count`, not just with len.
    // Original `len * 2` silently capped walkDerivedList(16, ...) at 8 entries
    // when len=4 (single non-important anchor case), causing assignStylesStratified
    // to receive N=8 instead of N=16 — at N=8 the largest-remainder math pins
    // text-art at its floor (4/8 = 50%) because text-art's remainder 0.40 loses
    // to minority 0.80. At N=16, text-art's 0.80 beats minority 0.60 → 9/16 = 56%.
    // Math.max preserves the original `len * 2` lazy-skip headroom while ALSO
    // guaranteeing the walker can fulfill the count request (modulo all-explored).
    // See .planning/debug/style-mix-imbalance.md for the full math walkthrough.
    const maxSteps = Math.max(count * 2, len);
    let steps = 0;
    while (result.length < count && steps < maxSteps) {
      const id = _state.derivedList[_state.cyclePosition];
      _state.cyclePosition = (_state.cyclePosition + 1) % len;
      steps++;
      if (!exploredIds.has(id) && !dismissedIds.has(id)) result.push(id);
    }
    save(_state);
    return result;
  },
};
