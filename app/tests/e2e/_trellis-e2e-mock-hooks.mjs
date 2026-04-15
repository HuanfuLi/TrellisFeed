/**
 * Module resolution hooks for trellis e2e tests:
 * 1. Replace canonical-knowledge.service with real-logic mock (no heavy deps)
 * 2. Resolve extensionless .ts imports
 */

import { existsSync } from 'node:fs';

export async function resolve(specifier, context, nextResolve) {
  // Replace canonical-knowledge.service with e2e mock that implements real grouping
  if (specifier.includes('canonical-knowledge.service')) {
    return {
      shortCircuit: true,
      url: new URL('./_trellis-e2e-mock-canonical.mjs', import.meta.url).href,
    };
  }

  // For relative imports without extension, try appending .ts
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
