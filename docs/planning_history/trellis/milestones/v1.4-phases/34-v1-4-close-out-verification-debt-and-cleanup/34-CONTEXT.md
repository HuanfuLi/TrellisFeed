# Phase 34: v1.4 close-out — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Close all gaps surfaced by `.planning/v1.4-MILESTONE-AUDIT.md` (2026-04-24) so v1.4 can ship. This is the milestone-closing phase — Phase 34 takes ownership of every uncommitted item in the working tree (36 working-tree items + 1 committed ROADMAP entry already on `gsd/phase-33-hygiene-and-polish`) and produces the verification + planning + commit trail needed to flip v1.4 status from `gaps_found` to `passed`.

**In scope (every Phase 34 plan must address one of these):**

1. **PHASE-30-VERIFICATION** — write `30-VERIFICATION.md` (D-01..D-22, abbreviated style)
2. **PHASE-31-VERIFICATION** — write `31-VERIFICATION.md` (D-01..D-47 + UAT retest integration)
3. **PHASE-32-EXECUTION** — write `32-CLOSURE.md` documenting Phase 32 absorption
4. **SEAM-11** — fix `trellis-replant.test.mjs` + `trellis-prune.test.mjs` desync (inline mocks, GRAPH_UPDATED contract)
5. **SEAM-12** — update `HomeScreen.image-pregen-filter.test.mjs` to guard `refillQueue` (folded into Commit 2 of WIP commit set)
6. **SEAM-2 tail + dead-prop fold** — delete `post-store.service.ts`, `ImmersiveInfoFlow` export, AND remove `VineProgress` `explored`/`total`/`isComplete` dead props (folded per D-15)
7. **VALIDATION-DRIFT-{28,29,30}** — flip `28/29-VALIDATION.md` to `validated` + `nyquist_compliant: true` (pure doc drift); flip `30-VALIDATION.md` after `30-VERIFICATION.md` lands
8. **VALIDATION-32-ANNOTATE** — annotate `32-VALIDATION.md` with "absorbed, no execution" status rather than flipping
9. **DEVICE-UAT-RETEST** — record `32.1-G2/G4/G5` + `33-HUMAN-UAT-1/2` outcomes in `34-UAT-LOG.md`; flip `32.1-VERIFICATION.md` `human_needed → passed` on operator pass
10. **WIP-COMMIT-SHAPE** — land 5-commit shape (rebrand / functional follow-on with Seam 12 / audit artifacts / planning context / execution artifacts). Includes `.gitignore` entry for `Presentation/`.

**Out of scope (deferred to v1.5):**

- Pre-existing trellis test failures from `ERR_IMPORT_ATTRIBUTE_MISSING` (Node 25 JSON import) — long-standing infrastructure issue, ~20 failures.
- Pre-existing Phase 26 test-code bugs (`trellis-tooltip-copy.test.mjs` tests deleted `TrellisTooltip.tsx`; `trellis-layout.test.mjs` `getVineColor` hex vs CSS vars mismatch — 4 failures total).
- Phase 32.1 Wave 3/4 addenda formal verifier pass — addenda were Claude-verified (session conversation), not gsd-verifier-verified. Optional rerun at v1.5 close.
- Append-only derived list + persistent cycle position in concept-feed pipeline — explicit v1.5 carry-over per CLAUDE.md "Concept Feed Generation Pipeline" gaps section.
- Rebrand localStorage key migration (echolearn_* keys preserved intentionally per `33-REBRAND.md`).

**Depends on:** Phase 33 (verification baseline; HEAD `245fae4d`) + `.planning/v1.4-MILESTONE-AUDIT.md` (2026-04-24 re-audit, `c24a875f`).

</domain>

<decisions>
## Implementation Decisions

### Seam 11 — trellis-actions test desync

