// Phase 55.1 BUGFIX-02 — persist-merge guard for text-art content.
//
// Root cause: `_persistStylesToCache` merged with `info.textArtContent ?? p.textArtContent`,
// which let a SHORTER (truncated/fragment) regeneration overwrite an already-good,
// non-empty `textArtContent`. After a provider switch to a Gemini thinking model + a
// locale change, the regenerated content was a starved fragment ("T" / "Is your") and
// the bare `??` happily replaced full sentences with it.
//
// Fix: a pure `mergeTextArtContent(existing, incoming)` that treats persisted content as
// immutable unless the incoming value is a genuine improvement — never overwrites a
// non-empty existing with an empty/rejected/shorter incoming.
//
// This file tests the CONTRACT of that merge (via a reference implementation matching
// the spec) AND source-guards that `_persistStylesToCache` actually routes through it
// (not the bare `?? p.textArtContent`). The helper is private to
// concept-feed.service.ts and the file imports browser-only modules, so we use the
// project's established source-reading pattern for the wiring guard.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CFS_PATH = resolve(__dirname, '../../src/services/concept-feed.service.ts');
const source = readFileSync(CFS_PATH, 'utf-8');

// Reference implementation of the merge contract. The production helper in
// concept-feed.service.ts MUST satisfy these same properties.
//   - incoming empty/undefined/rejected => keep existing
//   - incoming strictly shorter than a non-empty existing => keep existing
//   - incoming valid AND (existing empty OR incoming >= existing length) => take incoming
function mergeTextArtContentRef(existing, incoming) {
  const inc = (incoming ?? '').trim();
  const exi = (existing ?? '').trim();
  if (!inc) return existing;            // empty/undefined incoming → keep existing
  if (!exi) return incoming;            // existing empty → take valid incoming
  if (inc.length < exi.length) return existing; // shorter regen → keep existing
  return incoming;                      // genuine improvement → take incoming
}

describe('mergeTextArtContent contract (Phase 55.1 BUGFIX-02)', () => {
  it('keeps existing when incoming is empty', () => {
    assert.equal(mergeTextArtContentRef('Why World Models matter', ''), 'Why World Models matter');
  });

  it('keeps existing when incoming is undefined', () => {
    assert.equal(mergeTextArtContentRef('Why World Models matter', undefined), 'Why World Models matter');
  });

  it('keeps existing when incoming is a strictly-shorter fragment', () => {
    // "Is your" (7 chars) must not replace a full sentence.
    assert.equal(mergeTextArtContentRef('Is your brain lying to you about rereading?', 'Is your'), 'Is your brain lying to you about rereading?');
    assert.equal(mergeTextArtContentRef('RAG is dead. Long live agentic search.', 'T'), 'RAG is dead. Long live agentic search.');
  });

  it('takes incoming when existing is empty and incoming is valid', () => {
    assert.equal(mergeTextArtContentRef('', 'Transformers are already obsolete?'), 'Transformers are already obsolete?');
    assert.equal(mergeTextArtContentRef(undefined, 'Transformers are already obsolete?'), 'Transformers are already obsolete?');
  });

  it('takes incoming when it is a valid, non-shorter improvement', () => {
    assert.equal(mergeTextArtContentRef('Short one', 'A genuinely longer headline here'), 'A genuinely longer headline here');
  });
});

describe('_persistStylesToCache routes through mergeTextArtContent (source guard)', () => {
  it('declares a mergeTextArtContent helper', () => {
    assert.ok(
      /function\s+mergeTextArtContent\s*\(/.test(source),
      'concept-feed.service.ts must declare a pure `mergeTextArtContent(existing, incoming)` helper ' +
      'that never overwrites a non-empty textArtContent with an empty/shorter one.',
    );
  });

  it('_persistStylesToCache uses mergeTextArtContent, not the bare `?? p.textArtContent`', () => {
    const fnStart = source.indexOf('function _persistStylesToCache');
    assert.ok(fnStart >= 0, '_persistStylesToCache must exist');
    const after = source.slice(fnStart);
    const nextFn = after.slice(1).search(/\n(?:async )?function /);
    const body = nextFn >= 0 ? after.slice(0, nextFn + 1) : after;

    assert.ok(
      /mergeTextArtContent\s*\(/.test(body),
      '_persistStylesToCache must call mergeTextArtContent(...) when merging textArtContent ' +
      'so a shorter/empty regeneration cannot overwrite good content.',
    );
    assert.ok(
      !/info\.textArtContent\s*\?\?\s*p\.textArtContent/.test(body),
      '_persistStylesToCache must NOT use the bare `info.textArtContent ?? p.textArtContent` — ' +
      'that lets a shorter/empty regen replace good content (the BUGFIX-02 regression).',
    );
  });
});
