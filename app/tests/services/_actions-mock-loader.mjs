/**
 * Register hook that intercepts heavy service deps for trellis-actions tests.
 * Used with: --experimental-loader=./tests/services/_actions-mock-loader.mjs
 */

import { register } from 'node:module';

register(new URL('./_actions-mock-hooks.mjs', import.meta.url), import.meta.url);
