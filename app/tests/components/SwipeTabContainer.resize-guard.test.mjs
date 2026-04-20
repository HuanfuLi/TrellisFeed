/**
 * Guards the Phase 33 UAT-4 fix (2026-04-20): SwipeTabContainer's resync
 * handler must treat visualViewport.resize events where WIDTH didn't
 * change as no-ops, and must force a stripX re-snap on focus-out.
 *
 * Without the width-change guard, keyboard open/close on Android WebView
 * fires resize events with transient pixel-ratio-adjusted widths that
 * place the active slot at a wrong X — the "Ask screen zooms/deforms and
 * doesn't recover until tab navigation" bug. With the focus-out re-snap,
 * any drift that somehow slipped through is recovered as soon as the
 * keyboard closes.
 *
 * Source-reading asserts are the cheapest durable lock for React/
 * motion-values code that is expensive to simulate in a DOM mock.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../../src/components/SwipeTabContainer.tsx', import.meta.url),
  'utf-8',
);

describe('SwipeTabContainer resize + keyboard guards', () => {
  it('resync bails out when width did not change (height-only keyboard events are no-ops)', () => {
    // Locate the resync function body.
    const idx = source.indexOf('const resync = () =>');
    assert.ok(idx !== -1, 'SwipeTabContainer.tsx should contain const resync = () =>');
    const body = source.slice(idx, idx + 1000);

    assert.ok(
      /const\s+newWidth\s*=\s*getScreenWidth\(\)/.test(body),
      'resync must capture getScreenWidth() into a local before writing screenWidthRef — otherwise the height-only guard cannot compare',
    );
    assert.ok(
      /if\s*\(\s*newWidth\s*===\s*screenWidthRef\.current\s*\)\s*return/.test(body),
      'resync must return early when width did not change — height-only events (keyboard open/close) must not re-snap stripX',
    );
  });

  it('focus-out forces a stripX re-snap to recover from any drift during keyboard session', () => {
    const idx = source.indexOf('const onFocusOut');
    assert.ok(idx !== -1, 'SwipeTabContainer.tsx should contain const onFocusOut');
    const body = source.slice(idx, idx + 800);

    assert.ok(
      /requestAnimationFrame/.test(body),
      'onFocusOut must defer the re-snap via requestAnimationFrame so the keyboard-close viewport resize has finished before we read width',
    );
    assert.ok(
      /stripX\.set\(computeTargetX\(activeIndexRef\.current,\s*screenWidthRef\.current\)\)/.test(body),
      'onFocusOut must force stripX to computeTargetX(activeIndex, width) — this is the recovery path mirroring navigateToTab',
    );
  });
});
