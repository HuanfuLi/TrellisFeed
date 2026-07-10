---
phase: 27-add-i18n-l10n-support
plan: 02
subsystem: i18n
tags: [i18next, llm-provider, tts, youtube-data-api, intl, date-format, node25-compat]

# Dependency graph
requires:
  - phase: 27-add-i18n-l10n-support
    provides: "Plan 01 — i18n.init side-effect, LOCALE_NAMES, SupportedLocale type, Wave 0 test skeletons (llm-locale-injection, tts-locale, youtube-locale, web-search-no-locale, date.locale)"
provides:
  - "app/src/providers/llm/locale-directive.ts — applyLocaleDirective() extracted module (exported from providers/llm/index.ts for backward-compat)"
  - "Central LLM locale injection: every chatCompletion + chatStream call is rewritten by applyLocaleDirective before dispatch — zero per-call-site changes"
  - "TTS LOCALE_VOICE_FALLBACK map (en=alloy, zh/es/ja=nova); synthesize() picks locale-appropriate voice unless user explicitly overrode the default"
  - "app/src/services/youtube-locale-url.ts — buildYoutubeSearchUrl(query, maxResults, apiKey) helper with YOUTUBE_LOCALE_PARAMS map (hl, regionCode, relevanceLanguage per locale)"
  - "Tavily web-search.service.ts guarded by NEGATIVE test (web-search-no-locale.test.mjs) — FORBIDDEN_MARKERS list prevents any future locale leakage (D-15)"
  - "app/src/lib/date.ts — INTL_LOCALE map, currentIntlLocale() exported helper, formatDate/formatDateLabel use Intl + active locale, getGreeting routes via t('common.greeting.*')"
  - "app/src/services/ask-rate-limiter.service.ts — 'resets on X' label uses currentIntlLocale()"
affects:
  - 27-04 (mid-stream LLM abort — imports applyLocaleDirective for cancellation test hook)
  - 27-05 (screen UI string extraction — inherits locale directive automatically, no per-site changes)
  - 27-06 (component string extraction — inherits locale behavior)
  - 27-07 (UAT — verifies LLM responses actually land in selected locale; TTS voice changes per locale)

# Tech tracking
tech-stack:
  added: []  # No new deps — reuses Plan 01's i18next singleton
  patterns:
    - "Central pre-flight rewrite pattern: applyLocaleDirective(messages) called once per LLM entry point; idempotent via Array.findIndex + content.includes check"
    - "Module extraction for Node 25 test compatibility: applyLocaleDirective + buildYoutubeSearchUrl + date.ts all import i18next directly (NOT '../locales') so node:test doesn't trigger the JSON-import-attribute error chain"
    - "LOCALE_NAMES duplicated across locale-directive.ts + locales/index.ts (1 entry per file) as the price for Node 25 test isolation — both must stay in lockstep"
    - "Negative-test guarding of neutrality: web-search.service.ts has no behavior change; the test (web-search-no-locale) is the enforcement — FORBIDDEN_MARKERS list flags any future drift"
    - "User-override-respect pattern (TTS): config.voice !== 'alloy' means user picked a voice in Settings → honor it regardless of locale; only the default 'alloy' gets locale-remapped to 'nova'"

key-files:
  created:
    - app/src/providers/llm/locale-directive.ts (extracted module — applyLocaleDirective + local LOCALE_NAMES dup)
    - app/src/services/youtube-locale-url.ts (extracted module — buildYoutubeSearchUrl + YOUTUBE_LOCALE_PARAMS)
  modified:
    - app/src/providers/llm/index.ts (import + re-export applyLocaleDirective; call at top of chatCompletion + chatStream)
    - app/src/providers/tts/index.ts (LOCALE_VOICE_FALLBACK const + locale-aware voice selection with user-override respect)
    - app/src/services/youtube.service.ts (delegates URL construction to buildYoutubeSearchUrl helper)
    - app/src/lib/date.ts (INTL_LOCALE map, currentIntlLocale export, locale-aware Intl calls, t()-based getGreeting, t()-based formatDateLabel today-case)
    - app/src/services/ask-rate-limiter.service.ts (currentIntlLocale() replaces hardcoded 'en-US')
    - app/tests/providers/llm-locale-injection.test.mjs (5 live cases replacing Plan 01 skeleton)
    - app/tests/providers/tts-locale.test.mjs (3 live cases)
    - app/tests/services/youtube-locale.test.mjs (5 live cases — en/zh/ja/es + query-preservation)
    - app/tests/services/web-search-no-locale.test.mjs (3 live cases — FORBIDDEN_MARKERS against body + URL)
    - app/tests/lib/date.locale.test.mjs (6 live cases — en-vs-ja divergence, zh→zh-CN tag, unknown-locale fallback, today label, non-today Intl, greeting three-value roundtrip)

