# Phase 45: code-quality-sweep - Research

**Researched:** 2026-05-13
**Domain:** TypeScript/ESLint hygiene, dead-code triage, Vite/React performance profiling, TODO/operator-note closure
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Sweep Order
- **D-01:** Start with inventory artifacts before code edits: `45-TSC-AUDIT.md`, `45-TODO-TRIAGE.md`, and `45-PERF-AUDIT.md` or equivalent. Planning should make the audit outputs first-class deliverables, not afterthought notes.
- **D-02:** Fix order should be: existing test/TypeScript/lint blockers, dead-code and deleted-feature residue, diagnosed operator-note bugs, then performance findings. This keeps mechanical correctness ahead of speculative tuning.
- **D-03:** Phase 44 dependency bumps are intentionally parallel-safe but separate. Phase 45 should not bump packages or chase dependency-driven regressions unless a bug is proven independent of version changes.

#### TypeScript Strictness
- **D-04:** Do not broaden strictness flags opportunistically. Audit the current TypeScript configuration and current `tsc -b --noEmit` result, then fix low-risk gaps or document deferrals with rationale.
- **D-05:** Existing source comments such as `eslint-disable`, `@ts-ignore`, and `no-explicit-any` suppressions are triage inputs. Remove or narrow them where local typing is obvious; preserve documented browser/Capacitor/React-hook exceptions when the alternative would be churn.
- **D-06:** Known stale tests around Phase 42/43 constants and Node test import behavior should be treated as hygiene targets if still failing when Phase 45 starts. Do not mask failures by weakening assertions unless the underlying canonical value changed and is documented.

#### Dead Code And Removed-Feature Residue
- **D-07:** Remove true orphan exports, unused imports, unreachable helper functions, stale removed-feature residue, and stale i18n keys. Avoid broad refactors whose only benefit is aesthetic.
- **D-08:** When deleting code that has a load-bearing history, pair the deletion with source-reading or behavioral tests where practical. Carry forward the Phase 37/39/40/41/42/43 pattern: tests should guard the live path and avoid aspirational dead-code checks.
- **D-09:** Preserve explicitly documented compatibility residue, including the on-disk EchoLearn path and legacy localStorage migration behavior, unless an audit proves it is dead and not part of the brand-history compatibility contract.

#### Performance Profiling
- **D-10:** Required profiling areas are first paint, queue refill, masonry scroll, and GraphScreen Android drag lag. Produce a documented profile with evidence for each rather than relying on impressions.
- **D-11:** Fix P0/P1 performance issues only when the fix is localized and low-risk. Defer broad architectural changes, full GraphScreen rewrites, or speculative animation rewrites with a clear rationale.
- **D-12:** Prefer targeted instrumentation, browser/Android WebView observation, and existing service seams. Do not add persistent product telemetry or user-visible diagnostics as part of this hygiene phase.

#### TODO/FIXME Triage
- **D-13:** Catalogue project-wide TODO/FIXME/HACK/XXX plus suppression comments in `45-TODO-TRIAGE.md`. Each item must be closed, deferred to v1.6, or marked in-scope-for-v1.5 and closed inline.
- **D-14:** Suppression comments are not automatically bugs. Classify each as: justified permanent guard, narrowable local typing issue, stale workaround, or future-work note.

#### Operator Notes And Debug Files
- **D-15:** Treat `.planning/notes/*` and relevant `.planning/debug/*` as triage inputs. Do not rediscover diagnosed root causes; planning should read these files first and either close, fold into Phase 45, or defer each with rationale.
- **D-16:** `.planning/notes/2026-05-08-fix-youtube-landscape-video.md` appears already addressed by Phase 38's YouTube short/video removal. Phase 45 should mark it reviewed/closed unless code inspection shows a remaining bug.
- **D-17:** `.planning/notes/2026-05-09-graphscreen-drag-lag-android.md` belongs under the performance audit. Diagnose and document it; fix only if the cause is localized.
- **D-18:** The diagnosed Force-New-Day / feed issues in `.planning/debug/` are candidate in-scope bug closures because they are concrete runtime defects with root-cause notes. Planning should check whether existing Phase 43 follow-up plans already cover them before creating duplicate work.

### Claude's Discretion
- Exact names and split of audit artifacts beyond the required content.
- Whether to group fixes by concern area or by file, as long as commits remain reviewable and verification stays clear.
- Exact profiling toolchain, provided evidence is captured in the phase artifact and manual Android observations are not lost.

