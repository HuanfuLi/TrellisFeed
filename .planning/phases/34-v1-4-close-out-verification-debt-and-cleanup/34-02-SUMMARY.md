---
phase: 34-v1-4-close-out-verification-debt-and-cleanup
plan: 02
subsystem: testing
tags: [seam-12, source-grep-test, image-pregen, refillQueue, concept-feed, node-test]

# Dependency graph
requires:
  - phase: 33-phase-29-regression-and-phase-31-code-hygiene
    provides: image pre-gen architecture move from HomeScreen.handleLoad → concept-feed.service.ts:refillQueue (WIP, not yet committed)
provides:
  - Source-reading test re-targeted at the live image-pregen call site (`concept-feed.service.ts:refillQueue`)
  - Test green on the WIP working tree (was failing because grep target was the dead `HomeScreen.tsx:handleLoad` path)
affects: [phase-34-08, wave-5-commit-2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-grep test pattern (read .ts source, regex-assert structural patterns) — extended to a service file instead of a screen file"

key-files:
  created: []
  modified:
    - app/tests/screens/HomeScreen.image-pregen-filter.test.mjs

key-decisions:
  - "D-05 (sequencing): test fix lands atomically with production move in Wave 5 Commit 2 — test file is staged in working tree but NOT committed standalone by this plan"
  - "D-06 (grep target): rewrite asserts on `concept-feed.service.ts:refillQueue` body instead of `HomeScreen.tsx:handleLoad` body"
  - "Slice size bump (3000 → 12000 chars) — refillQueue is ~10kB and the image-pregen block lives ~9kB into the body, so the plan-prescribed 3000-char window was too small for the assertion targets"

patterns-established:
  - "When source-grep tests slice a function body by character count, the slice must exceed the function's actual length — refillQueue at ~10kB is the new minimum reference for service-level greps"

requirements-completed: [SEAM-12]

# Metrics
duration: 2min
completed: 2026-04-25
---

# Phase 34 Plan 02: SEAM-12 image-pregen test re-target Summary

**Re-pointed `HomeScreen.image-pregen-filter.test.mjs` from the dead `HomeScreen.tsx:handleLoad` grep target to the live `concept-feed.service.ts:refillQueue` body, restoring the source-reading guard against the Phase 33 WIP image-pregen architecture move.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-25T22:09:57Z
- **Completed:** 2026-04-25T22:11:44Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Test now reads `app/src/services/concept-feed.service.ts` instead of `app/src/screens/HomeScreen.tsx`.
- The `fnStart` locator searches for `'export async function refillQueue('` (live function declaration) instead of `'const handleLoad = useCallback'` (removed by WIP).
- All three structural assertions preserved (filter call, `Promise.allSettled(imagePosts.map(...))`, `imagePosts.length > 0` guard) — same regex shapes adapted for the new variable-binding shape (`const imagePosts = posts.filter(...)`).
- Test passes on the WIP working tree. Pre-fix: `# fail 1`. Post-fix: `# pass 1`.

## Task Commits

Per the plan's explicit instruction (D-05): the test file is staged in the working tree but NOT committed standalone. Plan 34-08 will fold this file into Wave 5 Commit 2 alongside `concept-feed.service.ts`, `HomeScreen.tsx`, and the other functional follow-on files. Tests must be green at every commit boundary (D-14) — committing this fix in isolation would leave the WIP tree green but make Commit 2 green only after both files land.

**Plan metadata:** committed as part of the docs-only final commit (SUMMARY + STATE + ROADMAP), separate from the test file edit.

## Files Created/Modified
- `app/tests/screens/HomeScreen.image-pregen-filter.test.mjs` — header comment rewritten to cite SEAM-12 + Phase 34 Plan 34-02; describe/it labels updated; source URL changed to `../../src/services/concept-feed.service.ts`; `fnStart` locator changed to `'export async function refillQueue('`; slice size bumped to 12000 chars (deviation, see below); three structural regex assertions preserved with refreshed messages.

## Decisions Made
- **Slice size bump (3000 → 12000):** the plan specified `slice(fnStart, fnStart + 3000)` but the live `imagePosts.filter` block lives at offset ~9007 from `refillQueue`'s declaration. A 3000-char slice misses all three assertion targets. Bumped to 12000 to accommodate the function body with margin. Documented inline as a code comment explaining the magnitude.
- **First assertion regex shape (deviation, see below):** the plan literally specified `/imagePosts\.filter\(/` but the source binds the filtered array AS `imagePosts`, not filters from it (`const imagePosts = posts.filter(...)`). Strict literal regex would fail on a correct codebase. Used `/const\s+imagePosts\s*=\s*[A-Za-z_$][\w$]*\.filter\(\([^)]*\)\s*=>\s*[^.]*\.presentationStyle\s*===\s*['"]image['"]\)/` instead — same intent (assert the filter creates `imagePosts` and narrows by image style), just adapted to the actual binding shape.
- **Header comment removed `handleLoad` mention:** acceptance criterion required `grep -c "handleLoad" ... = 0`. The header originally mentioned "moved from HomeScreen.handleLoad" for historical context. Reworded to "moved from the HomeScreen swipe-load callback" to satisfy the strict zero-grep without losing the rebrand context.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan-prescribed slice size too small**
- **Found during:** Task 1 (test verification)
- **Issue:** Plan said `slice(fnStart, fnStart + 3000)`. Actual offset from `refillQueue` declaration to `imagePosts.filter` block is ~9007 chars. With 3000, the slice excludes the very block being asserted on, so all three assertions fail even on a correct working tree.
- **Fix:** Bumped slice to `fnStart + 12000` and added a code comment explaining why.
- **Files modified:** `app/tests/screens/HomeScreen.image-pregen-filter.test.mjs`
- **Verification:** Test passes (`# pass 1, # fail 0`).

**2. [Rule 1 - Bug] Plan-prescribed first regex doesn't match the live binding shape**
- **Found during:** Task 1 (test verification)
- **Issue:** Plan said `/imagePosts\.filter\(/`. But `concept-feed.service.ts:1388` binds AS `const imagePosts = posts.filter(...)` — the variable being filtered is `posts`, not `imagePosts`. Strict literal regex never matches.
- **Fix:** Replaced with `/const\s+imagePosts\s*=\s*[A-Za-z_$][\w$]*\.filter\(\([^)]*\)\s*=>\s*[^.]*\.presentationStyle\s*===\s*['"]image['"]\)/` — asserts the filter call creates an `imagePosts` binding AND narrows by `presentationStyle === 'image'`. Same intent, correct shape. Acceptance criterion `grep -c "imagePosts.filter" >= 1` is still satisfied via the assertion message string `'... look for imagePosts.filter call'`.
- **Files modified:** `app/tests/screens/HomeScreen.image-pregen-filter.test.mjs`
- **Verification:** Test passes; all 8 acceptance grep checks pass (handleLoad=0, refillQueue=1, imagePosts.filter=1, Promise.allSettled=2, imagePosts.length>0=1, SEAM-12=1, src/services/concept-feed.service.ts=1).

**3. [Rule 1 - Bug] Header comment originally said "HomeScreen.handleLoad"**
- **Found during:** Task 1 (acceptance grep verification)
- **Issue:** Acceptance criterion `grep -c "handleLoad" ... = 0`. My first draft had `HomeScreen.handleLoad` in the historical context comment.
- **Fix:** Rephrased to "the HomeScreen swipe-load callback" — preserves historical context without the literal string `handleLoad`.
- **Files modified:** `app/tests/screens/HomeScreen.image-pregen-filter.test.mjs`
- **Verification:** `grep -c "handleLoad" tests/screens/HomeScreen.image-pregen-filter.test.mjs` returns 0.

---

**Total deviations:** 3 auto-fixed (3 Rule-1 bugs in plan-prescribed regex/slice/comment).
**Impact on plan:** All three fixes were necessary to make the test actually pass. Plan intent preserved verbatim — just adapted to the live source code's binding shape and length. No scope creep.

## Issues Encountered

- **Pre-fix test state:** the existing test on the WIP working tree was already failing (the symptom that motivated SEAM-12). Confirmed by running the test before any edits: `# fail 1`. After edits: `# pass 1`. Net regression delta: −1 failure (improvement).

## Verification Results

All acceptance criteria pass:

| Check | Expected | Actual |
|---|---|---|
| `grep -c "handleLoad"` | 0 | 0 |
| `grep -c "src/services/concept-feed.service.ts"` | >= 1 | 1 |
| `grep -c "export async function refillQueue"` | 1 | 1 |
| `grep -c "imagePosts\.filter"` | >= 1 | 1 (in assertion message) |
| `grep -c "Promise\.allSettled"` | >= 1 | 2 |
| `grep -cE "imagePosts\.length\s*>\s*0"` | >= 1 | 1 |
| `grep -cE "SEAM-12\|Phase 34 Plan 34-02"` | >= 1 | 1 |
| `node --test ... HomeScreen.image-pregen-filter.test.mjs` | pass 1, fail 0 | pass 1, fail 0 |
| `npx tsc -b --noEmit` | exit 0 | exit 0 |
| `git status --short app/` shows only the test file modified | yes | yes (1 file: `M app/tests/screens/HomeScreen.image-pregen-filter.test.mjs`) |

## Working-tree Status (handoff to Plan 34-08)

The test file edit is staged in the working tree (`M app/tests/screens/HomeScreen.image-pregen-filter.test.mjs`). Per D-05, this plan does NOT commit it. Plan 34-08's Wave 5 Commit 2 will stage it together with:
- `app/src/services/concept-feed.service.ts` (image-pregen production move)
- `app/src/screens/HomeScreen.tsx` (removal of dead handleLoad imagePosts.filter block)
- the other Commit 2 files listed in 34-CONTEXT.md D-13.

This guarantees tests are green at every commit boundary (D-14). Committing the test fix in isolation would leave the working tree green but make Commit 2 green only AFTER all of its files land.

## Next Plan Readiness

- 34-02 closes SEAM-12. Test is now correct on the WIP working tree.
- Plan 34-08 should stage `app/tests/screens/HomeScreen.image-pregen-filter.test.mjs` alongside `concept-feed.service.ts` + `HomeScreen.tsx` in Wave 5 Commit 2.
- No blockers for downstream plans.

## Self-Check: PASSED

- File exists: `app/tests/screens/HomeScreen.image-pregen-filter.test.mjs` — VERIFIED
- Test passes on WIP working tree: `# pass 1, # fail 0` — VERIFIED
- tsc clean: exit 0 — VERIFIED
- Only test file modified per `git status --short app/` — VERIFIED
- No standalone commit per D-05 — INTENTIONAL (test file remains staged in working tree for Plan 34-08)

---
*Phase: 34-v1-4-close-out-verification-debt-and-cleanup*
*Plan: 02 (SEAM-12)*
*Completed: 2026-04-25*
