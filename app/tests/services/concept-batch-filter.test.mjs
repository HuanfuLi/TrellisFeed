/**
 * Tests for D-13 (buildConceptBatch filtering logic).
 *
 * buildConceptBatch() is an unexported private function in concept-feed.service.ts.
 * We validate its contract by testing the underlying service primitives it consumes:
 *   - postQueueService.getQueue()  → source of pending concept IDs
 *   - dailyReadService.getExploredAnchors() → source of explored concept IDs
 *
 * Then we run the same filtering predicate in isolation to assert correct inclusion/exclusion.
 *
 * The implementation logic (lines 727-747 in concept-feed.service.ts) is:
 *   1. pendingIds = Set of sourceQuestionIds from all posts currently in the queue
 *   2. exploredIds = Set from dailyReadService.getExploredAnchors()
 *   3. dueAnchors = anchors WHERE id NOT IN pendingIds AND id NOT IN exploredIds
 *   4. For each dueAnchor: push id once; push a SECOND time if isImportant (ease < 1.5 or dying/falling/dead)
 */

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const { postQueueService } = await import('../../src/services/post-queue.service.ts');
const { dailyReadService } = await import('../../src/services/daily-read.service.ts');

// Helper to create a minimal DailyPost stub
function makePost(id, sourceQuestionIds = []) {
  return {
    id,
    date: new Date().toISOString().slice(0, 10),
    title: `Post ${id}`,
    teaser: { hook: '', preview: '' },
    bodyMarkdown: '',
    whyCare: '',
    takeaway: '',
    quickAskPrompts: [],
    narrativeMode: 'example-first',
    contextLabel: '',
    sourceType: 'recent',
    sourceQuestionIds,
    sourceQuestionTitles: [],
    keywords: [],
    generatedAt: Date.now(),
    origin: 'ai',
  };
}

// Helper: mirrors the filtering predicate in buildConceptBatch
function filterConcepts(anchors, pendingIds, exploredIds) {
  return anchors.filter(a => !pendingIds.has(a.id) && !exploredIds.has(a.id));
}

// Helper: mirrors the importance-doubling logic in buildConceptBatch
function applyImportanceWeighting(dueAnchors) {
  const result = [];
  for (const anchor of dueAnchors) {
    result.push(anchor.id);
    const isImportant =
      (anchor.reviewSchedule?.easeFactor != null && anchor.reviewSchedule.easeFactor < 1.5);
    if (isImportant) result.push(anchor.id);
  }
  return result;
}

describe('D-13 buildConceptBatch: pending post filter (via postQueueService)', () => {
  beforeEach(() => {
    localStorage.clear();
    postQueueService.loadQueue();
    dailyReadService.reset();
  });

  it('(a) getQueue reflects source question IDs — pending concepts are detectable', () => {
    const postWithAnchor = makePost('post-1', ['anchor-A']);
    postQueueService.enqueue([postWithAnchor]);

    const queuePosts = postQueueService.getQueue();
    const pendingIds = new Set(queuePosts.flatMap(p => p.sourceQuestionIds ?? []));

    assert.ok(pendingIds.has('anchor-A'), 'anchor-A should be in pending IDs from queue');
  });

  it('(a) concepts with pending posts in queue are excluded by filter predicate', () => {
    // anchor-A has a post in queue; anchor-B does not
    postQueueService.enqueue([makePost('post-for-A', ['anchor-A'])]);

    const pendingIds = new Set(postQueueService.getQueue().flatMap(p => p.sourceQuestionIds ?? []));
    const exploredIds = new Set(dailyReadService.getExploredAnchors());

    const anchors = [
      { id: 'anchor-A', isAnchorNode: true },
      { id: 'anchor-B', isAnchorNode: true },
    ];
    const due = filterConcepts(anchors, pendingIds, exploredIds);

    assert.equal(due.length, 1);
    assert.equal(due[0].id, 'anchor-B');
  });

  it('(b) getExploredAnchors reflects markExplored — explored concepts are detectable', () => {
    dailyReadService.markExplored('anchor-X');
    const exploredIds = new Set(dailyReadService.getExploredAnchors());
    assert.ok(exploredIds.has('anchor-X'), 'anchor-X should appear in explored set');
  });

  it('(b) concepts explored by user are excluded by filter predicate', () => {
    dailyReadService.markExplored('anchor-explored');

    const pendingIds = new Set(postQueueService.getQueue().flatMap(p => p.sourceQuestionIds ?? []));
    const exploredIds = new Set(dailyReadService.getExploredAnchors());

    const anchors = [
      { id: 'anchor-explored', isAnchorNode: true },
      { id: 'anchor-fresh', isAnchorNode: true },
    ];
    const due = filterConcepts(anchors, pendingIds, exploredIds);

    assert.equal(due.length, 1);
    assert.equal(due[0].id, 'anchor-fresh');
  });

  it('(c) un-covered, un-explored concepts pass through filter', () => {
    const pendingIds = new Set();
    const exploredIds = new Set();

    const anchors = [
      { id: 'fresh-1', isAnchorNode: true },
      { id: 'fresh-2', isAnchorNode: true },
    ];
    const due = filterConcepts(anchors, pendingIds, exploredIds);

    assert.equal(due.length, 2);
    assert.ok(due.some(a => a.id === 'fresh-1'));
    assert.ok(due.some(a => a.id === 'fresh-2'));
  });

  it('(d) important concepts (ease < 1.5) get 2 entries in the concept ID list', () => {
    const pendingIds = new Set();
    const exploredIds = new Set();

    const anchors = [
      { id: 'weak-anchor', isAnchorNode: true, reviewSchedule: { easeFactor: 1.3 } },
      { id: 'normal-anchor', isAnchorNode: true, reviewSchedule: { easeFactor: 2.5 } },
    ];
    const due = filterConcepts(anchors, pendingIds, exploredIds);
    const conceptIds = applyImportanceWeighting(due);

    assert.equal(conceptIds.filter(id => id === 'weak-anchor').length, 2, 'weak anchor should appear twice');
    assert.equal(conceptIds.filter(id => id === 'normal-anchor').length, 1, 'normal anchor should appear once');
  });

  it('(d) important concepts (ease >= 1.5) get only 1 entry', () => {
    const pendingIds = new Set();
    const exploredIds = new Set();

    const anchors = [
      { id: 'strong-anchor', isAnchorNode: true, reviewSchedule: { easeFactor: 2.0 } },
    ];
    const due = filterConcepts(anchors, pendingIds, exploredIds);
    const conceptIds = applyImportanceWeighting(due);

    assert.equal(conceptIds.filter(id => id === 'strong-anchor').length, 1);
  });

  it('both pending and explored exclusions apply simultaneously', () => {
    postQueueService.enqueue([makePost('post-P', ['anchor-pending'])]);
    dailyReadService.markExplored('anchor-explored');

    const pendingIds = new Set(postQueueService.getQueue().flatMap(p => p.sourceQuestionIds ?? []));
    const exploredIds = new Set(dailyReadService.getExploredAnchors());

    const anchors = [
      { id: 'anchor-pending', isAnchorNode: true },
      { id: 'anchor-explored', isAnchorNode: true },
      { id: 'anchor-due', isAnchorNode: true },
    ];
    const due = filterConcepts(anchors, pendingIds, exploredIds);

    assert.equal(due.length, 1);
    assert.equal(due[0].id, 'anchor-due');
  });
});
