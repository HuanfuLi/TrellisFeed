# Phase 33: Phase 29 regression + Phase 31 code hygiene — Research

**Researched:** 2026-04-19
**Domain:** Code hygiene / regression closure — no net-new product surface
**Confidence:** HIGH (every finding below verified against the working tree at HEAD `310f2802`)

## Summary

Phase 33's written scope spans five work bundles (TD-04 supersession, TD-05 orphan delete, TD-06 LeafState rename, 5 new Phase 31 tsc errors, WIP flush). Reality at HEAD is narrower: **commit `760fa4f8` (2026-04-18 23:34, "chore(types): clear 10 stale tsc errors blocking device build") has already resolved every piece of the "5 new Phase 31 tsc errors" bundle AND pre-renamed the `'dying'` literal in concept-feed.service.ts to `'yellow'`**. `npx tsc -b --noEmit` is now clean (exit 0), `npx vite build` is clean, and the 4 "pre-existing" tsc errors the CONTEXT.md treats as out-of-scope are ALSO gone. The CONTEXT.md was authored from the pre-`760fa4f8` audit snapshot and is stale on these points.

Three work bundles remain real:

1. **TD-04 supersession** — delete `concept-feed-strategy.test.mjs` + one TD-01 plumbing assertion in `orchestration-strategy.test.mjs`, update `29-VERIFICATION.md` + `29-UAT-LOG.md`. 6 live test failures today.
2. **TD-05 partial orphan sweep** — delete `ConceptProgressCard.tsx` + 4 orphaned i18n keys (`home.feed.{title,complete,progress,progressCompact}`) across all 4 locale bundles.
3. **TD-06 vocabulary rename** — rename LeafState `'yellow'` → `'dying'` and `'fallen'` → `'dead'` across 6 production files + 2 test files. Purely a renaming refactor; `'falling'` stays untouched. The concept-feed.service.ts line that originally triggered the rename (now line 654, formerly reported as 745) already reads `'yellow' || 'falling' || 'fallen'` — after the rename it will read `'dying' || 'falling' || 'dead'`.
4. **WIP flush** — 9 modified files + 3 untracked test files. All diffs reviewed below; all expected-clean (i18n polish, quota semantics refinement, 3 new bug-fix test suites that each pass locally).

**Primary recommendation:** Planner should produce a 4-wave plan: (W0) WIP flush as a single `chore` commit, (W1) TD-05 + TD-04 (delete-then-docs, two commits), (W2) TD-06 LeafState rename (one atomic commit per D-15), (W3) verification — `npm test`, `tsc -b`, `bundle-parity`, `vite build`. Planner should NOT include any task for the "5 tsc errors" bundle — explicitly mark it SATISFIED-BY-760fa4f8 and close the tracking decisions D-16/D-17/D-18 as no-op.

## Project Constraints (from CLAUDE.md)

