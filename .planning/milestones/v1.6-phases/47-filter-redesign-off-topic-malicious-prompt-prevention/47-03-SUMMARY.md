---
phase: 47-filter-redesign-off-topic-malicious-prompt-prevention
plan: 03
subsystem: providers/llm
tags:
  - filter
  - bracketing
  - provider-wrapper
  - phase-35-invariant
  - defense-in-depth
requirements:
  - FILTER-03
dependency_graph:
  requires:
    - app/src/providers/llm/locale-directive.ts (analog + composition partner)
    - app/src/state/useQuestions.ts (USER_ACK_BEFORE_GRAPH_CONTEXT constant)
  provides:
    - app/src/providers/llm/user-content-bracketing.ts (D-13 bracketing helper)
    - re-export of applyUserContentBracketing from providers/llm/index.ts
  affects:
    - app/src/providers/llm/index.ts (chatCompletion + chatStream composition)
    - app/src/providers/tts/index.ts (exemption documentation)
    - app/src/providers/embedding/index.ts (exemption documentation)
tech_stack:
  added: []
  patterns:
    - "leaf-module helper mirroring applyLocaleDirective shape"
    - "constants duplication discipline (mirrors LOCALE_VOICE_FALLBACK)"
    - "negative-invariant source-reading tests (mirrors InfoFlow.video-tap-emit)"
    - "U+200D zero-width joiner adversarial-tag escape"
key_files:
  created:
    - app/src/providers/llm/user-content-bracketing.ts (103 lines)
    - app/tests/providers/llm-bracketing.test.mjs (294 lines, 15 test cases)
    - app/tests/providers/tts-bracketing-exempt.test.mjs (71 lines, 4 test cases)
  modified:
    - app/src/providers/llm/index.ts (+10 lines: import + re-export + 2 composition lines + 6 var-rename touches)
    - app/src/providers/tts/index.ts (+9 lines exemption comment block)
    - app/src/providers/embedding/index.ts (+10 lines exemption comment block)
decisions:
  - "Composition order: applyLocaleDirective FIRST, applyUserContentBracketing SECOND"
  - "USER_ACK_BEFORE_GRAPH_CONTEXT_LITERAL duplicated (not imported) to keep helper a leaf module"
  - "Bracketing-exemption comments OMIT the helper symbol name to avoid false-positive matches in negative-invariant grep"
  - "TTS + embedding exempted with documented rationale + negative-invariant tests (no silent skips)"
metrics:
  duration: "~50 min"
  completed: "2026-05-15"
  commits: 3
  tests_added: 19
  tests_passing: 37
---

# Phase 47 Plan 03: Structural Prompt-Injection Bracketing at LLM Provider Wrapper Summary

Defense-in-depth XML bracketing of user-supplied content via `<user_content>...</user_content>` tags wrapped at the central `chatCompletion` / `chatStream` site, after `applyLocaleDirective`, with allowlist exclusions for the Phase 35 user-ack message and web-search Pass-2 results-injection.

## Plan Objective

FILTER-03 / D-13 / D-14 — wrap user-supplied content in `<user_content>...</user_content>` XML tags inside the LLM provider transport so injection attempts in the wrapped block cannot override system instructions. Critical constraint: preserve the Phase 35 byte-stable system-prompt invariant (CLAUDE.md "Ask-chat system prompt — byte-stable across turns") so KV-cache prefix coverage remains intact across chat turns.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create `applyUserContentBracketing` helper + 10 invariant tests | `19ef6f03` | `app/src/providers/llm/user-content-bracketing.ts`, `app/tests/providers/llm-bracketing.test.mjs` |
| 2 | Compose helper into `chatCompletion` + `chatStream` + 5 composition tests | `b527a556` | `app/src/providers/llm/index.ts`, `app/tests/providers/llm-bracketing.test.mjs` |
| 3 | Document TTS + embedding exemptions + 4 negative-invariant tests | `ea412d0f` | `app/src/providers/tts/index.ts`, `app/src/providers/embedding/index.ts`, `app/tests/providers/tts-bracketing-exempt.test.mjs` |

## Helper Shape

`app/src/providers/llm/user-content-bracketing.ts` (103 lines, leaf module — zero transitive imports of state/services/i18n):

```typescript
export const USER_CONTENT_OPEN_TAG = '<user_content>';
export const USER_CONTENT_CLOSE_TAG = '</user_content>';

export function applyUserContentBracketing(messages: ChatMessage[]): ChatMessage[];
```

