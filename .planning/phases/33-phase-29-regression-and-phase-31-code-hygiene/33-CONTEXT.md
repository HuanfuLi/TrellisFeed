# Phase 33: Phase 29 regression + Phase 31 code hygiene + opportunistic polish — Context

**Gathered:** 2026-04-19
**Revised:** 2026-04-19 (post Phase 32.1 Wave 4 — re-evaluated against current codebase + added v2 scope: perf memoization + cosmetic polish)
**Status:** Ready for planning (Wave 1 — original TD-04/05/06 still required; Wave 2 — v2 additions)

<domain>
## Phase Boundary

Resolve the three code regressions surfaced by `.planning/v1.4-MILESTONE-AUDIT.md` (TD-04, TD-05, TD-06), unify the trellis leaf-state vocabulary by renaming `LeafState` literals to match user-facing design names, AND land the v2 scope additions: opportunistic perf memoization + cosmetic polish that surfaced from a 2026-04-19 codebase audit (post Phase 32.1 Wave 4).

**Status by item (re-evaluated against current codebase 2026-04-19):**

| Item | Original Plan | Status |
|---|---|---|
| WIP flush (D-19/D-20/D-21) | Plan 33-00 | ✅ DONE — commit `fe4a2387` (2026-04-19 morning) |
| TD-05 ConceptProgressCard delete (D-06/D-09) | Plan 33-01 | ⏳ STILL NEEDED — file exists, zero consumers, 4 orphan i18n keys still in all 4 bundles |
| TD-04 strategy-bias test cleanup (D-01..D-05) | Plan 33-02 | ⏳ STILL NEEDED — `concept-feed-strategy.test.mjs` exists; TD-01 plumbing assertion in `orchestration-strategy.test.mjs` exists |
| TD-06 LeafState rename (D-10..D-15) | Plan 33-03 | ⏳ STILL NEEDED — `'yellow'`/`'fallen'` literals present at trellis-state.service.ts:9/88/90/117/119/121, concept-feed.service.ts:671, TrellisStatusPanel/TrellisLeaf |
| 5 Phase 31 tsc errors (D-16/D-17/D-18) | Plan 33-04 | ✅ DONE — `tsc -b --noEmit` exit 0; SATISFIED-BY pre-existing cleanup commits (per original 33-04 plan note: SATISFIED-BY-760fa4f8) |
| Wave 4 WIP re-flush (NEW) | Plan 33-05 | ⏳ NEW — 12 working-tree files modified post-`fe4a2387` (Wave 4 fixes); must commit before any Phase 33 code edits |
| Perf memoization (NEW v2) | Plan 33-06 | ⏳ NEW — settings.getSync() memoization + React.memo on heavy cards |
| Cosmetic touch-target + spacing tokens (NEW v2) | Plan 33-07 | ⏳ NEW — 4 small consistency fixes (PlannerScreen + ChatInput) |

**In scope (ordered by execution):**
1. WIP re-flush (NEW Plan 33-05) — review + commit the 12 working-tree files from Phase 32.1 Wave 4 (prerequisite so subsequent edits land cleanly).
2. TD-05 partial orphan sweep (Plan 33-01, unchanged) — delete `ConceptProgressCard.tsx` + 4 orphan `home.feed.*` i18n keys; defer `post-store.service.ts` and `ImmersiveInfoFlow` to v1.5.
3. TD-06 via full LeafState rename (Plan 33-03, unchanged) — `'yellow'` → `'dying'`, `'fallen'` → `'dead'` across type union, `computeLeafState`, trellis components, dev-mode seeds, tests. `'falling'` stays (internal-only gradation).
4. TD-04 supersession (Plan 33-02, unchanged) — delete `concept-feed-strategy.test.mjs` + orphaned TD-01 plumbing assertion in `orchestration-strategy.test.mjs`; update `29-VERIFICATION.md` + `29-UAT-LOG.md` to mark TD-01 SUPERSEDED-BY-PHASE-31 with pointer to D-14.
5. Perf memoization (NEW Plan 33-06) — D-22, D-23 below.
6. Cosmetic polish (NEW Plan 33-07) — D-24, D-25 below.

