---
phase: 42-masonry-feed-layout
plan: 07
type: execute
wave: 4
depends_on: ["42-01", "42-02", "42-03", "42-04", "42-05", "42-06"]
files_modified:
  - .planning/STATE.md
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/42-masonry-feed-layout/42-VALIDATION.md
  - .planning/phases/42-masonry-feed-layout/42-PHASE-SUMMARY.md
  - .planning/todos/closed/2026-05-07-double-column-feed-to-further-mimic-rednote-bilibili-info-flow.md
autonomous: true
requirements: [MASONRY-01, MASONRY-02]
must_haves:
  truths:
    - "STATE.md updated to reflect Phase 42 complete; current position advanced; Phase 42 lifetime decisions captured"
    - "REQUIREMENTS.md MASONRY-01 + MASONRY-02 promoted from [ ] to [x]"
    - "ROADMAP.md Phase 42 row in Progress table marked Complete with current date"
    - "ROADMAP.md Phase 42 entry — all 7 plan list items checked [x]"
    - "42-VALIDATION.md frontmatter status flipped to validated; nyquist_compliant: true; wave_0_complete: true; per-task verification map filled in"
    - "42-PHASE-SUMMARY.md created — phase-level summary linking 6 sub-plan summaries"
    - "Folded operator todo moved from .planning/todos/pending/ to .planning/todos/closed/ (CONTEXT.md folded_todos directive)"
  artifacts:
    - path: ".planning/STATE.md"
      provides: "Phase 42 close-out entry"
    - path: ".planning/phases/42-masonry-feed-layout/42-PHASE-SUMMARY.md"
      provides: "Phase-level rollup of all 6 sub-plan SUMMARYs"
  key_links: []
---

<objective>
Close Phase 42 with documentation hygiene. After plans 42-01..42-06 land their atomic commits, this plan flips status flags, updates progress trackers, generates the phase-level summary, and moves the folded operator todo to closed/.

Purpose: Reach the verifier-ready state.

Output: 6 file modifications/creations + 1 file move.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/phases/42-masonry-feed-layout/42-VALIDATION.md
@.planning/phases/42-masonry-feed-layout/42-CONTEXT.md
@.planning/phases/42-masonry-feed-layout/42-RESEARCH.md
@.planning/phases/42-masonry-feed-layout/42-UI-SPEC.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Promote MASONRY-01 + MASONRY-02 from [ ] to [x] in REQUIREMENTS.md</name>
  <files>.planning/REQUIREMENTS.md</files>
  <read_first>
    - .planning/REQUIREMENTS.md (lines 9-13 — MASONRY section)
  </read_first>
  <action>
    Edit `.planning/REQUIREMENTS.md`:

    Line 11 (MASONRY-01): Change `- [ ] **MASONRY-01**` → `- [x] **MASONRY-01**`
    Line 12 (MASONRY-02): Change `- [ ] **MASONRY-02**` → `- [x] **MASONRY-02**`

    Note: Plan 42-06 already updated the MASONRY-01 acceptance language. This plan only flips the checkbox.

    DO NOT TOUCH: Any other line in REQUIREMENTS.md (TECHDEBT-07..12 stay `[ ]`; ENGAGE-04 stays `[ ]`; everything else preserved).

    Atomic commit message: `docs(42): mark MASONRY-01 + MASONRY-02 complete in REQUIREMENTS.md`
  </action>
  <verify>
    <automated>grep -c "^- \[x\] \*\*MASONRY-01\*\*" /Users/Code/EchoLearn/.planning/REQUIREMENTS.md | grep -q "^1$" &amp;&amp; grep -c "^- \[x\] \*\*MASONRY-02\*\*" /Users/Code/EchoLearn/.planning/REQUIREMENTS.md | grep -q "^1$"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^- \[x\] \*\*MASONRY-01\*\*" .planning/REQUIREMENTS.md` returns `1`
    - `grep -c "^- \[x\] \*\*MASONRY-02\*\*" .planning/REQUIREMENTS.md` returns `1`
    - `grep -c "^- \[ \] \*\*MASONRY-01\*\*" .planning/REQUIREMENTS.md` returns `0`
    - `grep -c "^- \[ \] \*\*MASONRY-02\*\*" .planning/REQUIREMENTS.md` returns `0`
    - Other requirement statuses unchanged (e.g., TECHDEBT-07 still `[ ]`)
  </acceptance_criteria>
  <done>MASONRY-01 + MASONRY-02 marked complete.</done>
