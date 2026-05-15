// Spy-able deterministic embedding mock for Phase 47 Plan 02 filter tests.
//
// Layered on top of `_actions-mock-embedding.mjs`'s FNV-1a hash-projection mock
// — re-uses the same DIM=64 / L2-normalized recipe so cosine results stay
// reproducible across the whole filter test surface (cache test + classifier
// unit test + eval-set runner).
//
// Differences from `_actions-mock-embedding.mjs`:
//   - Tracks embedText invocation count + recent call args via `embedSpy`.
//     Tests for the (provider, model) cache invalidation guard count
//     embedText calls before/after re-invocation to prove cache hit/miss.
//   - Tests can `embedSpy.reset()` between scenarios.
//
// Used by `_filter-mock-loader.mjs` to intercept the `../providers/embedding`
// import in:
//   - `app/src/services/filter-corpus.service.ts` (cache loader)
//   - `app/src/services/question-filter.service.ts` (Layer 2 classifier)
//
// Tests load this via `register('./_filter-mock-loader.mjs', import.meta.url)`
// BEFORE any dynamic import of the service-under-test, so the loader hook
// rewrites the embedding import to point here.

const DIM = 64;

function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export const embedSpy = {
  callCount: 0,
  calls: [], // { text, config }
  reset() {
    this.callCount = 0;
    this.calls = [];
  },
};

export async function embedText(text, config) {
  embedSpy.callCount++;
  embedSpy.calls.push({ text, config });
  const vec = new Array(DIM);
  for (let i = 0; i < DIM; i++) {
    const h = fnv1a32(text + '␟' + i);
    vec[i] = h / 0x80000000 - 1;
  }
  let mag = 0;
  for (let i = 0; i < DIM; i++) mag += vec[i] * vec[i];
  mag = Math.sqrt(mag);
  if (mag === 0) return vec;
  for (let i = 0; i < DIM; i++) vec[i] = vec[i] / mag;
  return vec;
}

export function cosine(a, b) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
