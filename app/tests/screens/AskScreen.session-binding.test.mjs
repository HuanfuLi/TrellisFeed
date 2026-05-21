/**
 * Phase 55.1 BUGFIX-01 — cross-session LLM response leakage.
 *
 * A slow streaming answer requested in session A used to persist to whatever
 * session was ACTIVE at persist time (`sessionRef.current`), and session
 * switches never aborted the in-flight stream. Result observed on device: a
 * 3rd-session answer rendered/persisted under a 5th-session question.
 *
 * This file locks the fix two ways:
 *  (a) Contract tests for the pure `resolvePersistTarget` helper — persist is
 *      ALWAYS to the originating session; UI updates only on id-match.
 *  (b) Source-reading guards (readFileSync of AskScreen.tsx) — `originSessionId`
 *      is captured before the first await in generateAiReply, and the three
 *      session-switch handlers each abort the in-flight stream before switching.
 *
 * The source-guard pattern mirrors SwipeTabContainer.resize-guard.test.mjs:
 * source-reading asserts are the cheapest durable lock for React code that is
 * expensive to simulate in a DOM mock.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// Imported from the sibling .ts module (NOT AskScreen.tsx) — Node's native
// TypeScript stripping handles `.ts` but not `.tsx`. AskScreen re-exports the
// same symbol for the runtime path.
import { resolvePersistTarget } from '../../src/screens/ask-persist-target.ts';

const source = fs.readFileSync(
  new URL('../../src/screens/AskScreen.tsx', import.meta.url),
  'utf-8',
);

describe('resolvePersistTarget contract (BUGFIX-01)', () => {
  it('origin !== active: persists to origin, does NOT update UI', () => {
    const result = resolvePersistTarget({ originSessionId: 'A', activeSessionId: 'B' });
    assert.equal(result.persistSessionId, 'A', 'must persist to the originating session');
    assert.equal(result.updateUI, false, 'must NOT mutate UI when the origin is no longer active');
  });

  it('origin === active: persists to origin, updates UI', () => {
    const result = resolvePersistTarget({ originSessionId: 'A', activeSessionId: 'A' });
    assert.equal(result.persistSessionId, 'A', 'must persist to the originating session');
    assert.equal(result.updateUI, true, 'must mutate UI when the origin is still the active session');
  });
});

describe('AskScreen.tsx source guards (BUGFIX-01)', () => {
  it('generateAiReply captures originSessionId before the first await', () => {
    const start = source.indexOf('const generateAiReply');
    assert.ok(start !== -1, 'AskScreen.tsx should contain const generateAiReply');
    // The first await inside the callback is setStreaming/await chain; the
    // first `await` keyword is the boundary.
    const bodyToFirstAwait = source.slice(start, start + 2000);
    const awaitIdx = bodyToFirstAwait.indexOf('await ');
    assert.ok(awaitIdx !== -1, 'generateAiReply should contain an await');
    const beforeFirstAwait = bodyToFirstAwait.slice(0, awaitIdx);
    assert.ok(
      /const\s+originSessionId\s*=/.test(beforeFirstAwait),
      'originSessionId must be captured BEFORE the first await in generateAiReply — otherwise the persist target can drift to the active session',
    );
  });

  it('persist block re-reads the session by originSessionId (not bare sessionRef.current)', () => {
    assert.ok(
      /sessionService\.getById\(\s*originSessionId\s*\)/.test(source),
      'the persist block must re-read via sessionService.getById(originSessionId) so the answer lands in the originating session',
    );
  });

  it('persist/UI is gated through resolvePersistTarget', () => {
    assert.ok(
      /resolvePersistTarget\(/.test(source),
      'generateAiReply must drive the UI update through resolvePersistTarget(...)',
    );
  });

  it('all three session-switch handlers abort the in-flight stream', () => {
    const count = (source.match(/abortRef\.current\?\.abort\(\)/g) || []).length;
    // unmount cleanup (1) + handleNewChat + handleSelectSession + handleDeleteSession-active = >= 4
    assert.ok(
      count >= 4,
      `abortRef.current?.abort() must appear >= 4 times (unmount + 3 switch handlers); found ${count}`,
    );
  });

  it('handleNewChat aborts before switching session', () => {
    const idx = source.indexOf('const handleNewChat');
    assert.ok(idx !== -1, 'AskScreen.tsx should contain const handleNewChat');
    const body = source.slice(idx, idx + 400);
    assert.ok(
      /abortRef\.current\?\.abort\(\)/.test(body),
      'handleNewChat must abort the in-flight stream before opening a new session',
    );
  });

  it('handleSelectSession aborts before switching session', () => {
    const idx = source.indexOf('const handleSelectSession');
    assert.ok(idx !== -1, 'AskScreen.tsx should contain const handleSelectSession');
    const body = source.slice(idx, idx + 500);
    assert.ok(
      /abortRef\.current\?\.abort\(\)/.test(body),
      'handleSelectSession must abort the in-flight stream before loading another session',
    );
  });

  it('handleDeleteSession aborts when deleting the active session', () => {
    const idx = source.indexOf('const handleDeleteSession');
    assert.ok(idx !== -1, 'AskScreen.tsx should contain const handleDeleteSession');
    const body = source.slice(idx, idx + 500);
    assert.ok(
      /abortRef\.current\?\.abort\(\)/.test(body),
      'handleDeleteSession must abort the in-flight stream when the active session is deleted',
    );
  });
});
