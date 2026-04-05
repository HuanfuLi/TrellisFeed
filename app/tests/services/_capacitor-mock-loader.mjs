/**
 * Register hook that intercepts @capacitor/core imports.
 * Used with: --import app/tests/services/_capacitor-mock-loader.mjs
 */

import { register } from 'node:module';

register(new URL('./_capacitor-mock-hooks.mjs', import.meta.url), import.meta.url);
