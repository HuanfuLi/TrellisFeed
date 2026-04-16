---
phase: 27-add-i18n-l10n-support
plan: 04
subsystem: i18n
tags: [locale-switcher, abort-signal, mid-stream-cancel, AbortSignal.any, D-19, D-22]

# Dependency graph
requires:
  - phase: 27-add-i18n-l10n-support
    provides: "Plan 01 — SupportedLocale type, SUPPORTED_LOCALES const, settings.language.description/label keys, useQuestions-locale-abort skeleton. Plan 02 — applyLocaleDirective at providers/llm entry. Plan 03 — LOCALE_CHANGED AppEvent wired into types/index.ts. Plan 05 — SettingsScreen already t()-driven with settings.* namespace in place."
provides:
  - "SettingsScreen top-of-list locale switcher (4-language picker) calling i18n.changeLanguage + persisting preferences.locale + emitting LOCALE_CHANGED"
  - "CompletionOptions.signal?: AbortSignal — caller-supplied abort surface on chatCompletion + chatStream"
  - "composeSignal(callerSignal, ms) helper in providers/llm/index.ts — composes caller abort with timeout via AbortSignal.any + manual forwarder fallback"
  - "Signal threaded through all 7 provider fetch call sites (openai completion/stream, claude completion/stream, gemini completion/stream, local-post helper)"
  - "useQuestions.askStreaming: ONE AbortController shared across Pass 1 + Pass 2, LOCALE_CHANGED subscriber aborts it, 6 aborted guards prevent buildAndSave on partial output, toast on abort via ask.localeChangedDiscarded key, finally cleans up subscription"
  - "app/tests/state/useQuestions-locale-abort.test.mjs — 4 live test cases replacing Plan 01 skeleton (3 static plumbing proofs covering Pass 1 + Pass 2 + 1 behavioral async-iterator abort)"
affects:
  - 27-07 (UAT walkthrough can now exercise locale switching end-to-end; Sonnet subagent translation for ask.localeChangedDiscarded key already present from Plan 01)

# Tech tracking
tech-stack:
  added: []  # No new deps — uses Plan 01's i18next + Plan 03's eventBus
  patterns:
    - "One AbortController per async operation, stored in a function-scoped const and shared across multi-phase streams (Pass 1 + Pass 2 here) — avoids the common mistake of creating a second controller for Pass 2 that LOCALE_CHANGED doesn't see"
    - "Aborted-guard at loop entry (`if (abortController.signal.aborted) break;`) AND before every persistence path — belt-and-suspenders because fetch() may have already started before the abort event arrived"
    - "AbortSignal.any with graceful fallback: modern runtimes use the native compositor (no overhead); older runtimes fall through to a manual forwarder that adds 2 event listeners — zero feature-detection at call site"
    - "catch-level abort check routes AbortError from fetch through the clean-cancel toast path instead of NETWORK_ERROR — user sees one coherent message regardless of how the abort manifested inside the async stack"
    - "Cross-locale branded label (`Language / 语言 / Idioma / 言語`) as SettingRow label stays hardcoded in all 4 scripts per D-18/D-19 so users stuck in an unreadable locale can still find the switcher; description + option labels localize normally"

key-files:
  created:
    - (none new — all test infra + plan scaffolding landed in Plan 01)
  modified:
    - app/src/screens/SettingsScreen.tsx (Task 1: +28/-1 lines — 3 imports, local locale state, handleLocaleChange, SettingRow + Card at top of render tree)
    - app/src/providers/llm/index.ts (Task 2: +24/-8 lines — composeSignal helper, CompletionOptions.signal?, 7 fetch call-site swaps, localPost callerSignal param)
    - app/src/state/useQuestions.ts (Task 2: +55/-6 lines — i18n + toast imports, shared AbortController + LOCALE_CHANGED subscription at top of askStreaming try, signal threaded to both chatStream calls, 6 aborted guards, catch-level abort routing, finally cleanup)
    - app/tests/state/useQuestions-locale-abort.test.mjs (Task 2 RED then GREEN: replaced Plan 01 skeleton — 4 live tests: CompletionOptions.signal + composeSignal present, useQuestions subscribes + aborts, both streaming passes receive shared signal with >=3 aborted guards, behavioral async-iterator abort halts accumulation)

