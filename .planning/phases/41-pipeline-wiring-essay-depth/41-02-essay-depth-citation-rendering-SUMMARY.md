---
phase: 41-pipeline-wiring-essay-depth
plan: 02
subsystem: services-and-rendering
tags: [essay-depth, multi-snippet-grounding, citation-rendering, footnote-prompt, abort-threading, react-markdown-overrides, sanitize-schema-fix, deep-dive-api]

# Dependency graph
requires:
  - phase: 41-pipeline-wiring-essay-depth
    plan: 01
    provides: newsMeta.sources is now an array of up to 3 indexed entries (was effectively 1 pre-Phase-41); generateNewsEssay's sources.slice(0, 3) consumption needed this shape upstream. Plan 41-01 also updated post-essay.service.test.mjs window 2500→3500 for the news-defer test (preserved unchanged here).
provides:
  - EssayOptions.depth?: 'standard' | 'deep' API knob (default 'standard'); routed through generatePostEssay → 4 essay generators (standard/video/news/text-art)
  - bodyMarkdownDeep?: string field added to BOTH EssayContent AND PostSnapshot (back-compat additive per RESEARCH Pitfall 9 — old cached posts without the field remain valid; inherited by DailyPost)
  - generateNewsEssay multi-snippet grounding via sources.slice(0, 3) + footnote prompt instruction ([^1]/[^2]/[^3] markers + footnotes section emission per D-04)
  - generateEssayMeta body slice cap raised 2000 → 4000 chars (SC-6) for richer deep-variant meta extraction signal
  - patchPostEssayInCache selective field-by-field merge (Pitfall 9): empty bodyMarkdown does NOT clobber existing standard; empty bodyMarkdownDeep does NOT clobber existing deep; whyCare/takeaway preserve on empty; quickAskPrompts replaces unconditionally
  - generateConnectionPost + generateDiscoverPost in concept-feed.service.ts gain trailing options?: { signal?: AbortSignal } parameter; chatStream calls now thread signal: options?.signal (back-compat additive — positional callers unaffected)
  - PostDetailScreen.tsx essay useEffect: all 3 async branches now have BOTH pre-call `if (abortController.signal.aborted) return` guard AND `{ signal: abortController.signal }` passed to the generator (SC-7(a)/(b)/(c))
  - Markdown.tsx ReactMarkdown gains components={{ sup, a, section }} prop with citation-chip / footnote-link / footnote-section overrides; sanitizeSchema.attributes.sup spreads defaultSchema.attributes?.['sup'] (Pitfall 4 regression guard)
affects: [phase-43-engagement-ui]
  # Phase 43 owns the user-facing "Deep dive" button that calls generatePostEssay(post, questions, { depth: 'deep' }) and patches via patchPostEssayInCache(postId, { bodyMarkdownDeep, ...meta }) — that path is now wired end-to-end.

# Tech tracking
tech-stack:
  added: []  # No new dependencies — uses existing react-markdown Components type + remark-gfm v4 footnote output shape
  patterns:
    - "Depth-conditional system-prompt construction (Pattern 4): each generator computes `const depth = options?.depth ?? 'standard'` and selects a `wordCountInstruction` string before assembling system content. Standard band preserved per generator (200-350 / 200-400 / 150-250 / 80-120); deep band 350-600 added uniformly."
    - "Multi-snippet source grounding via .slice(0, 3) + indexed map: `sources.slice(0, 3).map(s => `[${s.index}] ${s.title} — ${s.url}\\n${s.snippet}`).join('\\n\\n')`. Up to 3 indexed entries; back-compat with pre-Phase-41 single-source shape (1-element array still works)."
    - "Markdown footnote prompt instruction set (D-04): explicit string mentioning [^1] / [^2] / [^3] markers AND `[^N]: <Source title>` footnotes section. The LLM emits the syntax; remark-gfm v4 (already in plugin chain) parses [^N] into <sup><a data-footnote-ref> + <section data-footnotes class='footnotes'>; Markdown.tsx component overrides style the parsed output. Single-source-of-truth rendering, no raw HTML, sanitize boundary preserved."
    - "Selective field-by-field cache merge (Pitfall 9): blanket spread `{ ...posts[idx], ...essay }` is unsafe for partial essays — replaced with field-by-field guarded merge so empty bodyMarkdown does NOT overwrite existing standard. Symmetric for bodyMarkdownDeep. whyCare/takeaway preserve on empty (1-sentence fields); quickAskPrompts replaces unconditionally (array — empty array is meaningful)."
    - "Trailing options bag for back-compat signal threading (Pitfall 6): generateConnectionPost / generateDiscoverPost gain `options?: { signal?: AbortSignal }` as final positional parameter — positional callers unaffected; new callers pass `{ signal: abortController.signal }` and chatStream propagates."
    - "Pre-call abort guard pattern (SC-7(a)): `if (abortController.signal.aborted) return;` immediately preceding each `for await` opener. Three-branch coverage in PostDetailScreen.tsx — connection / discover / generatePostEssay — all funnel through the same single AbortController instance. Mid-stream guards inside the for-await body preserved (D-08); LOCALE_CHANGED subscribe + unmount-cleanup `return () => abortController.abort()` preserved."
    - "ReactMarkdown component overrides discriminated by data attribute (not className prefix): the <a> override uses `rest['data-footnote-ref']` / `rest['data-footnote-backref']` to identify footnote refs, immune to hast-util-sanitize's DOM-clobber prefix changes (e.g. `user-content-fn-N`). The <section> override uses `className.includes('footnotes')` since remark-gfm guarantees the literal class string."
    - "Sanitize-schema sup-attr spread (Pitfall 4 regression guard): `sup: [...(defaultSchema.attributes?.['sup'] ?? []), 'dataCite', 'style']` — extends rather than replaces. Mirrors the established span/div pattern in the same schema. Future schema additions (e.g. data-footnotes, aria-describedby on the default sup allowlist) will flow through automatically."

