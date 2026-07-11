import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

const POOL_TABLES = [
  'content_pool_meta',
  'content_pool_topics',
  'content_pool_posts',
  'content_pool_concepts',
  'content_pool_claims',
  'content_pool_suggestions',
  'content_pool_assets',
];

function makeLocalStorage() {
  return {
    _store: new Map(),
    getItem(key) { return this._store.get(key) ?? null; },
    setItem(key, value) { this._store.set(key, String(value)); },
    removeItem(key) { this._store.delete(key); },
    clear() { this._store.clear(); },
  };
}

globalThis.localStorage = makeLocalStorage();
globalThis.indexedDB = fakeIndexedDB;

const indexedDbModule = await import('../../src/services/db.service.ts?content-pool-indexeddb');

describe('content pool schema and backend parity', () => {
  beforeEach(async () => {
    await indexedDbModule.clearAllTables();
  });

  it('schema upgrade creates every content pool object store', async () => {
    await indexedDbModule.getDB();
    const request = fakeIndexedDB.open('questiontrace');
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    for (const table of POOL_TABLES) {
      assert.equal(db.objectStoreNames.contains(table), true, `${table} must exist`);
    }
    db.close();
  });

  it('IndexedDB backend executes insert, query, delete, and clear through the DB seam', async () => {
    for (const table of POOL_TABLES) {
      await indexedDbModule.dbExecute(
        `INSERT OR REPLACE INTO ${table} (id, version, data) VALUES (?, ?, ?)`,
        [`${table}:row`, 'v1', '{}'],
      );
      assert.equal(
        (await indexedDbModule.dbQuery(`SELECT * FROM ${table} WHERE version = ?`, ['v1'])).length,
        1,
      );
      await indexedDbModule.dbExecute(`DELETE FROM ${table} WHERE version = ?`, ['v1']);
      assert.equal((await indexedDbModule.dbQuery(`SELECT * FROM ${table}`)).length, 0);
    }

    for (const table of POOL_TABLES) {
      await indexedDbModule.dbExecute(
        `INSERT OR REPLACE INTO ${table} (id, version, data) VALUES (?, ?, ?)`,
        [`${table}:clear`, 'v1', '{}'],
      );
    }
    await indexedDbModule.clearAllTables();
    for (const table of POOL_TABLES) {
      assert.equal((await indexedDbModule.dbQuery(`SELECT * FROM ${table}`)).length, 0);
    }
  });

  it('fallback backend supports the same content-pool SQL subset', async () => {
    const savedIndexedDB = globalThis.indexedDB;
    delete globalThis.indexedDB;
    globalThis.localStorage = makeLocalStorage();
    const fallback = await import('../../src/services/db.service.ts?content-pool-fallback');
    try {
      for (const table of POOL_TABLES) {
        await fallback.dbExecute(
          `INSERT OR REPLACE INTO ${table} (id, version, data) VALUES (?, ?, ?)`,
          [`${table}:row`, 'v1', '{}'],
        );
        assert.equal((await fallback.dbQuery(`SELECT * FROM ${table} WHERE version = ?`, ['v1'])).length, 1);
        await fallback.dbExecute(`DELETE FROM ${table} WHERE version = ?`, ['v1']);
        assert.equal((await fallback.dbQuery(`SELECT * FROM ${table}`)).length, 0);
      }
    } finally {
      globalThis.indexedDB = savedIndexedDB;
    }
  });
});
