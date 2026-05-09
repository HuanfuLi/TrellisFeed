---
phase: 38-v1-4-carry-over-cleanup
plan: 04
subsystem: ui
tags: [i18n, locale, flashcards, mock-data, fresh-install, cache-invalidation, event-bus]

# Dependency graph
requires:
  - phase: 38
    provides: Plan 38-02 (YouTube short-type removal) — settled the type/style world this plan caches against; Plan 38-03 (device UAT) — surfaced both bugs during round-1 fresh-install testing
provides:
  - LOCALE_CHANGED subscriber in concept-feed.service.ts that strips cached textArtContent so welcome posts regenerate under the new UI locale
  - Empty-default fresh-install review queue (no more 5 hardcoded English seed flashcards on first launch)
affects: [v1.5 ENGAGE/CONTENT plans that touch the fresh-install onboarding path; future content-localization phases that audit cache-invalidation hooks for new locale-sensitive fields]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cache invalidation via event-bus subscriber at module top level (matches the useQuestions.askStreaming LOCALE_CHANGED pattern at useQuestions.ts:132)"
    - "Object-rest-destructure to strip a single field from a typed object: const { textArtContent: _drop, ...rest } = p; return rest as DailyPost"

key-files:
  created: []
  modified:
    - app/src/services/flashcard.service.ts
    - app/src/services/concept-feed.service.ts

key-decisions:
  - "Strip textArtContent (not the whole post) on LOCALE_CHANGED so the queue doesn't lose its place — the next render path triggers _backgroundGenerateTextArt to regenerate just that field under the new locale."
  - "Reset _textArtBgRunning = false inside the subscriber so an in-flight pre-locale-switch generation that resolves AFTER the strip can re-fire instead of being permanently short-circuited."
  - "Delete (not refactor) makeSeedCards — Trellis is local-first personalized learning per PROJECT.md; pre-canned mock content contradicts the model. Empty review queue is the correct default."
  - "Don't write the empty array to localStorage on first launch — no point persisting an empty array; localStorage.getItem will keep returning null and the same `if (!raw) return []` branch will execute on every load until real cards exist."

patterns-established:
  - "Pattern: stale-cache invalidation via top-level eventBus.subscribe in service modules. Subscriber installed at module import time, fires on actual emit. Used here for LOCALE_CHANGED → text-art; same shape works for any future locale-stamped cache field."

requirements-completed: [BUG-A-textart-locale, BUG-B-mock-flashcard-seeds]

# Metrics
duration: 5 min
completed: 2026-05-09
---

# Phase 38 Plan 04: Fresh-install Bug Fixes Summary

**Two pre-existing fresh-install UX bugs closed: LOCALE_CHANGED subscriber invalidates cached text-art content (Bug A) and removed 5 hardcoded English seed flashcards (Bug B).**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-09T06:01:58Z
- **Completed:** 2026-05-09T06:07:37Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **Bug A (Task 2):** Welcome posts under STARTER_POSTS no longer render Chinese text-art content under English locale. `concept-feed.service.ts` now subscribes to `LOCALE_CHANGED` at module import time and strips `textArtContent` from every cached post on emit, so `_backgroundGenerateTextArt` regenerates fresh content under the new locale on the next render.
- **Bug B (Task 1):** New users no longer see 5 pre-canned English flashcards (dialectical materialism / quantum entanglement / backpropagation / supervised vs unsupervised / 2nd law of thermodynamics) on first launch. `makeSeedCards` deleted; `loadAll`'s first-launch branch now returns `[]`.
- **Test baseline preserved exactly:** test:main 566/564/2, test:actions 16/16/0 (matches post-Plan-38-02 baseline). Zero new failures; the 2 main-suite fails are the pre-existing baseline (extensionless youtube.service import + date-dependent getVineColor assertion) per Phase 37 STATE.md.

## Task Commits

1. **Task 1: Remove mock flashcard seed data (Bug B)** — `8829a68c` (fix)
2. **Task 2: Invalidate cached text-art on LOCALE_CHANGED (Bug A)** — `305c74fd` (fix)

**Plan metadata:** _pending — committed by orchestrator after this SUMMARY lands_ (docs)

## Files Created/Modified

