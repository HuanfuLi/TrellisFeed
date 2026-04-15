/**
 * Module resolution hooks for trellis-actions tests.
 * Intercepts heavy service dependencies so trellis-actions.service.ts
 * can be imported without LLM, SQLite, TTS, or settings providers.
 *
 * Mocked:
 *   - podcast.service  → _actions-mock-podcast.mjs
 *   - question.service → _actions-mock-question.mjs
 *   - db.service       → no-op stub
 *   - settings.service → no-op stub
 *   - providers/llm    → no-op stub
 *   - providers/tts    → no-op stub
 *   - providers/embedding → no-op stub
 *   - canonical-knowledge.service → existing stub
 *   - question-filter.service → no-op stub
 *   - @capacitor/core  → existing stub
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = new URL('.', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  // Stub podcast.service
  if (specifier.includes('podcast.service')) {
    return { shortCircuit: true, url: new URL('_actions-mock-podcast.mjs', DIR).href };
  }

  // Stub question.service (and its transitive heavy deps)
  if (specifier.includes('question.service') && !specifier.includes('question-filter')) {
    return { shortCircuit: true, url: new URL('_actions-mock-question.mjs', DIR).href };
  }

  // Stub db.service
  if (specifier.includes('db.service')) {
    return { shortCircuit: true, url: new URL('_actions-mock-db.mjs', DIR).href };
  }

  // Stub settings.service
  if (specifier.includes('settings.service')) {
    return { shortCircuit: true, url: new URL('_actions-mock-settings.mjs', DIR).href };
  }

  // Stub LLM provider
  if (specifier.includes('providers/llm') || specifier.includes('providers\\llm')) {
    return { shortCircuit: true, url: new URL('_actions-mock-llm.mjs', DIR).href };
  }

  // Stub TTS provider
  if (specifier.includes('providers/tts') || specifier.includes('providers\\tts')) {
    return { shortCircuit: true, url: new URL('_actions-mock-tts.mjs', DIR).href };
  }

  // Stub embedding provider
  if (specifier.includes('providers/embedding') || specifier.includes('providers\\embedding')) {
    return { shortCircuit: true, url: new URL('_actions-mock-embedding.mjs', DIR).href };
  }

  // Stub canonical-knowledge.service
  if (specifier.includes('canonical-knowledge.service')) {
    return { shortCircuit: true, url: new URL('_trellis-mock-canonical.mjs', DIR).href };
  }

  // Stub question-filter.service
  if (specifier.includes('question-filter.service')) {
    return { shortCircuit: true, url: new URL('_actions-mock-qfilter.mjs', DIR).href };
  }

  // Stub @capacitor/core
  if (specifier === '@capacitor/core') {
    return { shortCircuit: true, url: new URL('_capacitor-mock.mjs', DIR).href };
  }

  // For relative imports without extension, try .ts extension (same as _trellis-mock-hooks.mjs)
  if (specifier.startsWith('.') && !specifier.match(/\.\w+$/)) {
    try {
      const result = await nextResolve(specifier, context);
      return result;
    } catch {
      const tsSpec = specifier + '.ts';
      try {
        return await nextResolve(tsSpec, context);
      } catch {
        // Fall through
      }
    }
  }

  return nextResolve(specifier, context);
}