**Out of scope (deferred / post-Phase 33):**
- The 5 Phase 31 tsc errors — already SATISFIED (Plan 33-04 verification deferred or skipped).
- Token-cost LLM-call optimizations — initial research surfaced two HIGH-priority candidates (question-filter threshold tuning at `question-filter.service.ts:122-127`; combined LLM call refactor at `canonical-knowledge.service.ts:906`) but BOTH change LLM behavior in semantically-meaningful ways with no characterization tests to bound the risk. Deferred to v1.5 with a "write tests first" prerequisite.
- Restoring `applyStrategyBias` in concept-feed (explicitly rejected in favor of supersession — Phase 31 D-14 already implements weak-concept bias).
- `post-store.service.ts` deletion (retained; revisit next milestone).
- `ImmersiveInfoFlow` export deletion (retained; revisit next milestone).
- Renaming `'falling'` (kept as internal implementation detail — the UI never exposes it).
- Append-only derived list + persistent cycle position in concept-feed pipeline — explicit v1.5 carry-over per CLAUDE.md "Concept Feed Generation Pipeline" gaps section. Phase 33 must NOT close this.
- IntersectionObserver-derived `inView` for trellis (Phase 28 D-13 placeholder) — v1.5.
- Code splitting / lazy routes for bundle reduction — out of scope (would require swipe-tab architecture changes which CLAUDE.md locks).
- React.memo on `TrellisLeaf` — medium risk (interacts with Phase 28 D-10/D-11/D-12/D-13 animation surfaces); deferred.
- Event-bus subscriber debounce in `useTrellisData` — touches the GRAPH_UPDATED unification system (CLAUDE.md "Event bus" section, locked in Phase 32.1); deferred.
- Text-art prompt batching in `concept-feed.service.ts` — adds partial-failure surface; deferred.
- i18n string-overflow audit (Spanish-runs-longer concern) — deferred.
- Pre-existing 4 tsc errors in AskScreen / PlannerScreen / SettingsFeaturesScreen / SettingsScreen (carried from Phase 29) — note: tsc is now CLEAN per current measurement; these may already be resolved.
- Pre-existing 24 Node-25 trellis test failures (carried from v1.3).

**Depends on:** Phase 32 (verification baseline complete) + Phase 32.1 Wave 4 (working-tree changes must be flushed via Plan 33-05 first).

</domain>

<decisions>
## Implementation Decisions

### TD-04 — Phase 29 TD-01 regression

- **D-01:** SUPERSEDE the original TD-01 contract. Do NOT restore `applyStrategyBias` + `computeHints` in `concept-feed.service.ts`. Rationale: Phase 31 D-14 (generation-time weak-concept prioritization — 2 posts per important concept) already implements the weak-concept bias at the right layer. Restoring the Phase 29 sort bias would double-layer the weighting.
- **D-02:** Delete `app/tests/services/concept-feed-strategy.test.mjs` entirely (5 failing tests all assume applyStrategyBias exists).
- **D-03:** Delete the TD-01 plumbing assertion in `app/tests/services/orchestration-strategy.test.mjs` (the 1 remaining concept-feed-side assertion; leave the plannerAutoGen-side assertion alone since plannerAutoGen still wires checkInSignals).
- **D-04:** Update `.planning/phases/29-final-polishment/29-VERIFICATION.md`:
  - Change TD-01 row status from `SATISFIED` to `SUPERSEDED-BY-PHASE-31`.
  - Add Evidence cell: "Phase 31 D-14 (31-CONTEXT.md) implements weak-concept prioritization at generation time — 2 posts per important concept. This subsumes the Phase 29 runtime sort bias. concept-feed.service.ts still calls plannerService.getRecentSignals() at line 251 for LLM prompt context, but applyStrategyBias is intentionally absent."