key-files:
  created:
    - "app/tests/services/post-essay-depth.test.mjs (NEW, 192 lines — 11 cases: 4 SC-3 source-reading + 1 SC-4 source-reading + 1 SC-5(a) source-reading + 1 SC-6 source-reading + 1 counterweight + 3 patchPostEssayInCache merge behavioral tests)"
    - "app/tests/screens/PostDetailScreen-abort-threading.test.mjs (NEW, 117 lines — 10 cases: 1 SC-7(a) + 3 SC-7(b) + 4 SC-7(c) + 2 counterweights)"
    - "app/tests/components/Markdown-citation-overrides.test.mjs (NEW, 70 lines — 8 cases: 5 SC-5(b) + 1 SC-5(c) + 2 counterweights)"
    - ".planning/phases/41-pipeline-wiring-essay-depth/41-02-essay-depth-citation-rendering-SUMMARY.md (this file)"
  modified:
    - "app/src/types/index.ts (+4 lines — PostSnapshot gains optional bodyMarkdownDeep?: string with documenting comment)"
    - "app/src/services/post-essay.service.ts (+~75 / -25 lines — EssayOptions.depth knob + EssayContent.bodyMarkdownDeep field; depth-conditional wordCountInstruction in all 4 generators; sources.slice(0, 3) multi-snippet grounding + footnote prompt instruction in generateNewsEssay; meta slice cap 2000→4000; patchPostEssayInCache field-by-field selective merge)"
    - "app/src/services/concept-feed.service.ts (+10 / -3 lines across 2 sites — generateConnectionPost + generateDiscoverPost gain trailing options?: { signal?: AbortSignal }; chatStream calls thread signal: options?.signal)"
    - "app/src/screens/PostDetailScreen.tsx (+~10 net lines — D-15 comment block extended to 'Phase 41 SC-7' scope; 3 pre-call abort guards + 2 new { signal: abortController.signal } args added across the 3 async essay branches; existing mid-stream guards + LOCALE_CHANGED + cleanup all preserved)"
    - "app/src/components/Markdown.tsx (full file rewrite, 113 lines — preserves all existing plugin chain + sanitize schema; adds Components type import; adds citationComponents object with sup/a/section overrides; wires components={citationComponents} into ReactMarkdown JSX; SC-5(c) Pitfall 4 fix: sup attribute list now spreads defaultSchema.attributes?.['sup'])"
    - ".planning/REQUIREMENTS.md (CONTENT-01, CONTENT-03, CONTENT-04 promoted from `[ ]` to `[x]`; traceability table rows updated)"
    - ".planning/ROADMAP.md (Phase 41 plan list — 41-02 marked [x])"
    - ".planning/STATE.md (Last decisions section appended; Current Position + progress + Stopped at updated)"

