// Deterministic embedding mock for Phase 47 eval-test reproducibility.
//
// The real embedText (app/src/providers/embedding/index.ts) calls a network
// provider (OpenAI / Google / local Ollama / LM Studio). For tests we need
// stable, reproducible vectors so the eval-set runner produces the same
// cosine outputs across runs — without any network dependency.
//
// This mock projects an input string to a fixed-dimensional (DIM=64) vector
// via a simple FNV-1a hash mixed with each dimension index, then L2-normalizes
// the result so cosine values are bounded in [-1, 1]. Properties:
//   - embedText(s) === embedText(s)              (deterministic, in-process)
//   - cosine(embedText(s), embedText(s)) === 1   (within float tolerance)
//   - cosine(embedText(s), embedText(t)) < 1     (distinct strings → not 1)
//
// The cosine results are reproducible but NOT semantically meaningful —
// they exist so the eval-test runner verifies wiring + cache invalidation,
// not actual semantic accuracy. Real semantic accuracy of the classifier
// is validated by hand-spot-checking eval-fixture rows against staging
// embeddings on a developer machine, not in CI.
//
// Leaf-module discipline: zero transitive imports beyond Node built-ins
// (none needed here). Mirrors app/src/services/refill-mutex.ts header
// rationale — keeps `node --test` import-able without ERR_IMPORT_ATTRIBUTE_MISSING
// chains via locales/index.ts → en.json.
//
// Used by:
//   - tests/services/trellis-*.test.mjs (via _actions-mock-hooks.mjs loader —
//     stubs providers/embedding so trellis-actions.service.ts can import)
//   - Phase 47 Plan 02 filter-classifier.eval.test.mjs + filter-cache.test.mjs
//     (deterministic vectors so the eval runner is reproducible).

const DIM = 64;

// Plan 48-02 — per-test fail-toggle so graphCommandService.rename's
// graceful-degradation path (embed rejection preserves old vector) can be
// exercised without mutating the global embedText export. Set via
// _setEmbedFail(true) at test start; reset to false in resetAll().
let _embedFail = false;

export function _setEmbedFail(fail) {
  _embedFail = !!fail;
}

/**
 * FNV-1a 32-bit hash.
 * Returns an unsigned 32-bit integer.
 * Reference: https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function
 */
function fnv1a32(str) {
  let h = 0x811c9dc5; // FNV offset basis (32-bit)
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // 32-bit FNV prime multiplication, kept in unsigned 32-bit range via Math.imul + >>> 0.
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Project text to a deterministic 64-dim L2-normalized vector.
 * Each dimension is derived from fnv1a32(text + '␟' + dimIndex).
 * The 0x241F separator (Unit Separator visualization) prevents collisions
 * between e.g. ('foo', 1) and ('foo1', '') concatenations.
 *
 * Async signature mirrors the real embedText so tests can call it
 * interchangeably; the body itself is synchronous.
 */
export async function embedText(text /* config?: unknown */) {
  // Plan 48-02 — fail-toggle for graphCommandService.rename graceful-degradation test.
  if (_embedFail) {
    throw new Error('mock embedText forced failure (Plan 48-02 test)');
  }
  // The real provider trims internally on some paths; keep this 1:1 with
  // input so tests can choose to pre-trim or not.
  const vec = new Array(DIM);
  for (let i = 0; i < DIM; i++) {
    const h = fnv1a32(text + '␟' + i);
    // Map the unsigned 32-bit hash to a float in [-1, 1).
    // Divide by 2^31 then subtract 1: range becomes [-1, 1).
    vec[i] = (h / 0x80000000) - 1;
  }
  // L2-normalize so self-cosine === 1 exactly (within float tolerance).
  let mag = 0;
  for (let i = 0; i < DIM; i++) mag += vec[i] * vec[i];
  mag = Math.sqrt(mag);
  if (mag === 0) return vec; // pathological — text hashes that produce a zero vector are vanishingly rare for DIM=64
  for (let i = 0; i < DIM; i++) vec[i] = vec[i] / mag;
  return vec;
}

/**
 * Cosine similarity. Mirrors providers/embedding/index.ts:cosine exactly.
 * Returns 0 on length mismatch or zero-norm to match the real provider's
 * graceful-degradation contract.
 */
export function cosine(a, b) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