### Deferred Ideas (OUT OF SCOPE)
- Broad UI polish and tile-metadata redesign beyond hygiene.
- Major dependency upgrades or package migrations; Phase 44 owns in-major dependency sweep, and v1.6 owns held-back majors.
- Persistent telemetry or user-visible diagnostic tooling.
- Backend/cross-device sync for engagement or notes.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TECHDEBT-07 | TypeScript strictness audit: `tsc` 5.9.x strict-mode gaps documented; remediation plan or in-scope fixes | Current `tsc -b --noEmit` exits 0; strict mode is already enabled. Audit should target optional strict-adjacent flags and suppressions, not basic strict adoption. |
| TECHDEBT-09 | Dead-code sweep: orphan exports, unused imports, removed-feature residue across `src/` | Use `tsc`/ESLint first, then source-reading grep/tests for removed surfaces. Preserve documented EchoLearn and localStorage compatibility residue. |
| TECHDEBT-10 | Performance profiling pass: identify and document hot paths; fix any P0/P1 finding | Required areas map to first paint/build chunks, `refillQueue`, `MasonryFeed`, and `GraphScreen`/MindElixir Android drag. Use DevTools/Android observation plus temporary instrumentation. |
| TECHDEBT-11 | Project-wide TODO/FIXME triage: catalogue, decide each, close in-scope items | Current grep found no live `TODO/FIXME/HACK/XXX` in `app/src`; suppression comments and lint warnings are the meaningful triage inventory. |
| TECHDEBT-12 | Operator-note bug sweep: pull from `.planning/notes/*`, triage each note, close or defer | Two notes and two debug files exist. Phase 43 appears to have superseded the Force-New-Day diagnoses; YouTube note appears closed by Phase 38; Graph drag remains open perf audit input. |
</phase_requirements>

## Summary

Phase 45 should be planned as an evidence-first hygiene sweep, not a refactor. The codebase already has strict TypeScript enabled and `tsc -b --noEmit` exits cleanly. The immediate quality signal is instead stale lint suppressions, 27 lint warnings, five known `test:main` failures, dead removed-feature residue guarded by source-reading tests, and performance evidence around first paint, queue refill, masonry scroll, and Android GraphScreen drag.

The planner should make three artifacts first-class deliverables before code edits: `45-TSC-AUDIT.md`, `45-TODO-TRIAGE.md`, and `45-PERF-AUDIT.md`. Code tasks should then close low-risk/local findings only. Broad dependency upgrades, bundle-splitting architecture, persistent telemetry, full GraphScreen rewrites, and compatibility cleanup of EchoLearn/Trellis history are out of scope unless the audit proves a concrete bug.

**Primary recommendation:** Use the existing stack and existing source-reading test style; plan small closure commits for stale test/lint/suppression drift, removed-feature residue, superseded operator notes, and only evidence-backed localized perf fixes.

## Project Constraints (from CLAUDE.md)

- Work from `app/`; commands are `npm run build`, `npm run lint`, `npm test`, `npm run test:main`, `npm run test:actions`.
- Preserve brand-history compatibility: on-disk EchoLearn path, SQLite connection name `'echolearn'`, and Claude project memory path are intentionally retained; live app surfaces should say Trellis and localStorage keys should be `trellis_*`.
- Follow the three-list concept feed pipeline: daily concept list -> append-only derived list -> cyclic queue. Do not collapse lists, invent a fourth list, or physically splice the derived list on read.
- Preserve numeric feed defaults unless the audit proves a bug: `MAX_QUEUE_SIZE=32`, `REFILL_THRESHOLD=24`, `walkDerivedList(24, ...)` after Phase 42, and swipe-for-more count 8.
- Top-level swipe screens are always mounted; state that changes while off-screen needs route-aware re-sync or event-bus invalidation.
- Keep source-reading tests where Node dynamic import is blocked by the app import chain; prefer leaf-module extraction when practical.
- Do not reintroduce inline YouTube play in feed cards; PostDetailScreen owns video Detector D. Keep `enablejsapi=1` and the YouTube origin allowlist.
- Do not regress Header portal/in-tree split, root overflow clipping, ChatInput `minWidth: 0`, SwipeTabContainer resize guard, unified `GRAPH_UPDATED`, or anchor-name normalization.
- Service modules return `ServiceResult<T>` where applicable; local preferences use `settingsService`; cross-screen notifications use `eventBus`.