- **D-05:** Update `.planning/phases/29-final-polishment/29-UAT-LOG.md`: add a SUPERSEDED entry for TD-01 with the same pointer to 31-CONTEXT D-14. Preserve original UAT row — append, don't overwrite.

### TD-05 — Partial orphan sweep

- **D-06:** Delete `app/src/components/ConceptProgressCard.tsx` entirely. Both exports (`ConceptProgressCard`, `CompactProgressBar`) are replaced by `VineProgress.tsx` and have zero live consumers.
- **D-07:** Retain `app/src/services/post-store.service.ts` (deferred — no deletion in Phase 33). If `postStoreService` remains unused at the start of v1.5 milestone planning, revisit.
- **D-08:** Retain `ImmersiveInfoFlow` export in `app/src/components/InfoFlow.tsx` (deferred — no deletion). Same revisit trigger.
- **D-09:** Remove any dead i18n keys that were ONLY consumed by ConceptProgressCard/CompactProgressBar from all 4 locale bundles (`home.progress.*`, `home.compact.*` if they existed and are now unreferenced). grep-verify before deleting. Preserve all keys still referenced by VineProgress or any other component.

### TD-06 — LeafState vocabulary unification

- **D-10:** Rename `LeafState` literal `'yellow'` → `'dying'` across the entire codebase.
- **D-11:** Rename `LeafState` literal `'fallen'` → `'dead'` across the entire codebase.
- **D-12:** Keep `'falling'` as-is — it's an internal-only 7-13d-overdue gradation the UI never exposes. Rationale: the user-facing UI distinguishes only "Dying" and "Dead"; `'falling'` is a layout-level visual cue for medium-overdue leaves that falls under "Dying" semantically (see `TrellisStatusPanel.tsx:44`).
- **D-13:** Update targets:
  - `app/src/services/trellis-state.service.ts:9` (type union) + lines 88-90 (computeLeafState return values) + dev-mode seed array lines 113-119 (all string literals).
  - `app/src/components/trellis/TrellisStatusPanel.tsx:44-45` (filter predicates).
  - `app/src/components/trellis/TrellisCanvas.tsx` (any leaf-state string comparisons).
  - `app/src/components/trellis/TrellisLeaf.tsx` (state-to-color/shape mapping).
  - `app/src/components/trellis/types.ts` (any local type re-exports).
  - `app/src/components/ui/Badge.tsx` (leaf-state-aware variants if any).
  - `app/src/services/concept-feed.service.ts:745` — after the rename, the existing `'dying'` literal becomes VALID (no longer TS2367). The TD-06 tsc error clears automatically.
  - `app/tests/**` — any test fixtures referencing `'yellow'` or `'fallen'` (grep-sweep).
- **D-14:** Locale bundle i18n keys (`trellis.leafState.dying`, `trellis.leafState.dead`) already exist with correct values — no locale bundle changes required. Verify with bundle-parity test after rename.
- **D-15:** Git-history preservation: use a single commit for the rename so `git log --follow` traces cleanly. Do not mix the rename commit with TD-04 / TD-05 work.

### 5 new Phase 31 tsc errors (D-16/D-17/D-18 — CLOSED 2026-04-19)

- **D-16 [SATISFIED-BY-pre-existing]:** VineProgress prop interface is now `mode/concepts/onConceptTap/onHistoryTap` only — no unused props. Verified at `app/src/components/VineProgress.tsx:5-10`.
- **D-17 [SATISFIED-BY-pre-existing]:** No tsc errors related to unused helpers in `concept-feed.service.ts` per current measurement.
- **D-18 [SATISFIED 2026-04-19]:** `cd app && npx tsc -b --noEmit` returns exit 0 (clean). Zero errors anywhere in the project (the 4 pre-existing errors in AskScreen/PlannerScreen/SettingsFeaturesScreen/SettingsScreen mentioned in the original Phase 33 context appear to have been resolved by intervening phases). Plan 33-04 verification step is OPTIONAL — Phase 33 closure can rely on the in-context measurement here.

