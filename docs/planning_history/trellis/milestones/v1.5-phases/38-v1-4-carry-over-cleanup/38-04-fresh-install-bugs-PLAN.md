---
plan: 38-04-fresh-install-bugs
phase: 38
phase_name: v1-4-carry-over-cleanup
wave: 2
depends_on: [38-02-youtube-short-removal]
requirements: [BUG-A-textart-locale, BUG-B-mock-flashcard-seeds]
files_modified:
  - app/src/services/flashcard.service.ts
  - app/src/services/concept-feed.service.ts
autonomous: true
gap_closure: true
scope_note: "2 tasks fixing 2 fresh-install UX bugs surfaced during Plan 38-03 device UAT. Bug B is a 5-line deletion of seeded mock content; Bug A wires LOCALE_CHANGED to invalidate stale cached textArtContent so welcome-post text-art regenerates in the user's actual locale. Both are bisection-friendly atomic edits."
status: ready
created: 2026-05-09
---

# Plan 38-04 — Fresh-install bug fixes (gap closure)

## Objective

Close two pre-existing fresh-install UX bugs surfaced during Plan 38-03 device UAT:

- **Bug A** — STARTER_POSTS render Chinese text-art content under English locale because `textArtContent` is cached without a locale tag; once generated under one locale, subsequent locale changes do not invalidate the cached glyph content.
- **Bug B** — `flashcard.service.ts` seeds 5 hardcoded English mock flashcards on first launch (Marx / quantum / ML / thermodynamics). These were originally added so the Review screen had content before any LLM sessions; in v1.5's local-first personalized-learning framing they read as content the user never asked for.

Both bugs are pre-existing (not introduced by Phase 38 plans) but are blockers for clean fresh-install UX. Neither is in scope for any Phase 38 base plan.

## Background

**Bug A — text-art locale staleness:**

`generateTextArtContent` at `app/src/services/concept-feed.service.ts:622-682` runs lazily on cache-hit paths via `_backgroundGenerateTextArt` (line 588). It calls `chatCompletion` which routes through `applyLocaleDirective` (`app/src/providers/llm/locale-directive.ts:32`) — the directive injection IS happening correctly per its current implementation. The bug is that **the generated `textArtContent` is then persisted into the cache via `_persistStylesToCache` (line 599) without a locale tag**, and there is no subscriber to `LOCALE_CHANGED` (defined at `src/types/index.ts:676`) that clears the stale content.

Symptom: on a device where `detectInitialLocale` returns `zh` (e.g., Chinese system locale + no saved preference), text-art is generated in Chinese. User then completes onboarding and picks English; UI flips to English; but the previously-generated Chinese text-art remains cached and renders on every subsequent visit.

Fix shape: subscribe to `LOCALE_CHANGED` in concept-feed.service.ts and strip `textArtContent` from cached posts so the next render triggers `_backgroundGenerateTextArt` to regenerate under the new locale.

**Bug B — mock flashcard seeds:**

`makeSeedCards` at `app/src/services/flashcard.service.ts:15-54` returns 5 hardcoded English flashcards. `loadAll()` at line 61 persists them on first launch (`localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds))`). Verified: zero tests reference any seed by id (`fc-seed-1..5`) or by content (`grep -rn "fc-seed\|makeSeedCards\|dialectical materialism" app/tests/` → 0 hits). Clean to delete.

Fix shape: delete `makeSeedCards`, change `loadAll`'s first-launch branch to return `[]` (and skip the persist — no need to write an empty array).

## Tasks