- **D-01:** Fix shape — **inline mocks per test**. Drop the `_actions-mock-loader.mjs` dependency entirely. Each affected test (`trellis-replant.test.mjs`, `trellis-prune.test.mjs`, and any other test currently relying on the loader) uses local stubs/spies for the 9 mocked services (podcast, question, db, embedding, llm, qfilter, settings, tts). More test code (+~80-150 lines per test) but fully self-contained. Tests run under default `npm test` invocation. No risk of leaking mocks into other tests.
- **D-02:** Assertion rewrite — **rewrite to GRAPH_UPDATED contract**. Update test names, comments, and assertion text. `'must emit exactly one CLASSIFICATION_COMPLETED'` → `'must emit exactly one GRAPH_UPDATED'`. Add a comment in each rewritten test noting the rename history (`Phase 32.1 D-W3-02`).
- **D-03:** Implementation pattern — use either `node:test` `t.mock.method()` API (Node 22+) for spying, or a thin object-replacement pattern via mutable module exports. Planner/researcher should investigate which pattern produces the cleanest test before locking the approach.
- **D-04:** Scope guard — these test fixes do NOT modify `trellis-actions.service.ts` itself. Production code is verified correct by `.planning/v1.4-INTEGRATION-CHECK-v2.md` Seam 11 (emitters/subscribers all use `GRAPH_UPDATED`).

### Seam 12 — image-pregen test guards refillQueue

- **D-05:** Sequencing — **fold Seam 12 fix into Commit 2** (the functional follow-on commit) so tests pass on every commit boundary. Reverses the initial instinct ("standalone before WIP") because the WIP is now split into 5 commits and the image-pregen production move lives in Commit 2. Test fix and production move must land atomically.
- **D-06:** Test grep target — update `HomeScreen.image-pregen-filter.test.mjs` to read `concept-feed.service.ts:refillQueue` function body and assert the same regex patterns (`/Promise\.allSettled\(\s*imagePosts\.map/`, `/if\s*\(\s*imagePosts\.length\s*>\s*0\s*\)/`).

### Wave order / dependencies

- **D-07:** Wave structure (5 waves):
  - **Wave 1:** Test fixes (Seam 11 + Seam 12 stub — production move part of Wave 5 commits, but test re-targeting can be drafted now).
  - **Wave 2:** Verification documents (`30-VERIFICATION.md`, `31-VERIFICATION.md`, `32-CLOSURE.md` — parallel, doc-only).
  - **Wave 3:** Orphan + dead-prop cleanup (`post-store.service.ts` deletion, `ImmersiveInfoFlow` export deletion, `VineProgress` dead-props removal).
  - **Wave 4:** VALIDATION flips (28/29/30/32) — depends on Wave 2 verification docs landing clean.
  - **Wave 5:** Device UAT session + 5-commit WIP land + `.gitignore` for `Presentation/`.
- **D-08:** Wave 5 device UAT happens **before WIP commits** so any device-revealed bug becomes a Phase 34 fix, not a Phase 35 follow-up. Operator deploys APK, runs UAT, records in `34-UAT-LOG.md`, then commits.

### Phase 28 deferred human-UAT scope

- **D-09:** Treatment — **opportunistic recording**. If operator's APK session in Wave 5 naturally covers any of Phase 28's 6 deferred items (haptic, BottomNav slide-down, Header scroll shadow, SwipeTabContainer resize re-snap, trellis pulse from Suggested Moves, AskScreen locale switch empty state), record outcomes in `34-UAT-LOG.md` and flip the corresponding rows in `28-VERIFICATION.md` `human_verification:` block. Don't gate Phase 34 close on Phase 28 items. Honors Phase 32 D-06 ("don't gate on Phase 28 UAT").

### Cleanups + WIP commit shape