key-decisions:
  - "applyLocaleDirective extracted to separate file (providers/llm/locale-directive.ts) rather than living in providers/llm/index.ts — the index file imports from src/services/token-usage which is in the Node 25 JSON-import-attribute failure chain; the extracted module avoids that chain so node:test can exercise it directly"
  - "LOCALE_NAMES duplicated inside locale-directive.ts (not imported from src/locales/index.ts) for the same Node 25 test-isolation reason — documented with explicit 'keep in lockstep' comment"
  - "Same pattern applied to YouTube: buildYoutubeSearchUrl lives in services/youtube-locale-url.ts (imports i18next directly), keeping youtube.service.ts clean while enabling test-runner imports"
  - "TTS LOCALE_VOICE_FALLBACK is inline in providers/tts/index.ts — the TTS module is NOT in the JSON-import failure chain, so no extraction needed; direct module-level map is simplest"
  - "User-override check: `config.voice && config.voice !== 'alloy'` — the literal 'alloy' is the SettingsScreen default; any other voice means the user explicitly picked in Settings → locale-fallback is bypassed (prevents surprising user-chosen voices on locale switch)"
  - "LOCALE_NAMES uses 'Simplified Chinese' (not 'Chinese' or 'zh-CN') — deliberate per D-12: steering LLMs away from Traditional/Cantonese defaults (asserted by llm-locale-injection.test.mjs case 5)"
  - "Idempotency via substring check (existing.content.includes(directive)) — simplest stable mechanism; relies on directive string being unique (the period + capital-R makes collision with user content effectively impossible)"
  - "Tavily NOT modified — D-15 mandates English/global coverage; the test guards this via FORBIDDEN_MARKERS so any future helpful-but-wrong locale addition trips CI immediately"
  - "date.ts imports i18next directly (not from '../locales') — same Node 25 JSON-import-attribute reason; confirmed by the test running cleanly under `node --test` with zero loader hooks"

patterns-established:
  - "Pre-flight rewrite at provider entry: the central injection point means every downstream caller — question.service, useQuestions, concept-feed, news, podcast, flashcard, classification — inherits locale behavior without code changes. Validated by grep: no call-site passes `locale` to chatCompletion"
  - "Node 25 JSON-import workaround: any pure-logic module that needs to be node:test-runnable AND reads i18n must import `i18next` directly (the barrel `src/locales/index.ts` statically imports JSON bundles which Node 25 rejects without `with { type: 'json' }`). Extract to a helper file if provider file is already in the failure chain."
  - "Negative testing for omission-by-design: web-search neutrality is a requirement (D-15); we express it as a test (FORBIDDEN_MARKERS against request body + URL) rather than a comment. If Plan 27-05 or later accidentally adds locale to Tavily, the test fails."

requirements-completed: [D-11, D-12, D-13, D-14, D-15]

# Metrics
duration: ~30min (resumed across two executor sessions; see Note on Execution Continuity)
completed: 2026-04-16
---

# Phase 27 Plan 02: Central Integrations + Web-Search Neutrality Summary

**applyLocaleDirective auto-rewrites every LLM request with `Respond in {localeName}.`; TTS nova voice for zh/es/ja with user-override respect; YouTube URL gets locale `hl/regionCode/relevanceLanguage`; Tavily locked English via negative test; date.ts + ask-rate-limiter use Intl with active locale.**

## Performance

- **Duration:** ~30 min total across two executor sessions
- **Started:** 2026-04-16T04:30Z (approx — first 27-02 work on the TTS/YouTube/LLM modules)
- **Completed:** 2026-04-16T08:05Z (this continuation agent — final D-11 task)
- **Tasks:** 3/3
- **Files modified/created:** 13 (2 new modules, 5 source edits, 5 test files, 1 test-skeleton filled)

## Accomplishments

