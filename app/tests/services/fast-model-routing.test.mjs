// Phase 55.1 GAP-E (BUGFIX-08) — fast-model routing + per-provider thinking-disable.
//
// The post-body lazy-load made users wait seconds for the main model to THINK before the
// body streamed into PostDetailScreen. GAP-E adds an optional low-latency generation model:
// when enabled+configured, the on-open one-shot generators (post body, news essay,
// post-context Q&A) stream from it with thinking/reasoning DISABLED; when unset, they fall
// back to the main `llm` with NO behavior change.
//
// This test executes resolveGenerationConfig directly (pure, React-free) and source-guards
// the provider body-builder thinking-disable plumbing (openAIStream reasoning_effort,
// geminiStream thinkingConfig forwarding, claudeStream no extended-thinking block).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { resolveGenerationConfig } from '../../src/services/generation-config.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LLM_PATH = resolve(__dirname, '../../src/providers/llm/index.ts');
const POST_ESSAY_PATH = resolve(__dirname, '../../src/services/post-essay.service.ts');
const POST_QA_PATH = resolve(__dirname, '../../src/services/post-context-qa.service.ts');
const SETTINGS_PATH = resolve(__dirname, '../../src/services/settings.service.ts');
const TYPES_PATH = resolve(__dirname, '../../src/types/index.ts');
const CFS_PATH = resolve(__dirname, '../../src/services/concept-feed.service.ts');

const llmSource = readFileSync(LLM_PATH, 'utf-8');
const postEssaySource = readFileSync(POST_ESSAY_PATH, 'utf-8');
const postQaSource = readFileSync(POST_QA_PATH, 'utf-8');
const settingsSource = readFileSync(SETTINGS_PATH, 'utf-8');
const typesSource = readFileSync(TYPES_PATH, 'utf-8');
const cfsSource = readFileSync(CFS_PATH, 'utf-8');

const mainLlm = { provider: 'openai', apiKey: 'main-key', baseUrl: '', model: 'gpt-4o', isConfigured: true };

describe('resolveGenerationConfig (Phase 55.1 GAP-E)', () => {
  it('returns the MAIN config + disableThinking:false when fastModel is unset', () => {
    const { config, disableThinking } = resolveGenerationConfig({ llm: mainLlm });
    assert.equal(config, mainLlm, 'must return the exact main llm config (no copy → byte-identical request)');
    assert.equal(disableThinking, false, 'thinking must NOT be disabled on the fallback path');
  });

  it('returns the MAIN config when fastModel exists but is DISABLED', () => {
    const fastModel = { enabled: false, provider: 'openai', apiKey: 'fast-key', baseUrl: '', model: 'gpt-4o-mini', isConfigured: true };
    const { config, disableThinking } = resolveGenerationConfig({ llm: mainLlm, fastModel });
    assert.equal(config.model, 'gpt-4o', 'disabled fastModel must fall back to main');
    assert.equal(disableThinking, false);
  });

  it('returns the MAIN config when fastModel is enabled but NOT configured', () => {
    const fastModel = { enabled: true, provider: 'openai', apiKey: '', baseUrl: '', model: 'gpt-4o-mini', isConfigured: false };
    const { config, disableThinking } = resolveGenerationConfig({ llm: mainLlm, fastModel });
    assert.equal(config.model, 'gpt-4o', 'enabled-but-unconfigured fastModel must fall back to main');
    assert.equal(disableThinking, false);
  });

  it('returns the FAST config + disableThinking:true when fastModel is enabled AND configured', () => {
    const fastModel = { enabled: true, provider: 'openai', apiKey: 'fast-key', baseUrl: '', model: 'gpt-4o-mini', isConfigured: true };
    const { config, disableThinking } = resolveGenerationConfig({ llm: mainLlm, fastModel });
    assert.equal(config.model, 'gpt-4o-mini', 'must route through the fast model');
    assert.equal(config.apiKey, 'fast-key', 'must use the fast model key (possibly a different provider/key)');
    assert.equal(disableThinking, true, 'thinking MUST be disabled on the fast path');
    assert.ok(!('enabled' in config), 'the `enabled` gate must be stripped before passing to chatStream (clean LLMConfig)');
  });

  it('treats a local/lmstudio fastModel with a baseUrl as configured (no key required)', () => {
    const fastModel = { enabled: true, provider: 'lmstudio', apiKey: '', baseUrl: 'http://localhost:1234', model: 'fast-local', isConfigured: false };
    const { config, disableThinking } = resolveGenerationConfig({ llm: mainLlm, fastModel });
    assert.equal(config.model, 'fast-local', 'local model needs only a baseUrl to be usable');
    assert.equal(disableThinking, true);
  });
});