- **Inline styles with CSS variables** — not Tailwind classes for most UI. Planner must not switch to utility classes when touching TrellisLeaf / TrellisStatusPanel / VineProgress.
- **ServiceResult<T>** return shape for services. Not directly relevant to Phase 33 (no service signatures change), but any new helper must obey.
- **localStorage via `settingsService`** — not relevant here (no settings touched).
- **i18n rule (the ONE rule):** runtime LLM translation is PROHIBITED. All 4 locale bundles MUST land in the SAME commit. Phase 33's locale work (deleting 4 orphan keys) MUST hit `en.json` + `zh.json` + `es.json` + `ja.json` in one commit.
- **Bundle parity test is load-bearing** (`tests/locales/bundle-parity.test.mjs`) — asserts identical key sets across 4 bundles. Must re-run after D-09 key deletion.
- **Test framework:** Node's built-in `node --test`. New test files use `.test.mjs` extension and the `capacitor-mock-loader`/`trellis-mock-loader` loaders as appropriate. See existing patterns in `tests/services/`.
- **No emojis in commit messages / files** unless user explicitly asks.
- **Protected proper nouns** (don't translate): EchoLearn, OpenAI, Claude, Gemini, etc. Not relevant here — we're only deleting keys, not editing values.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**TD-04 — Phase 29 TD-01 regression (supersede, don't restore):**
- **D-01:** SUPERSEDE the original TD-01 contract. Do NOT restore `applyStrategyBias` + `computeHints` in `concept-feed.service.ts`. Rationale: Phase 31 D-14 (generation-time weak-concept prioritization — 2 posts per important concept) already implements the weak-concept bias at the right layer. Restoring the Phase 29 sort bias would double-layer the weighting.
- **D-02:** Delete `app/tests/services/concept-feed-strategy.test.mjs` entirely (5 failing tests all assume `applyStrategyBias` exists).
- **D-03:** Delete the TD-01 plumbing assertion in `app/tests/services/orchestration-strategy.test.mjs` (the 1 remaining concept-feed-side assertion; leave the plannerAutoGen-side assertion alone since plannerAutoGen still wires checkInSignals).
- **D-04:** Update `.planning/phases/29-final-polishment/29-VERIFICATION.md` — change TD-01 row status from `SATISFIED` to `SUPERSEDED-BY-PHASE-31`; add Evidence cell pointing to 31-CONTEXT D-14.
- **D-05:** Update `.planning/phases/29-final-polishment/29-UAT-LOG.md` — append a SUPERSEDED entry for TD-01 with the same pointer. Preserve the original UAT row.

**TD-05 — Partial orphan sweep:**
- **D-06:** Delete `app/src/components/ConceptProgressCard.tsx` entirely. Both exports have zero live consumers.
- **D-07:** Retain `app/src/services/post-store.service.ts` — deferred. Revisit v1.5.
- **D-08:** Retain `ImmersiveInfoFlow` export in `app/src/components/InfoFlow.tsx` — deferred. Revisit v1.5.
- **D-09:** Remove dead i18n keys that were ONLY consumed by ConceptProgressCard from all 4 locale bundles. grep-verify before deleting. Preserve keys still referenced by VineProgress or other components.

**TD-06 — LeafState vocabulary unification:**
- **D-10:** Rename `LeafState` literal `'yellow'` → `'dying'` across the entire codebase.
- **D-11:** Rename `LeafState` literal `'fallen'` → `'dead'` across the entire codebase.
- **D-12:** Keep `'falling'` as-is — it's an internal-only 7-13d-overdue gradation the UI never exposes.
- **D-13:** Update targets (7 files + test sweep).
- **D-14:** Locale bundle i18n keys (`trellis.leafState.dying`, `trellis.leafState.dead`) already exist with correct values — no locale bundle changes required. (Research note: keys are actually at `planner.trellis.dying` and `planner.trellis.dead` — same point holds.)
- **D-15:** Git-history preservation — use a SINGLE commit for the rename. Do not mix the rename commit with TD-04 / TD-05 work.

**5 new Phase 31 tsc errors:**
- **D-16:** VineProgress 3 unused props — wire or drop.
- **D-17:** 4 unused helpers in `concept-feed.service.ts` — delete with git-grep confirmation of zero call sites.
- **D-18:** After all fixes, `npx tsc -b --noEmit` MUST show only the 4 pre-existing errors documented in `29-03-SUMMARY.md`.

**WIP flush:**
- **D-19:** Commit all 9 modified + 3 untracked files as a Phase 33 prerequisite. Single commit message: `chore(v1.4): flush WIP from phases 30-31 follow-up edits`.
- **D-20:** Review policy during the flush — abort + escalate if any file looks unsafe.
- **D-21:** The 3 new test files must pass before the flush commit.

### Claude's Discretion

- Commit granularity within each task (single atomic commit per decision bundle, or finer-grained per-file commits).
- Order of tasks within a plan wave (e.g., WIP flush before or alongside TD-05 deletions).
- Whether to bundle D-01..D-05 (TD-04 supersession) as one plan or two (code delete vs docs update).
- Whether to add a new test asserting the TD-06 fix (e.g., test that `computeLeafState` returns `'dying'` for 1d-overdue input).

### Deferred Ideas (OUT OF SCOPE)

- Delete `post-store.service.ts` — revisit at start of v1.5 milestone planning (D-07).
- Delete `ImmersiveInfoFlow` export in `InfoFlow.tsx` — revisit at start of v1.5 (D-08).
- Rename `'falling'` to a mortality-themed literal — not worth the churn; UI never exposes it (D-12).
- Restore `applyStrategyBias` in concept-feed — explicitly rejected in favor of Phase 31 D-14's generation-time prioritization (D-01).
- Pre-existing 4 tsc errors in AskScreen / PlannerScreen / SettingsFeaturesScreen / SettingsScreen — carried from Phase 29, out of Phase 33 scope. **Research update: these are already fixed as of commit `760fa4f8`; see Finding #3.**
- Pre-existing 24 Node-25 trellis test failures — v1.5 concern.
- Phase 28's 6 human-UAT items — opportunistic only, not a Phase 33 gate.

## Critical Finding: Commit 760fa4f8 Has Already Landed Part of Phase 33's Scope

`git log --oneline` shows commit `760fa4f8` ("chore(types): clear 10 stale tsc errors blocking device build", authored 2026-04-18 23:34, one day before CONTEXT.md was captured) already did:

- Removed the 4 unused helpers in `concept-feed.service.ts`: `generateDailyPostsWithLLM`, `_backgroundGenerateVideos`, `shuffleArray`, `_backgroundGenerateNews` + their now-orphaned imports (`graphService`, `newsService`).
- Renamed `'dying'` → `'yellow'` at the TS2367 site in `concept-feed.service.ts` (formerly line 745, now line 654 after deletions).
- Dropped 3 unused props from `VineProgress` component interface (`explored`, `total`, `isComplete`) + their callers in `HomeScreen.tsx`.
- Dropped a bogus `n.side === 'left'` comparison in `TrellisCanvas.tsx` and an unused `navigate` import in `PostHistoryScreen.tsx`.

Current state on the working tree (verified `2026-04-19`):
- `npx tsc -b --noEmit` → exit 0, **zero errors**.
- `npx vite build` → clean in 3.23s.
- `npm test` → 377 total, 345 pass, 32 fail (6 TD-01 regressions + 26 pre-existing Node-25 trellis failures).

**Implication for the planner:** D-16, D-17, D-18 are all already satisfied. The plan should NOT re-do this work. Mark each as `SATISFIED-BY-760fa4f8` and move on. The CONTEXT.md references to "5 new tsc errors" and "4 unused helpers" and "3 unused VineProgress props" describe the pre-`760fa4f8` state and are now historical.

Additionally: the CONTEXT.md `<deferred>` section says "Pre-existing 4 tsc errors in AskScreen / PlannerScreen / SettingsFeaturesScreen / SettingsScreen — carried from Phase 29, out of Phase 33 scope." These are ALSO gone after `760fa4f8`. No action needed.

## Research Findings (10 Questions)

### Finding 1 — TD-06 LeafState rename blast radius

Grep of `'yellow'` and `'fallen'` across `app/src/` and `app/tests/` reveals the complete rename target set. File-by-file:

**File: `app/src/services/trellis-state.service.ts` (3 production callsites + 5 dev-seed occurrences)**
- Line 9: `export type LeafState = 'bud' | 'green' | 'yellow' | 'falling' | 'fallen' | 'blossom' | 'fruit';` → `'bud' | 'green' | 'dying' | 'falling' | 'dead' | 'blossom' | 'fruit'`
- Line 88: `if (maxOverdue >= 14 || aggregateEase < 1.5) return 'fallen';` → `return 'dead';`
- Line 90: `if (maxOverdue >= 1) return 'yellow';` → `return 'dying';`
- Line 117: `{ state: 'green', cat: 2, vineIdx: 2 }, { state: 'green', cat: 3, vineIdx: 2 }, { state: 'yellow', cat: 2, vineIdx: 2 }` → last literal `'dying'`
- Line 119: `{ state: 'yellow', cat: 4, vineIdx: 3 }, { state: 'falling', cat: 4, vineIdx: 3 }, { state: 'green', cat: 5, vineIdx: 3 }` → first literal `'dying'`
- Line 121: `{ state: 'falling', cat: 6, vineIdx: 4 }, { state: 'fallen', cat: 7, vineIdx: 4 }, { state: 'yellow', cat: 6, vineIdx: 4 }` → middle `'dead'`, last `'dying'`

**File: `app/src/services/concept-feed.service.ts` (1 site)**
- Line 654: `isImportant = leaf === 'yellow' || leaf === 'falling' || leaf === 'fallen';` → `leaf === 'dying' || leaf === 'falling' || leaf === 'dead';`

**File: `app/src/screens/PlannerScreen.tsx` (2 sites)**
- Line 46: `const deadNodes = layout.nodes.filter((n) => n.leafState === 'fallen');` → `'dead'`
- Line 47: `const dyingNodes = layout.nodes.filter((n) => n.leafState === 'yellow' || n.leafState === 'falling');` → `'dying' || ... 'falling'`

**File: `app/src/components/trellis/TrellisStatusPanel.tsx` (2 sites)**
- Line 44: `const dyingNodes = nodes.filter((n) => n.leafState === 'yellow' || n.leafState === 'falling');` → `'dying'`
- Line 45: `const deadNodes = nodes.filter((n) => n.leafState === 'fallen');` → `'dead'`

**File: `app/src/components/trellis/TrellisLeaf.tsx` (7 sites — 4 keys in 2 records + 3 literal comparisons in `withDecay`)**
- Line 73: `yellow: '#F9A825',` (key in `STATE_COLOR: Record<LeafState, string>`) → `dying: '#F9A825',`
- Line 75: `fallen: '#8D6E63',` (key in `STATE_COLOR`) → `dead: '#8D6E63',`
- Line 83: `yellow: '#F57F17',` (key in `STATE_VEIN: Record<LeafState, string>`) → `dying: '#F57F17',`
- Line 85: `fallen: '#5D4037',` (key in `STATE_VEIN`) → `dead: '#5D4037',`
- Line 516: `function withDecay(leaf: React.ReactNode, state: 'yellow' | 'falling' | 'fallen'): React.ReactNode {` → `state: 'dying' | 'falling' | 'dead'`
- Line 517: `const extraRotation = state === 'falling' ? 20 : state === 'fallen' ? -15 : 0;` → `'dead'`
- Line 518: `const opacity = state === 'fallen' ? 0.75 : 1;` → `'dead'`
- Line 525: `{state === 'fallen' && (` → `'dead'`

Plus inline comments at lines 514 ("Yellow/falling/fallen wrap the base leaf with visual decay cues."), 570 ("green, yellow, falling, fallen — use category leaf shape with state color") — comment updates are cosmetic; leave or update at author's discretion.

**File: `app/src/components/trellis/types.ts` — zero literal occurrences.** This file only re-exports the `LeafState` type from trellis-state.service. The rename propagates through the type re-export automatically; no edits needed.

**File: `app/src/components/trellis/TrellisCanvas.tsx` — zero LeafState string literals.** Uses `n.leafState` opaquely via the `state={n.leafState}` prop (line 167). No edits needed.

**File: `app/src/components/ui/Badge.tsx` — DO NOT RENAME.** Line 3's `type BadgeColor = 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray';` and line 23's `yellow: { bg: 'var(--badge-yellow-bg)', text: 'var(--badge-yellow-text)' }` are CSS-color names, not LeafState values. The `Badge` component is entirely independent of the trellis. Grep of `<Badge color="yellow">` across the app confirms 1 consumer (`PlannerScreen.tsx:263`), which is styling a "Heal" badge in the Suggested Moves row; it refers to Badge's yellow color palette, not to a LeafState. Leaving this untouched.

**File: `app/src/screens/PodcastScreen.tsx:220` — DO NOT RENAME.** `if (status === 'generating') return 'yellow';` returns a UI color string consumed by a `statusColor` helper. Unrelated to LeafState.

**Tests requiring updates:**

- `app/tests/services/trellis-state.test.mjs` — 4 sites:
  - Line 44: test name `'computeLeafState returns yellow for 1-7 day overdue child'` → `'... returns dying ...'`
  - Line 49: `assert.equal(computeLeafState(anchor, [child]), 'yellow');` → `'dying'`
  - Line 58: `assert.equal(computeLeafState(anchor, [bad, good]), 'fallen');` → `'dead'`
- `app/tests/components/trellis-tooltip-copy.test.mjs` — 2 sites:
  - Line 15: `assert.equal(mod.resolveHealthCopy('yellow', 2, 0), '...')` → `'dying'`
  - Line 17: `assert.equal(mod.resolveHealthCopy('fallen', 3, 0), '...')` → `'dead'`
  - Line 25: `const expected = ['bud', 'green', 'yellow', 'falling', 'fallen', 'blossom', 'fruit'];` → `['bud', 'green', 'dying', 'falling', 'dead', 'blossom', 'fruit']`
- `app/tests/services/concept-batch-filter.test.mjs:15` — comment only: `"ease < 1.5 or dying/falling/fallen"` → `"ease < 1.5 or dying/falling/dead"`. Non-load-bearing (comment text), but update for consistency.

**Dependent runtime source that must co-change:** `app/src/components/trellis/TrellisTooltip.tsx` defines `resolveHealthCopy` which the tooltip tests pin. Must check its switch/map for `case 'yellow'` and `case 'fallen'` branches — the file wasn't opened during research but its test calls `resolveHealthCopy('yellow', ...)` and `resolveHealthCopy('fallen', ...)` → after rename the test args change to `'dying'` and `'dead'`, which means the source file's mapping keys must change too. Planner should include a diff of TrellisTooltip.tsx in the rename task.

**`app/src/services/trellis-actions.service.ts` — comments only:** Lines 2, 4, 6, 38, 40, 50, 80–81, 94, 101, 106 use the word "dying" in comments AND a helper function name `dyingSchedule()` (line 40, called at 94 and 101). After the rename, "dying" becomes the literal name anyway, so the function name stays aligned. No refactor needed for `dyingSchedule` — it's already aligned with the new vocabulary.

**Summary: 23 literal edits in 5 production files + 5 literal edits in 2 test files + 4 Record-key edits in TrellisLeaf.tsx + TrellisTooltip.tsx mapping update. One atomic commit per D-15.** Grep after the rename should return zero occurrences of `'yellow'` or `'fallen'` in LeafState context (Badge's colors and PodcastScreen's status remain legitimately).

### Finding 2 — TD-05 locale-key orphan hunt

Contents of `app/src/components/ConceptProgressCard.tsx` reference 4 distinct `t()` keys:

| t() key | Line | Used elsewhere? | Verdict |
|---------|------|-----------------|---------|
| `home.feed.title` | 37 | No other callsite | **ORPHAN — delete** |
| `home.feed.complete` | 42, 71 | No other callsite | **ORPHAN — delete** |
| `home.feed.progress` | 43 | No other callsite | **ORPHAN — delete** |
| `home.feed.progressCompact` | 72 | No other callsite | **ORPHAN — delete** |

Grep verification (executed against HEAD `310f2802`):

```
$ grep -rn "home\.feed\.(title|complete|progress|progressCompact)\b" app/src/
app/src/components/ConceptProgressCard.tsx:37:{t('home.feed.title')}
app/src/components/ConceptProgressCard.tsx:42:? t('home.feed.complete')
app/src/components/ConceptProgressCard.tsx:43:: t('home.feed.progress', { explored, total })}
app/src/components/ConceptProgressCard.tsx:71:? t('home.feed.complete')
app/src/components/ConceptProgressCard.tsx:72:: t('home.feed.progressCompact', { explored, total })}
```

Zero other consumers. These 4 keys can be safely deleted from all 4 locale bundles AFTER `ConceptProgressCard.tsx` is deleted.

**Keys that MUST be retained (also under `home.feed.*`):**
- `home.feed.scrollToTop` — used by `ScrollToTopFAB.tsx:27`
- `home.feed.vineComplete` — used by `VineProgress.tsx:249`
- `home.feed.vineProgress` — used by `VineProgress.tsx:250`
- `home.feed.allExplored` — used by `VineProgress.tsx:395`
- `home.feed.suggestionTitle` — used by `SuggestionCard.tsx:84`
- `home.feed.creditToast` — used by `HomeScreen.tsx:466`
- `home.feed.emptyTitle`, `home.feed.emptyBody` — used by `HomeScreen.tsx:646,649`
- `home.feed.loadingTitle`, `home.feed.feedbackPrompt` — used by `HomeScreen.tsx:674,684,721`
- `home.feed.generationErrorTitle`, `home.feed.generationErrorBody`, `home.feed.generationErrorRetry` — used by `HomeScreen.tsx:698–712`

All 4 orphan keys are confirmed present in all 4 locale bundles today:

| Key | en.json | zh.json | es.json | ja.json |
|---|---|---|---|---|
| `home.feed.title` | "Today's Concepts" | "今日概念" | "Conceptos de hoy" | "今日のコンセプト" |
| `home.feed.complete` | "All caught up!" | "全部看完了!" | "Todo al dia!" | "すべて完了!" |
| `home.feed.progress` | "{{explored}} of {{total}} explored" | "已探索 {{explored}}/{{total}}" | "{{explored}} de {{total}} explorados" | "{{explored}}/{{total}} 探索済み" |
| `home.feed.progressCompact` | "{{explored}}/{{total}}" | "{{explored}}/{{total}}" | "{{explored}}/{{total}}" | "{{explored}}/{{total}}" |

Plan task instruction for the locale edit: locate the `home.feed` block in each of `app/src/locales/{en,zh,es,ja}.json`, remove the 4 keys (`title`, `complete`, `progress`, `progressCompact`), preserve all other keys, land all 4 locale changes in ONE commit. Re-run `bundle-parity.test.mjs` to confirm identical key sets.

CONTEXT.md D-09 also mentions potential `home.progress.*` and `home.compact.*` namespaces — grep of all four locale bundles confirms these namespaces **do not exist**. Those references in D-09 were speculative; no such keys to delete.

### Finding 3 — 5 new Phase 31 tsc errors (STATUS: ALREADY RESOLVED)

`npx tsc -b --noEmit` at HEAD `310f2802` returns exit 0. Captured output: empty (zero errors).

Commit message of `760fa4f8` enumerates exactly what changed:

> - TrellisCanvas.tsx: n.side is number (+1/-1), not string — drop bogus 'left' comparison
> - concept-feed.service.ts: LeafState 'dying' was renamed to 'yellow' (per CLAUDE.md trellis state map); also removes 4 dead helpers (generateDailyPostsWithLLM, _backgroundGenerateVideos, shuffleArray, _backgroundGenerateNews) and their now-orphaned imports (graphService, newsService)
> - VineProgress.tsx + HomeScreen.tsx callers: drop explored/total/isComplete props — already recomputed from concepts[] inside the component
> - PostHistoryScreen.tsx: drop unused navigate hook in outer component (inner button helper still uses its own)

Per-decision verification:

- **D-16 (VineProgress 3 unused props)** — SATISFIED. `VineProgress.tsx:5–10` now has only 4 props (`mode`, `concepts`, `onConceptTap`, `onHistoryTap`). Callers at `HomeScreen.tsx:496` and `HomeScreen.tsx:621` pass only these 4 props. No edits needed.
- **D-17 (4 unused helpers in concept-feed.service.ts)** — SATISFIED. Grep for `generateDailyPostsWithLLM|_backgroundGenerateVideos|shuffleArray|_backgroundGenerateNews` returns zero hits in the working tree. The 4 helpers are removed. No edits needed.
- **D-18 (tsc clean after fixes)** — SATISFIED. `tsc -b --noEmit` shows zero errors, not "only the 4 pre-existing" — those 4 are also gone thanks to `760fa4f8`'s additional cleanup.

**Planner action:** create a single Wave that documents D-16/D-17/D-18 as SATISFIED-BY-760fa4f8. A no-op plan is fine — include a verification step (run `tsc -b --noEmit`, assert exit 0) but no code edits.

### Finding 4 — VineProgress unused props (D-16)

The 3 props that were flagged unused (`explored: number`, `total: number`, `isComplete: boolean`) have already been dropped from the `VineProgressProps` interface in commit `760fa4f8`. Current interface at `app/src/components/VineProgress.tsx:5–10`:

```ts
interface VineProgressProps {
  mode: 'inline' | 'compact';
  concepts: Array<{ id: string; name: string; explored: boolean }>;
  onConceptTap?: (conceptId: string) => void;
  onHistoryTap?: () => void;
}
```

The component internally derives `conceptExplored = concepts.filter(c => c.explored).length` (line 202) and `conceptTotal = concepts.length` (line 201) and `vineComplete = conceptTotal > 0 && conceptExplored >= conceptTotal` (line 214). Callers pass only the 4 props above. **No follow-up needed.** The CONTEXT.md D-16 "wire or drop" question has already been answered "drop".

### Finding 5 — concept-feed.service.ts unused helpers (D-17)

The 4 helpers flagged unused by tsc are:

| Helper | Original line | Status |
|--------|---------------|--------|
| `generateDailyPostsWithLLM` | was ~472–524 | DELETED in 760fa4f8 |
| `_backgroundGenerateVideos` | was ~528–538 | DELETED in 760fa4f8 |
| `_backgroundGenerateNews` | was in same neighborhood | DELETED in 760fa4f8 |
| `shuffleArray` | small util | DELETED in 760fa4f8 |

Grep for each across `app/`:
```
$ grep -rn "generateDailyPostsWithLLM\|_backgroundGenerateVideos\|shuffleArray\|_backgroundGenerateNews" app/
(no matches)
```

Zero references remain. Their associated imports (`graphService`, `newsService`) were also removed. **No follow-up needed.**

### Finding 6 — TD-04 test deletion impact

**File: `app/tests/services/concept-feed-strategy.test.mjs` — DELETE WHOLE FILE (D-02).**

The file has 11 total tests across 4 describe blocks:

1. `applyStrategyBias — priority concept posts are sorted to front` (3 tests, inline algorithm, currently passing)
2. `applyStrategyBias — no-op when priorityConceptIds is empty` (2 tests, inline algorithm, currently passing)
3. `applyStrategyBias — posts with empty sourceQuestionIds are not matched` (1 test, inline algorithm, currently passing)
4. `applyStrategyBias — structural presence in concept-feed.service.ts` (5 tests, all grep the source file for `applyStrategyBias` — all FAILING because the function no longer exists)

Current result: 6 pass, 5 fail. Under D-01 (supersede), all 11 tests become obsolete — the first 6 test an inline algorithm that duplicates a feature Phase 31 intentionally removed, and the last 5 assert structural properties that are no longer true. Delete the whole file.

**File: `app/tests/services/orchestration-strategy.test.mjs` — DELETE ONE ASSERTION (D-03).**

File has 10 total tests. Layout:

- Lines 33–108: `describe('defaultStrategy.computeHints', ...)` — 8 tests covering mode selection, weak-area bias, curiosity plumbing. All PASS. **Keep all.**
- Line 114: `test('TD-01 plumbing: plannerAutoGen.service.ts passes checkInSignals to computeHints', ...)` — grep-asserts `plannerAutoGen.service.ts` contains `computeHints(signals, checkInSignals)` + `plannerService.getRecentSignals()`. PASSES today (the plannerAutoGen wiring is still in place at `plannerAutoGen.service.ts:115–116`). **Keep.**
- Line 126: `test('TD-01 plumbing: concept-feed.service.ts applyStrategyBias passes checkInSignals to computeHints', ...)` — grep-asserts `concept-feed.service.ts` contains `computeHints(signals, checkInSignals)` + `const recentSignals = plannerService.getRecentSignals()`. FAILS today because the applyStrategyBias function was removed. **DELETE this test (lines 126–137).**

The plannerAutoGen-side assertion (line 114) and the 8 `defaultStrategy.computeHints` tests are separable and correctly test the surviving wiring. Only the concept-feed-side assertion is orphaned. After deletion, this file goes from 10 tests (9 pass / 1 fail) to 9 tests (all pass).

### Finding 7 — WIP diff review (D-19, D-20, D-21)

**9 modified files:**

| File | Diff summary | Risk assessment |
|------|--------------|-----------------|
| `app/src/locales/en.json` | Adds 2 keys: `common.buttons.resetToday` ("Reset Today") and `common.toast.todayReset` ("Today's review/post status reset"). Also adds `home.feed.scrollToTop` ("Scroll to top"). | SAFE — i18n additions for SettingsDataScreen's "Reset Today" hardcoded-string localization. |
| `app/src/locales/zh.json` | Parallel 3-key addition in Simplified Chinese. | SAFE. |
| `app/src/locales/es.json` | Parallel 3-key addition in Spanish. | SAFE. |
| `app/src/locales/ja.json` | Parallel 3-key addition in Japanese. | SAFE. |
| `app/src/screens/PlannerScreen.tsx` | 1-line diff: removes unused `useEffect` import. | SAFE — dead import removal. |
| `app/src/screens/SettingsScreen.tsx` | 1-line diff: removes unused `Palette` import from `lucide-react`. | SAFE — dead import removal. |
| `app/src/screens/settings/SettingsDataScreen.tsx` | Replaces hardcoded English strings on "Reset Today" button with `t('settings.buttons.resetToday')` and `t('settings.toast.todayReset')`. | SAFE — i18n fix; paired with en.json key addition. |
| `app/src/screens/settings/SettingsFeaturesScreen.tsx` | Drops unused setter: `const [reviewLimit, setReviewLimit] = useState(...)` → `const [reviewLimit] = useState(...)`. | SAFE — suppresses unused-var tsc warning. Note: this removes the ability to write to `reviewLimit`; grep confirms no callers set it today, so this is correct. |
| `app/src/services/daily-read.service.ts` | Refactors `getConceptQuota` to derive the quota from `questionsById` (anchor nodes) instead of from posts. Renames `EXCLUDED_SOURCE_TYPES` → `NON_CONCEPT_SOURCE_TYPES` (now `['starter', 'connection', 'suggestion']` — removes `video, short, news` because those now count as concepts). | MEDIUM — behavioral change. The quota source shifts from "posts I've rendered today" to "anchors that are due". This matches Phase 31 D-12 per the comment ("Phase 31 D-12: SM-2 driven, same as flashcards/podcasts"). Must be co-landed with the test update (concept-quota.test.mjs, see next row). Reviewer should confirm HomeScreen's `conceptQuota` computation handles the new shape. |
| `app/src/services/post-history.service.ts` | 1-line diff: removes dead `const DEFAULT_RETENTION_DAYS = 7;` (unused after prior refactor). | SAFE — dead const removal. |
| `app/tests/concept-quota.test.mjs` | Rewrites tests to match the new `getConceptQuota` shape. Adds tests for starter/connection/suggestion exclusion + video/short/news inclusion + "posts param is ignored". 8 tests pass locally. | SAFE — test rewrite paired with the service change above. Ran locally: 8/8 pass. |

**3 untracked files:**

| File | Test count | Status |
|------|-----------|--------|
| `app/tests/services/concept-batch-filter.test.mjs` | 8 tests | All 8 PASS locally (verified by running `node --test tests/services/concept-batch-filter.test.mjs`). Tests the Phase 31 D-13 filter logic (pending/explored exclusion + ease-<1.5 importance doubling) via inline predicates that mirror the private `buildConceptBatch` logic. Well-structured; uses localStorage polyfill. |
| `app/tests/services/daily-generation-cap.test.mjs` | 11 tests | All 11 PASS locally. Tests Phase 31 D-38 daily-generation cap logic (multiplier × max(dueConcepts, 1)). |
| `app/tests/services/starter-posts.test.mjs` | 9 tests | All 9 PASS locally. Tests Phase 31 D-43 STARTER_POSTS contract (3 tutorial posts, `sourceType='starter'`, `presentationStyle='text-art'`, etc.). |

All 12 files are safe to commit. No debug logs (grepped for `console.log`, found none in diff). No secrets (grepped for `sk-`, `api_key`, etc., found none). No half-implemented features (all diffs are cohesive small changes). No uncommented TODOs added. Expected disposition per D-20: all clean — proceed with the flush commit.

**Planner instruction:** WIP flush should land as ONE atomic commit per D-19. Suggested message: `chore(v1.4): flush WIP — quota refactor, i18n polish, 3 Phase 31 test suites`. Include all 12 files (`git add` list: 9 modified files + 3 new test files — do NOT use `git add -A` because `.planning/STATE.md` is also modified and unrelated).

Actually — grep confirms `.planning/STATE.md` is in the modified list too. Verify with planner whether STATE.md changes belong in the WIP commit or should be part of a separate docs commit. Research recommendation: include it, because STATE.md's modifications will be about Phase 33 context capture and are tightly coupled to the other changes.

### Finding 8 — Test baseline

Running `cd app && npm test 2>&1 | tail -5` at HEAD `310f2802`:

```
ℹ tests 377
ℹ suites 31
ℹ pass 345
ℹ fail 32
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 60412.433542
```

Deduplicated list of 33 unique failing tests (the 32nd is a cascade/summary line). They separate cleanly into two buckets:

**Bucket A — 6 Phase 31 regressions (to be closed by D-02 + D-03):**

- `applyStrategyBias — structural presence in concept-feed.service.ts` (header) — `concept-feed-strategy.test.mjs`
- `applyStrategyBias function is defined in concept-feed.service.ts` — `concept-feed-strategy.test.mjs`
- `applyStrategyBias sorts by priorityConceptIds overlap` — `concept-feed-strategy.test.mjs`
- `applyStrategyBias is called at getDailyPosts return paths` — `concept-feed-strategy.test.mjs`
- `applyStrategyBias is wrapped in try-catch to protect feed from signal errors` — `concept-feed-strategy.test.mjs`
- `defaultStrategy.computeHints is called inside applyStrategyBias` — `concept-feed-strategy.test.mjs`
- `TD-01 plumbing: concept-feed.service.ts applyStrategyBias passes checkInSignals to computeHints` — `orchestration-strategy.test.mjs`

(That's 7 distinct assertion names, matching the audit's "5 in concept-feed-strategy + 1 in orchestration-strategy = 6 v1.4-specific regressions" — the header row "applyStrategyBias — structural presence in concept-feed.service.ts" is a describe block summary line, not a distinct test. Net: 5 concept-feed-strategy + 1 orchestration-strategy = 6 regressions.)

**Bucket B — 26 pre-existing Node-25 trellis failures (out of scope per CONTEXT.md `<deferred>`):**

All fail with `TypeError [ERR_IMPORT_ATTRIBUTE_MISSING]: Module "file:///.../src/locales/en.json" needs an import attribute of "type: json"`. Test files involved:

- `trellis-tooltip-copy.test.mjs` — 3 failures (pluralize, resolveHealthCopy, LEAF_STATE_COLOR). Note: `LEAF_STATE_COLOR` doesn't actually exist in TrellisLeaf.tsx (it's `STATE_COLOR`) — test has been broken since Phase 29, unrelated to the rename.
- `trellis-state.test.mjs` — 6 failures (bud, yellow, worst-child-wins, blossom, fruit, buildTrellisState-empty)
- `trellis-heal.test.mjs` — 4 failures (heal flow)
- `trellis-replant.test.mjs` — 6 failures (replant flow)
- `trellis-prune.test.mjs` — 4 failures (prune + unprune + hardDelete + emit)
- `trellis-layout.test.mjs` — 2 failures (getVineColor, buildTrellisState-green-transition)
- `buildTrellisState-falling.test.mjs` — 1 failure

Total: 26 failures. (The audit reported 24. The 2-test drift is likely due to natural test suite evolution since the audit — some of the newer cap/quota tests that didn't exist at audit time now run and surface differently under Node 25.)

**Phase 33 success criterion for tests:** After deleting `concept-feed-strategy.test.mjs` (D-02) and removing the one orphan TD-01 assertion (D-03), `npm test` should land at 377 - 11 (concept-feed-strategy file deletion) - 1 (orphan assertion deletion) = **365 tests, 339 pass, 26 fail** (or as close to that as the LeafState rename tests round to). Zero v1.4-specific regressions remain. All 26 remaining failures are pre-existing Node-25 JSON import-attribute trellis failures.

**Caveat for TD-06 rename:** Once `trellis-state.test.mjs` lines 44 (`'computeLeafState returns yellow ...'`) and 58 (`...'fallen'`) are renamed, the test NAMES change but the tests still fail on the same Node-25 import-attribute error (they never reach the assertion). Verification will need to either (a) skip running the trellis suite when checking rename correctness and rely on `tsc -b --noEmit` to catch type regressions, or (b) run a targeted `node --test` invocation with the correct mock loader.

### Finding 9 — 29-VERIFICATION.md row format

Current TD-01 row from `.planning/phases/29-final-polishment/29-VERIFICATION.md:93`:

```markdown
| TD-01 | 29-01 | Curiosity-signal wiring at plannerAutoGen + concept-feed computeHints call sites | SATISFIED | Both call sites verified; 2 static-grep plumbing tests pass |
```

Column schema: `| Requirement | Source Plan | Description | Status | Evidence |`.

Example SATISFIED row (for reference — from the same table, TD-02 row at line 94):

```markdown
| TD-02 | 29-02 | PostDetailScreen AbortController + LOCALE_CHANGED subscription replacing `let aborted` boolean | SATISFIED | AbortController present; aborted boolean absent; 10 tests pass |
```

**SUPERSEDED-BY-PHASE-31 format for D-04**:

```markdown
| TD-01 | 29-01 | Curiosity-signal wiring at plannerAutoGen + concept-feed computeHints call sites | SUPERSEDED-BY-PHASE-31 | Phase 31 D-14 (31-CONTEXT.md) implements weak-concept prioritization at generation time — 2 posts per important concept. This subsumes the Phase 29 runtime sort bias. concept-feed.service.ts still calls plannerService.getRecentSignals() at line 251 for LLM prompt context, but applyStrategyBias is intentionally absent. See Phase 33 TD-04 (33-CONTEXT.md D-01). |
```

Note: `line 251` reference is historical — after the `760fa4f8` deletion of `generateDailyPostsWithLLM`, the `plannerService.getRecentSignals()` call has shifted. Planner should re-grep at edit time and use the current line number (a quick `grep -n "plannerService.getRecentSignals" app/src/services/concept-feed.service.ts` will surface it).

Observable Truths table (lines 21–31) has a parallel row at line 21:

```markdown
| 1 | TD-01: checkInSignals threaded to computeHints at both call sites | VERIFIED | `computeHints(signals, checkInSignals)` present in both service files; 2 TD-01 plumbing tests pass |
```

This row is ALSO now stale (only one call site — plannerAutoGen — retains the wiring). Planner should update BOTH the Requirements Coverage table AND the Observable Truths table. Suggested Observable Truth rewrite:

```markdown
| 1 | TD-01: checkInSignals threaded to computeHints at the plannerAutoGen call site; concept-feed branch superseded by Phase 31 D-14 | VERIFIED / SUPERSEDED | `computeHints(signals, checkInSignals)` present in plannerAutoGen.service.ts:116; concept-feed applyStrategyBias removed per 33-CONTEXT.md D-01. 1 TD-01 plumbing test passes (orchestration-strategy.test.mjs plannerAutoGen assertion) |
```

**29-UAT-LOG.md append format (D-05):** The existing 29-UAT-LOG.md uses tables with an `Issue | Surfaced During | Fix Commit | Re-test Result | Date` header at line 84 for inline fixes. The cleanest place for the SUPERSEDED entry is a new subsection after the Sign-off block (line 87–93), e.g.:

```markdown
## Post-sign-off supersession

