// Phase 36 GAP-C regression guard: ensures InfoFlow.tsx fires CONCEPT_EXPLORED
// on video thumbnail tap-to-play (inline play). Phase 38 (TECHDEBT-06) removed the
// 'short' post type entirely; the GAP-C emit migrated from the short-card onClick
// into the video-card thumbnail onClick. Hybrid interaction (D-02b): thumbnail tap
// = inline play + emit; title/teaser tap = navigate to PostDetailScreen (Detectors
// A/B/C/D still cover deep engagement after navigation).
// See .planning/debug/video-completion-signal-missing.md
// and .planning/phases/38-v1-4-carry-over-cleanup/38-CONTEXT.md (D-02b).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INFOFLOW_PATH = resolve(__dirname, '../../src/components/InfoFlow.tsx');
const source = readFileSync(INFOFLOW_PATH, 'utf-8');

describe('InfoFlow video tap-to-play emit (Phase 36 GAP-C, generalized in Phase 38)', () => {
  it('contains Phase 36 GAP-C comment in the video thumbnail tap branch', () => {
    assert.ok(
      source.includes('Phase 36 GAP-C'),
      'InfoFlow.tsx must reference Phase 36 GAP-C in the video thumbnail tap-to-play handler comment (generalized in Phase 38).',
    );
  });

  it('fires markExplored exactly once (in the video thumbnail tap branch — no double-emit)', () => {
    const matches = source.match(/dailyReadService\.markExplored/g) || [];
    assert.equal(
      matches.length,
      1,
      `InfoFlow.tsx must call dailyReadService.markExplored exactly once — in the video thumbnail tap-to-play handler. ` +
      `Found ${matches.length} occurrences. Adding a second emit at the card-level onClick (which navigates to PostDetailScreen) ` +
      `would double-fire (idempotent via dailyReadService.isExplored, but unnecessary work + confusing semantics). ` +
      `Phase 38 generalization preserved single-emit semantic from Phase 36 GAP-C.`,
    );
  });

  it("emits CONCEPT_EXPLORED event exactly once via eventBus", () => {
    const matches = source.match(/type:\s*['"]CONCEPT_EXPLORED['"]/g) || [];
    assert.equal(
      matches.length,
      1,
      'InfoFlow.tsx must emit CONCEPT_EXPLORED exactly once (in the video thumbnail tap-to-play handler). ' +
      'Reuse the existing event type — do NOT introduce a new event (CLAUDE.md best practice rule 6).',
    );
  });

  it('imports the required services and event bus', () => {
    assert.ok(
      source.includes("from '../services/daily-read.service'"),
      'InfoFlow.tsx must import dailyReadService and getAnchorIdForPost from daily-read.service.',
    );
    assert.ok(
      source.includes("from '../services/question.service'"),
      'InfoFlow.tsx must import questionService to build the byId map for getAnchorIdForPost.',
    );
    assert.ok(
      source.includes("from '../lib/event-bus'"),
      'InfoFlow.tsx must import eventBus to emit CONCEPT_EXPLORED.',
    );
  });
});
