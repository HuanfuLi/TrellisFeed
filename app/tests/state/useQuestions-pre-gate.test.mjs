/**
 * Phase 47 D-01 / D-02 / D-18 / D-19 pipeline-inversion regression suite.
 *
 * Locks in the Phase 47 structural guarantee that useQuestions.askStreaming
 * runs the three-label classifier (filterQuestion) BEFORE chatStream so
 * malicious prompts spend ZERO answer-LLM tokens AND never persist a
 * Question. Mirrors the Phase 35 byte-stability test's source-reading
 * discipline — behavior under test is observable only at the provider
 * boundary, which we do not stub in CI. Code-shape assertions are the
 * durable, deterministic guard.
 *
 * Six invariants this guards against:
 *
 *   1. Pipeline-inversion regression — D-18 (someone moves filterQuestion
 *      back to a post-LLM-flag pattern, silently re-spending tokens on
 *      malicious prompts).
 *   2. Abort-signal threading — D-19 (someone drops the third arg to
 *      filterQuestion, silently breaking LOCALE_CHANGED cancellation of
 *      in-flight embedding calls).
 *   3. Malicious-no-LLM — D-01 (someone adds a chatStream/chatCompletion/
 *      buildAndSave call inside the malicious branch, defeating the
 *      zero-tokens guarantee).
 *   4. Malicious-block render signal — D-01 / D-02 (someone deletes the
 *      `kind: 'malicious-block'` SessionMessage shape, preventing
 *      ChatMessage.tsx from rendering the inline rejection surface).
 *   5. Off-topic-skip-classification — D-01 (someone adds
 *      classifyAndAnchorIncremental inside the off-topic branch, putting
 *      flagged questions into the mind map).
 *   6. One-event-per-semantic-event — CLAUDE.md (someone introduces a new
 *      event type for the pre-gate instead of reusing QUESTION_ASKED).
 *
 * Phase 35 byte-stability is enforced by the sibling test
 * `useQuestions-system-prompt-stability.test.mjs` which the verify command
 * runs alongside this one — see plan 47-04 §verify.
 *
 * See .planning/phases/47-filter-redesign-off-topic-malicious-prompt-prevention/
 *   47-CONTEXT.md (D-01, D-02, D-18, D-19) and 47-RESEARCH.md
 *   §"Pipeline Inversion Sketch" §"Code Examples".
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../../src/state/useQuestions.ts', import.meta.url),
  'utf-8',
);

/**
 * Slice the source between two anchor literals. Mirrors the
 * HomeScreen.exploredAnchors-resync.test.mjs slice-by-anchor-pair pattern
 * (PATTERNS.md §"Slice-by-anchor pattern" lines 736-748).
 */
function sliceBetween(src, startMarker, endMarker, ctx) {
  const startIdx = src.indexOf(startMarker);
  assert.ok(
    startIdx !== -1,
    `${ctx}: could not locate start marker \`${startMarker}\``,
  );
  const endIdx = src.indexOf(endMarker, startIdx);
  assert.ok(
    endIdx !== -1 && endIdx > startIdx,
    `${ctx}: could not locate end marker \`${endMarker}\` after \`${startMarker}\``,
  );
  return src.slice(startIdx, endIdx);
}

/** Returns the source slice covering the full askStreaming useCallback body. */
function getAskStreamingSlice() {
  // askStreaming is declared via `const askStreaming = useCallback(...)` and
  // the next sibling declaration is `const getByDate = useCallback(...)`.
  return sliceBetween(
    source,
    'const askStreaming = useCallback',
    'const getByDate = useCallback',
    'askStreaming slice',
  );
}

