---
phase: 42-masonry-feed-layout
plan: 03
type: execute
wave: 2
depends_on: ["42-01"]
files_modified:
  - app/src/index.css
  - app/src/components/InfoFlow.tsx
autonomous: true
requirements: [MASONRY-01]
must_haves:
  truths:
    - "@keyframes card-slide-in block at app/src/index.css:504-507 is deleted"
    - "All 3 callsites in app/src/components/InfoFlow.tsx (lines 197, 329, 858) reference the keyframe are deleted"
    - "Zero occurrences of 'card-slide-in' anywhere under app/src/ after this plan (negative grep across the entire src tree)"
    - "framer-motion replaces all entrance animations (D-06: one animation system, not two)"
  artifacts:
    - path: "app/src/index.css"
      provides: "card-slide-in keyframe REMOVED"
    - path: "app/src/components/InfoFlow.tsx"
      provides: "3 animation callsites REMOVED"
  key_links: []
---

<objective>
Delete the `@keyframes card-slide-in` block from `app/src/index.css:504-507` AND all 3 of its callsites in `app/src/components/InfoFlow.tsx` (lines 197, 329, 858) per D-06.

Rationale: Plan 42-01 introduced framer-motion entrance animations on leaf tiles inside MasonryFeed. The legacy CSS `card-slide-in` keyframe (still firing on `MemoizedConceptCard.isActive`, `ConnectionCard.isActive`, and `InlineInfoFlow.shouldAnimate` callsites) would dueling-animate with framer-motion at the wrapper level. D-06 says "one animation system, not two." This plan removes the CSS path entirely.

Purpose: Close MASONRY-01's "framer-motion entrance animations apply to leaf <motion.div> cards only" invariant (SC-4) by eliminating the parallel CSS animation path. Required for the source-reading negative-grep test in plan 42-05 to pass.

Output: 1 keyframe block deleted from index.css; 3 inline-style `animation:` properties deleted from InfoFlow.tsx.

**Wave note:** This plan moved from Wave 1 to Wave 2 (depends_on: ["42-01"]) during revision iteration 1 to eliminate parallel-write race risk on `app/src/components/InfoFlow.tsx`. Plan 42-01 Task 1 adds 3 `export` keywords to InfoFlow.tsx (lines 573, 610, 700); this plan deletes 3 inline `animation:` properties on disjoint lines (197, 329, 858). The line ranges do not overlap, but serializing them eliminates any merge-conflict possibility and gives the executor a clean "Wave 1 done, then Wave 2" mental model.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/42-masonry-feed-layout/42-CONTEXT.md
@.planning/phases/42-masonry-feed-layout/42-RESEARCH.md
@.planning/phases/42-masonry-feed-layout/42-UI-SPEC.md

# Source files to read
@app/src/index.css
@app/src/components/InfoFlow.tsx

<interfaces>
**Exact lines to delete (verified 2026-05-09 via grep):**

`app/src/index.css:504-507`:
```css
@keyframes card-slide-in {
  /* keyframes definition lines */
}
```

