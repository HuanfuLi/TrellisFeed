/**
 * Database abstraction layer.
 *
 * ONE backend on every platform (Phase 55, unified 2026-05-21): IndexedDB —
 * used identically in the browser AND inside the iOS/Android Capacitor WebView.
 * IndexedDB quota is disk-based (hundreds of MB+), escaping the ~5MB localStorage
 * cap that motivated the migration, and — unlike main-thread WASM SQLite — needs
 * no Web Worker or COOP/COEP cross-origin isolation. A single backend across
 * web and device keeps behaviour identical and debuggable from the browser console.
 *
 * LocalStorageBackend remains ONLY for environments without IndexedDB (the Node
 * test runner) and as a last-resort fallback if IndexedDB init throws.
 *
 * All public methods mirror a simple key-value + table-query interface (a tiny
 * SQL subset) so callers don't depend on the backend directly.
 *
 * Caveat (tracked for the future client/server split): iOS WebView may evict
 * IndexedDB under storage pressure. Acceptable pre-server (device is a cache once
 * the server owns the source of truth); mitigated by navigator.storage.persist().
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Row = Record<string, string | number | null>;

interface DBBackend {
  init(): Promise<void>;
  execute(sql: string, values?: (string | number | null)[]): Promise<void>;
  query<T extends Row>(sql: string, values?: (string | number | null)[]): Promise<T[]>;
}

// ─── Schema (table set) ───────────────────────────────────────────────────────
// Phase 55 D-09/D-13: the unified IndexedDBBackend derives one object store per
// table from this list (see TABLE_NAMES below). The DDL form is kept as the
// documented schema/column source-of-truth and as the LocalStorageBackend's
// no-op CREATE input; IndexedDB itself stores rows schemalessly with the first
// column as the row key.
//
// `questions.embedding BLOB` (D-13): the Float32 vector is stored base64-encoded
// in a dedicated column (see question.service.ts vectorToBase64) instead of as a
// JSON array inside `data` — ~3x smaller than the JSON form, eliminating the
// localStorage quota wall that motivated this migration.
const SHARED_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    embedding BLOB
  )`,
  `CREATE TABLE IF NOT EXISTS edge_weights (
    edge_key TEXT PRIMARY KEY,
    weight INTEGER NOT NULL DEFAULT 0
  )`,
  // ── Phase 55 heavy-store tables (D-09) ──────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, data TEXT NOT NULL, served_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS post_queue (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS post_history (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS engagement (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS research_records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS research_upload_queue (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS research_upload_quarantine (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS research_metadata (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  // ── Phase 2 frozen content-pool stores ────────────────────────────────────
  // Rows are version-qualified. `storage_id` is `${version}:${recordId}` so a
  // staged version cannot overwrite or become confused with a ready version.
  `CREATE TABLE IF NOT EXISTS content_pool_meta (version TEXT PRIMARY KEY, status TEXT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS content_pool_topics (storage_id TEXT PRIMARY KEY, version TEXT NOT NULL, record_id TEXT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS content_pool_posts (storage_id TEXT PRIMARY KEY, version TEXT NOT NULL, record_id TEXT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS content_pool_concepts (storage_id TEXT PRIMARY KEY, version TEXT NOT NULL, record_id TEXT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS content_pool_claims (storage_id TEXT PRIMARY KEY, version TEXT NOT NULL, record_id TEXT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS content_pool_suggestions (storage_id TEXT PRIMARY KEY, version TEXT NOT NULL, record_id TEXT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS content_pool_assets (storage_id TEXT PRIMARY KEY, version TEXT NOT NULL, record_id TEXT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS content_pool_sources (storage_id TEXT PRIMARY KEY, version TEXT NOT NULL, record_id TEXT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS content_pool_global_edges (storage_id TEXT PRIMARY KEY, version TEXT NOT NULL, record_id TEXT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS content_pool_ranking_features (storage_id TEXT PRIMARY KEY, version TEXT NOT NULL, record_id TEXT NOT NULL, data TEXT NOT NULL)`,
  // Canonical RSD Q&A records. Query columns enforce the same-user/same-post
  // boundary without making a derived transport record the local source of truth.
  `CREATE TABLE IF NOT EXISTS user_questions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, post_id TEXT NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ai_answers (id TEXT PRIMARY KEY, user_question_id TEXT NOT NULL, post_id TEXT NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL)`,
  // ── Phase 3 graph-memory and recommendation stores ──────────────────────
  `CREATE TABLE IF NOT EXISTS user_concept_states (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, concept_id TEXT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS graph_contributions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, concept_id TEXT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS personal_graph_edges (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS extraction_jobs (id TEXT PRIMARY KEY, status TEXT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS recommendations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS recommendation_batches (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, session_id TEXT NOT NULL, data TEXT NOT NULL)`,
];

// Object-store names for the IndexedDB backend, derived from SHARED_DDL so the
// store set never drifts from the documented schema. (SHARED_DDL is retained as
// the schema source-of-truth + column documentation even though IndexedDB stores
// rows schemalessly; the first column of each table is the row key by convention.)
const TABLE_NAMES: string[] = SHARED_DDL
  .map((ddl) => ddl.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)?.[1])
  .filter((n): n is string => !!n);

// ─── localStorage Backend (Node test runner + last-resort fallback) ──────────

const PREFIX = 'questiontrace_db_';

class LocalStorageBackend implements DBBackend {
  // We simulate a table as a JSON blob keyed by tableName.
  private tables: Record<string, Row[]> = {};

  async init() {
    // Hydrate from localStorage on first access
    try {
      const raw = localStorage.getItem(`${PREFIX}tables`);
      if (raw) this.tables = JSON.parse(raw) as Record<string, Row[]>;
    } catch {
      this.tables = {};
    }
  }

  private persist() {
    try {
      localStorage.setItem(`${PREFIX}tables`, JSON.stringify(this.tables));
    } catch {
      // ignore quota errors
    }
  }

  private getTable(name: string): Row[] {
    if (!this.tables[name]) this.tables[name] = [];
    return this.tables[name];
  }

  /**
   * Supports a minimal subset of SQL:
   * - INSERT OR REPLACE INTO <table> (col, ...) VALUES (?, ...)
   * - DELETE FROM <table> WHERE <col> = ?
   * - SELECT * FROM <table>
   * - SELECT * FROM <table> WHERE <col> = ?
   *
   * CREATE TABLE … is a no-op (we auto-create tables).
   */
  async execute(sql: string, values: (string | number | null)[] = []) {
    const s = sql.trim();
    if (/^CREATE\s+TABLE/i.test(s)) return;  // no-op

    // INSERT OR REPLACE INTO table (cols) VALUES (?,...)
    const insertMatch = s.match(/^INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (insertMatch) {
      const table = insertMatch[1];
      const cols = insertMatch[2].split(',').map((c) => c.trim());
      const rows = this.getTable(table);
      const row: Row = {};
      cols.forEach((c, i) => { row[c] = values[i] ?? null; });
      const pkCol = cols[0]; // first column is PK by convention
      const idx = rows.findIndex((r) => r[pkCol] === row[pkCol]);
      if (idx !== -1) rows[idx] = row; else rows.push(row);
      this.persist();
      return;
    }

    // DELETE FROM table WHERE col = ?
    const deleteMatch = s.match(/^DELETE\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\?/i);
    if (deleteMatch) {
      const table = deleteMatch[1];
      const col = deleteMatch[2];
      this.tables[table] = this.getTable(table).filter((r) => r[col] !== values[0]);
      this.persist();
      return;
    }

    // DELETE FROM table  (no WHERE → clear the table). Parity with
    // IndexedDBBackend, which implements this: without it "Clear All Data"
    // silently no-ops whenever this backend is active (private mode fallback).
    const deleteAllMatch = s.match(/^DELETE\s+FROM\s+(\w+)\s*$/i);
    if (deleteAllMatch) {
      this.tables[deleteAllMatch[1]] = [];
      this.persist();
      return;
    }
  }

  async query<T extends Row>(sql: string, values: (string | number | null)[] = []): Promise<T[]> {
    const s = sql.trim();

    // SELECT * FROM table WHERE col = ?
    const selectWhereMatch = s.match(/^SELECT\s+\*\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\?/i);
    if (selectWhereMatch) {
      const table = selectWhereMatch[1];
      const col = selectWhereMatch[2];
      return this.getTable(table).filter((r) => r[col] === values[0]) as T[];
    }

    // SELECT * FROM table
    const selectMatch = s.match(/^SELECT\s+\*\s+FROM\s+(\w+)/i);
    if (selectMatch) {
      return this.getTable(selectMatch[1]) as T[];
    }

    return [];
  }
}

