---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: gap closure)
status: executing
stopped_at: Completed 42-02-homescreen-swap-PLAN.md
last_updated: "2026-05-10T01:29:38.918Z"
last_activity: 2026-05-10
progress:
  total_phases: 21
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: v1.5 ROADMAP CREATED — 2026-05-08

## Current Position

Phase: 42 (masonry-feed-layout) — EXECUTING
Plan: 4 of 7
Status: Ready to execute
Last activity: 2026-05-10

## Progress

**Phases:** 2 / 9 complete (37 ✓; 38 ✓; 39 ready for verification; 40 ready for verification; 41 ready for verification 2/2 plans; 42 in flight 3/7 plans; 43-45 pending)
**Plans:** 3 / 7 complete in Phase 42 (42-01 masonry-feed-skeleton ✓; 42-03 card-slide-in-removal ✓; 42-06 roadmap-requirements-wording-correction ✓; 42-02 / 42-04 / 42-05 / 42-07 pending); 2 / 2 complete in Phase 41 (41-01 source-diversity-wiring ✓; 41-02 essay-depth-citation-rendering ✓); 1 / 1 complete in Phase 40 (40-01 source-diversity-service ✓); 1 / 1 complete in Phase 39 (39-01 engagement-service ✓)

```
[████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 38%
```

### Wave Order

- **Wave 0** (carry-over cleanup): Phase 37 (i18n leaf-module) + Phase 38 (v1.4 carry-overs) — parallel-safe, both unblock Wave 1
- **Wave 1** (foundation services): Phase 39 (engagement) + Phase 40 (source diversity) — parallel-safe, requires Wave 0
- **Wave 2** (service integration): Phase 41 (pipeline + essay depth) — requires Wave 1
- **Wave 3** (UI layer): Phase 42 (masonry) → Phase 43 (engagement UI) — sequential, requires Wave 2
- **Wave 4** (hygiene sweep): Phase 44 (deps) + Phase 45 (code quality) — parallel-safe, lands LAST

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-08 — milestone v1.5 started)

**Core value:** Enable learners to transform fragmented information into structured knowledge through AI-driven Q&A, visual mapping, and adaptive spaced repetition — all while maintaining complete local-first privacy.

**Current focus:** Phase 42 — masonry-feed-layout

## Requirement Coverage

22 / 22 requirements mapped to phases ✓ (no orphans)

| Category | Count | Phases |
|----------|-------|--------|
| MASONRY | 2 | Phase 42 |
| ENGAGE | 4 | Phase 39 (×3), Phase 43 (×1) |
| CONTENT | 4 | Phase 40 (×1), Phase 41 (×3) |
| TECHDEBT | 12 | Phase 37 (×1), Phase 38 (×5), Phase 44 (×1), Phase 45 (×5) |

## Carry-overs from v1.4 (in scope for v1.5)

All carry-overs are scheduled into Wave 0:

- **i18n leaf-module refactor** (TECHDEBT-01) → Phase 37
- **VALIDATION drift cleanup 34/35** (TECHDEBT-02) → Phase 38
- **ROADMAP plan-list polish 36-14/36-15** (TECHDEBT-03) → Phase 38
- **33-HUMAN-UAT-1/2 device retest** (TECHDEBT-04) → Phase 38
- **CLAUDE.md `echolearn_*` doc-drift** (TECHDEBT-05) → Phase 38
- **YouTube landscape-listed-as-short bug** (TECHDEBT-06) → Phase 38

## Resolved blockers

All v1.4 blockers resolved at close. No open blockers.

## Last decisions (Plan 42-02 close, 2026-05-10)

- **`useMemo` over bare const for `allExplored`.** `/home` is always-mounted in `SwipeTabContainer` and re-renders on every event-bus emission; the `.filter(q => q.isAnchorNode).every(a => exploredAnchors.includes(a.id))` chain is O(N×M) and would otherwise run on every render. Dep array `[questions, exploredAnchors]` is the precise mutating-input pair. `useMemo` was already imported at line 1, so no import diff was needed.
- **`allExplored` placement immediately after `isComplete` (line 469).** Colocated with the other `exploredAnchors`-derived `useMemo` blocks (`exploredCount` line 468, `conceptList` line 472-489). Future maintainers see the full vine-state derivation cluster in one place.
- **Empty-but-documented `else` block for the deleted toast (D-11) over flattening the if/else chain.** Preserves the pre-existing conditional shape exactly; inline comment names plan 42-04 as the celebration-card surface owner so future readers don't try to re-add a toast. The plan explicitly prescribed this no-op style ("Keeping the else block as a documented no-op (rather than removing the entire if/else chain) preserves the surrounding control flow exactly.").
- **`InlineInfoFlow` named import dropped, but `type InfoFlowItem` import preserved.** The `infoFlowItems` useMemo at line 391 declares its return type as `InfoFlowItem[]`, and the runtime type still flows through to `<MasonryFeed items={infoFlowItems}>`. D-01 — InlineInfoFlow stays exported from InfoFlow.tsx for future surfaces; only the `/home` wire moves to MasonryFeed.
- **Parallel-staging race forced 3 GREEN-attempt commits before HomeScreen.tsx actually landed.** Commits `78501855` and `3e494473` carried my plan-42-02 commit message but ended up attached to plan-42-04 sibling content (MasonryFeed.tsx body fill, then en.json i18n keys). Between each `git add app/src/screens/HomeScreen.tsx` and the subsequent `git commit -m "..."`, the parallel plan-42-04 agent's `git add` calls re-mutated the index. Resolution: `git commit -o app/src/screens/HomeScreen.tsx -m "..."` locks the file path at commit time. Final HomeScreen wire commit: `100be6c0`. **All three feat commits land valid end-state code** — only the file→message attribution is shuffled. Same class as Plan 38-02's parallelism artifact (commit `01d870e5`); now logged as a recurring pattern. Lesson: **future parallel executors should default to `git commit -o <path> -m "..."`** when sibling agents may stage files concurrently.
- **tsc errors in `MasonryFeed.tsx` + `InfoFlow.tsx` are out of scope.** Verified by stashing those sibling-agent files and running `tsc -b --noEmit` against my isolated `HomeScreen.tsx` change — exits 0. Per CLAUDE.md SCOPE BOUNDARY rule. Their tsc-clean state is the responsibility of plans 42-03 / 42-04.
- **Plan 42-02 close-out: 1 RED test commit + 3 feat commits (race-recovery sequence) + close-out commit.** This plan's contribution to the test pass count: +10 source-reading guards (1 describe block, 10 `it` cases, all green). MASONRY-01 + MASONRY-02 marked complete in REQUIREMENTS.md (MASONRY-01 was already marked by the sibling plan 42-04 wire; MASONRY-02 newly marked here for the toast-deletion + allExplored prep — the celebration card body itself is shipped by plan 42-04).

## Last decisions (Plan 42-03 close, 2026-05-10)

