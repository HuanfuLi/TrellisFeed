// Phase 53 PRIVACY-01 (2026-05-20) — provider chokepoint + prompt-call-site
// privacy structural assertion.
//
// Trellis is local-first and privacy-preserving. The three "private user-data"
// services — engagement.service (likes/saves/dismissals), collection.service
// (user-curated collections), and graph-edit-journal (the user's manual graph
// edits) — must NEVER have their contents interpolated into an outbound LLM/TTS
// provider payload. If a future change wires any of these into a prompt-bearing
// call-site, the next provider request would leak private data off-device.
//
// This guard is a PURE source-byte read (readFileSync + regex over the source
// text — no `import` of the source modules), modelled on the source-assertion
// seam in tests/providers/llm-bracketing.test.mjs:214 and the negative-invariant
// pattern of tests/components/InfoFlow.video-tap-emit.test.mjs.
//
// D-03: enforcement is tests + structural source-read assertion, not a runtime
//       scrubber.
// D-04: the structural assertion protects the field inventory — collections,
//       engagement, graph-edit-journal.
// D-07: the graph-edit-journal is readable ONLY by reorganizeMindmap (scoped
//       exception); any other reader fails the structural assertion.
//
// See .planning/phases/53-engagement-guardrails-provider-privacy/53-03-PLAN.md.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/** Read a source file relative to app/src as raw bytes (UTF-8). Never imports. */
function readSrc(rel) {
  return readFileSync(resolve(here, '../../src', rel), 'utf-8');
}

// Private user-data service identifiers. `collection.service` and
// `engagement.service` match their import specifiers (`./collection.service.ts`,
// `./engagement.service.ts`); `graph-edit-journal` matches both
// `graph-edit-journal.service.ts` and `graph-edit-journal-phrasing.ts`.
const PRIVATE_SERVICE_RE = /engagement\.service|collection\.service|graph-edit-journal/;

// Provider chokepoints — the funnels every outbound provider payload flows
// through. None may import or reference ANY private user-data service.
const CHOKEPOINTS = [
  'providers/llm/index.ts',
  'providers/llm/locale-directive.ts',
  'providers/llm/user-content-bracketing.ts',
  'providers/tts/index.ts',
];

// Prompt-bearing call-sites — services/state that build LLM prompts. The
// graph-edit-journal is allowlisted to canonical-knowledge.service.ts ONLY
// (the reorganizeMindmap exception, D-07); every OTHER call-site below must be
// free of any journal reference.
const JOURNAL_READERS_ALLOWED = ['services/canonical-knowledge.service.ts'];
const OTHER_PROMPT_CALL_SITES = [
  'state/useQuestions.ts',
  'services/podcast.service.ts',
  'services/post-essay.service.ts',
  'services/flashcard.service.ts',
  'services/post-context-qa.service.ts',
  'services/concept-feed.service.ts',
];

describe('PRIVACY-01 — provider chokepoints free of private user-data services (Sub-test A)', () => {
  for (const rel of CHOKEPOINTS) {
    it(`${rel} does NOT import a private user-data service`, () => {
      const src = readSrc(rel);
      assert.ok(
        !PRIVATE_SERVICE_RE.test(src),
        `${rel} must not import a private user-data service (PRIVACY-01). ` +
          `It is a provider chokepoint — every outbound LLM/TTS payload flows through here. ` +
          `Importing engagement.service / collection.service / graph-edit-journal at this layer ` +
          `is a direct path to leaking the user's likes, saved collections, or manual graph edits ` +
          `off-device on the next provider request.`,
      );
    });
  }
});

