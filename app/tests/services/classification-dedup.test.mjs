/**
 * Phase 33 UAT-4 classification-dedup regression suite (2026-04-20).
 *
 * Guards the structural anti-duplication invariants in canonical-knowledge.service.ts:
 *   1. Anchor lookup normalizes BOTH sides of the comparison (pre-b2061554 un-normalized
 *      stored titles still match the clean LLM-produced anchorName).
 *   2. buildStepPrompt bakes in reuse bias + level-specific hierarchy hints so the LLM
 *      prefers existing options over minting new ones at each step.
 *   3. PIPELINE_SYSTEM_PROMPT lists branch examples + the rule that branches are BROAD
 *      disciplines, not sub-fields or methodologies.
 *   4. preCheckAnchorMatch + ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD exist — the embedding
 *      pre-check is the structural fix for cross-cutting concepts that the tree descent
 *      cannot handle by design.
 *
 * Source-reading asserts. Simulating the full LLM pipeline requires stubbing chatCompletion
 * + embedText + settingsService, which is expensive for what we actually want to guard: the
 * code shape that makes duplication impossible.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../../src/services/canonical-knowledge.service.ts', import.meta.url),
  'utf-8',
);

describe('classification dedup invariants', () => {
  it('anchor lookup normalizes q.title before comparing to result.anchorName', () => {
    // Locate the `existingByName` lookup for anchors.
    const idx = source.indexOf('Check if an anchor with the same name already exists under the same cluster');
    assert.ok(idx !== -1, 'canonical-knowledge.service.ts should contain the anchor-dedup lookup block');
    const block = source.slice(idx, idx + 900);

    // The lookup MUST call normalizeAnchorName on the stored q.title side,
    // otherwise pre-normalization anchors never match.
    assert.ok(
      /normalizeAnchorName\(q\.title\s*\|\|\s*['"]{2}\)/.test(block),
      'anchor lookup must call normalizeAnchorName(q.title || "") on the RIGHT side of the comparison — previously only result.anchorName was normalized',
    );
  });

  it('step 1 coerces LLM-NEW branch to an existing selection when the name matches case-insensitively', () => {
    const idx = source.indexOf('Phase 33 UAT-4 fix: coerce LLM-NEW branch');
    assert.ok(idx !== -1, 'canonical-knowledge.service.ts should contain the branch-NEW coercion guard');
    const block = source.slice(idx, idx + 800);

    // Must locate by case-insensitive + trim match against the existing branches list.
    assert.ok(
      /branches\.findIndex\(b\s*=>\s*b\.trim\(\)\.toLowerCase\(\)\s*===\s*proposed\)/.test(block),
      'branch NEW coercion must match via trim().toLowerCase() — prevents "Psychology" vs "psychology" duplicates',
    );
  });

  it('step 2 coerces LLM-NEW cluster to an existing selection when the name matches case-insensitively', () => {
    const idx = source.indexOf('Phase 33 UAT-4 fix: same case/whitespace coercion for clusters');
    assert.ok(idx !== -1, 'canonical-knowledge.service.ts should contain the cluster-NEW coercion guard');
    const block = source.slice(idx, idx + 800);

    assert.ok(
      /clusters\.findIndex\(c\s*=>\s*c\.trim\(\)\.toLowerCase\(\)\s*===\s*proposedCluster\)/.test(block),
      'cluster NEW coercion must match via trim().toLowerCase() — same rationale as branch',
    );
  });

  it('preCheckAnchorMatch is exported with a conservative similarity threshold constant', () => {
    assert.ok(
      source.includes('export async function preCheckAnchorMatch'),
      'canonical-knowledge.service.ts must export preCheckAnchorMatch — embedding-based anchor match before tree descent',
    );

    // Threshold must be declared and conservative (≥ 0.75). Using 0.5 would false-positive.
    const thresholdMatch = source.match(/ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD\s*=\s*([\d.]+)/);
    assert.ok(thresholdMatch, 'ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD must be defined as a module constant');
    const threshold = parseFloat(thresholdMatch[1]);
    assert.ok(
      threshold >= 0.75 && threshold <= 0.95,
      `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD must be conservative — got ${threshold}, expected in [0.75, 0.95]. A value below 0.75 would false-positive and merge unrelated concepts; above 0.95 would miss legitimate near-duplicates.`,
    );
  });

  it('ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD source value is within the [0.78, 0.85] empirical dedup band (Phase 55 D-05/D-06)', () => {
    // Phase 55: the anchor-dedup knob (debug) is clamped to [0.78, 0.85] in
    // canonical-knowledge.service.ts:preCheckAnchorMatch, and the hardcoded default
    // constant must itself sit inside that empirical band (CLAUDE.md §"Classification
    // dedup — embedding pre-check": lower = missed dedups, higher = wrong merges). This
    // is a tighter assertion than the conservative [0.75, 0.95] check above — it locks
    // the constant to the exact band the debug clamp enforces so the two cannot drift.
    const thresholdMatch = source.match(/ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD\s*=\s*([\d.]+)/);
    assert.ok(thresholdMatch, 'ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD must be defined as a module constant');
    const threshold = parseFloat(thresholdMatch[1]);
    assert.ok(
      threshold >= 0.78 && threshold <= 0.85,
      `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD must be inside the empirical [0.78, 0.85] dedup band — got ${threshold}. This band matches the debug-knob clamp (Math.min(0.85, Math.max(0.78, ...))) in preCheckAnchorMatch.`,
    );
  });

  it('preCheckAnchorMatch clamps the anchor-dedup debug knob to [0.78, 0.85] (Phase 55 D-06)', () => {
    const fnIdx = source.indexOf('export async function preCheckAnchorMatch');
    assert.ok(fnIdx !== -1, 'preCheckAnchorMatch must exist');
    const fnBody = source.slice(fnIdx, fnIdx + 1600);
    assert.ok(
      /Math\.min\(0\.85,\s*Math\.max\(0\.78,/.test(fnBody),
      'preCheckAnchorMatch must clamp the debug anchorDedupThreshold to Math.min(0.85, Math.max(0.78, ...)) — the operator cannot widen the dedup band from the debug panel',
    );
  });

  it('classifyAndAnchorIncremental runs the pre-check before step 1', () => {
    const fnIdx = source.indexOf('export async function classifyAndAnchorIncremental');
    assert.ok(fnIdx !== -1, 'canonical-knowledge.service.ts should contain classifyAndAnchorIncremental');
    const fnBody = source.slice(fnIdx, fnIdx + 3000);

    // preCheckAnchorMatch must be invoked BEFORE buildStepPrompt for branch.
    const preCheckIdx = fnBody.indexOf('preCheckAnchorMatch(');
    const step1PromptIdx = fnBody.indexOf("buildStepPrompt('branch'");

    assert.ok(preCheckIdx !== -1, 'classifyAndAnchorIncremental must call preCheckAnchorMatch');
    assert.ok(step1PromptIdx !== -1, "classifyAndAnchorIncremental must call buildStepPrompt('branch', ...)");
    assert.ok(
      preCheckIdx < step1PromptIdx,
      'preCheckAnchorMatch must run BEFORE the step 1 branch prompt — otherwise we pay LLM tokens for a match the cosine check would have caught for free',
    );
  });

  it('pre-check hit path reuses existing anchor labels (no tree descent)', () => {
    const fnIdx = source.indexOf('export async function classifyAndAnchorIncremental');
    const fnBody = source.slice(fnIdx, fnIdx + 2000);

    // On pre-check hit, we must construct a ClassificationResult from the matched
    // anchor's own labels (branchLabel/clusterLabel/title), commit, and return.
    assert.ok(
      /existing\.branchLabel/.test(fnBody) && /existing\.clusterLabel/.test(fnBody),
      'pre-check hit path must adopt the matched anchor\'s existing.branchLabel + existing.clusterLabel — this is the whole point of the fix (cross-cutting concepts keep their original home)',
    );
    assert.ok(
      /anchorId:\s*existing\.id/.test(fnBody),
      'pre-check hit path must set anchorId to existing.id so commitClassificationResult reuses the anchor rather than creating a new one',
    );
  });
});

describe('classification prompt strengthening', () => {
  it('PIPELINE_SYSTEM_PROMPT lists broad discipline examples and the no-sub-field rule', () => {
    const idx = source.indexOf('PIPELINE_SYSTEM_PROMPT');
    assert.ok(idx !== -1, 'PIPELINE_SYSTEM_PROMPT must exist');
    const block = source.slice(idx, idx + 2000);

    // Must enumerate at least 6 broad disciplines as examples.
    const disciplines = ['Psychology', 'Biology', 'Computer Science', 'Mathematics', 'Physics', 'Philosophy', 'Economics', 'History', 'Linguistics'];
    const present = disciplines.filter(d => block.includes(d));
    assert.ok(
      present.length >= 6,
      `PIPELINE_SYSTEM_PROMPT must list at least 6 broad-discipline examples (Psychology/Biology/CS/Math/Physics/Philosophy/Economics/History/Linguistics). Found ${present.length}: ${present.join(', ')}`,
    );

    // Must explicitly warn against narrow sub-fields being treated as branches.
    assert.ok(
      /Educational Psychology|Cognitive Science|Learning Techniques|Educational Technology/.test(block),
      'PIPELINE_SYSTEM_PROMPT must name the actual sub-fields that regressed into separate branches (Educational Psychology, Cognitive Science, Learning Techniques, Educational Technology) so the LLM learns the rule from concrete examples',
    );

    // Must state reuse bias at the system level.
    assert.ok(
      /STRONGLY prefer REUSING|STRONGLY prefer selecting/i.test(block),
      'PIPELINE_SYSTEM_PROMPT must contain strong reuse-bias language',
    );
  });

  it('buildStepPrompt includes level-specific hints for all three levels', () => {
    const fnIdx = source.indexOf('export function buildStepPrompt');
    assert.ok(fnIdx !== -1, 'buildStepPrompt must exist');
    const fnBody = source.slice(fnIdx, fnIdx + 2500);

    // Branch hint: broad discipline examples + warning against sub-fields.
    assert.ok(
      /BRANCH\s*=\s*a broad academic discipline/.test(fnBody),
      'buildStepPrompt branch hint must define BRANCH as a broad academic discipline',
    );

    // Cluster hint: broader-than-anchor + not-identical-to-anchor + no generic words.
    assert.ok(
      /CLUSTER\s*=/.test(fnBody) && /BROADER than the anchor/i.test(fnBody),
      'buildStepPrompt cluster hint must state cluster is BROADER than anchor',
    );

    // Anchor hint: 1-3 word concept noun, not a question.
    assert.ok(
      /ANCHOR\s*=.*1-3 word concept noun/i.test(fnBody),
      'buildStepPrompt anchor hint must require 1-3 word concept noun phrase',
    );

    // Reuse bias applies to every level.
    assert.ok(
      /STRONGLY prefer selecting an existing option/.test(fnBody),
      'buildStepPrompt must include reuse-bias language applicable to every step',
    );
  });
});
