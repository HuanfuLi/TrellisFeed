/**
 * Phase 47 pre-gate-inversion regression suite for question.service.ask
 * (2026-05-15).
 *
 * Mirror of app/tests/state/useQuestions-pre-gate.test.mjs (Plan 04). Locks in
 * the D-18 / D-19 / D-01 invariants in the SECOND consumer of filterQuestion
 * — the legacy/REST-style `ask` method on questionService that does not flow
 * through the React hook.
 *
 * Why source-reading: the behavior under test (no chatCompletion call when
 * label is malicious; no embedText precompute either; no
 * classifyAndAnchorIncremental on off-topic) is structural — observable only
 * by stubbing the entire provider boundary, which CI does not do. Code-shape
 * assertions are the durable, deterministic guard.
 *
 * See:
 *   - .planning/phases/47-filter-redesign-off-topic-malicious-prompt-prevention/47-CONTEXT.md
 *     D-01 (three branches), D-18 (pre-gate inversion), D-19 (signal threading)
 *   - .planning/phases/47-filter-redesign-off-topic-malicious-prompt-prevention/47-PATTERNS.md
 *     §"app/tests/services/question-service-pre-gate.test.mjs" (analog confirmation)
 *   - .planning/phases/47-filter-redesign-off-topic-malicious-prompt-prevention/47-RESEARCH.md
 *     §"Pipeline Inversion Sketch" §"question.service.ask delta" (lines 794-800)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../../src/services/question.service.ts', import.meta.url),
  'utf-8',
);

/**
 * Slice the source between the `async ask(` declaration and the next sibling
 * method declaration `buildAndSave(`. The slice covers the entire ask-method
 * body so offset-comparisons inside the slice reflect ordering within ask().
 */
function getAskMethodSlice() {
  const startMarker = 'async ask(';
  const endMarker = '\n  buildAndSave(';
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker);
  assert.ok(
    startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
    `Could not locate ask-method anchor pair (${startMarker} ... ${endMarker.trim()}). startIdx=${startIdx}, endIdx=${endIdx}. The question.service.ts file structure may have changed; update the markers in this test.`,
  );
  return { slice: source.slice(startIdx, endIdx), startIdx, endIdx };
}

/**
 * Slice from `filterResult.label === '<label>'` to the matching closing `}`
 * of the `if (...) { ... }` block. Used to assert what runs (and does NOT
 * run) inside each branch of the three-way dispatch.
 */
