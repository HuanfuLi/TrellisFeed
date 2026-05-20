/**
 * 54-02 regression guard (QUALITY-01 FIX): PlannerScreen must re-read the
 * trellis-credits balance on navigation to /planner.
 *
 * PlannerScreen is an always-mounted SwipeTabContainer slot, so its
 * `useState(() => trellisCreditsService.getTotal())` initializer runs ONCE at app
 * boot. Credits can change while Planner is off-screen — most concretely when the
 * user finishes the daily vine on HomeScreen, which calls `trellisCreditsService.add(1)`.
 * Without a navigation resync, the displayed balance stays stale until the next
 * harvest mutates it via `onCreditsChange`.
 *
 * Per CLAUDE.md ("Always-mounted screens must explicitly re-read service state on
 * navigation") the fix is the canonical `[location.pathname]` resync effect — NOT a
 * new event (the `add()` call site stays the sole credit mutator: one signal per
 * semantic event).
 *
 * Source-reading region-slice pattern — same approach as
 * HomeScreen.exploredAnchors-resync.test.mjs; PlannerScreen's i18n/Capacitor deps
 * block a direct import under `node --test`. The slice is bounded to the component
 * body so a match cannot drift to an unrelated module.
 *
 * Audit disposition: FIX (54-BUG-AUDIT.md Cluster 2 / OQ#3).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLANNER_PATH = resolve(__dirname, '../../src/screens/PlannerScreen.tsx');
const source = readFileSync(PLANNER_PATH, 'utf-8');

// Slice from the credits useState declaration to the end of the file body.
function getBodySlice() {
  const startMarker = 'useState<number>(() => trellisCreditsService.getTotal())';
  const startIdx = source.indexOf(startMarker);
  assert.ok(startIdx !== -1, 'Could not locate the credits useState initializer in PlannerScreen.tsx; the structure may have changed.');
  return source.slice(startIdx);
}

describe('54-02 PlannerScreen credit balance resync on /planner navigation', () => {
  it('imports useLocation from react-router-dom', () => {
    assert.match(
      source,
      /import\s*\{[^}]*\buseLocation\b[^}]*\}\s*from\s*['"]react-router-dom['"]/,
      'PlannerScreen.tsx must import useLocation to drive the navigation resync effect.',
    );
  });

  it('declares a [location.pathname] effect that resets credits from trellisCreditsService.getTotal() when on /planner', () => {
    const body = getBodySlice();
    assert.match(
      body,
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?location\.pathname\s*===\s*['"]\/planner['"][\s\S]*?setCredits\(trellisCreditsService\.getTotal\(\)\)[\s\S]*?\},\s*\[location\.pathname\]\)/,
      'PlannerScreen.tsx must declare a useEffect that calls `setCredits(trellisCreditsService.getTotal())` when `location.pathname === "/planner"`, with `[location.pathname]` as the dependency. Without it, the credit balance stays stale after a daily-read credit is earned on HomeScreen while Planner is off-screen.',
    );
  });

  it('does NOT introduce a new credit event (one signal per semantic event)', () => {
    // The fix must use the [location.pathname] resync pattern, not a parallel event.
    assert.ok(
      !/eventBus\.subscribe\(\s*['"]CREDIT/.test(source) && !/CREDITS_CHANGED|CREDIT_ADDED|CREDIT_AWARDED/.test(source),
      'PlannerScreen.tsx must NOT introduce a new credit event; the navigation resync is the correct mechanism (CLAUDE.md: one signal per semantic event).',
    );
  });
});