describe('PRIVACY-01 / D-07 — graph-edit-journal scoped exception (Sub-test B)', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // D-07 SCOPED EXCEPTION (verbatim rationale):
  //   reorganizeMindmap intentionally injects graph-edit-journal entries into the
  //   reorg prompt — Phase 48 GRAPH-04 — to stop the LLM undoing manual edits;
  //   this is the ONLY allowlisted reader; any other reader is a leak.
  //
  // canonical-knowledge.service.ts is therefore PERMITTED to reference the
  // journal. No other prompt-bearing call-site may. The positive co-occurrence
  // assertion below keeps the exception anchored to reorganizeMindmap so that a
  // future relocation of the journal read into a different function in the same
  // file is at least surfaced for review.
  // ───────────────────────────────────────────────────────────────────────────

  it('canonical-knowledge.service.ts IS the allowlisted journal reader (D-07) — must NOT be failed', () => {
    const src = readSrc('services/canonical-knowledge.service.ts');
    // Soft positive assertion: the exception must stay real (the file actually
    // references the journal) AND anchored to reorganizeMindmap. If a refactor
    // moves the journal read elsewhere, this flags it for review rather than
    // silently widening the exception.
    assert.ok(
      /graphEditJournal/.test(src),
      'canonical-knowledge.service.ts must reference graphEditJournal — it is the documented ' +
        'D-07 reorg exception (Phase 48 GRAPH-04). If this assertion fails the exception is no ' +
        'longer real and the rest of this sub-test should be re-evaluated.',
    );
    assert.ok(
      /reorganizeMindmap/.test(src),
      'canonical-knowledge.service.ts must contain reorganizeMindmap — the journal read is ' +
        'allowlisted ONLY because it lives inside reorganizeMindmap (D-07). Co-occurrence keeps ' +
        'the exception anchored to the reorg function; a future move into a different function ' +
        'should be reviewed.',
    );
  });

  for (const rel of OTHER_PROMPT_CALL_SITES) {
    it(`${rel} does NOT read the graph-edit-journal (only reorganizeMindmap may — D-07)`, () => {
      const src = readSrc(rel);
      assert.ok(
        !/graph-edit-journal/.test(src),
        `${rel} must not read the graph-edit-journal (PRIVACY-01). ` +
          `D-07 allowlists exactly ${JOURNAL_READERS_ALLOWED.join(', ')} (reorganizeMindmap, ` +
          `Phase 48 GRAPH-04 — preserves the user's manual graph edits across a reorg). ` +
          `Any OTHER call-site reading the journal injects the user's private edit history into ` +
          `an outbound prompt — a leak.`,
      );
    });
  }
});

describe('PRIVACY-01 — collections/engagement leak shapes at prompt call-sites (Sub-test C)', () => {
  // Every prompt-bearing call-site is banned from referencing collection.service.
  const ALL_PROMPT_CALL_SITES = [...JOURNAL_READERS_ALLOWED, ...OTHER_PROMPT_CALL_SITES];
  for (const rel of ALL_PROMPT_CALL_SITES) {
    it(`${rel} does NOT read collection.service`, () => {
      const src = readSrc(rel);
      assert.ok(
        !/collection\.service/.test(src),
        `${rel} must not read collection.service (PRIVACY-01). User-curated collections are ` +
          `private and must never be interpolated into an outbound prompt.`,
      );
    });
  }

  // The five non-feed call-sites must not touch engagement.service at all.
  for (const rel of OTHER_PROMPT_CALL_SITES.filter((r) => r !== 'services/concept-feed.service.ts')) {
    it(`${rel} does NOT read engagement.service`, () => {
      const src = readSrc(rel);
      assert.ok(
        !/engagement\.service/.test(src),
        `${rel} must not read engagement.service (PRIVACY-01). The user's likes/saves/dismissals ` +
          `are private and must never reach an outbound prompt.`,
      );
    });
  }

  // concept-feed.service.ts LEGITIMATELY imports engagement.service for
  // getDismissedAnchorIds() — a list of anchor IDs used to FILTER the feed, never
  // interpolated into a prompt. We therefore do NOT blanket-ban engagement import
  // here; instead we ban the narrow LEAK shape: reading liked/saved CONTENT.
  it('concept-feed.service.ts uses only the getDismissedAnchorIds ID-filter, NOT liked/saved content', () => {
    const src = readSrc('services/concept-feed.service.ts');
    assert.ok(
      !/getLikedPosts|getSavedPosts|likedPosts/.test(src),
      `concept-feed.service.ts may import engagement.service for getDismissedAnchorIds() (an ` +
        `anchor-ID filter, not prompt content), but must NOT read liked/saved post CONTENT ` +
        `(getLikedPosts / getSavedPosts / likedPosts) — that content could be interpolated into ` +
        `a generated post prompt and leak private engagement signals (PRIVACY-01).`,
    );
  });
});
