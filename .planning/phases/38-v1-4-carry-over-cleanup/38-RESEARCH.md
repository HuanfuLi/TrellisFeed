# Phase 38: v1.4 Carry-Over Cleanup — Research

**Researched:** 2026-05-09
**Domain:** Documentation normalization + YouTube type-system refactor + device UAT
**Confidence:** HIGH (all findings verified directly from source files)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 3 plans, functional split:
  - `38-01-doc-cleanup-PLAN.md` — TECHDEBT-02 + 03 + 05
  - `38-02-youtube-short-removal-PLAN.md` — TECHDEBT-06
  - `38-03-device-uat-PLAN.md` — TECHDEBT-04
- **D-02:** Drop `short`/`video` distinction entirely. Render ALL YouTube content as `sourceType: 'video'` + `presentationStyle: 'video'`. No classifier, no API call, no thumbnail heuristic.
- **D-02a:** Video card uses `aspect-ratio: auto` driven by the thumbnail's natural dimensions (not a fixed 16:9 container).
- **D-02b:** Hybrid video interaction: tap thumbnail/iframe area = inline tap-to-play; tap title/teaser/open affordance = navigate to PostDetailScreen.
- **D-03:** UAT file at `38-HUMAN-UAT.md` in phase 38 dir; iOS + Android both required; single `result:` line per test with sub-checkpoints described in `expected:`.
- **D-04:** Project-wide `echolearn` sweep; bucket A (preserve, no edit), bucket B (annotate), bucket C (case-by-case). Audit table in 38-01-SUMMARY.md.

### Claude's Discretion

- Whether `style-assignment.ts` `STYLE_WEIGHTS` cleanup folds into Plan 38-02 or splits out — default: fold in.
- OS test order in 38-HUMAN-UAT.md — operator decides at test time.
- `git mv` vs delete-and-create for any echolearn-named file renames — preserve git blame.

### Deferred Ideas (OUT OF SCOPE)

- Server-side YouTube short detection proxy (HEAD redirect probe)
- Style-weight re-tuning after removing `short` (v1.5.x follow-up if mix feels off)
- Vertical-video thumbnail letterbox detection (image-processing complexity)
- iOS-specific UI bugs surfaced during device UAT (separate v1.5 phase items)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TECHDEBT-02 | `34-VALIDATION.md` flipped from `draft` to `validated`; `35-VALIDATION.md` normalized from `approved` to `validated` | Files located and exact YAML edits identified (see INV-2) |
| TECHDEBT-03 | Archived `v1.4-ROADMAP.md` Phase 36 entry has 36-14 + 36-15 plan bullets appended | Exact insertion point and format verified from neighboring phase entries (see INV-3) |
| TECHDEBT-04 | Phase 33's 2 deferred device tests run on physical device; results in `38-HUMAN-UAT.md` | Test specs extracted verbatim from `33-VERIFICATION.md`; canonical UAT shape verified from `37-HUMAN-UAT.md` (see INV-4) |
| TECHDEBT-05 | `echolearn_*` references audited project-wide; intentional occurrences preserved/annotated | Full audit table produced (see INV-5); 4 distinct surfaces found |
| TECHDEBT-06 | YouTube landscape-listed-as-short bug fixed by eliminating the short/video classifier | Complete blast radius mapped across 7 files + 4 test files; TypeScript impact documented (see INV-1) |
</phase_requirements>

---

## Phase Boundary

Phase 38 ships five parallel doc/code/UAT items that were explicitly deferred from v1.4. It does not change feed architecture, queue mechanics, or SM-2 scheduling. The YouTube short removal (TECHDEBT-06) is the only code change; it deletes dead classification code, merges the short post branch into the existing video branch, and generalizes the Phase 36 GAP-C tap-to-play emit from `sourceType === 'short'` to all `sourceType === 'video'` taps on the thumbnail area. The doc items (TECHDEBT-02/03/05) are YAML field edits and annotation passes. TECHDEBT-04 is a human operator task that produces `38-HUMAN-UAT.md`.

---

## Locked Decisions Recap

- Drop `short` from the type system; all YouTube content becomes `video`.
- `aspect-ratio: auto` from thumbnail natural dimensions (no fixed 16:9 or 9:16 container).
- Hybrid interaction: thumbnail tap = inline play + CONCEPT_EXPLORED emit; title/teaser tap = navigate to PostDetailScreen.
- Doc cleanup and YouTube code change are separate bisectable plans.
- UAT file lives in phase 38 dir matching Phase 37 pattern.
- echolearn sweep is project-wide with bucket A/B/C handling.

---

## Investigation Findings

### INV-1: TECHDEBT-06 Blast Radius — Complete `short` Touchpoint Map

#### 1a. Type definitions (`app/src/types/index.ts`)

Two union types reference `'short'`:

- **Line 474:** `export type PresentationStyle = 'image' | 'text-art' | 'image-less' | 'video' | 'short' | 'news' | 'suggestion';`
  - Action: remove `| 'short'` from the union.
- **Line 492:** `sourceType: 'recent' | 'related' | 'resurfaced' | 'starter' | 'mixed' | 'connection' | 'video' | 'short' | 'text-art' | 'news' | 'suggestion';` (field on `PostSnapshot`)
  - Action: remove `| 'short'` from this inline union.

TypeScript compilation impact: removing `'short'` from these unions makes any narrowed branch `case 'short':` or `=== 'short'` unreachable — tsc will error on those until they are removed. No switch statements on sourceType were found in the codebase; all narrowing uses `=== 'short'` (if/ternary). Removing those branches eliminates the tsc errors simultaneously.

#### 1b. `app/src/services/youtube.service.ts`

- **Lines 121–135:** `probePortrait(videoId, fallbackUrl): Promise<boolean>` — loads thumbnail image and checks `naturalHeight > naturalWidth`. This function must be DELETED entirely.
- **Lines 508–510:** (inside `fetchVideosForConceptBatch`)
  ```
  const isPortrait = await probePortrait(result.videoId, result.thumbnailUrl);
  const videoType = isPortrait ? 'short' : 'video';
  ```
  These two lines and the `await probePortrait(...)` call must be replaced with `const videoType = 'video';` (then `videoType` constant itself can be inlined away — set `sourceType: 'video'` and `presentationStyle: 'video'` unconditionally at lines 543–549).

