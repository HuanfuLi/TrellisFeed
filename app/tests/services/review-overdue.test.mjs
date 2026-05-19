// Gap B + Gap C (Phase 51 UAT, 2026-05-19): SM-2 overdue penalty,
// large-gap reset, oldest-overdue-first sort, daysOverdue helper.

import assert from 'node:assert/strict';
import test from 'node:test';

const ISO_MS_PER_DAY = 86400000;

// Build an ISO 'YYYY-MM-DD' string `daysFromNow` days from today, anchored
// at midnight local time so the helper's local-Date arithmetic matches.
const isoOffset = (daysFromNow) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
};

const mkSchedule = (overrides = {}) => ({
  nextReviewDate: isoOffset(0),
  reviewCount: 0,
  easeFactor: 2.5,
  ...overrides,
});

test('daysOverdue returns 0 for empty / future / today nextReviewDate', async () => {
  const { daysOverdue } = await import('../../src/services/review.service.ts');
  assert.equal(daysOverdue(''), 0);
  assert.equal(daysOverdue(isoOffset(0)), 0);    // due today
  assert.equal(daysOverdue(isoOffset(5)), 0);    // not yet due
});

test('daysOverdue returns positive integer for past nextReviewDate', async () => {
  const { daysOverdue } = await import('../../src/services/review.service.ts');
  assert.equal(daysOverdue(isoOffset(-3)), 3);
  assert.equal(daysOverdue(isoOffset(-14)), 14);
});

test('Gap C: rating 3 on on-time card → standard SM2 interval (no penalty)', async () => {
  const { calcNextInterval } = await import('../../src/services/review.service.ts');
  const result = calcNextInterval(mkSchedule({ reviewCount: 2, nextReviewDate: isoOffset(0) }), 3);
  // SM2_INTERVALS[2] = 4 days, no overdue penalty
  assert.equal(result.days, 4);
  assert.equal(result.newReviewCount, 3);
});

test('Gap C: rating 3 on moderately-overdue card → days reduced by floor(overdueDays/2)', async () => {
  const { calcNextInterval } = await import('../../src/services/review.service.ts');
  // reviewCount=2, base interval = SM2_INTERVALS[2] = 4 days, overdue 4 days
  // → penalty 2 days → days = 2
  // overdue 4 <= 2*previousInterval (2*SM2_INTERVALS[1]=2*2=4) — NOT reset; penalty path
  const result = calcNextInterval(mkSchedule({ reviewCount: 2, nextReviewDate: isoOffset(-4) }), 3);
  assert.equal(result.days, 2, 'baseDays 4 - floor(4/2)=2 → 2 days');
  assert.equal(result.newReviewCount, 3);
});

test('Gap C: rating 3 on large-gap overdue (overdue > 2x previous interval) → reset reviewCount to 0', async () => {
  const { calcNextInterval } = await import('../../src/services/review.service.ts');
  // reviewCount=3 → previousInterval = SM2_INTERVALS[2] = 4 days
  // overdue 20 days > 2*4 = 8 days → reset
  const result = calcNextInterval(mkSchedule({ reviewCount: 3, nextReviewDate: isoOffset(-20) }), 3);
  assert.equal(result.days, 1, 'large-gap reset → 1 day');
  assert.equal(result.newReviewCount, 0, 'large-gap reset → reviewCount=0');
});

test('Gap C: rating < 3 (fail) → 1 day repeat, reviewCount keeps incrementing (existing behavior)', async () => {
  const { calcNextInterval } = await import('../../src/services/review.service.ts');
  const result = calcNextInterval(mkSchedule({ reviewCount: 2, nextReviewDate: isoOffset(-1) }), 1);
  assert.equal(result.days, 1);
  // Fail-reset is intentionally NOT in scope for this Phase 51 UAT fix —
  // documented in the calcNextInterval doc-comment.
  assert.equal(result.newReviewCount, 3, 'fail does NOT reset reviewCount (separate concern)');
});

test('Gap C: penalty floors at 1 day (never schedules into the past)', async () => {
  const { calcNextInterval } = await import('../../src/services/review.service.ts');
  // reviewCount=1, base interval = SM2_INTERVALS[1] = 2 days, overdue 3 days
  // 3 < 2*previousInterval (2*SM2_INTERVALS[0]=2*1=2)? No, 3 > 2 → RESET path
  // To hit penalty floor without reset, need overdue <= 2*previousInterval
  // reviewCount=2 → previousInterval=2. baseDays=4. overdue=4 → penalty 2.
  // Want penalty floored at 1: reviewCount=1 → previousInterval=1. base=2.
  // overdue=2: 2 > 2*1=2? No (>, not >=). penalty = max(1, 2 - 1) = 1. PASS path.
  const result = calcNextInterval(mkSchedule({ reviewCount: 1, nextReviewDate: isoOffset(-2) }), 3);
  assert.equal(result.days, 1, 'baseDays 2 - floor(2/2)=1 → 1 day (floored)');
  assert.equal(result.newReviewCount, 2);
});

