// Node module loader hook for Phase 47 Plan 02 filter tests.
//
// Intercepts the `../providers/embedding` import inside filter-corpus.service.ts
// and question-filter.service.ts and routes it to `_filter-mock-embedding.mjs`,
// which exports the same `embedText` + `cosine` API but layers a call-counter
// spy on top of the deterministic FNV-1a hash projection.
//
// Tests register this loader inline at the top of the file via:
//   import { register } from 'node:module';
//   register('./_filter-mock-loader.mjs', import.meta.url);
//
// MUST be registered BEFORE any dynamic import of filter-corpus.service.ts
// or question-filter.service.ts — once Node has resolved the embedding
// specifier the resolution is cached.

export async function resolve(specifier, context, nextResolve) {
  // Match any import path that resolves to providers/embedding.
  // The classifier and corpus loader use `'../providers/embedding'`.
  if (specifier.includes('providers/embedding') || specifier.includes('providers\\embedding')) {
    return {
      shortCircuit: true,
      url: new URL('./_filter-mock-embedding.mjs', import.meta.url).href,
    };
  }
  return nextResolve(specifier, context);
}
