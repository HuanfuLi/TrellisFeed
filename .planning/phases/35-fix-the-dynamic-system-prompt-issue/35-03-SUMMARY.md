---
phase: 35-fix-the-dynamic-system-prompt-issue
plan: 03
subsystem: docs
tags: [claude-md, documentation, kv-cache, useQuestions, load-bearing-rule, phase-32-1-lesson-8]

# Dependency graph
requires:
  - phase: 35 plan-01
    provides: "the live byte-stable code shape in useQuestions.ts that this CLAUDE.md section documents (the rule must match what landed)"
  - phase: 35 plan-02
    provides: "tests/state/useQuestions-system-prompt-stability.test.mjs (the source-reading test the new CLAUDE.md section cross-references)"
provides:
  - "CLAUDE.md project-root section documenting Phase 35 load-bearing rule for Ask-chat system-prompt byte-stability"
  - "Third pillar of Phase 32.1 lesson #8 documentation-in-three-places (CLAUDE.md + inline code comment from Plan 01 + source-reading test from Plan 02)"
affects:
  - "Future agents reading CLAUDE.md before refactoring useQuestions.ts will see the rule and avoid re-introducing per-turn dynamic interpolation in the system prompt"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CLAUDE.md load-bearing-rule section format: H2 heading + opening rule paragraph + ### Why this exists + ### Rules numbered list — mirrors existing Classification dedup, Header positioning, Concept Feed Pipeline, ChatInput flex-shrink sections"

key-files:
  created: []
  modified:
    - CLAUDE.md

key-decisions:
  - "D-06 honored: section title 'Ask-chat system prompt — byte-stable across turns (Phase 35 — load-bearing)' placed adjacent to the existing Phase 33 'Classification dedup — embedding pre-check' section, immediately preceding 'Best practices learned in Phase 32.1'"
  - "Path correction documented at the planning layer (Plan 03 PLAN frontmatter) and silently honored in execution: there is no app/CLAUDE.md (despite CONTEXT.md D-06 referencing that path); the canonical CLAUDE.md lives at the project root. Edit applied to /Users/Code/EchoLearn/CLAUDE.md."
  - "Six-item Rules list (matches the load-bearing density of the Classification dedup section's 5 items + ChatInput flex-shrink's 2 items + Concept Feed Pipeline's deeper section) — covers re-introduction, dropping, single-closure-variable discipline, applyLocaleDirective expectations, the 5-minute provider TTL inherent limit, and the explicit non-goal of consistency-fixing one-shot call sites"

patterns-established:
  - "Documentation in three places (Phase 32.1 lesson #8): code-site inline comment (Plan 01) + source-reading test (Plan 02) + CLAUDE.md load-bearing section (this plan). Triple guard against silent refactor-induced regressions."

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-04-29
---

# Phase 35 Plan 03: Add CLAUDE.md load-bearing-rule section for Ask-chat system-prompt byte-stability Summary

**Inserted a new H2 section into project-root `CLAUDE.md` documenting the Phase 35 rule (no per-turn dynamic interpolation in `useQuestions.askStreaming` system prompt; candidate context lives in tail-position assistant message reused by Pass 1 + Pass 2), positioned between the existing Classification dedup and Best practices learned in Phase 32.1 sections — completing the third pillar of the Phase 32.1 lesson #8 "documentation in three places" discipline.**

## Performance

- **Duration:** ~2 min (single-file Markdown insertion; one Edit operation)
- **Started:** 2026-04-29T12:54:39Z
- **Completed:** 2026-04-29T12:55:55Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- New section `## Ask-chat system prompt — byte-stable across turns (Phase 35 — load-bearing)` inserted at line 257 of `CLAUDE.md`.
- Section structure mirrors adjacent load-bearing sections: opening rule paragraph (with embedded TypeScript code block showing the `[system, ...history, assistant(context), user]` shape), `### Why this exists` rationale paragraph, `### Rules` numbered list (6 items).
- Cross-references the live test file `tests/state/useQuestions-system-prompt-stability.test.mjs` by filename — future agents who break the invariant will be pointed at the failing test.
- Cross-references `LabPresentation/SCRIPTS.md` slide 4.7 — anchors the public-disclosure provenance for the fix.
- Documents the explicit non-goal of "consistency-fixing" the other one-shot LLM call sites (`concept-feed`, `planner`, `podcast`, `post-essay`, `post-context-qa`, `flashcard`, `canonical-knowledge` non-descent paths, `AskScreen.tsx:86` session-title) — pointing readers at `35-VERIFICATION.md` for the full audit.
- Honestly notes the 5-minute provider TTL as an inherent limit (not a Phase 35 bug) — sets correct expectations about long-idle conversations.
- Markdown structurally valid: 6 code fences (balanced), 391 total lines, 34200 bytes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Insert Phase 35 load-bearing section into CLAUDE.md** — `9321b1dd` (docs)

## Files Created/Modified