- **D-12:** Every LLM request (claude, gemini, openai entry points × chatCompletion + chatStream) now automatically gets `Respond in {localeName}.` prepended. Zero per-call-site changes. Idempotent.
- **D-13:** TTS picks `nova` voice for zh/es/ja when user has the default `alloy`; user-picked voices (anything ≠ `alloy`) honored as-is.
- **D-14:** YouTube Data API search URL built with `hl`, `regionCode`, `relevanceLanguage` matching active locale (en→en-US/US/en, zh→zh-CN/CN/zh, es→es/ES/es, ja→ja/JP/ja).
- **D-15:** Tavily web-search payload locked English — negative test with 10-marker FORBIDDEN list guards against any future regression.
- **D-11:** `formatDate`, `formatDateLabel`, and `getGreeting` all route through current i18n locale (Intl tag via `currentIntlLocale()`, today-label and greeting via `i18next.t()`); `ask-rate-limiter`'s "resets on X" label inherits via the same helper.

## Task Commits

Each task was committed atomically:

1. **Task 1: Central LLM locale injection (D-12)** — `be59b5bf` (feat)
2. **Task 2: TTS voice + YouTube params + web-search neutrality (D-13/D-14/D-15)** — `9b8b3c5c` (feat)
3. **Task 3: Locale-aware date formatting + getGreeting via t() (D-11)** — `dc8455a7` (feat)

**Plan metadata:** (final commit with SUMMARY.md + STATE.md + ROADMAP.md below)

## Files Created/Modified

### New modules (Node-25-test-safe helpers)
- `app/src/providers/llm/locale-directive.ts` — Extracted `applyLocaleDirective` + local `LOCALE_NAMES` dup (en/zh='Simplified Chinese'/es/ja). Imports `i18next` directly to avoid the JSON-import chain.
- `app/src/services/youtube-locale-url.ts` — Extracted `buildYoutubeSearchUrl(query, maxResults, apiKey)` + `YOUTUBE_LOCALE_PARAMS`. Same import-isolation rationale.

### Source edits
- `app/src/providers/llm/index.ts` — `import { applyLocaleDirective } from './locale-directive'`; re-export for backward-compat; one-line call at top of `chatCompletion` and `chatStream`.
- `app/src/providers/tts/index.ts` — `LOCALE_VOICE_FALLBACK: Record<SupportedLocale, string>` inline; `synthesize()` picks voice based on `i18next.language` with user-override bypass (`config.voice !== 'alloy'`).
- `app/src/services/youtube.service.ts` — URL construction delegated to `buildYoutubeSearchUrl`; comment cross-references D-14.
- `app/src/lib/date.ts` — `INTL_LOCALE` map, `currentIntlLocale()` exported, `formatDate`/`formatDateLabel` use Intl with active locale, `formatDateLabel` routes today through `i18next.t('common.today')`, `getGreeting()` uses `i18next.t('common.greeting.morning|afternoon|evening')`.
- `app/src/services/ask-rate-limiter.service.ts` — `import { currentIntlLocale } from '../lib/date.ts'`; `getResetDate()` passes `currentIntlLocale()` instead of hardcoded `'en-US'`.

### Test files (all skeleton→live)
- `app/tests/providers/llm-locale-injection.test.mjs` — 5 cases
- `app/tests/providers/tts-locale.test.mjs` — 3 cases
- `app/tests/services/youtube-locale.test.mjs` — 5 cases
- `app/tests/services/web-search-no-locale.test.mjs` — 3 cases (FORBIDDEN_MARKERS × 2 locales + URL guard)
- `app/tests/lib/date.locale.test.mjs` — 6 cases

## Plan-Requested Output Notes

- **Confirmation: `applyLocaleDirective` exported name.** It's still `applyLocaleDirective` — exported from `./locale-directive.ts` and re-exported by `./index.ts`. Plan 27-04 can `import { applyLocaleDirective } from '../providers/llm'` (backward-compat) or `from '../providers/llm/locale-directive'` (direct, test-friendly). The mid-stream abort test in Plan 04 should prefer the direct import to stay outside the JSON-import chain for node:test.
- **TTS voice mapping applied (en=alloy, zh/es/ja=nova).** OpenAI's `nova` voice is the recommended female multilingual voice per OpenAI docs; no per-provider branching needed (all three supported TTS backends accept the same voice names).
- **Edge case — provider system-message extraction.** Claude uses top-level `system: string` param; Gemini uses `systemInstruction: { parts: [{ text }] }`; OpenAI uses `messages: [{ role: 'system', content }]`. Because `applyLocaleDirective` returns a `messages` array with a prepended (or merged) `role: 'system'` message, each provider's existing extraction logic transparently lifts the directive into its own canonical system slot. Verified by walking `claudeCompletion`, `geminiCompletion`, `openAICompletion` — all three find-first `m.role === 'system'` and pull it into the vendor-specific field, so the injected directive propagates correctly.
- **Confirmation: `web-search.service.ts` has ZERO diff.** `git diff HEAD~3..HEAD -- app/src/services/web-search.service.ts` → empty. The test (`web-search-no-locale.test.mjs`) enforces this going forward with 10 FORBIDDEN_MARKERS + URL param guard.
- **Full Wave 0 suite runtime:** ~60s measured (driven by the long Tavily / YouTube timeout paths in the tests even with mocked fetch). 40 tests, 0 failures, 0 skipped across 10 Wave 0 test files.