function getBranchSlice(label) {
  const branchMarker = `filterResult.label === '${label}'`;
  const slice = getAskMethodSlice().slice;
  const branchIdx = slice.indexOf(branchMarker);
  assert.ok(branchIdx !== -1, `Branch marker not found in ask(): ${branchMarker}`);
  // Walk forward to find the opening `{` of the if-block, then track brace
  // depth until the matching close. This keeps the slice tight to the branch
  // body and avoids leaking into the else/sibling code.
  const openBrace = slice.indexOf('{', branchIdx);
  assert.ok(openBrace !== -1, `Could not find opening { after ${branchMarker}`);
  let depth = 1;
  let i = openBrace + 1;
  while (i < slice.length && depth > 0) {
    const c = slice[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  assert.ok(depth === 0, `Could not find matching } for branch ${label}`);
  return slice.slice(openBrace, i);
}

describe('question.service.ask pre-gate inversion (Phase 47)', () => {
  it('1. filterQuestion is called BEFORE chatCompletion in ask()', () => {
    const { slice } = getAskMethodSlice();
    const filterIdx = slice.indexOf('filterQuestion(');
    const chatIdx = slice.indexOf('chatCompletion(');
    assert.ok(
      filterIdx !== -1,
      'Phase 47 D-18 — question.service.ask MUST call filterQuestion(...) as a pre-gate. See 47-RESEARCH.md §"Pipeline Inversion Sketch".',
    );
    assert.ok(
      chatIdx !== -1,
      'question.service.ask MUST still call chatCompletion(...) for the on-topic + off-topic branches. See 47-RESEARCH.md §"Pipeline Inversion Sketch".',
    );
    assert.ok(
      filterIdx < chatIdx,
      `Phase 47 D-18 — filterQuestion (pre-gate) MUST run BEFORE chatCompletion in question.service.ask. Got offsets filterQuestion=${filterIdx}, chatCompletion=${chatIdx}. See 47-RESEARCH.md §"Pipeline Inversion Sketch".`,
    );
  });

  it('2. filterQuestion is called BEFORE the embedding precompute (first embedText call) in ask()', () => {
    const { slice } = getAskMethodSlice();
    const filterIdx = slice.indexOf('filterQuestion(');
    const embedIdx = slice.indexOf('embedText(');
    assert.ok(filterIdx !== -1, 'filterQuestion(...) call missing from ask()');
    assert.ok(
      embedIdx !== -1,
      'embedText(...) call missing from ask() — the pre-call query-embedding precompute must remain for context re-ranking',
    );
    assert.ok(
      filterIdx < embedIdx,
      `Phase 47 D-01 — malicious prompts MUST avoid the embedding precompute too (zero embedding tokens). filterQuestion must precede embedText in question.service.ask. Got offsets filterQuestion=${filterIdx}, embedText=${embedIdx}.`,
    );
  });

  it('3. filterQuestion is called with the signal parameter as the third argument (D-19) when ask accepts a signal', () => {
    const askSignatureMatch = source.match(/async ask\([^)]*signal[^)]*\)/);
    if (!askSignatureMatch) {
      // Conditional: ask method does not currently accept signal; this test
      // becomes a no-op. Document via a passing assertion so the test reports
      // green and the future signature change is not silently uncovered.
      assert.ok(true, 'ask() does not accept a signal parameter — D-19 abort threading test is a no-op for this signature.');
      return;
    }
    const { slice } = getAskMethodSlice();
    const callMatch = slice.match(/filterQuestion\([^)]*signal[^)]*\)/);
    assert.ok(
      callMatch,
      'Phase 47 D-19 — when ask() accepts a signal param, filterQuestion MUST receive it as the third argument for LOCALE_CHANGED cancellation. See 47-RESEARCH.md §"Abort signal threading".',
    );
  });

  it('4. The malicious branch returns ServiceResult error with code BLOCKED_MALICIOUS and does NOT invoke chatCompletion / embedText / buildAndSave / classifyAndAnchorIncremental', () => {
    const branchBody = getBranchSlice('malicious');

    // Must return the BLOCKED_MALICIOUS code (single- or double-quoted).
    assert.ok(
      /code:\s*['"]BLOCKED_MALICIOUS['"]/.test(branchBody),
      `Phase 47 D-01 — malicious branch MUST return ServiceResult error {code:'BLOCKED_MALICIOUS', ...}. Branch body: ${branchBody.slice(0, 200)}...`,
    );

    // Must NOT invoke any of the LLM/embedding/persistence call sites.
    for (const forbidden of ['chatCompletion(', 'embedText(', 'buildAndSave(', 'classifyAndAnchorIncremental(']) {
      assert.ok(
        !branchBody.includes(forbidden),
        `Phase 47 D-01 — malicious branch MUST NOT invoke ${forbidden} — zero LLM tokens, zero embedding tokens, no Question persisted. Found in branch body.`,
      );
    }
  });

  it('5. The off-topic branch sets flagged: true and SKIPS classifyAndAnchorIncremental', () => {
    const branchBody = getBranchSlice('off-topic');

    assert.ok(
      /flagged:\s*true/.test(branchBody),
      `Phase 47 D-01 — off-topic branch MUST set flagged:true on the persisted question. Branch body: ${branchBody.slice(0, 200)}...`,
    );

    assert.ok(
      !branchBody.includes('classifyAndAnchorIncremental('),
      'Phase 47 D-01 — off-topic branch MUST NOT fire classifyAndAnchorIncremental. Off-topic Q&A does not enter the mindmap; user override (Plan 06) is the only path that re-fires classification.',
    );
  });

  it('6. patchQuestion has no flag-transition hook — its body remains pure persistence (PATTERNS.md non-modification rule)', () => {
    // Locate the patchQuestion METHOD declaration site (not call sites).
    // The declaration shape `  patchQuestion(questionId:` is unique to the
    // method declaration in the questionService object literal.
    const declMarker = '  patchQuestion(questionId:';
    const declIdx = source.indexOf(declMarker);
    assert.ok(declIdx !== -1, `patchQuestion method declaration not found via marker: ${declMarker}`);

    // Walk the brace-depth from the opening `{` of the function body until
    // the matching close — this is the patchQuestion method body slice.
    const openBrace = source.indexOf('{', declIdx);
    assert.ok(openBrace !== -1, 'Could not find opening { for patchQuestion body');
    let depth = 1;
    let i = openBrace + 1;
    while (i < source.length && depth > 0) {
      const c = source[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      i++;
    }
    assert.ok(depth === 0, 'Could not find matching } for patchQuestion body');
    const body = source.slice(openBrace, i);

    assert.ok(
      !body.includes('classifyAndAnchorIncremental('),
      'Phase 47 / 47-PATTERNS.md — patchQuestion MUST remain pure persistence. The override re-fire belongs at the AskScreen.handleQuestionOverride call site (Plan 06), NOT inside patchQuestion. patchQuestion has 14+ call sites; a flag-transition hook here would fire spuriously. See 47-PATTERNS.md "Important non-modification".',
    );

    assert.ok(
      !/eventBus\.emit\(\s*\{\s*type:\s*['"]GRAPH_UPDATED/.test(body),
      'Phase 47 — patchQuestion MUST NOT emit GRAPH_UPDATED. classification path emits via commitClassificationResult; emitting here too would double-fire. See CLAUDE.md "Event bus — unified GRAPH_UPDATED".',
    );
  });

  it('7. No new event types introduced (CLAUDE.md "One signal per semantic event")', () => {
    const banned = source.match(/type:\s*['"](?:QUESTION_FLAGGED_PRE_GATE|FILTER_BLOCKED|MALICIOUS_BLOCKED)['"]/);
    assert.equal(
      banned,
      null,
      `Phase 47 — reuse existing events per CLAUDE.md "One signal per semantic event". Found new event type literal in question.service.ts: ${banned ? banned[0] : ''}.`,
    );
  });
});
