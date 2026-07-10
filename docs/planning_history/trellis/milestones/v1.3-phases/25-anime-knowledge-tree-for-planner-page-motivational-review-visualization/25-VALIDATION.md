---
phase: 25
slug: anime-knowledge-tree-for-planner-page-motivational-review-visualization
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-14
populated: 2026-04-14
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Populated by the planner agent from the Validation Architecture section of 25-RESEARCH.md.

**Critical adaptation from RESEARCH.md:** The project uses `node --test` with `.test.mjs` files (see `app/package.json` script `"test": "node --test tests/**/*.test.mjs"` and `app/tests/canonical-knowledge.test.mjs` pattern). RESEARCH.md suggested Vitest, but installing Vitest would introduce a new test framework alongside the existing node:test suite — this plan honors the established framework instead. All tests follow the node:test import pattern: `import test from 'node:test'; import assert from 'node:assert/strict';` with `.ts` imports via Node's native TypeScript loader.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node --test` (Node.js built-in test runner) — already in `app/package.json` |
| **Config file** | None required (zero-config node:test) |
| **Test file pattern** | `app/tests/**/*.test.mjs` |
| **Quick run command** | `cd app && node --test tests/<pattern>.test.mjs` |
| **Full suite command** | `cd app && npm test` |
| **Estimated runtime** | <10s for unit suite |

---

## Sampling Rate