## Standard Stack

### Core
| Library / Tool | Installed Version | Purpose | Why Standard |
|---|---:|---|---|
| TypeScript | 5.9.3 | Strict type checking via `tsc -b --noEmit` | Already configured with `strict`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, and `noUncheckedSideEffectImports`; no package change needed. |
| ESLint flat config | 9.39.3 | Unused vars/imports, hook dependency warnings, stale suppression inventory | Existing `app/eslint.config.js` is the source of truth; `--report-unused-disable-directives` exposes stale disables as errors for audit. |
| typescript-eslint | 8.59.3 | TypeScript lint rules | Existing rule config already allows `_`-prefixed unused values and rest sibling ignores. |
| Node test runner | Node 25.9.0 runtime | Behavioral and source-reading regression tests | Repo-standard `node:test` + `assert/strict`; avoids adding Jest/Vitest. |
| Vite | 7.3.1 | Production build, first-paint artifact/bundle evidence | Build already surfaces chunk warnings relevant to first-paint profiling. |
| Chrome DevTools / Android WebView observation | External tool | First paint, masonry scroll, and GraphScreen drag profiling | Official performance tooling, no persistent telemetry or runtime dependency. |

### Supporting
| Tool | Version | Purpose | When to Use |
|---|---:|---|---|
| React Profiler API / DevTools | React 19.2.6 | Identify render churn in `HomeScreen`, `MasonryFeed`, `GraphScreen` | Use during temporary profiling only; do not ship visible profiler UI. |
| `rg` / shell inventory | local | TODO/suppression/residue catalogue | Use for inventory artifacts and exact source-reading checks. |
| `npm view` / `npm ls` | npm 11.12.1 | Version verification | Use only for documentation; Phase 45 should not bump versions. |
| Android Debug Bridge | 1.0.41 | Android drag-lag manual observation | Required for GraphScreen Android note if device/emulator is attached. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| ESLint + TypeScript | Knip / ts-prune | More automated dead-export detection, but not installed and Phase 45 excludes dependency churn. Avoid adding unless planner explicitly schedules one-off `npx` evidence with no package changes. |
| Node test runner | Vitest/Jest | Better component runner ergonomics, but would be a test-stack migration out of scope for a hygiene sweep. |
| Manual DevTools profiling | Persistent app telemetry | Telemetry would give repeated metrics but violates D-12; keep instrumentation temporary and artifact-based. |
| Full GraphScreen rewrite | Localized MindElixir/container fixes | Rewrite may solve lag but violates D-11 unless profiling proves no local fix exists. |

**Installation:** No new install should be planned for Phase 45.

**Version verification:** `npm ls --depth=0` on 2026-05-13 found TypeScript 5.9.3, ESLint 9.39.3, typescript-eslint 8.59.3, Vite 7.3.1, React 19.2.6, `@vitejs/plugin-react` 5.1.4, React Hooks ESLint 7.1.1, and Capacitor core 8.3.3 installed. Registry latest versions checked with `npm view`; latest majors such as TypeScript 6.0.3, ESLint 10.3.0, Vite 8.0.12, and `@vitejs/plugin-react` 6.0.1 are explicitly out of scope per Phase 44/REQUIREMENTS.

## Architecture Patterns

### Recommended Project Structure
```text
.planning/phases/45-code-quality-sweep/
├── 45-RESEARCH.md
├── 45-TSC-AUDIT.md
├── 45-TODO-TRIAGE.md
├── 45-PERF-AUDIT.md
└── 45-VERIFY.md

app/
├── src/                  # hygiene fixes only where proven
├── tests/                # source-reading/behavioral guards for deleted residue and stale tests
└── eslint.config.js      # lint-rule audit only; no broad rule churn
```

### Pattern 1: Evidence Artifact Before Fixes
**What:** Each sweep begins by recording command, output, classification, owner decision, and planned action in the phase artifact.
**When to use:** TSC strictness, TODO/suppression triage, operator notes, and perf findings.
**Example:**
```markdown
| Item | Evidence | Classification | Action |
|---|---|---|---|
| HomeScreen.tsx:502 stale exhaustive-deps disable | `eslint --report-unused-disable-directives` error | stale workaround | Remove disable; run lint/test |
```

