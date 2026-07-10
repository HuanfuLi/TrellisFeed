# Phase 29: Final polishment — Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Close all v1.3 milestone-audit tech debt in a single sweep. Four bounded sub-scopes:

1. **TD-01 — Curiosity-signal wiring.** Thread `plannerService.getRecentSignals()` into `defaultStrategy.computeHints(signals, checkInSignals)` at the two call sites that currently drop the optional arg.
2. **TD-02 — PostDetailScreen abort plumbing.** Replace the local `aborted` boolean in the on-enter essay effect with an `AbortController`; subscribe to `LOCALE_CHANGED`; thread the signal through `post-essay.service.ts` → `chatStream`.
3. **TD-03 — `classifyAndAnchorIncremental` cancellation.** Add optional `AbortSignal` param; thread into the 3 step `chatCompletion` calls (mid-step cancel).
4. **Pre-existing cleanup.** Fix tsc errors in the 4 documented files (GraphScreen, canonical-knowledge, review, trellis-state) + any same-file siblings; fix the 5 documented Node 25 `ERR_MODULE_NOT_FOUND` failures by adding extensions to the failing tests' intra-`src/` import graphs.
5. **UAT walkthrough.** Device walkthrough for all 25 remaining `human_needed` items across archived phases 20/21/22/26, inline-fixing any bug the walkthrough surfaces.

**Explicitly out of scope:**
- Any feature work not in the five sub-scopes above
- 23-05 DEDUP plan (symmetric labelKey + NEW→existing coercion) — remains deferred; revisit only if classification dedup surfaces as a real problem
- REVIEW-03/04 daily goal bar (intentionally descoped per `feedback_daily_goal.md`)
- SWIPE-09 animated tap-to-jump (superseded by 2026-04-15 instant-transport addendum — do not retest items 4/5 of Phase 22 UAT)
- Broader tsc/Node 25 cleanup beyond the documented files and their same-file sibling errors
- Any refactor/abstraction not required to close the listed items

</domain>

<decisions>
## Implementation Decisions

### Execution shape

- **D-01:** Break Phase 29 into **4 separate plans** matching the natural work boundaries:
  - `29-01` — TD-01 curiosity-signal wiring (2 call sites)
  - `29-02` — TD-02 + TD-03 abort plumbing (PostDetailScreen essay + classifyAndAnchorIncremental)
  - `29-03` — Pre-existing tsc + Node 25 cleanup
  - `29-04` — UAT walkthrough + inline fixes for walkthrough-surfaced issues
  - Reason: cleanest blast-radius isolation; each plan has its own commit + verify boundary; matches the existing v1.3 phase style.
