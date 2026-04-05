/**
 * portal-card.test.mjs
 * Behavioral tests for buildPortalData aggregation logic.
 * Phase 20: Orchestration Strategy & Diagnostic Dialogue
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'assert';

// ─── Pure buildPortalData logic (mirrors PortalCard.tsx implementation) ───────
// We test the aggregation logic directly without DOM/React dependencies.

/**
 * Build portal data by aggregating content counts for a given concept.
 * This is the pure logic extracted from PortalCard.tsx for testability.
 */
function buildPortalData(conceptId, title, reason, deps) {
  const { flashcards, questions, dailyPosts } = deps;

  const relatedFlashcards = flashcards.filter(
    (c) => c.nodeId === conceptId
  ).length;

  const relatedQuestions = questions.filter(
    (q) => q.id === conceptId || (q.relatedQuestionIds && q.relatedQuestionIds.includes(conceptId))
  ).length;

  let relatedPosts = 0;
  try {
    if (Array.isArray(dailyPosts)) {
      relatedPosts = dailyPosts.filter(
        (p) => p.sourceQuestionIds && p.sourceQuestionIds.includes(conceptId)
      ).length;
    }
  } catch {
    relatedPosts = 0;
  }

  return {
    conceptId,
    title,
    description: reason,
    relatedPosts,
    relatedFlashcards,
    relatedQuestions,
    primaryAction: 'review',
    move: null,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('buildPortalData', () => {
  const CONCEPT_ID = 'q-concept-1';

  const mockFlashcards = [
    { id: 'fc-1', nodeId: 'q-concept-1', front: 'Q1', back: 'A1' },
    { id: 'fc-2', nodeId: 'q-concept-1', front: 'Q2', back: 'A2' },
    { id: 'fc-3', nodeId: 'q-concept-2', front: 'Q3', back: 'A3' },
  ];

  const mockQuestions = [
    { id: 'q-concept-1', title: 'Concept 1', keywords: [], relatedQuestionIds: [] },
    { id: 'q-other', title: 'Other', keywords: [], relatedQuestionIds: ['q-concept-1'] },
    { id: 'q-unrelated', title: 'Unrelated', keywords: [], relatedQuestionIds: ['q-concept-2'] },
  ];

  const mockDailyPosts = [
    { id: 'post-1', sourceQuestionIds: ['q-concept-1'] },
    { id: 'post-2', sourceQuestionIds: ['q-concept-1', 'q-concept-2'] },
    { id: 'post-3', sourceQuestionIds: ['q-concept-2'] },
  ];

  it('returns correct relatedFlashcards count for a given conceptId', () => {
    const result = buildPortalData(CONCEPT_ID, 'Test', 'reason', {
      flashcards: mockFlashcards,
      questions: [],
      dailyPosts: [],
    });
    assert.strictEqual(result.relatedFlashcards, 2);
  });

  it('returns correct relatedQuestions count for a given conceptId', () => {
    const result = buildPortalData(CONCEPT_ID, 'Test', 'reason', {
      flashcards: [],
      questions: mockQuestions,
      dailyPosts: [],
    });
    // q-concept-1 (direct match) + q-other (has it in relatedQuestionIds)
    assert.strictEqual(result.relatedQuestions, 2);
  });

  it('returns 0 counts when no matching content exists', () => {
    const result = buildPortalData('q-nonexistent', 'Empty', 'no match', {
      flashcards: mockFlashcards,
      questions: mockQuestions,
      dailyPosts: mockDailyPosts,
    });
    assert.strictEqual(result.relatedFlashcards, 0);
    assert.strictEqual(result.relatedQuestions, 0);
    assert.strictEqual(result.relatedPosts, 0);
  });

  it('returns correct relatedPosts count from daily posts', () => {
    const result = buildPortalData(CONCEPT_ID, 'Test', 'reason', {
      flashcards: [],
      questions: [],
      dailyPosts: mockDailyPosts,
    });
    assert.strictEqual(result.relatedPosts, 2);
  });

  it('PortalCardData shape includes all required fields', () => {
    const result = buildPortalData(CONCEPT_ID, 'Concept Title', 'Some reason text', {
      flashcards: mockFlashcards,
      questions: mockQuestions,
      dailyPosts: mockDailyPosts,
    });

    assert.strictEqual(typeof result.conceptId, 'string');
    assert.strictEqual(result.conceptId, CONCEPT_ID);
    assert.strictEqual(typeof result.title, 'string');
    assert.strictEqual(result.title, 'Concept Title');
    assert.strictEqual(typeof result.description, 'string');
    assert.strictEqual(result.description, 'Some reason text');
    assert.strictEqual(typeof result.relatedPosts, 'number');
    assert.strictEqual(typeof result.relatedFlashcards, 'number');
    assert.strictEqual(typeof result.relatedQuestions, 'number');
    assert.strictEqual(typeof result.primaryAction, 'string');
    assert.ok('move' in result, 'move field must be present');
  });
});