</task>

<task type="auto">
  <name>Task 2: Update ROADMAP.md Phase 42 plan list + Progress table row</name>
  <files>.planning/ROADMAP.md</files>
  <read_first>
    - .planning/ROADMAP.md (lines 1140-1153 — Phase 42 entry; lines 1191-1203 — Progress table)
  </read_first>
  <action>
    Edit `.planning/ROADMAP.md`:

    EDIT 1 — Phase 42 entry plan list (find `**Plans**: TBD` near line 1150 and replace with):
    ```markdown
    **Plans**: 7 plans
      - [x] 42-01-masonry-feed-skeleton-PLAN.md — MasonryFeed.tsx with height-accumulating split + framer-motion entrance + MotionConfig reduced-motion gate (MASONRY-01)
      - [x] 42-02-homescreen-swap-PLAN.md — InlineInfoFlow → MasonryFeed swap; noMorePosts toast deletion; allExplored locally computed (MASONRY-01 + MASONRY-02)
      - [x] 42-03-card-slide-in-removal-PLAN.md — Delete @keyframes card-slide-in + 3 callsites (D-06)
      - [x] 42-04-vine-bloom-card-and-i18n-PLAN.md — VineBloomCard with useTrellisData consumption + 13 home.celebration.* keys across 4 locales (MASONRY-02)
      - [x] 42-05-source-reading-invariant-tests-PLAN.md — 4 new test files locking 8 UI-SPEC + 1 Pitfall 1 invariants
      - [x] 42-06-roadmap-requirements-wording-correction-PLAN.md — 4 line edits aligning ROADMAP/REQUIREMENTS with D-02 height-accumulating split
      - [x] 42-07-phase-close-out-PLAN.md — STATE/REQUIREMENTS/ROADMAP/VALIDATION updates + PHASE-SUMMARY (this plan)
    ```

    EDIT 2 — Progress table row (around lines 1191-1203). Change:
    `| 42. Masonry Feed Layout | 0/0 | Not started | - |`
    To:
    `| 42. Masonry Feed Layout | 7/7 | Complete    | 2026-05-09 |`

    (Use the actual close date if different from 2026-05-09 — current STATE.md shows last_activity 2026-05-09 so the assumed same-day close is reasonable.)

    DO NOT TOUCH: Any other line in ROADMAP.md.

    Atomic commit message: `docs(42): mark Phase 42 plans + Progress row complete in ROADMAP`
  </action>
  <verify>
    <automated>grep -E "^\| 42\. Masonry Feed Layout \| 7/7 \| Complete" /Users/Code/EchoLearn/.planning/ROADMAP.md &amp;&amp; grep -c "42-01-masonry-feed-skeleton-PLAN.md" /Users/Code/EchoLearn/.planning/ROADMAP.md | grep -q "^1$" &amp;&amp; grep -c "42-07-phase-close-out-PLAN.md" /Users/Code/EchoLearn/.planning/ROADMAP.md | grep -q "^1$"</automated>
  </verify>
  <acceptance_criteria>
    - Progress table row reads `| 42. Masonry Feed Layout | 7/7 | Complete    | 2026-05-09 |`
    - Phase 42 plan list contains all 7 entries marked `[x]`
    - `grep -c "TBD" .planning/ROADMAP.md` does NOT include the former Phase 42 `**Plans**: TBD` (count decreases by 1 vs pre-edit)
    - Other phases' Progress rows unchanged
  </acceptance_criteria>
  <done>ROADMAP Phase 42 entry + Progress row reflect close-out.</done>
</task>

