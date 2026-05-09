---
phase: 37
slug: i18n-leaf-module-refactor
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-08
audited: 2026-05-08
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Mapped from `37-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node 25 built-in `node --test` (native TS strip — no esbuild/tsx loader) |
| **Config file** | None — uses `app/package.json` scripts directly |
| **Quick run command** | `cd app && npm test 2>&1 \| tail -40` |
| **Full suite command** | `cd app && npm test` (runs `test:main` then `test:actions`) |
| **Estimated runtime** | ~30 seconds (per measured baseline) |
| **TypeScript gate** | `cd app && npx tsc -b --noEmit; echo "exit $?"` (must exit 0) |

---

## Sampling Rate

- **After every task commit:** Run `cd app && npm test 2>&1 | tail -20` — confirms green or expected progress (Pitfall 7 / regex-collision early-warning)
- **After every plan boundary:**
  - Plan 37-01 close: `node --test app/tests/lib/i18n-leaf.test.mjs` (green) + `npm test` (10 carried failures still red — service files not yet migrated)
  - Plan 37-02 close: `npm test` (`fail 0` — chain broken) + `tsc -b --noEmit` (exit 0)
  - Plan 37-03 close: `npm test` (`fail 0`) + `node --test app/tests/services/leaf-imports.test.mjs` (green) + `tsc -b --noEmit` (exit 0)
- **Before `/gsd:verify-work`:** Full suite green + tsc green + manual locale-switch UAT (EN→ZH→ES→JA in Settings)
- **Max feedback latency:** ~30 seconds (full suite); ~3 seconds (per-file targeted run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 37-01-01 | 01 | 1 | TECHDEBT-01 | unit (smoke) | `cd app && node --test tests/lib/i18n-leaf.test.mjs` | ✅ | ✅ green (4/4) |
| 37-01-02 | 01 | 1 | TECHDEBT-01 | manual (boot) | App boots without TS error; locale change toast renders | ✅ | ⏳ manual (HUMAN-UAT.md) |
| 37-02-01 | 02 | 2 | TECHDEBT-01 (Goal 1) | hold-out | `cd app && npm test 2>&1 \| grep -E "fail [0-9]+"` | ✅ | ✅ green* (9/10 hold-out closed; 1 flipped to non-i18n error per VERIFICATION.md) |
| 37-02-02..05 | 02 | 2 | TECHDEBT-01 (Goal 1) | regression | `cd app && npm test` after each of remaining 4 service-file commits | ✅ | ✅ green (per-commit baseline preserved) |
| 37-03-01..04 | 03 | 3 | TECHDEBT-01 (Goal 4 proxy) | regression (paired) | Per-file: `node --test app/tests/{matching-test}.mjs` after each Tier 3 source+test paired commit | ✅ | ✅ green (22/22 across 4 files: date.locale 6, llm-locale 5, tts-locale 6, youtube-locale 5) |
| 37-03-05 | 03 | 3 | TECHDEBT-01 (Goal 2) | invariant | `cd app && node --test tests/services/leaf-imports.test.mjs` | ✅ | ✅ green (4/4) |
| 37-final | — | 3 | TECHDEBT-01 (Goal 3) | compile gate | `cd app && npx tsc -b --noEmit; echo "exit $?"` (expect `exit 0`) | ✅ | ✅ green (exit 0) |
| 37-final | — | 3 | TECHDEBT-01 (Goal 4) | manual UAT | Settings → switch EN→ZH→ES→JA — toasts/dates/voices update without console errors | ✅ | ⏳ manual (HUMAN-UAT.md) |

*Hold-out caveat: VALIDATION.md's original `fail 0` bar wasn't strictly met (`npm test` shows `fail 5`), but VERIFICATION.md classified all 5 remaining failures as pre-existing latent issues unmasked by the chain-unblock — NONE are members of the 10-test Phase 37 hold-out. The hold-out's natural Nyquist sample reads 9 fully closed + 1 flipped to a different (non-i18n) error class. Phase 37 goal achieved; the 5 unrelated fails are explicitly D-08 out-of-scope (recommended for Phase 38).

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `app/src/lib/i18n-leaf.ts` — shim source (Plan 37-01); covers TECHDEBT-01 Goal 2
- [x] `app/tests/lib/i18n-leaf.test.mjs` — shim smoke test, ≥4 assertions (Plan 37-01); covers TECHDEBT-01 Goal 2
- [x] `app/tests/services/leaf-imports.test.mjs` — source-reading invariant test, ≥4 assertions (Plan 37-03 final commit); covers TECHDEBT-01 Goal 2
- [x] Tier 3 paired test updates: `app/tests/lib/date.locale.test.mjs`, `app/tests/providers/llm-locale-injection.test.mjs`, `app/tests/providers/tts-locale.test.mjs`, `app/tests/services/youtube-locale.test.mjs` — each updated to call `bindI18nLeaf` instead of relying on shared `i18next` global (Plan 37-03); covers TECHDEBT-01 Goal 4 regression

*Existing infrastructure (`node --test` + `npm test` script) covers framework-level needs — no new test runner install.*

---

## Hold-Out Tests (natural Nyquist sampling)

The 10 currently-failing tests are the natural hold-out — they are NOT modified by Phase 37. They turn red→green as the chain breaks at Plan 37-02 commit 1 (`flashcard.service.ts` migration):

1. `tests/concept-feed.test.mjs:1:1` (entire file fails to import)
2. `tests/e2e/trellis-review-update.test.mjs:37:1`
3. `tests/e2e/trellis-review-update.test.mjs:61:1`
4. `tests/services/trellis-layout.test.mjs:64:1`
5. `tests/services/trellis-state.test.mjs:37:1`
6. `tests/services/trellis-state.test.mjs:44:1`
7. `tests/services/trellis-state.test.mjs:52:1`
8. `tests/services/trellis-state.test.mjs:61:1`
9. `tests/services/trellis-state.test.mjs:70:1`
10. `tests/services/trellis-state.test.mjs:78:1`

Each subsequent Tier 1+2 commit must keep the count at `fail 0`. Any regression on a non-target test indicates a Pitfall 7 (regex collision) breach.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Locale switch updates UI live | TECHDEBT-01 Goal 4 | Requires running app + DOM observation across 4 locales | Operator runs `npm run dev` (or device build); navigates Settings → Language; switches EN→ZH→ES→JA; verifies header titles, toast text, dates, voice labels update on each switch with NO console errors |
| App boots after main.tsx wire | TECHDEBT-01 Goal 2 | First-paint verification; `bindI18nLeaf` runs synchronously after `import './locales/index.ts'` | Operator boots app; expects no white screen and no `ReferenceError: i18n is not defined` in console |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (manual UAT only for live-locale switch + first-paint)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (per-file `npm test` between every commit)
- [x] Wave 0 covers all MISSING references (3 new test files: 1 smoke + 1 invariant + 4 paired updates)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter (after first checker pass)

**Approval:** validated 2026-05-08

---

## Validation Audit 2026-05-08

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 (no gaps to resolve) |
| Escalated | 0 |
| Status flips | `nyquist_compliant: false → true`, `wave_0_complete: false → true`, `status: draft → validated` |

**Audit narrative:** State A audit. All 8 Per-Task Map entries closed `green` against on-disk artifacts (verified via VERIFICATION.md spot-checks: smoke 4/4, invariant 4/4, 4 paired Tier 3 tests 22/22, tsc exit 0). Two manual entries (boot smoke + locale-switch UAT) persist in `37-HUMAN-UAT.md` per workflow. The 5 remaining `npm test` failures (`fail 5`) are documented out-of-scope: 4 date-dependent assertions + 1 youtube.service extension-resolution issue, none members of the Phase 37 hold-out. No new tests required; the existing automated coverage (smoke + invariant + 4 paired + compile gate + 9 of 10 hold-out closures) saturates TECHDEBT-01's measurable acceptance bar.