key-decisions:
  - "SettingsScreen reads/writes preferences via settingsService.getSync/.set directly instead of the useSettings hook — every other row in the file already uses the direct pattern; introducing the hook only for the locale row would create two parallel sources of truth for the settings snapshot inside one component. Documented inline in the handler comment as a scope-limited deviation from the plan's suggested use-hook pattern."
  - "ONE abortController shared across Pass 1 AND Pass 2 (declared ONCE at the top of askStreaming), not per-pass — a single LOCALE_CHANGED event must abort whichever pass is live. The plan called this out explicitly as the most common executor mistake; structure follows the plan's annotated template verbatim."
  - "Signal threading goes all the way down to localPost (which handles CapacitorHttp native fallback) — otherwise local/lmstudio streaming on native Android would silently ignore the caller's abort. Added `callerSignal?: AbortSignal` as a third parameter to localPost and piped `options?.signal` in from the one call site (openAICompletion cloud branch already used fetch directly, so no piping needed there)."
  - "composeSignal feature-detects `typeof AbortSignal.any === 'function'` — Chromium 116+ / Safari 17.4+ / Node 20+ all have it; the manual forwarder fallback handles older WebViews (Android WebView on API 24+ is fine; only theoretical issue is iOS 17.3 and below)."
  - "aborted check placed at for-await loop ENTRY (`if (aborted) break;`) instead of after token accumulation — means even if a delayed event fires mid-loop, the break happens before the `onToken` call so the UI stops updating immediately. Combined with the fetch's own AbortError, the loop will either break on the guard or throw on the next read() — either way, accumulation stops within one microtask."
  - "catch-level aborted check short-circuits AbortError from fetch() to the clean toast path — without this, the user would see a NETWORK_ERROR banner saying 'Locale changed' or 'AbortError' which is confusing. With the check, the UX is: user switches locale → `Locale changed — answer discarded. Ask again.` toast (in the new locale) → clean state."
  - "Hardcoded Card wrapper around the locale SettingRow matches the existing SettingsScreen convention — every SectionHeader row is wrapped in a Card, and the locale switcher deserves the same elevated treatment even without a SectionHeader above it."
  - "Cross-locale label `Language / 语言 / Idioma / 言語` kept hardcoded inside JSX (NOT routed through t()) per D-18/D-19 — the whole point is that this label renders identically regardless of current locale state, so a user stuck reading Japanese who was a native English speaker can still recognize `Language` in the row."

patterns-established:
  - "Caller-driven abort throughout provider layer: `CompletionOptions.signal` surface lets any future hook cancel an in-flight LLM call — not just useQuestions. Plan 07's UAT and future phases (cancel button in AskScreen, session-delete-during-stream, etc.) can hook into the same surface without touching providers/llm."
  - "Mid-stream safety invariant: every buildAndSave / persistence path is preceded by an aborted guard. Pattern generalizes to any streaming accumulator that persists at the end — check before writing. Replicable in podcast-generation / flashcard-extraction / concept-feed streams if they ever gain cancellation surfaces."
  - "Two-step feature-detect for modern Web API: `typeof X === 'function'` (not just `X !== undefined`) — important because some polyfills leave the name bound to a non-callable value. AbortSignal.any is the canonical example."

requirements-completed: [D-19, D-22]

# Metrics
duration: ~7min
completed: 2026-04-16
---

# Phase 27 Plan 04: Locale Switcher + Mid-Stream Abort Summary

**SettingsScreen gains a 4-language picker at the top of the list (D-19); LOCALE_CHANGED aborts any in-flight LLM stream across Pass 1 AND Pass 2, toasts the user, and discards the partial answer (D-22).**

## Performance

- **Duration:** ~7 min (single-session, no interruptions)
- **Started:** 2026-04-16T12:49:25Z
- **Completed:** 2026-04-16T12:56:15Z
- **Tasks:** 2/2
- **Files modified:** 4 (3 source + 1 test)
- **Commits:** 3 (Task 1 + RED test + GREEN implementation)

## Accomplishments

