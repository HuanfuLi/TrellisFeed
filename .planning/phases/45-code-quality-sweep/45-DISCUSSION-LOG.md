# Phase 45: Code Quality Sweep - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 45-code-quality-sweep
**Areas discussed:** Existing context refresh, sweep order, TypeScript strictness, dead-code cleanup, performance profiling, TODO/FIXME triage, operator notes and debug files

---

## Existing Context

| Option | Description | Selected |
|--------|-------------|----------|
| Update it | Review and revise the existing context | x |
| View it | Show current context before deciding | |
| Skip | Use existing context as-is | |

**User's choice:** Tool UI was unavailable in Default mode, so the workflow fallback selected the recommended update path.
**Notes:** Existing `45-CONTEXT.md` was already substantive. Refresh focused on late Phase 43 changes that alter how debug notes should be triaged.

---

## Sweep Order

| Option | Description | Selected |
|--------|-------------|----------|
| Inventory first | Create audit artifacts before code edits | x |
| Fix first | Start editing immediately, document after | |
| You decide | Leave ordering to planner | |

**User's choice:** Existing context decision retained.
**Notes:** Phase 45 should produce `45-TSC-AUDIT.md`, `45-TODO-TRIAGE.md`, and `45-PERF-AUDIT.md` or equivalents as first-class deliverables.

---

## TypeScript Strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Audit current strictness | Document current `tsc -b --noEmit` and fix low-risk gaps | x |
| Broaden strictness flags | Opportunistically tighten compiler options | |
| Defer strictness | Only document known gaps | |

**User's choice:** Existing context decision retained.
**Notes:** Suppression comments are triage inputs, not automatic removals.

---

## Dead Code And Removed-Feature Residue

| Option | Description | Selected |
|--------|-------------|----------|
| Remove true residue | Delete orphan exports, unused imports, stale i18n keys, and removed-feature leftovers | x |
| Broad refactor | Clean up adjacent style and structure while nearby | |
| Documentation only | Catalogue without deleting | |

**User's choice:** Existing context decision retained.
**Notes:** Compatibility residue for the EchoLearn on-disk path and legacy localStorage migration remains protected unless proven dead.

---

## Performance Profiling

| Option | Description | Selected |
|--------|-------------|----------|
| Evidence-based profiling | Document first paint, queue refill, masonry scroll, and GraphScreen Android drag lag | x |
| Fix by feel | Tune obvious hot spots without formal evidence | |
| Defer perf | Catalogue only, no fixes | |

**User's choice:** Existing context decision retained.
**Notes:** Fix only localized P0/P1 findings; defer broad rewrites.

---

## TODO/FIXME Triage

| Option | Description | Selected |
|--------|-------------|----------|
| Catalogue and classify | Close, defer, or mark in-scope-for-v1.5 and close inline | x |
| Remove all suppressions | Treat every suppression as a bug | |
| Defer all comments | Catalogue without action | |

**User's choice:** Existing context decision retained.
**Notes:** Current scout found `@ts-ignore`, `eslint-disable`, `no-explicit-any`, and hook-deps suppressions across source and tests.

---

## Operator Notes And Debug Files

| Option | Description | Selected |
|--------|-------------|----------|
| Verify supersession first | Map each note to Phase 43 coverage before creating new work | x |
| Treat all as open bugs | Plan fixes for every debug file | |
| Defer all notes | Move notes out of Phase 45 | |

**User's choice:** Updated during this refresh.
**Notes:** `dismiss-not-propagating-to-same-anchor-tiles.md` appears covered by 43-14; `duplicate-post-keys-after-force-new-day.md` appears covered by 43-15. Phase 45 should verify and close them before duplicating work.

---

## the agent's Discretion

- Exact audit artifact filenames beyond required content.
- Exact profiling toolchain.
- Whether to group fixes by concern area or by file, provided commits remain reviewable.

## Deferred Ideas

- Broad UI polish and tile-metadata redesign.
- Major dependency upgrades or package migrations.
- Persistent telemetry or user-visible diagnostics.
- Backend/cross-device sync for engagement or notes.
