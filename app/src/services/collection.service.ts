// Collection service — Phase 50 (D-03 / D-04 / D-09 / D-08).
//
// User-defined post collections (YouTube-playlist analogy). Persisted under
// localStorage key `trellis_collections_v1`. Storage is ID-only — DailyPost
// snapshots are resolved at read time via `postHistoryService.getPosts()`
// (mirrors `engagementService` discipline for save / like ID-only storage).
//
// Leaf-module discipline (Phase 37 D-01 / D-08, copied from engagement.service.ts):
//   - No JSON imports, no `react-i18next`, no `lib/date.ts` (would re-introduce
//     the i18next dependency chain and break `node --test` loadability).
//   - Sync API; localStorage-backed.
//   - ID-only storage with snapshot resolution via postHistoryService at read
//     time (D-03 — avoid duplicating the post-history snapshot store).
//   - MUST NOT import engagementService. Import direction is unidirectional:
//     engagementService → collectionService → postHistoryService (RESEARCH
//     Pitfall 2 — circular dep risk).
//
// Event-emission rules (Phase 50 + CLAUDE.md §"Event bus — unified GRAPH_UPDATED"):
//   - ONE event per semantic mutation. Every successful mutator emits EXACTLY
//     ONE COLLECTIONS_CHANGED with a discriminating `kind` payload:
//       create | rename | delete | add-post | remove-post
//   - All mutators are idempotent: re-saving an already-member post is a
//     no-op AND does NOT re-emit (membership check before push+emit).
//   - reset() emits NOTHING (D-08 wholesale-wipe — UI consumers should re-read
//     on Clear-All-Data rather than chase per-action events).
//
// Validation rules (Claude's Discretion in 50-CONTEXT.md):
//   - createCollection / renameCollection validate name at the service
//     boundary: trim → non-empty → ≤50 chars → case-insensitive dedup.
//   - Error keys are i18n SUFFIXES ('nameEmpty' | 'nameTooLong' | 'nameDuplicate')
//     so callers can compose t(`library.savePicker.${result.error}`).
//   - Threat T-50-XSS-NAME: validation does NOT sanitize or strip HTML — the
//     render boundary (HighlightedText in 50-06) uses React text nodes only.
//
// Threat mitigations:
//   - T-50-QUOTA: saveState() try/catch silently drops on localStorage quota
//     exceeded (matches engagementService + postHistoryService precedent).
//   - T-50-ORPHAN: getCollectionPosts() silently drops IDs not present in
//     postHistoryService.getPosts() (graceful degradation — matches D-04 in
//     engagementService).
//   - T-50-MALFORMED-JSON: loadState() try/catch + shape check returns
//     freshState() on parse failure.

import type { DailyPost, Collection } from '../types/index.ts';
import { eventBus } from '../lib/event-bus.ts';
import { postHistoryService } from './post-history.service.ts';

const STORAGE_KEY = 'trellis_collections_v1';
const MAX_NAME_LENGTH = 50;

// Locked ServiceResult shape per 50-PATTERNS.md §"ServiceResult<T> Return Type":
//   { success: true; data: T } | { success: false; error: <i18n key suffix> }
// The `error` value maps to `library.savePicker.${error}` on the consumer side.
// We use a local alias instead of the global ServiceResult<T> because the plan
// locks a simpler string-error shape (consumers branch on the literal union).
type NameError = 'nameEmpty' | 'nameTooLong' | 'nameDuplicate';
type CollectionResult<T> =
  | { success: true; data: T }
  | { success: false; error: NameError };

interface CollectionsState {
  collections: Collection[];
}

function freshState(): CollectionsState {
  return { collections: [] };
}

function loadState(): CollectionsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return freshState();
    const p = parsed as Partial<CollectionsState>;
    return {
      collections: Array.isArray(p.collections) ? p.collections : [],
    };
  } catch {
    return freshState();
  }
}

function saveState(state: CollectionsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage quota exceeded — silently drop (T-50-QUOTA).
  }
}

