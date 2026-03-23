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

// ─── SQLite Backend (Capacitor native) ───────────────────────────────────────

class SQLiteBackend implements DBBackend {
  private db: import('@capacitor-community/sqlite').SQLiteDBConnection | null = null;

  async init() {
    const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
    await CapacitorSQLite.createConnection({ database: 'echolearn', version: 1, encrypted: false, mode: 'no-encryption' });
    await CapacitorSQLite.open({ database: 'echolearn' });
    this.db = (CapacitorSQLite as unknown as { getConnection: (name: string) => import('@capacitor-community/sqlite').SQLiteDBConnection }).getConnection('echolearn');
    await this._runMigrations();
  }

  private async _runMigrations() {
    const ddl = [
      `CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
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
    ];
    for (const sql of ddl) {
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

const PREFIX = 'echolearn_db_';

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

// ─── Singleton ────────────────────────────────────────────────────────────────

let backend: DBBackend | null = null;
let initPromise: Promise<void> | null = null;

export async function getDB(): Promise<DBBackend> {
  if (backend) return backend;
  if (initPromise) { await initPromise; return backend!; }

  const candidate = Capacitor.isNativePlatform() ? new SQLiteBackend() : new LocalStorageBackend();
  initPromise = candidate.init().then(() => {
    backend = candidate;
  }).catch((err) => {
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

/** Wipe all known application tables. Called by "Clear All Data" in Settings. */
export async function clearAllTables(): Promise<void> {
  try {
    await dbExecute('DELETE FROM questions');
    await dbExecute('DELETE FROM edge_weights');
    await dbExecute('DELETE FROM planner_chunks');
    await dbExecute('DELETE FROM planner_threads');
    await dbExecute('DELETE FROM planner_checkins');
  } catch {
    // DB may not be available (e.g. tables not yet created) — silently ignore
  }
}