- **Underscore-prefix rename of ConceptCard's destructured `isActive` → `_isActive` (Rule 1 auto-fix in Task 2).** The plan asserted `isActive` is "consumed elsewhere in the card body (e.g., for image loading state)" — empirically incorrect for ConceptCard specifically: the destructured local at line 73 was only consumed by the deleted animation expression at line 197. Once the animation was removed, tsc fired TS6133. Rename preserves the prop on `ConceptCardProps` (line 69), the React.memo equality comparator at line 563 (`prev.isActive === next.isActive`), and the JSX call site at line 862 (`isActive={shouldAnimate}`). The underscore prefix matches the project's existing unused-arg convention (sibling `_feedIndex` on the same line). Folded into Task 2 commit `2fb5df8c`.
- **Pre-existing tsc errors in MasonryFeed.tsx are explicitly out of scope.** Twelve TS2345 errors reference `home.celebration.*` i18n keys not yet declared in `en.json` / `i18n.d.ts` — sibling-Wave Plan 42-04 (vine-bloom-card-and-i18n) territory. Per CLAUDE.md scope-boundary rule ("Only auto-fix issues DIRECTLY caused by the current task's changes"), NOT touched. Verified via `npx tsc -b --noEmit | grep InfoFlow` returning empty — Task 2 introduced zero new tsc errors in InfoFlow.tsx.
- **Both commits used `--no-verify`** per the parallel-execution protocol declared by the orchestrator. Sibling Wave 2 agents (42-02 HomeScreen swap, 42-04 vine-bloom-card-and-i18n) are running concurrently; orchestrator validates pre-commit hooks once after all agents complete.
- **Strict file-staging discipline** (lesson from Plan 38-02 close decision on parallelism artifact): explicit `git add app/src/index.css` (Task 1) and `git add app/src/components/InfoFlow.tsx` (Task 2) only — never `git add -A` or `.`. Sibling-agent in-progress writes (MasonryFeed.tsx, HomeScreen.tsx, .DS_Store, Android resource files) NOT captured by either commit.
- **Cross-tree negative grep is the load-bearing acceptance check.** `grep -rn "card-slide-in" app/src/` exits 1 (no matches) across the entire src tree (was 4 occurrences — 1 in index.css + 3 in InfoFlow.tsx). D-06 satisfied (one animation system, not two; framer-motion at the MasonryFeed wrapper now owns ALL feed-entrance animation). Plan 42-05 will add `tests/lib/no-card-slide-in.test.mjs` to lock this against future drift.
- **Plan 42-03 close-out: 2 atomic per-task commits + close-out commit.** No new tests added (this plan is pure-deletion; Plan 42-05 will add the source-reading invariant test). Test baseline preserved exactly — `app/tests/` had zero references to `card-slide-in` pre-deletion (verified via `grep -rn "card-slide-in" app/tests/` returning empty), so no test updates were required. Total deviations: 1 auto-fixed (Rule 1 — TS6133 on now-unused destructured local).

## Last decisions (Plan 41-02 close, 2026-05-09)

- **SC-7(a) regex anchor permits trailing inline comments.** Initial regex `if \(abortController\.signal\.aborted\) return[^;]*;\s*\n\s*for await/g` matched 0 because the trailing `// Phase 41 SC-7 — pre-call guard` comment doesn't end in `;`. Updated to `/if \(abortController\.signal\.aborted\) return;[^\n]*\n\s*for await/g` — anchors on the literal `;` then permits any non-newline characters before the line break + for-await opener. Rule 3 in-test-iteration fix folded into Task 5 commit `6c3fa72d`.
- **Essay useEffect block scoped via SECOND occurrence of "On-enter essay generation".** The FIRST occurrence is the state-block comment near the top of the component (line ~80); the SECOND opens the actual useEffect (line ~282). End boundary chosen as `Fetch cached images` (the carousel useEffect comment that follows the essay useEffect) — bounded the source-reading window precisely without false-positiving on later useEffects. Rule 3 in-test-iteration fix folded into Task 5 commit.
- **Footnote prompt instruction uses explicit numeric markers `[^1]`, `[^2]`, `[^3]` (not `[^N]` placeholder).** D-04 verbatim. Concrete examples are clearer to the LLM and match the test's `assert.match(/\[\^1\]/)` etc. Test additionally asserts the case-insensitive substring `footnotes section` to lock the section emission instruction.
- **patchPostEssayInCache selective merge: truthiness check on bodyMarkdown via `essay.bodyMarkdown && essay.bodyMarkdown.trim() !== ''`.** Empty string AND whitespace-only string both treated as "not regenerated" — matches the existing `if (post.bodyMarkdown && post.bodyMarkdown.trim() !== '') return;` skip pattern in PostDetailScreen.tsx. Symmetric for bodyMarkdownDeep. whyCare/takeaway use simple truthiness; quickAskPrompts uses truthiness check (replaces if defined; explicit `undefined` skips).
- **Trailing options bag for generateConnectionPost / generateDiscoverPost (Pitfall 6 — back-compat).** Both functions had no options bag pre-Phase-41; positional callers (e.g. PostDetailScreen pre-Task-5) remain valid. Task 5 immediately consumes the new bag.
- **Markdown.tsx full-file rewrite over Edit-tool patches.** The plan listed too many discrete additions (Components type import, citationComponents object, components prop wiring, SC-5(c) sup-attr fix) for clean atomic patches; full rewrite preserves the existing plugin chain + sanitize schema + KaTeX import while making the additions reviewable as a single semantic unit. Counterweight test guards plugin chain + sanitize tagNames + dataCite + span/div spread to catch any regression.
- **react-markdown v10 exports `type Components` directly from index** — verified via `node_modules/react-markdown/index.d.ts:2`; no shim or local type definition needed. tsc -b --noEmit exits 0 throughout.
- **data-footnote-ref / data-footnote-backref discriminator chosen over href-prefix matching.** The hast-util-sanitize default schema applies a clobber prefix (e.g. `user-content-fn-N`) that may be overridable by callers; relying on the prefix is brittle. The data attributes are emitted by remark-gfm regardless of clobber prefix and survive sanitize.
- **News post `bodyMarkdown: ''` invariant preserved** (CLAUDE.md "News post pipeline" load-bearing rule). Plan 41-02 changed only the on-enter streamer (`generateNewsEssay`); news creation at concept-feed.service.ts:1083 (`bodyMarkdown: ''` literal) is unchanged. tests/services/post-essay.service.test.mjs `news branch defers body to streaming` test still 6/6 green.
- **Phase 35 byte-stable system-prompt rule does NOT apply** (per CLAUDE.md "Other one-shot LLM call sites" footnote rule 6). post-essay generators are one-shot calls (no multi-turn history), so depth-conditional prompts and dynamic content interpolation are intentional.
- **CONTENT-01 + CONTENT-03 + CONTENT-04 promoted from `[ ]` to `[x]`.** Phase 41 fully closes its 3 requirements. Phase 43 owns the user-facing "Deep dive" button (consumes the API + cache field shipped here); Phase 41-02 ships the API + tests + rendering only.
- **Plan 41-02 close-out: 6 atomic per-task commits + close-out commit.** Test baseline: pre-Plan-41-02 626/2 → post-Plan-41-02 655/2 (+29 passes: 11 post-essay-depth + 10 PostDetailScreen-abort-threading + 8 Markdown-citation-overrides; same 2 pre-existing carry-over failures from Plan 39-01 / 40-01 / 41-01 — `tests/concept-feed.test.mjs` ERR_MODULE_NOT_FOUND for extensionless youtube.service import + `tests/services/trellis-layout.test.mjs:64` getVineColor date-dependent assertion). test:actions 16/16/0 unchanged. tsc -b --noEmit exits 0.

## Last decisions (Plan 41-01 close, 2026-05-09)