function resolvePostsByIds(ids: string[]): DailyPost[] {
  // Resolve through postHistoryService at read time (D-03). Preserves the
  // collection's INSERTION order (the user-action sequence), NOT history
  // order. Posts not found in history are silently dropped (T-50-ORPHAN —
  // graceful degradation when post-history was purged or Clear-All-Data ran).
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

/**
 * Validate a collection name. Returns null when valid, or an i18n key suffix
 * ('nameEmpty' | 'nameTooLong' | 'nameDuplicate') on failure. Case-insensitive
 * duplicate check; pass `excludeId` for rename so a collection can rename to
 * its own current (case-changed) name.
 */
function validateName(
  name: string,
  existing: Collection[],
  excludeId?: string,
): NameError | null {
  const trimmed = name.trim();
  if (!trimmed) return 'nameEmpty';
  if (trimmed.length > MAX_NAME_LENGTH) return 'nameTooLong';
  const lower = trimmed.toLowerCase();
  if (existing.some(c => c.id !== excludeId && c.name.toLowerCase() === lower)) {
    return 'nameDuplicate';
  }
  return null;
}

/**
 * Generate a collision-resistant collection id — timestamp + base36 random
 * suffix. Matches the GraphEditLogEntry.id pattern (Claude's Discretion in
 * 50-CONTEXT.md). Sub-millisecond same-tick collisions are still possible in
 * theory but the random suffix's ~6e7 keyspace makes it negligible.
 */
function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const collectionService = {
  // ─── CRUD (collections) ──────────────────────────────────────────────────

  /**
   * Create a new collection. Trims the name + enforces ≤50 chars + case-
   * insensitive dedup. Returns the created Collection on success or the
   * appropriate name-error suffix on failure. Emits EXACTLY ONE
   * COLLECTIONS_CHANGED { kind: 'create' } on success; emits NOTHING on
   * validation failure.
   */
  createCollection(name: string): CollectionResult<Collection> {
    const state = loadState();
    const err = validateName(name, state.collections);
    if (err) return { success: false, error: err };
    const now = Date.now();
    const collection: Collection = {
      id: genId(),
      name: name.trim(),
      postIds: [],
      createdAt: now,
      updatedAt: now,
    };
    state.collections.push(collection);
    saveState(state);
    eventBus.emit({
      type: 'COLLECTIONS_CHANGED',
      payload: { kind: 'create', collectionId: collection.id },
    });
    return { success: true, data: collection };
  },

  /**
   * Rename a collection. Same validation rules as create, but the
   * collection's current name is excluded from the dedup check so it can
   * rename to a case-changed version of itself. No-op + no emit when the
   * target id does not exist (defensive — caller may race a delete).
   */
  renameCollection(id: string, name: string): CollectionResult<void> {
    const state = loadState();
    const target = state.collections.find(c => c.id === id);
    if (!target) {
      // Treat missing target as a silent no-op for service ergonomics.
      // No event emitted; callers re-reading getCollections() will discover
      // the collection no longer exists.
      return { success: true, data: undefined };
    }
    const err = validateName(name, state.collections, id);
    if (err) return { success: false, error: err };
    target.name = name.trim();
    target.updatedAt = Date.now();
    saveState(state);
    eventBus.emit({
      type: 'COLLECTIONS_CHANGED',
      payload: { kind: 'rename', collectionId: id },
    });
    return { success: true, data: undefined };
  },

  /**
   * Delete a collection. Posts remain in the user's Saved archive — the
   * delete only removes the collection envelope and its membership list
   * (UI-SPEC deleteConfirm: "Posts will remain in Saved."). Idempotent:
   * re-deleting a non-existent collection returns success without emitting.
   */
  deleteCollection(id: string): CollectionResult<void> {
    const state = loadState();
    const exists = state.collections.some(c => c.id === id);
    if (!exists) return { success: true, data: undefined }; // idempotent
    state.collections = state.collections.filter(c => c.id !== id);
    saveState(state);
    eventBus.emit({
      type: 'COLLECTIONS_CHANGED',
      payload: { kind: 'delete', collectionId: id },
    });
    return { success: true, data: undefined };
  },

  // ─── Membership (posts within a collection) ──────────────────────────────

  /**
   * Add a post to a collection (idempotent — no-op + no emit if already a
   * member). No-op + no emit when the collection does not exist (defensive
   * against caller races). Emits EXACTLY ONE COLLECTIONS_CHANGED
   * { kind: 'add-post' } on a real addition.
   */
  addPost(collectionId: string, postId: string): void {
    const state = loadState();
    const target = state.collections.find(c => c.id === collectionId);
    if (!target) return;
    if (target.postIds.includes(postId)) return; // idempotent guard
    target.postIds.push(postId);
    target.updatedAt = Date.now();
    saveState(state);
    eventBus.emit({
      type: 'COLLECTIONS_CHANGED',
      payload: { kind: 'add-post', collectionId },
    });
  },

  /**
   * Remove a post from a collection (idempotent — no-op + no emit if not a
   * member). No-op + no emit when the collection does not exist. Emits
   * EXACTLY ONE COLLECTIONS_CHANGED { kind: 'remove-post' } on a real removal.
   */
  removePost(collectionId: string, postId: string): void {
    const state = loadState();
    const target = state.collections.find(c => c.id === collectionId);
    if (!target) return;
    if (!target.postIds.includes(postId)) return; // idempotent guard
    target.postIds = target.postIds.filter(p => p !== postId);
    target.updatedAt = Date.now();
    saveState(state);
    eventBus.emit({
      type: 'COLLECTIONS_CHANGED',
      payload: { kind: 'remove-post', collectionId },
    });
  },

  // ─── Read-only accessors ─────────────────────────────────────────────────

  /** All collections in insertion order (oldest first). */
  getCollections(): Collection[] {
    return loadState().collections;
  },

  /**
   * Resolve a collection's postIds to full DailyPost objects via
   * postHistoryService. IDs not present in history are silently dropped
   * (T-50-ORPHAN). Returns an empty array when the collection does not exist.
   */
  getCollectionPosts(collectionId: string): DailyPost[] {
    const target = loadState().collections.find(c => c.id === collectionId);
    if (!target) return [];
    return resolvePostsByIds(target.postIds);
  },

  /**
   * Union of postIds across ALL collections. Consumed by
   * `engagementService.getPinnedIds()` (D-09) so collection members survive
   * the 7-day rolling history purge in postHistoryService.purgeExpired().
   */
  getAllMemberPostIds(): Set<string> {
    const state = loadState();
    const out = new Set<string>();
    for (const c of state.collections) {
      for (const id of c.postIds) out.add(id);
    }
    return out;
  },

  /**
   * Reverse lookup — all collections that include `postId` in their member
   * list. Drives the CollectionPickerSheet pre-checked rows.
   */
  getPostCollections(postId: string): Collection[] {
    return loadState().collections.filter(c => c.postIds.includes(postId));
  },

  // ─── Test/dev affordance (D-08 — Clear-All-Data) ────────────────────────

  /**
   * Wipe ALL collections to []. Wired into SettingsDataScreen Clear-All-Data
   * sweep alongside `engagementService.reset()`. Emits NOTHING — wholesale
   * wipe is not a per-id change; UI consumers should re-read on the
   * Clear-All-Data event rather than chase per-action events.
   */
  reset(): void {
    saveState(freshState());
  },
};
