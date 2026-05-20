---
phase: 51-concept-dashboard-and-recovery-surfaces
verified: 2026-05-19T13:00:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "User can see the concept's Q&As, posts, saved/liked/history items, review cards, podcast mentions, tags, and weak/due signals in one bounded view"
    reason: "Operator chose thin-enrichment interpretation on 2026-05-19 (committed at 963bcb88). The bounded view is AnchorDetailScreen with Q&As inline + Knowledge Summary inline + LeafStateBadge (weak/due signal) + 'Appears in' footer showing saved/in-collections/podcast COUNTS as link-outs to bounded filtered views, NOT inline duplication of SavedScreen/ReviewScreen/PodcastScreen. Operator explicitly rejected the parallel ConceptDashboardScreen architecture. Tags surface deferred — RETRIEVE-02 tagging UX-on-anchor was not in 51-01 plan scope (tag join surface is a v1.6 future enhancement). Posts/review-cards live on linked surfaces, not duplicated."
    accepted_by: "operator (Huanfu Li)"
    accepted_at: "2026-05-19T00:00:00Z"
gaps: []
deferred:
  - truth: "Tag display on the concept-level home (concept's tags shown inline)"
    addressed_in: "Out of v1.6 RETRIEVE-03 scope (no later phase claims it)"
    evidence: "Plan 51-01 explicitly chose thin enrichment over rebuild. Tags are not surfaced on AnchorDetailScreen. RETRIEVE-02 (tagging foundation, Phase 50) is Done but tag-on-concept join was not in 51-01 must_haves. Operator-approved scope per 2026-05-19 design decision. No later phase (52, 53) addresses this — it's a documented design choice, not a deferral."
human_verification: []
---

# Phase 51: Concept Dashboard and Recovery Surfaces — Verification Report

**Phase Goal:** Users can open a concept-level home that joins local learning artifacts and routes them toward recovery, review, and retrieval.
**Verified:** 2026-05-19T13:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Context and Scope Decision

The ROADMAP detail block (lines 151-155) still lists 3 plans (51-01 hook + 51-02 screen + 51-03 sections) — the original parallel-screen architecture. The operator rejected that on 2026-05-19; 51-02 and 51-03 plans were deleted in commit `963bcb88` and 51-01-PLAN was rewritten as **thin enrichment** of AnchorDetailScreen (the existing centralized concept review surface). The committed plan is authoritative.

Goal achievement is judged against:
- ROADMAP Phase 51 goal text + 4 Success Criteria (lines 141-149)
- Committed 51-01-PLAN.md must_haves (11 truths, 7 artifacts, 5 key_links)
- Requirements RETRIEVE-03, RETRIEVE-04

