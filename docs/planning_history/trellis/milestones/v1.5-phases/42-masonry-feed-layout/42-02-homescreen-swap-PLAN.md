---
phase: 42-masonry-feed-layout
plan: 02
type: execute
wave: 2
depends_on: ["42-01"]
files_modified:
  - app/src/screens/HomeScreen.tsx
autonomous: true
requirements: [MASONRY-01, MASONRY-02]
must_haves:
  truths:
    - "HomeScreen renders <MasonryFeed> instead of <InlineInfoFlow> at the feed slot"
    - "The toast(t('home.toast.noMorePosts'), 'info') call at HomeScreen.tsx:240 is deleted (D-11)"
    - "HomeScreen computes allExplored locally from dailyReadService.getExploredAnchors() + questions.filter(q => q.isAnchorNode) and passes it as a prop to MasonryFeed (RESEARCH.md Pitfall 2 — allExplored is NOT a service property)"
    - "InlineInfoFlow remains exported from InfoFlow.tsx but is no longer wired at /home (D-01)"
  artifacts:
    - path: "app/src/screens/HomeScreen.tsx"
      provides: "MasonryFeed wired at /home; toast removed; allExplored computed locally"
      contains: "MasonryFeed"
  key_links:
    - from: "app/src/screens/HomeScreen.tsx"
      to: "app/src/components/MasonryFeed.tsx"
      via: "import { MasonryFeed }"
      pattern: "import.*MasonryFeed.*from.*['\"]\\.\\./components/MasonryFeed"
    - from: "app/src/screens/HomeScreen.tsx"
      to: "app/src/services/daily-read.service.ts + app/src/state/useQuestions.ts"
      via: "allExplored computation: anchors.length > 0 && anchors.every(a => exploredAnchors.includes(a.id))"
      pattern: "allExplored"
---

<objective>
Wire the MasonryFeed component (built in plan 42-01) into HomeScreen at the feed slot (currently `<InlineInfoFlow>` at `HomeScreen.tsx:824-832`). Delete the `toast(t('home.toast.noMorePosts'), 'info')` call at line 240 (D-11). Compute `allExplored` locally inside HomeScreen and pass it as a prop to MasonryFeed.

This is the user-visible cutover: after this plan lands, /home renders the 2-column masonry layout and shows nothing in place of the deleted toast (the celebration card lands in plan 42-04 and renders only when `allExplored && layout.nodes.length > 0`).

Purpose: Close MASONRY-01's user-visible portion (2-column layout active at /home). Delete the bare toast in preparation for MASONRY-02's celebration card replacement.

Output: Modified `app/src/screens/HomeScreen.tsx` — import swap, JSX swap, toast deletion, allExplored computation block.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/42-masonry-feed-layout/42-CONTEXT.md
@.planning/phases/42-masonry-feed-layout/42-RESEARCH.md
@.planning/phases/42-masonry-feed-layout/42-UI-SPEC.md

# Reference files
@app/src/screens/HomeScreen.tsx
@app/src/services/daily-read.service.ts

<interfaces>
From `app/src/screens/HomeScreen.tsx` (current state):
```typescript
// Line 7 — current import
import { InlineInfoFlow, type InfoFlowItem } from '../components/InfoFlow';

// Line 240 — toast call to DELETE
toast(t('home.toast.noMorePosts'), 'info');

// Line 824-832 — JSX site to swap
<InlineInfoFlow
  items={infoFlowItems}
  onOpenConnection={handleOpenConnection}
  showConnectionScores={settingsSnapshot.showConnectionScores}
  onOpenPost={(postId, post) => {
    navigate(`/posts/${postId}`, { state: { post } });
  }}
/>
```

From `app/src/components/MasonryFeed.tsx` (plan 42-01 output):
```typescript
export function MasonryFeed({
  items: InfoFlowItem[],
  onOpenConnection: (idA: string, idB: string) => void,
  showConnectionScores?: boolean,
  onOpenPost: (postId: string, post: DailyPost) => void,
  allExplored: boolean,  // NEW prop — computed by HomeScreen
}): JSX.Element
```

From `app/src/services/daily-read.service.ts`:
```typescript
dailyReadService.getExploredAnchors(): string[];  // returns array of anchor IDs explored today
```

From `app/src/state/useQuestions.ts`:
```typescript
const { questions } = useQuestions();
// each question has q.isAnchorNode boolean and q.id string
```

