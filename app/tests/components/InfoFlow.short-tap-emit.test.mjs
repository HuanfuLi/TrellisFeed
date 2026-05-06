// Phase 36 GAP-C regression guard: ensures InfoFlow.tsx fires CONCEPT_EXPLORED
// on short tap-to-play. Shorts never navigate to PostDetailScreen (interactive=false
// at line 295), so the existing detectors A/B/C/D never run for them.
// See .planning/debug/video-completion-signal-missing.md.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INFOFLOW_PATH = resolve(__dirname, '../../src/components/InfoFlow.tsx');
const source = readFileSync(INFOFLOW_PATH, 'utf-8');

describe('InfoFlow short tap-to-play emit (Phase 36 GAP-C)', () => {
  it('contains Phase 36 GAP-C comment in the short tap branch', () => {
    assert.ok(
      source.includes('Phase 36 GAP-C'),
      'InfoFlow.tsx must reference Phase 36 GAP-C in the short tap-to-play handler comment.',
    );
  });

  it('fires markExplored exactly once (only in the short branch, not the video branch)', () => {
    const matches = source.match(/dailyReadService\.markExplored/g) || [];
    assert.equal(
      matches.length,
      1,
      `InfoFlow.tsx must call dailyReadService.markExplored exactly once — in the short tap branch. ` +
      `Found ${matches.length} occurrences. Video posts route via onOpen → PostDetailScreen → Detector D, ` +
      `so they should NOT have a duplicate emit here (would double-fire).`,
    );
  });

  it("emits CONCEPT_EXPLORED event exactly once via eventBus", () => {
    const matches = source.match(/type:\s*['"]CONCEPT_EXPLORED['"]/g) || [];
    assert.equal(
      matches.length,
      1,
      'InfoFlow.tsx must emit CONCEPT_EXPLORED exactly once (in the short tap-to-play handler). ' +
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