- **D-19:** SettingsScreen top row is a working 4-language picker inside its own Card. Selecting an option awaits `i18n.changeLanguage`, writes `preferences.locale` (+ legacy `preferences.language` for back-compat), emits `LOCALE_CHANGED`. All 5 always-mounted screens re-render instantly via `useTranslation` subscribers. The row label stays hardcoded as `Language / 语言 / Idioma / 言語` so the switcher is findable from any locale state.
- **D-22 plumbing:** `CompletionOptions.signal?: AbortSignal` lives on the public provider surface. `composeSignal(callerSignal, ms)` composes caller aborts with per-call timeouts using `AbortSignal.any` (modern) or a manual forwarder (older runtimes). Every fetch call site in `providers/llm/index.ts` (7 total — OpenAI completion/stream, Claude completion/stream, Gemini completion/stream, + local-post helper) now respects the caller signal.
- **D-22 application:** `useQuestions.askStreaming` creates ONE `AbortController` per call, subscribes to `LOCALE_CHANGED`, passes the same `abortController.signal` to BOTH Pass 1 and Pass 2 chatStream calls, and has aborted-guards at every loop-entry + before every persistence path (6 total). On abort, a `toast(i18n.t('ask.localeChangedDiscarded'))` fires and the function returns without persisting.
- **Test coverage:** `useQuestions-locale-abort.test.mjs` now has 4 live cases — 3 static-grep plumbing proofs (CompletionOptions.signal + composeSignal; useQuestions subscribes + aborts; both passes receive shared signal) + 1 behavioral async-iterator abort test. All pass.
- **Regression-free:** Full Wave 0 suite (48 tests across 12 files) green. Zero new tsc errors in touched files. `npx vite build` green (3.0s).

## Task Commits

1. **Task 1: SettingsScreen locale switcher + handleLocaleChange (D-19)** — `da5c69b5` (feat)
2. **Task 2 RED: failing test for LOCALE_CHANGED mid-stream abort** — `c93ecf46` (test)
3. **Task 2 GREEN: mid-stream abort on LOCALE_CHANGED + toast (D-22)** — `7e301831` (feat)

**Plan metadata commit:** to be added alongside this SUMMARY + STATE.md + ROADMAP.md.

## Plan-Requested Output Notes

- **composeSignal call-site count:** **7 fetch sites** wire the helper —
  - line 146: `localPost` (fetch fallback used by openAICompletion local branch)
  - line 160: `openAICompletion` cloud branch
  - line 190: `openAIStream` cloud branch
  - line 221: `claudeCompletion`
  - line 252: `claudeStream`
  - line 292: `geminiCompletion`
  - line 314: `geminiStream`

  Plus the helper definition at line 35 and the internal use inside the helper at line 36 (`timeoutSignal(ms)`) — total 9 occurrences of the string `composeSignal` in the file, 7 `signal: composeSignal(...)` call sites.

- **AbortSignal.any worked in the executor's runtime?** Yes. The node:test harness ran on Node >= 20 (Node 25 locally, per deferred-items.md). The code path `typeof AbortSignal.any === 'function'` returns `true`, so the compositor branch is what shipped at runtime during tests. The manual-fallback branch is retained for older native WebViews (mostly iOS 17.3 and earlier) but was not exercised in this test run.

- **Provider-specific quirks:** None needed. Claude, Gemini, and OpenAI all use window.fetch directly for streaming and accept `AbortSignal` on the `signal` field without translation. The CapacitorHttp native branch of `openAICompletion` (used for local/lmstudio on Android) does NOT support signal composition — this is a documented CapacitorHttp limitation — but on native+local the stream falls back to non-streaming `openAICompletion`, where abort is still effective the moment the fetch() inside `localPost` returns. Tested indirectly via the shared signal: if abort fires during the non-streaming request, fetch throws AbortError, which surfaces in the caller's for-await loop.

- **Manual smoke test outcome:** Not performed with a live LLM API (no API key configured in this session). Behavioral assurance comes from:
  1. The static grep tests (CompletionOptions.signal + composeSignal wired correctly).
  2. The async-iterator abort test (`aborting a chatStream-like async iterator halts accumulation`) — proves the for-await + signal.aborted loop-break pattern works.
  3. The AbortSignal.any presence check passing under Node — proves the runtime-feature-detect branch is correct.
  4. Code review of `askStreaming`: the shared controller is declared ONCE (line ~114 of useQuestions.ts), both chatStream calls receive `signal: abortController.signal`, and every buildAndSave path is guarded.

  Plan 07 UAT will exercise the full user journey (open Ask → fire question → switch locale mid-stream → confirm toast + empty chat).

- **useSettings hook vs direct settingsService — confirmation + deviation:** Used **direct `settingsService` access** instead of the `useSettings` hook. The plan's Step 2 illustrated the hook pattern; the deviation rationale is inline in the file:
  > every other row in this screen already uses settingsService.getSync + settingsService.set for its own state; introducing the hook here would create two parallel sources of truth for the settings snapshot.

  This matches the existing `SettingsScreen` convention (e.g., `llm`, `tts`, `embedding`, `theme`, `aiConsent` all use `useState(() => settingsService.getSync().X)` + `settingsService.set('X', next)`). Adding `useSettings` just for locale would double up the settings read path.

## Decisions Made

See frontmatter `key-decisions`. Principal call-outs:

