/**
 * Database abstraction layer.
 * Uses Capacitor Community SQLite when running on native (iOS/Android).
 * Falls back to localStorage on web/browser environments.
 *
 * All public methods mirror a simple key-value + table-query interface so
 * callers don't depend on either backend directly.
 */
import { Capacitor } from '@capacitor/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Row = Record<string, string | number | null>;

interface DBBackend {
  init(): Promise<void>;
  execute(sql: string, values?: (string | number | null)[]): Promise<void>;
  query<T extends Row>(sql: string, values?: (string | number | null)[]): Promise<T[]>;
}

// ─── Shared schema (DDL) ──────────────────────────────────────────────────────
// Phase 55 D-09/D-13: the migration table set is identical across the native
// SQLiteBackend and the browser WASMSQLiteBackend so a record persisted on one
// platform round-trips on the other. Both backends run this exact DDL in their
// _runMigrations(). All statements are idempotent (IF NOT EXISTS) so re-running
// across hot reloads / re-init is safe.
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
  `CREATE TABLE IF NOT EXISTS planner_chunks (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS planner_threads (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS planner_checkins (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  )`,
  // ── Phase 55 heavy-store tables (D-09) ──────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, data TEXT NOT NULL, served_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS post_queue (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS post_history (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS flashcards (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS collections (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS engagement (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS podcasts (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS news_posts (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS video_cache (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
];

// ─── SQLite Backend (Capacitor native) ───────────────────────────────────────

class SQLiteBackend implements DBBackend {
  private db: import('@capacitor-community/sqlite').SQLiteDBConnection | null = null;

  async init() {
    // Phase 33 UAT-4 fix (2026-04-20): CapacitorSQLite.getConnection does not
    // exist on the native plugin — calling it throws "not implemented on
    // android". The correct API is the SQLiteConnection wrapper, which
    // tracks connections in a JS-side map keyed by database name. Use
    // isConnection to reuse across hot reloads, createConnection otherwise.
    const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    // SQLite connection name kept as 'echolearn' for backwards compat with
    // existing native installs — renaming would orphan the on-disk DB file
    // and force a data wipe. User-facing brand is Trellis; this internal
    // handle is never visible.
    const existing = await sqlite.isConnection('echolearn', false);
    this.db = existing.result
      ? await sqlite.retrieveConnection('echolearn', false)
      : await sqlite.createConnection('echolearn', false, 'no-encryption', 1, false);
    await this.db.open();
    await this._runMigrations();
  }

  private async _runMigrations() {
    for (const sql of SHARED_DDL) {
      await this.execute(sql);
    }
  }

  async execute(sql: string, values: (string | number | null)[] = []) {
    if (!this.db) throw new Error('DB not initialised');
    await this.db.run(sql, values);
  }

  async query<T extends Row>(sql: string, values: (string | number | null)[] = []): Promise<T[]> {
    if (!this.db) throw new Error('DB not initialised');
    const result = await this.db.query(sql, values);
    return (result.values ?? []) as T[];
  }
}

// ─── localStorage Backend (Web fallback) ─────────────────────────────────────

const PREFIX = 'trellis_db_';

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

// ─── WASM SQLite Backend (Browser dev + web, Phase 55 D-10) ──────────────────
// PRIMARY browser backend (55-01 OPFS GO verdict). Uses @sqlite.org/sqlite-wasm
// with the opfs-sahpool VFS — persistent, OPFS-backed, synchronous
// SyncAccessHandles, NO SharedArrayBuffer / COOP / COEP required on Chromium.
// init() throws when OPFS is unavailable (incognito, older browser, insecure
// context); the getDB() factory catches that and falls back to
// LocalStorageBackend so a backend-init failure never crashes the app
// (Pitfall 1 / T-55-05b). Runs the same SHARED_DDL as the native SQLiteBackend
// so the schema matches across platforms.

class WASMSQLiteBackend implements DBBackend {
  // Typed as Sqlite3Oo1Db at runtime; `unknown` avoids a hard type dep on the
  // browser-only package in the native build.
  private db: unknown = null;

