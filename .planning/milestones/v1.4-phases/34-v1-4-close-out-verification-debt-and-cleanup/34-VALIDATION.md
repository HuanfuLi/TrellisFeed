---
phase: 34
slug: v1-4-close-out-verification-debt-and-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` (Node 25.9.0) |
| **Config file** | `app/package.json` `"test": "node --test tests/**/*.test.mjs"` |
| **Quick run command** | `cd app && node --test tests/services/trellis-replant.test.mjs` (or other single file) |
| **Full suite command** | `cd app && npm test` |
| **Estimated runtime** | ~15 seconds (full suite) |
| **Type check** | `cd app && npx tsc -b --noEmit` |
| **Build** | `cd app && npx vite build` |

---

## Sampling Rate

- **After every task commit:** `cd app && npx tsc -b --noEmit` (always)
- **After Wave 1 commits (test fixes):** `cd app && npm test` (assert specific tests pass)
- **After Wave 2-4 commits (doc-only):** `cd app && npx tsc -b --noEmit` (skip npm test — no code edits)
- **After Wave 3 commits (deletions):** Both `tsc` AND `npm test` (deletions may affect compilation chain)
- **After Wave 5 commits (5-commit WIP land):** `cd app && npm test && npx tsc -b --noEmit && npx vite build` after EACH of the 5 commits
- **Phase gate:** Full suite `449 pass / 27 fail` baseline OR better; `tsc=0`; vite clean

---

## Per-Task Verification Map

| Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|------|------|-------------|-----------|-------------------|-------------|--------|
| 34-01 (Seam 11) | 1 | SEAM-11 | unit | `node --test tests/services/trellis-replant.test.mjs tests/services/trellis-prune.test.mjs` (must pass) | ✅ (needs edit) | ⬜ pending |
| 34-02 (Seam 12) | 1 | SEAM-12 | source-read | `node --test tests/screens/HomeScreen.image-pregen-filter.test.mjs` (must pass post-WIP) | ✅ (needs edit) | ⬜ pending |
| 34-03 (30-VERIFICATION) | 2 | PHASE-30-VERIFICATION | doc presence | `test -f .planning/phases/30-*/30-VERIFICATION.md && grep -c "VERIFIED\\|SUPERSEDED\\|NO-OP\\|DEFERRED" 30-VERIFICATION.md` (≥22) | ❌ Wave 2 | ⬜ pending |
| 34-04 (31-VERIFICATION) | 2 | PHASE-31-VERIFICATION | doc presence | `test -f .planning/phases/31-*/31-VERIFICATION.md && grep -c "VERIFIED\\|SUPERSEDED\\|NO-OP\\|DEFERRED" 31-VERIFICATION.md` (≥47) | ❌ Wave 2 | ⬜ pending |
| 34-05 (32-CLOSURE) | 2 | PHASE-32-EXECUTION | doc presence | `test -f .planning/phases/32-*/32-CLOSURE.md` | ❌ Wave 2 | ⬜ pending |
| 34-06 (Wave 3 cleanup) | 3 | SEAM-2-tail | source absence | `! test -f app/src/services/post-store.service.ts && ! grep -q "ImmersiveInfoFlow" app/src/components/InfoFlow.tsx` | ✅ delete | ⬜ pending |
| 34-07 (VALIDATION flips) | 4 | VALIDATION-DRIFT-{28,29,30}, VALIDATION-32-ANNOTATE | doc state | `grep "^status: validated" .planning/phases/{28,29,30}-*/*-VALIDATION.md` (3 hits); `grep -q "absorbed" .planning/phases/32-*/32-VALIDATION.md` | ❌ Wave 4 | ⬜ pending |
| 34-08 (UAT log + 5-commit land) | 5 | DEVICE-UAT-RETEST + WIP-COMMIT-SHAPE | doc presence + git state | `test -f .planning/phases/34-*/34-UAT-LOG.md && git log --oneline gsd/phase-33-hygiene-and-polish | head -5` (5 commits visible) | ❌ Wave 5 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

**No new test files needed.** All required tests already exist in the repository — they only need edits:

- `app/tests/services/trellis-replant.test.mjs` — exists; needs CLASSIFICATION_COMPLETED → GRAPH_UPDATED rename + payload assertion removal (Plan 34-01)
- `app/tests/services/trellis-prune.test.mjs` — exists; same pattern (Plan 34-01)
- `app/tests/screens/HomeScreen.image-pregen-filter.test.mjs` — exists; needs grep target change from `HomeScreen.tsx:handleLoad` to `concept-feed.service.ts:refillQueue` (Plan 34-02)

**No framework install needed** — `node --test` is built into Node 25.

**Existing infrastructure covers all Phase 34 phase requirements.**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 33-HUMAN-UAT-1: Touch target feel on PlannerScreen refresh + ChatInput mic/globe (44×44px) | DEVICE-UAT-RETEST | WCAG 2.5.8 perceptual quality, requires APK on real device | Deploy APK; tap each button; record "comfortable / cramped / missed" outcome in 34-UAT-LOG.md |
| 33-HUMAN-UAT-2: React.memo behavioral correctness on live feed | DEVICE-UAT-RETEST | Custom equality comparators correctness requires runtime observation | Load home feed; swipe-for-more (4 posts); toggle Settings → Image Generation; check VineProgress full-width; record outcomes |
| Phase 28 deferred UAT — 6 items (haptic, BottomNav slide-down, Header scroll shadow, SwipeTabContainer resize re-snap, trellis pulse from Suggested Moves, AskScreen locale switch empty state) | (opportunistic per D-09, NOT a hard gate) | Capacitor native bridge / Framer Motion DOM behavior / iOS-specific input | Record outcomes IF operator's APK session naturally covers them; flip 28-VERIFICATION.md `human_verification` rows on PASS |

**G2/G4/G5 from 32.1 are NOT in this list** — research confirmed they are already PASS / verified_by HuanfuLi 2026-04-19 in 32.1-HUMAN-UAT.md. Plan 34-08's Wave 5 work is to flip the 32.1-VERIFICATION.md `status: human_needed → passed` based on existing evidence, not run a new device session.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (Wave 0 is empty — no MISSING refs)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (full suite ~15s + tsc ~5s)
- [ ] `nyquist_compliant: true` set in frontmatter (after Wave 5 close-out)

**Approval:** pending — flip on Phase 34 verifier pass

---

## Notes

**Pre-existing failures NOT blocking Phase 34:**

The 27 pre-existing test failures (Node 25 JSON import strictness ~20 + Phase 26 test-code bugs ~4 + podcast.service ERR_MODULE_NOT_FOUND ~2) are documented in 34-CONTEXT.md `<deferred>` section as v1.5 carry-overs. Phase 34's "test baseline preserved" success criterion means "no new v1.4-specific failures introduced", not "all 27 pre-existing failures fixed".

**Per-commit test invocation (Wave 5):**

After each of the 5 commits in Wave 5 (rebrand / functional+Seam12 / audit / planning / execution), run:

```bash
cd app && npm test 2>&1 | grep -E "^# (pass|fail)" && npx tsc -b --noEmit && echo "TSC=$?"
```

Expected: `pass 449 fail 27` AND `TSC=0` after Commit 1 (rebrand only). Expected: `pass 449 fail 27` AND `TSC=0` after Commit 2 (functional + Seam 12 fix lands together). If any commit shows different counts, halt and investigate before proceeding.
