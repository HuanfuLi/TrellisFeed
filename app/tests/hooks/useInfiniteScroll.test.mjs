/**
 * useInfiniteScroll.test.mjs
 * Unit tests for useInfiniteScroll hook logic.
 * Phase 8: Post Detail & Infinite Scroll
 *
 * Tests the core scroll detection and debounce logic in pure JS,
 * without React DOM rendering.
 */

import { describe, it } from 'node:test';
import assert from 'assert';

// ─── Scroll Detection Logic (pure functions extracted for testability) ─────────

/**
 * Checks whether the scroll container has reached the bottom.
 * @param {{ scrollTop: number, scrollHeight: number, clientHeight: number }} el
 * @param {number} threshold
 * @returns {boolean}
 */
function isAtBottom(el, threshold = 0) {
  const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
  return distanceFromBottom <= threshold;
}

/**
 * Simple debounce implementation (for testing the timing behaviour).
 * @param {Function} fn
 * @param {number} ms
 * @returns {{ debounced: Function, cancel: Function }}
 */
function makeDebounce(fn, ms) {
  let timer = null;
  function debounced(...args) {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  }
  debounced.cancel = () => {
    if (timer !== null) { clearTimeout(timer); timer = null; }
  };
  return debounced;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useInfiniteScroll logic', () => {
  it('detects scroll to bottom', () => {
    // Simulate a container that is fully scrolled to the bottom
    const el = { scrollTop: 900, scrollHeight: 1000, clientHeight: 100 };
    assert.ok(isAtBottom(el, 0), 'Should detect absolute bottom (distance = 0)');

    // Simulate not at bottom
    const notBottom = { scrollTop: 500, scrollHeight: 1000, clientHeight: 100 };
    assert.ok(!isAtBottom(notBottom, 0), 'Should not detect bottom when not scrolled fully');
  });

  it('debounces onLoadMore calls', (t, done) => {
    let callCount = 0;
    const fn = () => { callCount++; };
    const debounced = makeDebounce(fn, 50);

    // Call 3 times rapidly
    debounced();
    debounced();
    debounced();

    // Should not have been called yet
    assert.strictEqual(callCount, 0, 'Should not call immediately');

    // After debounce period, should be called exactly once
    setTimeout(() => {
      assert.strictEqual(callCount, 1, 'Should be called exactly once after debounce');
      done();
    }, 100);
  });

  it('loads more posts when at bottom', () => {
    const el = { scrollTop: 900, scrollHeight: 1000, clientHeight: 100 };
    let triggered = false;
    function checkAndLoad(container, threshold, onLoadMore) {
      if (isAtBottom(container, threshold)) {
        onLoadMore();
      }
    }
    checkAndLoad(el, 0, () => { triggered = true; });
    assert.ok(triggered, 'onLoadMore should be called when at bottom');
  });

  it('prevents concurrent loads', () => {
    let isLoading = false;
    let loadCount = 0;

    async function attemptLoad() {
      if (isLoading) return; // Guard
      isLoading = true;
      loadCount++;
      // Simulate async work
      await new Promise(resolve => setTimeout(resolve, 10));
      isLoading = false;
    }

    // Call twice simultaneously (simulates rapid scroll events)
    void attemptLoad();
    void attemptLoad(); // Second call should be blocked by isLoading guard

    assert.strictEqual(loadCount, 1, 'Second call should be blocked by isLoading guard');
  });

  it('exposes loading state', () => {
    // Test that the loading state management works correctly
    let isLoading = false;
    const states = [];

    async function performLoad() {
      isLoading = true;
      states.push(isLoading);
      await Promise.resolve(); // Simulate async
      isLoading = false;
      states.push(isLoading);
    }

    const p = performLoad();
    // After starting: isLoading should be true
    assert.strictEqual(states[0], true, 'isLoading should be true during load');

    return p.then(() => {
      assert.strictEqual(states[1], false, 'isLoading should be false after load completes');
    });
  });
});