- `app/src/services/flashcard.service.ts` — Deleted `makeSeedCards` (lines 13-54 region) and the comment block above it; rewrote `loadAll`'s first-launch branch from `localStorage.setItem(...) → return seeds` to `return []`. Net: -49 lines (263 → 214).
- `app/src/services/concept-feed.service.ts` — Added 16-line module-top-level `eventBus.subscribe('LOCALE_CHANGED', ...)` block immediately after `_persistStylesToCache` (line 612). Handler reads cache via `loadCache`, strips `textArtContent` from every text-art post via object-rest-destructure, re-saves via `saveCache`, and resets `_textArtBgRunning = false` so an in-flight pre-locale-switch generation can re-fire if it resolves after the strip.

## Decisions Made

- **Strip `textArtContent` field, not the whole post.** Removing the post from cache would lose its position in the queue and re-trigger the LLM's full essay-generation path. Stripping just the locale-sensitive field lets `_backgroundGenerateTextArt` regenerate exactly what changed.
- **Reset `_textArtBgRunning = false` inside the subscriber.** Without it, an in-flight pre-locale-switch generation that resolves AFTER the strip would be the last writer to the cache, restoring stale content. Resetting the in-flight flag lets the next render path re-fire generation under the new locale.
- **Delete `makeSeedCards` outright (not gate behind an opt-in).** Trellis's value prop (local-first personalized learning) is at odds with shipping mock content. The plan correctly diagnosed this as a pre-existing semantic bug, not a feature toggle.
- **No persist on empty array.** `loadAll()` returns `[]` directly when localStorage is empty; we don't write the empty array back. The same `if (!raw) return []` branch runs on every load until real cards exist, with negligible perf cost (single localStorage.getItem call).

## Deviations from Plan

None — plan executed exactly as written.

Both edits landed verbatim per the action blocks. All `<read_first>` files were read; the orchestrator's pre-verification (zero `fc-seed`/`makeSeedCards` references outside the service file; `eventBus` already imported in `concept-feed.service.ts`; `LOCALE_CHANGED` event type at types/index.ts:676) was confirmed before each task. Acceptance criteria for both tasks ran clean on first attempt:

- **Task 1:** `tsc -b --noEmit` green; file dropped from 263 to 214 lines (-49, matches plan's "~40 lines" expectation); `! grep -q "makeSeedCards"` and `! grep -q "fc-seed"` both pass; no flashcard test file exists in `tests/services/` so no test runs were displaced.
- **Task 2:** `tsc -b --noEmit` green; subscriber installed at module top level (line 615); handler structure matches plan verbatim; full `npm test` returns identical baseline counts to post-Plan-38-02 (566/564/2 + 16/16/0).

**Total deviations:** 0
**Impact on plan:** Plan landed exactly as designed.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Manual Verification (folds back into Plan 38-03 UAT)

After the orchestrator's metadata commit, the operator should run the round-2 verification path described in the plan:

1. **Bug B verify:** `localStorage.removeItem('trellis_flashcards')` in DevTools (or fresh install on a wiped device), reload app, navigate Review tab. Expect: empty review queue, no Marx/quantum/etc cards.
2. **Bug A verify:** Set device locale to Chinese, install fresh, complete onboarding picking English, observe welcome posts. Expect: text-art renders in English (may briefly show "loading" while regeneration completes). Optionally repeat in reverse: en device → switch to zh in Settings → text-art regenerates in zh on next visible swipe.

Folded into the same `38-HUMAN-UAT.md` device session — no separate UAT file.

## Next Phase Readiness

Phase 38 is now complete (4/4 plans). Verifier should be invoked next via `/gsd:verify-work 38`, then `/gsd:plan-phase 39` (engagement signals — start of Wave 1).

The two bugs closed here unblock fresh-install UX for v1.5's broader "Curiosity Feed v2" rollout — both surfaces (welcome posts + review queue) are clean for new users. No follow-up plans required from these fixes.

---
*Phase: 38-v1-4-carry-over-cleanup*
*Completed: 2026-05-09*

## Self-Check: PASSED

- SUMMARY.md created at `.planning/phases/38-v1-4-carry-over-cleanup/38-04-fresh-install-bugs-SUMMARY.md` ✓
- `app/src/services/flashcard.service.ts` modified ✓ (commit 8829a68c)
- `app/src/services/concept-feed.service.ts` modified ✓ (commit 305c74fd)
- Both task commits visible in `git log --oneline --all` ✓
- Test baseline preserved: test:main 566/564/2 + test:actions 16/16/0 (matches post-Plan-38-02 baseline) ✓
- tsc -b --noEmit exits 0 after both tasks ✓