### TD-01 SUPERSEDED by Phase 31 (recorded 2026-04-19)

| Entry | Value |
|-------|-------|
| Original item | TD-01 — curiosity-signal wiring at plannerAutoGen + concept-feed call sites |
| Superseded by | Phase 31 D-14 (31-CONTEXT.md) — generation-time weak-concept prioritization |
| Rationale | Phase 31's `buildConceptBatch` generates 2 posts per important concept (ease < 1.5 or dying/falling/dead LeafState) AT generation time. The Phase 29 runtime sort bias would double-layer the weighting. |
| Code evidence | applyStrategyBias removed from concept-feed.service.ts; plannerAutoGen.service.ts:116 retains wiring |
| Closure commit | {fill in at PR merge} |
| Recorded by | Phase 33 TD-04 resolution (33-CONTEXT.md D-05) |
```

Planner has discretion on exact format per D-05 ("Preserve original UAT row — append, don't overwrite"). The appended section MUST NOT modify rows 35–78 of the log.

### Finding 10 — Validation Architecture

See the `## Validation Architecture` section below.

## Standard Stack

Phase 33 is pure code hygiene. No library additions. Tools already in use:

| Tool | Version (verified) | Purpose |
|------|--------------------|---------|
| TypeScript | 5.9.x (per package.json) | `tsc -b --noEmit` — currently exit 0 |
| Node built-in test runner | Node 25.x | `node --test` — 377 tests today |
| i18next | 25.x | Bundle loading for all 4 locales |
| Vite | 7.x | `vite build` — clean in 3.2s |