- **Walker integration test targets walkDerivedList directly per Pitfall 7, NOT a mocked refillQueue end-to-end.** Mocking refillQueue would require stubbing settings + Tavily + YouTube + post-history + dailyRead + concept-feed-dedup + style-assignment + ~5 other transitive deps — brittle and slow. The semantic load-bearing seam is `walkDerivedList(count, exploredIds, dismissedIds)`. Test setup mirrors `derived-list.test.mjs`'s Phase 39 dismiss-skip cases.
- **Outcome-based reset() test per Pitfall 8 (NOT mock.callCount === 1).** `reset()` is idempotent — `Map.clear()` on already-empty Map is a no-op. The plan-prescribed call-count test would FAIL if loadCache fires multiple times during stale-date scenarios (legitimate behavior until saveCache(today) writes a fresh entry). End-state assertion `recordServedDomain → reset → getUsedDomains returns empty Set` is invariant regardless.
- **Multi-snippet shape stored at creation loop only.** Pre-fetch loop stores ONLY `filtered[0]` as `chosen` into `preFetched.news` (one result per anchor; matches Promise.all pattern). The creation loop's cached-branch wraps single cached result as `topSources = [cached]` for back-compat. Full multi-snippet `topSources = filtered.slice(0, 3)` array is built only when creation loop calls webSearch directly (cache miss). No structural change to pre-fetch.
- **Conditional `exclude_domains` body set (Pitfall 1).** Always-set with empty array would also work (Tavily ignores empty), but the conditional pattern matches the existing `includeImages` conditional at web-search.service.ts:48-50 — minimal wire payload + consistent code style.
- **Auto-fix Rule 1 #1 fold into Task 2 commit `83804b5c`:** post-essay.service.test.mjs window 2500 → 3500. The Phase 41 source-diversity wiring block (~600 chars: cached branch + topSources + getUsedDomains + 3-line excludeDomains+maxResults webSearch + filterForDiversity + slice) pushed `snippet:` past the 2500 cap. Window-bump-with-comment auto-fix discipline applied (comment names Phase 41-01 as the source). Same window-fragility class as Plan 39-01's image-gen-key-gate fix.
- **Auto-fix Rule 1 #2 fold into Task 4 commit `436e8279`:** concept-feed-cache-date.test.mjs regex (one-liner → braced block) + window 1200 → 1800. Phase 41 Plan 41-01 Task 3 wrapped the early return in a braced block to call sourceDiversityService.reset(). Hard-coded one-liner regex `/parsed\.date !== today\(\)\)\s*return\s+null/` no longer matched. Updated to multiline-aware optional-braced-block pattern; window bumped to capture new return-null position past the 4-line comment block.
- **Walker call at concept-feed.service.ts:1212 UNTOUCHED per plan instruction.** Phase 39 D-07 wired `walkDerivedList(16, exploredIds, dismissedIds)` with `dismissedIds = new Set(engagementService.getDismissedAnchorIds())` correctly. Plan 41-01 SC-1 only ADDS the integration test; the wire was already correct. Counterweight test asserts continued presence of the verbatim line + Set construction.
- **`bodyMarkdown: ''` invariant preserved at news creation post object.** The pre-Phase-41 5-line comment block above `bodyMarkdown: ''` (explaining the 2026-04-19 truncated-snippet regression) is intact. Only the surrounding wiring (cached-branch handling + topSources construction + after-commit recordServedDomain) changed. CLAUDE.md "News post pipeline" load-bearing rule held.
- **`extractDomain` undefined-guard pattern at both recordServedDomain call sites.** Phase 40 D-10 made `extractDomain` defensive (returns undefined for malformed URLs via try/catch around `new URL(...)`). The guard `const domain = extractDomain(url); if (domain) sourceDiversityService.recordServedDomain(...)` prevents polluting the per-anchor used set with literal 'undefined' string. Counterweight test asserts both call sites use this pattern.
- **CONTENT-02 promoted from `◐ Partial` → `✓ Complete` in REQUIREMENTS.md traceability table.** Phase 40 shipped the leaf (5-function singleton + DOMAIN_TIERS + PSL slice); Phase 41-01 wired the leaf into Tavily (excludeDomains body field + getUsedDomains/filterForDiversity/recordServedDomain triple at both news call sites + day-boundary reset). User-visible behavior — repeat-anchor refills surface fresh sources — now shippable. Status row updated to `Phase 40+41 / Wave 1+2 / ✓ Complete`.
- **Plan 41-01 close-out: 4 atomic per-task commits + close-out commit (this).** Test baseline: pre-Plan-41-01 603/2 → post-Plan-41-01 626/2 (+23 passes: 7 web-search-exclude-domains + 4 day-boundary-reset + 12 source-diversity-wiring; same 2 pre-existing carry-over failures from Plan 40-01: tests/concept-feed.test.mjs ERR_MODULE_NOT_FOUND for extensionless youtube.service import + tests/services/trellis-layout.test.mjs:64 getVineColor date-dependent assertion). test:actions 16/16/0 unchanged. tsc -b --noEmit exits 0.

## Last decisions (Plan 40-01 close, 2026-05-09)

