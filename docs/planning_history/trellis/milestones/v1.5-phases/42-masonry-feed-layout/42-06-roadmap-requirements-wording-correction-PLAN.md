---
phase: 42-masonry-feed-layout
plan: 06
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
autonomous: true
requirements: [MASONRY-01]
must_haves:
  truths:
    - "REQUIREMENTS.md line 11 (MASONRY-01 acceptance language) updated to remove the literal 'column-count: 2' + 'break-inside: avoid' wording (CONTEXT.md operator-confirmed scope; RESEARCH.md § 8 verbatim replacement text)"
    - "ROADMAP.md line 1066 (per-phase plan reference table entry) updated to match"
    - "ROADMAP.md line 1141 (Phase 42 Goal) updated to match"
    - "ROADMAP.md line 1145 (Phase 42 SC-1) updated to match"
    - "All 4 line edits land in a SINGLE atomic commit BEFORE plan 42-05's source-reading test asserts the negative grep (so verify-work doesn't fail on stale wording)"
    - "Functional contract is identical: 2-column masonry, no card splits across columns; only the implementation mechanism differs"
  artifacts:
    - path: ".planning/REQUIREMENTS.md"
      provides: "MASONRY-01 wording aligned with D-02 height-accumulating split"
    - path: ".planning/ROADMAP.md"
      provides: "Phase 42 entry, goal, SC-1 wording aligned with D-02"
  key_links: []
---

<objective>
Make 4 surgical line edits to align ROADMAP.md and REQUIREMENTS.md wording with CONTEXT.md D-02's height-accumulating split decision (chosen over CSS `column-count: 2` due to column-shuffle bad UX).

CONTEXT.md D-02 operator-explicitly flags this as a mechanical wording adjustment landed inside Phase 42 (not scope creep). RESEARCH.md § 8 provides exact line numbers + verbatim replacement text for all 4 edits.

The user-visible contract is identical (2-column masonry, no card splits across columns); only the implementation mechanism differs (height-accumulating JS split vs CSS column-count). Without this edit, verify-work's source-reading test would fail because the verifier would literally grep for `column-count` in MasonryFeed.tsx and find nothing (correct per D-02; stale per ROADMAP wording).

Purpose: Close MASONRY-01's stale literal-wording assertion. Lands BEFORE plan 42-05's source-reading negative grep so the test contract is consistent.

Output: 4 line edits across 2 files in one atomic commit.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/phases/42-masonry-feed-layout/42-CONTEXT.md
@.planning/phases/42-masonry-feed-layout/42-RESEARCH.md

<interfaces>
**EXACT line numbers verified by RESEARCH.md § 8 (2026-05-09):**

- `.planning/REQUIREMENTS.md:11` — MASONRY-01 acceptance language
- `.planning/ROADMAP.md:1066` — per-phase reference table entry
- `.planning/ROADMAP.md:1141` — Phase 42 Goal
- `.planning/ROADMAP.md:1145` — Phase 42 SC-1