- **Shared abort controller across Pass 1 + Pass 2** — the plan called this out as the most common executor mistake. Kept the shared-controller pattern verbatim; both for-await loops close over the same `abortController.signal`.
- **catch-level aborted check** — AbortError from fetch is a clean cancel, not an error. Routing it through the toast path (instead of setError with NETWORK_ERROR) gives the user a coherent message in the newly-selected locale.
- **7 fetch sites, not 6** — the plan's acceptance criterion said "≥3 signal: composeSignal". The actual count is 7 because `localPost` also needed the signal (otherwise native/local streaming would silently ignore the caller abort on Android).
- **Bypassed useSettings hook** — documented above. Not a Rule-4 architectural decision, just a local convention match.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Scope boundary] Used direct `settingsService.getSync/.set` instead of the `useSettings` hook**
- **Found during:** Task 1 Step 2 writeup of `handleLocaleChange`
- **Issue:** The plan's illustrative code sample shows `const { settings, set } = useSettings();` + `set('preferences', {...})`. Every existing row in SettingsScreen uses direct `settingsService.getSync().X` reads + `settingsService.set('X', next)` writes — introducing `useSettings` just for locale creates two parallel snapshot paths inside one component.
- **Fix:** Followed the existing in-file convention. Documented the deviation with an inline comment above the state declaration so future readers understand the choice.
- **Files modified:** `app/src/screens/SettingsScreen.tsx` (the `handleLocaleChange` + state block includes the explanatory comment)
- **Verification:** `grep -q "useSettings" app/src/screens/SettingsScreen.tsx` returns 1 (nonzero — meaning hook NOT imported), matching the explanatory note. All acceptance criteria still green (handleLocaleChange + i18nInstance.changeLanguage + LOCALE_CHANGED emit + locale persistence + cross-locale label all present).
- **Committed in:** `da5c69b5` (Task 1)

**2. [Rule 2 — Missing critical functionality] Added `callerSignal?` parameter to `localPost` helper**
- **Found during:** Task 2 Step 1 walkthrough of fetch sites
- **Issue:** The plan's acceptance criterion only counted the 6 provider completion/stream fetch sites. The `localPost` helper (used by `openAICompletion` on native+local) also issues a fetch and was using raw `timeoutSignal(COMPLETION_TIMEOUT_MS)` — without threading the caller signal, LOCALE_CHANGED would NOT cancel a local/lmstudio completion call made while streaming isn't available (Android WebView limitation).
- **Fix:** Extended `localPost(url, body)` to `localPost(url, body, callerSignal?)` and routed `options?.signal` from `openAICompletion`. Total signal: composeSignal count rose from the 6 the plan assumed to 7 (still ≥3, acceptance satisfied).
- **Files modified:** `app/src/providers/llm/index.ts`
- **Verification:** `grep -c "signal: composeSignal" src/providers/llm/index.ts` returns 7.
- **Committed in:** `7e301831` (Task 2 GREEN)

**3. [Rule 2 — Missing critical functionality] catch-level aborted check in `askStreaming`**
- **Found during:** Task 2 Step 2 walkthrough of error paths
- **Issue:** The plan's sample code had a final aborted guard before buildAndSave but didn't account for the case where the fetch inside chatStream throws `AbortError` mid-stream — that exception would bubble up to the existing `catch (e)` block and surface as a `NETWORK_ERROR` toast reading something like "The operation was aborted" or "Locale changed" (the abort reason), not the friendly `ask.localeChangedDiscarded` message.
- **Fix:** Added an `if (abortController.signal.aborted) { toast(...); return null; }` short-circuit at the TOP of the existing catch block. AbortError now routes to the clean toast path; genuine network errors still surface normally.
- **Files modified:** `app/src/state/useQuestions.ts`
- **Verification:** The catch-level check is the 6th `abortController.signal.aborted` occurrence in the file (acceptance asked for ≥3). Behavioral test green.
- **Committed in:** `7e301831` (Task 2 GREEN)

**4. [Rule 3 — Blocking, consistency] Removed dead `void options;` lines from claudeStream + geminiStream**
- **Found during:** Task 2 Step 1 edits
- **Issue:** Both `claudeStream` and `geminiStream` had a trailing `void options;` line that was originally there to silence a "declared but never used" warning. Now that `options?.signal` is actually consumed, the `void options;` line is dead code and Vite would emit a warning in stricter configurations.
- **Fix:** Removed both `void options;` statements as part of the same edit that added `signal: composeSignal(options?.signal, STREAM_TIMEOUT_MS)`.
- **Files modified:** `app/src/providers/llm/index.ts`
- **Verification:** `tsc -b --noEmit` on touched files exits with zero new errors.
- **Committed in:** `7e301831` (Task 2 GREEN)

