# Phase 45 Performance Audit

## Required Targets

| Target | Evidence | Severity | Action |
|---|---|---|---|
| first paint | `cd app && npm run build` exits 0. Vite reports static/dynamic import chunk warnings, `dist/assets/trellis-bg-default-Ca5mjVu5.png` at 4,554.99 kB, and `dist/assets/index-BnDXUYbv.js` at 1,289.85 kB minified / 382.72 kB gzip, followed by `Some chunks are larger than 500 kB after minification`. No browser or Android first-paint trace was available in this plan. | P2-defer | defer broad code-splitting to v1.6 unless device trace proves P0/P1 |
| queue refill | `cd app && node --test tests/services/refill-mutex.test.mjs tests/services/refill-queue-integration.test.mjs` exits 0 after a localized stale source-reading regex fix. Source inspection confirms `postQueueService.needsRefill()` is `_state.posts.length < REFILL_THRESHOLD` with `REFILL_THRESHOLD = 24`, `refillQueue` keeps the cheap pre-check before `_refillMutex.run(async () => { ... })`, and `generateMorePosts` awaits `refillQueue(questions)` only on empty-dequeue retry while fire-and-forgetting background refill when below threshold. | P3-no-code | no code change; existing mutex and threshold guards cover the synchronous-loop regression class |
| masonry scroll | Source inspection confirms `MasonryFeed.tsx` uses calibrated per-style height estimates, splits items into columns by accumulated height, records tile heights via layout effects, and wraps the feed in `MotionConfig reducedMotion="user"` with scoped `AnimatePresence` column animation. No frame-drop trace was available. | P2-manual-follow-up | no speculative animation rewrite |
| GraphScreen Android drag lag | GraphScreen Android manual evidence: present. `adb devices` returned `emulator-5554 device`; emulator details were Android 16, model `sdk_gphone64_arm64`, WebView `com.google.android.webview 142.0.7444.171`. Current repo web bundle was installed via Capacitor, then a 24-node local graph was seeded in WebView localStorage. Cold first-drag `gfxinfo` after reset rendered 39 frames with 37 janky frames (94.87%), 81ms p50, 121ms p90, 150ms p95, 30 missed vsync, 31 slow UI thread, and 37 slow draw/frame-deadline misses. Warmed subsequent drag rendered 21 frames with 12 janky frames (57.14%), 46ms p50, 133ms p90, 150ms p95, 6 missed vsync, 6 slow UI thread, and 12 slow draw/frame-deadline misses. | P1-local-fix-candidate | apply only localized MindElixir container layer/touch mitigation; no Header ancestor or broad graph rewrite |

## Baseline Commands

| Command | Working directory | Exit code | Result |
|---|---|---:|---|
| `npm run build` | `app/` | 0 | `tsc -b` and `vite build` succeed in 1.73s; Vite emits large asset/chunk and static/dynamic import warnings. |
| `node --test tests/services/refill-mutex.test.mjs tests/services/refill-queue-integration.test.mjs` | `app/` | 1 then 0 | First run exposed a stale source-reading import regex; after Rule 3 test correction, rerun passed 16/16. |
| `adb devices` | repo root | 0 | Attached emulator row present: `emulator-5554 device`. |

### `cd app && npm run build`

