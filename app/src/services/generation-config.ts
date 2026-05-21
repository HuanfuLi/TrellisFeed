import type { AppSettings, LLMConfig } from '../types';

/**
 * Phase 55.1 GAP-E (BUGFIX-08) — resolve which LLM config the on-open one-shot generators
 * (post body, news essay, post-context Q&A) should stream from, and whether to disable the
 * model's thinking/reasoning for low streaming latency.
 *
 * - When the optional `fastModel` is enabled AND configured → return the fast config with
 *   `disableThinking: true`. This routes latency-sensitive generation through a separate
 *   low-latency / non-reasoning model so the body starts streaming immediately on tap-in.
 * - Otherwise → return the main `settings.llm` with `disableThinking: false` — a
 *   byte-identical request to today's behavior (zero behavior change for users who never
 *   configure a fast model).
 *
 * Pure + React-free so node:test can import it directly. Do NOT route Ask Q&A /
 * classification / planner / podcast / flashcard through this — they keep the main model.
 */
export function resolveGenerationConfig(
  settings: AppSettings,
): { config: LLMConfig; disableThinking: boolean } {
  const fast = settings.fastModel;
  const fastReady =
    !!fast &&
    fast.enabled &&
    (fast.isConfigured ||
      // local/lmstudio need no key — "configured" iff a baseUrl is present
      ((fast.provider === 'local' || fast.provider === 'lmstudio') && !!fast.baseUrl));

  if (fastReady && fast) {
    // Strip the `enabled` flag so the value passed to chatStream is a clean LLMConfig.
    const { enabled: _enabled, ...llmConfig } = fast;
    void _enabled;
    return { config: llmConfig, disableThinking: true };
  }

  return { config: settings.llm, disableThinking: false };
}
