# Phase 32: v1.4 verification close-out & UAT retest — Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the verification debt surfaced by `.planning/v1.4-MILESTONE-AUDIT.md`. Specifically:

1. Rerun Phase 31 UAT against the 8 failed items in `31-UAT.md` after the 31-08/09/10 gap-closure plans landed, appending `retest:` rows.
2. Fix the one cosmetic UAT finding (UAT-31-11: post-retention dropdown anchors off-screen) inline during the retest session.
3. Write `30-VERIFICATION.md` verifying all 22 Phase 30 decisions (D-01..D-22) against current code.
4. Write `31-VERIFICATION.md` verifying all 47 Phase 31 decisions (D-01..D-47) against current code + UAT retest results.
5. Flip VALIDATION.md `status: draft → validated` + `nyquist_compliant: false → true` on Phases 28, 29, 30 (doc drift only — VERIFICATION already passed for 28/29; Phase 30 flips only after its VERIFICATION writes up clean).

Out of scope (handled in Phase 33): TD-04 (Phase 29 TD-01 regression), TD-05 (orphaned components), TD-06 (dead `'dying'` LeafState branch), 5 new Phase 31 tsc errors, WIP triage.

</domain>

<decisions>
## Implementation Decisions

### VERIFICATION.md depth & style

- **D-01:** `30-VERIFICATION.md` verifies each of the 22 Phase 30 decisions (D-01..D-22) **inline** — single audit table with status (VERIFIED / NO-OP / DEFERRED) and grep/file evidence per row. No bulk-block shortcuts. Rationale: 9 decisions are not claimed in any SUMMARY frontmatter; inline rows are the only way to distinguish "implemented but not logged" from "deferred".
- **D-02:** `31-VERIFICATION.md` uses the **same inline approach** as Phase 30 — every one of the 47 decisions gets a row. Consistency across the two files keeps them readable side-by-side and makes audit repeatable.
- **D-03:** Both VERIFICATION files use **Phase 29's abbreviated observable-truths style**, not Phase 28's 30-row full truth table. Rationale: 47 decisions would balloon a Phase-28-style table past readability. Keep it to: goal achievement table (truths), required artifacts (files), requirements coverage (decisions, inline), gaps summary. Skip Key Link and Data-Flow Trace sections unless a specific decision calls for them.

### UAT retest

- **D-04:** Retest **all 8 failed items** in `31-UAT.md` against the 31-08/09/10 fixes. Append `retest:` rows to each failing test block — do NOT rewrite the original `result:` rows (preserve the first-pass history).
- **D-05:** Retest runs **before** writing `31-VERIFICATION.md`. The verifier needs the retest outcome as evidence for the 8 items it's auditing.
- **D-06:** Phase 28's 6 human-UAT items (haptic, slide-down, scroll shadow, resize re-snap, trellis pulse, locale switch) are **out of scope for Phase 32**. Device availability is the constraint; if device is present during retest, record them opportunistically in Phase 28's UAT file — but don't gate Phase 32 completion on them.

### UAT-31-11 dropdown fix

- **D-07:** Root cause is **native `<select>` opening off-screen** — CSS positioning/anchor issue on `SelectInput` wrapper in `SettingsDataScreen.tsx:147` (postRetention field). Not a layout width issue.
- **D-08:** **Fix during the UAT retest session**, not up-front. Tester opens Settings > Data & Privacy on device, captures the actual repro (screenshot or video), patch is written against the observed behavior. Avoids fix-by-guess.
- **D-09:** The fix lives in `SelectInput` inside `app/src/screens/settings/SettingsShared.tsx` (shared component) if the root cause is shared styling, OR in `SettingsDataScreen.tsx` if it's a row-local issue. Planner should include a discovery task.

### VALIDATION flip discipline

- **D-10:** `28-VALIDATION.md` + `29-VALIDATION.md` flip to `status: validated` + `nyquist_compliant: true` as part of Phase 32 — their VERIFICATION.md files already passed (28: 30/30, 29: 10/10), so this is pure doc drift correction.
- **D-11:** `30-VALIDATION.md` only flips after `30-VERIFICATION.md` is written and every decision row is VERIFIED or explicitly documented as NO-OP/DEFERRED. No flip if any decision is left as BLOCKED or unresolved.
- **D-12:** `31-VALIDATION.md` is **already** `status: validated` + `nyquist_compliant: true` (re-audited 2026-04-18) — no change needed.

### Claude's Discretion