- **D-10:** Working-tree disposition — **commit everything**. 36 working-tree items + 1 already-committed ROADMAP entry. Nothing reverted. Phase 34 closes v1.4 by landing all uncommitted work.
- **D-11:** Phase 33 functional changes (truncation-tolerant JSON parser, ReviewScreen flashcard dedup, style weight rebalance, REFILL_THRESHOLD 8→12, enqueueInterleaved method, image pre-gen moved to refillQueue, in-flight image dedupe, InfoFlow div role refactor) — **document in `33-REBRAND.md` addendum**, then commit as part of Commit 2. Acceptable because they're behind code paths already audited (post-queue, concept-feed) and tests still pass.
- **D-12:** `Presentation/` directory disposition — **add to `.gitignore`**. Personal demo prep materials (4 markdown files + SlideDecks/, ~80KB), not product code. Operator's local workspace stays local.
- **D-13:** Commit shape — **5 commits on `gsd/phase-33-hygiene-and-polish`**:
  - **Commit 1: Rebrand only (pure cosmetic + assets)** — `feat(brand): rebrand EchoLearn to Trellis (UI strings, configs, icons, console prefixes)`. Files (~17): CLAUDE.md, app/capacitor.config.ts, app/index.html, app/ios/App/App/Info.plist, AppIcon-512@2x.png, locales (rebrand strings only), GraphScreen.tsx, podcast/question-filter/question/scheduler.native services, useQuestions.ts; untracked: Trellis_logo.png, 5 PWA icons, 33-REBRAND.md.
  - **Commit 2: Functional follow-on (with Seam 12 fix)** — `refactor(feed+review): JSON parser hardening, image pre-gen architecture shift, queue tuning, ReviewScreen dedup`. Files (~13): InfoFlow.tsx, HomeScreen.tsx, ReviewScreen.tsx, SettingsDataScreen.tsx (non-rebrand parts), canonical-knowledge.service.ts, concept-feed.service.ts, imageGeneration.service.ts, post-queue.service.ts, style-assignment.ts, image-gen-key-gate.test.mjs, post-queue.test.mjs, style-assignment.test.mjs, **HomeScreen.image-pregen-filter.test.mjs (Seam 12 fix)**.
  - **Commit 3: Audit artifacts** — `docs(audit): v1.4 milestone audit + integration check v2 (post-32.1+33 re-audit)`. Files (2): v1.4-MILESTONE-AUDIT.md (rewrite), v1.4-INTEGRATION-CHECK-v2.md (new).
  - **Commit 4: Phase 34 planning context** — auto via gsd-tools at end of discuss-phase. Files: 34-CONTEXT.md, 34-DISCUSSION-LOG.md, STATE.md.
  - **Commit 5: Phase 34 execution artifacts** — incremental commits during execute-phase per plan (PLAN files, RESEARCH.md, VALIDATION.md, code edits per plan, SUMMARY files, VERIFICATION.md, UAT-LOG.md, eventual VALIDATION flips, eventual orphan/dead-prop deletions).
- **D-14:** Commit boundary invariant — **tests green at every commit boundary** including intermediate states. Specifically: Commit 1 must not regress test baseline (449 pass / 27 fail); Commit 2 must hold or improve baseline; Commit 3-5 are doc-only.
- **D-15:** Dead-prop cleanup — **fold into Wave 3 (Seam 2 sweep)**. While deleting `post-store.service.ts` and `ImmersiveInfoFlow` export, also remove `VineProgress` `explored` / `total` / `isComplete` props from `VineProgressProps` and the HomeScreen pass-through call sites. ~5-10 line edit, 2 files. Cite as "D-15 dead-prop cleanup" in `30-VERIFICATION.md` / `31-VERIFICATION.md`.

### Verification document style (carried from Phase 32)

- **D-16:** Both `30-VERIFICATION.md` and `31-VERIFICATION.md` use **Phase 29's abbreviated style** (truth table + artifacts + requirements coverage; skip Key Link and Data-Flow Trace sections unless a specific decision calls for them). Carry-forward from Phase 32 D-03.
- **D-17:** Both files use **inline rows for unclaimed decisions** — every decision (D-xx) gets a row marked VERIFIED / SUPERSEDED-BY-PHASE-N / NO-OP / DEFERRED with grep/file evidence. Carry-forward from Phase 32 D-01/D-02.
- **D-18:** `31-VERIFICATION.md` UAT integration — **inline format**: UAT retest outcomes from Phase 32.1 plans 32.1-01/02/03 appear next to relevant decision rows (e.g., D-04 row cites UAT test 5 retest with fix_source pointer). No separate appendix.

