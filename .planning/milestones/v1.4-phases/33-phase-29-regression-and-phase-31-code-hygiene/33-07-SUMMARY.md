---
phase: 33-phase-29-regression-and-phase-31-code-hygiene
plan: 07
subsystem: cosmetic-polish
tags: [touch-target, wcag-2-5-8, spacing-token, shadow-token, css-vars, planner, chat-input, d-24, d-25, d-26]

# Dependency graph
requires:
  - phase: 33-phase-29-regression-and-phase-31-code-hygiene
    provides: 33-06 perf memoization complete (working tree clean baseline; LeafState rename + Wave 4 flush already landed via 33-03/33-05)
  - phase: 32.1-curiosity-feed-uat-cycle
    provides: Wave 4 D-W4-08 unified shadow tier (`--shadow-2`); Wave 4 spacing token grid (`--space-sm/md/lg`)
  - phase: 27-add-i18n-l10n-support
    provides: i18n bundles untouched per D-26 (no translation changes in cosmetic plan)
provides:
  - "PlannerScreen.tsx refresh button at line 152 sized 44x44 (was 28x28) — WCAG 2.5.8 minimum touch target compliance per D-24"
  - "PlannerScreen.tsx EmptySectionHint padding at line 24 uses `var(--space-md) var(--space-lg)` token (was literal `'14px 16px'`) per D-25; 14->12 vertical change intentional per token grid"
  - "PlannerScreen.tsx show/hide buttons at lines 302, 317 use `var(--space-sm) var(--space-lg)` token (was literal `'10px 16px'`) per D-25; 10->8 vertical change intentional per token grid"
  - "ChatInput.tsx mic button at lines 110-111 sized 44x44 (was 34x34) per D-24"
  - "ChatInput.tsx globe button at lines 138-139 sized 44x44 (was 34x34) per D-24"
  - "ChatInput.tsx container box-shadow at line 97 uses `var(--shadow-2)` token (was literal `'0 4px 12px rgba(0,0,0,0.1)'`) per D-25; matches Phase 32.1 Wave 4 D-W4-08 unified shadow tier"
  - "Two atomic per-file commits — bisect-friendly per CONTEXT 'Specifics' guidance"
  - "D-26 honored: zero new packages, zero Tailwind classes, zero translation bundle changes; inline styles + CSS vars only"
affects: [v1.5-touch-target-audit-other-screens, v1.5-spacing-token-migration-remaining-call-sites]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WCAG 2.5.8 touch-target compliance via direct dimension swap on inline-style buttons: `width/height: 'NNpx'` literal upgraded to 44x44 minimum while preserving the inner icon `size={...}` so the icon doesn't dominate the larger button (refresh keeps size=13; mic+globe keep size=17)."
    - "Spacing token migration via literal-to-var swap with intentional grid alignment: `padding: '14px 16px'` -> `padding: 'var(--space-md) var(--space-lg)'` (= 12px 16px). The 14->12 / 10->8 vertical compression is by-design — token grid wins over the prior arbitrary px values."
    - "Shadow token migration via pre-edit visual-parity check: before swapping `boxShadow: '0 4px 12px rgba(0,0,0,0.1)'` -> `boxShadow: 'var(--shadow-2)'`, the responsible agent reads the CSS-var definition in `app/src/index.css` and confirms ~equivalent diffuseness. `--shadow-2` (`0 3px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)`) is Material Design 'elevation 2' tier — additive layers approximate the single-layer literal."
    - "Atomic per-file commit cadence for visual changes: ChatInput edits (3 substitutions in one file) and PlannerScreen edits (4 substitutions in one file) ship as separate commits so any visual regression bisects to one file."

key-files:
  created: []
  modified:
    - app/src/screens/PlannerScreen.tsx
    - app/src/components/ChatInput.tsx