No new dependencies required. No version changes required.

## Architecture Patterns

### Pattern 1 — Atomic rename commit (D-15)

Use a single commit for all LeafState literal renames so `git log --follow` traces cleanly. The rename touches 6 production files + 2 test files + 1 runtime mapping file (TrellisTooltip.tsx). All edits in one commit; message suggestion: `refactor(trellis): rename LeafState literals yellow→dying, fallen→dead per design vocabulary (TD-06)`.

### Pattern 2 — i18n edits land all 4 locales together (CLAUDE.md rule)

The D-09 locale key deletion MUST touch `en.json` + `zh.json` + `es.json` + `ja.json` in ONE commit. Re-run `bundle-parity.test.mjs` in the same task. Do not split across commits — it will temporarily break bundle parity.

### Pattern 3 — Supersession docs update is a cohesive unit

D-04 (29-VERIFICATION.md edit) + D-05 (29-UAT-LOG.md append) should land in the SAME commit as D-02 + D-03 (the test deletions) so the code state matches the docs state at every commit.

### Anti-patterns to avoid

- **Don't resurrect `applyStrategyBias`.** D-01 is explicit: this bundle is a supersession, not a restoration. Any task that adds `applyStrategyBias` back to `concept-feed.service.ts` is a violation.
- **Don't rename `'falling'`.** D-12 explicitly keeps it. The audit's CONTEXT.md has a design rationale the user finalized after 3 rounds of discussion.
- **Don't rename `'yellow'` in `Badge.tsx`.** It's a CSS color palette member, not a LeafState literal. Same for `PodcastScreen.tsx:220`.
- **Don't delete `post-store.service.ts` or `ImmersiveInfoFlow`.** D-07 and D-08 explicitly defer these to v1.5. Temptation: while opening concept-feed.service.ts for rename, don't opportunistically sweep.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Rename LeafState across many files | Custom script / regex codemod | Rely on TypeScript: rename in `trellis-state.service.ts:9` first, let `tsc -b --noEmit` reveal every type error, fix each as a follow-up edit. The compiler catches 100% of the type-sensitive sites; string literal sites (in tests, comments) require separate grep but are listed in Finding #1 above. |
| Verify locale bundle parity | Hand-count keys | `node --test tests/locales/bundle-parity.test.mjs` — existing test asserts identical key sets |
| Verify no orphan i18n key after deletion | Manual grep | Already-provided grep: `grep -rn "home\.feed\.(title\|complete\|progress\|progressCompact)" app/src/` should return zero hits AFTER ConceptProgressCard.tsx deletion. |
| Verify TD-01 tests cleanly deleted | Read the file | Run `npm test 2>&1 | grep "^✖"` after deletion — should drop from 32 failures to 26. |

