---
phase: 52-podcast-quality-defaults-and-learner-controls
plan: 05
subsystem: podcast
tags: [podcast, i18n, ui, gap-closure, uat]
requires:
  - 52-04   # podcast-view-model.ts (selection + render gates)
  - 52-06   # apiKeys?: additive LLMConfig field (untouched)
provides:
  - PodcastLength reduced to 3 presets (standard | deep | extended)
  - "Review" style display label (enum value unchanged)
  - collapsible Length & style config section, repositioned
affects:
  - app/src/types/index.ts
  - app/src/services/podcast-prompt.ts
  - app/src/screens/PodcastScreen.tsx
  - app/src/screens/settings/SettingsFeaturesScreen.tsx
  - app/src/locales/{en,zh,es,ja}.json
tech-stack:
  added: []
  patterns:
    - collapsible-section (ephemeral local UI state, no service read)
    - i18n EN-first 4-locale parity (configHeading added, brief removed)
key-files:
  created: []
  modified:
    - app/src/types/index.ts
    - app/src/services/podcast-prompt.ts
    - app/src/screens/PodcastScreen.tsx
    - app/src/screens/settings/SettingsFeaturesScreen.tsx
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json
    - app/tests/services/podcast-prompt.test.mjs
    - app/tests/services/podcast-options.test.mjs
    - app/tests/screens/PodcastScreen.options.test.mjs
decisions:
  - "D-01 revised by operator during UAT: 4 lengths → 3 (drop 'brief'). Operator is decision authority."
  - "'Review Drill' display label renamed to 'Review'; enum value 'review' unchanged to avoid data migration."
  - "Config panel is collapsed by default (low-frequency action) and repositioned below player/empty-state, above Knowledge Today."
metrics:
  duration: ~25m
  completed: 2026-05-19
  tasks: 3
  files: 11
---

# Phase 52 Plan 05: Podcast Length/Style GAP Closure Summary

Closed Phase 52 UAT GAP-1 and GAP-2: dropped the `brief` podcast length (operator revision of locked D-01), renamed the "Review Drill" style label to "Review", and converted the Length × Style config card into a collapsed-by-default collapsible section repositioned below the player/empty-state and above Knowledge Today.

## What Was Built

**GAP-1 (Task 1 + Task 2):**
- `PodcastLength` type reduced to `'standard' | 'deep' | 'extended'`. `LENGTH_MAP` (`Record<PodcastLength,string>`) tsc-enforced to exactly 3 keys after dropping the `brief` entry.
- `LENGTH_CHIPS` in PodcastScreen and the Settings → Features default-length dropdown both drop `brief`.
- All 4 locale bundles: `podcast.options.brief` key removed; `podcast.options.review` value renamed (en "Review", zh "复习", es "Repaso", ja "復習"). Key `review` itself unchanged.
- Wave-0 tests updated in lockstep: prompt matrix 4→3 lengths (12→9 combos), deleted the `brief` word-count assertion, swapped `brief` → `standard` in the options-hash and coverage tests, and removed `'brief'` from `REQUIRED_OPTION_KEYS`.

**GAP-2 (Task 3):**
- Added `showConfig` ephemeral local state (default `false`).
- Config card is now a collapsible section: a toggle header (`configHeading` label + ChevronDown/ChevronRight affordance) that reveals the Length + Style chip groups only when expanded.
- Repositioned: the config section now renders AFTER the player Card, empty/generate Card, and generating Card, and BEFORE the Knowledge Today block. Same gate (`isEmptyStateVisible || isPlayerVisible`) — exactly one config section in the JSX.
- Added `podcast.options.configHeading` to all 4 locale bundles to keep bundle-parity green.

## Integration with Upstream Waves

- 52-04's `podcast-view-model.ts` gating (`isEmptyStateVisible`, `isPlayerVisible`, `deriveSelectedPodcast` with no `podcasts[0]` fallback) was preserved. The collapse/reposition only changed the wrapping and position of the config JSX — chip onClick handlers, `selectedLength`/`selectedStyle` state, and the `isDirty`/Regenerate wiring are unchanged. No dual-render regression.
- 52-06's additive `apiKeys?` field on `LLMConfig`/`EmbeddingConfig` was left untouched while editing `PodcastLength` in the same `types/index.ts`.

## Deviations from Plan

None — plan executed as written. (Task 3's plan note about whether to add `configHeading` to the test's `REQUIRED_OPTION_KEYS` resolved to "no, rely on bundle-parity" per the plan's own guidance.)

## Deferred Issues (pre-existing, out of scope)

7 tests fail in the full suite, ALL unrelated to this plan's changes:
- `tests/services/trellis-replant.test.mjs` (3): replant date-bump assertions expect today `2026-05-19`, get `2026-05-18`.
- `tests/services/trellis-state.*` / SM-2 leaf-state tests (4): "Gap C penalty floors", "daysOverdue positive integer", "worst-child-wins", "anchor 14-day overdue → dead".

Root cause is an environmental UTC-vs-local date boundary (current UTC `2026-05-20T03:39Z`, local date `2026-05-19`) in trellis SM-2 date arithmetic — not touched by this plan (no trellis files modified). Per the SCOPE BOUNDARY rule these are not auto-fixed here. All podcast/i18n tests relevant to this plan pass.

## Verification Results

- `tsc -b --noEmit`: clean (exit 0).
- `bundle-parity.test.mjs` + `missing-key.test.mjs`: pass (identical key sets across 4 locales).
- `podcast-prompt.test.mjs`, `podcast-options.test.mjs`, `PodcastScreen.options.test.mjs`, `PodcastScreen.routeFilter.test.mjs`: pass (9-combo matrix, no `brief` refs).
- `podcast-view-model.test.mjs` (52-04 guard): green — no dual-render / `podcasts[0]` regression.
- Source order confirmed: player → empty-state → config section → Knowledge Today (BookOpen).

## Commits

- `44e1f75b` feat(52-05): drop 'brief' length, rename Review Drill to Review (GAP-1)
- `b5ea005b` test(52-05): update Wave-0 podcast tests to 3-length matrix (GAP-1)
- `a4036486` feat(52-05): collapsible config section repositioned below player (GAP-2)

## Self-Check: PASSED

All modified source files exist; all 3 task commits present in git log.