Note: `youtube.service.ts` is a standalone service; it does not import concept-feed at all. The `probePortrait` function is only called from within this file (lines 509 and 128). Zero cross-file callers.

#### 1c. `app/src/services/concept-feed.service.ts`

Five sites requiring change:

1. **Line 85:** `VALID_SOURCE_TYPES` set — remove `'short'` from the `new Set([...])` literal.
2. **Lines 766–784:** `SHORT_QUERY_MODIFIERS` array and the `buildYoutubeQuery` `isShort: boolean` parameter. `buildYoutubeQuery` is called in 3 places:
   - Line 1037: `buildYoutubeQuery(conceptName, cycleNumber, false)` — already `false`; just drop the parameter.
   - Line 1082: `buildYoutubeQuery(conceptName, cycleNumber, true)` — inside the `shortAssignments` loop; this entire loop is deleted.
   - Line 1308: `buildYoutubeQuery(conceptName, validationCycle, a.style === 'short')` — in the pre-validation pass; simplify to `false` then drop the boolean parameter.
3. **Lines 820–826:** Assignment grouping block:
   ```ts
   const videoAssignments = assignments.filter(a => a.style === 'video');
   const shortAssignments = assignments.filter(a => a.style === 'short');
   ```
   Merge: `const videoAssignments = assignments.filter(a => a.style === 'video');` (one line only). The separate `shortAssignments` variable and its downstream loop (lines 1060–1113) are deleted.
4. **Lines 1060–1113:** The `for (const a of shortAssignments)` loop that constructs `'short'` posts — DELETE this entire loop. The existing video construction loop (lines ~1020–1060, `for (const a of videoAssignments)`) already handles the logic correctly for landscape video; it now applies to all YouTube content. The `short` post `contextLabel: 'Short'` becomes `contextLabel: 'Video from YouTube'` (or whatever the video loop already uses — confirm at code time).
5. **Lines 1288/1308:** Pre-validation pass filters `a.style === 'video' || a.style === 'short'` — simplify to `a.style === 'video'`. Cache key comment at line 793 (`key: '${conceptId}:${style}' where style is 'video'|'short'`) — update to remove `|'short'`.

Note: The `trellis_short_posts` localStorage key is used at line 1520 for caching short posts. After removal, this key becomes dead. Decision: the key should be removed from code (stop writing it); a one-time migration to read and delete stale data from localStorage is courteous but not blocking. Document in plan that `legacy-migration.service.ts` MAY be extended to clear `trellis_short_posts` on next boot, but this is a Bucket C discretionary call — the data is not surfaced anywhere after the `short` type is removed.

#### 1d. `app/src/services/style-assignment.ts`

- **Lines 18–25:** `STYLE_WEIGHTS` object — remove `short: 0.10` key. The weight sum test enforces `sum === 1.0` (within 0.001). After removing `short: 0.10`, the remaining weights sum to `0.90`. The weight must be redistributed. Per D-02's note (Claude's discretion, default: fold into 38-02): add `0.10` to `video`, making `video: 0.20`. This preserves total = 1.0 and the CLAUDE.md note that "YouTube share kept at 25% total" becomes "YouTube share is now 20% total" — an acceptable adjustment since `short` was half the original 25%.
- **Lines 50–53:** The `if (!availability.hasYoutubeKey)` block references `weights.short` — update to remove the `+ weights.short` and `weights.short = 0` lines. After `short` is gone from STYLE_WEIGHTS, these lines become dead code.
- **Line 130:** `reassignFailures` — `a.style === 'video' || a.style === 'short' || a.style === 'news'` — remove `|| a.style === 'short'`.

#### 1e. `app/src/components/InfoFlow.tsx`

This is the most complex change. Key sites:

- **Line 80:** `const isShortPost = post.sourceType === 'short';` — DELETE this line.
- **Lines 89–96:** `imageResolved` initializer — remove `|| isShortPost` and `|| presentationStyle === 'short'` branches.
- **Line 108:** `if (isSuggestion || isVideoPost || isShortPost || isNewsPost) return;` — remove `|| isShortPost`.
- **Line 136:** dependency array — remove `isShortPost`.
- **Lines 156–164:** `wouldRenderVisual` block — remove `isShortPost` from the condition.
- **Lines 298–329:** The `interactive` / `handleActivate` / outer-div style block is currently gated by `!isShortPost`:
  ```tsx
  const interactive = !isShortPost;
  ```
  After deletion, ALL video posts become interactive (they navigate on card tap, except when the thumbnail area specifically intercepts). The outer div should have `role="button"`, `onClick={handleActivate}`, etc. for all non-suggestion posts — i.e., `const interactive = !isSuggestion;` (or the existing pattern minus the `isShortPost` guard).
- **Lines 318–328:** Multiple `isShortPost ? ... : ...` ternaries in inline styles for `padding`, `background`, `cursor` — remove the short branch, use the video/non-short defaults.
- **Lines 423–551 (D-02b merge):** The entire `{isShortPost && post.videoMeta?.videoId && ( ... )}` block is the Phase 36 GAP-C short tap-to-play section. This must be:
  1. Removed as a separate block for `isShortPost`.
  2. The tap-to-play emit logic (markExplored + CONCEPT_EXPLORED) migrated into the video card's thumbnail `onClick` (lines 373–419). Currently the video thumbnail onClick at lines 373–377 only calls `setVideoPlaying(post.id)` — it must now also run the GAP-C emit sequence.
  3. The `handleActivate` (navigate to PostDetailScreen) must move to the title/teaser area, not the entire card.
- **Line 596:** `{!isVideoPost && !isShortPost && image && ...}` — change to `{!isVideoPost && image && ...}` (remove `!isShortPost`).
- **Line 603:** `{!isShortPost && ( ...` hook/channel/preview section — change to render for all non-short (now all video posts): `{isVideoPost ? null : ( ...` or simply always render this section (the image/text-art/news/suggestion posts all need it; video posts already omit it because the block is gated differently).
- **Line 961:** `minHeight: item.post.presentationStyle === 'video' || item.post.presentationStyle === 'short' ? '320px' : 'auto'` — remove the `|| item.post.presentationStyle === 'short'` arm.

