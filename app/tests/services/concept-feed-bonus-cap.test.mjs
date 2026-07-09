/**
 * 54-02 regression guard for the concept-feed bonus-cap / allExplored gate.
 *
 * Live gate (concept-feed.service.ts:1705-1709, generateMorePosts):
 *
 *   const exploredAnchors = dailyReadService.getExploredAnchors();
 *   const anchors = questions.filter(q => q.isAnchorNode);
 *   const allExplored = anchors.length > 0 && anchors.every(a => exploredAnchors.includes(a.id));
 *   if (allExplored) {
 *     const settings = settingsService.getSync();
 *     const bonusCap = settings.feed?.bonusPostCap ?? FEED_DEFAULTS.bonusPostCap;
 *     if (postQueueService.getTotalServed() >= postQueueService.getTotalGenerated() + bonusCap) return [];
 *   }
 *
 * concept-feed.service.ts has transitive i18n (locales/en.json) deps that block a
 * direct import under `node --test`, so we mirror the gate as a pure helper
 * (INLINE-ALGORITHM pattern) — same approach as bonus-post-cap.test.mjs. The
 * default bonusCap is asserted against the real settings.service.ts module.
 *
 * Audit disposition: NOT-A-BUG (54-BUG-AUDIT.md Cluster 1). This is a PINNING guard
 * — it observes the corrected runtime behavior of an edge RESEARCH.md predicted is
 * already correct, so a future refactor cannot silently regress it.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Polyfill localStorage for the settings.service.ts import (reads localStorage at load).
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const { FEED_DEFAULTS } = await import('../../src/services/settings.service.ts');

// ─── Pure mirror of the live allExplored + bonus-cap gate ───────────────────
// Returns true when generateMorePosts should short-circuit with [].
function shouldReturnEmptyDueToBonusCap({
  anchors,
  exploredAnchorIds,
  totalServed,
  totalGenerated,
  bonusCap,
}) {
  const exploredSet = new Set(exploredAnchorIds);
  const allExplored = anchors.length > 0 && anchors.every(a => exploredSet.has(a.id));
  if (!allExplored) return false;
  return totalServed >= totalGenerated + bonusCap;
}

describe('54-02 concept-feed bonus-cap gate (allExplored)', () => {
  it('anchors=[] (first-time user) — allExplored is false → NOT capped, even with huge served count', () => {
    const capped = shouldReturnEmptyDueToBonusCap({
      anchors: [],
      exploredAnchorIds: [],
      totalServed: 1000,
      totalGenerated: 0,
      bonusCap: 0,
    });
    assert.equal(capped, false, 'zero anchors must make allExplored false so a new user is never capped');
  });

  it('anchors=[{a-1}], explored=[a-1], served=5, generated=5, bonusCap=0 → CAPPED (returns [])', () => {
    const capped = shouldReturnEmptyDueToBonusCap({
      anchors: [{ id: 'a-1' }],
      exploredAnchorIds: ['a-1'],
      totalServed: 5,
      totalGenerated: 5,
      bonusCap: 0,
      // 5 >= 5 + 0 = 5 → capped at the boundary, no crash, no negative count
    });
    assert.equal(capped, true, 'all explored + bonusCap=0 + served>=generated must cap immediately');
  });

  it('anchors present but NONE explored → NOT capped', () => {
    const capped = shouldReturnEmptyDueToBonusCap({
      anchors: [{ id: 'a-1' }, { id: 'a-2' }],
      exploredAnchorIds: [],
      totalServed: 100,
      totalGenerated: 0,
      bonusCap: 8,
    });
    assert.equal(capped, false, 'cap only applies when ALL anchors are explored');
  });

  it('anchors present but only SOME explored → NOT capped', () => {
    const capped = shouldReturnEmptyDueToBonusCap({
      anchors: [{ id: 'a-1' }, { id: 'a-2' }, { id: 'a-3' }],
      exploredAnchorIds: ['a-1', 'a-2'],
      totalServed: 100,
      totalGenerated: 0,
      bonusCap: 8,
    });
    assert.equal(capped, false, 'partial exploration must not trip the cap');
  });

  it('all explored, below cap (served < generated + bonusCap) → NOT capped', () => {
    const capped = shouldReturnEmptyDueToBonusCap({
      anchors: [{ id: 'a-1' }],
      exploredAnchorIds: ['a-1'],
      totalServed: 10,
      totalGenerated: 5,
      bonusCap: 8, // 10 < 13
    });
    assert.equal(capped, false, 'bonus posts continue while under the cap');
  });

  it('FEED_DEFAULTS.bonusPostCap default is 8 (real module)', () => {
    assert.equal(FEED_DEFAULTS.bonusPostCap, 8);
  });
});
