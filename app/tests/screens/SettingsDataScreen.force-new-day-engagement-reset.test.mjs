// Phase 43 Plan 43-07 + gap-closure 43-13 — source-reading invariants for SC-6.
//
// Asserts that SettingsDataScreen.handleForceNewDay wires
// engagementService.resetDismissedOnly() into the Force-New-Day dev affordance:
//   (a) engagementService is imported at the module top
//   (b) the resetDismissedOnly() call lives INSIDE handleForceNewDay's body
//   (c) ordering: dailyReadService.reset() → resetDismissedOnly() → success toast
//   (d) the call appears exactly once (no duplicate accumulation)
//   (e) NEGATIVE: engagementService.reset() does NOT appear in handleForceNewDay
//       body (43-13 — regression guard against wholesale wipe)
//
// Saved + liked posts are persistent user archives across days per operator
// intent confirmed during Phase 43 UAT. Wholesale reset() is reserved for
// Clear-All-Data / settingsService.reset() paths.
//
// Pattern follows Phase 39/40/41/42/43-04/43-05/43-06 source-reading invariant
// test discipline: pure regex + indexOf comparisons against the live source file,
// no React render, no jsdom, no node_modules side effects.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const src = readFileSync(path.join(appRoot, 'src/screens/settings/SettingsDataScreen.tsx'), 'utf8');

test('SC-6: engagementService imported at module top', () => {
  assert.match(src, /import\s+\{\s*engagementService\s*\}\s+from\s+['"][^'"]*engagement\.service['"]/);
});

test('SC-6: engagementService.resetDismissedOnly() called inside handleForceNewDay', () => {
  const fnStart = src.indexOf('const handleForceNewDay');
  assert.ok(fnStart > 0, 'handleForceNewDay function must exist');
  const fnEnd = src.indexOf('  };', fnStart);
  assert.ok(fnEnd > fnStart, 'handleForceNewDay function body must terminate with closing brace');
  const fnBody = src.slice(fnStart, fnEnd);
  assert.match(
    fnBody,
    /engagementService\.resetDismissedOnly\(\)/,
    'engagementService.resetDismissedOnly() must be called inside handleForceNewDay (gap-closure 43-13 — saved/liked persistent across days)',
  );
});

test('SC-6: resetDismissedOnly() ordering — after dailyReadService.reset(), before success toast', () => {
  const fnStart = src.indexOf('const handleForceNewDay');
  const fnEnd = src.indexOf('  };', fnStart);
  const fnBody = src.slice(fnStart, fnEnd);

  const dailyResetIdx = fnBody.indexOf('dailyReadService.reset()');
  const partialResetIdx = fnBody.indexOf('engagementService.resetDismissedOnly()');
  const successToastIdx = fnBody.indexOf("toast(t('settings.toast.forceNewDayRollbackSuccess')");

  assert.ok(dailyResetIdx > 0, 'dailyReadService.reset() must exist in handleForceNewDay');
  assert.ok(partialResetIdx > 0, 'engagementService.resetDismissedOnly() must exist in handleForceNewDay');
  assert.ok(successToastIdx > 0, 'success toast must exist in handleForceNewDay');

  assert.ok(partialResetIdx > dailyResetIdx, 'engagementService.resetDismissedOnly() must come AFTER dailyReadService.reset()');
  assert.ok(partialResetIdx < successToastIdx, 'engagementService.resetDismissedOnly() must come BEFORE the success toast');
});

test('SC-6: resetDismissedOnly() called exactly once (no duplicate accumulation)', () => {
  const calls = (src.match(/engagementService\.resetDismissedOnly\(\)/g) || []).length;
  assert.strictEqual(calls, 1);
});

test('SC-6: engagementService.reset() does NOT appear in handleForceNewDay body (43-13 negative invariant)', () => {
  // Gap-closure 43-13 negative invariant: regression guard against re-introducing
  // the wholesale wipe inside Force-New-Day. reset() is reserved for
  // Clear-All-Data and settingsService.reset() — those paths still legitimately
  // want saved + liked wiped. handleForceNewDay must NEVER call reset() again.
  const fnStart = src.indexOf('const handleForceNewDay');
  assert.ok(fnStart > 0, 'handleForceNewDay must exist');
  const fnEnd = src.indexOf('  };', fnStart);
  assert.ok(fnEnd > fnStart, 'handleForceNewDay must terminate');
  const fnBody = src.slice(fnStart, fnEnd);
  // The body must NOT contain `engagementService.reset()` as a standalone
  // call. The substring `resetDismissedOnly()` correctly does NOT match this
  // pattern (different identifier).
  assert.doesNotMatch(
    fnBody,
    /engagementService\.reset\(\)/,
    'engagementService.reset() must NOT appear inside handleForceNewDay — it would re-introduce the wholesale wipe regression',
  );
});
