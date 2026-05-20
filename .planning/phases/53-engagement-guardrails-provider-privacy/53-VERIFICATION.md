---
phase: 53-engagement-guardrails-provider-privacy
verified: 2026-05-20T00:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
---

# Phase 53: Provider Privacy + Non-Pushy Guardrail Verification Report

**Phase Goal:** Private user data (tags, saved/liked/history, graph correction logs) is provably excluded from outbound LLM and TTS payloads by default, and a guardrail test codifies Trellis's non-pushy stance so future work cannot quietly add coercive mechanics.
**Verified:** 2026-05-20
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

This is an intentionally **test-only** phase (CONTEXT D-01/D-03): no runtime scrubber, no UI. Enforcement is golden payload tests + a structural source-read assertion + a negative-invariant guard. The scope context provided was honored — absence of a runtime sanitizer/UI is NOT treated as a gap, D-07 reorg journal exception is treated as a documented allowance, D-06 hidden `liked` signal is treated as allowed, and LEARN-04's "no new feature" deliverable is treated as correct.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | TTS outbound payload excludes tags/collections, saved/liked/history, and graph correction logs (PRIVACY-01) | ✓ VERIFIED | `privacy-payload-tts.test.mjs` seeds all 3 sentinels into `trellis_collections_v1`/`trellis_engagement_v1`/`trellis_graph_edit_log`, drives `synthesize`, asserts captured fetch body excludes all 3. Non-vacuous: asserts `captured.input === 'Recap of spaced repetition.'`. Test passes. |
| 2   | LLM outbound payload excludes the same private fields across openAI/claude/gemini (PRIVACY-01) | ✓ VERIFIED | `privacy-payload-llm.test.mjs` runs 3 provider sub-tests; each seeds the 3 sentinels, drives `chatCompletion`, asserts captured body excludes all 3 and (non-vacuously) includes the benign user content. All 3 sub-tests pass. |
| 3   | Goldens capture the real outbound fetch body without a network call | ✓ VERIFIED | Both files install a `fakeFetch` capturing `JSON.parse(init.body)` and return a stub Response; the non-vacuous positive assertions (`input`/user content present) prove capture fired. |
| 4   | Provider chokepoints do not import any private service (PRIVACY-01 structural) | ✓ VERIFIED | `privacy-callsite-structural.test.mjs` Sub-test A; codebase grep confirms 0 refs in all 4 chokepoint files. Mutation check: appending a private-service import to `tts/index.ts` made the test fail (`fail 1`), proving the guard is non-vacuous; file restored clean. |
| 5   | graph-edit-journal is read ONLY by reorganizeMindmap; any other reader fails (D-07) | ✓ VERIFIED | Sub-test B allowlists `canonical-knowledge.service.ts` (3 journal refs confirmed; `reorganizeMindmap` co-occurs), bans the 6 other call-sites (0 refs each confirmed by grep). Tests pass. |
| 6   | No streak/leaderboard/stop-cue/mandated-goal/public-like construct exists in src/ (LEARN-04) | ✓ VERIFIED | `learn-04-no-pushy-mechanics.test.mjs` 5 forbidden-construct scans; independent grep over `src/**/*.{ts,tsx}` (excl. tests) returns 0 for all 5 patterns. Tests pass. |
| 7   | Hidden `liked` signal + reward/fruit-credit/confetti loop do NOT trip the LEARN-04 guard (D-06) | ✓ VERIFIED | Positive regression-guard suite asserts the allowed fixture (`liked`, `getLikedPosts`, `isLiked`, `likePost`, `trellisCreditsService`, `fruit_credits`, `confetti`, `dailyReadService`, `explored`) matches none of the forbidden regexes. Word-boundary regexes used throughout (no bare `/like/`). Tests pass. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/tests/helpers/memory-localstorage.mjs` | Leaf-safe Map-backed localStorage shim, `makeMemoryLocalStorage`, zero imports, not `.test.mjs` | ✓ VERIFIED | Exists; exports `makeMemoryLocalStorage`; roundtrip prints `HELPER-ROUNDTRIP-OK`; 0 `import` statements; excluded from `find tests -name '*.test.mjs'` glob. |
| `app/tests/providers/privacy-payload-tts.test.mjs` | TTS payload golden | ✓ VERIFIED | Seeds 3 sentinels, drives `synthesize`, non-vacuous capture, excludes all 3. Imports the 53-01 shim. No heavy prompt-service imports. |
| `app/tests/providers/privacy-payload-llm.test.mjs` | LLM payload golden (3 providers) | ✓ VERIFIED | openAI/claude/gemini sub-tests; union json() stub; non-vacuous capture per provider; imports the shim. |
| `app/tests/providers/privacy-callsite-structural.test.mjs` | Structural assertion incl. reorg exception | ✓ VERIFIED | readFileSync-only; Sub-tests A/B/C; D-07 allowlist; mutation-tested non-vacuous. |
| `app/tests/learn-04-no-pushy-mechanics.test.mjs` | Negative-invariant guard | ✓ VERIFIED | Recursive src scan; 5 forbidden + 5 allowed-fixture guards; word-boundary regexes. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| privacy-payload-tts.test.mjs | helpers/memory-localstorage.mjs | `import makeMemoryLocalStorage` | ✓ WIRED | Imported and installed before dynamic import of `synthesize`. |
| privacy-payload-llm.test.mjs | helpers/memory-localstorage.mjs | `import makeMemoryLocalStorage` | ✓ WIRED | Imported and installed before dynamic import of `chatCompletion`. |
| privacy-payload-tts.test.mjs | src/providers/tts/index.ts | dynamic import of `synthesize` after shims | ✓ WIRED | `await import('../../src/providers/tts/index.ts')` after all shims. |
| privacy-payload-llm.test.mjs | src/providers/llm/index.ts | dynamic import of `chatCompletion` after shims | ✓ WIRED | `await import('../../src/providers/llm/index.ts')` after all shims. |
| privacy-callsite-structural.test.mjs | src chokepoints + call-sites | readFileSync + regex | ✓ WIRED | Reads source bytes; no source-module import. |
| learn-04-no-pushy-mechanics.test.mjs | src/**/*.{ts,tsx} | recursive readFileSync + word-boundary regex | ✓ WIRED | `collectSourceFiles` walks src/, skips tests/.d.ts. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All 4 phase test files green | `node --test` on the 4 files | tests 38, pass 38, fail 0 | ✓ PASS |
| Structural guard is non-vacuous | append private import to `tts/index.ts`, re-run structural test | fail 1 (then restored clean) | ✓ PASS |
| LEARN-04 tokens absent in src | grep `streak/leaderboard/stop-cue/dailyGoal/publicLike` over src | all 0 | ✓ PASS |
| Helper roundtrip + zero imports | `node -e` roundtrip; `grep -c import` | `HELPER-ROUNDTRIP-OK`, 0 imports | ✓ PASS |
| Phase introduced no src/ changes | git log src/ in commit window | none | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| PRIVACY-01 | 53-01, 53-02, 53-03 | LLM+TTS payload tests confirm tags/saved/liked/history/graph correction logs excluded | ✓ SATISFIED | Truths 1–5; goldens + structural guard all green. |
| LEARN-04 | 53-03 | Guardrail test asserts no public likes/leaderboards/streaks/stop-cues/mandated-goals/engagement loops | ✓ SATISFIED | Truths 6–7; LEARN-04 guard green; tokens absent. |

Both phase requirement IDs cross-reference cleanly to REQUIREMENTS.md (lines 62, 68) and the ROADMAP coverage table maps both to Phase 53. No orphaned requirements. LEARN-01/02/03 are explicitly Out of Scope (rescoped 2026-05-20) — not a gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | — | — | No debt markers (TODO/FIXME/XXX) in the 5 phase files; no stubs; no console-only impls. Empty-data patterns present (`dismissed: []`, `savedPodcasts: []`) are intentional seed fixtures, not stubs. |

### Human Verification Required

None. The phase is fully test-driven with no UI (53-VALIDATION.md Manual-Only Verifications: none). All behaviors have automated verification that the verifier executed and confirmed green.

### Gaps Summary

No gaps. All 7 must-have truths are verified against the codebase (not just SUMMARY claims): the four test files and the helper exist, are substantive, are correctly wired, and pass (38/38). The two payload goldens use non-vacuous capture assertions so sentinel-exclusion cannot pass trivially. The structural guard was independently mutation-tested (private import → `fail 1`), proving it is not vacuous. LEARN-04 forbidden tokens were independently grep-confirmed absent in src/, and the allowed reward/`liked` vocabulary is guarded against false-positives (D-06). The phase introduced no src/UI changes, consistent with the test-only scope (D-01/D-03). Both requirement IDs are accounted for.

---

_Verified: 2026-05-20_
_Verifier: Claude (gsd-verifier)_
