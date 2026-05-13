# Phase 45 Performance Audit

## Required Targets

| Target | Initial status | Evidence source | Notes |
|---|---|---|---|
| first paint | pending-profile | `npm run build` bundle and asset output | Build warns about a large main chunk and a large default background asset; runtime paint evidence still needed. |
| queue refill | pending-profile | `concept-feed.service.ts`, `post-queue.service.ts` | Promise mutex, 24-post threshold, and 32-post queue defaults are in place; refill timing still needs measurement. |
| masonry scroll | pending-profile | `HomeScreen.tsx`, `MasonryFeed.tsx` | Height-accumulating two-column layout and tile animations are current surfaces; frame/scroll evidence still needed. |
| GraphScreen Android drag lag | pending-profile | `.planning/notes/2026-05-09-graphscreen-drag-lag-android.md`, `GraphScreen.tsx` | Android WebView manual profiling target; no fix applied in this inventory task. |

## Baseline Commands

| Command | Working directory | Exit code | Result |
|---|---|---:|---|
| `npm run build` | `app/` | 0 | `tsc -b` and `vite build` succeed in 1.74s. |

Build warnings captured:

- Vite reports that `settings.service.ts`, `event-bus.ts`, `imageGeneration.service.ts`, `postFormatting.service.ts`, and `question.service.ts` are both dynamically and statically imported, so dynamic imports do not move those modules into separate chunks.
- Vite reports `dist/assets/trellis-bg-default-Ca5mjVu5.png` at 4,554.99 kB.
- Vite reports `dist/assets/index-BnDXUYbv.js` at 1,289.85 kB minified / 382.72 kB gzip.
- Vite emits the standard `Some chunks are larger than 500 kB after minification` warning with suggestions to use dynamic imports, manual chunks, or a higher chunk-size warning limit.

## Findings

| Area | Baseline finding | Severity | Next evidence needed |
|---|---|---|---|
| Startup bundle/assets | Production build succeeds but has one large JS entry chunk and one large image asset. | P2 until runtime paint evidence proves user-visible delay | Capture browser/Android first-paint timing or DevTools trace. |
| Queue refill | Source context confirms refill runs through existing services and queue thresholds; no timing recorded yet. | pending | Add temporary local timing or DevTools observation in a later profiling task. |
| Masonry feed | Source context confirms masonry is HomeScreen-owned with `MasonryFeed` rendering animated tiles. | pending | Observe populated feed scroll and frame behavior. |
| Graph mindmap Android interaction | Operator note reports Android-only warm-up lag: perceptible but usable, most visible at drag start, and stabilizing after a few seconds. | pending | Reproduce on Android device/emulator and capture cold vs warm drag evidence. |

## P0/P1 Closure Decisions

- No P0/P1 performance fix is justified from this inventory task alone.
- Build warnings are relevant to startup profiling but do not prove a blocker without runtime paint evidence.
- The Android graph interaction note remains a profiling target, not an automatic rewrite trigger.
- Later Phase 45 performance work should fix only localized issues that have measured evidence.

## Manual Android Evidence

The operator note describes an Android-only graph mindmap drag symptom. The interaction remains usable, but lag is perceptible, is most noticeable at the start of dragging, and stabilizes after a brief warm-up period. This task records the baseline only; it intentionally does not implement a performance fix.

## Decision Coverage

- D-10 is represented by the four required performance targets and the build baseline.
