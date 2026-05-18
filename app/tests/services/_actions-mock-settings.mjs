/**
 * Stub for settings.service.ts — used by trellis-actions tests AND
 * Plan 48-02 graph-command tests.
 *
 * getSettings() preserved for legacy callers.
 *
 * getSync() (added Plan 48-02) returns a Partial<AppSettings> shape with
 * embedding config so graphCommandService.rename can gate on
 * settings.embedding?.isConfigured for the Blocker #4 graceful-degradation
 * path. The _setEmbeddingConfigured(bool) helper lets per-test setup
 * toggle the gate.
 */

let _embeddingConfigured = true;

export function _setEmbeddingConfigured(configured) {
  _embeddingConfigured = !!configured;
}

export const settingsService = {
  getSettings() {
    return { preferences: { onboardingCompleted: true } };
  },

  /**
   * Plan 48-02 — graphCommandService reads settings.embedding?.isConfigured
   * synchronously inside the rename body. The shape mirrors
   * AppSettings['embedding'] from app/src/services/settings.service.ts:19-26
   * with the runtime-modifiable isConfigured field.
   */
  getSync() {
    return {
      llm: { provider: 'openai', apiKey: '', baseUrl: '', model: 'gpt-4o', isConfigured: false },
      embedding: {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'text-embedding-3-small',
        baseUrl: '',
        dimensions: 64,
        isConfigured: _embeddingConfigured,
      },
      preferences: { onboardingCompleted: true, locale: 'en' },
    };
  },
};