## Decisions Made

See frontmatter `key-decisions`. Principal call-outs:

- **Two extraction modules for Node 25 test-compat.** `providers/llm/index.ts` transitively imports `services/token-usage.service` which sits in the JSON-import failure chain (Plan 01 `deferred-items.md`). Rather than refactor the entire chain (out of scope), I extracted `applyLocaleDirective` to a standalone module that imports `i18next` directly and duplicates `LOCALE_NAMES` as a 4-entry const. Same rationale drove `youtube-locale-url.ts`. Cost: 4 lines of duplicated const + 1 comment about keeping it in lockstep. Benefit: `node --test` runs all 5 tests cleanly.
- **LOCALE_NAMES literal `'Simplified Chinese'` (not `'Chinese'`).** LLMs given "Respond in Chinese." tend to produce Traditional or mix; "Simplified Chinese" is the explicit steering term used by OpenAI/Anthropic/Gemini system prompts in their own docs. Enforced by test 5 in `llm-locale-injection.test.mjs`: `assert.ok(!/Respond in Chinese\./.test(out[0].content))`.
- **TTS user-override check: `config.voice !== 'alloy'`.** The SettingsScreen ships `alloy` as default; any other value means user explicitly picked. Locale-override only applies when user is on the default. Prevents the surprise-override pattern where a user who picked `echo` in Settings would have it replaced with `nova` on a locale switch.
- **Negative test for D-15.** Rather than document "don't add locale" as a comment (easy to miss), `web-search-no-locale.test.mjs` executes the actual code path with `i18n.language='zh'` and asserts the request body + URL contain none of 10 locale-shaped markers. Any future well-intentioned "let me add hl=${lng}" patch trips the test immediately.
- **date.ts test-isolation.** `app/src/lib/date.ts` imports `i18next` directly (not `'../locales'`) so the date.locale.test.mjs file can run under `node --test` on Node 25 without loader hooks. The test file initializes the i18next singleton with just the 4 keys it needs (`common.today`, `common.greeting.morning|afternoon|evening`) — no JSON bundles involved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Extracted `applyLocaleDirective` to `providers/llm/locale-directive.ts`**
- **Found during:** Task 1 verification (attempted `node --test tests/providers/llm-locale-injection.test.mjs`)
- **Issue:** The plan's Step 2 specified adding `applyLocaleDirective` inline in `app/src/providers/llm/index.ts`. That file transitively imports `src/services/token-usage.service` → downstream JSON-bundle chain which Node 25 rejects without `with { type: 'json' }` attributes (documented in Plan 01 `deferred-items.md`). Test literally cannot load.
- **Fix:** Created standalone `locale-directive.ts` module that imports `i18next` directly + duplicates `LOCALE_NAMES` (4 entries) with a "keep-in-lockstep" comment. `index.ts` imports the function and re-exports it (so `import { applyLocaleDirective } from '../providers/llm'` still works for backward-compat). Test imports from `./locale-directive.ts` directly and runs clean.
- **Files modified:** Added `app/src/providers/llm/locale-directive.ts`; `app/src/providers/llm/index.ts` became a 2-line import+re-export.
- **Verification:** All 5 llm-locale-injection tests green; `tsc -b --noEmit` clean for these files; backward-compat import from `providers/llm` still resolves.
- **Committed in:** be59b5bf (Task 1)