### Claude's Discretion

- Exact test code structure for inline mocks in Seam 11 (planner/researcher decides between `t.mock.method()` API vs object-replacement pattern after lightweight investigation per D-03).
- File ordering within each commit (decided at commit time).
- Whether `33-REBRAND.md` ships in Commit 1 (rebrand) or Commit 2 (functional addendum) — mostly aesthetic; either works.
- Granularity of `34-UAT-LOG.md` rows (per item or per session) — operator pacing.
- Length and detail of `32-CLOSURE.md` (short annotation vs full close-out doc).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source-of-truth for gaps
- `.planning/v1.4-MILESTONE-AUDIT.md` — 2026-04-24 audit; the 9 in-scope items above all map to gaps in this file's frontmatter.
- `.planning/v1.4-INTEGRATION-CHECK-v2.md` — detailed seam-by-seam findings; Seam 11 / Seam 12 evidence + line numbers.

### Phase 30 verification inputs (for `30-VERIFICATION.md`)
- `.planning/phases/30-redesign-curiosity-feed-as-scroll-progress-bar-with-daily-reading-quota-credits/30-CONTEXT.md` — D-01..D-22 source.
- `.planning/phases/30-redesign-curiosity-feed-as-scroll-progress-bar-with-daily-reading-quota-credits/30-01-SUMMARY.md` — claimed decisions.
- `.planning/phases/30-redesign-curiosity-feed-as-scroll-progress-bar-with-daily-reading-quota-credits/30-02-SUMMARY.md` — claimed decisions (13 of 22).

### Phase 31 verification inputs (for `31-VERIFICATION.md`)
- `.planning/phases/31-curiosity-feed-redesign-post-lifecycle-and-display/31-CONTEXT.md` — D-01..D-47 source.
- `.planning/phases/31-curiosity-feed-redesign-post-lifecycle-and-display/31-01..10-SUMMARY.md` — 28 of 47 decisions claimed across 10 plans.
- `.planning/phases/31-curiosity-feed-redesign-post-lifecycle-and-display/31-UAT.md` — 8 originally-failed tests + retest rows from Phase 32.1.

### Phase 32 absorption inputs (for `32-CLOSURE.md`)
- `.planning/phases/32-v1-4-verification-close-out-and-uat-retest/32-CONTEXT.md` — D-01..D-12 (planned, never executed).
- `.planning/phases/32-v1-4-verification-close-out-and-uat-retest/32-01..03-PLAN.md` — 3 plans drafted, 0 executed.
- `.planning/phases/32.1-v1-4-uat-retest-gap-closure/32.1-VERIFICATION.md` — UAT retest absorption evidence (32.1-01/02/03 closed UAT-31-2/4/13/14).

### Phase 29 supersession trail
- `.planning/phases/29-final-polishment/29-VERIFICATION.md` — `SUPERSEDED-BY-PHASE-31` marker (Phase 33 plan 33-02).
- `.planning/phases/29-final-polishment/29-UAT-LOG.md` — TD-01 SUPERSEDED entry.

### Phase 33 baseline + WIP
- `.planning/phases/33-phase-29-regression-and-phase-31-code-hygiene/33-VERIFICATION.md` — 8/8 must-haves verified; tsc=0; baseline 449/27.
- `.planning/phases/33-phase-29-regression-and-phase-31-code-hygiene/33-REBRAND.md` — rebrand WIP scope doc (untracked); Phase 34 will append a "Functional changes" section.

### Architectural invariants (must not regress)
- `CLAUDE.md` — load-bearing invariants section: 3-list pipeline, Header portal, ChatInput minWidth, root overflow, SwipeTabContainer resize guard, GRAPH_UPDATED single signal, news two-phase, normalizeAnchorName, classification dedup pre-check.
- `.planning/STATE.md` — Phase 33 closure record + STATE.md should be updated by Phase 34 close-out.

