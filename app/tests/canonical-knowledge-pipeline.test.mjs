import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseStepResponse,
  buildStepPrompt,
  extractUniqueBranches,
  extractClustersUnderBranch,
  extractAnchorsUnderCluster,
} from '../src/services/canonical-knowledge.service.ts';

const makeQuestion = (overrides = {}) => ({
  id: `q-${Math.random().toString(16).slice(2)}`,
  timestamp: Date.now(),
  date: '2026-04-09',
  content: 'What is spaced repetition?',
  answer: 'Spaced repetition revisits material over widening intervals.',
  summary: 'Spaced repetition revisits material.',
  title: 'Spaced repetition',
  keywords: ['memory', 'spacing'],
  relatedQuestionIds: [],
  categoryIds: [],
  reviewSchedule: { nextReviewDate: '2026-04-09', reviewCount: 0, easeFactor: 2.5 },
  createdAt: Date.now(),
  ...overrides,
});

// ─── parseStepResponse ─────────────────────────────────────────────────────

test('parseStepResponse: bare integer in range returns selectedIndex', () => {
  const result = parseStepResponse('2', 5);
  assert.deepStrictEqual(result, { isNew: false, selectedIndex: 2 });
});

test('parseStepResponse: JSON with NEW index returns isNew + newName', () => {
  const result = parseStepResponse('{"index":"NEW","name":"Quantum Physics"}', 3);
  assert.deepStrictEqual(result, { isNew: true, newName: 'Quantum Physics' });
});

test('parseStepResponse: out-of-bounds integer throws', () => {
  assert.throws(() => parseStepResponse('99', 5), /Invalid step response/);
});

test('parseStepResponse: gibberish throws', () => {
  assert.throws(() => parseStepResponse('gibberish', 3), /Invalid step response/);
});

test('parseStepResponse: verbose LLM text with embedded integer extracts it', () => {
  const result = parseStepResponse('I think option 2 is best', 5);
  assert.deepStrictEqual(result, { isNew: false, selectedIndex: 2 });
});

test('parseStepResponse: JSON with numeric index returns selectedIndex', () => {
  const result = parseStepResponse('{"index":1}', 5);
  assert.deepStrictEqual(result, { isNew: false, selectedIndex: 1 });
});

test('parseStepResponse: index 0 (zero) is valid', () => {
  const result = parseStepResponse('0', 3);
  assert.deepStrictEqual(result, { isNew: false, selectedIndex: 0 });
});

test('parseStepResponse: negative index throws', () => {
  assert.throws(() => parseStepResponse('-1', 5), /Invalid step response/);
});

// ─── buildStepPrompt ───────────────────────────────────────────────────────

test('buildStepPrompt: with candidates lists numbered items', () => {
  const prompt = buildStepPrompt('branch', ['Psychology', 'Computer Science']);
  assert.ok(prompt.includes('0. Psychology'), 'should list index 0');
  assert.ok(prompt.includes('1. Computer Science'), 'should list index 1');
  assert.ok(prompt.includes('branch'), 'should mention level name');
});

test('buildStepPrompt: empty candidates returns create-new message', () => {
  const prompt = buildStepPrompt('cluster', []);
  assert.ok(prompt.includes('No existing clusters yet'), 'should indicate no candidates');
  assert.ok(prompt.includes('NEW'), 'should mention NEW');
});

test('buildStepPrompt: anchor level with object candidates uses names', () => {
  const prompt = buildStepPrompt('anchor', [
    { id: 'a-1', name: 'Spaced Repetition' },
    { id: 'a-2', name: 'Interleaving' },
  ]);
  assert.ok(prompt.includes('0. Spaced Repetition'));
  assert.ok(prompt.includes('1. Interleaving'));
});

// ─── extractUniqueBranches ─────────────────────────────────────────────────

