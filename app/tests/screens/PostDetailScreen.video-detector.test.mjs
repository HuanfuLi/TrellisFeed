// Phase 36 GAP-C regression guard: ensures PostDetailScreen.tsx contains Detector D
// (YouTube IFrame API postMessage listener) for video posts, and Detectors A/B
// remain intact. See .planning/debug/video-completion-signal-missing.md.
//
// Source-reading test (no React render harness needed) — same pattern as
// app/tests/components/ChatInput.flex-shrink.test.mjs.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POST_DETAIL_PATH = resolve(__dirname, '../../src/screens/PostDetailScreen.tsx');
const source = readFileSync(POST_DETAIL_PATH, 'utf-8');

describe('PostDetailScreen Detector D (Phase 36 GAP-C)', () => {
  it('contains Detector D comment block for video posts', () => {
    assert.ok(
      source.includes('Detector D'),
      'PostDetailScreen.tsx must declare Detector D — the YouTube IFrame API postMessage listener for video posts. See .planning/debug/video-completion-signal-missing.md.',
    );
  });

  it('restricts postMessage origin to YouTube domains', () => {
    assert.ok(
      source.includes("event.origin !== 'https://www.youtube.com'"),
      'Detector D must check event.origin against https://www.youtube.com to prevent spoofed concept-explored signals from untrusted iframes.',
    );
    assert.ok(
      source.includes('youtube-nocookie.com'),
      'Detector D should also accept the privacy-mirror domain youtube-nocookie.com (used by some Capacitor configs).',
    );
  });

  it('parses ENDED state from onStateChange events', () => {
    assert.ok(
      source.includes("data.event === 'onStateChange' && data.info === 0"),
      'Detector D must fire emitExplored when YouTube reports state change to ENDED (info=0). info=0 is the ENDED state per YouTube IFrame API spec.',
    );
  });

  it('parses heartbeat events and fires at >=80% playback', () => {
    assert.ok(
      source.includes("data.event === 'infoDelivery'"),
      'Detector D must parse infoDelivery heartbeat events.',
    );
    assert.ok(
      source.includes('info.currentTime / info.duration >= 0.8'),
      'Detector D must fire emitExplored when currentTime/duration >= 0.8 (video substantially watched).',
    );
  });

  it('registers and cleans up the message listener', () => {
    assert.ok(
      source.includes("window.addEventListener('message'"),
      'Detector D must register a window message listener.',
    );
    assert.ok(
      source.includes("window.removeEventListener('message'"),
      'Detector D must clean up the listener on unmount to prevent leaks across post navigation.',
    );
  });

  it('preserves existing Detectors A and B', () => {
    assert.ok(
      source.includes('Detector A: Scroll 70%'),
      'Phase 36 GAP-C fix must NOT remove Detector A (scroll 70% sentinel).',
    );
    assert.ok(
      source.includes('Detector B: 30s dwell'),
      'Phase 36 GAP-C fix must NOT remove Detector B (30s dwell timer).',
    );
  });
});