<task type="auto">
  <name>Task 3: Flip 42-VALIDATION.md frontmatter status to validated and fill per-task verification map</name>
  <files>.planning/phases/42-masonry-feed-layout/42-VALIDATION.md</files>
  <read_first>
    - .planning/phases/42-masonry-feed-layout/42-VALIDATION.md (full file)
  </read_first>
  <action>
    Edit `.planning/phases/42-masonry-feed-layout/42-VALIDATION.md`:

    EDIT 1 — Frontmatter:
    - `status: draft` → `status: validated`
    - `nyquist_compliant: false` → `nyquist_compliant: true`
    - `wave_0_complete: false` → `wave_0_complete: true`

    EDIT 2 — Per-Task Verification Map. Replace the table rows whose Task ID is `TBD` with the actual plan + wave + status:

    ```markdown
    | Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
    |---------|------|------|-------------|-----------|-------------------|-------------|--------|
    | 42-05-T1 | 42-05 | 3 | MASONRY-01 | source-reading + behavioral | `node --test tests/components/MasonryFeed.layout.test.mjs` | ✅ created plan 42-05 | ✅ green |
    | 42-03-T1+T2 | 42-03 | 2 | MASONRY-01 | source-reading | `node --test tests/lib/no-card-slide-in.test.mjs` | ✅ created plan 42-05 (test); plan 42-03 made it pass | ✅ green |
    | (existing) | (regression) | - | MASONRY-01 | source-reading (regression) | `node --test tests/components/InfoFlow.video-tap-emit.test.mjs` | ✅ pre-existing | ✅ green |
    | 42-05-T2 | 42-05 | 3 | MASONRY-02 | source-reading | `node --test tests/components/MasonryFeed.celebration.test.mjs` | ✅ created plan 42-05 | ✅ green |
    | 42-05-T3 | 42-05 | 3 | MASONRY-02 | source-reading | `node --test tests/screens/HomeScreen.no-more-posts-toast.test.mjs` | ✅ created plan 42-05 | ✅ green |
    | (existing) | (regression) | - | MASONRY-02 | source-reading (regression) | `node --test tests/locales/bundle-parity.test.mjs` | ✅ pre-existing | ✅ green |
    ```

    Note: Plan 42-03 wave was revised from 1 → 2 in revision iteration 1 (sits alongside 42-02 + 42-04 in Wave 2).

    EDIT 3 — Validation Sign-Off section: flip all checkboxes from `[ ]` to `[x]`:
    - [x] All tasks have `<automated>` verify or Wave 0 dependencies
    - [x] Sampling continuity: no 3 consecutive tasks without automated verify
    - [x] Wave 0 covers all MISSING references
    - [x] No watch-mode flags
    - [x] Feedback latency < 5s
    - [x] `nyquist_compliant: true` set in frontmatter

    EDIT 4 — Approval line: `**Approval:** pending` → `**Approval:** approved 2026-05-09 (or close-date)`

    Atomic commit message: `docs(42): flip 42-VALIDATION.md to validated; fill per-task verification map`
  </action>
  <verify>
    <automated>grep -q "^status: validated$" /Users/Code/EchoLearn/.planning/phases/42-masonry-feed-layout/42-VALIDATION.md &amp;&amp; grep -q "^nyquist_compliant: true$" /Users/Code/EchoLearn/.planning/phases/42-masonry-feed-layout/42-VALIDATION.md &amp;&amp; grep -q "^wave_0_complete: true$" /Users/Code/EchoLearn/.planning/phases/42-masonry-feed-layout/42-VALIDATION.md &amp;&amp; ! grep -q "Task ID.*TBD" /Users/Code/EchoLearn/.planning/phases/42-masonry-feed-layout/42-VALIDATION.md</automated>
  </verify>
  <acceptance_criteria>
    - Frontmatter `status: validated` (not `draft`)
    - Frontmatter `nyquist_compliant: true`
    - Frontmatter `wave_0_complete: true`
    - All `Task ID: TBD` placeholders replaced with concrete plan task IDs
    - All Validation Sign-Off checkboxes are `[x]`
    - Approval line says `approved` (not `pending`)
  </acceptance_criteria>
  <done>VALIDATION.md reflects phase-validated state with concrete per-task mapping.</done>
</task>