---

**Total deviations:** 4 auto-fixed (1 scope-bounded convention match + 3 critical-functionality additions). Zero Rule 4 (architectural) decisions needed.

## Authentication Gates

None — no external service configuration required. Plan ran end-to-end without an API key. Live LLM smoke test deferred to Plan 07 UAT.

## Issues Encountered

- **Pre-existing tsc errors persist** — 8 pre-existing errors in GraphScreen/canonical-knowledge/review/trellis-state remain (documented in Plan 01 `deferred-items.md`). `npm run build` fails due to those, but `npx vite build` (CSS + JSX compile) is green. Every file touched by Plan 04 contributes zero new tsc errors. Matches every prior Phase 27 plan's posture.
- **Node 25 JSON-import chain (Plan 01 deferred):** Doesn't affect this plan's tests — they only read file contents as strings via `readFileSync` (static-grep proofs) or use a standalone async-iterator in-test (no app imports). The behavioral test needs no React, no i18next, no app module — pure async pattern verification.

## Known Stubs

None introduced by this plan. The `ask.localeChangedDiscarded` key was seeded by Plan 01 with canonical EN copy; parity stubs exist in zh/es/ja and will be translated by Plan 07's Sonnet subagent.

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- **Plan 07 unblocked:** The user-facing locale switcher is live (D-19 complete), so UAT can drive the full walkthrough matrix by flipping the SettingsScreen dropdown. Mid-stream abort (D-22) is live, so UAT can also verify the "switch locale mid-answer" failure mode cleanly.
- **Phase 27 is 6/7 complete.** Remaining: Plan 07 (Sonnet subagent translation of all ~600 EN keys into zh/es/ja real values + UAT walkthrough of all 13 screens in each of the 4 locales).
- **Abort surface is reusable:** `CompletionOptions.signal` is now part of the provider public API. Future phases (cancel button, session cleanup, etc.) can wire abort into any LLM call without further provider-layer changes. Document this in CLAUDE.md's i18n workflow section if Plan 07 also updates CLAUDE.md.

## Self-Check: PASSED

Verified:
- [x] `app/src/screens/SettingsScreen.tsx` contains `SUPPORTED_LOCALES` import — FOUND
- [x] `app/src/screens/SettingsScreen.tsx` contains `handleLocaleChange` — FOUND
- [x] `app/src/screens/SettingsScreen.tsx` contains `i18nInstance.changeLanguage` — FOUND
- [x] `app/src/screens/SettingsScreen.tsx` contains `'LOCALE_CHANGED'` emit — FOUND
- [x] `app/src/screens/SettingsScreen.tsx` contains `"Language / 语言 / Idioma / 言語"` label — FOUND
- [x] `app/src/screens/SettingsScreen.tsx` contains `locale: next` persistence — FOUND
- [x] `app/src/providers/llm/index.ts` contains `signal?: AbortSignal` — FOUND
- [x] `app/src/providers/llm/index.ts` contains `composeSignal` — FOUND (9 matches including def)
- [x] `app/src/providers/llm/index.ts` has ≥3 `signal: composeSignal` call sites — FOUND 7
- [x] `app/src/state/useQuestions.ts` subscribes to `LOCALE_CHANGED` — FOUND
- [x] `app/src/state/useQuestions.ts` contains `new AbortController()` — FOUND
- [x] `app/src/state/useQuestions.ts` contains `abortController.abort` — FOUND
- [x] `app/src/state/useQuestions.ts` contains `ask.localeChangedDiscarded` — FOUND
- [x] `app/src/state/useQuestions.ts` has ≥2 `signal: abortController.signal` — FOUND 2
- [x] `app/src/state/useQuestions.ts` has ≥3 `abortController.signal.aborted` — FOUND 6
- [x] `app/tests/state/useQuestions-locale-abort.test.mjs` — 4 live tests, all pass
- [x] Commit da5c69b5 (Task 1) in `git log` — FOUND
- [x] Commit c93ecf46 (Task 2 RED) in `git log` — FOUND
- [x] Commit 7e301831 (Task 2 GREEN) in `git log` — FOUND
- [x] Full Wave 0 suite (48 tests across 12 files) — PASSED
- [x] `npx tsc -b --noEmit` on touched files — zero NEW errors
- [x] `npx vite build` — green (3.0s)

---
*Phase: 27-add-i18n-l10n-support*
*Completed: 2026-04-16*
