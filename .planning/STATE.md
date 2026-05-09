---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: gap closure)
status: verifying
stopped_at: Completed 40-01-source-diversity-service-PLAN.md
last_updated: "2026-05-09T13:04:00.958Z"
last_activity: 2026-05-09
progress:
  total_phases: 21
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: v1.5 ROADMAP CREATED — 2026-05-08

## Current Position

Phase: 40
Plan: Not started
Status: Phase 40 complete — ready for verification
Last activity: 2026-05-09

## Progress

**Phases:** 2 / 9 complete (37 ✓; 38 ✓; 39 ready for verification; 40 ready for verification; 41-45 pending)
**Plans:** 1 / 1 complete in Phase 40 (40-01 source-diversity-service ✓); 1 / 1 complete in Phase 39 (39-01 engagement-service ✓)

```
[████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 30%
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

**Current focus:** Phase 40 — source-diversity-leaf-module

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

**Stopped at:** Completed 40-01-source-diversity-service-PLAN.md
**Next action:** `/gsd:verify-work 40 01` (verifier sweep over Plan 40-01 must-haves) → after verification, `/gsd:plan-phase 41` (pipeline + essay depth, Wave 2; consumes Phase 40's leaf at the news pre-fetch loop + news creation loop in concept-feed.service.ts).

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
