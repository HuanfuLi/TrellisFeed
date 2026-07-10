# Phase 34: v1.4 close-out — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 34-v1-4-close-out-verification-debt-and-cleanup
**Areas discussed:** Seam 11 fix approach, Wave order / dependencies, Phase 28 deferred human-UAT scope, Cleanups + WIP commit shape

---

## Pre-discussion gates

### Q0a: CONTEXT capture mode

| Option | Description | Selected |
|--------|-------------|----------|
| Continue without CONTEXT.md (Recommended) | ROADMAP entry already specifies 9 concrete scope items with file paths, line numbers, and 8 success criteria. Like Phase 33 hygiene work — gap closure with locked scope. | |
| Run /gsd:discuss-phase first | Capture decisions via the discuss-phase workflow before planning. Adds one round-trip but produces a 34-CONTEXT.md following Phases 32/32.1/33 pattern. | ✓ |

**User's choice:** Run /gsd:discuss-phase first

### Q0b: Research before planning

| Option | Description | Selected |
|--------|-------------|----------|
| Skip research (Recommended) | Gap closure with concrete locked scope. Phases 32/33 also skipped research. | |
| Research first | Spawn gsd-phase-researcher to investigate before planning. | ✓ |

**User's choice:** Research first (will run in plan-phase after discuss-phase completes)

### Q0c: Gray area selection (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Seam 11 fix approach | Test desync: 4 fix shapes possible. | ✓ |
| Wave order / dependencies | VERIFICATION docs vs test fixes ordering; Seam 12 vs WIP commit relationship. | ✓ |
| Phase 28 deferred human-UAT scope | Opportunistic / strict / explicit. | ✓ |
| Cleanups + WIP commit shape | VineProgress dead props, Phase 33 functional changes, WIP commit shape. | ✓ |

**User's choice:** All 4 selected

---

## Seam 11 fix approach

### Q1: Fix shape

| Option | Description | Selected |
|--------|-------------|----------|
| Inline mocks per test (Recommended) | Drop _actions-mock-loader.mjs dependency entirely. Each test uses local stubs/spies for the 9 mocked services. More test code (+~80-150 lines per test) but fully self-contained. Tests run under default npm test. | ✓ |
| Add --experimental-loader to npm test (Risk) | Change npm test script to load _actions-mock-loader.mjs globally. Loader's hooks intercept podcast/question/db/embedding/llm/qfilter/settings/tts services GLOBALLY. May break unrelated tests. | |
| Add .ts extensions to service imports | Fix Node 25 issue: change trellis-actions.service.ts:13 from './podcast.service' to './podcast.service.ts'. Tests still need the loader for behavioral mocking. Doesn't fix CLASSIFICATION_COMPLETED desync. | |
| Just rename event + accept tests stay broken | Edit subscriptions to GRAPH_UPDATED but tests still fail to load due to ERR_MODULE_NOT_FOUND. Defers test resurrection to v1.5. | |

**User's choice:** Inline mocks per test (Recommended)

**Notes:** Operator preference is "less surface area, more isolation". Loader-based approach blamed for the 7-test-failure mass that surfaced this audit cycle.

### Q2: Test name + assertion handling

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite assertions (Recommended) | Update test names/comments to reference GRAPH_UPDATED. Update assertion text. Cleanest — tests reflect current production contract. Add a comment noting rename history (Phase 32.1 D-W3-02). | ✓ |
| Keep original names, update only event subscriptions | Tests still named 'replant emits CLASSIFICATION_COMPLETED event' but actually subscribe to GRAPH_UPDATED. Misleading but preserves git blame at a glance. | |
| Rename + add a single legacy alias test | Main tests rewritten. Add ONE small test asserting CLASSIFICATION_COMPLETED no longer exists in AppEvent union (regression guard). | |

**User's choice:** Rewrite assertions (Recommended)

---

## Wave order / dependencies

### Q3: Wave structure

