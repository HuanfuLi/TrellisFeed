# GraphScreen mindmap drag lag on Android (regression)

**Date:** 2026-05-09
**Surfaced during:** Phase 38 device UAT (HUMAN-UAT.md operator session)
**Platform:** Android only (iOS not reported as affected)
**Severity:** Perceptible but usable; smooths out after a brief warm-up period
**Suspected age:** Recently introduced (operator: "should be introduced recently")

## Symptom

Dragging nodes / panning the mindmap on `GraphScreen` feels laggy on Android Chromium WebView.
The lag is most noticeable at the start of the drag interaction; after a few seconds of
continued interaction the framerate appears to stabilize (warm-up pattern).

## Hypotheses to investigate

1. **Initial layout / paint cost on cold-touched canvas** — first drag triggers a heavy
   reflow / re-style that subsequent frames avoid (caches warm).
2. **React.memo / re-render churn during drag** — some ancestor invalidates per-frame on the
   first burst (Phase 33 React.memo work was on Home, not Graph; possibly an unrelated
   Graph render path lacks memoization).
3. **Will-change / transform layer promotion absent on draggable group** — Android Chromium
   WebView is unforgiving without explicit GPU layer hints.
4. **Recent dependency bump or React 19 concurrent-rendering interaction** — check
   `git log --since="2 weeks" -- app/src/screens/GraphScreen.tsx app/src/components/Graph*`
   for the suspect commit.

## Why deferred (not Phase 38 in-scope)

Phase 38's TECHDEBT-04 covered exactly 2 deferred tests (touch-target feel + React.memo
correctness on Home). Both passed on iOS+Android. Graph drag perf was outside the
test contract — captured here for triage in v1.5 (likely Phase 44 deps refresh or
Phase 45 code-quality sweep, or a dedicated perf phase if blast radius warrants).

## Suggested next action

`/gsd:discuss-phase` for whichever v1.5 phase bucket fits — frame this as
"GraphScreen mindmap drag latency on Android Chromium WebView, recently introduced,
warm-up pattern indicates layer / memo / paint issue, not algorithmic."
