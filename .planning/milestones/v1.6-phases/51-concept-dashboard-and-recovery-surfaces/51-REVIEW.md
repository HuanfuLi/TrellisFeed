---
phase: 51-concept-dashboard-and-recovery-surfaces
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - app/src/lib/anchor-resolution.ts
  - app/src/components/concept/LeafStateBadge.tsx
  - app/src/screens/AnchorDetailScreen.tsx
  - app/src/components/InfoFlow.tsx
  - app/src/screens/PostDetailScreen.tsx
  - app/src/screens/SavedScreen.tsx
  - app/src/screens/PodcastScreen.tsx
  - app/src/locales/en.json
  - app/src/locales/zh.json
  - app/src/locales/es.json
  - app/src/locales/ja.json
  - app/tests/lib/anchor-resolution.test.mjs
  - app/tests/screens/AnchorDetailScreen.recovery.test.mjs
  - app/tests/components/InfoFlow.badge-nav.test.mjs
  - app/tests/screens/SavedScreen.routeFilter.test.mjs
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 51: Code Review Report

**Reviewed:** 2026-05-19
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 51-01 ships a thin-enrichment pass that mostly respects its operator-locked
constraints: no `useConceptDashboard` hook, no 4-tab `AnchorDetailScreen` rebuild,
no Tailwind, inline-style + CSS-variable convention preserved, all 4 locale
bundles in parity (996 lines, identical key sets sampled), event-bus
subscriptions use the single `GRAPH_UPDATED` channel. The `LeafStateBadge`
component is well isolated, and the `resolveAnchorId` helper has the right
fixed-depth-walk semantics for the Trellis model.

The narrative review found two correctness BLOCKERs:

1. **`SavedScreen` race: Collections deep-link silently drops the concept
   filter.** The new mount effect calls `setFilterConcept(state.conceptFilterTitle)`
   AND `setActiveTab(state.openTab)` in the same tick. The pre-existing
   `[activeTab]` reset effect then fires on the new tab and `setFilterConcept(null)`,
   wiping the value Phase 51 just set. The link-out from
   `AnchorDetailScreen → "X in collections"` lands on the Collections tab with
   no filter active.

2. **`InfoFlow` badge-index drift after `isLikelyInternalId` filter.** The
   `.filter(t => !isLikelyInternalId(t)).map((title, idx) => …)` callback uses
   the **post-filter** index to look up `post.sourceQuestionIds[idx]`. If the
   filter drops a leading entry, the kept badge will navigate to the *previous*
   entry's anchor — or fail to resolve. Pre-Phase 51 the code only rendered a
   visual span, so the drift was invisible; Phase 51's tappable behavior turns
   it into a wrong-destination navigation bug.

Other findings cluster around: stale `computeLeafState` (omitted `fcMap` gives
a different state than `PlannerScreen`), UX inconsistency on the "in
collections" link target, missing `aria-label` on the `disabled` orphan
badges, performance concern that's out of v1 scope but flagged for visibility,
and a couple of low-cost polish issues.

## Critical Issues

### CR-01: SavedScreen tab-change reset wipes the route-state concept filter

**File:** `app/src/screens/SavedScreen.tsx:470-490` and `app/src/screens/SavedScreen.tsx:559-564`
**Issue:**
The Phase 51 mount effect consumes `{ conceptFilterTitle, openTab }` from
`location.state` and pre-applies both:
```ts
if (state.conceptFilterTitle) { setFilterConcept(state.conceptFilterTitle); }
if (state.openTab === '...') { setActiveTab(state.openTab); }
```
But the pre-existing tab-change reset effect at line 559 unconditionally clears
the filter chips whenever `activeTab` changes:
```ts
useEffect(() => {
  if (debounceRef.current) clearTimeout(debounceRef.current);
  setFilterConcept(null);     // ← wipes the concept filter just set
  setFilterSource(null);
  setFilterDate('all');
}, [activeTab]);
```
React schedules both state updates from the mount effect, commits them, then
re-runs the `[activeTab]` effect because `activeTab` flipped from `'saved'`
(default) to `'collections'`. That second pass calls `setFilterConcept(null)`,
silently dropping the route-state value.

Concrete user flow that breaks:
1. AnchorDetailScreen → tap "3 in collections" → navigates to
   `/saved` with `state = { conceptFilterTitle: 'Spaced Repetition', openTab: 'collections' }`.