### Code targets — Seam 11
- `app/tests/services/trellis-replant.test.mjs:137,145` — subscribes to deleted `CLASSIFICATION_COMPLETED` event.
- `app/tests/services/trellis-prune.test.mjs:95,103` — same.
- `app/tests/services/_actions-mock-loader.mjs` + 9 sibling `_actions-mock-*.mjs` files — to be retired (per D-01 inline-mocks decision).
- `app/src/services/trellis-actions.service.ts:13,107,138` — production emits `GRAPH_UPDATED` (no fix needed; reference for tests).
- `app/src/types/index.ts:694-696` — `GRAPH_UPDATED` in `AppEvent` union; `CLASSIFICATION_COMPLETED` removed (tombstone comment only).

### Code targets — Seam 12
- `app/tests/screens/HomeScreen.image-pregen-filter.test.mjs:40-48` — current grep target is `handleLoad` function body in `HomeScreen.tsx`.
- `app/src/services/concept-feed.service.ts:1388-1416` (post-WIP) — new grep target is `refillQueue` function body.
- `app/src/screens/HomeScreen.tsx:handleLoad` — pre-WIP location of `imagePosts.filter` pattern.

### Code targets — Wave 3 (orphan + dead-prop cleanup)
- `app/src/services/post-store.service.ts` — entire file to delete (zero consumers).
- `app/src/components/InfoFlow.tsx:808-815` — `ImmersiveInfoFlow` export to delete (zero consumers, missing D-29 wiring).
- `app/src/components/VineProgress.tsx` — `VineProgressProps` `explored` / `total` / `isComplete` props to remove.
- `app/src/screens/HomeScreen.tsx` — `<VineProgress>` call sites passing the dead props.

### Code targets — Wave 5 (rebrand + functional commits)
- All 26 modified files + 8 untracked items in current `git status` — see Phase 34 plan files for per-commit file lists.

### Style guide (Phase 29 abbreviated VERIFICATION pattern)
- `.planning/phases/29-final-polishment/29-VERIFICATION.md` — reference template for `30-VERIFICATION.md` and `31-VERIFICATION.md`.
- `.planning/phases/33-phase-29-regression-and-phase-31-code-hygiene/33-VERIFICATION.md` — another reference for tone/structure.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **node:test framework + `node:assert/strict`** — established testing pattern (`.planning/codebase/TESTING.md`). Inline mocks in Seam 11 should use this stack, not external mock libraries.
- **`localStorage` shim pattern** — used at top of every services test (e.g., `trellis-replant.test.mjs:1-12` makes a local `Map`-backed shim). Reusable for inline mocks.
- **Phase 29 abbreviated VERIFICATION style** — proven pattern; reproducible.
- **`gsd-tools commit`** — built-in Wave-aware atomic commit helper used by Phase 32.1 / Phase 33; reuse for Phase 34.

### Established Patterns
- **VERIFICATION.md frontmatter** — `phase:`, `verified:`, `status:`, `score:`, `re_verification:`, `gaps: []`, optional `human_verification:` block. All Phase 28/29/32.1/33 follow this.
- **Tombstone comments** — `CLASSIFICATION_COMPLETED` removed from `AppEvent` union but a comment explains why (`types/index.ts:694`). Pattern to follow for any other deletions.
- **CLAUDE.md invariant blocks** — Phase 32.1 added 8 load-bearing invariants. Phase 34 must NOT regress them.

### Integration Points
- **gsd-tools commit** — Phase 34 plans should call `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "..." --files ...` for atomic commits, not raw `git commit`. Auto-skips if no changes.
- **gsd-tools state record-session** — invoked at end of discuss-phase to update STATE.md.
- **31-UAT.md retest rows** — `fix_source:` YAML field convention (Phase 32.1 plans 32.1-01/02/03). 31-VERIFICATION.md should cite these.
- **Branch `gsd/phase-33-hygiene-and-polish`** — all 5 Phase 34 commits land here. Branch will be renamed or PR'd after Phase 34 close.