### Pattern 2: Source-Reading Tests For Deleted Residue
**What:** When a removal has load-bearing history, add or update source-reading tests that assert the deleted surface stays absent and live invariants remain present.
**When to use:** YouTube short residue, `InlineInfoFlow` de-wiring, `noMorePosts`, `card-slide-in`, locale key deletion, brittle constant drift.
**Example:**
```js
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import test from 'node:test';

const source = readFileSync(new URL('../../src/screens/HomeScreen.tsx', import.meta.url), 'utf8');

test('removed feature residue stays deleted', () => {
  assert.ok(!source.includes('home.toast.noMorePosts'));
  assert.ok(source.includes('<MasonryFeed'));
});
```

### Pattern 3: Local Perf Instrumentation, Then Remove
**What:** Use `performance.mark/measure`, React Profiler, DevTools traces, and Android observation to capture evidence in `45-PERF-AUDIT.md`; remove any instrumentation before closure unless it is already gated dev-only and justified.
**When to use:** `refillQueue`, swipe `handleLoad`, masonry scroll, GraphScreen drag warm-up.
**Example:**
```ts
if (import.meta.env.DEV) performance.mark('refillQueue:start');
await refillQueue(questions);
if (import.meta.env.DEV) {
  performance.mark('refillQueue:end');
  performance.measure('refillQueue', 'refillQueue:start', 'refillQueue:end');
}
```

### Anti-Patterns to Avoid
- **Turning warnings into broad rewrites:** Fix stale disables and obvious dependency drift; defer React hook dependency rewrites that would change lifecycle semantics.
- **Deleting compatibility residue by grep alone:** `legacy-migration.service.ts`, SQLite `'echolearn'`, and migration tests are intentionally preserved.
- **Weakening tests to match current code:** Update brittle source-reading tests only when the canonical value changed and document the source of truth.
- **Adding hygiene dependencies:** Phase 45 is parallel-safe with Phase 44 because it avoids package churn.
- **Shipping telemetry:** Profiling evidence belongs in artifacts, not persistent product diagnostics.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Strictness audit | Custom TypeScript parser | `tsc -b --noEmit`, `tsc --showConfig` | Compiler already resolves project references and strict options correctly. |
| Unused variable/import audit | Regex over imports | ESLint + TypeScript `noUnusedLocals`/`noUnusedParameters` | Handles TS syntax, JSX, and local ignore conventions. |
| Stale suppressions | Manual comment review only | `eslint --report-unused-disable-directives` plus grep | Current baseline has 3 stale disable directives that normal lint reports only as warnings. |
| Performance timing | Date math/log-only stopwatch | DevTools Performance, `performance.mark/measure`, React Profiler | Captures render, layout, scripting, and paint costs; logs alone miss frame drops. |
| Operator-note rediscovery | Fresh debugging from symptoms | Existing `.planning/notes` and `.planning/debug` docs first | The notes already contain root causes/supersession hints; planning should not duplicate work. |
| Dead feature residue checks | Broad source deletes | Existing source-reading invariant tests | Preserves historical contracts while deleting only proven residue. |

**Key insight:** Phase 45 risk is not algorithmic complexity; it is accidentally disturbing load-bearing compatibility and feed/UI invariants while doing “cleanup.” Use compiler/linter/profiler evidence and source-reading guardrails instead of aesthetic refactors.

## Current Baseline Findings

### Commands Run 2026-05-13
| Command | Result | Planning Impact |
|---|---|---|
| `cd app && npx tsc -b --noEmit --pretty false` | exit 0 | No basic strict failure blocker. |
| `cd app && npm run lint` | exit 0, 27 warnings | Warnings should be catalogued; `no-unused-vars` currently clean. |
| `cd app && npm run lint -- --report-unused-disable-directives` | exit 1, 3 stale-disable errors + 24 warnings | Good first fix target for TECHDEBT-07/11. |
| `cd app && npm run build` | exit 0 | Build passes; Vite emits dynamic/static import chunk warnings and a 1.29 MB main chunk warning relevant to first-paint audit. |
| `cd app && npm run test:actions` | exit 0, 16 pass | Action tests are clean. |
| `cd app && npm run test:main` | exit 1, 839/844 pass, 5 fail | Treat as Phase 45 hygiene targets unless proven superseded. |