- Exact row ordering and column set in VERIFICATION.md tables (keep Phase 29's columns: Truth | Status | Evidence).
- Whether to split 30-VERIFICATION and 31-VERIFICATION into waves/plans or one plan each.
- Whether to include a brief summary of the 28-29 VALIDATION flips in the audit report or just commit them silently.
- Commit granularity — one commit per VERIFICATION.md, or one commit per phase's full close-out (UAT + VERIFICATION + VALIDATION flip).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit source

- `.planning/v1.4-MILESTONE-AUDIT.md` — Authoritative gap list; TD-04/05/06 are deferred to Phase 33, everything else is Phase 32.
- `.planning/v1.4-INTEGRATION-CHECK.md` — Seam-by-seam evidence for which files/lines changed, used to inform verification rows.

### Prior VERIFICATION.md patterns to mirror

- `.planning/phases/29-final-polishment/29-VERIFICATION.md` — Abbreviated observable-truths style to mirror (10/10 format, frontmatter shape).
- `.planning/phases/28-ui-ux-polish-from-audit-findings/28-VERIFICATION.md` — Reference for richer evidence columns (used for comparison, not a template to copy wholesale).

### UAT ledger

- `.planning/phases/31-curiosity-feed-redesign-post-lifecycle-and-display/31-UAT.md` — Contains all 8 failed test rows that need `retest:` appended.
- `.planning/phases/29-final-polishment/29-UAT-LOG.md` — Append-only UAT log pattern (operator + date + row-per-item).

### Phase scope surfaces

- `.planning/phases/30-redesign-curiosity-feed-as-scroll-progress-bar-with-daily-reading-quota-credits/30-CONTEXT.md` — Phase 30's 22 decisions (D-01..D-22).
- `.planning/phases/31-curiosity-feed-redesign-post-lifecycle-and-display/31-CONTEXT.md` — Phase 31's 47 decisions (D-01..D-47).
- All `.planning/phases/30-*/30-0N-SUMMARY.md` + `.planning/phases/31-*/31-0N-SUMMARY.md` — SUMMARY frontmatter with `requirements_completed` for cross-check.

### Gap-closure fix references (for retest evidence)

- `.planning/phases/31-curiosity-feed-redesign-post-lifecycle-and-display/31-08-SUMMARY.md` — Queue cycling + empty-queue refill + YouTube dedup (UAT tests 2, 7, 13).
- `.planning/phases/31-curiosity-feed-redesign-post-lifecycle-and-display/31-09-SUMMARY.md` — Unified video state + touch overlay + close button (UAT tests 4, 5).
- `.planning/phases/31-curiosity-feed-redesign-post-lifecycle-and-display/31-10-SUMMARY.md` — LLM suggestion topics + fresh install empty state + checklist backdrop (UAT tests 3, 6, 14).

### Fix target for UAT-31-11

- `app/src/screens/settings/SettingsDataScreen.tsx:146-154` — Post-retention `SettingRow` + `SelectInput` site.
- `app/src/screens/settings/SettingsShared.tsx` — Shared `SelectInput` component (styling candidate if root cause is shared).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`SelectInput`** (from `SettingsShared`): shared wrapper around native `<select>`. If positioning is a wrapper-level issue, fix here propagates to every Settings sub-screen.
- **`SettingRow`**: standardized row layout — label left, control right. Dropdown anchor depends on this row's flex/positioning rules.
- **Phase 29's UAT-LOG.md pattern**: operator + date + PASS/SKIP rows + sign-off checklist. `31-UAT.md` already uses `result:` keys — retest should use `retest:` keys for symmetry.
- **Gap-closure plans (29-04 style)**: standalone plan per gap bundle with inline fix sub-loop.

### Established Patterns

- VERIFICATION.md written by `gsd-verifier` agent after plans complete (auto during execute-phase). For retroactive verification, the agent can be invoked directly.
- VALIDATION.md frontmatter fields: `status`, `nyquist_compliant`, `wave_0_complete`, `validated`, `re_audited` dates. Preserve all existing fields when flipping.
- `31-UAT.md` schema: `expected:` / `result:` / `reported:` / `severity:` keys. Retest rows must match this schema.

### Integration Points

- UAT retest drives content in 31-VERIFICATION.md rows for the 8 retest items — evidence column cites "31-UAT.md retest:N-passed".
- 30-VERIFICATION.md evidence column cites code file:line for each decision — no UAT dependency.
- VALIDATION.md flips are independent of VERIFICATION.md content for 28/29; for 30, the flip is gated on VERIFICATION.md completing cleanly.

</code_context>

<specifics>
## Specific Ideas

- Mirror `29-VERIFICATION.md`'s shape precisely: YAML frontmatter with `phase/verified/status/score`, followed by Observable Truths table, Required Artifacts table, Key Link Verification (optional), Behavioral Spot-Checks, Requirements Coverage table (one row per decision), Anti-Patterns, Human Verification Required, Gaps Summary.
- For Phase 30/31 inline decision verification, format each row as: `| D-NN | short description | VERIFIED / NO-OP / DEFERRED | file.tsx:lineN (grep "pattern" matches K) | evidence detail |`.
- Retest rows in `31-UAT.md` should read like: `retest: pass` with `retested: 2026-04-XX` and `retested_by: HuanfuLi` + `fix_source: 31-08-SUMMARY.md` (or 31-09/31-10 as applicable).
- UAT-31-11 fix likely needs `position: relative` on the SelectInput wrapper + `position: absolute; left: 0` on the native select for iOS Safari anchor correctness, OR switching to a portal-rendered custom dropdown. Confirm after device repro.

</specifics>

<deferred>
## Deferred Ideas

- **TD-04 (Phase 29 TD-01 regression):** Phase 33 scope. Requires decision (restore vs supersede) — separate from docs work.
- **TD-05 (orphaned ConceptProgressCard, post-store, ImmersiveInfoFlow):** Phase 33 scope.
- **TD-06 (dead `'dying'` LeafState branch):** Phase 33 scope.
- **5 new Phase 31 tsc errors:** Phase 33 scope.
- **Working-tree WIP triage (9 modified + 3 untracked files):** Phase 33 scope.
- **Phase 28's 6 human-UAT items:** Opportunistic — record in Phase 28's UAT file if device is handy during Phase 32 retest session, but not a gate.
- **Pre-existing Node-25 trellis test failures (24):** Carried from v1.3 per 29-03-SUMMARY. Not a Phase 32 concern; re-evaluate in v1.5.

</deferred>

---

*Phase: 32-v1-4-verification-close-out-and-uat-retest*
*Context gathered: 2026-04-18*
