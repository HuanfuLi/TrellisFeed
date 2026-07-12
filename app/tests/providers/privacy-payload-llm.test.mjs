// Phase 53-02 PRIVACY-01 — LLM outbound payload privacy golden (3 cloud providers).
//
// Provider-bound LLM payload tests confirm saved/liked engagement data is
// excluded from outbound provider requests by default. This is the LLM half
// of the D-03 tests-and-structural-assertion enforcement — there is NO runtime
// scrubber; the contract is "private data is never interpolated into a provider
// request body in the first place," proven by seeding sentinels into all three
// private localStorage keys and asserting the captured outbound body excludes
// them, across openAI / claude / gemini cloud paths.
//
// Strategy: install an in-memory localStorage shim + a fetch capture shim, seed
// the private engagement key with a unique sentinel string shaped like real
// data, drive the leaf LLM chokepoint `chatCompletion` (non-stream, so the
// request body is the unit under test), and assert the JSON-stringified captured
// request body contains none of the sentinels. A positive capture assertion
// (the benign user content appears in the body) ensures the negative
// assertions cannot pass vacuously.
//
// fakeFetch json() UNION shape (plan-checker WARNING 1): all three provider
// readers must parse the response WITHOUT throwing after the body is captured —
//   openAICompletion  reads data.choices[0].message.content
//   claudeCompletion  reads data.content[0].text
//   geminiCompletion  reads data.candidates[0].content.parts[0].text
// One object satisfies all three, so a single stub serves every sub-test.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { makeMemoryLocalStorage } from '../helpers/memory-localstorage.mjs';

// ─── Sentinels (D-04 full field inventory) ──────────────────────────────────
const ENGAGEMENT_SENTINEL = 'SECRET-ENGAGEMENT-SENTINEL'; // trellis_engagement_v1

// ─── localStorage shim + seeded sentinels ───────────────────────────────────
// Install BEFORE the dynamic import of chatCompletion (Plan 53-01 ordering rule).
globalThis.localStorage = makeMemoryLocalStorage();

// trellis_engagement_v1 — { saved, liked, dismissed }.
globalThis.localStorage.setItem(
  'trellis_engagement_v1',
  JSON.stringify({
    saved: [ENGAGEMENT_SENTINEL],
    liked: [ENGAGEMENT_SENTINEL],
    dismissed: [],
  }),
);

// ─── fetch capture shim (multi-shape union response) ─────────────────────────
let captured;
const fakeFetch = async (_url, init) => {
  captured = JSON.parse(init.body);
  // The provider attaches a 60s timeout AbortSignal to fetch. Since this fake
  // fetch resolves synchronously, dispatch abort to trigger the provider's
  // timeout cleanup listener and keep the golden fast under node --test.
  init.signal?.dispatchEvent?.(new Event('abort'));
  return {
    ok: true,
    status: 200,
    async text() {
      return '';
    },
    // Union shape parseable by all three providers without throwing.
    async json() {
      return {
        choices: [{ message: { content: '' } }],          // openAI
        content: [{ text: '' }],                           // claude
        candidates: [{ content: { parts: [{ text: '' }] } }], // gemini
      };
    },
  };
};
globalThis.window = globalThis.window ?? {};
globalThis.window.fetch = fakeFetch;
globalThis.fetch = fakeFetch;

// Import AFTER all shims. Leaf provider entry point.
const { chatCompletion } = await import('../../src/providers/llm/index.ts');

// Representative messages — a system message + a benign user question. Built
// inline (no heavy prompt-bearing service import).
const USER_CONTENT = 'What is spaced repetition?';
const messages = [
  { role: 'system', content: 'You are a helpful learning assistant.' },
  { role: 'user', content: USER_CONTENT },
];

const providerConfigs = {
  openAI: {
    provider: 'openai',
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4o',
    isConfigured: true,
  },
  claude: {
    provider: 'claude',
    apiKey: 'test-key',
    model: 'claude-sonnet-4-6',
    isConfigured: true,
  },
  gemini: {
    provider: 'gemini',
    apiKey: 'test-key',
    model: 'gemini-3.1-flash',
    isConfigured: true,
  },
};

function assertNoLeak(providerName) {
  const body = JSON.stringify(captured);

  // Non-vacuous capture assertion — the benign user content must appear in the
  // outbound body, proving the request was captured and the sentinel-exclusion
  // assertions below are meaningful.
  assert.ok(
    body.includes(USER_CONTENT),
    `PRIVACY-01 [${providerName}]: benign user content must appear in the ` +
      `captured outbound body so sentinel-exclusion is non-vacuous. Body=${body}`,
  );

  assert.ok(
    !body.includes(ENGAGEMENT_SENTINEL),
    `PRIVACY-01 [${providerName}]: outbound LLM body leaked the ` +
      `engagement (saved/liked) sentinel. Body=${body}`,
  );
}

describe('PRIVACY-01: LLM outbound body excludes private user data', () => {
  test('openAI: outbound chat/completions body excludes private sentinels', async () => {
    captured = undefined;
    await chatCompletion(messages, providerConfigs.openAI);
    assertNoLeak('openAI');
  });

  test('claude: outbound /v1/messages body excludes private sentinels', async () => {
    captured = undefined;
    await chatCompletion(messages, providerConfigs.claude);
    assertNoLeak('claude');
  });

  test('gemini: outbound :generateContent body excludes private sentinels', async () => {
    captured = undefined;
    await chatCompletion(messages, providerConfigs.gemini);
    assertNoLeak('gemini');
  });

  test('gemini: fixed YouTube media uses the official fileData envelope and rejects arbitrary URLs', async () => {
    captured = undefined;
    const media = { kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ' };
    await chatCompletion(messages, providerConfigs.gemini, { media });
    assert.deepEqual(captured.contents[0].parts[0], { fileData: { fileUri: media.url } });
    await assert.rejects(
      chatCompletion(messages, providerConfigs.gemini, { media: { ...media, url: 'https://evil.test/watch?v=dQw4w9WgXcQ' } }),
      /canonical frozen YouTube source/,
    );
    await assert.rejects(chatCompletion(messages, providerConfigs.openAI, { media }), /requires Gemini/);
  });
});
