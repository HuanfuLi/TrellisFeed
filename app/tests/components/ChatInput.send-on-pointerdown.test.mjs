/**
 * Guards the Phase 55.1 BUGFIX-04 fix: the Ask-screen Send button must send on
 * the FIRST tap while the keyboard is open.
 *
 * Root cause: Send was a `<button type="submit">` relying on click/form-submit,
 * which fires on pointer-UP — after the focus change. On Android WebView the
 * first tap's blur dismisses the keyboard and the submit never reaches the
 * handler, so the user has to tap twice.
 *
 * Fix: fire send on `onPointerDown` with `e.preventDefault()` so the handler
 * runs BEFORE the input blurs and focus is preserved (keyboard stays open). The
 * send body is extracted into a shared `submitMessage()` referenced by BOTH the
 * pointerdown handler AND the form's `onSubmit` so the Enter-key path still works
 * and the body is single-source (no double-send drift).
 *
 * Source-reading assertions (mirroring ChatInput.flex-shrink.test.mjs) are the
 * cheapest durable lock: a Node suite cannot prove the device-only blur-vs-tap
 * ordering, but it CAN prove the structural shape that makes first-tap send
 * possible never regresses.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../../src/components/ChatInput.tsx', import.meta.url),
  'utf-8',
);

describe('ChatInput send-on-pointerdown guard (BUGFIX-04)', () => {
  it('Send button has an onPointerDown handler that calls preventDefault()', () => {
    // Locate the Send button block (the one rendering the <Send …> icon).
    const sendIconIdx = source.indexOf('<Send size');
    assert.ok(sendIconIdx !== -1, 'ChatInput.tsx should contain the <Send> icon');

    // Walk back to the opening <button that wraps the Send icon.
    const buttonOpenIdx = source.lastIndexOf('<button', sendIconIdx);
    assert.ok(buttonOpenIdx !== -1, 'Send icon must live inside a <button>');

    const sendButtonBlock = source.slice(buttonOpenIdx, sendIconIdx);

    // (1) pointerdown (or mousedown) handler present.
    assert.ok(
      /on(PointerDown|MouseDown)\s*=/.test(sendButtonBlock),
      'Send button must wire onPointerDown (or onMouseDown) so the tap runs before the input blurs',
    );

    // (1b) and it must preventDefault to preserve focus (keyboard stays open).
    assert.ok(
      /preventDefault\s*\(\s*\)/.test(sendButtonBlock) ||
        /onPointerDown=\{handleSendPointerDown\}/.test(sendButtonBlock) &&
          /const\s+handleSendPointerDown[\s\S]{0,180}preventDefault\s*\(\s*\)/.test(source),
      'Send button onPointerDown must call e.preventDefault() so focus is preserved on the first tap',
    );
  });

  it('send body is a shared submitMessage() referenced by BOTH the pointerdown handler AND the form submit', () => {
    // The shared function must be declared.
    assert.ok(
      /const\s+submitMessage\s*=/.test(source),
      'send body must be extracted into a shared `submitMessage` function',
    );

    // It must be referenced at least twice (handleSubmit/Enter path + pointerdown path).
    const refs = source.match(/submitMessage\s*\(\s*\)/g) || [];
    assert.ok(
      refs.length >= 2,
      `submitMessage() must be called from BOTH the form submit (Enter) and the onPointerDown handler — found ${refs.length} call(s)`,
    );

    // handleSubmit (the form onSubmit) must still preventDefault and delegate to submitMessage.
    const handleSubmitIdx = source.indexOf('const handleSubmit');
    assert.ok(handleSubmitIdx !== -1, 'handleSubmit must still exist for the Enter-key/form path');
    const handleSubmitBlock = source.slice(handleSubmitIdx, handleSubmitIdx + 200);
    assert.ok(
      /preventDefault\s*\(\s*\)/.test(handleSubmitBlock) && /submitMessage\s*\(\s*\)/.test(handleSubmitBlock),
      'handleSubmit must preventDefault then call submitMessage() (Enter-key path preserved, single-source body)',
    );

    // The form must still wire onSubmit={handleSubmit}.
    assert.ok(
      /onSubmit=\{handleSubmit\}/.test(source),
      'form must keep onSubmit={handleSubmit} so Enter still submits',
    );
  });

  it('text input still declares minWidth: 0 (flex-shrink invariant not regressed)', () => {
    const inputIdx = source.indexOf('<input\n            type="text"');
    assert.ok(inputIdx !== -1, 'ChatInput.tsx should contain the text <input>');
    const inputBlock = source.slice(inputIdx, source.indexOf('/>', inputIdx) + 2);
    assert.ok(
      /minWidth:\s*0\b/.test(inputBlock),
      'ChatInput <input> must still set minWidth: 0 — Phase 33 UAT-4 flex-shrink invariant',
    );
  });

  it('Send button still carries the disabled={!canSend} guard', () => {
    const sendIconIdx = source.indexOf('<Send size');
    const buttonOpenIdx = source.lastIndexOf('<button', sendIconIdx);
    const sendButtonBlock = source.slice(buttonOpenIdx, sendIconIdx);
    assert.ok(
      /disabled=\{!canSend\}/.test(sendButtonBlock),
      'Send button must keep disabled={!canSend} so empty/disabled sends are blocked',
    );
  });
});
