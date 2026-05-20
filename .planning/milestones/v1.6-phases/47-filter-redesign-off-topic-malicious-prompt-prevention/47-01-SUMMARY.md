---
phase: 47-filter-redesign-off-topic-malicious-prompt-prevention
plan: 01
subsystem: filter
tags: [filter, corpus, embedding, eval-fixture, i18n, test-mock]

# Dependency graph
requires:
  - phase: 27-add-i18n-l10n-support
    provides: 4-locale bundle parity contract (en/zh/es/ja) and bundle-parity.test.mjs
  - phase: 33-uat-4-classification-dedup
    provides: embedding-similarity + cosine pre-check pattern (canonical-knowledge.service.ts:691-744) — Layer 2 corpus loader will mirror it
provides:
  - Static labeled corpus (app/src/data/filter-corpus.json — 104 entries across 3 labels × 4 locales) for Plan 02 hybrid classifier Layer 2
  - Held-out eval-set fixture (app/tests/services/filter-corpus.eval.json — 30 rows) anchoring FILTER-04 regression contract with both surfaced failure modes locked in (anchor-001 + anchor-002)
  - Deterministic 64-dim L2-normalized embedding mock (FNV-1a hash projection) in app/tests/services/_actions-mock-embedding.mjs for reproducible eval/cache tests
  - chatMessage.maliciousBlocked.body i18n key in en/zh/es/ja for Plan 04's inline rejection surface
affects: [47-02-hybrid-classifier, 47-03-provider-bracketing, 47-04-pipeline-inversion-useQuestions, 47-05-pipeline-inversion-question-service, 47-06-override-refire-and-uat]

# Tech tracking
tech-stack:
  added: []  # No new libraries — pure data + test mock + i18n strings
  patterns:
    - "Repo-only static JSON corpus with version + generated date envelope (D-09)"
    - "Held-out eval-fixture with anchor-seed rows + waiver-field documented limits (D-15, D-16, RESEARCH §Encoded Payloads)"
    - "Deterministic-but-fake embedding mock via FNV-1a hash projection — leaf-module discipline preserved"

key-files:
  created:
    - app/src/data/filter-corpus.json
    - app/tests/services/filter-corpus.eval.json
    - .planning/phases/47-filter-redesign-off-topic-malicious-prompt-prevention/47-01-SUMMARY.md
  modified:
    - app/tests/services/_actions-mock-embedding.mjs (no-op stub → 64-dim deterministic projection)
    - app/src/locales/en.json (canonical chatMessage.maliciousBlocked.body)
    - app/src/locales/zh.json (zh translation, "LLM" preserved)
    - app/src/locales/es.json (es translation, "LLM" preserved)
    - app/src/locales/ja.json (ja translation, "LLM" preserved)

key-decisions:
  - "Corpus authored at 104 entries (target was ~100) — splits 40 off-topic / 31 malicious / 33 on-topic; foreign-language coverage concentrated in malicious (8 zh+es+ja entries) per D-16, with on-topic foreign coverage minimal (1 each) so Layer 2 has at least one positive exemplar per locale"
  - "Eval fixture authored at 30 rows (RESEARCH suggested 30-50) — covers all D-16 categories: anchor seeds (2), classic injection (4 en + 1 each zh/es/ja), follow-up with priorAnswer context (2), encoded-payload waiver (1), Layer 1 false-positive counter-examples (5), foreign-language on-topic (3), DoS spam + disallowed-content (2). Plan 02 can extend without breaking the contract"
  - "Embedding mock dim=64 chosen over higher dimensions for speed — eval test runs are reproducibility checks, not semantic-accuracy benchmarks; smaller dim keeps test runtime tight without affecting correctness contract"
  - "Hash function = FNV-1a 32-bit (well-known, deterministic, fast, no dependencies). Each component derived from fnv1a32(text + '\\u241F' + dimIndex) — Unit Separator codepoint prevents ('foo', 1) vs ('foo1', '') collisions"
  - "i18n EN canonical copy adopted RESEARCH Option B verbatim (gives legitimate edge-case user a recovery hint without exposing classifier internals); LLM kept untranslated in zh/es/ja per CLAUDE.md i18n hard rule"

