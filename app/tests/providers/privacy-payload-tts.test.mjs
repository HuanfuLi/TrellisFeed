// Phase 53-02 PRIVACY-01 — TTS outbound payload privacy golden.
//
// Success Criterion 1 (53-VALIDATION.md): "Provider-bound LLM and TTS payload
// tests confirm tags, saved/liked/history, and graph correction logs are
// excluded from outbound provider requests by default." This is the TTS half
// of the D-03 tests-and-structural-assertion enforcement — there is NO runtime
// scrubber; the contract is "private data is never interpolated into a provider
// request body in the first place," proven by seeding sentinels into all three
// private localStorage keys and asserting the captured outbound body excludes
// them.
//
// Strategy (53-RESEARCH.md "Exact outbound payload shapes"): install the Plan
// 53-01 in-memory localStorage shim + a fetch capture shim, seed the three
// private services' keys with unique sentinel strings shaped like real data,
// drive the leaf TTS chokepoint `synthesize`, and assert the JSON-stringified
// captured request body contains none of the sentinels. A positive capture
// assertion (`captured.input` equals the synthesized text) ensures the negative
// assertions cannot pass vacuously.

import assert from 'node:assert/strict';
import test from 'node:test';
import i18next from 'i18next';
import { bindI18nLeaf } from '../../src/lib/i18n-leaf.ts';
import { makeMemoryLocalStorage } from '../helpers/memory-localstorage.mjs';

// ─── Sentinels (D-04 full field inventory) ──────────────────────────────────
// One per private surface so a leak can be attributed to its source.
const TAG_SENTINEL = 'SECRET-TAG-SENTINEL';               // trellis_collections_v1
const ENGAGEMENT_SENTINEL = 'SECRET-ENGAGEMENT-SENTINEL'; // trellis_engagement_v1
const JOURNAL_SENTINEL = 'SECRET-JOURNAL-SENTINEL';       // trellis_graph_edit_log

// ─── i18next preamble ────────────────────────────────────────────────────────
// synthesize()'s resolveVoice() reads the current locale via the i18n-leaf
// shim, so the singleton must be initialized + the leaf bound BEFORE the
// dynamic import of the TTS provider (copied verbatim from tts-locale.test.mjs).
await i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: { translation: {} },
    zh: { translation: {} },
    es: { translation: {} },
    ja: { translation: {} },
  },
});
bindI18nLeaf(i18next.t.bind(i18next), () => i18next.language);

// ─── localStorage shim + seeded sentinels ───────────────────────────────────
// Install BEFORE the dynamic import of synthesize (Plan 53-01 ordering rule).
globalThis.localStorage = makeMemoryLocalStorage();

// trellis_collections_v1 — shape: { collections: [{ id, name, postIds, ... }] }.
// Seed the sentinel as a collection NAME (the tag/bookmark label a user types).
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

// trellis_engagement_v1 — shape: { saved, liked, dismissed, savedPodcasts }.
// Seed the sentinel as a saved/liked post id (the engagement signal).
globalThis.localStorage.setItem(
  'trellis_engagement_v1',
  JSON.stringify({
    saved: [ENGAGEMENT_SENTINEL],
    liked: [ENGAGEMENT_SENTINEL],
    dismissed: [],
    savedPodcasts: [],
  }),
);

// trellis_graph_edit_log — shape: GraphEditLogEntry[]. Seed the sentinel as a
// renamed node title inside a before/after snapshot (the graph correction log).
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

// ─── fetch capture shim ──────────────────────────────────────────────────────
// synthesize() uses window.fetch; capture the parsed request body so we can
// assert against the outbound payload without making a network call.
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
    async blob() {
      return { type: 'audio/mpeg' };
    },
    async text() {
      return '';
    },
  };
};
globalThis.window = globalThis.window ?? {};
globalThis.window.fetch = fakeFetch;
globalThis.fetch = fakeFetch;
globalThis.URL = globalThis.URL ?? {};
globalThis.URL.createObjectURL = () => 'blob://stub';

// Import AFTER all shims. Leaf module — no JSON/heavy transitive imports.
const { synthesize } = await import('../../src/providers/tts/index.ts');

const baseTtsConfig = {
  provider: 'openai',
  apiKey: 'test-key',
  baseUrl: 'https://api.openai.com',
  voice: 'alloy',
  speed: 1.0,
  isConfigured: true,
};

test('PRIVACY-01: TTS outbound body excludes private user data', async () => {
  const TEXT = 'Recap of spaced repetition.';
  captured = undefined;
  await synthesize(TEXT, baseTtsConfig);

  // Non-vacuous capture assertion — proves the fetch body was actually
  // captured and the field we expect (`input`) carries the synthesized text.
  assert.equal(
    captured.input,
    TEXT,
    'PRIVACY-01: capture shim must record the outbound `input` field so the ' +
      'sentinel-exclusion assertions below are meaningful (non-vacuous).',
  );

  const body = JSON.stringify(captured);

  assert.ok(
    !body.includes(TAG_SENTINEL),
    `PRIVACY-01: outbound TTS body leaked the collections/tags sentinel into ` +
      `the request (field: input/voice/model). Body=${body}`,
  );
  assert.ok(
    !body.includes(ENGAGEMENT_SENTINEL),
    `PRIVACY-01: outbound TTS body leaked the engagement (saved/liked) ` +
      `sentinel into the request. Body=${body}`,
  );
  assert.ok(
    !body.includes(JOURNAL_SENTINEL),
    `PRIVACY-01: outbound TTS body leaked the graph-edit-log sentinel into ` +
      `the request. Body=${body}`,
  );
});