**Verification commands (run BEFORE editing — confirm line numbers match):**
```bash
grep -n "column-count" .planning/REQUIREMENTS.md .planning/ROADMAP.md
# Expected output:
# .planning/REQUIREMENTS.md:11:  ...column-count: 2 + break-inside: avoid...
# .planning/ROADMAP.md:1066:    ...column-count: 2 + break-inside: avoid...
# .planning/ROADMAP.md:1141:    ...column-count: 2 + break-inside: avoid...
# .planning/ROADMAP.md:1145:    ...column-count: 2 + break-inside: avoid...
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Apply 4 wording edits in single atomic commit</name>
  <files>.planning/REQUIREMENTS.md, .planning/ROADMAP.md</files>
  <read_first>
    - .planning/REQUIREMENTS.md (read lines 8-15 to confirm MASONRY-01 line + surrounding context)
    - .planning/ROADMAP.md (read lines 1063-1070 for context around line 1066 entry; lines 1138-1150 for Phase 42 Goal + SC-1 + SC-2 context)
    - .planning/phases/42-masonry-feed-layout/42-RESEARCH.md (§ 8 lines 1288-1352 — verbatim replacement text for all 4 edits)
    - .planning/phases/42-masonry-feed-layout/42-CONTEXT.md (D-02 lines 51-57 — rationale for the wording change)
  </read_first>
  <action>
    Make these 4 EXACT edits. Run a `grep -n "column-count" .planning/REQUIREMENTS.md .planning/ROADMAP.md` first to confirm line numbers; if line numbers have shifted (other edits since 2026-05-09), use the surrounding context to locate the correct lines.

    **EDIT 1 — `.planning/REQUIREMENTS.md` line 11:**

    Before:
    ```markdown
    - [ ] **MASONRY-01** Feed renders as a 2-column masonry layout via CSS `column-count: 2` + `break-inside: avoid`; cards never split across columns
    ```

    After:
    ```markdown
    - [ ] **MASONRY-01** Feed renders as a 2-column masonry layout via height-accumulating JS split (`MasonryFeed.tsx`); cards never split across columns by construction (each tile is rendered atomically inside one column)
    ```

    **EDIT 2 — `.planning/ROADMAP.md` line 1066:**

    Before:
    ```markdown
    - [ ] **Phase 42: Masonry Feed Layout** — `MasonryFeed.tsx` with CSS `column-count: 2` + `break-inside: avoid`; framer-motion entrance animations on leaf cards; vine-bloom end-of-content celebration card
    ```

    After:
    ```markdown
    - [ ] **Phase 42: Masonry Feed Layout** — `MasonryFeed.tsx` with height-accumulating 2-column split (Pinterest/Rednote-style; tiles never move between columns on append); framer-motion entrance animations on leaf cards; vine-bloom end-of-content celebration card
    ```

    **EDIT 3 — `.planning/ROADMAP.md` line 1141 (Phase 42 Goal):**

    Before:
    ```markdown
    **Goal**: Pinterest-style 2-column masonry feed using CSS `column-count: 2` + `break-inside: avoid`; vine-bloom celebration replaces the bare "no more posts" toast.
    ```

    After:
    ```markdown
    **Goal**: Pinterest-style 2-column masonry feed using a height-accumulating JS split (each new tile drops into the currently shorter column at append time and stays there); vine-bloom celebration replaces the bare "no more posts" toast.
    ```

    **EDIT 4 — `.planning/ROADMAP.md` line 1145 (Phase 42 SC-1):**

    Before:
    ```markdown
      1. HomeScreen feed renders as a 2-column masonry layout; no card splits across columns (visual snapshot + DOM-tree test asserting `column-count: 2` + `break-inside: avoid` are present in the rendered styles)
    ```

    After:
    ```markdown
      1. HomeScreen feed renders as a 2-column masonry layout; no card splits across columns (each tile is rendered atomically inside one of two flex-column wrappers); source-reading test asserts `MasonryFeed.tsx` does NOT use `column-count` / `break-inside` CSS (height-accumulating split chosen per CONTEXT.md D-02)
    ```

    **DO NOT TOUCH:**
    - Any other line in REQUIREMENTS.md (the other 21 requirements stay verbatim)
    - SC-2 in ROADMAP line 1146 ("Card heights vary naturally per content...") — its `image / text-art / video / short / news` enumeration is stale on `'short'` per CONTEXT.md canonical_refs note, but fixing it is OUT OF SCOPE for plan 42-06; it will be naturally invalidated when verify-work runs against the live PresentationStyle union (no `'short'` per Phase 38). If the operator wants SC-2 cleanup, that's a separate follow-up.
    - Other SCs (3, 4, 5) in ROADMAP — these are correct as written
    - The `## Progress` table entry for Phase 42 (still `0/0 | Not started` until plans land)

    **POST-EDIT VERIFICATION:**
    Run:
    ```bash
    grep -n "column-count" .planning/REQUIREMENTS.md .planning/ROADMAP.md
    ```
    Expected output: ONLY line 1145 (the SC-1 line), and ONLY in the negated form `does NOT use 'column-count' / 'break-inside' CSS`. Verify the literal-assertion form (`asserting column-count: 2 + break-inside: avoid are present`) is GONE from all 4 sites.

    Atomic commit message: `docs(42): correct MASONRY-01 + SC-1 wording — height-accumulating split, not column-count CSS

    CONTEXT.md D-02 selected JS height-accumulating split over CSS column-count (the
    latter shuffles existing tiles between columns when new ones append — bad UX).
    Update REQUIREMENTS.md MASONRY-01 + ROADMAP.md Phase 42 entry/goal/SC-1 wording
    to match. Verifier source-reading test now asserts the NEGATIVE (column-count CSS
    absent from MasonryFeed.tsx) instead of the positive.

    User-visible contract unchanged: 2-column masonry, no card splits.`
  </action>
  <verify>
    <automated>! grep -qE "asserting .column-count: 2. \+ .break-inside: avoid. are present" /Users/Code/EchoLearn/.planning/ROADMAP.md &amp;&amp; ! grep -qE "via CSS .column-count: 2. \+ .break-inside: avoid." /Users/Code/EchoLearn/.planning/REQUIREMENTS.md /Users/Code/EchoLearn/.planning/ROADMAP.md &amp;&amp; grep -q "height-accumulating" /Users/Code/EchoLearn/.planning/REQUIREMENTS.md &amp;&amp; grep -c "height-accumulating" /Users/Code/EchoLearn/.planning/ROADMAP.md | grep -qE "^[3-9]$|^[1-9][0-9]+$"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "via CSS .column-count: 2." .planning/REQUIREMENTS.md` returns `0`
    - `grep -c "via CSS .column-count: 2." .planning/ROADMAP.md` returns `0`
    - `grep -c "height-accumulating" .planning/REQUIREMENTS.md` returns ≥ `1`
    - `grep -c "height-accumulating" .planning/ROADMAP.md` returns ≥ `3` (lines 1066, 1141, 1145 all use the phrase)
    - `grep -n "asserting .column-count: 2." .planning/ROADMAP.md` returns no matches (the literal positive-assertion form is gone)
    - The remaining `column-count` mention in ROADMAP line 1145 is in NEGATED form: `does NOT use \`column-count\``
    - File line counts unchanged within ±1 line per file (no accidental block deletions)
    - Single atomic commit (per the action's commit message)
  </acceptance_criteria>
  <done>4 line edits applied; literal `column-count: 2` + `break-inside: avoid` positive-assertion wording removed from REQUIREMENTS + ROADMAP; D-02 height-accumulating split is the documented mechanism. Plan 42-05's negative grep test will be consistent with the documented contract.</done>
</task>

</tasks>

<verification>
- `grep -E "via CSS .column-count: 2.|asserting .column-count: 2." .planning/REQUIREMENTS.md .planning/ROADMAP.md` returns no matches
- `grep -c "height-accumulating" .planning/REQUIREMENTS.md` returns ≥ 1
- `grep -c "height-accumulating" .planning/ROADMAP.md` returns ≥ 3
- The 4 edits landed in a single commit (verified via `git log -1 --stat`)
</verification>

<success_criteria>
- All 4 edits applied per RESEARCH.md § 8 verbatim replacement text
- Single atomic commit
- No other lines in REQUIREMENTS.md or ROADMAP.md modified
- Functional contract preserved (2-column masonry; no card splits)
</success_criteria>

<output>
After completion, create `.planning/phases/42-masonry-feed-layout/42-06-SUMMARY.md` documenting:
- The 4 edits with before/after snippets
- Atomic commit hash
- Confirmation that grep verification passes
</output>