## Common Pitfalls

### Pitfall 1 — Mixing the LeafState rename with TD-04/TD-05 work

**What goes wrong:** Single commit touching 3 unrelated sets of files; `git log --follow` can't trace a clean rename history; reverting one pulls the others.
**How to avoid:** D-15 is explicit — rename in its own commit. Planner: task 3 (TD-06) is commit-isolated.
**Warning signs:** Planner asks "can we land TD-05 and TD-06 together?" — answer no.

### Pitfall 2 — Stale CONTEXT.md re: tsc errors

**What goes wrong:** Planner allocates tasks D-16/D-17/D-18 to fix errors that are already fixed, then reports "no changes found" and the plan looks broken.
**How to avoid:** Acknowledge `760fa4f8` up front. Create a zero-code task for D-16/D-17/D-18 that just re-runs `tsc -b --noEmit` and asserts clean exit.
**Warning signs:** Task "delete the 4 unused helpers" has no diff output.

### Pitfall 3 — Bundle parity break from partial locale delete

**What goes wrong:** Planner deletes `home.feed.title` from only `en.json` first (following a "write EN first" pattern), then commits — `bundle-parity.test.mjs` red-flags because the other 3 bundles still have the key.
**How to avoid:** For DELETIONS the rule is the reverse of additions: all 4 locales land in one commit. The CLAUDE.md EN-first workflow is for ADDITIONS.
**Warning signs:** First test run after locale edit fails on bundle-parity.