describe('per-provider thinking-disable plumbing (source guards)', () => {
  it('openAIStream sends reasoning_effort:minimal ONLY when disableThinking + provider openai', () => {
    assert.ok(/reasoning_effort/.test(llmSource), 'providers/llm/index.ts must reference reasoning_effort');
    // The field must be gated on BOTH disableThinking and the openai provider.
    assert.ok(
      /disableThinking[\s\S]{0,120}provider\s*===\s*'openai'[\s\S]{0,80}reasoning_effort:\s*'minimal'/.test(llmSource),
      'reasoning_effort:minimal must be gated on options.disableThinking AND config.provider === openai',
    );
  });

  it('geminiStream forwards disableThinking into toGeminiPayload (thinkingBudget:0 on stream path)', () => {
    // toGeminiPayload accepts disableThinking → thinkingConfig.thinkingBudget:0; the STREAM path
    // must forward options.disableThinking (previously it dropped all options).
    assert.ok(/thinkingConfig/.test(llmSource), 'Gemini path must keep thinkingConfig.thinkingBudget plumbing');
    const streamIdx = llmSource.indexOf('streamGenerateContent');
    assert.ok(streamIdx >= 0, 'geminiStream must exist');
    const window = llmSource.slice(streamIdx, streamIdx + 600);
    assert.ok(
      /toGeminiPayload\([\s\S]*disableThinking/.test(window),
      'geminiStream must forward options.disableThinking into toGeminiPayload',
    );
  });

  it('claudeStream sends NO extended-thinking block (default; documented no-op)', () => {
    const claudeIdx = llmSource.indexOf('async function* claudeStream');
    assert.ok(claudeIdx >= 0, 'claudeStream must exist');
    const window = llmSource.slice(claudeIdx, claudeIdx + 900);
    // We never opt into Anthropic extended thinking — assert no `thinking:` block is sent.
    assert.ok(
      !/body:\s*JSON\.stringify\(\{[\s\S]*thinking:\s*\{/.test(window),
      'claudeStream must NOT send a `thinking: { ... }` extended-thinking block',
    );
  });
});

describe('fastModel type + default + routing wiring (source guards)', () => {
  it('AppSettings has an optional fastModel field + FastModelConfig type', () => {
    assert.ok(/fastModel\?:\s*FastModelConfig/.test(typesSource), 'AppSettings must declare fastModel?: FastModelConfig');
    assert.ok(/interface FastModelConfig extends LLMConfig/.test(typesSource), 'FastModelConfig must extend LLMConfig');
    assert.ok(/enabled:\s*boolean/.test(typesSource), 'FastModelConfig must have an enabled gate');
  });

  it('defaultSettings includes a disabled fastModel (so deepMerge defaults pre-feature configs)', () => {
    const idx = settingsSource.indexOf('fastModel:');
    assert.ok(idx >= 0, 'settings.service.ts defaultSettings must include a fastModel default');
    const window = settingsSource.slice(idx, idx + 200);
    assert.ok(/enabled:\s*false/.test(window), 'the default fastModel must be disabled');
  });

  it('on-open generators route through resolveGenerationConfig (post-essay + post-context-qa)', () => {
    assert.ok(/resolveGenerationConfig/.test(postEssaySource), 'post-essay.service.ts must use resolveGenerationConfig');
    assert.ok(/resolveGenerationConfig/.test(postQaSource), 'post-context-qa.service.ts must use resolveGenerationConfig');
  });

  it('does NOT modify concept-feed text-art (news bodyMarkdown defer + text-art budget intact)', () => {
    // Negative guard: this plan must not touch concept-feed's news creation branch.
    assert.ok(/bodyMarkdown:\s*''/.test(cfsSource), "concept-feed must keep news bodyMarkdown:'' (defer-to-streamer)");
    assert.ok(!/resolveGenerationConfig/.test(cfsSource), 'concept-feed.service.ts must NOT be routed through resolveGenerationConfig (separate text-art path)');
  });
});
