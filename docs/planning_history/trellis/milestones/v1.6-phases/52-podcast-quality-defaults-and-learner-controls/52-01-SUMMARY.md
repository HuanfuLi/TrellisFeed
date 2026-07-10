---
phase: 52-podcast-quality-defaults-and-learner-controls
plan: 01
subsystem: podcast
tags: [typescript, types, leaf-module, prompt-assembly, cache-invalidation, podcast, node-test, tdd, wave-0]

# Dependency graph
requires:
  - phase: 27-add-i18n-l10n-support
    provides: i18n leaf-module pattern (no JSON / no lib/date / no react-i18next imports for modules tested under node --test); SupportedLocale type
  - phase: 50-retrieval-and-library-foundation
    provides: reinforcement of leaf-service rule (D-03) for new services tested under node --test
provides:
  - PodcastLength enum (brief / standard / deep / extended per D-01)
  - PodcastStyle enum (focused / conversational / review per D-02)
  - PodcastOptions interface (length + style)
  - Additive optional fields on DailyPodcast (options?, optionsHash?), PodcastSettings (defaultLength?, defaultStyle?), TTSConfig (model?) — no migration helper per operator rule
  - app/src/services/podcast-prompt.ts leaf module exporting buildPodcastPrompt (5-section + coverage prompt assembly) and computeOptionsHash (deterministic cache key)
  - Wave-0 test files establishing the Nyquist contract for Waves 1 + 2
affects:
  - phase: 52-podcast-quality-defaults-and-learner-controls (Plans 52-02 and 52-03 implement against this type surface + leaf-module API; the cross-plan source-read tests turn green when those plans land)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bounded-enum option types for podcast generation (PodcastLength × PodcastStyle = 12 combos)"
    - "Leaf-module discipline: pure prompt assembly with type-only imports, no JSON / lib-date / react-i18next"
    - "Deterministic options-hash cache key via JSON.stringify with sorted conceptIds + locale + length + style"
    - "Nyquist test contract: prompt tests green now; cross-plan source-read tests deliberately RED as work signals for downstream plans"
    - "Additive optional field rule: ?: + read-site fallback, NO normalize() / migration helper"

key-files:
  created:
    - app/src/services/podcast-prompt.ts
    - app/tests/services/podcast-prompt.test.mjs
    - app/tests/services/podcast-options.test.mjs
    - app/tests/screens/PodcastScreen.options.test.mjs
  modified:
    - app/src/types/index.ts

key-decisions:
  - "Locked PodcastLength enum to four members (brief / standard / deep / extended) per D-01; extended adds commute-friendly long-form at ~750 words / ~5 minutes."
  - "Locked PodcastStyle enum to three members (focused / conversational / review) per D-02; conversational is the default closest to existing behavior."
  - "Leaf module uses quoted property keys ('brief', 'standard', 'deep', 'extended') in LENGTH_MAP and STYLE_MAP so the source-read invariant `grep -oE \"'brief'|'standard'|'deep'|'extended'\" | sort -u | wc -l` returns 4 as required by Task 2 acceptance criteria."
  - "computeOptionsHash uses plain JSON.stringify with sorted conceptIds; not a security primitive, just a local cache invalidation key (Claude's Discretion in 52-CONTEXT.md)."
  - "Symlinked worktree app/node_modules to main repo's app/node_modules so npx tsc and node --test resolve dependencies; node_modules is in .gitignore so no commit impact."

patterns-established:
  - "BASE + SECTION + LENGTH_MAP[length] + STYLE_MAP[style] + COVERAGE assembled with '\\n\\n' join into the system prompt; user prompt holds the concept-lines payload."
  - "COVERAGE_CONSTRAINT is a byte-stable literal containing 'MUST mention every concept' — guarded by /MUST mention every concept/i case-insensitive regex in the prompt test."
  - "Cross-plan source-read invariants land in Wave 0 as RED tests so each downstream plan has a green-target work signal; no describe.skip / it.skip."

requirements-completed: [PODCAST-01, PODCAST-02, PODCAST-04]

# Metrics
duration: 6min
completed: 2026-05-19
---

# Phase 52 Plan 01: Podcast Quality Defaults and Learner Controls Summary

**Type contracts + leaf prompt module establishing the four-length × three-style bounded enum surface and the deterministic options-hash cache key, plus three Wave-0 test files that turn red/green according to the planner's Nyquist contract for downstream waves.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-19T17:33:21Z
- **Completed:** 2026-05-19T17:39:11Z
- **Tasks:** 3
- **Files modified:** 1
- **Files created:** 4