// ─── IndexedDB Backend (web + native WebView — Phase 55, unified) ────────────
// THE backend on every platform. Each SHARED_DDL table maps to one IndexedDB
// object store with out-of-line keys (the row's first column is the key).
// IndexedDB quota is disk-based, escaping the localStorage cap, with none of the
// Worker / COOP / COEP constraints that block main-thread WASM SQLite. The
// DBBackend methods are already async, so the in-memory-mirror + async
// write-through design (D-12) is unchanged — services read synchronously from
// their mirror and write through here. Implements the same minimal SQL subset as
// LocalStorageBackend (INSERT OR REPLACE / DELETE [WHERE] / SELECT *; BEGIN/
// COMMIT/ROLLBACK and CREATE TABLE are no-ops — each op is its own auto-committed
// IDB transaction and stores are created at open()).

const IDB_NAME = 'questiontrace';
const IDB_VERSION = 6;

class IndexedDBBackend implements DBBackend {
  private db: IDBDatabase | null = null;

  async init() {
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of TABLE_NAMES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
      req.onblocked = () => reject(new Error('IndexedDB open blocked'));
    });
  }

  private store(table: string, mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error('IndexedDB not initialised');
    return this.db.transaction(table, mode).objectStore(table);
  }

  private static wrap<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
    });
  }

  async execute(sql: string, values: (string | number | null)[] = []): Promise<void> {
    const s = sql.trim();
    // Transaction verbs + DDL: no-ops (each op below auto-commits its own IDB
    // transaction; object stores are created at open()).
    if (/^(BEGIN|COMMIT|ROLLBACK|CREATE\s+TABLE)/i.test(s)) return;

    // INSERT OR REPLACE INTO <table> (cols) VALUES (?, ...)
    const insertMatch = s.match(/^INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (insertMatch) {
      const table = insertMatch[1];
      const cols = insertMatch[2].split(',').map((c) => c.trim());
      const row: Row = {};
      cols.forEach((c, i) => { row[c] = values[i] ?? null; });
      const key = (values[0] ?? '') as IDBValidKey; // first column is the PK by convention
      await IndexedDBBackend.wrap(this.store(table, 'readwrite').put(row, key));
      return;
    }

    // DELETE FROM <table> WHERE <col> = ?
    const deleteWhereMatch = s.match(/^DELETE\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\?/i);
    if (deleteWhereMatch) {
      const table = deleteWhereMatch[1];
      const col = deleteWhereMatch[2];
      const target = values[0] ?? null;
      const st = this.store(table, 'readwrite');
      await new Promise<void>((resolve, reject) => {
        const cursorReq = st.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) { resolve(); return; }
          if ((cursor.value as Row)[col] === target) cursor.delete();
          cursor.continue();
        };
        cursorReq.onerror = () => reject(cursorReq.error ?? new Error('IndexedDB delete failed'));
      });
      return;
    }

    // DELETE FROM <table>  (no WHERE → clear the whole store; D-11 cutover + Clear-All-Data)
    const deleteAllMatch = s.match(/^DELETE\s+FROM\s+(\w+)\s*$/i);
    if (deleteAllMatch) {
      await IndexedDBBackend.wrap(this.store(deleteAllMatch[1], 'readwrite').clear());
      return;
    }
  }

  async query<T extends Row>(sql: string, values: (string | number | null)[] = []): Promise<T[]> {
    const s = sql.trim();

    // SELECT * FROM <table> WHERE <col> = ?
    const selectWhereMatch = s.match(/^SELECT\s+\*\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\?/i);
    if (selectWhereMatch) {
      const col = selectWhereMatch[2];
      const target = values[0] ?? null;
      const all = await IndexedDBBackend.wrap(this.store(selectWhereMatch[1], 'readonly').getAll());
      return (all as T[]).filter((r) => r[col] === target);
    }

    // SELECT * FROM <table>
    const selectMatch = s.match(/^SELECT\s+\*\s+FROM\s+(\w+)/i);
    if (selectMatch) {
      const all = await IndexedDBBackend.wrap(this.store(selectMatch[1], 'readonly').getAll());
      return all as T[];
    }

    return [];
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let backend: DBBackend | null = null;
let initPromise: Promise<void> | null = null;

export async function getDB(): Promise<DBBackend> {
  if (backend) return backend;
  if (initPromise) { await initPromise; return backend!; }

  // One backend on ALL platforms (browser + Capacitor WebView): IndexedDB.
  // LocalStorageBackend is used only where IndexedDB is absent (Node test runner)
  // or as a last-resort fallback if IndexedDB init throws (private mode / disabled
  // storage) so a backend-init failure never crashes the app.
  const candidate: DBBackend = typeof indexedDB !== 'undefined'
    ? new IndexedDBBackend()
    : new LocalStorageBackend();
  initPromise = candidate.init().then(() => {
    backend = candidate;
    // Logged so the operator can confirm the active backend (IndexedDB vs fallback)
    // from the browser/WebView console.
    console.info('[QuestionTrace] DB backend active:', candidate.constructor.name);
  }).catch(async (err) => {
    if (!(candidate instanceof LocalStorageBackend)) {
      console.warn('[QuestionTrace] IndexedDB unavailable, falling back to LocalStorageBackend:', err);
      const fb = new LocalStorageBackend();
      await fb.init();
      backend = fb;
      return;
    }
    // Reset so callers can retry after a transient failure
    initPromise = null;
    throw err;
  });
  await initPromise;
  return backend!;
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

export async function dbExecute(sql: string, values?: (string | number | null)[]) {
  const db = await getDB();
  return db.execute(sql, values);
}

export async function dbQuery<T extends Row>(sql: string, values?: (string | number | null)[]): Promise<T[]> {
  const db = await getDB();
  return db.query<T>(sql, values);
}

// The 13 legacy heavy-store localStorage keys retired by the Phase 55 migration.
// Tiny boot-critical prefs (trellis_settings, trellis_dev_mode,
// trellis_daily_read, trellis_active_session) are intentionally NOT listed.
const LEGACY_HEAVY_KEYS = [
  'trellis_questions',
  'trellis_daily_posts',
  'trellis_post_history',
  'trellis_post_queue',
  'trellis_post_queue_yesterday',
  'trellis_sessions',
  'trellis_db_tables',
  'trellis_engagement_v1',
];

/**
 * One-time D-11 cutover sweep: remove the now-stale legacy heavy-store
 * localStorage keys. Phase 55-07 calls this from App.tsx boot AFTER hydration
 * has populated every in-memory mirror from IndexedDB, so the user's data is
 * already restored from the durable store before the stale localStorage copies
 * are deleted (a stale shadow copy could otherwise re-seed a mirror — T-55-05e).
 *
 * NOTE: in 55-07 the heavy services no longer READ these keys, so this sweep is
 * pure quota reclamation — it does not change runtime behaviour, only frees the
 * ~5MB localStorage the dual-write was still consuming.
 */
export function clearLegacyHeavyLocalStorageKeys(): void {
  for (const k of LEGACY_HEAVY_KEYS) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}

/**
 * Wipe all known application tables. Called by "Clear All Data" in Settings AND
 * used as the D-11 clean-cutover sweep (pre-release, no real users): clears every
 * migrated SQLite table AND removes the legacy heavy-store localStorage keys so
 * no migrated store survives in localStorage after the cutover (a stale shadow
 * copy could otherwise re-seed an in-memory mirror — T-55-05e).
 */
export async function clearAllTables(): Promise<void> {
  try {
    await dbExecute('DELETE FROM questions');
    await dbExecute('DELETE FROM edge_weights');
    // ── Phase 55 heavy-store tables (D-09) ──────────────────────────────────
    await dbExecute('DELETE FROM sessions');
    await dbExecute('DELETE FROM posts');
    await dbExecute('DELETE FROM post_queue');
    await dbExecute('DELETE FROM post_history');
    await dbExecute('DELETE FROM engagement');
    await dbExecute('DELETE FROM research_records');
    await dbExecute('DELETE FROM research_upload_queue');
    await dbExecute('DELETE FROM research_upload_quarantine');
    await dbExecute('DELETE FROM research_metadata');
    // ── Phase 2 frozen content-pool stores ─────────────────────────────────
    await dbExecute('DELETE FROM content_pool_meta');
    await dbExecute('DELETE FROM content_pool_topics');
    await dbExecute('DELETE FROM content_pool_posts');
    await dbExecute('DELETE FROM content_pool_concepts');
    await dbExecute('DELETE FROM content_pool_claims');
    await dbExecute('DELETE FROM content_pool_suggestions');
    await dbExecute('DELETE FROM content_pool_assets');
    await dbExecute('DELETE FROM content_pool_sources');
    await dbExecute('DELETE FROM content_pool_global_edges');
    await dbExecute('DELETE FROM content_pool_ranking_features');
    await dbExecute('DELETE FROM user_questions');
    await dbExecute('DELETE FROM ai_answers');
    // ── Phase 3 graph-memory and recommendation stores ────────────────────
    await dbExecute('DELETE FROM user_concept_states');
    await dbExecute('DELETE FROM graph_contributions');
    await dbExecute('DELETE FROM personal_graph_edges');
    await dbExecute('DELETE FROM extraction_jobs');
    await dbExecute('DELETE FROM recommendations');
    await dbExecute('DELETE FROM recommendation_batches');
  } catch {
    // DB may not be available (e.g. tables not yet created) — silently ignore
  }
  // ── D-11 cutover: remove the legacy heavy-store localStorage keys ──────────
  // Enumerated in LEGACY_HEAVY_KEYS (all 13 heavy-store keys); tiny boot-critical
  // prefs are intentionally excluded from that list and stay in localStorage.
  clearLegacyHeavyLocalStorageKeys();
}
