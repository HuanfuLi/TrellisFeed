---
phase: 44
slug: dependency-version-sweep
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-12
---

# Phase 44 - Validation Strategy

> Per-phase validation contract for dependency-sweep feedback sampling.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test`; TypeScript build via `tsc -b`; Vite production build |
| **Config file** | `app/package.json`, `app/eslint.config.js`, `app/tsconfig*.json`, `app/vite.config.ts` |
| **Quick run command** | `npm run test:actions` |
| **Full suite command** | `npm test && npm run lint && npm run build && npm audit --audit-level=high && npx cap sync` |
| **Estimated runtime** | ~180-300 seconds |

---

## Sampling Rate

- **After dependency install:** Run `npm install` and inspect peer-dependency warnings.
- **After lockfile update:** Run `npm audit --audit-level=high`.
- **After every plan wave:** Run `npm test`, `npm run lint`, and `npm run build`.
- **Before `$gsd-verify-work`:** Run `npm test && npm run lint && npm run build && npm audit --audit-level=high && npx cap sync`.
- **Max feedback latency:** 300 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 44-01-01 | 01 | 1 | TECHDEBT-08 | package metadata | `npm install` | yes | green |
| 44-01-02 | 01 | 1 | TECHDEBT-08 | security | `npm audit --audit-level=high` | yes | green |
| 44-02-01 | 02 | 2 | TECHDEBT-08 | unit/integration | `npm test` | yes | green |
| 44-02-02 | 02 | 2 | TECHDEBT-08 | lint/type/build | `npm run lint && npm run build` | yes | green |
| 44-02-03 | 02 | 2 | TECHDEBT-08 | native sync | `npx cap sync` | yes | green |
| 44-03-01 | 03 | 3 | TECHDEBT-08 | manual smoke | `44-UAT.md` rows recorded | no | green |
| 44-04-01 | 04 | 4 | TECHDEBT-08 | docs close-out | `rg -n "TECHDEBT-08.*Complete|Phase 44 complete" .planning` | yes | green |

*Status: green / red / flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework should be installed for Phase 44.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Locale switch | TECHDEBT-08 | i18next/react-i18next dependency update affects runtime UI strings | Switch locale in the app and confirm visible strings change without console/runtime failure |
| Ask streaming | TECHDEBT-08 | React 19.x timing can affect streaming state/effects | Start an Ask request, confirm streaming text appears, and confirm completion or abort works |
| Queue refill | TECHDEBT-08 | Recent feed pipeline depends on async refill behavior | Trigger a fresh daily feed/refill path and confirm feed content appears |
| Saved route navigation | TECHDEBT-08 | React Router minor update can affect new Phase 43 routes | Open Saved, switch Saved/Liked tabs, and return to Home |
| Native Android sync sanity | TECHDEBT-08 | Capacitor update can change native generated files | Run `npx cap sync`; if native files change, inspect diff and record result |

---

## Validation Sign-Off

- [x] All tasks have automated verification or an explicit manual smoke row.
- [x] Sampling continuity: no 3 consecutive tasks without automated verification.
- [x] No new watch-mode commands introduced.
- [x] Feedback latency remains under 300 seconds.
- [x] `npm install` exits 0 with no peer-dependency warnings.
- [x] `npm audit --audit-level=high` reports no new high/critical vulnerabilities.
- [x] `npm test` baseline equals or improves post-Phase-43.
- [x] `npm run lint` exits 0.
- [x] `npm run build` exits 0.
- [x] `npx cap sync` exits 0.
- [x] Held-back majors are documented: Vite 8, TypeScript 6, ESLint 10, lucide-react 1.x, and framer-motion to `motion`.
- [x] `nyquist_compliant: true` set in frontmatter after execution evidence is complete.

**Approval:** approved 2026-05-12
