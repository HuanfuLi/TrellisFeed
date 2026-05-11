---
phase: 43-engagement-ui
plan: 08
type: execute
wave: 3
depends_on: [43-02, 43-03, 43-04, 43-05, 43-06, 43-07]
files_modified:
  - .planning/STATE.md
  - .planning/ROADMAP.md
  - .planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md
  - .planning/phases/43-engagement-ui/43-VALIDATION.md
autonomous: true
requirements: [ENGAGE-01, ENGAGE-02, ENGAGE-03, CONTENT-01]
must_haves:
  truths:
    - "Phase 43 PHASE-SUMMARY.md exists with per-plan summary references + final invariant audit"
    - "STATE.md current position updated to reflect Phase 43 closed"
    - "ROADMAP.md Phase 43 entry plans-list filled in (8 plans, all checked) and progress table updated"
    - "VALIDATION.md sign-off table fully checked; nyquist_compliant flipped to true"
  artifacts:
    - path: ".planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md"
      provides: "Phase-level retrospective + audit + plan-link table"
    - path: ".planning/STATE.md"
      provides: "Current position update; progress counter increment"
  key_links:
    - from: ".planning/STATE.md"
      to: ".planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md"
      via: "narrative summary reference + activity log entry"
      pattern: "Phase 43"
---

<objective>
Wave-3 close-out plan. Runs LAST after all plans 43-02..43-07 land. Captures phase-level audit + propagates the close to ROADMAP/STATE/VALIDATION.

Three areas of work:
1. Write 43-PHASE-SUMMARY.md aggregating per-plan SUMMARY.md outputs into a single phase retrospective: invariant audit, per-plan link table, success-criteria coverage (5 of 6 closed; SC-4 descoped per DS-01), commit total, any UAT carry-over notes.
2. Update STATE.md: increment progress, mark Phase 43 complete, update "Current Position" stanza.
3. Update ROADMAP.md: fill in the 8-plan list under the Phase 43 entry (now that all plans are known + done); update the progress table at the bottom. Note: the Requirements line + SC-4 strike were already landed in Wave 0 by 43-01 Task 5 per the revision 2026-05-11 (plan-checker Blocker 1 fix).
4. Mark VALIDATION.md sign-off complete; flip nyquist_compliant to true (all 9 test scaffolds now have real assertions).

This plan does NOT run the full test suite as part of its tasks — that gate runs implicitly via /gsd:verify-work after this plan lands. But it MUST verify before committing that:
- `cd app && npm test` exits 0
- `cd app && npx tsc -b --noEmit` exits 0
- All 4 i18n bundles still pass parity

Purpose: Wave-3 plan; depends on every prior Phase 43 plan completing. Final atomic commits for the phase.
Output: New PHASE-SUMMARY.md (~200 LOC), STATE.md/ROADMAP.md/VALIDATION.md edits.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/43-engagement-ui/43-CONTEXT.md
@.planning/phases/43-engagement-ui/43-VALIDATION.md
@.planning/phases/43-engagement-ui/43-01-SUMMARY.md
@.planning/phases/43-engagement-ui/43-02-SUMMARY.md
@.planning/phases/43-engagement-ui/43-03-SUMMARY.md
@.planning/phases/43-engagement-ui/43-04-SUMMARY.md
@.planning/phases/43-engagement-ui/43-05-SUMMARY.md
@.planning/phases/43-engagement-ui/43-06-SUMMARY.md
@.planning/phases/43-engagement-ui/43-07-SUMMARY.md

# Reference implementations to read first
@.planning/phases/42-masonry-feed-layout/42-PHASE-SUMMARY.md

<interfaces>
Phase 42's PHASE-SUMMARY.md is the canonical template — match its structure:
- Header (phase + dates + status)
- One-paragraph executive summary
- Plans table (plan ID, slug, requirement closed, status, commit count)
- Success-criteria coverage (per SC item, what closed it, evidence)
- Invariant audit (the ~6-8 source-reading invariants this phase locked)
- Carry-over notes (UAT items deferred, future-phase reopens)
- Final commit count + atomic-commit cadence audit

STATE.md fields to update:
- stopped_at — change from "Phase 43 UI-SPEC approved..." to "Phase 43 closed; 8/8 plans landed; ready for /gsd:verify-work"
- last_updated — bump to current date
- last_activity — bump
- progress.completed_phases — increment by 1
- Current Position section — Phase 43 → complete