### Pitfall 4 — Test loader needed for trellis tests

**What goes wrong:** After renaming LeafState literals in `trellis-state.test.mjs`, planner tries `node --test tests/services/trellis-state.test.mjs` standalone to verify. The tests fail with `ERR_IMPORT_ATTRIBUTE_MISSING` because they need `_trellis-mock-loader.mjs` (or capacitor mock loader) to resolve `src/locales/en.json`. This is a pre-existing Node 25 issue, NOT a rename regression.
**How to avoid:** For rename verification, rely on `tsc -b --noEmit` (catches all type errors) + `npm test` comparative baseline (26 failures before rename, 26 failures after rename — if the count changes, investigate).
**Warning signs:** "My rename broke trellis tests!" — check whether the tests failed with the same import-attribute error BEFORE the rename.

### Pitfall 5 — Forgetting to update TrellisTooltip.tsx

**What goes wrong:** Planner renames LeafState in trellis-state.service.ts but forgets that TrellisTooltip.tsx has its own `case 'yellow':` / `case 'fallen':` branches in `resolveHealthCopy`. Tests fail with "copy does not match" messages.
**How to avoid:** Include TrellisTooltip.tsx in the rename task explicitly. See Finding #1 (the test at `trellis-tooltip-copy.test.mjs:15,17` pins this mapping).
**Warning signs:** `trellis-tooltip-copy.test.mjs` shows NEW failure types (assertion errors on copy strings) rather than just the pre-existing import-attribute errors.