### WIP flush (D-19/D-20/D-21 — CLOSED 2026-04-19 morning)

- **D-19 [DONE — commit `fe4a2387`]:** Original 11 files committed via `chore(v1.4): flush WIP — quota refactor + i18n polish (3 new keys)`. See `33-00-SUMMARY.md`.
- **D-20 [DONE]:** Per-file diff review confirmed clean.
- **D-21 [DONE]:** `concept-batch-filter.test.mjs`, `daily-generation-cap.test.mjs`, `starter-posts.test.mjs` all GREEN at flush time.

### Wave 4 WIP re-flush — Plan 33-05 (NEW, 2026-04-19 evening)

After `fe4a2387` landed, Phase 32.1 Wave 4 introduced a second batch of working-tree changes (12 files):

| File | Wave 4 disposition |
|---|---|
| `app/src/components/ScrollToTopFAB.tsx` | (verify diff) |
| `app/src/locales/{en,zh,es,ja}.json` | new i18n keys for Wave 4 features |
| `app/src/screens/PlannerScreen.tsx` | minor edits |
| `app/src/screens/SettingsScreen.tsx` | minor edits |
| `app/src/screens/settings/SettingsDataScreen.tsx` | minor edits |
| `app/src/screens/settings/SettingsFeaturesScreen.tsx` | minor edits |
| `app/src/services/daily-read.service.ts` | minor edits |
| `app/src/services/post-history.service.ts` | minor edits |
| `app/tests/concept-quota.test.mjs` | test updates |
| `app/tests/services/concept-batch-filter.test.mjs` (untracked) | already landed pre-33-00 per `33-00-SUMMARY.md` notes — re-verify status |
| `app/tests/services/daily-generation-cap.test.mjs` (untracked) | same re-verify |
| `app/tests/services/starter-posts.test.mjs` (untracked) | same re-verify |

- **D-29 [NEW]:** Plan 33-05 commits the Wave 4 working-tree changes via a single chore commit before any subsequent Phase 33 plan executes. Commit subject: `chore(v1.4): flush Wave 4 follow-up WIP (Phase 32.1 cleanup)`.
- **D-30 [NEW]:** Per-file diff review applies (same policy as D-20). Reject the flush if any file contains debug logs, half-implemented work, or unrelated experiments.
- **D-31 [NEW]:** All targeted tests must pass at the flush boundary: `node --test tests/concept-quota.test.mjs tests/services/concept-batch-filter.test.mjs tests/services/daily-generation-cap.test.mjs tests/services/starter-posts.test.mjs tests/locales/bundle-parity.test.mjs`. If any fails, pause and fix before flushing.

### v2 Performance memoization — Plan 33-06 (NEW, 2026-04-19)

Identified by codebase audit. Both opportunities are localized component-level optimizations with no architectural impact.

- **D-22 [NEW] — Settings memoization at render hotspots:**
  - `app/src/components/InfoFlow.tsx:103` — `settingsService.getSync().imageGeneration.enabled` is called inside the `useEffect` that fires per-card on every `ConceptCard` mount + image-eligibility change. Move the read out of the effect's hot path: hoist to a `useMemo(() => settingsService.getSync().imageGeneration.enabled, [settingsVersion])` driven by a `SETTINGS_CHANGED` event-bus subscription (or rely on the existing event taxonomy). Acceptance: zero behavioral change; `imageGeneration.enabled` toggling still gates new image gen.
  - HomeScreen settings reads (line numbers vary post-Wave 4): apply same pattern to any `settingsService.getSync()` calls inside render closures. Subscribe-once-on-mount, invalidate-on-event.
  - Guardrail: do NOT remove the existing `imageGeneration.enabled` short-circuit at `InfoFlow.tsx:104`. The check stays; only the read is moved.