<task type="auto">
  <name>Task 1: Remove mock flashcard seed data (Bug B)</name>
  <read_first>
    1. `/Users/Code/EchoLearn/app/src/services/flashcard.service.ts` — full file (200 lines). Confirm `makeSeedCards` is only referenced by `loadAll`'s first-launch branch (line 66).
    2. Confirm no test or other source file references `fc-seed-` ids or `makeSeedCards`:
       ```bash
       cd /Users/Code/EchoLearn && grep -rn "fc-seed\|makeSeedCards" app/src/ app/tests/ | grep -v "flashcard.service.ts"
       ```
       Expect: 0 lines. If any hit appears, STOP and surface it before editing.
  </read_first>
  <acceptance_criteria>
    1. `makeSeedCards` function deleted entirely (lines 13-54 region).
    2. `loadAll`'s first-launch branch returns `[]` instead of persisting seeds. Don't write the empty array to localStorage — no point.
    3. `cd app && npx tsc -b --noEmit` exits 0.
    4. `cd app && node --test tests/services/` runs without new flashcard-related failures.
    5. Verify file size dropped by ~40 lines.
  </acceptance_criteria>
  <action>
    Edit `app/src/services/flashcard.service.ts`:

    1. Delete the entire `makeSeedCards` function (lines 13-54), including the comment block at lines 13-14 (`// Seed cards shown on first launch...`).
    2. Modify `loadAll()`'s first-launch branch:
       ```typescript
       // BEFORE:
       function loadAll(): FlashCard[] {
         try {
           const raw = localStorage.getItem(STORAGE_KEY);
           if (!raw) {
             // First launch — persist seed cards so they show up in the review queue
             const seeds = makeSeedCards();
             localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
             return seeds;
           }
           return JSON.parse(raw) as FlashCard[];
         } catch {
           return [];
         }
       }

       // AFTER:
       function loadAll(): FlashCard[] {
         try {
           const raw = localStorage.getItem(STORAGE_KEY);
           if (!raw) return [];
           return JSON.parse(raw) as FlashCard[];
         } catch {
           return [];
         }
       }
       ```
    3. Run `cd app && npx tsc -b --noEmit` to verify clean.
    4. Run `cd app && node --test tests/services/flashcard.test.mjs 2>&1 | tail -20` if such a test exists; otherwise spot-check that no test imports `fc-seed-*` ids.
  </action>
  <verify>
    ```bash
    cd /Users/Code/EchoLearn
    # makeSeedCards is gone
    ! grep -q "makeSeedCards" app/src/services/flashcard.service.ts
    # No fc-seed references survive
    ! grep -q "fc-seed" app/src/services/flashcard.service.ts
    # Type check passes
    cd app && npx tsc -b --noEmit
    ```
  </verify>
  <commit>fix(38-04): remove hardcoded mock flashcard seeds (Bug B)

Eliminates 5 pre-canned English flashcards (dialectical materialism,
quantum entanglement, backpropagation, supervised vs unsupervised,
2nd law of thermodynamics) that loadAll() persisted on first launch.

Trellis is local-first personalized learning — seeded mock content
contradicts the model. New users start with an empty review queue
that fills as they ask questions.</commit>
</task>