## Accomplishments

- Added `PodcastLength`, `PodcastStyle`, `PodcastOptions` to `app/src/types/index.ts` plus additive optional fields on `DailyPodcast`, `PodcastSettings`, `TTSConfig` — all `?:`, no migration helper (operator's no-normalize rule preserved; baseline `normalize` count stays at 0).
- Created `app/src/services/podcast-prompt.ts` as a true leaf module: type-only import from `../types`, no JSON / `../lib/date` / `react-i18next` imports. Exposes `buildPodcastPrompt(conceptLines, options)` (5-section + coverage prompt assembly) and `computeOptionsHash(conceptIds, locale, options)` (sorted-conceptIds JSON-string cache key).
- Wrote three Wave-0 test files that pass/fail exactly per the planner's Nyquist contract: prompt tests fully green, options tests partially red, screen tests fully red. Each RED test names exactly one piece of work the downstream plan must do.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add PodcastLength + PodcastStyle + PodcastOptions types and additive optional fields** — `6eb23ea4` (feat)
2. **Task 2: Create podcast-prompt.ts leaf module + prompt + options tests** — `7b355a3f` (feat)
3. **Task 3: Create PodcastScreen.options.test.mjs source-reading invariants + 4-locale podcast.options namespace check** — `9b5b7a66` (test)

## Files Created/Modified

- `app/src/types/index.ts` — Added `PodcastLength` / `PodcastStyle` / `PodcastOptions` exports; extended `DailyPodcast` with `options?` and `optionsHash?`; extended `PodcastSettings` with `defaultLength?` and `defaultStyle?`; extended `TTSConfig` with `model?`.
- `app/src/services/podcast-prompt.ts` — New leaf module: BASE_INSTRUCTION + SECTION_INSTRUCTION (RECAP / CONNECTIONS / MISCONCEPTION CHECK / RETRIEVAL QUESTIONS / NEXT ACTION) + COVERAGE_CONSTRAINT + LENGTH_MAP (4 entries with 150/225/450/750-word targets) + STYLE_MAP (3 entries); exports `buildPodcastPrompt` and `computeOptionsHash`.
- `app/tests/services/podcast-prompt.test.mjs` — 21 tests, all GREEN at end of Wave 0: leaf-module rule (4 tests), 12 length×style matrix coverage tests, 4 word-count tests, 1 coverage substring test.
- `app/tests/services/podcast-options.test.mjs` — 9 tests, 5 GREEN + 4 RED at end of Wave 0: hash determinism passes; cross-plan source-read invariants on `podcast.service.ts` fail intentionally (signature, cache-key check, leaf import, fallback literals) — Plan 52-02 work signal.
- `app/tests/screens/PodcastScreen.options.test.mjs` — 19 tests, all RED at end of Wave 0: 8 PodcastScreen.tsx source-reads + 11 locale-bundle parity assertions across en/zh/es/ja — Plan 52-03 work signal.

## Public Surface (Plan 52-01 Output)

### Type exports (app/src/types/index.ts)

```typescript
export type PodcastLength = 'brief' | 'standard' | 'deep' | 'extended';
export type PodcastStyle = 'focused' | 'conversational' | 'review';
export interface PodcastOptions { length: PodcastLength; style: PodcastStyle; }
```

Additive optional fields:

- `DailyPodcast.options?: PodcastOptions` and `.optionsHash?: string`
- `PodcastSettings.defaultLength?: PodcastLength` and `.defaultStyle?: PodcastStyle`
- `TTSConfig.model?: string` (default `'tts-1'`, opt-in `'tts-1-hd'`)

### Leaf-module exports (app/src/services/podcast-prompt.ts)

```typescript
export function buildPodcastPrompt(
  conceptLines: string,
  options: PodcastOptions,
): { system: string; user: string };

export function computeOptionsHash(
  conceptIds: string[],
  locale: SupportedLocale,
  options: PodcastOptions,
): string;
```

`LENGTH_MAP` key set: `'brief' | 'standard' | 'deep' | 'extended'` (4 entries).
`STYLE_MAP` key set: `'focused' | 'conversational' | 'review'` (3 entries).
`COVERAGE_CONSTRAINT` byte-stable literal: `'IMPORTANT: You MUST mention every concept listed below. Do not skip any. Coverage is non-negotiable; depth scales with the length target.'` — guarded by `/MUST mention every concept/i`.

## Test Status (matches plan's <verification> contract)

| File | Total | Pass | Fail | Status |
| --- | --- | --- | --- | --- |
| `tests/services/podcast-prompt.test.mjs` | 21 | 21 | 0 | GREEN (Wave 0 complete) |
| `tests/services/podcast-options.test.mjs` | 9 | 5 | 4 | PARTIALLY RED (Plan 52-02 target) |
| `tests/screens/PodcastScreen.options.test.mjs` | 19 | 0 | 19 | RED (Plan 52-03 target) |
| `tests/locales/bundle-parity.test.mjs` | 2 | 2 | 0 | GREEN (no new keys yet) |

`npx tsc -b --noEmit` exits 0.

## Decisions Made

- **Quoted property keys in LENGTH_MAP / STYLE_MAP.** The acceptance criterion required all four length keys to appear as quoted string literals (`grep -oE "'brief'|'standard'|'deep'|'extended'" | sort -u | wc -l` must return 4). Switched the Record from bare identifiers to quoted keys so the grep matches without changing runtime semantics — TypeScript treats `{ brief: ... }` and `{ 'brief': ... }` identically here.
- **Followed plan's no-normalize rule strictly.** Baseline `normalize` count in `types/index.ts` was 0 and stayed 0 — only added `?:` fields with read-site fallback deferred to Plans 52-02 and 52-03.
- **Locked the COVERAGE_CONSTRAINT literal.** Chose `'IMPORTANT: You MUST mention every concept listed below. Do not skip any.'` so the substring `MUST mention every concept` is byte-stable and the case-insensitive regex `/MUST mention every concept/i` matches per planner's contract.

## Deviations from Plan

None — plan executed exactly as written. Both task verification commands ran clean and every acceptance-criterion grep / test count matched.

## Issues Encountered

- **`npx tsc` ran the wrong binary at first.** The worktree didn't have a local `node_modules` (Claude Code worktrees are bare git checkouts), so `npx` resolved `tsc` from a parent directory's hoisted install that wasn't TypeScript. Resolved by symlinking `app/node_modules` to the main repo's `app/node_modules`: `ln -s /Users/Code/EchoLearn/app/node_modules /Users/Code/EchoLearn/.claude/worktrees/agent-aad6ad36f4c7b318a/app/node_modules`. `node_modules` is gitignored so the symlink doesn't enter the commit history. No source changes.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 52-02 unblocked.** The type surface (`PodcastLength`, `PodcastStyle`, `PodcastOptions`) and leaf-module API (`buildPodcastPrompt`, `computeOptionsHash`) are committed and importable. The four RED tests in `podcast-options.test.mjs` enumerate exactly the four changes 52-02 must land in `podcast.service.ts`:
  1. Extend `generatePodcast` signature to `(date, conceptIds?, options?: PodcastOptions)`.
  2. Add `existing.optionsHash === computeOptionsHash(...)` to the cache-skip condition.
  3. Replace the inline 90-second prompt literal with `buildPodcastPrompt(...)` from `./podcast-prompt`.
  4. Add read-site fallback literals `'standard'` and `'conversational'` (resolving `options?.length ?? settings.podcast.defaultLength ?? 'standard'` etc.).

- **Plan 52-03 unblocked.** `PodcastScreen.options.test.mjs` enumerates 8 source-reads + 12 locale-parity assertions across en/zh/es/ja. The screen wiring + i18n bundles land in 52-03.

- **No regressions.** `bundle-parity.test.mjs` still 2/2 green. No load-bearing rules in CLAUDE.md were touched.

## Self-Check: PASSED

- `app/src/types/index.ts` exists with all required exports: `PodcastLength`, `PodcastStyle`, `PodcastOptions` (verified via grep).
- `app/src/services/podcast-prompt.ts` exists with `buildPodcastPrompt` + `computeOptionsHash` exports and zero forbidden imports (verified via grep).
- `app/tests/services/podcast-prompt.test.mjs` exists and passes 21/21.
- `app/tests/services/podcast-options.test.mjs` exists and runs 5 green / 4 RED per plan.
- `app/tests/screens/PodcastScreen.options.test.mjs` exists and runs 0 green / 19 RED per plan.
- Commit `6eb23ea4` (Task 1) exists in `git log` (verified).
- Commit `7b355a3f` (Task 2) exists in `git log` (verified).
- Commit `9b5b7a66` (Task 3) exists in `git log` (verified).
- `npx tsc -b --noEmit` exits 0 (verified).

---
*Phase: 52-podcast-quality-defaults-and-learner-controls*
*Completed: 2026-05-19*