- **D-23 [NEW] — React.memo on ConceptCard + VineProgress:**
  - `app/src/components/InfoFlow.tsx` — wrap `ConceptCard` in `React.memo` with a custom equality function comparing `(post.id, isActive, videoPlaying, image, imageResolved)`. The parent re-renders 8 cards on every event; today, all 8 re-render even if only one card's state changed.
  - `app/src/components/VineProgress.tsx` — wrap the default export in `React.memo` (props are `mode`, `concepts`, `onConceptTap`, `onHistoryTap`; concepts is a stable array reference and callbacks come from parent refs).
  - DO NOT wrap `TrellisLeaf` — interacts with Phase 28 D-10/D-11/D-12/D-13 animation surfaces. Deferred to v1.5.
  - Acceptance: zero behavioral change; profile shows fewer re-renders on swipe-for-more and on event-bus emissions.

- **D-22-GUARDRAIL:** Render-layer changes MUST NOT touch the load-bearing render fallback at `InfoFlow.tsx:140-167` (Phase 32.1 Wave 4 Bug D — `wouldRenderVisual` exhaustive check). The fallback stays.

### v2 Cosmetic polish — Plan 33-07 (NEW, 2026-04-19)

Four small consistency fixes surfaced by codebase audit. All are token/value substitutions with no layout impact.

- **D-24 [NEW] — Touch-target compliance (WCAG 2.5.8 — 44x44px minimum):**
  - `app/src/screens/PlannerScreen.tsx:152` — refresh button `width: '28px', height: '28px'` → `width: '44px', height: '44px'`. Adjust the icon size (`<RefreshCw size={...}>`) to preserve visual density.
  - `app/src/components/ChatInput.tsx:110-111` — mic button `width: '34px', height: '34px'` → `width: '44px', height: '44px'`. Apply the same change to the globe button immediately following (search ChatInput for the second 34/34 occurrence).
  - Verify on device that adjacent buttons don't overlap after the size bump. If they do, increase parent container `gap` proportionally.

- **D-25 [NEW] — Spacing & shadow token migration:**
  - `app/src/components/ChatInput.tsx:97` — `boxShadow: '0 4px 12px rgba(0,0,0,0.1)'` → `boxShadow: 'var(--shadow-2)'`. Matches the unified shadow tier (Phase 32.1 Wave 4 D-W4-08).
  - `app/src/screens/PlannerScreen.tsx:24` (EmptySectionHint) — `padding: '14px 16px'` → `padding: 'var(--space-md) var(--space-lg)'` (= 12px 16px). Note the 14→12 vertical change is intentional (token grid).
  - `app/src/screens/PlannerScreen.tsx:302, 317` (show/hide buttons) — `padding: '10px 16px'` → `padding: 'var(--space-sm) var(--space-lg)'` (= 8px 16px). Note the 10→8 vertical change is intentional.

- **D-26 [NEW] — No icon library, no Tailwind, no translation changes:** Per CLAUDE.md, project convention is inline styles + CSS vars + lucide-react icons + i18next bundles. Cosmetic plan must NOT introduce new packages, Tailwind classes, or runtime LLM translation.

### Claude's Discretion

- Commit granularity within each task (single atomic commit per decision bundle, or finer-grained per-file commits).
- Order of tasks within a plan wave (e.g., WIP flush before or alongside TD-05 deletions).
- Whether to bundle D-01..D-05 (TD-04 supersession) as one plan or two (code delete vs docs update).
- Whether to add a new test asserting the TD-06 fix (e.g., test that `computeLeafState` returns `'dying'` for 1d-overdue input).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit source

- `.planning/v1.4-MILESTONE-AUDIT.md` — TD-04/05/06 definitions, severity, and location citations.
- `.planning/v1.4-INTEGRATION-CHECK.md` — seam-by-seam file:line evidence for each regression.

### Phase 32 dependency

- `.planning/phases/32-v1-4-verification-close-out-and-uat-retest/32-CONTEXT.md` — Phase 32 must complete before Phase 33 (Phase 32 writes 30/31-VERIFICATION.md; Phase 33 mutates the code those files reference).