key-decisions:
  - "Source-reading test for SC-7(a) uses a regex anchor `if (abortController.signal.aborted) return;[^\\n]*\\n\\s*for await` — permits trailing inline comments (e.g. `// Phase 41 SC-7 — pre-call guard`) without breaking the match. Initial regex `[^;]*;` failed because the comment after `return;` doesn't end in `;`."
  - "Essay useEffect block scoped via SECOND occurrence of `On-enter essay generation` marker (the first is the state-block comment near the top of the file; the second opens the actual useEffect). End boundary: `Fetch cached images` comment (the carousel useEffect that follows). Avoids accidentally including state-declaration block in the source-reading window."
  - "Footnote prompt instruction wording chosen from D-04 verbatim: 'Cite each factual claim with [^1], [^2], [^3] markers tied to the source list above.' + 'Emit a footnotes section at the end of the essay using `[^1]: <Source title>` for each cited source.' Explicit numeric markers (rather than e.g. '[^N]') give the LLM concrete examples; the test asserts all three numeric markers AND `footnotes section` substring (case-insensitive)."
  - "patchPostEssayInCache selective merge guard list: bodyMarkdown empty-string check (`essay.bodyMarkdown && essay.bodyMarkdown.trim() !== ''`) protects against the standard-empty-when-deep-only path; same shape for bodyMarkdownDeep; whyCare/takeaway truthiness check (preserves existing on empty); quickAskPrompts truthiness check (replaces on truthy — empty array is meaningful but undefined would skip). Phase 38 / TECHDEBT-06 historical comment block preserved verbatim above the function."
  - "Trailing options bag for generateConnectionPost / generateDiscoverPost (Pitfall 6 — back-compat). Both functions had no options bag pre-Phase-41; positional callers (e.g. PostDetailScreen pre-Task-5) remain valid. Task 5 immediately consumes the new bag in PostDetailScreen.tsx."
  - "Markdown.tsx full-file rewrite over Edit-tool patches: the plan listed too many discrete additions (Components import, citationComponents object, components prop wiring, SC-5(c) fix) for clean atomic patches; full rewrite preserves all existing plugin chain + sanitize schema + KaTeX import while making the additions reviewable as a single semantic unit. Counterweight test guards plugin chain + sanitize tagNames + dataCite + span/div spread to catch any regression."
  - "react-markdown v10 exports `type Components` directly from index — verified via `node_modules/react-markdown/index.d.ts:2`; no shim or local type definition needed. tsc -b --noEmit exits 0 throughout."
  - "data-footnote-ref / data-footnote-backref discriminator chosen over href-prefix matching (e.g. `href.startsWith('#user-content-fn-')`). The hast-util-sanitize default schema applies a clobber prefix that may be overridable by callers; relying on the prefix is brittle. The data attributes are emitted by remark-gfm regardless of clobber prefix and survive sanitize."
  - "Test baseline: pre-Plan-41-02 626/2 → post-Plan-41-02 655/2 (+29 passes: 11 post-essay-depth + 10 PostDetailScreen-abort-threading + 8 Markdown-citation-overrides; same 2 pre-existing carry-over failures from Plan 41-01: tests/concept-feed.test.mjs ERR_MODULE_NOT_FOUND for extensionless youtube.service import + tests/services/trellis-layout.test.mjs:64 getVineColor date-dependent assertion). test:actions 16/16/0 unchanged. tsc -b --noEmit exits 0."
  - "Plan 41-02 sequenced after Plan 41-01 in Wave 2 — both plans touched concept-feed.service.ts (Plan 41-01 owned news loops + loadCache; Plan 41-02 Task 4 owned generateConnectionPost/generateDiscoverPost signal threading). Logical scopes were disjoint; sequential execution avoided parallel-write file corruption. No merge conflicts."

patterns-established:
  - "Depth-conditional generator template: `const depth = options?.depth ?? 'standard'; const wordCountInstruction = depth === 'deep' ? '...350-600...' : '...standard band...'; const systemContent = '...prefix... ' + wordCountInstruction + ' ...suffix...';` — replicable for any future generator that needs depth variation. Default 'standard' preserves pre-Phase-41 behavior."
  - "Multi-snippet grounding template: `sources.slice(0, MAX).map((s, i) => `[${s.index}] ${s.title} — ${s.url}` + (s.snippet ? `\\n${s.snippet}` : '')).join('\\n\\n')` — replicable for any future LLM call that consumes a list of indexed sources."
  - "Selective field-by-field merge for cache patches (Pitfall 9 generalization): blanket spread `{ ...existing, ...partial }` is unsafe whenever `partial` may have empty / undefined fields the caller doesn't intend to overwrite. Replace with explicit truthiness-guarded `if (partial.X) merged.X = partial.X` pattern. Applies to any future cache-patch function with optional fields."
  - "ReactMarkdown component override discriminated by data attribute, not className prefix or href prefix: when the underlying parser emits stable data-* attributes (remark-gfm footnotes, GitHub task-list checkboxes), prefer those over className inspection. Survives sanitize clobber-prefix changes."

requirements-completed: [CONTENT-01, CONTENT-03, CONTENT-04]

# Metrics
duration: 17 min
completed: 2026-05-09
---

# Phase 41 Plan 02: Essay Depth + Citation Rendering Summary