**Behavior:**
1. Empty input → empty output (no-op).
2. Find LAST `role: 'user'` index by backward iteration; pass through if none.
3. Idempotency check: if already wrapped (`startsWith(OPEN)` AND `endsWith(CLOSE)`), pass through.
4. Allowlist check: if content === `USER_ACK_BEFORE_GRAPH_CONTEXT_LITERAL`, pass through.
5. Allowlist check: if content `startsWith('Web search results for "')`, pass through.
6. Adversarial-tag escape: replace inner `</user_content>` and `<user_content>` substrings with U+200D-split forms (`</user U+200D _content>`) so the user cannot close our wrapper from inside (Pitfall 5).
7. Wrap target content as `<user_content>\n${safeContent}\n</user_content>`.
8. Return immutable slice-rewrite preserving all other indices byte-stable.

System + assistant + history-user messages are NEVER mutated — Phase 35 KV-cache prefix coverage preserved.

## Composition Diff (`providers/llm/index.ts`)

Two-line addition per function (4 net lines added per function: 1 comment + 1 invocation, plus 6 `msgs` → `bracketed` variable references):

```typescript
// Before:
const msgs = applyLocaleDirective(messages); // D-12 — central locale injection
switch (config.provider) { case 'claude': return claudeCompletion(msgs, ...); ... }

// After:
const msgs = applyLocaleDirective(messages); // D-12 — central locale injection
const bracketed = applyUserContentBracketing(msgs); // D-13 — structural injection bracketing
switch (config.provider) { case 'claude': return claudeCompletion(bracketed, ...); ... }
```

Identical change applied to both `chatCompletion` and `chatStream`. Plus an `import` + `export` pair at module top.

**Counts:** `applyUserContentBracketing` appears 4× in `providers/llm/index.ts` (1 import + 1 re-export + 2 invocations); `bracketed` variable appears 8× (2 declarations + 6 transport-call uses across both functions).

## Constants Duplication

The literal `'Here is the knowledge graph context for this turn:'` is duplicated in:
- `app/src/state/useQuestions.ts:165` — canonical declaration `const USER_ACK_BEFORE_GRAPH_CONTEXT = '...'`
- `app/src/providers/llm/user-content-bracketing.ts:38` — duplicated as `const USER_ACK_BEFORE_GRAPH_CONTEXT_LITERAL = '...'`

Duplication is intentional — keeps the helper a leaf module (no transitive imports of state/services/i18n). Mirrors the `LOCALE_VOICE_FALLBACK` discipline in `app/src/providers/tts/index.ts:11-16`. Test case 10 (`constant-sync invariant`) reads both source files and asserts the literal stays byte-equal across the two copies; failure message instructs the maintainer to update both files together if renaming.

**Verification (byte-for-byte match):** `'Here is the knowledge graph context for this turn:'`

## TTS + Embedding Exemptions

`app/src/providers/tts/index.ts` and `app/src/providers/embedding/index.ts` each gain a 9-10 line comment block at the top of the file (after imports) referencing FILTER-03/D-13/EXEMPT and pointing to the relevant RESEARCH.md sections. Rationale:

- **TTS:** No instruction-following surface; the API vocalizes `text` literally. Wrapping would either be silently dropped or pronounced as "less-than text-to-speak greater-than".
- **Embedding:** Endpoints project text to a vector space; wrapping would corrupt cosine math (vector for `<user_content>foo</user_content>` differs from vector for `foo`).

Negative-invariant test `app/tests/providers/tts-bracketing-exempt.test.mjs` (4 cases in 2 describe blocks) asserts:
- Zero occurrences of `applyUserContentBracketing` in either provider source.
- The exemption comment block referencing `FILTER-03|D-13` and the word `EXEMPT` is present.

Each failure message names the RESEARCH.md section (lines 845-851 for TTS, lines 853-859 for embedding) so a future maintainer can locate the rationale.

> **Comment-text caveat:** The exemption comments deliberately do NOT include the literal symbol name `applyUserContentBracketing`, since the negative-invariant test uses a strict `assert.equal(matches.length, 0)` check via global regex. Writing the symbol name in the comment would trigger a false positive.

## Test Counts

| Test file | Cases | Status |
|---|---|---|
| `app/tests/providers/llm-bracketing.test.mjs` | 15 (helper goldens 1-10 + composition 11-15) | All pass |
| `app/tests/providers/tts-bracketing-exempt.test.mjs` | 4 (TTS no-import + has-comment, embedding no-import + has-comment) | All pass |

## Phase 35 Invariant Verification

`app/tests/state/useQuestions-system-prompt-stability.test.mjs` continues to pass after this plan lands. Six existing test cases all green:

- `formatCandidateContextPack is NOT referenced inside any role:"system" content` ✔
- `Pass 1 chatStream array has a role:"assistant" message carrying the candidate context BEFORE the user turn` ✔
- `Pass 2 chatStream array has the SAME role:"assistant" assistantContextMessage element` ✔
- `assistantContextMessage is declared exactly once` ✔
- `formatCandidateContextPack remains imported from canonical-knowledge.service` ✔
- `USER_ACK_BEFORE_GRAPH_CONTEXT constant is declared once and inserted between history and assistant context in BOTH passes` ✔

The byte-stability invariant survives because bracketing only mutates the LAST `role: 'user'` message; system + assistant + history-user messages pass through unchanged.

## Combined Verification Run

```
node --test \
  tests/providers/llm-bracketing.test.mjs \
  tests/providers/tts-bracketing-exempt.test.mjs \
  tests/providers/llm-locale-injection.test.mjs \
  tests/state/useQuestions-system-prompt-stability.test.mjs \
  tests/providers/tts-locale.test.mjs

→ tests 37, pass 37, fail 0
```

`npx tsc -b --noEmit` exits 0 (clean typecheck).

## Threat Model Outcomes

All STRIDE threats from the plan's `<threat_model>` block are addressed:

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-47-10 (direct injection) | mitigate | User content wrapped in `<user_content>` tags inside transport; Anthropic-trained XML structure provides context locking. |
| T-47-11 (adversarial closing tags) | mitigate | Inner `</user_content>` and `<user_content>` escaped via U+200D zero-width joiner before wrapping. Test 6 enforces. |
| T-47-12 (Phase 35 cache regression) | mitigate | Helper touches only LAST `role: 'user'`; system + assistant + history-user byte-stable. Phase 35 test continues to pass. |
| T-47-13 (web-search results bracketed as adversarial) | accept (excluded via allowlist) | Pass-2 message starting with `Web search results for "` passes through unwrapped. Test 9 enforces. |
| T-47-14 (future maintainer "consistency-fix" of TTS/embedding) | mitigate | Negative-invariant tests block the import statically; comment blocks explain rationale. |
| T-47-SC (package-supply-chain) | N/A | No packages installed. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed `applyUserContentBracketing` symbol-name from exemption comment text**
- **Found during:** Task 3 first test run.
- **Issue:** The comment block initially referenced the helper symbol name verbatim (`asserts no applyUserContentBracketing import/call appears in this file`). The negative-invariant test uses `source.match(/applyUserContentBracketing/g)` with `assert.equal(matches.length, 0)` — the comment mention was a false positive (matches.length === 1 when expected 0). The plan's "Note about negation precision" section acknowledged this risk.
- **Fix:** Reworded both comments to avoid the literal symbol name (`asserts the bracketing helper from providers/llm is NOT imported here`).
- **Files modified:** `app/src/providers/tts/index.ts`, `app/src/providers/embedding/index.ts`.
- **Commit:** `ea412d0f` (single-commit fix; not split into pre-fix + post-fix per TDD micro-cycle).

### Authentication Gates

None encountered — provider wrapper changes are purely structural and do not touch any authentication path.

### Architectural Changes

None.

## Known Stubs

None.

## Threat Flags

None — this plan adds defense-in-depth bracketing without introducing new network endpoints, file-access patterns, or schema changes at trust boundaries.

## Self-Check: PASSED

**Files exist:**
- ✔ `app/src/providers/llm/user-content-bracketing.ts` (103 lines)
- ✔ `app/tests/providers/llm-bracketing.test.mjs` (294 lines)
- ✔ `app/tests/providers/tts-bracketing-exempt.test.mjs` (71 lines)
- ✔ `.planning/phases/47-filter-redesign-off-topic-malicious-prompt-prevention/47-03-SUMMARY.md` (this file)

**Commits exist on `worktree-agent-ab69cdcda953a0864`:**
- ✔ `19ef6f03` — `feat(47-03): add applyUserContentBracketing helper (D-13)`
- ✔ `b527a556` — `feat(47-03): compose applyUserContentBracketing in LLM transport (D-13)`
- ✔ `ea412d0f` — `docs(47-03): document D-13 bracketing exemption for TTS + embedding`

**Acceptance counts:**
- ✔ `grep -c "applyUserContentBracketing" app/src/providers/llm/index.ts` = 4 (≥4 required)
- ✔ `grep -c "applyUserContentBracketing" app/src/providers/tts/index.ts` = 0
- ✔ `grep -c "applyUserContentBracketing" app/src/providers/embedding/index.ts` = 0
- ✔ `grep -E "applyLocaleDirective\(messages\);\s*//\s*D-12" app/src/providers/llm/index.ts` = 2 matches
- ✔ `grep -E "applyUserContentBracketing\(msgs\);\s*//\s*D-13" app/src/providers/llm/index.ts` = 2 matches
- ✔ `npx tsc -b --noEmit` exits 0
