---
phase: 1
slug: rebrand-research-shell-hardening
status: populated
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` |
| **Config file** | none — `app/package.json` scripts |
| **Quick run command** | `node --test tests/<area>/<file>.test.mjs` (from `app/`) |
| **Full suite command** | `npm test` (from `app/`); gates also include `npm run lint` and `npm run build` (`tsc -b`) |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the targeted `node --test` file(s) for the touched area
- **After every plan wave:** Run `npm test` from `app/`
- **Before `/gsd-verify-work`:** Full suite + `npm run lint` + `npm run build` must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | SHELL-01 | T-01-01/02/03 | Display rebrand; bundle IDs preserved; mic string removed | source-regression | `cd app && node --test tests/phase1/rebrand-surfaces.test.mjs` | ❌ W0 (this plan) | ⬜ pending |
| 01-01-02 | 01 | 1 | SHELL-01 | T-01-02 | Locale rebrand + accurate collector privacy copy; parity preserved | locale-parity | `cd app && node --test tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs` | ✅ | ⬜ pending |
| 01-02-01 | 02 | 1 | SHELL-02 | T-01-04/05/06 | `questiontrace` DB + research stores; no read-forward migration | behavioral (dbQuery) | `cd app && node --test tests/services/storage-namespace.test.mjs` | ❌ W0 (this plan) | ⬜ pending |
| 01-03-02 | 03 | 1 | LOG-01 | T-01-07/10/11 | Field allowlist + size bounds reject prohibited/oversized ingest | backend unit | `cd research-backend && node --test test/validation.test.mjs` | ❌ W0 (this plan) | ⬜ pending |
| 01-03-03 | 03 | 1 | LOG-01 | T-01-08/09 | Idempotent ingest; server-derived condition/topic | backend unit (fake D1) | `cd research-backend && node --test test/ingest.test.mjs` | ❌ W0 (this plan) | ⬜ pending |
| 01-04-02 | 04 | 2 | SHELL-03 | T-01-12/14 | Bind-once immutable condition; no participant mutator | unit (dbQuery seam) | `cd app && node --test tests/services/study-context.service.test.mjs` | ❌ W0 (this plan) | ⬜ pending |
| 01-05-01 | 05 | 2 | LOG-01 | T-01-16 | CSV formula escaping; two-entry ZIP | backend unit | `cd research-backend && node --test test/export.test.mjs` | ❌ W0 (this plan) | ⬜ pending |
| 01-05-02 | 05 | 2 | LOG-01 | T-01-15/17 | Basic-auth guard; HTML-escaped status page | backend unit | `cd research-backend && node --test test/admin-auth.test.mjs` | ❌ W0 (this plan) | ⬜ pending |
| 01-06-01 | 06 | 3 | LOG-01 | T-01-20/21/22 | Persist-before-send; ACK-only deletion; retry retention | TDD (dbQuery + mock fetch) | `cd app && node --test tests/services/upload-queue.service.test.mjs` | ❌ W0 (this plan) | ⬜ pending |
| 01-07-01 | 07 | 4 | LOG-01 | T-01-23/24/25 | Internal identity; runtime privacy rejection; Q/A revisioning | TDD (dbQuery seam) | `cd app && node --test tests/services/interaction-log.service.test.mjs` | ❌ W0 (this plan) | ⬜ pending |
| 01-08-03 | 08 | 5 | RQ-01, LOG-01 | T-01-26/28 | Every RQ-01 measure derivable; no forbidden field | contract/unit | `cd app && node --test tests/services/rq1-log-coverage.test.mjs` | ❌ W0 (this plan) | ⬜ pending |
| 01-09-03 | 09 | 4 | SHELL-04, LOG-01 | T-01-29/30/32 | Settings = account+language; non-destructive PIN-gated diagnostics | surface-invariant | `cd app && node --test tests/phase1/participant-surface.test.mjs` | ❌ W0 (this plan) | ⬜ pending |
| 01-10-03 | 10 | 5 | SHELL-04 | T-01-33/34 | Pruned residue gone; load-bearing infra preserved | source-regression | `cd app && node --test tests/phase1/pruned-residue.test.mjs` | ❌ W0 (this plan) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Each new test file is created inside its own plan (as a dedicated test task or TDD RED step), so there are no unresolved cross-plan MISSING references. Every code-producing task additionally runs `npx tsc -b --noEmit` and/or `npm run lint`.*

---

## Wave 0 Requirements

New test files are authored within the plan that owns the behavior (no separate Wave 0 plan needed; each plan creates its own scaffold before/as it implements):

- [ ] `app/tests/phase1/rebrand-surfaces.test.mjs` (Plan 01) — display/native/config rebrand + preserved bundle IDs
- [ ] `app/tests/services/storage-namespace.test.mjs` (Plan 02) — `questiontrace` namespace + research-store round-trip through dbQuery
- [ ] `research-backend/test/{validation,ingest,export,admin-auth}.test.mjs` (Plans 03, 05) — validation, idempotent ingest, CSV/ZIP, admin auth (fake D1)
- [ ] `app/tests/services/study-context.service.test.mjs` (Plan 04) — bind-once immutable condition, no participant mutator
- [ ] `app/tests/services/upload-queue.service.test.mjs` (Plan 06) — persist-before-send, ACK-only deletion, retry retention
- [ ] `app/tests/services/interaction-log.service.test.mjs` (Plan 07) — event allowlist, privacy rejection, Q/A revisioning
- [ ] `app/tests/services/rq1-log-coverage.test.mjs` (Plan 08) — every RQ-01 measure derivable from allowed fields
- [ ] `app/tests/phase1/participant-surface.test.mjs` (Plan 09) — reduced Settings + non-destructive PIN-gated diagnostics
- [ ] `app/tests/phase1/pruned-residue.test.mjs` (Plan 10) — residue gone + load-bearing infra preserved

Existing infrastructure reused: `bundle-parity.test.mjs`, `missing-key.test.mjs`, the `dbQuery`/`dbExecute` persistence seam.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native launcher/home-screen label reads QuestionTrace; bundle IDs unchanged | SHELL-01 | Requires `npx cap sync` + native build inspection | Run `npx cap sync`; inspect iOS/Android diff; confirm label + unchanged identifiers |
| Fresh install opens `questiontrace` IndexedDB with research stores; old `trellis` data not read | SHELL-02 | IndexedDB behavior differs in real WebView vs Node fallback (false-green risk, CLAUDE.md) | DevTools → Application → IndexedDB after a clean install |
| Offline durability + resume retry drains the queue; last-upload time advances | LOG-01/D-13 | Requires real device offline/kill/resume + network toggling | Go offline, generate records, kill/resume app, regain network; watch diagnostics pending count → 0 |
| Setup gate binds identity once; no participant condition/clear control anywhere | SHELL-03/D-03 | Interactive navigation of the reduced shell | Fresh install lands on `/research-setup`; bind (mock); relaunch keeps identity; Settings shows only account+language |
| Protected researcher page shows health + downloads two-CSV ZIP; app never sees other accounts | LOG-01/D-14/D-15 | Requires the deployed Worker + Basic auth over HTTPS | Post-deploy smoke test (Plan 05 checkpoint): `/admin` prompts auth; `/admin/export.zip` yields two CSVs |

*Note: persistence/platform changes need in-browser/on-device UAT — the Node suite has shipped false-greens on this area before (see CLAUDE.md).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-populated 2026-07-10 — every task carries an `<automated>` verify (test file, tsc, lint, or npm test); each new test file is authored inside its owning plan.
