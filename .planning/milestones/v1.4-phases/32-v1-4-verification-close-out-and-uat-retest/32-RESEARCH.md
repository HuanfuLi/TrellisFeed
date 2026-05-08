# Phase 32: v1.4 verification close-out & UAT retest - Research

**Researched:** 2026-04-18
**Domain:** GSD documentation hygiene (VERIFICATION.md/UAT retest/VALIDATION.md flip) + one iOS Capacitor native `<select>` positioning bug
**Confidence:** HIGH (patterns well-established in prior phases; root cause for dropdown has strong CSS evidence)

## Summary

Phase 32 is a gap-closure / documentation phase. The patterns it follows are already established in Phases 28/29/31 — no new library, no new framework decisions. The research therefore focuses on **codifying the exact file shapes** so the planner can write grep-verifiable task acceptance criteria instead of vague "write VERIFICATION.md" prose, and on **narrowing the UAT-31-11 dropdown root cause** from "investigate" to one of three named CSS interactions so the fix task can be specific.

Key findings: (1) mirror 29-VERIFICATION.md frontmatter + 7-section body exactly for both 30 and 31 VERIFICATION files, with a Requirements Coverage row per decision; (2) the `31-UAT.md` schema uses YAML-ish indented keys — the safe retest extension is to append `retest:`, `retested:`, `retested_by:`, `fix_source:`, `retest_note:` keys WITHOUT touching the original `result:` row; (3) the UAT-31-11 dropdown is almost certainly caused by the `<motion.div>` in `SwipeTabContainer.tsx:224-234` applying `x: stripX` which compiles to a CSS `transform: translateX(...)` — this creates a containing block that confuses iOS Safari's native `<select>` popover anchor math. The fix is to render the native select inside a `position: fixed` element OR replace with a portal-rendered custom dropdown; (4) the 3 VALIDATION.md files needing flips have a consistent frontmatter shape — only 2-3 fields change per file.

**Primary recommendation:** Use wave structure **option (A) — 3 plans in sequence** (32-01 retest + dropdown fix → 32-02 write 30/31-VERIFICATION → 32-03 flip VALIDATION files). This matches Phase 29's atomic-commit culture and respects D-05 (retest BEFORE verification write-up) and D-11 (30-VALIDATION flip gated on 30-VERIFICATION clean).

## User Constraints (from CONTEXT.md)

### Locked Decisions

**VERIFICATION.md depth & style:**
- **D-01:** `30-VERIFICATION.md` verifies each of the 22 Phase 30 decisions (D-01..D-22) **inline** — single audit table with status (VERIFIED / NO-OP / DEFERRED) and grep/file evidence per row. No bulk-block shortcuts.
- **D-02:** `31-VERIFICATION.md` uses the **same inline approach** as Phase 30 — every one of the 47 decisions gets a row.
- **D-03:** Both VERIFICATION files use **Phase 29's abbreviated observable-truths style**, not Phase 28's 30-row full truth table. Keep it to: goal achievement table (truths), required artifacts (files), requirements coverage (decisions, inline), gaps summary. Skip Key Link and Data-Flow Trace sections unless a specific decision calls for them.

**UAT retest:**
- **D-04:** Retest **all 8 failed items** in `31-UAT.md`. Append `retest:` rows; do NOT rewrite the original `result:` rows.
- **D-05:** Retest runs **before** writing `31-VERIFICATION.md`.
- **D-06:** Phase 28's 6 human-UAT items are **out of scope for Phase 32**. Opportunistic if device available, but not a gate.

**UAT-31-11 dropdown fix:**
- **D-07:** Root cause is **native `<select>` opening off-screen** — CSS positioning/anchor issue on `SelectInput` wrapper in `SettingsDataScreen.tsx:147` (postRetention field). Not a layout width issue.
- **D-08:** **Fix during the UAT retest session**, not up-front. Tester captures actual repro, patch written against observed behavior.
- **D-09:** Fix lives in `SelectInput` inside `SettingsShared.tsx` (shared) OR `SettingsDataScreen.tsx` (row-local). Planner includes a discovery task.

**VALIDATION flip discipline:**
- **D-10:** `28-VALIDATION.md` + `29-VALIDATION.md` flip to `status: validated` + `nyquist_compliant: true` as pure doc drift correction.
- **D-11:** `30-VALIDATION.md` only flips after `30-VERIFICATION.md` is written and every decision row is VERIFIED or explicitly documented as NO-OP/DEFERRED.
- **D-12:** `31-VALIDATION.md` is **already** `status: validated` + `nyquist_compliant: true` (re-audited 2026-04-18) — no change needed.

### Claude's Discretion

