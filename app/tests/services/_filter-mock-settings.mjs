// Controllable settings.service stub for Phase 47 Plan 02 filter-classifier
// unit tests.
//
// Tests mutate `_cfg` via `_setEmbeddingCfg(...)` to flip isConfigured for
// D-12 graceful-degradation testing OR to swap (provider, model) for cache
// invalidation testing across runs.
//
// Mirrors the shape of the real `settingsService.getSync().embedding` so the
// classifier can call it interchangeably.

let _cfg = {
  provider: 'openai',
  model: 'text-embedding-3-small',
  isConfigured: true,
};

export function _setEmbeddingCfg(cfg) {
  _cfg = { ..._cfg, ...cfg };
}

export const settingsService = {
  getSync() {
    return {
      embedding: _cfg,
      // Other settings shapes — the classifier only touches `.embedding`,
      // but provide stubs so consumers reading larger slices don't crash.
      llm: { isConfigured: true, provider: 'openai', model: 'gpt-4o', apiKey: 'mock' },
      preferences: { onboardingCompleted: true },
    };
  },
  // Some legacy call sites use getSettings (older API). Provide both.
  getSettings() {
    return this.getSync();
  },
};
