# Phase 32: v1.4 verification close-out & UAT retest — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 32-v1-4-verification-close-out-and-uat-retest
**Areas selected for discussion:** Unclaimed decisions, Dropdown fix (UAT-31-11)
**Areas deferred to Claude's discretion:** UAT scope & order, VERIFICATION.md depth

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| UAT scope & order | 8 Phase 31 items only vs. also Phase 28's 6 human-UAT; retest before vs. after VERIFICATION | |
| VERIFICATION.md depth | Phase 28 full truth table vs. Phase 29 abbreviated vs. minimum | |
| Unclaimed decisions | 9 Phase 30 + 19 Phase 31 decisions without SUMMARY frontmatter claim | ✓ |
| Dropdown fix (UAT-31-11) | SelectInput positioning bug — fix timing and approach | ✓ |

**User's choice:** Selected "Unclaimed decisions" and "Dropdown fix (UAT-31-11)"

---

## Unclaimed decisions

### Q1: How should 30-VERIFICATION.md handle the 9 unclaimed decisions?

| Option | Description | Selected |
|--------|-------------|----------|
| Verify each inline (Recommended) | Grep code + mark status per row | ✓ |
| Bulk no-op section | One block covering all 9 as structural | |
| Defer any requiring work to 33 | Inline where clear, BLOCKED otherwise | |

**User's choice:** Verify each inline (Recommended)

### Q2: How should 31-VERIFICATION.md handle its 19 unclaimed decisions?

| Option | Description | Selected |
|--------|-------------|----------|
| Same as Phase 30 (Recommended) | Apply Q1 approach → inline | ✓ |
| Different — 31 gets bulk treatment | Lighter bulk block for 19 items | |
| Different — 31 inline, 30 bulk | Reverse | |

**User's choice:** Same as Phase 30 (Recommended)

---

## Dropdown fix (UAT-31-11)

### Q3: What's the likely root cause of the dropdown-anchor bug?

| Option | Description | Selected |
|--------|-------------|----------|
| Native select opening off-screen | CSS positioning/anchor issue on SelectInput wrapper | ✓ |
| Dropdown too wide / column layout | SettingRow or min-width rules | |
| Let me describe it differently | Free-text | |

**User's choice:** Native select opening off-screen

### Q4: When should we fix the dropdown in Phase 32?

| Option | Description | Selected |
|--------|-------------|----------|
| Fix during UAT retest session (Recommended) | Screenshot-driven patch from actual repro | ✓ |
| Fix up-front, validate during retest | Patch now, validate later | |
| Defer to Phase 33 | Move to 33's scope | |

**User's choice:** Fix during UAT retest session (Recommended)

---

## Claude's Discretion (deferred topics)

After the selected areas were resolved, Claude applied defaults to the two non-selected areas and the user approved via "Create context":

- **UAT scope & order:** Retest the 8 Phase 31 items only (Phase 28's 6 human-UAT items opportunistic, not a gate). Retest runs BEFORE writing 31-VERIFICATION.md so the verifier has retest outcomes as evidence.
- **VERIFICATION.md depth:** Use Phase 29's abbreviated observable-truths style, not Phase 28's 30-row full truth table. 47 decisions (Phase 31) would balloon the Phase-28 style past readability.

These are locked in CONTEXT.md as D-03, D-04, D-05, D-06.

---

## Deferred Ideas

None additional — all out-of-scope items (TD-04/05/06, tsc errors, WIP triage, Node-25 trellis failures) were already captured in `v1.4-MILESTONE-AUDIT.md` and assigned to Phase 33 or future milestones before this discussion.
