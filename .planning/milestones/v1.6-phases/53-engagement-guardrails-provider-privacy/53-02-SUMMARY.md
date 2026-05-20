---
phase: 53-engagement-guardrails-provider-privacy
plan: 02
subsystem: privacy-testing
tags: [privacy, provider-payload, golden-tests, fetch-stub, PRIVACY-01]
requires:
  - "app/tests/helpers/memory-localstorage.mjs (makeMemoryLocalStorage) — Plan 53-01"
provides:
  - "app/tests/providers/privacy-payload-tts.test.mjs (TTS outbound payload privacy golden)"
  - "app/tests/providers/privacy-payload-llm.test.mjs (LLM outbound payload privacy golden, 3 providers)"
affects:
  - "Phase 53 Success Criterion 1 — provider-bound payload exclusion of private data"
tech-stack:
  added: []
  patterns:
    - "fetch-stub capture seam (JSON.parse(init.body) → captured) reused from tts-locale.test.mjs"
    - "Multi-shape union json() stub so openAI/claude/gemini readers all parse without throwing"
    - "Caller-installed localStorage shim BEFORE dynamic import of the module under test (53-01 ordering)"
    - "Non-vacuous capture assertion guards against false-green sentinel exclusion"
key-files:
  created:
    - "app/tests/providers/privacy-payload-tts.test.mjs"
    - "app/tests/providers/privacy-payload-llm.test.mjs"
  modified: []
decisions:
  - "D-03: payload goldens are the test-based half of tests-and-structural-assertion enforcement (no runtime scrubber)"
  - "D-04: goldens seed + assert exclusion of the full private field inventory — collections/tags, engagement saved/liked, graph correction logs"
  - "Single union json() stub serves all three LLM providers (avoids the OpenAI-only-stub uncaught-rejection on the claude sub-test, plan-checker WARNING 1)"
  - "Non-stream chatCompletion chosen over chatStream — the REQUEST body is the unit under test, keeping the response stub minimal"
metrics:
  duration: ~12m
  completed: 2026-05-20
  tasks: 2
  files: 2
---

# Phase 53 Plan 02: Provider payload privacy goldens Summary

Locks PRIVACY-01 with two fetch-stub golden tests proving private user data (tags/collections, engagement saved/liked, graph correction logs) never reaches the outbound TTS or LLM provider request body. Each golden seeds the three private localStorage keys with unique sentinels, installs the Plan 53-01 in-memory localStorage shim plus a fetch capture shim, drives the leaf provider chokepoint without a network call, and asserts the JSON-stringified captured request body contains none of the sentinels — backed by a non-vacuous capture assertion so the exclusion checks cannot pass trivially.

## What Was Built

Two `.test.mjs` goldens under `app/tests/providers/`, both modeled on the `tts-locale.test.mjs:27-54` fetch-stub seam:

- **`privacy-payload-tts.test.mjs`** — i18next preamble + `bindI18nLeaf` (so `synthesize`'s `resolveVoice` resolves a locale), installs `globalThis.localStorage = makeMemoryLocalStorage()` and seeds all three private keys, installs the fetch+`URL.createObjectURL` capture shim, dynamic-imports `synthesize` AFTER the shims, calls `synthesize('Recap of spaced repetition.', baseTtsConfig)`, then asserts `captured.input === text` (non-vacuous) and that the stringified body excludes `SECRET-TAG-SENTINEL`, `SECRET-ENGAGEMENT-SENTINEL`, `SECRET-JOURNAL-SENTINEL`.
- **`privacy-payload-llm.test.mjs`** — installs the same shim + the same three seeded sentinels, installs a fetch capture shim whose `json()` returns a UNION response shape (`choices`/`content`/`candidates`) parseable by all three provider readers without throwing, dynamic-imports `chatCompletion` AFTER the shims, and runs three sub-tests (openAI/claude/gemini) each with a provider-specific `LLMConfig`. Each sub-test asserts the benign user content IS present in the captured body (non-vacuous) and that none of the three sentinels appear.

Sentinels were shaped to match each service's real stored JSON: a collection `name` (`trellis_collections_v1`), `saved`/`liked` post ids (`trellis_engagement_v1`), and a rename `before`/`after` node title (`trellis_graph_edit_log`).

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | TTS payload privacy golden | 0629b265 | app/tests/providers/privacy-payload-tts.test.mjs |
| 2 | LLM payload privacy golden across openAI/claude/gemini | c3c16b81 | app/tests/providers/privacy-payload-llm.test.mjs |

## Verification

`node --test tests/providers/privacy-payload-tts.test.mjs tests/providers/privacy-payload-llm.test.mjs` → 4 tests pass, 0 fail (1 TTS test + 3 LLM provider sub-tests). Both acceptance-criteria sets satisfied:

- Both files seed all three keys with the exact sentinels `SECRET-TAG-SENTINEL`, `SECRET-ENGAGEMENT-SENTINEL`, `SECRET-JOURNAL-SENTINEL`.
- Non-vacuous capture assertions present (`captured.input` equals the text for TTS; benign user content present in body for each LLM provider).
- `globalThis.localStorage` installed via `makeMemoryLocalStorage()` BEFORE the dynamic import in both files.
- No import of `useQuestions`, `podcast.service`, `concept-feed.service`, or `canonical-knowledge.service`.
- Three LLM provider sub-tests run (openAI/claude/gemini appear in `it` descriptions).
- Confirmed `Capacitor.isNativePlatform()` is false under Node, so the cloud fetch path runs and is the path asserted (per plan interfaces note).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree had no `node_modules` to run the tests against**
- **Found during:** Task 1 verification.
- **Issue:** The worktree carries no `node_modules`; `node --test` (the project's `test:main` runner) could resolve `.ts` files via Node 26 native type-stripping but failed to resolve the bare `i18next` package import, so the goldens could not be executed in-place.
- **Fix:** Temporarily symlinked the main repo's `node_modules` (`ln -s /Users/Code/EchoLearn/app/node_modules ./node_modules`) into the worktree purely to execute the tests, then removed the symlink before staging. This is an environment fix, not a package install — no package was added and the symlink was not committed (verified `git status --short` showed only the two test files).
- **Files modified:** None committed; the symlink was transient and removed.
- **Commit:** N/A (verification-only environment fix).

This is expected per the orchestrator note: the goldens are picked up at wave merge by `npm run test:main` in the main repo where `node_modules` exists.

## Threat Surface

No new threat surface introduced. The plan's threat register is satisfied:
- **T-53-01 (mitigate)** — both goldens seed sentinel private data into all three protected keys and assert the captured outbound TTS + LLM (3-provider) bodies exclude them; non-vacuous capture assertions prevent false-green.
- **T-53-02 (transfer)** — structural source-read assertion is out of scope, deferred to Plan 53-03.
- **T-53-SC (accept)** — no packages installed; both files use only Node built-ins (`node:test`, `node:assert/strict`), `i18next` (already a project dep), and the in-repo Plan 53-01 shim.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: app/tests/providers/privacy-payload-tts.test.mjs
- FOUND: app/tests/providers/privacy-payload-llm.test.mjs
- FOUND: commit 0629b265
- FOUND: commit c3c16b81
