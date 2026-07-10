---
phase: 38
slug: v1-4-carry-over-cleanup
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-09
approved: 2026-05-09
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `38-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` (Node 25.x) |
| **Config file** | `app/package.json` — `"test:main"`, `"test:actions"` scripts |
| **Quick run command** | `cd app && node --test tests/services/youtube-no-short-classification.test.mjs` (Plan 38-02 only) |
| **Full suite command** | `cd app && npm test` |
| **Type check** | `cd app && npx tsc -b --noEmit` |
| **Estimated runtime** | ~30 seconds (full suite) |

---

## Sampling Rate

- **After every task commit (Plan 38-02):** `cd app && npx tsc -b --noEmit` — catches TS cascade from union narrowing
- **After Plan 38-02 completion:** `cd app && npm test` — verify ≤3 failures (Phase 37 baseline preserved)
- **After Plans 38-01 and 38-03:** grep assertions only (doc-only changes, no runtime)
- **Before `/gsd:verify-work 38`:** Full suite green + tsc exit 0 + `38-HUMAN-UAT.md` exists with both `result: pass` entries
- **Max feedback latency:** ~30 seconds for full suite; <1s for grep / tsc

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | TECHDEBT-02 | grep | `grep "^status: validated" .planning/milestones/v1.4-phases/34-*/34-VALIDATION.md` | ❌ W0 | ⬜ pending |
| 38-01-02 | 01 | 1 | TECHDEBT-02 | grep | `grep "^status: validated" .planning/milestones/v1.4-phases/35-*/35-VALIDATION.md` | ❌ W0 | ⬜ pending |
| 38-01-03 | 01 | 1 | TECHDEBT-03 | grep | `grep "36-14\|36-15" .planning/milestones/v1.4-ROADMAP.md` (must be inside Phase 36 entry) | ❌ W0 | ⬜ pending |
| 38-01-04 | 01 | 1 | TECHDEBT-05 | grep | `grep -rn "echolearn_" app/src/services/ --include="*.ts" \| grep -v "legacy-migration\|db.service"` → 0 hits | ❌ W0 | ⬜ pending |
| 38-01-05 | 01 | 1 | TECHDEBT-05 | manual+grep | starter-posts.test.mjs vs concept-feed.service.ts STARTER_POSTS comparison | ❌ W0 | ⬜ pending |
| 38-02-01 | 02 | 1 | TECHDEBT-06 | tsc | `cd app && npx tsc -b --noEmit` exit 0 after types/index.ts edit | ✅ | ⬜ pending |
| 38-02-02 | 02 | 1 | TECHDEBT-06 | source-read | `youtube-no-short-classification.test.mjs` test 1 — probePortrait absent | ❌ W0 | ⬜ pending |
| 38-02-03 | 02 | 1 | TECHDEBT-06 | source-read | `youtube-no-short-classification.test.mjs` test 2 — sourceType 'short' absent | ❌ W0 | ⬜ pending |
| 38-02-04 | 02 | 1 | TECHDEBT-06 | source-read | `youtube-no-short-classification.test.mjs` test 3 — STYLE_WEIGHTS.short absent + sum=1.0 | ❌ W0 | ⬜ pending |
| 38-02-05 | 02 | 1 | TECHDEBT-06 | source-read | Updated `InfoFlow.video-tap-emit.test.mjs` (renamed from short-tap-emit) | ✅ (rename) | ⬜ pending |
| 38-02-06 | 02 | 1 | TECHDEBT-06 | full suite | `cd app && npm test` ≤3 fails (matches Phase 37 baseline) | ✅ | ⬜ pending |
| 38-02-07 | 02 | 1 | TECHDEBT-06 | grep | `grep -c "Phase 36 GAP-C, generalized in Phase 38" CLAUDE.md` returns 1 AND `! grep -q "Short tap-to-play emit" CLAUDE.md` exits 0 | ❌ W0 | ⬜ pending |
| 38-03-01 | 03 | 1 | TECHDEBT-04 | file presence | `test -f .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` | ❌ W0 | ⬜ pending |
| 38-03-02 | 03 | 1 | TECHDEBT-04 | grep | `grep -c "result: pass" 38-HUMAN-UAT.md` → 2 (filled in by human after device test) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/tests/services/youtube-no-short-classification.test.mjs` — NEW source-reading invariant test (4 assertions: probePortrait absent, sourceType 'short' absent, presentationStyle 'short' absent, STYLE_WEIGHTS.short absent + sum=1.0)
- [ ] `app/tests/components/InfoFlow.video-tap-emit.test.mjs` — rename + content update of existing `InfoFlow.short-tap-emit.test.mjs`; assertion targets shift from `sourceType === 'short'` gate to `sourceType === 'video'` thumbnail-onClick gate
- [ ] `.planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` — NEW human-UAT YAML file mirroring Phase 37's shape (single test entry per device-only behavior; 2 entries total: HUMAN-UAT-1 touch-target feel, HUMAN-UAT-2 React.memo behavioral correctness)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 33-HUMAN-UAT-1: touch-target feel on iOS + Android | TECHDEBT-04 | Touch hit-area "feel" cannot be auto-asserted; needs human-perceived comfort across hand size + device weight | See `38-HUMAN-UAT.md` Test 1 (created by Plan 38-03) |
| 33-HUMAN-UAT-2: React.memo behavioral correctness on iOS + Android | TECHDEBT-04 | Behavioral correctness under real Capacitor WebView rendering — automated tests use jsdom which doesn't reproduce Android Chromium's memo timing | See `38-HUMAN-UAT.md` Test 2 (created by Plan 38-03) |
| Visual feed sanity: landscape + portrait videos render with `aspect-ratio: auto` from thumbnail (no letterbox stretch) | TECHDEBT-06 | CSS `aspect-ratio: auto` + Image natural dimension behavior on Android Chromium WebView is the bug-class venue (per Phase 32.1 best-practice rule 3); needs human eyes on real device | Boot app on device, swipe feed until 3+ video posts encountered (one obvious portrait, one obvious landscape); confirm thumbnail-tap inline plays both, title-tap navigates to detail for both, no card collapses or stretches |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (13/14 tasks have grep/tsc/test command; 38-03-02 is human-fill-in)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (Plan 38-01 has grep per task; Plan 38-02 has tsc per task; Plan 38-03 has file-presence per task)
- [ ] Wave 0 covers all MISSING references (3 NEW test files listed above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter (flipped on plan-checker pass)

**Approval:** approved 2026-05-09 (plan-checker iteration 2 — all blockers/warnings resolved)
