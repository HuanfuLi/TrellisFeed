/**
 * Guards the Phase 33 UAT-4 fix (2026-04-20) for the Ask keyboard-deform
 * bug. The true root cause was that the SwipeTabContainer strip is
 * 500vw wide (5 slots × 100vw) but the document had NO `overflow-x:
 * hidden`. When Android WebView's keyboard opened on a focused input
 * inside an off-center slot, Chromium's scrollIntoView shifted
 * document.scrollLeft — the whole app visibly drifted left. On close,
 * scrollLeft was not reset, so the drift persisted until a route change
 * re-layouted.
 *
 * Three layers of defense. This test pins all three:
 *   1. index.css: html, body { overflow-x: hidden } — primary structural fix
 *   2. App.tsx root div: overflowX: 'hidden' — React-layer belt-and-suspenders
 *   3. SwipeTabContainer onFocusOut: document.scrollingElement.scrollLeft = 0 — recovery path
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const indexCss = fs.readFileSync(
  new URL('../../src/index.css', import.meta.url),
  'utf-8',
);
const appTsx = fs.readFileSync(
  new URL('../../src/App.tsx', import.meta.url),
  'utf-8',
);
const swipeTab = fs.readFileSync(
  new URL('../../src/components/SwipeTabContainer.tsx', import.meta.url),
  'utf-8',
);

describe('root horizontal overflow clip', () => {
  it('index.css clips BOTH horizontal AND vertical overflow on html + body', () => {
    // overflow-x hidden — prevents 500vw strip from making document horizontally scrollable.
    // overflow-y hidden — prevents body (min-height:100vh, which doesn't shrink with
    //   keyboard) from becoming a second scroll container nested outside every screen's
    //   own overflow:auto region. That nesting causes elastic-bounce direction-change
    //   blocking AND lets body scroll drag ChatInput behind the keyboard on AskScreen.
    // Both axes can be expressed via the shorthand `overflow: hidden` or separate
    // `overflow-x: hidden; overflow-y: hidden`. Accept either form.
    assert.ok(
      /html,\s*body\s*\{\s*overflow:\s*hidden/.test(indexCss)
      || /html,\s*body\s*\{[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*hidden/.test(indexCss)
      || /html,\s*body\s*\{[^}]*overflow-y:\s*hidden[^}]*overflow-x:\s*hidden/.test(indexCss),
      'index.css must declare `html, body { overflow: hidden }` (or both overflow-x and overflow-y hidden). Horizontal clip blocks 500vw-strip scroll-into-view drift; vertical clip blocks body-vs-inner-scroll nesting that breaks keyboard scroll on AskScreen.',
    );
  });

  it('App.tsx root div has overflowX: "hidden" as React-layer belt-and-suspenders', () => {
    // The outermost wrapper directly around SwipeTabContainer.
    assert.ok(
      /minHeight:\s*['"]100vh['"][^}]*overflowX:\s*['"]hidden['"]/.test(appTsx)
      || /overflowX:\s*['"]hidden['"][^}]*minHeight:\s*['"]100vh['"]/.test(appTsx),
      'App.tsx root div must set overflowX: "hidden" alongside minHeight: "100vh" — defense-in-depth if index.css rule is lost',
    );
  });

  it('SwipeTabContainer onFocusOut resets document.scrollLeft as recovery path', () => {
    const idx = swipeTab.indexOf('const onFocusOut');
    assert.ok(idx !== -1, 'SwipeTabContainer.tsx should contain const onFocusOut');
    const body = swipeTab.slice(idx, idx + 1200);

    assert.ok(
      /document\.scrollingElement/.test(body),
      'onFocusOut must reference document.scrollingElement for scrollLeft reset — the keyboard-scroll-into-view recovery path',
    );
    assert.ok(
      /scrollLeft\s*=\s*0/.test(body),
      'onFocusOut must set scrollLeft = 0 to recover any horizontal drift',
    );
  });
});
