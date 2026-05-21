// Phase 42 UAT-6 (3B, 2026-05-09) — text-art tightener regression guard.
//
// `tightenTextArtContent` is private to concept-feed.service.ts. We test by
// reading the source and asserting:
//   - the helper exists with the expected name + signature
//   - the LLM prompt asserts "EXACTLY ONE sentence (≤ 80 characters)"
//   - the fallback path uses `teaser.hook` not `teaser.preview` (preview is
//     multi-sentence and was the primary cause of the long text-art tiles
//     reported in operator screenshot 2026-05-09)
//
// We don't import the function directly because the file imports many
// browser-only modules that don't load under bare node:test. Source-reading
// keeps this test fast and deterministic, matching the project's existing
// MasonryFeed.layout.test.mjs pattern.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CFS_PATH = resolve(__dirname, '../../src/services/concept-feed.service.ts');
const source = readFileSync(CFS_PATH, 'utf-8');

describe('text-art content tightener (Phase 42 UAT-6, 3B)', () => {
  it('declares the tightenTextArtContent helper', () => {
    assert.ok(
      /function\s+tightenTextArtContent\s*\(\s*raw\s*:\s*string\s*\)/.test(source),
      'concept-feed.service.ts must declare `function tightenTextArtContent(raw: string): string | null`. ' +
      'This is the post-LLM validator that strips trailing extra sentences and truncates ≤ 80 chars.',
    );
  });

  it('LLM prompt requires EXACTLY ONE sentence ≤ 80 characters', () => {
    assert.ok(
      /EXACTLY ONE sentence \(≤ 80 characters\)/.test(source),
      'concept-feed.service.ts text-art prompt must include the exact rule line ' +
      '"EXACTLY ONE sentence (≤ 80 characters)". Operator 2026-05-09: text-art was wrapping ' +
      '4+ lines in half-width masonry tiles ("Why the Smell of Safety Makes AI Unsafe").',
    );
  });

  it('fallback path uses teaser.hook (not teaser.preview which is multi-sentence)', () => {
    // Match the specific fallback-construction line. After 3B, the FIRST `const fallback`
    // assignment in the file must read from p.teaser.hook, not p.teaser.preview.
    // Other occurrences of teaser.preview elsewhere in concept-feed.service.ts (e.g.,
    // image-prompt building, news essay extraction) are legitimately different code paths.
    const fallbackMatch = source.match(/const fallback = p\.teaser\.[a-z]+/);
    assert.ok(fallbackMatch, 'concept-feed.service.ts text-art fallback must construct a `const fallback` from p.teaser.*');
    assert.ok(
      /p\.teaser\.hook/.test(fallbackMatch[0]),
      `text-art fallback must use p.teaser.hook (got: ${fallbackMatch[0]}). ` +
      `p.teaser.preview is the multi-sentence summary and produced the over-long text-art tiles ` +
      `reported in operator screenshot 2026-05-09.`,
    );
    assert.ok(
      !/p\.teaser\.preview/.test(fallbackMatch[0]),
      `text-art fallback must NOT reference p.teaser.preview (got: ${fallbackMatch[0]}). ` +
      `Use p.teaser.hook (single-sentence by construction).`,
    );
  });

  it('runs the tightener on both LLM responses AND the fallback path', () => {
    const callCount = (source.match(/tightenTextArtContent\(/g) || []).length;
    assert.ok(
      callCount >= 2,
      `tightenTextArtContent must be called at least twice (once on LLM response, once on the ` +
      `fallback construction; helper definition itself doesn't count). Found ${callCount} call(s). ` +
      `Without the fallback-side call, multi-sentence hook strings still bypass the contract.`,
    );
  });
});

describe('text-art tightener reject-empty/fragment gate (Phase 55.1 BUGFIX-02)', () => {
  // Root cause (BUGFIX-02): a Gemini thinking model + locale switch starved the
  // 80-token budget, so the LLM returned a truncated fragment ("T", "Is your")
  // that the tightener happily persisted, collapsing the card. The fix adds a
  // reject branch so a too-short / non-sentence fragment returns null and the
  // call site falls back to teaser.hook || title instead of persisting garbage.
  //
  // Source-reading guard (helper is private to concept-feed.service.ts): assert
  // the tightener delegates its fragment-reject decision to the pure, CJK-aware
  // `isUnusableTextArtFragment` predicate and returns null when it fires. The
  // predicate's behavior (CJK kept, "T"/"Is your" rejected) is covered by the
  // EXECUTING test in `text-art-fragment.test.mjs` — the original inline
  // `!/\s/ && length < 8` gate was a CJK-locale regression (CR-01). The gate
  // applies to textArtContent ONLY — never bodyMarkdown.

  it('tightenTextArtContent delegates the fragment-reject gate to isUnusableTextArtFragment and returns null', () => {
    // Extract the body of tightenTextArtContent so we don't false-match a reject
    // branch from some other helper.
    const fnStart = source.indexOf('function tightenTextArtContent');
    assert.ok(fnStart >= 0, 'tightenTextArtContent must exist');
    // Body runs until the next top-level `async function` / `function` decl.
    const after = source.slice(fnStart + 'function tightenTextArtContent'.length);
    const nextFn = after.search(/\n(?:async )?function /);
    const body = nextFn >= 0 ? after.slice(0, nextFn) : after;

    // The reject gate must call the CJK-aware predicate, then return null.
    assert.ok(
      /if\s*\(\s*isUnusableTextArtFragment\(/.test(body),
      'tightenTextArtContent must gate on `isUnusableTextArtFragment(...)` (CJK-aware, ' +
      'catches single-token "T" and dangling "Is your") rather than an inline ' +
      '`!/\\s/ && length < 8` check, which discarded valid short zh/ja headlines (CR-01). ' +
      'See text-art-fragment.test.mjs for the executing behavior coverage.',
    );
    assert.ok(
      /isUnusableTextArtFragment\([^)]*\)\s*\)\s*return null/.test(body),
      'the reject branch must `return null` so the call site uses the teaser.hook || title fallback.',
    );
    // And the module must import the predicate.
    assert.ok(
      /import\s*\{[^}]*isUnusableTextArtFragment[^}]*\}\s*from\s*['"]\.\/text-art-fragment\.ts['"]/.test(source),
      'concept-feed.service.ts must import isUnusableTextArtFragment from ./text-art-fragment.ts.',
    );
  });

  it('reject gate is scoped to textArtContent only — does NOT touch bodyMarkdown', () => {
    // Negative invariant: the tightener body must not reference bodyMarkdown.
    const fnStart = source.indexOf('function tightenTextArtContent');
    const after = source.slice(fnStart + 'function tightenTextArtContent'.length);
    const nextFn = after.search(/\n(?:async )?function /);
    const body = nextFn >= 0 ? after.slice(0, nextFn) : after;
    assert.ok(
      !/bodyMarkdown/.test(body),
      'tightenTextArtContent must never reference bodyMarkdown — the news defer-to-streamer ' +
      'design (bodyMarkdown: "") is untouched by the text-art reject gate (CLAUDE.md News pipeline).',
    );
  });
});