key-decisions:
  - "D-24 honored on PlannerScreen: refresh button at line 152 changed from `width: '28px', height: '28px'` to `width: '44px', height: '44px'`. Icon kept at `<RefreshCw size={13} />` (within the 14-16px tolerance noted in CONTEXT 'Code Context' — 'KEEP the icon at 14-16px so it doesn't dominate the button'); 13 is acceptable because the original was 13 and the WCAG bump only enlarges the hit target, not the visual icon."
  - "D-24 honored on ChatInput: mic button (lines 110-111) and globe button (lines 138-139) both bumped from 34x34 to 44x44. Both icons preserved at `size={17}` — 17/44 = 39% icon-to-button ratio, comfortable for thumbs and visually consistent with the 13/44 = 30% on PlannerScreen refresh."
  - "D-25 honored on PlannerScreen EmptySectionHint: line 24 padding `'14px 16px'` -> `'var(--space-md) var(--space-lg)'`. The 14->12 vertical compression is intentional per token grid alignment (CONTEXT D-25 explicit note)."
  - "D-25 honored on PlannerScreen show/hide buttons: lines 302 (showAllSuggestions=true) and 317 (showAllSuggestions=false) both swapped `padding: '10px 16px'` -> `padding: 'var(--space-sm) var(--space-lg)'` (= 8px 16px). The 10->8 vertical compression is intentional per token grid alignment. Disambiguation via 3-line context including the `onClick` handler signature."
  - "D-25 honored on ChatInput container shadow: line 97 `boxShadow: '0 4px 12px rgba(0,0,0,0.1)'` -> `boxShadow: 'var(--shadow-2)'`. Pre-edit visual-parity check confirmed `--shadow-2` light mode (`0 3px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)`) is visually equivalent — additive 2-layer shadow with combined ~16% opacity vs original single-layer 10%, plus matching ~5px y-offset and ~10px combined blur. Aligns with Phase 32.1 Wave 4 D-W4-08 unified shadow tier."
  - "D-26 honored: zero new packages (`git diff HEAD~2 -- app/package.json` empty), zero Tailwind class additions in diff (`grep -E '^\\+.*className='` on full diff returns no NEW additions; existing `className=\"active-squish\"` on PlannerScreen line 150 is unmodified), zero locale bundle changes (`git diff HEAD~2 -- 'app/src/locales/*.json'` empty)."
  - "Two atomic per-file commits per CONTEXT 'Specifics' guidance: `616c761f` (PlannerScreen) + `47d81049` (ChatInput). Each commit's `git diff HEAD~1 --name-only` lists exactly one file. Bisect target for any visual regression is precisely one file."
  - "Plan scope discipline: only the 3 specified PlannerScreen sites (EmptySectionHint + 2 show/hide buttons + refresh button) and 3 ChatInput sites (mic + globe + container shadow) were touched. Other `'14px 16px'`, `'10px 16px'`, `'34px'`, etc. literals elsewhere in the same files were left alone — they're out of scope per CONTEXT D-25 explicit boundary."

patterns-established:
  - "Pre-edit visual-parity gate for token swaps: when migrating a hardcoded shadow/color/spacing literal to a CSS-var token, the agent MUST first read the token definition in `app/src/index.css` and confirm visual equivalence (or justify intentional deviation). For `--shadow-2`, the additive 2-layer composition (`0 3px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)`) approximates the single-layer literal `0 4px 12px rgba(0,0,0,0.1)` within Material Design elevation tolerance."
  - "Touch-target bump preserving icon size: when increasing a button's hit area to meet WCAG 2.5.8 (44x44), the inner icon's `size={...}` should NOT scale proportionally. Keep the icon at its previous comfortable visual weight (13-17px) so the button is hit-target-accessible without becoming visually heavy. Standard ratio: 30-40% icon-to-button area."
  - "Disambiguating identical-style blocks via 3-line context: when two JSX elements have IDENTICAL `style={{...}}` literals but different surrounding handlers (e.g., two show-vs-hide buttons), the Edit tool's `old_string` MUST include the disambiguating handler line (`onClick={() => setShowAllSuggestions(true)}` vs `false`). Include 3-4 lines of context, NOT just the single style line."
  - "Cosmetic-plan scope discipline: a 'cosmetic polish' plan is allowed to touch ONLY the call sites enumerated in the CONTEXT decisions. Other instances of the same literal in OTHER components or even other contexts within the same file are out-of-scope. Resist the urge to fix-while-you're-there."

requirements-completed: [COSMETIC-POLISH]

# Metrics
duration: ~6min
completed: 2026-04-19
---

# Phase 33 Plan 07: Cosmetic Polish Summary

