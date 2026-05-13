---
phase: 41
slug: pipeline-wiring-essay-depth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-09
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `41-RESEARCH.md` § Validation Architecture (HIGH confidence).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` + esbuild tsx loader (no jsdom, no React Testing Library — established source-reading + behavioral pattern from Phase 27/35/37/39/40) |
| **Config file** | `app/package.json` `"test": "npm run test:main; npm run test:actions"` |
| **Quick run command** | `node --test app/tests/services/post-essay-depth.test.mjs` (or the file modified by the current task) |
| **Full suite command** | `cd app && npm test` |
| **Estimated runtime** | ~30 seconds (full suite); < 5s per file |

---

## Sampling Rate

- **After every task commit:** Run the test file the task introduced or modified (< 5s).
- **After every plan wave:** Run `cd app && npm test` (full main + actions suites, ~30s).
- **Before `/gsd:verify-work`:** Full suite green AND `tsc -b --noEmit` exits 0. Test baseline target: ≥ pre-Phase-41 pass count + ~12-16 new assertions across 5 new test files.
- **Max feedback latency:** 30 seconds (full suite); 5 seconds (single file).

---

## Per-Task Verification Map

| SC | Behavior | Plan | Test Type | Automated Command | File Exists |
|----|----------|------|-----------|-------------------|-------------|
| SC-1 | Walker skips dismissed concept ID via `dismissedIds` Set | 41-01 | unit (walker boundary) | `node --test app/tests/services/concept-feed-source-diversity-wiring.test.mjs` | ❌ W0 |
| SC-2(a) | News-branch Tavily call passes `usedDomains` from `recordServedDomain` history | 41-01 | source-reading | (same file as SC-1) | ❌ W0 |
| SC-2(b) | Consecutive calls return different top domains when ≥2 high-quality domains exist | 41-01 | behavioral (mock webSearch + filterForDiversity) | (same file as SC-1) | ❌ W0 |
| SC-2(c) | `WebSearchOptions.excludeDomains` threads to Tavily `exclude_domains` body field | 41-01 | behavioral (mock fetch + capture body) | `node --test app/tests/services/web-search-exclude-domains.test.mjs` | ❌ W0 |
| SC-2(d) | Day-boundary `loadCache()` mismatch fires `sourceDiversityService.reset()` | 41-01 | behavioral | `node --test app/tests/services/source-diversity-day-boundary-reset.test.mjs` | ❌ W0 |
| SC-3 | `EssayOptions.depth: 'deep'` produces 350-600w; standard 150-250w | 41-02 | source-reading + behavioral mock | `node --test app/tests/services/post-essay-depth.test.mjs` | ❌ W0 |
| SC-4 | News essay prompt receives `sources.slice(0, 3)` joined for grounding | 41-02 | source-reading | (same file as SC-3) | ❌ W0 |
| SC-5(a) | LLM news prompt contains footnote instruction string (`[^N]` markers) | 41-02 | source-reading | (same file as SC-3) | ❌ W0 |
| SC-5(b) | `Markdown.tsx` has `components={{ sup, a, section }}` overrides | 41-02 | source-reading | `node --test app/tests/components/Markdown-citation-overrides.test.mjs` | ❌ W0 |
| SC-5(c) | `Markdown.tsx` sanitize schema spreads default `sup` attributes (Pitfall 4 regression guard) | 41-02 | source-reading | (same file as SC-5(b)) | ❌ W0 |
| SC-6 | `generateEssayMeta` body slice cap is 4000 chars (raised from 2000) | 41-02 | source-reading | (same file as SC-3) | ❌ W0 |
| SC-7(a) | All 3 async branches in PostDetailScreen essay useEffect have pre-call `if (signal.aborted) return` | 41-02 | source-reading | `node --test app/tests/screens/PostDetailScreen-abort-threading.test.mjs` | ❌ W0 |
| SC-7(b) | All 3 async branches pass `{ signal: abortController.signal }` to the generator | 41-02 | source-reading | (same file as SC-7(a)) | ❌ W0 |
| SC-7(c) | `generateConnectionPost` and `generateDiscoverPost` accept and thread `signal` to `chatStream` | 41-02 | source-reading | (same file as SC-7(a)) | ❌ W0 |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · W0 = Wave 0 file creation required*

---

## Wave 0 Requirements

The following test files do NOT exist; Plan 41-01 / Plan 41-02 must create them as part of their atomic commits:

- [ ] `app/tests/services/concept-feed-source-diversity-wiring.test.mjs` — Plan 41-01 (SC-1 + SC-2(a) + SC-2(b))
- [ ] `app/tests/services/web-search-exclude-domains.test.mjs` — Plan 41-01 (SC-2(c))
- [ ] `app/tests/services/source-diversity-day-boundary-reset.test.mjs` — Plan 41-01 (SC-2(d))
- [ ] `app/tests/services/post-essay-depth.test.mjs` — Plan 41-02 (SC-3 + SC-4 + SC-5(a) + SC-6)
- [ ] `app/tests/screens/PostDetailScreen-abort-threading.test.mjs` — Plan 41-02 (SC-7(a) + SC-7(b) + SC-7(c))
- [ ] `app/tests/components/Markdown-citation-overrides.test.mjs` — Plan 41-02 (SC-5(b) + SC-5(c))

**Framework install:** not needed — `node --test` is built into Node 20+; esbuild tsx loader already configured.

**Shared fixtures:** not needed — each test file is self-contained per the established Phase 39/40 pattern.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Citation chips render visually as styled superscripts; footnote section renders below essay body | CONTENT-04 / SC-5 visual aspect | DOM-snapshot tests skipped (no jsdom in test env); operator visual confirmation only | (1) Open Trellis. (2) Open any news post that has Tavily sources. (3) Wait for essay stream. (4) Confirm `[^1]` markers render as small chip-styled superscripts inline. (5) Scroll to bottom — confirm "Footnotes" / "Sources" section renders with each numbered link. |
| Source-diversity rotation observable across same-anchor refills | CONTENT-02 / SC-2 user-observable aspect | Requires real Tavily API responses across multiple refill cycles | (1) Force a news anchor to be refilled twice in one day (Force-New-Day + open same news post twice). (2) Open the post detail. (3) Confirm at least one `sources[*].url` domain differs across the two refills (when Tavily has ≥2 quality domains for the topic). |
| Deep dive essay length feels substantively richer than standard | CONTENT-01 visual feel | Word count is mechanically asserted in tests but content-quality judgement is operator-only | UAT after Phase 43's Deep dive button ships — operator opens a post, taps Deep dive, confirms the expanded essay reads as deeper exploration not just padded sentences. (Phase 41 only delivers the plumbing; Phase 43 delivers the user-facing trigger.) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (assigned to plan tasks at planning step)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (6 new test files enumerated above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (post-execution, before `/gsd:verify-work`)

**Approval:** pending
