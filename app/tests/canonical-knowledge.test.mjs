import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCandidateContextPack,
  buildDailyReviewMap,
  decideIngestionOutcome,
  getDueProjectedFlashcards,
  projectQuestionToKnowledgeNode,
} from '../src/services/canonical-knowledge.service.ts';

const makeQuestion = (overrides = {}) => ({
  id: `q-${Math.random().toString(16).slice(2)}`,
  timestamp: Date.now(),
  date: '2026-03-22',
  content: 'What is spaced repetition?',
  answer: 'Spaced repetition revisits material over widening intervals to improve retention.',
  summary: 'Spaced repetition revisits material over widening intervals.',
  title: 'Spaced repetition',
  storyHook: 'Why does spacing reviews make memory stronger?',
  keywords: ['memory', 'spacing', 'retention'],
  relatedQuestionIds: [],
  categoryIds: ['cat-general'],
  reviewSchedule: { nextReviewDate: '2026-03-22', reviewCount: 0, easeFactor: 2.5 },
  createdAt: Date.now(),
  ...overrides,
});

test('projectQuestionToKnowledgeNode keeps canonical review and placement fields', () => {
  const question = makeQuestion({
    id: 'q-1',
    rootLabel: 'Memory',
    branchLabel: 'Forgetting',
    clusterLabel: 'Recall difficulty',
    placementReason: 'Grouped with forgetting-related concepts.',
  });
  const node = projectQuestionToKnowledgeNode(question);

  assert.equal(node.id, 'q-1');
  assert.equal(node.rootLabel, 'Memory');
  assert.equal(node.branchLabel, 'Forgetting');
  assert.equal(node.clusterLabel, 'Recall difficulty');
  assert.equal(node.reviewSchedule.nextReviewDate, '2026-03-22');
});

test('buildCandidateContextPack narrows to likely roots, branches, and candidates', () => {
  const questions = [
    makeQuestion({ id: 'q-1', title: 'Forgetting curve', content: 'What is the forgetting curve?', keywords: ['memory', 'forgetting'], rootLabel: 'Memory', branchLabel: 'Forgetting', clusterLabel: 'Forgetting curve' }),
    makeQuestion({ id: 'q-2', title: 'Retrieval practice', content: 'Why does retrieval practice work?', keywords: ['memory', 'retrieval'], rootLabel: 'Memory', branchLabel: 'Retrieval', clusterLabel: 'Testing effect' }),
    makeQuestion({ id: 'q-3', title: 'Gradient descent', content: 'What is gradient descent?', keywords: ['optimization', 'ml'], rootLabel: 'Machine Learning', branchLabel: 'Optimization', clusterLabel: 'Training basics' }),
  ];

  const pack = buildCandidateContextPack('Why does the forgetting curve matter after one day?', questions);
  assert.ok(pack.roots.some((root) => root.label === 'Memory'));
  assert.ok(pack.branches.some((branch) => branch.label === 'Forgetting'));
  assert.ok(pack.candidates.some((candidate) => candidate.id === 'q-1'));
});

test('decideIngestionOutcome merges strong duplicates and refines near matches', () => {
  const questions = [
    makeQuestion({ id: 'q-1', title: 'Forgetting curve', content: 'What is the forgetting curve?', keywords: ['memory', 'forgetting'], rootLabel: 'Memory', branchLabel: 'Forgetting', clusterLabel: 'Forgetting curve' }),
  ];

  const duplicate = decideIngestionOutcome('What is the forgetting curve?', questions);
  assert.equal(duplicate.outcome, 'merge');
  assert.equal(duplicate.targetNodeId, 'q-1');

  const refinement = decideIngestionOutcome('Why does the forgetting curve matter after first exposure?', questions);
  assert.equal(refinement.outcome, 'refine');
  assert.equal(refinement.targetNodeId, 'q-1');
});

test('getDueProjectedFlashcards and buildDailyReviewMap stay synchronized on node ids', () => {
  const questions = [
    makeQuestion({
      id: 'q-1',
      title: 'Forgetting curve',
      content: 'What is the forgetting curve?',
      rootLabel: 'Memory',
      branchLabel: 'Forgetting',
      clusterLabel: 'Forgetting curve',
      reviewSchedule: { nextReviewDate: '2020-01-01', reviewCount: 0, easeFactor: 2.5 },
    }),
    makeQuestion({
      id: 'q-2',
      title: 'Testing effect',
      content: 'Why does retrieval practice work?',
      rootLabel: 'Memory',
      branchLabel: 'Retrieval',
      clusterLabel: 'Testing effect',
      reviewSchedule: { nextReviewDate: '2099-12-31', reviewCount: 1, easeFactor: 2.5 },
    }),
  ];

  const dueCards = getDueProjectedFlashcards(questions);
  assert.equal(dueCards.length, 1);
  assert.equal(dueCards[0].nodeId, 'q-1');

  const map = buildDailyReviewMap(dueCards, questions, ['q-1'], 'q-1');
  assert.equal(map.totalDue, 1);
  assert.equal(map.revealedCount, 1);
  assert.equal(map.roots[0].branches[0].clusters[0].leaves[0].nodeId, 'q-1');
  assert.equal(map.roots[0].branches[0].clusters[0].leaves[0].state, 'active');
});
