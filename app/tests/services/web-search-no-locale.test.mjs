import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// D-15 NEGATIVE TEST: web-search.service.ts must NEVER pass locale info to Tavily.
//
// Approach: static-source scan (not runtime). The runtime path would require
// importing web-search.service.ts, which on Node 25 trips the pre-existing
// extension-less `.ts` import chain (see deferred-items.md); the static scan
// is strictly stronger anyway — it catches any NEW locale reference added to
// the file, regardless of whether runtime coverage would reach that branch.
//
// If any of the patterns below ever start appearing in web-search.service.ts,
// this test fails loudly before the PR can merge.

const here = dirname(fileURLToPath(import.meta.url));
const servicePath = resolve(here, '../../src/services/web-search.service.ts');
const source = readFileSync(servicePath, 'utf8');

// These substrings indicate locale pass-through to the Tavily request.
// Any presence → D-15 violation.
const FORBIDDEN_SUBSTRINGS = [
  "from '../locales'",
  'from "../locales"',
  "from '../locales/",
  "from '../../locales'",
  'Simplified Chinese',
  'Spanish',
  'Japanese',
  'LOCALE_NAMES',
  'SupportedLocale',
  'i18next',
  'i18n.language',
  'detectInitialLocale',
  'normalizeLocale',
];

// Regex-level guards — any body/url key that looks like a locale param.
const FORBIDDEN_PATTERNS = [
  /["']hl["']\s*:/,
  /["']regionCode["']\s*:/,
  /["']relevanceLanguage["']\s*:/,
  /["']locale["']\s*:/,
  /["']language["']\s*:/,
  /["']lang["']\s*:/,
];

test('web-search.service.ts contains no locale imports or literals (D-15)', () => {
  for (const needle of FORBIDDEN_SUBSTRINGS) {
    assert.ok(
      !source.includes(needle),
      `web-search.service.ts must not contain "${needle}" (D-15 forbids locale pass-through to Tavily).`,
    );
  }
});

test('web-search.service.ts contains no locale-shaped body keys (D-15)', () => {
  for (const pattern of FORBIDDEN_PATTERNS) {
    assert.ok(
      !pattern.test(source),
      `web-search.service.ts must not contain key pattern ${pattern} (D-15 forbids locale pass-through to Tavily).`,
    );
  }
});

test('web-search.service.ts sends topic general or news (baseline sanity)', () => {
  // Positive guard: ensure the file at least still points at Tavily with
  // topic=general/news — confirms we are testing the right file, not an
  // empty stub.
  assert.ok(
    source.includes('api.tavily.com'),
    'sanity: web-search.service.ts should still target api.tavily.com',
  );
  assert.ok(
    /topic\??:\s*(options\?\.topic\s*\?\?\s*)?['"](general|news)['"]/.test(source),
    'sanity: topic should default to general or news',
  );
});