### TD-04 update targets

- `.planning/phases/29-final-polishment/29-VERIFICATION.md` — row to amend.
- `.planning/phases/29-final-polishment/29-UAT-LOG.md` — append SUPERSEDED entry.
- `.planning/phases/31-curiosity-feed-redesign-post-lifecycle-and-display/31-CONTEXT.md` — D-14 text to cite in the supersession evidence.

### Code files to modify (grouped by decision)

**TD-04 (D-02, D-03):**
- `app/tests/services/concept-feed-strategy.test.mjs` — delete
- `app/tests/services/orchestration-strategy.test.mjs` — remove TD-01 plumbing assertion

**TD-05 (D-06, D-09):**
- `app/src/components/ConceptProgressCard.tsx` — delete
- `app/src/locales/en.json`, `zh.json`, `es.json`, `ja.json` — remove dead keys after grep verification

**TD-06 (D-10..D-15):**
- `app/src/services/trellis-state.service.ts`
- `app/src/components/trellis/TrellisStatusPanel.tsx`
- `app/src/components/trellis/TrellisCanvas.tsx`
- `app/src/components/trellis/TrellisLeaf.tsx`
- `app/src/components/trellis/types.ts`
- `app/src/components/ui/Badge.tsx` (if leaf-state aware)
- `app/src/services/concept-feed.service.ts` (line 745 becomes valid automatically)
- `app/tests/**` — test fixtures referencing renamed literals

**tsc errors (D-16, D-17):**
- `app/src/components/VineProgress.tsx` — 3 unused props
- `app/src/services/concept-feed.service.ts` — 4 unused helpers

**WIP (D-19, D-20, D-21) — CLOSED via commit `fe4a2387`. See `33-00-SUMMARY.md`.**

**Wave 4 WIP re-flush (D-29, D-30, D-31) — files currently in working tree per `git status` 2026-04-19 evening:**
- `app/src/components/ScrollToTopFAB.tsx` (M)
- `app/src/locales/{en,zh,es,ja}.json` (M)
- `app/src/screens/PlannerScreen.tsx` (M)
- `app/src/screens/SettingsScreen.tsx` (M)
- `app/src/screens/settings/SettingsDataScreen.tsx` (M)
- `app/src/screens/settings/SettingsFeaturesScreen.tsx` (M)
- `app/src/services/daily-read.service.ts` (M)
- `app/src/services/post-history.service.ts` (M)
- `app/tests/concept-quota.test.mjs` (M)
- `app/tests/services/concept-batch-filter.test.mjs` (untracked — recheck)
- `app/tests/services/daily-generation-cap.test.mjs` (untracked — recheck)
- `app/tests/services/starter-posts.test.mjs` (untracked — recheck)

**v2 Performance memoization (D-22, D-23):**
- `app/src/components/InfoFlow.tsx` (settings memoization at line ~103 + ConceptCard React.memo wrap)
- `app/src/components/VineProgress.tsx` (React.memo wrap)
- `app/src/screens/HomeScreen.tsx` (settings memoization at any inline `settingsService.getSync()` call site)

**v2 Cosmetic polish (D-24, D-25, D-26):**
- `app/src/screens/PlannerScreen.tsx` (refresh button size + EmptySectionHint padding + show/hide button padding)
- `app/src/components/ChatInput.tsx` (mic + globe button sizes + container shadow)

### Project conventions

- `CLAUDE.md` — inline styles with CSS vars, 4-locale i18n bundle parity mandatory, settingsService pattern, no runtime LLM translation.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`computeLeafState`** is the single source of truth for leaf state derivation; rename impact radiates from its signature.
- **`TrellisStatusPanel.tsx:43-45`** — today's UI-vocabulary mapping (yellow+falling → "Dying", fallen → "Dead"). Post-rename this simplifies: `dyingNodes.filter(n => n.leafState === 'dying' || n.leafState === 'falling')` stays two-state (since we keep 'falling'), but the semantics are cleaner.
- **`plannerAutoGen.service.ts:115-116`** — the surviving TD-01 wiring. Phase 33 leaves it alone.
- **`bundle-parity.test.mjs`** — verifies locale-bundle key sets stay aligned across 4 locales. Re-run after TD-05 D-09 locale key removal.

