/**
 * Module resolution + load hooks for testing .tsx component exports.
 * Strips JSX via esbuild transform so pure functions can be tested with node --test.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Stub out heavy deps that aren't needed for pure-function tests
const STUBS = [
  'framer-motion',
  'lucide-react',
  'react-router-dom',
  'canonical-knowledge.service',
  'question.service',
  'event-bus',
];

function shouldStub(specifier) {
  return STUBS.some((s) => specifier.includes(s));
}

export async function resolve(specifier, context, nextResolve) {
  if (shouldStub(specifier)) {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export default {};export const motion={g:()=>null};export function useNavigate(){return()=>{}}export const X=()=>null;export const eventBus={subscribe:()=>()=>{}};',
    };
  }

  // Handle relative .tsx/.ts imports
  if (specifier.endsWith('.tsx') || specifier.endsWith('.ts')) {
    return nextResolve(specifier, context);
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.tsx') || url.endsWith('.ts')) {
    const filePath = fileURLToPath(url);
    const source = readFileSync(filePath, 'utf-8');

    // Use esbuild to transform TSX -> JS
    // esbuild may be in main repo node_modules (worktree)
    let esbuild;
    try { esbuild = await import('esbuild'); } catch {
      const { createRequire } = await import('node:module');
      const require = createRequire(import.meta.url);
      esbuild = require('esbuild');
    }
    const { transformSync } = esbuild;
    const result = transformSync(source, {
      loader: url.endsWith('.tsx') ? 'tsx' : 'ts',
      format: 'esm',
      target: 'esnext',
    });

    return {
      shortCircuit: true,
      format: 'module',
      source: result.code,
    };
  }

  return nextLoad(url, context);
}