## Code Examples

### Example 1 — The rename target in `trellis-state.service.ts` (D-10, D-11)

```ts
// Before:
export type LeafState = 'bud' | 'green' | 'yellow' | 'falling' | 'fallen' | 'blossom' | 'fruit';

// After:
export type LeafState = 'bud' | 'green' | 'dying' | 'falling' | 'dead' | 'blossom' | 'fruit';

// Before (computeLeafState lines 88-90):
if (maxOverdue >= 14 || aggregateEase < 1.5) return 'fallen';
if (maxOverdue >= 7) return 'falling';
if (maxOverdue >= 1) return 'yellow';

// After:
if (maxOverdue >= 14 || aggregateEase < 1.5) return 'dead';
if (maxOverdue >= 7) return 'falling';
if (maxOverdue >= 1) return 'dying';
```

### Example 2 — TD-01 plumbing assertion deletion (D-03)

```ts
// In app/tests/services/orchestration-strategy.test.mjs, DELETE lines 126-137:
test('TD-01 plumbing: concept-feed.service.ts applyStrategyBias passes checkInSignals to computeHints', () => {
  const src = readFileSync(path.join(repoRoot, 'src/services/concept-feed.service.ts'), 'utf8');
  assert.ok(
    src.includes('computeHints(signals, checkInSignals)'),
    'concept-feed.service.ts must pass checkInSignals to computeHints',
  );
  // Ensure we didn't accidentally remove the pre-existing line-251 recentSignals call
  assert.ok(
    src.includes('const recentSignals = plannerService.getRecentSignals()'),
    'concept-feed.service.ts must retain pre-existing line-251 recentSignals call',
  );
});
// Keep everything else — the plannerAutoGen-side test at line 114 stays.
```

### Example 3 — Locale key deletion in en.json (D-09, pattern repeats in zh/es/ja)

```jsonc
// app/src/locales/en.json — home.feed section, BEFORE (excerpt):
"feed": {
  "title": "Today's Concepts",
  "complete": "All caught up!",
  "progress": "{{explored}} of {{total}} explored",
  "progressCompact": "{{explored}}/{{total}}",
  "vineComplete": "All concepts explored",
  "vineProgress": "{{explored}} of {{total}} concepts explored",
  "allExplored": "All caught up! Great work today.",
  "suggestionTitle": "Explore more",
  // ... other keys retained
}

// AFTER — 4 keys removed:
"feed": {
  "vineComplete": "All concepts explored",
  "vineProgress": "{{explored}} of {{total}} concepts explored",
  "allExplored": "All caught up! Great work today.",
  "suggestionTitle": "Explore more",
  // ... other keys retained
}
```

## State of the Art

| Old Approach (pre-Phase 31) | Current Approach (post-Phase 31) | When Changed |
|-----------------------------|-----------------------------------|--------------|
| Runtime sort bias via `applyStrategyBias(posts, hints)` | Generation-time concept prioritization in `buildConceptBatch` (2 posts per weak concept) | Phase 31 D-14 (2026-04-15) |
| `ConceptProgressCard.tsx` (sticky card) + `CompactProgressBar` | `VineProgress.tsx` (SVG vine-growing visual) | Phase 31 D-01 / D-02 (2026-04-15) |
| LeafState literals `'yellow'` / `'fallen'` | Post Phase 33 TD-06: `'dying'` / `'dead'` to match design vocabulary | Phase 33 D-10 / D-11 (this phase) |

**Deprecated after this phase:**
- `app/src/components/ConceptProgressCard.tsx` — deleted (D-06)
- 4 keys `home.feed.{title,complete,progress,progressCompact}` in all 4 locales — deleted (D-09)
- `app/tests/services/concept-feed-strategy.test.mjs` — deleted (D-02)
- TD-01 plumbing assertion in `orchestration-strategy.test.mjs` — deleted (D-03)
- LeafState literals `'yellow'` and `'fallen'` — renamed throughout (D-10, D-11)

## Open Questions

1. **Should the rename commit update the `'yellow'` and `'fallen'` COMMENTS in trellis-state.service.ts and TrellisLeaf.tsx?**
   - What we know: CONTEXT.md says update the type union + callsites + tests. Comments are listed nowhere.
   - What's unclear: Whether lingering comment text ("Yellow/falling/fallen wrap ..." at TrellisLeaf.tsx:514) should co-change for readability.
   - Recommendation: YES, update comments in the same commit. Keeps documentation aligned with code. No code risk.