```text
> app@0.0.0 build
> tsc -b && vite build

vite v7.3.1 building client environment for production...
✓ 2660 modules transformed.
[plugin vite:reporter]
(!) /Users/Code/EchoLearn/app/src/services/settings.service.ts is dynamically imported by /Users/Code/EchoLearn/app/src/services/canonical-knowledge.service.ts ... dynamic import will not move module into another chunk.
[plugin vite:reporter]
(!) /Users/Code/EchoLearn/app/src/lib/event-bus.ts is dynamically imported by /Users/Code/EchoLearn/app/src/services/canonical-knowledge.service.ts ... dynamic import will not move module into another chunk.
[plugin vite:reporter]
(!) /Users/Code/EchoLearn/app/src/services/imageGeneration.service.ts is dynamically imported by /Users/Code/EchoLearn/app/src/services/concept-feed.service.ts but also statically imported ... dynamic import will not move module into another chunk.
[plugin vite:reporter]
(!) /Users/Code/EchoLearn/app/src/services/postFormatting.service.ts is dynamically imported by /Users/Code/EchoLearn/app/src/services/concept-feed.service.ts but also statically imported ... dynamic import will not move module into another chunk.
[plugin vite:reporter]
(!) /Users/Code/EchoLearn/app/src/services/question.service.ts is dynamically imported by /Users/Code/EchoLearn/app/src/services/canonical-knowledge.service.ts ... dynamic import will not move module into another chunk.
dist/assets/trellis-bg-default-Ca5mjVu5.png           4,554.99 kB
dist/assets/index-BCggJvOf.css                           60.80 kB │ gzip:  16.45 kB
dist/assets/vendor-mindmap-CQf7cx1C.js                   90.67 kB │ gzip:  29.62 kB
dist/assets/vendor-react-CSVxCaDj.js                    103.59 kB │ gzip:  34.96 kB
dist/assets/vendor-motion-DVCBvlaF.js                   134.66 kB │ gzip:  44.47 kB
dist/assets/vendor-markdown-CLD5S6tw.js                 157.40 kB │ gzip:  47.56 kB
dist/assets/index-BnDXUYbv.js                         1,289.85 kB │ gzip: 382.72 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.73s
```

### `cd app && node --test tests/services/refill-mutex.test.mjs tests/services/refill-queue-integration.test.mjs`

First run:

```text
tests 16
suites 3
pass 15
fail 1

failing tests:
imports createPromiseMutex from the leaf module
AssertionError [ERR_ASSERTION]: concept-feed.service.ts must import createPromiseMutex from refill-mutex.ts
expected: /import\s*\{\s*createPromiseMutex\s*\}\s*from\s*['"]\.\/refill-mutex['"]/
actual included: import { createPromiseMutex } from './refill-mutex.ts';
```

Rule 3 blocking fix: `app/tests/services/refill-mutex.test.mjs` now accepts the repository's direct `.ts` import convention for this leaf module.

Rerun:

```text
tests 16
suites 3
pass 16
fail 0
duration_ms 91.44525
```

### `adb devices`

```text
List of devices attached
emulator-5554	device
```

## Source Inspection Notes

### Queue refill

- `app/src/services/post-queue.service.ts` defines `REFILL_THRESHOLD = 24`.
- `postQueueService.needsRefill()` returns `_state.posts.length < REFILL_THRESHOLD`.
- `app/src/services/concept-feed.service.ts` imports `createPromiseMutex` from `./refill-mutex.ts`, instantiates `_refillMutex`, keeps a cheap `needsRefill()` pre-check, and wraps generation in `_refillMutex.run(async () => { ... })`.
- `refillQueue` walks 24 derived-list entries to restore one 8-post swipe of headroom above the 24-post threshold.

### Masonry scroll

- `MasonryFeed.tsx` estimates per-style heights for first-pass column assignment.
- Column split is accumulated-height based, not count based.
- DOM measurements are recorded after render and refine subsequent batches.
- `MotionConfig reducedMotion="user"` scopes reduced-motion behavior to the masonry feed.
- Existing animation is opacity plus small Y-offset; no broad animation rewrite is justified without frame evidence.

### GraphScreen Android drag lag

- `GraphScreen.tsx` still has the localized MindElixir container region:

```tsx
<div ref={containerRef} data-no-swipe-nav="true" style={{ width: '100%', height: '100%' }} />
```

- No layer-promotion mitigation was applied because the plan requires actual attached Android device/emulator manual evidence before deciding whether the lag is a P1 local fix candidate.
- GraphScreen Android manual evidence: present.
- Android evidence shows cold first-drag jank improves after warm-up but does not disappear, supporting a P1 localized container mitigation rather than a broad MindElixir rewrite.

## P0/P1 Closure Decisions

