/**
 * Module resolution hooks for trellis-state tests:
 * 1. Stub canonical-knowledge.service (heavy dep chain)
 * 2. Resolve extensionless .ts imports to .ts files
 */

import { existsSync } from 'node:fs';

export async function resolve(specifier, context, nextResolve) {
  // Stub canonical-knowledge.service (and its transitive deps)
  if (specifier.includes('canonical-knowledge.service')) {
    return {
      shortCircuit: true,
      url: new URL('./_trellis-mock-canonical.mjs', import.meta.url).href,
    };
  }

  // For relative imports without extension, try appending .ts
  if (specifier.startsWith('.') && !specifier.match(/\.\w+$/)) {
    try {
      const result = await nextResolve(specifier, context);
      return result;
    } catch {
      // Try .ts extension
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
