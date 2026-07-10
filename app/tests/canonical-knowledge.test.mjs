import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCandidateContextPack,
  decideIngestionOutcome,
  extractClustersUnderBranch,
  extractUniqueBranches,
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

// ════════════════════════════════════════════════════════════════════════
// Phase 49-06 follow-up — extractors must see cluster/anchor nodes too
// ════════════════════════════════════════════════════════════════════════
//
// UAT 2026-05-19: detaching the only QA under a cluster left the cluster
// node alive in storage but invisible to extractClustersUnderBranch (which
// previously only consulted QA-leaf placement labels), forcing the LLM at
// step 2 of the by-layer pipeline to propose a NEW near-duplicate cluster
// name (e.g. "Japanese Writing Systems" with a trailing s). The fix
// removes the isClusterNode/isAnchorNode skips so the structural truth of
// the graph is the prompt the LLM sees.

test('extractUniqueBranches: returns branchLabel from cluster nodes (no QAs reference it)', () => {
  const questions = [
    makeQuestion({ id: 'cluster-1', isClusterNode: true, branchLabel: 'Linguistics', clusterLabel: 'Japanese Writing System' }),
  ];
  const branches = extractUniqueBranches(questions);
  assert.ok(branches.includes('Linguistics'), 'cluster node\'s branchLabel surfaces');
});

test('extractUniqueBranches: returns branchLabel from anchor nodes (no QAs reference it)', () => {
  const questions = [
    makeQuestion({ id: 'anchor-1', isAnchorNode: true, branchLabel: 'Linguistics', clusterLabel: 'Japanese Writing System' }),
  ];
  const branches = extractUniqueBranches(questions);
  assert.ok(branches.includes('Linguistics'));
});

test('extractUniqueBranches: skips flagged records (cascade-cleanup soft-deletes hide)', () => {
  const questions = [
    makeQuestion({ id: 'anchor-1', isAnchorNode: true, branchLabel: 'GhostBranch', flagged: true }),
  ];
  const branches = extractUniqueBranches(questions);
  assert.ok(!branches.includes('GhostBranch'), 'flagged-out cascade-cleaned branch stays hidden');
});

test('extractClustersUnderBranch: returns clusterLabel from a cluster node with no QAs', () => {
  // Reproduce the UAT scenario: a cluster whose only QA was just detached
  // (QA.branchLabel/clusterLabel now undefined). The cluster node still
  // lives in storage carrying the labels.
  const questions = [
    makeQuestion({ id: 'cluster-1', isClusterNode: true, branchLabel: 'Linguistics', clusterLabel: 'Japanese Writing System' }),
    // Stripped-QA — labels undefined.
    makeQuestion({ id: 'qa-1' /* no branchLabel/clusterLabel */ }),
  ];
  const clusters = extractClustersUnderBranch(questions, 'Linguistics');
  assert.ok(
    clusters.includes('Japanese Writing System'),
    'cluster node label surfaces even when no QA carries it (regression: pre-fix returned [])',
  );
});

test('extractClustersUnderBranch: returns clusterLabel from anchor nodes too', () => {
  const questions = [
    makeQuestion({ id: 'anchor-1', isAnchorNode: true, branchLabel: 'L', clusterLabel: 'C' }),
  ];
  const clusters = extractClustersUnderBranch(questions, 'L');
  assert.ok(clusters.includes('C'));
});

test('extractClustersUnderBranch: still filters by branchLabel', () => {
  const questions = [
    makeQuestion({ id: 'cluster-a', isClusterNode: true, branchLabel: 'BranchA', clusterLabel: 'C1' }),
    makeQuestion({ id: 'cluster-b', isClusterNode: true, branchLabel: 'BranchB', clusterLabel: 'C2' }),
  ];
  const clusters = extractClustersUnderBranch(questions, 'BranchA');
  assert.deepEqual(clusters, ['C1'], 'C2 from BranchB excluded');
});
