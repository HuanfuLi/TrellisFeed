/**
 * Tests for D-39 (Bonus post cap after all concepts explored).
 *
 * The cap logic lives in concept-feed.service.ts generateMorePosts (lines 1217-1225):
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
 * We mirror this as a pure helper (INLINE-ALGORITHM pattern) to avoid pulling in
 * DOM/Capacitor deps that the full concept-feed.service.ts transitively requires.
 *
 * FEED_DEFAULTS.bonusPostCap is 8 (settings.service.ts:8). One test asserts this default
 * by importing the real module.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Polyfill localStorage for the settings.service.ts import below (it reads localStorage at module load).
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const { FEED_DEFAULTS } = await import('../../src/services/settings.service.ts');

// ─── Pure helper: mirrors the D-39 gate in generateMorePosts ────────────────
// Returns true when generateMorePosts should short-circuit with [] because the
// bonus post cap has been reached.
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

describe('D-39 bonus post cap: all concepts explored gate', () => {
  it('(1) no anchors — allExplored is false, NOT capped', () => {
    const capped = shouldReturnEmptyDueToBonusCap({
      anchors: [],
      exploredAnchorIds: [],
      totalServed: 100,
      totalGenerated: 0,
      bonusCap: 8,
    });
    assert.equal(capped, false, 'with zero anchors, allExplored must be false regardless of served counts');
  });

  it('(2) anchors exist but NOT all explored — NOT capped', () => {
    const capped = shouldReturnEmptyDueToBonusCap({
      anchors: [{ id: 'a-1' }, { id: 'a-2' }, { id: 'a-3' }],
      exploredAnchorIds: ['a-1'], // only 1 of 3 explored
      totalServed: 100,
      totalGenerated: 0,
      bonusCap: 8,
    });
    assert.equal(capped, false, 'cap must only apply when ALL anchors are explored');
  });

  it('(3) all anchors explored AND totalServed < totalGenerated + bonusCap — NOT capped', () => {
    const capped = shouldReturnEmptyDueToBonusCap({
      anchors: [{ id: 'a-1' }, { id: 'a-2' }],
      exploredAnchorIds: ['a-1', 'a-2'],
      totalServed: 10,
      totalGenerated: 5,
      bonusCap: 8,
      // 10 < 5 + 8 = 13 → not yet capped, still within bonus quota
    });
    assert.equal(capped, false, 'below the cap, bonus posts should continue');
  });

  it('(4) all anchors explored AND totalServed === totalGenerated + bonusCap — CAPPED (>=)', () => {
    const capped = shouldReturnEmptyDueToBonusCap({
      anchors: [{ id: 'a-1' }],
      exploredAnchorIds: ['a-1'],
      totalServed: 13,
      totalGenerated: 5,
      bonusCap: 8,
      // 13 >= 5 + 8 = 13 → cap reached (boundary)
    });
    assert.equal(capped, true, 'predicate uses >= so boundary equality must cap');
  });

  it('(5) all anchors explored AND totalServed > totalGenerated + bonusCap — CAPPED', () => {
    const capped = shouldReturnEmptyDueToBonusCap({
      anchors: [{ id: 'a-1' }, { id: 'a-2' }],
      exploredAnchorIds: ['a-1', 'a-2'],
      totalServed: 20,
      totalGenerated: 5,
      bonusCap: 8,
      // 20 > 5 + 8 = 13 → strictly over the cap
    });
    assert.equal(capped, true);
  });

  it('(6) default bonusCap from FEED_DEFAULTS is 8', () => {
    assert.equal(FEED_DEFAULTS.bonusPostCap, 8, 'D-39 default bonus cap must be 8');
  });

  it('(7) bonusCap of 0 — CAPPED immediately once all explored if totalServed >= totalGenerated', () => {
    const capped = shouldReturnEmptyDueToBonusCap({
      anchors: [{ id: 'a-1' }],
      exploredAnchorIds: ['a-1'],
      totalServed: 5,
      totalGenerated: 5,
      bonusCap: 0,
      // 5 >= 5 + 0 = 5 → capped immediately
    });
    assert.equal(capped, true, 'bonusCap=0 means no bonus allowed beyond what was generated');
  });

  it('(8) empty exploredAnchorIds — allExplored false, NOT capped', () => {
    const capped = shouldReturnEmptyDueToBonusCap({
      anchors: [{ id: 'a-1' }, { id: 'a-2' }],
      exploredAnchorIds: [],
      totalServed: 1000,
      totalGenerated: 0,
      bonusCap: 8,
    });
    assert.equal(capped, false, 'no explored anchors → allExplored false → cap never applies');
  });

  it('(9) uses default FEED_DEFAULTS.bonusPostCap when passed as literal — cap=8 boundary check', () => {
    // Mirrors a realistic scenario: the impl's fallback resolves to 8.
    const capped = shouldReturnEmptyDueToBonusCap({
      anchors: [{ id: 'a-1' }],
      exploredAnchorIds: ['a-1'],
      totalServed: 8,
      totalGenerated: 0,
      bonusCap: FEED_DEFAULTS.bonusPostCap,
      // 8 >= 0 + 8 = 8 → capped at the default boundary
    });
    assert.equal(capped, true);
  });
});
