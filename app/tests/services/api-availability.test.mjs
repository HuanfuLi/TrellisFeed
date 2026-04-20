/**
 * Tests for api-availability circuit breaker.
 *
 * Phase 33 quota-burn fix (2026-04-20): verifies the flag lifecycle —
 * flip on quota-exhausted, persist within day, auto-reset on date rollover.
 *
 * Uses the __resetApiAvailabilityForTesting export to reset module state
 * between tests and localStorage polyfill to verify persistence semantics.
 */

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill (same pattern as daily-generation-cap.test.mjs)
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const mod = await import('../../src/services/api-availability.ts');
const {
  markYoutubeQuotaExhausted,
  markTavilyQuotaExhausted,
  isYoutubeRuntimeAvailable,
  isTavilyRuntimeAvailable,
  __resetApiAvailabilityForTesting,
} = mod;

describe('api-availability circuit breaker', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetApiAvailabilityForTesting();
  });

  it('starts with both APIs available', () => {
    assert.equal(isYoutubeRuntimeAvailable(), true);
    assert.equal(isTavilyRuntimeAvailable(), true);
  });

  it('flips YouTube to unavailable when marked exhausted', () => {
    markYoutubeQuotaExhausted();
    assert.equal(isYoutubeRuntimeAvailable(), false);
    // Tavily is independent — still available.
    assert.equal(isTavilyRuntimeAvailable(), true);
  });

  it('flips Tavily to unavailable when marked exhausted', () => {
    markTavilyQuotaExhausted();
    assert.equal(isTavilyRuntimeAvailable(), false);
    assert.equal(isYoutubeRuntimeAvailable(), true);
  });

  it('independent flags — flipping one does not affect the other', () => {
    markYoutubeQuotaExhausted();
    markTavilyQuotaExhausted();
    assert.equal(isYoutubeRuntimeAvailable(), false);
    assert.equal(isTavilyRuntimeAvailable(), false);
  });

  it('persists flag state across module re-imports within the same day', async () => {
    markYoutubeQuotaExhausted();
    // Simulate a fresh module load by re-importing with a cache-buster.
    const fresh = await import('../../src/services/api-availability.ts?persist1');
    assert.equal(fresh.isYoutubeRuntimeAvailable(), false);
  });

  it('resets flag when date rolls over', async () => {
    // Seed localStorage with yesterday's day stamp.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    localStorage.setItem('echolearn_api_availability_day', JSON.stringify({
      day: yKey,
      youtubeDisabled: true,
      tavilyDisabled: true,
    }));

    // Re-import to trigger loadState with stale day.
    const fresh = await import('../../src/services/api-availability.ts?rollover');
    assert.equal(fresh.isYoutubeRuntimeAvailable(), true, 'YouTube should be re-enabled on new day');
    assert.equal(fresh.isTavilyRuntimeAvailable(), true, 'Tavily should be re-enabled on new day');
  });

  it('idempotent — flipping an already-flipped flag is a no-op', () => {
    markYoutubeQuotaExhausted();
    markYoutubeQuotaExhausted();
    markYoutubeQuotaExhausted();
    assert.equal(isYoutubeRuntimeAvailable(), false);
  });
});