**Lengthens the essay path with a `depth: 'standard' | 'deep'` knob across all 4 essay generators, widens news grounding to `sources.slice(0, 3)` with a footnote-aware prompt, raises `generateEssayMeta` body slice cap from 2000 to 4000, audits `PostDetailScreen.tsx`'s essay `useEffect` so all 3 async branches both pass `{ signal: abortController.signal }` AND have a pre-call `if (signal.aborted) return` guard, extends `generateConnectionPost` + `generateDiscoverPost` with a trailing options bag that threads signal to `chatStream`, adds `bodyMarkdownDeep?: string` field to BOTH `EssayContent` AND `PostSnapshot` (back-compat additive per Pitfall 9), and adds ReactMarkdown `components={{ sup, a, section }}` overrides to `Markdown.tsx` with a sanitize-schema spread fix on `<sup>` attributes — closing CONTENT-01 (deep-dive API), CONTENT-03 (multi-snippet grounding), CONTENT-04 (citation rendering) and unblocking Phase 43's "Deep dive" button.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-05-09T14:54:53Z
- **Completed:** 2026-05-09T15:11:36Z
- **Tasks:** 7 (1 type+interface additions + 1 generator depth wiring + 1 cache-merge + 1 generator signal-bag + 1 PostDetailScreen abort audit + 1 Markdown overrides + 1 close-out)
- **Files created:** 4 (3 test files + this SUMMARY)
- **Files modified:** 5 source files (types/index.ts, post-essay.service.ts, concept-feed.service.ts, PostDetailScreen.tsx, Markdown.tsx) + REQUIREMENTS.md + ROADMAP.md + STATE.md

## Accomplishments

- `EssayOptions.depth?: 'standard' | 'deep'` knob added; default 'standard' preserves pre-Phase-41 behavior
- `bodyMarkdownDeep?: string` field added to BOTH `EssayContent` AND `PostSnapshot` (back-compat additive per Pitfall 9 — inherited by DailyPost; old cached posts without the field remain valid)
- All 4 essay generators (`generateStandardEssay` 200-350w, `generateVideoEssay` 200-400w, `generateNewsEssay` 150-250w, `generateTextArtEssay` 80-120w) now read `options?.depth` and switch their system prompt's word-count instruction; deep band is 350-600w on every generator
- `generateNewsEssay` consumes `sources.slice(0, 3)` for multi-snippet grounding (was effectively `sources[0]` pre-Phase-41 since Tavily `maxResults` was 1; Plan 41-01 widened to 3)
- `generateNewsEssay` system prompt now contains explicit footnote instruction per D-04: "Cite each factual claim with [^1], [^2], [^3] markers tied to the source list above. Emit a footnotes section at the end of the essay using `[^1]: <Source title>` for each cited source."
- `generateEssayMeta` body slice cap raised 2000 → 4000 chars (SC-6) — gives meta-extraction a fuller signal for deep-variant essays
- `patchPostEssayInCache` rewritten to selective field-by-field merge (Pitfall 9): empty `bodyMarkdown` does NOT clobber existing standard; empty `bodyMarkdownDeep` does NOT clobber existing deep; whyCare/takeaway preserve on empty; quickAskPrompts replaces unconditionally
- `generateConnectionPost` + `generateDiscoverPost` in concept-feed.service.ts gain trailing `options?: { signal?: AbortSignal }` parameter (back-compat additive); chatStream calls thread `signal: options?.signal`
- PostDetailScreen.tsx essay useEffect: all 3 async branches (connection / discover / generatePostEssay) now have BOTH pre-call `if (abortController.signal.aborted) return` guard AND `{ signal: abortController.signal }` passed to the generator (SC-7(a)/(b)); D-15 comment block extended to "Phase 41 SC-7" scope
- Markdown.tsx now imports `type Components` from react-markdown and wires `components={citationComponents}` on ReactMarkdown JSX with three overrides: `sup` (citation chip with subtle background + smaller font + verticalAlign super), `a` (footnote return-link styling discriminated by data-footnote-ref / data-footnote-backref data attrs — DOM-clobber-prefix-safe), `section` (footnote section container styling discriminated by `className.includes('footnotes')`)
- Markdown.tsx sanitizeSchema.attributes.sup now SPREADS defaultSchema.attributes?.['sup'] instead of replacing it (SC-5(c) / Pitfall 4 regression guard) — mirrors existing span/div pattern; future schema additions survive automatically
- 29 new test cases across 3 new test files, all green
- Phase 35 byte-stable system-prompt rule does NOT apply to Phase 41's one-shot LLM call sites (per CLAUDE.md "Other one-shot LLM call sites" footnote rule 6) — depth-conditional prompts and dynamic content interpolation are intentional in this scope
- News post `bodyMarkdown: ''` invariant preserved (CLAUDE.md "News post pipeline" load-bearing rule) — only the on-enter streamer (`generateNewsEssay`) changed; news creation site at concept-feed.service.ts is unchanged by this plan
- CONTENT-01 (deep dive API + bodyMarkdownDeep field), CONTENT-03 (multi-snippet grounding), CONTENT-04 (sup/a/section overrides) all promoted from `[ ]` to `[x]` in REQUIREMENTS.md

## Task Commits

Each task was committed atomically with `(41-02)` scope (`--no-verify` per parallel-execution protocol — orchestrator validates hooks once after all wave agents complete):