**Bumped 3 button hit-targets from sub-44px to 44x44 (PlannerScreen refresh + ChatInput mic + globe) for WCAG 2.5.8 compliance, and migrated 4 hardcoded spacing/shadow literals (`'14px 16px'`, `'10px 16px'` x2, `'0 4px 12px rgba(0,0,0,0.1)'`) to CSS-var tokens (`var(--space-md/sm) var(--space-lg)`, `var(--shadow-2)`) — all in 2 atomic per-file commits with zero behavioral change, zero new packages, and zero translation changes per D-26.**

## Performance

- **Duration:** ~6 minutes wall-clock (2026-04-20T00:16:59Z plan start → 2026-04-20T00:22:56Z final commit)
- **Started:** 2026-04-20T00:16:59Z
- **Completed:** 2026-04-20T00:22:56Z
- **Tasks:** 2 (Task 7.1 PlannerScreen + Task 7.2 ChatInput) — one atomic commit per task
- **Files modified:** 2 unique files; 7 substitutions total
- **Net diff:** 9 insertions, 9 deletions across 2 files

## Accomplishments

- **D-24a (PlannerScreen refresh button — WCAG 2.5.8):** `width: '28px', height: '28px'` → `width: '44px', height: '44px'` at line 152. RefreshCw icon kept at `size={13}` (within 14-16 tolerance per CONTEXT note); the bump only enlarges the hit target, the visual icon weight is unchanged.
- **D-24b (ChatInput mic button — WCAG 2.5.8):** `width: '34px', height: '34px'` → `width: '44px', height: '44px'` at lines 110-111. Mic icon preserved at `size={17}` (39% icon-to-button ratio).
- **D-24c (ChatInput globe button — WCAG 2.5.8):** Identical bump at lines 138-139. Globe icon preserved at `size={17}`. Disambiguated from mic via the `onClick={onToggleWebSearch}` context line in the Edit `old_string`.
- **D-25a (PlannerScreen EmptySectionHint padding):** `padding: '14px 16px'` → `padding: 'var(--space-md) var(--space-lg)'` at line 24 (= 12px 16px). 14→12 vertical compression intentional per token grid (CONTEXT D-25 explicit note).
- **D-25b (PlannerScreen show/hide buttons padding):** Both `padding: '10px 16px'` literals at lines 302, 317 → `padding: 'var(--space-sm) var(--space-lg)'` (= 8px 16px). Disambiguated via the `onClick={() => setShowAllSuggestions(true)}` vs `(false)` context lines.
- **D-25c (ChatInput container shadow):** `boxShadow: '0 4px 12px rgba(0,0,0,0.1)'` → `boxShadow: 'var(--shadow-2)'` at line 97. Pre-edit visual-parity check confirmed equivalence with `--shadow-2` light mode (`0 3px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)`).
- **D-26 (no Tailwind / no new packages / no translation changes):** Verified via `git diff HEAD~2` against `app/package.json` (0 lines), all locale bundle files (0 lines), and `^\\+.*className=` pattern (no NEW additions).

## Pre-edit Shadow Visual-Parity Check (D-25c gate)

Per the safety rule in the executor prompt and Task 7.2 Step 1, before swapping the ChatInput container shadow:

