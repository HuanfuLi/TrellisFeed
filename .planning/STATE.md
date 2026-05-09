---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: gap closure)
status: executing
stopped_at: Completed 38-01-doc-cleanup-PLAN.md
last_updated: "2026-05-09T04:18:20.789Z"
last_activity: 2026-05-09
progress:
  total_phases: 9
  completed_phases: 1
  total_plans: 3
  completed_plans: 4
---

# Project State: v1.5 ROADMAP CREATED — 2026-05-08

## Current Position

Phase: 38 (v1-4-carry-over-cleanup) — EXECUTING
Plan: 2 of 3
Status: Ready to execute
Last activity: 2026-05-09

## Progress

**Phases:** 1 / 9 complete (37 ✓; 38 IN PROGRESS — plan 1 of 3 done; 39-45 pending)
**Plans:** 1 / 3 complete in Phase 38 (Plan 38-01 doc cleanup ✓; 38-02 + 38-03 running in parallel)

```
[██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 11%
```

### Wave Order

- **Wave 0** (carry-over cleanup): Phase 37 (i18n leaf-module) + Phase 38 (v1.4 carry-overs) — parallel-safe, both unblock Wave 1
- **Wave 1** (foundation services): Phase 39 (engagement) + Phase 40 (source diversity) — parallel-safe, requires Wave 0
- **Wave 2** (service integration): Phase 41 (pipeline + essay depth) — requires Wave 1
- **Wave 3** (UI layer): Phase 42 (masonry) → Phase 43 (engagement UI) — sequential, requires Wave 2
- **Wave 4** (hygiene sweep): Phase 44 (deps) + Phase 45 (code quality) — parallel-safe, lands LAST

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-08 — milestone v1.5 started)

**Core value:** Enable learners to transform fragmented information into structured knowledge through AI-driven Q&A, visual mapping, and adaptive spaced repetition — all while maintaining complete local-first privacy.

**Current focus:** Phase 38 — v1-4-carry-over-cleanup

## Requirement Coverage

22 / 22 requirements mapped to phases ✓ (no orphans)

| Category | Count | Phases |
|----------|-------|--------|
| MASONRY | 2 | Phase 42 |
| ENGAGE | 4 | Phase 39 (×3), Phase 43 (×1) |
| CONTENT | 4 | Phase 40 (×1), Phase 41 (×3) |
| TECHDEBT | 12 | Phase 37 (×1), Phase 38 (×5), Phase 44 (×1), Phase 45 (×5) |

## Carry-overs from v1.4 (in scope for v1.5)

All carry-overs are scheduled into Wave 0:

- **i18n leaf-module refactor** (TECHDEBT-01) → Phase 37
- **VALIDATION drift cleanup 34/35** (TECHDEBT-02) → Phase 38
- **ROADMAP plan-list polish 36-14/36-15** (TECHDEBT-03) → Phase 38
- **33-HUMAN-UAT-1/2 device retest** (TECHDEBT-04) → Phase 38
- **CLAUDE.md `echolearn_*` doc-drift** (TECHDEBT-05) → Phase 38
- **YouTube landscape-listed-as-short bug** (TECHDEBT-06) → Phase 38

## Resolved blockers

All v1.4 blockers resolved at close. No open blockers.

## Last decisions (Plan 38-01 close, 2026-05-09)