1. **Task 1: bodyMarkdownDeep field on EssayContent + PostSnapshot; depth knob on EssayOptions** — `6ba839de` (feat)
2. **Task 2: depth-aware essay prompts; multi-snippet news grounding; footnote instruction; meta cap 4000** — `e8634daa` (feat) — first 8 cases of post-essay-depth.test.mjs
3. **Task 3: patchPostEssayInCache selective merge for bodyMarkdownDeep (Pitfall 9)** — `a19b2fa5` (feat) — appended 3 merge behavioral tests
4. **Task 4: thread AbortSignal through generateConnectionPost + generateDiscoverPost** — `aaee719a` (feat)
5. **Task 5: SC-7 abort threading — pre-call guards + signal args on all 3 essay branches** — `6c3fa72d` (feat) — created PostDetailScreen-abort-threading.test.mjs
6. **Task 6: ReactMarkdown sup/a/section overrides + sanitize sup-attr spread fix** — `397d388a` (feat) — created Markdown-citation-overrides.test.mjs

**Plan close-out commit:** to follow this SUMMARY (docs(41-02) — see git log)

## Files Created/Modified

### Created

- `app/tests/services/post-essay-depth.test.mjs` (NEW, 192 lines) — 11 cases: 4 SC-3 source-reading (4 generators present, depth knob branched 4×, deep band 350-600 referenced 4×, standard bands preserved per generator) + 1 SC-4 source-reading (sources.slice(0, 3) in generateNewsEssay) + 1 SC-5(a) source-reading ([^1]/[^2]/[^3] + footnotes section in generateNewsEssay system prompt) + 1 SC-6 source-reading (4000-char meta cap; old 2000 cap removed) + 1 counterweight (signal threading preserved) + 3 patchPostEssayInCache merge behavioral tests (deep-only patch preserves standard; both-fields patch updates both; round-trip standard-then-deep preserves both)
- `app/tests/screens/PostDetailScreen-abort-threading.test.mjs` (NEW, 117 lines) — 10 cases: 1 SC-7(a) (≥3 pre-call abort guards immediately preceding for-await openers in essay useEffect block) + 3 SC-7(b) (each of generateConnectionPost / generateDiscoverPost / generatePostEssay receives `{ signal: abortController.signal }`) + 4 SC-7(c) (both generator signatures have options?: { signal?: AbortSignal }; both bodies thread signal: options?.signal into chatStream) + 2 counterweights (LOCALE_CHANGED subscribe + abort cleanup pattern preserved; D-15 comment block updated to mention Phase 41 SC-7)
- `app/tests/components/Markdown-citation-overrides.test.mjs` (NEW, 70 lines) — 8 cases: 5 SC-5(b) (Components type import; components object with sup/a/section keys; ReactMarkdown JSX has components prop; data-footnote-ref + data-footnote-backref discriminators in <a> override; section override discriminates by className.includes('footnotes')) + 1 SC-5(c) Pitfall 4 regression guard (sanitizeSchema attributes.sup spreads defaultSchema.attributes?.['sup']) + 2 counterweights (existing tagNames sup + dataCite + span/div spread preserved; remark-gfm + remark-math + rehype-katex + rehype-raw + rehype-sanitize plugin chain preserved)
- `.planning/phases/41-pipeline-wiring-essay-depth/41-02-essay-depth-citation-rendering-SUMMARY.md` (this file)

### Modified

- `app/src/types/index.ts` (+4 lines) — `PostSnapshot` interface gains optional `bodyMarkdownDeep?: string` field with documenting comment naming Phase 41 D-03; placed immediately after `bodyMarkdown: string`. DailyPost (extends PostSnapshot) inherits the field automatically.
- `app/src/services/post-essay.service.ts` (+~75 / -25 lines):
  - `EssayOptions` gains `depth?: 'standard' | 'deep'` field
  - `EssayContent` gains `bodyMarkdownDeep?: string` field
  - `generateEssayMeta` body slice cap raised 2000 → 4000 chars (SC-6) with documenting comment
  - All 4 generators (`generateStandardEssay`, `generateVideoEssay`, `generateNewsEssay`, `generateTextArtEssay`) compute `const depth = options?.depth ?? 'standard'` and select a `wordCountInstruction` string before assembling system content
  - `generateNewsEssay` additionally: consumes `sources.slice(0, 3)`; system prompt contains footnote instruction per D-04
  - `patchPostEssayInCache` rewritten to selective field-by-field merge (Pitfall 9); Phase 38 / TECHDEBT-06 historical comment block preserved verbatim above the function
- `app/src/services/concept-feed.service.ts` (+10 / -3 lines across 2 sites):
  - `generateConnectionPost` (line ~1818) gains trailing `options?: { signal?: AbortSignal }` parameter; chatStream call threads `signal: options?.signal`
  - `generateDiscoverPost` (line ~1947) gains trailing `options?: { signal?: AbortSignal }` parameter; chatStream call threads `signal: options?.signal`
