/**
 * Phase 41 Plan 41-01 Task 4 — concept-feed source-diversity wiring tests.
 *
 * Covers:
 *   - SC-1 (integration): walker skips dismissed concept end-to-end via
 *     engagementService → walkDerivedList(N, exploredIds, dismissedIds).
 *     Targets walkDerivedList directly (NOT a mocked refillQueue) per Pitfall 7.
 *   - SC-2(a) source-reading: news call sites read usedDomains BEFORE webSearch,
 *     pass excludeDomains + maxResults: 3, recordServedDomain AFTER commit.
 *   - SC-2(b) behavioral: filterForDiversity prefers unseen domains in mixed input.
 *   - Counterweight assertions: Phase 39 walker wire intact at line 1212;
 *     recordServedDomain ordering after commits in both loops.
 */

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';

// localStorage polyfill for Node (engagement.service + post-queue.service both need it)
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const { engagementService } = await import('../../src/services/engagement.service.ts');
const { postQueueService } = await import('../../src/services/post-queue.service.ts');
const { sourceDiversityService } = await import('../../src/services/source-diversity.service.ts');

const SRC = readFileSync(
  new URL('../../src/services/concept-feed.service.ts', import.meta.url),
  'utf8',
);

// ─── SC-1 integration ──────────────────────────────────────────────────────────

describe('SC-1: walker skips dismissed concept end-to-end', () => {
  beforeEach(() => {
    localStorage.clear();
    engagementService.reset();
    postQueueService.loadQueue();  // re-read state from cleared localStorage → freshState
  });

  it('walkDerivedList output excludes dismissed conceptIds (engagementService → walker integration)', () => {
    engagementService.dismissAnchor('concept-X');

    postQueueService.appendToDerivedList(['concept-X', 'concept-Y', 'concept-Z']);

    const exploredIds = new Set();
    const dismissedIds = new Set(engagementService.getDismissedAnchorIds());

    // Request 2 entries — walker must lazy-skip 'concept-X' and return Y + Z.
    const result = postQueueService.walkDerivedList(2, exploredIds, dismissedIds);

    assert.ok(
      !result.includes('concept-X'),
      'dismissed concept-X must NOT appear in walker output',
    );
    assert.equal(result.length, 2, 'walker should still satisfy count=2 from non-dismissed entries');
    assert.deepEqual(
      result.sort(),
      ['concept-Y', 'concept-Z'],
      'walker output must contain only the non-dismissed concepts Y and Z',
    );
  });

  it('walkDerivedList with empty dismissedIds Set returns all entries (counterweight — dismissedIds is the gate)', () => {
    // Counterweight: when nothing is dismissed, walker behavior is unchanged.
    // Guards against false-positive on the SC-1 test (if walker ignored dismissedIds
    // entirely, this test would also pass — but the SC-1 test would fail).
    postQueueService.appendToDerivedList(['concept-A', 'concept-B', 'concept-C']);
    const result = postQueueService.walkDerivedList(3, new Set(), new Set());
    assert.equal(result.length, 3, 'no dismissed → walker returns all 3');
    assert.deepEqual(result.sort(), ['concept-A', 'concept-B', 'concept-C']);
  });
});

// ─── SC-2(a) source-reading: wiring at both news call sites ────────────────────

