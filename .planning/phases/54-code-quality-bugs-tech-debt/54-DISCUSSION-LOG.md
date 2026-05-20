# Phase 54: Code Quality, Bugs & Tech Debt - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 54-code-quality-bugs-tech-debt
**Areas discussed:** Tech-debt bar, Bug-audit breadth, Podcast verify, Deferred tests

---

## Tech-Debt Bar (TECHDEBT-13)

| Option | Description | Selected |
|--------|-------------|----------|
| Blocks rewards work | High-priority = anything obstructing/re-touched by rewards phases 57–59; tight scope | |
| User-impacting only | High-priority = real user-visible defect / data drift / crash risk; smell-debt re-accepted | |
| Severity × reach matrix | Score every item severity×reach, fix top tier regardless of theme; most thorough | ✓ |

**User's choice:** Severity × reach matrix
**Notes:** Operator chose the most thorough, widest-scope option deliberately. Sub-tier items get re-accepted with documented rationale; the inventory is a deliverable.

---

## Bug-Audit Breadth (QUALITY-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Load-bearing services | Deep audit of documented load-bearing surfaces only; best ROI | |
| Whole codebase sweep | Systematic pass over all services + screens + hooks | ✓ |
| Audit everything, fix top tier | Inventory whole codebase, fix only high-severity this phase | |

**User's choice:** Whole codebase sweep
**Notes:** Operator chose breadth over a focused audit. Confirmed bugs fixed + covered by tests where practical; severity×reach (D-01) is the triage lens.

---

## Podcast Verify (QUALITY-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Diagnostics-first, you test | Add dev affordance + pipeline logging, operator runs device test, fix from logs | |
| Code-path audit only | Trace/harden from source; final device confirmation at milestone UAT | |
| Escalate to /gsd:debug | Spin up dedicated debug session if non-trivial break | |
| **Other (free text)** | **"I have tested it is working"** | ✓ |

**User's choice:** Free text — "I have tested it is working"
**Notes:** Auto-gen podcast is device-verified working by the operator (2026-05-20). QUALITY-03 device-verification is satisfied. No diagnostics build or fix work; close the carried-over podcast todo. Light source sanity-check optional, must not gate the phase.

---

## Deferred Tests (TECHDEBT-14)

| Option | Description | Selected |
|--------|-------------|----------|
| Fix to match behavior | Rewrite stale tests to assert current correct contract; re-accept only when gap intentional | ✓ |
| Delete if obsolete | Delete tests guarding dead/abandoned paths | |
| Case-by-case | Triage each failure individually | |

**User's choice:** Fix to match behavior
**Notes:** Code presumed right, tests drifted (e.g. buildFallbackPosts). Re-accept with documented rationale only where the gap is intentional. Goal: full suite + tsc green.

---

## Claude's Discretion

- Severity × reach scoring rubric (scale, weights) and inventory document format/location.
- Per-file depth of the whole-codebase sweep before diminishing returns.
- Whether each fixed bug gets a regression test (default: yes where practical).

## Deferred Ideas

- Numeric threshold / cosine tuning + filter/recommendation/feed-randomizer/"like" mechanism tuning → Phase 55 (incl. the reviewed-but-not-folded cosine-threshold cache-miss todo, `resolves_phase: 55`).
- UI polish, animations, navigation audit, stale-doc archiving, CLAUDE.md drift correction → Phase 56.
