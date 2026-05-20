---
phase: 53-engagement-guardrails-provider-privacy
plan: 03
subsystem: guardrails-tests
tags: [privacy, engagement-ethics, structural-test, negative-invariant]
requires: []
provides:
  - "PRIVACY-01 structural source-read guard (provider chokepoints + prompt call-sites)"
  - "LEARN-04 non-pushy negative-invariant guard"
affects:
  - "app/tests/providers/privacy-callsite-structural.test.mjs"
  - "app/tests/learn-04-no-pushy-mechanics.test.mjs"
tech-stack:
  added: []
  patterns:
    - "readFileSync + regex source-byte assertion (no source import) — mirrors llm-bracketing.test.mjs:214"
    - "negative-invariant guard with positive regression fixture — mirrors InfoFlow.video-tap-emit.test.mjs"
key-files:
  created:
    - app/tests/providers/privacy-callsite-structural.test.mjs
    - app/tests/learn-04-no-pushy-mechanics.test.mjs
  modified: []
decisions:
  - "D-07 reorg scoped exception encoded as JOURNAL_READERS_ALLOWED allowlist + soft positive co-occurrence assertion"
  - "concept-feed.service.ts engagement import permitted (getDismissedAnchorIds ID-filter); only liked/saved CONTENT leak shape banned"
  - "LEARN-04 regexes use word-boundary/specific constructs only — never bare /liked/ or /like/ — to avoid false positives on the allowed hidden engagement signal"
metrics:
  duration: "~10 min"
  completed: 2026-05-20
  tasks: 2
  files: 2
---

# Phase 53 Plan 03: Engagement Guardrails & Provider Privacy (Structural Guards) Summary

Two pure source-byte test files that lock the phase's structural guarantees with no runtime dependency: PRIVACY-01 (private user-data services never reach a provider payload) and LEARN-04 (no coercive engagement mechanics in `src/`).

## What Was Built

### Task 1 — PRIVACY-01 structural call-site assertion (`app/tests/providers/privacy-callsite-structural.test.mjs`)
- **Sub-test A:** four provider chokepoints (`providers/llm/index.ts`, `providers/llm/locale-directive.ts`, `providers/llm/user-content-bracketing.ts`, `providers/tts/index.ts`) asserted free of `engagement.service | collection.service | graph-edit-journal`.
- **Sub-test B (D-07 scoped exception):** `canonical-knowledge.service.ts` is the ONLY allowlisted graph-edit-journal reader (reorganizeMindmap / Phase 48 GRAPH-04). A soft positive assertion confirms `graphEditJournal` AND `reorganizeMindmap` co-occur so the exception stays anchored to the reorg function. The six other prompt-bearing call-sites are asserted free of `graph-edit-journal`. The verbatim D-07 rationale is documented in a comment block.
- **Sub-test C:** all prompt call-sites banned from `collection.service`; the five non-feed call-sites banned from `engagement.service`; `concept-feed.service.ts` permitted to import engagement.service for the `getDismissedAnchorIds()` ID-filter but banned from the leak shape `getLikedPosts | getSavedPosts | likedPosts`.
- 24 tests, all green. Reads source via `readFileSync` only — no source-module imports.

### Task 2 — LEARN-04 non-pushy negative-invariant guard (`app/tests/learn-04-no-pushy-mechanics.test.mjs`)
- Recursive `collectSourceFiles` walks `src/` collecting `*.ts`/`*.tsx`, skipping `node_modules`, `*.test.*`, `*.d.ts`.
- Five forbidden-construct `it()` blocks (word-boundary / phrase, case-insensitive): `\bstreak\b`, `\bleaderboard\b`, `stopCue|stop-cue|stop cue`, `dailyGoal|daily goal|mandatedGoal`, `publicLike|public like|likeCount|likesCount`. Each failure message cites the 2026-05-20 rescope rationale and lists offending file paths.
- One positive regression-guard suite asserting the allowed vocabulary (`liked`, `getLikedPosts`, `isLiked`, `likePost`, `trellisCreditsService`, `fruit_credits`, `confetti`, `dailyReadService`, `explored`) does NOT match any forbidden regex (D-06).
- 10 tests, all green. All forbidden counts are 0 in the current codebase.

## Verification

`cd app && node --test tests/providers/privacy-callsite-structural.test.mjs tests/learn-04-no-pushy-mechanics.test.mjs` → **34 tests, 34 pass, 0 fail**. Both files use only Node built-ins (`node:fs`, `node:path`, `node:test`, `node:assert`, `node:url`) — picked up automatically by `npm run test:main`. No packages installed (threat T-53-SC: accept).

## Deviations from Plan

None — plan executed exactly as written. Pre-flight verification confirmed every structural assumption (chokepoints clean, journal only in canonical-knowledge with `graphEditJournal`/`reorganizeMindmap` co-occurring, collection.service absent everywhere, engagement.service only in concept-feed as `getDismissedAnchorIds`, all five LEARN-04 forbidden counts = 0).

## Notes for Future Plans

- The LEARN-04 forbidden regexes carry the global (`g`) flag and are used statefully via `.test()`. Each regex instance is tested at most once per code path (once across `src/` files in the absence-scan via `.match()`, and once per allowed-fixture in the regression guard), so `lastIndex` advancement is not a hazard here. Adding a second `.test()` call against the same regex object in a loop would require resetting `lastIndex` or recreating the regex.
- D-07's allowlist is a single-file allowlist (`services/canonical-knowledge.service.ts`). If a future phase legitimately needs another journal reader, extend `JOURNAL_READERS_ALLOWED` AND document the new exception's rationale inline, mirroring the existing comment block.

## Commits

- `3aa52d0b` test(53-03): add PRIVACY-01 provider-callsite structural guard
- `4aa09e7e` test(53-03): add LEARN-04 non-pushy negative-invariant guard

## Self-Check: PASSED
- FOUND: app/tests/providers/privacy-callsite-structural.test.mjs
- FOUND: app/tests/learn-04-no-pushy-mechanics.test.mjs
- FOUND commit: 3aa52d0b
- FOUND commit: 4aa09e7e
