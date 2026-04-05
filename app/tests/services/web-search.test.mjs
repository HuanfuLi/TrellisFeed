/**
 * Unit tests for web search service.
 *
 * Tests citation extraction (pure function) and
 * webSearch NOT_CONFIGURED guard (mock-based).
 *
 * Run: npx tsx --import ./app/tests/services/_capacitor-mock-loader.mjs \
 *        --test app/tests/services/web-search.test.mjs
 */

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// ─── Mock localStorage ────────────────────────────────────────────────────────

class MockStorage {
  constructor() {
    this.data = {};
  }
  setItem(key, value) {
    this.data[key] = String(value);
  }
  getItem(key) {
    return this.data[key] ?? null;
  }
  removeItem(key) {
    delete this.data[key];
  }
  clear() {
    this.data = {};
  }
}

globalThis.localStorage = new MockStorage();

// ─── Dynamic import after mocks are set ───────────────────────────────────────

const { extractCitations, webSearch } = await import('../../src/services/web-search.service.ts');

// ─── extractCitations tests ───────────────────────────────────────────────────

describe('extractCitations', () => {
  it('parses a single citation with markdown link format', () => {
    const input = 'Answer with [1] ref.\n\nSources:\n[1] [Title One](https://example.com/1)';
    const result = extractCitations(input);
    assert.equal(result.body, 'Answer with [1] ref.');
    assert.equal(result.sources.length, 1);
    assert.equal(result.sources[0].index, 1);
    assert.equal(result.sources[0].title, 'Title One');
    assert.equal(result.sources[0].url, 'https://example.com/1');
  });

  it('returns empty sources when no Sources section exists', () => {
    const result = extractCitations('No sources here');
    assert.equal(result.body, 'No sources here');
    assert.deepEqual(result.sources, []);
  });

  it('parses multiple citations correctly', () => {
    const input = [
      'Text with [1] and [2] and [3] refs.',
      '',
      'Sources:',
      '[1] [First Source](https://example.com/1)',
      '[2] [Second Source](https://example.com/2)',
      '[3] [Third Source](https://example.com/3)',
    ].join('\n');
    const result = extractCitations(input);
    assert.equal(result.sources.length, 3);
    assert.equal(result.sources[0].index, 1);
    assert.equal(result.sources[0].title, 'First Source');
    assert.equal(result.sources[1].index, 2);
    assert.equal(result.sources[1].title, 'Second Source');
    assert.equal(result.sources[2].index, 3);
    assert.equal(result.sources[2].url, 'https://example.com/3');
  });

  it('handles "References:" header same as "Sources:"', () => {
    const input = 'Answer.\n\nReferences:\n[1] [Ref Title](https://ref.com/a)';
    const result = extractCitations(input);
    assert.equal(result.body, 'Answer.');
    assert.equal(result.sources.length, 1);
    assert.equal(result.sources[0].title, 'Ref Title');
    assert.equal(result.sources[0].url, 'https://ref.com/a');
  });

  it('trims trailing whitespace from body text', () => {
    const input = 'Body text with trailing space.   \n\nSources:\n[1] [S](https://s.com)';
    const result = extractCitations(input);
    assert.equal(result.body, 'Body text with trailing space.');
  });

  it('parses citation index numbers as integers', () => {
    const input = 'Text.\n\nSources:\n[12] [Big Index](https://big.com)';
    const result = extractCitations(input);
    assert.equal(typeof result.sources[0].index, 'number');
    assert.equal(result.sources[0].index, 12);
  });
});

// ─── webSearch NOT_CONFIGURED guard tests ─────────────────────────────────────

describe('webSearch', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns NOT_CONFIGURED error when API key is empty string', async () => {
    // Settings default has tavilyApiKey: '' (empty)
    const result = await webSearch('test query');
    assert.equal(result.success, false);
    assert.equal(result.error?.code, 'NOT_CONFIGURED');
  });

  it('returns NOT_CONFIGURED error when webSearch settings key is missing', async () => {
    // Store settings without webSearch key
    localStorage.setItem('echolearn_settings', JSON.stringify({ llm: {} }));
    const result = await webSearch('test query');
    assert.equal(result.success, false);
    assert.equal(result.error?.code, 'NOT_CONFIGURED');
    localStorage.removeItem('echolearn_settings');
  });
});