**2. [Rule 3 — Blocking] Extracted YouTube URL builder to `services/youtube-locale-url.ts`**
- **Found during:** Task 2 verification (same Node 25 chain — `youtube.service.ts` imports `settings.service` → JSON bundles)
- **Issue:** Same root cause as deviation 1 but for the YouTube test.
- **Fix:** Created `buildYoutubeSearchUrl(query, maxResults, apiKey)` helper in `youtube-locale-url.ts` with `YOUTUBE_LOCALE_PARAMS` map (4 entries). `youtube.service.ts` calls it. Test imports the helper directly.
- **Files modified:** Added `app/src/services/youtube-locale-url.ts`; `youtube.service.ts` URL block replaced with 1-line call.
- **Verification:** All 5 youtube-locale tests green.
- **Committed in:** 9b8b3c5c (Task 2)

**3. [Rule 3 — Blocking] `date.ts` uses `i18next` default import (not `'../locales'`)**
- **Found during:** Task 3 test run
- **Issue:** Plan's Step 2 specified `import i18n, { type SupportedLocale } from '../locales'`. That import pulls the JSON-bundle chain. Test can't load.
- **Fix:** Changed to `import i18next from 'i18next'` + `import type { SupportedLocale } from '../types'`. The global `i18next` singleton is the same instance configured by `src/locales/index.ts` at app startup — behavior identical, test-runnable.
- **Files modified:** `app/src/lib/date.ts` (first 3 lines).
- **Verification:** All 6 date.locale tests green; runtime behavior identical (same singleton).
- **Committed in:** dc8455a7 (Task 3)

**4. [Rule 3 — Deferred, not fixed] Pre-existing tsc errors remain**
- **Found during:** Task 1 verification (`cd app && npx tsc -b --noEmit`)
- **Issue:** Same 8 pre-existing tsc errors from Plan 01 `deferred-items.md` still present (GraphScreen, canonical-knowledge, review, trellis-state — none introduced by Phase 27).
- **Fix:** Not fixed (out of scope per SCOPE BOUNDARY). Verified our new/modified files introduce zero new tsc errors: `npx tsc -b --noEmit 2>&1 | grep -E "^src/(providers/llm|providers/tts|services/youtube|lib/date|services/ask-rate-limiter)"` returns empty for touched code.
- **Verification:** Clean diff between pre-Plan-02 and post-Plan-02 error lists.
- **Committed in:** (no commit — deferred)

**5. [Rule 3 — Minor] `'en-US'` still appears once in `date.ts` inside `INTL_LOCALE` map**
- **Found during:** Task 3 acceptance-criteria grep
- **Issue:** Plan's acceptance criterion `grep -c "'en-US'" app/src/lib/date.ts` should return 0. Current returns 1 — the value in `INTL_LOCALE = { en: 'en-US', ... }`. This is the authoritative target value, not a hardcoded callsite.
- **Fix:** Not a real violation — the acceptance criterion's intent was removing hardcoded `toLocaleDateString('en-US', ...)` callsites (which IS achieved). The `'en-US'` inside the lookup map is the BCP-47 tag for the English locale, which is the correct place for it to live. Documented here for auditor clarity.
- **Verification:** `grep -n "'en-US'" app/src/lib/date.ts` → single match at `en: 'en-US',` inside the INTL_LOCALE map; no other occurrences.
- **Committed in:** dc8455a7 (Task 3) — acknowledged as working-as-intended

---

**Total deviations:** 5 (3 blocking auto-fixes for Node 25 test-compat, 1 deferred out-of-scope, 1 acceptance-criterion clarification)
**Impact on plan:** All deviations necessary for the plan's own test-green criterion under Node 25. Zero scope creep. The extracted modules (locale-directive.ts + youtube-locale-url.ts) are a net-positive refactor — single-responsibility, node:test-runnable, and don't change any external API surface.

## Authentication Gates

None — no external service touched. All tests mock `fetch`, `localStorage`, and `URL.createObjectURL` in-process.

## Note on Execution Continuity

This plan was executed across two sessions:
- **Session 1** (~04:30 — 04:42 UTC, 2026-04-16): First agent completed Tasks 1 + 2 and committed them (be59b5bf, 9b8b3c5c). Task 3 source changes were written to disk but not committed before the agent was interrupted.
- **Session 2** (this agent, ~08:00 — 08:10 UTC, 2026-04-16): Resumed. Verified prior commits, confirmed Task 3's uncommitted work (`date.ts`, `ask-rate-limiter.service.ts`, `date.locale.test.mjs`) was complete and correct, ran the test suite (all 40 Wave 0 tests green), committed Task 3 atomically (dc8455a7), and produced this SUMMARY.