<task type="auto">
  <name>Task 4: Move folded operator todo from pending/ to closed/</name>
  <files>.planning/todos/closed/2026-05-07-double-column-feed-to-further-mimic-rednote-bilibili-info-flow.md</files>
  <read_first>
    - .planning/todos/pending/2026-05-07-double-column-feed-to-further-mimic-rednote-bilibili-info-flow.md (verify the todo still exists at this path; if directory layout differs, find the actual path)
  </read_first>
  <action>
    Move the folded todo file from `.planning/todos/pending/` to `.planning/todos/closed/` (per CONTEXT.md folded_todos directive: "Folded into Phase 42 scope; the todo file should be moved from `pending/` to `closed/` at phase close.").

    Concrete steps:
    1. Confirm the source file exists: `test -f .planning/todos/pending/2026-05-07-double-column-feed-to-further-mimic-rednote-bilibili-info-flow.md`
    2. Confirm the target directory exists: `test -d .planning/todos/closed/` (create with `mkdir -p` if it doesn't)
    3. `git mv .planning/todos/pending/2026-05-07-double-column-feed-to-further-mimic-rednote-bilibili-info-flow.md .planning/todos/closed/`
    4. Optionally append a 1-line close note to the moved file (e.g., `\n\n---\n_Closed 2026-05-09 — folded into Phase 42 (MasonryFeed)._`)

    DO NOT TOUCH: Any other todo file in pending/.

    Atomic commit message: `chore(42): close folded operator todo (double-column feed → Phase 42)`
  </action>
  <verify>
    <automated>test -f /Users/Code/EchoLearn/.planning/todos/closed/2026-05-07-double-column-feed-to-further-mimic-rednote-bilibili-info-flow.md &amp;&amp; ! test -f /Users/Code/EchoLearn/.planning/todos/pending/2026-05-07-double-column-feed-to-further-mimic-rednote-bilibili-info-flow.md</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `.planning/todos/closed/2026-05-07-double-column-feed-to-further-mimic-rednote-bilibili-info-flow.md`
    - File does NOT exist at `.planning/todos/pending/2026-05-07-double-column-feed-to-further-mimic-rednote-bilibili-info-flow.md`
    - Move was performed via `git mv` so git history follows the file
  </acceptance_criteria>
  <done>Folded todo closed.</done>
</task>

<task type="auto">
  <name>Task 5: Create 42-PHASE-SUMMARY.md (phase-level rollup)</name>
  <files>.planning/phases/42-masonry-feed-layout/42-PHASE-SUMMARY.md</files>
  <read_first>
    - .planning/phases/42-masonry-feed-layout/42-CONTEXT.md (D-01..D-11 to recap)
    - .planning/phases/42-masonry-feed-layout/42-RESEARCH.md (3 critical findings: MotionConfig, allExplored compute-itself, no new service helper)
    - .planning/phases/42-masonry-feed-layout/42-01-SUMMARY.md ... 42-06-SUMMARY.md (link to each)
  </read_first>
  <action>
    Create `.planning/phases/42-masonry-feed-layout/42-PHASE-SUMMARY.md` with this structure:

    ```markdown
    ---
    phase: 42-masonry-feed-layout
    status: complete
    completed: 2026-05-09
    requirements_closed: [MASONRY-01, MASONRY-02]
    ---

    # Phase 42 — Masonry Feed Layout — Phase Summary

    **Closed:** 2026-05-09
    **Requirements closed:** MASONRY-01, MASONRY-02
    **Plans:** 7 (42-01 through 42-07)
    **Atomic commits:** ~14-18 across all plans

    ## Goal Recap

    Pinterest-style 2-column masonry feed using a height-accumulating JS split (each new tile drops into the currently shorter column at append time and stays there). Vine-bloom celebration card with suggested-tomorrow plan replaces the bare "no more posts" toast.

    ## What Shipped

    1. **MasonryFeed.tsx** — NEW. 2-column height-accumulating split (D-02), framer-motion entrance on leaf tiles only (D-03/D-04/D-05), `<MotionConfig reducedMotion="user">` wrapper (RESEARCH.md Pitfall 1 — framer-motion v12 does NOT auto-respect prefers-reduced-motion), Phase 36 GAP-C video state ownership ported verbatim from InlineInfoFlow.
    2. **VineBloomCard** — co-located inside MasonryFeed.tsx. Inline 88x88 SVG vine illustration with bloom path-draw (matches `vineLoadingPulse` aesthetic at HomeScreen.tsx:759-767). Consumes `useTrellisData()` directly to derive heal/replant suggestions (RESEARCH.md § 1 path b — NO new trellisActionsService getter). Routes via existing `trellisActionsService.heal()` / `.replant()` handlers; "Open Planner" CTA uses `useNavigate('/planner')`. Uses `t('home.celebration.anchorFallback')` for nullish-safe i18n fallback (per Warning 6 from revision iteration 1).
    3. **HomeScreen swap** — `InlineInfoFlow` → `MasonryFeed` at /home (D-01). `toast(t('home.toast.noMorePosts'), 'info')` at line 240 deleted (D-11). `allExplored` computed locally from `dailyReadService.getExploredAnchors()` + `useQuestions()` filter (RESEARCH.md Pitfall 2 — `infiniteScrollService.allExplored` does NOT exist as service state).
    4. **`card-slide-in` keyframe deletion** (D-06) — 1 keyframe block + 3 callsites in InfoFlow.tsx removed; framer-motion replaces all entrance animation; one animation system, not two.
    5. **i18n bundle parity** — 13 new `home.celebration.*` keys added to all 4 locale bundles (en/zh/es/ja); 1 deprecated `home.toast.noMorePosts` key removed from all 4. bundle-parity.test.mjs green.
    6. **Source-reading invariant tests** — 4 new test files locking the 8 UI-SPEC structural invariants + the new MotionConfig assertion + the GAP-C single-emit invariant.
    7. **ROADMAP/REQUIREMENTS wording correction** — 4 line edits aligning the documented mechanism with D-02's height-accumulating split (replacing the stale `column-count: 2` + `break-inside: avoid` literal-assertion wording).

    ## Sub-Plan Summaries

    - [42-01-SUMMARY.md](./42-01-SUMMARY.md) — MasonryFeed skeleton + height-accumulator + framer-motion + GAP-C video state port
    - [42-02-SUMMARY.md](./42-02-SUMMARY.md) — HomeScreen InlineInfoFlow → MasonryFeed swap + toast deletion + allExplored computation
    - [42-03-SUMMARY.md](./42-03-SUMMARY.md) — card-slide-in keyframe + 3 callsite deletion
    - [42-04-SUMMARY.md](./42-04-SUMMARY.md) — VineBloomCard implementation + 4-bundle i18n parity (13 added incl. anchorFallback, 1 removed)
    - [42-05-SUMMARY.md](./42-05-SUMMARY.md) — 4 source-reading invariant test files
    - [42-06-SUMMARY.md](./42-06-SUMMARY.md) — ROADMAP/REQUIREMENTS wording alignment

    ## Key Decisions Honored (CONTEXT.md D-01..D-11)

    All 11 locked decisions implemented verbatim. The 3 critical RESEARCH.md findings that corrected/refined UI-SPEC.md were addressed:

    - **MotionConfig reducedMotion="user" wrapper** — added (UI-SPEC line 328 was wrong; framer-motion v12 does NOT auto-respect prefers-reduced-motion).
    - **`allExplored` computed by HomeScreen, not read from a service** — `infiniteScrollService.allExplored` does not exist as service state; HomeScreen derives it from `dailyReadService.getExploredAnchors()` + `useQuestions()` per Pitfall 2.
    - **`trellisActionsService` surface unchanged** — no new `getCelebrationSuggestions()` method; VineBloomCard consumes `useTrellisData()` directly per § 1 path b.

    ## Patterns Established

    - **`<MotionConfig reducedMotion="user">` wrapper at the feature scope** for framer-motion v12 reduced-motion handling. Applies surgically at the MasonryFeed level (not App root) per RESEARCH.md Open Question 1; future motion sites can adopt the same pattern.
    - **Height-accumulating 2-column split** — pattern proven for stable, append-friendly masonry without dependencies. Reusable for any future 2+-column layout.
    - **Co-located celebration card inside the feed component** — VineBloomCard inside MasonryFeed.tsx mirrors MilestoneCard inside InfoFlow.tsx; avoids premature abstraction.
    - **Hook-level data derivation over service surface expansion** — VineBloomCard consumes `useTrellisData()` rather than adding `trellisActionsService.getCelebrationSuggestions()`. Pattern preserves clean service boundaries when the "what to suggest" filter is structural (a one-line `leafState ===` filter) and shared with one other consumer (PlannerScreen).
    - **i18n-safe nullish fallback via dedicated key** — VineBloomCard's `node.anchor.title ?? node.anchor.content ?? t('home.celebration.anchorFallback')` pattern (Warning 6 from revision iteration 1). Avoids hardcoded English literals leaking into non-EN locales; namespace cohesion preserved (no cross-namespace reuse).

    ## Test Baseline

    Pre-Phase-42 baseline: test:main 657/655/2 + test:actions 16/16/0.
    Post-Phase-42 baseline: TBD (filled in by close-out commit) — expected delta ≈ +20-30 passes from 4 new test files; same 2 pre-existing carry-over failures from earlier phases (concept-feed.test.mjs ERR_MODULE_NOT_FOUND for extensionless youtube.service import + trellis-layout.test.mjs:64 getVineColor date-dependent assertion).

    ## Manual UAT (deferred to operator)

    Per VALIDATION.md "Manual-Only Verifications":
    - [ ] Scroll position survives `/home → /posts/:id → back` (architectural — should pass without effort per RESEARCH.md § 3)
    - [ ] framer-motion entrance animation visible on swipe-for-more (RAF/timing not deterministic in JSDOM)
    - [ ] Vine-bloom celebration card visual aesthetic — brand-fit judgment
    - [ ] `prefers-reduced-motion` honors OS setting (System Preferences → Reduce Motion → ON; reload `/home`; verify tile fade-up + SVG bloom collapse to instant)
    ```

    Atomic commit message: `docs(42): create 42-PHASE-SUMMARY.md (phase-level rollup)`
  </action>
  <verify>
    <automated>test -f /Users/Code/EchoLearn/.planning/phases/42-masonry-feed-layout/42-PHASE-SUMMARY.md &amp;&amp; grep -q "status: complete" /Users/Code/EchoLearn/.planning/phases/42-masonry-feed-layout/42-PHASE-SUMMARY.md &amp;&amp; grep -q "MASONRY-01" /Users/Code/EchoLearn/.planning/phases/42-masonry-feed-layout/42-PHASE-SUMMARY.md &amp;&amp; grep -q "MASONRY-02" /Users/Code/EchoLearn/.planning/phases/42-masonry-feed-layout/42-PHASE-SUMMARY.md</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/42-masonry-feed-layout/42-PHASE-SUMMARY.md` exists
    - Frontmatter declares `status: complete`, `requirements_closed: [MASONRY-01, MASONRY-02]`, `completed: <date>`
    - Body links to all 6 sub-plan SUMMARYs (42-01 through 42-06)
    - Body recaps the 3 RESEARCH.md critical findings and how each was addressed
    - Body lists patterns established
  </acceptance_criteria>
  <done>Phase summary published.</done>
</task>

<task type="auto">
  <name>Task 6: Update STATE.md with Phase 42 close-out entry</name>
  <files>.planning/STATE.md</files>
  <read_first>
    - .planning/STATE.md (full file — locate the `## Last decisions` section to insert the new Phase 42 entry at the top, per the project's reverse-chronological convention; locate the live frontmatter field name for "stopped at" and use it verbatim — verified 2026-05-09 to be `stopped_at:`)
    - .planning/phases/42-masonry-feed-layout/42-PHASE-SUMMARY.md (just created — for cross-reference)
  </read_first>
  <action>
    Edit `.planning/STATE.md`:

    EDIT 1 — Frontmatter (use whatever field name the live STATE.md uses for "stopped at" — verified 2026-05-09 to be `stopped_at:`; if the live shape has changed, use the actual field name):
    - `stopped_at: ...` → `stopped_at: "Phase 42 complete — ready for verification"` (preserve quoting style of the existing value; use bare string if the file is unquoted)
    - `last_updated: "..."` → current timestamp
    - `last_activity: 2026-05-09` → keep at current date
    - In `progress:` block:
      - Bump `total_plans` by 7 (Phase 42 added 7 plans)
      - Bump `completed_plans` by 7

    EDIT 2 — Update `# Project State` heading and current position:
    - `## Current Position` block: update `Phase: 41` → `Phase: 42`; `Plan: Not started` → `Plan: 7/7 complete`; `Status: Phase complete — ready for verification`

    EDIT 3 — Update `## Progress` line:
    - `**Phases:** 2 / 9 complete (37 ✓; 38 ✓; 39 ready for verification; 40 ready for verification; 41 ready for verification 2/2 plans; 42-45 pending)` → `**Phases:** 2 / 9 complete (37 ✓; 38 ✓; 39 ready for verification; 40 ready for verification; 41 ready for verification; 42 ready for verification 7/7 plans; 43-45 pending)`
    - `**Plans:** ...` row: append `; 7 / 7 complete in Phase 42 (42-01 ✓; 42-02 ✓; 42-03 ✓; 42-04 ✓; 42-05 ✓; 42-06 ✓; 42-07 ✓)`
    - Update the progress bar percentage if appropriate.

    EDIT 4 — Insert NEW "## Last decisions (Plan 42-07 close, <date>)" section AT THE TOP of the existing `## Last decisions` chronology (project convention is reverse-chronological — newest first). Include the phrase **"Phase 42 complete"** somewhere in the body so the verify step can grep for it. Suggested content:

    ```markdown
    ## Last decisions (Phase 42 close, 2026-05-09)

    - **Phase 42 complete** — MASONRY-01 + MASONRY-02 closed; 7 plans landed across 4 waves; verifier-ready.
    - **MotionConfig reducedMotion="user" wrapper at MasonryFeed scope, not App root** (RESEARCH.md Open Question 1). Surgical scope; doesn't disturb existing animations (BottomNavigation, SwipeTabContainer, PostCarousel, etc.). Phase 45 may revisit project-wide reduced-motion handling as part of accessibility audit.
    - **`allExplored` computed by HomeScreen, NOT read from a service** (RESEARCH.md Pitfall 2). `infiniteScrollService.allExplored` does NOT exist as service state — it's a local `const` inside `concept-feed.service.ts:1591`. HomeScreen derives it from `dailyReadService.getExploredAnchors()` + `useQuestions().questions.filter(q => q.isAnchorNode)`. Re-render triggered automatically by HomeScreen's existing `[location.pathname === '/home']` resync at lines 467-522.
    - **VineBloomCard consumes useTrellisData() directly — NO new trellisActionsService method** (RESEARCH.md § 1 path b). The "what to suggest" filter is structural (`leafState === 'dead' / 'dying' / 'falling'`); centralizing into a service-level helper would be premature abstraction (only 2 callers — PlannerScreen and VineBloomCard — both inline the filter trivially). trellis-actions.service.ts surface UNCHANGED.
    - **Phase 36 GAP-C video state ownership ported VERBATIM from InlineInfoFlow** (RESEARCH.md § 2). The 3 useEffects at InfoFlow.tsx:746-797 (visibilitychange + swipeProgress + intra-app navigation + IntersectionObserver) live at the wrapper level, not the leaf card. MasonryFeed becomes the new owner of `videoPlaying` state. The thumbnail-tap emit stays inside MemoizedConceptCard (verified by grep: 0 occurrences of `dailyReadService.markExplored` in MasonryFeed.tsx). Existing `InfoFlow.video-tap-emit.test.mjs` continues to pass without modification.
    - **`card-slide-in` keyframe + 3 callsites deletion** (D-06; RESEARCH.md Pitfall 7). One animation system, not two. Cross-tree negative grep test (`tests/lib/no-card-slide-in.test.mjs`) locks the deletion.
    - **ROADMAP + REQUIREMENTS wording correction landed in plan 42-06 BEFORE the negative-grep test in plan 42-05** so the source-reading test contract is consistent with the documented mechanism. RESEARCH.md § 8 verbatim replacement text used.
    - **`home.toast` parent object deleted from all 4 locale bundles** (UI-SPEC § DEPRECATED i18n keys; verified via grep that `noMorePosts` was the sole child).
    - **i18n bundle delta:** +12 net keys per bundle (13 added under `home.celebration.*` incl. `anchorFallback`; 1 deleted at `home.toast.noMorePosts`). bundle-parity.test.mjs green.
    - **Plan 42-04 anchorFallback i18n key added in revision iteration 1** (Warning 6). VineBloomCard's anchor name fallback (`node.anchor.title ?? node.anchor.content ?? <fallback>`) was originally hardcoded to English literal `'anchor'`; revised to `t('home.celebration.anchorFallback')` so non-EN locales render the localized gloss ("这个概念" / "este concepto" / "この概念") when both fields are nullish.
    - **Plan 42-03 wave revised 1 → 2 in revision iteration 1** (Blocker 2). Originally co-equal with 42-01 in Wave 1; both touched InfoFlow.tsx on disjoint lines but the parallel-write race risk was unacceptable. Moved to Wave 2 (depends_on: ["42-01"]) so it serializes after 42-01's `export` keyword additions land.
    - **Plan 42-01 Task 1 expanded to export THREE symbols in revision iteration 1** (Blocker 1). Originally exported only ConnectionCard + MilestoneCard; the actual `MemoizedConceptCard` at line 573 was also unexported, which would have broken Task 2's import. Revised to add `export` keyword to all three (lines 573, 610, 700).
    - **Test baseline (post-Phase-42):** [filled in by close-out commit; expected ≈ 680/2 fail + 16/16/0 actions; 4 new test files contribute ≈ 20-30 passes; same 2 pre-existing carry-over failures unchanged]
    ```

    EDIT 5 — Append "Files written this session (Plan 42-07 close)" + "Plan 42-07 commits" sections at the END of the existing chronology (reverse chronological is at the top; per-session detail goes at the bottom matching prior sessions' shape).

    Atomic commit message: `docs(42): update STATE.md with Phase 42 close-out`
  </action>
  <verify>
    <automated>grep -q "Phase 42 complete" /Users/Code/EchoLearn/.planning/STATE.md &amp;&amp; grep -q "Last decisions (Phase 42 close" /Users/Code/EchoLearn/.planning/STATE.md &amp;&amp; grep -q "42 ready for verification 7/7 plans" /Users/Code/EchoLearn/.planning/STATE.md</automated>
  </verify>
  <acceptance_criteria>
    - The phrase `Phase 42 complete` appears somewhere in `.planning/STATE.md` (Warning 7 — softened from `stopped_at:.*Phase 42 complete` because the field name shape may evolve; the phrase appearance is the load-bearing assertion)
    - Body has new section "## Last decisions (Phase 42 close, ...)"
    - Progress line shows `42 ready for verification 7/7 plans`
    - Progress: total_plans incremented by 7; completed_plans incremented by 7
    - Other phases' status text unchanged
    - The "stopped at" frontmatter field (whatever its live name — verified 2026-05-09 to be `stopped_at:`) carries the new Phase 42 close value
  </acceptance_criteria>
  <done>STATE.md captures Phase 42 close.</done>
</task>

</tasks>

<verification>
- All 6 tasks above pass their `<automated>` verifications
- No regressions to non-Phase-42 documentation files (REQUIREMENTS.md other rows, ROADMAP.md other phases, STATE.md other sections)
- 42-PHASE-SUMMARY.md exists and frontmatter declares status: complete
- Folded todo successfully moved (closed/ has it; pending/ does not)
- `cd app && npm test` baseline (run from prior tasks) is preserved (this plan modifies only documentation files; no source/test changes)
</verification>

<success_criteria>
- All 6 close-out tasks completed
- MASONRY-01 + MASONRY-02 visibly closed in REQUIREMENTS.md, ROADMAP.md, and STATE.md
- 42-PHASE-SUMMARY.md published linking 6 sub-plan SUMMARYs
- VALIDATION.md frontmatter validated; per-task map filled
- Folded operator todo moved to closed/
- Phase ready for `/gsd:verify-work 42` audit
</success_criteria>

<output>
After completion, write a brief `.planning/phases/42-masonry-feed-layout/42-07-SUMMARY.md` (sub-plan summary, separate from the phase-level 42-PHASE-SUMMARY.md created in Task 5). Document:
- 6 atomic commit hashes for the close-out tasks
- Confirmation that the Phase is verifier-ready
</output>
</content>
</invoke>