allExplored computation pattern (RESEARCH.md Pitfall 2 fix — verbatim):
```typescript
const exploredAnchors = dailyReadService.getExploredAnchors();
const anchors = questions.filter((q) => q.isAnchorNode);
const allExplored = anchors.length > 0 && anchors.every((a) => exploredAnchors.includes(a.id));
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Swap InlineInfoFlow → MasonryFeed import + JSX site, delete noMorePosts toast, add allExplored computation</name>
  <files>app/src/screens/HomeScreen.tsx</files>
  <read_first>
    - app/src/screens/HomeScreen.tsx (full read — need to understand the existing exploredAnchors state at lines 467-522 to avoid duplicating it; need to find where `questions` is in scope; need line 240 context for the else-branch handling)
    - .planning/phases/42-masonry-feed-layout/42-RESEARCH.md (§ Pitfall 2 lines 378-402 — exact allExplored computation; § 3 — scroll preservation already automatic, no new code needed)
    - .planning/phases/42-masonry-feed-layout/42-UI-SPEC.md (line 261-262 — allExplored gate condition)
    - .planning/phases/42-masonry-feed-layout/42-CONTEXT.md (D-11 — toast deletion)
    - app/src/components/MasonryFeed.tsx (verify the prop signature matches what HomeScreen passes)
  </read_first>
  <behavior>
    - Test 1: After edit, `grep -c "import.*InlineInfoFlow" app/src/screens/HomeScreen.tsx` returns 0
    - Test 2: After edit, `grep -c "import.*MasonryFeed" app/src/screens/HomeScreen.tsx` returns ≥1
    - Test 3: After edit, `grep -c "<InlineInfoFlow" app/src/screens/HomeScreen.tsx` returns 0
    - Test 4: After edit, `grep -c "<MasonryFeed" app/src/screens/HomeScreen.tsx` returns ≥1
    - Test 5: After edit, `grep -c "noMorePosts" app/src/screens/HomeScreen.tsx` returns 0
    - Test 6: After edit, `grep -c "allExplored" app/src/screens/HomeScreen.tsx` returns ≥1
    - Test 7: tsc -b --noEmit exits 0
    - Test 8: The else-branch at the former line 240 is either deleted entirely OR becomes a no-op comment (no toast call survives, no other side effect introduced)
    - Test 9: The InfoFlowItem type import stays (still needed for infoFlowItems typing)
  </behavior>
  <action>
    Make these EXACT edits to `app/src/screens/HomeScreen.tsx`:

    **EDIT 1 — Import swap (around line 7):**
    Change:
    ```typescript
    import { InlineInfoFlow, type InfoFlowItem } from '../components/InfoFlow';
    ```
    To:
    ```typescript
    import { type InfoFlowItem } from '../components/InfoFlow';
    import { MasonryFeed } from '../components/MasonryFeed';
    ```

    **EDIT 2 — Add allExplored computation BEFORE the JSX return.**
    Locate the existing `exploredAnchors` state in HomeScreen (search for `setExploredAnchors` — it already exists per RESEARCH.md § 3 line 400 reference to lines 514-522). The existing state already tracks explored anchors and re-syncs on `[location.pathname === '/home']`.

    Add this computation immediately before the `return` JSX (or in a useMemo if the executor judges that helps re-render perf — recommended `useMemo` to avoid recomputing on every render):

    ```typescript
    // Phase 42 MASONRY-02: Compute allExplored locally (RESEARCH.md Pitfall 2 — NOT a service property).
    // VineBloomCard renders only when allExplored && layout.nodes.length > 0; the layout.nodes>0 gate
    // lives inside VineBloomCard via useTrellisData (per plan 42-04 design).
    const allExplored = useMemo(() => {
      const anchors = questions.filter((q) => q.isAnchorNode);
      return anchors.length > 0 && anchors.every((a) => exploredAnchors.includes(a.id));
    }, [questions, exploredAnchors]);
    ```

    NOTE: The variable names `questions` and `exploredAnchors` MUST already exist in HomeScreen scope. If `exploredAnchors` is stored differently (e.g., as a Set or via a different name), use the actual variable name from HomeScreen.tsx. Read the file first to confirm. If `useMemo` is not already imported from 'react', add it to the import.

    **EDIT 3 — Delete the noMorePosts toast call (line 240 area).**

    Locate the `else` branch:
    ```typescript
    } else {
      toast(t('home.toast.noMorePosts'), 'info');
    }
    ```

    Replace with:
    ```typescript
    } else {
      // Phase 42 D-11: Toast removed; vine-bloom celebration card (plan 42-04) handles the
      // "no more posts" state via allExplored prop passed to MasonryFeed.
    }
    ```

    Keeping the else block as a documented no-op (rather than removing the entire `if/else` chain) preserves the surrounding control flow exactly. Do NOT introduce any new side effect inside the empty else.

    **EDIT 4 — JSX swap at line 824-832 area:**
    Change:
    ```tsx
    <InlineInfoFlow
      items={infoFlowItems}
      onOpenConnection={handleOpenConnection}
      showConnectionScores={settingsSnapshot.showConnectionScores}
      onOpenPost={(postId, post) => {
        navigate(`/posts/${postId}`, { state: { post } });
      }}
    />
    ```
    To:
    ```tsx
    <MasonryFeed
      items={infoFlowItems}
      onOpenConnection={handleOpenConnection}
      showConnectionScores={settingsSnapshot.showConnectionScores}
      onOpenPost={(postId, post) => {
        navigate(`/posts/${postId}`, { state: { post } });
      }}
      allExplored={allExplored}
    />
    ```

    **DO NOT TOUCH:** Any other line in HomeScreen.tsx. Specifically preserve:
    - The existing exploredAnchors state + resync useEffect at lines 467-522 (consumed by allExplored computation; CLAUDE.md "Always-mounted screens" rule)
    - The vine-loading-pulse SVG at lines 759-767 (referenced by plan 42-04 for VineBloomCard styling, but NOT moved or modified here)
    - The empty-state UI at lines 730-749 (different from allExplored — preserved unchanged per CONTEXT.md canonical_refs)
    - The other 3 toast calls in HomeScreen (only `home.toast.noMorePosts` is deleted)

    Atomic commit message: `feat(42): swap InlineInfoFlow → MasonryFeed at /home; delete noMorePosts toast (D-11); compute allExplored locally`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app &amp;&amp; ! grep -q "InlineInfoFlow" src/screens/HomeScreen.tsx &amp;&amp; grep -q "MasonryFeed" src/screens/HomeScreen.tsx &amp;&amp; ! grep -q "noMorePosts" src/screens/HomeScreen.tsx &amp;&amp; grep -q "allExplored" src/screens/HomeScreen.tsx &amp;&amp; npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "InlineInfoFlow" app/src/screens/HomeScreen.tsx` returns `0`
    - `grep -c "MasonryFeed" app/src/screens/HomeScreen.tsx` returns ≥ `2` (1 import + 1 JSX usage)
    - `grep -c "home.toast.noMorePosts" app/src/screens/HomeScreen.tsx` returns `0`
    - `grep -c "noMorePosts" app/src/screens/HomeScreen.tsx` returns `0` (no other reference)
    - `grep -c "allExplored" app/src/screens/HomeScreen.tsx` returns ≥ `2` (1 declaration + 1 prop pass)
    - `grep -c "type InfoFlowItem" app/src/screens/HomeScreen.tsx` returns ≥ `1` (type import preserved)
    - `cd app && npx tsc -b --noEmit` exits 0
    - The other toast calls in HomeScreen still exist (e.g., `grep -c "toast(" app/src/screens/HomeScreen.tsx` returns ≥ 1 — confirms only noMorePosts was removed)
  </acceptance_criteria>
  <done>HomeScreen renders MasonryFeed instead of InlineInfoFlow; the bare noMorePosts toast is gone; allExplored is computed locally and passed as a prop; tsc clean; ready for plan 42-04 to swap the placeholder VineBloomCard for the real one.</done>
</task>

</tasks>

<verification>
- `cd app && npx tsc -b --noEmit` exits 0
- `cd app && npm test` baseline does not regress (existing tests remain green)
- Existing `tests/components/InfoFlow.video-tap-emit.test.mjs` still passes (InfoFlow.tsx untouched in this plan)
- Manual UAT (deferred to phase close): /home renders 2-column layout; no toast appears when feed is exhausted; existing posts visible in cards
</verification>

<success_criteria>
- HomeScreen.tsx wires MasonryFeed in place of InlineInfoFlow
- noMorePosts toast deletion verified by negative grep
- allExplored is computed locally using `dailyReadService.getExploredAnchors()` + `questions.filter(q => q.isAnchorNode)` (RESEARCH.md Pitfall 2 — service does NOT expose allExplored)
- InlineInfoFlow remains exported from InfoFlow.tsx (de-wired but available for future surfaces per D-01)
</success_criteria>

<output>
After completion, create `.planning/phases/42-masonry-feed-layout/42-02-SUMMARY.md` documenting:
- The 4 edit locations and their final state
- Confirmation that the existing `exploredAnchors` state pattern was reused (no duplicate state introduced)
- Atomic commit hash
</output>