test('Gap C: easeFactor still bumps for high ratings even with overdue penalty', async () => {
  const { calcNextInterval } = await import('../../src/services/review.service.ts');
  const result = calcNextInterval(mkSchedule({ reviewCount: 2, easeFactor: 2.5, nextReviewDate: isoOffset(-2) }), 5);
  assert.ok(result.newEaseFactor > 2.5, 'rating 5 should bump easeFactor');
});

test('Gap C: easeFactor floors at 1.3', async () => {
  const { calcNextInterval } = await import('../../src/services/review.service.ts');
  const result = calcNextInterval(mkSchedule({ reviewCount: 0, easeFactor: 1.3 }), 1);
  assert.ok(result.newEaseFactor >= 1.3, 'easeFactor must not drop below 1.3');
});

test('Gap C: fresh card (reviewCount=0) due-today + rating 3 → 1 day (no surprise)', async () => {
  const { calcNextInterval } = await import('../../src/services/review.service.ts');
  // reviewCount=0, base interval = SM2_INTERVALS[0] = 1 day, overdue 0 → no penalty
  // previousInterval logic for reviewCount=0: fallback to 1
  const result = calcNextInterval(mkSchedule({ reviewCount: 0, nextReviewDate: isoOffset(0) }), 3);
  assert.equal(result.days, 1);
  assert.equal(result.newReviewCount, 1);
});

// ── Gap B: oldest-overdue-first sort sentinel ─────────────────────────────
test('Gap B: getTodayReviewItems sort source-pattern verifies oldest-overdue-first', async () => {
  const fs = await import('node:fs');
  const url = await import('node:url');
  const path = await import('node:path');
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const reviewPath = path.resolve(__dirname, '../../src/services/review.service.ts');
  const source = fs.readFileSync(reviewPath, 'utf-8');
  assert.match(
    source,
    /flashcardService\.getDue\(\)[\s\S]{0,200}\.sort\(\s*\([^)]+\)[\s\S]{0,200}localeCompare/,
    'reviewService.getTodayReviewItems must sort flashcardService.getDue() via localeCompare on nextReviewDate.',
  );
});

// ── Gap B: i18n sentinel ──────────────────────────────────────────────────
test('Gap B: all 4 locale bundles include review.session.overdueBadge plural pair', async () => {
  const fs = await import('node:fs');
  const url = await import('node:url');
  const path = await import('node:path');
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  for (const locale of ['en', 'zh', 'es', 'ja']) {
    const localePath = path.resolve(__dirname, `../../src/locales/${locale}.json`);
    const json = JSON.parse(fs.readFileSync(localePath, 'utf-8'));
    assert.ok(json?.review?.session?.overdueBadge_one, `${locale}.json must have review.session.overdueBadge_one`);
    assert.ok(json?.review?.session?.overdueBadge_other, `${locale}.json must have review.session.overdueBadge_other`);
  }
});

// ── Learn-as-Post escalation sentinel ─────────────────────────────────────
test('AnchorDetailScreen escalates Learn-as-Post for dead OR (recovery && no flashcards)', async () => {
  const fs = await import('node:fs');
  const url = await import('node:url');
  const path = await import('node:path');
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const anchorPath = path.resolve(__dirname, '../../src/screens/AnchorDetailScreen.tsx');
  const source = fs.readFileSync(anchorPath, 'utf-8');
  assert.match(
    source,
    /learnAsPostRecoveryActive[\s\S]{0,200}leafState\s*===\s*['"]dead['"][\s\S]{0,200}recoveryActive\s*&&\s*anchorCardCount\s*===\s*0/,
    'AnchorDetailScreen must define learnAsPostRecoveryActive as `leafState === "dead" || (recoveryActive && anchorCardCount === 0)`.',
  );
  assert.match(
    source,
    /graph\.anchor\.rebuildAsPost/,
    'AnchorDetailScreen must reference graph.anchor.rebuildAsPost label for the recovery state.',
  );
});

test('AnchorDetailScreen Learn-as-Post button consumes the escalated style vars (learnAsPostBg/Label/TextColor)', async () => {
  const fs = await import('node:fs');
  const url = await import('node:url');
  const path = await import('node:path');
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const anchorPath = path.resolve(__dirname, '../../src/screens/AnchorDetailScreen.tsx');
  const source = fs.readFileSync(anchorPath, 'utf-8');
  assert.match(source, /backgroundColor:\s*learnAsPostBg/);
  assert.match(source, /color:\s*learnAsPostTextColor/);
  assert.match(source, /\{learnAsPostLabel\}/);
});