patterns-established:
  - "Repo-static labeled JSON corpus with {version, generated, entries[]} envelope — first-of-kind in the codebase; future label/data-fixture work should mirror this shape"
  - "Eval-set fixture with {version, rows[]} envelope and per-row {id, input, expected, context?, rationale, waived_known_limit?} — reusable for any future classifier eval that wants documented-limits semantics"
  - "Deterministic test-mock pattern: hash → fixed-dim → L2-normalize → real cosine. Reusable for any test needing reproducible vector outputs from a network-only provider"

requirements-completed: [FILTER-01, FILTER-02, FILTER-04]

# Metrics
duration: ~25min
completed: 2026-05-15
---

# Phase 47 Plan 01: Filter Corpus + Eval Fixture + i18n Foundation Summary

**Wave 0 foundation: 104-entry labeled corpus across en/zh/es/ja, 30-row held-out eval fixture with anchor-seed contract, deterministic 64-dim hash-projection embedding mock, and 4-locale i18n bundle for malicious-block surface — all data files only, zero source code touched.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-15 (single execution session)
- **Completed:** 2026-05-15
- **Tasks:** 3 / 3
- **Files created:** 2 (filter-corpus.json, filter-corpus.eval.json)
- **Files modified:** 5 (4 locale bundles + embedding mock)

## Accomplishments

- Static corpus checked-in BEFORE the classifier exists, so Plan 02's classifier can be developed against a stable contract and the held-out eval rows survive any future classifier rewrite (RESEARCH §"Wave 0 Gaps").
- Both surfaced failure modes from production are now locked into eval-fixture rows: `anchor-001` ("How are you doing?" → off-topic) for the false-negative; `anchor-002` ("What is a system prompt?" → on-topic) for the false-positive. Plan 02 cannot regress these without a CI failure.
- Deterministic embedding mock unblocks Plan 02's eval-test runner — same input always yields same vector, so cosine outputs are reproducible across CI runs without any network dependency.
- 4-locale i18n bundle for `chatMessage.maliciousBlocked.body` lands in the SAME commit (bundle-parity test enforces this); Plan 04's ChatMessage.tsx render branch can call `t('chatMessage.maliciousBlocked.body')` immediately.

### Corpus breakdown (filter-corpus.json — 104 entries)

| Label     | en  | zh | es | ja | Total |
|-----------|-----|----|----|-----|-------|
| off-topic | 36  | 1  | 1  | 2   | 40    |
| malicious | 22  | 3  | 3  | 3   | 31    |
| on-topic  | 30  | 1  | 1  | 1   | 33    |
| **Total** | **88** | **5** | **5** | **6** | **104** |

Off-topic categories (en): greetings (8), bare acks (6), social small talk (8 incl. foreign-locale variants), jokes/entertainment (4), sarcasm/dismissive (5), system-meta-questions (4), bare profanity/fillers (5).
Malicious categories (en): DAN + ignore-previous (8), role-swap/persona override (6), disallowed-content abstract stubs (4 — never actual harmful content), DoS spam markers (4); foreign-locale jailbreaks (9 across zh/es/ja).
On-topic categories (en): "What is X?" (8), "How does X work?" (6), "Why does X happen?" (6), legitimate LLM/security questions including the 5 anchor counter-examples (5), follow-up shapes (5).

### Eval fixture breakdown (filter-corpus.eval.json — 30 rows)