ROADMAP.md Phase 43 entry — fill in:
- Plans: 8 plans (was TBD; the Requirements line + SC-4 strike were already landed in Wave 0 by 43-01 Task 5)
- Plan list — checkboxes for each plan with one-line description
- Progress table at the bottom — add Phase 43 row
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write 43-PHASE-SUMMARY.md aggregating per-plan summaries</name>
  <files>.planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md</files>
  <read_first>
    - .planning/phases/42-masonry-feed-layout/42-PHASE-SUMMARY.md (canonical template — replicate structure)
    - All 7 per-plan summaries in .planning/phases/43-engagement-ui/43-{01..07}-SUMMARY.md (gather commit hashes + LOC deltas + key outcomes)
    - .planning/phases/43-engagement-ui/43-CONTEXT.md (LP/SV/DD/TS/DS decisions reference for the audit)
    - .planning/phases/43-engagement-ui/43-VALIDATION.md (test-surface inventory for the audit)
  </read_first>
  <action>
    Create .planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md following the Phase 42 template. Structure:

    Section 1 — Header:
    ```
    # Phase 43: Engagement UI — Phase Summary

    **Closed:** 2026-05-{date}
    **Plans:** 8 / 8 complete
    **Atomic commits:** {count from per-plan SUMMARYs aggregated}
    **Requirements closed:** ENGAGE-01, ENGAGE-02, ENGAGE-03, CONTENT-01 (user-facing visible)
    **Requirements descoped:** ENGAGE-04 (DS-01, 2026-05-11)
    ```

    Section 2 — Executive Summary (1-2 paragraphs):
    Describe what shipped: long-press contextual menu, /saved view with tabs, Deep Dive button + segmented toggle, HomeScreen engagement wiring + bookmark icon, Force-New-Day reset extension, presentation-style tag trim (TS-01). Note the parallel-safe Wave-1 structure (4 plans landed concurrently after Wave-0 infra). Note the plan-checker revision 2026-05-11 that folded DS-01 doc edits into Wave 0 (43-01 Task 5) for consistent Wave-1 executor state.

    Section 3 — Plan Table (UPDATED slugs per revision 2026-05-11):
    | Plan ID | Slug | Decisions Closed | Tests | Commits |
    |---------|------|------------------|-------|---------|
    | 43-01 | shared-infra-and-locales | useLongPress + BottomSheet compact + 14 i18n keys + 9 scaffolds + DS-01 doc edits (ROADMAP+REQUIREMENTS) | 1 new + 2 parity gates | 5 |
    | 43-02 | trim-presentation-style-tag | TS-01 | 1 source-reading | 2 |
    | 43-03 | longpress-menu-and-masonry-integration | LP-01..LP-05 | 2 source-reading + anti-wire | 4 |
    | 43-04 | saved-screen-and-route | SV-01..SV-04 | 1 source-reading | 3 |
    | 43-05 | postdetail-deep-dive-trigger | DD-01..DD-05 | 3 source-reading (deep-dive-trigger + segmented-toggle + abort-contract) | 4 |
    | 43-06 | homescreen-wiring | SV-02 + dual-effect ANCHOR_DISMISSED + ENGAGEMENT_CHANGED resync | 1 source-reading (dual-effect pattern) | 2 |
    | 43-07 | force-new-day-engagement-reset | SC-6 (DS-01 doc edits moved to 43-01 per revision 2026-05-11) | 1 source-reading | 2 |
    | 43-08 | phase-close-out | docs only | n/a | 1 |

    Section 4 — Success-Criteria Coverage (1 row per SC from ROADMAP Phase 43 entry):
    | SC | Status | Closed by | Evidence |
    |----|--------|-----------|----------|
    | SC-1 (long-press menu) | Closed | 43-03 LongPressMenu + 43-06 host | tests/components/LongPressMenu.test.mjs |
    | SC-2 (saved view) | Closed | 43-04 SavedScreen + route | tests/screens/SavedScreen.test.mjs |
    | SC-3 (Deep Dive button) | Closed | 43-05 + DD-05 abort contract | tests/screens/PostDetailScreen.{deep-dive-trigger,segmented-toggle,abort-contract}.test.mjs |
    | SC-4 (N-connections label) | Descoped | DS-01 (43-01 Task 5 Wave 0 doc edits per revision 2026-05-11) | ROADMAP SC-4 struck; REQUIREMENTS.md ENGAGE-04 in Out of Scope |
    | SC-5 (ANCHOR_DISMISSED resync) | Closed | 43-06 HomeScreen dual-effect subscription | tests/screens/HomeScreen.engagement-resync.test.mjs |
    | SC-6 (Force-New-Day reset) | Closed | 43-07 SettingsDataScreen edit | tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs |

    Section 5 — Invariant Audit (source-reading invariants locked by Phase 43):
    Aggregate each plan's source-reading invariants into one list:
    - LongPressMenu.tsx never references CONCEPT_EXPLORED, eventBus.emit, or dailyReadService.markExplored (anti-wire — 43-03)
    - MasonryFeed.tsx preserves Phase 42 invariants (no column-count, no will-change, MotionConfig wrap, single-emit GAP-C) (43-03)
    - InfoFlow.tsx no longer contains "infoFlow.newsTag"; no locale bundle contains "newsTag" (TS-01 — 43-02)
    - SavedScreen.tsx Header backTo='/home' portals to body; no transform/will-change on Header ancestor (Phase 32.1 — 43-04)
    - PostDetailScreen.tsx at least 4 pre-call AbortController guards + at least 5 signal-arg passes + cache-write guard (DD-05 — 43-05)
    - PostDetailScreen segmented-toggle onChange does NOT invoke generatePostEssay (DD-04 — 43-05 segmented-toggle.test.mjs)
    - HomeScreen.tsx dual-effect dismiss resync: stable ANCHOR_DISMISSED listener (deps []) + [location.pathname] re-read via engagementService.getDismissedAnchors() (LP-05 + Phase 36-14 — 43-06)
    - HomeScreen.tsx Phase 36-14 [location.pathname] resync effects (exploredAnchors + warm-start fallback) preserved; new Effect B joins as sibling for engagement (43-06)
    - SettingsDataScreen.tsx engagementService.reset() ordered after daily reset, before success toast (SC-6 — 43-07)
    - ROADMAP.md + REQUIREMENTS.md DS-01 descope reflected from Wave 0 (43-01 Task 5)

    Section 6 — Carry-over notes / UAT items:
    Document any UAT-worthy concerns:
    - Visual smoke: long-press feel on Android WebView (no native text-selection menu); manual verification per VALIDATION.md
    - Visual smoke: bottom-sheet slide animation curve consistency with TrellisStatusPanel / other modals
    - Visual smoke: deep-stream replace-in-place no scroll jump
    - i18n: Spanish dismiss-toast width fits in ToastContainer (verify on device — Spanish "Got it — you won't see this again" is ~20% longer)
    - Future-phase reopen path: ENGAGE-04 if operator changes mind (candidatePack helper at canonical-knowledge.service.ts:222 unchanged + DailyPost connectionCount field needed)

    Section 7 — Commit cadence audit:
    Total commits: <aggregate from per-plan SUMMARYs> (target: 23-26 across 8 plans per atomic per-file-with-test cadence Phase 37 D-03; revision 2026-05-11 added 1 commit to 43-01 for DS-01 doc edits)
    Average commits per plan: <total / 8>
    Largest plan (commit count): 43-01 (~5 commits — includes new Task 5 for DS-01 doc edits after revision)
    Smallest plan (commit count): 43-08 (1 commit)

    Atomic commit message: docs(43): write 43-PHASE-SUMMARY.md (aggregate of 7 plan summaries; final invariant audit)
  </action>
  <verify>
    <automated>test -f /Users/Code/EchoLearn/.planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md && grep -q "Phase 43: Engagement UI" /Users/Code/EchoLearn/.planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md && grep -q "Success-Criteria Coverage" /Users/Code/EchoLearn/.planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md && grep -q "DS-01" /Users/Code/EchoLearn/.planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md</automated>
  </verify>
  <acceptance_criteria>
    - File .planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md exists with at least 100 lines
    - Contains a "Plan Table" section with 8 rows (one per plan 43-01 through 43-08)
    - Contains a "Success-Criteria Coverage" section with 6 rows (SC-1 through SC-6, including SC-4 Descoped row)
    - Contains an "Invariant Audit" section listing the source-reading invariants from each plan
    - Contains a "Commit cadence audit" section with commit count totals
    - References DS-01 / ENGAGE-04 descope at least once
    - References all 8 source-reading test surfaces from VALIDATION.md (deep-dive-trigger + segmented-toggle + abort-contract count as 3 distinct surfaces)
  </acceptance_criteria>
  <done>Phase-level retrospective documented; ready for /gsd:verify-work consumption.</done>