2. SavedScreen mounts: filterConcept becomes `'Spaced Repetition'`, activeTab
   becomes `'collections'`.
3. Next render: tab-change effect runs (activeTab changed), filterConcept → null.
4. User lands on the Collections tab with NO filter chip visible.

The link-out's whole purpose — pre-applying the concept filter — is defeated.
The "Saved" deep-link is unaffected because activeTab stays `'saved'` (default),
so the tab-change effect doesn't re-fire. The "Collections" path is the only one
that triggers an `activeTab` mutation, so it's the only one that breaks. The
existing test `SavedScreen.routeFilter.test.mjs` only checks that
`setFilterConcept(state.conceptFilterTitle)` is *called*, not that the value
survives the next render — so this regression is invisible to the test suite.

**Fix:**
Either (a) make the tab-change reset effect aware of route-state initialization,
or (b) consume route state *after* committing the tab change. Option (b) is
cleaner:
```ts
useEffect(() => {
  const state = location.state as { conceptFilterTitle?: string; openTab?: string } | null;
  if (!state) return;
  let nextTab: Tab | null = null;
  if (state.openTab === 'saved' || state.openTab === 'liked' ||
      state.openTab === 'history' || state.openTab === 'collections') {
    nextTab = state.openTab;
  }
  if (nextTab && nextTab !== activeTab) {
    setActiveTab(nextTab);
  }
  // Set filter AFTER the activeTab change has flushed so the reset effect
  // doesn't wipe it. Use queueMicrotask or a follow-up effect keyed on a
  // pending-filter ref.
  if (state.conceptFilterTitle) {
    queueMicrotask(() => setFilterConcept(state.conceptFilterTitle!));
  }
  navigate(location.pathname, { replace: true, state: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```
Alternative: gate the tab-change reset on a `userInitiatedTabChange` flag the
mount effect can set to `false`. Whatever you pick, add a regression test that
asserts the chip is *visible* after mounting with `state.openTab === 'collections'`,
not just that the setter was invoked.

---

### CR-02: InfoFlow concept-badge uses post-filter index when reading sourceQuestionIds

**File:** `app/src/components/InfoFlow.tsx:297-327` (news branch) and `app/src/components/InfoFlow.tsx:495-532` (concept branch)
**Issue:**
Both badge-render branches do:
```ts
post.sourceQuestionTitles?.slice(0, N).filter(t => !isLikelyInternalId(t)).map((title, idx) => {
  const qaId = post.sourceQuestionIds?.[idx];   // ← idx is post-filter
  const anchorId = qaId ? resolveAnchorId(qaId) : null;
  …
})
```
`.filter()` re-indexes the array. After the filter, `idx` is 0 for the *first
surviving* title, regardless of its position in the original
`sourceQuestionTitles`. But `post.sourceQuestionIds` is *parallel* to the
unfiltered titles array — `sourceQuestionIds[0]` corresponds to
`sourceQuestionTitles[0]` (pre-filter).

Worked example for the concept branch (`slice(0, 2)`):
- `sourceQuestionTitles = ['anchor-abc', 'Spaced Repetition']`
- `sourceQuestionIds = ['qa-malformed', 'qa-real']`
- After `.filter(!isLikelyInternalId)`: `['Spaced Repetition']`
- `.map((title, idx) => …)` runs with `idx = 0`
- `qaId = post.sourceQuestionIds[0]` = `'qa-malformed'`
- `resolveAnchorId('qa-malformed')` resolves to the WRONG anchor (or null)
- Tapping the "Spaced Repetition" badge navigates to *another concept's*
  AnchorDetailScreen — or no-ops because the orphan path returned `null`.

Pre-Phase 51 the code only rendered a `<span>{title}</span>`, so the drift was
visually invisible. Phase 51 turns the badge into a navigation target, which
promotes the drift into an incorrect-destination bug. The chip-title filter
was added in `ca7ffd6a` precisely because the upstream pipeline occasionally
leaks internal IDs into `sourceQuestionTitles` (see comment lines 19-24) — so
the trigger is known to fire in production.

