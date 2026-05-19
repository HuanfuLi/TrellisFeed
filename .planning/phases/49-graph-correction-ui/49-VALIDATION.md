---
phase: 49
slug: graph-correction-ui
status: closed
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-17
closed: 2026-05-19
---

# Phase 49 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `49-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` (Node 20+) — `[VERIFIED: app/package.json scripts]` |
| **Config file** | `app/package.json` scripts: `test`, `test:main`, `test:actions` |
| **Quick run command** | `cd app && node --test tests/components/graph/<file>.test.mjs` (per-file, <2s) |
| **Full suite command** | `cd app && npm test` |
| **Estimated runtime** | ~6-8s added; full suite goes from ~144 → ~154 files |

---

## Sampling Rate

- **After every task commit:** Run the specific test file for the file changed (<2s)
- **After every plan wave:** Run `cd app && npm test` — full suite
- **Before `/gsd:verify-work`:** Full suite must be green (target <60s, no watch-mode flags)
- **Max feedback latency:** 60 seconds (full suite) / 2 seconds (per-file)

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRAPHUI-01 | Per-node-type action matrix (Root→toast; Branch→toast; Cluster→4 actions; Anchor→5 actions; QA→2 actions) | source-reading + behavioral | `node --test tests/components/graph/CorrectionCard.test.mjs` | ❌ W0 |
| GRAPHUI-01 | Long-press 480ms timer fires; drag-start at 8px transitions to drag mode; release-in-place opens correction card | behavioral | `node --test tests/hooks/useLongPressOrDrag.test.mjs` | ❌ W0 |
| GRAPHUI-01 | Click-after-long-press suppression via `didLongPress` ref | behavioral | `node --test tests/hooks/useLongPressOrDrag.test.mjs` | ❌ W0 |
| GRAPHUI-01 | Ghost-node mounts to `document.body` on drag-start; unmounts on drag-end / pointercancel | source-reading | `node --test tests/components/graph/DragOverlay.test.mjs` | ❌ W0 |
| GRAPHUI-01 | Magnetic snap math: ghost within 32px of target center triggers snap; beyond 32px ghost tracks finger | behavioral | `node --test tests/components/graph/DragOverlay.test.mjs` | ❌ W0 |
| GRAPHUI-01 | Valid drop target detection: anchor-on-cluster = Move; anchor-on-anchor = Merge; invalid = snap-back + toast | behavioral | `node --test tests/components/graph/DragOverlay.test.mjs` | ❌ W0 |
| GRAPHUI-01 | GraphScreen wires `correctionNode` state; long-press release sets it; tap-outside / X dismisses; tap on different node replaces; calls `graphCommandService` per action | source-reading | `node --test tests/screens/GraphScreen.correction-card.test.mjs` | ❌ W0 |
| GRAPHUI-01 | Pick-mode banner shows "Tap a cluster to move 'X' into it" with Cancel button (D-06); invalid tap → toast | source-reading + behavioral | `node --test tests/components/graph/PickModeBanner.test.mjs` | ❌ W0 |
| GRAPHUI-01 | Detach toast distinguishes re-anchored vs same-anchor (D-12) | behavioral | `node --test tests/screens/GraphScreen.detach-toast.test.mjs` | ❌ W0 |
| GRAPHUI-02 | ConfirmDialog renders open/closed; destructive prop swaps to `--danger` confirm button | behavioral | `node --test tests/components/ui/ConfirmDialog.test.mjs` | ❌ W0 |
| GRAPHUI-02 | Merge confirm renders side-by-side loser/survivor cards with badges; commits via `graphCommandService.merge(loserId, survivorId)` (D-08 convention) | source-reading + behavioral | `node --test tests/components/graph/MergeConfirmPreview.test.mjs` | ❌ W0 |
| GRAPHUI-02 | Delete confirm renders cascade explanation with child count; commits via `graphCommandService.delete()`; destructive CTA | behavioral | `node --test tests/screens/GraphScreen.delete-confirm.test.mjs` | ❌ W0 |
| GRAPHUI-02 | Soft prune commits + toast renders [Undo] action button; tap on [Undo] calls `graphCommandService.undo()` | behavioral | `node --test tests/components/Toast.action.test.mjs` + `node --test tests/screens/GraphScreen.prune-undo.test.mjs` | ❌ W0 |
| GRAPHUI-02 | Persistent UndoButton: enabled when journal non-empty, disabled when empty; tap on empty journal → "Nothing to undo" toast; tap on populated → `graphCommandService.undo()` + toast | behavioral | `node --test tests/components/graph/UndoButton.test.mjs` | ❌ W0 |
| GRAPHUI-02 | Reorg-in-progress (D-16): correction card shows paused row; drag-start blocked with toast; UndoButton disabled | source-reading + behavioral | `node --test tests/screens/GraphScreen.reorg-gate.test.mjs` | ❌ W0 |
| GRAPHUI-03 | Reload survival: after `graphCommandService.rename()` → remount GraphScreen → mutation reflected in nodes state | behavioral | `node --test tests/screens/GraphScreen.reload-survival.test.mjs` | ❌ W0 |
| — | i18n: `graph.correction.*` namespace lands in all 4 locale bundles with identical key sets | parity | `node --test tests/locales/bundle-parity.test.mjs` | ✅ existing (~40 new keys added) |

---

## Wave 0 Requirements

Wave 0 must create 14 new test files (3-8 tests each; ~60-100 new tests total):