### Established Patterns

- LeafState lifecycle transitions happen in `computeLeafState` at `trellis-state.service.ts:88-91`. Post-rename:
  - `maxOverdue >= 14 || aggregateEase < 1.5` → `'dead'`
  - `maxOverdue >= 7` → `'falling'` (unchanged)
  - `maxOverdue >= 1` → `'dying'`
  - else → `'green'`
- Dev-mode seeded entries at `trellis-state.service.ts:110-120` use the literal strings — must update every entry.
- Confetti + harvest particle flow in `TrellisStatusPanel` consumes `leafState === 'fruit'` — unaffected by the rename.

### Integration Points

- After rename, `concept-feed.service.ts:671` (re-baselined from original :745) reads `leaf === 'dying' || leaf === 'falling' || leaf === 'fallen'`. `'fallen'` must also become `'dead'` in the same sweep — otherwise the line re-introduces TS2367. Full rename is atomic per D-15.
- Locale bundle keys `trellis.leafState.dying` / `trellis.leafState.dead` already exist (Phase 27 i18n) — no new keys needed.
- `npm test` baseline after Phase 33 should be: pre-existing failures only (carried from v1.3 + v1.4 baselines per Phase 32.1 measurement: 32 baseline failures from JSON-import-attribute issue) + zero new failures. Any new failure indicates a missed callsite in the rename or a memo regression.

### v2 — Performance memoization integration points

- **`InfoFlow.tsx` ConceptCard memoization (D-22, D-23):** The component receives `post`, `isActive`, plus internal state `image`, `imageResolved`, `videoPlaying`. Equality function MUST include all props that affect render output. Phase 32.1 Wave 4 D-W4-03 (render-layer defense net `wouldRenderVisual`) MUST remain authoritative — the memo wrapper sits OUTSIDE the render fallback, never inside.
- **`HomeScreen.tsx` settings reads (D-22):** Today's flow re-evaluates `settingsService.getSync()` on every navigation back to /home (always-mounted screen still re-renders on event-bus emissions). Memoizing requires either: (a) a `SETTINGS_CHANGED` event + invalidation, or (b) a useState-driven snapshot updated on subscribe. Both safe; (b) is simpler.
- **VineProgress memoization (D-23):** Receives `concepts: Array<{ id, name, explored }>`. Memo key MUST treat the array reference as a value (deep equality not needed if parent passes a stable reference; however `concepts.map(c => c.id + c.explored).join('|')` is a safer custom comparator).

### v2 — Cosmetic touch-target integration points

- **`PlannerScreen.tsx:152` refresh button (D-24):** Currently 28×28px with a `RefreshCw size={14}` (verify the icon size constant near the button). Bumping to 44×44px should KEEP the icon at 14-16px so it doesn't dominate the button.
- **`ChatInput.tsx:110-111` mic button + adjacent globe button (D-24):** Container at line 90-100 has `padding: '12px 16px'` and `gap: '10px'`. Bumping mic+globe from 34→44px will increase the total ChatInput height by ~10px. Verify on device that bottom-nav clearance still works (ChatInput is anchored at the bottom of the AskScreen layout).
- **`ChatInput.tsx:97` shadow migration (D-25):** Current `'0 4px 12px rgba(0,0,0,0.1)'` is ~equivalent to `var(--shadow-2)` (verify `--shadow-2` definition in `app/src/index.css` before swap to confirm visual parity). If the substitute is darker/lighter, escalate before landing.

</code_context>

<specifics>
## Specific Ideas

