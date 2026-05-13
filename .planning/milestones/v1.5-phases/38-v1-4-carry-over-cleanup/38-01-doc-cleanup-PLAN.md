---
phase: 38-v1-4-carry-over-cleanup
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md
  - .planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md
  - .planning/milestones/v1.4-ROADMAP.md
  - .planning/research/PITFALLS.md
  - app/tests/services/starter-posts.test.mjs
autonomous: true
requirements: [TECHDEBT-02, TECHDEBT-03, TECHDEBT-05]

scope_note: "5 tasks but each is a 1-3 line edit to a distinct file (34-VALIDATION.md frontmatter / 35-VALIDATION.md frontmatter / v1.4-ROADMAP.md single line / PITFALLS.md inline annotations / starter-posts.test.mjs string fixture). Tasks have no shared mutable state, are individually grep-verifiable in <1s, and produce 5 atomic bisection-friendly commits. Splitting would harm bisection (each file edit is the natural commit boundary) without reducing degradation risk (total context ~25%, well under the 50% target)."

must_haves:
  truths:
    - "34-VALIDATION.md frontmatter shows status: validated, nyquist_compliant: true, wave_0_complete: true."
    - "35-VALIDATION.md frontmatter shows status: validated (other fields untouched)."
    - "v1.4-ROADMAP.md Phase 36 entry mentions plans 36-14 + 36-15 by name in the **Plans:** line (not just in the Decisions of note section)."
    - "starter-posts.test.mjs hardcoded fixture strings match the production STARTER_POSTS strings (both say 'Trellis' OR both annotated as known drift)."
    - "PITFALLS.md echolearn references carry an explicit '(historical: pre-2026-05-07 brand)' annotation where the keys discussed have already been migrated."
    - "No new echolearn_* localStorage keys appear in app/src/services/*.ts outside legacy-migration.service.ts and db.service.ts (audit-by-grep produces zero hits in non-migration code)."
  artifacts:
    - path: ".planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md"
      provides: "Phase 34 validation status flipped to validated"
      contains: "status: validated"
    - path: ".planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md"
      provides: "Phase 35 validation status normalized to validated"
      contains: "status: validated"
    - path: ".planning/milestones/v1.4-ROADMAP.md"
      provides: "Phase 36 entry plans line references 36-14 + 36-15"
      contains: "36-14"
    - path: "app/tests/services/starter-posts.test.mjs"
      provides: "Starter post test fixtures consistent with production STARTER_POSTS"
      contains: "Trellis"
    - path: ".planning/research/PITFALLS.md"
      provides: "Echolearn references annotated as historical where appropriate"
      contains: "historical"
  key_links:
    - from: "app/tests/services/starter-posts.test.mjs"
      to: "app/src/services/concept-feed.service.ts STARTER_POSTS (line 87)"
      via: "string-equality of fixture vs production"
      pattern: "Welcome to Trellis"
---

<objective>
Close the three v1.4 documentation/audit carry-overs (TECHDEBT-02, TECHDEBT-03, TECHDEBT-05) so v1.5 starts from a clean baseline. All work is YAML frontmatter edits, single-line markdown edits, annotation passes, and a project-wide echolearn audit. ZERO source-code changes (the code change for TECHDEBT-06 lives in Plan 38-02; the device UAT for TECHDEBT-04 lives in Plan 38-03 — this plan does NOT touch those).

Purpose: Prevent v1.5 from inheriting drift in the v1.4 archive (status fields, plan-list entries) and in active CLAUDE.md / planning research notes. Leaves an audit trail in 38-01-SUMMARY.md so future agents can verify each echolearn occurrence's bucket assignment without re-grepping.

Output: 5 file edits across the v1.4 archive + active research + an active test fixture; an audit table embedded in this plan (Bucket A/B/C from RESEARCH.md INV-5); SUMMARY.md at plan close.
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
@.planning/phases/38-v1-4-carry-over-cleanup/38-CONTEXT.md
@.planning/phases/38-v1-4-carry-over-cleanup/38-RESEARCH.md
@CLAUDE.md
</context>

<echolearn_audit_table>
<!-- Source: 38-RESEARCH.md INV-5. Executor follows this table verbatim — does NOT decide ad-hoc.   -->
<!-- The CLAUDE.md "Brand history" paragraph (line 5 area) is the source of truth for which        -->
<!-- echolearn references are intentionally preserved. This table reflects D-04 bucketing.         -->

