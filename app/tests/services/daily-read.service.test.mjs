import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill for Node
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const { dailyReadService } = await import('../../src/services/daily-read.service.ts');

const STORAGE_KEY = 'echolearn_daily_read';

describe('dailyReadService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('markExplored adds anchorId to exploredAnchors list', () => {
    dailyReadService.markExplored('anchor-1');
    const anchors = dailyReadService.getExploredAnchors();
    assert.ok(anchors.includes('anchor-1'));
  });

  it('markExplored is idempotent — duplicate calls do not add twice', () => {
    dailyReadService.markExplored('anchor-1');
    dailyReadService.markExplored('anchor-1');
    const anchors = dailyReadService.getExploredAnchors();
    assert.equal(anchors.filter(a => a === 'anchor-1').length, 1);
  });

  it('isExplored returns true for explored anchors, false for unknown', () => {
    dailyReadService.markExplored('anchor-1');
    assert.equal(dailyReadService.isExplored('anchor-1'), true);
    assert.equal(dailyReadService.isExplored('anchor-999'), false);
  });

  it('getExploredAnchors returns all explored anchors', () => {
    dailyReadService.markExplored('anchor-1');
    dailyReadService.markExplored('anchor-2');
    dailyReadService.markExplored('anchor-3');
    const anchors = dailyReadService.getExploredAnchors();
    assert.deepEqual(anchors.sort(), ['anchor-1', 'anchor-2', 'anchor-3']);
  });

  it('state resets when date changes', () => {
    dailyReadService.markExplored('anchor-1');
    assert.equal(dailyReadService.isExplored('anchor-1'), true);

    // Manually overwrite stored JSON with a different date
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    raw.date = '1999-01-01';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));

    // After date change, state should be fresh
    assert.deepEqual(dailyReadService.getExploredAnchors(), []);
    assert.equal(dailyReadService.isExplored('anchor-1'), false);
  });

  it('isCreditAwarded returns false initially, true after markCreditAwarded', () => {
    assert.equal(dailyReadService.isCreditAwarded(), false);
    dailyReadService.markCreditAwarded();
    assert.equal(dailyReadService.isCreditAwarded(), true);
  });

  it('creditAwarded resets on new day', () => {
    dailyReadService.markCreditAwarded();
    assert.equal(dailyReadService.isCreditAwarded(), true);

    // Manually overwrite stored JSON with a different date
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    raw.date = '1999-01-01';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));

    assert.equal(dailyReadService.isCreditAwarded(), false);
  });
});