describe('useQuestions pre-LLM filter gate (Phase 47 D-18 / D-19 / D-01 / D-02)', () => {
  it('case 1 (D-18) — filterQuestion is called BEFORE the first chatStream invocation in askStreaming', () => {
    const slice = getAskStreamingSlice();
    const filterIdx = slice.indexOf('filterQuestion(content');
    const chatStreamIdx = slice.indexOf('chatStream(');
    assert.ok(
      filterIdx !== -1,
      'Phase 47 D-18 — askStreaming MUST contain a `filterQuestion(content...)` call (the pre-gate). The post-LLM-flag pattern was replaced.',
    );
    assert.ok(
      chatStreamIdx !== -1,
      'askStreaming MUST contain a chatStream call (the answer LLM Pass 1). If this fails, Pass 1 has been removed entirely — that is not the intent of this plan.',
    );
    assert.ok(
      filterIdx < chatStreamIdx,
      `Phase 47 D-18 — filterQuestion (pre-gate) MUST run BEFORE chatStream in askStreaming. The post-LLM-flag pattern was replaced. See 47-RESEARCH.md §"Pipeline Inversion Sketch". filterQuestion offset=${filterIdx}, chatStream offset=${chatStreamIdx}.`,
    );
  });

  it('case 2 (D-19) — filterQuestion is called with abortController.signal as the third argument', () => {
    const slice = getAskStreamingSlice();
    assert.match(
      slice,
      /filterQuestion\s*\(\s*content\s*,\s*sessionContext\s*,\s*abortController\.signal\s*\)/,
      'Phase 47 D-19 — filterQuestion call MUST pass abortController.signal as third arg so LOCALE_CHANGED cancellation propagates to the embedding call. Without this, a locale switch mid-classification leaves a stale embedding request running.',
    );
  });

  it('case 3 (D-01) — the malicious branch does NOT invoke chatStream / chatCompletion / buildAndSave', () => {
    // Slice from the malicious-branch literal to the matching closing brace
    // of the if-block. Use the next `}` followed by a blank-line OR the next
    // top-level `const`/`if` declaration — whichever comes first — as the
    // upper bound. The malicious branch is a small `if (...) { ... return null; }`
    // followed by other code; the closing `}` of the if is on its own line.
    const slice = getAskStreamingSlice();
    const startIdx = slice.indexOf("if (filterResult.label === 'malicious')");
    assert.ok(
      startIdx !== -1,
      "Phase 47 D-01 — askStreaming MUST contain an `if (filterResult.label === 'malicious')` branch.",
    );
    // Scan forward for the matching closing brace of the if-block.
    // Counting braces from the position of the FIRST `{` after the if-condition.
    const openBraceIdx = slice.indexOf('{', startIdx);
    assert.ok(openBraceIdx !== -1, 'malicious branch: could not find opening brace');
    let depth = 1;
    let closeBraceIdx = -1;
    for (let i = openBraceIdx + 1; i < slice.length; i++) {
      const ch = slice[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          closeBraceIdx = i;
          break;
        }
      }
    }
    assert.ok(closeBraceIdx !== -1, 'malicious branch: could not find matching closing brace');
    const branchBody = slice.slice(openBraceIdx, closeBraceIdx + 1);

    // No chatStream / chatCompletion / buildAndSave inside the branch body.
    assert.equal(
      branchBody.match(/\bchatStream\s*\(/),
      null,
      'Phase 47 D-01 — malicious branch MUST NOT call chatStream. Found a forbidden call inside the malicious branch — malicious prompts must spend ZERO answer-LLM tokens.',
    );
    assert.equal(
      branchBody.match(/\bchatCompletion\s*\(/),
      null,
      'Phase 47 D-01 — malicious branch MUST NOT call chatCompletion. Found a forbidden call inside the malicious branch.',
    );
    assert.equal(
      branchBody.match(/\bbuildAndSave\s*\(/),
      null,
      'Phase 47 D-01 — malicious branch MUST NOT call buildAndSave. The malicious prompt must NOT enter the question store.',
    );
  });

  it('case 4 (D-01 / D-02) — the malicious branch sets SessionMessage.kind = "malicious-block"', () => {
    const slice = getAskStreamingSlice();
    const hasSingleQuoted = slice.includes("kind: 'malicious-block'");
    const hasDoubleQuoted = slice.includes('kind: "malicious-block"');
    assert.ok(
      hasSingleQuoted || hasDoubleQuoted,
      'Phase 47 D-01 / D-02 — malicious branch MUST construct a SessionMessage with `kind: \'malicious-block\'` so ChatMessage.tsx renders the inline rejection surface (no override button per D-02). See app/src/components/ChatMessage.tsx render branch added by Task 1.',
    );
  });

  it('case 5 (D-01) — the off-topic branch calls patchQuestion with flagged: true AND skips classifyAndAnchorIncremental', () => {
    const slice = getAskStreamingSlice();
    const startIdx = slice.indexOf("if (filterResult.label === 'off-topic')");
    assert.ok(
      startIdx !== -1,
      "Phase 47 D-01 — askStreaming MUST contain an `if (filterResult.label === 'off-topic')` branch.",
    );
    // Slice the off-topic branch body (matching-brace scan as in case 3).
    const openBraceIdx = slice.indexOf('{', startIdx);
    assert.ok(openBraceIdx !== -1, 'off-topic branch: could not find opening brace');
    let depth = 1;
    let closeBraceIdx = -1;
    for (let i = openBraceIdx + 1; i < slice.length; i++) {
      const ch = slice[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          closeBraceIdx = i;
          break;
        }
      }
    }
    assert.ok(closeBraceIdx !== -1, 'off-topic branch: could not find matching closing brace');
    const branchBody = slice.slice(openBraceIdx, closeBraceIdx + 1);

    assert.match(
      branchBody,
      /patchQuestion\s*\([^)]*flagged:\s*true/,
      'Phase 47 D-01 — off-topic branch MUST call `patchQuestion(rawQuestion.id, { flagged: true })` so the persisted question is flagged from the start (no post-LLM round-trip).',
    );
    assert.equal(
      branchBody.match(/\bclassifyAndAnchorIncremental\s*\(/),
      null,
      'Phase 47 D-01 — off-topic branch MUST NOT fire classifyAndAnchorIncremental. Flagged questions never enter the mind map (12+ consumers gate on `flagged`).',
    );
  });

  it('case 6 — no new event types introduced; QUESTION_ASKED is reused per CLAUDE.md "One signal per semantic event"', () => {
    // Source-wide assertion (not slice-bounded) — any new event type anywhere
    // in this file would defeat the one-event-per-semantic-event rule.
    assert.equal(
      source.match(/type:\s*['"](?:QUESTION_FLAGGED_PRE_GATE|FILTER_BLOCKED|MALICIOUS_BLOCKED)['"]/),
      null,
      'Phase 47 — reuse the existing QUESTION_ASKED event per CLAUDE.md "Event bus — unified GRAPH_UPDATED" + "One signal per semantic event". A new event type for the pre-gate creates a parallel signal that subscribers can desync from.',
    );
    // Counterweight: ensure QUESTION_ASKED IS still emitted in the off-topic
    // branch — without this the off-topic flag-update would silently fail to
    // reach other useQuestions instances (HomeScreen, etc.).
    assert.match(
      source,
      /eventBus\.emit\s*\(\s*\{\s*type:\s*['"]QUESTION_ASKED['"]\s*,\s*payload:\s*rawQuestion\s*\}\s*\)/,
      'Phase 47 — off-topic branch MUST keep `eventBus.emit({type: "QUESTION_ASKED", payload: rawQuestion})` so other useQuestions instances replace their copy with the flagged version before feed re-generation.',
    );
  });

  // Case 7 (Phase 35 byte-stability) is enforced by the sibling test
  // `useQuestions-system-prompt-stability.test.mjs` which the verify command
  // runs alongside this file. Confirm the analog test file still exists so a
  // future contributor doesn't accidentally delete it without noticing.
  it('case 7 (Phase 35) — the byte-stability sibling test file still exists', () => {
    const siblingTestUrl = new URL('./useQuestions-system-prompt-stability.test.mjs', import.meta.url);
    assert.ok(
      fs.existsSync(siblingTestUrl),
      'Phase 35 byte-stability invariant is enforced by tests/state/useQuestions-system-prompt-stability.test.mjs. That sibling file is missing — Phase 47 plan 04 verify expects both tests to run together. Restore the sibling test before merging this commit.',
    );
  });
});
