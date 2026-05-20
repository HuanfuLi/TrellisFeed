// Phase 52 GAP-5 — Per-provider API-key persistence in SettingsAIScreen.
//
// Two layers, mirroring the project test pattern (readFileSync + regex on the
// live source; see app/tests/screens/PodcastScreen.options.test.mjs):
//   1. Source-read invariants: the LLM + embedding provider onChange stash the
//      current key under the old provider and restore the new provider's saved
//      key AFTER the defaults spread (so defaults[p].apiKey:'' is overridden).
//      effectiveTtsApiKey must remain present and unchanged.
//   2. Pure-logic round-trip: replicate the restore math and prove a key
//      survives switch-away-and-back, independent of React.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREEN_PATH = resolve(__dirname, '../../src/screens/settings/SettingsAIScreen.tsx');
const source = readFileSync(SCREEN_PATH, 'utf-8');

describe('SettingsAIScreen provider-key persistence — source invariants (Phase 52 GAP-5)', () => {
  it('LLM provider onChange stashes the current key under the old provider', () => {
    assert.match(
      source,
      /\[llm\.provider\]\s*:\s*llm\.apiKey/,
      'LLM provider onChange must stash llm.apiKey under [llm.provider] before switching',
    );
  });

  it('LLM provider onChange restores via apiKeys with apiKey overridden AFTER the defaults spread', () => {
    assert.match(
      source,
      /\.\.\.defaults\[p\],\s*apiKey:/,
      'apiKey must be set AFTER ...defaults[p] so the blank from defaults is overridden',
    );
    assert.match(
      source,
      /apiKeys:\s*savedKeys/,
      'LLM next-object must persist the savedKeys map under apiKeys',
    );
  });

  it('LLM apiKey TextInput onChange remembers the key under the current provider', () => {
    assert.match(
      source,
      /\[prev\.provider\]\s*:\s*v/,
      'apiKey TextInput onChange must write the entered value under [prev.provider] in apiKeys',
    );
  });

  it('embedding provider onChange also references apiKeys', () => {
    assert.match(
      source,
      /\[embedding\.provider\]\s*:\s*embedding\.apiKey/,
      'embedding provider onChange must stash embedding.apiKey under [embedding.provider]',
    );
  });

  it('NEGATIVE: effectiveTtsApiKey is present and unchanged (truth #4)', () => {
    assert.match(
      source,
      /const effectiveTtsApiKey = tts\.apiKey \|\| \(tts\.provider === 'openai'/,
      'effectiveTtsApiKey fallback must remain intact',
    );
  });
});

// Pure-logic restore math — the actual behavior, independent of React.
function applySwitch(state, newProvider) {
  const saved = { ...(state.apiKeys ?? {}), [state.provider]: state.apiKey ?? '' };
  return { ...state, provider: newProvider, apiKey: saved[newProvider] ?? '', apiKeys: saved };
}

describe('SettingsAIScreen provider-key persistence — pure-logic round-trip (Phase 52 GAP-5)', () => {
  it('key restores on switch-away-and-back', () => {
    // Start: openai with key sk-A.
    let state = { provider: 'openai', apiKey: 'sk-A', isConfigured: true };

    // Switch to claude — A's key is stashed, claude has no saved key yet.
    state = applySwitch(state, 'claude');
    assert.equal(state.provider, 'claude');
    assert.equal(state.apiKey, '', 'claude has no saved key → blank');
    assert.equal(state.apiKeys.openai, 'sk-A', 'openai key stashed in the map');

    // Enter a claude key.
    state = { ...state, apiKey: 'sk-B', apiKeys: { ...state.apiKeys, claude: 'sk-B' } };

    // Switch back to openai — A's key restored, B stashed.
    state = applySwitch(state, 'openai');
    assert.equal(state.provider, 'openai');
    assert.equal(state.apiKey, 'sk-A', 'openai key restored on switch-back');
    assert.equal(state.apiKeys.claude, 'sk-B', 'claude key stashed for later restore');
  });

  it('first-ever switch from a pristine (no apiKeys) state does not throw', () => {
    const state = { provider: 'openai', apiKey: 'sk-A', isConfigured: true }; // apiKeys undefined
    const next = applySwitch(state, 'gemini');
    assert.equal(next.apiKey, '');
    assert.equal(next.apiKeys.openai, 'sk-A');
  });
});
