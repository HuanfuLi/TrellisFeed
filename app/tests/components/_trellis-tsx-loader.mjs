/**
 * Register hook for testing .tsx component pure-function exports.
 * Used with: --import app/tests/components/_trellis-tsx-loader.mjs
 */

import { register } from 'node:module';

register(new URL('./_trellis-tsx-hooks.mjs', import.meta.url), import.meta.url);
