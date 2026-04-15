/**
 * Register hook that intercepts canonical-knowledge.service imports
 * with a real-logic mock for e2e trellis tests.
 * Used with: --import app/tests/e2e/_trellis-e2e-mock-loader.mjs
 */

import { register } from 'node:module';

register(new URL('./_trellis-e2e-mock-hooks.mjs', import.meta.url), import.meta.url);
