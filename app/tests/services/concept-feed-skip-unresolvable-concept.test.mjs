// 2026-05-12 — guard the video + news loops in concept-feed.service.ts against
// leaking internal anchor IDs into Tavily/YouTube queries and the user-visible
// sourceQuestionTitles chip when byId.get(a.conceptId) returns undefined.
//
// Operator report 2026-05-12: a feed tile shipped with the chip text
// "anchor-1776786217111-4-v9ty0" (raw anchor ID) and a "NIH-Funded ANCHOR
// Study Findings" headline — Tavily soft-matched on the "anchor-" prefix and
// returned a real-world ANCHOR study (anal cancer prevention) by coincidence.
// Root cause: `conceptName = concept?.title ?? concept?.content?.slice(0,50)
// ?? a.conceptId` collapsed to the raw conceptId when the anchor wasn't in the
// byId snapshot (e.g., pruned/deleted between assignment construction and
// generatePostBatch invocation).
//
// Pattern: pure regex over the live source. No render. Mirrors the rest of
// the Phase 39+ source-reading test discipline.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const src = readFileSync(
  path.join(appRoot, 'src/services/concept-feed.service.ts'),
  'utf8',
);

test('concept-feed: video loop bails when concept is unresolvable (no a.conceptId leak)', () => {
  // Scope to the video assignments loop.
  const startIdx = src.indexOf('for (const a of videoAssignments)');
  assert.ok(startIdx > 0, 'video assignment loop must exist');
  const endIdx = src.indexOf('for (const a of newsAssignments)', startIdx);
  assert.ok(endIdx > startIdx, 'news loop must follow video loop');
  const region = src.slice(startIdx, endIdx);

  assert.match(
    region,
    /if\s*\(\s*!concept\s*\)\s*continue\s*;/,
    'video loop must `if (!concept) continue;` so unresolvable anchors do not produce posts',
  );
  assert.doesNotMatch(
    region,
    /\?\?\s*a\.conceptId\b/,
    'video loop must NOT fall back to a.conceptId — that leaks internal anchor IDs into the YouTube search query and sourceQuestionTitles',
  );
});

test('concept-feed: news loop bails when concept is unresolvable (no a.conceptId leak)', () => {
  const startIdx = src.indexOf('for (const a of newsAssignments)');
  assert.ok(startIdx > 0, 'news assignment loop must exist');
  const region = src.slice(startIdx, startIdx + 2000);

  assert.match(
    region,
    /if\s*\(\s*!concept\s*\)\s*continue\s*;/,
    'news loop must `if (!concept) continue;` so unresolvable anchors do not trigger Tavily searches with raw IDs',
  );
  assert.doesNotMatch(
    region,
    /\?\?\s*a\.conceptId\b/,
    'news loop must NOT fall back to a.conceptId — that produced the 2026-05-12 "anchor-1776786217111-..." chip + NIH ANCHOR Study coincidence',
  );
});

test('InfoFlow chip filter: isLikelyInternalId rejects anchor-/post-/concept-/question- prefixes', () => {
  const infoFlow = readFileSync(path.join(appRoot, 'src/components/InfoFlow.tsx'), 'utf8');
  assert.match(
    infoFlow,
    /function\s+isLikelyInternalId\s*\(/,
    'InfoFlow.tsx must declare an isLikelyInternalId helper',
  );
  // Verify the regex covers the four known internal-ID prefixes.
  assert.match(
    infoFlow,
    /\/\^\(anchor\|post\|concept\|question\)-\/i/,
    'isLikelyInternalId regex must cover anchor-, post-, concept-, and question- prefixes (case-insensitive)',
  );
});

test('InfoFlow chip renderers filter sourceQuestionTitles through isLikelyInternalId', () => {
  const infoFlow = readFileSync(path.join(appRoot, 'src/components/InfoFlow.tsx'), 'utf8');
  // Both the news-card chip (1-item slice) and the standard chip block (2-item
  // slice) must run the filter so neither leaks an internal ID even if a
  // future regression at any upstream call site reintroduces the bug.
  //
  // CR-02 fix (Phase 51 code review) changed the filter callback signature:
  // - Old (regression-prone): .filter(t => !isLikelyInternalId(t))
  // - New (parallel-index-preserving): map to { title, originalIdx } pairs
  //   FIRST, then .filter(({ title }) => !isLikelyInternalId(title)). This
  //   keeps the pre-filter index across the filter so the post.sourceQuestionIds
  //   lookup parallels the unfiltered titles array. See 51-REVIEW.md CR-02.
  //
  // Accept either callback shape — what we're enforcing here is the
  // "isLikelyInternalId guard runs on each chip's title" invariant, not the
  // specific destructure form.
  const matches = infoFlow.match(/\.filter\((?:t\s*=>\s*!isLikelyInternalId\(t\)|\(\{\s*title\s*\}\)\s*=>\s*!isLikelyInternalId\(title\))\)/g) || [];
  assert.ok(
    matches.length >= 2,
    `expected ≥2 chip filters through isLikelyInternalId, found ${matches.length}`,
  );
});