- `app/src/screens/PostDetailScreen.tsx` (+~10 net lines):
  - D-15 scope comment block extended: "all 3 branches now thread the AbortSignal AND have a pre-call abort guard. Walker termination + LOCALE_CHANGED mid-stream cancel + unmount cleanup all funnel through the same single AbortController."
  - 3 pre-call `if (abortController.signal.aborted) return;` guards added (one per branch) BEFORE the for-await opener
  - 2 new `{ signal: abortController.signal }` args added (connection branch + discover branch); generatePostEssay branch already had its signal arg
  - All other surrounding code preserved verbatim (LOCALE_CHANGED subscribe, try/catch/finally, patchPostEssayInCache call, unsubLocale cleanup, return abort cleanup)
- `app/src/components/Markdown.tsx` (full file rewrite, 113 lines — same plugin chain + sanitize schema preserved verbatim; new additions integrated cleanly):
  - `import ReactMarkdown, { type Components } from 'react-markdown'` (was just `ReactMarkdown`)
  - SC-5(c) Pitfall 4 fix: `sup: [...(defaultSchema.attributes?.['sup'] ?? []), 'dataCite', 'style']` (was `sup: ['dataCite', 'style']`)
  - New `citationComponents: Components` object with sup / a / section overrides
  - `<ReactMarkdown components={citationComponents} ...>` JSX
- `.planning/REQUIREMENTS.md` (CONTENT-01, CONTENT-03, CONTENT-04 marked `[x]`; traceability table updated)
- `.planning/ROADMAP.md` (Phase 41 plan list — 41-02 marked `[x]`)
- `.planning/STATE.md` (close-out section + plan progression — appended Last decisions block)

## Test Baselines

| Suite | Pre-Plan-41-02 (post-41-01) | Post-Plan-41-02 | Delta |
|-------|------------------------------|-----------------|-------|
| `tsc -b --noEmit` | exit 0 | exit 0 | unchanged |
| `npm run test:main` | 626 pass / 2 fail | **655 pass / 2 fail** | +29 passes (11 post-essay-depth + 10 PostDetailScreen-abort-threading + 8 Markdown-citation-overrides) |
| `npm run test:actions` | 16/16/0 | 16/16/0 | unchanged |

**Pass count exceeds plan's expected lower bound.** The 2 remaining test:main failures are the SAME pre-existing carry-overs from Plan 39-01 / 40-01 / 41-01 close:

1. `tests/concept-feed.test.mjs` — `ERR_MODULE_NOT_FOUND` for extensionless `youtube.service` import (pre-existing extension-resolution issue)
2. `tests/services/trellis-layout.test.mjs:64` — `getVineColor returns one of the 5 --node-* variables` date-dependent assertion (pre-existing timezone/date-sensitive test)

Neither failure mentions post-essay-depth, PostDetailScreen-abort-threading, Markdown-citation-overrides, or any Phase 41 file. Phase 41 Plan 41-02 introduces ZERO regressions.

## Decisions Made