- [ ] `app/tests/hooks/useLongPressOrDrag.test.mjs` — GRAPHUI-01 gesture differentiation
- [ ] `app/tests/components/graph/CorrectionCard.test.mjs` — GRAPHUI-01 action matrix
- [ ] `app/tests/components/graph/DragOverlay.test.mjs` — GRAPHUI-01 drag mechanics + drop semantics
- [ ] `app/tests/components/graph/MergeConfirmPreview.test.mjs` — GRAPHUI-02 merge preview
- [ ] `app/tests/components/graph/UndoButton.test.mjs` — GRAPHUI-02 undo button
- [ ] `app/tests/components/graph/PickModeBanner.test.mjs` — GRAPHUI-01 menu+tap fallback
- [ ] `app/tests/components/ui/ConfirmDialog.test.mjs` — GRAPHUI-02 modal mechanics
- [ ] `app/tests/components/Toast.action.test.mjs` — extended toast signature
- [ ] `app/tests/screens/GraphScreen.correction-card.test.mjs` — GraphScreen wiring
- [ ] `app/tests/screens/GraphScreen.reorg-gate.test.mjs` — reorg-in-progress gate
- [ ] `app/tests/screens/GraphScreen.reload-survival.test.mjs` — GRAPHUI-03
- [ ] `app/tests/screens/GraphScreen.detach-toast.test.mjs` — D-12 detach toast variants
- [ ] `app/tests/screens/GraphScreen.delete-confirm.test.mjs` — GRAPHUI-02 delete flow
- [ ] `app/tests/screens/GraphScreen.prune-undo.test.mjs` — GRAPHUI-02 prune+undo flow

**Framework install:** None — `node --test` is built-in.

**Sampling continuity:** Every task in every plan MUST have an automated verify reference (the test file for the changed surface). No 3-consecutive-tasks-without-verify.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Magnetic snap "feels right" at default 0.5× scale on a real Android device | GRAPHUI-01 D-05 | Requires touch hardware + visual judgment | Operator UAT: open graph with ≥5 anchors visible; long-press an anchor; slowly drag toward another anchor; confirm halo activates within ~32px and ghost snaps. Tune 24-48px band if it feels off. |
| Haptic feedback fires on long-press + drop-onto-valid-target | GRAPHUI-01 D-01 | Web platform has no haptics; only verifiable on Android/iOS Capacitor build | Operator UAT: long-press a node — feel light tap. Drag + drop onto a cluster — feel medium tap. |
| Drag does not fight MindElixir's pan/zoom | GRAPHUI-01 R1 | Requires running app + pinch-to-zoom + multi-finger gestures | Operator UAT: pinch-zoom out, long-press a deep anchor, drag toward a different cluster. Confirm gesture commits without map snapping back to default scale. |
| Pick-mode banner doesn't break Header positioning | GRAPHUI-01 R19 + CLAUDE.md §"Header positioning" | Requires running app + checking visual position of Header across keyboard-open and tab-swipe transitions | Operator UAT: enter pick-mode; swipe tabs left/right; confirm Header stays in place. |

---

## Validation Sign-Off

- [x] All tasks have `<acceptance_criteria>` with automated verify references OR Wave 0 dependency on the corresponding test file
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers all 14 NEW test files above
- [x] No watch-mode flags (`--watch`, `node --test --watch`, etc.)
- [x] Feedback latency <60s (full suite) / <2s (per-file)
- [x] i18n bundle parity green AFTER Sonnet translation step (subagent runs as a Wave 0 or Wave-final task before bundle-parity check)
- [x] `nyquist_compliant: true` set in frontmatter only after all checkboxes above are ticked

**Approval:** approved 2026-05-19 (UAT pass on Pixel 10 Pro; see 49-06-SUMMARY.md)

---

## Operator UAT result (2026-05-19, Pixel 10 Pro)

| Test | Behavior | Status |
|------|----------|--------|
| 1 | Long-press → CorrectionCard; post-recognition drag transitions cleanly (no pan, no snap-back) | ✅ Pass after 49-06.2 (capture-phase pointermove + state-machine feed) |
| 2 | Haptic feedback at 480ms recognition tick | ✅ Pass |
| 3 | Viewport preservation on drop / undo at non-default zoom | ⚠️ **Known issue — DEFERRED to Phase 53.** Drop/undo currently resets to default 0.5× center. Four attempts (49-06.3 + 49-06.4 variants) failed; rolled back to 49-06.2. Root cause appears to be a StrictMode + MindElixir.init ordering hazard requiring on-device console.log instrumentation to diagnose. Documented at `c6ac6170`. |
| 4 | PickMode banner persists across SwipeTabContainer tab swipe | ✅ Pass |
| 5 | PickMode cancel restores CorrectionCard at ORIGINAL coords | ✅ Pass |
| 6 | Reorg gate blocks gestures + re-enables after REORG_COMPLETED | ✅ Pass |
| 7 | QA detach (with cascade-cleanup + extractor fixes) | ✅ Pass — surfaced two pre-existing design bugs in detach + re-classify (Phase 33 + Phase 48), both fixed inline at commit `2c296870`. Detach itself was always working. |
| 8 | Rename undo | ✅ Pass — rename perf improvement at commit `c2f6b8c4` (fire-and-forget embed) |
| 9 | Prune snackbar (with hierarchy preservation) | ✅ Pass — surfaced cascade-missing bug in trellisActionsService.prune, fixed at commit `8ea088c5` |
| 10 | i18n locale switching | ✅ Pass |

**Provenance:** Pixel 10 Pro · Android 14 · Capacitor 8 build `7aba5bd5...8ea088c5`
