---
phase: 38-v1-4-carry-over-cleanup
plan: 01
subsystem: docs
tags: [validation, roadmap, frontmatter, brand-history, echolearn, trellis, audit, test-fixture, starter-posts]

# Dependency graph
requires:
  - phase: 34-v1-4-close-out-verification-debt-and-cleanup
    provides: VALIDATION.md frontmatter that needed status flip (originally shipped status:draft despite VERIFICATION 10/10)
  - phase: 35-fix-the-dynamic-system-prompt-issue
    provides: VALIDATION.md frontmatter using non-standard status:approved (State B reconstruction artifact)
  - phase: 36-curiosity-feed-randomness-and-weights
    provides: Plans 36-14 + 36-15 (round-4 close-out) that needed naming in v1.4-ROADMAP Phase 36 entry
  - phase: 37-i18n-leaf-module-refactor
    provides: TECHDEBT-01 closure setting the test baseline (562/559/3 + 16/16/0) that this plan must not regress
provides:
  - Phase 34 VALIDATION frontmatter normalized to validated/true/true
  - Phase 35 VALIDATION frontmatter status normalized (approved → validated)
  - v1.4-ROADMAP Phase 36 entry with explicit 36-14 + 36-15 plan-list naming
  - PITFALLS.md echolearn references annotated as historical (Pitfall 8 + warning table row)
  - starter-posts test fixture matching production STARTER_POSTS (no EchoLearn drift)
  - Audit trail (echolearn Bucket A/B/C table) embedded for future agents