</task>

<task type="auto">
  <name>Task 2: Update STATE.md to reflect Phase 43 close</name>
  <files>.planning/STATE.md</files>
  <read_first>
    - .planning/STATE.md (read full file — note current frontmatter values: stopped_at, last_updated, last_activity, progress counters)
    - .planning/phases/42-masonry-feed-layout/42-PHASE-SUMMARY.md (template — what kinds of edits Phase 42 made when it closed)
    - .planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md (Task 1 output)
  </read_first>
  <action>
    Update .planning/STATE.md with these field changes:

    Frontmatter:
    - stopped_at: change to "Phase 43 closed; 8/8 plans landed; ready for /gsd:verify-work 43"
    - last_updated: bump to current date in ISO-8601 (e.g., "2026-05-{day}T{hh:mm:ss}.000Z")
    - last_activity: bump to current date YYYY-MM-DD
    - progress.completed_phases: increment by 1 (from 0 to 1 OR current count plus 1 — verify current count by reading the field)
    - progress.total_plans: bump to current total
    - progress.completed_plans: bump to reflect Phase 43's 8 plans now done

    Body:
    - "Current Position" section — change "Phase: 42" / "Status: Ready for verification" to "Phase: 43 / Status: Ready for verification" (or whatever next phase is queued)
    - "Progress" section narrative — append a line for Phase 43: "8/8 plans complete in Phase 43"
    - "Last decisions" section — replace or augment the Phase 42 close decisions with a Phase 43 close summary (3-5 bullets aggregating the major operator decisions: LP-01..05, SV-01..04, DD-01..05, TS-01, DS-01)

    Specifically the "Last decisions" replacement should include:
    - Phase 43 closed — ENGAGE-01/02/03 + CONTENT-01 user-facing UI shipped; ENGAGE-04 descoped 2026-05-11 (DS-01)
    - Operator preference signal: "tiles already too rich" — single TS-01 trim (NEWS chip + 4-locale newsTag key) honored; broader tile-metadata audit deferred
    - Three operator divergences from research recommendation, all toward more-interactive UX: SV-04 tabs (over private-only Like), DD-03 replace-in-place stream (over append-both), DD-04 segmented toggle (over append-both)
    - LongPressMenu anti-wire invariant locked: 0 CONCEPT_EXPLORED, 0 eventBus.emit, 0 dailyReadService.markExplored
    - AbortController contract preserved: at least 4 pre-call guards + at least 5 signal-arg passes + cache-write guard for bodyMarkdownDeep
    - HomeScreen dual-effect dismiss resync (stable listener + [location.pathname] re-read) — canonical Phase 36-14 sibling-effects pattern
    - 9 new test scaffolds (Wave-0) + 8 filled-in source-reading tests (deep-dive-trigger + segmented-toggle + abort-contract count as 3 distinct DD-* surfaces); nyquist_compliant flipped true in VALIDATION.md

    Atomic commit message: docs(43): close STATE.md after Phase 43 completion
  </action>
  <verify>
    <automated>grep -q "Phase 43 closed" /Users/Code/EchoLearn/.planning/STATE.md && grep -q "ENGAGE-04 descoped" /Users/Code/EchoLearn/.planning/STATE.md && grep -q "8/8 plans complete in Phase 43\|8 / 8 complete in Phase 43" /Users/Code/EchoLearn/.planning/STATE.md</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "Phase 43 closed" .planning/STATE.md returns at least 1
    - grep -c "ENGAGE-04 descoped" .planning/STATE.md returns at least 1
    - grep -c "8/8 plans complete in Phase 43\|8 / 8 complete in Phase 43" .planning/STATE.md returns at least 1
    - Frontmatter stopped_at + last_updated + last_activity fields are bumped
    - completed_plans counter increments by 8
    - completed_phases counter increments by 1
  </acceptance_criteria>
  <done>STATE.md reflects Phase 43 closed.</done>