**Fix:**
Carry the original index across the filter by mapping to `[title, index]`
pairs first, *then* filtering. Apply to BOTH the news (line 297) and concept
(line 495) badge blocks:
```ts
{post.sourceQuestionTitles
  ?.slice(0, 2)
  .map((title, originalIdx) => ({ title, originalIdx }))
  .filter(({ title }) => !isLikelyInternalId(title))
  .map(({ title, originalIdx }) => {
    const qaId = post.sourceQuestionIds?.[originalIdx];   // ← parallel index
    const anchorId = qaId ? resolveAnchorId(qaId) : null;
    const leafSignal = getBadgeLeafSignal(qaId);
    return (
      <button key={originalIdx} …>
        {leafSignal === 'attention' && <span … />}
        {title}
      </button>
    );
  })}
```
Add a unit test covering the post-filter case: input
`['anchor-x', 'Real Concept']` + `['qa-1', 'qa-2']` → assert the rendered
badge's onClick navigates with anchorId derived from `qa-2` (not `qa-1`).

## Warnings

### WR-01: AnchorDetailScreen computes leaf state without fcMap — diverges from PlannerScreen

**File:** `app/src/screens/AnchorDetailScreen.tsx:88-93`
**Issue:**
```ts
// the optional fcMap arg is omitted here because the anchor screen is fine
// with the Question-level data — the trellis layout (PlannerScreen) uses
// the FlashCard override, this read-only badge does not.
const leafState = computeLeafState(anchor, qaChildren);
```
`trellis-state.service.ts:39-43` is explicit: *"Resolve best review data: prefer
FlashCard data (actually updated by review flow) over Question.reviewSchedule
(often stale at initial values)."* The Question-level `reviewSchedule` is the
stale source by design. After a review session, `FlashCard.reviewSchedule` is
updated; `Question.reviewSchedule` lags until the next classification/re-anchor.