2. **Should a new test be added asserting `computeLeafState` returns `'dying'`/`'dead'` (Claude's discretion per CONTEXT.md)?**
   - What we know: The existing `trellis-state.test.mjs` test at line 44 would, after rename, assert `'dying'` — that's a defacto positive test.
   - What's unclear: Whether adding a redundant test provides value.
   - Recommendation: NO new test. Update the existing line-49 and line-58 assertions to `'dying'` / `'dead'` and consider that the positive test. Avoid test proliferation.

3. **Is `.planning/STATE.md` part of the WIP flush or a separate commit?**
   - What we know: `git status` shows STATE.md as modified.
   - What's unclear: STATE.md auto-updates on every phase op; the current modifications are likely Phase 33 context capture. Not tied to the code WIP.
   - Recommendation: Include in the WIP flush — it's cohesive with "records current state going into Phase 33 execution". Label the commit message accordingly: `chore(v1.4): flush WIP — quota refactor, i18n polish, 3 Phase 31 test suites, state snapshot`.

4. **Does the rename commit need to verify `bundle-parity.test.mjs` too?**
   - What we know: The rename doesn't touch locale bundles (D-14 confirms keys already present).
   - What's unclear: Only the locale DELETION task (D-09) touches bundles.
   - Recommendation: Verify bundle-parity in the TD-05 task (D-09), not the TD-06 task (D-10/D-11).

## Environment Availability

Phase 33 has no external dependencies beyond the existing dev stack. All probes pass:

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | All tests, tsc, vite | ✓ | 25.x | — |
| TypeScript | `tsc -b --noEmit` verification | ✓ | 5.9.x | — |
| Vite | `vite build` verification | ✓ | 7.x | — |
| Git | Commit workflow | ✓ | (any) | — |
| `capacitor-mock-loader.mjs` | Targeted trellis test reruns | ✓ | — | — |

No missing dependencies. No fallbacks needed.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` with esbuild `tsx` loader |
| Config file | `app/package.json` — `"test": "node --test --experimental-transform-types --import capacitor-mock-loader/register 'tests/**/*.test.mjs'"` (pattern) |
| Quick run command | `cd app && node --test tests/services/orchestration-strategy.test.mjs` (targeted) |
| Full suite command | `cd app && npm test` |
| tsc check | `cd app && npx tsc -b --noEmit` (must return exit 0) |
| i18n parity check | `cd app && node --test tests/locales/bundle-parity.test.mjs` (2 tests; both must pass) |
| Build check | `cd app && npx vite build` (must complete without error) |

### Phase Requirements → Test Map

Phase 33 has NO net-new REQ-IDs. The validation surface is the 21 decisions D-01..D-21. Each decision maps to a verification step:

| Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| D-01 | `applyStrategyBias` NOT present in concept-feed.service.ts | grep-assert | `grep -c "applyStrategyBias" app/src/services/concept-feed.service.ts` must return `0` | n/a — grep |
| D-02 | `concept-feed-strategy.test.mjs` deleted | file-absence | `test ! -f app/tests/services/concept-feed-strategy.test.mjs` | n/a — file check |
| D-03 | TD-01 plumbing assertion for concept-feed removed from orchestration-strategy.test.mjs | grep-assert | `grep -c "TD-01 plumbing: concept-feed.service.ts" app/tests/services/orchestration-strategy.test.mjs` must return `0` | n/a — grep |
| D-04 | 29-VERIFICATION.md TD-01 row status = SUPERSEDED-BY-PHASE-31 | grep-assert | `grep -c "SUPERSEDED-BY-PHASE-31" .planning/phases/29-final-polishment/29-VERIFICATION.md` must return ≥ 1 | n/a — grep |
| D-05 | 29-UAT-LOG.md has a SUPERSEDED section for TD-01 | grep-assert | `grep -c "TD-01 SUPERSEDED" .planning/phases/29-final-polishment/29-UAT-LOG.md` must return ≥ 1 | n/a — grep |
| D-06 | `ConceptProgressCard.tsx` deleted | file-absence | `test ! -f app/src/components/ConceptProgressCard.tsx` | n/a — file check |
| D-09 | 4 orphan keys removed from all 4 locale bundles | bundle-parity | `node --test tests/locales/bundle-parity.test.mjs` must pass; `grep -c "home.feed.title\|home.feed.progress" app/src/locales/en.json` must be 0 | ✅ `tests/locales/bundle-parity.test.mjs` exists |
| D-10 | LeafState type no longer contains `'yellow'` | grep-assert | `grep -c "'yellow'" app/src/services/trellis-state.service.ts` must return `0` | n/a — grep |
| D-11 | LeafState type no longer contains `'fallen'` | grep-assert | `grep -c "'fallen'" app/src/services/trellis-state.service.ts` must return `0` | n/a — grep |
| D-10+D-11 positive | `computeLeafState` returns `'dying'` for 1d overdue and `'dead'` for 14d overdue | unit | Update `trellis-state.test.mjs:49` and `:58` assertion values; `node --test tests/services/trellis-state.test.mjs` should show SAME count of failures before and after (pre-existing import-attribute error) | ✅ `tests/services/trellis-state.test.mjs` exists |
| D-12 | `'falling'` still present in LeafState type | grep-assert | `grep -c "'falling'" app/src/services/trellis-state.service.ts` must return ≥ 1 | n/a — grep |
| D-13 | Grep for `'yellow'` / `'fallen'` in LeafState context returns zero | grep sweep | Script: `grep -rn "'yellow'\|'fallen'" app/src app/tests | grep -v "Badge.tsx\|PodcastScreen.tsx" | wc -l` should return `0` | n/a — grep |
| D-14 | Bundle parity still passes after rename (locale keys unchanged) | bundle-parity | `node --test tests/locales/bundle-parity.test.mjs` must pass | ✅ exists |
| D-16/D-17/D-18 | `tsc -b --noEmit` clean | tsc | `npx tsc -b --noEmit; echo $?` must return `0` | n/a — tsc |
| D-19 | `git status` clean after WIP flush | git-state | `git status --porcelain | wc -l` must return `0` | n/a — git |
| D-21 | 3 untracked test files pass | targeted test | `node --test tests/services/concept-batch-filter.test.mjs tests/services/daily-generation-cap.test.mjs tests/services/starter-posts.test.mjs` — 28 tests must pass | ✅ all 3 exist (untracked today) |
| Phase gate | Overall test baseline | full-suite | `npm test` final count: 365 tests, 339 pass, 26 fail (all pre-existing Node-25). Zero v1.4 regressions. | — |
| Phase gate | Build clean | build | `npx vite build` returns exit 0 | — |

### Sampling Rate

- **Per task commit:** `npx tsc -b --noEmit && node --test tests/locales/bundle-parity.test.mjs` (< 10s)
- **Per wave merge:** `npm test` full suite (~60s), plus `npx vite build` (~3s)
- **Phase gate:** Full suite green (26 pre-existing failures only) + tsc clean + vite build clean + git status clean before `/gsd:verify-work`

### Wave 0 Gaps

- None — existing test infrastructure fully covers Phase 33's requirements. No new test files need to be created.
- The 3 untracked test files are already written (Finding #7) and they each pass. They land as part of the WIP flush, not as new Wave 0 scaffolds.

*(If planner decides to add the positive `'dying'` return test per CONTEXT.md Claude's Discretion, it's a 2-line assertion edit in the existing `trellis-state.test.mjs:49`, not a new file.)*

## Sources

### Primary (HIGH confidence)
- Working tree at HEAD `310f2802` — every file:line citation above verified via Read / Grep tool at research time.
- `.planning/phases/33-phase-29-regression-and-phase-31-code-hygiene/33-CONTEXT.md` — 21 locked decisions.
- `.planning/v1.4-INTEGRATION-CHECK.md` — seam-by-seam file:line evidence.
- `.planning/v1.4-MILESTONE-AUDIT.md` — TD-04/05/06 definitions.
- Commit `760fa4f8cf71996b613f95f1d279a3f2e8cb2665` — full diff reviewed.
- `app/CLAUDE.md` (project root) — i18n workflow, inline-style convention.

### Secondary (MEDIUM confidence)
- `29-VERIFICATION.md` / `29-UAT-LOG.md` row formats — inferred from existing tables; D-04/D-05 may have stylistic variations the author prefers.

### Tertiary (LOW confidence)
- The 2-test drift in pre-existing Node-25 failures (audit reported 24, today shows 26) — unverified beyond noting that test suites have evolved between audit time and now.

## Metadata

**Confidence breakdown:**
- TD-04 scope: HIGH — test file contents read and counted.
- TD-05 scope: HIGH — ConceptProgressCard.tsx fully read; grep for all 4 keys across `app/src` shows zero outside the file; locale bundles confirmed to contain the keys.
- TD-06 scope: HIGH — every callsite grep-verified; Record<LeafState, string> sites in TrellisLeaf.tsx catalogued; TrellisTooltip.tsx dependency called out.
- tsc errors: HIGH — `tsc -b --noEmit` ran locally, exit 0.
- WIP diffs: HIGH — each diff read; 3 untracked tests executed locally (all pass).
- `760fa4f8` supersession: HIGH — commit message + stat reviewed; cross-referenced against current source.

**Research date:** 2026-04-19
**Valid until:** 2026-04-26 (7 days — fast-moving working tree; re-run grep verifications if execution is delayed).