`app/src/components/InfoFlow.tsx:197` (inside MemoizedConceptCard's isActive branch):
```tsx
animation: isActive ? 'card-slide-in 0.35s ease' : 'none',
```

`app/src/components/InfoFlow.tsx:329` (inside ConnectionCard's isActive branch):
```tsx
animation: isActive ? 'card-slide-in 0.35s ease' : 'none',
```

`app/src/components/InfoFlow.tsx:858` (inside InlineInfoFlow's items.map):
```tsx
animation: shouldAnimate ? `card-slide-in 0.3s ease ${Math.min(index, 5) * 0.05}s both` : undefined,
```
</interfaces>

<dependencies>
**Wave structure (revised 2026-05-09):**

| Wave | Plans | Notes |
|------|-------|-------|
| 1 | 42-01, 42-06 | Foundation — MasonryFeed skeleton + ROADMAP/REQUIREMENTS wording correction |
| 2 | 42-02, 42-03, 42-04 | All depend on 42-01 (MasonryFeed exports) |
| 3 | 42-05 | Source-reading invariant tests — depends on 42-01..42-04 |
| 4 | 42-07 | Phase close-out — depends on all prior |

This plan (42-03) sits in Wave 2 alongside 42-02 (HomeScreen swap) and 42-04 (VineBloomCard + i18n). All three modify disjoint regions of `app/src/components/InfoFlow.tsx` OR different files entirely:
- 42-02: edits HomeScreen.tsx (no InfoFlow.tsx edits)
- 42-03: edits InfoFlow.tsx lines 197, 329, 858 (animation property deletions) AND index.css
- 42-04: edits MasonryFeed.tsx + 4 locale bundles + i18n.d.ts (no InfoFlow.tsx edits)

42-03 is the only Wave-2 plan touching InfoFlow.tsx → no parallel-write conflict possible.
</dependencies>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete @keyframes card-slide-in from app/src/index.css</name>
  <files>app/src/index.css</files>
  <read_first>
    - app/src/index.css (read lines 500-512 to see the exact keyframe block + surrounding context)
  </read_first>
  <action>
    Delete the entire `@keyframes card-slide-in { ... }` block from `app/src/index.css` (currently at lines 504-507; verify the actual extent — keyframes typically span from `@keyframes name {` to the matching closing `}`).

    Concrete steps:
    1. Read `app/src/index.css` to find the exact boundaries (`@keyframes card-slide-in {` opening line, then read forward to the matching closing `}`).
    2. Delete the entire block including the surrounding blank line if it leaves a gap.
    3. Do NOT touch any other keyframe block. Other keyframes in this file (e.g., `vineLoadingPulse`, `pulseGreen`, `quickFade`, etc.) are load-bearing and must remain untouched.
    4. Verify zero behavioral CSS regression: this keyframe is only referenced from InfoFlow.tsx (Task 2 cleans those callsites).

    Atomic commit message: `refactor(42): delete @keyframes card-slide-in (D-06 — framer-motion replaces CSS entrance)`
  </action>
  <verify>
    <automated>! grep -q "card-slide-in" /Users/Code/EchoLearn/app/src/index.css</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "card-slide-in" app/src/index.css` returns `0`
    - `grep -c "@keyframes" app/src/index.css` returns the previous count minus 1 (only this one keyframe deleted; others preserved)
    - File still parses as valid CSS (sanity check via Vite build later — `cd app && npm run build` would expose CSS syntax errors; but tsc alone won't catch this)
  </acceptance_criteria>
  <done>card-slide-in keyframe removed from index.css; ready for callsite removal in Task 2.</done>
</task>

<task type="auto">
  <name>Task 2: Delete 3 card-slide-in animation callsites from app/src/components/InfoFlow.tsx</name>
  <files>app/src/components/InfoFlow.tsx</files>
  <read_first>
    - app/src/components/InfoFlow.tsx (read lines 190-205 for callsite 1; lines 320-335 for callsite 2; lines 850-865 for callsite 3 — see exact inline-style context for each)
    - .planning/phases/42-masonry-feed-layout/42-RESEARCH.md (Pitfall 7 lines 473-486 — explicit enumeration of all 3 callsites and the dueling-animation risk if any one survives)
  </read_first>
  <action>
    Delete all 3 `animation:` inline-style properties referencing `card-slide-in` in `app/src/components/InfoFlow.tsx`:

    **Callsite 1 (around line 197, inside MemoizedConceptCard's style object):**
    Delete this single line:
    ```tsx
    animation: isActive ? 'card-slide-in 0.35s ease' : 'none',
    ```
    Leave the surrounding style object intact. The `isActive` prop is consumed elsewhere in the card body (e.g., for image loading state), so DO NOT remove the prop itself or other references to it.

    **Callsite 2 (around line 329, inside ConnectionCard's style object):**
    Delete this single line:
    ```tsx
    animation: isActive ? 'card-slide-in 0.35s ease' : 'none',
    ```
    Same rule — leave the style object intact, leave `isActive` in scope.

    **Callsite 3 (around line 858, inside InlineInfoFlow's items.map render):**
    Delete this single line:
    ```tsx
    animation: shouldAnimate ? `card-slide-in 0.3s ease ${Math.min(index, 5) * 0.05}s both` : undefined,
    ```
    Same rule — leave the surrounding tile-wrapper style intact, leave `shouldAnimate` in scope (still used for `isActive={shouldAnimate}` prop pass to leaf cards).

    **DO NOT TOUCH:**
    - Any other line in InfoFlow.tsx
    - The 3 leaf card components themselves (`ConceptCard`, `ConnectionCard`, `MilestoneCard`)
    - Any other animation property in InfoFlow.tsx (e.g., transition properties on hover, scale animations on press — these are unrelated)
    - The `isActive` and `shouldAnimate` references that remain after the deletions
    - The 3 `export` keywords added by Plan 42-01 Task 1 at lines 573, 610, 700 (Wave 1 — already landed before this plan runs)

    **POST-DELETE CHECK:**
    - `grep -c "card-slide-in" app/src/components/InfoFlow.tsx` returns `0`
    - `grep -c "card-slide-in" app/src/` returns `0` (cross-tree — combined effect of Task 1 + Task 2)

    Atomic commit message: `refactor(42): delete 3 card-slide-in animation callsites in InfoFlow.tsx (D-06)`
  </action>
  <verify>
    <automated>! grep -q "card-slide-in" /Users/Code/EchoLearn/app/src/components/InfoFlow.tsx &amp;&amp; ! grep -rq "card-slide-in" /Users/Code/EchoLearn/app/src/ &amp;&amp; cd /Users/Code/EchoLearn/app &amp;&amp; npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "card-slide-in" app/src/components/InfoFlow.tsx` returns `0`
    - `grep -rc "card-slide-in" app/src/` returns `0` total across all files in the src tree
    - `cd app && npx tsc -b --noEmit` exits 0 (no TypeScript errors from removed inline-style property)
    - The 3 deletion sites left their surrounding style objects valid (no trailing commas left behind that breaks parsing — visual review of git diff)
    - `git diff --stat app/src/components/InfoFlow.tsx` shows changes confined to ~3 lines deleted (no other lines modified)
  </acceptance_criteria>
  <done>All references to card-slide-in are gone from app/src/. Cross-tree negative grep returns 0. Plan 42-05's source-reading invariant test (`tests/lib/no-card-slide-in.test.mjs`) will pass.</done>
</task>

</tasks>

<verification>
- `grep -rc "card-slide-in" app/src/` returns `0` (cross-tree negative grep — Pitfall 7 closed)
- `cd app && npx tsc -b --noEmit` exits 0
- Existing tests (`cd app && npm test`) baseline does not regress
</verification>

<success_criteria>
- 1 CSS keyframe block deleted from app/src/index.css
- 3 inline-style animation properties deleted from app/src/components/InfoFlow.tsx
- Zero remaining references to `card-slide-in` anywhere in app/src/
- D-06 satisfied: one animation system (framer-motion), not two
</success_criteria>

<output>
After completion, create `.planning/phases/42-masonry-feed-layout/42-03-SUMMARY.md` documenting:
- Final cross-tree grep result (0 occurrences)
- Atomic commit hashes for both tasks
- Note that plan 42-05 will add the source-reading test that locks this invariant
</output>
</content>
</invoke>