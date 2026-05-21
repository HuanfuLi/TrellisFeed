// Phase 55.1 BUGFIX-02 — Gemini text-art token budget source guard.
//
// Root cause: the text-art call used `maxTokens: 80` (concept-feed.service.ts:793),
// which becomes `generationConfig.maxOutputTokens: 80` in toGeminiPayload. On Gemini
// 2.5/3 "thinking" models, internal reasoning tokens count against maxOutputTokens, so
// an 80-token budget is consumed by thinking and the visible text comes back empty or
// truncated (finishReason: MAX_TOKENS) — collapsing the card to "T" / "Is your".
//
// Fix (BOTH defenses):
//   (a) raise the text-art call budget off 80 (>= 256 — A1 conservative 512), and
//   (b) add a thinkingConfig path so short Gemini calls don't spend the budget on thinking.
//
// This source guard locks the fix so a future refactor can't regress to a bare
// `maxOutputTokens: 80`. It passes if EITHER defense is present and verifiable.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LLM_PATH = resolve(__dirname, '../../src/providers/llm/index.ts');
const CFS_PATH = resolve(__dirname, '../../src/services/concept-feed.service.ts');
const llmSource = readFileSync(LLM_PATH, 'utf-8');
const cfsSource = readFileSync(CFS_PATH, 'utf-8');

describe('Gemini text-art token budget (Phase 55.1 BUGFIX-02)', () => {
  it('text-art call no longer uses maxTokens: 80', () => {
    assert.ok(
      !/maxTokens:\s*80\b/.test(cfsSource),
      'concept-feed.service.ts must NOT use `maxTokens: 80` for text-art — Gemini thinking ' +
      'tokens starve an 80-token budget. Raise it (A1: 512).',
    );
  });

  it('text-art call uses a budget >= 256', () => {
    // Find the serviceName: 'text-art' options object and read its maxTokens.
    const idx = cfsSource.indexOf("serviceName: 'text-art'");
    assert.ok(idx >= 0, "text-art chatCompletion call (serviceName: 'text-art') must exist");
    // Look in a window around the call for the maxTokens value.
    const window = cfsSource.slice(Math.max(0, idx - 200), idx + 200);
    const m = window.match(/maxTokens:\s*(\d+)/);
    assert.ok(m, 'the text-art call options must specify a numeric maxTokens');
    const budget = Number(m[1]);
    assert.ok(
      budget >= 256,
      `text-art maxTokens must be >= 256 to survive Gemini thinking overhead (A1: 512). Got ${budget}.`,
    );
  });

  it('toGeminiPayload supports disabling thinking via thinkingConfig.thinkingBudget', () => {
    // The Gemini path EITHER raises the budget (asserted above) OR adds a thinkingConfig
    // field. We require thinkingConfig as the structural belt-and-suspenders defense, scoped
    // so it only fires for short non-reasoning calls (does not break main chat/classification).
    assert.ok(
      /thinkingConfig/.test(llmSource),
      'providers/llm/index.ts must reference `thinkingConfig` in the Gemini payload so short ' +
      'text-art calls do not spend their budget on thinking tokens.',
    );
    assert.ok(
      /thinkingBudget/.test(llmSource),
      'the thinkingConfig must use the `thinkingBudget` field (Gemini v1beta generationConfig.' +
      'thinkingConfig.thinkingBudget) to disable/cap thinking for short calls.',
    );
  });

  it('thinkingConfig sits inside generationConfig in toGeminiPayload', () => {
    const fnStart = llmSource.indexOf('function toGeminiPayload');
    assert.ok(fnStart >= 0, 'toGeminiPayload must exist');
    const after = llmSource.slice(fnStart);
    const nextFn = after.slice(1).search(/\n(?:async )?function /);
    const body = nextFn >= 0 ? after.slice(0, nextFn + 1) : after;
    assert.ok(
      /generationConfig/.test(body) && /thinkingConfig/.test(body),
      'toGeminiPayload must place thinkingConfig inside generationConfig.',
    );
  });
});
