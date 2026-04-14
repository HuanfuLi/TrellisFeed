/**
 * Register hook that intercepts canonical-knowledge.service imports.
 * Used with: --import app/tests/services/_trellis-mock-loader.mjs
 */

import { register } from 'node:module';

register(new URL('./_trellis-mock-hooks.mjs', import.meta.url), import.meta.url);