- **DOMAIN_TIERS authored at 219 entries (above ~180-200 target).** Above-target depth came from broader academic publisher coverage (added Springer, Wiley, Cambridge, OUP, ScienceDirect, Tandfonline, Frontiers, Plos, USENIX) and finer social/UGC distinction (Twitter/X 0.10 vs LinkedIn 0.25; Stack Overflow 0.45 separate from Stack Exchange 0.35). Operator can override any entry in PR review. RESEARCH § 1's per-tier-count guidance was a soft target; quality-gating each entry against D-03 editorial line is the real gate.
- **Special-cased plato.stanford.edu (0.85), ProPublica (0.85), Harvard Health (0.85)** as journalism-tier quality despite encyclopedic/general-interest classification. Stanford Encyclopedia of Philosophy is peer-reviewed, ProPublica is investigative journalism, Harvard Health is primary-source clinical content. RESEARCH § 1's mid-tier classification was conservative; the operator's editorial-line directive (D-03) supports the bump.
- **Docstring de-collision applied PROACTIVELY (Phase 39 lesson — "engagement-service docstring de-collision proactive Rule 2 fix").** The leaf header originally listed forbidden patterns verbatim ("No `await`, no `fetch`, no `chatStream`, no `chatCompletion`, no I/O" + "No `async` keyword anywhere" + "No localStorage"). These literal substrings would have false-positively matched the plan's `! grep -q '\basync\b'` and `! grep -q 'chatStream|chatCompletion'` and `! grep -q 'localStorage'` acceptance grep checks. Rephrased to surrogate language ("No deferred-execution function declarations", "no suspending expression", "no LLM call", "no browser-storage read or write"). The actual runtime anti-wire test uses `/\basync\s/` (whitespace-anchored) which would have been safer (excludes backtick-wrapped instances like `` `async` ``), but the plan's structural grep assertions are stricter (word-boundary only) and forced the rephrase. Cost: ~3 lines of header text. Same root cause + fix as Plan 39-01 close decision.
- **Anti-wire test sanity-check performed (per plan).** Temporarily injected `async function _antiwire_probe() { await Promise.resolve(); }` into source-diversity.service.ts → assertion fired with the expected message at line 46 → reverted; clean test run confirmed all 4 assertions still pass against the production source. Probe never landed in any commit.
- **Phase 41 boundary held strictly.** ZERO edits to concept-feed.service.ts, web-search.service.ts, or any consumer. ZERO recordServedDomain call sites added. ZERO Tavily maxResults widening. ZERO WebSearchOptions excludeDomains field added. Phase 40 ships the leaf only; Phase 41 owns the wiring (news pre-fetch loop ~line 1293, news creation loop ~line 1083, day-boundary `reset()` at `loadCache()`'s date-mismatch branch).
- **CONTENT-02 marked PARTIAL (not complete) in REQUIREMENTS.md.** Per plan output spec — Phase 40 ships the leaf (5-function singleton + DOMAIN_TIERS + PSL slice); Phase 41 ships the Tavily wire (`exclude_domains` field threaded into `WebSearchOptions`). Both halves are required to fulfill the requirement's user-visible behavior ("repeated Tavily calls for the same anchor pass `exclude_domains`"). Status row in traceability table: `◐ Partial (Phase 40 leaf complete; Phase 41 wires into Tavily)`.
- **Plan 40-01 close-out: 3 atomic per-task commits + close-out commit.** Test baseline: pre-Phase-40 583/2 → post-Plan-40-01 603/2 (+20 passes: 16 behavioral test cases + 4 anti-wire assertions; same 2 pre-existing carry-over failures from Plan 39-01 — `tests/concept-feed.test.mjs` ERR_MODULE_NOT_FOUND on extensionless youtube.service import + `tests/services/trellis-layout.test.mjs:64` getVineColor date-dependent assertion). test:actions 16/16/0 unchanged. tsc -b --noEmit exits 0. Pass count exceeds plan's expected lower bound of 601.

## Last decisions (Plan 39-01 close, 2026-05-09)

- **Storage key `trellis_engagement_v1` locked verbatim.** The `_v1` suffix is unusual (other Trellis keys are unsuffixed) but mandated by ROADMAP success criterion #1; not normalized away. Future schema migrations would bump the suffix in a separate phase.
- **Defense-in-depth anti-wire enforcement (D-06).** Two tests lock the invariant that no code path emits both `ANCHOR_DISMISSED` and `CONCEPT_EXPLORED` for the same call: (a) BEHAVIORAL — `engagement.service.test.mjs` case 6 captures the event-bus log on a `dismissAnchor` call and asserts exactly 1 dismiss event + 0 engagement-change events + 0 explored events; (b) STATIC — `engagement-anti-wire.test.mjs` walks every `.ts/.tsx` file under `app/src/` and scans for the two emit substrings within an 800-char window, with a counterweight assertion that `engagement.service.ts` IS in the scan list AND emits at least one dismiss event (catches future scope drift). Manual sanity-checked: temporarily injecting a co-emit triggers the test failure with offset diagnostics; reverted.
- **Walker third arg `dismissedIds` is REQUIRED positional, NOT defaulted (D-07).** Defaulting to `new Set()` would let new callers silently bypass dismiss-skip behavior. Required arg forces explicit consideration. Cost was one line at the single existing caller (`concept-feed.service.ts:1209`); benefit is structural. Phase 36 GAP-B `Math.max(count * 2, len)` math + comment block preserved verbatim — load-bearing per CLAUDE.md "Concept Feed Generation Pipeline" section.
- **ESM cycle `engagement.service` ↔ `post-history.service` is acceptable as value-level cycle.** `engagementService.getSavedPosts/getLikedPosts` invoke `postHistoryService.getPosts()` at call time; `postHistoryService.purgeExpired()` invokes `engagementService.getPinnedIds()` at call time. Neither side touches the other at module-init time. Both top-levels only declare functions/objects; both deferred reads happen at call time. tsc -b --noEmit exits 0; engagement.service.test.mjs runs cleanly. New canonical pattern documented in SUMMARY frontmatter `patterns-established`.
- **Engagement-service docstring de-collision (proactive Rule 2 fix during Task 2).** Original docstrings directly named ANCHOR_DISMISSED, ENGAGEMENT_CHANGED, and CONCEPT_EXPLORED; this would have caused the Task 4 source-reading anti-wire test to false-positive on the docstring co-occurrence. Rephrased to surrogate names ("anchor-dismiss event" / "explored-anchor signal" / "engagement-change event"). Single literal `ANCHOR_DISMISSED` occurrence is the emit site; ENGAGEMENT_CHANGED count = 5 (one per emit site); CONCEPT_EXPLORED count = 0. Same lesson as Plan 37-03 leaf-shim docstring de-collision.
- **Phase 39 D-07 comment trim in concept-feed.service.ts (Task 8 Rule 1 fix).** My added 6-line Phase 39 D-07 comment block pushed the `hasImageGenKey: imageGenEnabled && (nanoBananaKeyPresent || geminiImageKeyPresent)` assignment past the 6000-char window read by `tests/services/image-gen-key-gate.test.mjs:22`. Trimmed to 3 lines integrated into the existing comment block; Phase 39 D-07 marker preserved verbatim. Test infrastructure fragility (window-based source-reading) is captured as a Phase 44/45 candidate. Same class as the leaf-shim docstring fragility from Plan 37-03.
- **walkDerivedList signature change broke `refill-queue-integration.test.mjs` (Task 8 Rule 3 fix).** Plan listed only `derived-list.test.mjs` as needing the third-arg update; planner could not have known about `refill-queue-integration.test.mjs` without exhaustively scanning `tests/`. Added `, new Set()` as third arg to all 5 walkDerivedList calls in that file. Fix is in scope (my walker change directly broke these). 7/7 tests pass after fix.
- **Plan 39-01 close-out: 8 atomic per-task commits + close-out commit.** Test baseline: pre-Phase-39 579/2 fail → post-Phase-39 583/2 fail (net +4 passes from new test files; both remaining fails are the same pre-existing carry-overs from Phase 37 STATE.md — `tests/concept-feed.test.mjs` ERR_MODULE_NOT_FOUND for extensionless youtube.service import + `tests/services/trellis-layout.test.mjs:64` getVineColor date-dependent assertion). test:actions 16/16/0 (unchanged from Plan 38-02 close baseline). tsc -b --noEmit exits 0. Pass count exceeds plan's expected lower bound of 582.

## Last decisions (Plan 38-04 close, 2026-05-09)

- **Strip `textArtContent` field (not the whole post) on LOCALE_CHANGED.** Removing the post from cache would lose its position in the queue and re-trigger full essay-generation. Stripping only the locale-sensitive field lets `_backgroundGenerateTextArt` regenerate exactly what changed.
- **Reset `_textArtBgRunning = false` inside the same handler.** Without it, an in-flight pre-locale-switch generation that resolves AFTER the strip would be the last writer to the cache, restoring stale content. Resetting the in-flight flag lets the next render path re-fire generation under the new locale. Single-line addition inside the subscriber callback.
- **Delete `makeSeedCards` outright (5 hardcoded English flashcards: Marx / quantum / backprop / supervised / thermodynamics).** Trellis is local-first personalized learning per PROJECT.md; pre-canned mock content contradicts the model. Empty review queue is the correct fresh-install default. Don't write the empty array back to localStorage on first launch — the same `if (!raw) return []` branch runs every load until real cards exist (single localStorage.getItem, negligible cost).
- **Pre-verification confirmed all preconditions before edit (Plan-orchestrator pattern).** Zero `fc-seed`/`makeSeedCards` references outside flashcard.service.ts; `eventBus` already imported at concept-feed.service.ts:4; `LOCALE_CHANGED` event type at types/index.ts:676 with `{ locale: SupportedLocale }` payload. No deviations needed; both edits landed verbatim.
- **Test baseline preserved exactly (566/564/2 + 16/16/0).** Identical to post-Plan-38-02 baseline — both pre-existing main-suite fails (concept-feed.test.mjs ERR_MODULE_NOT_FOUND on extensionless youtube.service import + getVineColor date-dependent assertion) unchanged. Zero new failures.

## Last decisions (Plan 38-02 close, 2026-05-09)

- **STYLE_WEIGHTS rebalance — video absorbed short's 0.10 → video: 0.20** (per CONTEXT.md Claude's discretion + plan_notes STYLE_WEIGHTS REBALANCE). Total sum preserved at 1.0. The new `youtube-no-short-classification.test.mjs` invariant test asserts BOTH invariants (no `short:` key in STYLE_WEIGHTS + sum within 1e-9 tolerance) — first attempt's regex over-matched the trailing comment `// Phase 38: absorbed short's 0.10`, producing sum=1.1; corrected by anchoring on `key: value` pairs after stripping line comments, landed in single Task 6 commit `863132c1`.
- **D-02b hybrid interaction — preserved card-level onClick + e.stopPropagation() on thumbnail.** Chose existing card-level `handleActivate` pattern over RESEARCH.md's "split into two click handlers" suggestion. The card-level `onClick` already covers any non-thumbnail tap (title, teaser, hook, channel attribution); `stopPropagation()` on the thumbnail handles inline-play dispatch. Simpler than introducing a new title-area onClick and matches existing structure. Single-emit semantic enforced by renamed `InfoFlow.video-tap-emit.test.mjs` (4/4 green; markExplored AND CONCEPT_EXPLORED each appear EXACTLY ONCE in InfoFlow.tsx).
- **D-02a aspect-ratio: CSS-only `aspectRatio: 'auto 16 / 9'`** over JS state `[thumbRatio, setThumbRatio]`. Zero new state, no extra render pass; iframe falls back to 16/9 when thumbnail has no intrinsic size yet. RESEARCH.md INV-1e Recommendation followed; device verification deferred to operator UAT (per CONTEXT.md scope).
- **Strategy C atomic commit ordering** — types and immediate consumers (6 files: types/index.ts + youtube.service.ts + concept-feed.service.ts + style-assignment.ts + InfoFlow.tsx + PostDetailScreen.tsx) in single commit `76323eaa` so CI stays green between commits. Subsequent commits (i18n bundles, post-essay, test files, CLAUDE.md, new invariant) are small + bisection-friendly. Chose this over types-first (which would leave tsc red between commits) and over usage-sites-first (which would require flipping the union LAST — same end-state but reverse order).
- **trellis_short_posts localStorage stale data NOT cleaned in legacy-migration.service.ts** — Bucket C deferral per CONTEXT.md. Stale data is harmless once read sites are gone (concept-feed.service.ts:1500+ block deleted; post-essay.service.ts cacheKeys array trimmed). User's existing localStorage entries become orphaned but never read; future Wave-4 hygiene phase MAY add a one-shot delete in `legacy-migration.service.ts` if user-facing storage clutter becomes an issue.
- **Plan 38-02 close-out: 8 tasks across 10 atomic commits + new invariant test + i18n bundle parity preserved.** TECHDEBT-06 acceptance: all 9 must-have truths satisfied (type unions clean, probePortrait deleted, shortAssignments loop deleted, STYLE_WEIGHTS sum=1.0 with video:0.20, GAP-C single-emit migrated, PostDetailScreen guard removed, 4 i18n bundles parity-clean, post-essay cache patch removed, tsc + npm test baselines preserved). Test baseline at close: test:main 566/564/2 (+6 pass cases vs Phase 37 baseline 558/555/3; both remaining fails are pre-existing per Phase 37 STATE.md), test:actions 16/16/0 (improved from baseline 16/14/2). CLAUDE.md GAP-C section retitled "Video post completion signals (Phase 36 GAP-C, generalized in Phase 38 — load-bearing)" with detector inventory + Why-both subsection + Rules 1/3/4 rewritten to reflect video-only world.
- **Parallelism artifact noted (not a regression):** Task 3's commit `01d870e5` accidentally captured 4 sibling-agent state-update writes (STATE.md/ROADMAP.md/REQUIREMENTS.md modifications + 38-01-doc-cleanup-SUMMARY.md) that the parallel 38-01 agent had left in the staging index. The intended Task 3 changes (post-essay.service.ts + post-essay.service.test.mjs) committed correctly; the extras are sibling finalization writes attributed to the wrong commit. Work is correct in either commit; pure logging/attribution issue. Future parallel executors should consider explicit `git reset HEAD` of unrelated indexed paths before per-task commits when running concurrently.

## Last decisions (Plan 38-01 close, 2026-05-09)

- **Annotation phrasing chosen via audit table over action prose** (Task 4 fix). Plan PITFALLS.md action block specified em-dash form `historical — pre-2026-05-07 brand`, but audit table line 94 + acceptance criteria's grep pattern both use colon form `historical: pre-2026-05-07 brand`. Initial Task 4 edit followed action prose (em-dash); verification grep returned 0; followed up with single-character punctuation fix BEFORE committing. Folded into Task 4 commit `911a09df`. Documented as Rule 1 inline auto-fix in 38-01 SUMMARY.
- **Test fixture parity verified end-to-end via diff before editing** (Task 5). Diffed `awk 'NR>=87 && NR<=112' app/src/services/concept-feed.service.ts` against `awk 'NR>=53 && NR<=78' app/tests/services/starter-posts.test.mjs` BEFORE making any change — diff identified exactly 4 EchoLearn occurrences in fixture (1 title + 1 preview + 2 bodyMarkdown openings); post-edit diff confirms zero remaining drift in string args (modulo intentional declaration syntax differences for the inline-reproduce pattern). 9/9 tests pass.
- **Plan 38-02's territory NOT touched** (parallel-execution scope). post-essay.service.ts and concept-feed.service.ts trellis_short_posts references explicitly excluded — Plan 38-02 owns those edits. Verified via git status before each commit; never staged anything outside the 5 declared `files_modified`.
- **All 5 commits used `--no-verify`** per parallel-execution protocol (orchestrator validates hooks once after all 3 wave-1 agents complete).
- **Plan 38-01 close-out: 5 atomic commits across 5 files (TECHDEBT-02 + TECHDEBT-03 + TECHDEBT-05).** Test parity preserved at test:main 562/559/3 + test:actions 16/16/0 (matches Phase 37 close-out; well within plan's ≤3 main / ≤2 actions tolerance). Audit table from PLAN reproduced verbatim in SUMMARY with Bucket C "no surprises encountered" annotation.

## Last decisions (Plan 37-03 close, 2026-05-09)

- **Replace, don't append, the i18next-mentioning paragraph at locale-directive.ts lines 10-15.** The truly load-bearing D-07 prologue (lines 5-8 — `IMPORTANT (D-07): This module is the ONLY code path that reads i18n locale...`) was preserved verbatim per plan instructions. The separate obsolete paragraph (which described the old JSON-import workaround and explicitly named `i18next.language` as the read source) was replaced with the canonical Phase 37 footnote per RESEARCH.md verbatim text (`byte-stable vs. the pre-Phase-37 direct i18next.language read`). Net result: D-07 directive intact + accurate post-refactor technical description; the historical-reference word `i18next.language` survives only inside the canonical footnote prose, not in any code path. Acceptance criteria reconciled per Plan 37-03 SUMMARY Deviation 1.
- **De-collide leaf shim docstring with the new invariant test regex.** The leaf's pre-Plan-37-03 docstring (shipped in Plan 37-01) contained 3 literal `from '../locales'` substrings (all comment text saying what NOT to do); the invariant test's regex `/from\s+['"]\.\.?\/(\.\.\/)?locales/` doesn't distinguish comments from code. Chose to rephrase the leaf's prose (`the locales/index module is imported`) over tightening the regex (which is verbatim from canonical RESEARCH.md). Single-commit fix landed alongside the invariant test in `a9c57cbe`. See Plan 37-03 SUMMARY Deviation 2.
- **Phase 37 close-out: 9 source files migrated (5 Tier 1+2 + 4 Tier 3) + 1 production wire (main.tsx) + 2 new test files (smoke + invariant) + 4 paired test updates = 16 file changes across 11 atomic commits over 3 plans (2+5+5).** TECHDEBT-01 acceptance: 7 of 10 carried `ERR_IMPORT_ATTRIBUTE_MISSING` failures CLOSED (remaining 3 main-suite fails are pre-existing assertion / extension-resolution issues — never `ERR_IMPORT_ATTRIBUTE_MISSING` — out of scope per CLAUDE.md scope-boundary rule); shim exists with 9 service/lib/provider files importing it; tsc -b --noEmit exits 0; manual locale-switch UAT handed off to operator before `/gsd:verify-work`.

## Last decisions (Plan 37-02 close, 2026-05-09)

- **Use `.ts` extension on shim import specifier (`from '../lib/i18n-leaf.ts'`) in all 5 Tier 1+2 service files.** Plan 37-02 / RESEARCH.md § Open Question A specified extensionless `from '../lib/i18n-leaf'` claiming Node 25 native ESM auto-resolves `.ts`. Live verification under `node --test tests/services/trellis-state.test.mjs` showed Node DID NOT auto-add `.ts` — produced `ERR_MODULE_NOT_FOUND`. Matched the existing convention in flashcard.service.ts (lines 2-7 all use `.ts` extensions). Resolved as Rule 3 blocking fix during Task 1 amendment; Tasks 2-5 used the `.ts` form from the start. **Plan 37-03 must adopt the same `.ts` convention** for the 4 Tier 3 source migrations and any test file using `from '../../src/lib/i18n-leaf.ts'`.
- **Plan 37-02's hold-out prediction was wrong: chain closes at Task 3 (question.service.ts), not Task 1 (flashcard.service.ts).** flashcard.service.ts transitively imports question.service.ts which had its own `'../locales/index.ts'` import — plan/RESEARCH treated them as parallel sites, missing the inter-service edge. Final outcome unchanged (7 of 10 carried failures CLOSED at Task 3 instead of Task 1); Plan 37-03 should not assume single-commit chain closure.

## Last decisions (Plan 37-01 close, 2026-05-09)

- **Cast `i18n.t.bind(i18n) as any` at the bind site in main.tsx** — bridges i18next's literal-key-union type from i18n.d.ts module augmentation to the leaf shim's intentionally-generic TFn signature. Single-line cast preserves the plan's regex invariant; eslint-disable + 4-line explanatory comment annotates the bridge. Alternative (widening TFn or wrapper closure) rejected: would couple shim to bundle internals or add a function-call hop in production for zero functional gain.
- **Atomic-pair commit for shim source + smoke test** — per Plan 37-01 plan_notes Pitfall 7 mitigation. Shipping the test alone would fail; shipping the source alone leaves the hold-out unverifiable. Two atomic commits at plan close: `4e72565a` (shim+test) + `04056289` (main.tsx wire). Bisection-friendly per D-03.

## Last decisions (Roadmap creation, 2026-05-08)

- **9 phases across 4 waves** following synthesizer's recommended dependency graph; merged Wave 0 carry-over cleanup into a single Phase 38 (TECHDEBT-02 through TECHDEBT-06) for cohesion since they're all v1.4 documentation/QA cleanup
- **Masonry strategy locked to CSS `column-count: 2`** per research reconciliation (zero new dependencies; rejects `@virtuoso.dev/masonry` and `masonic` on architectural + maintenance grounds)
- **ENGAGE-04 (graph-derived social proof) placed in Phase 43**, not Phase 42, because the micro-label sits on the tile that masonry first renders
- **Wave 4 (deps + code quality) intentionally lands LAST** to avoid React/Capacitor minor bumps mid-feature triggering StrictMode timing surprises (Pitfall 12)
- **TECHDEBT-04 device retest folded into Phase 38** as a checklist task rather than its own phase (synthesizer permission)
- **CONTENT-04 (citation rendering polish)** placed in Phase 41 (pipeline wiring) so it lands with `depth: 'deep'` essay path; pulled from FEATURES.md P3 into v1.5 release scope per research's "may need to be pulled in" note

## Session Continuity

**Stopped at:** Completed 42-03-card-slide-in-removal-PLAN.md
**Next action:** Wave 2 sibling completions (42-02 HomeScreen swap, 42-04 vine-bloom-card-and-i18n) finalize → `/gsd:verify-work 42 03` (verifier sweep over Plan 42-03 must-haves) → after Wave 2 verification, Plan 42-05 (source-reading invariant tests) → Plan 42-07 (phase close-out).

**Files written this session (Plan 42-03 close):**

- `app/src/index.css` (MODIFIED — `@keyframes card-slide-in` block + preceding `/* Card entering the viewport */` comment removed; net 6 deletions; keyframes count 24 → 23)
- `app/src/components/InfoFlow.tsx` (MODIFIED — 3 inline `animation:` properties removed at former lines 197 / 329 / 858; ConceptCard's destructured `isActive` renamed to `_isActive` to silence TS6133; net 4 deletions, 1 insertion)
- `.planning/phases/42-masonry-feed-layout/42-03-card-slide-in-removal-SUMMARY.md` (NEW — close-out)
- `.planning/STATE.md` (this file)
- `.planning/ROADMAP.md` (Phase 42 plan-progress row updated)
- `.planning/REQUIREMENTS.md` (MASONRY-01 marked complete)

**Plan 42-03 commits:**

- `6bf7f761` (Task 1: delete @keyframes card-slide-in from index.css — refactor)
- `2fb5df8c` (Task 2: delete 3 card-slide-in animation callsites in InfoFlow.tsx + Rule 1 fold-in `_isActive` rename — refactor)

**Test baseline (post-Plan-42-03):** No tests added or modified by this plan (pure-deletion plan; Plan 42-05 will add `tests/lib/no-card-slide-in.test.mjs` source-reading invariant test). `app/tests/` had zero references to `card-slide-in` pre-deletion (verified via `grep -rn "card-slide-in" app/tests/` returning empty), so the existing test suite is untouched. tsc -b --noEmit reports 12 errors — ALL in `MasonryFeed.tsx` (sibling-Wave Plan 42-04 home.celebration.* i18n keys not yet added) and `HomeScreen.tsx` (sibling-Wave Plan 42-02 swap in flight); zero tsc errors in InfoFlow.tsx after Task 2's `_isActive` rename. Cross-tree negative grep `grep -rn "card-slide-in" app/src/` exits 1 (zero matches) — D-06 acceptance criterion satisfied.

**Stopped at:** Completed 42-03-card-slide-in-removal-PLAN.md

---

**Files written this session (Plan 41-02 close):**

- `app/src/types/index.ts` (MODIFIED — PostSnapshot gains optional bodyMarkdownDeep?: string with documenting comment; inherited by DailyPost)
- `app/src/services/post-essay.service.ts` (MODIFIED — EssayOptions.depth knob + EssayContent.bodyMarkdownDeep field; depth-conditional wordCountInstruction in all 4 generators; sources.slice(0, 3) multi-snippet grounding + footnote prompt instruction in generateNewsEssay; meta slice cap 2000→4000; patchPostEssayInCache field-by-field selective merge)
- `app/src/services/concept-feed.service.ts` (MODIFIED — generateConnectionPost + generateDiscoverPost gain trailing options?: { signal?: AbortSignal }; chatStream calls thread signal: options?.signal)
- `app/src/screens/PostDetailScreen.tsx` (MODIFIED — D-15 comment block extended to "Phase 41 SC-7" scope; 3 pre-call abort guards + 2 new { signal: abortController.signal } args added across 3 async essay branches)
- `app/src/components/Markdown.tsx` (REWRITE — preserves all existing plugin chain + sanitize schema; adds Components type import; adds citationComponents object with sup/a/section overrides; wires components={citationComponents} into ReactMarkdown JSX; SC-5(c) Pitfall 4 fix: sup attribute list now spreads defaultSchema.attributes?.['sup'])
- `app/tests/services/post-essay-depth.test.mjs` (NEW — 192 lines, 11 cases: SC-3/4/5(a)/6 source-reading + 3 patchPostEssayInCache merge behavioral tests)
- `app/tests/screens/PostDetailScreen-abort-threading.test.mjs` (NEW — 117 lines, 10 cases: SC-7(a)/(b)/(c) source-reading + 2 counterweights)
- `app/tests/components/Markdown-citation-overrides.test.mjs` (NEW — 70 lines, 8 cases: SC-5(b)/(c) source-reading + 2 counterweights)
- `.planning/phases/41-pipeline-wiring-essay-depth/41-02-essay-depth-citation-rendering-SUMMARY.md` (NEW — close-out)
- `.planning/STATE.md` (this file)
- `.planning/REQUIREMENTS.md` (CONTENT-01 + CONTENT-03 + CONTENT-04 marked complete)
- `.planning/ROADMAP.md` (Phase 41 + plan list rows marked [x])

**Plan 41-02 commits:**

- `6ba839de` (Task 1: bodyMarkdownDeep field + depth knob — feat)
- `e8634daa` (Task 2: depth-aware prompts + multi-snippet news + footnote instruction + meta cap 4000 — feat)
- `a19b2fa5` (Task 3: patchPostEssayInCache selective merge — feat)
- `aaee719a` (Task 4: AbortSignal threading on generateConnectionPost + generateDiscoverPost — feat)
- `6c3fa72d` (Task 5: SC-7 abort threading — pre-call guards + signal args on all 3 essay branches — feat)
- `397d388a` (Task 6: ReactMarkdown sup/a/section overrides + sanitize sup-attr spread fix — feat)

**Test baseline (post-Plan-41-02):** test:main 657/655/2 (+29 passes from 3 new test files); test:actions 16/16/0 (unchanged); tsc -b --noEmit → exit 0. Same 2 pre-existing carry-over failures from Plan 41-01 (concept-feed.test.mjs extension-resolution + trellis-layout date-dependent assertion). Pass count exceeds plan's expected lower bound.

---

**Files written this session (Plan 40-01 close):**

- `app/src/services/source-diversity.service.ts` (NEW — 513 lines, 5-function singleton + extractDomain + normalizeHost + DOMAIN_TIERS (219 entries) + MULTI_SEGMENT_TLDS (12 entries) + UNKNOWN_DOMAIN_SCORE)
- `app/tests/services/source-diversity.service.test.mjs` (NEW — 16 behavioral test cases: 7 filterForDiversity + 3 scoreSource + 3 extractDomain + 2 record/get/reset + 1 singleton-shape sanity)
- `app/tests/services/source-diversity-anti-wire.test.mjs` (NEW — 4 source-reading assertions: counterweight + no async + no fetch( + no chatStream/chatCompletion)
- `.planning/phases/40-source-diversity-leaf-module/40-01-source-diversity-service-SUMMARY.md` (NEW — close-out)
- `.planning/STATE.md` (this file)
- `.planning/REQUIREMENTS.md` (CONTENT-02 marked partial: Phase 40 leaf complete, Phase 41 wires Tavily)
- `.planning/ROADMAP.md` (plan progress row updated)

**Plan 40-01 commits:**

- `934343a3` (Task 1: source-diversity.service.ts leaf service — feat)
- `8e67b6e1` (Task 2: behavioral test suite — 16 cases — test)
- `780c00c3` (Task 3: source-reading anti-wire test — 4 assertions — test)

**Test baseline (post-Plan-40-01):** test:main 603/2 (matches pre-Phase-40 583 pass + 20 new tests with the same 2 pre-existing carry-over failures: `tests/concept-feed.test.mjs` ERR_MODULE_NOT_FOUND for extensionless youtube.service import + `tests/services/trellis-layout.test.mjs:64` getVineColor date-dependent assertion); test:actions 16/16/0 (unchanged); tsc -b --noEmit → exit 0. Pass count exceeds plan's expected lower bound of 601.

---

**Files written this session (Plan 39-01 close):**

- `app/src/types/index.ts` (MODIFIED — AppEvent union + ANCHOR_DISMISSED + ENGAGEMENT_CHANGED { kind })
- `app/src/services/engagement.service.ts` (NEW — 210 lines, full save/like/dismiss API + getPinnedIds + reset)
- `app/src/services/post-queue.service.ts` (MODIFIED — walkDerivedList signature gains required positional dismissedIds; predicate ANDs both sets; Phase 36 GAP-B math preserved verbatim)
- `app/src/services/concept-feed.service.ts` (MODIFIED — engagementService import; sole walker caller updated to pass dismissedIds; Phase 39 D-07 comment trimmed for image-gen-key-gate window compatibility)
- `app/src/services/post-history.service.ts` (MODIFIED — engagementService import; purgeExpired filter pins saved/liked posts via getPinnedIds)
- `app/tests/services/engagement.service.test.mjs` (NEW — 13 behavioral test cases incl. D-06 BEHAVIORAL HALF case 6 and D-08 reset() emits-nothing case 12)
- `app/tests/services/engagement-anti-wire.test.mjs` (NEW — D-06 STATIC HALF: counterweight + 800-char window co-emit scan across all .ts/.tsx files under app/src/)
- `app/tests/services/derived-list.test.mjs` (MODIFIED — 8 existing walkDerivedList calls get empty third arg; 4 new dismiss-skip cases under new describe block)
- `app/tests/services/refill-queue-integration.test.mjs` (MODIFIED — 5 walkDerivedList calls get empty third arg; Task 8 auto-fix for walker-signature regression)
- `.planning/phases/39-engagement-service-walker-extension/39-01-engagement-service-SUMMARY.md` (NEW — close-out)
- `.planning/STATE.md` (this file)

**Plan 39-01 commits:**

- `7dc20dac` (Task 1: AppEvent union + ANCHOR_DISMISSED + ENGAGEMENT_CHANGED)
- `84ed50d2` (Task 2: engagement.service.ts leaf service)
- `c332ba82` (Task 3: behavioral test suite — 13 cases incl. D-06 BEHAVIORAL HALF)
- `ab56005e` (Task 4: source-reading anti-wire test — D-06 STATIC HALF)
- `6b4d40da` (Task 5: walkDerivedList signature + 4 new dismiss-skip tests + 8 existing test updates)
- `040a865d` (Task 6: concept-feed.service.ts walker caller wired with engagementService.getDismissedAnchorIds)
- `aca300b8` (Task 7: post-history.service.ts purgeExpired pins via getPinnedIds — D-04)
- `d15fc16f` (Task 8: full-suite green check + auto-fix walker-signature regressions)

**Test baseline (post-Plan-39-01):** test:main 583/2 (matches pre-Phase-39 pass count + 4 new tests, with the same 2 pre-existing carry-over failures); test:actions 16/16/0 (unchanged); tsc -b --noEmit → exit 0. Pass count exceeds plan's expected lower bound of 582.

---

**Files written this session (Plan 38-02 close):**

- `app/src/types/index.ts` (MODIFIED — `'short'` removed from PresentationStyle + PostSnapshot.sourceType unions)
- `app/src/services/youtube.service.ts` (MODIFIED — probePortrait deleted; sourceType/presentationStyle hardcoded to `'video'`)
- `app/src/services/concept-feed.service.ts` (MODIFIED — VALID_SOURCE_TYPES, SHORT_QUERY_MODIFIERS, isShort param, shortAssignments loop, trellis_short_posts cache read all deleted; pre-validation pass simplified)
- `app/src/services/style-assignment.ts` (MODIFIED — STYLE_WEIGHTS rebalanced video:0.10 → 0.20; weights.short references removed; reassignFailures simplified)
- `app/src/components/InfoFlow.tsx` (MODIFIED — isShortPost variable + short-card render block deleted; GAP-C emit migrated into video thumbnail onClick; aspect-ratio: auto for video card; minHeight short check removed; ~130 lines deleted, ~30 lines added in thumbnail handler)
- `app/src/screens/PostDetailScreen.tsx` (MODIFIED — `if (post.sourceType === 'short') return;` guard deleted)
- `app/src/services/post-essay.service.ts` (MODIFIED — trellis_short_posts removed from cacheKeys array)
- `app/src/locales/{en,zh,es,ja}.json` (MODIFIED — `infoFlow.shortTag` key deleted from all 4 bundles; bundle-parity test green)
- `app/tests/services/post-essay.service.test.mjs` (MODIFIED — trellis_short_posts assertion deleted)
- `app/tests/components/InfoFlow.video-tap-emit.test.mjs` (NEW — renamed from InfoFlow.short-tap-emit.test.mjs via git mv; 4 assertions retargeted to video card thumbnail onClick)
- `app/tests/services/style-assignment.test.mjs` (MODIFIED — validStyles, no-YouTube-key arithmetic, reassignFailures fixture)
- `app/tests/services/style-assignment-stratified.test.mjs` (MODIFIED — counter, valid set, hasYoutubeKey=false assertion)
- `app/tests/services/refill-queue-integration.test.mjs` (MODIFIED — b4 fixture short → video; STYLE_WEIGHTS comment refreshed)
- `app/tests/concept-quota.test.mjs` (MODIFIED — sourceType iteration array; short removed)
- `app/tests/services/youtube-no-short-classification.test.mjs` (NEW — 4 source-reading invariants: probePortrait absent / sourceType:'short' absent / presentationStyle:'short' absent / STYLE_WEIGHTS no `short:` key + sum=1.0)
- `CLAUDE.md` (MODIFIED — GAP-C section retitled "Video post completion signals (Phase 36 GAP-C, generalized in Phase 38 — load-bearing)"; detector inventory updated; Why-both subsection rewritten for hybrid interaction; Rules 1+3+4 rewritten)
- `.planning/phases/38-v1-4-carry-over-cleanup/38-02-youtube-short-removal-SUMMARY.md` (NEW — close-out)
- `.planning/STATE.md` (this file)

**Plan 38-02 commits:**

- `76323eaa` (Task 1: atomic 6-file short-type removal — types/youtube.service/concept-feed/style-assignment/InfoFlow/PostDetailScreen)
- `6696f346` (Task 2: i18n bundle deletions — en/zh/es/ja)
- `01d870e5` (Task 3: post-essay.service.ts trellis_short_posts removed + paired test assertion deleted; also captured 4 sibling-agent state-update writes — see Plan 38-02 close decision on parallelism artifact)
- `8de21a88` (Task 4: rename InfoFlow.short-tap-emit.test.mjs → video-tap-emit.test.mjs via git mv; 4 assertions updated)
- `ce4324fd` (Task 5A: style-assignment.test.mjs)
- `914a74b3` (Task 5B: style-assignment-stratified.test.mjs)
- `3e381a29` (Task 5C: refill-queue-integration.test.mjs)
- `63e46c9e` (Task 5D: concept-quota.test.mjs)
- `863132c1` (Task 6: NEW youtube-no-short-classification invariant test)
- `6bff92d0` (Task 7: CLAUDE.md GAP-C section amendment)

**Test baseline (post-Plan-38-02):** test:main 566/564/2 (+6 pass cases vs Phase 37 baseline 558/555/3 — 4 from new invariant test + 2 from net assertion changes; both remaining fails are pre-existing per Phase 37 STATE.md: tests/concept-feed.test.mjs ERR_MODULE_NOT_FOUND for extensionless youtube.service import + tests/services/trellis-layout.test.mjs:64 getVineColor date-dependent assertion. Neither failure message contains `'short'` or `ERR_IMPORT_ATTRIBUTE_MISSING`.) test:actions 16/16/0 (matches Plan 38-01 close — improved over the older 16/14/2 baseline note). tsc -b --noEmit exits 0.

**Stopped at:** Completed 38-02-youtube-short-removal-PLAN.md

---

**Files written this session (Plan 38-01 close):**

- `.planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md` (MODIFIED — frontmatter status/nyquist/wave_0 flipped, 3 lines)
- `.planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md` (MODIFIED — status normalized approved → validated, 1 line)
- `.planning/milestones/v1.4-ROADMAP.md` (MODIFIED — Phase 36 Plans line names 36-14 + 36-15, 1 line)
- `.planning/research/PITFALLS.md` (MODIFIED — 3 inline brand-history annotations on Pitfall 8 + warning-table row, 3 lines modified)
- `app/tests/services/starter-posts.test.mjs` (MODIFIED — 4 string-literal updates EchoLearn → Trellis to match production STARTER_POSTS, 4 lines)
- `.planning/phases/38-v1-4-carry-over-cleanup/38-01-doc-cleanup-SUMMARY.md` (NEW — close-out)
- `.planning/STATE.md` (this file)
- `.planning/ROADMAP.md` (plan progress row updated)
- `.planning/REQUIREMENTS.md` (TECHDEBT-02, TECHDEBT-03, TECHDEBT-05 marked complete)

**Plan 38-01 commits:**

- `1cbe4def` (Task 1: 34-VALIDATION frontmatter flip)
- `b44ea43c` (Task 2: 35-VALIDATION status normalize)
- `09f3b171` (Task 3: v1.4-ROADMAP Phase 36 plans line)
- `911a09df` (Task 4: PITFALLS.md brand-history annotations)
- `697fc4b8` (Task 5: starter-posts fixture EchoLearn → Trellis)

**Test baseline (post-Plan-38-01):** test:main 562/559/3 + test:actions 16/16/0. Matches Phase 37 close-out — zero regressions, 2 fewer test:actions failures than STATE's prior 16/14/2 baseline note (likely a stale-baseline artifact from Plan 37-03 capture; Phase 37 SUMMARY recorded 16/16/0). starter-posts.test.mjs alone: 9/9 pass.

---

**Files written this session (Plan 37-03 close):**

- `app/tests/services/leaf-imports.test.mjs` (NEW — 4 source-reading invariant assertions)
- `app/src/services/youtube-locale-url.ts` (MODIFIED — leaf import + 1 call site rewritten)
- `app/tests/services/youtube-locale.test.mjs` (MODIFIED — bindI18nLeaf wired)
- `app/src/lib/date.ts` (MODIFIED — leaf import + 5 call sites rewritten — 1 .language + 4 .t)
- `app/tests/lib/date.locale.test.mjs` (MODIFIED — bindI18nLeaf wired)
- `app/src/providers/llm/locale-directive.ts` (MODIFIED — leaf import + 1 call site + D-07 block preserved verbatim + Phase 37 footnote added)
- `app/tests/providers/llm-locale-injection.test.mjs` (MODIFIED — bindI18nLeaf wired)
- `app/src/providers/tts/index.ts` (MODIFIED — leaf import + 1 call site rewritten)
- `app/tests/providers/tts-locale.test.mjs` (MODIFIED — bindI18nLeaf wired)
- `app/src/lib/i18n-leaf.ts` (MODIFIED — docstring de-collided to remove literal `from '../locales'` substrings that false-positive against the new invariant test regex)
- `.planning/phases/37-i18n-leaf-module-refactor/37-03-SUMMARY.md` (NEW — Plan 37-03 close-out)
- `.planning/STATE.md` (this file)
- `.planning/ROADMAP.md` (plan progress row updated)
- `.planning/REQUIREMENTS.md` (TECHDEBT-01 marked complete — Phase 37 fully closes it)

**Plan 37-03 commits:**

- `fce07880` (Task 1: youtube-locale-url + paired test)
- `b73349ec` (Task 2: lib/date + paired test, 5 call sites)
- `c098854d` (Task 3: locale-directive + paired test, D-07 preserved + Phase 37 footnote)
- `8757ae9d` (Task 4: tts/index + paired test)
- `a9c57cbe` (Task 5: invariant test added + leaf docstring de-collided)

**Test baseline (post-Plan-37-03):** test:main 558/555/3 + test:actions 16/14/2 — IDENTICAL to Plan 37-02 close (zero new regressions introduced by Tier 3 migrations). 4 Tier 3 paired tests stayed green throughout (22 cases total: 6+5+6+5). New invariant test green (4/4). tsc -b --noEmit → exit 0.

**Phase 37 lifetime totals:** Pre-Phase-37 baseline 558/548/10 + 16/14/2 = 12 fail. Post-Phase-37 baseline 558/555/3 + 16/14/2 = 5 fail. Net 7 closures (all `ERR_IMPORT_ATTRIBUTE_MISSING` chain). Remaining 5 fails are pre-existing assertion / extension-resolution issues unrelated to i18n.