**D-02a aspect-ratio implementation:** The video card iframe container currently uses `aspectRatio: '16 / 9'` (line 336). For D-02a (auto from thumbnail), this needs to be CSS `aspect-ratio: auto` driven by thumbnail natural dimensions. The practical approach:
- The thumbnail `<img>` already exists in the "before playing" state (lines 380–383). Its `naturalWidth`/`naturalHeight` are available after `onLoad`.
- Use an `onLoad` handler on the thumbnail img to read `e.currentTarget.naturalWidth` and `e.currentTarget.naturalHeight`, then set a local state `[thumbRatio, setThumbRatio]` initialized to `undefined`. The iframe/playing container uses `aspectRatio: thumbRatio ? `${thumbRatio}` : '16 / 9'` as a fallback.
- Simpler alternative: CSS `aspect-ratio: auto 16/9` with an `<img>` inside — browsers calculate natural ratio from the img element in `aspect-ratio: auto`. This is a pure CSS solution with no JS state. Supported in all modern browsers including Android Chromium 98+.

Recommendation: Use CSS `aspect-ratio: auto` on the container + let the `<img>` provide the intrinsic size. Zero JS state needed. The iframe playing state falls back to the detected thumbnail ratio. Plan 38-02 should verify this renders correctly on the simulator.

#### 1f. `app/src/screens/PostDetailScreen.tsx`

- **Line 289:** `if (post.sourceType === 'short') return;` — DELETE. After this deletion, all video posts (including former shorts) will enter the on-enter streaming flow. Since shorts already set `bodyMarkdown: ''`, the streaming path for them was previously blocked by this guard. Removing the guard is correct — video posts already have `bodyMarkdown: ''` and defer to on-open streaming for essay content.
- **Lines 589–601 (video render branch):** Detector D postMessage handler — STAYS UNCHANGED per D-02b. All videos now reach PostDetailScreen via the title/teaser tap path.

#### 1g. i18n bundles

- `app/src/locales/en.json` line 730: `"shortTag": "Short"` — DELETE this key from all 4 bundles (en/zh/es/ja). All 4 bundles have the key at line 730 under `infoFlow.shortTag`. The `t('infoFlow.shortTag')` call at InfoFlow.tsx line 520 is inside the short card block being deleted.
- After deletion, run `bundle-parity.test.mjs` to confirm 4-way key parity.

#### 1h. Test strategy for TECHDEBT-06

Files to UPDATE or RENAME:

1. **`app/tests/components/InfoFlow.short-tap-emit.test.mjs`** — This test currently guards:
   - Phase 36 GAP-C comment presence in the short tap branch.
   - `dailyReadService.markExplored` called exactly once (in short branch only).
   - `CONCEPT_EXPLORED` event emitted exactly once.
   - Import assertions.
   
   After the merge, the file should be RENAMED to `InfoFlow.video-tap-emit.test.mjs`. All 4 assertions need updating:
   - Replace `'Phase 36 GAP-C'` comment check with a check for the comment in the VIDEO branch.
   - `markExplored` still called exactly once — assertion holds (now in video thumbnail onClick).
   - `CONCEPT_EXPLORED` still emitted exactly once — assertion holds.
   - Import assertions unchanged.

2. **`app/tests/services/style-assignment.test.mjs`** — Multiple assertions reference `'short'`:
   - Line 20: `validStyles` set — remove `'short'`.
   - Lines 67–74: "no video/short" test — update to "no video" (single style check).
   - Lines 70, 73: comment mentions `0.10+0.15 = 0.25 extra` and `40% + 25% = 65%` — update arithmetic to `video: 0.10` being absorbed into text-art (or whatever the new redistribution is).
   - Lines 100, 110: `reassignFailures` test uses `{ conceptId: 'd', style: 'short' }` as a failed style — update to another style (e.g., `'video'`) since `'short'` no longer exists.
   - Line 116: `STYLE_WEIGHTS sum to 1.0` — this assertion will still pass after `short` is removed and `video` absorbs the weight.

3. **`app/tests/services/style-assignment-stratified.test.mjs`** — Lines 11, 58, 74, 77:
   - Line 11: `c` counter object includes `short: 0` — remove.
   - Line 58: `valid` set includes `'short'` — remove.
   - Lines 74, 77: `hasYoutubeKey=false: video+short count is 0` — update to `video count is 0`.

4. **`app/tests/services/refill-queue-integration.test.mjs`** line 120: `makePost('b4', ['B'], 'short')` — change to `'video'` or `'text-art'`. This is a test fixture, not a behavior assertion about short.

5. **`app/tests/concept-quota.test.mjs`** lines 48–52: `for (const sourceType of ['video', 'short', 'news'])` — remove `'short'` from the array.

6. **`app/tests/services/post-essay.service.test.mjs`** line 20: asserts `source.includes('trellis_short_posts')` in `post-essay.service.ts`. After removal of the short cache, `trellis_short_posts` will no longer appear in `post-essay.service.ts`. This test assertion must be DELETED (the entire assertion at line 20).

NEW test to add:

- **`app/tests/services/youtube-no-short-classification.test.mjs`** — source-reading invariant test asserting:
  1. `probePortrait` does not appear anywhere in `youtube.service.ts` (function deleted).
  2. The string `'short'` does not appear as a `sourceType` value in `concept-feed.service.ts` (the literal `sourceType: 'short'` is gone).
  3. The string `'short'` does not appear as a `presentationStyle` value in `concept-feed.service.ts`.
  4. `STYLE_WEIGHTS` in `style-assignment.ts` does not contain the key `'short'` (grep for `short:`).

#### 1i. TypeScript compilation cascade