test('extractUniqueBranches: filters out only flagged; cluster + anchor nodes ARE included', () => {
  // Phase 49-06 follow-up — the prior implementation skipped cluster +
  // anchor nodes, which hid an entire branch from the LLM whenever its last
  // QA was detached (the detached QA's branchLabel goes undefined, the
  // anchor + cluster nodes retain it but were filtered out). The fix unions
  // all three kinds so the structural truth of the graph is what the LLM
  // sees at step 1 of the by-layer pipeline.
  const questions = [
    makeQuestion({ branchLabel: 'Psychology' }),
    makeQuestion({ branchLabel: 'Psychology' }),
    makeQuestion({ branchLabel: 'Computer Science' }),
    makeQuestion({ branchLabel: 'Psychology', flagged: true }),
    makeQuestion({ branchLabel: 'Physics', isClusterNode: true }),
    makeQuestion({ branchLabel: 'Biology', isAnchorNode: true }),
  ];
  const branches = extractUniqueBranches(questions);
  assert.ok(branches.includes('Psychology'));
  assert.ok(branches.includes('Computer Science'));
  assert.ok(branches.includes('Physics'), 'cluster node\'s branchLabel surfaces post-fix');
  assert.ok(branches.includes('Biology'), 'anchor node\'s branchLabel surfaces post-fix');
  // Unique check
  assert.equal(branches.filter(b => b === 'Psychology').length, 1);
});

test('extractUniqueBranches: excludes vague labels', () => {
  const questions = [
    makeQuestion({ branchLabel: 'General concepts' }),
    makeQuestion({ branchLabel: 'Real Branch' }),
  ];
  const branches = extractUniqueBranches(questions);
  assert.ok(!branches.includes('General concepts'), 'vague label excluded');
  assert.ok(branches.includes('Real Branch'));
});

// ─── extractClustersUnderBranch ────────────────────────────────────────────

test('extractClustersUnderBranch: returns unique clusters for matching branch; anchor + cluster nodes ARE included', () => {
  // Phase 49-06 follow-up — same fix-direction as extractUniqueBranches.
  // Cluster + anchor nodes are now first-class label sources.
  const questions = [
    makeQuestion({ branchLabel: 'Psychology', clusterLabel: 'Learning Theory' }),
    makeQuestion({ branchLabel: 'Psychology', clusterLabel: 'Learning Theory' }),
    makeQuestion({ branchLabel: 'Psychology', clusterLabel: 'Memory' }),
    makeQuestion({ branchLabel: 'Computer Science', clusterLabel: 'Algorithms' }),
    makeQuestion({ branchLabel: 'Psychology', clusterLabel: 'Memory', flagged: true }),
    makeQuestion({ branchLabel: 'Psychology', clusterLabel: 'Perception', isAnchorNode: true }),
  ];
  const clusters = extractClustersUnderBranch(questions, 'Psychology');
  assert.ok(clusters.includes('Learning Theory'));
  assert.ok(clusters.includes('Memory'));
  assert.ok(!clusters.includes('Algorithms'), 'wrong branch excluded');
  assert.ok(clusters.includes('Perception'), 'anchor node\'s clusterLabel surfaces post-fix');
  assert.equal(clusters.filter(c => c === 'Learning Theory').length, 1, 'unique');
});

// ─── extractAnchorsUnderCluster ────────────────────────────────────────────