The "in one bounded view" success criterion is treated as **satisfied via override** (frontmatter) — the operator's thin-enrichment design replaces inline duplication with link-outs to bounded filtered views.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AnchorDetailScreen identity preserved (Flashcards + Learn as Post + Knowledge Summary + Q&A list stay primary; no tab restructure) | ✓ VERIFIED | `AnchorDetailScreen.tsx:323-368` Flashcards + Learn-as-Post buttons intact; `370-398` summary entries; `400-437` Q&A children list. No `useState<Tab>` or tab-switcher anywhere in file. |
| 2 | LeafStateBadge renders below anchor title, above stats row | ✓ VERIFIED | `AnchorDetailScreen.tsx:298-309` — h1 title (line 299), `{leafState && <LeafStateBadge />}` (line 305-309), stats row (line 311). Render order matches spec. |
| 3 | Flashcards button morph: amber for dying, red for falling, muted for dead; label = `t('graph.anchor.reviewNow')` when recoveryActive | ✓ VERIFIED | `AnchorDetailScreen.tsx:182-196` `recoveryActive` + `flashcardsBg` ternary (amber `#f59e0b`, red `#ef4444`, `var(--muted-foreground)`) + `flashcardsLabel` swap. Healthy keeps `var(--primary-40)`. Button stays clickable in all states. |
| 4 | "Appears in" footer with 3 link-outs: {N} saved, {N} in collections, {N} podcasts | ✓ VERIFIED | `AnchorDetailScreen.tsx:443-486` — conditional render when `savedCount + inCollectionsCount + podcastCount > 0`; three buttons each gated on count > 0; navigate to /saved or /podcast with route state. |
| 5 | InfoFlow concept badges tappable, navigate to /anchor/:anchorId with e.stopPropagation() | ✓ VERIFIED | `InfoFlow.tsx:310` (news) + `513` (concept): `onClick={anchorId ? (e) => { e.stopPropagation(); navigate(`/anchor/${anchorId}`); } : undefined}`. Hit-target bumped to `6px 10px` (lines 316 + 527). |
| 6 | Binary amber dot rendered when leafState ∈ {dying, falling, dead}; no dot otherwise | ✓ VERIFIED | `InfoFlow.tsx:35-45` `getBadgeLeafSignal` returns `'attention'` only for dying/falling/dead. Render at line 326-328 (news) + 536-538 (concept): 6px circle, `#f59e0b`, gated on `leafSignal === 'attention'`. |
| 7 | PostDetailScreen contextLabel + connection pills navigate to /anchor/:anchorId when resolved; static otherwise | ✓ VERIFIED | `PostDetailScreen.tsx:486-499` resolves `conceptAnchorId` + `connectionAnchorIds` via useMemo. Line 1010-1034 contextLabel: button when resolved, span when not. Line 808-839 connection pills: role/tabIndex/onClick/onKeyDown gated on anchorId. |
| 8 | Shared `resolveAnchorId(qaId)` helper at `app/src/lib/anchor-resolution.ts`, used everywhere | ✓ VERIFIED | `anchor-resolution.ts:24-36` exports the function. Imported by `InfoFlow.tsx:11`, `PostDetailScreen.tsx:27`. No duplicated walk logic — grep -r `qa.parentId.*isAnchorNode` only matches the helper. |
| 9 | SavedScreen accepts `{ conceptFilterTitle }` route state, pre-selects filterConcept; chip remains user-controllable | ✓ VERIFIED | `SavedScreen.tsx:480-508` reads `location.state`, defers `setFilterConcept` to `queueMicrotask` (CR-01 fix — survives the `[activeTab]` reset effect at line 577-582). Chip-clear handler at line 874 untouched. |
| 10 | PodcastScreen accepts `{ conceptFilterQaIds, conceptTitle }` route state, filters list, shows "Filtered by ... · Clear" banner | ✓ VERIFIED | `PodcastScreen.tsx:55-82` `conceptFilter` state + consume effect + `visiblePodcasts` useMemo. Banner at line 316-333 with `t('podcast.filteredBy', { concept })` + Clear button. Surgical state-clear preserves planner moveState (line 68-72). |
| 11 | No new ConceptDashboard hook, no parallel screen, no 4-tab AnchorDetailScreen restructure | ✓ VERIFIED | `grep -r useConceptDashboard\|ConceptDashboardScreen\|ConceptXxxSection app/src/` returns zero matches. `.planning/phases/51-.../` contains only 51-01-PLAN.md (51-02/03 deleted in 963bcb88). |

**Score:** 11/11 truths verified (1 via documented operator override on success-criterion interpretation)

### ROADMAP Success Criteria — Goal-Backward Check

