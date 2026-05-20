// Leaf-safe, dependency-free, Map-backed in-memory `localStorage` shim.
//
// WHY THIS EXISTS:
//   `node --test` runs without a DOM, so there is no global `localStorage`.
//   The PRIVACY-01 payload goldens (Plan 53-02) seed sentinel private data
//   into the private services' localStorage keys (engagement / collections /
//   graph-edit-journal), then drive a provider flow and assert the captured
//   fetch body excludes those sentinels. Those services call
//   `localStorage.getItem` / `localStorage.setItem` at module/read time, which
//   would throw under `node --test` without this shim.
//
// HOW TO USE:
//   This helper does NOT auto-install onto `globalThis`. The importing golden
//   controls install ordering and MUST assign the shim BEFORE its dynamic
//   `import()` of the module under test:
//
//     import { makeMemoryLocalStorage } from '../helpers/memory-localstorage.mjs';
//     globalThis.localStorage = makeMemoryLocalStorage();
//     globalThis.localStorage.setItem('trellis_engagement_v1', JSON.stringify(...));
//     const mod = await import('../../src/services/engagement.service.ts');
//
// NOT A TEST FILE:
//   This file ends in `.mjs` but NOT `.test.mjs`, so the `test:main` glob
//   (`find tests -name '*.test.mjs'`) must not pick it up. It is a plain
//   support module — keep it dependency-free (zero imports) so it stays
//   leaf-safe and never pulls heavy/JSON-import-attribute deps.

export function makeMemoryLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      const k = String(key);
      return store.has(k) ? store.get(k) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
    key(index) {
      const i = Number(index);
      if (!Number.isInteger(i) || i < 0) return null;
      const keys = Array.from(store.keys());
      return i < keys.length ? keys[i] : null;
    },
    get length() {
      return store.size;
    },
  };
}
