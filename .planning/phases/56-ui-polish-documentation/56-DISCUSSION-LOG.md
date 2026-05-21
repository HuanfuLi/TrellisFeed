# Phase 56: UI Polish & Documentation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 56-UI Polish & Documentation
**Areas discussed:** Polish discovery method, Animation appetite, Navigation audit depth, Documentation archival

---

## Polish discovery method

| Option | Description | Selected |
|--------|-------------|----------|
| Operator-led walkthrough | You flag what looks rough; agents fix only what you call out | |
| Agent visual audit | gsd-ui-auditor 6-pillar sweep, scored report you approve | |
| Hybrid (audit, then you triage) | Agent audit produces candidate list, you approve/cut/add before fixes | ✓ |

**User's choice:** Hybrid (audit, then you triage)

| Option | Description | Selected |
|--------|-------------|----------|
| All screens, equal pass | Audit every screen at equal depth | ✓ |
| Prioritize high-traffic | Deep pass on Home/Ask/Planner/Graph/PostDetail, lighter elsewhere | |
| Only screens you name | Restrict to a provided list | |

**User's choice:** All screens, equal pass

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh audit, ignore old report | Audit current code from scratch; archive Apr-16 report | ✓ |
| Cross-check against old report | Fresh audit + reconcile against Apr-16 findings | |
| You decide | Auditor judges old report's usefulness | |

**User's choice:** Fresh audit, ignore old report
**Notes:** Old `UI_AUDIT_REPORT.md` predates i18n, masonry feed, SQLite migration, Trellis rework → archive to Legacy/.

---

## Animation appetite

| Option | Description | Selected |
|--------|-------------|----------|
| Fix-janky-only | Repair existing animation jank/flicker; add no new motion | ✓ |
| Fix + targeted additions | Fix janky + add a small set of micro-interactions | |
| Broad animation pass | Systematically add motion across screens | |

**User's choice:** Fix-janky-only

| Option | Description | Selected |
|--------|-------------|----------|
| Make it instant / remove | Drop unsmoothable animation for instant transition | |
| Simplify, keep some motion | Reduce to a cheaper effect | |
| Case-by-case, flag to you | Auditor proposes remove-vs-simplify per animation, you decide | ✓ |

**User's choice:** Case-by-case, flag to you
**Notes:** Consistent with hybrid triage and the 2026-04-15 tab-transport revert precedent.

---

## Navigation audit depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full route-map audit | Map every route + entry point, walk each path | ✓ |
| Known-issues only | Fix only already-known broken paths | |
| Map + you spot-check | Agent maps + flags, you confirm from device experience | |

**User's choice:** Full route-map audit

| Option | Description | Selected |
|--------|-------------|----------|
| None I can name | Let the audit surface them | |
| Yes, I'll describe them | Operator has specific broken paths | |
| Back-button behavior generally | Android hardware/gesture back across screens is the worry | ✓ |

**User's choice:** Back-button behavior generally
**Notes:** No single broken path; Android back-button consistency across screens is the top concern.

---

## Documentation archival

| Option | Description | Selected |
|--------|-------------|----------|
| Move to Legacy/, never delete | Continue the Documents/Legacy/ convention; nothing deleted | ✓ |
| Delete truly-dead, archive the rest | Delete zero-value docs, archive useful ones | |
| You decide per-doc | Agent proposes archive/delete/update per doc | |

**User's choice:** Move to Legacy/, never delete

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-correct, list changes | Agent corrects drift directly, summary after | |
| Report drift, you approve | Agent reports doc-vs-code drift, you approve each correction | ✓ |
| Fix code-vs-doc per case | Agent flags whether code regressed or doc is stale | |

**User's choice:** Report drift, you approve
**Notes:** CLAUDE.md is load-bearing/high-stakes → confirm-first, no silent edits.

---

## Claude's Discretion

- Contents of the polish checklist / 6-pillar rubric.
- WebView performance-budget measurement method.
- Diagnosing code-regression vs stale-doc for each CLAUDE.md drift (resolution direction still operator-approved).

## Deferred Ideas

None — discussion stayed within phase scope.
