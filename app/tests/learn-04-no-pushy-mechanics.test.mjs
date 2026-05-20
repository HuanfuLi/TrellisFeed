// Phase 53 LEARN-04 (rescoped 2026-05-20) — non-pushy engagement guard.
//
// Trellis is reward-based, not mandate-based, and is NEVER pushy. The operator
// rejected Phase 53's original LEARN-01/02/03 premise on 2026-05-20: reviews are
// reward-based, not mandated; there are NO stop cues, daily goals, streaks,
// leaderboards, or public-like mechanics. The deliverable of the non-pushy
// principle (D-02) is the *absence* of coercive mechanics — and this file is the
// negative-invariant test that enforces that absence.
//
// Pattern mirrors tests/components/InfoFlow.video-tap-emit.test.mjs: each it()
// scans every source file via readFileSync and asserts ZERO matches, with a
// message explaining WHY the construct is forbidden and listing offending files.
//
// CRITICAL: use word-boundary / specific-construct regexes only. A bare /liked/
// or /like/ substring would false-positive on the ALLOWED hidden engagement
// signal (liked / getLikedPosts / isLiked — present in 14 files) and on the
// intended reward loop (trellisCreditsService / fruit_credits / confetti harvest)
// and vine-progress vocabulary (dailyReadService / "explored"). D-06 explicitly
// permits all of these; the positive regression-guard it() below documents that.
//
// See .planning/phases/53-engagement-guardrails-provider-privacy/53-03-PLAN.md
// and ~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_no_pushy_engagement_mechanics.md.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(here, '../src');

/**
 * Recursively collect *.ts / *.tsx source files under SRC_ROOT, skipping
 * node_modules, test files (*.test.*), and type declarations (*.d.ts).
 */
function collectSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...collectSourceFiles(full));
    } else if (entry.isFile()) {
      if (/\.test\./.test(entry.name)) continue;
      if (entry.name.endsWith('.d.ts')) continue;
      if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  }
  return out;
}

const SOURCE_FILES = collectSourceFiles(SRC_ROOT);

const RESCOPE_RATIONALE =
  'LEARN-04, rescoped 2026-05-20: Trellis is reward-based, not mandate-based, never pushy. ' +
  'The operator rejected daily goals / streaks / leaderboards / stop cues / public likes — ' +
  'reviews are a reward, not an obligation. Re-introducing a coercive mechanic violates the ' +
  'locked non-pushy stance (D-02).';

/** Scan every source file for `re`; return [{ file, count }] for files that match. */
function findMatches(re) {
  const offenders = [];
  for (const file of SOURCE_FILES) {
    const src = readFileSync(file, 'utf-8');
    const matches = src.match(re);
    if (matches && matches.length > 0) {
      offenders.push({ file: relative(SRC_ROOT, file), count: matches.length });
    }
  }
  return offenders;
}

function assertAbsent(re, label) {
  const offenders = findMatches(re);
  assert.equal(
    offenders.length,
    0,
    `Forbidden coercive construct "${label}" found in src/. ${RESCOPE_RATIONALE} ` +
      `Offending files: ${offenders.map((o) => `${o.file} (${o.count})`).join(', ')}.`,
  );
}

describe('LEARN-04 — no pushy/coercive engagement mechanics in src/', () => {
  it('contains no streak counter', () => {
    assertAbsent(/\bstreak\b/gi, 'streak');
  });

  it('contains no leaderboard', () => {
    assertAbsent(/\bleaderboard\b/gi, 'leaderboard');
  });

  it('contains no stop-cue interstitial', () => {
    assertAbsent(/stopCue|stop-cue|stop cue/gi, 'stop cue');
  });

  it('contains no mandated/daily-goal mechanic', () => {
    assertAbsent(/dailyGoal|daily goal|mandatedGoal/gi, 'daily/mandated goal');
  });

  it('contains no public-like display or like-count', () => {
    assertAbsent(/publicLike|public like|likeCount|likesCount/gi, 'public like / like count');
  });
});

describe('LEARN-04 — allowed reward/engagement vocabulary must NOT trip the guard (D-06)', () => {
  // This positive regression-guard documents that the forbidden regexes are
  // intentionally narrow: the allowed hidden `liked` engagement signal and the
  // intended reward/fruit-credit/confetti harvest + vine-progress vocabulary are
  // NOT coercive and must never be banned. The fixture below contains every
  // allowed construct; none of the forbidden patterns may match it.
  const ALLOWED_FIXTURE = [
    'liked',
    'getLikedPosts',
    'isLiked',
    'likePost',
    'trellisCreditsService',
    'fruit_credits',
    'confetti',
    'dailyReadService',
    'explored',
  ].join(' ');

  const FORBIDDEN = [
    [/\bstreak\b/gi, 'streak'],
    [/\bleaderboard\b/gi, 'leaderboard'],
    [/stopCue|stop-cue|stop cue/gi, 'stop cue'],
    [/dailyGoal|daily goal|mandatedGoal/gi, 'daily/mandated goal'],
    [/publicLike|public like|likeCount|likesCount/gi, 'public like / like count'],
  ];

  for (const [re, label] of FORBIDDEN) {
    it(`allowed vocabulary does not match forbidden pattern "${label}"`, () => {
      assert.ok(
        !re.test(ALLOWED_FIXTURE),
        `The "${label}" guard must NOT match the allowed reward/engagement vocabulary ` +
          `(${ALLOWED_FIXTURE}). D-06 permits the hidden \`liked\` signal and the ` +
          `reward/fruit-credit/confetti harvest loop and vine-progress vocabulary; these are ` +
          `not coercive. If this fails, the forbidden regex is too broad and would false-positive ` +
          `on legitimate code.`,
      );
    });
  }
});