- **Annotation phrasing chosen via audit table over action prose** (Task 4 fix). Plan PITFALLS.md action block specified em-dash form `historical — pre-2026-05-07 brand`, but audit table line 94 + acceptance criteria's grep pattern both use colon form `historical: pre-2026-05-07 brand`. Initial Task 4 edit followed action prose (em-dash); verification grep returned 0; followed up with single-character punctuation fix BEFORE committing. Folded into Task 4 commit `911a09df`. Documented as Rule 1 inline auto-fix in 38-01 SUMMARY.
- **Test fixture parity verified end-to-end via diff before editing** (Task 5). Diffed `awk 'NR>=87 && NR<=112' app/src/services/concept-feed.service.ts` against `awk 'NR>=53 && NR<=78' app/tests/services/starter-posts.test.mjs` BEFORE making any change — diff identified exactly 4 EchoLearn occurrences in fixture (1 title + 1 preview + 2 bodyMarkdown openings); post-edit diff confirms zero remaining drift in string args (modulo intentional declaration syntax differences for the inline-reproduce pattern). 9/9 tests pass.
- **Plan 38-02's territory NOT touched** (parallel-execution scope). post-essay.service.ts and concept-feed.service.ts trellis_short_posts references explicitly excluded — Plan 38-02 owns those edits. Verified via git status before each commit; never staged anything outside the 5 declared `files_modified`.
- **All 5 commits used `--no-verify`** per parallel-execution protocol (orchestrator validates hooks once after all 3 wave-1 agents complete).
- **Plan 38-01 close-out: 5 atomic commits across 5 files (TECHDEBT-02 + TECHDEBT-03 + TECHDEBT-05).** Test parity preserved at test:main 562/559/3 + test:actions 16/16/0 (matches Phase 37 close-out; well within plan's ≤3 main / ≤2 actions tolerance). Audit table from PLAN reproduced verbatim in SUMMARY with Bucket C "no surprises encountered" annotation.

## Last decisions (Plan 37-03 close, 2026-05-09)

- **Replace, don't append, the i18next-mentioning paragraph at locale-directive.ts lines 10-15.** The truly load-bearing D-07 prologue (lines 5-8 — `IMPORTANT (D-07): This module is the ONLY code path that reads i18n locale...`) was preserved verbatim per plan instructions. The separate obsolete paragraph (which described the old JSON-import workaround and explicitly named `i18next.language` as the read source) was replaced with the canonical Phase 37 footnote per RESEARCH.md verbatim text (`byte-stable vs. the pre-Phase-37 direct i18next.language read`). Net result: D-07 directive intact + accurate post-refactor technical description; the historical-reference word `i18next.language` survives only inside the canonical footnote prose, not in any code path. Acceptance criteria reconciled per Plan 37-03 SUMMARY Deviation 1.
- **De-collide leaf shim docstring with the new invariant test regex.** The leaf's pre-Plan-37-03 docstring (shipped in Plan 37-01) contained 3 literal `from '../locales'` substrings (all comment text saying what NOT to do); the invariant test's regex `/from\s+['"]\.\.?\/(\.\.\/)?locales/` doesn't distinguish comments from code. Chose to rephrase the leaf's prose (`the locales/index module is imported`) over tightening the regex (which is verbatim from canonical RESEARCH.md). Single-commit fix landed alongside the invariant test in `a9c57cbe`. See Plan 37-03 SUMMARY Deviation 2.
- **Phase 37 close-out: 9 source files migrated (5 Tier 1+2 + 4 Tier 3) + 1 production wire (main.tsx) + 2 new test files (smoke + invariant) + 4 paired test updates = 16 file changes across 11 atomic commits over 3 plans (2+5+5).** TECHDEBT-01 acceptance: 7 of 10 carried `ERR_IMPORT_ATTRIBUTE_MISSING` failures CLOSED (remaining 3 main-suite fails are pre-existing assertion / extension-resolution issues — never `ERR_IMPORT_ATTRIBUTE_MISSING` — out of scope per CLAUDE.md scope-boundary rule); shim exists with 9 service/lib/provider files importing it; tsc -b --noEmit exits 0; manual locale-switch UAT handed off to operator before `/gsd:verify-work`.

## Last decisions (Plan 37-02 close, 2026-05-09)

- **Use `.ts` extension on shim import specifier (`from '../lib/i18n-leaf.ts'`) in all 5 Tier 1+2 service files.** Plan 37-02 / RESEARCH.md § Open Question A specified extensionless `from '../lib/i18n-leaf'` claiming Node 25 native ESM auto-resolves `.ts`. Live verification under `node --test tests/services/trellis-state.test.mjs` showed Node DID NOT auto-add `.ts` — produced `ERR_MODULE_NOT_FOUND`. Matched the existing convention in flashcard.service.ts (lines 2-7 all use `.ts` extensions). Resolved as Rule 3 blocking fix during Task 1 amendment; Tasks 2-5 used the `.ts` form from the start. **Plan 37-03 must adopt the same `.ts` convention** for the 4 Tier 3 source migrations and any test file using `from '../../src/lib/i18n-leaf.ts'`.
- **Plan 37-02's hold-out prediction was wrong: chain closes at Task 3 (question.service.ts), not Task 1 (flashcard.service.ts).** flashcard.service.ts transitively imports question.service.ts which had its own `'../locales/index.ts'` import — plan/RESEARCH treated them as parallel sites, missing the inter-service edge. Final outcome unchanged (7 of 10 carried failures CLOSED at Task 3 instead of Task 1); Plan 37-03 should not assume single-commit chain closure.

## Last decisions (Plan 37-01 close, 2026-05-09)

- **Cast `i18n.t.bind(i18n) as any` at the bind site in main.tsx** — bridges i18next's literal-key-union type from i18n.d.ts module augmentation to the leaf shim's intentionally-generic TFn signature. Single-line cast preserves the plan's regex invariant; eslint-disable + 4-line explanatory comment annotates the bridge. Alternative (widening TFn or wrapper closure) rejected: would couple shim to bundle internals or add a function-call hop in production for zero functional gain.
- **Atomic-pair commit for shim source + smoke test** — per Plan 37-01 plan_notes Pitfall 7 mitigation. Shipping the test alone would fail; shipping the source alone leaves the hold-out unverifiable. Two atomic commits at plan close: `4e72565a` (shim+test) + `04056289` (main.tsx wire). Bisection-friendly per D-03.

## Last decisions (Roadmap creation, 2026-05-08)

- **9 phases across 4 waves** following synthesizer's recommended dependency graph; merged Wave 0 carry-over cleanup into a single Phase 38 (TECHDEBT-02 through TECHDEBT-06) for cohesion since they're all v1.4 documentation/QA cleanup
- **Masonry strategy locked to CSS `column-count: 2`** per research reconciliation (zero new dependencies; rejects `@virtuoso.dev/masonry` and `masonic` on architectural + maintenance grounds)
- **ENGAGE-04 (graph-derived social proof) placed in Phase 43**, not Phase 42, because the micro-label sits on the tile that masonry first renders
- **Wave 4 (deps + code quality) intentionally lands LAST** to avoid React/Capacitor minor bumps mid-feature triggering StrictMode timing surprises (Pitfall 12)
- **TECHDEBT-04 device retest folded into Phase 38** as a checklist task rather than its own phase (synthesizer permission)
- **CONTENT-04 (citation rendering polish)** placed in Phase 41 (pipeline wiring) so it lands with `depth: 'deep'` essay path; pulled from FEATURES.md P3 into v1.5 release scope per research's "may need to be pulled in" note

## Session Continuity

**Stopped at:** Completed 38-01-doc-cleanup-PLAN.md (Wave 1 of Phase 38 — running in parallel with 38-02 + 38-03)
**Next action:** Wait for parallel agents 38-02 (YouTube short removal) + 38-03 (Device UAT scaffold) to complete; then orchestrator runs verification (incl. hooks) and proceeds to Phase 38 close-out.

**Files written this session (Plan 38-01 close):**

- `.planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md` (MODIFIED — frontmatter status/nyquist/wave_0 flipped, 3 lines)
- `.planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md` (MODIFIED — status normalized approved → validated, 1 line)
- `.planning/milestones/v1.4-ROADMAP.md` (MODIFIED — Phase 36 Plans line names 36-14 + 36-15, 1 line)
- `.planning/research/PITFALLS.md` (MODIFIED — 3 inline brand-history annotations on Pitfall 8 + warning-table row, 3 lines modified)
- `app/tests/services/starter-posts.test.mjs` (MODIFIED — 4 string-literal updates EchoLearn → Trellis to match production STARTER_POSTS, 4 lines)
- `.planning/phases/38-v1-4-carry-over-cleanup/38-01-doc-cleanup-SUMMARY.md` (NEW — close-out)
- `.planning/STATE.md` (this file)
- `.planning/ROADMAP.md` (plan progress row updated)
- `.planning/REQUIREMENTS.md` (TECHDEBT-02, TECHDEBT-03, TECHDEBT-05 marked complete)

**Plan 38-01 commits:**

- `1cbe4def` (Task 1: 34-VALIDATION frontmatter flip)
- `b44ea43c` (Task 2: 35-VALIDATION status normalize)
- `09f3b171` (Task 3: v1.4-ROADMAP Phase 36 plans line)
- `911a09df` (Task 4: PITFALLS.md brand-history annotations)
- `697fc4b8` (Task 5: starter-posts fixture EchoLearn → Trellis)

**Test baseline (post-Plan-38-01):** test:main 562/559/3 + test:actions 16/16/0. Matches Phase 37 close-out — zero regressions, 2 fewer test:actions failures than STATE's prior 16/14/2 baseline note (likely a stale-baseline artifact from Plan 37-03 capture; Phase 37 SUMMARY recorded 16/16/0). starter-posts.test.mjs alone: 9/9 pass.

---

**Files written this session (Plan 37-03 close):**

- `app/tests/services/leaf-imports.test.mjs` (NEW — 4 source-reading invariant assertions)
- `app/src/services/youtube-locale-url.ts` (MODIFIED — leaf import + 1 call site rewritten)
- `app/tests/services/youtube-locale.test.mjs` (MODIFIED — bindI18nLeaf wired)
- `app/src/lib/date.ts` (MODIFIED — leaf import + 5 call sites rewritten — 1 .language + 4 .t)
- `app/tests/lib/date.locale.test.mjs` (MODIFIED — bindI18nLeaf wired)
- `app/src/providers/llm/locale-directive.ts` (MODIFIED — leaf import + 1 call site + D-07 block preserved verbatim + Phase 37 footnote added)
- `app/tests/providers/llm-locale-injection.test.mjs` (MODIFIED — bindI18nLeaf wired)
- `app/src/providers/tts/index.ts` (MODIFIED — leaf import + 1 call site rewritten)
- `app/tests/providers/tts-locale.test.mjs` (MODIFIED — bindI18nLeaf wired)
- `app/src/lib/i18n-leaf.ts` (MODIFIED — docstring de-collided to remove literal `from '../locales'` substrings that false-positive against the new invariant test regex)
- `.planning/phases/37-i18n-leaf-module-refactor/37-03-SUMMARY.md` (NEW — Plan 37-03 close-out)
- `.planning/STATE.md` (this file)
- `.planning/ROADMAP.md` (plan progress row updated)
- `.planning/REQUIREMENTS.md` (TECHDEBT-01 marked complete — Phase 37 fully closes it)

**Plan 37-03 commits:**

- `fce07880` (Task 1: youtube-locale-url + paired test)
- `b73349ec` (Task 2: lib/date + paired test, 5 call sites)
- `c098854d` (Task 3: locale-directive + paired test, D-07 preserved + Phase 37 footnote)
- `8757ae9d` (Task 4: tts/index + paired test)
- `a9c57cbe` (Task 5: invariant test added + leaf docstring de-collided)

**Test baseline (post-Plan-37-03):** test:main 558/555/3 + test:actions 16/14/2 — IDENTICAL to Plan 37-02 close (zero new regressions introduced by Tier 3 migrations). 4 Tier 3 paired tests stayed green throughout (22 cases total: 6+5+6+5). New invariant test green (4/4). tsc -b --noEmit → exit 0.

**Phase 37 lifetime totals:** Pre-Phase-37 baseline 558/548/10 + 16/14/2 = 12 fail. Post-Phase-37 baseline 558/555/3 + 16/14/2 = 5 fail. Net 7 closures (all `ERR_IMPORT_ATTRIBUTE_MISSING` chain). Remaining 5 fails are pre-existing assertion / extension-resolution issues unrelated to i18n.
