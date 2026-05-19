---
phase: 49-graph-correction-ui
plan: 06
subsystem: gesture-engine + graph-hygiene
tags: [gap-closure, gesture, mind-elixir, prune, detach, move, rename, extractors]

requires:
  - phase: 49-graph-correction-ui
    provides: 5 prior plans (01-05) shipping the by-spec correction UI. UAT after 49-05 surfaced one gesture-engine bug (long-press-release vs recognition) plus five latent design bugs discovered while testing the gap fix.
provides:
  - Gesture-engine rewire: long-press recognition + drag transition + MindElixir pan suppression without phantom-finger leak (the 49-06.1 + 49-06.2 fixes)
  - Self-snap merge bug fix (drop-on-origin no longer opens self-merge dialog)
  - Extractor blindness fix (extractUniqueBranches + extractClustersUnderBranch now include cluster + anchor nodes, not just QA leaves)
  - Cascade cleanup on detach + move (emptied anchor / cluster auto-flagged; undo restores)
  - Rename perf via fire-and-forget embed (instant title commit; async vector patch with race-guard)
  - Prune cascade preserves 4-layer hierarchy (anchor + QA leaves flagged together; undo restores precisely)
affects:
  - 49-VALIDATION.md — flipped nyquist_compliant: true with Test 3 deferred as known issue

tech-stack:
  added: []
  patterns:
    - "Capture-phase pointermove suppression — capture-phase listener BOTH drives the state machine (activeMachine.onPointerMove) AND calls stopPropagation, so MindElixir's bubble-phase pan handler stays silent for the duration of the gesture. The drive-state-machine-first ordering is load-bearing (49-06.2 inline comment); driving second loses post-recognition moves and the 8px drag threshold never trips."
    - "Fire-and-forget embed on rename — synchronous title patch commits inside the mutex, journal append + GRAPH_UPDATED emit happen at command boundary, then embedText runs async after the mutex releases. Race-guard on the async patch (refreshed.title === trimmed) prevents stale embeds clobbering a subsequent rename. Mirrors detach's classify-and-anchor-incremental pattern."
    - "Cascade soft-delete via flagged=true — emptied anchor / cluster on detach + move and QA leaves on prune use questionService.patchQuestion({ flagged: true }) (silent — preserves the D-17 single-emit-per-command invariant). Undo flips flagged back. No full-record resurrection needed; the row never leaves storage."
    - "Journal-driven precise undo — prune.after.cascadedQaIds records EXACTLY which QAs were cascaded. Undo passes that list to unpruneQuestion so off-topic-flagged QAs that happened to live under the pruned anchor stay flagged."

key-files:
  created:
    - .planning/phases/49-graph-correction-ui/49-06-SUMMARY.md
  modified:
    - app/src/screens/GraphScreen.tsx (gesture engine rewire + self-snap filter)
    - app/src/hooks/useLongPressOrDrag.ts (onLongPressRelease → onLongPressRecognized)
    - app/src/services/canonical-knowledge.service.ts (extractor union)
    - app/src/services/graph-command.service.ts (detach + move cascade; rename fire-and-forget; prune cascade journal)
    - app/src/services/trellis-actions.service.ts (prune cascades to QAs; unpruneQuestion accepts cascadedQaIds opt)
    - app/src/services/question.service.ts (getPrunedQuestions adds isAnchorNode filter)
    - app/tests/screens/GraphScreen.gesture-isolation.test.mjs (assertions for capture-phase + state-machine feed + self-snap exclusion)
    - app/tests/services/_actions-mock-question.mjs (getPrunedQuestions filter mirrors prod)
    - app/tests/services/graph-command-service.{detach,move,rename}.test.mjs (cascade + perf tests)
    - app/tests/services/graph-command-service.undo.test.mjs (prune cascade undo precision)
    - app/tests/services/trellis-prune.test.mjs (cascade tests)
    - app/tests/canonical-knowledge.test.mjs (extractor union tests)
    - app/tests/canonical-knowledge-pipeline.test.mjs (extractor tests updated to assert new union behavior)
  uat-known-issue:
    - .planning/phases/49-graph-correction-ui/49-VALIDATION.md (Test 3 deferred — viewport reset on drop/undo at non-default zoom)

---

## What shipped

### Plan 49-06 charter (gesture engine fix)

The on-device UAT after Plan 49-05 flagged: long-press menu was firing on finger RELEASE instead of at the 480ms timer tick, and trying to drag after recognition still panned the canvas. Plan 49-06 rewired:

1. **`useLongPressOrDrag`** — renamed callback `onLongPressRelease` → `onLongPressRecognized` and fired it INSIDE the 480ms setTimeout alongside `didLongPress = true` + haptic. Post-recognition pointermoves over 8px transition to drag mode via `opts.onDragStart` + `opts.onDragMove`.
2. **`GraphScreen.tsx`** (49-06.1) — replaced tier-a/b/setPointerCapture defenses with a capture-phase pointermove listener that calls `e.stopPropagation()`. Tier-a/b had been preempting MindElixir's pointerup cleanup of its internal pinch-zoom Map (line 960), stranding a pointerId per long-press and tripping pinch on the next single-finger gesture ("phantom finger").
3. **`GraphScreen.tsx`** (49-06.2) — the capture-phase listener also drives `activeMachine.onPointerMove(e)` BEFORE `stopPropagation()`. Without this feed the bubble-phase `handlePointerMove` never fires for the state machine, so the 8px drag-threshold transition never trips. Operator-reported "long-press shows card but node can't move" was this exact failure mode.

UAT Tests 1, 2 PASS on Pixel 10 Pro.

### UAT-surfaced bonus fixes

While running the regression sweep, five additional design bugs surfaced. All were pre-existing (Phase 33 / 48 code), all fixed inline:

| Commit | Fix | Source bug |
|--------|-----|-----------|
| `a8bd34f7` | Drag-snap excludes source node | drop-on-origin opened a self-merge dialog with loser === survivor |
| `2c296870` | Extractor union + detach/move cascade cleanup | (a) `extractUniqueBranches` / `extractClustersUnderBranch` skipped cluster + anchor nodes, hiding labels from the LLM step-1/step-2 prompt → forced duplicate creation ("Japanese Writing Systems" near-duplicate). (b) detach + move decremented qaCount but didn't cascade-clean emptied parents. |
| `c2f6b8c4` | Rename fire-and-forget embed | rename awaited embedText inside the mutex, blocking success on a 200-2000ms network roundtrip |
| `8ea088c5` | Prune cascades to QA leaves | prune flagged only the anchor; leaves became visible orphans, promoted to anchor-looking nodes in the renderer |

### Deferred to Phase 53 — Test 3 (viewport preservation on drop / undo)

Drop / undo at non-default zoom (e.g. zoomed in 1.5×) currently resets the viewport to the default 0.5× center. Four attempts to fix were rolled back (commit `c6ac6170`):

- 49-06.3 (`6ffea10c`): capture/restore `map.style.transform` + `scaleVal` across destroy+rebuild. Did not survive `MindElixir.init()`.
- 49-06.4 (`295a1d05`): split Effect A (one-time init) + Effect B (`mei.refresh(newData)`). Empty viewport.
- 49-06.4 (`61f5f77b`): boolean first-run skip on Effect B. Empty viewport (StrictMode persisted boolean across double-mount).
- 49-06.4 (`2069c109`): ref-by-data first-run skip. Still failed in web browser.

Root cause likely a React 19 StrictMode + MindElixir.init ordering hazard. Further attempts need on-device console.log instrumentation rather than blind iteration. **Tracked as Phase 53 ticket.**

## Test counts

| Suite | Before | After | Delta |
|-------|--------|-------|-------|
| `test:main` | 1244 | 1260 | +16 (extractor union, self-snap, cascade extractor tests) |
| `test:actions` | 133 | 149 | +16 (detach cascade, move cascade, rename two-phase, rename race-guard, prune cascade × 5, undo precision) |
| **Total** | **1377** | **1409** | **+32** |

All green. Typecheck clean. Capacitor Android sync succeeds.

## Phase 53 follow-up tickets (to be planned)

1. **Test 3 viewport preservation** — diagnose with on-device instrumentation; needs Effect-split design that survives StrictMode + MindElixir.init.
2. **Plural / fuzzy coercion** at branch + cluster level — extractors now show the LLM the canonical labels, but if it still proposes "Japanese Writing Systems" the current `.trim().toLowerCase()` coercion won't catch the trailing s. Embedding-similarity pre-check at branch/cluster level would mirror the anchor-level fix from Phase 33 UAT-4.
3. **Block-malicious-prompt feedback** (carry-over from earlier user feedback — `feedback_filter_redesign_not_tuning.md`).

## Provenance

- Operator: HuanfuLi
- Device: Pixel 10 Pro · Android 14 · Capacitor 8
- Build trace: `7aba5bd5` (phase context) → `8ea088c5` (prune cascade)
- UAT date: 2026-05-19