Concrete user-visible inconsistency: a user reviews flashcards under a
`dying` anchor, marks them confident, and the planner's vine flips the leaf
to `green`. Tapping the anchor opens AnchorDetailScreen, which reads stale
Question-level data and shows the `dying` (amber) badge. The Flashcards CTA
also stays in recovery mode (amber #f59e0b background, "Review Now" label) —
contradicting the user's just-completed action.

The comment treats this as an intentional choice, but the operator-locked
"thin enrichment" framing presumes the new surfaces *agree with* the existing
trellis. Disagreement here is a UX bug, not a deferred concern.

**Fix:**
Build the fcMap the same way `useTrellisData` does and pass it through:
```ts
import { flashcardService } from '../services/flashcard.service';
// …
const fcMap = useMemo(() => {
  const map = new Map<string, ReviewSchedule>();
  for (const card of flashcardService.getAll()) {
    const existing = map.get(card.nodeId);
    if (!existing || card.reviewSchedule.reviewCount > existing.reviewCount) {
      map.set(card.nodeId, card.reviewSchedule);
    }
  }
  return map;
}, [/* re-run when FLASHCARDS_CREATED / REVIEW_COMPLETED fires — setTick already covers it */]);
const leafState = computeLeafState(anchor, qaChildren, undefined, fcMap);
```
If the fcMap build is too costly for every-render usage, gate it behind a
useMemo keyed on the tick counter you already track.

---

### WR-02: "in collections" link-out has count/target semantic mismatch

**File:** `app/src/screens/AnchorDetailScreen.tsx:399-406`
**Issue:**
The link reads "{{count}} in collections" where `count = conceptPosts.filter(p
=> collectionService.getPostCollections(p.id).length > 0).length` — i.e., the
number of *posts about this concept* that live in at least one collection.

But the link navigates to `/saved` with `openTab: 'collections'`, where the
Collections tab renders a list of **collections** (not posts). The user clicks
"3 in collections" expecting to see those 3 posts (or the collections that
contain them), and instead lands on a full list of all collections in the
library with — even after CR-01 is fixed — a concept-filter chip that has no
effect on the Collections tab (Collections rendering ignores `filtered` and
just maps `collections`).

Even with CR-01 fixed, the Collections tab UI has no surface for filtering
collections by which concept their member posts reference. So the link is
semantically broken as designed.

**Fix:** Either (a) drop the "in collections" link-out entirely until the
Collections tab gains concept filtering, or (b) change the link target to
`/saved?openTab=saved` with `conceptFilterTitle` so the user lands on the
Saved tab pre-filtered to the concept's posts (the same posts being counted).
Option (b) is closer to the user's intent because `saved` is post-shaped, but
the counter label would need to change to something like "{{count}} saved in
collections" to match.

---

### WR-03: Disabled orphan badges have no aria-label

**File:** `app/src/components/InfoFlow.tsx:300-326` and `app/src/components/InfoFlow.tsx:498-532`
**Issue:**
When `resolveAnchorId(qaId)` returns null, the badge renders as
`<button disabled>{title}</button>` with no onClick. Screen readers see a
disabled button with no aria-label explanation; users hear "Spaced Repetition,
dimmed button" but get no indication of why the button is non-actionable.
The amber-dot signal also has no text equivalent.

This is not a navigation bug, but it's a regression from a static `<span>`
(which screen readers treated as plain text) to an interactive `<button>` that
exposes a disabled state without semantic context.

**Fix:**
Add an `aria-label` for the disabled state and an `aria-label` describing the
leaf signal when present:
```ts
<button
  …
  disabled={!anchorId}
  aria-label={
    anchorId
      ? leafSignal === 'attention'
        ? t('home.feed.conceptBadgeAttention', { title })
        : t('home.feed.conceptBadge', { title })
      : t('home.feed.conceptBadgeOrphan', { title })
  }
>
```
Add the 3 keys to all 4 locale bundles.

---

### WR-04: AnchorDetailScreen reads from local-state `questions` (recent 50) while badge resolver reads full store

**File:** `app/src/screens/AnchorDetailScreen.tsx:73-74` and `app/src/screens/AnchorDetailScreen.tsx:98`
**Issue:**
`qaChildren` is derived from `questions` (returned by `useQuestions()`, which
populates from `questionService.getRecent(50)`). The `appearsIn` section then
builds `qaChildIdSet = new Set(qaChildren.map(q => q.id))` and filters
`postHistoryService.getPosts()` + `engagementService.getSavedPosts()` +
`podcastService.getAll()` against it.

For an anchor that pre-dates the most recent 50 questions:
- The anchor itself was already in `questions` (it has its own row from a more
  recent ask), but its child Q&As may have been pushed past the 50-cap.
- `qaChildren` is then a *partial* slice of the real children.
- `savedCount`, `inCollectionsCount`, `podcastCount` are all **undercounted**.
- The "Appears in" footer either hides (sum=0) or shows a smaller number than
  reality.

This is partly a pre-existing limitation of `useQuestions` (out of phase
scope), but Phase 51 is the first surface to expose a count that depends on
*all* of the anchor's Q&A children, so the symptom is new.

`InfoFlow.getBadgeLeafSignal` correctly uses
`questionService.getAll({ includeFlagged: true })` for the same reason —
AnchorDetailScreen should be aligned.

**Fix:**
Build `qaChildren` directly from the full store in AnchorDetailScreen, the
same way the InfoFlow helper does:
```ts
const allQ = questionService.getAll({ includeFlagged: true });
const qaChildren = allQ.filter((q) => q.parentId === anchor.id && !q.isAnchorNode);
```
Keep the `setTick` effect — it forces a re-read on GRAPH_UPDATED.

---

### WR-05: LeafStateBadge i18n key type-cast bypasses bundle-parity safety

**File:** `app/src/components/concept/LeafStateBadge.tsx:114`
**Issue:**
```ts
{t(v.i18nKey as 'graph.anchor.leafState.bud')}
```
The cast lies to TypeScript: it tells the compiler the key is *always*
`graph.anchor.leafState.bud`, when it's actually one of seven keys built into
the StateVisual table. If a future commit changes `'green'` to point at, say,
`'graph.anchor.leafState.healthy'` (an unrelated rename), the bundle-parity
test (`bundle-parity.test.mjs`) still passes because the key is referenced via
string, but the TS compiler also passes because of the cast — the missing-key
fallback (`missing-key.test.mjs`) is the only signal left.

Phase 27's whole point of the type-safe `t()` keys is to fail at compile time,
not at runtime. The cast defeats that.

**Fix:**
Build a constant tuple/record so TS keeps the keys honest:
```ts
const LEAF_STATE_I18N = {
  bud:      'graph.anchor.leafState.bud',
  green:    'graph.anchor.leafState.green',
  dying:    'graph.anchor.leafState.dying',
  falling:  'graph.anchor.leafState.falling',
  dead:     'graph.anchor.leafState.dead',
  blossom:  'graph.anchor.leafState.blossom',
  fruit:    'graph.anchor.leafState.fruit',
} as const;

// Then:
{t(LEAF_STATE_I18N[leafState])}
```
i18next's typed-keys derivation accepts string-literal types here without a
cast, restoring the compile-time check.

---

### WR-06: Test files claim per-mount one-shot but Strict Mode runs the effect twice

**File:** `app/tests/screens/SavedScreen.routeFilter.test.mjs:77-87` and `app/src/screens/SavedScreen.tsx:470-490`
**Issue:**
The route-state consume-and-clear effect runs with `useEffect(…, [])`. In
React Strict Mode (dev), `useEffect` runs twice on mount: first invocation
calls `setFilterConcept(state.conceptFilterTitle)` + `setActiveTab(state.openTab)`
+ `navigate(…, { replace: true, state: null })`. The cleanup runs (no-op), then
the effect re-runs. On the second pass, `location.state` is now `null` because
the first pass already cleared it — so the second pass is a no-op. That's
fine, but it depends on the `state: null` clear happening synchronously
*before* the re-mount's effect re-reads `location.state`.

react-router-dom v7's `useLocation()` updates `location` reactively after
`navigate({ replace })`. The closure inside the `[]`-deps effect captures the
*first-pass* location, so the second invocation still reads the cleared
location — i.e., `state === null`. But this is undocumented behavior the test
suite doesn't cover. The same Strict-Mode double-mount pattern in PodcastScreen
(line 56-74) inherits the same fragility.

**Fix:**
Add an explicit consumption guard to make the second-pass no-op intentional:
```ts
const consumedRef = useRef(false);
useEffect(() => {
  if (consumedRef.current) return;
  consumedRef.current = true;
  const state = location.state as { … } | null;
  if (!state) return;
  // …
}, []);
```
Add a test that imports `StrictMode` + the screen and asserts only one
`navigate(replace)` call fires per mount.

## Info

### IN-01: AnchorDetailScreen recomputes 4 services per render

**File:** `app/src/screens/AnchorDetailScreen.tsx:97-112`
**Issue:**
Per-render `postHistoryService.getPosts()` (sorted), `engagementService.getSavedPosts()`,
`collectionService.getPostCollections(p.id)` for each conceptPost,
`podcastService.getAll()` — all of these are localStorage parses. With the
`setTick` subscription on 6 event types, this fires on every save/like/review/
podcast event in the app, not just events relevant to this anchor. Out of v1
scope (performance), but worth memoizing on the tick counter when revisiting.

**Fix:** Wrap the appears-in calculations in `useMemo(() => …, [tick, anchor.id, qaChildren])`.

---

### IN-02: Inline LIGHT/DARK theme arrays duplicated in PostDetailScreen and InfoFlow

**File:** `app/src/screens/PostDetailScreen.tsx:886-905` and `app/src/components/InfoFlow.tsx:49-71`
**Issue:**
Two identical 8-entry theme arrays are inlined in both files. Phase 51 didn't
introduce them, but the diff touches both files and the duplication is now
visible.

**Fix:** Extract `TEXT_ART_THEMES_LIGHT/DARK` to a shared module (e.g.,
`src/lib/text-art-themes.ts`). Out of phase 51 scope to fix now, but worth a
follow-up ticket.

---

### IN-03: `linkBtnStyle` redeclared every render

**File:** `app/src/screens/AnchorDetailScreen.tsx:135-143`
**Issue:**
`linkBtnStyle` is a plain const inside the component body — re-created on
every render. Cheap, but unnecessary; hoist to module scope or `useMemo`.

**Fix:** Move the literal outside the component (no closure dependency).

---

### IN-04: `Object.keys(rest).length > 0` shape check in PodcastScreen omits an empty-but-not-null case

**File:** `app/src/screens/PodcastScreen.tsx:69-72`
**Issue:**
```ts
const { conceptFilterQaIds: _qa, conceptTitle: _ct, ...rest } = state;
navigate(location.pathname, { replace: true, state: Object.keys(rest).length > 0 ? rest : null });
```
If `state` is `{ conceptFilterQaIds: [...], conceptTitle: 'X' }` (the common
case), `rest` is `{}` and we pass `null` — fine. If state has other unknown
fields, they're preserved. But unrelated boolean/null fields like
`{ conceptFilterQaIds: [...], someFlag: false }` would result in `rest =
{ someFlag: false }` which passes the `length > 0` gate and re-stamps. Minor
ambiguity; harmless for the current shape.

**Fix:** N/A — current behavior is correct for the documented inputs.
Future maintainers should keep route-state keys flat and known.

---

_Reviewed: 2026-05-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