- First paint: P2-defer. Build warnings identify plausible startup weight, but without browser/Android paint evidence this plan should not ship broad code-splitting or asset rewrites.
- Queue refill: P3-no-code. Targeted queue/refill tests pass after the stale test regex correction, and source inspection confirms the mutex and threshold guards remain in place.
- Masonry scroll: P2-manual-follow-up. Source structure is already the height-balanced/reduced-motion design; no frame trace proves a P0/P1 scroll issue.
- GraphScreen Android drag lag: P1-local-fix-candidate. Attached-emulator evidence reproduced the Android-only drag-start/warm-up lag and supports a localized MindElixir container layer/touch mitigation only.

## Manual Android Evidence

GraphScreen Android manual evidence: present.

Evidence source:

- Device/emulator: `emulator-5554 device`.
- Android version: 16.
- Product model: `sdk_gphone64_arm64`.
- WebView: `com.google.android.webview 142.0.7444.171` (`targetSdkVersion=36`).
- App bundle source: current repo production web build installed through Capacitor on the attached emulator.
- Local graph seed: 24 WebView localStorage nodes, including 6 cluster nodes, 6 anchor nodes, and 12 QA children, used only for reproducible device evidence.

Reproduction steps:

1. Confirmed `adb devices` showed `emulator-5554 device`.
2. Confirmed emulator boot, Android version, model, and WebView package via `adb shell getprop` and `adb shell dumpsys webviewupdate`.
3. Ran `cd app && npx cap sync android`.
4. Ran `cd app && npx cap run android --target emulator-5554 --no-sync`.
5. Seeded onboarding-complete settings and the local graph through WebView DevTools `Runtime.evaluate`.
6. Opened GraphScreen with the bottom navigation.
7. Reset frame stats, recorded screen, and captured cold first-drag using `adb shell input swipe 830 900 240 900 1000` followed by `adb shell input swipe 780 1020 300 1020 800`.
8. Performed warm-up pan gestures, reset frame stats, recorded screen, and captured the warmed subsequent drag with the same swipe sequence.

Cold first-drag evidence:

```text
Total frames rendered: 39
Janky frames: 37 (94.87%)
Janky frames (legacy): 39 (100.00%)
50th percentile: 81ms
90th percentile: 121ms
95th percentile: 150ms
99th percentile: 150ms
Number Missed Vsync: 30
Number High input latency: 4
Number Slow UI thread: 31
Number Slow issue draw commands: 37
Number Frame deadline missed: 37
```

Warmed subsequent-drag evidence:

```text
Total frames rendered: 21
Janky frames: 12 (57.14%)
Janky frames (legacy): 20 (95.24%)
50th percentile: 46ms
90th percentile: 133ms
95th percentile: 150ms
99th percentile: 150ms
Number Missed Vsync: 6
Number High input latency: 16
Number Slow UI thread: 6
Number Slow issue draw commands: 12
Number Frame deadline missed: 12
```

Evidence artifacts collected locally:

- `/tmp/graph-cold.mp4`
- `/tmp/graph-warm.mp4`
- `/tmp/graph-cold-gfxinfo.txt`
- `/tmp/graph-warm-gfxinfo.txt`
- `/tmp/trellis-graph-after-cold-drag.png`
- `/tmp/trellis-graph-after-warm-drag.png`

## Plan 45-04 Verification

| Command | Working directory | Exit code | Result |
|---|---|---:|---|
| `npm run build` | `app/` | 0 | TypeScript build and Vite production build pass. Vite still reports the known large chunk/static-dynamic import warnings; main app bundle is `dist/assets/index-Co92EIVp.js` at 1,289.92 kB minified / 382.74 kB gzip. |
| `npx tsc -b --noEmit --pretty false` | `app/` | 0 | Typecheck passes without emitting files. |
| `npm run lint` | `app/` | 0 | ESLint exits 0 with 24 existing warnings and no errors. |
| `node --test tests/screens/GraphScreen.performance-layer.test.mjs` | `app/` | 0 | GraphScreen layer guard passes 2/2 tests. |

persistent telemetry added: no.

## Decision Coverage

- D-10 is represented by the four required performance targets and their evidence rows.
- D-11 is represented by the P0/P1 closure decisions: no broad rewrite or speculative optimization shipped.
- D-12 is represented by the absence of persistent telemetry or user-visible diagnostics.