| Option | Description | Selected |
|--------|-------------|----------|
| Tests first, then docs (Recommended) | Wave 1: Seam 11 + Seam 12. Wave 2: 30/31 VERIFICATION + 32-CLOSURE.md. Wave 3: orphan cleanup. Wave 4: VALIDATION flips. Wave 5: device UAT + WIP commit. | ✓ |
| Docs first, then tests, then cleanup | Wave 1: VERIFICATION + closure docs. Wave 2: Seam 11 + Seam 12 + orphan cleanup. Wave 3: VALIDATION flips. Wave 4: device UAT + WIP commit. | |
| All independent parallel + serialized close-out | Wave 1: VERIFICATION write-ups, Seam 11 fix, Seam 12 fix, orphan cleanup ALL parallel. Wave 2: VALIDATION flips + 32-CLOSURE.md. Wave 3: device UAT + WIP commit. | |

**User's choice:** Tests first, then docs (Recommended)

### Q4: Seam 12 sequencing relative to WIP commit (initial)

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone commit BEFORE WIP (Recommended) | Land Seam 12 fix as its own atomic commit BEFORE the 26-file WIP commit. Test passes on every commit boundary. | ✓ |
| Folded into the WIP commit | Operator includes Seam 12 in same commit as rebrand+functional. Single commit captures all related changes. | |
| Operator decides at commit time | Phase 34 plans the test fix but doesn't lock the commit ordering. | |

**User's choice (initial):** Standalone commit BEFORE WIP

**Note:** This answer assumed WIP was a single 26-file commit. The follow-up split into 5 commits required revisiting (see Q11 below).

### Q5: Device UAT timing

| Option | Description | Selected |
|--------|-------------|----------|
| After all code/docs land, before WIP commit (Recommended) | Sequence: code+docs (Waves 1-4) → device UAT → record results → flip VERIFICATIONs → then WIP commit. Device-revealed bug becomes a Phase 34 fix. | ✓ |
| After WIP commit (final close-out) | Code+docs land, WIP commits, then operator does device UAT as the final action. Cleaner separation but bug surfaces become Phase 35. | |
| Bundled into WIP commit deploy cycle | Operator commits WIP, builds APK, deploys, runs UAT. Tightest cycle but risks half-shipped phase if UAT fails. | |

**User's choice:** After all code/docs land, before WIP commit (Recommended)

---

## Phase 28 deferred human-UAT scope

### Q6: Treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Opportunistic recording (Recommended) | Record outcomes if operator's APK session naturally covers any of the 6 items. Don't gate Phase 34. | ✓ |
| Strict scope (defer to v1.5) | Phase 34 device UAT covers ONLY the 5 currently flagged human_needed items. Phase 28's 6 items stay unvisited. | |
| Explicit — include all 11 items | Phase 34 device UAT explicitly tests all 11 items. Closes Phase 28's UAT debt as a side effect. | |

**User's choice:** Opportunistic recording (Recommended)

---

## Cleanups + WIP commit shape

### Q7: VineProgress dead props

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into Seam 2 sweep (Recommended) | While deleting post-store and ImmersiveInfoFlow, also remove the 3 dead props from VineProgressProps and HomeScreen pass-through. ~5-10 line edit, 2 files. | ✓ |
| Strict defer | Honor ROADMAP 'Out of scope' line for VineProgress dead props. Remains v1.5 cleanup item. | |

**User's choice:** Fold into Seam 2 sweep (Recommended)

### Q8: Phase 33 WIP functional changes

| Option | Description | Selected |
|--------|-------------|----------|
| Document in 33-REBRAND.md addendum, then commit as part of WIP (Recommended) | Append 'Functional changes' section to 33-REBRAND.md listing each change + rationale + test coverage. Operator commits the whole WIP. | ✓ |
| Split into separate Phase 33.1 plans retroactively | Create 33.1-01..06 plan files retroactively. Cleanest GSD trail but adds significant work for already-verified code. | |
| Move them to v1.5 (revert from WIP) | Operator reverts the functional changes, lands rebrand-only WIP, re-applies in v1.5. | |
| Operator decides per-change at commit time | Phase 34 lists each functional change as 'pending operator decision'. | |

**User's choice:** Document in 33-REBRAND.md addendum, then commit as part of WIP (Recommended)

### Q9: WIP commit shape (revised after operator pivot)