</code_context>

<specifics>
## Specific Ideas

### From discussion (D-01..D-15)

- **Inline mocks vs loader** — operator preference is "less surface area, more isolation". Loader-based approach blamed for the 7-test-failure mass that surfaced this audit cycle.
- **WIP single-phase ownership** — operator preference is "milestone close-out should address all problems and unfinished work". Phase 34 owns disposition of all 36 working-tree items. Nothing carries to v1.5 unless explicitly listed in the Out-of-scope section above.
- **Tests green at every commit boundary** — D-14 invariant. Drives Seam 12 fold into Commit 2.
- **Opportunistic UAT recording** — D-09 honors Phase 32 D-06 ("don't gate v1.4 on Phase 28's 6 items") while still allowing close-out if operator covers them naturally.
- **Phase 29 abbreviated VERIFICATION style** — reproducible reference; carry forward via D-16/D-17/D-18.

### From v1.4-MILESTONE-AUDIT.md "Top-priority actions"

The 10-item action list at the bottom of `.planning/v1.4-MILESTONE-AUDIT.md` is the canonical Phase 34 task surface. Every plan must close at least one of those items.

### Branch state at Phase 34 start

- Branch: `gsd/phase-33-hygiene-and-polish`
- HEAD: `c24a875f docs(roadmap): add Phase 34 v1.4 close-out (...)` (committed during this discuss-phase workflow)
- Test baseline: 449 pass / 27 fail on HEAD (clean tree); 448 pass / 28 fail on WIP tree (Seam 12 regression introduced by uncommitted image-pregen move).
- tsc: 0 errors on both.
- npm test failures all pre-existing or covered by Seam 11/12.

</specifics>

<deferred>
## Deferred Ideas

### Out of scope per operator + ROADMAP

- **Pre-existing trellis test failures** — `ERR_IMPORT_ATTRIBUTE_MISSING` (Node 25 JSON import strictness, ~20 failures). Long-standing infrastructure issue documented in STATE.md and 29-VERIFICATION.md. v1.5+.
- **Pre-existing Phase 26 test-code bugs** — `trellis-tooltip-copy.test.mjs` tests deleted `TrellisTooltip.tsx` (3 failures since Phase 26); `trellis-layout.test.mjs` `getVineColor` hex vs CSS vars (1 failure). v1.5.
- **Phase 32.1 Wave 3/4 addenda formal verifier pass** — addenda were Claude session-conversation-verified, not gsd-verifier-verified. Optional rerun at v1.5 close.
- **Append-only derived list + persistent cycle position** — explicit v1.5 carry-over per CLAUDE.md "Concept Feed Generation Pipeline" gaps section. Phase 34 must NOT close this.
- **localStorage key migration** — `echolearn_*` keys preserved intentionally per `33-REBRAND.md`. Existing users have uninterrupted data access. Migration is a post-presentation v1.5 task.
- **Phase 28's 6 deferred human-UAT items** — opportunistic recording only (D-09); not a hard scope item.

### Surfaced during discussion but explicitly deferred

- Restoring `applyStrategyBias` in concept-feed (rejected at Phase 33 — superseded by Phase 31 D-14).
- IntersectionObserver-derived `inView` for trellis (Phase 28 D-13 placeholder) — v1.5.
- React.memo on `TrellisLeaf` — medium risk (interacts with Phase 28 animation surfaces); deferred at Phase 33.
- Question-filter LLM threshold tuning + combined LLM call refactor — deferred at Phase 33 with "write tests first" prerequisite.
- Bundle splitting / lazy routes — locked out by swipe-tab architecture per CLAUDE.md.

### No reviewed-but-deferred todos

`gsd-tools todo match-phase 34` returned 0 matches — no backlog items relevant to Phase 34 scope.

</deferred>

---

*Phase: 34-v1-4-close-out-verification-debt-and-cleanup*
*Context gathered: 2026-04-25*
