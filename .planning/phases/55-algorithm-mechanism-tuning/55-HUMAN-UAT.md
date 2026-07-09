---
status: complete
phase: 55-algorithm-mechanism-tuning
source: [55-VERIFICATION.md]
started: 2026-05-21
updated: 2026-05-21
---

## Current Test

[testing complete]

## Tests

### 1. Heavy stores live in IndexedDB, not localStorage (structural quota-relief proof)
expected: After normal light use (ask 1–2 questions, scroll the feed once) in `npm run dev` (Chrome, localhost), DevTools confirms the heavy data moved off localStorage into IndexedDB — no bulk image generation needed. (Unified backend: IndexedDB on both web and the native WebView.)
how: DevTools.
  (a) Console: confirm the active backend log on boot reads `[Trellis] DB backend active: IndexedDBBackend` (NOT `LocalStorageBackend`).
  (b) Application → IndexedDB → a database named `trellis` exists with object stores (`questions`, `posts`, `post_queue`, `sessions`, `flashcards`, …) holding rows.
  (c) Application → Local Storage → `http://localhost:*` → the heavy keys are ABSENT: `trellis_questions`, `trellis_post_queue`, `trellis_daily_posts`, `trellis_post_history`, session keys, `trellis_flashcards`. Only lightweight prefs (settings, onboarding flags) remain.
result: PASSED (operator-confirmed 2026-05-21 — heavy keys gone from Local Storage; backend reads IndexedDB). NOTE: required a 55-07 dual-write fix — 55-05 had written heavy stores to BOTH localStorage and the DB, leaving localStorage primary; now IndexedDB is the sole heavy persistence.

### 2. Content persists across a hard reload (D-12 sync-read invariant)
expected: Ask a question (creates a question + anchor) and note its title. Hard-reload (Cmd+Shift+R). The question/anchor reappears immediately on Home/Graph with NO empty-state flash — proving the boot path hydrates SQLite → in-memory mirror → synchronous `getSync()` read before first paint.
result: PASSED (operator-confirmed 2026-05-21 — content rehydrated on hard reload, no empty-state flash)

### 3. OPFS quota headroom is categorically larger than localStorage (cheap numeric check)
expected: In the DevTools console run `await navigator.storage.estimate()`. The reported `quota` is in the hundreds-of-MB-to-GB range (browser-disk based), versus localStorage's ~5 MB cap — numerically demonstrating the quota relief without writing any large data.
result: PASSED (operator-confirmed 2026-05-21 — quota reported in MB–GB range)

### 4. Per-threshold debug knob UI
expected: Under the Debug-mode toggle in Settings → AI, the malicious-floor slider appears (clamped 0.35–0.70) alongside the anchor-dedup slider; the off-topic slider is GONE (retired by RAW-ARGMAX). The malicious-floor slider refuses to go below 0.35 or above 0.70. The D-02 refill instrumentation (`[refillQueue] …`, `[generateMorePosts] …`) appears in the DevTools console while swiping the feed. The knobs are hidden/inert when Debug mode is off (release behavior).
result: PASSED (operator-confirmed 2026-05-21 — malicious-floor + anchor-dedup sliders present, off-topic slider gone, floor clamped 0.35–0.70, refill logs visible, inert when debug off)

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- 55-05 shipped a dual-write (heavy stores written to BOTH localStorage and the DB; mirror hydrated from localStorage) so localStorage stayed primary and the quota wall was never escaped. Also, the browser SQLite backend (oo1.OpfsDb / opfs-sahpool) was unworkable on the main thread. RESOLVED by 55-07: unified on a single IndexedDBBackend (web + native WebView), made the in-memory mirror the sole sync read path hydrated from IndexedDB at boot (awaited before first render), preserved post-queue day-rollover + yesterday-snapshot off localStorage, and added a no-dual-write regression guard. Operator-confirmed heavy keys gone + IndexedDB active 2026-05-21.