After operator stated "milestone closing phase so we should address all problems and unfinished work" and full disposition of 36 working-tree items was tabulated, the original 3-option commit-shape question was replaced with a comprehensive 5-commit proposal.

**Proposed 5-commit shape:**
1. Rebrand only (~17 items): `feat(brand): rebrand EchoLearn to Trellis (...)`
2. Functional follow-on with Seam 12 fix folded in (~13 items): `refactor(feed+review): JSON parser hardening, image pre-gen architecture shift, queue tuning, ReviewScreen dedup`
3. Audit artifacts (2 items): `docs(audit): v1.4 milestone audit + integration check v2 (...)`
4. Phase 34 planning context (auto via gsd-tools): 34-CONTEXT.md, 34-DISCUSSION-LOG.md, STATE.md
5. Phase 34 execution artifacts (incremental during execute-phase)

### Q10: Presentation/ directory disposition

| Option | Description | Selected |
|--------|-------------|----------|
| Add to .gitignore (Recommended) | Personal demo prep, not product code. Operator keeps slide-deck workspace local. One-line .gitignore change. | ✓ |
| Commit as its own docs/Presentation commit | Track the demo materials in git for posterity. Useful if operator wants the materials reviewable later. | |
| Move out of repo (defer to operator) | Operator moves Presentation/ to a separate location. Phase 34 notes it should be removed from repo. | |

**User's choice:** Add to .gitignore (Recommended)

### Q11: Seam 12 sequencing reshape (revisits Q4)

After the 5-commit split, Q4's "standalone before WIP" answer no longer worked because the WIP was no longer a single bundled commit and the image-pregen production move now lived in Commit 2 specifically.

| Option | Description | Selected |
|--------|-------------|----------|
| Fold Seam 12 into Commit 2 (Recommended) | Test fix lands atomically with image-pregen production move. Tests green on every commit boundary. Reverses Q4 because the original assumption (single WIP commit) no longer holds. | ✓ |
| Keep Seam 12 standalone, accept temporary red boundary | Land Seam 12 BEFORE Commit 2. Tests RED between Commit 1 and Commit 2. Honors original instinct but breaks 'green on every commit' rule. | |
| Land Seam 12 AFTER Commit 2 | Commit 2 lands first; test fails; Commit 3 fixes test. Each commit atomic but Commit 2 is RED. | |

**User's choice:** Fold Seam 12 into Commit 2 (Recommended)

### Q12: Final disposition check

| Option | Description | Selected |
|--------|-------------|----------|
| Plan as proposed — commit everything (Recommended) | 5-commit shape locked. Presentation/ → .gitignore. Nothing reverted. Phase 34 closes v1.4 by landing all 36 working-tree items. | ✓ |
| Revert specific items (free text) | Free-text reply listing items to revert instead of commit. | |
| Add additional fixes (free text) | Free-text reply listing additional fixes to bundle. | |

**User's choice:** Plan as proposed — commit everything (Recommended)

---

## Claude's Discretion

- Exact test code structure for inline mocks in Seam 11 — planner/researcher will investigate `t.mock.method()` API vs object-replacement pattern (per D-03).
- File ordering within each commit — decided at commit time.
- Whether `33-REBRAND.md` ships in Commit 1 (rebrand) or Commit 2 (functional addendum) — aesthetic choice, either works.
- Granularity of `34-UAT-LOG.md` rows (per item or per session) — operator pacing.
- Length and detail of `32-CLOSURE.md` (short annotation vs full close-out doc).

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section. Summary:

- Pre-existing trellis test failures (Node 25 JSON import strictness) — v1.5+
- Pre-existing Phase 26 test-code bugs (TrellisTooltip + getVineColor) — v1.5
- Phase 32.1 Wave 3/4 addenda formal verifier pass — optional v1.5
- Append-only derived list + persistent cycle position — v1.5 carry-over (CLAUDE.md gaps)
- localStorage key migration — post-presentation v1.5 task
- Phase 28's 6 deferred human-UAT items — opportunistic only, not a hard scope item

No backlog todos matched Phase 34 (`gsd-tools todo match-phase 34` returned 0 matches).