- **SC-7(a) regex anchor permits trailing inline comments.** Initial regex `if \(abortController\.signal\.aborted\) return[^;]*;\s*\n\s*for await/g` matched 0 because the trailing `// Phase 41 SC-7 — pre-call guard` comment doesn't end in `;`. Updated to `/if \(abortController\.signal\.aborted\) return;[^\n]*\n\s*for await/g` — anchors on the literal `;` then permits any non-newline characters (the comment) before the line break. 3 matches as expected.
- **Essay useEffect block scoped via SECOND occurrence of "On-enter essay generation".** The FIRST occurrence is the state-block comment near the top of the component (line ~80); the SECOND opens the actual useEffect (line ~282). End boundary chosen as `Fetch cached images` (the carousel useEffect comment that follows the essay useEffect) — bounded the source-reading window precisely without false-positiving on later useEffects.
- **Footnote prompt instruction uses explicit numeric markers `[^1]`, `[^2]`, `[^3]` (not `[^N]` placeholder).** D-04 verbatim. Concrete examples are clearer to the LLM and match the test's `assert.match(/\[\^1\]/)` etc. Test additionally asserts the case-insensitive substring `footnotes section` to lock the section emission instruction.
- **patchPostEssayInCache selective merge: truthiness check on bodyMarkdown via `essay.bodyMarkdown && essay.bodyMarkdown.trim() !== ''`.** Empty string AND whitespace-only string both treated as "not regenerated" — matches the existing `if (post.bodyMarkdown && post.bodyMarkdown.trim() !== '') return;` skip pattern in PostDetailScreen.tsx essay useEffect. Symmetric for bodyMarkdownDeep. whyCare/takeaway use simple truthiness (1-sentence fields where empty string is unambiguous "not generated"). quickAskPrompts uses truthiness (replaces if defined — empty array `[]` is truthy in JS so it WILL replace; explicit `undefined` skips).
- **Trailing options bag for generateConnectionPost / generateDiscoverPost (Pitfall 6).** Both functions had no options bag pre-Phase-41. Adding `options?: { signal?: AbortSignal }` as the trailing positional parameter preserves all existing call sites (positional callers omit the trailing arg = `options` undefined = signal undefined = pre-Phase-41 behavior). PostDetailScreen.tsx Task 5 immediately consumes the new bag.
- **Markdown.tsx full-file rewrite over Edit-tool patches.** The plan listed too many discrete additions (Components type import, citationComponents object, components prop wiring on JSX, SC-5(c) sup-attr fix) for clean atomic patches; full rewrite preserves the existing plugin chain + sanitize schema + KaTeX import while making the additions reviewable as a single semantic unit. Counterweight test guards plugin chain + sanitize tagNames + dataCite + span/div spread to catch any regression.
- **react-markdown v10 exports `type Components` directly from index.** Verified via `node_modules/react-markdown/index.d.ts:2` (`export type Components = import("./lib/index.js").Components`); no shim or local type definition needed. tsc -b --noEmit exits 0 throughout.
- **data-footnote-ref / data-footnote-backref discriminator chosen over href-prefix matching.** The hast-util-sanitize default schema applies a clobber prefix (e.g. `user-content-fn-N`) that may be overridable by callers; relying on the prefix is brittle. The data attributes are emitted by remark-gfm regardless of clobber prefix and survive sanitize.
- **News post `bodyMarkdown: ''` invariant preserved.** This plan changed only the on-enter streamer (`generateNewsEssay`); news creation at concept-feed.service.ts:1083 (`bodyMarkdown: ''` literal) is unchanged. CLAUDE.md "News post pipeline" load-bearing rule held; tests/services/post-essay.service.test.mjs `news branch defers body to streaming` test confirms it (still 6/6 green).
- **Phase 35 byte-stable system-prompt rule does NOT apply.** Per CLAUDE.md "Other one-shot LLM call sites" footnote rule 6: post-essay generators are one-shot calls (no multi-turn history), so depth-conditional prompts and dynamic content interpolation are intentional. No "consistency-fix" with useQuestions.ts pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] SC-7(a) regex anchor adjustment for trailing inline comments**

- **Found during:** Task 5 first test run after writing the test file
- **Issue:** Initial SC-7(a) regex `/if \(abortController\.signal\.aborted\) return[^;]*;\s*\n\s*for await/g` matched 0 of the 3 expected pre-call guards because the trailing inline comment (`// Phase 41 SC-7 — pre-call guard`) doesn't end in `;`. The pattern required `;` after `return` AND another `;` before the comment, which doesn't exist.
- **Fix:** Updated regex to `/if \(abortController\.signal\.aborted\) return;[^\n]*\n\s*for await/g` — anchors on the literal `return;` (the actual statement terminator) then permits any non-newline characters (the comment) before the line break + for-await opener.
- **Files modified:** `app/tests/screens/PostDetailScreen-abort-threading.test.mjs` (folded into Task 5 commit `6c3fa72d`)
- **Why this is in scope:** Task 5 source change (added 3 pre-call guards with trailing inline comments) directly broke the test pattern as initially written. Adjustment is in the same commit as the source change.

**2. [Rule 3 — Blocking] Essay useEffect block scoped via SECOND occurrence of "On-enter essay generation" marker**

- **Found during:** Task 5 first test run after writing the test file
- **Issue:** Initial `essayUseEffectBlock()` helper used `SRC.indexOf('On-enter essay generation')` which returned the FIRST occurrence (state-block comment near the top of the component at line ~80) — but the actual essay useEffect is at line ~282 with its own opening comment "On-enter essay generation: stream bodyMarkdown when post has empty body". The `useEffect(` boundary search then returned the wrong useEffect.
- **Fix:** Updated helper to find the SECOND occurrence of the marker (`SRC.indexOf('On-enter essay generation', firstMarker + 1)`) AND switched the end boundary from `useEffect(` to the `Fetch cached images` comment of the carousel useEffect that follows.
- **Files modified:** `app/tests/screens/PostDetailScreen-abort-threading.test.mjs` (folded into Task 5 commit `6c3fa72d`)
- **Why this is in scope:** Test infrastructure design issue caught during the first test-run iteration; fix folded into the same commit as the source change.

### No Other Deviations

The plan's task list, file list, action steps, and acceptance criteria executed verbatim aside from the two Rule 3 in-test-iteration fixes folded into the affected test commit. No Rule 1 (production bug) events. No Rule 2 (missing critical functionality) events. No Rule 4 (architectural questions) events.

## Issues Encountered