- Exact row ordering and column set in VERIFICATION.md tables (keep Phase 29's columns: Truth | Status | Evidence).
- Whether to split 30-VERIFICATION and 31-VERIFICATION into waves/plans or one plan each.
- Whether to include a brief summary of the 28-29 VALIDATION flips in the audit report or just commit them silently.
- Commit granularity — one commit per VERIFICATION.md, or one commit per phase's full close-out.

### Deferred Ideas (OUT OF SCOPE)

- **TD-04 (Phase 29 TD-01 regression)** — Phase 33.
- **TD-05 (orphaned ConceptProgressCard, post-store, ImmersiveInfoFlow)** — Phase 33.
- **TD-06 (dead `'dying'` LeafState branch)** — Phase 33.
- **5 new Phase 31 tsc errors** — Phase 33.
- **Working-tree WIP triage (9 modified + 3 untracked files)** — Phase 33.
- **Phase 28's 6 human-UAT items** — Opportunistic only.
- **Pre-existing Node-25 trellis test failures (24)** — Carried from v1.3; re-evaluate in v1.5.

## Phase Requirements

Phase 32 has no REQ-IDs. `.planning/REQUIREMENTS.md` tracks only v1.1 REQ-IDs (FEED/IMAGE/PLANNER/NAV/CARDS/GRAPH/CLUSTER). v1.4 phases use phase-local Context decisions as the requirement surface.

Scope surfaces the phase operates on:

| Scope area | Decisions in play | Source |
|------------|-------------------|--------|
| Phase 30 VERIFICATION | D-01..D-22 (22 decisions) | `30-CONTEXT.md` |
| Phase 31 VERIFICATION | D-01..D-47 (47 decisions) | `31-CONTEXT.md` |
| Phase 31 UAT retest | 8 failed tests (tests 2, 3, 4, 5, 6, 7, 11, 13, 14 — test 12 was `blocked`) | `31-UAT.md` |
| VALIDATION flips | 28, 29, 30 (31 is already validated) | three VALIDATION.md files |

## Standard Stack

No new dependencies. Phase 32 is pure doc + one single-file UI fix.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-i18next | 17.0.3 | Existing SelectInput props | Preserves locale behavior on label text |
| framer-motion | installed | SwipeTabContainer uses `motion.div` with `x` MotionValue → translates to CSS `transform` | Already present; root cause of dropdown bug traces through this |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React 19 `createPortal` | built-in (`react-dom`) | Optional fix: render dropdown outside transform-ancestor to fix iOS anchor | Use ONLY if native `<select>` fix (moving slot out of transform context) proves insufficient after device repro |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Keep native `<select>` | Custom portal-rendered dropdown | More code, loses native wheel picker UX on iOS. Reject unless native fix fails on device. |
| Single 32-01 plan with 4 tasks | 3 atomic plans | Single plan is fewer commits; 3 plans respect D-05 ordering + give cleaner commit history (matches Phase 29). |

**Installation:** None. No `npm install` step in this phase.

**Version verification:** N/A — no new packages.

## Architecture Patterns

### Recommended File Structure

Phase 32 touches these paths only:

```
.planning/phases/
├── 28-ui-ux-polish-from-audit-findings/
│   └── 28-VALIDATION.md                          # frontmatter flip only
├── 29-final-polishment/
│   └── 29-VALIDATION.md                          # frontmatter flip only
├── 30-redesign-curiosity-feed-.../
│   ├── 30-VALIDATION.md                          # frontmatter flip (after D-11 gate)
│   └── 30-VERIFICATION.md                        # NEW
├── 31-curiosity-feed-redesign-.../
│   ├── 31-UAT.md                                 # append 8 retest: rows
│   └── 31-VERIFICATION.md                        # NEW
└── 32-v1-4-verification-close-out-and-uat-retest/
    ├── 32-01-PLAN.md                             # NEW (retest + dropdown fix)
    ├── 32-01-SUMMARY.md                          # NEW
    ├── 32-02-PLAN.md                             # NEW (write VERIFICATIONs)
    ├── 32-02-SUMMARY.md                          # NEW
    ├── 32-03-PLAN.md                             # NEW (VALIDATION flips)
    └── 32-03-SUMMARY.md                          # NEW

app/src/screens/settings/
├── SettingsShared.tsx                            # candidate fix site (if shared SelectInput is root cause)
└── SettingsDataScreen.tsx                        # candidate fix site (if row-local is root cause)
```

### Pattern 1: VERIFICATION.md frontmatter shape (mirror Phase 29)

**What:** 5-field YAML frontmatter + 7-section body.

**When to use:** Both 30-VERIFICATION.md and 31-VERIFICATION.md.

**Example** (verified from `29-VERIFICATION.md:1-6`):
```yaml
---
phase: 30-redesign-curiosity-feed-as-scroll-progress-bar-with-daily-reading-quota-credits
verified: 2026-04-18T00:00:00Z
status: passed             # passed | human_needed | gaps_found
score: 22/22 decisions verified
re_verification: false     # true if this is a re-run after a fix
---
```

Phase 28's frontmatter adds a `gaps: []` array and a `human_verification:` nested list — Phase 32 may use these on 31-VERIFICATION.md if any decision is left DEFERRED or NO-OP with human verification.

**Body sections** (mirroring `29-VERIFICATION.md`):

1. `# Phase 30: [Name] Verification Report` + `**Phase Goal:** ...` + metadata block
2. `## Goal Achievement` / `### Observable Truths` — 5-10 top-level truths table (columns: # | Truth | Status | Evidence). **Do NOT expand to Phase 28's 30-row table per D-03.**
3. `### Required Artifacts` — table (columns: Artifact | Expected | Status | Details) listing every file/path that should exist after the phase.
4. `### Key Link Verification` — optional per D-03; skip unless a decision concerns cross-file wiring.
5. `### Behavioral Spot-Checks` — table (columns: Behavior | Command | Result | Status) of actual test invocations with counts.
6. `### Requirements Coverage` — **this is the inline decision audit required by D-01/D-02.** Columns: Decision | Wave | Status | Evidence. One row per D-NN for all 22 (Phase 30) or 47 (Phase 31) decisions.
7. `### Anti-Patterns Found` — table of intentional or deferred anti-patterns (matches 28-VERIFICATION.md:189-196 format).
8. `### Human Verification Required` — list of items requiring physical-device testing.
9. `### Gaps Summary` — final prose statement with "No gaps" or enumerated gaps.
10. Closing `_Verified: <ts>_ / _Verifier: Claude (gsd-verifier)_`.

### Pattern 2: Requirements Coverage row schema (the D-01/D-02 deliverable)

**What:** Per-decision status row per D-01/D-02 "inline" mandate.

**When to use:** In both 30-VERIFICATION.md and 31-VERIFICATION.md bodies.

**Row template:**

```markdown
| D-07 | Sticky progress card transforms on scroll | VERIFIED | HomeScreen.tsx:496 imports VineProgress (Phase 31 supersedes; see D-07..D-10 group) |
| D-19 | localStorage daily reset for explored concepts | VERIFIED | daily-read.service.ts:37 `resetIfNewDay()`; test passes 7/7 |
| D-20 | Bento card with concept topics deferred to UI-SPEC | DEFERRED | 30-CONTEXT.md D-20 marks as deferred; no code artifact expected |
| D-12 | Non-concept feed items excluded from quota | NO-OP | daily-read.service.ts:101 `getAnchorIdForPost` returns undefined for unmapped posts → excluded by construction |
```

**Three status values:**
- **VERIFIED** — Decision is implemented and visible in code; evidence cites file:line or test command.
- **NO-OP** — Decision required no code artifact (e.g., "no visual difference" / "reuse existing infra" / "keep greeting as-is"). Evidence justifies why.
- **DEFERRED** — Decision is explicitly deferred (per CONTEXT.md `## Deferred Ideas` block or cross-phase supersedes like 30-D-07..D-10 → 31-D-01).

Use **SUPERSEDED** instead of VERIFIED when a subsequent phase replaced the decision (30-D-07..D-10 card-to-bar → 31-D-01 VineProgress). Evidence cites the superseding decision.

### Pattern 3: UAT retest row schema (the D-04 deliverable)

**What:** Append-only retest block inside existing test entry.

**When to use:** 8 failed tests in `31-UAT.md`.

**Schema observed in current 31-UAT.md** (lines 15-98):

```yaml
### 2. Feed shows diverse post styles
expected: Feed displays posts in varied styles...
result: issue
reported: "I see repeated youtube videos in video posts"
severity: major
```

**Proposed retest extension** (mirrors `29-UAT-LOG.md` schema where `Fix Commit` and `Re-test Result` are explicit columns):

```yaml
### 2. Feed shows diverse post styles
expected: Feed displays posts in varied styles — text-art, video (16:9 landscape), YouTube shorts (9:16), news cards, suggestion cards. Not all the same style.
result: issue
reported: "I see repeated youtube videos in video posts"
severity: major

retest: pass
retested: 2026-04-18
retested_by: HuanfuLi
fix_source: 31-08-SUMMARY.md
retest_note: "YouTube videoId dedup via seenVideoIds Set confirmed on device; no duplicate videos observed across 3 pull-up cycles."
```

**Schema rules:**
- `retest:` required — value `pass` | `fail` | `still-blocked` | `skipped` (device unavailable).
- `retested:` required — ISO date.
- `retested_by:` required — operator name.
- `fix_source:` required when `retest: pass` — cites the SUMMARY.md that landed the fix (`31-08-SUMMARY.md`, `31-09-SUMMARY.md`, `31-10-SUMMARY.md`, or `32-01-SUMMARY.md` for the Test 11 dropdown fix).
- `retest_note:` free text describing what operator observed; required when `pass` to provide device-repro evidence for 31-VERIFICATION.md.
- `fix_commit:` OPTIONAL git SHA — `29-UAT-LOG.md` treats it as a column but inline keys are cleaner for 31-UAT.md's block format.

**Mapping of 8 failed tests → fix source** (from `.planning/v1.4-INTEGRATION-CHECK.md` + Phase 31 SUMMARYs):

| Test # | Title | Fix source |
|--------|-------|------------|
| 2 | Repeated YouTube videos | `31-08-SUMMARY.md` (seenVideoIds Set) |
| 3 | Suggestion topics repeat existing QAs; 3 too few | `31-10-SUMMARY.md` (LLM-generated topics, temp 0.8; 4 per card) |
| 4 | Inline video touch conflict | `31-09-SUMMARY.md` (transparent overlay) |
| 5 | Cannot stop video; 2 videos play simultaneously | `31-09-SUMMARY.md` (unified videoPlaying state + close button) |
| 6 | Compact header doesn't block feed interaction (MINOR) | `31-10-SUMMARY.md` (backdrop overlay for compact expand) |
| 7 | Cycling stops; no new posts generate | `31-08-SUMMARY.md` (removed exploredIds filter; await refill) |
| 11 | Post-retention dropdown anchors weird (COSMETIC) | `32-01-SUMMARY.md` (fix in THIS phase) |
| 13 | Pull-up pops 1 or 0 posts | `31-08-SUMMARY.md` (same fix as test 7) |
| 14 | Fresh install shows "Nothing new today"; starters too brief | `31-10-SUMMARY.md` (empty-state guard + richer STARTER_POSTS) |

Test 12 was `blocked` (not `issue`) so it gets a `retest: unblocked` once queue-fix lands — it's a dependent test not a failure to retest against a fix.

### Pattern 4: VALIDATION.md flip mechanics (the D-10/D-11 deliverable)

**What:** Minimal frontmatter mutation preserving all existing fields.

**When to use:** 28-VALIDATION.md, 29-VALIDATION.md, 30-VALIDATION.md.

**Fields that MUST change:**
```yaml
status: draft       → status: validated
nyquist_compliant: false → nyquist_compliant: true
```

**Fields that MUST be ADDED** (match 31-VALIDATION.md shape from `31-VALIDATION.md:1-10`):
```yaml
validated: 2026-04-18         # ISO date of flip
```

**Fields that MUST NOT change:**
```yaml
phase: 28 / 29 / 30           # identity
slug: ...                     # identity
created: 2026-04-16           # historical
wave_0_complete: ...          # already true in all 3 files per actual completion evidence — flip if currently false based on verification
```

**Before/after frontmatter — 28-VALIDATION.md:**

Before (lines 1-8):
```yaml
---
phase: 28
slug: ui-ux-polish-from-audit-findings
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---
```

After:
```yaml
---
phase: 28
slug: ui-ux-polish-from-audit-findings
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-16
validated: 2026-04-18
---
```

Rationale for `wave_0_complete: false → true`: 28-VERIFICATION.md line 106 confirms all Wave 0 test files exist and pass ("AskScreen.recent.test.mjs: 9 tests, all passing", etc.). The `false` in the VALIDATION frontmatter is stale.

**Before/after frontmatter — 29-VALIDATION.md:**

Before (lines 1-8):
```yaml
---
phase: 29
slug: final-polishment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---
```

After:
```yaml
---
phase: 29
slug: final-polishment
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-16
validated: 2026-04-18
---
```

Rationale for `wave_0_complete: false → true`: 29-VERIFICATION.md line 43 confirms `tests/screens/post-detail-abort.test.mjs` exists and passes (10/10). All Wave 0 dependencies met.

**Before/after frontmatter — 30-VALIDATION.md** (ONLY after 30-VERIFICATION.md writes up clean per D-11):

Before (lines 1-8):
```yaml
---
phase: 30
slug: redesign-curiosity-feed-as-scroll-progress-bar-with-daily-reading-quota-credits
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---
```

After:
```yaml
---
phase: 30
slug: redesign-curiosity-feed-as-scroll-progress-bar-with-daily-reading-quota-credits
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-17
validated: 2026-04-18
---
```

**31-VALIDATION.md:** NO CHANGE. Already at `status: validated`, `nyquist_compliant: true`, `validated: 2026-04-18`, `re_audited: 2026-04-18` (lines 4-9). D-12 locks this.

### Anti-Patterns to Avoid

- **Rewriting original `result:` lines in 31-UAT.md:** Destroys first-pass history. D-04 explicitly forbids; append `retest:` instead.
- **Adding REQ-IDs to REQUIREMENTS.md for v1.4 work:** REQUIREMENTS.md only tracks v1.1 IDs. v1.4 phases use Context decisions.
- **Using Phase 28's 30-row observable-truths table in 30/31-VERIFICATION.md:** D-03 forbids. Use Phase 29's abbreviated style (5-10 top truths).
- **Flipping `30-VALIDATION.md` before `30-VERIFICATION.md` is clean:** D-11 gate. If any decision ends as BLOCKED or unresolved, the flip is not allowed.
- **Writing "investigate dropdown" as a task description:** D-09 says the planner must include a discovery task, but the discovery should be grep-specific (see Common Pitfall 2 below).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| VERIFICATION.md frontmatter | Freeform YAML | Copy 29-VERIFICATION.md's 5-field shape + body sections | Downstream `/gsd:audit-milestone` parses `status:` and `score:` fields; consistency matters |
| UAT retest rows | Inline HTML comments or rewrite original | `retest:` block appended below existing keys | Preserves first-pass history + is greppable |
| Dropdown fix | Custom `<div>`-based dropdown from scratch | Move existing native `<select>` out of `transform` ancestor OR wrap its trigger in a `createPortal` that renders under `document.body` | Native iOS wheel picker is superior UX; only escape if portal can't fix |
| VALIDATION.md flip | Multi-field rewrite | 2-field change (status, nyquist_compliant) + 1-field add (validated) + (if currently false) flip wave_0_complete | Minimal diff = easier to review |

**Key insight:** This phase is 99% file editing. The one exception is the dropdown fix — and even there, the "right" solution is to REMOVE a CSS interaction rather than add new code.

## Runtime State Inventory

Not applicable — Phase 32 is not a rename/refactor/migration phase. Grep audit already done in `.planning/v1.4-MILESTONE-AUDIT.md`. No runtime state will change as a result of Phase 32 work:
- **Stored data:** None. 31-UAT.md edits are docs-only. VALIDATION flips are docs-only. VERIFICATION writes are new files.
- **Live service config:** None.
- **OS-registered state:** None.
- **Secrets/env vars:** None.
- **Build artifacts:** None. If dropdown fix touches `SettingsShared.tsx` or `SettingsDataScreen.tsx`, no egg-info/dist equivalent applies — Vite HMR handles the React rebuild.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Physical iOS device (Capacitor build) | UAT retest + dropdown repro | ? (operator to confirm) | — | D-06 says opportunistic; if device absent, retest uses web target (`npm run dev`) which reproduces the CSS-ancestor bug in desktop Chrome too |
| git | Commits for VERIFICATION + VALIDATION flips | ✓ (assumed — active repo) | — | — |
| Node 25 + npm test | Smoke-running test suite after dropdown fix | ✓ | Node 25 | — |
| `npx tsc -b --noEmit` | Verify no new tsc errors in touched Settings files | ✓ | TS 5.9 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** Physical device. If unavailable during retest, use a desktop Chrome DevTools iPhone simulator with `transform: translateX(-1000px)` forced on the ancestor — this reproduces the iOS native-select anchor bug in Chromium too. Record `retest: still-blocked` with `retest_note: "Retested in Chrome iOS sim; native select anchors to desktop viewport not row. Same root cause confirmed."`

## Common Pitfalls

### Pitfall 1: Writing VERIFICATION.md before 31-UAT retest runs

**What goes wrong:** 31-VERIFICATION.md Observable Truths row for "Queue cycles through concepts" can't be VERIFIED without operator retest evidence. Planner is tempted to verify against SUMMARY.md claims alone.

**Why it happens:** SUMMARY.md files say "fix landed" but UAT.md still shows `result: issue`.

**How to avoid:** D-05 locks the order. Task 32-02 must list `.planning/phases/31-curiosity-feed-redesign-.../31-UAT.md has 8 "retest:" rows and 7 show "retest: pass"` as its precondition.

**Warning sign:** 31-VERIFICATION.md evidence column citing `31-08-SUMMARY.md` instead of `31-UAT.md retest-pass-2`.

### Pitfall 2: Guessing the dropdown root cause instead of diagnosing on device

**What goes wrong:** Plan says "fix SelectInput positioning"; executor wraps SelectInput in `position: relative` and calls it done. On device, the native iOS picker overlay still anchors to the swipe-strip viewport, not the Settings row, because the root cause is an ancestor `transform`, not the select wrapper.

**Why it happens:** The visible symptom ("dropdown appears off-screen") points at the dropdown; the actual cause is several DOM levels up.

**How to avoid:** Planner must order the fix task as: (a) operator opens Settings > Data on device and captures screenshot/video of repro; (b) run the three grep diagnostics below; (c) only THEN write the patch.

**Three grep diagnostic commands the planner should include in the discovery task:**

```bash
# Diagnostic 1: Find every transform on an ancestor of <SelectInput>
grep -rn "transform:" app/src/components/ui/Header.tsx app/src/components/BottomNavigation.tsx app/src/components/SwipeTabContainer.tsx app/src/App.tsx
# Expected hits:
#   SwipeTabContainer.tsx:231 — x: stripX (motion.div → CSS translateX)
#   SwipeTabContainer.tsx:245 — transform: 'translateZ(0)' per-slot wrapper
#   App.tsx subscreen wrapper — no transform (good — subscreens are OUTSIDE swipe transform)

# Diagnostic 2: Confirm SettingsDataScreen renders inside the Outlet (outside swipe strip transform)
grep -n "showSubScreen\|Outlet\|cachedOutletRef" app/src/App.tsx
# Expected: Outlet renders at App.tsx:242-279, guarded by showSubScreen, with its own position:fixed container at line 253-272.
# If subscreen outlet is INSIDE <SwipeTabContainer> DOM children instead of siblings, that's the bug.

# Diagnostic 3: Check if SelectInput wrapper has an implicit transform/filter/will-change
grep -n "transform\|will-change\|filter\|backdrop-filter\|perspective" app/src/screens/settings/SettingsShared.tsx app/src/screens/settings/SettingsDataScreen.tsx
# Expected: zero hits (confirmed today). If any hit appears, it creates a new containing block and is the likely culprit.
```

**Three likely root causes** (ranked by probability, to be falsified on device):

1. **MOST LIKELY — Swipe strip `transform: translateX` leaks into native select popover anchor math.** `SwipeTabContainer.tsx:224-234` wraps the strip in `<motion.div style={{ x: stripX, ... }}>` which compiles to `transform: translate3d(Npx, 0, 0)`. iOS Safari's native `<select>` popover computes its anchor rect against the nearest `transform`ed ancestor instead of the viewport (documented Safari quirk — see [Safari transform + position:fixed bug](https://github.com/popperjs/popper-core/issues/1156)). The subscreen outlet at `App.tsx:253-272` uses `position: fixed; top:0; left:0; right:0; bottom:0` which SHOULD escape the transform — but on iOS Safari, `position: fixed` inside a `transform`ed ancestor is re-scoped to the ancestor. Verify: if screenshot shows dropdown anchored to Home tab's X-offset instead of the SettingsDataScreen row, this is the cause.

   **Fix:** Move the subscreen Outlet OUT of SwipeTabContainer's children tree. Currently `App.tsx:141-240` wraps SwipeTabContainer, then `App.tsx:242-279` renders the Outlet as a sibling OUTSIDE `<SwipeTabContainer>`. If subscreen outlet is visually on top (zIndex 50) but still DOM-nested inside SwipeTabContainer, restructure so Outlet is a true sibling. (Re-read `App.tsx:141-279` carefully to confirm DOM position.) If already a sibling, the fix is on the `.div` at line 253: add `transform: 'none'` + `willChange: 'auto'` explicitly to force a fresh containing block at that layer. Note: `position: 'fixed'` on line 259 SHOULD already escape — if iOS Safari is re-scoping, try `position: 'absolute'` on `<html>` context instead.

2. **SECOND LIKELY — Per-slot `transform: translateZ(0)` in SwipeTabContainer.tsx:245 leaks.** Each swipe slot has its own `translateZ(0)` hack for Z-ordering. If the subscreen Outlet IS rendered inside these slots (re-read to confirm), this transform creates the containing block. Fix: remove the `translateZ(0)` — but this breaks Z-ordering from the original Phase 22 design. Prefer fix #1.

3. **LEAST LIKELY — SelectInput wrapper row-local CSS.** `SelectInput` at `SettingsShared.tsx:59-79` has no transform/filter/will-change. `SettingRow` at `SettingsShared.tsx:14-24` has flex + borderBottom, nothing unusual. If grep diagnostic 3 returns zero hits (confirmed at research time — zero hits), this is NOT the cause. Only revisit if fixes #1 and #2 both fail on device.

**Warning signs:** Fix is "just add `position: relative` to SelectInput wrapper" — this won't help because native `<select>` popover positioning is browser-native, not CSS-driven.

### Pitfall 3: Accidentally including deferred TD-04/TD-05/TD-06 work

**What goes wrong:** While writing 31-VERIFICATION.md for the D-14 "important concepts get 2 posts" decision, planner notices the dead `'dying'` branch (TD-06) and adds "fix dead branch" as a task.

**Why it happens:** TD-06 is visible in the same file as Phase 31 decisions; easy to conflate.

**How to avoid:** Deferred Ideas section from 32-CONTEXT.md is authoritative. 31-VERIFICATION.md D-14 row should say `| D-14 | Important concepts get 2 posts | PARTIAL | concept-feed.service.ts:745 — easeFactor<1.5 + falling/fallen branches WIRED; 'dying' literal mismatch flagged as TD-06 deferred to Phase 33 |`. This documents the gap without fixing it.

**Warning sign:** Plan task list contains any file edit in `concept-feed.service.ts`, `trellis-state.service.ts`, `ConceptProgressCard.tsx`, `post-store.service.ts`, or `InfoFlow.tsx` (the TD-04/05/06 surfaces).

### Pitfall 4: Phase 29 VALIDATION flip hiding the TD-04 regression

**What goes wrong:** `29-VALIDATION.md` flipping to `status: validated` suggests Phase 29 is "good" — but TD-04 says the Phase 29 TD-01 plumbing was regressed by Phase 30/31. A future auditor reads the green VALIDATION and doesn't see the STALE verification.

**Why it happens:** VALIDATION.md reflects the phase-internal Nyquist test sampling contract, not cross-phase regressions. The flip is about doc drift, not current correctness.

**How to avoid:** Plan 32-03 commit message should cite TD-04 is tracked separately (Phase 33). Optionally, 29-VALIDATION.md can add a `validation_note: "Phase 29 TD-01 wiring regressed in Phase 30/31 refactor — see TD-04 in v1.4-MILESTONE-AUDIT.md, scheduled for Phase 33"` field for audit breadcrumb. Not required by D-10.

**Warning sign:** A future /gsd:audit-milestone pass against v1.5 reports "29: validated; no issues" without surfacing TD-04.

### Pitfall 5: Missing the "superseded" status in 30-VERIFICATION.md

**What goes wrong:** 30-VERIFICATION.md marks D-07..D-10 (card-to-bar) as DEFERRED — but they're not deferred, they're SUPERSEDED by Phase 31 D-01 (VineProgress replaced ConceptProgressCard). A future reader thinks these decisions were punted; actually they were implemented-then-replaced.

**Why it happens:** D-01/D-02 only define VERIFIED/NO-OP/DEFERRED tri-state.

**How to avoid:** Extend the status vocabulary to include SUPERSEDED for rows where a later phase intentionally replaced the work. Evidence cites the superseding decision. Precedent: `.planning/v1.4-INTEGRATION-CHECK.md:277` already uses SUPERSEDED for 30-D-07..D-10.

**Warning sign:** 30-VERIFICATION.md has 4 rows with evidence like "no code artifact exists" when the reality is "ConceptProgressCard.tsx exists but is orphaned; replaced by VineProgress".

## Code Examples

### Example 1: 30-VERIFICATION.md Requirements Coverage row examples

Direct-from-code citation patterns the planner can have the verifier mirror:

```markdown
| D-01 | Progress tracks unique concepts, not posts | VERIFIED | `daily-read.service.ts:101` `getAnchorIdForPost` returns anchor's id (walks sourceQuestionIds → parentId); `concept-quota.test.mjs` 8/8 pass |
| D-04 | Concept marked explored on scroll 70%, 30s dwell, or follow-up | VERIFIED | `PostDetailScreen.tsx:124-137` (Detector A, scroll sentinel), `:139-149` (Detector B, 30s timer), `:409-410` (Detector C, follow-up) |
| D-05 | PostDetailScreen emits CONCEPT_EXPLORED via event bus | VERIFIED | `PostDetailScreen.tsx:116-122` emitExplored; `HomeScreen.tsx:422-427` subscribes |
| D-07 | Card replaced in-place between bento and feed | SUPERSEDED | Replaced by VineProgress in Phase 31 D-01; `HomeScreen.tsx:496` imports VineProgress; `ConceptProgressCard.tsx` orphaned (TD-05 Phase 33) |
| D-08 | Sticky card transforms on scroll | SUPERSEDED | Replaced by VineProgress compact-header-on-scroll pattern; see Phase 31 D-02 |
| D-09 | CSS class animates card-to-compact | SUPERSEDED | VineProgress uses two render sites (HomeScreen inline + compact); no CSS-class transition |
| D-10 | Full card vs compact bar state | SUPERSEDED | VineProgress variant prop ('full' \| 'compact'); `HomeScreen.tsx:496 + 617` render both |
| D-14 | +1 trellis credit on completion | VERIFIED | `HomeScreen.tsx:462` `trellisCreditsService.add(1)`; daily idempotent via dailyReadService |
| D-17 | Hide card when no concept posts | VERIFIED | `HomeScreen.tsx:615` guard `conceptQuota > 0` |
| D-19 | Explored concepts persisted in localStorage with daily reset | VERIFIED | `daily-read.service.ts:37` resetIfNewDay; 7/7 tests pass |
| D-21 | All new strings i18n'd | VERIFIED | `home.feed.*` keys present in 4 bundles; bundle-parity test green |
| D-22 | home.feed.* namespace | VERIFIED | grep `^\s*"feed":` in each of 4 bundle files returns 1 hit each |
```

### Example 2: 31-VERIFICATION.md goal achievement table

10-row abbreviated observable-truths table per D-03:

```markdown
### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | VineProgress replaces ConceptProgressCard | VERIFIED | `HomeScreen.tsx:8, 496, 617` imports + renders VineProgress |
| 2 | Same vine used inline AND compact | VERIFIED | HomeScreen renders VineProgress in both positions; single component with variant prop |
| 3 | 8-post FIFO queue with refill threshold 8 | VERIFIED | `post-queue.service.ts` + `REFILL_THRESHOLD=8`; 8/8 tests pass |
| 4 | 4 LLM-generated suggestion topics per card | VERIFIED | `concept-feed.service.ts` chatCompletion(temp=0.8); 31-10-SUMMARY.md confirms |
| 5 | Landscape video inline play + swipe stop | VERIFIED (post-retest) | `InfoFlow.tsx:936-938` SwipeTabContext listener; 31-UAT.md test 5 retest: pass |
| 6 | 7-day rolling retention + "keep all" | VERIFIED | `post-history.service.ts` purgeExpired; 6/6 tests pass |
| 7 | Scroll-to-top FAB at bottom-right | VERIFIED | `ScrollToTopFAB.tsx` + `HomeScreen.tsx:* import`; zIndex 40 (below BottomNav 100) |
| 8 | Starter posts replaced with app-tutorial | VERIFIED (post-retest) | `concept-feed.service.ts:55-80` STARTER_POSTS; 9/9 starter tests pass; 31-UAT.md test 14 retest: pass |
| 9 | Post history screen at /history | VERIFIED | `App.tsx:312` route; HomeScreen + SettingsDataScreen entry points |
| 10 | 8 UAT regressions retested green (except cosmetic) | VERIFIED | `31-UAT.md` has 8 retest: rows; 7 pass, 1 is Test 11 fixed in this phase |

**Score:** 10/10 truths verified
```

### Example 3: UAT retest block (verbatim append to 31-UAT.md test 7)

```yaml
### 7. VineProgress completion celebration
expected: After exploring all concepts (opening and reading posts for each), vine turns gold (#E8A838) with bloom animation and fruit icons. "+1 credit earned!" toast appears.
result: issue
reported: "Cannot test because I cannot finish all concepts. The system fails to go through list of concept again in a loop manner, and stops generating new posts after a few swipe-for-more actions."
severity: blocker

retest: pass
retested: 2026-04-18
retested_by: HuanfuLi
fix_source: 31-08-SUMMARY.md
retest_note: "Confirmed queue now cycles indefinitely. Explored all 5 due concepts, vine turned gold, +1 credit toast fired. Bloom animation + fruit icons visible."
```

### Example 4: Dropdown fix candidate — move Outlet to sibling of SwipeTabContainer

If Diagnostic 1 confirms `SwipeTabContainer.tsx:224` transform leaks into subscreen outlet:

**Current structure** (`App.tsx:141-279` — verify DOM nesting):
```tsx
<SwipeTabContainer routes={routes}>
  {/* 5 tab screens inside */}
  <ToastContainer />
</SwipeTabContainer>
{showSubScreen && (
  <div style={{ position: 'fixed', ... }}>
    <Outlet />
  </div>
)}
```

This structure SHOULD work (subscreen div is a SIBLING, not a child). But on iOS Safari, if the subscreen div is DOM-adjacent to SwipeTabContainer but both are inside a parent that has no explicit `transform: none`, iOS's native `<select>` popover walks up the render tree and finds SwipeTabContainer's motion.div transform.

**Hotfix candidate** (minimum diff):
```tsx
// App.tsx line 253 — add explicit transform-cancel + isolation
<div
  onScroll={...}
  style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    backgroundColor: 'var(--surface)',
    paddingTop: 'var(--safe-area-top)',
    paddingBottom: 'var(--safe-area-bottom)',
    overflow: 'auto',
    overscrollBehavior: 'contain',
    animation: subScreenClosing ? 'sub-screen-out 0.2s ease forwards' : 'sub-screen-in 0.2s ease',
    pointerEvents: subScreenClosing ? 'none' : 'auto',
    transform: 'none',        // NEW — force new containing block
    isolation: 'isolate',      // NEW — new stacking context, prevents inherit
    willChange: 'auto',        // NEW — cancel any willChange from sub-screen-in animation
  }}
>
```

**Alternative (higher risk, higher confidence):** Re-render subscreen at document.body via `createPortal`:
```tsx
import { createPortal } from 'react-dom';
// ...
{showSubScreen && createPortal(
  <div style={{ position: 'fixed', ... }}>{outlet}</div>,
  document.body
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| VERIFICATION.md as freeform prose | Structured frontmatter + 7-section body with tables | Phase 22 (v1.3) | `/gsd:audit-milestone` can parse frontmatter; enables automated cross-phase audits |
| UAT as separate walkthrough document | Inline UAT test blocks in a single phase UAT.md with YAML-ish keys | Phase 31 (v1.4) | One-file ledger; retest support via appended keys |
| VALIDATION.md with manual Nyquist docs | Frontmatter-driven `nyquist_compliant` flag + auto-flipped by `/gsd:validate-phase` | Phase 27-28 (v1.4) | Machine-greppable; enables milestone-audit coverage reporting |

**Deprecated/outdated:**
- Phase 28's 30-row Observable Truths table (per D-03, not to be mirrored for 47-decision Phase 31).
- Separate `20/21/22-UAT-LOG.md` per-phase files (consolidated to single `29-UAT-LOG.md` per Phase 29 D-09).

## Open Questions

1. **Is the sub-screen Outlet actually a DOM sibling of SwipeTabContainer or a descendant?**
   - What we know: `App.tsx:141-279` shows JSX structure where the fragment has `<SwipeTabContainer>...</SwipeTabContainer>` followed by `{showSubScreen && <div>...<Outlet /></div>}`. In JSX semantics these are siblings. In DOM, React renders them as siblings too.
   - What's unclear: whether iOS Safari's native `<select>` popover walks up the tree and still gets confused by the SwipeTabContainer's transform context even when the Outlet div is a sibling.
   - Recommendation: Start the dropdown fix task with Diagnostic 1 grep + a 30-second device session. If the simulator repro also shows the misalignment (easy to verify: `document.querySelector('[role="combobox"]')` then click, or just open Settings in Chrome DevTools iPhone sim), proceed with the minimum-diff patch (transform:none/isolation:isolate). If device-only, proceed with createPortal.

2. **Does Phase 30 D-20 (bento card deferred to UI-SPEC) count as DEFERRED or NO-OP in 30-VERIFICATION.md?**
   - What we know: 30-CONTEXT.md:58 marks it "deferred to UI-SPEC design review".
   - What's unclear: whether "deferred to a design review" is the same status as "deferred to a future phase". Phase 30 UI-SPEC may or may not exist as a document.
   - Recommendation: Use DEFERRED with evidence citing "30-CONTEXT.md D-20; UI-SPEC design review pending (no artifact expected in this phase)". The verifier can drop to NO-OP later if UI-SPEC ruled against adding the card.

3. **Should 32-02 be one plan covering both 30 and 31 VERIFICATION, or two plans (one per file)?**
   - What we know: 30 has 22 decisions; 31 has 47. The verifier agent typically produces one VERIFICATION.md per invocation.
   - What's unclear: planner's preference — but single plan with two tasks (one per file) keeps commit granularity at "one commit per VERIFICATION.md" per Phase 29's established pattern. Prefer this.
   - Recommendation: Single 32-02 plan, 2 tasks. Commits are atomic per VERIFICATION.md.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` + esbuild tsx loader (existing infrastructure; no new install) |
| Config file | `app/package.json` (existing `test` script) |
| Quick run command | `cd app && node --test tests/locales/bundle-parity.test.mjs` (~1s) |
| Full suite command | `cd app && npm test` (~60s) |
| Phase 32 adds ZERO new unit tests — this phase is documentation + one UI fix |

### Phase Requirements → Test Map

Phase 32's "requirements" are the 12 decisions (D-01..D-12). Since this is a documentation + 1-UI-fix phase, most "tests" are grep-based doc assertions, not runtime tests.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| D-01 | 30-VERIFICATION.md verifies each D-01..D-22 inline | doc-grep | `grep -c "^| D-" .planning/phases/30-*/30-VERIFICATION.md` must return ≥ 22 | ❌ Wave 0 create |
| D-02 | 31-VERIFICATION.md verifies each D-01..D-47 inline | doc-grep | `grep -c "^| D-" .planning/phases/31-*/31-VERIFICATION.md` must return ≥ 47 | ❌ Wave 0 create |
| D-03 | Files follow Phase 29 abbreviated style (5-10 top truths, NOT 30) | doc-grep | `awk '/^### Observable Truths$/,/^###/' .planning/phases/30-*/30-VERIFICATION.md \| grep -c "^| [0-9]"` ≤ 15 | ❌ Wave 0 create |
| D-04 | 8 retest rows appended in 31-UAT.md (one per failed test 2,3,4,5,6,7,11,13,14) | doc-grep | `grep -c "^retest:" .planning/phases/31-*/31-UAT.md` == 9 (includes test 12 unblock) | ❌ Wave 0 append |
| D-04-preserve | Original `result:` lines unchanged | doc-grep | `grep -c "^result: issue" .planning/phases/31-*/31-UAT.md` == 8 (preserved) AND `grep -c "^result: blocked" .planning/phases/31-*/31-UAT.md` == 1 | Existing file |
| D-05 | Retest runs BEFORE 31-VERIFICATION.md is written | execution-order | Plan 32-01 precedes Plan 32-02 in commit log (git log) | Plan ordering |
| D-07 | UAT-31-11 root cause identified + documented | doc-grep | `grep -c "transform" .planning/phases/32-*/32-01-SUMMARY.md` ≥ 1 | ❌ 32-01 creates |
| D-08 | Dropdown fix done DURING retest (not upfront) | execution-order | 32-01 plan has tasks in order: (1) device retest, (2) dropdown repro capture, (3) fix | Plan structure |
| D-09 | Fix site is SettingsShared.tsx OR SettingsDataScreen.tsx OR App.tsx | static-grep | `git diff HEAD~1..HEAD --stat` after fix shows one of {`app/src/screens/settings/SettingsShared.tsx`, `app/src/screens/settings/SettingsDataScreen.tsx`, `app/src/App.tsx`} | ❌ 32-01 creates |
| D-10 | 28-VALIDATION.md + 29-VALIDATION.md have status:validated + nyquist_compliant:true | doc-grep | `grep -c "^status: validated" .planning/phases/{28,29}-*/*-VALIDATION.md` == 2 AND `grep -c "^nyquist_compliant: true" .planning/phases/{28,29}-*/*-VALIDATION.md` == 2 | Existing files |
| D-11 | 30-VALIDATION.md flipped ONLY after 30-VERIFICATION.md exists AND has no BLOCKED rows | doc-grep | `test -f .planning/phases/30-*/30-VERIFICATION.md && grep -c "BLOCKED" .planning/phases/30-*/30-VERIFICATION.md == 0` MUST be true before flipping 30-VALIDATION.md | 30-VERIFICATION.md created in 32-02 |
| D-12 | 31-VALIDATION.md unchanged | doc-grep | `grep "^validated: 2026-04-18" .planning/phases/31-*/31-VALIDATION.md` returns 1 hit (already present); no new commit touches this file | Existing; no change expected |
| Regression | SelectInput dropdown fix introduces no new tsc errors | regression | `cd app && npx tsc -b --noEmit 2>&1 \| grep -c "error TS"` no worse than 9 (current baseline) | Run after 32-01 |
| Regression | No new test failures after SelectInput fix | regression | `cd app && npm test 2>&1 \| grep -c "fail"` no worse than current 32 (24 pre-existing trellis + 8 v1.4 TD-04) | Run after 32-01 |

### Sampling Rate

- **Per task commit:** Run the task's doc-grep assertion (one-liner, < 100ms).
- **Per wave merge:** No test suite runs needed — this is a docs phase. Exception: 32-01 wave ends with `cd app && npm test` + `npx tsc -b --noEmit` after the dropdown fix lands, to confirm no regression in the 4 test files touching Settings (bundle-parity.test.mjs, settings-locale.test.mjs).
- **Phase gate:** Final `/gsd:audit-milestone v1.4` should report `gaps_found → passed` (no remaining gaps except TD-04/05/06 scheduled for Phase 33).

### Wave 0 Gaps

No new test framework install needed. No new unit tests. Wave 0 consists of CREATING (not testing) documentation artifacts:

- [ ] `.planning/phases/30-redesign-curiosity-feed-.../30-VERIFICATION.md` — created by gsd-verifier in Plan 32-02
- [ ] `.planning/phases/31-curiosity-feed-redesign-.../31-VERIFICATION.md` — created by gsd-verifier in Plan 32-02
- [ ] `.planning/phases/31-curiosity-feed-redesign-.../31-UAT.md` — modified (append retest rows) in Plan 32-01
- [ ] `.planning/phases/28-ui-ux-polish-from-audit-findings/28-VALIDATION.md` — modified (frontmatter flip) in Plan 32-03
- [ ] `.planning/phases/29-final-polishment/29-VALIDATION.md` — modified (frontmatter flip) in Plan 32-03
- [ ] `.planning/phases/30-redesign-curiosity-feed-.../30-VALIDATION.md` — modified (frontmatter flip) in Plan 32-03 (gated on D-11)

*None — existing test infrastructure covers all regression needs. If dropdown fix lands in App.tsx, no test file targets App.tsx wrapping structure (operator UAT is the acceptance harness for Test 11).*

## Proposed Wave Structure

**Recommended: Option (A) — 3 plans in strict sequential order, matching D-05 and D-11 gates.**

### Plan 32-01: UAT retest + dropdown fix (atomic)

| Task | Site | Acceptance |
|------|------|------------|
| 1. Device session: retest 8 failed UAT items + capture dropdown screenshot | Physical iOS device (or desktop Chrome iPhone sim per D-06 fallback) | Operator has 8 retest results + 1 screenshot |
| 2. Dropdown root-cause diagnostic greps | `App.tsx`, `SwipeTabContainer.tsx`, `SettingsShared.tsx` | 3 grep commands run; smoking-gun ancestor transform identified |
| 3. Patch fix (one of: App.tsx transform:none / createPortal / SelectInput wrapper change) | Per diagnostic outcome | `git diff` shows minimal change; device retest passes |
| 4. Append 8 `retest:` blocks to 31-UAT.md (plus test 12 unblock) | `31-UAT.md` | `grep -c "^retest:" 31-UAT.md` == 9 |
| 5. Regression check | — | `cd app && npm test` same fail count; `npx tsc -b --noEmit` same error count |

**Commit granularity:** 1 commit for dropdown fix, 1 commit for 31-UAT.md retest appends (preserves atomicity).

### Plan 32-02: Write 30-VERIFICATION.md + 31-VERIFICATION.md

| Task | Site | Acceptance |
|------|------|------------|
| 1. Invoke gsd-verifier for Phase 30 | Creates `30-VERIFICATION.md` | `test -f` + `grep -c "^| D-"` ≥ 22 + no BLOCKED rows |
| 2. Invoke gsd-verifier for Phase 31 (uses 31-UAT.md retest results as evidence) | Creates `31-VERIFICATION.md` | `test -f` + `grep -c "^| D-"` ≥ 47 + no BLOCKED rows |

**Commit granularity:** 1 commit per VERIFICATION.md = 2 commits.

### Plan 32-03: Flip VALIDATION.md frontmatter on 28, 29, 30

| Task | Site | Acceptance |
|------|------|------------|
| 1. Flip 28-VALIDATION.md frontmatter | `28-VALIDATION.md` | `grep "^status: validated"` + `grep "^nyquist_compliant: true"` + `grep "^validated:"` all return 1 |
| 2. Flip 29-VALIDATION.md frontmatter | `29-VALIDATION.md` | same |
| 3. Flip 30-VALIDATION.md frontmatter (gated per D-11 on Plan 32-02 completing clean) | `30-VALIDATION.md` | same + `grep -c "BLOCKED" 30-VERIFICATION.md` == 0 |
| 4. Update STATE.md with Phase 32 completion | `STATE.md` | `grep "Phase 32" STATE.md` shows COMPLETE |

**Commit granularity:** 1 commit per VALIDATION.md flip + 1 commit for STATE.md = 4 commits.

**Total Phase 32 commits (option A):** ~8 commits. Matches Phase 29's atomic style.

**Rejected alternatives:**

- **Option (B) — 2 plans:** Bundles dropdown fix with 31-VERIFICATION; violates D-05 if retest hasn't landed before verifier invocation.
- **Option (C) — 1 plan / 4 tasks:** One giant commit or one messy multi-file commit per task. Loses atomicity. Doesn't respect D-11 gating (30-VALIDATION can't conditionally skip inside a single plan).

## Sources

### Primary (HIGH confidence)

- `.planning/phases/32-v1-4-verification-close-out-and-uat-retest/32-CONTEXT.md` — 12 locked decisions
- `.planning/phases/29-final-polishment/29-VERIFICATION.md` — abbreviated observable-truths template (per D-03)
- `.planning/phases/29-final-polishment/29-UAT-LOG.md` — UAT row schema + retest pattern
- `.planning/phases/31-curiosity-feed-redesign-post-lifecycle-and-display/31-UAT.md` — current failed-test schema + list of 8 failures
- `.planning/phases/31-*/31-08-SUMMARY.md`, `31-09-SUMMARY.md`, `31-10-SUMMARY.md` — fix sources for UAT retest evidence
- `.planning/phases/30-*/30-CONTEXT.md` — 22 decisions for 30-VERIFICATION.md scope
- `.planning/phases/31-*/31-CONTEXT.md` — 47 decisions for 31-VERIFICATION.md scope
- `.planning/phases/31-*/31-VALIDATION.md:1-10` — reference frontmatter for the `validated:` date field
- `.planning/v1.4-MILESTONE-AUDIT.md` — authoritative gap list and status nomenclature (SUPERSEDED precedent)
- `.planning/v1.4-INTEGRATION-CHECK.md:277` — SUPERSEDED status precedent for 30-D-07..D-10
- `app/src/components/SwipeTabContainer.tsx:224-234, 245` — confirmed motion.div transform + per-slot translateZ(0) that are candidate root causes
- `app/src/App.tsx:141-279` — confirmed subscreen Outlet is a JSX sibling of SwipeTabContainer, rendered in a position:fixed div with its own animation
- `app/src/screens/settings/SettingsShared.tsx:59-79` — confirmed SelectInput is a plain native `<select>` with no transform/filter/will-change
- `app/src/screens/settings/SettingsDataScreen.tsx:146-154` — confirmed SelectInput row has no unusual positioning

### Secondary (MEDIUM confidence)

- WebSearch "position:fixed CSS transform parent containing block iOS Safari select picker anchor" — returned multiple sources confirming that ancestor CSS `transform` creates a containing block that redirects `position:fixed` and breaks native popover anchor math on iOS Safari (verified against `dev.to/salilnaik/the-uncanny-relationship-between-position-fixed-and-transform-property`, `muffinman.io/blog/ios-safari-scroll-position-fixed`, `copyprogramming.com/howto/css-work-around-for-postion-fixed-css`, and `github.com/popperjs/popper-core/issues/1156`)

### Tertiary (LOW confidence — flagged for device validation)

- The exact order of likely root causes (1: SwipeTabContainer motion.div, 2: per-slot translateZ, 3: SelectInput row) is based on diagnostic grep + DOM reading, NOT device repro. D-08 specifies the diagnosis happens DURING the retest session — the root-cause ranking here is an informed hypothesis, not a verified diagnosis. Planner should add operator screenshot capture as the first step of 32-01.

## Metadata

**Confidence breakdown:**
- VERIFICATION.md shape: HIGH — direct mirror of 29-VERIFICATION.md observed and verified
- UAT retest schema: HIGH — direct extension of 31-UAT.md's existing YAML-ish key pattern, with 29-UAT-LOG.md precedent for Fix Commit / Re-test columns
- VALIDATION.md flip: HIGH — 3 files read side-by-side; frontmatter diff is trivially derivable
- Dropdown root cause ranking: MEDIUM — code inspection + established iOS Safari CSS quirk; device repro is required to confirm which of the 3 candidates is the actual cause. Diagnostic greps documented.
- Wave structure recommendation: HIGH — follows Phase 29's atomic-commit pattern; respects D-05 and D-11 gates.
- Regression testing approach: HIGH — no new tests needed; existing `npm test` + `tsc -b --noEmit` baselines capture any regression.

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (stable docs patterns, no fast-moving dependencies)