- `CLAUDE.md` — Single-file Markdown insertion:
  - Inserted 34 new lines between line 253 (`5. **Threshold tuning is empirical, not mathematical.** ...`) and the existing `---` + `## Best practices learned in Phase 32.1` block.
  - Net change: +34 lines, 0 deletions, no other content modified.

## Decisions Made

- **D-06 honored verbatim:** section title matches the recommended `## Ask-chat system prompt — byte-stable across turns (Phase 35 — load-bearing)`; positioned adjacent to Classification dedup (line 236) and immediately preceding Best practices learned in Phase 32.1 (line 291), exactly as CONTEXT specified.
- **Path correction (silent):** CONTEXT.md D-06 references `app/CLAUDE.md`, but no such file exists in this repo. The canonical CLAUDE.md is at project root (`/Users/Code/EchoLearn/CLAUDE.md`). Plan 03 PLAN frontmatter caught this and the executor honored it. No deviation logged because the planner's correction was authoritative.
- **Six Rules items (vs. CONTEXT.md "2-3"):** Kept all six rules from the Plan 03 `<action>` block — they cover distinct invariants (no re-introduction of dynamic content, no dropping of the assistant-tail message, single-closure discipline, `applyLocaleDirective` first-system-message expectations, 5-minute TTL framing, and the deferred one-shot call sites). Trimming to 3 would have lost the operationally important honest-framing items (TTL limit + deferred-by-design call sites).
- **TypeScript code block in opening paragraph:** Included the 4-element message-array shape verbatim as a fenced TypeScript block. Matches the visual density of the Classification dedup section's numbered substeps and the Concept Feed Pipeline section's ASCII diagram. Future agents skim-reading the section get the structural shape immediately.

## Deviations from Plan

None — plan executed exactly as written. The Plan 03 `<action>` block specified the literal Markdown content; it was inserted verbatim. No CLAUDE.md directives were violated (the new section ITSELF is a CLAUDE.md directive going forward).

## Issues Encountered

None. The Edit tool completed cleanly on the first attempt.

## Verification Results

Acceptance criteria from `35-03-PLAN.md` `<acceptance_criteria>`:

- [x] `grep -c "## Ask-chat system prompt — byte-stable across turns (Phase 35 — load-bearing)" /Users/Code/EchoLearn/CLAUDE.md` returns exactly `1` — verified
- [x] `grep -nE "^## " /Users/Code/EchoLearn/CLAUDE.md` shows the new heading positioned AFTER `## Classification dedup` (line 236) and BEFORE `## Best practices learned in Phase 32.1` (line 291) — verified at line 257
- [x] Section contains a `### Why this exists` subheading and a `### Rules` subheading — verified (`grep -c "^### "` over the section returns 2)
- [x] Rules subsection contains exactly 6 numbered items — verified (`awk` slice of section + `grep -cE "^[0-9]+\."` returns 6)
- [x] Section references `useQuestions-system-prompt-stability.test.mjs` by filename — verified (1 occurrence)
- [x] Section references `LabPresentation/SCRIPTS.md` slide 4.7 — verified (1 occurrence)
- [x] Section mentions the byte-stable code-shape block as a TypeScript snippet (`role: 'assistant', content: assistantContextMessage`) — verified (1 occurrence)
- [x] Full file remains valid Markdown — verified: `node -e require('fs').readFileSync(...)` succeeds; 6 code fences (balanced); 391 total lines

## Next Phase Readiness

The "documentation in three places" triple guard is now complete for Phase 35:

1. **Code-site inline comment** — landed in Plan 01 commit `5f27f26a` (lines 140-145 + 154-161 of `useQuestions.ts`).
2. **Source-reading test** — landed in Plan 02 (the orchestrator's regex hotfix referenced in the prompt notes).
3. **CLAUDE.md load-bearing section** — landed in this plan, commit `9321b1dd`.

Plan 04 (project-wide chatStream/chatCompletion audit + `35-VERIFICATION.md`) was already complete prior to this plan. Phase 35 is now ready for `/gsd:verify 35` and merge.

## Self-Check: PASSED

Verified files exist:
- FOUND: `/Users/Code/EchoLearn/CLAUDE.md` (modified, +34 lines)
- FOUND: commit `9321b1dd` in `git log --oneline`

Verified acceptance grep invariants:
- FOUND: 1 × `## Ask-chat system prompt — byte-stable across turns (Phase 35 — load-bearing)`
- FOUND: H2 positioning Classification-dedup(236) → Phase-35(257) → Best-practices-32.1(291)
- FOUND: 2 × `### ` subheadings within the Phase 35 section
- FOUND: 6 × numbered Rules items
- FOUND: 1 × `useQuestions-system-prompt-stability` filename reference
- FOUND: 1 × `slide 4.7` LabPresentation reference
- FOUND: 1 × `role: 'assistant', content: assistantContextMessage` code-shape line

Verified Markdown structural validity:
- PASSED: 6 code fences (balanced)
- PASSED: file readable via `fs.readFileSync` without parse errors
- PASSED: total lines 391, byte length 34200

---
*Phase: 35-fix-the-dynamic-system-prompt-issue*
*Completed: 2026-04-29*