None beyond the two Rule 3 in-test-iteration fixes documented above. Both are test-infrastructure regex/scoping issues local to the new test file; neither indicates a production-code issue.

## User Setup Required

None. Plan 41-02 is pure-source + interface extension + test additions; no new external services, no new env vars, no migrations. Existing Tavily / LLM provider key requirements are unchanged.

## Next Phase Readiness

**Phase 41 complete; Phase 43 unblocked for Deep dive button + engagement UI.** Plan 41-02 delivers the API surface Phase 43 will consume:

- `generatePostEssay(post, questions, { depth: 'deep' })` — Phase 43's Deep dive button calls this, then `patchPostEssayInCache(postId, { bodyMarkdownDeep, ...meta })` to persist; toggle render between `post.bodyMarkdown` (standard) and `post.bodyMarkdownDeep` (deep) based on toggle state.
- The `bodyMarkdownDeep` field is already on PostSnapshot (inherited by DailyPost) and surfaces through patchPostEssayInCache's selective merge (Pitfall 9-safe).
- All 3 PostDetailScreen essay branches now uniformly thread the AbortSignal — the Deep dive button can mid-stream cancel an in-flight standard generation if the user requests deep before standard finishes (Phase 43's UX concern).
- ReactMarkdown citation overrides render footnote chips inline AND a styled footnotes section at the end of news essays — operator UAT confirms visual quality after Phase 43 ships the user-facing trigger (or earlier, by manually opening any news post that has Tavily sources).

**Closes:**

- **CONTENT-01** — Deep dive API + bodyMarkdownDeep field shipped (Phase 43 owns the user-facing button)
- **CONTENT-03** — Multi-snippet grounding via sources.slice(0, 3) (Plan 41-01 widened Tavily maxResults to 3 + stored multi-snippet shape; Plan 41-02 consumes the shape)
- **CONTENT-04** — ReactMarkdown sup/a/section component overrides for clean footnote presentation

**Phase 41 totals:** Plan 41-01 (5 commits incl. close-out: 4 source/test + 1 docs) + Plan 41-02 (7 commits incl. close-out: 6 source/test + 1 docs) = ~12 atomic commits across the 2 plans. Test baseline: pre-Phase-41 583/2 → post-Phase-41 655/2 (+72 passes net across the 6 new test files and behavioral additions). Phase 41 introduces ZERO regressions; both pre-existing carry-over failures unchanged.

## Self-Check

After writing this SUMMARY, the following claims are verified by direct inspection:

- File `app/src/types/index.ts` modified: `grep -c "bodyMarkdownDeep?: string" app/src/types/index.ts` returns 1 ✓
- File `app/src/services/post-essay.service.ts` modified: `grep -c "depth?: 'standard' | 'deep'" app/src/services/post-essay.service.ts` returns 1 ✓; `grep -c "bodyMarkdownDeep" app/src/services/post-essay.service.ts` returns ≥2 ✓
- File `app/src/services/concept-feed.service.ts` modified: `grep -c "options?: { signal?: AbortSignal }" app/src/services/concept-feed.service.ts` returns 2 ✓
- File `app/src/screens/PostDetailScreen.tsx` modified: `grep -c "{ signal: abortController.signal }" app/src/screens/PostDetailScreen.tsx` returns 4 ✓ (one per branch generator call + the meta call)
- File `app/src/components/Markdown.tsx` modified: `grep -c "type Components" app/src/components/Markdown.tsx` returns 1 ✓; `grep -c "components={" app/src/components/Markdown.tsx` returns 1 ✓
- File `app/tests/services/post-essay-depth.test.mjs` exists ✓ (created in Task 2, extended in Task 3)
- File `app/tests/screens/PostDetailScreen-abort-threading.test.mjs` exists ✓ (created in Task 5)
- File `app/tests/components/Markdown-citation-overrides.test.mjs` exists ✓ (created in Task 6)
- Commit `6ba839de` (Task 1) exists in `git log` ✓
- Commit `e8634daa` (Task 2) exists in `git log` ✓
- Commit `a19b2fa5` (Task 3) exists in `git log` ✓
- Commit `aaee719a` (Task 4) exists in `git log` ✓
- Commit `6c3fa72d` (Task 5) exists in `git log` ✓
- Commit `397d388a` (Task 6) exists in `git log` ✓
- `cd app && npm test` exits with the expected baseline (655 pass / 2 fail in test:main; 16/16/0 in test:actions) ✓
- `cd app && npx tsc -b --noEmit` exits 0 ✓
- News post `bodyMarkdown: ''` invariant preserved (CLAUDE.md "News post pipeline"): `tests/services/post-essay.service.test.mjs` `news branch defers body to streaming` test still green (6/6) ✓
- Phase 36-12 `_refillMutex` discipline preserved (Task 4 only touched generator signatures + chatStream call; no new throw paths added in concept-feed.service.ts changes) ✓

## Self-Check: PASSED