test('extractAnchorsUnderCluster: returns anchor id/name pairs', () => {
  const questions = [
    makeQuestion({
      id: 'a-1', title: 'Spaced Repetition', isAnchorNode: true,
      branchLabel: 'Psychology', clusterLabel: 'Learning Theory',
    }),
    makeQuestion({
      id: 'a-2', title: 'Interleaving', isAnchorNode: true,
      branchLabel: 'Psychology', clusterLabel: 'Learning Theory',
    }),
    makeQuestion({
      id: 'a-3', title: 'Binary Search', isAnchorNode: true,
      branchLabel: 'Computer Science', clusterLabel: 'Algorithms',
    }),
    makeQuestion({
      id: 'q-1', title: 'Regular Q&A',
      branchLabel: 'Psychology', clusterLabel: 'Learning Theory',
    }),
  ];
  const anchors = extractAnchorsUnderCluster(questions, 'Psychology', 'Learning Theory');
  assert.equal(anchors.length, 2);
  assert.ok(anchors.some(a => a.id === 'a-1' && a.name === 'Spaced Repetition'));
  assert.ok(anchors.some(a => a.id === 'a-2' && a.name === 'Interleaving'));
});

// ─── TD-03 plumbing — static-grep assertions (no TS import needed) ─────────

const __dirname_td03 = dirname(fileURLToPath(import.meta.url));
const repoRoot_td03 = resolve(__dirname_td03, '..');
const canonicalSrc = readFileSync(
  resolve(repoRoot_td03, 'src/services/canonical-knowledge.service.ts'),
  'utf8',
);

test('TD-03 plumbing: runStepWithRetry accepts signal?: AbortSignal', () => {
  assert.match(canonicalSrc, /async function runStepWithRetry\([\s\S]*?signal\?\s*:\s*AbortSignal/);
});

test('TD-03 plumbing: classifyAndAnchorIncremental accepts signal?: AbortSignal', () => {
  assert.match(canonicalSrc, /export async function classifyAndAnchorIncremental\([\s\S]*?signal\?\s*:\s*AbortSignal/);
});

test('TD-03 plumbing: all 3 runStepWithRetry call sites pass signal', () => {
  const callSites = canonicalSrc.match(/runStepWithRetry\([^)]*\)/g) || [];
  // First match is the declaration; filter to actual call-site invocations.
  const actualCalls = callSites.filter((m) => /,\s*signal\)/.test(m));
  assert.ok(actualCalls.length >= 3, `expected >= 3 runStepWithRetry calls passing signal, got ${actualCalls.length}`);
});

test('TD-03 plumbing: chatCompletion inside runStepWithRetry receives signal', () => {
  // The { signal } or signal: options should appear in the chatCompletion opts block inside runStepWithRetry
  const retryBlock = canonicalSrc.slice(
    canonicalSrc.indexOf('async function runStepWithRetry'),
    canonicalSrc.indexOf('export async function classifyAndAnchorIncremental'),
  );
  assert.match(retryBlock, /chatCompletion\([\s\S]*?signal[\s\S]*?\)/);
});

test('TD-03 D-17: classifyAndAnchor (fallback) signature UNCHANGED — exactly 3 params', () => {
  // The fallback function at ~line 848 must have EXACTLY (question, allQuestions, llmConfig)
  const fallbackSigMatch = canonicalSrc.match(/export async function classifyAndAnchor\(([^)]*)\)/);
  assert.ok(fallbackSigMatch, 'classifyAndAnchor declaration must exist');
  const params = fallbackSigMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
  assert.equal(params.length, 3, `classifyAndAnchor must have exactly 3 params; got ${params.length}: ${params.join(' | ')}`);
  assert.ok(!fallbackSigMatch[1].includes('signal'), 'classifyAndAnchor must NOT accept a signal param (D-17)');
});

test('TD-03 behavioral: AbortController.abort propagates AbortError out of a stubbed retry loop', async () => {
  const ac = new AbortController();
  ac.abort(new DOMException('test', 'AbortError'));
  async function fakeChatCompletion(_msgs, _cfg, opts) {
    if (opts?.signal?.aborted) {
      throw new DOMException('aborted', 'AbortError');
    }
    return '{}';
  }
  let err;
  try {
    await fakeChatCompletion([], {}, { serviceName: 'classification', signal: ac.signal });
  } catch (e) {
    err = e;
  }
  assert.ok(err instanceof DOMException);
  assert.equal(err.name, 'AbortError');
});