describe('SC-2(a): source-reading — news call sites wire sourceDiversityService correctly', () => {
  it('both news call sites call sourceDiversityService.getUsedDomains BEFORE webSearch', () => {
    // Find every news webSearch call (matches both creation loop + pre-fetch loop).
    const matches = [...SRC.matchAll(/webSearch\(\s*\n?\s*conceptName \+ ' latest research findings'/g)];
    assert.equal(
      matches.length,
      2,
      'expected exactly 2 news call sites (creation loop + pre-fetch loop)',
    );

    for (const m of matches) {
      // Window: 600 chars BEFORE the webSearch call.
      const before = SRC.slice(Math.max(0, m.index - 600), m.index);
      assert.match(
        before,
        /sourceDiversityService\.getUsedDomains\(/,
        `getUsedDomains must precede webSearch at offset ${m.index}`,
      );
    }
  });

  it('both news call sites pass excludeDomains: [...usedDomains] AND maxResults: 3', () => {
    const calls = [...SRC.matchAll(/maxResults: 3, excludeDomains: \[\.\.\.usedDomains\]/g)];
    assert.equal(
      calls.length,
      2,
      'expected 2 calls with maxResults: 3 + excludeDomains: [...usedDomains] spread',
    );
  });

  it('both news call sites call filterForDiversity on the results array', () => {
    // Two real call-site invocations (one in creation loop on searchResult.data.results,
    // one in pre-fetch loop on results.data.results). Comments may add extra matches.
    const callSiteMatches = [
      ...SRC.matchAll(/sourceDiversityService\.filterForDiversity\([a-zA-Z]/g),
    ];
    assert.equal(
      callSiteMatches.length,
      2,
      'expected exactly 2 actual filterForDiversity invocations (excludes docstring mentions)',
    );
  });
});

// ─── SC-2(a) counterweight: recordServedDomain ordering ────────────────────────

describe('SC-2(a) counterweight: recordServedDomain after commit', () => {
  it('recordServedDomain in creation loop appears AFTER posts.push of news entry', () => {
    // Find the news posts.push (anchored on sourceType: 'news').
    const newsPushSourceTypeIdx = SRC.indexOf("sourceType: 'news'");
    assert.ok(newsPushSourceTypeIdx >= 0, "news creation loop should have sourceType: 'news'");
    const recordIdx = SRC.indexOf('sourceDiversityService.recordServedDomain', newsPushSourceTypeIdx);
    assert.ok(
      recordIdx > newsPushSourceTypeIdx,
      'recordServedDomain in creation loop must appear AFTER the news posts.push (commit-then-record ordering)',
    );
  });

  it('recordServedDomain in pre-fetch loop appears AFTER preFetched.news.set', () => {
    const preFetchSet = SRC.indexOf('preFetched.news.set(a.conceptId, chosen)');
    assert.ok(
      preFetchSet >= 0,
      'pre-fetch loop must store filtered[0] as `chosen` into preFetched.news',
    );
    const preFetchRecord = SRC.indexOf('sourceDiversityService.recordServedDomain', preFetchSet);
    assert.ok(
      preFetchRecord > preFetchSet,
      'recordServedDomain must follow preFetched.news.set in pre-fetch loop',
    );
  });

  it('recordServedDomain calls are guarded by truthy domain check (extractDomain undefined-guard)', () => {
    // Pattern: `if (domain) sourceDiversityService.recordServedDomain(...)`
    const guarded = [...SRC.matchAll(/if \(domain\) sourceDiversityService\.recordServedDomain/g)];
    assert.equal(guarded.length, 2, 'both recordServedDomain calls must be guarded by `if (domain)`');
  });
});

// ─── SC-2(b) behavioral: filterForDiversity rerank ─────────────────────────────

describe('SC-2(b): filterForDiversity prefers unseen domain in mixed input', () => {
  beforeEach(() => {
    sourceDiversityService.reset();
  });

  it('mit.edu (unseen) ranks above nature.com (seen) despite lower domain quality', () => {
    const mockResults = [
      { title: 'Nature paper 1', url: 'https://nature.com/article-1', content: 'snippet 1', score: 0.9 },
      { title: 'Nature paper 2', url: 'https://nature.com/article-2', content: 'snippet 2', score: 0.85 },
      { title: 'MIT research', url: 'https://mit.edu/research', content: 'snippet 3', score: 0.7 },
    ];
    const usedDomains = new Set(['nature.com']);

    const filtered = sourceDiversityService.filterForDiversity(mockResults, usedDomains);

    assert.ok(filtered.length >= 1, 'filtered must return at least 1 result');
    assert.match(
      filtered[0].url,
      /mit\.edu/,
      'unseen mit.edu must rank above seen nature.com (Phase 40 D-06 — Pass A unseen-first)',
    );
  });

  it('with no used domains, top-quality wins (regression guard for filterForDiversity)', () => {
    const mockResults = [
      { title: 'Medium article', url: 'https://medium.com/x', content: 'c', score: 0.5 },
      { title: 'Nature article', url: 'https://nature.com/y', content: 'c', score: 0.5 },
    ];
    const filtered = sourceDiversityService.filterForDiversity(mockResults, new Set());
    assert.match(filtered[0].url, /nature\.com/, 'with no used domains, nature.com (top tier) wins');
  });
});

// ─── Counterweight: Phase 39 walker wire intact ────────────────────────────────

describe('counterweight: Phase 39 walker wire untouched at concept-feed.service.ts:~1212', () => {
  it('concept-feed.service.ts contains walkDerivedList(24, exploredIds, dismissedIds)', () => {
    assert.match(
      SRC,
      /walkDerivedList\(24, exploredIds, dismissedIds\)/,
      'Phase 39 D-07 walker wire must be unchanged — load-bearing per CLAUDE.md',
    );
  });

  it('dismissedIds is built from engagementService.getDismissedAnchorIds()', () => {
    assert.match(
      SRC,
      /new Set\(engagementService\.getDismissedAnchorIds\(\)\)/,
      'dismissedIds must be sourced from engagementService',
    );
  });
});