- For the TD-06 rename, use a single find-and-replace pass across the target files, then grep-verify zero residual `'yellow'` or `'fallen'` string literals in `LeafState` contexts. Separate rename per literal to avoid double-touch.
- The SUPERSEDED-BY-PHASE-31 marker in 29-VERIFICATION.md should match whatever pattern the 29-UAT-LOG.md uses for SKIP entries — same vocabulary, different key: SKIP for items that never applied, SUPERSEDED for items that applied then got superseded.
- `concept-feed-strategy.test.mjs` likely has 5 test cases asserting applyStrategyBias behavior. Delete the file in one commit, not piecewise.
- If any Wave 4 WIP file diff looks off during the re-flush (e.g., debug logs, commented-out code), park in a branch and escalate — don't force-commit.
- For v2 perf memos (D-22, D-23): land each memo as its own commit so a regression can be bisected to the exact wrapping. Don't bundle ConceptCard memo with VineProgress memo.
- For v2 cosmetic (D-24, D-25): land touch-target bumps and token migrations as one chore commit per file. Verify each change in dev mode (`npm run dev`) before committing — touch-target changes can subtly break button alignment.

</specifics>

<deferred>
## Deferred Ideas

- Delete `post-store.service.ts` — revisit at start of v1.5 milestone planning (D-07).
- Delete `ImmersiveInfoFlow` export in `InfoFlow.tsx` — revisit at start of v1.5 (D-08).
- Rename `'falling'` to a mortality-themed literal — not worth the churn; UI never exposes it (D-12).
- Restore `applyStrategyBias` in concept-feed — explicitly rejected in favor of Phase 31 D-14's generation-time prioritization (D-01).
- Pre-existing 4 tsc errors in AskScreen / PlannerScreen / SettingsFeaturesScreen / SettingsScreen — RESOLVED per current measurement (tsc exit 0 on 2026-04-19).
- Pre-existing 32 baseline test failures (JSON-import-attribute) — v1.5 concern.
- Phase 28's 6 human-UAT items — opportunistic only, not a Phase 33 gate.

### v2 Deferred (researched 2026-04-19, NOT in Phase 33)

- **Question-filter LLM threshold tuning** (`question-filter.service.ts:122-127`) — would skip LLM call for confidence below 0.3 and treat above 0.65 as off-topic. Skipped because: no characterization tests exist; semantically changes flag/no-flag boundary; pattern.flagged trust is asymmetric (true vs. false meanings differ at the threshold). Prerequisite: write tests first.
- **Combined LLM call refactor in canonical-knowledge new-branch path** (`canonical-knowledge.service.ts:906`) — would reduce token re-tokenization in the rare new-branch fallback. Skipped because: complex refactor, low frequency, and the path already includes a placeholder-rejection guard from Phase 32.1 Wave 4 Bug 8 that we don't want to perturb.
- **Text-art prompt batching in concept-feed** — would batch N posts in one LLM call; adds partial-failure surface. Defer to Phase 34 if latency becomes a concern.
- **Event-bus subscriber debounce in `useTrellisData`** — touches the GRAPH_UPDATED unification system locked in Phase 32.1. Higher risk than perceived; defer.
- **React.memo on `TrellisLeaf`** — interacts with Phase 28 D-10/D-11/D-12/D-13 (shake/haptic/pulse/perf-mask). Defer to v1.5.
- **IntersectionObserver-driven `inView` for trellis perf-mask** — Phase 28 D-13 placeholder still stubbed `inView=true`. Architecture-level, defer to v1.5.
- **Bundle splitting / lazy routes** — would conflict with the always-mounted swipe screens architecture. Defer to v1.5 architecture review.
- **i18n string-overflow audit** — needs Sonnet subagent + visual review. Defer.

</deferred>

---

*Phase: 33-phase-29-regression-and-phase-31-code-hygiene*
*Context gathered: 2026-04-19*
*Context revised: 2026-04-19 (v2 — perf + cosmetic additions)*