## Bucket A — INTENTIONAL backwards-compat — NO EDIT (already annotated or load-bearing)

| Location | Occurrence | Reason |
|----------|------------|--------|
| app/src/services/db.service.ts (lines 34, 38, 40, 41) | `'echolearn'` SQLite connection name (4 literals) | Per CLAUDE.md "Brand history" — changing orphans existing user databases |
| app/src/services/legacy-migration.service.ts (lines 4, 5, 9, 14, 18) | `LEGACY_PREFIX = 'echolearn_'` + comments | THIS IS the migration service; renaming would break migration |
| app/src/main.tsx (line 21) | Comment: `// Migrate pre-rebrand echolearn_* localStorage keys...` | Accurate historical annotation |
| CLAUDE.md (line 5 — Brand history paragraph) | "the SQLite connection name `'echolearn'`...path is also keyed to the original directory name" | Already carries the explicit brand-history annotation |
| CLAUDE.md (lines ~380, ~436 — i18n section paths) | `~/.claude/projects/-Users-Code-EchoLearn/memory/...` references | Auto-memory path keyed to on-disk directory name (cannot change) |
| .planning/milestones/v1.4-phases/** (all archived files) | All echolearn occurrences in v1.4 archive | Immutable historical record — no edits to archived phases EVER |
| app/tests/services/legacy-migration.test.mjs (lines 19-56) | `echolearn_settings`, `echolearn_post_queue` test fixture keys | These ARE the migration test fixtures — they correctly test the legacy-key path |

## Bucket B — DOC DRIFT — ANNOTATE or FIX

| Location | Occurrence | Action |
|----------|------------|--------|
| app/tests/services/starter-posts.test.mjs (lines 57, 59, 60, 68 area) | "Welcome to EchoLearn", "EchoLearn is your AI-powered learning companion", etc. in test fixture string literals | **FIX** — production app/src/services/concept-feed.service.ts STARTER_POSTS already says "Trellis" (verified at line 87+ during context-gathering). Test fixture is stale. Update test strings "EchoLearn" → "Trellis" so fixture matches production. Cross-reference production code at concept-feed.service.ts:87-110 (STARTER_POSTS array) to confirm exact production strings before editing. |
| .planning/research/PITFALLS.md (lines ~201-215, ~341 area) | `echolearn_post_history`, `echolearn_engagement_*`, `echolearn` SQLite connection refs in research notes | **ANNOTATE** — these are research notes about the rebrand pitfall; references are illustrative. Where they discuss keys that have already been migrated, append a `(historical: pre-2026-05-07 brand, key migrated to trellis_*)` annotation so future agents aren't confused. Don't rewrite the prose — append the annotation to clarifying sentences. |

## Bucket C — SURPRISES (case-by-case)

| Location | Occurrence | Action |
|----------|------------|--------|
| app/tests/services/post-essay.service.test.mjs (line 20) | `assert.ok(source.includes('trellis_short_posts'), ...)` | NOT echolearn — but the `trellis_short_posts` storage key becomes dead after Plan 38-02 removes the short post type. **DO NOT TOUCH IN THIS PLAN.** Plan 38-02 owns this assertion deletion. Cross-plan coordination: 38-01 must not modify post-essay.service.test.mjs. |
| app/src/services/concept-feed.service.ts (line ~1520) | `localStorage.getItem('trellis_short_posts')` | Same — owned by Plan 38-02. NOT echolearn-related. |

</echolearn_audit_table>

<tasks>

<task type="auto">
  <name>Task 1: Flip 34-VALIDATION.md frontmatter (status, nyquist_compliant, wave_0_complete)</name>
  <files>.planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md</files>
  <read_first>
    1. The full file: `.planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md` — confirm current frontmatter matches the BEFORE block below (no surprise fields added since RESEARCH.md was written 2026-05-09).
    2. RESEARCH.md § INV-2 (the "34-VALIDATION.md" subsection) — page-pin for rationale: Phase 34 VERIFICATION.md shipped status:passed with 8/8 must-haves; the VALIDATION.md frontmatter was never flipped at phase close (documented carry-over in v1.4-ROADMAP.md "Tech debt carried to v1.5").
  </read_first>
  <action>
    Edit ONLY the frontmatter. Do NOT touch the body of the file.

    BEFORE (lines 1-8):
    ```yaml
    ---
    phase: 34
    slug: v1-4-close-out-verification-debt-and-cleanup
    status: draft
    nyquist_compliant: false
    wave_0_complete: false
    created: 2026-04-25
    ---
    ```

    AFTER (lines 1-8):
    ```yaml
    ---
    phase: 34
    slug: v1-4-close-out-verification-debt-and-cleanup
    status: validated
    nyquist_compliant: true
    wave_0_complete: true
    created: 2026-04-25
    ---
    ```

    Three field changes:
    - `status: draft` → `status: validated`
    - `nyquist_compliant: false` → `nyquist_compliant: true`
    - `wave_0_complete: false` → `wave_0_complete: true`

    Do NOT add a `validated:` timestamp field unless the existing schema has one — check the corresponding Phase 33 or Phase 32 VALIDATION.md frontmatter shape and ONLY add fields that already exist in the v1.4 archive convention. The RESEARCH.md INV-2 only specifies the three field flips.

    Per Pitfall 5 in RESEARCH.md: the v1.4-ROADMAP.md is archived; touching ANY structural elements beyond the targeted edits creates a confusing diff. Apply the same discipline to 34-VALIDATION.md — frontmatter ONLY.
  </action>
  <verify>
    <automated>grep "^status: validated$" .planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md && grep "^nyquist_compliant: true$" .planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md && grep "^wave_0_complete: true$" .planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^status: validated$" .planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md` returns 1
    - `grep -c "^nyquist_compliant: true$" .planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md` returns 1
    - `grep -c "^wave_0_complete: true$" .planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md` returns 1
    - `grep -c "^status: draft$" .planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md` returns 0
    - `grep -c "^nyquist_compliant: false$" .planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md` returns 0
    - File diff (`git diff --stat`) shows exactly one file with 3 lines changed (no body edits)
  </acceptance_criteria>
  <done>34-VALIDATION.md frontmatter flipped to validated/true/true; body untouched; git diff shows exactly 3 line changes in the frontmatter only.</done>
</task>

<task type="auto">
  <name>Task 2: Normalize 35-VALIDATION.md frontmatter status (approved → validated)</name>
  <files>.planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md</files>
  <read_first>
    1. The full file: `.planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md` — confirm current frontmatter matches the BEFORE block below.
    2. RESEARCH.md § INV-2 (the "35-VALIDATION.md" subsection) — page-pin for rationale: `approved` is a non-standard status value (State B reconstruction artifact). The canonical status used by Phase 37 and the Nyquist gate is `validated`.
  </read_first>
  <action>
    Edit ONLY the `status:` field. Do NOT touch any other field including `nyquist_compliant: true` and `wave_0_complete: true` (already correct) and the `reconstructed_from:` note (preserve verbatim — it's a State B reconstruction artifact note that should remain for historical accuracy).

    BEFORE (lines 1-8):
    ```yaml
    ---
    phase: 35
    slug: fix-the-dynamic-system-prompt-issue
    status: approved
    nyquist_compliant: true
    wave_0_complete: true
    created: 2026-04-29
    reconstructed_from: SUMMARY artifacts (State B — no VALIDATION.md existed at planning time; phase ran with --skip-research)
    ---
    ```

    AFTER (lines 1-8):
    ```yaml
    ---
    phase: 35
    slug: fix-the-dynamic-system-prompt-issue
    status: validated
    nyquist_compliant: true
    wave_0_complete: true
    created: 2026-04-29
    reconstructed_from: SUMMARY artifacts (State B — no VALIDATION.md existed at planning time; phase ran with --skip-research)
    ---
    ```

    ONE field change only: `status: approved` → `status: validated`.

    Same archived-file discipline as Task 1 — do not touch the body.
  </action>
  <verify>
    <automated>grep "^status: validated$" .planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md && ! grep "^status: approved$" .planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md && grep "^reconstructed_from:" .planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^status: validated$" .planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md` returns 1
    - `grep -c "^status: approved$" .planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md` returns 0
    - `grep -c "^reconstructed_from:" .planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md` returns 1 (preserved)
    - `grep -c "^nyquist_compliant: true$" .planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md` returns 1 (untouched)
    - `git diff --stat` shows the file with exactly 1 line changed
  </acceptance_criteria>
  <done>35-VALIDATION.md frontmatter status normalized to validated; reconstructed_from note preserved; git diff shows exactly 1 line change.</done>
</task>

<task type="auto">
  <name>Task 3: Append 36-14 + 36-15 plan references to v1.4-ROADMAP.md Phase 36 entry</name>
  <files>.planning/milestones/v1.4-ROADMAP.md</files>
  <read_first>
    1. The full file (or at least lines 85-120 covering the Phase 36 entry and Decisions of note section): `.planning/milestones/v1.4-ROADMAP.md`. Confirm the **Plans:** line at line 93 still reads as the BEFORE block below.
    2. RESEARCH.md § INV-3 — page-pin for rationale: the Phase 36 entry's `**Plans:**` line currently mentions a "round-4 close-out" parenthetical but does NOT enumerate plans 36-14 + 36-15 by their plan numbers. Plans 36-14 (always-mounted screen state-resync principle) and 36-15 (handleForceNewDay symmetric two-cache mutation) are mentioned by name in the "Decisions of note" section (lines 109-110) but not in the Phase 36 plan-list area. CONTEXT.md D-03 wants them in the **Plans:** line, not just in the Decisions section.
    3. Pitfall 5 in RESEARCH.md: v1.4-ROADMAP.md is archived. Only the targeted line edit is permitted. Do NOT improve formatting elsewhere; do NOT add a separate bullet list (the format convention in this roadmap is parenthetical inline notes, not bullet lists — Phase 33's entry has no bullet list either).
  </read_first>
  <action>
    Edit EXACTLY ONE LINE in the file. Replace the existing `**Plans:**` line in the Phase 36 entry with the expanded version naming both plans explicitly.

    BEFORE (line 93 — current text):
    ```
    **Plans:** 16/16 across 4 rounds (round-4 close-out 2026-05-07: vine progress chip resync + warm-start re-fallback + handleForceNewDay symmetric two-cache mutation)
    ```

    AFTER (line 93 — replacement text):
    ```
    **Plans:** 16/16 across 4 rounds (round-4 close-out 2026-05-07; plans 36-14 + 36-15 added in round-4: vine-progress chip resync + warm-start re-fallback / handleForceNewDay symmetric two-cache mutation)
    ```

    Single line change. The substantive addition is the explicit "plans 36-14 + 36-15 added in round-4" naming. The descriptive list of changes (vine progress chip resync etc.) is preserved with a slight separator change (semicolon between round-4 close-out date + plan-naming clause; slash between the two plans' descriptive labels for readability).

    DO NOT add a separate bullet list under the Phase 36 entry. DO NOT add or remove other lines. DO NOT touch the "Tech debt carried to v1.5" section (lines 112+) since these items are now scheduled into v1.5 phases (Phase 37 closed TECHDEBT-01; this Phase 38 closes TECHDEBT-02..06). DO NOT touch the "Decisions of note" section (lines 105-110) — the cross-references there are accurate.

    DO NOT touch any other Phase entry (Phase 28-35) or any other section.
  </action>
  <verify>
    <automated>grep -c "plans 36-14 + 36-15 added in round-4" .planning/milestones/v1.4-ROADMAP.md && awk '/^### Phase 36:/,/^### Phase 37:|^### Rebrand:/' .planning/milestones/v1.4-ROADMAP.md | grep -c "36-14"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "plans 36-14 + 36-15 added in round-4" .planning/milestones/v1.4-ROADMAP.md` returns 1
    - `awk '/^### Phase 36:/,/^### Rebrand:/' .planning/milestones/v1.4-ROADMAP.md | grep -c "36-14"` returns at least 1 (proves "36-14" appears INSIDE the Phase 36 entry block, not just in the Decisions section below)
    - `awk '/^### Phase 36:/,/^### Rebrand:/' .planning/milestones/v1.4-ROADMAP.md | grep -c "36-15"` returns at least 1 (same for 36-15)
    - `git diff --stat` for v1.4-ROADMAP.md shows exactly 1 line changed (1 deletion + 1 insertion = 1 line modified)
    - `grep -c "^### Phase " .planning/milestones/v1.4-ROADMAP.md` is unchanged from before (no phase entries added or removed)
  </acceptance_criteria>
  <done>v1.4-ROADMAP.md Phase 36 **Plans:** line names plans 36-14 and 36-15 explicitly; awk-bounded grep confirms both appear inside the Phase 36 entry block (not just in Decisions of note); single-line diff.</done>
</task>

<task type="auto">
  <name>Task 4: Annotate PITFALLS.md echolearn references with brand-history notes</name>
  <files>.planning/research/PITFALLS.md</files>
  <read_first>
    1. The full PITFALLS.md, paying attention to lines 200-215 area (Pitfall 8 region — engagement signals + brand drift) and line ~341 (mitigations matrix row).
    2. CLAUDE.md "Brand history" paragraph (line 5 area) — confirms which echolearn references are intentionally preserved (SQLite connection name + auto-memory path).
    3. RESEARCH.md § INV-5 Bucket B "PITFALLS.md" row — page-pin specifying the annotation pattern: append `(historical: pre-2026-05-07 brand, key migrated to trellis_*)` where the keys discussed have already been migrated.
  </read_first>
  <action>
    Add inline annotations to the echolearn references in PITFALLS.md WITHOUT rewriting the prose. The goal is to clarify that specific echolearn_* keys already migrated, so future agents don't get confused into re-introducing them.

    Specific edits — make these changes ONLY at occurrences that discuss MIGRATED keys (not the SQLite connection name, which IS still echolearn). Reference the table below; verify line numbers before editing as PITFALLS.md may have shifted since RESEARCH.md was written:

    Edit 1 — Line ~201 area:
    BEFORE: `legacy-migration.service.ts migrated all echolearn_* keys to trellis_* keys at v1.4. If engagement signals add a new trellis_engagement_state key, this key will not have a legacy migration entry — that's fine. But if a developer accidentally uses echolearn_engagement_* as the key name (copy-paste from an older service file that hasn't been fully rebranded), there is no runtime migration and the key is silently orphaned on upgrade. The user's engagement history vanishes.`
    AFTER: Add this annotation as the LAST sentence of that paragraph: `(Note: the echolearn_* prefix is historical — pre-2026-05-07 brand. All such keys were one-shot migrated to trellis_* by legacy-migration.service.ts. New code MUST use trellis_*.)`

    Edit 2 — Line ~203 area:
    BEFORE: `More commonly: the CLAUDE.md "Brand history" note says localStorage keys use trellis_* but the SQLite connection name is still 'echolearn'. A developer working on engagement signals may reach for the SQLite connection (reasonable, since like/save are permanent records) but use the wrong connection name string literal.`
    AFTER: Append at end of paragraph: `(SQLite connection name 'echolearn' is intentionally preserved; only localStorage keys were rebranded.)`

    Edit 3 — Line ~341 area (the mitigations matrix row that mentions `echolearn_`):
    BEFORE: `| Engagement signals | New echolearn_ localStorage key after v1.4 rebrand | Lint check: no echolearn_ in new service files (Pitfall 8) |`
    AFTER: Replace with: `| Engagement signals | New (incorrect) echolearn_ localStorage key after v1.4 rebrand — historical prefix, pre-2026-05-07 | Lint check: no echolearn_ in new service files (Pitfall 8) |`
    (The change is "(incorrect)" + "— historical prefix, pre-2026-05-07" inserted between "rebrand" and the next pipe.)

    Do NOT touch the existing prose at lines 206 ("Brand rename happened in v1.4 (commit 9e5d1f38)..."), lines 210-211 (mitigation bullets), or line 215 (grep example). These are accurate as-is.

    The line numbers above are approximate — find the exact paragraphs by content, not line number, before editing.

    Net edit footprint: ~3 small inline annotations (1 sentence each). No section restructuring; no headings added or removed; no examples deleted.
  </action>
  <verify>
    <automated>grep -c "historical: pre-2026-05-07 brand" .planning/research/PITFALLS.md && grep -c "intentionally preserved" .planning/research/PITFALLS.md && grep -c "historical prefix, pre-2026-05-07" .planning/research/PITFALLS.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "historical: pre-2026-05-07 brand" .planning/research/PITFALLS.md` returns at least 1 (Edit 1 landed)
    - `grep -c "SQLite connection name 'echolearn' is intentionally preserved" .planning/research/PITFALLS.md` returns at least 1 (Edit 2 landed)
    - `grep -c "historical prefix, pre-2026-05-07" .planning/research/PITFALLS.md` returns at least 1 (Edit 3 landed)
    - `grep -c "Brand rename happened in v1.4 (commit 9e5d1f38)" .planning/research/PITFALLS.md` returns 1 (preserved, untouched)
    - `git diff --stat` shows PITFALLS.md with a small line-delta (3-6 lines modified, no large structural changes)
  </acceptance_criteria>
  <done>PITFALLS.md has 3 inline brand-history annotations on the migrated-key discussions; existing prose, examples, and mitigations preserved.</done>
</task>

<task type="auto">
  <name>Task 5: Fix starter-posts.test.mjs fixture strings (EchoLearn → Trellis to match production)</name>
  <files>app/tests/services/starter-posts.test.mjs</files>
  <read_first>
    1. `app/tests/services/starter-posts.test.mjs` (full file — it's small, ~120 lines).
    2. `app/src/services/concept-feed.service.ts` lines 87-150 area — the `STARTER_POSTS` array. CONFIRM the production strings already say "Trellis" (verified during context-gathering: line 90 reads `'Welcome to Trellis'`). If production strings still say "EchoLearn", abort this task and add an annotation comment to the test file instead — but production has been rebranded, so this case should not arise.
    3. RESEARCH.md § INV-5 Bucket B "starter-posts.test.mjs" row — confirms this is a test fixture drift. Plan executor MUST cross-reference production STARTER_POSTS strings before editing test fixtures. If both say "EchoLearn" they're consistent (drift is in production); if production says "Trellis" and test says "EchoLearn", test is stale (the expected case).
    4. RESEARCH.md § Open Questions (footnote at end of file) — the "starter-posts test fixture" item.
  </read_first>
  <action>
    Step 1 — VERIFY production strings before editing: Read `app/src/services/concept-feed.service.ts` lines 85-160 (the `STARTER_POSTS` array). Find the three `makeStarterPost(...)` calls. For each one, note the exact title/hook/preview/bodyMarkdown strings. Pay special attention to occurrences of "Trellis" or "EchoLearn".

    Expected production state (verified during planning): All three starter posts use "Trellis" — first post is `'Welcome to Trellis'`, body markdown says `'Trellis is your AI-powered learning companion'` and `'# Welcome to Trellis'`, etc.

    Step 2 — Edit test fixture to match production:

    Open `app/tests/services/starter-posts.test.mjs`. Find the three `makeStarterPost(...)` calls in the const `STARTER_POSTS = [...]` block (currently around lines 50-90 of the test file, originally reproduced from the production code). Update every "EchoLearn" to "Trellis" in:
    - Post 1 (`starter-welcome`): title `'Welcome to EchoLearn'` → `'Welcome to Trellis'`; preview text `'Ask any question and watch your knowledge grow. EchoLearn uses AI to create personalized learning paths.'` → `'Ask any question and watch your knowledge grow. Trellis uses AI to create personalized learning paths.'`; bodyMarkdown `'# Welcome to EchoLearn\n\nEchoLearn is your AI-powered learning companion...'` → `'# Welcome to Trellis\n\nTrellis is your AI-powered learning companion...'`
    - Posts 2 and 3: scan for any remaining "EchoLearn" occurrences in their string args and update each to "Trellis".

    Step 3 — VERIFY against production again. After editing the test fixture, the `STARTER_POSTS` literal in the test file MUST be character-for-character identical (modulo formatting whitespace) to the `STARTER_POSTS` literal in `concept-feed.service.ts`. If they differ in any other way (e.g., a hook string was rewritten in production but the test still has the old version), update the test to match.

    Step 4 — Run the test locally to confirm it still passes:
    ```
    cd app && node --test tests/services/starter-posts.test.mjs
    ```

    Net edit footprint: ~5-8 string replacements in the test fixture. No structural or assertion changes — the test logic stays the same; only the expected string values update.

    Pitfall 4 reference (RESEARCH.md): if the test fixture diverges from production for OTHER reasons (e.g., a body sentence was rewritten in v1.4 polish), bring the test fixture to parity in this same task. Don't ship a half-fix.
  </action>
  <verify>
    <automated>cd app && node --test tests/services/starter-posts.test.mjs 2>&1 | tail -5; grep -c "EchoLearn" tests/services/starter-posts.test.mjs; grep -c "Trellis" tests/services/starter-posts.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "EchoLearn" app/tests/services/starter-posts.test.mjs` returns 0 (no remaining occurrences in test fixture strings)
    - `grep -c "Welcome to Trellis" app/tests/services/starter-posts.test.mjs` returns at least 1 (matches production)
    - `cd app && node --test tests/services/starter-posts.test.mjs` exits 0 with all assertions passing (test fixture-vs-fixture match still works)
    - `diff <(grep -A2 "starter-welcome" app/src/services/concept-feed.service.ts | head -5) <(grep -A2 "starter-welcome" app/tests/services/starter-posts.test.mjs | head -5)` shows no surprising differences in user-facing strings
    - `git diff --stat app/tests/services/starter-posts.test.mjs` shows a small line-delta (5-15 lines modified)
  </acceptance_criteria>
  <done>starter-posts.test.mjs fixture strings updated EchoLearn→Trellis to match production STARTER_POSTS; node --test passes; production-vs-test fixture parity restored.</done>
</task>

</tasks>

<verification>
After all 5 tasks complete, run from the project root:

```bash
# TECHDEBT-02 verification
grep -c "^status: validated$" .planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md  # expect 1
grep -c "^status: validated$" .planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md  # expect 1

# TECHDEBT-03 verification (must be inside the Phase 36 entry block, not just Decisions section)
awk '/^### Phase 36:/,/^### Rebrand:/' .planning/milestones/v1.4-ROADMAP.md | grep -c "36-14"  # expect ≥1
awk '/^### Phase 36:/,/^### Rebrand:/' .planning/milestones/v1.4-ROADMAP.md | grep -c "36-15"  # expect ≥1

# TECHDEBT-05 verification
grep -rn "echolearn_" app/src/services/ --include="*.ts" | grep -v "legacy-migration\|db.service" | wc -l  # expect 0
grep -c "EchoLearn" app/tests/services/starter-posts.test.mjs  # expect 0
grep -c "historical: pre-2026-05-07 brand" .planning/research/PITFALLS.md  # expect ≥1

# Full test suite must not regress (Phase 37 baseline: test:main 558/555/3 + test:actions 16/14/2)
cd app && npm test 2>&1 | tail -10  # confirm ≤3 fails in main, ≤2 in actions
```

Then write `38-01-SUMMARY.md` with the audit table reproduced from this plan, plus a per-task summary of what was edited (file paths + line ranges) and any Bucket C surprises encountered.
</verification>

<success_criteria>
- TECHDEBT-02 closed: both 34-VALIDATION.md and 35-VALIDATION.md frontmatter normalized to status: validated.
- TECHDEBT-03 closed: v1.4-ROADMAP.md Phase 36 **Plans:** line names plans 36-14 + 36-15 explicitly.
- TECHDEBT-05 closed: starter-posts.test.mjs fixture strings match production (no "EchoLearn"); PITFALLS.md echolearn references annotated as historical where appropriate; no new echolearn_* localStorage keys in non-migration source code.
- Test suite parity: `cd app && npm test` shows ≤3 failures in test:main and ≤2 in test:actions (Phase 37 baseline preserved).
- 38-01-SUMMARY.md exists with the audit table and per-task summary.
- All 5 file edits land as separate atomic commits (per Phase 37 D-03 / CLAUDE.md best practice rule on bisection-friendly commits).
</success_criteria>

<output>
After completion, create `.planning/phases/38-v1-4-carry-over-cleanup/38-01-SUMMARY.md` with:
- Per-task summary (what was edited, file paths, line ranges, commit SHAs)
- Audit table from `<echolearn_audit_table>` reproduced verbatim with any Bucket C surprises encountered during execution
- Verification command outputs (grep counts, test suite tally)
- Confirmation that Plan 38-02's territory (post-essay.service.ts and concept-feed.service.ts trellis_short_posts references) was NOT touched by this plan
</output>