### Known Test Failures To Plan
| Test | Failure | Likely Classification |
|---|---|---|
| `tests/concept-feed.test.mjs` | Node ESM cannot resolve extensionless `./youtube.service` from `concept-feed.service.ts` | Existing Node import behavior blocker; prefer source-reading fallback or TS extension fix if local. |
| `tests/services/concept-feed-source-diversity-wiring.test.mjs` | Expects `walkDerivedList(16, ...)`; source now uses `24` per Phase 42 | Brittle stale constant; update to canonical `24` with rationale. |
| `tests/services/image-gen-key-gate.test.mjs` | Regex drift around `hasImageGenKey` expression | Brittle source-reading window; fix test to match current enabled + NanoBanana/Gemini logic without weakening behavior. |
| `tests/services/post-queue.test.mjs` | Expects refill threshold 16; source uses 24 | Brittle stale constant; update to Phase 42 canonical threshold. |
| `tests/services/trellis-layout.test.mjs` | Expects one of 5 node variables; source has 9 colors | Brittle stale expectation; verify canonical color list before updating. |

### TODO/Suppression Inventory
| Inventory | Result |
|---|---|
| `rg -n "TODO|FIXME|HACK|XXX" app/src app/tests .planning/notes .planning/debug` | No live `TODO/FIXME/HACK/XXX` in `app/src`; planning artifacts contain historical TODOs; one Spanish string contains "TODOS" but is not a TODO. |
| Suppression/comment grep | Meaningful inventory includes `@ts-ignore` in `legacy-migration.test.mjs`, `no-explicit-any` in `settings.service.ts`, `TrellisLeaf.tsx`, `main.tsx`, `providers/llm/index.ts`, and multiple hook exhaustive-deps disables. |
| Stale disable evidence | `SwipeTabContainer.tsx:169`, `HomeScreen.tsx:502`, and `useTrellisData.ts:24` are unused disable directives under `--report-unused-disable-directives`. |

## Common Pitfalls

### Pitfall 1: Strict Is Already On
**What goes wrong:** Planner schedules a broad “enable strict” task.
**Why it happens:** The requirement name says strictness audit, but `tsconfig.app.json` already has `strict: true`.
**How to avoid:** Start `45-TSC-AUDIT.md` with `tsc --showConfig` and current `tsc -b --noEmit` evidence; only consider optional flags such as `exactOptionalPropertyTypes` or `noUncheckedIndexedAccess` if the diff is genuinely small.
**Warning signs:** Large cross-cutting type churn, interface rewrites, or many non-null assertions.

### Pitfall 2: Normal Lint Hides Stale Suppression Severity
**What goes wrong:** Planner says lint is clean and misses stale disables.
**Why it happens:** `npm run lint` exits 0 with warnings; `--report-unused-disable-directives` exits 1.
**How to avoid:** Use both commands. Treat stale disables as in-scope local fixes before warning-only console/hook audits.
**Warning signs:** `ruleId: null` warnings in ESLint JSON.

### Pitfall 3: Source-Reading Tests Drift With Canonical Constants
**What goes wrong:** Tests assert stale values like threshold 16 after Phase 42 changed canonical values to 24.
**Why it happens:** Some tests are regex/source-based because dynamic imports hit Node ESM/i18n chains.
**How to avoid:** Update source-reading tests to canonical values and cite the owning phase/context; do not weaken assertions into vague substring checks.
**Warning signs:** Failure message says “unchanged” while CLAUDE.md/STATE says the value changed.

### Pitfall 4: Dead-Code Tools Flag Public Test Surfaces
**What goes wrong:** Planner deletes exported helpers that are intentionally exported for tests or leaf-module isolation.
**Why it happens:** Exports like `spreadByStyle`, `normalizeAnchorName`, `isLeafFocused`, and service helpers often exist for source-reading/behavioral tests.
**How to avoid:** Confirm all exports with `rg` across `app/src` and `app/tests`; preserve exports used only by tests if they pin a contract.
**Warning signs:** Export is referenced in a `tests/**` source-reading or leaf import test.

### Pitfall 5: Removed-Feature Residue Includes Historical Comments
**What goes wrong:** Planner deletes useful comments or fails tests because the literal appears in allowed historical context.
**Why it happens:** Negative greps often distinguish live code from explanatory comments.
**How to avoid:** For each residue class, identify whether tests require zero substring or only zero live usage. Adjust comments only if they break a deliberate negative invariant.
**Warning signs:** Tests like `InfoFlow.video-tap-emit`, `HomeScreen.no-more-posts-toast`, and `no-card-slide-in` contain precise wording.