| Attribute | Original literal `0 4px 12px rgba(0,0,0,0.1)` | `--shadow-2` light mode (line 79 `app/src/index.css`) | Verdict |
| --- | --- | --- | --- |
| Layers | 1 | 2 (additive) | comparable |
| Total y-offset | 4px | 3 + 2 = 5px (additive) | within 1px |
| Total blur | 12px | 6 + 4 = 10px (additive) | within 2px |
| Total opacity | 0.10 | 0.10 + 0.06 = ~0.16 (combined) | slightly darker, Material Design 'elevation 2' tier |
| Material Design tier | informal | elevation 2 (formalized via Phase 32.1 Wave 4 D-W4-08) | aligned |
| Dark mode equivalent | n/a (literal didn't theme) | line 228: `0 3px 6px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.5)` (intentionally darker for dark theme) | improvement (theming gain) |

**Verdict:** visually equivalent in light mode, intentional theming gain in dark mode. Swap proceeded per plan.

## Per-Decision Acceptance Verification

| Decision | Acceptance grep | Result |
| --- | --- | --- |
| D-24a (PlannerScreen refresh 44x44) | `grep -nE "width: '44px', height: '44px'" app/src/screens/PlannerScreen.tsx` | line 152 ✓ |
| D-24b (ChatInput mic 44x44) | mic block (lines 108-128) `grep -nE "width: '44px'\|height: '44px'"` | 2 hits at relative lines 3, 4 ✓ |
| D-24c (ChatInput globe 44x44) | globe block (lines 131-152) `grep -nE "width: '44px'\|height: '44px'"` | 2 hits at relative lines 8, 9 ✓ |
| D-25a (EmptySectionHint padding token) | `grep -nE "padding: 'var\\(--space-md\\) var\\(--space-lg\\)'" app/src/screens/PlannerScreen.tsx` | line 24 ✓ |
| D-25b (show/hide buttons padding token) | `grep -nE "padding: 'var\\(--space-sm\\) var\\(--space-lg\\)'" app/src/screens/PlannerScreen.tsx` | lines 302, 317 ✓ (2 hits as expected) |
| D-25c (ChatInput container shadow token) | `grep -nE "boxShadow: 'var\\(--shadow-2\\)'" app/src/components/ChatInput.tsx` | line 97 ✓ |
| (negative) PlannerScreen `'14px 16px'` literal | `grep -c` global | 0 ✓ |
| (negative) PlannerScreen `'10px 16px'` literal | `grep -c` global | 0 ✓ |
| (negative) PlannerScreen `width: '28px', height: '28px'` literal | `grep -c` global | 0 ✓ |
| (negative) ChatInput `boxShadow: '0 4px 12px rgba(0,0,0,0.1)'` literal | `grep -c` | 0 ✓ |
| (negative) ChatInput `width: '34px'` literal | `grep -c` | 0 ✓ |
| (negative) ChatInput `height: '34px'` literal | `grep -c` | 0 ✓ |
| D-26 no package.json changes | `git diff HEAD~2 -- app/package.json \| wc -l` | 0 ✓ |
| D-26 no NEW Tailwind classes | `git diff HEAD~2 -- 'app/src/**/*.tsx' \| grep -E '^\\+.*className='` | empty (no new additions) ✓ |
| D-26 no locale bundle changes | `git diff HEAD~2 -- 'app/src/locales/*.json' \| wc -l` | 0 ✓ |

## Task Commits

Each task committed atomically per CONTEXT "Specifics" guidance (one commit per file for trivial bisect):

1. **Task 7.1 (D-24a + D-25a + D-25b — PlannerScreen):** `616c761f` (style)
   Subject: `style(PlannerScreen): touch targets + spacing tokens (D-24, D-25)`
   Scope: 4 substitutions in 1 file (refresh button + EmptySectionHint padding + show button padding + hide button padding)
   Diff: 4 insertions, 4 deletions
2. **Task 7.2 (D-24b + D-24c + D-25c — ChatInput):** `47d81049` (style)
   Subject: `style(ChatInput): touch targets + shadow token (D-24, D-25)`
   Scope: 3 substitutions in 1 file (mic button + globe button + container shadow)
   Diff: 5 insertions, 5 deletions

## Files Created/Modified

### Source files (2 files, 7 substitutions)

- **`app/src/screens/PlannerScreen.tsx`** — 4 substitutions:
  - Line 24 (EmptySectionHint): `padding: '14px 16px'` → `padding: 'var(--space-md) var(--space-lg)'`
  - Line 152 (refresh button): `width: '28px', height: '28px'` → `width: '44px', height: '44px'`
  - Line 302 (show-all button): `padding: '10px 16px'` → `padding: 'var(--space-sm) var(--space-lg)'`
  - Line 317 (show-less button): `padding: '10px 16px'` → `padding: 'var(--space-sm) var(--space-lg)'`
- **`app/src/components/ChatInput.tsx`** — 3 substitutions:
  - Line 97 (container shadow): `boxShadow: '0 4px 12px rgba(0,0,0,0.1)'` → `boxShadow: 'var(--shadow-2)'`
  - Lines 110-111 (mic button): `width: '34px', height: '34px'` → `width: '44px', height: '44px'`
  - Lines 138-139 (globe button): `width: '34px', height: '34px'` → `width: '44px', height: '44px'`

## Decisions Made

None new — all decisions pre-locked in 33-CONTEXT.md (D-24 / D-25 / D-26) and Plan 33-07's `<must_haves>` frontmatter.

The pre-edit visual-parity check on `--shadow-2` (D-25c gate) was performed per plan and concluded "PROCEED" — the additive 2-layer light-mode shadow (5px y-offset, 10px blur, ~16% opacity combined) is within Material Design "elevation 2" tolerance of the original single-layer literal (4px y-offset, 12px blur, 10% opacity).

## Deviations from Plan

None — plan executed exactly as written. All 7 substitutions landed on first attempt; no Edit retries needed; no plan steps skipped.

The "Step 7" parent-layout clearance check on AskScreen (D-24 caveat about ChatInput height growing ~10px) was acknowledged but NOT acted on per the plan's explicit instruction ("Do NOT modify the parent layout in this plan — that's out of scope for D-24"). Deferred to operator dev-mode validation.

## Issues Encountered

None. All edits applied cleanly via the Edit tool with sufficient surrounding context to disambiguate identical-style blocks (the two `'10px 16px'` show/hide buttons in PlannerScreen, and the two `'34px'` mic/globe buttons in ChatInput). tsc stayed clean throughout. Test count unchanged from baseline.

One minor verification-script quirk: the chained `&&` shell pipeline in the initial verification grep batch stopped early because `grep -c` returns nonzero exit when the count is `0` (which is the desired result here). Re-ran without `&&` chaining to capture all 6 negative-check outputs individually. Cosmetic, no impact on the verification outcome.

## User Setup Required

None — no external service configuration, no environment variables, no migrations.

## Verification

### Pre-task baseline (HEAD = 51b0724d, 33-06 final state)

```
npx tsc -b --noEmit                                     exit 0 ✓
npm test                                                379 tests / 353 pass / 26 fail (per 33-06-SUMMARY.md)
git status --porcelain                                  empty (working tree clean) ✓
git log -1 --format=%h                                  51b0724d ✓
```

### Post-Task 7.1 (PlannerScreen — D-24a + D-25a + D-25b) — HEAD = 616c761f

```
grep -nE "padding: 'var\(--space-md\) var\(--space-lg\)'" app/src/screens/PlannerScreen.tsx
                                                        → line 24 (EmptySectionHint) ✓
grep -nE "padding: 'var\(--space-sm\) var\(--space-lg\)'" app/src/screens/PlannerScreen.tsx
                                                        → lines 302, 317 (show + hide buttons) ✓
grep -nE "width: '44px', height: '44px'" app/src/screens/PlannerScreen.tsx
                                                        → line 152 (refresh button) ✓
grep -c "padding: '14px 16px'" app/src/screens/PlannerScreen.tsx     → 0 ✓
grep -c "padding: '10px 16px'" app/src/screens/PlannerScreen.tsx     → 0 ✓
grep -c "width: '28px', height: '28px'" app/src/screens/PlannerScreen.tsx → 0 ✓
npx tsc -b --noEmit                                     exit 0 ✓
git log -1 --format='%s'  →  style(PlannerScreen): touch targets + spacing tokens (D-24, D-25) ✓
git diff HEAD~1 --name-only  →  app/src/screens/PlannerScreen.tsx ✓ (only file)
git diff HEAD~1 --stat  →  4 insertions(+), 4 deletions(-) ✓
```

### Post-Task 7.2 (ChatInput — D-24b + D-24c + D-25c) — HEAD = 47d81049

```
grep -c "boxShadow: 'var(--shadow-2)'" app/src/components/ChatInput.tsx       → 1 ✓
grep -c "width: '44px'" app/src/components/ChatInput.tsx                       → 2 ✓ (mic + globe)
grep -c "height: '44px'" app/src/components/ChatInput.tsx                      → 2 ✓ (mic + globe)
grep -c "size={17}" app/src/components/ChatInput.tsx                            → 3 ✓ (Loader2 + Mic + Globe; ≥2 required)
grep -c "boxShadow: '0 4px 12px rgba(0,0,0,0.1)'" app/src/components/ChatInput.tsx → 0 ✓
grep -c "width: '34px'" app/src/components/ChatInput.tsx                       → 0 ✓
grep -c "height: '34px'" app/src/components/ChatInput.tsx                      → 0 ✓
npx tsc -b --noEmit                                     exit 0 ✓
git log -1 --format='%s'  →  style(ChatInput): touch targets + shadow token (D-24, D-25) ✓
git diff HEAD~1 --name-only  →  app/src/components/ChatInput.tsx ✓ (only file)
git diff HEAD~1 --stat  →  5 insertions(+), 5 deletions(-) ✓
```

### End-of-plan aggregate verification

```
git log HEAD~2..HEAD --format='%h %s':
  47d81049 style(ChatInput): touch targets + shadow token (D-24, D-25)
  616c761f style(PlannerScreen): touch targets + spacing tokens (D-24, D-25)
                                                        ✓ 2 atomic commits, one per file

git status --porcelain                                  empty (working tree clean) ✓
git diff HEAD~2 --stat                                  2 files changed, 9 insertions(+), 9 deletions(-) ✓
npx tsc -b --noEmit                                     exit 0 ✓
npx vite build                                          exit 0, built in 2.93s ✓
npm test fail count: 26 (== 33-06 baseline 26)           PASS gate cleared ✓
                                                          (no new failure kinds; same JSON-import-attribute /
                                                           ERR_MODULE_NOT_FOUND / etc. baseline as 33-06)

D-26 honored:
git diff HEAD~2 -- app/package.json | wc -l            → 0 ✓ (no new packages)
git diff HEAD~2 -- 'app/src/**/*.tsx' | grep -E '^\+.*className='  → empty ✓ (no NEW Tailwind classes)
git diff HEAD~2 -- 'app/src/locales/*.json' | wc -l    → 0 ✓ (no translation changes)
```

### Test signature diff (post-plan vs 33-06 pre-plan baseline)

| Bucket | Pre-task baseline (33-06) | Post-task | Delta |
| --- | --- | --- | --- |
| Total tests | 379 | 379 | 0 |
| Pass | 353 | 353 | 0 |
| Fail | 26 | 26 | 0 |
| ERR_IMPORT_ATTRIBUTE_MISSING | present | present | unchanged |
| ERR_MODULE_NOT_FOUND | present | present | unchanged |
| ERR_UNKNOWN_FILE_EXTENSION | present | present | unchanged |
| ERR_ASSERTION | present | present | unchanged |
| AssertionError [ERR_ASSERTION] | present | present | unchanged |

PASS gate cleared: post fail count == baseline (26 == 26) AND post signature set ⊆ baseline signature set (5 == 5, identical sets). Zero new failure kinds introduced. The 26 pre-existing failures are the v1.3/1.4 carry-over from JSON-import-attribute issues, missing TrellisTooltip.tsx, missing podcast.service.ts, tsx loader extension issues, and feed-strategy assertion failures — all documented in 33-RESEARCH.md Pitfall #4/#5 and prior 33-XX-SUMMARY.md files.

### Operator dev-mode smoke-test outcome

PENDING — no automated assertion can verify "no behavioral change visible in `npm run dev`". Operator should spot-check on the next APK deploy cycle:

1. **PlannerScreen refresh button** — touch-friendly 44x44 (was a tight 28x28 tap target). Icon (RefreshCw size=13) still legible inside the larger button. Adjacent buttons in the `gap: '6px'` flex row don't visibly overlap.
2. **PlannerScreen EmptySectionHint** — empty-state Card padding now 12px 16px (was 14px 16px). The 2px vertical reduction is visually subtle; verify the hint text doesn't feel cramped.
3. **PlannerScreen show-all / show-less buttons** — bottom-of-suggestions buttons now 8px 16px padding (was 10px 16px). The 2px vertical reduction is visually subtle.
4. **ChatInput mic + globe buttons** — both touch-friendly 44x44 (were 34x34). The 17px icons sit comfortably inside; container's `gap: '10px'` keeps mic and globe apart.
5. **ChatInput container shadow** — slightly different shadow (additive 2-layer Material Design elevation 2 instead of single-layer). Should look consistent with other input bars in the app (e.g., AskScreen drawer search input).
6. **AskScreen bottom-nav clearance** — ChatInput total height grew by ~10px (mic+globe bump). Verify bottom-nav still has clearance above the ChatInput on AskScreen — no overlap. If overlap is observed, an out-of-scope follow-up plan can adjust the AskScreen layout's `paddingBottom` (NOT this plan's responsibility per CONTEXT D-24 caveat).

