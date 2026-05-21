---
status: partial
phase: 55-algorithm-mechanism-tuning
source: [55-VERIFICATION.md]
started: 2026-05-21
updated: 2026-05-21
---

## Current Test

[awaiting human testing]

## Tests

### 1. Heavy stores live in OPFS SQLite, not localStorage (structural quota-relief proof)
expected: After normal light use (ask 1–2 questions, scroll the feed once) in `npm run dev` (Chrome, localhost), DevTools confirms the heavy data moved off localStorage into the OPFS-backed SQLite file — no bulk image generation needed.
how: DevTools → Application tab.
  (a) Storage → confirm an OPFS SQLite file exists. In console: `for await (const [k] of (await navigator.storage.getDirectory()).entries()) console.log(k)` — a `.sqlite3` (e.g. `trellis.sqlite3`) entry should be listed.
  (b) Local Storage → `http://localhost:*` → confirm the heavy keys are ABSENT: `trellis_questions`, `trellis_post_queue`, `trellis_daily_posts`, `trellis_post_history`, session keys, `trellis_flashcards`. Only lightweight prefs (settings, onboarding flags) should remain.
result: [pending]

### 2. Content persists across a hard reload (D-12 sync-read invariant)
expected: Ask a question (creates a question + anchor) and note its title. Hard-reload (Cmd+Shift+R). The question/anchor reappears immediately on Home/Graph with NO empty-state flash — proving the boot path hydrates SQLite → in-memory mirror → synchronous `getSync()` read before first paint.
result: [pending]

### 3. OPFS quota headroom is categorically larger than localStorage (cheap numeric check)
expected: In the DevTools console run `await navigator.storage.estimate()`. The reported `quota` is in the hundreds-of-MB-to-GB range (browser-disk based), versus localStorage's ~5 MB cap — numerically demonstrating the quota relief without writing any large data.
result: [pending]

### 4. Per-threshold debug knob UI
expected: Under the Debug-mode toggle in Settings → AI, three labeled range sliders appear (off-topic, malicious, anchor-dedup). The malicious slider refuses to go below 0.78 or above 0.85. The D-02 refill instrumentation (`[refillQueue] …`, `[generateMorePosts] …`) appears in the DevTools console while swiping the feed. The knobs are hidden/inert when Debug mode is off (release behavior).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