affects: [38-02-youtube-short-removal, 38-03-device-uat, future engagement signals phase, future v1.5 hygiene phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Echolearn audit table (Bucket A/B/C from 38-RESEARCH INV-5) embedded in plan + summary so future agents don't re-grep cold"
    - "Archived-file discipline: edits to v1.4-MILESTONE archive files are frontmatter-only or single-line (no structural changes, no body edits)"

key-files:
  created:
    - .planning/phases/38-v1-4-carry-over-cleanup/38-01-doc-cleanup-SUMMARY.md
  modified:
    - .planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md
    - .planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md
    - .planning/milestones/v1.4-ROADMAP.md
    - .planning/research/PITFALLS.md
    - app/tests/services/starter-posts.test.mjs

key-decisions:
  - "Apply colon form 'historical: pre-2026-05-07 brand' (matches audit table line 94 + acceptance criteria) instead of em-dash form from action prose. The audit table is the canonical phrasing source; action prose was inconsistent."
  - "Test fixture parity verified end-to-end via diff against production lines 87-112 BEFORE editing. Diff confirmed exactly 4 EchoLearn occurrences in fixture (1 title + 1 preview + 2 bodyMarkdown openings); all replaced; post-edit diff is empty (string args fully match production modulo intentional declaration syntax differences)."
  - "Plan 38-02's territory (post-essay.service.ts and concept-feed.service.ts trellis_short_posts) explicitly NOT touched by this plan, per parallel-execution scope boundary."

patterns-established:
  - "Phase 32.1 lesson #8 reinforced: when echolearn references appear in research notes about MIGRATED keys, append a `(historical: pre-2026-05-07 brand)` annotation rather than rewriting the prose — preserves historical accuracy while preventing future agents from re-introducing the legacy prefix."
  - "v1.4 archive edits use frontmatter-only or single-line discipline (no structural changes) — pattern carried from Phase 37 archived-file edits, codified in 38-PLAN's repeat instructions."

requirements-completed: [TECHDEBT-02, TECHDEBT-03, TECHDEBT-05]

# Metrics
duration: 5 min
completed: 2026-05-09
---

# Phase 38 Plan 01: v1.4 Doc Cleanup Summary

**Closed three v1.4 documentation/audit carry-overs (TECHDEBT-02/03/05) via 5 atomic file edits — VALIDATION frontmatter flips, ROADMAP plan-list naming, brand-history annotations, and starter-posts test fixture parity to production STARTER_POSTS — with zero source-code changes.**

## Performance

- **Duration:** ~5 min (308s)
- **Started:** 2026-05-09T04:11:14Z
- **Completed:** 2026-05-09T04:16:22Z
- **Tasks:** 5 (all completed)
- **Files modified:** 5
- **Atomic commits:** 5 task commits + 1 metadata commit (pending)

## Accomplishments

- TECHDEBT-02 closed: both 34-VALIDATION.md (status:draft→validated, nyquist:false→true, wave_0:false→true) and 35-VALIDATION.md (status:approved→validated) frontmatter normalized; reconstructed_from State B note preserved verbatim on 35.
- TECHDEBT-03 closed: v1.4-ROADMAP Phase 36 **Plans:** line now explicitly names plans 36-14 (vine-progress chip resync + warm-start re-fallback) + 36-15 (handleForceNewDay symmetric two-cache mutation) — verified inside the Phase 36 entry block via awk-bounded grep, not just in the Decisions of note section below.
- TECHDEBT-05 closed: starter-posts.test.mjs fixture strings updated EchoLearn → Trellis (4 string literals across 2 of 3 posts) to match production at concept-feed.service.ts:87-112; PITFALLS.md Pitfall 8 + warning table row annotated with brand-history clarifications; project-wide audit confirmed zero echolearn_* localStorage keys in non-migration source code (only legacy-migration.service.ts retains the legacy prefix, which is its job).
- Test parity preserved: post-plan baseline test:main 562/559/3 + test:actions 16/16/0 (matches Phase 37 close-out — actually slightly improved on actions vs STATE.md's stated 16/14/2 baseline; either way well within plan's ≤3 main / ≤2 actions tolerance).
- starter-posts.test.mjs: 9/9 tests pass after fixture update.

## Task Commits

Each task was committed atomically (with --no-verify per parallel-execution protocol — orchestrator validates hooks once after all 3 wave-1 agents complete):

1. **Task 1: Flip 34-VALIDATION frontmatter** — `1cbe4def` (docs)
2. **Task 2: Normalize 35-VALIDATION status (approved → validated)** — `b44ea43c` (docs)
3. **Task 3: Name plans 36-14 + 36-15 in v1.4-ROADMAP Phase 36 entry** — `09f3b171` (docs)
4. **Task 4: Annotate PITFALLS.md echolearn references with brand-history notes** — `911a09df` (docs)
5. **Task 5: Match starter-posts fixture to production STARTER_POSTS** — `697fc4b8` (test)

## Files Created/Modified

- `.planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md` — frontmatter status/nyquist/wave_0 flipped (3 lines)
- `.planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md` — status normalized (1 line)
- `.planning/milestones/v1.4-ROADMAP.md` — Phase 36 **Plans:** line expanded to name 36-14 + 36-15 (1 line)
- `.planning/research/PITFALLS.md` — 3 inline brand-history annotations on Pitfall 8 + warning-table row (3 lines modified)
- `app/tests/services/starter-posts.test.mjs` — 4 string-literal updates EchoLearn → Trellis in 2 of 3 starter posts (4 lines)

## Echolearn Audit Table (reproduced verbatim from PLAN; Bucket C surprises noted)

### Bucket A — INTENTIONAL backwards-compat — NO EDIT (already annotated or load-bearing)

| Location | Occurrence | Reason |
|----------|------------|--------|
| `app/src/services/db.service.ts` (lines 34, 38, 40, 41) | `'echolearn'` SQLite connection name (4 literals) | Per CLAUDE.md "Brand history" — changing orphans existing user databases |
| `app/src/services/legacy-migration.service.ts` (lines 4, 5, 9, 14, 18) | `LEGACY_PREFIX = 'echolearn_'` + comments | THIS IS the migration service; renaming would break migration |
| `app/src/main.tsx` (line 21) | Comment: `// Migrate pre-rebrand echolearn_* localStorage keys...` | Accurate historical annotation |
| `CLAUDE.md` (line 5 — Brand history paragraph) | "the SQLite connection name `'echolearn'`...path is also keyed to the original directory name" | Already carries the explicit brand-history annotation |
| `CLAUDE.md` (lines ~380, ~436 — i18n section paths) | `~/.claude/projects/-Users-Code-EchoLearn/memory/...` references | Auto-memory path keyed to on-disk directory name (cannot change) |
| `.planning/milestones/v1.4-phases/**` (all archived files) | All echolearn occurrences in v1.4 archive | Immutable historical record — no edits to archived phases EVER |
| `app/tests/services/legacy-migration.test.mjs` (lines 19-56) | `echolearn_settings`, `echolearn_post_queue` test fixture keys | These ARE the migration test fixtures — they correctly test the legacy-key path |

### Bucket B — DOC DRIFT — ANNOTATE or FIX

| Location | Occurrence | Action taken |
|----------|------------|--------------|
| `app/tests/services/starter-posts.test.mjs` (lines 57, 59, 60, 68 area) | "Welcome to EchoLearn", "EchoLearn is your AI-powered learning companion", etc. | **FIXED** — test fixture updated to "Trellis" matching production STARTER_POSTS at concept-feed.service.ts:87-112. 4 string literals replaced. node --test 9/9 pass. (Task 5 / commit `697fc4b8`) |
| `.planning/research/PITFALLS.md` (lines ~201-215, ~341 area) | `echolearn_post_history`, `echolearn_engagement_*`, `echolearn` SQLite connection refs | **ANNOTATED** — 3 inline brand-history notes added to Pitfall 8 paragraphs + warning-table row. Existing prose, examples, and mitigations preserved verbatim. (Task 4 / commit `911a09df`) |

### Bucket C — SURPRISES (case-by-case)

| Location | Occurrence | Action taken |
|----------|------------|--------------|
| `app/tests/services/post-essay.service.test.mjs` (line 20) | `assert.ok(source.includes('trellis_short_posts'), ...)` | NOT TOUCHED. Plan 38-02 owns this assertion deletion (parallel-execution scope boundary explicitly enforced). |
| `app/src/services/concept-feed.service.ts` (line ~1520) | `localStorage.getItem('trellis_short_posts')` | NOT TOUCHED. Plan 38-02 territory. |
| **No new Bucket C surprises encountered during execution.** | | All grep audits returned the expected occurrences. |

## Decisions Made

- **Annotation phrasing chosen via audit table over action prose** (Task 4): The plan's action block had a wording inconsistency — its literal annotation text used em-dash (`historical — pre-2026-05-07 brand`), but the audit table at PLAN line 94 used colon (`historical: pre-2026-05-07 brand`) and the acceptance criteria's grep pattern matched the colon form. I followed the canonical audit table phrasing (which the acceptance criteria's grep enforces); applied a single follow-up edit when initial verification flagged the mismatch. Documented in Deviations as Rule 1 inline fix.
- **No-touch enforcement for parallel-agent boundaries**: Plans 38-02 (YouTube short removal) and 38-03 (Device UAT scaffold) own files this plan must not touch. Verified before each commit via git status; never staged anything outside the 5 declared `files_modified`.
- **All 5 commits use `--no-verify`** per the parallel-execution protocol — orchestrator validates hooks once after all 3 wave-1 agents complete.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrong dash form in PITFALLS.md annotation (initial Task 4 edit)**
- **Found during:** Task 4 verification (grep `historical: pre-2026-05-07 brand` returned 0 — initial edit used em-dash form `historical — pre-2026-05-07 brand` from the plan's action prose, but the audit table + acceptance criteria use the colon form)
- **Issue:** Action prose at PLAN.md line 272 specified the annotation as `(Note: the echolearn_* prefix is historical — pre-2026-05-07 brand. ...)` (em-dash), but PLAN.md line 94 (audit table) AND the acceptance criteria's grep pattern (`grep -c "historical: pre-2026-05-07 brand"`) require the colon form. The action prose was inconsistent with the canonical phrasing.
- **Fix:** Replaced the em-dash with a colon in the same annotation text (`historical: pre-2026-05-07 brand`) — preserves all surrounding context, only changes the punctuation between `historical` and `pre-2026-05-07`. Re-ran the verification grep — passes.
- **Files modified:** `.planning/research/PITFALLS.md` (1 character changed)
- **Verification:** `grep -c "historical: pre-2026-05-07 brand"` returns 1 (was 0); other 3 verification greps unchanged.
- **Committed in:** `911a09df` (Task 4 commit — applied before commit, so the fix is folded into the single Task 4 commit, not a separate commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix — punctuation form to satisfy acceptance-criteria grep)
**Impact on plan:** No scope creep. The fix reconciled an internal inconsistency in the plan document itself (action prose vs. audit table vs. acceptance criteria); chose the canonical form that two of three sources agree on (audit table + acceptance criteria grep).

## Verification Output

```text
=== TECHDEBT-02 ===
grep -c "^status: validated$" 34-VALIDATION.md → 1 ✓
grep -c "^status: validated$" 35-VALIDATION.md → 1 ✓

=== TECHDEBT-03 ===
awk Phase-36-block + grep -c "36-14" → 1 ✓
awk Phase-36-block + grep -c "36-15" → 1 ✓

=== TECHDEBT-05 ===
grep -rn "echolearn_" app/src/services/ (excl legacy-migration + db.service) → 0 ✓
grep -c "EchoLearn" app/tests/services/starter-posts.test.mjs → 0 ✓
grep -c "historical: pre-2026-05-07 brand" .planning/research/PITFALLS.md → 1 ✓

=== Bucket A audit (only legacy-migration.service.ts retains echolearn_) ===
app/src/services/legacy-migration.service.ts:5: * localStorage keys moved from the `echolearn_*` prefix to `trellis_*`.
app/src/services/legacy-migration.service.ts:9: * Idempotent: safe to call on every boot. Once an `echolearn_*` key has been
app/src/services/legacy-migration.service.ts:18:const LEGACY_PREFIX = 'echolearn_';

=== Test suite parity ===
test:main → 562/559/3 (matches Phase 37 close-out)
test:actions → 16/16/0 (improved over STATE.md baseline 16/14/2)
starter-posts.test.mjs alone → 9/9 pass
```

## Issues Encountered

None during planned work. The Task 4 punctuation discrepancy (above) was a plan-internal inconsistency, not an execution issue.

## User Setup Required

None — pure documentation + test-fixture cleanup. No external services or environment changes.

## Next Phase Readiness

- v1.4 carry-overs TECHDEBT-02/03/05 closed.
- TECHDEBT-04 (33-HUMAN-UAT-1/2 device retest) is owned by parallel-running Plan 38-03.
- TECHDEBT-06 (YouTube landscape-listed-as-short bug) is owned by parallel-running Plan 38-02.
- After all 3 wave-1 plans complete, Phase 38 verification should re-run `npm test` once with hooks enabled (orchestrator's responsibility) to confirm zero contention regressions.
- Wave 1 (Phase 39 engagement + Phase 40 source diversity) gated on Phase 38 wave-1 completion.

## Self-Check: PASSED

Verified all claims:
- Created file exists: `/Users/Code/EchoLearn/.planning/phases/38-v1-4-carry-over-cleanup/38-01-doc-cleanup-SUMMARY.md` ✓ (this file)
- Modified files exist: all 5 files in `key-files.modified` confirmed via `git diff --stat` and grep verifications above
- Commits exist: `1cbe4def`, `b44ea43c`, `09f3b171`, `911a09df`, `697fc4b8` all found via `git log --oneline -5`

---
*Phase: 38-v1-4-carry-over-cleanup*
*Plan: 01-doc-cleanup*
*Completed: 2026-05-09*