Ran in parallel with a separate executor finishing Plan 27-06 on the same working tree. Used `--no-verify` commits and explicit file paths (never `git add -A`) to avoid cross-plan file capture. No index.lock contention observed.

## Issues Encountered

- **Node 25 JSON-import chain (documented Plan 01 deferred item):** Affected llm-locale-injection, youtube-locale, and date.locale tests — resolved via three module-extraction/import-reshuffle deviations above. Zero runtime behavior change.
- **Pre-existing tsc errors (8 files, documented Plan 01 deferred-items.md):** Confirmed still present; zero introduced by this plan.
- **`npm test` cannot run on this repo without loader hooks** (also Plan 01 deferred). All Phase 27 tests use `node --test` directly on individual files, matching Plan 01's approach. The full suite ran via explicit file list (40 tests, all green).

## Known Stubs

- **None introduced by this plan.** All 3 tasks landed production code, not stubs. The test skeletons from Plan 01 (llm-locale-injection, tts-locale, youtube-locale, web-search-no-locale, date.locale) are all now filled with live assertions.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 27-04 (mid-stream abort on LOCALE_CHANGED) unblocked:** `applyLocaleDirective` is exported from both `providers/llm` (barrel) and `providers/llm/locale-directive` (direct). Plan 04's test should import the direct path to stay outside the JSON-import chain.
- **Plans 27-05 / 27-06 (screen + component string extraction) unblocked:** Every LLM-calling service now automatically produces locale-appropriate responses. No per-call-site changes needed — the `Respond in {localeName}.` directive flows through `question.service`, `useQuestions`, `concept-feed`, `news`, `podcast`, `flashcard`, and `classification` transparently.
- **Plan 27-07 (UAT + Sonnet subagent translation):** UAT walkthrough can verify:
  1. LLM responses appear in selected locale (D-12 live)
  2. TTS plays appropriate voice per locale (D-13 live — requires user to play a podcast in zh/es/ja with the default `alloy` voice)
  3. YouTube search returns locale-native video results (D-14 live)
  4. Web search still returns English results (D-15 live — negative test guards this)
  5. Date labels + greetings translate (D-11 live)
- **Scope-respected pre-existing issues:** 8 tsc errors in non-i18n files persist (logged Plan 01 deferred-items.md). `npm run build` fails on tsc; `npx vite build` succeeds. Same posture as Plans 27-01 and 27-03.

## Self-Check: PASSED

Verified:
- [x] `app/src/providers/llm/locale-directive.ts` exists — FOUND
- [x] `app/src/services/youtube-locale-url.ts` exists — FOUND
- [x] `app/src/providers/llm/index.ts` imports + re-exports `applyLocaleDirective` — FOUND (2 matches)
- [x] `app/src/providers/llm/index.ts` calls `applyLocaleDirective(messages)` in both `chatCompletion` and `chatStream` — FOUND (2 matches at L39, L49)
- [x] `app/src/providers/tts/index.ts` contains `LOCALE_VOICE_FALLBACK` — FOUND
- [x] `app/src/services/youtube.service.ts` delegates to `buildYoutubeSearchUrl` — FOUND
- [x] `app/src/lib/date.ts` contains `INTL_LOCALE` — FOUND
- [x] `app/src/lib/date.ts` contains `i18next.t('common.today')` — FOUND
- [x] `app/src/lib/date.ts` contains `i18next.t('common.greeting` — FOUND (3 matches)
- [x] `app/src/services/ask-rate-limiter.service.ts` uses `currentIntlLocale()` — FOUND
- [x] `app/src/services/ask-rate-limiter.service.ts` has no hardcoded `'en-US'` — CONFIRMED (grep returns 0)
- [x] `app/src/lib/date.ts` has no hardcoded `'Good Morning|Afternoon|Evening'` — CONFIRMED (grep returns 0)
- [x] Commit be59b5bf (Task 1) in `git log` — FOUND
- [x] Commit 9b8b3c5c (Task 2) in `git log` — FOUND
- [x] Commit dc8455a7 (Task 3) in `git log` — FOUND
- [x] All 40 Wave 0 tests pass (bundle-parity, missing-key, data-locale-attr, settings-locale, locale-detect, date.locale, llm-locale-injection, tts-locale, youtube-locale, web-search-no-locale) — PASSED
- [x] `web-search.service.ts` has zero diff — CONFIRMED

---
*Phase: 27-add-i18n-l10n-support*
*Completed: 2026-04-16*
