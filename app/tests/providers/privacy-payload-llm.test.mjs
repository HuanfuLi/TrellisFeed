// Phase 53-02 PRIVACY-01 — LLM outbound payload privacy golden (3 cloud providers).
//
// Success Criterion 1 (53-VALIDATION.md): "Provider-bound LLM and TTS payload
// tests confirm tags, saved/liked/history, and graph correction logs are
// excluded from outbound provider requests by default." This is the LLM half
// of the D-03 tests-and-structural-assertion enforcement — there is NO runtime
// scrubber; the contract is "private data is never interpolated into a provider
// request body in the first place," proven by seeding sentinels into all three
// private localStorage keys and asserting the captured outbound body excludes
// them, across openAI / claude / gemini cloud paths.
//
// Strategy (53-RESEARCH.md "Exact outbound payload shapes"): install the Plan
// 53-01 in-memory localStorage shim + a fetch capture shim, seed the three
// private services' keys with unique sentinel strings shaped like real data,
// drive the leaf LLM chokepoint `chatCompletion` (non-stream, so the request
// body is the unit under test), and assert the JSON-stringified captured
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
const TAG_SENTINEL = 'SECRET-TAG-SENTINEL';               // trellis_collections_v1
const ENGAGEMENT_SENTINEL = 'SECRET-ENGAGEMENT-SENTINEL'; // trellis_engagement_v1
const JOURNAL_SENTINEL = 'SECRET-JOURNAL-SENTINEL';       // trellis_graph_edit_log

// ─── localStorage shim + seeded sentinels ───────────────────────────────────
// Install BEFORE the dynamic import of chatCompletion (Plan 53-01 ordering rule).
globalThis.localStorage = makeMemoryLocalStorage();

// trellis_collections_v1 — { collections: [{ id, name, postIds, ... }] }.
globalThis.localStorage.setItem(
  'trellis_collections_v1',
  JSON.stringify({
    collections: [
      {
        id: 'col-1',
        name: TAG_SENTINEL,
        postIds: ['post-1'],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  }),
);

// trellis_engagement_v1 — { saved, liked, dismissed, savedPodcasts }.
globalThis.localStorage.setItem(
  'trellis_engagement_v1',
  JSON.stringify({
    saved: [ENGAGEMENT_SENTINEL],
    liked: [ENGAGEMENT_SENTINEL],
    dismissed: [],
    savedPodcasts: [],
  }),
);

// trellis_graph_edit_log — GraphEditLogEntry[] (rename before/after snapshots).
globalThis.localStorage.setItem(
  'trellis_graph_edit_log',
  JSON.stringify([
    {
      id: 'log-1',
      ts: 1,
      cmd: 'rename',
      before: { title: JOURNAL_SENTINEL },
      after: { title: JOURNAL_SENTINEL + '-renamed' },
    },
  ]),
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
    !body.includes(TAG_SENTINEL),
    `PRIVACY-01 [${providerName}]: outbound LLM body leaked the ` +
      `collections/tags sentinel. Body=${body}`,
  );
  assert.ok(
    !body.includes(ENGAGEMENT_SENTINEL),
    `PRIVACY-01 [${providerName}]: outbound LLM body leaked the ` +
      `engagement (saved/liked) sentinel. Body=${body}`,
  );
  assert.ok(
    !body.includes(JOURNAL_SENTINEL),
    `PRIVACY-01 [${providerName}]: outbound LLM body leaked the ` +
      `graph-edit-log sentinel. Body=${body}`,
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
});