- **After every task commit:** Run relevant unit test file with `node --test tests/<file>.test.mjs`
- **After every plan wave:** Run full suite `cd app && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-00-1 | 25-00 | 1 | AppEvent types + REVIEW_COMPLETED bridge | unit | `cd app && node --test tests/types.appevent.test.mjs` | Created in 25-00 T1 | ⬜ pending |
| 25-00-2 | 25-00 | 1 | trellis-blossom-dates.service | unit | `cd app && node --test tests/services/trellis-blossom-dates.test.mjs` | Created in 25-00 T2 | ⬜ pending |
| 25-00-3 | 25-00 | 1 | Asset directory + README | structural | `test -f app/src/assets/planner-trellis/README.md && grep -c "Asset 1\|Asset 2\|Mockup" app/src/assets/planner-trellis/README.md` | Created in 25-00 T3 | ⬜ pending |
| 25-01-1 | 25-01 | 2 | Seeded layout (mulberry32, hashStr, generateVinePath, getLeafPosition) | unit | `cd app && node --test tests/services/trellis-layout.test.mjs` | Created in 25-01 T1 | ⬜ pending |
| 25-01-2 | 25-01 | 2 | State aggregation (computeLeafState, buildTrellisState, worst-child-wins) | unit | `cd app && node --test tests/services/trellis-state.test.mjs` | Created in 25-01 T2 | ⬜ pending |
| 25-01-3 | 25-01 | 2 | useTrellisData + types module (compile-time) | type-check | `cd app && npx tsc -b --noEmit` | N/A (compile-only) | ⬜ pending |
| 25-02-1 | 25-02 | 3 | Leaf color mapping + tooltip copy resolver | unit | `cd app && node --test tests/components/trellis-tooltip-copy.test.mjs` | Created in 25-02 T1 | ⬜ pending |
| 25-02-2 | 25-02 | 3 | TrellisCanvas + TrellisHero + PlannerScreen wire-up (compile + build) | build | `cd app && npx tsc -b --noEmit && npm run build` | N/A (build-only) | ⬜ pending |
| 25-02-3 | 25-02 | 3 | Variant C visual + interaction (human-verify checkpoint) | manual | Walk through interactions on localhost | Human | ⬜ pending |
| 25-03-1 | 25-03 | 4 | TrellisBackgroundA + fallback (build success in both asset states) | build | `cd app && npm run build` | N/A (build-only) | ⬜ pending |
| 25-04-1 | 25-04 | 4 | useVideoPauseGuard pure decision function | unit | `cd app && node --test tests/hooks/useVideoPauseGuard.test.mjs` | Created in 25-04 T1 | ⬜ pending |
| 25-04-2 | 25-04 | 4 | TrellisBackgroundV video attributes + wire-up (grep + build) | build+grep | `cd app && grep -c "muted\|playsInline\|loop" src/components/trellis/variants/TrellisBackgroundV.tsx && npm run build` | N/A (build-only) | ⬜ pending |
| 25-05-1 | 25-05 | 5 | Route-aware sway gate (compile + grep) | type-check+grep | `cd app && npx tsc -b --noEmit && grep -c "useLocation\|ambientEnabled" src/components/trellis/TrellisHero.tsx` | N/A (compile-only) | ⬜ pending |
| 25-05-2 | 25-05 | 5 | End-to-end review→leaf-state smoke test | integration | `cd app && node --test tests/e2e/trellis-review-update.test.mjs` | Created in 25-05 T2 | ⬜ pending |
| 25-05-3 | 25-05 | 5 | Manual QA checklist committed | structural | `test -f .planning/phases/25-.../25-MANUAL-QA.md` | Created in 25-05 T3 | ⬜ pending |
| 25-05-4 | 25-05 | 5 | Final phase human-verify checkpoint | manual | Walk QA checklist | Human | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Covered by 25-00 tasks:

- [x] **Test framework verified** — `node --test` is already in `app/package.json` script `"test": "node --test tests/**/*.test.mjs"`. No Vitest install required (adapted from RESEARCH.md recommendation).
- [x] **Event type additions** — 25-00 Task 1 adds `REVIEW_COMPLETED`, `CLASSIFICATION_COMPLETED`, `ANCHOR_DELETED` to `AppEvent` union in `app/src/types/index.ts`
- [x] **Blossom-date storage** — 25-00 Task 2 creates `app/src/services/trellis-blossom-dates.service.ts` with localStorage key `trellis_blossom_dates`
- [x] **Asset directory + README** — 25-00 Task 3 creates `app/src/assets/planner-trellis/.gitkeep` + `README.md` with all 6 AI prompts
- [x] **Test stubs** — 25-00 Tasks 1-2 create initial test files; 25-01 creates layout + state tests; 25-02 creates copy tests; 25-04 creates hook tests; 25-05 creates e2e test

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Ghibli visual aesthetic match | D-04 | Subjective visual judgment | Review mockups 1-3 (if present) alongside live Variants A/C/V during 25-02 and 25-05 human-verify |
| Gentle drift fall animation feel | D-39 | Subjective animation tuning | Trigger overdue threshold (mutate localStorage Q&A nextReviewDate), observe 3-4s fall; adjust spring values if "off" |
| Variant V video on real device | D-54 | Performance/battery | Real iOS Capacitor build, leave Planner tab for 10 min with Variant V active, verify no decode drain when tab hidden (QA checklist item in 25-05 manual QA) |
| Tooltip positioning at canvas edges | UI-SPEC §Tooltip | Visual edge cases | Test anchor near each canvas corner, verify tooltip never overflows hero bounds (25-05 QA checklist) |
| Empty state copy clarity | D-50/51/52 | UX judgment | Fresh user with 0 anchors, observe CTA discoverability (25-02 human-verify covers populated; 25-05 QA covers empty) |
| Leaf color transitions visually match UI-SPEC | D-06/D-38 | Subjective color pairing | DevTools inspector confirms `fill="var(--node-*)"` per state; human judges if hex values read as intended (25-05 QA) |

---

## Known Test Coverage Limitations

**React hooks requiring DOM cannot be unit-tested under node:test without a renderer.** Specifically:
- `useTrellisData` — subscribes to eventBus; runtime behavior verified by grep-level wiring + 25-05 e2e test exercising eventBus directly
- `useVideoPauseGuard` — IntersectionObserver + visibilitychange callbacks; pure `shouldPauseVideo` decision function is tested; wiring verified by grep-level checks and real-device QA in 25-05

These gaps are acceptable given:
1. The project has no existing React testing library dependency
2. Grep-level checks catch structural omissions (missing `muted`, missing `observer.disconnect`)
3. Human-verify checkpoints in 25-02 and 25-05 cover real-device behavior
4. Installing React testing infrastructure is out of scope for Phase 25 (and introduces a test-framework split that would widen rather than narrow the feedback loop)

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (15 tasks, all mapped above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every plan wave has at least one automated test command)
- [x] Wave 0 covers all MISSING references (event types, blossom storage, asset scaffold)
- [x] No watch-mode flags (all node --test commands are single-shot)
- [x] Feedback latency < 30s (node --test completes in <10s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner self-signed; awaits /gsd:check-plans review if orchestrator requests)