  async init() {
    const sqlite3InitModule = (await import('@sqlite.org/sqlite-wasm')).default;
    const sqlite3 = await sqlite3InitModule();
    // opfs-sahpool VFS: persistent OPFS-backed DB using synchronous access
    // handles. Unlike oo1.OpfsDb (the kvvfs/SAB OPFS VFS, which needs a Worker +
    // COOP/COEP cross-origin isolation), installOpfsSAHPoolVfs runs on the main
    // thread with NO special headers — the reason 55-RESEARCH selected it. The
    // install Promise rejects when OPFS is unavailable (incognito, insecure
    // context, older browser); the getDB() catch then swaps to LocalStorageBackend.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const poolUtil = await (sqlite3 as any).installOpfsSAHPoolVfs({
      name: 'opfs-sahpool',
      directory: '.trellis-sqlite',
    });
    this.db = new poolUtil.OpfsSAHPoolDb('/trellis.sqlite3');
    await this._runMigrations();
  }

  private async _runMigrations() {
    for (const sql of SHARED_DDL) {
      await this.execute(sql);
    }
  }

  async execute(sql: string, values: (string | number | null)[] = []) {
    if (!this.db) throw new Error('WASMSQLite not initialised');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.db as any).exec({ sql, bind: values });
  }

  async query<T extends Row>(sql: string, values: (string | number | null)[] = []): Promise<T[]> {
    if (!this.db) throw new Error('WASMSQLite not initialised');
    const rows: T[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.db as any).exec({ sql, bind: values, rowMode: 'object', resultRows: rows });
    return rows;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let backend: DBBackend | null = null;
let initPromise: Promise<void> | null = null;

export async function getDB(): Promise<DBBackend> {
  if (backend) return backend;
  if (initPromise) { await initPromise; return backend!; }

  // Native → real SQLite (connection name 'echolearn' preserved for backwards
  // compat). Browser → WASMSQLiteBackend (opfs-sahpool) with a graceful
  // LocalStorageBackend fallback if OPFS init throws (Pitfall 1 / T-55-05b).
  let candidate: DBBackend;
  if (Capacitor.isNativePlatform()) {
    candidate = new SQLiteBackend();
  } else {
    candidate = new WASMSQLiteBackend();
  }
  initPromise = candidate.init().then(() => {
    backend = candidate;
    if (!Capacitor.isNativePlatform()) {
      console.info('[Trellis] DB backend active:', candidate.constructor.name);
    }
  }).catch(async (err) => {
    if (!Capacitor.isNativePlatform() && !(candidate instanceof LocalStorageBackend)) {
      // OPFS / WASM unavailable — fall back to LocalStorageBackend so the app
      // never crashes on a backend-init failure. Logged so the operator can
      // see whether the dev environment is on the WASM path or the fallback.
      console.warn('[Trellis] WASM SQLite unavailable, falling back to LocalStorageBackend:', err);
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
    await dbExecute('DELETE FROM planner_chunks');
    await dbExecute('DELETE FROM planner_threads');
    await dbExecute('DELETE FROM planner_checkins');
    // ── Phase 55 heavy-store tables (D-09) ──────────────────────────────────
    await dbExecute('DELETE FROM sessions');
    await dbExecute('DELETE FROM posts');
    await dbExecute('DELETE FROM post_queue');
    await dbExecute('DELETE FROM post_history');
    await dbExecute('DELETE FROM flashcards');
    await dbExecute('DELETE FROM collections');
    await dbExecute('DELETE FROM engagement');
    await dbExecute('DELETE FROM podcasts');
    await dbExecute('DELETE FROM news_posts');
    await dbExecute('DELETE FROM video_cache');
  } catch {
    // DB may not be available (e.g. tables not yet created) — silently ignore
  }
  // ── D-11 cutover: remove the legacy heavy-store localStorage keys ──────────
  // MUST enumerate ALL 13 heavy-store keys. Missing any leaves a stale heavy
  // store in localStorage after cutover (D-11 incomplete). Tiny boot-critical
  // prefs (trellis_settings, trellis_fruit_credits, trellis_dev_mode,
  // trellis_ask_rate_limit, trellis_blossom_dates, trellis_token_usage,
  // trellis_daily_read, trellis_trajectory_signals) are intentionally NOT
  // cleared here — they stay in localStorage.
  const legacyKeys = [
    'trellis_questions',
    'trellis_daily_posts',
    'trellis_post_history',
    'trellis_post_queue',
    'trellis_post_queue_yesterday',
    'trellis_sessions',
    'trellis_flashcards',
    'trellis_db_tables',
    'trellis_collections_v1',
    'trellis_engagement_v1',
    'trellis_podcasts',
    'trellis_news_posts',
    'trellis_video_cache',
  ];
  for (const k of legacyKeys) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}
