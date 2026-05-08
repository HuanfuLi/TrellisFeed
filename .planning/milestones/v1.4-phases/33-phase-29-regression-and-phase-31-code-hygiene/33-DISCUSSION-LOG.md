# Phase 33: Phase 29 regression + Phase 31 code hygiene — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 33-phase-29-regression-and-phase-31-code-hygiene
**Areas selected for discussion:** TD-04 resolution direction, TD-05 + TD-06 scope, WIP triage policy
**Areas deferred to Claude's discretion:** tsc error priority

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| TD-04 resolution direction | Restore vs supersede Phase 29 contract | ✓ |
| WIP triage policy | 9 modified + 3 untracked files | ✓ |
| TD-05 + TD-06 scope | Orphan deletion + dead branch fix | ✓ |
| tsc error priority | 5 new errors — fix all vs subset | |

**User's choice:** Selected TD-04 resolution direction, WIP triage policy, TD-05 + TD-06 scope.

---

## TD-04 resolution direction

### Q1: Restore Phase 29's applyStrategyBias wiring or supersede the contract?

| Option | Description | Selected |
|--------|-------------|----------|
| Supersede the contract (Recommended) | Phase 31 D-14 generation-time priority subsumes it | ✓ |
| Restore the wiring | Re-add applyStrategyBias in concept-feed | |
| Hybrid | Thin bias on top of getRecentSignals() | |

**User's choice:** Supersede the contract

---

## TD-05 + TD-06 scope

### Q2: Orphan sweep scope (ConceptProgressCard, post-store, ImmersiveInfoFlow)?

| Option | Description | Selected |
|--------|-------------|----------|
| Delete all three (Recommended) | Clean cut | |
| Delete 2, keep ImmersiveInfoFlow with comment | | |
| Delete only ConceptProgressCard, defer rest | Minimal-surface cleanup | ✓ |

**User's choice:** Delete only ConceptProgressCard, defer post-store + ImmersiveInfoFlow

### Q3: Dead 'dying' branch fix (concept-feed.service.ts:745)?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop 'dying' | falling + fallen cover it | |
| Replace 'dying' with 'yellow' | Matches LeafState member | |
| Drop the entire branch | easeFactor<1.5 alone | |

**User's reply (initial):** "Investigate thoroughly. What is leaf status used for? In design, leaves become dying (overdue once, shown as yellow) and dead (overdue several days, shown as fallen)"

**Investigation outcome:** Confirmed two-layer vocabulary: internal `LeafState` type uses botanical literals (`yellow`/`falling`/`fallen`), user-facing UI uses mortality labels (`Dying`/`Dead`). Mapping is in `TrellisStatusPanel.tsx:44-45`.

### Q4 (reframe): After investigation — proper fix?

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmed: replace 'dying' → 'yellow' | 1-line swap | |
| Also rename LeafState literals to match design | Cross-cutting refactor | ✓ (initial) |
| Fix + clarifying comment | | |

**User's initial choice:** Rename LeafState literals. Claude pushed back citing two-layer vocabulary. User countered: "It doesn't make sense to swap to me."

### Q5 (re-scope after pushback): Rename vs swap vs drop TD-06?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop TD-06 entirely | Low-impact safety-net via easeFactor<1.5 | |
| Minimal swap 'dying'→'yellow' | Original Claude recommendation | |
| Full rename to unify vocabulary | 5-file refactor | ✓ |

**User's choice (final):** Full rename — unify vocabulary across type union + components + tests.

### Q6: Fold rename into Phase 33 or carve Phase 34?

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into Phase 33 (Recommended) | Single phase, single verification pass | ✓ |
| Carve Phase 34 | Dedicated refactor phase | |

**User's choice:** Fold into Phase 33

---

## WIP triage policy

### Q7: 9 modified + 3 untracked files — triage approach?

| Option | Description | Selected |
|--------|-------------|----------|
| Commit all as Phase 33 prerequisite | Review + single chore commit | ✓ |
| Review and cherry-pick | File-by-file triage | |
| Discard all WIP | Start clean | |

**User's choice:** Commit all as Phase 33 prerequisite

---

## Claude's Discretion (deferred topic)

After the selected areas were resolved, Claude applied a default to the non-selected area and the user approved via "Create context":

- **tsc error priority:** Fix all 5 new Phase 31 tsc errors in Phase 33 (3 unused VineProgress props + 4 unused helpers in concept-feed.service.ts). In-scope per the ROADMAP entry; code-hygiene phase is the natural home.

Locked in CONTEXT.md as D-16, D-17, D-18.

---

## Decision rework log

Phase 33's TD-06 discussion required multiple rework passes:

1. **Initial Claude recommendation:** Drop 'dying' (option 1).
2. **User asked for investigation:** "What is leaf status used for? In design, leaves become dying and dead."
3. **Claude investigated and updated recommendation:** Replace 'dying' → 'yellow' (option 2).
4. **User picked option 3 (rename):** But selected the larger refactor.
5. **Claude pushed back:** Two-layer vocabulary is intentional.
6. **User countered:** "It doesn't make sense to swap to me."
7. **Claude fully researched:** Confirmed the two-layer pattern but acknowledged user's point that design docs show dying/dead, not yellow/fallen.
8. **User asked "why tf do we need to care":** Claude explained the bug severity honestly (real correctness issue, low impact due to easeFactor safety net).
9. **User final decision:** Full rename to unify vocabulary.
10. **Phase scope:** Fold into Phase 33.

Lesson recorded for future TD-06-style decisions: when user has a clear design-vocabulary preference, don't try to defend inherited code vocabulary as "intentional two-layer separation" — respect the design preference and cost it honestly.

---

## Deferred Ideas

None additional — all out-of-scope items (post-store deletion, ImmersiveInfoFlow deletion, 'falling' rename, pre-existing tsc/test failures) were explicitly captured in CONTEXT.md `<deferred>` section.
