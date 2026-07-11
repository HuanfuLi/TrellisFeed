/**
 * Guards the Phase 33 UAT-4 fix (2026-04-20): ChatInput's text input must
 * declare `minWidth: 0` on its inline style. Without this guard the
 * Android WebView flex algorithm refuses to shrink the input below its
 * intrinsic content width, pushing the flexShrink:0 Send button off-screen.
 *
 * This regression has happened TWICE:
 *   - d45c228c (2026-04-07) switched position:fixed → flex-column, didn't add the guard.
 *   - 47d81049 (2026-04-19) grew mic/globe buttons 34→44px, tipping the flex overflow.
 *
 * A source-reading assertion is the cheapest durable lock — any PR that
 * removes the `minWidth: 0` line fails CI before it ships to device.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../../src/components/ChatInput.tsx', import.meta.url),
  'utf-8',
);

describe('ChatInput flex-shrink guard', () => {
  it('text input declares minWidth: 0 so Send button cannot drift off-screen', () => {
    // Locate the <input type="text" …> block.
    const inputIdx = source.search(/<input\b[\s\S]*?type=["']text["']/);
    assert.ok(inputIdx !== -1, 'ChatInput.tsx should contain the text <input>');

    // Narrow to the input's JSX (up to the next '/>').
    const inputBlock = source.slice(inputIdx, source.indexOf('/>', inputIdx) + 2);
    assert.ok(
      /minWidth:\s*0\b/.test(inputBlock),
      'ChatInput <input> must set minWidth: 0 on its inline style — flex overflow regression on Android WebView otherwise',
    );

    // And it must coexist with flex: 1, not replace it.
    assert.ok(
      /flex:\s*1\b/.test(inputBlock),
      'ChatInput <input> must also retain flex: 1 — minWidth:0 on its own without flex:1 would collapse the field to 0',
    );
  });
});