<task type="auto">
  <name>Task 2: Invalidate cached text-art on LOCALE_CHANGED (Bug A)</name>
  <read_first>
    1. `/Users/Code/EchoLearn/app/src/services/concept-feed.service.ts` lines 1-50 (imports + STORAGE_KEY) and lines 580-690 (the existing `_backgroundGenerateTextArt`, `_persistStylesToCache`, and `generateTextArtContent` functions).
    2. `/Users/Code/EchoLearn/app/src/lib/event-bus.ts` (subscribe API shape).
    3. `/Users/Code/EchoLearn/app/src/types/index.ts:676` — confirm LOCALE_CHANGED payload shape.
    4. `/Users/Code/EchoLearn/app/src/state/useQuestions.ts:132` — reference for an existing `eventBus.subscribe('LOCALE_CHANGED', ...)` call shape.
  </read_first>
  <acceptance_criteria>
    1. A module-top-level `eventBus.subscribe('LOCALE_CHANGED', ...)` is added in `concept-feed.service.ts`.
    2. The handler reads the current cache via `loadCache()`, strips `textArtContent` from every post, and re-saves via `saveCache()`. Optionally also resets `_textArtBgRunning` so the next render path doesn't short-circuit.
    3. The handler is NOT called at module top level — it's installed via `eventBus.subscribe` at module import time and fires only on actual LOCALE_CHANGED emit.
    4. `cd app && npx tsc -b --noEmit` exits 0.
    5. `cd app && npm test` shows no new failures vs. the post-Plan-38-02 baseline (test:main 566/564/2 + test:actions 16/16/0).
    6. The fix self-heals: a user who has Chinese text-art cached and switches to English will see English text-art on the next swipe-for-more / next cold-boot once the regenerate completes.
  </acceptance_criteria>
  <action>
    Edit `app/src/services/concept-feed.service.ts`:

    1. Locate the existing `_persistStylesToCache` function (around line 599) to identify where to add the new handler. Add the LOCALE_CHANGED subscriber immediately AFTER `_persistStylesToCache` ends (around line 609, before the spreadByStyle comment block).

    2. Insert this block:
       ```typescript
       // Phase 38-04: invalidate cached textArtContent on locale change so welcome
       // posts (and any cached text-art posts) regenerate under the new locale.
       // Without this, text-art generated under one locale stays in the cache
       // forever and renders mismatched against the user's UI locale.
       eventBus.subscribe('LOCALE_CHANGED', () => {
         const cached = loadCache();
         if (!cached) return;
         const stripped = cached.posts.map(p => {
           if (p.presentationStyle !== 'text-art' || !p.textArtContent) return p;
           const { textArtContent: _drop, ...rest } = p;
           return rest as DailyPost;
         });
         saveCache({ ...cached, posts: stripped });
         _textArtBgRunning = false;
       });
       ```

    3. Verify `eventBus` is already imported at the top of the file. If not, add `import { eventBus } from '../lib/event-bus.ts';` to the import block.

    4. Run `cd app && npx tsc -b --noEmit` — expect exit 0.

    5. Run `cd app && npm test 2>&1 | tail -25` — confirm test:main and test:actions counts are unchanged from baseline (566/564/2 + 16/16/0).
  </action>
  <verify>
    ```bash
    cd /Users/Code/EchoLearn
    # Subscriber installed
    grep -q "eventBus.subscribe('LOCALE_CHANGED'" app/src/services/concept-feed.service.ts
    # Subscribed callback strips textArtContent
    grep -A 8 "eventBus.subscribe('LOCALE_CHANGED'" app/src/services/concept-feed.service.ts | grep -q "textArtContent"
    # Type check passes
    cd app && npx tsc -b --noEmit
    # Test baseline preserved
    cd app && npm test 2>&1 | tail -3
    ```
  </verify>
  <commit>fix(38-04): invalidate cached text-art on LOCALE_CHANGED (Bug A)

Welcome posts (STARTER_POSTS) and any other text-art posts cache
their generated glyph content via _persistStylesToCache. Pre-Phase-38-04,
that cache had no locale tag and no invalidation hook — text-art
generated under zh stayed in cache forever, even after the user
switched UI locale to en.

Subscribing to LOCALE_CHANGED and stripping textArtContent from cached
posts triggers _backgroundGenerateTextArt to regenerate on next render
under the new locale. Self-heals on next swipe-for-more / cold-boot.</commit>
</task>

## Definition of Done

- [ ] Task 1 committed: `makeSeedCards` deleted; `loadAll` returns `[]` on first launch; tsc green.
- [ ] Task 2 committed: LOCALE_CHANGED subscriber installed; tsc green; test baseline preserved.
- [ ] SUMMARY.md created at `.planning/phases/38-v1-4-carry-over-cleanup/38-04-fresh-install-bugs-SUMMARY.md` documenting both fixes + the device UAT path that surfaced them.
- [ ] STATE.md and ROADMAP.md updated to reflect Plan 38-04 complete.

## Manual Verification (folds back into Plan 38-03 UAT)

After both tasks land, the operator should:

1. **Bug B verify:** `localStorage.removeItem('trellis_flashcards')` in DevTools (or fresh install on a wiped device), reload app, navigate Review tab. Expect: empty review queue, no Marx/quantum/etc cards.
2. **Bug A verify:** Set device locale to Chinese, install fresh, complete onboarding picking English, observe welcome posts. Expect: text-art renders in English (may show "loading" briefly while regeneration completes). Optionally repeat in reverse: en device → switch to zh in Settings → text-art regenerates in zh on next visible swipe.

These are folded into the same 38-HUMAN-UAT.md device session — no separate UAT file needed.

## Plan Notes

- **Why no test for Bug A:** the regeneration path is async + LLM-driven; testing it deterministically requires mocking `chatCompletion` AND `eventBus`. The fix shape is small enough (10 lines) and the verify path is clear enough that a runtime test adds more maintenance burden than safety value. The structural assertion (subscriber exists + strips textArtContent) is covered by the verify grep checks in Task 2.
- **Why no test for Bug B:** removal of dead seed code — verifying the absence of seeds is by definition a non-test (no behavior to assert). The `! grep -q "fc-seed"` check covers the structural removal.