| Category                                   | Count | Notable IDs                                          |
|--------------------------------------------|-------|------------------------------------------------------|
| Anchor seeds (D-16 surfaced failures)      | 2     | anchor-001, anchor-002                               |
| Classic English injection                  | 4     | inj-en-001..004 (DAN, ignore previous, role-swap)    |
| Foreign-language injection                 | 3     | inj-zh-001, inj-es-001, inj-ja-001                   |
| Encoded-payload waiver (documented limit)  | 1     | encoded-001 (leetspeak — KNOWN LIMIT)                |
| Follow-up with priorAnswer context         | 2     | follow-up-001, follow-up-002                         |
| Layer 1 narrow-regex positives             | 3     | off-en-001..003 (greeting, ack, single-token)        |
| Layer 2 off-topic non-anchor               | 2     | off-en-004 (joke), off-en-005 (sarcasm)              |
| Layer 1 false-positive counter-examples    | 5     | ont-fp-001..005 ("Hello world programming", "What is a thank-you note", LLM-security) |
| On-topic canonical learning                | 3     | ont-001..003 (photosynthesis, Krebs, antibiotics)    |
| Foreign-language on-topic counter-examples | 3     | ont-zh-001, ont-es-001, ont-ja-001                   |
| Spam + disallowed-content                  | 2     | mal-spam-001, mal-disallowed-001                     |

## Task Commits

Each task was committed atomically:

1. **Task 1: Author filter-corpus.json + eval-set fixture** — `b06a8bc0` (feat)
2. **Task 2: Extend deterministic-vector embedding mock** — `f8a07558` (test)
3. **Task 3: Add chatMessage.maliciousBlocked.body in 4 locales** — `5f15dfc5` (feat)

## Files Created/Modified

- `app/src/data/filter-corpus.json` — Phase 47 D-09 corpus, 104 labeled exemplars across 3 labels × 4 locales. Consumed by Plan 02 via `import corpus from '../data/filter-corpus.json'`.
- `app/tests/services/filter-corpus.eval.json` — Phase 47 FILTER-04 / D-15 / D-16 held-out eval rows. Consumed by Plan 02's `filter-classifier.eval.test.mjs` via `readFileSync(new URL('./filter-corpus.eval.json', import.meta.url))`.
- `app/tests/services/_actions-mock-embedding.mjs` — Replaced no-op stub with deterministic 64-dim hash projection + real cosine implementation. Backwards-compatible signatures (`async embedText(text, config?)`, `cosine(a, b)`) so existing trellis-actions tests using this mock via `_actions-mock-loader.mjs` continue to pass.
- `app/src/locales/en.json` — Added `chatMessage.maliciousBlocked.body` canonical EN value at end of `chatMessage` namespace.
- `app/src/locales/zh.json`, `es.json`, `ja.json` — Translated values with "LLM" preserved verbatim per CLAUDE.md i18n rules.

## Decisions Made

- **Corpus size:** Authored 104 entries (vs. RESEARCH suggestion of ~100) — slightly over to ensure each `(label, locale)` cell has at least one exemplar (e.g., off-topic/zh, on-topic/ja). Plan 02 can extend without breaking the schema.
- **Foreign-language coverage skewed to malicious:** Per D-16, foreign-language injection coverage is REQUIRED in the eval fixture (so Layer 2 thresholds work cross-locale). On-topic foreign coverage is bootstrap-minimal (1 entry per locale) — primary on-topic discrimination is via the 30 English entries, with foreign-language entries serving as positive anchors for the centroid.
- **Hash function:** FNV-1a 32-bit chosen over SHA-256 for speed (eval-fixture rows × 64 dims = many calls per test run); chosen over djb2 for slightly better avalanche behavior in the 32-bit window. No security implications — this is a test mock, not a cryptographic primitive.
- **Vector dim:** 64 chosen over 1024+ (real embedding-model norm) — eval fixture only validates wiring + cache invalidation; semantic accuracy validated by hand-spot-check on staging, not in CI. Smaller dim means faster tests.
- **i18n EN copy:** Adopted RESEARCH §"Open Questions" #3 Option B verbatim. Operator-bias-friendly framing ("If this is a real learning question about LLM security, please rephrase") gives legitimate users a recovery hint without exposing classifier internals.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- **Worktree path mishap on Task 1 (resolved before commit):** Initial `Write` calls used absolute paths under `/Users/Code/EchoLearn/app/...` instead of the worktree root `/Users/Code/EchoLearn/.claude/worktrees/agent-a899845f6a5a83ebb/app/...`. The result: `filter-corpus.json` and `filter-corpus.eval.json` were created in the main repo, not the worktree. Caught by the `worktree-path-safety` cwd-drift assertion (which exposed the discrepancy when `git status` showed the files weren't staged in the worktree). Recovered by `mv` from main repo into the worktree under `WT_ROOT/app/src/data/` and `WT_ROOT/app/tests/services/`. No commits were made to the wrong tree, no data lost. All subsequent Edit/Write operations explicitly used the worktree absolute path.
- **`tests/locales/missing-key.test.mjs` cannot be run in this worktree:** Pre-existing limitation — the worktree has no `node_modules`, and that test imports `i18next`. Not caused by my changes; the same import error would occur on `main` in this worktree. The actual verify command (`bundle-parity.test.mjs`) requires no external imports and passes.