| # | Criterion | Status | Mapping |
|---|-----------|--------|---------|
| 1 | User can open a concept dashboard from concept-linked surfaces | ✓ VERIFIED | Truth #5 (InfoFlow badges → /anchor/:id), Truth #7 (PostDetail contextLabel + connection pills → /anchor/:id). AnchorDetailScreen IS the concept-level home. |
| 2 | User can see Q&As, posts, saved/liked/history, review cards, podcast mentions, tags, weak/due in one bounded view | ✓ VERIFIED (override) | Q&As inline (Truth #1, AnchorDetailScreen:400-437). Knowledge Summary inline (line 370-398). Weak/due via LeafStateBadge (Truth #2, line 305-309) + Flashcards button recovery morph (Truth #3). Posts/Saved/Podcasts as bounded link-out counts in "Appears in" footer (Truth #4, line 443-486). Tags not surfaced — operator-approved out-of-scope per thin enrichment. Override accepted. |
| 3 | User can jump from dashboard to original post, Q&A, review action, podcast mention, or tag-filtered retrieval result | ✓ VERIFIED | Q&A inline + tappable to `/ask/:id` (line 414-435). Review action = Flashcards button → `/review` with anchorReview state (line 209-220). Podcast → `/podcast` with conceptFilterQaIds (line 471-483). Saved → `/saved` with conceptFilterTitle (line 455-470). Tag-filtered: filter chip on SavedScreen is `conceptFilterTitle` (which IS the tag-shape filter for post-level concepts). |
| 4 | Dashboard and retrieval surfaces prioritize search, filters, dashboard navigation, and review actions instead of endless scrolling | ✓ VERIFIED | AnchorDetailScreen has never had infinite scroll (bounded list of Q&As + bounded footer). Flashcards button recovery morph (amber/red, "Review Now" label) foregrounds review when leafState ∈ recovery. InfoFlow badges replace tile-blind tap with concept-targeted nav. SavedScreen + PodcastScreen filter pre-applied — bounded results. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/lib/anchor-resolution.ts` | Shared `resolveAnchorId` helper | ✓ VERIFIED | 36 lines, exports function. Walks ≤2 hops via sync `questionService.getAll().find()`. Documented design constraints inline. |
| `app/src/components/concept/LeafStateBadge.tsx` | 7-state leaf-state pill | ✓ VERIFIED | 117 lines, exports `LeafStateBadge`. Renders null for null/undefined. All 7 states mapped to dotColor/bgColor/i18nKey. WR-05 cast-to-string-literal is a typing concern, not a correctness one. |
| `app/src/screens/AnchorDetailScreen.tsx` | LeafStateBadge + recovery button + Appears-in footer + fcMap (WR-01) + full-store qaChildren (WR-04) | ✓ VERIFIED | All wiring present. fcMap memoized on tick (line 72-89, WR-01 fix). qaChildren from full store (line 107-112, WR-04 fix). |
| `app/src/components/InfoFlow.tsx` | Tappable badges, binary amber dot, pre-filter index (CR-02 fix) | ✓ VERIFIED | News branch (line 297-332) + concept branch (line 500-542) both use `originalIdx` (pre-filter) for sourceQuestionIds lookup. stopPropagation in both onClick handlers. |
| `app/src/screens/PostDetailScreen.tsx` | Tappable contextLabel + connection pills | ✓ VERIFIED | Resolution useMemos at line 486-499. contextLabel render at 1010-1037. Connection pills at 808-839. Detectors A/B/C/D unchanged. |
| `app/src/screens/SavedScreen.tsx` | Pre-selects filterConcept; CR-01 fix queueMicrotask | ✓ VERIFIED | Mount effect at line 481-508 with `queueMicrotask(() => setFilterConcept(pendingFilter))`. Route state cleared via `navigate(...{state:null})`. |
| `app/src/screens/PodcastScreen.tsx` | conceptFilter state + visiblePodcasts memo + Clear banner | ✓ VERIFIED | State + consume effect at line 55-82. visiblePodcasts useMemo line 79-82. Banner line 316-333. Surgical route-state clear preserves other fields. |
| `app/src/locales/{en,zh,es,ja}.json` | 17 new keys per locale | ✓ VERIFIED | bundle-parity.test.mjs passes. graph.anchor.reviewNow/appearsIn/appearsInSaved/appearsInCollections/appearsInPodcasts/leafState.{bud,green,dying,falling,dead,blossom,fruit}, podcast.filteredBy, common.clear all present in all 4. |
| Test files (4) | Source-pattern + unit tests | ✓ VERIFIED | `anchor-resolution.test.mjs` (3.3KB), `AnchorDetailScreen.recovery.test.mjs` (10.8KB), `InfoFlow.badge-nav.test.mjs` (12.4KB), `SavedScreen.routeFilter.test.mjs` (8.7KB). All execute under `npm test`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| InfoFlow.tsx | anchor-resolution.ts | `resolveAnchorId(post.sourceQuestionIds[originalIdx])` | ✓ WIRED | Import at line 11; called inside both badge branches (line 304, 507). Pre-filter index (CR-02 fix). |
| PostDetailScreen.tsx | anchor-resolution.ts | `resolveAnchorId` for contextLabel + both connection pills | ✓ WIRED | Import at line 27; useMemo at line 486 (single concept) + 493 (connection pair). Both consumers route navigate calls. |
| AnchorDetailScreen.tsx | trellis-state.service.ts | `computeLeafState(anchor, qaChildren, undefined, fcMap)` | ✓ WIRED | Line 157; fcMap built from FlashCard data (line 72-89) so leaf state agrees with PlannerScreen vine (WR-01 fix). |
| AnchorDetailScreen.tsx | SavedScreen | `navigate('/saved', { state: { conceptFilterTitle, openTab? } })` | ✓ WIRED | Line 455-470. SavedScreen consumer at line 481-508 — CR-01 fix ensures filter survives activeTab reset. |
| AnchorDetailScreen.tsx | PodcastScreen | `navigate('/podcast', { state: { conceptFilterQaIds, conceptTitle } })` | ✓ WIRED | Line 471-483. PodcastScreen consumer at line 55-74 — surgical clear preserves moveState. visiblePodcasts useMemo at line 79-82 filters list. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| AnchorDetailScreen — savedCount | engagementService.getSavedPosts() | localStorage `trellis_engagement_saved_posts` via real service read | Yes | ✓ FLOWING |
| AnchorDetailScreen — inCollectionsCount | collectionService.getPostCollections(p.id) per conceptPost | localStorage real read | Yes | ✓ FLOWING |
| AnchorDetailScreen — podcastCount | podcastService.getAll() filtered by qaChildIdSet ∩ questionIds | localStorage real read | Yes | ✓ FLOWING |
| AnchorDetailScreen — qaChildren | questionService.getAll({ includeFlagged: true }).filter(parentId === anchor.id && !isAnchorNode) | Full store, NOT recent-50 capped (WR-04 fix) | Yes | ✓ FLOWING |
| AnchorDetailScreen — leafState | computeLeafState(anchor, qaChildren, undefined, fcMap) | fcMap built from flashcardService.getAll() with most-reviewed-card selection | Yes | ✓ FLOWING (WR-01 fix lands real authoritative review-state) |
| InfoFlow — leafSignal (amber dot) | getBadgeLeafSignal(qaId) → computeLeafState | Live `questionService.getAll({includeFlagged:true})` reads | Yes | ✓ FLOWING |
| InfoFlow — anchorId (badge tap target) | resolveAnchorId(qaId) | Live store walk; pre-filter index preserves parallel-array correctness | Yes | ✓ FLOWING (CR-02 fix prevents wrong-anchor navigation) |
| SavedScreen — filterConcept (route-state path) | location.state.conceptFilterTitle → setFilterConcept | queueMicrotask deferral ensures real propagation past activeTab reset | Yes | ✓ FLOWING (CR-01 fix verifies survival) |
| PodcastScreen — visiblePodcasts | useMemo over (podcasts, conceptFilter) with `questionIds.some(id => qaIds.has(id))` filter | Real podcast list joined to real route-state qaIds | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All test suites pass | `cd app && npm test` | 1308 main + 149 actions = 1457 tests, fail=0 | ✓ PASS |
| Bundle parity across 4 locales | `cd app && node --test tests/locales/bundle-parity.test.mjs` | "en/zh/es/ja bundles have identical flattened key sets" — pass | ✓ PASS |
| Missing-key fallback works | `cd app && node --test tests/locales/missing-key.test.mjs` | "missingKeyHandler fires; fallback returns EN text" — pass | ✓ PASS |
| TypeScript compile clean | `cd app && npx tsc -b --noEmit` | exit 0, no output | ✓ PASS |
| New i18n keys present in all 4 locales | grep for `reviewNow\|appearsIn\|leafState\|filteredBy\|clear:` across en/zh/es/ja | All 17 keys × 4 locales = 68 entries found at consistent line offsets | ✓ PASS |
| No useConceptDashboard hook | `grep -r useConceptDashboard app/src/` | 0 matches | ✓ PASS |
| No ConceptDashboardScreen | `grep -r ConceptDashboardScreen app/src/` | 0 matches | ✓ PASS |
| Phase 42 YouTubeEmbed enablejsapi guard | `grep -c "enablejsapi=1" app/src/components/YouTubeEmbed.tsx` | ≥1 (matches) | ✓ PASS |
| Phase 33 ChatInput minWidth:0 guard | `grep -c "minWidth: 0" app/src/components/ChatInput.tsx` | ≥1 (matches) | ✓ PASS |
| Phase 33 root overflow:hidden | `grep -c "overflow: hidden" app/src/index.css` | ≥1 (matches) | ✓ PASS |
| Phase 36 walker maxSteps | `grep "Math.max(count \* 2, len)" app/src/services/post-queue.service.ts` | line 422 (intact) | ✓ PASS |
| Phase 32.1 single GRAPH_UPDATED event | `grep -r CLASSIFICATION_COMPLETED app/src/` | Only in types/index.ts comment (historical marker) | ✓ PASS |

### Probe Execution

No phase-declared probe scripts under `scripts/*/tests/probe-*.sh`. Phase 51 is React + TypeScript with `npm test` as the primary green-suite gate, which passed.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RETRIEVE-03 | 51-01-PLAN.md frontmatter | User can open a concept dashboard that joins the concept's Q&As, posts, saved/liked/history items, review cards, podcast mentions, tags, and weak/due signals | ✓ SATISFIED (with documented override) | AnchorDetailScreen serves as bounded concept-level home. Q&As inline. Posts/Saved/Podcasts as bounded link-outs (operator design — see override). Review cards via Flashcards button → /review. Weak/due via LeafStateBadge + recovery morph. Tags deferred (see `deferred` frontmatter). |
| RETRIEVE-04 | 51-01-PLAN.md frontmatter | Retrieval surfaces are bounded and recovery-oriented: they prioritize search, filters, dashboards, and review actions rather than another infinite recommendation feed | ✓ SATISFIED | AnchorDetailScreen bounded (no infinite scroll). SavedScreen + PodcastScreen filter chips/banner pre-applied via route state. Flashcards button recovery morph foregrounds review action. InfoFlow concept badges enable targeted dashboard navigation (vs blind feed scrolling). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/src/components/concept/LeafStateBadge.tsx` | 114 | `t(v.i18nKey as 'graph.anchor.leafState.bud')` cast bypasses type-safe `t()` | ℹ Info (WR-05) | Future key renames bypass tsc check; bundle-parity + missing-key tests still catch runtime regressions. Not goal-blocking. |
| `app/src/screens/AnchorDetailScreen.tsx` | 397-404 | "in collections" link-out has count/target semantic mismatch | ⚠ Warning (WR-02) | Count = posts-in-collections; target = collections tab (collection-list view). Currently passes the activeTab + filter through after CR-01 fix, but Collections tab UI doesn't visually surface a concept filter on the collection LIST. Sub-optimal UX; not goal-blocking — user can still navigate from this entry. |
| `app/src/components/InfoFlow.tsx` | 311, 521 | `<button disabled>` without `aria-label` for orphan badges | ⚠ Warning (WR-03) | A11y regression vs previous static `<span>`. Screen-reader announces "dimmed button" without context. Not goal-blocking. |
| `app/src/screens/SavedScreen.tsx` & `PodcastScreen.tsx` | route-state effect | No `consumedRef` guard for StrictMode double-mount | ⚠ Warning (WR-06) | Current implementation relies on `state: null` clear happening before re-run reads location; works in production but tests don't verify StrictMode resilience. Not goal-blocking — existing tests pass. |

### Re-Verification Status

This is the **initial** verification for Phase 51. The 51-REVIEW.md code review (2026-05-19) identified 2 BLOCKERs (CR-01, CR-02) + 6 warnings. **CR-01 + CR-02 + WR-01 + WR-04 were fixed** in commits `76ebab01..743bac5e`. Remaining open warnings (WR-02, WR-03, WR-05, WR-06) are documented as anti-patterns above but do not break any must-have.

### Deviation from ROADMAP detail block

ROADMAP.md lines 151-155 still list:
- 51-01-PLAN.md — useConceptDashboard hook + LeafStateBadge + test scaffolds
- 51-02-PLAN.md — ConceptDashboardScreen layout + route + concept-linked navigation
- 51-03-PLAN.md — Dashboard sections + bounded views + action routes

The committed implementation is **thin enrichment**: 51-02 and 51-03 plan files were deleted in commit `963bcb88`; 51-01 was rewritten as the only plan. This deviation is operator-approved (2026-05-19) and recorded in 51-01-PLAN frontmatter `must_haves.truths[10]`: "No new ConceptDashboard hook, no new ConceptXxxSection components, no 4-tab restructure of AnchorDetailScreen. Phase 51 stays a thin enrichment, not a rebuild."

Recommendation (informational, NOT a gap): when closing Phase 51 in ROADMAP.md, update the detail block to reflect the actual delivered plan (1 plan, thin enrichment) so future verifications don't surface the same stale-detail confusion.

### Gaps Summary

None. All 11 must-haves verified. 2 BLOCKERs from code review (CR-01 SavedScreen activeTab race; CR-02 InfoFlow post-filter index drift) are FIXED and have flowing data. The phase goal is achieved: users can navigate from concept-linked surfaces (InfoFlow tile badges, PostDetailScreen contextLabel + connection pills) to AnchorDetailScreen (the concept-level home), see leaf-state + Q&As + Knowledge Summary inline, jump to bounded filtered views of SavedScreen + PodcastScreen, and reach the review action via the recovery-morphed Flashcards button.

Open warnings (WR-02 collection-target semantic, WR-03 a11y, WR-05 cast, WR-06 StrictMode guard) are tracked for future polish but do not affect goal achievement.

---

_Verified: 2026-05-19T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