### Pitfall 6: GraphScreen Lag May Be Library/Warm-Up, Not React State
**What goes wrong:** Planner schedules a GraphScreen rewrite.
**Why it happens:** Android drag lag has a warm-up symptom, which can be layer promotion, first layout/paint, or MindElixir initialization.
**How to avoid:** Profile cold open and first drag separately. Check `MasterMap` initialization, `opacity=0`/`setTimeout(0)` scale/center sequence, and container/layer CSS before broader changes.
**Warning signs:** No evidence trace, only subjective “feels smoother.”

## Code Examples

### Lint Inventory Command
```bash
cd app
npm run lint
npm run lint -- --report-unused-disable-directives
npx eslint . --format json > /tmp/phase45-eslint.json
```

### TSC Audit Commands
```bash
cd app
npx tsc -b --noEmit --pretty false
npx tsc --showConfig -p tsconfig.app.json
```

### TODO/Suppression Catalogue Commands
```bash
rg -n "TODO|FIXME|HACK|XXX" app/src app/tests .planning/notes .planning/debug
rg -n "eslint-disable|@ts-ignore|@ts-expect-error|no-explicit-any|\\bas any\\b|: any\\b" app/src app/tests
```

### Performance Audit Pattern
```markdown
| Area | Evidence | Finding | Severity | Action |
|---|---|---|---|---|
| First paint | `npm run build` chunk output + DevTools trace | Main chunk 1.29 MB, large PNG asset 4.55 MB | P1/P2 after trace | Local fix or defer code-splitting with rationale |
| Queue refill | temporary `performance.measure('refillQueue')` | TBD | TBD | Keep/remove instrumentation before closure |
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Turning on `strict` as a late hardening phase | Strict already enabled; audit optional strict-adjacent flags and suppressions | Current repo as of 2026-05-13 | Avoid broad type churn. |
| Normal ESLint only | Pair normal lint with `--report-unused-disable-directives` | ESLint flat config current behavior | Finds stale suppressions that normal lint leaves as warnings. |
| Single-column feed / InlineInfoFlow | `MasonryFeed` with height-accumulating two-column split | Phase 42 | Dead-code sweep must not rewire feed; remove only proven residue. |
| YouTube short/portrait classifier | All YouTube content is `video`; classifier deleted | Phase 38 | YouTube note likely closed; preserve negative tests. |
| Queue refill threshold 16 | Threshold 24 and walker count 24 | Phase 42 | Update stale tests; do not “fix” source back to 16. |

**Deprecated/outdated:**
- `sourceType: 'short'` / `presentationStyle: 'short'`: removed by Phase 38.
- `InlineInfoFlow` as `/home` feed surface: de-wired by Phase 42, still exported from `InfoFlow.tsx` for future surfaces/history.
- `home.toast.noMorePosts`: removed by Phase 42 celebration-card work.
- `card-slide-in`: deleted in favor of Framer Motion wrappers.

## Open Questions

1. **Should `exactOptionalPropertyTypes` or `noUncheckedIndexedAccess` be enabled?**
   - What we know: strict mode and several strict-adjacent flags are already enabled; `tsc` is clean.
   - What's unclear: The diff size of enabling these flags.
   - Recommendation: Audit with temporary command/config only; enable only if the diff is small and local, otherwise document deferral in `45-TSC-AUDIT.md`.

2. **Can GraphScreen Android drag lag be fixed locally?**
   - What we know: The note reports Android-only warm-up lag. `GraphScreen` initializes MindElixir on visibility, hides container until `setTimeout(0)` scale/center, then uses draggable library DOM.
   - What's unclear: Whether the bottleneck is first layout/paint, layer promotion, library drag handler, or React re-render.
   - Recommendation: Capture Android trace/manual evidence first. Try local container/layer/init sequencing fixes only if evidence points there.

3. **Are build chunk warnings P1 for first paint?**
   - What we know: Build has a 1.29 MB main JS chunk and a 4.55 MB background PNG asset.
   - What's unclear: Actual first-paint impact on target Android device after cache state.
   - Recommendation: Document trace evidence; defer broad code-splitting unless trace shows P0/P1 user-visible startup cost and a localized split exists.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | build/test/lint | yes | 25.9.0 | none |
| npm | scripts/version audit | yes | 11.12.1 | none |
| Java | Android tooling | yes | Temurin 21.0.3 | none |
| adb | Android GraphScreen observation | yes | 1.0.41 | Manual device notes if no device attached |
| Chrome/Chromium CLI | Desktop profiling | not found by `command -v google-chrome/chromium` | - | Use browser UI manually or Android WebView traces |
| Vite/TypeScript/ESLint | build/type/lint | yes | from `node_modules` | none |

**Missing dependencies with no fallback:** None for repository verification.

**Missing dependencies with fallback:** Chrome/Chromium CLI; profiler can be run manually in an installed browser or via Android tooling.

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework | Node built-in `node:test` on Node 25.9.0 |
| Config file | none; scripts in `app/package.json` |
| Quick run command | `cd app && npx tsc -b --noEmit --pretty false && npm run lint` |
| Full suite command | `cd app && npm run build && npm run test:main && npm run test:actions` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| TECHDEBT-07 | TypeScript strictness audit and local fixes | compiler + lint | `cd app && npx tsc -b --noEmit --pretty false && npm run lint -- --report-unused-disable-directives` | yes |
| TECHDEBT-09 | Dead code/residue removed without regression | source-reading + lint | targeted existing tests such as `node --test tests/components/InfoFlow.video-tap-emit.test.mjs tests/screens/HomeScreen.no-more-posts-toast.test.mjs tests/lib/no-card-slide-in.test.mjs` | yes |
| TECHDEBT-10 | Perf hot paths profiled and P0/P1 closed/deferred | manual + artifact | `cd app && npm run build`; manual DevTools/Android trace evidence in `45-PERF-AUDIT.md` | artifact missing |
| TECHDEBT-11 | TODO/FIXME/suppression catalogue closed/deferred | source inventory | `rg -n "TODO|FIXME|HACK|XXX" app/src app/tests .planning/notes .planning/debug` plus suppression grep | artifact missing |
| TECHDEBT-12 | Operator/debug notes triaged | doc + targeted tests | inspect `.planning/notes/*`, `.planning/debug/*`, then run targeted tests for any code closure | artifact missing |

### Sampling Rate
- **Per task commit:** targeted test for touched area plus `cd app && npx tsc -b --noEmit --pretty false`.
- **Per wave merge:** `cd app && npm run lint && npm run test:actions`; run relevant `test:main` subset.
- **Phase gate:** `npm run build`, `npm run lint`, `npm run test:main`, `npm run test:actions`, with any remaining known failures documented in `45-VERIFY.md`.

### Wave 0 Gaps
- [ ] `.planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md` — covers TECHDEBT-07.
- [ ] `.planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md` — covers TECHDEBT-11 and suppression inventory.
- [ ] `.planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md` — covers TECHDEBT-10.
- [ ] `.planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md` or section in triage artifact — covers TECHDEBT-12.

## Sources

### Primary (HIGH confidence)
- Local repo: `AGENTS.md`, `CLAUDE.md`, `.planning/phases/45-code-quality-sweep/45-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`.
- Local commands: `tsc -b --noEmit`, `tsc --showConfig`, `npm run lint`, `npm run lint -- --report-unused-disable-directives`, `npm run build`, `npm run test:main`, `npm run test:actions`.
- TypeScript TSConfig reference: https://www.typescriptlang.org/tsconfig/
- ESLint CLI reference for unused disable directives: https://eslint.org/docs/latest/use/command-line-interface
- Node.js test runner docs: https://nodejs.org/api/test.html
- Chrome DevTools Performance docs: https://developer.chrome.com/docs/devtools/performance/
- React `<Profiler>` reference: https://react.dev/reference/react/Profiler

### Secondary (MEDIUM confidence)
- npm registry metadata checked with `npm view` for TypeScript, ESLint, typescript-eslint, Vite, React, `@vitejs/plugin-react`, React Hooks ESLint, Capacitor, and Tailwind versions.

### Tertiary (LOW confidence)
- None used as authoritative input.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified from `package.json`, `npm ls`, and current scripts.
- Architecture: HIGH - verified from project instructions, codebase maps, and inspected source.
- Pitfalls: HIGH - derived from live command output and known phase histories.
- Performance recommendations: MEDIUM - target files and build warnings are verified, but actual Android/DevTools traces still need collection.

**Research date:** 2026-05-13
**Valid until:** 2026-06-12 for repo-local hygiene patterns; re-check npm/tool versions after 7 days if Phase 45 is delayed.