## User Setup Required

None — no external service configuration required. All artifacts are repo-only data and test fixtures.

## Threat Flags

None — Wave 0 introduces only static data + test fixtures + i18n strings. No new network endpoints, no auth paths, no schema changes at trust boundaries. The `filter-corpus.json` is loaded via `JSON.parse` at runtime (Plan 02), no `eval`, no remote fetch — matches T-47-01 disposition.

## Next Phase Readiness

- **Plan 02 (hybrid classifier):** Can `import corpus from '../data/filter-corpus.json'` immediately. Eval-test runner can read `filter-corpus.eval.json` and use the deterministic mock for reproducible cosine outputs.
- **Plan 03 (provider bracketing):** No dependency on Wave 0 outputs; can proceed in parallel with Plan 02.
- **Plan 04 (pipeline inversion in useQuestions):** Can call `t('chatMessage.maliciousBlocked.body')` immediately — bundle parity test green across en/zh/es/ja.
- **Plan 05 (pipeline inversion in question.service):** Same — error-shape `code: 'BLOCKED_MALICIOUS'` will use the same i18n key.
- **Plan 06 (override re-fire + UAT):** No dependency on Wave 0 outputs.
- **No blockers, no concerns.**

## Self-Check: PASSED

- [x] `app/src/data/filter-corpus.json` exists in worktree (FOUND)
- [x] `app/tests/services/filter-corpus.eval.json` exists in worktree (FOUND)
- [x] `app/tests/services/_actions-mock-embedding.mjs` modified in worktree (FOUND)
- [x] Commit `b06a8bc0` exists (Task 1)
- [x] Commit `f8a07558` exists (Task 2)
- [x] Commit `5f15dfc5` exists (Task 3)
- [x] Task 1 verify command passes (`OK corpus=104 eval=30`)
- [x] Task 2 verify command passes (`OK self=1 diff=0.6777158410290011`)
- [x] Task 3 verify command passes (`OK all 4 bundles have chatMessage.maliciousBlocked.body`)
- [x] `bundle-parity.test.mjs` passes (key sets identical across 4 locales)
- [x] Existing `classification-dedup.test.mjs` continues to pass (8/8 tests green)
- [x] Existing `trellis-heal/replant/prune.test.mjs` continues to pass (16/16 tests green) — confirms deterministic mock is backwards-compatible with `_actions-mock-loader.mjs` consumers
- [x] All 4 locale bundles contain "LLM" verbatim in the new translation
- [x] No corpus entry contains actual harmful content — disallowed-content stubs use abstracted phrasing only
- [x] No `import`, `require`, `chatCompletion`, `chatStream`, or `llmProvider` strings in either JSON data file (manual grep verified)

---

*Phase: 47-filter-redesign-off-topic-malicious-prompt-prevention*
*Completed: 2026-05-15*