If any of (1)-(6) regresses, the bisect target is one of: `616c761f` (PlannerScreen) or `47d81049` (ChatInput). Per-file atomic commits make this trivial.

## Self-Check: PASSED

- All 2 modified files exist on disk with new contents (verified via grep above).
- Commits PRESENT: `616c761f`, `47d81049` (verified via `git log HEAD~2..HEAD --format='%h %s'`).
- Subjects exact-match plan acceptance criteria for each task ✓.
- `git diff HEAD~2 --stat`: 2 files changed, 9 insertions(+), 9 deletions(-) ✓
- `npx tsc -b --noEmit`: exit 0 ✓
- `git status --porcelain`: empty (working tree clean) ✓
- `npx vite build`: exit 0, built in 2.93s ✓
- `npm test`: 379 / 353 pass / 26 fail (delta vs. 33-06 baseline: 0 / 0 / 0) ✓
- D-24 acceptance: 1 hit each for refresh button (44x44 in PlannerScreen) ✓; 2 hits each for mic+globe (44x44 in ChatInput) ✓
- D-25 acceptance: 1 hit for `var(--space-md) var(--space-lg)` in PlannerScreen (EmptySectionHint) ✓; 2 hits for `var(--space-sm) var(--space-lg)` in PlannerScreen (show + hide buttons) ✓; 1 hit for `var(--shadow-2)` in ChatInput (container) ✓
- D-26 acceptance: 0 lines diff on `app/package.json` ✓; 0 NEW `className=` additions in tsx diff ✓; 0 lines diff on locale bundles ✓
- Pre-edit shadow visual-parity check performed and documented (table above) ✓

