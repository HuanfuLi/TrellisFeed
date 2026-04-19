# Phase 33: Phase 29 regression + Phase 31 code hygiene — Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Resolve the three code regressions surfaced by `.planning/v1.4-MILESTONE-AUDIT.md` (TD-04, TD-05, TD-06), clear the 5 new tsc errors introduced by Phase 31, commit the working-tree WIP, and unify the trellis leaf-state vocabulary by renaming the internal `LeafState` literals to match user-facing design names.

**In scope (ordered by execution):**
1. WIP flush — review + commit the 9 modified + 3 untracked files sitting in the working tree (TD-05 prerequisite so the rename doesn't collide with experimental edits).
2. TD-05 partial orphan sweep — delete only `ConceptProgressCard.tsx` + `CompactProgressBar` export; defer `post-store.service.ts` and `ImmersiveInfoFlow` to a future milestone.
3. TD-06 via full LeafState rename — `'yellow'` → `'dying'`, `'fallen'` → `'dead'` across type union, `computeLeafState`, trellis components, dev-mode seeds, tests. `'falling'` stays (internal-only gradation).
4. TD-04 supersession — delete `concept-feed-strategy.test.mjs` + orphaned TD-01 plumbing assertion in `orchestration-strategy.test.mjs`; update `29-VERIFICATION.md` + `29-UAT-LOG.md` to mark TD-01 SUPERSEDED-BY-PHASE-31 with pointer to D-14.
5. 5 new Phase 31 tsc errors — 3 unused `VineProgress` props (wire or drop from prop interface) + 4 unused helpers in `concept-feed.service.ts`.

**Out of scope (deferred / post-Phase 33):**
- Restoring `applyStrategyBias` in concept-feed (explicitly rejected in favor of supersession).
- `post-store.service.ts` deletion (retained; revisit next milestone).
- `ImmersiveInfoFlow` export deletion (retained; revisit next milestone).
- Renaming `'falling'` (kept as internal implementation detail — the UI never exposes it).
- Pre-existing 4 tsc errors in AskScreen / PlannerScreen / SettingsFeaturesScreen / SettingsScreen (carried from Phase 29; not Phase 33 scope).
- Pre-existing 24 Node-25 trellis test failures (carried from v1.3).

**Depends on:** Phase 32 (verification baseline must be set before mutating code the verifier just audited).

</domain>

<decisions>
## Implementation Decisions

### TD-04 — Phase 29 TD-01 regression

- **D-01:** SUPERSEDE the original TD-01 contract. Do NOT restore `applyStrategyBias` + `computeHints` in `concept-feed.service.ts`. Rationale: Phase 31 D-14 (generation-time weak-concept prioritization — 2 posts per important concept) already implements the weak-concept bias at the right layer. Restoring the Phase 29 sort bias would double-layer the weighting.
- **D-02:** Delete `app/tests/services/concept-feed-strategy.test.mjs` entirely (5 failing tests all assume applyStrategyBias exists).
- **D-03:** Delete the TD-01 plumbing assertion in `app/tests/services/orchestration-strategy.test.mjs` (the 1 remaining concept-feed-side assertion; leave the plannerAutoGen-side assertion alone since plannerAutoGen still wires checkInSignals).
- **D-04:** Update `.planning/phases/29-final-polishment/29-VERIFICATION.md`:
  - Change TD-01 row status from `SATISFIED` to `SUPERSEDED-BY-PHASE-31`.
  - Add Evidence cell: "Phase 31 D-14 (31-CONTEXT.md) implements weak-concept prioritization at generation time — 2 posts per important concept. This subsumes the Phase 29 runtime sort bias. concept-feed.service.ts still calls plannerService.getRecentSignals() at line 251 for LLM prompt context, but applyStrategyBias is intentionally absent."
- **D-05:** Update `.planning/phases/29-final-polishment/29-UAT-LOG.md`: add a SUPERSEDED entry for TD-01 with the same pointer to 31-CONTEXT D-14. Preserve original UAT row — append, don't overwrite.

### TD-05 — Partial orphan sweep

- **D-06:** Delete `app/src/components/ConceptProgressCard.tsx` entirely. Both exports (`ConceptProgressCard`, `CompactProgressBar`) are replaced by `VineProgress.tsx` and have zero live consumers.
- **D-07:** Retain `app/src/services/post-store.service.ts` (deferred — no deletion in Phase 33). If `postStoreService` remains unused at the start of v1.5 milestone planning, revisit.
- **D-08:** Retain `ImmersiveInfoFlow` export in `app/src/components/InfoFlow.tsx` (deferred — no deletion). Same revisit trigger.
- **D-09:** Remove any dead i18n keys that were ONLY consumed by ConceptProgressCard/CompactProgressBar from all 4 locale bundles (`home.progress.*`, `home.compact.*` if they existed and are now unreferenced). grep-verify before deleting. Preserve all keys still referenced by VineProgress or any other component.

### TD-06 — LeafState vocabulary unification

- **D-10:** Rename `LeafState` literal `'yellow'` → `'dying'` across the entire codebase.
- **D-11:** Rename `LeafState` literal `'fallen'` → `'dead'` across the entire codebase.
- **D-12:** Keep `'falling'` as-is — it's an internal-only 7-13d-overdue gradation the UI never exposes. Rationale: the user-facing UI distinguishes only "Dying" and "Dead"; `'falling'` is a layout-level visual cue for medium-overdue leaves that falls under "Dying" semantically (see `TrellisStatusPanel.tsx:44`).
- **D-13:** Update targets:
  - `app/src/services/trellis-state.service.ts:9` (type union) + lines 88-90 (computeLeafState return values) + dev-mode seed array lines 113-119 (all string literals).
  - `app/src/components/trellis/TrellisStatusPanel.tsx:44-45` (filter predicates).
  - `app/src/components/trellis/TrellisCanvas.tsx` (any leaf-state string comparisons).
  - `app/src/components/trellis/TrellisLeaf.tsx` (state-to-color/shape mapping).
  - `app/src/components/trellis/types.ts` (any local type re-exports).
  - `app/src/components/ui/Badge.tsx` (leaf-state-aware variants if any).
  - `app/src/services/concept-feed.service.ts:745` — after the rename, the existing `'dying'` literal becomes VALID (no longer TS2367). The TD-06 tsc error clears automatically.
  - `app/tests/**` — any test fixtures referencing `'yellow'` or `'fallen'` (grep-sweep).
- **D-14:** Locale bundle i18n keys (`trellis.leafState.dying`, `trellis.leafState.dead`) already exist with correct values — no locale bundle changes required. Verify with bundle-parity test after rename.
- **D-15:** Git-history preservation: use a single commit for the rename so `git log --follow` traces cleanly. Do not mix the rename commit with TD-04 / TD-05 work.

### 5 new Phase 31 tsc errors

- **D-16:** VineProgress 3 unused props — inspect each prop's original intent. If planned for future use, wire them into the component with a simple passthrough or stub. If genuinely dead, drop from the prop interface.
- **D-17:** 4 unused helpers in `concept-feed.service.ts` (likely `assignPresentationStyles`, `interleaveNewsPosts`, or equivalents made obsolete by D-17/D-21/D-44 of Phase 31). Delete with `git grep` confirmation of zero call sites.
- **D-18:** After all fixes, `npx tsc -b --noEmit` MUST show only the 4 pre-existing errors documented in `29-03-SUMMARY.md` (AskScreen, PlannerScreen, SettingsFeaturesScreen, SettingsScreen). Zero new errors.

### WIP flush

- **D-19:** Commit all 9 modified + 3 untracked files as a Phase 33 prerequisite (task 00 or equivalent), before any rename/orphan-sweep work starts. Single commit message: `chore(v1.4): flush WIP from phases 30-31 follow-up edits`.
- **D-20:** Review policy during the flush: read each diff; abort the commit and escalate if any file looks unsafe (e.g., half-implemented feature, secret leakage, debug logs). Expected disposition: all 12 files commit cleanly — the modifications are Phase 31 UAT-feedback polish (locale fixes, screen refinements, new test files for queue/cap/starter-posts behavior).
- **D-21:** The 3 new test files (`concept-batch-filter.test.mjs`, `daily-generation-cap.test.mjs`, `starter-posts.test.mjs`) must pass before the flush commit — they're confirmed-clean per v1.4 integration check. If any fails, pause and fix before proceeding.

### Claude's Discretion

- Commit granularity within each task (single atomic commit per decision bundle, or finer-grained per-file commits).
- Order of tasks within a plan wave (e.g., WIP flush before or alongside TD-05 deletions).
- Whether to bundle D-01..D-05 (TD-04 supersession) as one plan or two (code delete vs docs update).
- Whether to add a new test asserting the TD-06 fix (e.g., test that `computeLeafState` returns `'dying'` for 1d-overdue input).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit source

- `.planning/v1.4-MILESTONE-AUDIT.md` — TD-04/05/06 definitions, severity, and location citations.
- `.planning/v1.4-INTEGRATION-CHECK.md` — seam-by-seam file:line evidence for each regression.

### Phase 32 dependency

- `.planning/phases/32-v1-4-verification-close-out-and-uat-retest/32-CONTEXT.md` — Phase 32 must complete before Phase 33 (Phase 32 writes 30/31-VERIFICATION.md; Phase 33 mutates the code those files reference).

### TD-04 update targets

- `.planning/phases/29-final-polishment/29-VERIFICATION.md` — row to amend.
- `.planning/phases/29-final-polishment/29-UAT-LOG.md` — append SUPERSEDED entry.
- `.planning/phases/31-curiosity-feed-redesign-post-lifecycle-and-display/31-CONTEXT.md` — D-14 text to cite in the supersession evidence.

### Code files to modify (grouped by decision)

**TD-04 (D-02, D-03):**
- `app/tests/services/concept-feed-strategy.test.mjs` — delete
- `app/tests/services/orchestration-strategy.test.mjs` — remove TD-01 plumbing assertion

**TD-05 (D-06, D-09):**
- `app/src/components/ConceptProgressCard.tsx` — delete
- `app/src/locales/en.json`, `zh.json`, `es.json`, `ja.json` — remove dead keys after grep verification

**TD-06 (D-10..D-15):**
- `app/src/services/trellis-state.service.ts`
- `app/src/components/trellis/TrellisStatusPanel.tsx`
- `app/src/components/trellis/TrellisCanvas.tsx`
- `app/src/components/trellis/TrellisLeaf.tsx`
- `app/src/components/trellis/types.ts`
- `app/src/components/ui/Badge.tsx` (if leaf-state aware)
- `app/src/services/concept-feed.service.ts` (line 745 becomes valid automatically)
- `app/tests/**` — test fixtures referencing renamed literals

**tsc errors (D-16, D-17):**
- `app/src/components/VineProgress.tsx` — 3 unused props
- `app/src/services/concept-feed.service.ts` — 4 unused helpers

**WIP (D-19, D-20, D-21):**
- `app/src/components/ScrollToTopFAB.tsx`
- `app/src/locales/{en,zh,es,ja}.json`
- `app/src/screens/PlannerScreen.tsx`
- `app/src/screens/SettingsScreen.tsx`
- `app/src/screens/settings/SettingsDataScreen.tsx`
- `app/src/screens/settings/SettingsFeaturesScreen.tsx`
- `app/src/services/daily-read.service.ts`
- `app/src/services/post-history.service.ts`
- `app/tests/concept-quota.test.mjs`
- `app/tests/services/concept-batch-filter.test.mjs` (untracked)
- `app/tests/services/daily-generation-cap.test.mjs` (untracked)
- `app/tests/services/starter-posts.test.mjs` (untracked)

### Project conventions

- `CLAUDE.md` — inline styles with CSS vars, 4-locale i18n bundle parity mandatory, settingsService pattern, no runtime LLM translation.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`computeLeafState`** is the single source of truth for leaf state derivation; rename impact radiates from its signature.
- **`TrellisStatusPanel.tsx:43-45`** — today's UI-vocabulary mapping (yellow+falling → "Dying", fallen → "Dead"). Post-rename this simplifies: `dyingNodes.filter(n => n.leafState === 'dying' || n.leafState === 'falling')` stays two-state (since we keep 'falling'), but the semantics are cleaner.
- **`plannerAutoGen.service.ts:115-116`** — the surviving TD-01 wiring. Phase 33 leaves it alone.
- **`bundle-parity.test.mjs`** — verifies locale-bundle key sets stay aligned across 4 locales. Re-run after TD-05 D-09 locale key removal.

### Established Patterns

- LeafState lifecycle transitions happen in `computeLeafState` at `trellis-state.service.ts:88-91`. Post-rename:
  - `maxOverdue >= 14 || aggregateEase < 1.5` → `'dead'`
  - `maxOverdue >= 7` → `'falling'` (unchanged)
  - `maxOverdue >= 1` → `'dying'`
  - else → `'green'`
- Dev-mode seeded entries at `trellis-state.service.ts:110-120` use the literal strings — must update every entry.
- Confetti + harvest particle flow in `TrellisStatusPanel` consumes `leafState === 'fruit'` — unaffected by the rename.

### Integration Points

- After rename, `concept-feed.service.ts:745` reads `leaf === 'dying' || leaf === 'falling' || leaf === 'fallen'`. `'fallen'` must also become `'dead'` in the same sweep — otherwise the line re-introduces TS2367. Full rename is atomic per D-15.
- Locale bundle keys `trellis.leafState.dying` / `trellis.leafState.dead` already exist (Phase 27 i18n) — no new keys needed.
- `npm test` baseline after Phase 33 should be: 24 pre-existing Node-25 trellis failures (carried from v1.3) + zero new failures. Any new failure indicates a missed callsite in the rename.

</code_context>

<specifics>
## Specific Ideas

- For the TD-06 rename, use a single find-and-replace pass across the 7 target files, then grep-verify zero residual `'yellow'` or `'fallen'` string literals in `LeafState` contexts. Separate rename per literal to avoid double-touch.
- The 5 new tsc errors may share a root cause (e.g., VineProgress props are unused because HomeScreen was simplified post-31-06). Fix in the same task if the root cause is shared.
- The SUPERSEDED-BY-PHASE-31 marker in 29-VERIFICATION.md should match whatever pattern the 29-UAT-LOG.md uses for SKIP entries — same vocabulary, different key: SKIP for items that never applied, SUPERSEDED for items that applied then got superseded.
- `concept-feed-strategy.test.mjs` likely has 5 test cases asserting applyStrategyBias behavior. Delete the file in one commit, not piecewise.
- If any WIP file diff looks off during the flush (e.g., debug logs, commented-out code), park in a branch and escalate — don't force-commit.

</specifics>

<deferred>
## Deferred Ideas

- Delete `post-store.service.ts` — revisit at start of v1.5 milestone planning (D-07).
- Delete `ImmersiveInfoFlow` export in `InfoFlow.tsx` — revisit at start of v1.5 (D-08).
- Rename `'falling'` to a mortality-themed literal — not worth the churn; UI never exposes it (D-12).
- Restore `applyStrategyBias` in concept-feed — explicitly rejected in favor of Phase 31 D-14's generation-time prioritization (D-01).
- Pre-existing 4 tsc errors in AskScreen / PlannerScreen / SettingsFeaturesScreen / SettingsScreen — carried from Phase 29, out of Phase 33 scope.
- Pre-existing 24 Node-25 trellis test failures — v1.5 concern.
- Phase 28's 6 human-UAT items — opportunistic only, not a Phase 33 gate.

</deferred>

---

*Phase: 33-phase-29-regression-and-phase-31-code-hygiene*
*Context gathered: 2026-04-19*
