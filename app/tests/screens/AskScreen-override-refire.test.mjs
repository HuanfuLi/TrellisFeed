// Phase 47 Plan 06 (D-06) — Override re-fire wire-up guard.
//
// FILTER-05 contract: when the user taps "Save anyway" on a flagged exchange,
// the question must (a) flip flagged: false (existing D-05 surface) AND
// (b) actually enter the mind map by firing classifyAndAnchorIncremental
// AFTER the patch (D-06 gap closure).
//
// The override re-fire is wired at the AskScreen.handleQuestionOverride call
// site, NOT inside questionService.patchQuestion (PATTERNS.md non-modification
// rule — patchQuestion has 14+ unrelated callers; wrapping it would re-fire
// classification for every patch). This source-reading test enforces both
// halves of that decision.
//
// Test pattern mirrors HomeScreen.exploredAnchors-resync.test.mjs — slice the
// source to the override handler region, then assert positive and negative
// regex matches inside the slice.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ASK_PATH = resolve(here, '../../src/screens/AskScreen.tsx');
const QSVC_PATH = resolve(here, '../../src/services/question.service.ts');
const askSource = readFileSync(ASK_PATH, 'utf-8');
const qsvcSource = readFileSync(QSVC_PATH, 'utf-8');

// Slice the source to the handleQuestionOverride callback body. Start marker
// is the declaration; end marker is the next top-level `const ` inside the
// component (handleDeleteSession comes right after handleQuestionOverride at
// the time of writing). If the file structure changes, update the markers.
function getOverrideHandlerSlice() {
  const startMarker = 'const handleQuestionOverride';
  const startIdx = askSource.indexOf(startMarker);
  // End at the next sibling `const handleDeleteSession` (the callback that
  // currently follows handleQuestionOverride). Falling back to the next
  // top-level "\n  const " would over-capture if a future refactor moved
  // handleDeleteSession; pin to the specific name for stability.
  const endMarker = '\n  const handleDeleteSession';
  const endIdx = askSource.indexOf(endMarker, startIdx + startMarker.length);
  assert.ok(
    startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
    `Could not locate handleQuestionOverride slice in AskScreen.tsx. startIdx=${startIdx}, endIdx=${endIdx}. The file structure may have changed; update the markers.`,
  );
  return askSource.slice(startIdx, endIdx);
}

// Slice the patchQuestion method body in question.service.ts. The method is
// declared as `patchQuestion(questionId: string, patch: Partial<Question>): void {`
// and ends at the next `},` (object-literal method separator) at the same
// indentation.
function getPatchQuestionSlice() {
  const startMarker = 'patchQuestion(questionId: string';
  const startIdx = qsvcSource.indexOf(startMarker);
  // Find the next `\n  },\n` closing brace at the method-end indentation.
  // patchQuestion is the LAST method in the questionService object literal,
  // so its closer is `\n  },\n};\n` — match the `  },` line specifically.
  const endIdx = qsvcSource.indexOf('\n  },', startIdx);
  assert.ok(
    startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
    `Could not locate patchQuestion slice in question.service.ts. startIdx=${startIdx}, endIdx=${endIdx}.`,
  );
  return qsvcSource.slice(startIdx, endIdx);
}

describe('AskScreen handleQuestionOverride — D-06 override re-fire (Phase 47)', () => {
  it('1. handleQuestionOverride references classifyAndAnchorIncremental', () => {
    const slice = getOverrideHandlerSlice();
    assert.match(
      slice,
      /classifyAndAnchorIncremental\(/,
      'D-06 — handleQuestionOverride must call classifyAndAnchorIncremental after the flag flip so the question enters the mind map. See 47-RESEARCH.md §"D-06 Gap Closure".',
    );
  });

  it('2. The classifyAndAnchorIncremental call is fire-and-forget (`void` prefix + `.catch`)', () => {
    const slice = getOverrideHandlerSlice();
    assert.match(
      slice,
      /void\s+classifyAndAnchorIncremental\([\s\S]*?\)\.catch\(/,
      'D-06 — classifyAndAnchorIncremental must be void-fired with .catch — mirrors useQuestions.ts:373-375. Awaited call would block the toast and the user-perceived synchronous response.',
    );
  });

  it('3. The call has the isConfigured guard before it', () => {
    const slice = getOverrideHandlerSlice();
    assert.match(
      slice,
      /(?:settings\.llm\.isConfigured|isConfigured)/,
      'D-06 / Pitfall 4 — handleQuestionOverride must guard on settings.llm.isConfigured before firing classifyAndAnchorIncremental. Otherwise a fresh-install user with no API key gets a network error toast.',
    );
  });

  it('4. The call does NOT use await (would block the toast/synchronous UX)', () => {
    const slice = getOverrideHandlerSlice();
    const awaitMatch = slice.match(/await\s+classifyAndAnchorIncremental/);
    assert.ok(
      !awaitMatch,
      "D-06 — classifyAndAnchorIncremental must be fire-and-forget, not awaited. The user's button tap must return synchronously; classification runs in background.",
    );
  });

  it('5. NO eventBus.emit GRAPH_UPDATED in the override handler slice (commitClassificationResult emits it inside)', () => {
    const slice = getOverrideHandlerSlice();
    const emitMatch = slice.match(/eventBus\.emit\(\{\s*type:\s*['"]GRAPH_UPDATED/);
    assert.ok(
      !emitMatch,
      'CLAUDE.md "Event bus — unified GRAPH_UPDATED" — do NOT emit GRAPH_UPDATED here. commitClassificationResult inside canonical-knowledge.service.ts already emits it; double-fire would race subscribers.',
    );
  });

  it('6. patchQuestion (the persistence helper) has NO classifyAndAnchorIncremental call inside it', () => {
    const patchSlice = getPatchQuestionSlice();
    const patchSliceClassifyMatch = patchSlice.match(/classifyAndAnchorIncremental/);
    assert.ok(
      !patchSliceClassifyMatch,
      'PATTERNS.md non-modification — patchQuestion must remain pure persistence. The override re-fire is wired at AskScreen.handleQuestionOverride, NOT inside patchQuestion. patchQuestion has 14+ call sites; spurious fires unacceptable.',
    );
  });
});
