// Phase 42 plan 42-08 — Heal CTA renders anchor-scoped empty state, not today's queue.
//
// Locks the fix for Gap 2 (UAT-4): ReviewScreen.tsx:299 used to be
//   `const isFiltered = Boolean(filteredItems && filteredItems.length > 0);`
// which collapsed "filter requested but zero matches" into "no filter
// requested" and fell back to today's full SM-2 due queue.
//
// The fix: `const isFiltered = filteredItems !== null;` — distinguishes the
// two states, and the done-or-empty branch renders an anchor-scoped empty
// message ("No flashcards yet for {{title}} ...") when the filter yields zero.
//
// Pattern: Pattern A (counterweight + positive presence + negative grep on
// ReviewScreen.tsx) plus a parsed-JSON sanity check across all 4 locale bundles.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REVIEW_SCREEN_PATH = resolve(__dirname, '../../src/screens/ReviewScreen.tsx');
const source = readFileSync(REVIEW_SCREEN_PATH, 'utf-8');

const LOCALE_PATHS = ['en', 'zh', 'es', 'ja'].map((code) => ({
  code,
  path: resolve(__dirname, `../../src/locales/${code}.json`),
}));

describe('ReviewScreen anchor-scoped empty state (Phase 42 Gap 2 / UAT-4)', () => {
  it('still references anchorReview from location.state (counterweight — proves test reads the right file)', () => {
    assert.ok(
      /anchorReview/.test(source),
      'ReviewScreen.tsx must still reference anchorReview from location.state — the heal-CTA filter consumer.',
    );
  });

  it('uses `filteredItems !== null` to distinguish "no filter" from "filter matched zero"', () => {
    assert.ok(
      /filteredItems\s*!==\s*null/.test(source),
      'ReviewScreen.tsx must use `filteredItems !== null` (the new shape) — distinguishes "no filter requested" from "filter requested but zero matches" so the heal CTA does NOT silently fall back to today\'s SM-2 queue.',
    );
  });

  it('does NOT use the fail-open `Boolean(filteredItems && filteredItems.length > 0)` form', () => {
    // Match the exact pre-fix form plus whitespace variants.
    assert.ok(
      !/Boolean\s*\(\s*filteredItems\s*&&\s*filteredItems\.length\s*>\s*0\s*\)/.test(source),
      'ReviewScreen.tsx must NOT use Boolean(filteredItems && filteredItems.length > 0) — that form is fail-open: an anchor with zero matching flashcards collapses to "no filter" and dumps the user into today\'s full queue (Gap 2 / UAT-4 root cause). Use `filteredItems !== null` instead.',
    );
  });

  it('references review.done.anchorEmptyHeading and anchorEmptyBody for the empty-state branch', () => {
    assert.ok(
      /review\.done\.anchorEmptyHeading/.test(source),
      'ReviewScreen.tsx must call t("review.done.anchorEmptyHeading") in the done-or-empty branch — anchor-scoped empty state heading.',
    );
    assert.ok(
      /review\.done\.anchorEmptyBody/.test(source),
      'ReviewScreen.tsx must call t("review.done.anchorEmptyBody", { title: ... }) in the done-or-empty branch — anchor-scoped empty state body using the title from nav state.',
    );
  });
});

describe('Locale bundles carry review.done.anchorEmpty* keys (Phase 42 Gap 2 i18n)', () => {
  for (const { code, path } of LOCALE_PATHS) {
    it(`${code}.json has non-empty review.done.anchorEmptyHeading + anchorEmptyBody`, () => {
      const bundle = JSON.parse(readFileSync(path, 'utf-8'));
      const heading = bundle?.review?.done?.anchorEmptyHeading;
      const body = bundle?.review?.done?.anchorEmptyBody;
      assert.ok(
        typeof heading === 'string' && heading.trim().length > 0,
        `locales/${code}.json must define review.done.anchorEmptyHeading as a non-empty string — anchor-scoped empty state heading for the heal CTA.`,
      );
      assert.ok(
        typeof body === 'string' && body.trim().length > 0,
        `locales/${code}.json must define review.done.anchorEmptyBody as a non-empty string — anchor-scoped empty state body, must contain {{title}} interpolation.`,
      );
      assert.ok(
        body.includes('{{title}}'),
        `locales/${code}.json review.done.anchorEmptyBody must contain the {{title}} interpolation marker — uses the title from nav state.`,
      );
    });
  }
});
