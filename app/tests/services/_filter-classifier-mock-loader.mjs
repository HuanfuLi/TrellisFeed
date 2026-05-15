// Node module loader hook for Phase 47 Plan 02 Task 2 filter-classifier
// unit tests.
//
// Intercepts:
//   - `../providers/embedding`  →  `_filter-mock-embedding.mjs` (counter-spying
//     deterministic FNV-1a hash projection)
//   - `./settings.service.ts`   →  `_filter-mock-settings.mjs` (controllable
//     EmbeddingConfig stub for D-12 graceful-degradation testing)
//
// The settings.service stub matters because question-filter.service.ts uses
// the canonical lazy-import pattern (`await import('./settings.service.ts')`)
// inside evaluateQuestion to keep the module leaf — without the loader hook,
// that import would resolve to the real settings.service.ts which transitively
// imports locales/index.ts → en.json (the JSON-import-attribute failure chain).

export async function resolve(specifier, context, nextResolve) {
  if (specifier.includes('providers/embedding') || specifier.includes('providers\\embedding')) {
    return {
      shortCircuit: true,
      url: new URL('./_filter-mock-embedding.mjs', import.meta.url).href,
    };
  }
  if (specifier.includes('settings.service')) {
    return {
      shortCircuit: true,
      url: new URL('./_filter-mock-settings.mjs', import.meta.url).href,
    };
  }
  return nextResolve(specifier, context);
}