After the changes above, `tsc -b --noEmit` should exit 0. The narrowing sites that will become errors IF NOT deleted simultaneously:
- `PostDetailScreen.tsx:289` — `post.sourceType === 'short'` will be a TS2367 error ("this condition will always be false") once `'short'` is removed from the union. Must be deleted in the same commit.
- `InfoFlow.tsx:80` — `post.sourceType === 'short'` same error. Must be deleted.
- `concept-feed.service.ts:1101` — `sourceType: 'short'` will be a type error (not assignable to the union). Must be removed with the short post construction loop.
- Any remaining `style === 'short'` in style-assignment.ts will not cause TS errors (the style field is typed `PresentationStyle` which won't include `'short'` after the union edit) — these would be errors too. All must be deleted in the same commit.

Plan 38-02 should be structured as ONE atomic commit removing the type, ONE atomic commit removing all usage sites, to enable bisection of a hypothetical tsc regression.

---

### INV-2: TECHDEBT-02 — Exact VALIDATION Drift Edits

#### `34-VALIDATION.md`

**Path:** `.planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md`

Current frontmatter (lines 1–8):
```yaml
---
phase: 34
slug: v1-4-close-out-verification-debt-and-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---
```

Required edit — three fields:
```yaml
status: validated
nyquist_compliant: true
wave_0_complete: true
```

Rationale: Phase 34 VERIFICATION.md shows `status: passed`, `score: 8/8 must-haves verified`. The VALIDATION.md frontmatter was never flipped at phase close (documented carry-over in v1.4-ROADMAP.md "Tech debt carried to v1.5"). The `nyquist_compliant: true` is justified because the Validation Sign-Off checklist body says `"flip on Phase 34 verifier pass"` — that pass happened.

#### `35-VALIDATION.md`

**Path:** `.planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md`

Current frontmatter (lines 1–8):
```yaml
---
phase: 35
slug: fix-the-dynamic-system-prompt-issue
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-29
reconstructed_from: SUMMARY artifacts (State B — no VALIDATION.md existed at planning time; phase ran with --skip-research)
---
```

Required edit — one field:
```yaml
status: validated
```

(`nyquist_compliant: true` and `wave_0_complete: true` are already correct.)

Rationale: `approved` is a non-standard status value (State B reconstruction artifact per the frontmatter note). v1.4-ROADMAP.md "Tech debt carried" section explicitly flags this. The canonical status used by Phase 37 and the Nyquist gate is `validated`. No other fields change.

---

### INV-3: TECHDEBT-03 — v1.4-ROADMAP.md Phase 36 Plan Bullets

**Path:** `.planning/milestones/v1.4-ROADMAP.md`

Current Phase 36 entry (lines 90–96):
```markdown
### Phase 36: gap closure on curiosity feed randomness and weights

**Goal:** Close four divergences...
**Plans:** 16/16 across 4 rounds (round-4 close-out 2026-05-07: vine progress chip resync + warm-start re-fallback + handleForceNewDay symmetric two-cache mutation)
**Verification:** 16/16 round-4 must-haves verified (36-VERIFICATION.md)
**Outputs:** Persistent derivedList + cyclePosition (GAP-1+2), stratified style allocation (GAP-3), spreadByConcept mixer (GAP-4), Promise-mutex refill, durable yesterday-snapshot, dev "Force new day" affordance, always-mounted screen state-resync principle, Detector D for video completion + InfoFlow short tap-to-play emit
**Status:** ✅ SHIPPED
```

The Phase 36 entry has NO `**Plans:**` bullet list like Phase 29 (`Plans: 4/4`) or Phase 33 (`Plans: 8/8`) — it lists a plan count inline in the `**Plans:**` line but does not enumerate 36-01 through 36-15 in a bullet list. Looking at other entries (e.g., Phase 33 does not have a bullet list either), the convention is just the count field.

The CONTEXT.md D-03 requirement is: "append 36-14 + 36-15 plan bullets in the plan list (not just the carry-over footer)."

Looking at the "Tech debt carried to v1.5" section (lines 112–118), Plans 36-14 and 36-15 are mentioned by name in the "Decisions of note" section (lines 109–110):
- Line 109: Always-mounted screen state-resync principle (36-14)
- Line 110: Force-New-Day handler symmetric two-cache mutation (36-15)

These are mentioned in the Decisions section, NOT in the Phase 36 entry's plan count area. The fix: update the `**Plans:**` line in the Phase 36 entry to expand its note about round-4 to name plans 36-14 and 36-15 explicitly:

```markdown
**Plans:** 16/16 across 4 rounds (round-4 close-out 2026-05-07; plans 36-14 + 36-15 added in round-4: vine-progress chip resync + warm-start re-fallback / handleForceNewDay symmetric two-cache mutation)
```

This is a one-line text edit on line 93 of the archived file. The CONTEXT.md says "append 36-14 + 36-15 plan bullets in the plan list" — interpreting "plan list" as the `**Plans:**` line, since there is no separate bullet list for individual plan names in this roadmap format.

---

### INV-4: TECHDEBT-04 — Phase 33 Device Test Specs

Source: `.planning/milestones/v1.4-phases/33-phase-29-regression-and-phase-31-code-hygiene/33-VERIFICATION.md` frontmatter `human_verification` section (lines 8–14).

#### Test 1: Touch-target feel (33-HUMAN-UAT-1)

```
test: "On-device APK smoke-test for cosmetic touch-target changes"
expected: "Refresh button (PlannerScreen) and mic/globe buttons (ChatInput) are comfortably tappable at 44x44; AskScreen bottom-nav clearance not violated by ChatInput height increase (~10px)"
why_human: "Visual and interaction quality cannot be verified from grep/tsc alone; Capacitor APK deploy required"
```

From the 34-VALIDATION.md `Manual-Only Verifications` table (more detailed version):
- Screen: PlannerScreen (refresh button) + ChatInput (mic, globe)
- Action: Deploy APK; tap each button; record "comfortable / cramped / missed" outcome
- iOS + Android both

#### Test 2: React.memo behavioral correctness (33-HUMAN-UAT-2)

```
test: "Perf memoization behavioral correctness on live feed"
expected: "Feed renders 8 cards correctly; swipe-for-more pops 4 new posts; VineProgress spans full container; image-gen toggle still respected for NEW card mounts"
why_human: "React.memo with custom equality comparator — correctness for animation paths and internal state changes requires runtime verification in a browser/APK"
```

From 34-VALIDATION.md `Manual-Only Verifications`:
- Sub-checkpoints (4): 8-card render / swipe-for-more pops 4 new posts / image-gen toggle / VineProgress full-width
- These are the `expected:` block items per D-03; NOT split into separate YAML entries.
- Why Android is important: React.memo with custom equality comparators, combined with Android Chromium WebView's rendering quirks, is the likeliest surface for missed re-renders.

#### Canonical 38-HUMAN-UAT.md shape

From `37-HUMAN-UAT.md`:
```yaml
---
status: complete
phase: 37-i18n-leaf-module-refactor
source: [37-VERIFICATION.md]
started: 2026-05-08T00:00:00Z
updated: 2026-05-08T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Locale switch UAT (TECHDEBT-01 Goal 4)
expected: Boot the app...
result: pass

## Summary

total: 1
passed: 1
...
```

Phase 38's file follows the same shape. Two tests, each with `expected:` (multi-line, covers sub-checkpoints for test 2) and a single `result:` line (pass/fail with optional failure note). Status starts as `pending` and `started:` is filled in when operator begins device testing.

---

### INV-5: TECHDEBT-05 — echolearn Project-Wide Audit

Audit scope: `app/src/`, `app/tests/`, `.planning/` (active phases only — archived v1.4-phases are treated as immutable historical record).

#### Bucket A — Intentional backwards-compat, NO EDIT

| Location | Occurrence | Reason |
|----------|------------|--------|
| `app/src/services/db.service.ts:34,38,40,41` | `'echolearn'` SQLite connection name (4 literals) | Explicitly preserved per CLAUDE.md "Brand history" paragraph. Changing would orphan existing users' databases. |
| `app/src/services/legacy-migration.service.ts:4,5,9,14,18` | `echolearn` in comments + `LEGACY_PREFIX = 'echolearn_'` constant | This IS the migration service. Its entire purpose is to handle the `echolearn_*` → `trellis_*` migration. Renaming these would break the migration. |
| `app/src/main.tsx:21` | Comment: `// Migrate pre-rebrand echolearn_* localStorage keys...` | Accurate historical annotation. No edit needed. |
| `CLAUDE.md:5` | "Brand history" paragraph mentioning `'echolearn'` SQLite name and `~/.claude/projects/-Users-Code-EchoLearn/` path | Already carries the explicit brand-history annotation. Satisfies TECHDEBT-05 ROADMAP criterion. |
| `CLAUDE.md:380,436` | `~/.claude/projects/-Users-Code-EchoLearn/memory/...` path references | Auto-memory path is keyed to on-disk directory name (cannot change without losing memory continuity). Intentional. |
| `.planning/milestones/v1.4-phases/**` (all) | All `echolearn` occurrences in v1.4 archive | Immutable historical record. No edits to archived phases. |

#### Bucket B — Pure doc drift, ANNOTATE or CLEAN

| Location | Occurrence | Action |
|----------|------------|--------|
| `app/tests/services/legacy-migration.test.mjs:19-56` | `echolearn_settings`, `echolearn_post_queue` as test fixture keys | These are CORRECT — they test the migration service which reads `echolearn_*` keys. No edit needed; they are accurate test fixtures for the migration path. Reclassified to Bucket A. |
| `app/tests/services/starter-posts.test.mjs:57,59,60,68` | `'Welcome to EchoLearn'`, `EchoLearn is your AI-powered learning companion`, etc. in STARTER_POSTS content strings | These are the starter post body text (user-facing content). The rebrand changed the app name but these starter post hardcoded strings were NOT updated in the v1.4 rebrand commit. **Bucket B — fix:** update "EchoLearn" → "Trellis" in these starter post test fixture strings. Cross-check against `concept-feed.service.ts` `STARTER_POSTS` to ensure test fixtures match production strings. |
| `.planning/research/PITFALLS.md:201-215` | `echolearn_post_history`, `echolearn_engagement_*`, `echolearn` SQLite connection references | These are planning research notes about the rebrand pitfall. The references are illustrative (documenting the pitfall). They should carry a `(historical: pre-2026-05-07 brand, key migrated to trellis_*)` annotation where they discuss keys that have already been migrated, to avoid confusing future agents. **Bucket B — annotate.** |

#### Bucket C — Surprises, case-by-case at execute time

| Location | Occurrence | Flag |
|----------|------------|------|
| `app/tests/services/post-essay.service.test.mjs:20` | `assert.ok(source.includes('trellis_short_posts'), ...)` | Not `echolearn_*` but the `trellis_short_posts` storage key will become dead after TECHDEBT-06. This assertion must be DELETED in Plan 38-02 (not Plan 38-01). Cross-plan dependency: 38-01 doc pass should NOT touch this file; 38-02 handles it. |
| `concept-feed.service.ts:1520` | `localStorage.getItem('trellis_short_posts')` | Dead storage key after short removal. Decision: remove from code (stop reading). Consider emitting a one-time delete in `legacy-migration.service.ts` to clean up stale user data. |

**Summary:** The CLAUDE.md occurrence already has a brand-history annotation (Bucket A). The main actionable Bucket B item is the starter post test fixture strings that still say "EchoLearn" instead of "Trellis". The planning research notes need an annotation pass. No Bucket C surprises require blocking decisions.

---

### INV-6: Phase 36 GAP-C Generalization — Exact Code Shape

#### Current short tap handler (InfoFlow.tsx lines 423–551)

The existing `{isShortPost && post.videoMeta?.videoId && ( ... )}` block contains the complete Phase 36 GAP-C tap-to-play emit:

```tsx
onClick={(e) => {
  if (videoPlaying !== post.id) {
    e.stopPropagation();
    setVideoPlaying(post.id);
    try {
      const allQ = questionService.getAll({ includeFlagged: true });
      const byId = new Map(allQ.map(q => [q.id, q]));
      const anchorId = getAnchorIdForPost(post, byId);
      if (anchorId && !dailyReadService.isExplored(anchorId)) {
        dailyReadService.markExplored(anchorId);
        eventBus.emit({ type: 'CONCEPT_EXPLORED', payload: { anchorId } });
      }
    } catch (err) {
      console.warn('[InfoFlow] short tap-to-play emit failed:', err);
    }
  }
}}
```

#### Current video card thumbnail handler (InfoFlow.tsx lines 373–377)

```tsx
onClick={(e) => {
  e.stopPropagation();
  setVideoPlaying(post.id);
}}
```

No CONCEPT_EXPLORED emit — video posts use Detector D (PostDetailScreen postMessage) for deep engagement, and the full PostDetailScreen Detectors B/C for Q&A follow-up. Under D-02b, the thumbnail tap now also needs the GAP-C emit because some videos will play inline and never navigate to PostDetailScreen.

#### D-02b migration plan

The correct merged video card structure after Plan 38-02:

1. **Thumbnail area onClick** (the `<div onClick>` wrapping the thumbnail img at line 373): Add the full GAP-C emit sequence (copy from short handler). Update `console.warn` tag to `'[InfoFlow] video tap-to-play emit failed:'`.

2. **Title/teaser/open affordance** (hook, preview, channel attribution — currently at lines 603+): These elements need a dedicated `onClick` that calls `handleActivate()` (navigate to PostDetailScreen). Currently `handleActivate` is the card-level `onClick` handler. After D-02b:
   - Card-level `onClick` is REMOVED (or becomes a no-op).
   - Title/teaser container gets its own `onClick={() => handleActivate()}` with `cursor: 'pointer'`.
   - Thumbnail container gets its own `onClick` for inline play + emit.

3. **CLAUDE.md rule 3 ("Don't add a duplicate emit in the InfoFlow video card onClick")**: This rule was written to protect against doubling the emit. After D-02b, the emit is in the THUMBNAIL onClick, not the card-level onClick. The spirit of the rule is preserved (no double-emit). The rule itself must be UPDATED in CLAUDE.md to say the emit now fires from the thumbnail onClick for ALL `sourceType === 'video'` posts (not just `sourceType === 'short'`). This is a CLAUDE.md edit that belongs in Plan 38-02 or Plan 38-01.

4. **Detector D (PostDetailScreen.tsx)**: Unchanged. Users who tap the title/teaser navigate to PostDetailScreen and Detector D handles the postMessage completion signal for deep engagement. Users who tap the thumbnail get the tap-to-play emit immediately. Both paths are now available for all video posts.

5. **CLAUDE.md "Phase 36 GAP-C" section**: The Detector inventory table must be updated — row for "Short tap-to-play emit" at `InfoFlow.tsx` generalizes from `sourceType='short'` to `sourceType='video'` with `thumbnail tap target`. The rule about `interactive=false` for shorts (it was `interactive=false` at ConceptCard line 295, now removed) needs updating: video posts ARE interactive (navigate on title/teaser tap), but the thumbnail area intercepts the click for inline play. Note the rule transition in Plan 38-02.

---

### INV-7: Test Strategy per Requirement

| Requirement | Test Strategy | Automated? |
|-------------|--------------|------------|
| TECHDEBT-02 | `grep "^status: validated" .planning/milestones/v1.4-phases/{34,35}-*/*-VALIDATION.md` — expect 2 hits | Yes — grep |
| TECHDEBT-03 | `grep "36-14\|36-15" .planning/milestones/v1.4-ROADMAP.md` — expect hits in Phase 36 entry (not just Decisions section) | Yes — grep |
| TECHDEBT-04 | `test -f .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md && grep -c "result: pass" 38-HUMAN-UAT.md` — expect 2 | Yes — file presence + grep |
| TECHDEBT-05 | `grep -rn "echolearn" app/src/services/ --include="*.ts"` — only `db.service.ts` and `legacy-migration.service.ts` return hits; no new `echolearn_*` localStorage keys in non-migration code | Yes — grep |
| TECHDEBT-06 code | `node --test tests/services/youtube-no-short-classification.test.mjs` — 4 source-reading assertions | Yes — automated |
| TECHDEBT-06 manual | Manual feed visual check: video posts render at thumbnail-driven aspect ratio; tapping thumbnail plays inline; tapping title navigates to detail | No — manual smoke test |

**Test baseline preservation:**
Phase 37 close-out baseline: `test:main 558/555/3 + test:actions 16/14/2`. Phase 38 must not introduce new failures. Plan 38-02 will:
- DELETE `InfoFlow.short-tap-emit.test.mjs` (4 cases) — net loss from pass count.
- RENAME/REPLACE it with `InfoFlow.video-tap-emit.test.mjs` (4 cases) — net zero.
- UPDATE style-assignment tests (removing `'short'` from valid-styles set, etc.) — tests that previously checked short-specific behavior are replaced with equivalent video checks.
- DELETE `post-essay.service.test.mjs:20` assertion — reduces pass count by 1 within that file.
- ADD `youtube-no-short-classification.test.mjs` — 4 new assertions; net +4 to pass count.

Expected net: pass count changes are neutral to slightly positive (no regressions). Fail count must stay ≤3.

---

### INV-8: TypeScript / Build Impact Summary

Dropping `'short'` from `PresentationStyle` and `PostSnapshot.sourceType` unions causes TS errors at EVERY `=== 'short'` narrowing site unless that site is deleted simultaneously. The affected sites are:

| File | Line | Error Type | Resolution |
|------|------|------------|------------|
| `PostDetailScreen.tsx` | 289 | TS2367 — always false | DELETE the if-guard |
| `InfoFlow.tsx` | 80 | TS2367 — always false | DELETE `isShortPost` declaration |
| `InfoFlow.tsx` | 92 | TS2367 — always false | DELETE `|| presentationStyle === 'short'` |
| `concept-feed.service.ts` | 1101 | TS2322 — not assignable | DELETE the short post construction loop |
| `concept-feed.service.ts` | 1107 | TS2322 — not assignable | Deleted in same loop |
| `style-assignment.ts` | 24 | TS7053 — no key `short` in STYLE_WEIGHTS | DELETE `short: 0.10` |
| `style-assignment.ts` | 51–53 | TS7053 | DELETE `weights.short` references |
| `style-assignment.ts` | 130 | TS2367 — `a.style === 'short'` always false | DELETE the arm |

All must be removed in Plan 38-02's commits. The recommended commit sequence:
1. Edit types/index.ts unions (triggers tsc errors).
2. Remove all usage sites (resolves tsc errors).
3. `tsc -b --noEmit` exits 0.

No cascade failures into other non-listed files were found — the narrowing sites above cover 100% of `=== 'short'` occurrences in `app/src/`.

---

## Risks & Pitfalls

### Pitfall 1: Partial short removal leaves TS errors

If Plan 38-02 removes the type union (types/index.ts) in one commit but defers removal of usage sites to a later commit, `tsc` will fail between commits. Mitigation: all usage-site removals land in the same commit as the type union edit, OR the type union edit is the LAST commit (after all usage sites are already removed). The second order is safer for CI-continuous builds.

### Pitfall 2: D-02b event duplication after merge

The new video card has BOTH a thumbnail onClick (emit + inline play) AND a title onClick (navigate). If the parent card div retains a top-level `onClick`, three handlers fire on thumbnail tap: parent card, thumbnail div, any child elements. Use `e.stopPropagation()` on the thumbnail onClick to prevent bubble to the card level. The existing video card already uses `e.stopPropagation()` on the thumbnail click (line 375) — preserve this.

### Pitfall 3: STYLE_WEIGHTS sum invariant

After removing `short: 0.10`, the weights must still sum to 1.0. Adding 0.10 to `video` (making `video: 0.20`) preserves the sum. The existing test `'STYLE_WEIGHTS sum to 1.0'` will catch any arithmetic error. The test comment in `style-assignment.test.mjs` line 70 references "0.10+0.15 = 0.25 extra" — this comment is wrong already (the actual weights are `video: 0.10, short: 0.10` = 0.20 combined, not 0.25); update the comment as part of the style-assignment.test.mjs edits.

### Pitfall 4: starter-posts test strings still say "EchoLearn"

The `app/tests/services/starter-posts.test.mjs` file has hardcoded string expectations that include "EchoLearn" (lines 57, 59, 60, 68). If `concept-feed.service.ts`'s STARTER_POSTS were updated in the rebrand but the tests were not, the tests are passing against incorrect fixtures. Check `concept-feed.service.ts` STARTER_POSTS strings before editing the test fixtures. If both production code AND test fixtures say "EchoLearn", they are consistent (both wrong but consistent — flagging the discrepancy is enough for Plan 38-01).

### Pitfall 5: archived v1.4-ROADMAP.md is immutable except for the 36-14/36-15 edit

The v1.4-ROADMAP.md is in `.planning/milestones/` (archived). Only the targeted Phase 36 `**Plans:**` line update should be made. Do not touch other sections or "improve" formatting. The file was archived as-is; any structural changes create a confusing diff.

### Pitfall 6: 38-HUMAN-UAT.md must not be created as "complete" pre-testing

The UAT file starts with `status: pending`. Only the operator updates it to `status: complete` after running physical device tests. Plan 38-03's job is to create the file with the correct structure and `status: pending` — NOT to fill in `result:` lines.

### Pitfall 7: post-essay.service.ts `trellis_short_posts` reference

`post-essay.service.ts` likely contains a patch call for `trellis_short_posts` (confirmed by the test at line 20 that asserts its presence). After TECHDEBT-06 removes the short post type, this patch call becomes dead code. Removing it from `post-essay.service.ts` also requires deleting the test assertion at `post-essay.service.test.mjs:20`. Both must happen in Plan 38-02 — not Plan 38-01.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` (Node 25.x) |
| Config file | `app/package.json` — `"test:main": "node --test tests/**/*.test.mjs"` |
| Quick run command | `cd app && node --test tests/services/youtube-no-short-classification.test.mjs` (for TECHDEBT-06) |
| Full suite command | `cd app && npm test` |
| Type check | `cd app && npx tsc -b --noEmit` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| TECHDEBT-02 | `34-VALIDATION.md status: validated` | grep | `grep "^status: validated" .planning/milestones/v1.4-phases/34-*/34-VALIDATION.md` | 1 hit expected |
| TECHDEBT-02 | `35-VALIDATION.md status: validated` | grep | `grep "^status: validated" .planning/milestones/v1.4-phases/35-*/35-VALIDATION.md` | 1 hit expected |
| TECHDEBT-03 | 36-14 + 36-15 bullets in Phase 36 entry | grep | `grep "36-14\|36-15" .planning/milestones/v1.4-ROADMAP.md` | Hits must be inside the Phase 36 entry block |
| TECHDEBT-04 | `38-HUMAN-UAT.md` exists with 2 test entries | file presence | `test -f .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` | Created by Plan 38-03 |
| TECHDEBT-04 | Both device results recorded as pass | grep | `grep -c "result: pass" .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` | 2 expected (human fills in) |
| TECHDEBT-05 | No stale `echolearn_` in non-migration source | grep | `grep -rn "echolearn_" app/src/services/ --include="*.ts" | grep -v "legacy-migration\|db.service"` — zero hits | |
| TECHDEBT-06 | `probePortrait` absent | source-read | `youtube-no-short-classification.test.mjs` test 1 | New test |
| TECHDEBT-06 | `sourceType: 'short'` absent | source-read | `youtube-no-short-classification.test.mjs` test 2 | New test |
| TECHDEBT-06 | `STYLE_WEIGHTS.short` absent | source-read | `youtube-no-short-classification.test.mjs` test 4 | New test |
| TECHDEBT-06 | `markExplored` called in video thumbnail onClick | source-read | Updated `InfoFlow.video-tap-emit.test.mjs` | Renamed from short-tap-emit |
| TECHDEBT-06 | No new tsc errors | static analysis | `cd app && npx tsc -b --noEmit` | Exit 0 required |

### Sampling Rate

- **Per task commit (Plan 38-02):** `cd app && npx tsc -b --noEmit` (every commit; catches any TS cascade from type union removal)
- **After Plan 38-02 completion:** `cd app && npm test` (full suite; verify ≤3 failures, same baseline)
- **Phase gate for /gsd:verify-work:** Full suite green + tsc clean + `38-HUMAN-UAT.md` exists with `result: pass` entries

### Wave 0 Gaps (new test files needed)

- [ ] `app/tests/services/youtube-no-short-classification.test.mjs` — 4 source-reading assertions (probePortrait absent, sourceType short absent, presentationStyle short absent, STYLE_WEIGHTS.short absent)
- [ ] `app/tests/components/InfoFlow.video-tap-emit.test.mjs` — rename + update of existing `InfoFlow.short-tap-emit.test.mjs`

---

## Open Questions

None — all decisions locked in CONTEXT.md.

For plan-time reference: the starter-posts test fixture strings ("Welcome to EchoLearn") in `app/tests/services/starter-posts.test.mjs` are a Bucket B item in Plan 38-01. The executor should verify whether `concept-feed.service.ts` STARTER_POSTS still say "EchoLearn" or were updated to "Trellis" in the v1.4 rebrand commit (`9e5d1f38`). If both are still "EchoLearn", annotate the test as a known drift; if the production strings say "Trellis" but the test says "EchoLearn", the test is a regression — fix it.

---

## Suggested Plan Boundaries

### Plan 38-01: `38-01-doc-cleanup-PLAN.md` (TECHDEBT-02 + 03 + 05)

**Tasks:**
1. Edit `34-VALIDATION.md` frontmatter: `status: draft → validated`, `nyquist_compliant: false → true`, `wave_0_complete: false → true`.
2. Edit `35-VALIDATION.md` frontmatter: `status: approved → validated` (one field only).
3. Edit `v1.4-ROADMAP.md` Phase 36 entry `**Plans:**` line to name 36-14 + 36-15 explicitly.
4. Run echolearn sweep; populate audit table in `38-01-SUMMARY.md`; annotate Bucket B items in `.planning/research/PITFALLS.md` with `(historical: pre-2026-05-07 brand)` notes.
5. Check starter-posts.test.mjs vs. concept-feed.service.ts STARTER_POSTS for "EchoLearn" drift; annotate or fix per finding.
6. Verify: grep assertions for TECHDEBT-02/03/05 all pass.

No automated test changes needed. Verification is grep-only.

### Plan 38-02: `38-02-youtube-short-removal-PLAN.md` (TECHDEBT-06)

**Tasks:**
1. Edit `app/src/types/index.ts`: remove `'short'` from `PresentationStyle` and `PostSnapshot.sourceType` unions.
2. Delete `probePortrait` function from `app/src/services/youtube.service.ts`; remove `isPortrait` call and `videoType` ternary; set `sourceType: 'video'` and `presentationStyle: 'video'` unconditionally.
3. Edit `app/src/services/concept-feed.service.ts`:
   - Remove `'short'` from `VALID_SOURCE_TYPES`.
   - Delete `SHORT_QUERY_MODIFIERS`; update `buildYoutubeQuery` signature.
   - Delete `shortAssignments` filter + for loop (lines ~826, ~1060–1113).
   - Simplify pre-validation pass (`a.style === 'video' || a.style === 'short'` → `a.style === 'video'`).
   - Remove/update `trellis_short_posts` localStorage reference.
4. Edit `app/src/services/style-assignment.ts`:
   - Remove `short: 0.10` from `STYLE_WEIGHTS`; add weight to `video` (→ `video: 0.20`).
   - Remove `weights.short` redistribution in the YouTube-unavailable block.
   - Remove `|| a.style === 'short'` from `reassignFailures`.
5. Edit `app/src/components/InfoFlow.tsx`:
   - Delete `isShortPost` and all branches.
   - Merge GAP-C tap-to-play emit into video thumbnail onClick.
   - Add title/teaser onClick for navigate-to-detail (D-02b hybrid).
   - Implement `aspect-ratio: auto` CSS for video card container (D-02a).
   - Remove `minHeight short` from the feed item wrapper.
6. Edit `app/src/screens/PostDetailScreen.tsx`: delete `if (post.sourceType === 'short') return;`.
7. Delete `infoFlow.shortTag` key from all 4 i18n bundles (en/zh/es/ja).
8. Update `post-essay.service.ts` to remove `trellis_short_posts` patch call (if present).
9. Update tests:
   - Rename `InfoFlow.short-tap-emit.test.mjs` → `InfoFlow.video-tap-emit.test.mjs`; update 4 assertions.
   - Update `style-assignment.test.mjs`: remove `'short'` from validStyles, update no-YouTube-key test, update `reassignFailures` test fixture.
   - Update `style-assignment-stratified.test.mjs`: remove `short` from counter and validStyles.
   - Update `refill-queue-integration.test.mjs` line 120 fixture.
   - Update `concept-quota.test.mjs` sourceType array.
   - Delete assertion at `post-essay.service.test.mjs:20`.
10. Add `app/tests/services/youtube-no-short-classification.test.mjs` (4 source-reading invariants).
11. Update CLAUDE.md "Phase 36 GAP-C" section: generalize the "Short tap-to-play emit" table row to cover `sourceType === 'video'` with thumbnail-as-tap-target; update rule 3 to note the rule transition.
12. Run `tsc -b --noEmit` (must exit 0) + `npm test` (≤3 failures).

### Plan 38-03: `38-03-device-uat-PLAN.md` (TECHDEBT-04)

**Tasks:**
1. Create `.planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` with `status: pending`, 2 test entries extracted from `33-VERIFICATION.md` human_verification section, OS matrix (iOS + Android), single `result:` field per test.
2. Hand off to operator: deploy APK; run Test 1 (touch targets) and Test 2 (React.memo behavioral correctness) on both iOS and Android; fill in result fields.
3. Operator updates `status: complete` when both tests pass.

This plan has zero automated tasks — it is a document creation + human handoff. Depends on Plan 38-02 landing first if any YouTube changes might affect feed behavior observed during UAT.

---

## Sources

### Primary (HIGH confidence)

- Direct source file reads: `app/src/types/index.ts`, `app/src/services/youtube.service.ts`, `app/src/services/concept-feed.service.ts`, `app/src/services/style-assignment.ts`, `app/src/components/InfoFlow.tsx`, `app/src/screens/PostDetailScreen.tsx`
- Direct VALIDATION file reads: `.planning/milestones/v1.4-phases/34-*/34-VALIDATION.md`, `.planning/milestones/v1.4-phases/35-*/35-VALIDATION.md`
- Direct test file reads: `app/tests/components/InfoFlow.short-tap-emit.test.mjs`, `app/tests/services/style-assignment.test.mjs`, `app/tests/services/style-assignment-stratified.test.mjs`
- CONTEXT.md, DISCUSSION-LOG.md, REQUIREMENTS.md, STATE.md
- `.planning/milestones/v1.4-ROADMAP.md` Phase 36 entry + Tech debt section
- `33-VERIFICATION.md` human_verification frontmatter — verbatim device test specs

### Secondary (MEDIUM confidence)

- Grep outputs across `app/src/` and `app/tests/` for `'short'`, `echolearn`, `isShortPost`, `probePortrait`

### Tertiary (LOW confidence)

- None — all findings verified from source files.

---

## Metadata

**Confidence breakdown:**
- TECHDEBT-02/03: HIGH — files read directly, exact line edits identified
- TECHDEBT-04: HIGH — verbatim source from 33-VERIFICATION.md, UAT shape from 37-HUMAN-UAT.md
- TECHDEBT-05: HIGH — comprehensive grep run across all surfaces
- TECHDEBT-06 blast radius: HIGH — every `'short'` occurrence found by grep and verified by file read
- D-02b implementation: MEDIUM — code shape for hybrid tap dispatch is architecturally clear but CSS `aspect-ratio: auto` browser behavior should be verified on Android Chromium at execute time

**Research date:** 2026-05-09
**Valid until:** 2026-06-08 (30 days; file structure stable)

---

## RESEARCH COMPLETE
