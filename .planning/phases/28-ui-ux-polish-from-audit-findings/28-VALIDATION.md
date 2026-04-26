---
phase: 28
slug: ui-ux-polish-from-audit-findings
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-16
validated: 2026-04-16
re_audited: 2026-04-25
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` + esbuild tsx loader (via `tests/components/_trellis-tsx-loader.mjs`) |
| **Config file** | Per-test-file; pattern uses `import.meta.resolve` + esbuild register |
| **Quick run command** | `cd app && node --test tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs` |
| **Full suite command** | `cd app && npm test` |
| **Estimated runtime** | ~10–15 seconds (Wave 0 inheriting Phase 27's 48+ tests) |

---

## Sampling Rate

- **After every task commit:** Run quick command (`node --test tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs`) — <1s
- **After every plan wave:** Run `cd app && npm test` — full suite green
- **Before `/gsd:verify-work`:** Full suite must be green + `npx vite build` must succeed + manual UAT checklist below complete
- **Max feedback latency:** <15s

---

## Per-Task Verification Map

*Plan IDs will be assigned by gsd-planner. Task IDs follow the pattern `{plan}-{wave}-{task}`. Decision IDs (D-XX) map to CONTEXT.md decisions.*

| Decision | Wave | Behavior | Test Type | Automated Command | File Exists | Status |
|----------|------|----------|-----------|-------------------|-------------|--------|
| D-04 | A | Suggested Moves section header renders with `t('planner.suggestedMoves')` | unit | grep assertion on rendered output (research says this already renders at PlannerScreen.tsx:130; planner verifies styling scope) | ✅ existing | ⬜ pending |
| D-05-LOGIC | A | `computeTargetX(index, width)` pure helper returns `-index * width` | unit | `cd app && node --test tests/lib/swipe-tab-logic.test.mjs` | ✅ existing (Phase 22); add case | ⬜ pending |
| D-05-INTEGRATION | A | `stripX` updates on simulated `visualViewport.resize` event | manual | manual UAT (DOM + MotionValue requires live browser) | ❌ Manual | ⬜ pending |
| D-06-LOGIC | A | Nav `y` target derivable from `isTopLevelScreen` (pure bool → string transform) | unit | new `tests/components/BottomNavigation.slide.test.mjs` | ❌ Wave 0 | ⬜ pending |
| D-06-RUNTIME | A | Nav slides down on sub-screen entry, up on top-level entry | manual | manual UAT (Framer Motion animation requires live browser) | ❌ Manual | ⬜ pending |
| D-07-LOGIC | B | `scrollTop > 4` predicate yields correct boolean | unit | inline helper test — trivial; may fold into Header test | ❌ Wave 0 (optional — trivial) | ⬜ pending |
| D-08 | B | BottomNavigation has `borderTop` on top-level screens | unit | grep assertion on component output | ✅ existing (borderTop at BottomNavigation.tsx:147 per research — may be no-op or cosmetic tweak only) | ⬜ pending |
| D-09 | B | Consolidated consistency pass items | manual | manual UAT per item identified by planner | ❌ Manual | ⬜ pending |
| D-10-LOGIC | C | Leaf `shake` variant returns correct rotate array `[0, 4, -4, 2, 0]` | unit | new `tests/components/TrellisLeaf.shake.test.mjs` | ❌ Wave 0 | ⬜ pending |
| D-11 | C | `hapticImpactLight()` invoked on leaf tap | unit | mock `@capacitor/haptics`; assert invocation | ❌ Wave 0 (small) | ⬜ pending |
| D-12-LOGIC | C | `focusedAnchorId === leaf.anchor.id` → `focused={true}` prop propagates | unit | new `tests/components/TrellisCanvas.focus.test.mjs` | ❌ Wave 0 | ⬜ pending |
| D-12-RUNTIME | C | Pulse visible for ~2s; clears on action/navigate | manual | manual UAT | ❌ Manual | ⬜ pending |
| D-13-LOGIC | C | `leafAnimationMask(count, index, inView)` returns true only when count ≤ 30 OR in-view | unit | new `tests/services/trellis-perf-mask.test.mjs` | ❌ Wave 0 | ⬜ pending |
| D-13-RUNTIME | C | 50+ leaf canvas animates only visible leaves | manual | manual UAT via seeded test fixture | ❌ Manual | ⬜ pending |
| D-14-BUNDLE | C | `graph.headerTitle` value equals expected per locale (en: "Knowledge Graph", zh: "知识图谱", es: "Grafo de conocimiento", ja: "ナレッジグラフ") | unit | extend `tests/locales/bundle-parity.test.mjs` with value assertion | ✅ existing; add value test | ⬜ pending |
| D-14-RUNTIME | C | GraphScreen Header title matches `t('graph.headerTitle')` in each locale | manual | UAT: switch locale in Settings → verify graph header | ❌ Manual | ⬜ pending |
| D-15-LOGIC | D | AskScreen recent-questions empty-state renders when `recent.length === 0` | unit | small DOM assertion test | ❌ Wave 0 (small) | ⬜ pending |
| D-15-RUNTIME | D | Row tap navigates to `/ask/:id`; 2-line ellipsis applies | manual + integration | manual UAT; optional testing-library test | ❌ Manual | ⬜ pending |
| D-16 | D | `active-squish` class applied to chip on press | unit | DOM assertion on rendered output | ❌ Wave 0 (small) | ⬜ pending |
| D-17/D-18/D-19 | D | Empty-state copy + Graph tweaks + residual polish | manual | manual UAT per item | ❌ Manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test files to add or extend BEFORE phase execution tasks commit:

- [ ] `app/tests/lib/swipe-tab-logic.test.mjs` — extend with `computeTargetX` resize-handler case (file exists from Phase 22)
- [ ] `app/tests/components/BottomNavigation.slide.test.mjs` — assert `y`-target derivation from `isTopLevelScreen`
- [ ] `app/tests/components/TrellisLeaf.shake.test.mjs` — assert shake variant `rotate` array
- [ ] `app/tests/components/TrellisCanvas.focus.test.mjs` — assert `focused` prop propagation from `focusedAnchorId`
- [ ] `app/tests/services/trellis-perf-mask.test.mjs` — assert perf mask predicate
- [ ] `app/tests/locales/bundle-parity.test.mjs` — extend with value-level assertion for `graph.headerTitle` in each of the 4 locales (currently only key-set parity)

No framework install needed — `node --test` + esbuild tsx loader already wired from Phase 25/27.

---

## Manual-Only Verifications

Manual UAT is the primary acceptance harness for a polish phase — visual / animation / navigation behaviors are not cleanly unit-testable and match the audit report ritual.

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| SwipeTabContainer desync recovery | D-05 | Requires live MotionValue + DOM visualViewport events; not reproducible in node --test | 1. Navigate to `/planner`. 2. Focus an input (keyboard opens). 3. Rotate/resize viewport. 4. Close keyboard. 5. Swipe to Home. Verify strip position matches URL; no drift. |
| Nav slide-down animation | D-06-RUNTIME | Framer Motion animation requires live browser | 1. From any top-level screen, navigate to `/posts/:id`. 2. Verify nav slides down ~200ms. 3. Back button → nav slides up. |
| Sub-screen header shadow-on-scroll | D-07 | Requires scroll event on live DOM | 1. Open `/posts/:id`. 2. Scroll content down 10px. 3. Verify header gains `box-shadow: var(--shadow-1)`. 4. Scroll to top → shadow clears. |
| Trellis leaf shake on tap | D-10 | Animation visual quality is subjective | 1. Navigate to `/planner`. 2. Tap any leaf (any state). 3. Verify ~300ms rotate shake. 4. Tap rapidly — shake does not stack awkwardly. |
| Haptic feedback | D-11 | Device-only (web no-op, Capacitor fires) | On physical iOS/Android device: tap leaf → feel light haptic tap. |
| Pulse-on-focus linkage | D-12-RUNTIME | Interaction between two UI surfaces | 1. On `/planner`, tap a Suggested Move row. 2. Verify matching leaf pulses (scale + glow) before navigation commits. 3. If no action taken within 2s, glow fades. |
| Perf guard on 50+ leaves | D-13-RUNTIME | Requires seeded large dataset | 1. Seed 50+ anchors (via dev helper or localStorage import). 2. Scroll trellis canvas. 3. Verify off-screen leaves don't animate (no jank, no dropped frames). |
| Knowledge Graph rename runtime | D-14-RUNTIME | UI text verification across 4 locales | 1. Open `/graph` in en → header reads "Knowledge Graph". 2. Settings → switch to zh → header reads "知识图谱". 3. Repeat for es ("Grafo de conocimiento") and ja ("ナレッジグラフ"). |
| AskScreen row tap | D-15-RUNTIME | Navigation + ellipsis visual | 1. Open `/ask`. 2. Tap a recent-question row. 3. Verify navigates to `/ask/:id`. 4. Seed long question (100+ chars) → verify 2-line ellipsis with "..." at end. |
| Chip press feedback | D-16 | Active-squish visual is subjective | Tap any chip → verify 0.96 scale squish on press. |
| Empty-state copy consistency | D-17 | Tone and CTA review | Navigate through Home (no posts), Planner (no anchors), Graph (<5 nodes), Ask (no recent) → verify copy consistency per audit. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency <15s
- [ ] `nyquist_compliant: true` set in frontmatter after planner approves the Req→Test map

**Approval:** pending

---

*Phase 28 is a polish phase: manual UAT is a first-class acceptance mode per decision D-03 and D-25, not a fallback. Automated coverage targets pure logic helpers (D-05, D-06, D-10, D-12, D-13, D-14-BUNDLE); animation/interaction fidelity is validated by the UAT checklist above.*
