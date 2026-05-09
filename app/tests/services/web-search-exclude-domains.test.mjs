/**
 * Phase 41 Plan 41-01 Task 1 — WebSearchOptions.excludeDomains threading test.
 *
 * Covers SC-2(c): WebSearchOptions.excludeDomains threads to Tavily exclude_domains
 * body field, conditionally (only when array has length).
 *
 * Test approach:
 *   - Source-reading: assert WebSearchOptions interface has the new field AND
 *     the body builder has the conditional set (cheap, deterministic, no
 *     Capacitor mock needed).
 *   - Behavioral: swap globalThis.fetch, set tavilyApiKey via settings store,
 *     call webSearch, capture the request body, assert exclude_domains presence
 *     conditional on the option being passed.
 *
 * The behavioral half runs the non-native path in webSearch (Capacitor mock
 * registers isNativePlatform: false → goes through fetch). We import after
 * the fetch swap so the closure captures our spy.
 */

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';

// ─── Source-reading SRC blob (read once before any imports) ──────────────────

const SRC = readFileSync(
  new URL('../../src/services/web-search.service.ts', import.meta.url),
  'utf8',
);

// ─── localStorage polyfill ────────────────────────────────────────────────────

class MockStorage {
  constructor() { this.data = {}; }
  setItem(key, value) { this.data[key] = String(value); }
  getItem(key) { return this.data[key] ?? null; }
  removeItem(key) { delete this.data[key]; }
  clear() { this.data = {}; }
}
globalThis.localStorage = new MockStorage();

// ─── fetch capture ────────────────────────────────────────────────────────────

let lastFetchBody = null;
let lastFetchUrl = null;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  lastFetchUrl = url;
  lastFetchBody = init?.body ? JSON.parse(init.body) : null;
  return {
    ok: true,
    status: 200,
    async text() { return ''; },
    async json() { return { results: [], images: [], query: 'test' }; },
  };
};

// Dynamic import AFTER fetch swap so the module-level reference (if any)
// would capture our spy. (web-search.service.ts uses the global fetch by
// reference at call time; no module-level binding.)
const { webSearch } = await import('../../src/services/web-search.service.ts');

function setTavilyKey(key) {
  // settingsService reads from localStorage 'trellis_settings'.
  localStorage.setItem('trellis_settings', JSON.stringify({
    llm: {},
    webSearch: { tavilyApiKey: key },
  }));
}

// ─── Source-reading assertions ────────────────────────────────────────────────

describe('web-search.service.ts — Phase 41 SC-2(c) source-reading', () => {
  it('WebSearchOptions interface includes excludeDomains?: string[]', () => {
    assert.match(
      SRC,
      /excludeDomains\?:\s*string\[\]/,
      'WebSearchOptions must declare excludeDomains as optional string array',
    );
  });

  it('webSearch body builder conditionally sets exclude_domains', () => {
    assert.match(
      SRC,
      /if \(options\?\.excludeDomains\?\.length\)/,
      'must guard exclude_domains assignment on .length truthy',
    );
    assert.match(
      SRC,
      /body\.exclude_domains = options\.excludeDomains/,
      'must assign options.excludeDomains to body.exclude_domains',
    );
  });

  it('regression guard — max_results body field unchanged', () => {
    // Counterweight per plan acceptance criterion: ensure other body fields
    // weren't accidentally touched while adding exclude_domains.
    assert.match(
      SRC,
      /max_results: options\?\.maxResults \?\? 5/,
      'max_results body assignment must remain intact',
    );
  });
});

// ─── Behavioral assertions (fetch body capture) ──────────────────────────────

describe('webSearch — Phase 41 SC-2(c) behavioral', () => {
  beforeEach(() => {
    lastFetchBody = null;
    lastFetchUrl = null;
    setTavilyKey('test-key');
  });

  it('threads excludeDomains into Tavily request body as exclude_domains', async () => {
    const result = await webSearch('hello', { excludeDomains: ['nature.com', 'sciencedirect.com'] });
    assert.equal(result.success, true, 'webSearch should succeed with mocked fetch');
    assert.equal(lastFetchUrl, 'https://api.tavily.com/search');
    assert.ok(lastFetchBody, 'request body must have been captured');
    assert.deepEqual(
      lastFetchBody.exclude_domains,
      ['nature.com', 'sciencedirect.com'],
      'exclude_domains must thread verbatim',
    );
  });

  it('omits exclude_domains entirely when option is undefined', async () => {
    const result = await webSearch('hello');
    assert.equal(result.success, true);
    assert.ok(lastFetchBody, 'request body must have been captured');
    assert.equal(
      Object.prototype.hasOwnProperty.call(lastFetchBody, 'exclude_domains'),
      false,
      'exclude_domains key must be absent when not requested (Pitfall 1 — minimal payload)',
    );
  });

  it('omits exclude_domains entirely when option is empty array', async () => {
    const result = await webSearch('hello', { excludeDomains: [] });
    assert.equal(result.success, true);
    assert.ok(lastFetchBody, 'request body must have been captured');
    assert.equal(
      Object.prototype.hasOwnProperty.call(lastFetchBody, 'exclude_domains'),
      false,
      'exclude_domains key must be absent for empty array (Pitfall 1 — minimal payload)',
    );
  });

  it('preserves other body fields (query, max_results, search_depth, topic) when excludeDomains is set', async () => {
    await webSearch('spaced repetition', { excludeDomains: ['nature.com'], maxResults: 3, topic: 'general' });
    assert.equal(lastFetchBody.query, 'spaced repetition');
    assert.equal(lastFetchBody.max_results, 3);
    assert.equal(lastFetchBody.topic, 'general');
    assert.equal(lastFetchBody.search_depth, 'basic');
    assert.equal(lastFetchBody.include_answer, false);
    assert.equal(lastFetchBody.include_raw_content, false);
  });
});

// Restore fetch on process exit so other suites in same node --test invocation
// (parallel runs) are not corrupted. node --test isolates files in workers, but
// being explicit costs nothing.
process.on('exit', () => {
  globalThis.fetch = originalFetch;
});