- **D-02:** **Parallel execution** — plans 29-01/02/03/04 have no strict ordering. UAT walkthrough runs on current `main` (the `human_needed` tests are against already-shipped behavior, not Phase 29's new code). If a tech-debt fix changes a UAT test path, that item gets spot-retested after the fix lands.
- **D-03:** **Inline-fix whatever the walkthrough turns up.** If UAT surfaces new issues not on the 25-item list (device-only layout bugs, regressions, etc.), fix them in-scope. No size cap. Reason: since we're already doing the walkthrough, milestone quality matters more than schedule.
- **D-11:** **Definition of done (strictest):** Phase 29 is complete when all 4 plan VERIFICATIONs pass + all 25 original UAT items resolved + all walkthrough-surfaced fixes resolved. Nothing ships with `human_needed` items still open. This is the most rigorous bar — 29-04 scope is unbounded by design and the planner should design it as an iterative/checkpoint-heavy plan.

### TD-01 — Curiosity-signal wiring (29-01)

- **D-12:** Fix at both call sites. Thread `plannerService.getRecentSignals()` into `defaultStrategy.computeHints(signals, checkInSignals)` at:
  - `app/src/services/plannerAutoGen.service.ts:115`
  - `app/src/services/concept-feed.service.ts:759`
- **D-13:** No new helper / no caching / no refactor. 2-line change per call site: `const checkInSignals = plannerService.getRecentSignals(); const hints = defaultStrategy.computeHints(signals, checkInSignals);`. `getRecentSignals()` already reads localStorage synchronously with reasonable perf.

### TD-02 — PostDetailScreen abort plumbing (29-02)

- **D-06:** **Abort triggers:** `LOCALE_CHANGED` **+** component unmount **+** timeout (compose all three into one signal via `composeSignal` — the helper Phase 27 added at `providers/llm/index.ts:35`). Replaces the current local `aborted` boolean cleanly. Unmount trigger eliminates network waste when user navigates away; timeout guards against hung streams.
- **D-14:** Timeout value: use the existing LLM provider `timeoutMs` from settings. Do NOT introduce a separate PostDetailScreen-specific timeout constant.
- **D-15:** Thread the signal from `PostDetailScreen.tsx` → `post-essay.service.ts:generatePostEssay` / `generateEssayMeta` → `chatStream` / `chatCompletion`. Both generator functions in `post-essay.service.ts` must accept a `signal` option and pass through.
- **D-16:** Both the `streamingBody` accumulator and the post-stream `generateEssayMeta` call share the SAME `AbortController` (one per essay effect), matching the Phase 27 `useQuestions.ts` Pass-1 + Pass-2 shared-signal pattern.

### TD-03 — `classifyAndAnchorIncremental` cancellation (29-02)

- **D-07:** **Mid-step cancel** — signal threads into every `chatCompletion` call in `runStepWithRetry`. When signal fires, the in-flight step's fetch aborts within ~100ms, the step throws AbortError, and the pipeline stops. Exact parity with Phase 27 D-22 pattern.
- **D-17:** Optional `signal?: AbortSignal` param on `classifyAndAnchorIncremental` and `runStepWithRetry`. Default undefined keeps the existing single-call fallback path unchanged (`classifyAndAnchor` already accepts no signal and stays that way).
- **D-18:** Call sites — `useQuestions.ts:273` (streaming Q&A) and `question.service.ts:262` (filterQuestion path): both should thread in the appropriate signal. For `useQuestions.ts`, reuse the existing `abortController.signal` that already handles LOCALE_CHANGED for `chatStream`. For `question.service.ts`, accept an optional signal param from callers.

### Partial state on abort (TD-02 + TD-03)

- **D-08:** **Discard — nothing persists on abort.**
  - PostDetailScreen: do NOT call `patchPostEssayInCache` on abort. `bodyMarkdown` reverts to empty; user can re-open the post to retry (the existing on-enter effect will refire).
  - `classifyAndAnchorIncremental`: no change needed — the pipeline already only commits via `commitClassificationResult` AFTER all 3 steps succeed. Abort mid-flight means no writes happened. Zero rollback logic required.

### Pre-existing tsc + Node 25 cleanup (29-03)

- **D-04:** **tsc scope = narrow + same-file siblings.** Fix the 4 tsc errors listed in `.planning/milestones/v1.3-phases/27-add-i18n-l10n-support/deferred-items.md` (GraphScreen, canonical-knowledge, review, trellis-state). If tsc reports additional errors in those same files, include them. Do NOT chase errors in unrelated files.
- **D-05:** **Node 25 fix = add extensions to the failing tests' import graphs.** For each of the 5 documented failing test files (`canonical-knowledge-pipeline.test.mjs`, `canonical-knowledge.test.mjs`, `concept-feed.test.mjs`, `reorg-json-parser.test.mjs`, `web-search.test.mjs`), add `.ts`/`.js` extensions to the transitively-imported intra-`src/` modules until the test resolves. Don't touch unrelated imports.
- **D-19:** Do NOT introduce a Node loader config or tsconfig `moduleResolution` change as a workaround. Source-code extensions are the path.
- **D-20:** Plan 29-03 regression gate: after fixes, all 43 Phase 27 tests must still pass, and the 5 previously-failing tests from `deferred-items.md` must also pass. Full `tsc -b --noEmit` green is NOT required (scope is narrow), but the 4 target files must compile clean.

### UAT walkthrough (29-04)

- **D-09:** **Single `29-UAT-LOG.md`** in the Phase 29 directory. Flat file with 25 items grouped by source phase (20/21/22/26). Each item has: test description, expected behavior, actual behavior, pass/fail, date executed, notes. Auditor-friendly.
- **D-21:** **Also update archived VERIFICATION.md frontmatter** — after all UAT items close, edit `.planning/milestones/v1.3-phases/{20,21,22,26}-*/*-VERIFICATION.md` to flip `status: human_needed` → `status: passed` and add a `re_verification` block pointing to `.planning/phases/29-final-polishment/29-UAT-LOG.md`. Evidence lives in the log; status lives with the archived phase.
- **D-10:** **Walkthrough-surfaced fix commits land inside plan 29-04.** Each fix committed as a separate git commit with its own message, all under the 29-04 plan umbrella. Self-contained: one plan = walkthrough + all fixes it surfaces. Plan size is unbounded by design (see D-11).
- **D-22:** **Operator executes the walkthrough, Claude records.** Operator runs through each of the 25 items on device (or browser dev mode as appropriate), reports pass/fail + notes to Claude, Claude updates `29-UAT-LOG.md` in real time. For fixes, operator describes the bug, Claude implements and commits, operator re-verifies.
- **D-23:** UAT skip list — do NOT retest these (superseded by documented reversals, not bugs):
  - Phase 22 items 4 and 5 (animated tab-tap + non-adjacent direct-slide) — reverted to instant transport on 2026-04-15, see `22-VERIFICATION.md` addendum
  - Phase 21 items 3 and 4 for REVIEW-03/REVIEW-04 (daily goal bar + label rename) — intentionally descoped per `feedback_daily_goal.md`

### Claude's Discretion

- **Plan subagent spawning pattern for 29-04:** Given the iterative walkthrough + inline-fix loop, the planner can choose checkpoint-heavy single-wave execution vs a two-part plan (walkthrough → produce fix list → fix list plan). Claude decides at plan time based on how many items land in each group.
- **Error message copy for aborted post essay (D-08):** When abort discards mid-stream content, the visible UI state is the pre-stream shell (empty bodyMarkdown). No explicit toast needed per the D-08 discard semantics, but if the planner finds a surface where silent-discard is confusing, adding a `t('posts.detail.streamAborted')` toast is allowed (with i18n keys added to all 4 bundles per the root `CLAUDE.md` workflow).
- **29-03 file ordering:** Whether to fix tsc errors first then Node 25 tests, or vice versa, is up to the planner. Both converge on the same end state.
- **Branching:** Work on `main` per established project cadence. No feature branches unless the planner identifies a cross-plan interaction that requires isolation.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit sources (defines what Phase 29 closes)
- `.planning/v1.3-MILESTONE-AUDIT.md` — v1.3 audit status (tech_debt), TD-01/02/03 summary, UAT backlog inventory
- `.planning/v1.3-INTEGRATION-CHECK.md` — full seam-by-seam + flow-by-flow evidence for TD-01/02/03 with exact file paths and line numbers
- `.planning/milestones/v1.3-phases/27-add-i18n-l10n-support/deferred-items.md` — pre-existing tsc errors + Node 25 ERR_MODULE_NOT_FOUND chain inventory (the exact 4 tsc files + 5 failing test files)

### Phase archives with UAT items (29-04 scope)
- `.planning/milestones/v1.3-phases/20-orchestration-strategy-diagnostic-dialogue/20-VERIFICATION.md` — 4 human_needed items
- `.planning/milestones/v1.3-phases/21-review-cap-fix-generate-on-enter-posts/21-VERIFICATION.md` — 5 human_needed items (items 3/4 superseded per D-23)
- `.planning/milestones/v1.3-phases/22-swipe-navigation-between-first-level-screens/22-VERIFICATION.md` — 9 human_needed items (items 4/5 superseded per D-23; see 2026-04-15 addendum)
- `.planning/milestones/v1.3-phases/26-trellis-harvest-panel-*/26-VERIFICATION.md` — 7 human_needed items

### House patterns to match (NOT invent new patterns)
- `app/src/providers/llm/index.ts:35` — `composeSignal` helper (use for D-06 signal composition)
- `app/src/providers/llm/index.ts:58,62,72` — `CompletionOptions.signal` + call-site pattern
- `app/src/state/useQuestions.ts:120-123` — canonical `AbortController` + `LOCALE_CHANGED` subscription pattern (Phase 27 D-22). D-06/D-07 must match this structure.
- `app/src/lib/event-bus.ts` — `eventBus.subscribe('LOCALE_CHANGED', ...)` pattern
- `CLAUDE.md` (project root) — i18n workflow for any new toast strings (D-14 / Claude's Discretion)
- `app/scripts/translate-locales.md` — Sonnet subagent template if any new i18n keys need translating

### v1.3 phase frontmatter schema (for 29-04 D-21 updates)
- `.planning/milestones/v1.3-phases/23-*/23-VERIFICATION.md` — example of `status: passed` frontmatter shape
- `.planning/milestones/v1.3-phases/26-*/26-VERIFICATION.md` — example of `re_verification:` block with `previous_status`, `previous_score`, `gaps_closed`, `gaps_remaining`, `regressions` fields

### Project conventions
- `.planning/PROJECT.md` — local-first, multi-provider LLM, style conventions
- `.planning/CLAUDE.md` (root) and `app/CLAUDE.md` — coding conventions, test patterns, i18n rules
- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_daily_goal.md` — REVIEW-03/04 descoped (supports D-23)
- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_i18n_translation.md` — runtime LLM translation prohibited (boundary, not directly in scope)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`composeSignal(...signals)` in `providers/llm/index.ts:35`** — already built by Phase 27. Use it for D-06 (LOCALE_CHANGED + unmount + timeout) without reinventing.
- **`CompletionOptions.signal?: AbortSignal` in `providers/llm/index.ts:58`** — already threaded into `chatCompletion` and `chatStream` fetch call sites. TD-03 only needs the callers to pass the arg through.
- **`eventBus.subscribe('LOCALE_CHANGED', cb)` pattern** — canonical, used in `useQuestions.ts:121-123`. Replicate verbatim in `PostDetailScreen.tsx` for D-06.
- **`trellisActionsService.prune/heal/replant`** — stable APIs referenced by Phase 26 UAT tests; 29-04 operator should not need to modify these (walkthrough, not rewrite).
- **Phase 27 subagent template `app/scripts/translate-locales.md`** — use if any new i18n keys surface during 29-04 inline fixes.

### Established Patterns
- **`AbortController` shared across multiple fetch calls** — `useQuestions.ts` Pass-1 (L156) + Pass-2 (L223) share one signal. D-16 must match.
- **Abort-discard, no partial persistence** — `useQuestions.ts` aborts before `buildAndSave`, so no partial state leaks. D-08 follows the same rule for both TD-02 and TD-03.
- **Frontmatter `re_verification:` block** — already established by Phase 26's re-verification (`26-VERIFICATION.md` lines 6-18). D-21 copies this schema for phases 20/21/22.
- **`{ success, data?, error? }` service result shape** — project-wide. Not strictly required here but any new service-level code should honor.
- **Inline styles with CSS variables** (not Tailwind classes) — established convention per project memory.

### Integration Points
- `PostDetailScreen.tsx` imports `post-essay.service.ts` — signal must be threaded across this boundary in 29-02.
- `useQuestions.ts` imports `canonical-knowledge.service.ts#classifyAndAnchorIncremental` — signal already exists on the caller (`abortController.signal`), just needs to be passed through in 29-02.
- `plannerAutoGen.service.ts` and `concept-feed.service.ts` both import `plannerService` and `orchestration-strategy.service.ts` — 29-01 wiring point.
- `question.service.ts:262` — second classification call site, also needs signal thread-through in 29-02.

### Constraints
- **Do not change `classifyAndAnchor` (single-call fallback) signature** — it must remain the no-signal fallback path per D-17. Only the incremental variant gets the new param.
- **No new dependencies.** v1.3 already added `i18next`, `react-i18next`, `@capacitor/device`. Phase 29 is a pure polish phase — no new packages.
- **Vite build must stay green.** Phase 27's 3.63s build time is the reference.

</code_context>

<specifics>
## Specific Ideas

- **D-22 parity is non-negotiable.** TD-02 and TD-03 must structurally mirror the Phase 27 `useQuestions.ts` pattern so a future reader sees one house style, not three variants.
- **Timeout composition (D-06/D-14) uses existing `timeoutMs` from settings.** If the settings-read path is not reachable from `PostDetailScreen`, fall back to the same 60s the LLM provider uses internally — but prefer reading from settings to keep user configuration authoritative.
- **UAT log format (D-09) should be a table, not prose paragraphs.** Columns: item ID, source phase, test, expected, actual, pass/fail, fix commit (if applicable), date. Auditable at a glance.
- **Inline fixes in 29-04 (D-10) commit individually** — each bug gets its own commit with a clear "fix(29-04): …" message referencing the UAT item ID. Do not bundle multiple unrelated fixes into one commit.

</specifics>

<deferred>
## Deferred Ideas

- **23-05 DEDUP plan (symmetric labelKey + NEW→existing coercion)** — still deferred to v1.4 or beyond. Revisit only if classification dedup surfaces as a real observed problem.
- **Broader tsc / Node 25 cleanup** — Phase 29 scope is narrow (D-04, D-05). If running full `tsc -b --noEmit` during 29-03 surfaces errors outside the 4 target files, those go to a v1.4 backlog item, not Phase 29.
- **Node loader config / tsconfig moduleResolution tweak** — explicitly rejected per D-19. Can be reconsidered in a future phase if the extension-sweep becomes unmaintainable, but not now.
- **Per-phase UAT log files** — considered and rejected (D-09). Single file is authoritative. If future operators want per-phase breakouts, they can grep by source-phase column.
- **Introducing a `useAbortOnLocaleChange` custom hook** — tempting DRY move but rejected for Phase 29 to keep TD-02 and TD-03 structurally parallel to the inlined Phase 27 pattern. A hook can be extracted in a future refactor phase once 3+ call sites exist.
- **Captured UAT screenshots** — the Phase 27 operator UAT approved without archiving image files. 29-04 follows the same precedent; screenshots are optional. If operator chooses to capture them, save to `.planning/phases/29-final-polishment/uat-screenshots/` matching the Phase 27 folder structure.

</deferred>

---

*Phase: 29-final-polishment*
*Context gathered: 2026-04-16*