</task>

<task type="auto">
  <name>Task 3: Fill Phase 43 plan list in ROADMAP.md + update progress table</name>
  <files>.planning/ROADMAP.md</files>
  <read_first>
    - .planning/ROADMAP.md (read lines 1160-1210 — Phase 43 entry + progress table around line 1198+; note that the Requirements line + SC-4 strike were already landed in Wave 0 by 43-01 Task 5)
    - .planning/phases/42-masonry-feed-layout/42-PHASE-SUMMARY.md (template — Phase 42 plan list reference)
  </read_first>
  <action>
    Two edits to .planning/ROADMAP.md:

    Edit 1 — Fill in Phase 43's Plans list (currently "Plans: TBD" at line 1172). Replace with (UPDATED slugs per revision 2026-05-11):
    ```
    **Plans**: 8 plans (4 waves)
      - [x] 43-01-shared-infra-and-locales-PLAN.md — Wave 0: useLongPress hook + BottomSheet compact prop + 14 i18n keys (4 locales) + 9 test scaffolds + DS-01 doc edits (ROADMAP+REQUIREMENTS per revision 2026-05-11)
      - [x] 43-02-trim-presentation-style-tag-PLAN.md — Wave 1: TS-01 trim NEWS chip from InfoFlow.tsx + remove infoFlow.newsTag from 4 locale bundles
      - [x] 43-03-longpress-menu-and-masonry-integration-PLAN.md — Wave 1: LongPressMenu component (LP-01..LP-04) + MasonryFeed long-press wrapper + corner-icon overlay + AnimatePresence column wrapping (LP-05)
      - [x] 43-04-saved-screen-and-route-PLAN.md — Wave 1: SavedScreen with Saved/Liked tabs (SV-01..SV-04) + /saved route registration
      - [x] 43-05-postdetail-deep-dive-trigger-PLAN.md — Wave 1: Deep Dive button + Standard|Deep segmented control + dedicated deepAbortControllerRef (DD-01..DD-05); 3 test surfaces (deep-dive-trigger + segmented-toggle + abort-contract)
      - [x] 43-06-homescreen-wiring-PLAN.md — Wave 2: HomeScreen Bookmark icon + LongPressMenu host + dual-effect ANCHOR_DISMISSED (stable listener + [location.pathname] resync) + ENGAGEMENT_CHANGED subscription (SV-02 + LP-03/05)
      - [x] 43-07-force-new-day-engagement-reset-PLAN.md — Wave 2: SettingsDataScreen engagementService.reset() (DS-01 doc edits moved to 43-01 Wave 0 per revision 2026-05-11)
      - [x] 43-08-phase-close-out-PLAN.md — Wave 3: 43-PHASE-SUMMARY.md + STATE.md/ROADMAP.md/VALIDATION.md close-out edits
    ```

    Edit 2 — Update the Progress table at the bottom of ROADMAP.md (around line 1198). Add a new row:
    ```
    | 43. Engagement UI | 8/8 | Complete    | 2026-05-{date} |
    ```
    Insert it in the correct position (after Phase 42).

    Note: the Phase 43 Requirements line + SC-4 descope strike were already landed by 43-01 Task 5 in Wave 0 (per the plan-checker revision 2026-05-11). Do NOT re-edit those lines in this task; they're already correct.

    Atomic commit message: docs(43): fill Phase 43 plan list + progress table in ROADMAP
  </action>
  <verify>
    <automated>grep -q "43-01-shared-infra-and-locales-PLAN.md" /Users/Code/EchoLearn/.planning/ROADMAP.md && grep -q "43-07-force-new-day-engagement-reset-PLAN.md" /Users/Code/EchoLearn/.planning/ROADMAP.md && grep -q "43-08-phase-close-out-PLAN.md" /Users/Code/EchoLearn/.planning/ROADMAP.md && grep -q "43. Engagement UI" /Users/Code/EchoLearn/.planning/ROADMAP.md</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "43-01-shared-infra-and-locales-PLAN.md" .planning/ROADMAP.md returns 1
    - grep -c "43-07-force-new-day-engagement-reset-PLAN.md" .planning/ROADMAP.md returns 1
    - grep -c "43-08-phase-close-out-PLAN.md" .planning/ROADMAP.md returns 1
    - grep -c "43. Engagement UI" .planning/ROADMAP.md returns at least 1 (progress table row)
    - All 8 plans show [x] checkbox state (Phase 43 close presumes execute-phase has marked them done; for the doc edit at plan-time it's acceptable to leave as [ ] until execute-phase actually completes them — coordinate with executor)
  </acceptance_criteria>
  <done>ROADMAP Phase 43 entry plan list filled + progress table row added.</done>
</task>

<task type="auto">
  <name>Task 4: Update VALIDATION.md sign-off + flip nyquist_compliant to true</name>
  <files>.planning/phases/43-engagement-ui/43-VALIDATION.md</files>
  <read_first>
    - .planning/phases/43-engagement-ui/43-VALIDATION.md (read full file — frontmatter at top, Per-Task Verification Map table, Wave 0 Requirements list, Validation Sign-Off section at bottom)
  </read_first>
  <action>
    Three edits to .planning/phases/43-engagement-ui/43-VALIDATION.md:

    Edit 1 — Frontmatter (lines 1-9). Change:
    - status: draft → status: validated
    - nyquist_compliant: false → nyquist_compliant: true
    - wave_0_complete: false → wave_0_complete: true

    Edit 2 — Per-Task Verification Map (around line 41). Fill in the TBD placeholder rows with the actual mapping derived from 43-{01..07} plans (UPDATED per revision 2026-05-11 — 43-01 now has 5 tasks; 43-05 now has 4 tasks; 43-07 now has 2 tasks). Format:
    ```
    | Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
    |---------|------|------|-------------|-----------|-------------------|-------------|--------|
    | 43-01-T1 | 43-01 | 0 | infrastructure | source-reading | cd app && node --test tests/hooks/useLongPress.test.mjs | yes | green |
    | 43-01-T2 | 43-01 | 0 | infrastructure | grep | cd app && grep "compact" src/components/ui/BottomSheet.tsx | yes | green |
    | 43-01-T3 | 43-01 | 0 | i18n parity | structural | cd app && node --test tests/locales/bundle-parity.test.mjs | yes | green |
    | 43-01-T4 | 43-01 | 0 | scaffold | skipped | cd app && node --test tests/components/... | yes | scaffold |
    | 43-01-T5 | 43-01 | 0 | DS-01 doc | grep | grep "ENGAGE-04 descoped 2026-05-11 (DS-01)" .planning/ROADMAP.md | yes | green |
    | 43-02-T1 | 43-02 | 1 | TS-01 | source-reading neg | cd app && node --test tests/components/InfoFlow.no-presentation-style-tag.test.mjs | yes | green |
    | 43-02-T2 | 43-02 | 1 | TS-01 | source-reading | cd app && node --test tests/components/InfoFlow.no-presentation-style-tag.test.mjs | yes | green |
    | 43-03-T1 | 43-03 | 1 | ENGAGE-01/02/03 | source-reading | cd app && node --test tests/components/LongPressMenu.test.mjs | yes | green |
    | 43-03-T2 | 43-03 | 1 | anti-wire | source-reading | cd app && node --test tests/components/LongPressMenu.test.mjs | yes | green |
    | 43-03-T3 | 43-03 | 1 | LP-03/05 | source-reading | cd app && node --test tests/components/MasonryFeed.dismiss-fade-all.test.mjs | yes | green |
    | 43-03-T4 | 43-03 | 1 | LP-03/05 | source-reading | cd app && node --test tests/components/MasonryFeed.dismiss-fade-all.test.mjs | yes | green |
    | 43-04-T1 | 43-04 | 1 | ENGAGE-01/03 | source-reading | cd app && node --test tests/screens/SavedScreen.test.mjs | yes | green |
    | 43-04-T2 | 43-04 | 1 | SV-01 | build | cd app && npm run build | yes | green |
    | 43-04-T3 | 43-04 | 1 | SV-* | source-reading | cd app && node --test tests/screens/SavedScreen.test.mjs | yes | green |
    | 43-05-T1 | 43-05 | 1 | CONTENT-01 | source-reading | cd app && node --test tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs | yes | green |
    | 43-05-T2 | 43-05 | 1 | DD-01..03 | source-reading | cd app && node --test tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs | yes | green |
    | 43-05-T3 | 43-05 | 1 | DD-05 | source-reading | cd app && node --test tests/screens/PostDetailScreen.abort-contract.test.mjs | yes | green |
    | 43-05-T4 | 43-05 | 1 | DD-04 | source-reading | cd app && node --test tests/screens/PostDetailScreen.segmented-toggle.test.mjs | yes | green |
    | 43-06-T1 | 43-06 | 2 | SV-02 + LP-03/05 | source-reading | cd app && node --test tests/screens/HomeScreen.engagement-resync.test.mjs | yes | green |
    | 43-06-T2 | 43-06 | 2 | Phase 32.1 + 36-14 | source-reading | cd app && node --test tests/screens/HomeScreen.engagement-resync.test.mjs | yes | green |
    | 43-07-T1 | 43-07 | 2 | SC-6 | grep | cd app && grep engagementService.reset src/screens/settings/SettingsDataScreen.tsx | yes | green |
    | 43-07-T2 | 43-07 | 2 | SC-6 | source-reading | cd app && node --test tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs | yes | green |
    ```

    (Use actual file location ${Code/EchoLearn} prefixes where needed; the table cells should be straight copy/paste with concrete commands.)

    Edit 3 — Validation Sign-Off section (around line 94). Check all 6 items:
    - [x] All tasks have <automated> verify or Wave 0 dependencies
    - [x] Sampling continuity: no 3 consecutive tasks without automated verify
    - [x] Wave 0 covers all MISSING references
    - [x] No watch-mode flags
    - [x] Feedback latency < 45s
    - [x] nyquist_compliant: true set in frontmatter

    Change "Approval: pending" to "Approval: validated 2026-05-{date}"

    Atomic commit message: docs(43): validate VALIDATION.md sign-off; flip nyquist_compliant true; fill per-task map
  </action>
  <verify>
    <automated>grep -q "nyquist_compliant: true" /Users/Code/EchoLearn/.planning/phases/43-engagement-ui/43-VALIDATION.md && grep -q "wave_0_complete: true" /Users/Code/EchoLearn/.planning/phases/43-engagement-ui/43-VALIDATION.md && grep -q "status: validated" /Users/Code/EchoLearn/.planning/phases/43-engagement-ui/43-VALIDATION.md && grep -q "Approval: validated" /Users/Code/EchoLearn/.planning/phases/43-engagement-ui/43-VALIDATION.md</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "nyquist_compliant: true" .planning/phases/43-engagement-ui/43-VALIDATION.md returns 1
    - grep -c "wave_0_complete: true" .planning/phases/43-engagement-ui/43-VALIDATION.md returns 1
    - grep -c "status: validated" .planning/phases/43-engagement-ui/43-VALIDATION.md returns 1
    - grep -c "Approval: validated" .planning/phases/43-engagement-ui/43-VALIDATION.md returns 1
    - Per-task verification map populated with at least 22 rows (all 7 plans' tasks listed; revised 2026-05-11 — 43-01 has 5 tasks, 43-05 has 4 tasks, 43-07 has 2 tasks)
    - All 6 sign-off checkboxes filled with [x]
  </acceptance_criteria>
  <done>VALIDATION.md fully signed off; phase ready for /gsd:verify-work.</done>
</task>

</tasks>

<verification>
- cd app && npm test exits 0 (FULL suite — all 43-* + counterweight Phase 36/42 tests green)
- cd app && npx tsc -b --noEmit exits 0
- cd app && npm run build exits 0
- All 4 close-out docs updated (PHASE-SUMMARY exists, STATE updated, ROADMAP plan list filled, VALIDATION signed off)
</verification>

<success_criteria>
- Phase 43 closed; STATE.md reflects "Ready for verification"
- All 8 plans listed in ROADMAP with checkboxes (updated slugs per revision 2026-05-11)
- PHASE-SUMMARY.md captures invariant audit + commit counts + carry-over notes for /gsd:verify-work consumption
- VALIDATION.md sign-off complete; nyquist_compliant true; per-task verification map populated with revised task counts (43-01 has 5 tasks; 43-05 has 4; 43-07 has 2)
- 4 atomic commits (PHASE-SUMMARY write, STATE update, ROADMAP update, VALIDATION update)
</success_criteria>

<output>
After completion, no additional SUMMARY needed — 43-PHASE-SUMMARY.md is itself the phase-level output. Update only STATE.md per Task 2 to reference 43-PHASE-SUMMARY.md as the phase-close artifact.
</output>