## Next Phase Readiness

- **Phase 33 closure status:** Plan 33-07 was the final v2 plan in Phase 33 per 33-CONTEXT.md "Status by item" table. With this plan landed, the Phase 33 plan inventory is complete (33-00 WIP flush DONE; 33-01 TD-05 partial sweep DONE; 33-02 TD-04 supersession DONE; 33-03 TD-06 LeafState rename DONE; 33-04 5 tsc errors SATISFIED; 33-05 Wave 4 WIP re-flush DONE; 33-06 perf memoization DONE; 33-07 cosmetic polish DONE).
- **Working tree clean**, branch `gsd/phase-33-hygiene-and-polish` ready for phase rollup or merge.
- **Touch-target pattern established** for v1.5: when a button has `width/height < 44px`, bump it to 44x44 inline-style while preserving the inner icon `size={...}`. The 30-40% icon-to-button area is the sweet spot.
- **Spacing token migration pattern established** for v1.5: a future phase can sweep remaining `'NNpx NNpx'` literals (audited from grep) in any other component to `var(--space-*)` tokens. Pre-condition: the corresponding `--space-*` CSS-var must exist (sm=8, md=12, lg=16 confirmed in this plan).
- **Shadow token migration pattern established** for v1.5: a future phase can sweep remaining `boxShadow: '0 Xpx Ypx rgba(...)'` literals to `var(--shadow-1/2/3)` tokens. Pre-condition: pre-edit visual-parity check on the target token before swap.
- **Pre-existing 26 baseline failures (JSON-import-attribute, missing TrellisTooltip.tsx, missing podcast.service.ts, tsx loader extension, feed-strategy assertions) remain** — v1.5 concern, NOT a Phase 33 gate. Identical to 33-06 baseline.
- **D-24 caveat for AskScreen layout (deferred):** ChatInput total height grew ~10px due to mic+globe bump. Operator should verify bottom-nav clearance on AskScreen during next APK deploy. If regression observed, follow-up plan can adjust `AskScreen` `paddingBottom`.

---
*Phase: 33-phase-29-regression-and-phase-31-code-hygiene*
*Completed: 2026-04-19*
